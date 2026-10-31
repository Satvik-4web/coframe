import pytest
import uuid
import datetime
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.db.database import SessionLocal
from backend.app.db.seed import reset_demo_database, DEMO_PROJECT_ID
from backend.app.db.models import (
    ProposalModel,
    DelegationModel,
    ImplementationPlanModel,
    AgentRunModel,
    RequirementModel,
    ArtifactSectionModel,
    ChatMessageModel,
    WorkflowStateModel,
)

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_baseline():
    db = SessionLocal()
    reset_demo_database(db, DEMO_PROJECT_ID)
    db.close()
    yield


def test_entire_team_ambiguous_idea_routes_to_nova_only():
    """Alex sends ambiguous idea ('SAI') to Entire Team.
    1. NOVA alone responds.
    2. PIXEL does NOT respond and sends no fake message.
    3. NOVA asks clarifying questions about 'SAI'.
    4. No proposal or implementation task is created.
    5. Workflow stage reflects product clarification with PIXEL waiting.
    """
    res = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/conversations/conv_team_ledgerflow/messages",
        json={
            "sender_id": "alex",
            "recipient": "team",
            "message_content": "I want to integrate SAI into LedgerFlow.",
        },
    )
    assert res.status_code == 200, res.text
    data = res.json()

    # Human message persisted
    assert data["human_message"]["sender_id"] == "alex"
    assert data["human_message"]["recipient_type"] == "team"

    # Exactly ONE agent response: NOVA leads
    agent_responses = data["agent_responses"]
    assert len(agent_responses) == 1, f"Expected 1 agent response, got {len(agent_responses)}"
    assert agent_responses[0]["sender_id"] == "nova"

    # NOVA clarifies the ambiguous acronym
    nova_msg = agent_responses[0]["message_content"]
    assert "SAI" in nova_msg
    assert any(w in nova_msg.lower() for w in ["clarify", "refer", "aligned", "scope", "represent", "invoicing", "intelligence", "integration", "problem"])


    # No proposal created prematurely
    assert agent_responses[0]["related_proposal_id"] is None

    # Check database: no PIXEL messages in this turn
    db = SessionLocal()
    pixel_msgs = db.query(ChatMessageModel).filter(
        ChatMessageModel.sender_id == "pixel",
        ChatMessageModel.message_content.contains("listening"),
    ).all()
    assert len(pixel_msgs) == 0, "No fake PIXEL listening messages should be present"

    # Verify workflow stage API
    wf_res = client.get(f"/api/projects/{DEMO_PROJECT_ID}/workflow-stage")
    assert wf_res.status_code == 200
    wf_data = wf_res.json()
    assert wf_data["current_stage"] == "product_clarification"
    assert "Waiting for confirmed requirements" in wf_data["pixel_status"]
    db.close()


def test_entire_team_clarified_idea_generates_formal_prd():
    """Alex clarifies the SAI acronym and asks for a PRD proposal.
    1. NOVA generates a formal 11-section PRD proposal.
    2. Proposal status is 'pending_review' with author='nova'.
    3. Chat response summarizes PRD with markdown link to the proposal.
    4. PIXEL does NOT execute yet; PIXEL status is 'Waiting for confirmed requirements'.
    """
    res = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/conversations/conv_team_ledgerflow/messages",
        json={
            "sender_id": "alex",
            "recipient": "team",
            "message_content": "SAI stands for Smart Automated Invoicing for scanning supplier bills and extracting line items. Please create a PRD proposal.",
        },
    )
    assert res.status_code == 200, res.text
    data = res.json()

    agent_responses = data["agent_responses"]
    assert len(agent_responses) == 1
    nova_resp = agent_responses[0]
    assert nova_resp["sender_id"] == "nova"

    # Must contain markdown link to persisted proposal
    prop_id = nova_resp["related_proposal_id"]
    assert prop_id is not None
    assert f"[View PRD Proposal #{prop_id[-6:]}](/proposals)" in nova_resp["message_content"]
    assert "PIXEL is waiting for Alex's confirmation" in nova_resp["message_content"] or "awaiting Alex's confirmation" in nova_resp["message_content"]

    # Verify PRD proposal structure in database
    db = SessionLocal()
    prop = db.query(ProposalModel).filter(ProposalModel.id == prop_id).first()
    assert prop is not None
    assert prop.agent_id == "nova"
    assert prop.created_by == "nova"
    assert prop.proposal_type == "prd_requirement"
    assert prop.status == "pending_review"

    # Verify 11 PRD sections
    prd = prop.prd_data
    assert prd is not None
    assert "title" in prd
    assert "objective" in prd
    assert "executive_summary" in prd
    assert "problem_statement" in prd
    assert "target_audience" in prd
    assert "proposed_solution" in prd
    assert len(prd.get("functional_requirements", [])) >= 2
    assert len(prd.get("user_stories", [])) >= 1
    assert len(prd.get("acceptance_criteria", [])) >= 1
    assert "constraints_and_assumptions" in prd
    assert "dependencies_and_risks" in prd
    assert "open_questions" in prd

    # PIXEL has NOT received any delegation task yet
    delegations = db.query(DelegationModel).filter(DelegationModel.correlation_id == prop_id).all()
    assert len(delegations) == 0

    # Workflow stage is awaiting human confirmation
    wf_res = client.get(f"/api/projects/{DEMO_PROJECT_ID}/workflow-stage")
    assert wf_res.status_code == 200
    wf_data = wf_res.json()
    assert wf_data["current_stage"] == "prd_awaiting_confirmation"
    assert wf_data["active_prd_id"] == prop_id
    assert "Waiting for confirmed requirements" in wf_data["pixel_status"]
    db.close()


def test_full_sequential_orchestration_journey():
    """End-to-end full sequential journey:
    1. Alex asks NOVA for PRD.
    2. NOVA generates formal PRD proposal (#prop_prd).
    3. Alex confirms requirements via POST /confirm_requirements.
    4. Exactly ONE delegation task is created.
    5. PIXEL executes and submits an implementation proposal (#prop_pixel).
    6. NOVA reviews PIXEL's proposal (Verdict: PASS).
    7. Alex approves PIXEL's implementation proposal.
    8. LedgerFlow prototype canvas updated to v2.
    9. Workflow stage advances to implementation_applied.
    """
    # 1 & 2. NOVA creates PRD proposal
    chat_res = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/conversations/conv_team_ledgerflow/messages",
        json={
            "sender_id": "alex",
            "recipient": "team",
            "message_content": "Create a PRD proposal for Smart Automated Invoicing with OCR.",
        },
    )
    assert chat_res.status_code == 200
    prd_prop_id = chat_res.json()["agent_responses"][0]["related_proposal_id"]
    assert prd_prop_id is not None

    # Check stage before confirmation
    wf_pre = client.get(f"/api/projects/{DEMO_PROJECT_ID}/workflow-stage").json()
    assert wf_pre["current_stage"] == "prd_awaiting_confirmation"
    assert "Waiting for confirmed requirements" in wf_pre["pixel_status"]

    # 3. Alex confirms requirements
    conf_res = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/proposals/{prd_prop_id}/confirm_requirements",
        json={"confirmed_by": "alex", "note": "Confirmed for MVP demo"},
    )
    assert conf_res.status_code == 200, conf_res.text
    conf_data = conf_res.json()

    # 4 & 5. Delegation and PIXEL implementation proposal
    assert conf_data["delegation"] is not None
    delegation_id = conf_data["delegation"]["id"]
    pixel_prop_data = conf_data["implementation_proposal"]
    assert pixel_prop_data is not None
    pixel_prop_id = pixel_prop_data.get("proposal_id") or pixel_prop_data.get("id")


    # 6. Check NOVA review verdict on PIXEL proposal
    db = SessionLocal()
    pixel_prop = db.query(ProposalModel).filter(ProposalModel.id == pixel_prop_id).first()
    assert pixel_prop is not None
    assert pixel_prop.created_by == "pixel"
    assert pixel_prop.supersedes_proposal_id == prd_prop_id
    assert pixel_prop.reviewed_by == "nova"
    assert pixel_prop.review_outcome in ("PASS", "WARNING")
    assert pixel_prop.status == "pending_review"  # Human confirmation is required

    # Exactly ONE delegation in DB
    del_count = db.query(DelegationModel).filter(DelegationModel.correlation_id == prd_prop_id).count()
    assert del_count == 1

    # Check stage is awaiting final human approval
    wf_mid = client.get(f"/api/projects/{DEMO_PROJECT_ID}/workflow-stage").json()
    assert wf_mid["current_stage"] == "implementation_awaiting_approval"
    assert wf_mid["active_pixel_proposal_id"] == pixel_prop_id
    assert "Reviewed" in wf_mid["nova_status"]

    # 7. Test Idempotency: repeated confirmation does NOT duplicate tasks or proposals
    conf_res_2 = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/proposals/{prd_prop_id}/confirm_requirements",
        json={"confirmed_by": "alex"},
    )
    assert conf_res_2.status_code == 200
    del_count_2 = db.query(DelegationModel).filter(DelegationModel.correlation_id == prd_prop_id).count()
    assert del_count_2 == 1, "Idempotency violated: duplicate delegation task created"

    # 8. Alex approves PIXEL's proposal
    appr_res = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/proposals/{pixel_prop_id}/approve",
        json={"decided_by": "alex"},
    )
    assert appr_res.status_code == 200, appr_res.text
    assert appr_res.json()["artifact_version"] >= 2

    # 9. Verify final workflow stage
    wf_final = client.get(f"/api/projects/{DEMO_PROJECT_ID}/workflow-stage").json()
    assert wf_final["current_stage"] == "implementation_applied"
    db.close()


def test_direct_nova_and_pixel_chat_remain_independent():
    """Verify that direct recipient messaging ('nova' and 'pixel') functions independently."""
    # Direct NOVA message
    res_nova = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/conversations/conv_team_ledgerflow/messages",
        json={
            "sender_id": "alex",
            "recipient": "nova",
            "message_content": "What is our audience strategy?",
        },
    )
    assert res_nova.status_code == 200
    nova_resps = res_nova.json()["agent_responses"]
    assert len(nova_resps) == 1
    assert nova_resps[0]["sender_id"] == "nova"

    # Direct PIXEL message
    res_pixel = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/conversations/conv_team_ledgerflow/messages",
        json={
            "sender_id": "alex",
            "recipient": "pixel",
            "message_content": "What components are in the approval queue?",
        },
    )
    assert res_pixel.status_code == 200
    pixel_resps = res_pixel.json()["agent_responses"]
    assert len(pixel_resps) == 1
    assert pixel_resps[0]["sender_id"] == "pixel"
