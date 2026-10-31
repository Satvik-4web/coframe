import logging
import uuid
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session

from backend.app.db.models import (
    GitHubConnectionModel,
    GitHubContributionModel,
    GitHubSyncJobModel,
    ProposalModel,
    DecisionModel,
    ProjectModel,
    utcnow_str,
)
from backend.app.github.client import GitHubClient, GitHubError
from backend.app.github.exporter import export_approved_artifact_files
from backend.app.github.branches import BranchService
from backend.app.github.commits import CommitService, format_commit_message
from backend.app.github.pull_requests import PullRequestService
from backend.app.github.schemas import GitHubContributionItem, PublishProposalResponse
from backend.app.websocket.manager import ws_manager

logger = logging.getLogger("coframe.github.contribution")


class ContributionService:
    def __init__(self, db: Session, client: Optional[GitHubClient] = None):
        self.db = db
        self.client = client or GitHubClient()
        self.branches = BranchService(db, self.client)
        self.commits = CommitService(db, self.client)
        self.pull_requests = PullRequestService(db, self.client)

    async def publish_approved_proposal(
        self,
        project_id: str,
        proposal_id: str,
        decided_by: str = "alex",
    ) -> PublishProposalResponse:
        """
        Executes the full end-to-end publishing pipeline for an approved proposal:
        1. Validate proposal is approved (cannot publish rejected or pending work).
        2. Idempotency check: prevent duplicate contributions.
        3. Ensure repository is connected.
        4. Create isolated branch.
        5. Export approved artifact state.
        6. Create atomic commit with Git Database API.
        7. Open GitHub Pull Request.
        8. Save contribution & job records.
        9. Broadcast realtime WebSocket events.
        """
        # 1. Validation
        proposal = (
            self.db.query(ProposalModel)
            .filter(ProposalModel.id == proposal_id, ProposalModel.project_id == project_id)
            .first()
        )
        if not proposal:
            raise ValueError(f"Proposal '{proposal_id}' not found.")

        if proposal.status != "approved":
            raise ValueError(
                f"Cannot publish proposal '{proposal_id}': status is '{proposal.status}'. "
                f"Only approved proposals can be published to GitHub."
            )

        # 2. Connection check
        conn = (
            self.db.query(GitHubConnectionModel)
            .filter(GitHubConnectionModel.project_id == project_id)
            .first()
        )
        if not conn:
            raise ValueError("No GitHub repository connected to this project. Connect a repository first.")

        # 3. Idempotency check
        existing_contrib = (
            self.db.query(GitHubContributionModel)
            .filter(
                GitHubContributionModel.project_id == project_id,
                GitHubContributionModel.proposal_id == proposal_id,
                GitHubContributionModel.repository_full_name == conn.repository_full_name,
            )
            .first()
        )
        if existing_contrib and existing_contrib.sync_status in ("pr_opened", "merged", "closed"):
            return PublishProposalResponse(
                status="success",
                job_id="existing",
                contribution_id=existing_contrib.id,
                branch_name=existing_contrib.branch_name,
                commit_sha=existing_contrib.commit_sha,
                pr_number=existing_contrib.pr_number,
                pr_url=existing_contrib.pr_url,
                message=f"Proposal '{proposal_id}' was already published (PR #{existing_contrib.pr_number}).",
            )

        # 4. Initialize or reuse contribution & sync job records
        contrib_id = existing_contrib.id if existing_contrib else str(uuid.uuid4())
        branch_name = f"coframe/{proposal.agent_id.lower()}-proposal-{proposal.id}"

        now = utcnow_str()
        if existing_contrib:
            contrib = existing_contrib
            contrib.sync_status = "publishing"
            contrib.error_message = None
            contrib.updated_at = now
        else:
            contrib = GitHubContributionModel(
                id=contrib_id,
                project_id=project_id,
                proposal_id=proposal_id,
                repository_full_name=conn.repository_full_name,
                branch_name=branch_name,
                base_branch=conn.default_branch,
                pr_status="open",
                sync_status="publishing",
                created_at=now,
                updated_at=now,
            )
            self.db.add(contrib)

        sync_job = GitHubSyncJobModel(
            id=str(uuid.uuid4()),
            project_id=project_id,
            proposal_id=proposal_id,
            contribution_id=contrib_id,
            status="processing",
            attempts=1,
            created_at=now,
            updated_at=now,
        )
        self.db.add(sync_job)
        self.db.commit()

        # Step 5 - 8: Execute GitHub operations in safe try/except block
        try:
            # 5. Create isolated branch
            created_branch = await self.branches.create_isolated_branch(
                project_id=project_id,
                agent_id=proposal.agent_id,
                proposal_id=proposal.id,
                base_branch=conn.default_branch,
            )
            contrib.branch_name = created_branch
            contrib.sync_status = "branch_created"
            self.db.commit()

            await ws_manager.broadcast(project_id, {
                "type": "GITHUB_BRANCH_CREATED",
                "branch_name": created_branch,
                "proposal_id": proposal.id,
            })

            # 6. Export approved artifact files
            exported_files = export_approved_artifact_files(self.db, project_id, proposal.id)

            # 7. Create atomic commit
            commit_msg = format_commit_message(proposal, decided_by)
            commit_sha = await self.commits.create_atomic_commit(
                project_id=project_id,
                branch_name=created_branch,
                files=exported_files,
                commit_message=commit_msg,
            )
            contrib.commit_sha = commit_sha
            contrib.sync_status = "commit_created"
            self.db.commit()

            await ws_manager.broadcast(project_id, {
                "type": "GITHUB_COMMIT_CREATED",
                "branch_name": created_branch,
                "commit_sha": commit_sha,
                "proposal_id": proposal.id,
            })

            # 8. Create Pull Request
            pr_data = await self.pull_requests.create_pull_request_for_proposal(
                project_id=project_id,
                proposal=proposal,
                branch_name=created_branch,
                base_branch=conn.default_branch,
                decided_by=decided_by,
            )

            pr_number = pr_data.get("number")
            pr_url = pr_data.get("html_url")
            pr_title = pr_data.get("title")

            contrib.pr_number = pr_number
            contrib.pr_url = pr_url
            contrib.pr_title = pr_title
            contrib.pr_status = "open"
            contrib.sync_status = "pr_opened"
            contrib.last_synced_at = utcnow_str()
            contrib.updated_at = utcnow_str()

            sync_job.status = "completed"
            sync_job.updated_at = utcnow_str()
            self.db.commit()

            await ws_manager.broadcast(project_id, {
                "type": "GITHUB_PULL_REQUEST_OPENED",
                "pr_number": pr_number,
                "pr_url": pr_url,
                "branch_name": created_branch,
                "proposal_id": proposal.id,
            })

            return PublishProposalResponse(
                status="success",
                job_id=sync_job.id,
                contribution_id=contrib.id,
                branch_name=created_branch,
                commit_sha=commit_sha,
                pr_number=pr_number,
                pr_url=pr_url,
                message=f"Proposal published successfully: PR #{pr_number} opened.",
            )

        except Exception as e:
            logger.error(f"GitHub publishing failed for proposal '{proposal_id}': {e}", exc_info=True)
            # Safe rollback of GitHub sync records - NEVER roll back COFRAME artifact!
            contrib.sync_status = "sync_failed"
            contrib.error_message = str(e)
            contrib.updated_at = utcnow_str()

            sync_job.status = "failed"
            sync_job.last_error = str(e)
            sync_job.updated_at = utcnow_str()
            self.db.commit()

            await ws_manager.broadcast(project_id, {
                "type": "GITHUB_SYNC_FAILED",
                "proposal_id": proposal.id,
                "error": str(e),
            })

            return PublishProposalResponse(
                status="failed",
                job_id=sync_job.id,
                contribution_id=contrib.id,
                branch_name=contrib.branch_name,
                message=f"GitHub publishing failed: {e}",
            )

    async def list_contributions(self, project_id: str) -> List[GitHubContributionItem]:
        """Lists all recorded GitHub contributions for the project with enriched proposal details."""
        contribs = (
            self.db.query(GitHubContributionModel)
            .filter(GitHubContributionModel.project_id == project_id)
            .order_by(GitHubContributionModel.created_at.desc())
            .all()
        )

        results: List[GitHubContributionItem] = []
        for c in contribs:
            prop = self.db.query(ProposalModel).filter(ProposalModel.id == c.proposal_id).first()
            decision = (
                self.db.query(DecisionModel)
                .filter(DecisionModel.proposal_id == c.proposal_id, DecisionModel.decision == "approved")
                .first()
            )

            results.append(
                GitHubContributionItem(
                    id=c.id,
                    project_id=c.project_id,
                    proposal_id=c.proposal_id,
                    repository_full_name=c.repository_full_name,
                    branch_name=c.branch_name,
                    base_branch=c.base_branch,
                    commit_sha=c.commit_sha,
                    pr_number=c.pr_number,
                    pr_url=c.pr_url,
                    pr_title=c.pr_title or (prop.summary if prop else None),
                    pr_status=c.pr_status,
                    sync_status=c.sync_status,
                    error_message=c.error_message,
                    last_synced_at=c.last_synced_at,
                    created_at=c.created_at,
                    updated_at=c.updated_at,
                    proposal_summary=prop.summary if prop else None,
                    agent_id=prop.agent_id if prop else None,
                    decided_by=decision.decided_by if decision else None,
                    artifact_version=(prop.base_artifact_version + 1) if prop else None,
                )
            )

        return results

    async def get_contribution(self, project_id: str, contribution_id: str) -> Optional[GitHubContributionItem]:
        """Gets a single contribution item."""
        c = (
            self.db.query(GitHubContributionModel)
            .filter(
                GitHubContributionModel.id == contribution_id,
                GitHubContributionModel.project_id == project_id,
            )
            .first()
        )
        if not c:
            return None

        prop = self.db.query(ProposalModel).filter(ProposalModel.id == c.proposal_id).first()
        decision = (
            self.db.query(DecisionModel)
            .filter(DecisionModel.proposal_id == c.proposal_id, DecisionModel.decision == "approved")
            .first()
        )

        return GitHubContributionItem(
            id=c.id,
            project_id=c.project_id,
            proposal_id=c.proposal_id,
            repository_full_name=c.repository_full_name,
            branch_name=c.branch_name,
            base_branch=c.base_branch,
            commit_sha=c.commit_sha,
            pr_number=c.pr_number,
            pr_url=c.pr_url,
            pr_title=c.pr_title or (prop.summary if prop else None),
            pr_status=c.pr_status,
            sync_status=c.sync_status,
            error_message=c.error_message,
            last_synced_at=c.last_synced_at,
            created_at=c.created_at,
            updated_at=c.updated_at,
            proposal_summary=prop.summary if prop else None,
            agent_id=prop.agent_id if prop else None,
            decided_by=decision.decided_by if decision else None,
            artifact_version=(prop.base_artifact_version + 1) if prop else None,
        )

    async def retry_failed_contribution(self, project_id: str, contribution_id: str) -> PublishProposalResponse:
        """Retries a failed publishing job."""
        contrib = (
            self.db.query(GitHubContributionModel)
            .filter(
                GitHubContributionModel.id == contribution_id,
                GitHubContributionModel.project_id == project_id,
            )
            .first()
        )
        if not contrib:
            raise ValueError(f"Contribution '{contribution_id}' not found.")

        await ws_manager.broadcast(project_id, {
            "type": "GITHUB_SYNC_RETRIED",
            "contribution_id": contribution_id,
            "proposal_id": contrib.proposal_id,
        })

        return await self.publish_approved_proposal(
            project_id=project_id,
            proposal_id=contrib.proposal_id,
            decided_by="alex",
        )
