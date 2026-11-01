from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.app.db.database import get_db
from backend.app.db.models import ProjectModel, ArtifactSectionModel
from backend.app.schemas.artifact import ManualSectionEditRequest
from backend.app.proposals.apply import apply_manual_section_edit
from backend.app.websocket.manager import ws_manager
from backend.app.api.auth import get_current_identity, verify_governance_authorization

router = APIRouter(tags=["artifact"])


class SectionActivityRequest(BaseModel):
    participant_id: str
    activity: str  # "viewing" | "editing" | "idle"


@router.get("/projects/{project_id}/artifact")
async def get_artifact(project_id: str, db: Session = Depends(get_db)):
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    sections = db.query(ArtifactSectionModel).filter(ArtifactSectionModel.project_id == project_id).all()

    # Query live active section collaborator indicators
    presence = ws_manager.get_presence_payload(project_id)
    section_collaborators = {}
    for part_id, p_info in presence.get("participants", {}).items():
        sec = p_info.get("section_key")
        if sec and p_info.get("status") in ("viewing", "editing"):
            section_collaborators.setdefault(sec, []).append({
                "participant_id": part_id,
                "status": p_info.get("status"),
                "role": p_info.get("role"),
            })

    return {
        "project_id": project.id,
        "artifact_version": project.artifact_version,
        "sections": {
            s.section_key: {
                "section_key": s.section_key,
                "data": s.data,
                "version": s.version,
                "updated_by": s.updated_by,
                "updated_at": s.updated_at,
                "active_collaborators": section_collaborators.get(s.section_key, []),
            }
            for s in sections
        },
    }


@router.patch("/projects/{project_id}/artifact/sections/{section_key}")
async def edit_artifact_section(
    project_id: str,
    section_key: str,
    body: ManualSectionEditRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Step 4 Case B: Maya manually edits a prototype section.
    Uses compare-and-swap check with expected_version.
    Increments section version, global artifact version, and triggers conflict detection.
    """
    caller = get_current_identity(request, db)
    verified_editor = verify_governance_authorization(
        caller=caller,
        claimed_identity=body.editor_id,
        action_type="artifact_edit",
        db=db,
        project_id=project_id,
    )

    try:
        updated_sec = apply_manual_section_edit(
            db=db,
            project_id=project_id,
            section_key=section_key,
            new_data=body.data,
            expected_version=body.expected_version,
            editor_id=verified_editor,
        )
    except ValueError as e:
        curr_sec = (
            db.query(ArtifactSectionModel)
            .filter(
                ArtifactSectionModel.project_id == project_id,
                ArtifactSectionModel.section_key == section_key,
            )
            .first()
        )
        conflict_payload = {
            "error": "Section edit conflict",
            "message": str(e),
            "section_key": section_key,
            "expected_version": body.expected_version,
            "current_version": curr_sec.version if curr_sec else None,
            "updated_by": curr_sec.updated_by if curr_sec else None,
            "updated_at": curr_sec.updated_at if curr_sec else None,
            "current_data": curr_sec.data if curr_sec else {},
        }
        raise HTTPException(status_code=409, detail=conflict_payload)

    # Mark editor back to online/idle on completion of edit
    await ws_manager.update_participant_status(
        project_id=project_id,
        identity_key=verified_editor,
        status="online",
        section_key=None,
    )

    await ws_manager.broadcast(project_id, {
        "type": "SECTION_EDITED",
        "section_key": section_key,
        "new_version": updated_sec.version,
        "editor_id": verified_editor,
    })

    return {
        "status": "success",
        "section_key": updated_sec.section_key,
        "version": updated_sec.version,
        "data": updated_sec.data,
    }


@router.post("/projects/{project_id}/artifact/sections/{section_key}/activity")
async def report_section_activity(
    project_id: str,
    section_key: str,
    body: SectionActivityRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Reports a participant viewing, editing, or idling on a specific artifact section."""
    caller = get_current_identity(request, db)
    verified_id = verify_governance_authorization(
        caller=caller,
        claimed_identity=body.participant_id,
        action_type="activity_report",
        db=db,
        project_id=project_id,
    )

    status_map = {
        "viewing": "viewing",
        "editing": "editing",
        "idle": "online",
    }
    new_status = status_map.get(body.activity, "online")
    sec_key = section_key if body.activity in ("viewing", "editing") else None

    await ws_manager.update_participant_status(
        project_id=project_id,
        identity_key=verified_id,
        status=new_status,
        section_key=sec_key,
    )

    await ws_manager.broadcast(project_id, {
        "type": "SECTION_ACTIVITY",
        "section_key": section_key,
        "participant_id": verified_id,
        "activity": body.activity,
    })

    return {
        "status": "success",
        "section_key": section_key,
        "participant_id": verified_id,
        "activity": body.activity,
    }
