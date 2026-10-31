import pytest
import asyncio
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.db.database import Base
from backend.app.db.models import (
    ProjectModel,
    RequirementModel,
    ArtifactSectionModel,
    ProposalModel,
    AgentRunModel,
    EventModel,
)
from backend.app.db.seed import reset_demo_database, DEMO_PROJECT_ID
from backend.app.context.pack_builder import build_context_pack, create_and_persist_agent_run
from backend.app.proposals.stamping import stamp_and_persist_proposal
from backend.app.proposals.staleness import evaluate_selective_staleness
from backend.app.proposals.conflicts import evaluate_section_conflicts
from backend.app.proposals.apply import (
    apply_proposal_atomically,
    apply_manual_section_edit,
    ApplyValidationError,
)
from backend.app.context.recovery import restart_agent_and_recover
from backend.app.observer_summary.generator import generate_observer_summary
from backend.app.agents.fallback import (
    FALLBACK_NOVA_PROPOSAL_A,
    FALLBACK_NOVA_PROPOSAL_B,
    FALLBACK_PIXEL_PROPOSAL_C,
    FALLBACK_HIGH_IMPACT_APPROVAL_POLICY,
)


@pytest.fixture
def test_db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = TestingSessionLocal()
    reset_demo_database(db, DEMO_PROJECT_ID)
    try:
        yield db
    finally:
        db.close()


def test_reset_demo_baseline(test_db):
    """Test 24: Reset Demo restores the baseline deterministically."""
    project = test_db.query(ProjectModel).filter(ProjectModel.id == DEMO_PROJECT_ID).first()
    assert project is not None
    assert project.context_version == 1
    assert project.artifact_version == 1

    reqs = test_db.query(RequirementModel).filter(RequirementModel.project_id == DEMO_PROJECT_ID).all()
    assert len(reqs) == 5
    req_keys = {r.requirement_key for r in reqs}
    assert "REQ_AUDIENCE" in req_keys
    assert "REQ_METRICS" in req_keys
    assert "REQ_BRAND" in req_keys
    assert "REQ_APPROVAL_POLICY" in req_keys
    assert "REQ_ROLES" in req_keys

    sections = test_db.query(ArtifactSectionModel).filter(ArtifactSectionModel.project_id == DEMO_PROJECT_ID).all()
    assert len(sections) == 4
    sec_keys = {s.section_key for s in sections}
    assert sec_keys == {"product_brief", "hero", "dashboard", "approval_queue"}


def test_immutable_context_pack_and_stamping(test_db):
    """Test 4 & 6: Backend creates immutable Context Pack and stamps proposal versions."""
    run = create_and_persist_agent_run(
        db=test_db,
        project_id=DEMO_PROJECT_ID,
        agent_id="nova",
        run_id="run_test_001",
        task_id="task_001",
        task_description="Strategy analysis",
    )
    assert run.context_pack is not None
    assert run.base_context_version == 1
    assert run.base_artifact_version == 1

    # Stamp Proposal A
    prop = stamp_and_persist_proposal(
        db=test_db,
        project_id=DEMO_PROJECT_ID,
        run_id=run.id,
        raw_output=FALLBACK_NOVA_PROPOSAL_A,
        source="cached_fallback",
        is_simulated=True,
    )
    assert prop.id.startswith("prop_")
    assert prop.base_context_version == 1
    assert prop.base_artifact_version == 1
    assert prop.base_section_versions == {"product_brief": 1}
    assert prop.status == "pending_review"


def test_selective_staleness(test_db):
    """Test 9 & 10: Proposal A becomes stale when REQ_AUDIENCE changes; Proposal B survives."""
    run = create_and_persist_agent_run(
        db=test_db,
        project_id=DEMO_PROJECT_ID,
        agent_id="nova",
        run_id="run_test_002",
        task_id="task_002",
        task_description="Parallel tasks",
    )
    # Proposal A depends on REQ_AUDIENCE
    prop_a = stamp_and_persist_proposal(
        db=test_db,
        project_id=DEMO_PROJECT_ID,
        run_id=run.id,
        raw_output=FALLBACK_NOVA_PROPOSAL_A,
    )
    # Proposal B depends on REQ_METRICS
    prop_b = stamp_and_persist_proposal(
        db=test_db,
        project_id=DEMO_PROJECT_ID,
        run_id=run.id,
        raw_output=FALLBACK_NOVA_PROPOSAL_B,
    )

    # Change REQ_AUDIENCE
    staled = evaluate_selective_staleness(
        db=test_db,
        project_id=DEMO_PROJECT_ID,
        changed_requirement_keys=["REQ_AUDIENCE"],
        old_value_summary="Small businesses",
        new_value_summary="Enterprise finance teams",
    )

    test_db.refresh(prop_a)
    test_db.refresh(prop_b)

    assert prop_a.status == "stale"
    assert "Enterprise finance teams" in prop_a.stale_reason
    # Proposal B must remain eligible!
    assert prop_b.status == "pending_review"
    assert prop_b.stale_reason is None


def test_manual_section_edit_and_conflict(test_db):
    """Test 11 & 12: Manual edit to hero increments section version; older PIXEL proposal becomes CONFLICT."""
    run = create_and_persist_agent_run(
        db=test_db,
        project_id=DEMO_PROJECT_ID,
        agent_id="pixel",
        run_id="run_test_003",
        task_id="task_003",
        task_description="Hero upgrade",
    )
    prop_c = stamp_and_persist_proposal(
        db=test_db,
        project_id=DEMO_PROJECT_ID,
        run_id=run.id,
        raw_output=FALLBACK_PIXEL_PROPOSAL_C,
    )
    assert prop_c.base_section_versions == {"hero": 1}

    # Maya manually edits hero section
    updated_sec = apply_manual_section_edit(
        db=test_db,
        project_id=DEMO_PROJECT_ID,
        section_key="hero",
        new_data={
            "headline": "Maya's Handcrafted Hero",
            "subheadline": "Human precision expense tracking",
            "cta_text": "Get Started",
        },
        expected_version=1,
        editor_id="maya",
    )
    assert updated_sec.version == 2

    # Proposal C should now be marked CONFLICT
    test_db.refresh(prop_c)
    assert prop_c.status == "conflict"
    assert "Maya updated the 'hero' section" in prop_c.conflict_reason


def test_atomic_apply_and_permissions(test_db):
    """Test 15, 20, 22: High impact proposal requires Alex; Maya is rejected with 403."""
    run = create_and_persist_agent_run(
        db=test_db,
        project_id=DEMO_PROJECT_ID,
        agent_id="pixel",
        run_id="run_test_004",
        task_id="task_004",
        task_description="Approval policy proposal",
    )
    prop_d = stamp_and_persist_proposal(
        db=test_db,
        project_id=DEMO_PROJECT_ID,
        run_id=run.id,
        raw_output=FALLBACK_HIGH_IMPACT_APPROVAL_POLICY,
    )
    assert prop_d.requires_decision is True
    assert prop_d.assigned_decider_id == "alex"

    # Maya attempts to approve -> Forbidden!
    with pytest.raises(ApplyValidationError) as exc:
        apply_proposal_atomically(
            db=test_db,
            project_id=DEMO_PROJECT_ID,
            proposal_id=prop_d.id,
            decided_by="maya",
        )
    assert exc.value.is_forbidden is True

    # Alex approves -> Success!
    approved = apply_proposal_atomically(
        db=test_db,
        project_id=DEMO_PROJECT_ID,
        proposal_id=prop_d.id,
        decided_by="alex",
    )
    assert approved.status == "approved"

    # Verify section was updated in DB
    sec = (
        test_db.query(ArtifactSectionModel)
        .filter(ArtifactSectionModel.project_id == DEMO_PROJECT_ID, ArtifactSectionModel.section_key == "approval_queue")
        .first()
    )
    assert sec.version == 2
    assert sec.data["title"] == "Enterprise Multi-Tier Approval Queue"


@pytest.mark.asyncio
async def test_agent_restart_and_recovery(test_db):
    """Test 16 & 17: Restarting an agent builds fresh Context Pack from persisted state."""
    new_run, recovery_data = await restart_agent_and_recover(
        db=test_db,
        project_id=DEMO_PROJECT_ID,
        agent_id="nova",
    )
    assert new_run.id.startswith("run_nova_")
    assert "recovery_summary" in recovery_data
    assert "what_changed_offline" in recovery_data
    assert new_run.base_context_version >= 1


@pytest.mark.asyncio
async def test_observer_summary_generation(test_db):
    """Test 23: Observer Summary is event-derived with 3 required parts."""
    summary = await generate_observer_summary(db=test_db, project_id=DEMO_PROJECT_ID)
    assert summary.what_changed != ""
    assert summary.why != ""
    assert summary.what_happens_next != ""
    assert len(summary.source_event_ids) > 0
