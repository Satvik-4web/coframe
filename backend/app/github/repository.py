import logging
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session

from backend.app.db.models import GitHubConnectionModel, ProjectModel, utcnow_str
from backend.app.github.client import (
    GitHubClient,
    GitHubAuthError,
    GitHubPermissionError,
    GitHubNotFoundError,
    GitHubError,
)
from backend.app.github.authentication import GitHubConfig
from backend.app.github.schemas import (
    GitHubConnectionStatusResponse,
    GitHubRepositoryResponse,
)

logger = logging.getLogger("coframe.github.repository")


class RepositoryService:
    def __init__(self, db: Session, client: Optional[GitHubClient] = None):
        self.db = db
        self.client = client or GitHubClient()

    async def get_connection_status(self, project_id: str) -> GitHubConnectionStatusResponse:
        """Returns the current connection status of the project's repository."""
        is_conf = GitHubConfig.is_configured()
        conn = (
            self.db.query(GitHubConnectionModel)
            .filter(GitHubConnectionModel.project_id == project_id)
            .first()
        )

        if not is_conf:
            return GitHubConnectionStatusResponse(
                is_configured=False,
                connection_status="not_configured",
                message="GitHub integration is not configured. Please set GITHUB_TOKEN in your environment.",
            )

        if not conn:
            return GitHubConnectionStatusResponse(
                is_configured=True,
                connection_status="not_connected",
                default_branch=GitHubConfig.get_default_base_branch(),
                message="No repository connected to this project yet.",
            )

        # Authenticate user name if token is valid
        auth_user = None
        try:
            user_data = await self.client.get_authenticated_user()
            auth_user = user_data.get("login")
        except Exception:
            pass

        return GitHubConnectionStatusResponse(
            is_configured=True,
            connection_status=conn.connection_status,
            owner=conn.owner,
            repository_name=conn.repository_name,
            repository_full_name=conn.repository_full_name,
            repository_url=conn.repository_url,
            default_branch=conn.default_branch,
            authenticated_user=auth_user,
            last_synced_at=conn.last_synced_at,
        )

    async def connect_repository(
        self,
        project_id: str,
        owner: Optional[str] = None,
        repository_name: Optional[str] = None,
        default_branch: Optional[str] = None,
    ) -> GitHubConnectionModel:
        """Validates and connects a repository to the project."""
        if not GitHubConfig.is_configured():
            raise GitHubAuthError("Cannot connect repository: GITHUB_TOKEN is not configured.")

        owner = (owner or GitHubConfig.get_default_owner()).strip()
        repository_name = (repository_name or GitHubConfig.get_default_repo()).strip()
        base_branch = (default_branch or GitHubConfig.get_default_base_branch()).strip()

        logger.info(f"Validating GitHub repository access for {owner}/{repository_name}...")

        # Validate with GitHub API
        try:
            repo_info = await self.client.get_repository(owner, repository_name)
        except GitHubNotFoundError:
            raise GitHubNotFoundError(f"Repository '{owner}/{repository_name}' not found on GitHub.")
        except GitHubPermissionError:
            raise GitHubPermissionError(f"Insufficient permissions for repository '{owner}/{repository_name}'.")

        full_name = repo_info.get("full_name", f"{owner}/{repository_name}")
        html_url = repo_info.get("html_url", f"https://github.com/{owner}/{repository_name}")
        actual_default_branch = repo_info.get("default_branch", base_branch)

        conn = (
            self.db.query(GitHubConnectionModel)
            .filter(GitHubConnectionModel.project_id == project_id)
            .first()
        )

        now = utcnow_str()
        if conn:
            conn.owner = owner
            conn.repository_name = repository_name
            conn.repository_full_name = full_name
            conn.repository_url = html_url
            conn.default_branch = actual_default_branch
            conn.connection_status = "connected"
            conn.last_synced_at = now
            conn.updated_at = now
        else:
            conn = GitHubConnectionModel(
                project_id=project_id,
                owner=owner,
                repository_name=repository_name,
                repository_full_name=full_name,
                repository_url=html_url,
                default_branch=actual_default_branch,
                connection_status="connected",
                last_synced_at=now,
                created_at=now,
                updated_at=now,
            )
            self.db.add(conn)

        self.db.commit()
        self.db.refresh(conn)
        return conn

    async def disconnect_repository(self, project_id: str) -> None:
        """Disconnects the project's repository."""
        conn = (
            self.db.query(GitHubConnectionModel)
            .filter(GitHubConnectionModel.project_id == project_id)
            .first()
        )
        if conn:
            self.db.delete(conn)
            self.db.commit()

    async def get_repository_details(self, project_id: str) -> GitHubRepositoryResponse:
        """Fetches live repository metadata from GitHub."""
        conn = (
            self.db.query(GitHubConnectionModel)
            .filter(GitHubConnectionModel.project_id == project_id)
            .first()
        )
        if not conn:
            raise GitHubNotFoundError("No repository connected to this project.")

        repo_info = await self.client.get_repository(conn.owner, conn.repository_name)
        return GitHubRepositoryResponse(
            name=repo_info.get("name", conn.repository_name),
            full_name=repo_info.get("full_name", conn.repository_full_name),
            owner=conn.owner,
            description=repo_info.get("description"),
            default_branch=repo_info.get("default_branch", conn.default_branch),
            html_url=repo_info.get("html_url", conn.repository_url),
            stars_count=repo_info.get("stargazers_count", 0),
            forks_count=repo_info.get("forks_count", 0),
            open_issues_count=repo_info.get("open_issues_count", 0),
            is_private=repo_info.get("private", False),
            updated_at=repo_info.get("updated_at"),
        )
