from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


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
    created_at: str
    updated_at: str


class ProposalApproveRequest(BaseModel):
    decided_by: str = "alex"  # "alex" or "maya"


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
