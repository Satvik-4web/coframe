from typing import Any, Dict, Optional, List
from fastapi import APIRouter, Depends, HTTPException, Request
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
from backend.app.impact.impact_engine import calculate_requirement_impact
from backend.app.websocket.manager import ws_manager
from backend.app.api.auth import get_current_identity, verify_governance_authorization

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
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Step 3: Human edits a requirement mid-flight.
    Enforces identity check, conditional CAS version check,
    increments requirement version, archives previous version,
    increments project context_version, appends event,
    and executes selective staleness check on pending proposals.
    """
    caller = get_current_identity(request, db)
    is_founder_req = requirement_key in ("REQ_AUDIENCE", "REQ_GOAL", "REQ_APPROVAL_POLICY")
    verified_editor = verify_governance_authorization(
        caller=caller,
        claimed_identity=body.editor_id,
        action_type="founder_requirement" if is_founder_req else "requirement_edit",
        db=db,
        project_id=project_id,
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
    req.updated_by = verified_editor
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
        updated_by=verified_editor,
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
        actor_id=verified_editor,
        event_type="HUMAN_REQUIREMENT_EDITED",
        context_version=project.context_version,
        artifact_version=project.artifact_version,
        payload={
            "requirement_key": requirement_key,
            "old_value": old_val,
            "new_value": new_val,
            "editor_id": verified_editor,
            "new_context_version": project.context_version,
        },
    )
    db.commit()

    # 7. Trigger Smart Change Impact Analysis
    impact_result = calculate_requirement_impact(
        db=db,
        project_id=project_id,
        changed_requirement_keys=[requirement_key],
        old_value_summary=old_val,
        new_value_summary=new_val,
    )

    # 8. Independent NOVA AI re-verification on affected proposals
    reverification_results = []
    for prop in impact_result.affected_proposals:
        if prop.agent_id == "pixel":
            try:
                from backend.app.agents.nova import reverify_proposal_with_nova
                rev_res = await reverify_proposal_with_nova(
                    db=db,
                    project_id=project_id,
                    proposal_id=prop.id,
                    changed_requirement_keys=[requirement_key],
                    old_value_summary=old_val,
                    new_value_summary=new_val,
                    impact_findings={
                        "stale_reason": prop.stale_reason,
                        "conflict_reason": prop.conflict_reason,
                        "status": prop.status,
                    },
                )
                reverification_results.append({
                    "proposal_id": prop.id,
                    "review": rev_res.model_dump(),
                })
            except Exception as e:
                import logging
                logging.getLogger(__name__).warning(f"NOVA re-verification failed for proposal {prop.id}: {e}")

    # 9. Broadcast to connected tabs
    await ws_manager.broadcast(project_id, {
        "type": "REQUIREMENT_UPDATED",
        "requirement_key": requirement_key,
        "new_value": new_val,
        "context_version": project.context_version,
        "staled_proposals_count": impact_result.stale_count,
        "reverified_proposals_count": len(reverification_results),
    })

    return {
        "status": "success",
        "requirement_key": requirement_key,
        "version": req.version,
        "context_version": project.context_version,
        "staled_proposals": [p.id for p in impact_result.affected_proposals],
        "reverified_proposals": reverification_results,
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
