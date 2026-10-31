from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class GitHubConnectRequest(BaseModel):
    owner: Optional[str] = Field(None, description="GitHub repository owner/organization")
    repository_name: Optional[str] = Field(None, description="GitHub repository name")
    default_branch: Optional[str] = Field("main", description="Target base branch")


class GitHubConnectionStatusResponse(BaseModel):
    is_configured: bool = Field(..., description="Whether GITHUB_TOKEN is configured in environment")
    connection_status: str = Field(..., description="Status: not_configured, connected, not_connected, etc.")
    owner: Optional[str] = None
    repository_name: Optional[str] = None
    repository_full_name: Optional[str] = None
    repository_url: Optional[str] = None
    default_branch: Optional[str] = "main"
    authenticated_user: Optional[str] = None
    last_synced_at: Optional[str] = None
    message: Optional[str] = None


class GitHubRepositoryResponse(BaseModel):
    name: str
    full_name: str
    owner: str
    description: Optional[str] = None
    default_branch: str
    html_url: str
    stars_count: int = 0
    forks_count: int = 0
    open_issues_count: int = 0
    is_private: bool = False
    updated_at: Optional[str] = None


class GitHubBranchItem(BaseModel):
    name: str
    commit_sha: str
    is_default: bool = False
    is_coframe_branch: bool = False
    related_proposal_id: Optional[str] = None


class GitHubCommitItem(BaseModel):
    sha: str
    message: str
    author_name: str
    author_date: str
    html_url: str
    is_coframe_commit: bool = False
    related_proposal_id: Optional[str] = None
    actor_identity: Optional[str] = None


class GitHubPullRequestItem(BaseModel):
    number: int
    title: str
    body: Optional[str] = None
    state: str
    html_url: str
    head_branch: str
    base_branch: str
    created_at: str
    updated_at: Optional[str] = None
    merged_at: Optional[str] = None
    author: str
    related_proposal_id: Optional[str] = None


class GitHubContributionItem(BaseModel):
    id: str
    project_id: str
    proposal_id: str
    repository_full_name: str
    branch_name: str
    base_branch: str
    commit_sha: Optional[str] = None
    pr_number: Optional[int] = None
    pr_url: Optional[str] = None
    pr_title: Optional[str] = None
    pr_status: str
    sync_status: str
    error_message: Optional[str] = None
    last_synced_at: Optional[str] = None
    created_at: str
    updated_at: str
    proposal_summary: Optional[str] = None
    agent_id: Optional[str] = None
    decided_by: Optional[str] = None
    artifact_version: Optional[int] = None


class PublishProposalResponse(BaseModel):
    status: str
    job_id: str
    contribution_id: Optional[str] = None
    branch_name: Optional[str] = None
    commit_sha: Optional[str] = None
    pr_number: Optional[int] = None
    pr_url: Optional[str] = None
    message: str


class RefreshPRResponse(BaseModel):
    pr_number: int
    pr_status: str
    merged: bool
    html_url: str
    message: str
