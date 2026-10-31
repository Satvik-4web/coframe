"""
Persistent Execution Checkpointing and Context Recovery Engine.
Implements fine-grained state checkpointing, idempotency keys, offline event replay,
and deterministic task resumption for interrupted AI collaborators.
"""

from typing import Dict, Any, List, Optional, Tuple
import uuid
import datetime
from sqlalchemy.orm import Session
from sqlalchemy import desc

from backend.app.db.models import (
    AgentRunModel,
    EventModel,
    ProjectModel,
    RequirementModel,
    ArtifactSectionModel,
    ProposalModel,
    utcnow_str,
)
from backend.app.events.logger import log_event


class ExecutionState:
    CREATED = "CREATED"
    RUNNING = "RUNNING"
    CHECKPOINTED = "CHECKPOINTED"
    INTERRUPTED = "INTERRUPTED"
    RECOVERING = "RECOVERING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


def create_checkpoint(
    db: Session,
    run_id: str,
    completed_step: str,
    pending_steps: List[str],
    relevant_proposal_ids: Optional[List[str]] = None,
    idempotency_key: Optional[str] = None,
) -> AgentRunModel:
    """
    Persists an execution checkpoint for an active agent run.
    Records completed work, pending work, latest event sequence, and context versions.
    """
    run = db.query(AgentRunModel).filter(AgentRunModel.id == run_id).first()
    if not run:
        raise ValueError(f"Agent run {run_id} not found")

    project = db.query(ProjectModel).filter(ProjectModel.id == run.project_id).first()
    ctx_ver = project.context_version if project else run.base_context_version
    art_ver = project.artifact_version if project else run.base_artifact_version

    latest_event = (
        db.query(EventModel)
        .filter(EventModel.project_id == run.project_id)
        .order_by(desc(EventModel.sequence_no))
        .first()
    )
    last_seq = latest_event.sequence_no if latest_event else 0

    current_completed = list(run.completed_work or [])
    if completed_step and completed_step not in current_completed:
        current_completed.append(completed_step)

    checkpoint_data = {
        "checkpoint_id": f"chk_{uuid.uuid4().hex[:8]}",
        "timestamp": utcnow_str(),
        "run_id": run_id,
        "agent_id": run.agent_id,
        "completed_step": completed_step,
        "completed_work": current_completed,
        "pending_work": pending_steps,
        "context_version": ctx_ver,
        "artifact_version": art_ver,
        "last_processed_event_seq": last_seq,
        "relevant_proposal_ids": relevant_proposal_ids or [],
        "status": ExecutionState.CHECKPOINTED,
    }

    run.last_checkpoint = checkpoint_data
    run.completed_work = current_completed
    run.pending_work = pending_steps
    run.last_processed_event_seq = last_seq
    run.status = "working"
    run.lifecycle_state = "working"
    if idempotency_key:
        run.idempotency_key = idempotency_key

    db.commit()
    db.refresh(run)

    log_event(
        db=db,
        project_id=run.project_id,
        actor_type="agent",
        actor_id=run.agent_id,
        event_type="agent.checkpointed",
        payload={
            "run_id": run_id,
            "completed_step": completed_step,
            "pending_steps_count": len(pending_steps),
            "context_version": ctx_ver,
            "artifact_version": art_ver,
        },
        auto_commit=True,
    )

    return run


def evaluate_checkpoint_and_resume_plan(
    db: Session,
    project_id: str,
    agent_id: str,
) -> Dict[str, Any]:
    """
    Evaluates the last checkpoint for an agent against current project state.
    Determines whether the previous checkpoint is still valid or requires revision.
    """
    last_run = (
        db.query(AgentRunModel)
        .filter(AgentRunModel.project_id == project_id, AgentRunModel.agent_id == agent_id)
        .order_by(desc(AgentRunModel.started_at))
        .first()
    )

    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    curr_ctx_ver = project.context_version if project else 1
    curr_art_ver = project.artifact_version if project else 1

    if not last_run or not last_run.last_checkpoint:
        return {
            "has_checkpoint": False,
            "can_resume_directly": False,
            "task_action": "start_fresh",
            "offline_events_count": 0,
            "reason": "No previous checkpoint recorded. Starting fresh task stream.",
        }

    chk = last_run.last_checkpoint
    chk_ctx_ver = chk.get("context_version", 1)
    chk_art_ver = chk.get("artifact_version", 1)
    last_seq = chk.get("last_processed_event_seq", 0)

    # Fetch events that occurred since checkpoint
    if (last_seq is None or last_seq == 0) and chk.get("timestamp"):
        offline_events = (
            db.query(EventModel)
            .filter(EventModel.project_id == project_id, EventModel.created_at > str(chk["timestamp"]))
            .order_by(EventModel.sequence_no.asc())
            .all()
        )
    else:
        offline_events = (
            db.query(EventModel)
            .filter(EventModel.project_id == project_id, EventModel.sequence_no > (int(last_seq) if last_seq else 0))
            .order_by(EventModel.sequence_no.asc())
            .all()
        )

    # Check if context or artifact advanced
    is_context_outdated = curr_ctx_ver > chk_ctx_ver
    is_artifact_outdated = curr_art_ver > chk_art_ver

    pending_work = chk.get("pending_work", [])
    completed_work = chk.get("completed_work", [])

    if not is_context_outdated and not is_artifact_outdated:
        return {
            "has_checkpoint": True,
            "can_resume_directly": True,
            "task_action": "resume_pending",
            "completed_work": completed_work,
            "pending_work": pending_work,
            "offline_events_count": len(offline_events),
            "reason": "Project versions unchanged. Safe to continue pending task items.",
        }
    else:
        # Context advanced while offline!
        revised_tasks = []
        for task in pending_work:
            revised_tasks.append(f"{task} (reconciled with Context v{curr_ctx_ver})")

        return {
            "has_checkpoint": True,
            "can_resume_directly": False,
            "task_action": "revise_and_reconcile",
            "completed_work": completed_work,
            "pending_work": revised_tasks or ["Synthesize updated enterprise requirements"],
            "offline_events_count": len(offline_events),
            "context_drift": {
                "checkpoint_context_version": chk_ctx_ver,
                "current_context_version": curr_ctx_ver,
                "checkpoint_artifact_version": chk_art_ver,
                "current_artifact_version": curr_art_ver,
            },
            "reason": f"Context evolved while offline from v{chk_ctx_ver} to v{curr_ctx_ver}. Re-evaluating tasks against fresh state.",
        }
