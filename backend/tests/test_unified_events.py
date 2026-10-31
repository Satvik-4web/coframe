import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.db.models import Base, ProjectModel, EventModel
from backend.app.events.logger import log_event


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    project = ProjectModel(
        id="test-proj-events",
        name="Event Test Workspace",
        context_version=1,
        artifact_version=1,
    )
    session.add(project)
    session.commit()

    yield session
    session.close()


def test_unified_event_envelope_structure(db_session):
    event = log_event(
        db=db_session,
        project_id="test-proj-events",
        actor_type="agent",
        actor_id="nova",
        event_type="proposal.created",
        payload={"summary": "Audience alignment proposal", "sections": ["hero"]},
        context_version=2,
        artifact_version=1,
        correlation_id="corr-12345",
        causation_id="cause-67890",
        auto_commit=True,
    )

    envelope = event.to_envelope()

    assert envelope["event_id"] == event.id
    assert envelope["workspace_id"] == "test-proj-events"
    assert envelope["event_type"] == "proposal.created"
    assert envelope["actor_type"] == "agent"
    assert envelope["actor_id"] == "nova"
    assert envelope["context_version"] == 2
    assert envelope["artifact_version"] == 1
    assert envelope["correlation_id"] == "corr-12345"
    assert envelope["causation_id"] == "cause-67890"
    assert isinstance(envelope["timestamp"], int)
    assert envelope["sequence_no"] == 1


def test_monotonic_sequence_numbers(db_session):
    e1 = log_event(
        db=db_session,
        project_id="test-proj-events",
        actor_type="human",
        actor_id="alex",
        event_type="requirement.updated",
        payload={"key": "REQ_AUDIENCE"},
        auto_commit=True,
    )

    e2 = log_event(
        db=db_session,
        project_id="test-proj-events",
        actor_type="agent",
        actor_id="nova",
        event_type="agent.started",
        payload={"task": "Market positioning analysis"},
        auto_commit=True,
    )

    e3 = log_event(
        db=db_session,
        project_id="test-proj-events",
        actor_type="agent",
        actor_id="pixel",
        event_type="delegation.created",
        payload={"target": "pixel"},
        auto_commit=True,
    )

    assert e1.sequence_no == 1
    assert e2.sequence_no == 2
    assert e3.sequence_no == 3


def test_correlation_and_causation_tracking(db_session):
    root_corr_id = "wf_delegation_001"

    # Step 1: Human changes requirement
    req_event = log_event(
        db=db_session,
        project_id="test-proj-events",
        actor_type="human",
        actor_id="alex",
        event_type="requirement.updated",
        payload={"key": "REQ_PRICING"},
        correlation_id=root_corr_id,
        auto_commit=True,
    )

    # Step 2: Agent delegates task caused by requirement update
    del_event = log_event(
        db=db_session,
        project_id="test-proj-events",
        actor_type="agent",
        actor_id="nova",
        event_type="delegation.created",
        payload={"target": "pixel", "task": "Update pricing tiers"},
        correlation_id=root_corr_id,
        causation_id=req_event.id,
        auto_commit=True,
    )

    # Step 3: Target agent produces proposal
    prop_event = log_event(
        db=db_session,
        project_id="test-proj-events",
        actor_type="agent",
        actor_id="pixel",
        event_type="proposal.created",
        payload={"proposal_id": "prop_tier_1"},
        correlation_id=root_corr_id,
        causation_id=del_event.id,
        auto_commit=True,
    )

    correlated_events = (
        db_session.query(EventModel)
        .filter(EventModel.correlation_id == root_corr_id)
        .order_by(EventModel.sequence_no.asc())
        .all()
    )

    assert len(correlated_events) == 3
    assert correlated_events[0].id == req_event.id
    assert correlated_events[1].causation_id == req_event.id
    assert correlated_events[2].causation_id == del_event.id
