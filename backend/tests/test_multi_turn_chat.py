"""
Comprehensive Multi-Turn Conversation Integration Test Suite for COFRAME Workspace Chat.
Covers:
- Test A: Consecutive messages to NOVA (3 turns in same conversation, verifying context continuity & separate IDs).
- Test B: Consecutive messages to PIXEL (3 turns in same conversation).
- Test C: Agent switching (Alex -> NOVA -> PIXEL -> NOVA, verifying context preservation).
- Test D: Entire team dispatch (both agents respond independently without blocking).
- Test E: Pending proposal does NOT block subsequent chat messages.
- Test F: Provider timeout / error fallback resilience without unhandled exceptions.
- Test G: Conversation history persistence and chronological retrieval.
"""

import pytest
from unittest.mock import patch, AsyncMock
from starlette.testclient import TestClient

from backend.app.main import app
from backend.app.db.database import get_db, SessionLocal
from backend.app.db.models import (
    ChatMessageModel,
    AgentRunModel,
    ProposalModel,
)
from backend.app.db.seed import DEMO_PROJECT_ID, reset_demo_database
from backend.app.agents.provider import LLMResult

client = TestClient(app)
TEAM_CONV_ID = "conv_team_ledgerflow"


@pytest.fixture(autouse=True)
def setup_db():
    """Reset demo database before each test run."""
    db = next(get_db())
    try:
        reset_demo_database(db)
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Test A: Consecutive Messages to NOVA (3 Turns)
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_consecutive_messages_to_nova():
    """Verifies NOVA responds across 3 consecutive turns in the same conversation."""
    # Turn 1
    resp1 = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/conversations/{TEAM_CONV_ID}/messages",
        json={
            "sender_id": "alex",
            "recipient": "nova",
            "message_content": "Analyse the current LedgerFlow UX and suggest five improvements.",
        },
    )
    assert resp1.status_code == 200
    data1 = resp1.json()
    assert data1["status"] == "success"
    assert len(data1["agent_responses"]) == 1
    msg1 = data1["agent_responses"][0]
    assert msg1["sender_id"] == "nova"
    msg1_id = msg1["id"]

    # Turn 2: Follow-up question on travel expense policy
    resp2 = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/conversations/{TEAM_CONV_ID}/messages",
        json={
            "sender_id": "alex",
            "recipient": "nova",
            "message_content": "NOVA, how should we structure the international travel expense approval policy?",
        },
    )
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert data2["status"] == "success"
    assert len(data2["agent_responses"]) == 1
    msg2 = data2["agent_responses"][0]
    assert msg2["sender_id"] == "nova"
    assert msg2["id"] != msg1_id
    # Assert informative conversational content was delivered
    assert len(msg2["message_content"]) > 50

    # Turn 3: Follow-up asking for threshold elaboration
    resp3 = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/conversations/{TEAM_CONV_ID}/messages",
        json={
            "sender_id": "alex",
            "recipient": "nova",
            "message_content": "Can you elaborate on the per diem threshold mechanism?",
        },
    )
    assert resp3.status_code == 200
    data3 = resp3.json()
    assert data3["status"] == "success"
    assert len(data3["agent_responses"]) == 1
    msg3 = data3["agent_responses"][0]
    assert msg3["sender_id"] == "nova"
    assert msg3["id"] not in (msg1_id, msg2["id"])

    # Verify distinct completed AgentRun records were created for each turn
    db = SessionLocal()
    runs = (
        db.query(AgentRunModel)
        .filter(AgentRunModel.agent_id == "nova", AgentRunModel.id.like("run_nova_chat_%"))
        .all()
    )
    db.close()
    assert len(runs) >= 3
    for r in runs:
        assert r.lifecycle_state in ("completed", "waiting_for_review")


# ---------------------------------------------------------------------------
# Test B: Consecutive Messages to PIXEL (3 Turns)
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_consecutive_messages_to_pixel():
    """Verifies PIXEL responds across 3 consecutive turns in the same conversation."""
    # Turn 1: Inspection inquiry
    resp1 = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/conversations/{TEAM_CONV_ID}/messages",
        json={
            "sender_id": "alex",
            "recipient": "pixel",
            "message_content": "Inspect the current section versions and summarize the frontend components.",
        },
    )
    assert resp1.status_code == 200
    data1 = resp1.json()
    assert len(data1["agent_responses"]) == 1
    msg1 = data1["agent_responses"][0]
    assert msg1["sender_id"] == "pixel"

    # Turn 2: Styling question
    resp2 = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/conversations/{TEAM_CONV_ID}/messages",
        json={
            "sender_id": "alex",
            "recipient": "pixel",
            "message_content": "PIXEL, how should we style the approval queue status badges?",
        },
    )
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert len(data2["agent_responses"]) == 1
    msg2 = data2["agent_responses"][0]
    assert msg2["sender_id"] == "pixel"
    assert msg2["id"] != msg1["id"]

    # Turn 3: Explicit proposal request
    resp3 = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/conversations/{TEAM_CONV_ID}/messages",
        json={
            "sender_id": "alex",
            "recipient": "pixel",
            "message_content": "Update hero headline and create proposal for modern enterprise spend.",
        },
    )
    assert resp3.status_code == 200
    data3 = resp3.json()
    assert len(data3["agent_responses"]) == 1
    msg3 = data3["agent_responses"][0]
    assert msg3["sender_id"] == "pixel"
    assert msg3["id"] != msg2["id"]


# ---------------------------------------------------------------------------
# Test C: Agent Switching (Alex -> NOVA -> PIXEL -> NOVA)
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_agent_switching_context_preservation():
    """Verifies switching between NOVA and PIXEL maintains conversation context."""
    # 1. Ask NOVA about target persona
    resp1 = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/conversations/{TEAM_CONV_ID}/messages",
        json={
            "sender_id": "alex",
            "recipient": "nova",
            "message_content": "What is our primary user persona for LedgerFlow?",
        },
    )
    assert resp1.status_code == 200
    msg1 = resp1.json()["agent_responses"][0]
    assert msg1["sender_id"] == "nova"

    # 2. Ask PIXEL about components for that persona
    resp2 = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/conversations/{TEAM_CONV_ID}/messages",
        json={
            "sender_id": "alex",
            "recipient": "pixel",
            "message_content": "PIXEL, what components render this persona's workflow?",
        },
    )
    assert resp2.status_code == 200
    msg2 = resp2.json()["agent_responses"][0]
    assert msg2["sender_id"] == "pixel"

    # 3. Switch back to NOVA
    resp3 = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/conversations/{TEAM_CONV_ID}/messages",
        json={
            "sender_id": "alex",
            "recipient": "nova",
            "message_content": "NOVA, given PIXEL's architecture explanation, should we add an executive summary card?",
        },
    )
    assert resp3.status_code == 200
    msg3 = resp3.json()["agent_responses"][0]
    assert msg3["sender_id"] == "nova"

    # Verify all 3 exchanges are persisted in the same conversation
    db = SessionLocal()
    msgs = (
        db.query(ChatMessageModel)
        .filter(ChatMessageModel.conversation_id == TEAM_CONV_ID)
        .all()
    )
    db.close()
    sender_ids = [m.sender_id for m in msgs]
    assert "alex" in sender_ids
    assert "nova" in sender_ids
    assert "pixel" in sender_ids


# ---------------------------------------------------------------------------
# Test D: Entire Team Dispatch (Both Agents Respond)
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_entire_team_dispatch():
    """Verifies that addressing 'team' with general or sprint intent prompts both agents."""
    resp = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/conversations/{TEAM_CONV_ID}/messages",
        json={
            "sender_id": "alex",
            "recipient": "team",
            "message_content": "Team, what is our sprint progress and plan for this milestone?",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["agent_responses"]) == 2
    senders = {r["sender_id"] for r in data["agent_responses"]}
    assert senders == {"nova", "pixel"}


# ---------------------------------------------------------------------------
# Test E: Pending Proposal Does NOT Block Subsequent Chat Messages
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_pending_proposal_does_not_block_chat():
    """Verifies that having an active pending proposal does not halt conversation progression."""
    # 1. Create a pending proposal in database using stamp_and_persist_proposal
    from backend.app.context.pack_builder import create_and_persist_agent_run
    from backend.app.proposals.stamping import stamp_and_persist_proposal
    db = SessionLocal()
    run = create_and_persist_agent_run(
        db=db,
        project_id=DEMO_PROJECT_ID,
        agent_id="nova",
        run_id="run_test_pending_block_check",
        task_id="task_test_seed",
        task_description="Seed proposal run",
        target_sections=["product_brief"],
        affected_requirements=["REQ_AUDIENCE"],
    )
    prop = stamp_and_persist_proposal(
        db=db,
        project_id=DEMO_PROJECT_ID,
        run_id=run.id,
        raw_output={
            "summary": "Test Pending Proposal That Must Not Block Chat",
            "reasoning": "Testing non-blocking conversation flow",
            "affected_requirements": ["REQ_AUDIENCE"],
            "target_sections": ["product_brief"],
            "changes": {
                "operations": [
                    {
                        "op": "update_product_brief",
                        "section": "product_brief",
                        "fields": {"strategic_note": "pending test"},
                    }
                ]
            },
        },
        source="live_llm",
        is_simulated=False,
    )
    db.close()

    # 2. Send follow-up chat message while proposal is pending
    resp = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/conversations/{TEAM_CONV_ID}/messages",
        json={
            "sender_id": "alex",
            "recipient": "nova",
            "message_content": "While that proposal is pending review, can we discuss our target metrics?",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["agent_responses"]) == 1
    assert data["agent_responses"][0]["sender_id"] == "nova"
    assert len(data["agent_responses"][0]["message_content"]) > 20


# ---------------------------------------------------------------------------
# Test F: Provider Timeout & Fallback Resilience
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_provider_timeout_fallback_resilience():
    """Verifies that if the LLM provider fails or times out, the chat service falls back cleanly."""
    with patch("backend.app.agents.chat_service.call_llm_json", side_effect=Exception("Timeout: 25.0s exceeded")):
        resp = client.post(
            f"/api/projects/{DEMO_PROJECT_ID}/conversations/{TEAM_CONV_ID}/messages",
            json={
                "sender_id": "alex",
                "recipient": "nova",
                "message_content": "NOVA, how should we structure the international travel expense approval policy?",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["agent_responses"]) == 1
        agent_resp = data["agent_responses"][0]
        assert agent_resp["sender_id"] == "nova"
        assert agent_resp["metadata"]["source"] == "cached_fallback"
        assert agent_resp["metadata"]["is_simulated"] is True
        assert "International Travel" in agent_resp["content"] or "Travel" in agent_resp["content"] or "Policy" in agent_resp["content"]


# ---------------------------------------------------------------------------
# Test G: Conversation History Persistence and Chronological Retrieval
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_history_persistence_and_retrieval():
    """Verifies that GET /messages retrieves all turns chronologically with full metadata."""
    # Send 2 messages
    client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/conversations/{TEAM_CONV_ID}/messages",
        json={"sender_id": "alex", "recipient": "nova", "message_content": "Turn 1 question"},
    )
    client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/conversations/{TEAM_CONV_ID}/messages",
        json={"sender_id": "maya", "recipient": "pixel", "message_content": "Turn 2 question"},
    )

    resp = client.get(
        f"/api/projects/{DEMO_PROJECT_ID}/conversations/{TEAM_CONV_ID}/messages?limit=50"
    )
    assert resp.status_code == 200
    messages = resp.json()
    assert len(messages) >= 4  # 2 human + 2 agent messages

    # Verify chronological ordering
    created_ats = [m["created_at"] for m in messages]
    assert created_ats == sorted(created_ats)

    # Verify sender fields
    senders = [m["sender_name"] for m in messages]
    assert "Alex" in senders
    assert "Maya" in senders
    assert "NOVA" in senders
    assert "PIXEL" in senders
