import os
import hmac
import hashlib
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Header, Request
from sqlalchemy.orm import Session

from backend.app.db.database import get_db
from backend.app.db.seed import DEMO_PROJECT_ID
from backend.app.github.client import (
    GitHubClient,
    GitHubAuthError,
    GitHubPermissionError,
    GitHubNotFoundError,
    GitHubConflictError,
    GitHubError,
)
from backend.app.github.schemas import (
    GitHubConnectRequest,
    GitHubConnectionStatusResponse,
    GitHubRepositoryResponse,
    GitHubBranchItem,
    GitHubCommitItem,
    GitHubPullRequestItem,
    GitHubContributionItem,
    PublishProposalResponse,
    RefreshPRResponse,
)
from backend.app.github.repository import RepositoryService
from backend.app.github.branches import BranchService
from backend.app.github.commits import CommitService
from backend.app.github.pull_requests import PullRequestService
from backend.app.github.contribution_service import ContributionService
from backend.app.websocket.manager import ws_manager

logger = logging.getLogger("coframe.github.api")
router = APIRouter(prefix="/github", tags=["github"])


@router.get("/status", response_model=GitHubConnectionStatusResponse)
async def get_github_status(
    project_id: str = Query(DEMO_PROJECT_ID),
    db: Session = Depends(get_db),
):
    """Returns current GitHub configuration and repository connection status."""
    service = RepositoryService(db)
    return await service.get_connection_status(project_id)


@router.post("/connect", response_model=GitHubConnectionStatusResponse)
async def connect_repository(
    body: GitHubConnectRequest,
    project_id: str = Query(DEMO_PROJECT_ID),
    db: Session = Depends(get_db),
):
    """Validates and connects a repository to the project."""
    service = RepositoryService(db)
    try:
        conn = await service.connect_repository(
            project_id=project_id,
            owner=body.owner,
            repository_name=body.repository_name,
            default_branch=body.default_branch,
        )

        await ws_manager.broadcast(project_id, {
            "type": "GITHUB_REPOSITORY_CONNECTED",
            "repository": conn.repository_full_name,
            "default_branch": conn.default_branch,
        })

        return await service.get_connection_status(project_id)
    except GitHubAuthError as e:
        raise HTTPException(status_code=401, detail=e.message)
    except GitHubPermissionError as e:
        raise HTTPException(status_code=403, detail=e.message)
    except GitHubNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
    except GitHubError as e:
        raise HTTPException(status_code=400, detail=e.message)


@router.delete("/disconnect")
async def disconnect_repository(
    project_id: str = Query(DEMO_PROJECT_ID),
    db: Session = Depends(get_db),
):
    """Disconnects the repository from the project."""
    service = RepositoryService(db)
    await service.disconnect_repository(project_id)

    await ws_manager.broadcast(project_id, {
        "type": "GITHUB_REPOSITORY_DISCONNECTED",
        "project_id": project_id,
    })

    return {"status": "disconnected", "message": "Repository disconnected."}


@router.get("/repository", response_model=GitHubRepositoryResponse)
async def get_repository_details(
    project_id: str = Query(DEMO_PROJECT_ID),
    db: Session = Depends(get_db),
):
    """Returns detailed metadata about the connected repository."""
    service = RepositoryService(db)
    try:
        return await service.get_repository_details(project_id)
    except GitHubNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
    except GitHubError as e:
        raise HTTPException(status_code=400, detail=e.message)


@router.get("/branches", response_model=List[GitHubBranchItem])
async def list_branches(
    project_id: str = Query(DEMO_PROJECT_ID),
    db: Session = Depends(get_db),
):
    """Lists all branches on the connected repository, identifying COFRAME branches."""
    service = BranchService(db)
    try:
        return await service.list_branches(project_id)
    except GitHubNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
    except GitHubError as e:
        raise HTTPException(status_code=400, detail=e.message)


@router.get("/commits", response_model=List[GitHubCommitItem])
async def list_commits(
    branch: Optional[str] = Query(None),
    project_id: str = Query(DEMO_PROJECT_ID),
    db: Session = Depends(get_db),
):
    """Lists recent commits, identifying COFRAME contributions."""
    service = CommitService(db)
    try:
        return await service.list_commits(project_id, branch=branch)
    except GitHubNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
    except GitHubError as e:
        raise HTTPException(status_code=400, detail=e.message)


@router.post("/proposals/{proposal_id}/publish", response_model=PublishProposalResponse)
async def publish_proposal(
    proposal_id: str,
    project_id: str = Query(DEMO_PROJECT_ID),
    decided_by: str = Query("alex"),
    db: Session = Depends(get_db),
):
    """Publishes an approved proposal to GitHub (creates isolated branch, commit, and PR)."""
    service = ContributionService(db)
    try:
        resp = await service.publish_approved_proposal(
            project_id=project_id,
            proposal_id=proposal_id,
            decided_by=decided_by,
        )
        return resp
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except GitHubError as e:
        raise HTTPException(status_code=502, detail=f"GitHub operation failed: {e.message}")


@router.get("/contributions", response_model=List[GitHubContributionItem])
async def list_contributions(
    project_id: str = Query(DEMO_PROJECT_ID),
    db: Session = Depends(get_db),
):
    """Lists all recorded GitHub contributions for the project."""
    service = ContributionService(db)
    return await service.list_contributions(project_id)


@router.get("/contributions/{contribution_id}", response_model=GitHubContributionItem)
async def get_contribution(
    contribution_id: str,
    project_id: str = Query(DEMO_PROJECT_ID),
    db: Session = Depends(get_db),
):
    """Gets details for a single GitHub contribution."""
    service = ContributionService(db)
    contrib = await service.get_contribution(project_id, contribution_id)
    if not contrib:
        raise HTTPException(status_code=404, detail="Contribution not found.")
    return contrib


@router.post("/contributions/{contribution_id}/retry", response_model=PublishProposalResponse)
async def retry_contribution(
    contribution_id: str,
    project_id: str = Query(DEMO_PROJECT_ID),
    db: Session = Depends(get_db),
):
    """Retries a failed publishing job."""
    service = ContributionService(db)
    try:
        return await service.retry_failed_contribution(project_id, contribution_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except GitHubError as e:
        raise HTTPException(status_code=502, detail=f"GitHub retry failed: {e.message}")


@router.get("/pull-requests", response_model=List[GitHubPullRequestItem])
async def list_pull_requests(
    state: str = Query("all"),
    project_id: str = Query(DEMO_PROJECT_ID),
    db: Session = Depends(get_db),
):
    """Lists repository pull requests with COFRAME identification."""
    service = PullRequestService(db)
    try:
        return await service.list_pull_requests(project_id, state=state)
    except GitHubNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
    except GitHubError as e:
        raise HTTPException(status_code=400, detail=e.message)


@router.post("/pull-requests/{pr_number}/refresh", response_model=RefreshPRResponse)
async def refresh_pull_request(
    pr_number: int,
    project_id: str = Query(DEMO_PROJECT_ID),
    db: Session = Depends(get_db),
):
    """Refreshes status of a PR from GitHub API and updates contribution records."""
    service = PullRequestService(db)
    try:
        resp = await service.refresh_pull_request_status(project_id, pr_number)
        await ws_manager.broadcast(project_id, {
            "type": "GITHUB_PULL_REQUEST_UPDATED",
            "pr_number": pr_number,
            "status": resp.pr_status,
            "merged": resp.merged,
        })
        return resp
    except GitHubNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
    except GitHubError as e:
        raise HTTPException(status_code=400, detail=e.message)


@router.post("/webhooks")
async def github_webhook(
    request: Request,
    x_hub_signature_256: Optional[str] = Header(None),
    project_id: str = Query(DEMO_PROJECT_ID),
    db: Session = Depends(get_db),
):
    """(Optional P1) GitHub Webhook receiver for pull_request events."""
    body_bytes = await request.body()
    webhook_secret = os.getenv("GITHUB_WEBHOOK_SECRET", "").strip()

    if webhook_secret:
        if not x_hub_signature_256:
            raise HTTPException(status_code=401, detail="Missing X-Hub-Signature-256 header.")
        expected_sig = "sha256=" + hmac.new(webhook_secret.encode(), body_bytes, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(x_hub_signature_256, expected_sig):
            raise HTTPException(status_code=403, detail="Invalid webhook signature.")

    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body.")

    event_type = request.headers.get("X-GitHub-Event", "ping")
    if event_type == "pull_request":
        pr = payload.get("pull_request", {})
        pr_number = pr.get("number")
        if pr_number:
            service = PullRequestService(db)
            try:
                await service.refresh_pull_request_status(project_id, pr_number)
            except Exception as e:
                logger.warning(f"Failed to refresh PR #{pr_number} from webhook: {e}")

    return {"status": "ok", "event": event_type}
