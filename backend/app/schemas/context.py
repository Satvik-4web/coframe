from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ContextProvenance(BaseModel):
    source_id: str
    source_type: str  # "requirement", "artifact_section", "decision", "event", "proposal", "historical_requirement"
    project_id: str
    version: int
    timestamp: str
    approval_status: str  # "approved", "draft", "outdated", "rejected", "stale", "pending_review"
    retrieval_reason: str
    relevance_score: float
    scoring_breakdown: Optional[Dict[str, float]] = Field(default_factory=dict)


class RequirementItem(BaseModel):
    id: str
    key: str
    title: str
    value: Any
    version: int
    status: str = "approved"  # "approved", "draft", "outdated", "rejected"
    is_current: bool = True
    provenance: Optional[ContextProvenance] = None


class HistoricalContextItem(BaseModel):
    source_id: str
    source_type: str
    key: str
    title: Optional[str] = None
    value: Any
    version: int
    status: str = "outdated"
    timestamp: str
    reason_archived: Optional[str] = None
    superseded_by_version: Optional[int] = None


class ContextRetrievalMetrics(BaseModel):
    retrieval_latency_ms: float
    estimated_token_count: int
    total_candidates_evaluated: int
    items_retrieved: int


class AgentTask(BaseModel):
    task_id: str
    description: str
    last_checkpoint: Optional[str] = None
    target_sections: Optional[List[str]] = Field(default_factory=list)
    affected_requirements: Optional[List[str]] = Field(default_factory=list)


class ContextPack(BaseModel):
    project_id: str
    agent_id: str
    run_id: str
    context_version: int
    artifact_version: int
    section_versions: Dict[str, int]
    requirements: List[RequirementItem]
    approved_decisions: List[Dict[str, Any]] = Field(default_factory=list)
    artifact_summary: Dict[str, Any] = Field(default_factory=dict)
    relevant_events: List[Dict[str, Any]] = Field(default_factory=list)
    open_proposals: List[Dict[str, Any]] = Field(default_factory=list)
    agent_task: AgentTask
    offline_changes: List[Dict[str, Any]] = Field(default_factory=list)

    # Context Retrieval Enhancement fields
    authoritative_context: Dict[str, Any] = Field(default_factory=dict)
    advisory_context: Dict[str, Any] = Field(default_factory=dict)
    historical_context: List[HistoricalContextItem] = Field(default_factory=list)
    item_provenance: List[ContextProvenance] = Field(default_factory=list)
    retrieval_metrics: Optional[ContextRetrievalMetrics] = None
    retrieval_mode: str = "hybrid_task_aware"
