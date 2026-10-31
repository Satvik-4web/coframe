import asyncio

from fastapi import APIRouter, Depends, HTTPException

from sqlalchemy.orm import Session



from backend.app.db.database import get_db

from backend.app.db.models import AgentRunModel, ProjectModel, RecoveryRecordModel

from backend.app.agents.nova import run_nova_initial

from backend.app.agents.pixel import run_pixel_initial, run_pixel_approval_policy

from typing import Optional, List

from pydantic import BaseModel

from backend.app.context.recovery import (
    restart_agent_and_recover,
    rebuild_agent_context,
    resume_agent_execution,
    find_interrupted_or_pending_task,
)

from backend.app.context.pack_builder import build_context_pack

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

    nova_proposals = await run_nova_initial(db, project_id)
    pixel_proposals = await run_pixel_initial(db, project_id)



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
async def get_agent_context_pack(
    project_id: str,
    agent_id: str,
    run_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    Exposes the exact Context Pack for the readable Context Inspector.
    Supports querying a specific run_id or defaults to the latest run.
    """
    query = db.query(AgentRunModel).filter(
        AgentRunModel.project_id == project_id,
        AgentRunModel.agent_id == agent_id,
    )
    if run_id:
        target_run = query.filter(AgentRunModel.id == run_id).first()
    else:
        target_run = query.order_by(AgentRunModel.started_at.desc()).first()

    if not target_run:
        raise HTTPException(status_code=404, detail=f"No run found for agent {agent_id}")

    chk = target_run.last_checkpoint or {}
    pack = target_run.context_pack or {}

    return {
        "agent_id": agent_id,
        "run_id": target_run.id,
        "task_id": (pack.get("agent_task") or {}).get("task_id") or f"task_{target_run.id}",
        "task_description": target_run.task_description,
        "status": target_run.status,
        "lifecycle_state": target_run.lifecycle_state,
        "source": target_run.source,
        "started_at": target_run.started_at,
        "completed_at": target_run.completed_at,
        "last_checkpoint": target_run.last_checkpoint,
        "base_context_version": target_run.base_context_version,
        "base_artifact_version": target_run.base_artifact_version,
        "context_pack": pack,
        "target_sections": (pack.get("agent_task") or {}).get("target_sections", []),
        "affected_requirements": (pack.get("agent_task") or {}).get("affected_requirements", []),
        "completed_work": target_run.completed_work or chk.get("completed_work", []),
        "pending_work": target_run.pending_work or chk.get("pending_work", []),
    }

class RebuildContextRequest(BaseModel):
    base_run_id: Optional[str] = None


class ResumeAgentRequest(BaseModel):
    base_run_id: Optional[str] = None
    idempotency_key: Optional[str] = None


@router.post("/projects/{project_id}/agents/{agent_id}/context-pack/rebuild")
async def rebuild_context_endpoint(
    project_id: str,
    agent_id: str,
    body: Optional[RebuildContextRequest] = None,
    db: Session = Depends(get_db),
):
    """
    Operation B: Rebuilds a fresh Context Pack from latest approved project state
    without executing or resuming the agent. Preserves historical Context Packs and persists
    a RecoveryRecordModel for audit and inspection.
    """
    if agent_id not in ("nova", "pixel"):
        raise HTTPException(status_code=400, detail="Agent ID must be 'nova' or 'pixel'")

    base_run_id = body.base_run_id if body else None
    rec, fresh_pack, diff = rebuild_agent_context(db, project_id, agent_id, base_run_id)

    return {
        "status": "success",
        "operation": "rebuild",
        "agent_id": agent_id,
        "recovery_id": rec.id,
        "previous_run_id": rec.previous_run_id,
        "checkpoint": rec.checkpoint_reference,
        "diff": diff,
        "validation_outcome": rec.validation_outcome,
        "conflicts_detected": rec.conflicts_detected,
        "reconstructed_context_pack": fresh_pack,
        "events_consumed": rec.events_consumed,
        "created_at": rec.created_at,
    }


@router.post("/projects/{project_id}/agents/{agent_id}/resume")
async def resume_agent_endpoint(
    project_id: str,
    agent_id: str,
    body: Optional[ResumeAgentRequest] = None,
    db: Session = Depends(get_db),
):
    """
    Operation C: Genuinely resumes an interrupted or recoverable agent task.
    Builds the recovered Context Pack, verifies task relevance, dispatches work,
    and returns real execution outcomes. If no interrupted task exists, clearly
    reports that there is nothing to resume.
    """
    if agent_id not in ("nova", "pixel"):
        raise HTTPException(status_code=400, detail="Agent ID must be 'nova' or 'pixel'")

    base_run_id = body.base_run_id if body else None
    idempotency_key = body.idempotency_key if body else None

    rec, new_run, recovery_data = await resume_agent_execution(
        db, project_id, agent_id, base_run_id, idempotency_key
    )

    if new_run:
        await ws_manager.broadcast(project_id, {
            "type": "AGENT_RECOVERED",
            "agent_id": agent_id,
            "run_id": new_run.id,
            "recovery_id": rec.id,
            "task_resumed": True,
        })

    return {
        "status": "success",
        "operation": "resume",
        "agent_id": agent_id,
        "task_resumed": rec.task_resumed,
        "recovery_id": rec.id,
        "previous_run_id": rec.previous_run_id,
        "resulting_run_id": rec.resulting_agent_run_id,
        "recovery_status": rec.recovery_status,
        "validation_outcome": rec.validation_outcome,
        "resumed_task_description": rec.resumed_task_description,
        "diff": rec.changes_detected,
        "reconstructed_context_pack": rec.reconstructed_context_pack,
        "recovery_data": recovery_data,
        "message": recovery_data.get("message", "Recovery completed."),
    }


@router.get("/projects/{project_id}/agents/{agent_id}/runs")
async def list_agent_runs_for_agent(
    project_id: str,
    agent_id: str,
    db: Session = Depends(get_db),
):
    """
    Lists historical and current runs specifically for the selected agent.
    Provides checkpoint status, step metrics, and timestamps.
    """
    if agent_id not in ("nova", "pixel"):
        raise HTTPException(status_code=400, detail="Agent ID must be 'nova' or 'pixel'")

    runs = (
        db.query(AgentRunModel)
        .filter(AgentRunModel.project_id == project_id, AgentRunModel.agent_id == agent_id)
        .order_by(AgentRunModel.started_at.desc())
        .all()
    )

    return [
        {
            "id": r.id,
            "agent_id": r.agent_id,
            "status": r.status,
            "lifecycle_state": r.lifecycle_state,
            "task_description": r.task_description,
            "base_context_version": r.base_context_version,
            "base_artifact_version": r.base_artifact_version,
            "source": r.source,
            "has_checkpoint": bool(r.last_checkpoint),
            "checkpoint": r.last_checkpoint,
            "completed_work": r.completed_work or [],
            "pending_work": r.pending_work or [],
            "started_at": r.started_at,
            "completed_at": r.completed_at,
        }
        for r in runs
    ]


@router.get("/projects/{project_id}/agents/{agent_id}/runs/{run_id}/context-pack")
async def get_specific_run_context_pack(
    project_id: str,
    agent_id: str,
    run_id: str,
    db: Session = Depends(get_db),
):
    """
    Operation A: Inspects the exact persisted Context Pack used by a particular historical
    or current agent run. Never rebuilds or overwrites it.
    """
    run = (
        db.query(AgentRunModel)
        .filter(
            AgentRunModel.project_id == project_id,
            AgentRunModel.agent_id == agent_id,
            AgentRunModel.id == run_id,
        )
        .first()
    )
    if not run:
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found for agent {agent_id}")

    chk = run.last_checkpoint or {}
    pack = run.context_pack or {}

    return {
        "agent_id": agent_id,
        "run_id": run.id,
        "task_id": (pack.get("agent_task") or {}).get("task_id") or f"task_{run.id}",
        "task_description": run.task_description,
        "status": run.status,
        "lifecycle_state": run.lifecycle_state,
        "source": run.source,
        "started_at": run.started_at,
        "completed_at": run.completed_at,
        "last_checkpoint": run.last_checkpoint,
        "base_context_version": run.base_context_version,
        "base_artifact_version": run.base_artifact_version,
        "context_pack": pack,
        "target_sections": (pack.get("agent_task") or {}).get("target_sections", []),
        "affected_requirements": (pack.get("agent_task") or {}).get("affected_requirements", []),
        "completed_work": run.completed_work or chk.get("completed_work", []),
        "pending_work": run.pending_work or chk.get("pending_work", []),
    }


@router.get("/projects/{project_id}/agents/{agent_id}/recovery-history")
async def get_recovery_history(
    project_id: str,
    agent_id: str,
    db: Session = Depends(get_db),
):
    """
    Returns the persisted recovery history for the selected agent.
    Shows previous attempts, diffs, validation outcomes, and resulting run IDs.
    """
    if agent_id not in ("nova", "pixel"):
        raise HTTPException(status_code=400, detail="Agent ID must be 'nova' or 'pixel'")

    records = (
        db.query(RecoveryRecordModel)
        .filter(RecoveryRecordModel.project_id == project_id, RecoveryRecordModel.agent_id == agent_id)
        .order_by(RecoveryRecordModel.created_at.desc())
        .limit(25)
        .all()
    )

    return [
        {
            "id": r.id,
            "agent_id": r.agent_id,
            "previous_run_id": r.previous_run_id,
            "checkpoint_reference": r.checkpoint_reference,
            "validation_outcome": r.validation_outcome,
            "conflicts_detected": r.conflicts_detected or [],
            "resulting_agent_run_id": r.resulting_agent_run_id,
            "task_resumed": r.task_resumed,
            "resumed_task_description": r.resumed_task_description,
            "recovery_status": r.recovery_status,
            "failure_reason": r.failure_reason,
            "changes_detected": r.changes_detected or {},
            "events_consumed_count": len(r.events_consumed or []),
            "created_at": r.created_at,
        }
        for r in records
    ]


@router.get("/projects/{project_id}/agents/{agent_id}/interrupted-task")
async def get_interrupted_task_status(
    project_id: str,
    agent_id: str,
    db: Session = Depends(get_db),
):
    """
    Checks whether an actual interrupted, unfinished, or pending task exists for this agent.
    Used by frontend to determine whether 'Resume Agent' action is enabled.
    """
    if agent_id not in ("nova", "pixel"):
        raise HTTPException(status_code=400, detail="Agent ID must be 'nova' or 'pixel'")

    task_info = find_interrupted_or_pending_task(db, project_id, agent_id)
    return {
        "agent_id": agent_id,
        "has_interrupted_task": task_info is not None,
        "task_info": task_info,
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







@router.get("/projects/{project_id}/agents/telemetry")

async def get_agent_telemetry(project_id: str):

    """

    Returns operational observability metrics per agent:

    Provider, model, request counts, token counts, average latency, and fallback rates.

    """

    from backend.app.agents.telemetry import telemetry_tracker

    return {

        "status": "success",

        "project_id": project_id,

        "telemetry": telemetry_tracker.get_all_metrics(),

    }





@router.post("/projects/{project_id}/agents/{agent_id}/tools/{tool_name}")

async def execute_tool_endpoint(

    project_id: str,

    agent_id: str,

    tool_name: str,

    arguments: dict,

    db: Session = Depends(get_db),

):

    """

    Executes a structured tool call strictly within the agent's permission boundaries.

    """

    from backend.app.agents.tools import execute_agent_tool

    try:

        result = execute_agent_tool(

            agent_id=agent_id,

            tool_name=tool_name,

            arguments=arguments,

            db=db,

            project_id=project_id,

        )

        return {"status": "success", "result": result}

    except PermissionError as pe:

        raise HTTPException(status_code=403, detail=str(pe))

    except Exception as e:

        raise HTTPException(status_code=400, detail=str(e))





class ContextRetrieveRequest(BaseModel):

    agent_id: str = "nova"

    task_id: str = "custom_task"

    task_description: str

    target_sections: Optional[List[str]] = None

    affected_requirements: Optional[List[str]] = None





@router.post("/projects/{project_id}/context/retrieve")

async def retrieve_context_adhoc(

    project_id: str,

    body: ContextRetrieveRequest,

    db: Session = Depends(get_db),

):

    """

    On-demand hybrid context retrieval endpoint allowing developers and inspectors

    to test and observe what context NOVA or PIXEL receives for any given task.

    """

    pack = build_context_pack(

        db=db,

        project_id=project_id,

        agent_id=body.agent_id,

        run_id=f"adhoc_{body.agent_id}",

        task_id=body.task_id,

        task_description=body.task_description,

        target_sections=body.target_sections,

        affected_requirements=body.affected_requirements,

    )

    return {

        "status": "success",

        "agent_id": body.agent_id,

        "task_id": body.task_id,

        "task_description": body.task_description,

        "context_version": pack.context_version,

        "artifact_version": pack.artifact_version,

        "retrieval_metrics": pack.retrieval_metrics.model_dump() if pack.retrieval_metrics else None,

        "requirements": [r.model_dump() for r in pack.requirements],

        "historical_context": [h.model_dump() for h in pack.historical_context],

        "item_provenance": [p.model_dump() for p in pack.item_provenance],

        "context_pack": pack.model_dump(),

    }

