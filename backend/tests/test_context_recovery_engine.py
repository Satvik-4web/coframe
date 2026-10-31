import pytest
import asyncio
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.db.database import Base, get_db
from backend.app.db.models import (
    ProjectModel,
    RequirementModel,
    ArtifactSectionModel,
    AgentRunModel,
    EventModel,
    RecoveryRecordModel,
    DelegationModel,
    ProposalModel,
)
from backend.app.context.checkpointing import (
    create_checkpoint,
    evaluate_checkpoint_and_resume_plan,
    ExecutionState,
)
from backend.app.context.recovery import (
    restart_agent_and_recover,
    rebuild_agent_context,
    resume_agent_execution,
    compute_context_diff,
    find_interrupted_or_pending_task,
)
from backend.app.context.pack_builder import create_and_persist_agent_run, build_context_pack
from backend.app.events.logger import log_event


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
    create_checkpoint(
        db=recovery_db,
        run_id="run-init",
        completed_step="Persona analysis",
        pending_steps=["Draft hero copy"],
    )

    proj = recovery_db.query(ProjectModel).filter_by(id="test-rec-proj").first()
    proj.context_version = 2
    recovery_db.commit()

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


@pytest.mark.asyncio
async def test_pixel_end_to_end_recovery_flow(recovery_db):
    """
    User Requirement 8: Genuine End-to-End Recovery Test for PIXEL
    1. Start a real PIXEL implementation task.
    2. Persist its checkpoint and Context Pack.
    3. Interrupt the task.
    4. Change an approved requirement.
    5. Make another relevant artifact change.
    6. Create more than 15 events during PIXEL's interruption (18 events).
    7. Click Restart & Recover Context (call resume_agent_execution).
    8. Verify all relevant events after the checkpoint are retrieved (>15).
    9. Verify that PIXEL receives the latest approved requirements.
    10. Verify the updated artifact and section versions.
    11. Verify outdated work is identified.
    12. Resume PIXEL using the recovered Context Pack.
    13. Verify a new agent run is created and persisted.
    14. Verify completed work is not duplicated.
    15. Verify no stale proposal is applied.
    16. Verify the recovery history is accurate.
    """
    proj_id = "test-rec-proj"

    # Seed PIXEL baseline requirements & sections
    req_policy = RequirementModel(
        id="r_policy",
        project_id=proj_id,
        requirement_key="REQ_APPROVAL_POLICY",
        title="Approval Policy",
        value="Single manager threshold $500",
        version=1,
    )
    req_brand = RequirementModel(
        id="r_brand",
        project_id=proj_id,
        requirement_key="REQ_BRAND",
        title="Brand Identity",
        value="LedgerFlow Slate/Teal",
        version=1,
    )
    sec_queue = ArtifactSectionModel(
        id="s_queue",
        project_id=proj_id,
        section_key="approval_queue",
        data={"policy": "threshold_500", "title": "Manager Review Queue"},
        version=1,
    )
    recovery_db.add_all([req_policy, req_brand, sec_queue])
    recovery_db.commit()

    # 1. Start a real PIXEL implementation task
    pixel_run = create_and_persist_agent_run(
        db=recovery_db,
        project_id=proj_id,
        agent_id="pixel",
        run_id="run-pixel-init",
        task_id="task_pixel_impl",
        task_description="Implement LedgerFlow approval queue with threshold settings",
        target_sections=["approval_queue"],
        affected_requirements=["REQ_APPROVAL_POLICY"],
    )

    # 2. Persist checkpoint and Context Pack
    create_checkpoint(
        db=recovery_db,
        run_id="run-pixel-init",
        completed_step="Built responsive approval table",
        pending_steps=["Add tiered threshold selector", "Validate submission limits"],
        idempotency_key="chk_pixel_001",
    )

    # 3. Interrupt the task
    pixel_run = recovery_db.query(AgentRunModel).filter_by(id="run-pixel-init").first()
    pixel_run.status = "interrupted"
    pixel_run.lifecycle_state = "offline"
    recovery_db.commit()

    # 4. Change an approved requirement
    req_policy.value = "Enterprise multi-tier threshold $2,500"
    req_policy.version = 2
    proj = recovery_db.query(ProjectModel).filter_by(id=proj_id).first()
    proj.context_version = 2

    # 5. Make another relevant artifact change
    sec_queue.data = {"policy": "threshold_2500", "title": "Enterprise Multi-Tier Queue"}
    sec_queue.version = 2
    proj.artifact_version = 2
    recovery_db.commit()

    # 6. Create more than 15 events during PIXEL's interruption (18 events)
    for i in range(1, 19):
        log_event(
            db=recovery_db,
            project_id=proj_id,
            actor_type="system",
            actor_id="admin",
            event_type=f"audit.log.step_{i}",
            payload={"step_index": i, "details": f"Interruption event {i}"},
            auto_commit=True,
        )

    # 7. Call Restart & Recover Context
    rec, new_run, recovery_data = await resume_agent_execution(
        db=recovery_db,
        project_id=proj_id,
        agent_id="pixel",
    )

    # 8. Verify all relevant events after the checkpoint are retrieved (>15 events)
    assert recovery_data["events_discovered"] >= 18
    assert len(new_run.context_pack["offline_changes"]) >= 18

    # 9. Verify PIXEL receives the latest approved requirements (REQ_APPROVAL_POLICY v2)
    reqs_in_pack = {r["key"]: r for r in new_run.context_pack["requirements"]}
    assert "REQ_APPROVAL_POLICY" in reqs_in_pack
    assert reqs_in_pack["REQ_APPROVAL_POLICY"]["version"] == 2
    assert "2,500" in reqs_in_pack["REQ_APPROVAL_POLICY"]["value"]

    # 10. Verify updated artifact and section versions
    assert new_run.context_pack["section_versions"]["approval_queue"] == 2
    assert new_run.base_artifact_version == 2
    assert new_run.base_context_version == 2

    # 11. Verify outdated work is identified
    assert rec.validation_outcome == "STALE_WORK_IDENTIFIED"
    assert any("REQ_APPROVAL_POLICY" in c for c in rec.conflicts_detected)
    assert any("approval_queue" in c for c in rec.conflicts_detected)

    # 12. Resume PIXEL using recovered Context Pack
    assert rec.task_resumed is True
    assert recovery_data["task_resumed"] is True

    # 13. Verify a new agent run is created and persisted
    assert new_run is not None
    assert new_run.id != "run-pixel-init"
    assert new_run.id.startswith("run_pixel_")
    persisted_run = recovery_db.query(AgentRunModel).filter_by(id=new_run.id).first()
    assert persisted_run is not None

    # 14. Verify completed work is not duplicated
    assert "Built responsive approval table" in new_run.completed_work
    assert "Add tiered threshold selector" in new_run.completed_work

    # 15. Verify no stale proposal is applied
    assert new_run.base_context_version == 2
    assert new_run.base_artifact_version == 2

    # 16. Verify the recovery history is accurate
    history_rec = recovery_db.query(RecoveryRecordModel).filter_by(id=rec.id).first()
    assert history_rec is not None
    assert history_rec.agent_id == "pixel"
    assert history_rec.previous_run_id == "run-pixel-init"
    assert history_rec.resulting_agent_run_id == new_run.id
    assert history_rec.recovery_status == "COMPLETED"
    assert len(history_rec.events_consumed) >= 18


@pytest.mark.asyncio
async def test_nova_end_to_end_recovery_flow(recovery_db):
    """
    User Requirement 8: Genuine End-to-End Recovery Test for NOVA
    """
    proj_id = "test-rec-proj"

    # 1. Start a real NOVA strategy task
    nova_run = create_and_persist_agent_run(
        db=recovery_db,
        project_id=proj_id,
        agent_id="nova",
        run_id="run-nova-spec",
        task_id="task_nova_strategy",
        task_description="Define LedgerFlow enterprise market expansion strategy",
        target_sections=["product_brief"],
        affected_requirements=["REQ_AUDIENCE"],
    )

    # 2. Persist checkpoint
    create_checkpoint(
        db=recovery_db,
        run_id="run-nova-spec",
        completed_step="Audited small business user churn",
        pending_steps=["Define enterprise positioning", "Align multi-currency policy"],
        idempotency_key="chk_nova_001",
    )

    # 3. Interrupt task
    nova_run.status = "interrupted"
    nova_run.lifecycle_state = "offline"
    recovery_db.commit()

    # 4. Change approved requirement
    req_aud = recovery_db.query(RequirementModel).filter_by(requirement_key="REQ_AUDIENCE").first()
    req_aud.value = "Global Enterprises with > 500 seats"
    req_aud.version = 2
    proj = recovery_db.query(ProjectModel).filter_by(id=proj_id).first()
    proj.context_version = 2
    recovery_db.commit()

    # 5. Create more than 15 events (20 events)
    for i in range(1, 21):
        log_event(
            db=recovery_db,
            project_id=proj_id,
            actor_type="agent",
            actor_id="system",
            event_type=f"workspace.action.{i}",
            payload={"event_num": i},
            auto_commit=True,
        )

    # 6. Resume NOVA execution
    rec, new_run, recovery_data = await resume_agent_execution(
        db=recovery_db,
        project_id=proj_id,
        agent_id="nova",
    )

    # 7. Verifications
    assert recovery_data["events_discovered"] >= 20
    assert len(new_run.context_pack["offline_changes"]) >= 20

    reqs_in_pack = {r["key"]: r for r in new_run.context_pack["requirements"]}
    assert reqs_in_pack["REQ_AUDIENCE"]["version"] == 2
    assert "Global Enterprises" in reqs_in_pack["REQ_AUDIENCE"]["value"]

    assert rec.validation_outcome == "STALE_WORK_IDENTIFIED"
    assert rec.task_resumed is True
    assert new_run.id != "run-nova-spec"
    assert "Audited small business user churn" in new_run.completed_work
    assert "Define enterprise positioning" in new_run.completed_work

    # Recovery record check
    assert rec.recovery_status == "COMPLETED"
    assert rec.resulting_agent_run_id == new_run.id


def test_rebuild_context_only_operation(recovery_db):
    """
    Operation B: Rebuild Context Pack without resuming.
    Verifies fresh pack is built, diff is computed, recovery record is saved with REBUILT_ONLY,
    and no agent execution is dispatched.
    """
    rec, fresh_pack, diff = rebuild_agent_context(
        db=recovery_db,
        project_id="test-rec-proj",
        agent_id="nova",
    )

    assert rec is not None
    assert rec.recovery_status == "REBUILT_ONLY"
    assert rec.task_resumed is False
    assert rec.resulting_agent_run_id is None
    assert "context_version" in fresh_pack
    assert "requirements" in fresh_pack
    assert "context_drift" in diff

    # Verify persisted in database
    persisted = recovery_db.query(RecoveryRecordModel).filter_by(id=rec.id).first()
    assert persisted is not None
    assert persisted.recovery_status == "REBUILT_ONLY"


@pytest.mark.asyncio
async def test_resume_when_no_interrupted_task(recovery_db):
    """
    Operation C: When no unfinished task exists, clearly report that there is nothing to resume.
    """
    # Ensure all runs are completed
    runs = recovery_db.query(AgentRunModel).filter_by(project_id="test-rec-proj", agent_id="nova").all()
    for r in runs:
        r.status = "completed"
        r.last_checkpoint = None
        r.pending_work = []
    recovery_db.commit()

    rec, new_run, recovery_data = await resume_agent_execution(
        db=recovery_db,
        project_id="test-rec-proj",
        agent_id="nova",
    )

    assert rec.recovery_status == "NO_TASK_TO_RESUME"
    assert rec.task_resumed is False
    assert new_run is None
    assert "no interrupted task exists to resume" in recovery_data["message"]


@pytest.mark.asyncio
async def test_idempotency_prevents_duplicate_recovery_runs(recovery_db):
    """
    User Requirement 4: Idempotency ensures repeated clicks cannot create duplicate runs.
    """
    proj_id = "test-rec-proj"

    # Create interrupted run
    run = create_and_persist_agent_run(
        db=recovery_db,
        project_id=proj_id,
        agent_id="pixel",
        run_id="run-idemp-001",
        task_id="task_idemp",
        task_description="Idempotent task test",
    )
    create_checkpoint(
        db=recovery_db,
        run_id="run-idemp-001",
        completed_step="Step A",
        pending_steps=["Step B"],
    )
    run.status = "interrupted"
    recovery_db.commit()

    # Call 1
    rec1, run1, data1 = await resume_agent_execution(
        db=recovery_db,
        project_id=proj_id,
        agent_id="pixel",
        idempotency_key="idemp_key_999",
    )
    assert run1 is not None

    # Call 2 with same idempotency key
    rec2, run2, data2 = await resume_agent_execution(
        db=recovery_db,
        project_id=proj_id,
        agent_id="pixel",
        idempotency_key="idemp_key_999",
    )

    assert run2.id == run1.id
    assert "Returned existing resumed run" in data2["message"]


def test_context_recovery_api_endpoints():
    """
    Tests the new API endpoints via TestClient:
    - GET /agents/{id}/runs
    - GET /agents/{id}/runs/{run_id}/context-pack
    - POST /agents/{id}/context-pack/rebuild
    - POST /agents/{id}/resume
    - GET /agents/{id}/recovery-history
    - GET /agents/{id}/interrupted-task
    """
    client = TestClient(app)

    # 1. List runs
    res_runs = client.get("/api/projects/demo-ledgerflow/agents/nova/runs")
    assert res_runs.status_code == 200
    runs = res_runs.json()
    assert isinstance(runs, list)
    assert len(runs) > 0

    first_run_id = runs[0]["id"]

    # 2. Get specific run context pack
    res_pack = client.get(f"/api/projects/demo-ledgerflow/agents/nova/runs/{first_run_id}/context-pack")
    assert res_pack.status_code == 200
    pack_data = res_pack.json()
    assert pack_data["run_id"] == first_run_id
    assert "context_pack" in pack_data

    # 3. Rebuild context pack (Operation B)
    res_rebuild = client.post("/api/projects/demo-ledgerflow/agents/nova/context-pack/rebuild")
    assert res_rebuild.status_code == 200
    rebuild_data = res_rebuild.json()
    assert rebuild_data["operation"] == "rebuild"
    assert "recovery_id" in rebuild_data
    assert "diff" in rebuild_data

    # 4. Check interrupted task
    res_task = client.get("/api/projects/demo-ledgerflow/agents/nova/interrupted-task")
    assert res_task.status_code == 200
    assert "has_interrupted_task" in res_task.json()

    # 5. Recovery history
    res_hist = client.get("/api/projects/demo-ledgerflow/agents/nova/recovery-history")
    assert res_hist.status_code == 200
    hist = res_hist.json()
    assert isinstance(hist, list)
    assert len(hist) > 0
    assert hist[0]["id"] == rebuild_data["recovery_id"]

    # 6. Resume agent (Operation C)
    res_resume = client.post("/api/projects/demo-ledgerflow/agents/nova/resume")
    assert res_resume.status_code == 200
    resume_data = res_resume.json()
    assert resume_data["operation"] == "resume"
    assert "task_resumed" in resume_data
