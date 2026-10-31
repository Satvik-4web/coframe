import datetime
import uuid
from sqlalchemy import (
    Column,
    String,
    Integer,
    Boolean,
    DateTime,
    Text,
    JSON,
    ForeignKey,
    Index,
)
from backend.app.db.database import Base


def utcnow_str():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


class ProjectModel(Base):
    __tablename__ = "projects"

    id = Column(String(64), primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    context_version = Column(Integer, default=1, nullable=False)
    artifact_version = Column(Integer, default=1, nullable=False)
    created_at = Column(String(64), default=utcnow_str, nullable=False)
    updated_at = Column(String(64), default=utcnow_str, nullable=False)


class ProjectMemberModel(Base):
    __tablename__ = "project_members"

    id = Column(String(64), primary_key=True)
    project_id = Column(String(64), ForeignKey("projects.id"), index=True, nullable=False)
    identity_key = Column(String(32), nullable=False)  # "alex" or "maya"
    display_name = Column(String(64), nullable=False)  # "Alex", "Maya"
    role = Column(String(64), nullable=False)          # "founder", "designer"
    member_type = Column(String(32), default="human", nullable=False)


class RequirementModel(Base):
    __tablename__ = "requirements"

    id = Column(String(64), primary_key=True)
    project_id = Column(String(64), ForeignKey("projects.id"), index=True, nullable=False)
    requirement_key = Column(String(64), index=True, nullable=False)  # "REQ_AUDIENCE", etc.
    title = Column(String(255), nullable=False)
    value = Column(JSON, nullable=False)
    version = Column(Integer, default=1, nullable=False)
    updated_by = Column(String(64), default="system", nullable=False)
    updated_at = Column(String(64), default=utcnow_str, nullable=False)

    __table_args__ = (
        Index("idx_req_proj_key", "project_id", "requirement_key"),
    )


class ArtifactSectionModel(Base):
    __tablename__ = "artifact_sections"

    id = Column(String(64), primary_key=True)
    project_id = Column(String(64), ForeignKey("projects.id"), index=True, nullable=False)
    section_key = Column(String(64), index=True, nullable=False)  # "product_brief", "hero", etc.
    data = Column(JSON, nullable=False)
    version = Column(Integer, default=1, nullable=False)
    updated_by = Column(String(64), default="system", nullable=False)
    updated_at = Column(String(64), default=utcnow_str, nullable=False)

    __table_args__ = (
        Index("idx_art_proj_key", "project_id", "section_key"),
    )


class EventModel(Base):
    __tablename__ = "events"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    sequence_no = Column(Integer, nullable=False, index=True)
    project_id = Column(String(64), ForeignKey("projects.id"), index=True, nullable=False)
    actor_type = Column(String(32), nullable=False)  # "human", "agent", "system"
    actor_id = Column(String(64), nullable=False)    # "alex", "maya", "nova", "pixel"
    event_type = Column(String(64), index=True, nullable=False)
    context_version = Column(Integer, nullable=False)
    artifact_version = Column(Integer, nullable=False)
    payload = Column(JSON, default=dict, nullable=False)
    created_at = Column(String(64), default=utcnow_str, nullable=False)

    __table_args__ = (
        Index("idx_event_proj_seq", "project_id", "sequence_no"),
    )


class AgentRunModel(Base):
    __tablename__ = "agent_runs"

    id = Column(String(64), primary_key=True)
    project_id = Column(String(64), ForeignKey("projects.id"), index=True, nullable=False)
    agent_id = Column(String(32), index=True, nullable=False)  # "nova", "pixel"
    status = Column(String(32), default="idle", nullable=False)  # "idle", "working", "waiting_for_review", "failed", "offline"
    task_description = Column(Text, nullable=False)
    context_pack = Column(JSON, nullable=False)
    base_context_version = Column(Integer, nullable=False)
    base_artifact_version = Column(Integer, nullable=False)
    last_checkpoint = Column(JSON, nullable=True)
    source = Column(String(32), default="live_llm", nullable=False)
    started_at = Column(String(64), default=utcnow_str, nullable=False)
    completed_at = Column(String(64), nullable=True)


class ProposalModel(Base):
    __tablename__ = "proposals"

    id = Column(String(64), primary_key=True)
    project_id = Column(String(64), ForeignKey("projects.id"), index=True, nullable=False)
    agent_id = Column(String(32), index=True, nullable=False)
    run_id = Column(String(64), ForeignKey("agent_runs.id"), nullable=False)
    supersedes_proposal_id = Column(String(64), ForeignKey("proposals.id"), nullable=True)
    summary = Column(Text, nullable=False)
    reasoning = Column(Text, nullable=False)
    affected_requirements = Column(JSON, default=list, nullable=False)
    target_sections = Column(JSON, default=list, nullable=False)
    changes = Column(JSON, default=dict, nullable=False)
    base_context_version = Column(Integer, nullable=False)
    base_artifact_version = Column(Integer, nullable=False)
    base_section_versions = Column(JSON, default=dict, nullable=False)
    requires_decision = Column(Boolean, default=False, nullable=False)
    assigned_decider_id = Column(String(32), nullable=True)  # "alex"
    status = Column(String(32), default="pending_review", index=True, nullable=False)
    stale_reason = Column(Text, nullable=True)
    conflict_reason = Column(Text, nullable=True)
    source = Column(String(32), default="live_llm", nullable=False)
    is_simulated = Column(Boolean, default=False, nullable=False)
    created_at = Column(String(64), default=utcnow_str, nullable=False)
    updated_at = Column(String(64), default=utcnow_str, nullable=False)

    __table_args__ = (
        Index("idx_proposal_proj_status", "project_id", "status"),
    )


class DecisionModel(Base):
    __tablename__ = "decisions"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    proposal_id = Column(String(64), ForeignKey("proposals.id"), index=True, nullable=False)
    decision = Column(String(32), nullable=False)  # "approved", "rejected", "redirected", "reconciled"
    decided_by = Column(String(32), nullable=False)  # "alex", "maya"
    note = Column(Text, nullable=True)
    created_at = Column(String(64), default=utcnow_str, nullable=False)


class GitHubConnectionModel(Base):
    __tablename__ = "github_connections"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(64), ForeignKey("projects.id"), index=True, nullable=False, unique=True)
    owner = Column(String(128), nullable=False)
    repository_name = Column(String(128), nullable=False)
    repository_full_name = Column(String(256), nullable=False)
    repository_url = Column(String(512), nullable=False)
    default_branch = Column(String(128), default="main", nullable=False)
    connection_status = Column(String(32), default="connected", nullable=False)  # "not_connected", "connected", "synchronizing", "sync_successful", "sync_failed", "auth_expired", "permission_denied"
    last_synced_at = Column(String(64), nullable=True)
    created_at = Column(String(64), default=utcnow_str, nullable=False)
    updated_at = Column(String(64), default=utcnow_str, nullable=False)


class GitHubContributionModel(Base):
    __tablename__ = "github_contributions"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(64), ForeignKey("projects.id"), index=True, nullable=False)
    proposal_id = Column(String(64), ForeignKey("proposals.id"), index=True, nullable=False)
    repository_full_name = Column(String(256), nullable=False)
    branch_name = Column(String(256), nullable=False)
    base_branch = Column(String(128), default="main", nullable=False)
    commit_sha = Column(String(64), nullable=True)
    pr_number = Column(Integer, nullable=True)
    pr_url = Column(String(512), nullable=True)
    pr_title = Column(String(256), nullable=True)
    pr_status = Column(String(32), default="open", nullable=False)  # "open", "closed", "merged", "draft", "sync_failed"
    sync_status = Column(String(32), default="pending", nullable=False)  # "pending", "publishing", "branch_created", "commit_created", "pr_opened", "sync_failed", "merged", "closed"
    error_message = Column(Text, nullable=True)
    last_synced_at = Column(String(64), nullable=True)
    created_at = Column(String(64), default=utcnow_str, nullable=False)
    updated_at = Column(String(64), default=utcnow_str, nullable=False)

    __table_args__ = (
        Index("idx_contrib_proj_prop", "project_id", "proposal_id"),
    )


class GitHubSyncJobModel(Base):
    __tablename__ = "github_sync_jobs"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(64), ForeignKey("projects.id"), index=True, nullable=False)
    proposal_id = Column(String(64), ForeignKey("proposals.id"), index=True, nullable=False)
    contribution_id = Column(String(64), ForeignKey("github_contributions.id"), nullable=True)
    status = Column(String(32), default="pending", nullable=False)  # "pending", "processing", "completed", "failed"
    attempts = Column(Integer, default=0, nullable=False)
    max_attempts = Column(Integer, default=3, nullable=False)
    last_error = Column(Text, nullable=True)
    next_attempt_at = Column(String(64), nullable=True)
    created_at = Column(String(64), default=utcnow_str, nullable=False)
    updated_at = Column(String(64), default=utcnow_str, nullable=False)

    __table_args__ = (
        Index("idx_sync_proj_status", "project_id", "status"),
    )
