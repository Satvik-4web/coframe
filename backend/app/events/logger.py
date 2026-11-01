import uuid
import datetime
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.app.db.models import EventModel, ProjectModel, utcnow_str
from backend.app.websocket.manager import ws_manager

# Canonical event type mapping for backward and forward compatibility
EVENT_TYPE_MAPPING = {
    "HUMAN_REQUIREMENT_EDITED": "requirement.updated",
    "AGENT_STARTED": "agent.started",
    "AGENT_STATUS_CHANGED": "agent.status_changed",
    "AGENT_COMPLETED": "agent.completed",
    "AGENT_FAILED": "agent.failed",
    "PROPOSAL_CREATED": "proposal.created",
    "PROPOSAL_MARKED_STALE": "proposal.stale",
    "PROPOSAL_MARKED_CONFLICT": "proposal.conflicted",
    "PROPOSAL_RECONCILED": "proposal.reconciled",
    "PROPOSAL_APPROVED": "proposal.approved",
    "PROPOSAL_REJECTED": "proposal.rejected",
    "PROPOSAL_REDIRECTED": "proposal.redirected",
    "ARTIFACT_UPDATED": "artifact.updated",
    "CONTEXT_RECOVERED": "context.recovered",
    "APPROVAL_REQUESTED": "approval.requested",
    "APPROVAL_RESOLVED": "approval.resolved",
    "DELEGATION_CREATED": "delegation.created",
    "DELEGATION_COMPLETED": "delegation.completed",
}




def serialize_event(event: EventModel) -> Dict[str, Any]:
    return {
        "id": event.id,
        "sequence_no": event.sequence_no,
        "project_id": event.project_id,
        "actor_type": event.actor_type,
        "actor_id": event.actor_id,
        "event_type": event.event_type,
        "context_version": event.context_version,
        "artifact_version": event.artifact_version,
        "payload": event.payload,
        "created_at": event.created_at,
    }


async def broadcast_event(project_id: str, event: EventModel):
    """Broadcasts a persisted event to connected project clients."""
    await ws_manager.broadcast(project_id, {
        "type": "EVENT_EMITTED",
        "event": serialize_event(event),
    })

def log_event(
    db: Session,
    project_id: str,
    actor_type: str,
    actor_id: str,
    event_type: str,
    payload: Dict[str, Any],
    context_version: Optional[int] = None,
    artifact_version: Optional[int] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    correlation_id: Optional[str] = None,
    causation_id: Optional[str] = None,
    timestamp: Optional[int] = None,
    workspace_id: Optional[str] = None,
    auto_commit: bool = True,
) -> EventModel:
    """
    Appends an immutable typed event to the project's event history with monotonic sequence_no
    and consistent correlation/causation tracking.
    """
    # Normalize event type if standard alias exists
    canonical_type = EVENT_TYPE_MAPPING.get(event_type, event_type)

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

    # Infer entity type and entity id if missing
    if not entity_type or not entity_id:
        if "proposal_id" in payload:
            entity_type = entity_type or "proposal"
            entity_id = entity_id or str(payload["proposal_id"])
        elif "requirement_key" in payload:
            entity_type = entity_type or "requirement"
            entity_id = entity_id or str(payload["requirement_key"])
        elif "section_key" in payload:
            entity_type = entity_type or "artifact_section"
            entity_id = entity_id or str(payload["section_key"])
        elif "delegation_id" in payload:
            entity_type = entity_type or "delegation"
            entity_id = entity_id or str(payload["delegation_id"])
        elif "approval_id" in payload:
            entity_type = entity_type or "approval"
            entity_id = entity_id or str(payload["approval_id"])
        elif "agent_id" in payload:
            entity_type = entity_type or "agent"
            entity_id = entity_id or str(payload["agent_id"])

    # Inherit correlation / causation from payload if present
    if not correlation_id and "correlation_id" in payload:
        correlation_id = str(payload["correlation_id"])
    if not causation_id and "causation_id" in payload:
        causation_id = str(payload["causation_id"])

    # Fallback timestamp in ms
    if timestamp is None:
        timestamp = int(datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000)

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
        workspace_id=workspace_id or project_id,
        actor_type=actor_type,
        actor_id=actor_id,
        event_type=canonical_type,
        entity_type=entity_type,
        entity_id=entity_id,
        context_version=context_version,
        artifact_version=artifact_version,
        payload=payload,
        correlation_id=correlation_id,
        causation_id=causation_id,
        timestamp=timestamp,
        created_at=utcnow_str(),
    )
    db.add(event)
    if auto_commit:
        db.commit()
        db.refresh(event)
    else:
        db.flush()

    return event
