from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from backend.app.db.database import get_db
from backend.app.db.models import EventModel
from backend.app.events.logger import serialize_event

router = APIRouter(tags=["events"])


@router.get("/projects/{project_id}/events")
async def list_events(
    project_id: str,
    limit: int = 50,
    since_sequence_no: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """
    Returns project events.
    If since_sequence_no is provided, returns events with sequence_no > since_sequence_no
    in ascending order (ideal for client reconnection and replay).
    Otherwise returns the latest events in chronological order up to limit.
    """
    query = db.query(EventModel).filter(EventModel.project_id == project_id)
    if since_sequence_no is not None:
        events = (
            query.filter(EventModel.sequence_no > since_sequence_no)
            .order_by(EventModel.sequence_no.asc())
            .limit(limit)
            .all()
        )
        return [serialize_event(e) for e in events]
    else:
        events = (
            query.order_by(EventModel.sequence_no.desc())
            .limit(limit)
            .all()
        )
        return [serialize_event(e) for e in reversed(events)]
