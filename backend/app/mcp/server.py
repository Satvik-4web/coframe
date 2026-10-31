import logging
from typing import Dict, Any, List, Optional, Callable
from sqlalchemy.orm import Session
from pydantic import ValidationError

from backend.app.events.logger import log_event
from backend.app.mcp.schemas import (
    GetWorkspaceContextInput,
    GetArtifactInput,
    GetProposalHistoryInput,
    CreateProposalInput,
    SendWorkspaceMessageInput,
    RequestHumanDecisionInput,
    GetAgentStatusInput,
    GetWorkspaceEventsInput,
    DelegateToAgentInput,
    MCPToolCallRequest,
    MCPToolCallResponse,
)
from backend.app.mcp.tools import (
    execute_get_workspace_context,
    execute_get_artifact,
    execute_get_proposal_history,
    execute_create_proposal,
    execute_send_workspace_message,
    execute_request_human_decision,
    execute_get_agent_status,
    execute_get_workspace_events,
    execute_delegate_to_agent,
)

logger = logging.getLogger("coframe.mcp")


class COFRAMEMCPServer:
    """
    Lightweight Model Context Protocol (MCP) server for COFRAME.
    Provides typed, controlled, and auditable tool-calling capabilities to NOVA, PIXEL,
    and external autonomous agent harnesses without direct database mutation.
    """

    def __init__(self):
        self._tools: Dict[str, Dict[str, Any]] = {
            "get_workspace_context": {
                "description": "Retrieve project info, context/artifact versions, verified requirements, and member roster.",
                "schema": GetWorkspaceContextInput.model_json_schema(),
                "executor": execute_get_workspace_context,
                "input_cls": GetWorkspaceContextInput,
                "allowed_callers": ["nova", "pixel", "alex", "maya", "system"],
            },
            "get_artifact": {
                "description": "Inspect full or section-specific LedgerFlow artifact data and version metadata.",
                "schema": GetArtifactInput.model_json_schema(),
                "executor": execute_get_artifact,
                "input_cls": GetArtifactInput,
                "allowed_callers": ["nova", "pixel", "alex", "maya", "system"],
            },
            "get_proposal_history": {
                "description": "Query proposal records with status and agent filters.",
                "schema": GetProposalHistoryInput.model_json_schema(),
                "executor": execute_get_proposal_history,
                "input_cls": GetProposalHistoryInput,
                "allowed_callers": ["nova", "pixel", "alex", "maya", "system"],
            },
            "create_proposal": {
                "description": "Authoritatively stamp and persist an agent proposal into the review queue.",
                "schema": CreateProposalInput.model_json_schema(),
                "executor": execute_create_proposal,
                "input_cls": CreateProposalInput,
                "allowed_callers": ["nova", "pixel", "alex", "maya", "system"],
            },
            "send_workspace_message": {
                "description": "Post a collaborative update or status notice to the team workspace.",
                "schema": SendWorkspaceMessageInput.model_json_schema(),
                "executor": execute_send_workspace_message,
                "input_cls": SendWorkspaceMessageInput,
                "allowed_callers": ["nova", "pixel", "alex", "maya", "system"],
            },
            "request_human_decision": {
                "description": "Escalate a high-impact policy or architectural change requiring owner sign-off.",
                "schema": RequestHumanDecisionInput.model_json_schema(),
                "executor": execute_request_human_decision,
                "input_cls": RequestHumanDecisionInput,
                "allowed_callers": ["nova", "pixel", "alex", "maya", "system"],
            },
            "get_agent_status": {
                "description": "Inspect live agent presence, lifecycle state, current tasks, and heartbeats.",
                "schema": GetAgentStatusInput.model_json_schema(),
                "executor": execute_get_agent_status,
                "input_cls": GetAgentStatusInput,
                "allowed_callers": ["nova", "pixel", "alex", "maya", "system"],
            },
            "get_workspace_events": {
                "description": "Retrieve immutable, typed event history with correlation filtering.",
                "schema": GetWorkspaceEventsInput.model_json_schema(),
                "executor": execute_get_workspace_events,
                "input_cls": GetWorkspaceEventsInput,
                "allowed_callers": ["nova", "pixel", "alex", "maya", "system"],
            },
            "delegate_to_agent": {
                "description": "Delegate a focused implementation or strategy assignment from one agent to another.",
                "schema": DelegateToAgentInput.model_json_schema(),
                "executor": execute_delegate_to_agent,
                "input_cls": DelegateToAgentInput,
                "allowed_callers": ["nova", "pixel", "alex", "maya", "system"],
            },
        }

    def list_tools(self) -> List[Dict[str, Any]]:
        """Returns standard MCP tool discovery manifest."""
        return [
            {
                "name": name,
                "description": meta["description"],
                "inputSchema": meta["schema"],
                "allowed_callers": meta["allowed_callers"],
            }
            for name, meta in self._tools.items()
        ]

    async def call_tool(
        self,
        db: Session,
        call_req: MCPToolCallRequest,
    ) -> MCPToolCallResponse:
        """
        Validates caller permissions, parses arguments with strict Pydantic model,
        dispatches to backend executor, logs audit event, and returns response.
        """
        tool_name = call_req.tool_name
        if tool_name not in self._tools:
            return MCPToolCallResponse(
                tool_name=tool_name,
                success=False,
                error=f"Tool '{tool_name}' is not registered on COFRAME MCP Server.",
            )

        tool_meta = self._tools[tool_name]
        caller = call_req.agent_id.lower().strip()

        # Permission check
        if caller not in tool_meta["allowed_callers"]:
            return MCPToolCallResponse(
                tool_name=tool_name,
                success=False,
                error=f"Caller '{caller}' is not authorized to execute tool '{tool_name}'.",
            )

        # Merge project_id into arguments if missing
        args_dict = dict(call_req.arguments or {})
        if "project_id" not in args_dict:
            args_dict["project_id"] = call_req.project_id
        if "agent_id" not in args_dict and tool_name in ["get_workspace_context", "create_proposal"]:
            args_dict["agent_id"] = caller
        if "sender_id" not in args_dict and tool_name == "send_workspace_message":
            args_dict["sender_id"] = caller
        if "requested_by" not in args_dict and tool_name == "request_human_decision":
            args_dict["requested_by"] = caller
        if "source_agent" not in args_dict and tool_name == "delegate_to_agent":
            args_dict["source_agent"] = caller

        # Validate with Pydantic
        input_cls = tool_meta["input_cls"]
        try:
            validated_input = input_cls(**args_dict)
        except ValidationError as ve:
            return MCPToolCallResponse(
                tool_name=tool_name,
                success=False,
                error=f"Invalid arguments for {tool_name}: {str(ve)}",
            )

        # Execute
        try:
            executor: Callable = tool_meta["executor"]
            output = await executor(db, validated_input)

            # Record tool outcome in event log
            event = log_event(
                db=db,
                project_id=call_req.project_id,
                actor_type="agent" if caller in ["nova", "pixel"] else "human",
                actor_id=caller,
                event_type="mcp.tool_completed",
                payload={
                    "tool": tool_name,
                    "success": True,
                },
                auto_commit=True,
            )

            result_data = output.model_dump() if hasattr(output, "model_dump") else output

            return MCPToolCallResponse(
                tool_name=tool_name,
                success=True,
                result=result_data,
                event_id=event.id,
            )
        except Exception as e:
            logger.error(f"Error executing MCP tool '{tool_name}': {e}", exc_info=True)
            return MCPToolCallResponse(
                tool_name=tool_name,
                success=False,
                error=str(e),
            )


# Global singleton instance
coframe_mcp_server = COFRAMEMCPServer()
