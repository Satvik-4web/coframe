import asyncio
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.db.database import get_db
from backend.app.db.models import AgentRunModel, ProjectModel
from backend.app.agents.nova import run_nova_initial
from backend.app.agents.pixel import run_pixel_initial, run_pixel_approval_policy
from backend.app.context.recovery import restart_agent_and_recover
from backend.app.websocket.manager import ws_manager

router = APIRouter(tags=["agents"])


@router.post("/projects/{project_id}/agents/start")
async def start_collaboration(project_id: str, db: Session = Depends(get_db)):
    """
    Step 2: Human clicks 'Start Collaboration'.
    NOVA and PIXEL execute parallel tasks against immutable Context Packs.
    Creates Proposal A, Proposal B, and Proposal C.
    """
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Run NOVA and PIXEL tasks
    nova_proposals, pixel_proposals = await asyncio.gather(
        run_nova_initial(db, project_id),
        run_pixel_initial(db, project_id),
    )

    all_proposals = nova_proposals + pixel_proposals

    await ws_manager.broadcast(project_id, {
        "type": "AGENTS_COMPLETED_INITIAL",
        "proposals_count": len(all_proposals),
    })

    return {
        "status": "success",
        "message": "NOVA and PIXEL completed parallel initial runs.",
        "proposals": [
            {
                "id": p.id,
                "agent_id": p.agent_id,
                "summary": p.summary,
                "status": p.status,
                "affected_requirements": p.affected_requirements,
                "target_sections": p.target_sections,
                "source": p.source,
                "is_simulated": p.is_simulated,
            }
            for p in all_proposals
        ],
    }


@router.post("/projects/{project_id}/agents/{agent_id}/restart")
async def restart_agent(project_id: str, agent_id: str, db: Session = Depends(get_db)):
    """
    Step 5: User clicks Restart on NOVA or PIXEL.
    Closes previous run, builds fresh Context Pack from persisted state,
    executes context recovery summary, and returns the pack for inspection.
    """
    if agent_id not in ("nova", "pixel"):
        raise HTTPException(status_code=400, detail="Agent ID must be 'nova' or 'pixel'")

    new_run, recovery_data = await restart_agent_and_recover(db, project_id, agent_id)

    await ws_manager.broadcast(project_id, {
        "type": "AGENT_RESTARTED",
        "agent_id": agent_id,
        "run_id": new_run.id,
    })

    return {
        "status": "success",
        "agent_id": agent_id,
        "run_id": new_run.id,
        "recovery": recovery_data,
        "context_pack": new_run.context_pack,
    }


@router.get("/projects/{project_id}/agents")
async def list_agent_runs(project_id: str, db: Session = Depends(get_db)):
    runs = (
        db.query(AgentRunModel)
        .filter(AgentRunModel.project_id == project_id)
        .order_by(AgentRunModel.started_at.desc())
        .all()
    )
    return [
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
        for r in runs
    ]


@router.get("/projects/{project_id}/agents/{agent_id}/context-pack")
async def get_agent_context_pack(project_id: str, agent_id: str, db: Session = Depends(get_db)):
    """Exposes the exact Context Pack for the readable Context Inspector."""
    latest_run = (
        db.query(AgentRunModel)
        .filter(AgentRunModel.project_id == project_id, AgentRunModel.agent_id == agent_id)
        .order_by(AgentRunModel.started_at.desc())
        .first()
    )
    if not latest_run:
        raise HTTPException(status_code=404, detail=f"No run found for agent {agent_id}")

    return {
        "agent_id": agent_id,
        "run_id": latest_run.id,
        "status": latest_run.status,
        "base_context_version": latest_run.base_context_version,
        "base_artifact_version": latest_run.base_artifact_version,
        "source": latest_run.source,
        "context_pack": latest_run.context_pack,
    }


@router.post("/projects/{project_id}/agents/propose-policy")
async def trigger_high_impact_proposal(project_id: str, db: Session = Depends(get_db)):
    """
    Step 6 Trigger: PIXEL proposes manager approval policy & queue configuration.
    Backend stamping automatically computes: requires_decision=True, assigned_decider_id="alex".
    """
    prop = await run_pixel_approval_policy(db, project_id)
    await ws_manager.broadcast(project_id, {
        "type": "HIGH_IMPACT_PROPOSAL_SUBMITTED",
        "proposal_id": prop.id,
        "assigned_decider_id": prop.assigned_decider_id,
    })
    return {
        "status": "success",
        "proposal_id": prop.id,
        "summary": prop.summary,
        "requires_decision": prop.requires_decision,
        "assigned_decider_id": prop.assigned_decider_id,
    }
