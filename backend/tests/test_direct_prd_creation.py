import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.db.database import SessionLocal
from backend.app.db.seed import reset_demo_database, DEMO_PROJECT_ID
from backend.app.db.models import ProposalModel

client = TestClient(app)

def test_ocr_prompt_directly_creates_prd_proposal():
    db = SessionLocal()
    reset_demo_database(db, DEMO_PROJECT_ID)
    db.close()

    res = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/conversations/conv_team_ledgerflow/messages",
        json={
            "sender_id": "alex",
            "recipient": "team",
            "message_content": "Team, how should we handle automatic receipts OCR extraction?",
        },
    )
    assert res.status_code == 200, res.text
    data = res.json()

    agent_responses = data["agent_responses"]
    assert len(agent_responses) == 1
    nova_resp = agent_responses[0]
    assert nova_resp["sender_id"] == "nova"
    assert nova_resp["related_proposal_id"] is not None, "NOVA must directly link the created PRD proposal"

    # Verify database record
    db = SessionLocal()
    prop = db.query(ProposalModel).filter(ProposalModel.id == nova_resp["related_proposal_id"]).first()
    assert prop is not None
    assert prop.proposal_type == "prd_requirement"
    assert prop.created_by == "nova"
    assert prop.status == "pending_review"
    assert "OCR Extraction" in prop.summary or "Automatic Receipts" in prop.summary
    assert prop.prd_data is not None
    assert prop.prd_data.get("title") is not None
    db.close()
