from typing import Any, Dict, List, Optional
from enum import Enum
from pydantic import BaseModel, Field


class PixelComponentType(str, Enum):
    HEADER = "header"
    NAVBAR = "navbar"
    HERO = "hero"
    CARD = "card"
    BUTTON_GROUP = "button_group"
    FORM = "form"
    TABLE = "table"
    METRICS_GRID = "metrics_grid"
    CHART = "chart"
    SIDEBAR = "sidebar"
    CONTAINER = "container"


class PixelTaskStatus(str, Enum):
    PENDING = "pending"
    BUILDING = "building"
    COMPLETED = "completed"
    FAILED = "failed"


class PixelUIComponent(BaseModel):
    id: str
    type: PixelComponentType
    title: str
    description: Optional[str] = None
    props: Dict[str, Any] = Field(default_factory=dict)
    order: int = 0
    status: PixelTaskStatus = PixelTaskStatus.PENDING


class PixelBuildTask(BaseModel):
    id: str
    title: str
    description: str
    component_id: str
    status: PixelTaskStatus = PixelTaskStatus.PENDING
    logs: List[str] = Field(default_factory=list)
    started_at: Optional[str] = None
    completed_at: Optional[str] = None


class PixelBuildRequest(BaseModel):
    instruction: Optional[str] = ""
    plan_id: Optional[str] = None
    prd_id: Optional[str] = None
    execution_assignment_id: Optional[str] = None
    submitter_id: Optional[str] = "alex"
    execution_mode: Optional[str] = "pixel_in_app"


class PixelBuildSessionResponse(BaseModel):
    id: str
    project_id: str
    plan_id: Optional[str] = None
    prd_id: Optional[str] = None
    execution_assignment_id: Optional[str] = None
    run_id: Optional[str] = None
    instruction: str
    understanding: Optional[str] = None
    status: str
    progress_pct: int = 0
    current_task_id: Optional[str] = None
    tasks: List[PixelBuildTask] = Field(default_factory=list)
    components: List[PixelUIComponent] = Field(default_factory=list)
    proposal_id: Optional[str] = None
    error_message: Optional[str] = None
    execution_source: str = "live_llm"
    is_simulated: bool = False
    tokens_used: int = 0
    retry_count: int = 0
    created_at: str
    updated_at: str
    completed_at: Optional[str] = None
