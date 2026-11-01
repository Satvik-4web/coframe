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
    DelegationModel,
    ApprovalRequestModel,
    SharedResourceModel,
)
from backend.app.resources.manager import get_all_workspace_resources
from backend.app.observer_summary.generator import generate_observer_summary
from backend.app.proposals.serialization import serialize_proposal_for_api
from backend.app.websocket.manager import ws_manager
from backend.app.api.auth import create_session

router = APIRouter(tags=["demo"])


class JoinRequest(BaseModel):
    identity_key: str  # "alex" | "maya"


@router.post("/demo/reset")
async def reset_demo(db: Session = Depends(get_db)):
    """Wipes and resets the project to the exact clean baseline defined in the specification."""
    project = reset_demo_database(db, project_id=DEMO_PROJECT_ID)
    summary = await generate_observer_summary(db, DEMO_PROJECT_ID)
    await ws_manager.broadcast(DEMO_PROJECT_ID, {"type": "STATE_REFRESHED", "reason": "DEMO_RESET"})
    return {
        "status": "success",
        "message": "Demo project reset to clean baseline (no pending proposals).",
        "project_id": project.id,
        "context_version": project.context_version,
        "artifact_version": project.artifact_version,
        "is_clean_baseline": True,
        "scenario_label": "Clean Baseline",
        "summary": summary.model_dump(),
    }


@router.post("/demo/load-scenario")
async def load_demo_scenario(db: Session = Depends(get_db)):
    """Pre-seeds the demo scenario with NOVA & PIXEL initial proposals."""
    project = reset_demo_database(db, project_id=DEMO_PROJECT_ID)
    import asyncio
    from backend.app.agents.nova import run_nova_initial
    from backend.app.agents.pixel import run_pixel_initial

    await run_nova_initial(db, DEMO_PROJECT_ID)
    await run_pixel_initial(db, DEMO_PROJECT_ID)
    summary = await generate_observer_summary(db, DEMO_PROJECT_ID)
    await ws_manager.broadcast(DEMO_PROJECT_ID, {"type": "STATE_REFRESHED", "reason": "SCENARIO_LOADED"})
    return {
        "status": "success",
        "message": "Demo scenario loaded with initial proposals.",
        "project_id": project.id,
        "context_version": project.context_version,
        "artifact_version": project.artifact_version,
        "is_clean_baseline": False,
        "scenario_label": "Loaded Demo Scenario",
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

    session_token = create_session(
        project_id=project_id,
        identity_key=member.identity_key,
        role=member.role,
        display_name=member.display_name,
    )

    return {
        "identity_key": member.identity_key,
        "display_name": member.display_name,
        "role": member.role,
        "member_type": member.member_type,
        "session_token": session_token,
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
        .limit(30)
        .all()
    )
    delegations = (
        db.query(DelegationModel)
        .filter(DelegationModel.project_id == project_id)
        .order_by(DelegationModel.created_at.desc())
        .all()
    )
    approvals = (
        db.query(ApprovalRequestModel)
        .filter(ApprovalRequestModel.project_id == project_id)
        .order_by(ApprovalRequestModel.created_at.desc())
        .all()
    )
    resources = get_all_workspace_resources(db, project_id)
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
        "proposals": [serialize_proposal_for_api(p) for p in proposals],
        "agent_runs": [
            {
                "id": r.id,
                "agent_id": r.agent_id,
                "status": r.status,
                "lifecycle_state": r.lifecycle_state or r.status or "idle",
                "task_description": r.task_description,
                "base_context_version": r.base_context_version,
                "base_artifact_version": r.base_artifact_version,
                "current_task": r.current_task,
                "current_proposal_id": r.current_proposal_id,
                "task_start_time": r.task_start_time or r.started_at,
                "last_completed_task": r.last_completed_task,
                "last_heartbeat": r.last_heartbeat or r.started_at,
                "source": r.source,
                "started_at": r.started_at,
                "completed_at": r.completed_at,
            }
            for r in agent_runs
        ],
        "events": [
            e.to_envelope()
            for e in reversed(events)
        ],
        "delegations": [
            {
                "id": d.id,
                "source_agent": d.source_agent,
                "target_agent": d.target_agent,
                "task": d.task,
                "scope": d.scope,
                "acceptance_criteria": d.acceptance_criteria,
                "status": d.status,
                "result_proposal_id": d.result_proposal_id,
                "created_at": d.created_at,
            }
            for d in delegations
        ],
        "approvals": [
            {
                "id": a.id,
                "requested_by": a.requested_by,
                "title": a.title,
                "explanation": a.explanation,
                "escalation_reason": a.escalation_reason,
                "affected_requirements": a.affected_requirements,
                "affected_sections": a.affected_sections,
                "expected_impact": a.expected_impact,
                "assigned_decider_id": a.assigned_decider_id,
                "proposal_id": a.proposal_id,
                "status": a.status,
                "resolved_by": a.resolved_by,
                "created_at": a.created_at,
            }
            for a in approvals
        ],
        "resources": resources,
        "is_clean_baseline": len(proposals) == 0,
        "scenario_label": "Clean Baseline" if len(proposals) == 0 else "Loaded Demo Scenario",
        "observer_summary": summary.model_dump(),
        "online_members": list(ws_manager.active_presence.get(project_id, set())),
    }
