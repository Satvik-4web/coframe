from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.db.database import get_db
from backend.app.mcp.server import coframe_mcp_server
from backend.app.mcp.schemas import MCPToolCallRequest, MCPToolCallResponse

router = APIRouter(prefix="/mcp", tags=["mcp"])


@router.get("/tools")
def list_mcp_tools():
    """
    Exposes the MCP tool discovery manifest for autonomous agents and external tools.
    Lists tool names, descriptions, input schemas, and access control policies.
    """
    return {
        "status": "online",
        "protocol": "Model Context Protocol (MCP)",
        "version": "1.0.0",
        "server": "COFRAME MCP Workspace Engine",
        "tools": coframe_mcp_server.list_tools(),
    }


@router.post("/call", response_model=MCPToolCallResponse)
async def call_mcp_tool(
    req: MCPToolCallRequest,
    db: Session = Depends(get_db),
):
    """
    Executes a controlled, typed COFRAME workspace tool on behalf of an agent or human.
    Enforces role permissions, input validation, transaction boundaries, and event logging.
    """
    response = await coframe_mcp_server.call_tool(db=db, call_req=req)
    if not response.success and response.error and "not authorized" in response.error:
        raise HTTPException(status_code=403, detail=response.error)
    return response
