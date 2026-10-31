from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class EventRecord(BaseModel):
    id: str
    sequence_no: int
    project_id: str
    actor_type: str  # "human" | "agent" | "system"
    actor_id: str    # "alex" | "maya" | "nova" | "pixel" | "system"
    event_type: str  # "HUMAN_REQUIREMENT_EDITED", "HUMAN_SECTION_EDITED", "AGENT_RUN_STARTED", etc.
    context_version: int
    artifact_version: int
    payload: Dict[str, Any] = Field(default_factory=dict)
    created_at: str
