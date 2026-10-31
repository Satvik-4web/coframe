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
    ArtifactSectionVersionModel,
    ChatMessageModel,
    DecisionModel,
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


def _create_nova_prd(
    db,
    title: str = "Enterprise Expense Routing & Threshold Policy",
    target_section: str = "approval_queue",
    affected_req: str = "REQ_APPROVAL_POLICY",
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
        target_sections=[target_section],
        affected_requirements=[affected_req],
    )

    prd_data = {
        "title": title,
        "product_name": "LedgerFlow",
        "status": "awaiting_confirmation",
        "executive_summary": {
            "what_proposed": "Implement enterprise expense approval controls requiring Alex signoff for items > $500.",
            "why_critical": "Growing organizations require strict budgetary spend governance.",
        },
        "target_audience": "Enterprise CFOs and Finance Teams",
        "target_users": {
            "primary_users": "Enterprise CFOs and Finance Teams",
        },
        "functional_requirements": [
            {"id": "FR-1", "title": "Threshold Rule", "description": "Flag all expenditures above $500 for founder approval."},
            {"id": "FR-2", "title": "Manager Escalation", "description": "Auto-escalate pending approvals over 48 hours old."},
        ],
        "acceptance_criteria": [
            {"id": "AC-1", "criterion": "Expenses > $500 marked with policy alert."},
            {"id": "AC-2", "criterion": "Approval queue displays threshold configuration."},
        ],
        "dependencies": [affected_req],
    }

    raw_output = {
        "summary": f"PRD: {title}",
        "reasoning": "Formulated structured product requirements based on executive brief.",
        "affected_requirements": [affected_req],
        "target_sections": [target_section],
        "changes": {
            "operations": [
                {
                    "op": "set_approval_queue_config",
                    "section": target_section,
                    "config": {
                        "title": title,
                        "threshold": "$500.00",
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
    prop.status = "pending_review"
    db.commit()
    db.refresh(prop)
    return prop


# =========================================================================
# TEST A: Normal PRD to Implementation Complete Lifecycle
# =========================================================================
def test_normal_prd_to_implementation_lifecycle():
    """
    Test A: End-to-end journey:
    1. NOVA produces PRD ('pending_review').
    2. Alex confirms requirements via API.
    3. PRD status becomes 'approved', context version advances.
    4. Automatically delegates to PIXEL (creates Delegation, ImplementationPlan, AgentRun).
    5. PIXEL submits implementation proposal linked to originating PRD.
    6. NOVA reviews PIXEL's proposal ('PASS').
    7. Alex reviews and approves implementation proposal.
    8. Atomic apply updates canonical section to v2, increments artifact version.
    """
    db = SessionLocal()
    prd_prop = _create_nova_prd(db, title="Autonomous Tiered Expense Approvals")
    db.close()

    # Step 1: Alex confirms requirements
    resp = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/proposals/{prd_prop.id}/confirm_requirements",
        json={"confirmed_by": "alex", "note": "Confirmed by Alex. Handing off to PIXEL."},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()

    # Verify PRD confirmation
    assert data["status"] == "approved"
    assert data["prd_data"]["status"] == "confirmed"

    # Verify Delegation to PIXEL
    delegation = data.get("delegation")
    assert delegation is not None
    assert delegation["source_agent"] == "nova"
    assert delegation["target_agent"] == "pixel"
    assert delegation["status"] == "completed"

    # Verify PIXEL implementation proposal
    impl_prop = data.get("implementation_proposal")
    assert impl_prop is not None
    assert impl_prop["created_by"] == "pixel"
    assert impl_prop["supersedes_proposal_id"] == prd_prop.id
    assert impl_prop["status"] == "pending_review"

    # Verify NOVA review
    assert impl_prop["reviewed_by"] == "NOVA"
    assert impl_prop["review_outcome"] in ("PASS", "WARNING")

    # Step 2: Alex reviews and approves PIXEL implementation
    approve_resp = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/proposals/{impl_prop['proposal_id']}/approve",
        json={"decided_by": "alex"},
    )
    assert approve_resp.status_code == 200, approve_resp.text
    approve_data = approve_resp.json()
    assert approve_data["status"] == "success"

    # Verify canonical artifact updated atomically
    db2 = SessionLocal()
    sec = (
        db2.query(ArtifactSectionModel)
        .filter(ArtifactSectionModel.project_id == DEMO_PROJECT_ID, ArtifactSectionModel.section_key == "approval_queue")
        .first()
    )
    assert sec.version >= 2
    assert "pixel" in sec.updated_by or "alex" in sec.updated_by

    applied_prop = db2.query(ProposalModel).filter(ProposalModel.id == impl_prop["proposal_id"]).first()
    assert applied_prop.status == "approved"
    db2.close()


# =========================================================================
# TEST B: PRD Clarification and Revision Lifecycle
# =========================================================================
def test_prd_clarification_and_revision():
    """
    Test B: Human requests revision on PRD before confirming.
    1. NOVA creates initial PRD.
    2. Alex redirects NOVA with human instruction.
    3. NOVA produces revised proposal linked via supersedes_proposal_id.
    4. Original PRD is superseded.
    5. Revised PRD is confirmed and successfully delegates to PIXEL.
    """
    db = SessionLocal()
    prd_prop = _create_nova_prd(db, title="Original High-Risk Policy")
    db.close()

    # Alex redirects NOVA
    redirect_resp = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/proposals/{prd_prop.id}/redirect",
        json={"decided_by": "alex", "instruction": "Focus specifically on enterprise finance teams and add threshold controls."},
    )
    assert redirect_resp.status_code == 200, redirect_resp.text
    redir_data = redirect_resp.json()
    new_prop_id = redir_data["new_proposal_id"]

    db2 = SessionLocal()
    orig = db2.query(ProposalModel).filter(ProposalModel.id == prd_prop.id).first()
    assert orig.status == "superseded"

    revised = db2.query(ProposalModel).filter(ProposalModel.id == new_prop_id).first()
    assert revised.status == "pending_review"
    assert revised.supersedes_proposal_id == prd_prop.id
    db2.close()

    # Alex confirms revised PRD
    confirm_resp = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/proposals/{new_prop_id}/confirm_requirements",
        json={"confirmed_by": "alex", "note": "Confirmed revised PRD."},
    )
    assert confirm_resp.status_code == 200, confirm_resp.text
    assert confirm_resp.json()["delegation"]["status"] == "completed"


# =========================================================================
# TEST C: Conflict Detection and Resolution Lifecycle
# =========================================================================
def test_conflict_detection_and_resolution_lifecycle():
    """
    Test C: Full conflict handling lifecycle:
    1. PIXEL creates proposal based on hero v1.
    2. Maya manually edits hero section to v2 in canonical canvas.
    3. Attempting to approve PIXEL's proposal returns 409 Conflict.
    4. GET /conflict returns side-by-side details (v1 proposed vs v2 canonical).
    5. Reconcile with PIXEL synthesizes a revised proposal based on canonical v2.
    6. Alex approves the reconciled proposal without conflict.
    """
    db = SessionLocal()
    # Baseline hero section is version 1
    hero_sec = (
        db.query(ArtifactSectionModel)
        .filter(ArtifactSectionModel.project_id == DEMO_PROJECT_ID, ArtifactSectionModel.section_key == "hero")
        .first()
    )
    initial_ver = hero_sec.version

    # PIXEL creates proposal targeting hero based on v1
    run_id = f"run_pixel_test_{uuid.uuid4().hex[:6]}"
    run = create_and_persist_agent_run(
        db=db,
        project_id=DEMO_PROJECT_ID,
        agent_id="pixel",
        run_id=run_id,
        task_id="task_hero_upgrade",
        task_description="Upgrade hero section",
        target_sections=["hero"],
        affected_requirements=["REQ_BRAND"],
    )

    prop = stamp_and_persist_proposal(
        db=db,
        project_id=DEMO_PROJECT_ID,
        run_id=run.id,
        raw_output={
            "summary": "PIXEL Hero Redesign",
            "reasoning": "Modern conversion copy",
            "affected_requirements": ["REQ_BRAND"],
            "target_sections": ["hero"],
            "changes": {
                "operations": [
                    {
                        "op": "set_hero_content",
                        "section": "hero",
                        "fields": {
                            "headline": "Modern Expense Control, Zero Friction",
                            "subheadline": "Submit receipts in seconds",
                            "cta_text": "Start Free 14-Day Trial",
                        },
                    }
                ]
            },
        },
        source="live_llm",
        created_by="pixel",
        author_type="agent",
        proposal_type="prototype_modification",
    )
    prop.status = "pending_review"
    db.commit()
    pixel_prop_id = prop.id
    db.close()

    # Step 2: Maya manually updates hero section to version 2
    maya_edit_resp = client.patch(
        f"/api/projects/{DEMO_PROJECT_ID}/artifact/sections/hero",
        json={
            "expected_version": initial_ver,
            "editor_id": "maya",
            "data": {
                "headline": "Take control of company spending",
                "subheadline": "Real-time expense management for high-velocity teams",
                "cta_text": "Start Free Trial",
            },
        },
    )
    assert maya_edit_resp.status_code == 200, maya_edit_resp.text
    assert maya_edit_resp.json()["version"] == initial_ver + 1

    # Step 3: Attempting to approve PIXEL's proposal must be strictly blocked (409)
    blocked_resp = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/proposals/{pixel_prop_id}/approve",
        json={"decided_by": "alex"},
    )
    assert blocked_resp.status_code == 409, blocked_resp.text
    assert "conflict" in blocked_resp.json()["detail"].lower()

    # Step 4: GET /conflict returns side-by-side comparison
    conflict_resp = client.get(f"/api/projects/{DEMO_PROJECT_ID}/proposals/{pixel_prop_id}/conflict")
    assert conflict_resp.status_code == 200, conflict_resp.text
    c_data = conflict_resp.json()
    assert c_data["is_conflicted"] is True
    assert c_data["base_version"] == initial_ver
    assert c_data["canonical_version"] == initial_ver + 1
    assert c_data["intervening_user"].lower() == "maya"
    assert len(c_data["conflicting_fields"]) > 0

    # Step 5: Option 2 Reconcile with PIXEL
    reconcile_resp = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/proposals/{pixel_prop_id}/resolve-conflict",
        json={"resolution_mode": "reconcile_pixel", "decided_by": "alex"},
    )
    assert reconcile_resp.status_code == 200, reconcile_resp.text
    rec_data = reconcile_resp.json()
    reconciled_prop_id = rec_data["new_proposal_id"]
    assert reconciled_prop_id != pixel_prop_id

    # Original marked superseded
    db3 = SessionLocal()
    orig_p = db3.query(ProposalModel).filter(ProposalModel.id == pixel_prop_id).first()
    assert orig_p.status == "superseded"

    # Reconciled proposal is based on v2
    rec_p = db3.query(ProposalModel).filter(ProposalModel.id == reconciled_prop_id).first()
    assert rec_p.base_section_versions.get("hero") == initial_ver + 1
    assert rec_p.status == "pending_review"
    assert rec_p.reviewed_by == "nova"
    db3.close()

    # Step 6: Alex approves the reconciled proposal cleanly
    final_approve_resp = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/proposals/{reconciled_prop_id}/approve",
        json={"decided_by": "alex"},
    )
    assert final_approve_resp.status_code == 200, final_approve_resp.text

    db4 = SessionLocal()
    final_sec = (
        db4.query(ArtifactSectionModel)
        .filter(ArtifactSectionModel.project_id == DEMO_PROJECT_ID, ArtifactSectionModel.section_key == "hero")
        .first()
    )
    assert final_sec.version == initial_ver + 2
    db4.close()


# =========================================================================
# TEST D: Multiple Independent PRDs Lifecycle
# =========================================================================
def test_multiple_independent_prds_lifecycle():
    """
    Test D: Independent lifecycle isolation:
    Confirming PRD 1 delegates to PIXEL without affecting PRD 2.
    """
    db = SessionLocal()
    prd_1 = _create_nova_prd(db, title="PRD 1: Policy Governance", target_section="approval_queue")
    prd_2 = _create_nova_prd(db, title="PRD 2: Spend Analytics", target_section="dashboard", affected_req="REQ_METRICS")
    prd_1_id = prd_1.id
    prd_2_id = prd_2.id
    db.close()

    # Confirm PRD 1
    res1 = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/proposals/{prd_1_id}/confirm_requirements",
        json={"confirmed_by": "alex"},
    )
    assert res1.status_code == 200

    db2 = SessionLocal()
    # PRD 1 is confirmed and delegated
    p1 = db2.query(ProposalModel).filter(ProposalModel.id == prd_1_id).first()
    assert p1.status == "approved"

    # PRD 2 remains strictly in pending_review
    p2 = db2.query(ProposalModel).filter(ProposalModel.id == prd_2_id).first()
    assert p2.status == "pending_review"
    assert p2.prd_data["status"] == "awaiting_confirmation"
    db2.close()


# =========================================================================
# TEST E: Delegation Idempotency and Non-Duplication
# =========================================================================
def test_delegation_idempotency_and_non_duplication():
    """
    Test E: Confirming a PRD a second time does not re-run or duplicate tasks.
    """
    db = SessionLocal()
    prd = _create_nova_prd(db, title="Idempotency Test PRD")
    db.close()

    # First click
    res1 = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/proposals/{prd.id}/confirm_requirements",
        json={"confirmed_by": "alex"},
    )
    assert res1.status_code == 200
    first_impl_id = res1.json()["implementation_proposal"]["proposal_id"]

    # Second click
    res2 = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/proposals/{prd.id}/confirm_requirements",
        json={"confirmed_by": "alex"},
    )
    assert res2.status_code == 200
    second_impl_id = res2.json()["implementation_proposal"]["proposal_id"]

    assert first_impl_id == second_impl_id

    # Verify only 1 delegation record exists
    db2 = SessionLocal()
    dels = db2.query(DelegationModel).filter(DelegationModel.correlation_id == prd.id).all()
    assert len(dels) == 1
    db2.close()


# =========================================================================
# TEST F: Permissions and Role-Based Guardrails
# =========================================================================
def test_permissions_and_role_based_guardrails():
    """
    Test F: Security and governance:
    1. Unauthorized decider is rejected (400).
    2. High-impact proposal assigned to Alex cannot be approved by Maya (403).
    3. Humans cannot forge unknown contributor names (403).
    """
    db = SessionLocal()
    prd = _create_nova_prd(db, title="High Impact Spend Thresholds")
    db.close()

    # Confirm PRD
    conf_res = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/proposals/{prd.id}/confirm_requirements",
        json={"confirmed_by": "alex"},
    )
    impl_id = conf_res.json()["implementation_proposal"]["proposal_id"]

    # 1. Invalid decider identity (e.g. rogue user)
    bad_decider = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/proposals/{impl_id}/approve",
        json={"decided_by": "mallory"},
    )
    assert bad_decider.status_code == 400

    # 2. Maya tries to approve proposal assigned specifically to Alex
    maya_try = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/proposals/{impl_id}/approve",
        json={"decided_by": "maya"},
    )
    assert maya_try.status_code == 403
    assert "permission denied" in maya_try.json()["detail"].lower()

    # 3. Unauthorized human contribution author
    bad_human = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/proposals/human",
        json={
            "author": "charlie",
            "summary": "Unauthorized injection",
            "reasoning": "Attempt",
            "target_sections": ["hero"],
            "changes": {"operations": []},
        },
    )
    assert bad_human.status_code == 403


# =========================================================================
# TEST G: Live Proposals Stats Endpoint
# =========================================================================
def test_proposals_stats_endpoint():
    """
    Test G: GET /stats returns live SQLite metrics.
    """
    db = SessionLocal()
    _create_nova_prd(db, title="Stats PRD 1")
    _create_nova_prd(db, title="Stats PRD 2")
    db.close()

    resp = client.get(f"/api/projects/{DEMO_PROJECT_ID}/proposals/stats")
    assert resp.status_code == 200, resp.text
    stats = resp.json()
    assert stats["awaiting_confirmation"] >= 2
    assert "by_contributor" in stats
    assert stats["by_contributor"]["nova"] >= 2
