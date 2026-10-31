from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from backend.app.db.database import get_db
from backend.app.db.models import EventModel

router = APIRouter(tags=["events"])


@router.get("/projects/{project_id}/events")
async def list_events(project_id: str, limit: int = 50, db: Session = Depends(get_db)):
    events = (
        db.query(EventModel)
        .filter(EventModel.project_id == project_id)
        .order_by(EventModel.sequence_no.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": e.id,
            "sequence_no": e.sequence_no,
            "actor_type": e.actor_type,
            "actor_id": e.actor_id,
            "event_type": e.event_type,
            "context_version": e.context_version,
            "artifact_version": e.artifact_version,
            "payload": e.payload,
            "created_at": e.created_at,
        }
        for e in reversed(events)
    ]
