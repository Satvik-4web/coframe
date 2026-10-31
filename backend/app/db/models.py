import datetime
import uuid
from sqlalchemy import (
    Column,
    String,
    Integer,
    BigInteger,
    Boolean,
    DateTime,
    Text,
    JSON,
    ForeignKey,
    Index,
    Float,
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
    workspace_id = Column(String(64), nullable=True, index=True)
    actor_type = Column(String(32), nullable=False)  # "human", "agent", "system"
    actor_id = Column(String(64), nullable=False)    # "alex", "maya", "nova", "pixel"
    event_type = Column(String(64), index=True, nullable=False)
    entity_type = Column(String(64), nullable=True, index=True)
    entity_id = Column(String(64), nullable=True, index=True)
    context_version = Column(Integer, nullable=False)
    artifact_version = Column(Integer, nullable=False)
    payload = Column(JSON, default=dict, nullable=False)
    correlation_id = Column(String(64), nullable=True, index=True)
    causation_id = Column(String(64), nullable=True, index=True)
    timestamp = Column(BigInteger, nullable=True, index=True)
    created_at = Column(String(64), default=utcnow_str, nullable=False)

    __table_args__ = (
        Index("idx_event_proj_seq", "project_id", "sequence_no"),
        Index("idx_event_corr", "project_id", "correlation_id"),
        Index("idx_event_entity", "entity_type", "entity_id"),
        Index("idx_event_type", "project_id", "event_type"),
    )

    def to_envelope(self) -> dict:
        import datetime
        ts = self.timestamp
        if not ts:
            try:
                ts = int(datetime.datetime.fromisoformat(self.created_at).timestamp() * 1000)
            except Exception:
                ts = int(datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000)
        return {
            "event_id": self.id,
            "workspace_id": self.workspace_id or self.project_id,
            "event_type": self.event_type,
            "actor_type": self.actor_type,
            "actor_id": self.actor_id,
            "entity_type": self.entity_type,
            "entity_id": self.entity_id,
            "payload": self.payload,
            "context_version": self.context_version,
            "artifact_version": self.artifact_version,
            "timestamp": ts,
            "correlation_id": self.correlation_id,
            "causation_id": self.causation_id,
            "created_at": self.created_at,
            "sequence_no": self.sequence_no,
        }


class AgentRunModel(Base):
    __tablename__ = "agent_runs"

    id = Column(String(64), primary_key=True)
    project_id = Column(String(64), ForeignKey("projects.id"), index=True, nullable=False)
    agent_id = Column(String(32), index=True, nullable=False)  # "nova", "pixel"
    status = Column(String(32), default="idle", nullable=False)  # "idle", "working", "waiting_for_review", "failed", "offline"
    lifecycle_state = Column(String(32), default="idle", nullable=False)  # "offline", "idle", "working", "waiting_for_approval", "recovering_context", "failed"
    task_description = Column(Text, nullable=False)
    context_pack = Column(JSON, nullable=False)
    base_context_version = Column(Integer, nullable=False)
    base_artifact_version = Column(Integer, nullable=False)
    last_checkpoint = Column(JSON, nullable=True)
    completed_work = Column(JSON, default=list, nullable=True)
    pending_work = Column(JSON, default=list, nullable=True)
    idempotency_key = Column(String(64), index=True, nullable=True)
    last_processed_event_seq = Column(Integer, default=0, nullable=False)
    source = Column(String(32), default="live_llm", nullable=False)
    prune_metadata = Column(JSON, nullable=True)
    last_heartbeat = Column(String(64), nullable=True)
    current_task = Column(Text, nullable=True)
    current_proposal_id = Column(String(64), nullable=True)
    task_start_time = Column(String(64), nullable=True)
    last_completed_task = Column(Text, nullable=True)
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
    prune_metadata = Column(JSON, nullable=True)
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


class DelegationModel(Base):
    __tablename__ = "delegations"

    id = Column(String(64), primary_key=True, default=lambda: f"del_{uuid.uuid4().hex[:10]}")
    project_id = Column(String(64), ForeignKey("projects.id"), index=True, nullable=False)
    source_agent = Column(String(32), nullable=False, index=True)   # "nova", "pixel"
    target_agent = Column(String(32), nullable=False, index=True)   # "pixel", "nova"
    task = Column(Text, nullable=False)
    scope = Column(Text, nullable=True)
    acceptance_criteria = Column(JSON, default=list, nullable=False)
    context_version = Column(Integer, default=1, nullable=False)
    artifact_version = Column(Integer, default=1, nullable=False)
    dependencies = Column(JSON, default=list, nullable=False)
    status = Column(String(32), default="pending", index=True, nullable=False)  # "pending", "in_progress", "completed", "failed", "cancelled"
    result_proposal_id = Column(String(64), ForeignKey("proposals.id"), nullable=True)
    feedback = Column(Text, nullable=True)
    correlation_id = Column(String(64), nullable=True, index=True)
    created_at = Column(String(64), default=utcnow_str, nullable=False)
    updated_at = Column(String(64), default=utcnow_str, nullable=False)

    __table_args__ = (
        Index("idx_del_proj_status", "project_id", "status"),
        Index("idx_del_agents", "source_agent", "target_agent"),
    )


class ApprovalRequestModel(Base):
    __tablename__ = "approvals"

    id = Column(String(64), primary_key=True, default=lambda: f"appr_{uuid.uuid4().hex[:10]}")
    project_id = Column(String(64), ForeignKey("projects.id"), index=True, nullable=False)
    requested_by = Column(String(64), nullable=False, index=True)   # "nova", "pixel"
    title = Column(String(255), nullable=False)
    explanation = Column(Text, nullable=False)
    escalation_reason = Column(Text, nullable=False)
    affected_requirements = Column(JSON, default=list, nullable=False)
    affected_sections = Column(JSON, default=list, nullable=False)
    expected_impact = Column(String(64), default="high", nullable=False)  # "low", "medium", "high", "critical"
    assigned_decider_id = Column(String(32), default="alex", nullable=False)  # "alex"
    proposal_id = Column(String(64), ForeignKey("proposals.id"), nullable=True)
    status = Column(String(32), default="pending", index=True, nullable=False)  # "pending", "approved", "rejected", "redirected", "clarification_requested"
    resolved_by = Column(String(32), nullable=True)
    resolution_note = Column(Text, nullable=True)
    resolved_at = Column(String(64), nullable=True)
    correlation_id = Column(String(64), nullable=True, index=True)
    created_at = Column(String(64), default=utcnow_str, nullable=False)
    updated_at = Column(String(64), default=utcnow_str, nullable=False)

    __table_args__ = (
        Index("idx_appr_proj_status", "project_id", "status"),
        Index("idx_appr_decider", "project_id", "assigned_decider_id"),
    )


class SharedResourceModel(Base):
    __tablename__ = "resources"

    id = Column(String(64), primary_key=True, default=lambda: f"res_{uuid.uuid4().hex[:10]}")
    project_id = Column(String(64), ForeignKey("projects.id"), index=True, nullable=False)
    resource_type = Column(String(64), index=True, nullable=False)  # "prototype", "requirement", "proposal", "event", "file", "version_snapshot"
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    creator_type = Column(String(32), default="system", nullable=False)  # "human", "agent", "system"
    creator_id = Column(String(64), nullable=False)
    data = Column(JSON, default=dict, nullable=False)
    related_proposal_id = Column(String(64), nullable=True)
    related_event_id = Column(String(64), nullable=True)
    artifact_version = Column(Integer, default=1, nullable=False)
    visibility = Column(String(32), default="workspace", nullable=False)  # "workspace", "restricted"
    created_at = Column(String(64), default=utcnow_str, nullable=False)
    updated_at = Column(String(64), default=utcnow_str, nullable=False)

    __table_args__ = (
        Index("idx_res_proj_type", "project_id", "resource_type"),
    )


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


class PruneReceiptModel(Base):
    __tablename__ = "prune_receipts"

    id = Column(String(64), primary_key=True)
    project_id = Column(String(64), nullable=True, index=True)
    prompt_hash = Column(String(64), nullable=True, index=True)
    cache_hit = Column(Boolean, default=False, nullable=False)
    tokens_prompt = Column(Integer, default=0, nullable=False)
    tokens_completion = Column(Integer, default=0, nullable=False)
    tokens_cached = Column(Integer, default=0, nullable=False)
    cost_usd = Column(Float, default=0.0, nullable=False)
    cost_saved_usd = Column(Float, default=0.0, nullable=False)
    model = Column(String(64), nullable=False)
    shield_status = Column(String(32), default="passed", nullable=False)
    shield_violation = Column(String(64), nullable=True)
    shield_reason = Column(Text, nullable=True)
    signature = Column(Text, nullable=False)
    public_key = Column(Text, nullable=False)
    receipt_data = Column(JSON, nullable=False)
    created_at = Column(String(64), default=utcnow_str, nullable=False)

    __table_args__ = (
        Index("idx_prune_proj_created", "project_id", "created_at"),
    )


class ExpenseModel(Base):
    __tablename__ = "expenses"

    id = Column(String(64), primary_key=True, default=lambda: f"exp_{uuid.uuid4().hex[:10]}")
    project_id = Column(String(64), ForeignKey("projects.id"), index=True, nullable=False)
    submitted_by = Column(String(64), nullable=False)        # "alex", "maya", "employee"
    amount = Column(Float, nullable=False)
    currency = Column(String(8), default="USD", nullable=False)
    category = Column(String(64), nullable=False)            # "Travel", "Meals", "Software", "Equipment", "Office"
    description = Column(Text, nullable=False)
    expense_date = Column(String(64), nullable=False)
    reference = Column(String(128), nullable=True)
    status = Column(String(32), default="pending_approval", index=True, nullable=False)  # "pending_approval", "approved", "rejected"
    threshold_exceeded = Column(Boolean, default=False, nullable=False)
    decided_by = Column(String(32), nullable=True)           # "alex", "maya"
    decision_reason = Column(Text, nullable=True)
    decided_at = Column(String(64), nullable=True)
    created_at = Column(String(64), default=utcnow_str, nullable=False)
    updated_at = Column(String(64), default=utcnow_str, nullable=False)

    __table_args__ = (
        Index("idx_expense_proj_status", "project_id", "status"),
        Index("idx_expense_category", "project_id", "category"),
    )


