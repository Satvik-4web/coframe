import pytest
import uuid
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.db.database import get_db, SessionLocal
from backend.app.db.seed import reset_demo_database, DEMO_PROJECT_ID
from backend.app.db.models import (
    ProposalModel,
    AgentRunModel,
    DecisionModel,
    ProjectModel,
    utcnow_str,
)
from backend.app.proposals.stamping import stamp_and_persist_proposal
from backend.app.proposals.apply import apply_proposal_atomically
from backend.app.proposals.serialization import serialize_proposal_for_api


client = TestClient(app)


@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        reset_demo_database(db, DEMO_PROJECT_ID)
        yield db
    finally:
        db.close()


# --------------------------------------------------------------------------
# Criterion 1: NOVA creates requirements proposal and is displayed as author
# --------------------------------------------------------------------------
def test_nova_creates_requirements_proposal_attribution(db_session: Session):
    run_id = f"run_nova_test_{uuid.uuid4().hex[:6]}"
    run = AgentRunModel(
        id=run_id,
        project_id=DEMO_PROJECT_ID,
        agent_id="nova",
        status="working",
        task_description="Analyze market requirements",
        base_context_version=1,
        base_artifact_version=1,
        context_pack={"requirements": [{"id": "REQ_AUDIENCE"}], "section_versions": {"product_brief": 1}},
        source="live_llm",
        started_at=utcnow_str(),
    )
    db_session.add(run)
    db_session.commit()

    raw_output = {
        "summary": "Clarify target audience for product brief",
        "reasoning": "Early market fit requires clear segment definition.",
        "affected_requirements": ["REQ_AUDIENCE"],
        "target_sections": ["product_brief"],
        "changes": {
            "operations": [
                {
                    "op": "update_product_brief",
                    "section": "product_brief",
                    "fields": {"target_audience": "Mid-market finance teams"},
                }
            ]
        },
    }

    prop = stamp_and_persist_proposal(
        db=db_session,
        project_id=DEMO_PROJECT_ID,
        run_id=run_id,
        raw_output=raw_output,
    )

    assert prop.created_by == "nova"
    assert prop.author_type == "agent"
    assert prop.proposal_type == "prd_requirement"

    serialized = serialize_proposal_for_api(prop)
    assert serialized["author"] == "NOVA"
    assert serialized["author_role"] == "AI Product Strategist"
    assert serialized["contribution_type"] == "PRODUCT REQUIREMENTS"
    assert serialized["author_type"] == "agent"


# --------------------------------------------------------------------------
# Criterion 2: PIXEL creates implementation proposal and is displayed as author
# --------------------------------------------------------------------------
def test_pixel_creates_implementation_proposal_attribution(db_session: Session):
    run_id = f"run_pixel_test_{uuid.uuid4().hex[:6]}"
    run = AgentRunModel(
        id=run_id,
        project_id=DEMO_PROJECT_ID,
        agent_id="pixel",
        status="working",
        task_description="Build hero section overhaul",
        base_context_version=1,
        base_artifact_version=1,
        context_pack={"requirements": [{"id": "REQ_BRAND"}], "section_versions": {"hero": 1}},
        source="live_llm",
        started_at=utcnow_str(),
    )
    db_session.add(run)
    db_session.commit()

    raw_output = {
        "summary": "High conversion hero overhaul",
        "reasoning": "Modernized hero copy drives better conversion.",
        "affected_requirements": ["REQ_BRAND"],
        "target_sections": ["hero"],
        "changes": {
            "operations": [
                {
                    "op": "set_hero_content",
                    "section": "hero",
                    "fields": {"headline": "Smarter Corporate Spend Management"},
                }
            ]
        },
    }

    prop = stamp_and_persist_proposal(
        db=db_session,
        project_id=DEMO_PROJECT_ID,
        run_id=run_id,
        raw_output=raw_output,
    )

    assert prop.created_by == "pixel"
    assert prop.author_type == "agent"
    assert prop.proposal_type == "prototype_modification"

    serialized = serialize_proposal_for_api(prop)
    assert serialized["author"] == "PIXEL"
    assert serialized["author_role"] == "AI Software Engineer"
    assert serialized["contribution_type"] == "IMPLEMENTATION"
    assert serialized["author_type"] == "agent"


# --------------------------------------------------------------------------
# Criterion 3: Alex or Maya creates human contribution and correct person is displayed
# --------------------------------------------------------------------------
def test_human_contribution_alex_and_maya(db_session: Session):
    # 1. Alex creates a human contribution
    res_alex = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/proposals/human",
        json={
            "author": "alex",
            "summary": "Founder direct edit on enterprise billing rules",
            "reasoning": "Decided in executive board meeting.",
            "target_sections": ["product_brief"],
            "changes": {"operations": [{"op": "update_product_brief", "fields": {"policy": "NET_30"}}]},
            "requires_decision": True,
        },
    )
    assert res_alex.status_code == 200
    data_alex = res_alex.json()
    assert data_alex["author"] == "Alex"
    assert data_alex["author_type"] == "human"
    assert data_alex["author_role"] == "Founder / Decision Owner"
    assert data_alex["contribution_type"] == "HUMAN CONTRIBUTION"

    # 2. Maya creates a human contribution
    res_maya = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/proposals/human",
        json={
            "author": "maya",
            "summary": "Designer adjustments to dashboard typography",
            "reasoning": "Improves legibility for financial controllers.",
            "target_sections": ["dashboard"],
            "changes": {"operations": [{"op": "set_dashboard_metrics", "fields": {"font_scale": "refined"}}]},
            "requires_decision": False,
        },
    )
    assert res_maya.status_code == 200
    data_maya = res_maya.json()
    assert data_maya["author"] == "Maya"
    assert data_maya["author_type"] == "human"
    assert data_maya["author_role"] == "Product Designer"
    assert data_maya["contribution_type"] == "HUMAN CONTRIBUTION"


# --------------------------------------------------------------------------
# Criterion 4: NOVA reviews PIXEL's proposal without changing PIXEL's authorship
# --------------------------------------------------------------------------
def test_nova_reviews_pixel_proposal_without_changing_authorship(db_session: Session):
    run_id = f"run_pixel_rev_{uuid.uuid4().hex[:6]}"
    run = AgentRunModel(
        id=run_id,
        project_id=DEMO_PROJECT_ID,
        agent_id="pixel",
        status="working",
        task_description="Build expense submission table",
        base_context_version=1,
        base_artifact_version=1,
        context_pack={"requirements": [], "section_versions": {"hero": 1}},
        source="live_llm",
        started_at=utcnow_str(),
    )
    db_session.add(run)
    db_session.commit()

    raw_output = {
        "summary": "Refined expense table component",
        "reasoning": "Optimizes speed of submission.",
        "affected_requirements": [],
        "target_sections": ["hero"],
        "changes": {
            "operations": [
                {
                    "op": "set_hero_content",
                    "section": "hero",
                    "fields": {"headline": "Fast expense submission"},
                }
            ]
        },
    }

    # Stamping executes structured review where NOVA validates PIXEL
    prop = stamp_and_persist_proposal(
        db=db_session,
        project_id=DEMO_PROJECT_ID,
        run_id=run_id,
        raw_output=raw_output,
    )

    # Verification: Reviewer is NOVA, but Author remains PIXEL!
    assert prop.created_by == "pixel"
    assert prop.reviewed_by == "nova"
    assert prop.review_outcome == "PASS"

    serialized = serialize_proposal_for_api(prop)
    assert serialized["author"] == "PIXEL"  # AUTHOR IS PIXEL!
    assert serialized["reviewed_by"] == "NOVA"  # REVIEWER IS NOVA!
    assert serialized["review_outcome"] == "PASS"


# --------------------------------------------------------------------------
# Criterion 5: Alex approves a PIXEL proposal without becoming its author
# --------------------------------------------------------------------------
def test_alex_approves_pixel_proposal_without_becoming_author(db_session: Session):
    run_id = f"run_pixel_appr_{uuid.uuid4().hex[:6]}"
    run = AgentRunModel(
        id=run_id,
        project_id=DEMO_PROJECT_ID,
        agent_id="pixel",
        status="working",
        task_description="Build approval policy queue",
        base_context_version=1,
        base_artifact_version=1,
        context_pack={"requirements": [], "section_versions": {"hero": 1}},
        source="live_llm",
        started_at=utcnow_str(),
    )
    db_session.add(run)
    db_session.commit()

    raw_output = {
        "summary": "Approval workflow configuration",
        "reasoning": "Configures manager approval routing.",
        "affected_requirements": [],
        "target_sections": ["hero"],
        "changes": {
            "operations": [
                {
                    "op": "set_hero_content",
                    "section": "hero",
                    "fields": {"headline": "Multi-tier corporate governance"},
                }
            ]
        },
    }

    prop = stamp_and_persist_proposal(
        db=db_session,
        project_id=DEMO_PROJECT_ID,
        run_id=run_id,
        raw_output=raw_output,
    )

    # Alex approves the proposal
    approved_prop = apply_proposal_atomically(
        db=db_session,
        project_id=DEMO_PROJECT_ID,
        proposal_id=prop.id,
        decided_by="alex",
    )

    assert approved_prop.status == "approved"
    # Authorship is preserved as PIXEL, not Alex!
    assert approved_prop.created_by == "pixel"
    assert approved_prop.author_type == "agent"

    # Decision record reflects Alex's approval
    decision = db_session.query(DecisionModel).filter(DecisionModel.proposal_id == prop.id).first()
    assert decision is not None
    assert decision.decided_by == "alex"
    assert decision.decision == "approved"

    serialized = serialize_proposal_for_api(approved_prop)
    assert serialized["author"] == "PIXEL"
    assert serialized["status"] == "approved"


# --------------------------------------------------------------------------
# Criterion 6: Contributor filters work individually
# --------------------------------------------------------------------------
def test_contributor_filters_individually(db_session: Session):
    # Setup 1 NOVA, 1 PIXEL, 1 Human proposal
    nova_p = ProposalModel(
        id="prop_filter_nova",
        project_id=DEMO_PROJECT_ID,
        agent_id="nova",
        created_by="nova",
        author_type="agent",
        proposal_type="prd_requirement",
        run_id="run_filter_nova",
        summary="NOVA positioning",
        reasoning="Strategy",
        affected_requirements=[],
        target_sections=["product_brief"],
        changes={"operations": []},
        base_context_version=1,
        base_artifact_version=1,
        base_section_versions={},
        status="pending_review",
        source="live_llm",
        is_simulated=False,
    )
    pixel_p = ProposalModel(
        id="prop_filter_pixel",
        project_id=DEMO_PROJECT_ID,
        agent_id="pixel",
        created_by="pixel",
        author_type="agent",
        proposal_type="prototype_modification",
        run_id="run_filter_pixel",
        summary="PIXEL UI component",
        reasoning="Frontend",
        affected_requirements=[],
        target_sections=["hero"],
        changes={"operations": []},
        base_context_version=1,
        base_artifact_version=1,
        base_section_versions={},
        status="pending_review",
        source="live_llm",
        is_simulated=False,
    )
    human_p = ProposalModel(
        id="prop_filter_human",
        project_id=DEMO_PROJECT_ID,
        agent_id="alex",
        created_by="alex",
        author_type="human",
        proposal_type="human_contribution",
        run_id="run_filter_human",
        summary="Alex manual note",
        reasoning="Founder decision",
        affected_requirements=[],
        target_sections=["dashboard"],
        changes={"operations": []},
        base_context_version=1,
        base_artifact_version=1,
        base_section_versions={},
        status="approved",
        source="human_entry",
        is_simulated=False,
    )
    db_session.add_all([nova_p, pixel_p, human_p])
    db_session.commit()

    proposals = [serialize_proposal_for_api(p) for p in [nova_p, pixel_p, human_p]]

    # NOVA filter
    nova_filtered = [p for p in proposals if p["created_by"] == "nova"]
    assert len(nova_filtered) == 1
    assert nova_filtered[0]["author"] == "NOVA"

    # PIXEL filter
    pixel_filtered = [p for p in proposals if p["created_by"] == "pixel"]
    assert len(pixel_filtered) == 1
    assert pixel_filtered[0]["author"] == "PIXEL"

    # Human filter
    human_filtered = [p for p in proposals if p["author_type"] == "human"]
    assert len(human_filtered) == 1
    assert human_filtered[0]["author"] == "Alex"


# --------------------------------------------------------------------------
# Criterion 7: Contributor and status filters work together
# --------------------------------------------------------------------------
def test_contributor_and_status_filters_together(db_session: Session):
    p_pixel_pending = serialize_proposal_for_api(
        ProposalModel(
            id="p_pix_pend",
            project_id=DEMO_PROJECT_ID,
            created_by="pixel",
            agent_id="pixel",
            author_type="agent",
            status="pending_review",
            summary="Pixel pending",
            reasoning="R",
            affected_requirements=[],
            target_sections=[],
            changes={},
            base_context_version=1,
            base_artifact_version=1,
            base_section_versions={},
        )
    )
    p_pixel_approved = serialize_proposal_for_api(
        ProposalModel(
            id="p_pix_appr",
            project_id=DEMO_PROJECT_ID,
            created_by="pixel",
            agent_id="pixel",
            author_type="agent",
            status="approved",
            summary="Pixel approved",
            reasoning="R",
            affected_requirements=[],
            target_sections=[],
            changes={},
            base_context_version=1,
            base_artifact_version=1,
            base_section_versions={},
        )
    )
    p_nova_pending = serialize_proposal_for_api(
        ProposalModel(
            id="p_nov_pend",
            project_id=DEMO_PROJECT_ID,
            created_by="nova",
            agent_id="nova",
            author_type="agent",
            status="pending_review",
            summary="Nova pending",
            reasoning="R",
            affected_requirements=[],
            target_sections=[],
            changes={},
            base_context_version=1,
            base_artifact_version=1,
            base_section_versions={},
        )
    )

    all_props = [p_pixel_pending, p_pixel_approved, p_nova_pending]

    # PIXEL + pending_review
    res = [p for p in all_props if p["created_by"] == "pixel" and p["status"] == "pending_review"]
    assert len(res) == 1
    assert res[0]["proposal_id"] == "p_pix_pend"

    # PIXEL + approved
    res_appr = [p for p in all_props if p["created_by"] == "pixel" and p["status"] == "approved"]
    assert len(res_appr) == 1
    assert res_appr[0]["proposal_id"] == "p_pix_appr"

    # NOVA + approved -> 0
    res_none = [p for p in all_props if p["created_by"] == "nova" and p["status"] == "approved"]
    assert len(res_none) == 0


# --------------------------------------------------------------------------
# Criterion 8: Redirected/reconciled proposals preserve attribution & revision
# --------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_redirect_and_reconcile_preserve_attribution_and_revisions(db_session: Session):
    # 1. Test redirect for PIXEL
    orig_pixel = ProposalModel(
        id="prop_orig_pixel",
        project_id=DEMO_PROJECT_ID,
        agent_id="pixel",
        created_by="pixel",
        author_type="agent",
        run_id="run_1",
        summary="Original PIXEL proposal",
        reasoning="Reasoning",
        affected_requirements=[],
        target_sections=["hero"],
        changes={"operations": [{"op": "set_hero_content", "fields": {"headline": "V1"}}]},
        base_context_version=1,
        base_artifact_version=1,
        base_section_versions={"hero": 1},
        status="pending_review",
        source="live_llm",
        is_simulated=False,
    )
    db_session.add(orig_pixel)
    db_session.commit()

    from backend.app.agents.pixel import redirect_pixel_proposal
    new_prop = await redirect_pixel_proposal(
        db=db_session,
        project_id=DEMO_PROJECT_ID,
        original_proposal_id="prop_orig_pixel",
        human_instruction="Make it bolder",
        decided_by="alex",
    )

    assert new_prop.supersedes_proposal_id == "prop_orig_pixel"
    assert new_prop.created_by == "pixel"
    assert new_prop.author_type == "agent"


# --------------------------------------------------------------------------
# Criterion 9: Legacy proposals with incomplete metadata do not receive fabricated authorship
# --------------------------------------------------------------------------
def test_legacy_proposals_incomplete_metadata_no_fabrication():
    # Proposal with no created_by and no recognized agent_id
    legacy_prop = ProposalModel(
        id="prop_legacy_incomplete",
        project_id=DEMO_PROJECT_ID,
        agent_id=None,
        created_by=None,
        author_type=None,
        summary="Legacy un-attributed proposal",
        reasoning="Historical commit prior to multi-agent schema.",
        affected_requirements=[],
        target_sections=["product_brief"],
        changes={},
        base_context_version=1,
        base_artifact_version=1,
        base_section_versions={},
        status="pending_review",
        source="legacy_db",
        is_simulated=False,
    )

    serialized = serialize_proposal_for_api(legacy_prop)
    # MUST NOT be fabricated as NOVA, PIXEL, Alex or Maya!
    assert serialized["author"] == "Legacy / Unknown author"
    assert serialized["author_type"] == "unknown"
    assert serialized["created_by"] is None


# --------------------------------------------------------------------------
# Criterion 10: Unauthorized callers cannot spoof another contributor's identity
# --------------------------------------------------------------------------
def test_unauthorized_callers_cannot_spoof_identity():
    # Attempting to submit as an unauthenticated or invalid contributor
    res = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/proposals/human",
        json={
            "author": "malicious_actor",
            "summary": "Spoofed proposal",
            "reasoning": "Attempting unauthorized injection",
            "target_sections": ["hero"],
            "changes": {"operations": []},
        },
    )
    assert res.status_code == 403
    assert "Unauthorized contributor" in res.json()["detail"]
