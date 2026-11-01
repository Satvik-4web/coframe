import pytest
from starlette.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.main import app
from backend.app.db.database import Base, get_db
from backend.app.db.seed import init_db, DEMO_PROJECT_ID
from backend.app.db.models import (
    ProjectModel,
    PixelBuildSessionModel,
    ProposalModel,
    EventModel,
)
from backend.app.schemas.pixel_builder import (
    PixelComponentType,
    PixelTaskStatus,
    PixelUIComponent,
    PixelBuildTask,
    PixelBuildRequest,
    PixelBuildSessionResponse,
)
from backend.app.agents.pixel_builder import (
    _generate_deterministic_plan,
    _build_props_for_component,
    execute_pixel_live_build,
)


@pytest.fixture
def test_db():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    init_db(target_engine=engine)

    db = TestingSessionLocal()
    proj = ProjectModel(
        id=DEMO_PROJECT_ID,
        name="Demo LedgerFlow",
        context_version=1,
        artifact_version=1,
    )
    db.add(proj)
    db.commit()

    try:
        yield db
    finally:
        db.close()


def test_pixel_builder_schemas():
    """Verify schema structures and enums for live builder."""
    assert PixelComponentType.NAVBAR == "navbar"
    assert PixelComponentType.METRICS_GRID == "metrics_grid"
    assert PixelComponentType.TABLE == "table"
    assert PixelComponentType.FORM == "form"
    assert PixelComponentType.CHART == "chart"
    assert PixelComponentType.CARD == "card"

    comp = PixelUIComponent(
        id="comp_1",
        type=PixelComponentType.CARD,
        title="Test Card",
        props={"key": "val"},
        order=1,
        status=PixelTaskStatus.COMPLETED,
    )
    assert comp.id == "comp_1"
    assert comp.type == PixelComponentType.CARD
    assert comp.status == PixelTaskStatus.COMPLETED

    task = PixelBuildTask(
        id="task_1",
        title="Build Component",
        description="Task desc",
        component_id="comp_1",
        status=PixelTaskStatus.BUILDING,
        logs=["Step 1 started"],
    )
    assert task.status == PixelTaskStatus.BUILDING
    assert len(task.logs) == 1


def test_deterministic_plan_generation():
    """Verify breakdown of instructions into tasks and components."""
    instruction = "Build an enterprise analytics dashboard with real-time spend monitoring and transaction table"
    understanding, tasks, components = _generate_deterministic_plan(instruction)

    assert len(understanding) > 20
    assert len(components) >= 5
    assert len(tasks) == len(components)

    orders = [c["order"] for c in components]
    assert orders == sorted(orders)
    for c in components:
        assert c["status"] == PixelTaskStatus.PENDING.value

    comp_ids = {c["id"] for c in components}
    task_comp_ids = {t["component_id"] for t in tasks}
    assert comp_ids == task_comp_ids


def test_build_props_for_all_component_types():
    """Verify realistic schema props are generated for each supported component."""
    for c_type in PixelComponentType:
        props = _build_props_for_component(
            comp_type=c_type.value,
            comp_title=f"Sample {c_type.value.title()}",
            instruction="Build a spend management ledger",
        )
        assert isinstance(props, dict)
        assert len(props) > 0

    metrics_props = _build_props_for_component(PixelComponentType.METRICS_GRID.value, "KPIs", "fintech")
    assert "metrics" in metrics_props
    assert len(metrics_props["metrics"]) == 4

    table_props = _build_props_for_component(PixelComponentType.TABLE.value, "Ledger", "fintech")
    assert "columns" in table_props
    assert "rows" in table_props
    assert len(table_props["rows"]) >= 3

    form_props = _build_props_for_component(PixelComponentType.FORM.value, "Form", "fintech")
    assert "fields" in form_props
    assert len(form_props["fields"]) >= 3


@pytest.mark.asyncio
async def test_execute_pixel_live_build_lifecycle(test_db):
    """Verify the complete 4-stage live build workflow."""
    instruction = "Create real-time audit queue with transaction breakdown"
    session = await execute_pixel_live_build(
        db=test_db,
        project_id=DEMO_PROJECT_ID,
        instruction=instruction,
        submitter_id="alex",
    )

    assert session.status == "completed"
    assert session.progress_pct == 100
    assert session.completed_at is not None
    assert session.proposal_id is not None

    for comp in session.components:
        assert comp["status"] == PixelTaskStatus.COMPLETED.value
        assert len(comp["props"]) > 0

    for task in session.tasks:
        assert task["status"] == PixelTaskStatus.COMPLETED.value
        assert len(task["logs"]) > 0

    prop = test_db.query(ProposalModel).filter(ProposalModel.id == session.proposal_id).first()
    assert prop is not None
    assert prop.created_by == "pixel"
    assert prop.proposal_type == "live_product_build"
    assert "set_dashboard_metrics" in str(prop.changes)

    events = (
        test_db.query(EventModel)
        .filter(EventModel.project_id == DEMO_PROJECT_ID)
        .all()
    )
    event_types = [e.event_type for e in events]
    assert "PIXEL_BUILD_STARTED" in event_types
    assert "PIXEL_BUILD_COMPLETED" in event_types


def test_pixel_build_api_endpoints(test_db):
    """Test API routes for initiating and querying pixel build sessions."""
    app.dependency_overrides[get_db] = lambda: test_db
    client = TestClient(app)

    try:
        res_empty = client.post(
            f"/api/projects/{DEMO_PROJECT_ID}/pixel/build",
            json={"instruction": "   "},
        )
        assert res_empty.status_code == 400

        res_404 = client.post(
            "/api/projects/nonexistent-project/pixel/build",
            json={"instruction": "Build something"},
        )
        assert res_404.status_code == 404

        session_row = PixelBuildSessionModel(
            id="pbs_test_session_1",
            project_id=DEMO_PROJECT_ID,
            instruction="Build a customer dashboard",
            understanding="Understanding test",
            status="completed",
            progress_pct=100,
            tasks=[],
            components=[],
            created_at="2026-11-01T00:00:00Z",
            updated_at="2026-11-01T00:00:00Z",
        )
        test_db.add(session_row)
        test_db.commit()

        res_latest = client.get(f"/api/projects/{DEMO_PROJECT_ID}/pixel/build/latest")
        assert res_latest.status_code == 200
        latest_data = res_latest.json()
        assert latest_data["id"] == "pbs_test_session_1"
        assert latest_data["instruction"] == "Build a customer dashboard"

        res_by_id = client.get(f"/api/projects/{DEMO_PROJECT_ID}/pixel/build/pbs_test_session_1")
        assert res_by_id.status_code == 200
        assert res_by_id.json()["id"] == "pbs_test_session_1"

        res_missing = client.get(f"/api/projects/{DEMO_PROJECT_ID}/pixel/build/pbs_missing")
        assert res_missing.status_code == 404

    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_pixel_live_build_websocket_events(test_db, monkeypatch):
    """Verify that WebSocket broadcast receives all lifecycle events in real time."""
    from backend.app.websocket.manager import ws_manager

    broadcasted_events = []

    async def mock_broadcast(project_id: str, message: dict):
        broadcasted_events.append(message)

    monkeypatch.setattr(ws_manager, "broadcast", mock_broadcast)

    instruction = "Build interactive employee expense submission form with approval buttons"
    session = await execute_pixel_live_build(
        db=test_db,
        project_id=DEMO_PROJECT_ID,
        instruction=instruction,
        submitter_id="maya",
    )

    event_types = [ev.get("type") for ev in broadcasted_events]
    assert "PIXEL_BUILD_STARTED" in event_types
    assert "PIXEL_TASK_STARTED" in event_types
    assert "PIXEL_COMPONENT_UPDATED" in event_types
    assert "PIXEL_TASK_COMPLETED" in event_types
    assert "PIXEL_BUILD_PROGRESS" in event_types
    assert "PIXEL_BUILD_COMPLETED" in event_types

    comp_types = [c["type"] for c in session.components]
    assert PixelComponentType.FORM.value in comp_types


@pytest.mark.asyncio
async def test_pixel_live_build_error_handling(test_db, monkeypatch):
    """Verify failure path gracefully sets failed status and emits PIXEL_BUILD_FAILED."""
    from backend.app.agents import pixel_builder

    def failing_props(*args, **kwargs):
        raise RuntimeError("Simulated GPU failure in UI synthesis")

    monkeypatch.setattr(pixel_builder, "_build_props_for_component", failing_props)

    broadcasted = []

    async def mock_broadcast(project_id: str, message: dict):
        broadcasted.append(message)

    from backend.app.websocket.manager import ws_manager
    monkeypatch.setattr(ws_manager, "broadcast", mock_broadcast)

    with pytest.raises(RuntimeError):
        await execute_pixel_live_build(
            db=test_db,
            project_id=DEMO_PROJECT_ID,
            instruction="Failing build test",
        )

    failed_session = (
        test_db.query(PixelBuildSessionModel)
        .filter(PixelBuildSessionModel.project_id == DEMO_PROJECT_ID)
        .order_by(PixelBuildSessionModel.created_at.desc())
        .first()
    )
    assert failed_session is not None
    assert failed_session.status == "failed"
    assert "Simulated GPU failure" in failed_session.error_message

    fail_events = [e for e in broadcasted if e.get("type") == "PIXEL_BUILD_FAILED"]
    assert len(fail_events) == 1
    assert fail_events[0]["status"] == "failed"
