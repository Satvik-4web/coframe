import pytest
import asyncio
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.app.db.database import Base
from backend.app.db.models import (
    ProjectModel,
    RequirementModel,
    ArtifactSectionModel,
    AgentRunModel,
    EventModel,
)
from backend.app.context.checkpointing import (
    create_checkpoint,
    evaluate_checkpoint_and_resume_plan,
    ExecutionState,
)
from backend.app.context.recovery import restart_agent_and_recover


@pytest.fixture
def recovery_db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    proj = ProjectModel(id="test-rec-proj", name="Recovery Proj", context_version=1, artifact_version=1)
    session.add(proj)

    req = RequirementModel(
        id="r1",
        project_id="test-rec-proj",
        requirement_key="REQ_AUDIENCE",
        title="Audience",
        value="Small businesses",
        version=1,
    )
    session.add(req)

    sec = ArtifactSectionModel(
        id="s1",
        project_id="test-rec-proj",
        section_key="hero",
        data={"headline": "Initial"},
        version=1,
    )
    session.add(sec)

    run = AgentRunModel(
        id="run-init",
        project_id="test-rec-proj",
        agent_id="nova",
        status="working",
        task_description="Analyze market",
        context_pack={},
        base_context_version=1,
        base_artifact_version=1,
    )
    session.add(run)
    session.commit()

    yield session
    session.close()


def test_create_and_retrieve_checkpoint(recovery_db):
    """Tests creating fine-grained execution checkpoints for an agent."""
    run = create_checkpoint(
        db=recovery_db,
        run_id="run-init",
        completed_step="Analyzed small business personas",
        pending_steps=["Define positioning brief", "Draft value props"],
        idempotency_key="idemp_001",
    )

    assert run.last_checkpoint is not None
    assert run.last_checkpoint["completed_step"] == "Analyzed small business personas"
    assert "Define positioning brief" in run.last_checkpoint["pending_work"]
    assert run.idempotency_key == "idemp_001"


def test_resume_plan_when_context_evolves_offline(recovery_db):
    """
    Tests that if context_version advances while the agent was offline,
    the checkpoint evaluator flags context_drift and instructs revise_and_reconcile!
    """
    # 1. Create checkpoint at context v1
    create_checkpoint(
        db=recovery_db,
        run_id="run-init",
        completed_step="Persona analysis",
        pending_steps=["Draft hero copy"],
    )

    # 2. Advance project context to v2
    proj = recovery_db.query(ProjectModel).filter_by(id="test-rec-proj").first()
    proj.context_version = 2
    recovery_db.commit()

    # 3. Evaluate resume plan
    plan = evaluate_checkpoint_and_resume_plan(recovery_db, "test-rec-proj", "nova")

    assert plan["has_checkpoint"] is True
    assert plan["can_resume_directly"] is False
    assert plan["task_action"] == "revise_and_reconcile"
    assert "Context evolved while offline" in plan["reason"]
    assert plan["context_drift"]["current_context_version"] == 2


@pytest.mark.asyncio
async def test_restart_agent_and_recover_full_flow(recovery_db):
    """Tests restart_agent_and_recover produces a valid recovered run with fresh pack."""
    new_run, recovery_data = await restart_agent_and_recover(
        db=recovery_db,
        project_id="test-rec-proj",
        agent_id="nova",
    )

    assert new_run.id.startswith("run_nova_")
    assert new_run.status == "idle"
    assert "recovery_summary" in recovery_data
    assert "resume_plan" in recovery_data
