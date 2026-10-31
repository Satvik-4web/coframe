from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from backend.app.db.database import get_db
from backend.app.db.models import ProjectModel, RequirementModel, utcnow_str
from backend.app.events.logger import log_event
from backend.app.proposals.staleness import evaluate_selective_staleness
from backend.app.websocket.manager import ws_manager

router = APIRouter(tags=["requirements"])


class RequirementUpdateRequest(BaseModel):
    value: Any
    editor_id: str = "alex"


@router.get("/projects/{project_id}/requirements")
async def list_requirements(project_id: str, db: Session = Depends(get_db)):
    reqs = db.query(RequirementModel).filter(RequirementModel.project_id == project_id).all()
    return [
        {
            "id": r.id,
            "requirement_key": r.requirement_key,
            "title": r.title,
            "value": r.value,
            "version": r.version,
            "updated_by": r.updated_by,
            "updated_at": r.updated_at,
        }
        for r in reqs
    ]


@router.patch("/projects/{project_id}/requirements/{requirement_key}")
async def update_requirement(
    project_id: str,
    requirement_key: str,
    body: RequirementUpdateRequest,
    db: Session = Depends(get_db),
):
    """
    Step 3: Human edits a requirement mid-flight.
    Increments requirement version, increments project context_version,
    appends event, and executes selective staleness check on pending proposals.
    """
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).with_for_update(nowait=False).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    req = (
        db.query(RequirementModel)
        .filter(
            RequirementModel.project_id == project_id,
            RequirementModel.requirement_key == requirement_key,
        )
        .with_for_update(nowait=False)
        .first()
    )
    if not req:
        raise HTTPException(status_code=404, detail=f"Requirement '{requirement_key}' not found")

    old_val = str(req.value)
    new_val = str(body.value)

    # 1. Update requirement
    req.value = body.value
    req.version += 1
    req.updated_by = body.editor_id
    req.updated_at = utcnow_str()

    # 2. Increment project context_version
    project.context_version += 1
    project.updated_at = utcnow_str()

    # 3. Log event
    log_event(
        db=db,
        project_id=project_id,
        actor_type="human",
        actor_id=body.editor_id,
        event_type="HUMAN_REQUIREMENT_EDITED",
        context_version=project.context_version,
        artifact_version=project.artifact_version,
        payload={
            "requirement_key": requirement_key,
            "old_value": old_val,
            "new_value": new_val,
            "editor_id": body.editor_id,
            "new_context_version": project.context_version,
        },
    )
    db.commit()

    # 4. Trigger selective staleness
    staled = evaluate_selective_staleness(
        db=db,
        project_id=project_id,
        changed_requirement_keys=[requirement_key],
        old_value_summary=old_val,
        new_value_summary=new_val,
    )

    # 5. Broadcast to connected tabs
    await ws_manager.broadcast(project_id, {
        "type": "REQUIREMENT_UPDATED",
        "requirement_key": requirement_key,
        "new_value": new_val,
        "context_version": project.context_version,
        "staled_proposals_count": len(staled),
    })

    return {
        "status": "success",
        "requirement_key": requirement_key,
        "version": req.version,
        "context_version": project.context_version,
        "staled_proposals": [p.id for p in staled],
    }
