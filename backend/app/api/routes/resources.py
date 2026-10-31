from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.db.database import get_db
from backend.app.db.models import SharedResourceModel, ProjectModel, utcnow_str
from backend.app.resources.manager import get_all_workspace_resources
from backend.app.events.logger import log_event
from backend.app.websocket.manager import ws_manager

router = APIRouter(prefix="/projects/{project_id}/resources", tags=["resources"])


class CreateResourceRequest(BaseModel):
    resource_type: str = Field(..., description="Type: file, reference, spec, note")
    title: str = Field(..., description="Resource title")
    description: Optional[str] = Field(None, description="Resource summary")
    creator_id: str = Field("alex", description="Creator identity")
    data: Dict[str, Any] = Field(default_factory=dict, description="Resource contents or metadata")
    visibility: str = Field("workspace", description="workspace or restricted")


@router.get("")
def list_resources(
    project_id: str,
    resource_type: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    Exposes the OpenAgents Phase 3: Shared Creation Resources Shelf.
    Returns unified resources across prototype sections, requirements, proposals, and reference files.
    """
    resources = get_all_workspace_resources(db, project_id)
    if resource_type:
        resources = [r for r in resources if r["resource_type"] == resource_type]

    return {
        "total": len(resources),
        "resources": resources,
    }


@router.post("")
async def create_custom_resource(
    project_id: str,
    body: CreateResourceRequest,
    db: Session = Depends(get_db),
):
    """Allows uploading or linking reference documents and project assets into the shared creation shelf."""
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    res = SharedResourceModel(
        project_id=project_id,
        resource_type=body.resource_type,
        title=body.title,
        description=body.description,
        creator_type="human" if body.creator_id in ["alex", "maya"] else "agent",
        creator_id=body.creator_id,
        data=body.data,
        artifact_version=project.artifact_version,
        visibility=body.visibility,
    )
    db.add(res)
    db.commit()
    db.refresh(res)

    log_event(
        db=db,
        project_id=project_id,
        actor_type=res.creator_type,
        actor_id=res.creator_id,
        event_type="resource.created",
        payload={
            "resource_id": res.id,
            "title": res.title,
            "resource_type": res.resource_type,
        },
        auto_commit=True,
    )

    await ws_manager.broadcast(project_id, {
        "type": "RESOURCE_CREATED",
        "resource_id": res.id,
        "title": res.title,
        "resource_type": res.resource_type,
    })

    return {
        "status": "success",
        "resource_id": res.id,
        "resource": {
            "resource_id": res.id,
            "title": res.title,
            "resource_type": res.resource_type,
            "created_at": res.created_at,
        },
    }
