from typing import Any, Dict, List, Optional
from enum import Enum
from pydantic import BaseModel, Field, field_validator


class NovaReviewStatus(str, Enum):
    AFFECTED = "AFFECTED"
    NOT_AFFECTED = "NOT_AFFECTED"
    UNCERTAIN = "UNCERTAIN"
    REVIEW_FAILED = "REVIEW_FAILED"


class NovaRecommendedAction(str, Enum):
    REGENERATE = "REGENERATE"
    REVIEW_MANUALLY = "REVIEW_MANUALLY"
    NO_CHANGE = "NO_CHANGE"


class NovaReverificationResult(BaseModel):
    review_status: NovaReviewStatus
    missing_dependencies: List[str] = Field(default_factory=list)
    affected_sections: List[str] = Field(default_factory=list)
    impact_explanation: str
    recommended_action: NovaRecommendedAction
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    reviewed_requirement_versions: Dict[str, int] = Field(default_factory=dict)

    @field_validator("review_status", mode="before")
    @classmethod
    def normalize_status(cls, v):
        if isinstance(v, str):
            v_upper = v.upper()
            if v_upper in NovaReviewStatus.__members__:
                return NovaReviewStatus(v_upper)
        return v

    @field_validator("recommended_action", mode="before")
    @classmethod
    def normalize_action(cls, v):
        if isinstance(v, str):
            v_upper = v.upper()
            if v_upper in NovaRecommendedAction.__members__:
                return NovaRecommendedAction(v_upper)
        return v



class ProposalModelOutput(BaseModel):
    """Schema enforced strictly on LLM output. Model must NOT supply metadata."""
    summary: str
    reasoning: str
    affected_requirements: List[str]
    target_sections: List[str]
    changes: Dict[str, Any]


class ProposalRecord(BaseModel):
    """Backend-owned stamped authoritative proposal record."""
    proposal_id: str
    project_id: str
    agent_id: str  # "nova" | "pixel"
    run_id: str
    supersedes_proposal_id: Optional[str] = None
    summary: str
    reasoning: str
    affected_requirements: List[str]
    target_sections: List[str]
    changes: Dict[str, Any]
    base_context_version: int
    base_artifact_version: int
    base_section_versions: Dict[str, int]
    requires_decision: bool = False
    assigned_decider_id: Optional[str] = None
    status: str = "pending_review"  # "pending_review" | "stale" | "conflict" | "approved" | "rejected" | "superseded"
    stale_reason: Optional[str] = None
    conflict_reason: Optional[str] = None
    source: str = "live_llm"  # "live_llm" | "cached_fallback"
    is_simulated: bool = False
    prune_metadata: Optional[Dict[str, Any]] = None
    nova_review: Optional[Dict[str, Any]] = None
    created_at: str
    updated_at: str


class ProposalApproveRequest(BaseModel):
    decided_by: str = "alex"  # "alex" or "maya"
    manual_review: bool = False


class ProposalRejectRequest(BaseModel):
    decided_by: str = "alex"
    reason: Optional[str] = None


class ProposalRedirectRequest(BaseModel):
    decided_by: str = "alex"
    instruction: str


class ProposalReconcileRequest(BaseModel):
    requested_by: str = "maya"


class HumanProposalCreateRequest(BaseModel):
    author: str  # must be "alex" or "maya"
    summary: str
    reasoning: str
    target_sections: List[str]
    changes: Dict[str, Any]
    affected_requirements: Optional[List[str]] = None
    task_id: Optional[str] = None
    requires_decision: Optional[bool] = False
    assigned_decider_id: Optional[str] = "alex"



class ConfirmRequirementsRequest(BaseModel):
    confirmed_by: str = "alex"
    note: Optional[str] = "Confirmed product requirements. Ready for engineering implementation."


class ConflictResolutionRequest(BaseModel):
    resolution_mode: str = "reconcile_pixel"  # "reconcile_pixel" | "keep_human" | "custom_merge"
    decided_by: str = "alex"  # "alex" or "maya"
    note: Optional[str] = None
    custom_changes: Optional[Dict[str, Any]] = None


class ConflictingField(BaseModel):
    field: str
    proposed: Any
    canonical: Any


class ProposalConflictResponse(BaseModel):
    is_conflicted: bool
    proposal_id: str
    section_key: str
    base_version: int
    canonical_version: int
    intervening_user: str
    intervening_timestamp: str
    intervening_summary: Optional[str] = None
    conflict_reason: str
    proposed_content: Dict[str, Any]
    canonical_content: Dict[str, Any]
    conflicting_fields: List[ConflictingField]
    can_auto_reconcile: bool = True


class ProposalStatsResponse(BaseModel):
    awaiting_confirmation: int
    implementations_in_progress: int
    ready_for_review: int
    conflicted: int
    recently_applied: int
    total: int
    by_contributor: Dict[str, int]


class PlanApproveRequest(BaseModel):
    decided_by: str = "alex"
    note: Optional[str] = "Implementation plan approved. Proceed to execution environment selection."


class PlanExecuteRequest(BaseModel):
    execution_mode: str = "pixel_in_app"  # "connected_ide" | "pixel_in_app"
    environment_id: str = "pixel_sandbox"  # "antigravity_ide" | "pixel_sandbox" | "cursor"
    initiated_by: str = "alex"
    instructions: Optional[str] = None


class ExecutionEnvironmentResponse(BaseModel):
    id: str
    name: str
    mode: str  # "connected_ide" | "pixel_in_app"
    is_connected: bool
    status: str
    description: str
    capabilities: List[str]
