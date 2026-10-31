from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from backend.app.db.database import get_db
from backend.app.db.seed import reset_demo_database, DEMO_PROJECT_ID
from backend.app.db.models import (
    ProjectModel,
    ProjectMemberModel,
    RequirementModel,
    ArtifactSectionModel,
    ProposalModel,
    AgentRunModel,
    EventModel,
)
from backend.app.observer_summary.generator import generate_observer_summary
from backend.app.websocket.manager import ws_manager

router = APIRouter(tags=["demo"])


class JoinRequest(BaseModel):
    identity_key: str  # "alex" | "maya"


@router.post("/demo/reset")
async def reset_demo(db: Session = Depends(get_db)):
    """Wipes and resets the project to the exact baseline defined in the specification."""
    project = reset_demo_database(db, project_id=DEMO_PROJECT_ID)
    summary = await generate_observer_summary(db, DEMO_PROJECT_ID)
    await ws_manager.broadcast(DEMO_PROJECT_ID, {"type": "STATE_REFRESHED", "reason": "DEMO_RESET"})
    return {
        "status": "success",
        "message": "Demo project reset to deterministic baseline.",
        "project_id": project.id,
        "context_version": project.context_version,
        "artifact_version": project.artifact_version,
        "summary": summary.model_dump(),
    }


@router.post("/projects/{project_id}/join")
async def join_project(project_id: str, req: JoinRequest, db: Session = Depends(get_db)):
    """Validate and join as one of the two demo identities."""
    if req.identity_key not in ("alex", "maya"):
        raise HTTPException(status_code=400, detail="Invalid identity. Demo allows only 'alex' or 'maya'.")

    member = (
        db.query(ProjectMemberModel)
        .filter(
            ProjectMemberModel.project_id == project_id,
            ProjectMemberModel.identity_key == req.identity_key,
        )
        .first()
    )
    if not member:
        raise HTTPException(status_code=404, detail="Member identity not found in project.")

    return {
        "identity_key": member.identity_key,
        "display_name": member.display_name,
        "role": member.role,
        "member_type": member.member_type,
    }


@router.get("/projects/{project_id}/state")
async def get_project_state(project_id: str, db: Session = Depends(get_db)):
    """Returns the full aggregated workspace state for initial load or full sync."""
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        # Auto-seed if not exists
        project = reset_demo_database(db, project_id=project_id)

    members = db.query(ProjectMemberModel).filter(ProjectMemberModel.project_id == project_id).all()
    requirements = db.query(RequirementModel).filter(RequirementModel.project_id == project_id).all()
    sections = db.query(ArtifactSectionModel).filter(ArtifactSectionModel.project_id == project_id).all()
    proposals = (
        db.query(ProposalModel)
        .filter(ProposalModel.project_id == project_id)
        .order_by(ProposalModel.created_at.desc())
        .all()
    )
    agent_runs = (
        db.query(AgentRunModel)
        .filter(AgentRunModel.project_id == project_id)
        .order_by(AgentRunModel.started_at.desc())
        .all()
    )
    events = (
        db.query(EventModel)
        .filter(EventModel.project_id == project_id)
        .order_by(EventModel.sequence_no.desc())
        .limit(20)
        .all()
    )
    summary = await generate_observer_summary(db, project_id)

    return {
        "project": {
            "id": project.id,
            "name": project.name,
            "context_version": project.context_version,
            "artifact_version": project.artifact_version,
            "created_at": project.created_at,
            "updated_at": project.updated_at,
        },
        "members": [
            {"identity_key": m.identity_key, "display_name": m.display_name, "role": m.role}
            for m in members
        ],
        "requirements": [
            {
                "id": r.id,
                "requirement_key": r.requirement_key,
                "title": r.title,
                "value": r.value,
                "version": r.version,
                "updated_by": r.updated_by,
                "updated_at": r.updated_at,
            }
            for r in requirements
        ],
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
        "proposals": [
            {
                "proposal_id": p.id,
                "agent_id": p.agent_id,
                "run_id": p.run_id,
                "supersedes_proposal_id": p.supersedes_proposal_id,
                "summary": p.summary,
                "reasoning": p.reasoning,
                "affected_requirements": p.affected_requirements,
                "target_sections": p.target_sections,
                "changes": p.changes,
                "base_context_version": p.base_context_version,
                "base_artifact_version": p.base_artifact_version,
                "base_section_versions": p.base_section_versions,
                "requires_decision": p.requires_decision,
                "assigned_decider_id": p.assigned_decider_id,
                "status": p.status,
                "stale_reason": p.stale_reason,
                "conflict_reason": p.conflict_reason,
                "source": p.source,
                "is_simulated": p.is_simulated,
                "created_at": p.created_at,
                "updated_at": p.updated_at,
            }
            for p in proposals
        ],
        "agent_runs": [
            {
                "id": r.id,
                "agent_id": r.agent_id,
                "status": r.status,
                "task_description": r.task_description,
                "base_context_version": r.base_context_version,
                "base_artifact_version": r.base_artifact_version,
                "source": r.source,
                "started_at": r.started_at,
                "completed_at": r.completed_at,
            }
            for r in agent_runs
        ],
        "events": [
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
        ],
        "observer_summary": summary.model_dump(),
        "online_members": list(ws_manager.active_presence.get(project_id, set())),
    }
