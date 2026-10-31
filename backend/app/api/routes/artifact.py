from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.db.database import get_db
from backend.app.db.models import ProjectModel, ArtifactSectionModel
from backend.app.schemas.artifact import ManualSectionEditRequest
from backend.app.proposals.apply import apply_manual_section_edit
from backend.app.websocket.manager import ws_manager

router = APIRouter(tags=["artifact"])


@router.get("/projects/{project_id}/artifact")
async def get_artifact(project_id: str, db: Session = Depends(get_db)):
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    sections = db.query(ArtifactSectionModel).filter(ArtifactSectionModel.project_id == project_id).all()
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
            }
            for s in sections
        },
    }


@router.patch("/projects/{project_id}/artifact/sections/{section_key}")
async def edit_artifact_section(
    project_id: str,
    section_key: str,
    body: ManualSectionEditRequest,
    db: Session = Depends(get_db),
):
    """
    Step 4 Case B: Maya manually edits a prototype section.
    Uses compare-and-swap check with expected_version.
    Increments section version, global artifact version, and triggers conflict detection.
    """
    try:
        updated_sec = apply_manual_section_edit(
            db=db,
            project_id=project_id,
            section_key=section_key,
            new_data=body.data,
            expected_version=body.expected_version,
            editor_id=body.editor_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))

    await ws_manager.broadcast(project_id, {
        "type": "SECTION_EDITED",
        "section_key": section_key,
        "new_version": updated_sec.version,
        "editor_id": body.editor_id,
    })

    return {
        "status": "success",
        "section_key": updated_sec.section_key,
        "version": updated_sec.version,
        "data": updated_sec.data,
    }
