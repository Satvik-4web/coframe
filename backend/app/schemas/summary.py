from typing import List, Optional
from pydantic import BaseModel, Field


class ObserverSummaryResponse(BaseModel):
    what_changed: str
    why: str
    what_happens_next: str
    source_event_ids: List[str] = Field(default_factory=list)
    context_version: int
    artifact_version: int
    source: str = "rule_based_fallback"  # "live_llm" | "rule_based_fallback"
    is_simulated: bool = False
