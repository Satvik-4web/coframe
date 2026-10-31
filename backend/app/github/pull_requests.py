import logging
import re
from typing import List, Dict, Optional, Any
from sqlalchemy.orm import Session

from backend.app.db.models import (
    GitHubConnectionModel,
    GitHubContributionModel,
    ProposalModel,
    ProjectModel,
    utcnow_str,
)
from backend.app.github.client import GitHubClient, GitHubNotFoundError, GitHubError
from backend.app.github.schemas import GitHubPullRequestItem, RefreshPRResponse

logger = logging.getLogger("coframe.github.pull_requests")


def format_pr_content(
    proposal: ProposalModel,
    project: ProjectModel,
    decided_by: str,
) -> tuple[str, str]:
    """Generates standardized PR title and body adhering to COFRAME specification."""
    title = f"feat: {proposal.summary.strip().rstrip('.')}"

    target_secs = ", ".join(proposal.target_sections or ["all"])
    affected_reqs = ", ".join(proposal.affected_requirements or ["none"])

    body = f"""## COFRAME Contribution

**Agent:** `{proposal.agent_id.upper()}`  
**Proposal:** `{proposal.id}`  
**Approved by:** `{decided_by.capitalize()}`  
**Context Version:** v{project.context_version}  
**Artifact Version:** v{project.artifact_version}  

---

## Summary
{proposal.summary}

### Agent Reasoning
{proposal.reasoning}

## Changes
- **Target sections:** {target_secs}
- **Affected requirements:** {affected_reqs}
- **Artifact Files:** Exported approved JSON artifacts and changelog under `coframe-artifacts/ledgerflow/`

## Provenance
- Generated and validated through **COFRAME** (Human + AI, One Shared Creation).
- Source proposal: `{proposal.id}`
- Base Context Version: v{proposal.base_context_version}
- Base Artifact Version: v{proposal.base_artifact_version}

---
*Note: This pull request is ready for final review and human merge directly on GitHub.*
"""
    return title, body


def parse_coframe_pr(pr_body: str) -> Optional[Dict[str, str]]:
    """Extracts proposal and agent metadata from a PR body."""
    if "COFRAME Contribution" in pr_body or "Source proposal:" in pr_body:
        prop_match = re.search(r"Proposal:?\s*`?([a-zA-Z0-9_-]+)`?", pr_body)
        agent_match = re.search(r"Agent:?\s*`?([a-zA-Z0-9_-]+)`?", pr_body)
        return {
            "proposal_id": prop_match.group(1) if prop_match else None,
            "agent_id": agent_match.group(1) if agent_match else None,
        }
    return None


class PullRequestService:
    def __init__(self, db: Session, client: Optional[GitHubClient] = None):
        self.db = db
        self.client = client or GitHubClient()

    async def list_pull_requests(
        self,
        project_id: str,
        state: str = "all",
    ) -> List[GitHubPullRequestItem]:
        """Lists repository pull requests with COFRAME identification."""
        conn = (
            self.db.query(GitHubConnectionModel)
            .filter(GitHubConnectionModel.project_id == project_id)
            .first()
        )
        if not conn:
            raise GitHubNotFoundError("No repository connected to this project.")

        prs_raw = await self.client.list_pull_requests(conn.owner, conn.repository_name, state=state)
        result: List[GitHubPullRequestItem] = []

        for p in prs_raw:
            number = p.get("number")
            title = p.get("title", "")
            body = p.get("body", "") or ""
            html_url = p.get("html_url", "")
            head_branch = p.get("head", {}).get("ref", "")
            base_branch = p.get("base", {}).get("ref", "")
            created_at = p.get("created_at", "")
            updated_at = p.get("updated_at")
            merged_at = p.get("merged_at")
            user_login = p.get("user", {}).get("login", "unknown")

            state_str = "merged" if merged_at else p.get("state", "open")

            parsed = parse_coframe_pr(body)
            related_proposal_id = parsed["proposal_id"] if parsed else None

            result.append(
                GitHubPullRequestItem(
                    number=number,
                    title=title,
                    body=body,
                    state=state_str,
                    html_url=html_url,
                    head_branch=head_branch,
                    base_branch=base_branch,
                    created_at=created_at,
                    updated_at=updated_at,
                    merged_at=merged_at,
                    author=user_login,
                    related_proposal_id=related_proposal_id,
                )
            )

        return result

    async def create_pull_request_for_proposal(
        self,
        project_id: str,
        proposal: ProposalModel,
        branch_name: str,
        base_branch: Optional[str] = None,
        decided_by: str = "alex",
    ) -> Dict[str, Any]:
        """Creates a Pull Request for the published proposal branch."""
        conn = (
            self.db.query(GitHubConnectionModel)
            .filter(GitHubConnectionModel.project_id == project_id)
            .first()
        )
        if not conn:
            raise GitHubNotFoundError("No repository connected to this project.")

        project = self.db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
        target_base = base_branch or conn.default_branch

        title, body = format_pr_content(proposal, project, decided_by)

        logger.info(f"Opening GitHub Pull Request from '{branch_name}' into '{target_base}'...")
        pr_data = await self.client.create_pull_request(
            owner=conn.owner,
            repo=conn.repository_name,
            title=title,
            body=body,
            head=branch_name,
            base=target_base,
            draft=False,
        )

        return pr_data

    async def refresh_pull_request_status(
        self,
        project_id: str,
        pr_number: int,
    ) -> RefreshPRResponse:
        """Fetches live PR status from GitHub and updates contribution records in DB."""
        conn = (
            self.db.query(GitHubConnectionModel)
            .filter(GitHubConnectionModel.project_id == project_id)
            .first()
        )
        if not conn:
            raise GitHubNotFoundError("No repository connected to this project.")

        pr_info = await self.client.get_pull_request(conn.owner, conn.repository_name, pr_number)
        merged_at = pr_info.get("merged_at")
        state_str = "merged" if merged_at else pr_info.get("state", "open")
        html_url = pr_info.get("html_url", "")

        # Find matching contribution if exists
        contrib = (
            self.db.query(GitHubContributionModel)
            .filter(
                GitHubContributionModel.project_id == project_id,
                GitHubContributionModel.pr_number == pr_number,
            )
            .first()
        )
        if contrib:
            contrib.pr_status = state_str
            if state_str == "merged":
                contrib.sync_status = "merged"
            elif state_str == "closed":
                contrib.sync_status = "closed"
            contrib.last_synced_at = utcnow_str()
            self.db.commit()

        return RefreshPRResponse(
            pr_number=pr_number,
            pr_status=state_str,
            merged=bool(merged_at),
            html_url=html_url,
            message=f"Pull request #{pr_number} status is '{state_str}'.",
        )
