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
    ArtifactSectionModel,
    ChatMessageModel,
    utcnow_str,
)
from backend.app.proposals.stamping import stamp_and_persist_proposal
from backend.app.proposals.apply import apply_proposal_atomically
from backend.app.proposals.serialization import serialize_proposal_for_api
from backend.app.proposals.output_transformers import (
    build_nova_prd_data,
    build_pixel_implementation_data,
)


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
# 1. NOVA creates structured PRD proposal with all 11 required sections
# --------------------------------------------------------------------------
def test_nova_creates_structured_prd_with_11_sections(db_session: Session):
    run_id = f"run_nova_{uuid.uuid4().hex[:6]}"
    run = AgentRunModel(
        id=run_id,
        project_id=DEMO_PROJECT_ID,
        agent_id="nova",
        status="working",
        task_description="Define enterprise multi-currency and target audience",
        base_context_version=1,
        base_artifact_version=1,
        context_pack={"requirements": [{"id": "REQ_AUDIENCE"}], "section_versions": {"product_brief": 1}},
        source="live_llm",
        started_at=utcnow_str(),
    )
    db_session.add(run)
    db_session.commit()

    raw_output = {
        "summary": "Multi-Currency & Global Compliance Support",
        "reasoning": "Global enterprise customers need real-time FX rate sync and multi-currency expense reporting.",
        "affected_requirements": ["REQ_AUDIENCE"],
        "target_sections": ["product_brief"],
        "changes": {
            "operations": [
                {
                    "op": "update_product_brief",
                    "section": "product_brief",
                    "fields": {"problem_statement": "Manual currency translation is slow and error-prone"}
                }
            ]
        }
    }

    stamped = stamp_and_persist_proposal(
        db=db_session,
        project_id=DEMO_PROJECT_ID,
        run_id=run_id,
        raw_output=raw_output,
    )

    assert stamped is not None
    assert stamped.prd_data is not None

    prd = stamped.prd_data
    # Verify all 11 mandatory PRD sections are present
    required_sections = [
        "executive_summary",
        "problem_statement",
        "target_users",
        "proposed_solution",
        "functional_requirements",
        "non_functional_requirements",
        "user_stories",
        "acceptance_criteria",
        "constraints_assumptions",
        "dependencies_risks",
        "open_questions",
    ]
    for sec in required_sections:
        assert sec in prd, f"Missing PRD section '{sec}'"
        assert prd[sec] is not None, f"PRD section '{sec}' is None"

    assert prd["status"] in ("draft", "ready_for_review")
    assert len(prd["functional_requirements"]) >= 1
    assert len(prd["acceptance_criteria"]) >= 1
    assert prd["author"] == "NOVA"
    assert prd["author_role"] == "AI Product Strategist"


# --------------------------------------------------------------------------
# 2. NOVA PRD does not expose implementation operations as primary output
# --------------------------------------------------------------------------
def test_nova_prd_serialization_primary_output(db_session: Session):
    run_id = f"run_nova_{uuid.uuid4().hex[:6]}"
    run = AgentRunModel(
        id=run_id,
        project_id=DEMO_PROJECT_ID,
        agent_id="nova",
        status="working",
        task_description="Define enterprise policy engine requirements",
        base_context_version=1,
        base_artifact_version=1,
        context_pack={"requirements": [{"id": "REQ_AUDIENCE"}], "section_versions": {"product_brief": 1}},
        source="live_llm",
        started_at=utcnow_str(),
    )
    db_session.add(run)
    db_session.commit()

    raw_output = {
        "summary": "Automated Expense Policy Engine PRD",
        "reasoning": "Real-time compliance validation prevents fraudulent receipts before submission.",
        "affected_requirements": ["REQ_AUDIENCE"],
        "target_sections": ["product_brief"],
        "changes": {
            "operations": [{"op": "update_product_brief", "section": "product_brief", "fields": {"target_audience": "Mid-market enterprise"}}]
        }
    }

    stamped = stamp_and_persist_proposal(
        db=db_session,
        project_id=DEMO_PROJECT_ID,
        run_id=run_id,
        raw_output=raw_output,
    )

    serialized = serialize_proposal_for_api(stamped)
    assert "prd_data" in serialized
    assert serialized["prd_data"] is not None
    assert serialized["author_label"] == "NOVA · PRD"
    assert serialized["contribution_type"] == "PRODUCT REQUIREMENTS"
    # Ensure title and executive summary are primary
    assert "executive_summary" in serialized["prd_data"]
    assert "functional_requirements" in serialized["prd_data"]


# --------------------------------------------------------------------------
# 3. Alex confirms NOVA PRD via POST /confirm_requirements
# --------------------------------------------------------------------------
def test_alex_confirms_nova_prd_via_endpoint(db_session: Session):
    run_id = f"run_nova_{uuid.uuid4().hex[:6]}"
    run = AgentRunModel(
        id=run_id,
        project_id=DEMO_PROJECT_ID,
        agent_id="nova",
        status="working",
        task_description="Define analytics dashboard requirements",
        base_context_version=1,
        base_artifact_version=1,
        context_pack={"requirements": [{"id": "REQ_AUDIENCE"}], "section_versions": {"product_brief": 1}},
        source="live_llm",
        started_at=utcnow_str(),
    )
    db_session.add(run)
    db_session.commit()

    raw_output = {
        "summary": "Executive Analytics & Departmental Spend PRD",
        "reasoning": "CFOs need drill-down departmental budgets and spend forecasts.",
        "affected_requirements": ["REQ_AUDIENCE"],
        "target_sections": ["product_brief"],
        "changes": {
            "operations": [
                {"op": "update_product_brief", "section": "product_brief", "fields": {"target_audience": "CFOs and Controllers"}}
            ]
        }
    }

    stamped = stamp_and_persist_proposal(
        db=db_session,
        project_id=DEMO_PROJECT_ID,
        run_id=run_id,
        raw_output=raw_output,
    )

    # Initial state
    assert stamped.status == "pending_review"
    orig_project = db_session.query(ProjectModel).filter(ProjectModel.id == DEMO_PROJECT_ID).first()
    orig_version = orig_project.artifact_version

    # Call confirmation endpoint
    resp = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/proposals/{stamped.id}/confirm_requirements",
        json={"confirmed_by": "alex", "note": "Requirements fully approved for Q4 build"},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["status"] == "approved"
    assert data["proposal_id"] == stamped.id

    # Refresh from db
    db_session.refresh(stamped)
    assert stamped.status == "approved"
    assert stamped.prd_data["status"] == "confirmed"
    assert stamped.prd_data["confirmed_by"] == "alex"
    assert stamped.prd_data["confirmed_at"] is not None

    # Check project artifact version has NOT incremented (confirming requirements does not mutate canvas directly)
    db_session.refresh(orig_project)
    assert orig_project.artifact_version == orig_version


# --------------------------------------------------------------------------
# 4. PIXEL creates implementation proposal with all 7 components
# --------------------------------------------------------------------------
def test_pixel_creates_implementation_proposal(db_session: Session):
    run_id = f"run_pixel_{uuid.uuid4().hex[:6]}"
    run = AgentRunModel(
        id=run_id,
        project_id=DEMO_PROJECT_ID,
        agent_id="pixel",
        status="working",
        task_description="Implement interactive receipt scanner and auto-tagging",
        base_context_version=1,
        base_artifact_version=1,
        context_pack={"requirements": [{"id": "REQ_BRAND"}], "section_versions": {"hero": 1}},
        source="live_llm",
        started_at=utcnow_str(),
    )
    db_session.add(run)
    db_session.commit()

    raw_output = {
        "summary": "Receipt Scanner OCR & AI Auto-Categorization",
        "reasoning": "Reduces receipt upload latency and parses merchant, date, amount, and VAT dynamically.",
        "affected_requirements": ["REQ_BRAND"],
        "target_sections": ["hero"],
        "changes": {
            "operations": [
                {
                    "op": "set_hero_content",
                    "section": "hero",
                    "fields": {
                        "headline": "Smart OCR Receipt Scanner",
                        "subheadline": "Multi-angle scanning with automatic currency detection"
                    }
                }
            ]
        }
    }

    stamped = stamp_and_persist_proposal(
        db=db_session,
        project_id=DEMO_PROJECT_ID,
        run_id=run_id,
        raw_output=raw_output,
    )

    assert stamped is not None
    assert stamped.implementation_data is not None

    impl = stamped.implementation_data
    # 7 engineering components:
    # 1. Implementation Summary
    assert "implementation_summary" in impl
    assert "what_implemented" in impl["implementation_summary"]
    assert "why_changes_made" in impl["implementation_summary"]
    # 2. Implementation Plan / Tasks
    tasks_list = impl["implementation_plan"] if isinstance(impl["implementation_plan"], list) else impl["implementation_plan"]["tasks"]
    assert len(tasks_list) >= 1
    # 3. Affected Sections / Changed Files
    assert "affected_sections" in impl
    assert len(impl["affected_sections"]) >= 1
    assert "changed_files" in impl or "changed_files_or_sections" in impl
    # 4. Readable Component Diff
    assert "readable_diff" in impl or "artifact_diff" in impl
    diffs = impl.get("readable_diff") or impl.get("artifact_diff")
    assert len(diffs) >= 1
    assert "before" in diffs[0]
    assert "after" in diffs[0]
    # 5. Visual Preview Reference
    assert "visual_preview" in impl or "preview_reference" in impl
    preview = impl.get("visual_preview") or impl.get("preview_reference")
    assert "target_section" in preview
    # 6. Validation and Testing Results
    assert "test_results" in impl
    assert impl["test_results"]["passed"] > 0
    assert "allowlist_check" in impl["test_results"]
    assert "type_check" in impl["test_results"]
    # 7. Requirement Traceability Table
    assert "requirement_traceability" in impl
    assert len(impl["requirement_traceability"]) >= 1


# --------------------------------------------------------------------------
# 5. NOVA advisory review on PIXEL proposal preserves PIXEL authorship
# --------------------------------------------------------------------------
def test_nova_advisory_review_on_pixel_proposal(db_session: Session):
    run_id = f"run_pixel_{uuid.uuid4().hex[:6]}"
    run = AgentRunModel(
        id=run_id,
        project_id=DEMO_PROJECT_ID,
        agent_id="pixel",
        status="working",
        task_description="Implement LedgerFlow export module",
        base_context_version=1,
        base_artifact_version=1,
        context_pack={"requirements": [{"id": "REQ_BRAND"}], "section_versions": {"hero": 1}},
        source="live_llm",
        started_at=utcnow_str(),
    )
    db_session.add(run)
    db_session.commit()

    raw_output = {
        "summary": "QuickBooks & Xero Accounting Sync",
        "reasoning": "Bi-directional ledger sync for real-time reconciliation.",
        "affected_requirements": ["REQ_BRAND"],
        "target_sections": ["hero"],
        "changes": {
            "operations": [{"op": "set_hero_content", "section": "hero", "fields": {"headline": "Accounting Sync Ready"}}]
        }
    }

    stamped = stamp_and_persist_proposal(
        db=db_session,
        project_id=DEMO_PROJECT_ID,
        run_id=run_id,
        raw_output=raw_output,
    )

    serialized = serialize_proposal_for_api(stamped)
    # Authorship must remain strictly PIXEL
    assert serialized["author"] == "PIXEL"
    assert serialized["agent_id"] == "pixel"
    assert serialized["created_by"] == "pixel"
    assert serialized["author_role"] == "AI Software Engineer"
    assert serialized["author_label"] == "PIXEL · Implementation"

    # Advisory review fields
    assert serialized["reviewed_by"] == "NOVA"
    assert serialized["review_outcome"] in ("PASS", "WARNING", "BLOCK")

    # Implementation data includes advisory review breakdown
    impl = serialized["implementation_data"]
    assert "nova_advisory_review" in impl
    review = impl["nova_advisory_review"]
    assert review["verdict"] in ("PASS", "WARNING", "BLOCK")
    assert "criteria_evaluations" in review
    assert len(review["criteria_evaluations"]) >= 4
    # Check advisory disclaimer
    assert "advisory" in review.get("advisory_disclaimer", "").lower()


# --------------------------------------------------------------------------
# 6. Human approval applies PIXEL changes and posts chat notification
# --------------------------------------------------------------------------
def test_human_approval_applies_pixel_changes_and_notifies_chat(db_session: Session):
    run_id = f"run_pixel_{uuid.uuid4().hex[:6]}"
    run = AgentRunModel(
        id=run_id,
        project_id=DEMO_PROJECT_ID,
        agent_id="pixel",
        status="working",
        task_description="Implement interactive hero demo",
        base_context_version=1,
        base_artifact_version=1,
        context_pack={"requirements": [{"id": "REQ_BRAND"}], "section_versions": {"hero": 1}},
        source="live_llm",
        started_at=utcnow_str(),
    )
    db_session.add(run)
    db_session.commit()

    raw_output = {
        "summary": "Modernize LedgerFlow Hero Section",
        "reasoning": "Clear high-converting CTA and audit badge.",
        "affected_requirements": ["REQ_BRAND"],
        "target_sections": ["hero"],
        "changes": {
            "operations": [
                {
                    "op": "set_hero_content",
                    "section": "hero",
                    "fields": {
                        "headline": "Autonomous Spend Governance for High-Growth Finance Teams",
                        "subheadline": "Real-time compliance, zero friction.",
                        "cta_text": "Schedule Enterprise Pilot"
                    }
                }
            ]
        }
    }

    stamped = stamp_and_persist_proposal(
        db=db_session,
        project_id=DEMO_PROJECT_ID,
        run_id=run_id,
        raw_output=raw_output,
    )

    # Approve via endpoint
    resp = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/proposals/{stamped.id}/approve",
        json={"decided_by": "alex", "reason": "Looks clean, ready to ship"},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["status"] == "success"

    # Verify project artifact version incremented
    proj = db_session.query(ProjectModel).filter(ProjectModel.id == DEMO_PROJECT_ID).first()
    assert proj.artifact_version >= 2

    # Verify chat notification was dispatched
    chat_msgs = (
        db_session.query(ChatMessageModel)
        .filter(ChatMessageModel.conversation_id == "conv_team_ledgerflow")
        .order_by(ChatMessageModel.created_at.desc())
        .all()
    )
    found_notification = False
    for msg in chat_msgs:
        if "Alex approved implementation" in msg.message_content or stamped.id in (msg.related_proposal_id or ""):
            found_notification = True
            break
    assert found_notification, "Expected chat message notification for approved proposal"


# --------------------------------------------------------------------------
# 7. Rejection leaves canvas unchanged
# --------------------------------------------------------------------------
def test_rejection_leaves_canvas_unchanged(db_session: Session):
    proj_before = db_session.query(ProjectModel).filter(ProjectModel.id == DEMO_PROJECT_ID).first()
    initial_version = proj_before.artifact_version

    hero_sec = (
        db_session.query(ArtifactSectionModel)
        .filter(
            ArtifactSectionModel.project_id == DEMO_PROJECT_ID,
            ArtifactSectionModel.section_key == "hero",
        )
        .first()
    )
    initial_hero = dict(hero_sec.data) if isinstance(hero_sec.data, dict) else hero_sec.data

    run_id = f"run_pixel_{uuid.uuid4().hex[:6]}"
    run = AgentRunModel(
        id=run_id,
        project_id=DEMO_PROJECT_ID,
        agent_id="pixel",
        status="working",
        task_description="Radical redesign rejected by Alex",
        base_context_version=1,
        base_artifact_version=initial_version,
        context_pack={"requirements": [{"id": "REQ_BRAND"}], "section_versions": {"hero": initial_version}},
        source="live_llm",
        started_at=utcnow_str(),
    )
    db_session.add(run)
    db_session.commit()

    raw_output = {
        "summary": "Experimental Radical Hero Layout",
        "reasoning": "Experimental test.",
        "affected_requirements": ["REQ_BRAND"],
        "target_sections": ["hero"],
        "changes": {
            "operations": [
                {
                    "op": "set_hero_content",
                    "section": "hero",
                    "fields": {"headline": "UNWANTED EXPERIMENTAL HEADLINE"}
                }
            ]
        }
    }

    stamped = stamp_and_persist_proposal(
        db=db_session,
        project_id=DEMO_PROJECT_ID,
        run_id=run_id,
        raw_output=raw_output,
    )

    resp = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/proposals/{stamped.id}/reject",
        json={"decided_by": "alex", "reason": "Not aligned with enterprise brand guidelines"},
    )
    assert resp.status_code == 200, resp.text

    db_session.refresh(proj_before)
    db_session.refresh(hero_sec)
    assert proj_before.artifact_version == initial_version
    assert hero_sec.data == initial_hero


# --------------------------------------------------------------------------
# 8. Historical legacy proposals serialize with complete metadata
# --------------------------------------------------------------------------
def test_legacy_proposals_serialize_without_breaking(db_session: Session):
    run_id = f"run_legacy_{uuid.uuid4().hex[:6]}"
    run = AgentRunModel(
        id=run_id,
        project_id=DEMO_PROJECT_ID,
        agent_id="pixel",
        status="completed",
        task_description="Legacy run",
        base_context_version=1,
        base_artifact_version=1,
        context_pack={"requirements": [{"id": "REQ_BRAND"}], "section_versions": {"hero": 1}},
        source="live_llm",
        started_at=utcnow_str(),
    )
    db_session.add(run)
    db_session.commit()

    legacy_prop = ProposalModel(
        id=f"prop_legacy_{uuid.uuid4().hex[:6]}",
        project_id=DEMO_PROJECT_ID,
        run_id=run_id,
        agent_id="pixel",
        summary="Legacy expense card update",
        reasoning="Legacy change before output redesign.",
        proposal_type="prototype_modification",
        target_sections=["hero"],
        base_context_version=1,
        base_artifact_version=1,
        base_section_versions={"hero": 1},
        changes={"operations": [{"op": "set_hero_content", "section": "hero", "fields": {}}]},
        status="pending_review",
        created_at=utcnow_str(),
        updated_at=utcnow_str(),
        prd_data=None,
        implementation_data=None,
    )
    db_session.add(legacy_prop)
    db_session.commit()

    serialized = serialize_proposal_for_api(legacy_prop)
    assert serialized["proposal_id"] == legacy_prop.id
    # Dynamically enriched with implementation data
    assert serialized["implementation_data"] is not None
    assert "implementation_summary" in serialized["implementation_data"]
    # Technical details preserved
    assert "operations" in serialized["changes"]
