from typing import Any, Dict, Optional, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from backend.app.db.database import get_db
from backend.app.db.models import (
    ProjectModel,
    RequirementModel,
    RequirementVersionModel,
    utcnow_str,
)
from backend.app.events.logger import log_event
from backend.app.proposals.staleness import evaluate_selective_staleness
from backend.app.websocket.manager import ws_manager

router = APIRouter(tags=["requirements"])

ALLOWED_EDITORS = {"alex", "maya", "admin", "system"}


class RequirementUpdateRequest(BaseModel):
    value: Any
    editor_id: str = "alex"
    expected_version: Optional[int] = None


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
            "status": getattr(r, "status", "approved"),
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
    Enforces identity check, conditional CAS version check,
    increments requirement version, archives previous version,
    increments project context_version, appends event,
    and executes selective staleness check on pending proposals.
    """
    # 1. Trusted identity check
    editor = (body.editor_id or "alex").strip().lower()
    if editor not in ALLOWED_EDITORS:
        raise HTTPException(
            status_code=403,
            detail=f"Unauthorized editor: '{body.editor_id}'. Only verified team members can update requirements.",
        )

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

    # 2. Conditional CAS check
    if body.expected_version is not None and req.version != body.expected_version:
        raise HTTPException(
            status_code=409,
            detail=f"Conflict: Expected requirement version {body.expected_version}, but requirement is at version {req.version}.",
        )

    old_val = str(req.value)
    new_val = str(body.value)
    old_version = req.version

    # 3. Archive previous version in history
    old_ver_record = (
        db.query(RequirementVersionModel)
        .filter(
            RequirementVersionModel.project_id == project_id,
            RequirementVersionModel.requirement_key == requirement_key,
            RequirementVersionModel.version == old_version,
        )
        .first()
    )
    if old_ver_record:
        old_ver_record.status = "outdated"
    else:
        db.add(RequirementVersionModel(
            id=f"{req.id}-v{old_version}",
            project_id=project_id,
            requirement_key=requirement_key,
            title=req.title,
            value=req.value,
            version=old_version,
            status="outdated",
            updated_by=req.updated_by,
            created_at=req.updated_at,
        ))

    # 4. Update requirement
    req.value = body.value
    req.version += 1
    req.updated_by = body.editor_id
    req.updated_at = utcnow_str()
    req.status = "approved"

    # Add new approved version record
    new_ver_record = RequirementVersionModel(
        id=f"{req.id}-v{req.version}",
        project_id=project_id,
        requirement_key=requirement_key,
        title=req.title,
        value=body.value,
        version=req.version,
        status="approved",
        updated_by=body.editor_id,
        created_at=req.updated_at,
    )
    db.add(new_ver_record)

    # 5. Increment project context_version
    project.context_version += 1
    project.updated_at = utcnow_str()

    # 6. Log event
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

    # 7. Trigger selective staleness
    staled = evaluate_selective_staleness(
        db=db,
        project_id=project_id,
        changed_requirement_keys=[requirement_key],
        old_value_summary=old_val,
        new_value_summary=new_val,
    )

    # 8. Broadcast to connected tabs
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


@router.get("/projects/{project_id}/requirements/{requirement_key}/history")
async def get_requirement_history(
    project_id: str,
    requirement_key: str,
    db: Session = Depends(get_db),
):
    """
    Exposes historical versions for a requirement, allowing comparison between
    the current approved version and prior/outdated versions.
    """
    versions = (
        db.query(RequirementVersionModel)
        .filter(
            RequirementVersionModel.project_id == project_id,
            RequirementVersionModel.requirement_key == requirement_key,
        )
        .order_by(RequirementVersionModel.version.desc())
        .all()
    )
    return [
        {
            "id": v.id,
            "requirement_key": v.requirement_key,
            "title": v.title,
            "value": v.value,
            "version": v.version,
            "status": v.status,
            "updated_by": v.updated_by,
            "created_at": v.created_at,
        }
        for v in versions
    ]
