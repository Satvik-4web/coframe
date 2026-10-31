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
    EventModel,
)
from backend.app.context.pack_builder import create_and_persist_agent_run
from backend.app.proposals.stamping import stamp_and_persist_proposal

client = TestClient(app)

def utcnow_str() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


@pytest.fixture(autouse=True)
def clean_baseline():
    db = SessionLocal()
    reset_demo_database(db, DEMO_PROJECT_ID)
    db.close()
    yield


def _create_nova_prd_proposal(
    db,
    title: str = "Enterprise Expense Routing & Threshold Policy",
    target_audience: str = "Global Enterprise Finance Teams",
) -> ProposalModel:
    """Helper to create a realistic NOVA PRD proposal awaiting review."""
    run_id = f"run_nova_test_{uuid.uuid4().hex[:6]}"
    run = create_and_persist_agent_run(
        db=db,
        project_id=DEMO_PROJECT_ID,
        agent_id="nova",
        run_id=run_id,
        task_id="task_prd_formulation",
        task_description=f"Formulate PRD for {title}",
        target_sections=["product_brief", "approval_queue"],
        affected_requirements=["REQ_AUDIENCE", "REQ_APPROVAL_POLICY"],
    )

    prd_data = {
        "title": title,
        "product_name": "LedgerFlow",
        "status": "awaiting_confirmation",
        "executive_summary": {
            "what_proposed": "Implement enterprise multi-tier expense approval thresholds requiring Alex signoff.",
            "why_critical": "Growing organizations require strict budgetary spend governance.",
        },
        "target_audience": target_audience,
        "target_users": {
            "primary_users": target_audience,
        },
        "functional_requirements": [
            {"id": "FR-1", "title": "Threshold Rule", "description": "Flag all expenditures above $500 for founder approval."},
            {"id": "FR-2", "title": "Manager Escalation", "description": "Auto-escalate pending approvals over 48 hours old."},
        ],
        "acceptance_criteria": [
            {"id": "AC-1", "criterion": "Expenses > $500 marked with alert badge."},
            {"id": "AC-2", "criterion": "Founder dashboard shows active escalation queue."},
        ],
        "dependencies": ["REQ_AUDIENCE", "REQ_APPROVAL_POLICY"],
    }

    raw_output = {
        "summary": f"PRD: {title}",
        "reasoning": "Formulated structured product requirements based on executive product brief.",
        "affected_requirements": ["REQ_AUDIENCE", "REQ_APPROVAL_POLICY"],
        "target_sections": ["product_brief"],
        "changes": {
            "operations": [
                {
                    "op": "update_product_brief",
                    "section": "product_brief",
                    "fields": {
                        "name": "LedgerFlow Enterprise",
                        "summary": "Autonomous corporate spend management",
                    },
                }
            ]
        },
    }

    prop = stamp_and_persist_proposal(
        db=db,
        project_id=DEMO_PROJECT_ID,
        run_id=run.id,
        raw_output=raw_output,
        source="live_llm",
        is_simulated=False,
        created_by="nova",
        author_type="agent",
        proposal_type="prd_requirement",
        prd_data=prd_data,
    )
    return prop


def test_end_to_end_prd_confirmation_and_pixel_delegation():
    """
    Validates the complete end-to-end workflow:
    1. NOVA PRD created & persisted as ready for review.
    2. Baseline artifact state inspected (version = 1).
    3. Alex confirms requirements.
    4. Approved requirement versions updated in database.
    5. PIXEL implementation task created and linked to PRD.
    6. PIXEL agent run created in working -> waiting_for_review lifecycle.
    7. PIXEL generates linked implementation proposal.
    8. NOVA executes multi-layer review (verdict: PASS).
    9. Implementation awaits human approval (status: pending_review, requires_decision: True).
    10. Canonical artifact remains UNMODIFIED before final human approval.
    11. Alex approves implementation proposal.
    12. Canonical artifact version increments (v2) and approval queue updates.
    13. Workspace chat and event logs capture the full provenance trail.
    """
    db = SessionLocal()
    prd_prop = _create_nova_prd_proposal(db, title="International Travel Expense Governance Policy")
    prd_id = prd_prop.id
    db.close()

    # Step 1: Initial state verification
    r_state_init = client.get(f"/api/projects/{DEMO_PROJECT_ID}/artifact")
    assert r_state_init.status_code == 200
    assert r_state_init.json()["artifact_version"] == 1

    # Step 2: Alex confirms requirements
    confirm_payload = {
        "confirmed_by": "alex",
        "note": "Alex confirmed requirements for International Travel Expense Governance.",
    }
    r_confirm = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/proposals/{prd_id}/confirm_requirements",
        json=confirm_payload,
    )
    assert r_confirm.status_code == 200
    confirm_data = r_confirm.json()

    # Step 3: Verify PRD is confirmed
    assert confirm_data["status"] == "approved"
    assert confirm_data["prd_data"]["status"] == "confirmed"
    assert confirm_data["prd_data"]["confirmed_by"] == "alex"

    # Step 4: Verify PIXEL delegation task exists and references PRD
    assert "delegation" in confirm_data
    del_info = confirm_data["delegation"]
    assert del_info["source_agent"] == "nova"
    assert del_info["target_agent"] == "pixel"
    assert del_info["status"] == "completed"
    assert del_info["result_proposal_id"] is not None

    delegation_id = del_info["id"]

    # Step 5: Verify PIXEL implementation proposal
    impl_prop_info = confirm_data["implementation_proposal"]
    assert impl_prop_info is not None
    pixel_prop_id = impl_prop_info["proposal_id"]

    db = SessionLocal()
    pixel_prop = db.query(ProposalModel).filter(ProposalModel.id == pixel_prop_id).first()
    assert pixel_prop is not None

    # Step 6: Verify linkage to PRD and Delegation
    assert pixel_prop.supersedes_proposal_id == prd_id
    assert pixel_prop.task_id == delegation_id
    assert pixel_prop.created_by == "pixel"
    assert pixel_prop.author_type == "agent"

    # Step 7: Verify NOVA Review on PIXEL implementation
    assert pixel_prop.reviewed_by == "NOVA" or pixel_prop.reviewed_by == "nova"
    assert pixel_prop.review_outcome in ("PASS", "WARNING")

    # Step 8: Verify PIXEL proposal requires Alex approval and is NOT yet approved
    assert pixel_prop.status == "pending_review"
    assert pixel_prop.requires_decision is True
    assert pixel_prop.assigned_decider_id == "alex"

    # Step 9: Verify canonical artifact remains unchanged before Alex approves
    r_art_pre = client.get(f"/api/projects/{DEMO_PROJECT_ID}/artifact")
    assert r_art_pre.status_code == 200
    assert r_art_pre.json()["artifact_version"] == 1

    # Step 10: Maya attempts to approve high-impact PIXEL proposal -> 403 Forbidden!
    r_maya = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/proposals/{pixel_prop_id}/approve",
        json={"decided_by": "maya"},
    )
    assert r_maya.status_code == 403

    # Step 11: Alex approves PIXEL proposal
    r_alex = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/proposals/{pixel_prop_id}/approve",
        json={"decided_by": "alex"},
    )
    assert r_alex.status_code == 200

    # Step 12: Verify canonical artifact version increments to v2
    r_art_post = client.get(f"/api/projects/{DEMO_PROJECT_ID}/artifact")
    assert r_art_post.status_code == 200
    assert r_art_post.json()["artifact_version"] >= 2

    # Step 13: Verify Chat Notifications
    r_chat = client.get(f"/api/projects/{DEMO_PROJECT_ID}/conversations/conv_team_ledgerflow/messages")
    assert r_chat.status_code == 200
    messages = r_chat.json()
    msg_contents = [m["message_content"] for m in messages]
    assert any("confirmed" in mc.lower() and "pixel" in mc.lower() for mc in msg_contents)

    db.close()


def test_idempotent_double_click_confirmation():
    """Double-clicking Confirm Requirements must return the existing delegation and proposal without duplicating."""
    db = SessionLocal()
    prd_prop = _create_nova_prd_proposal(db, title="Spend Analytics Governance Policy")
    prd_id = prd_prop.id
    db.close()

    # First click
    r1 = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/proposals/{prd_id}/confirm_requirements",
        json={"confirmed_by": "alex"},
    )
    assert r1.status_code == 200
    first_del_id = r1.json()["delegation"]["id"]
    first_impl_id = r1.json()["implementation_proposal"]["proposal_id"]

    # Second click (idempotent double-click)
    r2 = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/proposals/{prd_id}/confirm_requirements",
        json={"confirmed_by": "alex"},
    )
    assert r2.status_code == 200
    second_del_id = r2.json()["delegation"]["id"]
    second_impl_id = r2.json()["implementation_proposal"]["proposal_id"]

    # Same delegation and proposal IDs returned
    assert first_del_id == second_del_id
    assert first_impl_id == second_impl_id

    # Verify database contains exactly one delegation for this PRD
    db = SessionLocal()
    delegations = (
        db.query(DelegationModel)
        .filter(DelegationModel.correlation_id == prd_id)
        .all()
    )
    assert len(delegations) == 1
    db.close()


def test_independent_multiple_prds_delegation():
    """Confirming one PRD must NOT affect or auto-delegate other PRDs in the workspace."""
    db = SessionLocal()
    prd_a = _create_nova_prd_proposal(db, title="PRD Alpha: Receipt OCR Parsing")
    prd_b = _create_nova_prd_proposal(db, title="PRD Beta: Multi-Currency Reconciliations")
    id_a = prd_a.id
    id_b = prd_b.id
    db.close()

    # Confirm only PRD Alpha
    r_a = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/proposals/{id_a}/confirm_requirements",
        json={"confirmed_by": "alex"},
    )
    assert r_a.status_code == 200

    # Verify PRD Beta is still pending_review and has NO delegation
    db = SessionLocal()
    db_prd_b = db.query(ProposalModel).filter(ProposalModel.id == id_b).first()
    assert db_prd_b.status == "pending_review"

    del_b = db.query(DelegationModel).filter(DelegationModel.correlation_id == id_b).first()
    assert del_b is None

    # Now confirm PRD Beta separately
    r_b = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/proposals/{id_b}/confirm_requirements",
        json={"confirmed_by": "alex"},
    )
    assert r_b.status_code == 200
    del_b_post = db.query(DelegationModel).filter(DelegationModel.correlation_id == id_b).first()
    assert del_b_post is not None
    assert del_b_post.correlation_id == id_b
    assert del_b_post.id != r_a.json()["delegation"]["id"]

    db.close()


def test_unauthorized_user_cannot_confirm_prd():
    """Only Alex or Maya can confirm requirements; unauthorized users are rejected."""
    db = SessionLocal()
    prd_prop = _create_nova_prd_proposal(db, title="Corporate Card Policy")
    prd_id = prd_prop.id
    db.close()

    r = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/proposals/{prd_id}/confirm_requirements",
        json={"confirmed_by": "employee_dan"},
    )
    assert r.status_code == 400
    assert "Only 'alex' or 'maya'" in r.json()["detail"]


def test_delegation_retry_endpoint():
    """Verifies that the delegation retry endpoint functions correctly."""
    db = SessionLocal()
    prd_prop = _create_nova_prd_proposal(db, title="Tax Compliance Policy")
    prd_id = prd_prop.id
    db.close()

    # Initial confirmation
    r = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/proposals/{prd_id}/confirm_requirements",
        json={"confirmed_by": "alex"},
    )
    assert r.status_code == 200
    del_id = r.json()["delegation"]["id"]

    # Retry endpoint
    r_retry = client.post(f"/api/projects/{DEMO_PROJECT_ID}/delegations/{del_id}/retry")
    assert r_retry.status_code == 200
    assert r_retry.json()["status"] in ("already_completed", "already_delegated", "success")
