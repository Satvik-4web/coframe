from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class RequirementItem(BaseModel):
    id: str
    key: str
    title: str
    value: Any
    version: int


class AgentTask(BaseModel):
    task_id: str
    description: str
    last_checkpoint: Optional[str] = None


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
