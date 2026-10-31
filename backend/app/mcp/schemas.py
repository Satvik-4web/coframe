from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field


# --- Tool 1: get_workspace_context ---
class GetWorkspaceContextInput(BaseModel):
    project_id: str = Field(..., description="Project / Workspace ID")
    agent_id: str = Field(..., description="Calling agent identity (e.g. nova, pixel)")


class GetWorkspaceContextOutput(BaseModel):
    project_id: str
    project_name: str
    context_version: int
    artifact_version: int
    requirements: List[Dict[str, Any]]
    section_versions: Dict[str, int]
    members: List[Dict[str, Any]]


# --- Tool 2: get_artifact ---
class GetArtifactInput(BaseModel):
    project_id: str = Field(..., description="Project / Workspace ID")
    section_key: Optional[str] = Field(None, description="Optional section key (hero, dashboard, approval_queue, product_brief)")


class GetArtifactOutput(BaseModel):
    project_id: str
    artifact_version: int
    sections: Dict[str, Any]


# --- Tool 3: get_proposal_history ---
class GetProposalHistoryInput(BaseModel):
    project_id: str = Field(..., description="Project / Workspace ID")
    status: Optional[str] = Field(None, description="Filter by status (pending_review, stale, conflict, approved, rejected)")
    agent_id: Optional[str] = Field(None, description="Filter by creating agent (nova, pixel)")
    limit: int = Field(20, description="Max proposals to return")


class GetProposalHistoryOutput(BaseModel):
    total: int
    proposals: List[Dict[str, Any]]


# --- Tool 4: create_proposal ---
class CreateProposalInput(BaseModel):
    project_id: str = Field(..., description="Project / Workspace ID")
    agent_id: str = Field(..., description="Agent authoring proposal (nova, pixel)")
    summary: str = Field(..., description="Concise human-readable title of proposal")
    reasoning: str = Field(..., description="Strategic justification for change")
    affected_requirements: List[str] = Field(default_factory=list, description="List of requirement keys this proposal depends on")
    target_sections: List[str] = Field(default_factory=list, description="List of artifact section keys modified")
    changes: Dict[str, Any] = Field(default_factory=dict, description="Structured operations allowlist dict")
    base_context_version: int = Field(..., description="Context version used by agent")
    base_artifact_version: int = Field(..., description="Artifact version used by agent")
    base_section_versions: Dict[str, int] = Field(default_factory=dict, description="Section version map at time of proposal")
    requires_decision: bool = Field(False, description="Whether this proposal requires owner escalation")
    assigned_decider_id: Optional[str] = Field(None, description="Assigned decision owner (e.g. alex)")
    supersedes_proposal_id: Optional[str] = Field(None, description="Optional ID of proposal being revised")
    correlation_id: Optional[str] = Field(None, description="Correlation tracing ID")


class CreateProposalOutput(BaseModel):
    proposal_id: str
    status: str
    created_at: str
    requires_decision: bool
    summary: str


# --- Tool 5: send_workspace_message ---
class SendWorkspaceMessageInput(BaseModel):
    project_id: str = Field(..., description="Project / Workspace ID")
    sender_id: str = Field(..., description="Sender identity (agent or human)")
    message: str = Field(..., description="Message text or notification payload")
    message_type: str = Field("status", description="Type: status, notification, delegation_note, decision")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Optional metadata")


class SendWorkspaceMessageOutput(BaseModel):
    status: str
    event_id: str
    timestamp: int


# --- Tool 6: request_human_decision ---
class RequestHumanDecisionInput(BaseModel):
    project_id: str = Field(..., description="Project / Workspace ID")
    requested_by: str = Field(..., description="Agent initiating escalation (nova, pixel)")
    title: str = Field(..., description="Decision title")
    explanation: str = Field(..., description="Detailed explanation of the issue")
    escalation_reason: str = Field(..., description="Why human decision is required")
    affected_requirements: List[str] = Field(default_factory=list, description="Affected requirement keys")
    affected_sections: List[str] = Field(default_factory=list, description="Affected artifact sections")
    expected_impact: str = Field("high", description="Impact rating: low, medium, high, critical")
    assigned_decider_id: str = Field("alex", description="Authorized decider (default: alex)")
    proposal_id: Optional[str] = Field(None, description="Related proposal ID if applicable")
    correlation_id: Optional[str] = Field(None, description="Correlation tracing ID")


class RequestHumanDecisionOutput(BaseModel):
    approval_id: str
    status: str
    assigned_decider_id: str
    title: str


# --- Tool 7: get_agent_status ---
class GetAgentStatusInput(BaseModel):
    project_id: str = Field(..., description="Project / Workspace ID")
    agent_id: Optional[str] = Field(None, description="Optional specific agent identity")


class AgentPresenceInfo(BaseModel):
    agent_id: str
    status: str
    lifecycle_state: str
    task_description: str
    current_task: Optional[str] = None
    current_proposal_id: Optional[str] = None
    task_start_time: Optional[str] = None
    last_completed_task: Optional[str] = None
    last_heartbeat: Optional[str] = None


class GetAgentStatusOutput(BaseModel):
    agents: List[AgentPresenceInfo]


# --- Tool 8: get_workspace_events ---
class GetWorkspaceEventsInput(BaseModel):
    project_id: str = Field(..., description="Project / Workspace ID")
    event_type: Optional[str] = Field(None, description="Filter by canonical event type (e.g. proposal.created)")
    correlation_id: Optional[str] = Field(None, description="Filter by correlation chain ID")
    limit: int = Field(50, description="Max events to return")


class GetWorkspaceEventsOutput(BaseModel):
    total: int
    events: List[Dict[str, Any]]


# --- Tool 9: delegate_to_agent ---
class DelegateToAgentInput(BaseModel):
    project_id: str = Field(..., description="Project / Workspace ID")
    source_agent: str = Field(..., description="Delegating agent (e.g. nova)")
    target_agent: str = Field(..., description="Target agent to perform task (e.g. pixel)")
    task: str = Field(..., description="Description of the delegated assignment")
    scope: Optional[str] = Field(None, description="Boundaries and constraints of delegation")
    acceptance_criteria: List[str] = Field(default_factory=list, description="Specific criteria that must be satisfied")
    dependencies: List[str] = Field(default_factory=list, description="Required dependencies (requirements, sections)")
    correlation_id: Optional[str] = Field(None, description="Correlation tracing ID")


class DelegateToAgentOutput(BaseModel):
    delegation_id: str
    status: str
    source_agent: str
    target_agent: str
    task: str
    created_at: str


# --- Standard MCP Invocation Request & Response ---
class MCPToolCallRequest(BaseModel):
    project_id: str = Field(..., description="Target workspace / project ID")
    agent_id: str = Field(..., description="Caller identity (nova, pixel, alex, maya)")
    tool_name: str = Field(..., description="Tool to invoke")
    arguments: Dict[str, Any] = Field(default_factory=dict, description="Tool arguments")


class MCPToolCallResponse(BaseModel):
    tool_name: str
    success: bool
    result: Optional[Any] = None
    error: Optional[str] = None
    event_id: Optional[str] = None
