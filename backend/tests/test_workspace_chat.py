import pytest
from starlette.testclient import TestClient
from backend.app.main import app
from backend.app.db.seed import DEMO_PROJECT_ID, reset_demo_database
from backend.app.db.database import get_db

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db():
    db = next(get_db())
    try:
        reset_demo_database(db)
    finally:
        db.close()


def test_list_seeded_conversations():
    resp = client.get(f"/api/projects/{DEMO_PROJECT_ID}/conversations")
    assert resp.status_code == 200
    convs = resp.json()
    assert len(convs) >= 1
    # Check default conversation
    team_conv = next((c for c in convs if c["id"] == "conv_team_ledgerflow"), None)
    assert team_conv is not None
    assert team_conv["title"] == "LedgerFlow Team Room"
    assert len(team_conv["participants"]) >= 4
    # Check last message
    assert team_conv["last_message"] is not None
    assert team_conv["message_count"] >= 3


def test_create_new_conversation():
    # Alex creates a conversation
    resp = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/conversations",
        json={
            "title": "Approval Matrix Refinement",
            "conversation_type": "topic",
            "created_by": "alex",
            "participants": ["alex", "maya", "nova"],
        },
    )
    assert resp.status_code == 200
    created = resp.json()
    assert created["title"] == "Approval Matrix Refinement"
    assert created["created_by"] == "alex"
    assert created["id"].startswith("conv_")

    # Fetch it
    get_resp = client.get(f"/api/projects/{DEMO_PROJECT_ID}/conversations/{created['id']}")
    assert get_resp.status_code == 200
    data = get_resp.json()
    assert data["title"] == "Approval Matrix Refinement"
    participant_ids = [p["participant_id"] for p in data["participants"]]
    assert "alex" in participant_ids
    assert "nova" in participant_ids


def test_anti_spoofing_creator_and_sender():
    # Unauthorized creator
    resp = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/conversations",
        json={
            "title": "Spoofed Channel",
            "created_by": "intruder",
        },
    )
    assert resp.status_code == 403

    # Unauthorized sender
    resp = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/conversations/conv_team_ledgerflow/messages",
        json={
            "sender_id": "intruder",
            "message_content": "Hello hackers",
            "recipient": "team",
        },
    )
    assert resp.status_code == 403

    # Agent cannot spoof human endpoint
    resp_agent = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/conversations/conv_team_ledgerflow/messages",
        json={
            "sender_id": "nova",
            "message_content": "I am NOVA pretending to be a human sender",
            "recipient": "team",
        },
    )
    assert resp_agent.status_code == 403


def test_send_message_to_nova_generates_strategy():
    resp = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/conversations/conv_team_ledgerflow/messages",
        json={
            "sender_id": "alex",
            "message_content": "NOVA, can we define a stricter policy for international travel expenses?",
            "recipient": "nova",
        },
    )
    assert resp.status_code == 200
    result = resp.json()
    assert result["status"] == "success"
    assert result["human_message"]["sender_key"] == "alex"
    assert len(result["agent_responses"]) >= 1
    nova_reply = result["agent_responses"][0]
    assert nova_reply["sender_key"] == "nova"
    assert "PRD" in nova_reply["content"] or "Policy" in nova_reply["content"] or "requirements" in nova_reply["content"].lower()

    # Check that message list in conversation contains both
    msgs_resp = client.get(
        f"/api/projects/{DEMO_PROJECT_ID}/conversations/conv_team_ledgerflow/messages"
    )
    assert msgs_resp.status_code == 200
    msgs = msgs_resp.json()
    assert any(m["sender_key"] == "alex" and "international travel" in m["content"] for m in msgs)
    assert any(m["sender_key"] == "nova" for m in msgs)


def test_send_message_to_pixel_generates_proposal():
    resp = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/conversations/conv_team_ledgerflow/messages",
        json={
            "sender_id": "alex",
            "message_content": "PIXEL, please update the metrics cards to include travel budget tracking and add a currency field.",
            "recipient": "pixel",
        },
    )
    assert resp.status_code == 200
    result = resp.json()
    assert result["status"] == "success"
    assert result["human_message"]["sender_key"] == "alex"
    assert len(result["agent_responses"]) >= 1
    pixel_reply = result["agent_responses"][0]
    assert pixel_reply["sender_key"] == "pixel"
    assert "prototype" in pixel_reply["content"].lower() or "implementation" in pixel_reply["content"].lower()
    
    # Check related proposal
    if pixel_reply.get("related_proposal_id"):
        assert pixel_reply["related_proposal"] is not None
        assert pixel_reply["related_proposal"]["proposal_id"] == pixel_reply["related_proposal_id"]
        assert pixel_reply["related_proposal"]["status"] == "pending_review"


def test_send_message_to_team():
    resp = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/conversations/conv_team_ledgerflow/messages",
        json={
            "sender_id": "maya",
            "message_content": "Team, how should we improve receipt attachments and approval flows?",
            "recipient": "team",
        },
    )
    assert resp.status_code == 200
    result = resp.json()
    assert result["status"] == "success"
    assert result["human_message"]["sender_key"] == "maya"
    # Both NOVA and PIXEL should respond to team inquiries
    agent_keys = [r["sender_key"] for r in result["agent_responses"]]
    assert "nova" in agent_keys
    assert "pixel" in agent_keys


def test_mark_conversation_read():
    resp = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/conversations/conv_team_ledgerflow/read",
        json={"participant_id": "alex"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
