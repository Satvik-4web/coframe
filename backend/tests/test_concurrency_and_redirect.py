import pytest
import concurrent.futures
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.db.database import Base
from backend.app.db.models import (
    ProjectModel,
    RequirementModel,
    ArtifactSectionModel,
    ProposalModel,
    utcnow_str,
)
from backend.app.db.seed import reset_demo_database, DEMO_PROJECT_ID
from backend.app.context.pack_builder import create_and_persist_agent_run
from backend.app.proposals.stamping import stamp_and_persist_proposal
from backend.app.proposals.apply import (
    apply_proposal_atomically,
    apply_manual_section_edit,
    ApplyValidationError,
)
from backend.app.agents.nova import redirect_nova_proposal
from backend.app.agents.pixel import redirect_pixel_proposal
from backend.app.agents.fallback import (
    FALLBACK_NOVA_PROPOSAL_A,
    FALLBACK_NOVA_PROPOSAL_B,
    FALLBACK_PIXEL_PROPOSAL_C,
    FALLBACK_HIGH_IMPACT_APPROVAL_POLICY,
)


@pytest.fixture
def db_engine():
    engine = create_engine("sqlite:///./test_concurrency.db", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            for table, col in [("proposals", "prune_metadata"), ("agent_runs", "prune_metadata")]:
                cols = [r[1] for r in conn.execute(text(f"PRAGMA table_info({table})")).fetchall()]
                if col not in cols:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} JSON"))
                    conn.commit()
    except Exception:
        pass
    return engine


@pytest.fixture
def db_session(db_engine):
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=db_engine)
    session = TestingSessionLocal()
    reset_demo_database(session, DEMO_PROJECT_ID)
    try:
        yield session
    finally:
        session.close()


def test_competing_manual_edits(db_session):
    """Priority 1: Test competing manual edits on the same section."""
    # Initial hero is v1
    hero = db_session.query(ArtifactSectionModel).filter(
        ArtifactSectionModel.project_id == DEMO_PROJECT_ID,
        ArtifactSectionModel.section_key == "hero"
    ).first()
    assert hero.version == 1

    # Edit 1 succeeds with expected_version=1
    updated_1 = apply_manual_section_edit(
        db=db_session,
        project_id=DEMO_PROJECT_ID,
        section_key="hero",
        new_data={"headline": "Edit 1", "subheadline": "Sub 1", "cta_text": "CTA 1"},
        expected_version=1,
        editor_id="maya",
    )
    assert updated_1.version == 2

    # Edit 2 competing with the old expected_version=1 MUST FAIL with version conflict!
    with pytest.raises(ValueError) as exc:
        apply_manual_section_edit(
            db=db_session,
            project_id=DEMO_PROJECT_ID,
            section_key="hero",
            new_data={"headline": "Edit 2", "subheadline": "Sub 2", "cta_text": "CTA 2"},
            expected_version=1,
            editor_id="maya",
        )
    assert "conflict" in str(exc.value).lower()


def test_competing_proposal_apply_vs_manual_edit(db_session):
    """Priority 1: When a section version evolves, proposal apply fails atomically and rolls back."""
    run = create_and_persist_agent_run(
        db=db_session,
        project_id=DEMO_PROJECT_ID,
        agent_id="pixel",
        run_id="run_comp_001",
        task_id="task_comp_001",
        task_description="Hero update",
    )
    prop = stamp_and_persist_proposal(
        db=db_session,
        project_id=DEMO_PROJECT_ID,
        run_id=run.id,
        raw_output=FALLBACK_PIXEL_PROPOSAL_C,
    )
    assert prop.base_section_versions == {"hero": 1}

    # Maya manually edits hero, incrementing to v2
    apply_manual_section_edit(
        db=db_session,
        project_id=DEMO_PROJECT_ID,
        section_key="hero",
        new_data={"headline": "Maya's Direct Edit"},
        expected_version=1,
        editor_id="maya",
    )

    # Proposal apply should be rejected with conflict
    with pytest.raises(ApplyValidationError) as exc:
        apply_proposal_atomically(
            db=db_session,
            project_id=DEMO_PROJECT_ID,
            proposal_id=prop.id,
            decided_by="alex",
        )
    assert exc.value.is_conflict is True


def test_atomic_multi_section_partial_write_rollback(db_session):
    """Priority 1: If a proposal targets 2 sections and one conflicts, NEITHER is written."""
    run = create_and_persist_agent_run(
        db=db_session,
        project_id=DEMO_PROJECT_ID,
        agent_id="pixel",
        run_id="run_multi_001",
        task_id="task_multi_001",
        task_description="Multi-section update",
    )
    # Propose changes to both hero and dashboard
    multi_prop_raw = {
        "summary": "Update hero and dashboard",
        "reasoning": "Synchronized visual refresh",
        "affected_requirements": ["REQ_BRAND"],
        "target_sections": ["hero", "dashboard"],
        "changes": {
            "operations": [
                {
                    "op": "set_hero_content",
                    "fields": {"headline": "Multi Hero Test"}
                },
                {
                    "op": "set_dashboard_metrics",
                    "title": "Multi Dashboard Test",
                    "metrics": [{"label": "Test Metric", "value": "$999"}]
                }
            ]
        }
    }
    prop = stamp_and_persist_proposal(
        db=db_session,
        project_id=DEMO_PROJECT_ID,
        run_id=run.id,
        raw_output=multi_prop_raw,
    )
    assert prop.base_section_versions == {"hero": 1, "dashboard": 1}

    # Now mutate hero to v2 so hero conflicts, while dashboard remains v1
    apply_manual_section_edit(
        db=db_session,
        project_id=DEMO_PROJECT_ID,
        section_key="hero",
        new_data={"headline": "Concurrent Hero Mutate"},
        expected_version=1,
        editor_id="maya",
    )

    # Attempt to apply proposal
    with pytest.raises(ApplyValidationError) as exc:
        apply_proposal_atomically(
            db=db_session,
            project_id=DEMO_PROJECT_ID,
            proposal_id=prop.id,
            decided_by="alex",
        )
    assert exc.value.is_conflict is True

    # VERIFY PARTIAL WRITE PREVENTION: dashboard must NOT have been updated!
    dash = db_session.query(ArtifactSectionModel).filter(
        ArtifactSectionModel.project_id == DEMO_PROJECT_ID,
        ArtifactSectionModel.section_key == "dashboard"
    ).first()
    assert dash.version == 1
    assert dash.data.get("title") != "Multi Dashboard Test"


@pytest.mark.asyncio
async def test_nova_and_pixel_redirect(db_session):
    """Priority 2: Test that NOVA proposals redirect to NOVA and PIXEL redirect to PIXEL."""
    # 1. NOVA Proposal A redirect
    run_nova = create_and_persist_agent_run(
        db=db_session,
        project_id=DEMO_PROJECT_ID,
        agent_id="nova",
        run_id="run_nova_test",
        task_id="task_nova_test",
        task_description="NOVA run",
    )
    prop_nova = stamp_and_persist_proposal(
        db=db_session,
        project_id=DEMO_PROJECT_ID,
        run_id=run_nova.id,
        raw_output=FALLBACK_NOVA_PROPOSAL_A,
    )

    revised_nova = await redirect_nova_proposal(
        db=db_session,
        project_id=DEMO_PROJECT_ID,
        original_proposal_id=prop_nova.id,
        human_instruction="Position for CFO enterprise compliance",
        decided_by="alex",
    )
    assert revised_nova.agent_id == "nova"
    assert revised_nova.supersedes_proposal_id == prop_nova.id

    # Verify original is superseded
    db_session.refresh(prop_nova)
    assert prop_nova.status == "superseded"

    # 2. PIXEL Proposal redirect
    run_pixel = create_and_persist_agent_run(
        db=db_session,
        project_id=DEMO_PROJECT_ID,
        agent_id="pixel",
        run_id="run_pixel_test",
        task_id="task_pixel_test",
        task_description="PIXEL run",
    )
    prop_pixel = stamp_and_persist_proposal(
        db=db_session,
        project_id=DEMO_PROJECT_ID,
        run_id=run_pixel.id,
        raw_output=FALLBACK_PIXEL_PROPOSAL_C,
    )

    revised_pixel = await redirect_pixel_proposal(
        db=db_session,
        project_id=DEMO_PROJECT_ID,
        original_proposal_id=prop_pixel.id,
        human_instruction="Add secondary CTA for demo booking",
        decided_by="alex",
    )
    assert revised_pixel.agent_id == "pixel"
    assert revised_pixel.supersedes_proposal_id == prop_pixel.id


def test_permission_restrictions_alex_vs_maya(db_session):
    """Priority 3: Restrict high-impact decisions to Alex across actions."""
    run = create_and_persist_agent_run(
        db=db_session,
        project_id=DEMO_PROJECT_ID,
        agent_id="pixel",
        run_id="run_perm_test",
        task_id="task_perm_test",
        task_description="High-impact policy",
    )
    prop = stamp_and_persist_proposal(
        db=db_session,
        project_id=DEMO_PROJECT_ID,
        run_id=run.id,
        raw_output=FALLBACK_HIGH_IMPACT_APPROVAL_POLICY,
    )
    assert prop.requires_decision is True
    assert prop.assigned_decider_id == "alex"

    # Maya cannot approve
    with pytest.raises(ApplyValidationError) as exc:
        apply_proposal_atomically(
            db=db_session,
            project_id=DEMO_PROJECT_ID,
            proposal_id=prop.id,
            decided_by="maya",
        )
    assert exc.value.is_forbidden is True

    # Non-demo identity cannot approve
    with pytest.raises(ApplyValidationError) as exc:
        apply_proposal_atomically(
            db=db_session,
            project_id=DEMO_PROJECT_ID,
            proposal_id=prop.id,
            decided_by="unauthorized_user",
        )
    assert exc.value.is_forbidden is True
