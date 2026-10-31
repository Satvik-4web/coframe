import logging
import re
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session

from backend.app.db.models import GitHubConnectionModel
from backend.app.github.client import GitHubClient, GitHubNotFoundError, GitHubError
from backend.app.github.schemas import GitHubBranchItem

logger = logging.getLogger("coframe.github.branches")


def generate_branch_name(agent_id: str, proposal_id: str) -> str:
    """Standardized branch naming: coframe/{agent_id}-proposal-{proposal_id}"""
    clean_agent = agent_id.lower().strip()
    clean_prop = proposal_id.strip()
    return f"coframe/{clean_agent}-proposal-{clean_prop}"


def parse_coframe_branch(branch_name: str) -> Optional[Dict[str, str]]:
    """Parses agent and proposal_id from a COFRAME branch name."""
    pattern = r"^coframe/([a-zA-Z0-9_-]+)-proposal-([a-zA-Z0-9_-]+)$"
    match = re.match(pattern, branch_name)
    if match:
        return {
            "agent_id": match.group(1),
            "proposal_id": match.group(2),
        }
    return None


class BranchService:
    def __init__(self, db: Session, client: Optional[GitHubClient] = None):
        self.db = db
        self.client = client or GitHubClient()

    async def list_branches(self, project_id: str) -> List[GitHubBranchItem]:
        """Lists branches for the connected repository."""
        conn = (
            self.db.query(GitHubConnectionModel)
            .filter(GitHubConnectionModel.project_id == project_id)
            .first()
        )
        if not conn:
            raise GitHubNotFoundError("No repository connected to this project.")

        branches_raw = await self.client.list_branches(conn.owner, conn.repository_name)
        result: List[GitHubBranchItem] = []

        for b in branches_raw:
            b_name = b.get("name", "")
            commit_sha = b.get("commit", {}).get("sha", "")
            is_default = (b_name == conn.default_branch)
            parsed = parse_coframe_branch(b_name)
            is_coframe = parsed is not None
            related_proposal_id = parsed["proposal_id"] if parsed else None

            result.append(
                GitHubBranchItem(
                    name=b_name,
                    commit_sha=commit_sha,
                    is_default=is_default,
                    is_coframe_branch=is_coframe,
                    related_proposal_id=related_proposal_id,
                )
            )

        return result

    async def get_base_branch_sha(self, owner: str, repo: str, base_branch: str) -> str:
        """Fetches the latest commit SHA of the base branch."""
        branch_data = await self.client.get_branch(owner, repo, base_branch)
        sha = branch_data.get("commit", {}).get("sha")
        if not sha:
            raise GitHubError(f"Could not resolve commit SHA for base branch '{base_branch}'.")
        return sha

    async def create_isolated_branch(
        self,
        project_id: str,
        agent_id: str,
        proposal_id: str,
        base_branch: Optional[str] = None,
    ) -> str:
        """Creates an isolated branch for a proposal: coframe/{agent_id}-proposal-{proposal_id}."""
        conn = (
            self.db.query(GitHubConnectionModel)
            .filter(GitHubConnectionModel.project_id == project_id)
            .first()
        )
        if not conn:
            raise GitHubNotFoundError("No repository connected to this project.")

        target_base = base_branch or conn.default_branch
        base_sha = await self.get_base_branch_sha(conn.owner, conn.repository_name, target_base)

        branch_name = generate_branch_name(agent_id, proposal_id)

        # Check if branch already exists
        try:
            existing = await self.client.get_branch(conn.owner, conn.repository_name, branch_name)
            if existing:
                logger.info(f"Branch '{branch_name}' already exists.")
                return branch_name
        except Exception:
            # Branch doesn't exist yet, proceed to create
            pass

        logger.info(f"Creating isolated branch '{branch_name}' from '{target_base}' ({base_sha[:7]})...")
        await self.client.create_branch(conn.owner, conn.repository_name, branch_name, base_sha)
        return branch_name
