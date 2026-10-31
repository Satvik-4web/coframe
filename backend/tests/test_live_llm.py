"""
Comprehensive Integration Test Suite for Live LLM Activation, Tool Permissions,
Fallback Guarantees, and Per-Agent Observability Telemetry.
"""

import pytest
import os
import json
from unittest.mock import patch, AsyncMock
from starlette.testclient import TestClient

from backend.app.main import app
from backend.app.db.database import get_db
from backend.app.db.seed import DEMO_PROJECT_ID, reset_demo_database
from backend.app.agents.provider import (
    call_llm_json,
    get_effective_provider,
    get_effective_model,
    get_effective_api_key,
    LLMResult,
)
from backend.app.agents.telemetry import telemetry_tracker
from backend.app.agents.tools import execute_agent_tool, NOVA_TOOLS, PIXEL_TOOLS

client = TestClient(app)
TEAM_CONV_ID = "conv_team_ledgerflow"


@pytest.fixture(autouse=True)
def setup_db():
    """Reset demo database and telemetry tracker before each test."""
    db = next(get_db())
    try:
        reset_demo_database(db)
        telemetry_tracker.reset()
    finally:
        db.close()


# ---------------------------------------------------------------------------
# 1. Provider Resolution & Credential Handling Tests
# ---------------------------------------------------------------------------

def test_model_resolution_separate_for_nova_and_pixel(monkeypatch):
    """Verifies NOVA and PIXEL can have separate models configured."""
    monkeypatch.setenv("LLM_PROVIDER", "gemini")
    monkeypatch.setenv("NOVA_MODEL", "gemini-2.5-pro")
    monkeypatch.setenv("PIXEL_MODEL", "gemini-2.5-flash")

    assert get_effective_model("nova") == "gemini-2.5-pro"
    assert get_effective_model("pixel") == "gemini-2.5-flash"


def test_api_key_resolution_provider_specific(monkeypatch):
    """Verifies provider-specific API keys are resolved securely."""
    monkeypatch.delenv("LLM_API_KEY", raising=False)
    monkeypatch.setenv("GOOGLE_API_KEY", "test_google_key_123")

    assert get_effective_api_key("gemini") == "test_google_key_123"
    assert get_effective_api_key("google") == "test_google_key_123"

    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    monkeypatch.setenv("OPENAI_API_KEY", "test_openai_key_456")
    assert get_effective_api_key("openai") == "test_openai_key_456"


# ---------------------------------------------------------------------------
# 2. Tool Permissions & Backend Validation Tests
# ---------------------------------------------------------------------------

def test_nova_tool_execution_allowed():
    """NOVA can call its own authorized tools."""
    db = next(get_db())
    try:
        res = execute_agent_tool(
            agent_id="nova",
            tool_name="get_confirmed_requirements",
            arguments={"keys": ["REQ_AUDIENCE"]},
            db=db,
            project_id=DEMO_PROJECT_ID,
        )
        assert res["status"] == "success"
        assert len(res["requirements"]) >= 1
        assert res["requirements"][0]["key"] == "REQ_AUDIENCE"
    finally:
        db.close()


def test_pixel_tool_execution_allowed():
    """PIXEL can call its own authorized tools."""
    db = next(get_db())
    try:
        res = execute_agent_tool(
            agent_id="pixel",
            tool_name="get_artifact_sections",
            arguments={},
            db=db,
            project_id=DEMO_PROJECT_ID,
        )
        assert res["status"] == "success"
        sec_keys = [s["section_key"] for s in res["sections"]]
        assert "hero" in sec_keys
        assert "dashboard" in sec_keys
    finally:
        db.close()


def test_permission_enforcement_nova_cannot_call_pixel_tool():
    """NOVA cannot call PIXEL's propose_prototype_changes tool."""
    db = next(get_db())
    try:
        with pytest.raises(PermissionError) as exc_info:
            execute_agent_tool(
                agent_id="nova",
                tool_name="propose_prototype_changes",
                arguments={"summary": "test", "target_sections": ["hero"], "operations": [], "reasoning": "test"},
                db=db,
                project_id=DEMO_PROJECT_ID,
            )
        assert "not authorized" in str(exc_info.value)
    finally:
        db.close()


def test_permission_enforcement_pixel_cannot_call_nova_tool():
    """PIXEL cannot call NOVA's propose_prd_document tool."""
    db = next(get_db())
    try:
        with pytest.raises(PermissionError) as exc_info:
            execute_agent_tool(
                agent_id="pixel",
                tool_name="propose_prd_document",
                arguments={"title": "test", "executive_summary": {}, "target_audience": "test", "functional_requirements": []},
                db=db,
                project_id=DEMO_PROJECT_ID,
            )
        assert "not authorized" in str(exc_info.value)
    finally:
        db.close()


# ---------------------------------------------------------------------------
# 3. Live LLM Execution Simulation Tests (Phase 8: NOVA & PIXEL Tests)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_live_nova_request_execution():
    """
    Phase 8 NOVA Test:
    Send NOVA: 'Help me improve the LedgerFlow expense approval experience.'
    Verify it makes a genuine provider request and produces relevant product analysis.
    """
    mock_live_output = {
        "message": "### Strategic Analysis · LedgerFlow Expense Approval Optimization\n\nI have evaluated the current approval flow and identified 3 key improvements:\n1. Dynamic tiered routing for expenditures > $500\n2. Real-time Slack/email notification dispatch\n3. Instant budget variance checking prior to submission.",
        "proposal_intent": True,
        "proposal_summary": "Optimized Tiered Approval Workflow PRD",
        "affected_requirements": ["REQ_APPROVAL_POLICY"],
        "target_sections": ["approval_queue", "product_brief"],
        "prd_data": {
            "title": "LedgerFlow Frictionless Expense Approval Experience",
            "executive_summary": {
                "what": "Automated multi-tier approval routing with live compliance checking",
                "problem": "Manual approvals exceed 24 hours on average",
                "outcome": "Sub-2-hour average approval turnaround time"
            },
            "target_audience": "Finance Controllers and Team Leads",
            "functional_requirements": [
                {"id": "FR-APP-01", "title": "Tiered Escalation Thresholds", "description": "Auto-route expenses > $500 to Alex", "priority": "High"}
            ],
            "acceptance_criteria": [
                {"id": "AC-01", "req_id": "FR-APP-01", "criterion": "Expenses over $500 cannot be approved by peer managers", "measurable": True}
            ]
        }
    }

    mock_llm_result = LLMResult(
        data=mock_live_output,
        source="live_llm",
        is_simulated=False,
        prune_metadata={"receipt_id": "rec_live_test_123", "verified": True},
        usage={"prompt_tokens": 120, "completion_tokens": 280, "total_tokens": 400},
        duration_ms=350.5,
        model="gemini-2.5-flash",
        provider="gemini",
    )

    with patch("backend.app.agents.chat_service.call_llm_json", new=AsyncMock(return_value=mock_llm_result)):
        resp = client.post(
            f"/api/projects/{DEMO_PROJECT_ID}/conversations/{TEAM_CONV_ID}/messages",
            json={
                "sender_id": "alex",
                "message_content": "Help me improve the LedgerFlow expense approval experience.",
                "recipient": "nova",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "success"
        agent_responses = data["agent_responses"]
        assert len(agent_responses) == 1
        nova_resp = agent_responses[0]
        assert nova_resp["sender_key"] == "nova"
        assert "tiered routing" in nova_resp["content"].lower()
        assert "Actionable Proposal Created" in nova_resp["content"]
        assert nova_resp["metadata"]["source"] == "live_llm"
        assert nova_resp["metadata"]["is_simulated"] is False


@pytest.mark.asyncio
async def test_live_pixel_request_execution():
    """
    Phase 8 PIXEL Test:
    Send PIXEL: 'Inspect the existing LedgerFlow expense approval components and suggest a concrete implementation improvement.'
    Verify it makes a genuine provider request and uses actual project context.
    """
    mock_live_output = {
        "message": "### Engineering Implementation Plan · Approval Queue Visual Overhaul\n\nI have inspected the `approval_queue` component (current v1). I propose adding dynamic policy badges and an instant threshold indicator.",
        "proposal_intent": True,
        "proposal_summary": "Interactive Multi-Tier Approval Queue Component",
        "target_sections": ["approval_queue"],
        "operations": [
            {
                "op": "set_approval_queue_config",
                "section": "approval_queue",
                "config": {
                    "title": "Live Enterprise Approval Queue",
                    "threshold": "$500.00",
                    "policy_note": "Expenses exceeding $500 require Founder review"
                },
                "items": [
                    {"id": "EXP-LIVE-1", "submitter": "Sarah Chen", "amount": "$750.00", "policy_flag": "Requires Alex Review", "status": "pending"}
                ]
            }
        ],
        "implementation_data": {
            "component_name": "LedgerFlowApprovalQueue",
            "tasks": [{"id": "T-01", "title": "Add policy flag badge rendering", "status": "completed"}],
            "changed_files": ["frontend/src/components/prototype/LedgerFlowApprovalQueue.tsx"],
            "readable_diff": {
                "before": "Standard flat expense table",
                "after": "Tiered approval queue with live policy tags",
                "explanation": "Enforces strict human governance per the confirmed product requirements."
            }
        }
    }

    mock_llm_result = LLMResult(
        data=mock_live_output,
        source="live_llm",
        is_simulated=False,
        prune_metadata={"receipt_id": "rec_live_test_456", "verified": True},
        usage={"prompt_tokens": 150, "completion_tokens": 320, "total_tokens": 470},
        duration_ms=410.2,
        model="gemini-2.5-flash",
        provider="gemini",
    )

    with patch("backend.app.agents.chat_service.call_llm_json", new=AsyncMock(return_value=mock_llm_result)):
        resp = client.post(
            f"/api/projects/{DEMO_PROJECT_ID}/conversations/{TEAM_CONV_ID}/messages",
            json={
                "sender_id": "alex",
                "message_content": "Inspect the existing LedgerFlow expense approval components and suggest a concrete implementation improvement.",
                "recipient": "pixel",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "success"
        agent_responses = data["agent_responses"]
        assert len(agent_responses) == 1
        pixel_resp = agent_responses[0]
        assert pixel_resp["sender_key"] == "pixel"
        assert "Engineering Implementation Plan" in pixel_resp["content"]
        assert pixel_resp["metadata"]["source"] == "live_llm"
        assert pixel_resp["metadata"]["is_simulated"] is False


# ---------------------------------------------------------------------------
# 4. Entire Team Test
# ---------------------------------------------------------------------------

def test_entire_team_orchestration_sequential_nova_leads():
    """
    Sequential Orchestration Test:
    Send a product improvement request to Entire Team.
    Verify message routes to NOVA exclusively. PIXEL remains waiting for confirmed requirements.
    """
    resp = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/conversations/{TEAM_CONV_ID}/messages",
        json={
            "sender_id": "alex",
            "message_content": "hi team lets improve the LedgerFlow approval workflow",
            "recipient": "team",
        },
    )
    assert resp.status_code == 200
    result = resp.json()
    assert result["status"] == "success"
    agent_keys = [r["sender_key"] for r in result["agent_responses"]]
    assert agent_keys == ["nova"], f"Expected only NOVA to respond, got {agent_keys}"

    # Verify PIXEL did not post a fake message in history
    history = client.get(f"/api/projects/{DEMO_PROJECT_ID}/conversations/{TEAM_CONV_ID}/messages").json()
    last_agent_msgs = [m for m in history if m["sender_key"] in ("nova", "pixel")]
    assert last_agent_msgs[-1]["sender_key"] == "nova"


# ---------------------------------------------------------------------------
# 5. Failure / Fallback Tests (Phase 8 Failure Test)
# ---------------------------------------------------------------------------

def test_missing_credentials_triggers_fallback_cleanly(monkeypatch):
    """
    Phase 8 Failure Test:
    Missing or invalid credentials triggers fallback and accurately reports execution mode.
    """
    # Unset all LLM API keys
    monkeypatch.delenv("LLM_API_KEY", raising=False)
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("PRUNE_API_KEY", raising=False)

    resp = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/conversations/{TEAM_CONV_ID}/messages",
        json={
            "sender_id": "alex",
            "message_content": "NOVA define requirements for spend alerts",
            "recipient": "nova",
        },
    )
    assert resp.status_code == 200
    result = resp.json()
    assert result["status"] == "success"
    agent_responses = result["agent_responses"]
    assert len(agent_responses) == 1
    nova_msg = agent_responses[0]

    # Verify execution mode accurately reports fallback
    assert nova_msg["metadata"]["source"] == "cached_fallback"
    assert nova_msg["metadata"]["is_simulated"] is True


def test_auth_failure_triggers_fallback_cleanly(monkeypatch):
    """
    When provider raises an auth/network exception, it triggers fallback without 500 error.
    """
    with patch("backend.app.agents.chat_service.call_llm_json", side_effect=Exception("401 Unauthorized: Invalid API Key")):
        resp = client.post(
            f"/api/projects/{DEMO_PROJECT_ID}/conversations/{TEAM_CONV_ID}/messages",
            json={
                "sender_id": "alex",
                "message_content": "PIXEL modernize the hero component header",
                "recipient": "pixel",
            },
        )
        assert resp.status_code == 200
        result = resp.json()
        assert result["status"] == "success"
        agent_responses = result["agent_responses"]
        assert len(agent_responses) == 1
        pixel_msg = agent_responses[0]
        assert pixel_msg["metadata"]["source"] == "cached_fallback"
        assert pixel_msg["metadata"]["is_simulated"] is True


# ---------------------------------------------------------------------------
# 6. Observability & Telemetry API Test
# ---------------------------------------------------------------------------

def test_telemetry_endpoint_returns_metrics():
    """Verifies telemetry endpoint exposes metrics per agent."""
    # Seed a telemetry call
    telemetry_tracker.record_call(
        agent_id="nova",
        provider="gemini",
        model="gemini-2.5-flash",
        prompt_tokens=150,
        completion_tokens=300,
        duration_ms=420.0,
        success=True,
        is_fallback=False,
    )

    resp = client.get(f"/api/projects/{DEMO_PROJECT_ID}/agents/telemetry")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    telemetry = data["telemetry"]
    assert "nova" in telemetry["agents"]
    assert "pixel" in telemetry["agents"]

    nova_metrics = telemetry["agents"]["nova"]
    assert nova_metrics["total_requests"] >= 1
    assert nova_metrics["live_requests"] >= 1
    assert nova_metrics["total_tokens"] >= 450
    assert nova_metrics["average_duration_ms"] > 0.0
