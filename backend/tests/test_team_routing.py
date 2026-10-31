"""
Integration tests for role-aware team chat orchestration.

Tests verify that:
1. _classify_team_intent correctly classifies message intent
2. Team messages are routed to the correct agents
3. Both NOVA and PIXEL respond to team UI/product improvement messages
4. Direct NOVA/PIXEL messages do not cross-dispatch
"""
import pytest
from starlette.testclient import TestClient

from backend.app.main import app
from backend.app.db.seed import DEMO_PROJECT_ID, reset_demo_database
from backend.app.db.database import get_db
from backend.app.agents.chat_service import _classify_team_intent

client = TestClient(app)

TEAM_CONV_ID = "conv_team_ledgerflow"


@pytest.fixture(autouse=True)
def setup_db():
    """Reset demo database before each test for isolation."""
    db = next(get_db())
    try:
        reset_demo_database(db)
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Intent Classification Unit Tests
# ---------------------------------------------------------------------------

def test_classify_product_led_ui():
    """'make the ui better' must be product_led."""
    assert _classify_team_intent("lets make the ui better") == "product_led"


def test_classify_product_led_improve():
    """'improve the user experience' must be product_led."""
    assert _classify_team_intent("can we improve the user experience") == "product_led"


def test_classify_product_led_design():
    """'redesign the product workflow' must be product_led."""
    assert _classify_team_intent("redesign the product workflow") == "product_led"


def test_classify_product_led_feature():
    """'suggest new product features' must be product_led."""
    assert _classify_team_intent("suggest new product features") == "product_led"


def test_classify_implementation_led():
    """Implementation messages must map to implementation_led."""
    assert _classify_team_intent("please update the dashboard component code") == "implementation_led"


def test_classify_both_parallel_milestone():
    """Milestone messages must route to both_parallel."""
    result = _classify_team_intent("what is the milestone status for sprint 3")
    assert result == "both_parallel"


def test_classify_greeting():
    """Greeting messages must route to greeting_or_general."""
    assert _classify_team_intent("hi team good morning") == "greeting_or_general"


def test_classify_product_wins_when_both():
    """When both product and implementation keywords are present, product wins."""
    # 'improve' (product) + 'component' (impl) → product_led
    assert _classify_team_intent("improve the dashboard component") == "product_led"


def test_classify_unknown_falls_back_to_general():
    """Completely unknown message should default to greeting_or_general."""
    result = _classify_team_intent("the number 42 is important")
    assert result == "greeting_or_general"


# ---------------------------------------------------------------------------
# Integration Tests — Team Routing
# ---------------------------------------------------------------------------

def test_team_ui_improvement_routes_to_nova_sequentially():
    """Sequential: 'make the ui better' to Entire Team routes to NOVA leads alone; PIXEL waits."""
    resp = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/conversations/{TEAM_CONV_ID}/messages",
        json={
            "sender_id": "alex",
            "message_content": "hi team lets make the ui better",
            "recipient": "team",
        },
    )
    assert resp.status_code == 200, f"Unexpected status: {resp.status_code} — {resp.text}"
    result = resp.json()
    assert result["status"] == "success"
    agent_keys = [r["sender_key"] for r in result["agent_responses"]]
    assert agent_keys == ["nova"], f"Expected NOVA alone, got: {agent_keys}"


def test_nova_only_never_dispatches_pixel():
    """NOVA-only direct messages must never dispatch to PIXEL."""
    resp = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/conversations/{TEAM_CONV_ID}/messages",
        json={
            "sender_id": "alex",
            "message_content": "NOVA please define requirements for the approval threshold",
            "recipient": "nova",
        },
    )
    assert resp.status_code == 200
    result = resp.json()
    agent_keys = [r["sender_key"] for r in result["agent_responses"]]
    assert "nova" in agent_keys, f"NOVA should respond: {agent_keys}"
    assert "pixel" not in agent_keys, f"PIXEL should NOT respond to nova-direct: {agent_keys}"


def test_pixel_only_never_dispatches_nova():
    """PIXEL-only direct messages must never dispatch to NOVA."""
    resp = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/conversations/{TEAM_CONV_ID}/messages",
        json={
            "sender_id": "maya",
            "message_content": "PIXEL please inspect the hero section components",
            "recipient": "pixel",
        },
    )
    assert resp.status_code == 200
    result = resp.json()
    agent_keys = [r["sender_key"] for r in result["agent_responses"]]
    assert "pixel" in agent_keys, f"PIXEL should respond: {agent_keys}"
    assert "nova" not in agent_keys, f"NOVA should NOT respond to pixel-direct: {agent_keys}"


def test_product_improvement_nova_responds_with_analysis():
    """Product improvement request triggers NOVA's analysis containing product-relevant content."""
    resp = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/conversations/{TEAM_CONV_ID}/messages",
        json={
            "sender_id": "maya",
            "message_content": "team I think we should redesign the approval workflow for better user experience",
            "recipient": "team",
        },
    )
    assert resp.status_code == 200
    result = resp.json()
    nova_responses = [r for r in result["agent_responses"] if r["sender_key"] == "nova"]
    assert len(nova_responses) >= 1, "NOVA must respond to product improvement request"
    nova_content = nova_responses[0]["content"].lower()
    assert any(
        w in nova_content
        for w in ["product", "requirement", "ux", "user", "analysis", "improvement", "design", "workflow"]
    ), f"NOVA response does not mention product/UX: {nova_content[:300]}"


def test_agent_responses_stored_in_db():
    """NOVA response is persisted to the database under sequential routing."""
    resp = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/conversations/{TEAM_CONV_ID}/messages",
        json={
            "sender_id": "alex",
            "message_content": "team please review our product milestone progress",
            "recipient": "team",
        },
    )
    assert resp.status_code == 200
    result = resp.json()
    agent_keys = [r["sender_key"] for r in result["agent_responses"]]
    assert "nova" in agent_keys, "NOVA must respond to milestone messages"

    # Verify message is persisted in conversation history
    msgs_resp = client.get(
        f"/api/projects/{DEMO_PROJECT_ID}/conversations/{TEAM_CONV_ID}/messages"
    )
    assert msgs_resp.status_code == 200
    msgs = msgs_resp.json()
    msg_senders = [m.get("sender_key", m.get("sender_id", "")) for m in msgs]
    assert "nova" in msg_senders, "NOVA message not found in conversation history"
