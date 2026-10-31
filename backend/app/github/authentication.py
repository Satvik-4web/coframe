import os
import logging
from typing import Optional, Tuple

logger = logging.getLogger("coframe.github.auth")


class GitHubConfig:
    @staticmethod
    def get_token() -> Optional[str]:
        token = os.getenv("GITHUB_TOKEN", "").strip()
        return token if token else None

    @staticmethod
    def get_default_owner() -> str:
        return os.getenv("GITHUB_OWNER", "Satvik-4web").strip()

    @staticmethod
    def get_default_repo() -> str:
        return os.getenv("GITHUB_REPO", "ledgerflow-product").strip()

    @staticmethod
    def get_default_base_branch() -> str:
        return os.getenv("GITHUB_BASE_BRANCH", "main").strip()

    @staticmethod
    def is_auto_pr_enabled() -> bool:
        return os.getenv("GITHUB_AUTO_CREATE_PR", "true").lower() in ("1", "true", "yes")

    @staticmethod
    def is_configured() -> bool:
        return bool(GitHubConfig.get_token())


def get_sanitized_config() -> dict:
    """Returns safe configuration metadata without exposing token credentials."""
    token = GitHubConfig.get_token()
    return {
        "is_configured": bool(token),
        "token_prefix": f"{token[:4]}...{token[-4:]}" if token and len(token) > 8 else ("configured" if token else None),
        "default_owner": GitHubConfig.get_default_owner(),
        "default_repo": GitHubConfig.get_default_repo(),
        "default_base_branch": GitHubConfig.get_default_base_branch(),
        "auto_create_pr": GitHubConfig.is_auto_pr_enabled(),
    }
