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

