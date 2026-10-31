import uuid
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.app.db.models import EventModel, ProjectModel, utcnow_str


def log_event(
    db: Session,
    project_id: str,
    actor_type: str,
    actor_id: str,
    event_type: str,
    payload: Dict[str, Any],
    context_version: Optional[int] = None,
    artifact_version: Optional[int] = None,
    auto_commit: bool = True,
) -> EventModel:
    """
    Appends an immutable event to the project's event history with monotonic sequence_no.
    If auto_commit is False, flushes to the session without committing,
    ensuring atomic participation in an outer transaction.
    """
    # Fetch current versions if not explicitly provided
    if context_version is None or artifact_version is None:
        project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
        if project:
            if context_version is None:
                context_version = project.context_version
            if artifact_version is None:
                artifact_version = project.artifact_version
        else:
            context_version = context_version or 1
            artifact_version = artifact_version or 1

    # Monotonic sequence number per project
    max_seq = (
        db.query(func.max(EventModel.sequence_no))
        .filter(EventModel.project_id == project_id)
        .scalar()
    )
    next_seq = (max_seq or 0) + 1

    event_id = f"evt_{uuid.uuid4().hex[:10]}"
    event = EventModel(
        id=event_id,
        sequence_no=next_seq,
        project_id=project_id,
        actor_type=actor_type,
        actor_id=actor_id,
        event_type=event_type,
        context_version=context_version,
        artifact_version=artifact_version,
        payload=payload,
        created_at=utcnow_str(),
    )
    db.add(event)
    if auto_commit:
        db.commit()
        db.refresh(event)
    else:
        db.flush()

    return event
