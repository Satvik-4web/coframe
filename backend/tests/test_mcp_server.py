import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.db.database import SessionLocal
from backend.app.db.seed import reset_demo_database
from backend.app.mcp.server import coframe_mcp_server
from backend.app.mcp.schemas import MCPToolCallRequest


@pytest.fixture(scope="module", autouse=True)
def setup_demo_db():
    db = SessionLocal()
    reset_demo_database(db)
    db.close()


@pytest.fixture
def client():
    return TestClient(app)


def test_mcp_server_lists_all_nine_tools():
    manifest = coframe_mcp_server.list_tools()
    assert len(manifest) == 9
    tool_names = {t["name"] for t in manifest}
    expected_tools = {
        "get_workspace_context",
        "get_artifact",
        "get_proposal_history",
        "create_proposal",
        "send_workspace_message",
        "request_human_decision",
        "get_agent_status",
        "get_workspace_events",
        "delegate_to_agent",
    }
    assert expected_tools == tool_names


@pytest.mark.asyncio
async def test_mcp_get_workspace_context():
    db = SessionLocal()
    try:
        req = MCPToolCallRequest(
            project_id="demo-ledgerflow",
            agent_id="nova",
            tool_name="get_workspace_context",
            arguments={"project_id": "demo-ledgerflow"},
        )
        res = await coframe_mcp_server.call_tool(db, req)
        assert res.success is True
        assert res.result["project_id"] == "demo-ledgerflow"
        assert res.result["context_version"] >= 1
        assert len(res.result["requirements"]) > 0
    finally:
        db.close()


@pytest.mark.asyncio
async def test_mcp_get_artifact_section():
    db = SessionLocal()
    try:
        req = MCPToolCallRequest(
            project_id="demo-ledgerflow",
            agent_id="pixel",
            tool_name="get_artifact",
            arguments={"project_id": "demo-ledgerflow", "section_key": "hero"},
        )
        res = await coframe_mcp_server.call_tool(db, req)
        assert res.success is True
        assert "hero" in res.result["sections"]
        assert "data" in res.result["sections"]["hero"]
        assert "headline" in res.result["sections"]["hero"]["data"]
    finally:
        db.close()


@pytest.mark.asyncio
async def test_mcp_send_workspace_message():
    db = SessionLocal()
    try:
        req = MCPToolCallRequest(
            project_id="demo-ledgerflow",
            agent_id="nova",
            tool_name="send_workspace_message",
            arguments={
                "project_id": "demo-ledgerflow",
                "recipient": "maya",
                "message": "Strategy update ready for review.",
            },
        )
        res = await coframe_mcp_server.call_tool(db, req)
        assert res.success is True
        assert res.result["status"] == "sent"
    finally:
        db.close()


@pytest.mark.asyncio
async def test_mcp_request_human_decision():
    db = SessionLocal()
    try:
        req = MCPToolCallRequest(
            project_id="demo-ledgerflow",
            agent_id="nova",
            tool_name="request_human_decision",
            arguments={
                "project_id": "demo-ledgerflow",
                "title": "Pricing Tier Escalation",
                "explanation": "Agent proposes enterprise tier revision exceeding automated limit",
                "escalation_reason": "High impact financial logic change",
                "affected_requirements": ["REQ_PRICING"],
                "affected_sections": ["metric_grid"],
                "expected_impact": "high",
                "assigned_decider_id": "alex",
            },
        )
        res = await coframe_mcp_server.call_tool(db, req)
        assert res.success is True
        assert res.result["status"] == "pending"
        assert res.result["assigned_decider_id"] == "alex"
        assert res.result["approval_id"].startswith("appr_")
    finally:
        db.close()


@pytest.mark.asyncio
async def test_mcp_delegate_to_agent():
    db = SessionLocal()
    try:
        req = MCPToolCallRequest(
            project_id="demo-ledgerflow",
            agent_id="nova",
            tool_name="delegate_to_agent",
            arguments={
                "project_id": "demo-ledgerflow",
                "target_agent": "pixel",
                "task": "Build audit table for reconciliation",
                "scope": "metric_grid only",
                "acceptance_criteria": ["4 columns rendered", "Status colors applied"],
            },
        )
        res = await coframe_mcp_server.call_tool(db, req)
        assert res.success is True
        assert res.result["status"] == "pending"
        assert res.result["delegation_id"].startswith("del_")
    finally:
        db.close()


def test_mcp_rest_endpoints(client):
    # Test GET /api/mcp/tools
    res = client.get("/api/mcp/tools")
    assert res.status_code == 200
    data = res.json()
    assert len(data["tools"]) == 9

    # Test POST /api/mcp/call
    call_res = client.post(
        "/api/mcp/call",
        json={
            "project_id": "demo-ledgerflow",
            "agent_id": "alex",
            "tool_name": "get_agent_status",
            "arguments": {
                "project_id": "demo-ledgerflow",
                "agent_id": "nova",
            },
        },
    )
    assert call_res.status_code == 200
    call_data = call_res.json()
    assert call_data["tool_name"] == "get_agent_status"
    assert "agents" in call_data["result"]
    assert any(a["agent_id"] == "nova" for a in call_data["result"]["agents"])
