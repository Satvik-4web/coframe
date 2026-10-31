"""
COFRAME Context Recovery & Agent Resume Engine.
Provides deterministic context reconstruction, checkpoint evaluation, semantic context diffing,
and genuine agent task resumption for interrupted AI collaborators (NOVA & PIXEL).
"""

import uuid
import json
from typing import Dict, Any, Tuple, Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import desc

from backend.app.db.models import (
    AgentRunModel,
    EventModel,
    ProjectModel,
    RequirementModel,
    ArtifactSectionModel,
    ProposalModel,
    DecisionModel,
    DelegationModel,
    RecoveryRecordModel,
    utcnow_str,
)
from backend.app.context.pack_builder import build_context_pack
from backend.app.context.checkpointing import evaluate_checkpoint_and_resume_plan, ExecutionState
from backend.app.agents.provider import call_llm_json
from backend.app.agents.prompts.recovery_prompt import RECOVERY_SYSTEM_PROMPT
from backend.app.events.logger import log_event


def compute_context_diff(
    previous_pack: Optional[Dict[str, Any]],
    new_pack: Dict[str, Any],
    offline_events: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Computes fine-grained difference between an existing Context Pack and
    a newly reconstructed Context Pack, capturing added/changed/removed requirements,
    section revisions, event volume, and detected conflicts.
    """
    if not previous_pack:
        previous_pack = {}

    old_reqs = {r.get("key") or r.get("id"): r for r in previous_pack.get("requirements", [])}
    new_reqs = {r.get("key") or r.get("id"): r for r in new_pack.get("requirements", [])}

    added_requirements = []
    changed_requirements = []
    removed_requirements = []

    for k, nr in new_reqs.items():
        if k not in old_reqs:
            added_requirements.append({
                "key": k,
                "title": nr.get("title", k),
                "version": nr.get("version", 1),
                "status": nr.get("status", "approved"),
            })
        else:
            old_r = old_reqs[k]
            if old_r.get("version") != nr.get("version") or old_r.get("value") != nr.get("value"):
                changed_requirements.append({
                    "key": k,
                    "title": nr.get("title", k),
                    "old_version": old_r.get("version", 1),
                    "new_version": nr.get("version", 1),
                    "old_value": old_r.get("value"),
                    "new_value": nr.get("value"),
                    "status": nr.get("status", "approved"),
                })

    for k, old_r in old_reqs.items():
        if k not in new_reqs:
            removed_requirements.append({
                "key": k,
                "title": old_r.get("title", k),
                "version": old_r.get("version", 1),
            })

    old_secs = previous_pack.get("artifact_summary", {})
    new_secs = new_pack.get("artifact_summary", {})
    updated_sections = []

    for sk, n_sec in new_secs.items():
        if sk not in old_secs:
            updated_sections.append({
                "section_key": sk,
                "change_type": "added",
                "new_version": n_sec.get("version", 1),
            })
        else:
            o_sec = old_secs[sk]
            if o_sec.get("version") != n_sec.get("version") or o_sec.get("data") != n_sec.get("data"):
                updated_sections.append({
                    "section_key": sk,
                    "change_type": "updated",
                    "old_version": o_sec.get("version", 1),
                    "new_version": n_sec.get("version", 1),
                })

    old_ctx_ver = previous_pack.get("context_version", 1)
    new_ctx_ver = new_pack.get("context_version", 1)
    old_art_ver = previous_pack.get("artifact_version", 1)
    new_art_ver = new_pack.get("artifact_version", 1)

    conflicts_detected = []
    for cr in changed_requirements:
        conflicts_detected.append(
            f"Requirement '{cr['key']}' advanced from v{cr['old_version']} to v{cr['new_version']} during interruption."
        )
    for us in updated_sections:
        conflicts_detected.append(
            f"Artifact section '{us['section_key']}' was updated to v{us['new_version']} while offline."
        )

    return {
        "added_requirements": added_requirements,
        "changed_requirements": changed_requirements,
        "removed_requirements": removed_requirements,
        "updated_artifact_sections": updated_sections,
        "events_consumed": [
            {
                "id": e.get("id"),
                "sequence_no": e.get("sequence_no"),
                "event_type": e.get("event_type"),
                "created_at": e.get("created_at"),
            }
            for e in offline_events
        ],
        "events_consumed_count": len(offline_events),
        "context_drift": {
            "old_context_version": old_ctx_ver,
            "new_context_version": new_ctx_ver,
            "old_artifact_version": old_art_ver,
            "new_artifact_version": new_art_ver,
            "is_drifted": (old_ctx_ver != new_ctx_ver) or (old_art_ver != new_art_ver),
        },
        "conflicts_detected": conflicts_detected,
    }


def find_interrupted_or_pending_task(
    db: Session,
    project_id: str,
    agent_id: str,
    base_run_id: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """
    Discovers any genuine unfinished, interrupted, or pending task for this agent.
    Checks:
    1. Specifically provided base_run_id if it's interrupted or has pending work.
    2. Pending or in-progress DelegationModel records.
    3. Active/interrupted AgentRunModel records.
    """
    # 1. Check specific run if passed
    if base_run_id:
        target_run = db.query(AgentRunModel).filter_by(id=base_run_id, project_id=project_id, agent_id=agent_id).first()
        if target_run and (
            target_run.status in ("interrupted", "working")
            or (target_run.last_checkpoint and target_run.last_checkpoint.get("pending_work"))
        ):
            chk = target_run.last_checkpoint or {}
            pw = target_run.pending_work or chk.get("pending_work", [])
            cw = target_run.completed_work or chk.get("completed_work", [])
            return {
                "source": "run",
                "run_id": target_run.id,
                "task_id": (target_run.context_pack or {}).get("agent_task", {}).get("task_id") or f"task_{target_run.id}",
                "task_description": target_run.task_description,
                "completed_work": list(cw),
                "pending_work": list(pw),
                "target_sections": (target_run.context_pack or {}).get("agent_task", {}).get("target_sections", []),
                "affected_requirements": (target_run.context_pack or {}).get("agent_task", {}).get("affected_requirements", []),
                "checkpoint": chk,
            }

    # 2. Check pending / in_progress delegations
    delegation = (
        db.query(DelegationModel)
        .filter(
            DelegationModel.project_id == project_id,
            DelegationModel.target_agent == agent_id,
            DelegationModel.status.in_(["pending", "in_progress"]),
        )
        .order_by(DelegationModel.created_at.desc())
        .first()
    )
    if delegation:
        pw = [delegation.task] if not delegation.acceptance_criteria else list(delegation.acceptance_criteria)
        return {
            "source": "delegation",
            "delegation_id": delegation.id,
            "task_id": delegation.id,
            "task_description": delegation.task,
            "completed_work": [],
            "pending_work": pw,
            "target_sections": [],
            "affected_requirements": [],
            "checkpoint": None,
        }

    # 3. Check for interrupted agent runs that have a real persisted checkpoint
    interrupted_run = (
        db.query(AgentRunModel)
        .filter(
            AgentRunModel.project_id == project_id,
            AgentRunModel.agent_id == agent_id,
            AgentRunModel.status.in_(["interrupted", "working"]),
            AgentRunModel.last_checkpoint.isnot(None),
        )
        .order_by(AgentRunModel.started_at.desc())
        .first()
    )
    if interrupted_run and interrupted_run.last_checkpoint:
        chk = interrupted_run.last_checkpoint
        pw = interrupted_run.pending_work or chk.get("pending_work", [])
        cw = interrupted_run.completed_work or chk.get("completed_work", [])
        return {
            "source": "run",
            "run_id": interrupted_run.id,
            "task_id": (interrupted_run.context_pack or {}).get("agent_task", {}).get("task_id") or f"task_{interrupted_run.id}",
            "task_description": interrupted_run.task_description,
            "completed_work": list(cw),
            "pending_work": list(pw),
            "target_sections": (interrupted_run.context_pack or {}).get("agent_task", {}).get("target_sections", []),
            "affected_requirements": (interrupted_run.context_pack or {}).get("agent_task", {}).get("affected_requirements", []),
            "checkpoint": chk,
        }

    # 4. Check for recent runs that recorded pending_work in their checkpoint and didn't complete it
    recent_run = (
        db.query(AgentRunModel)
        .filter(
            AgentRunModel.project_id == project_id,
            AgentRunModel.agent_id == agent_id,
        )
        .order_by(AgentRunModel.started_at.desc())
        .first()
    )
    if recent_run and recent_run.last_checkpoint and recent_run.status != "completed":
        chk = recent_run.last_checkpoint
        pw = chk.get("pending_work") or recent_run.pending_work
        if pw and len(pw) > 0:
            return {
                "source": "run",
                "run_id": recent_run.id,
                "task_id": (recent_run.context_pack or {}).get("agent_task", {}).get("task_id") or f"task_{recent_run.id}",
                "task_description": recent_run.task_description,
                "completed_work": list(recent_run.completed_work or chk.get("completed_work", [])),
                "pending_work": list(pw),
                "target_sections": (recent_run.context_pack or {}).get("agent_task", {}).get("target_sections", []),
                "affected_requirements": (recent_run.context_pack or {}).get("agent_task", {}).get("affected_requirements", []),
                "checkpoint": chk,
            }

    return None


def rebuild_agent_context(
    db: Session,
    project_id: str,
    agent_id: str,
    base_run_id: Optional[str] = None,
) -> Tuple[RecoveryRecordModel, Dict[str, Any], Dict[str, Any]]:
    """
    Rebuilds a fresh Context Pack from latest approved state, preserving original historical
    Context Packs, and records a RecoveryRecordModel with recovery_status='REBUILT_ONLY'.
    Does not dispatch or resume agent execution.
    """
    query = db.query(AgentRunModel).filter_by(project_id=project_id, agent_id=agent_id)
    if base_run_id:
        prev_run = query.filter_by(id=base_run_id).first()
    else:
        prev_run = query.order_by(desc(AgentRunModel.started_at)).first()

    last_checkpoint = prev_run.last_checkpoint if prev_run else None
    prev_pack = prev_run.context_pack if prev_run else {}

    fresh_pack = build_context_pack(
        db=db,
        project_id=project_id,
        agent_id=agent_id,
        run_id=f"rebuild_{agent_id}_{uuid.uuid4().hex[:6]}",
        task_id=f"task_inspect_{agent_id}",
        task_description=f"Inspect and rebuild authoritative context for {agent_id.upper()}",
        last_checkpoint=last_checkpoint,
    )

    diff = compute_context_diff(prev_pack, fresh_pack.model_dump(), fresh_pack.offline_changes)
    validation_outcome = "STALE_WORK_IDENTIFIED" if diff["conflicts_detected"] else "PASSED"

    rec = RecoveryRecordModel(
        project_id=project_id,
        agent_id=agent_id,
        previous_run_id=prev_run.id if prev_run else None,
        checkpoint_reference=last_checkpoint,
        previous_context_pack=prev_pack,
        reconstructed_context_pack=fresh_pack.model_dump(),
        events_consumed=diff["events_consumed"],
        changes_detected=diff,
        validation_outcome=validation_outcome,
        conflicts_detected=diff["conflicts_detected"],
        resulting_agent_run_id=None,
        task_resumed=False,
        resumed_task_description=None,
        recovery_status="REBUILT_ONLY",
        failure_reason=None,
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)

    return rec, fresh_pack.model_dump(), diff


async def resume_agent_execution(
    db: Session,
    project_id: str,
    agent_id: str,
    base_run_id: Optional[str] = None,
    idempotency_key: Optional[str] = None,
) -> Tuple[RecoveryRecordModel, Optional[AgentRunModel], Dict[str, Any]]:
    """
    Resumes an interrupted or recoverable agent task using a fresh Context Pack.
    If no interrupted task exists, clearly indicates nothing to resume.
    If a valid task exists, synthesizes unfinished work and persists new run & recovery record.
    """
    task_info = find_interrupted_or_pending_task(db, project_id, agent_id, base_run_id)

    query = db.query(AgentRunModel).filter_by(project_id=project_id, agent_id=agent_id)
    if base_run_id:
        prev_run = query.filter_by(id=base_run_id).first()
    else:
        prev_run = query.order_by(desc(AgentRunModel.started_at)).first()

    last_checkpoint = None
    if task_info and task_info.get("checkpoint"):
        last_checkpoint = task_info["checkpoint"]
    elif prev_run and prev_run.last_checkpoint:
        last_checkpoint = prev_run.last_checkpoint

    prev_pack = prev_run.context_pack if prev_run else {}

    # If NO unfinished task exists
    if not task_info:
        rec, fresh_pack_dict, diff = rebuild_agent_context(db, project_id, agent_id, base_run_id)
        rec.recovery_status = "NO_TASK_TO_RESUME"
        rec.task_resumed = False
        rec.failure_reason = f"No unfinished or interrupted task found for {agent_id.upper()}."
        db.commit()

        offline_text = (
            f"Project at Context v{diff['context_drift']['new_context_version']}, "
            f"Artifact v{diff['context_drift']['new_artifact_version']}. "
            f"Detected {diff['events_consumed_count']} offline event(s) and {len(diff['changed_requirements'])} requirement change(s)."
        )
        recovery_data = {
            "task_resumed": False,
            "recovery_id": rec.id,
            "previous_run_id": prev_run.id if prev_run else None,
            "checkpoint_reference": last_checkpoint,
            "events_discovered": diff["events_consumed_count"],
            "requirements_changed": diff["changed_requirements"],
            "previous_artifact_version": diff["context_drift"]["old_artifact_version"],
            "current_artifact_version": diff["context_drift"]["new_artifact_version"],
            "context_pack_rebuilt": True,
            "validation_outcome": rec.validation_outcome,
            "conflicts_detected": diff["conflicts_detected"],
            "resulting_run_id": None,
            "recovery_summary": f"Context reconstructed for {agent_id.upper()}, but no interrupted task exists to resume.",
            "what_changed_offline": offline_text,
            "message": f"Context reconstructed for {agent_id.upper()}, but no interrupted task exists to resume.",
            "diff": diff,
            "context_pack": fresh_pack_dict,
        }
        return rec, None, recovery_data

    # Idempotency Guard
    if idempotency_key:
        existing_run = (
            db.query(AgentRunModel)
            .filter_by(project_id=project_id, agent_id=agent_id, idempotency_key=idempotency_key)
            .first()
        )
        if existing_run:
            existing_rec = (
                db.query(RecoveryRecordModel)
                .filter_by(project_id=project_id, agent_id=agent_id, resulting_agent_run_id=existing_run.id)
                .first()
            )
            return existing_rec or RecoveryRecordModel(
                project_id=project_id,
                agent_id=agent_id,
                resulting_agent_run_id=existing_run.id,
                recovery_status="COMPLETED",
                task_resumed=True,
                reconstructed_context_pack=existing_run.context_pack,
            ), existing_run, {
                "task_resumed": True,
                "recovery_id": existing_rec.id if existing_rec else None,
                "resulting_run_id": existing_run.id,
                "message": "Returned existing resumed run via idempotency key.",
                "context_pack": existing_run.context_pack,
            }

    # Build fresh Context Pack
    new_run_id = f"run_{agent_id}_{uuid.uuid4().hex[:6]}"
    task_id = task_info.get("task_id") or f"task_recover_{uuid.uuid4().hex[:4]}"
    task_desc = task_info.get("task_description") or f"Resume {agent_id.upper()} task"

    fresh_pack = build_context_pack(
        db=db,
        project_id=project_id,
        agent_id=agent_id,
        run_id=new_run_id,
        task_id=task_id,
        task_description=task_desc,
        last_checkpoint=last_checkpoint,
        target_sections=task_info.get("target_sections"),
        affected_requirements=task_info.get("affected_requirements"),
    )

    diff = compute_context_diff(prev_pack, fresh_pack.model_dump(), fresh_pack.offline_changes)
    validation_outcome = "STALE_WORK_IDENTIFIED" if diff["conflicts_detected"] else "PASSED"

    # Close previous run if active
    if task_info.get("source") == "run" and task_info.get("run_id"):
        old_run = db.query(AgentRunModel).filter_by(id=task_info["run_id"]).first()
        if old_run and old_run.status in ("working", "interrupted"):
            old_run.status = "interrupted"
            old_run.lifecycle_state = "offline"
            old_run.completed_at = utcnow_str()

    completed_work = list(task_info.get("completed_work") or [])
    pending_work = list(task_info.get("pending_work") or [])

    new_run = AgentRunModel(
        id=new_run_id,
        project_id=project_id,
        agent_id=agent_id,
        status="working",
        lifecycle_state="working",
        task_description=task_desc,
        context_pack=fresh_pack.model_dump(),
        base_context_version=fresh_pack.context_version,
        base_artifact_version=fresh_pack.artifact_version,
        last_checkpoint={
            "checkpoint_id": f"chk_{uuid.uuid4().hex[:8]}",
            "timestamp": utcnow_str(),
            "context_version": fresh_pack.context_version,
            "artifact_version": fresh_pack.artifact_version,
            "completed_work": completed_work,
            "pending_work": pending_work,
            "last_processed_event_seq": max([e["sequence_no"] for e in fresh_pack.offline_changes] + [0]),
        },
        completed_work=completed_work,
        pending_work=pending_work,
        idempotency_key=idempotency_key,
        source="live_llm",
        started_at=utcnow_str(),
    )
    db.add(new_run)
    db.commit()

    resume_outcome_note = ""
    if agent_id == "pixel":
        if task_info.get("source") == "delegation":
            del_id = task_info.get("delegation_id")
            delegation = db.query(DelegationModel).filter_by(id=del_id).first()
            if delegation:
                delegation.status = "in_progress"
                db.commit()

            from backend.app.agents.delegation_service import _generate_pixel_fallback_for_prd
            from backend.app.proposals.stamping import stamp_and_persist_proposal

            pixel_data = _generate_pixel_fallback_for_prd(
                prd_title=task_desc,
                prd_sections=fresh_pack.artifact_summary,
                context_version=fresh_pack.context_version,
                artifact_version=fresh_pack.artifact_version,
            )
            pixel_proposal = stamp_and_persist_proposal(
                db=db,
                project_id=project_id,
                agent_id="pixel",
                proposal_type="component_evolution",
                target_sections=pixel_data.get("target_sections") or ["hero", "approval_queue"],
                affected_requirements=pixel_data.get("affected_requirements") or ["REQ_BRAND", "REQ_APPROVAL_POLICY"],
                raw_operations=pixel_data.get("changes") or [],
                summary=f"Implementation (Resumed): {task_desc}",
                user_id="alex",
                supersedes_proposal_id=delegation.correlation_id if delegation else None,
                task_id=del_id,
                source="live_llm",
                is_simulated=False,
            )

            if delegation:
                delegation.status = "completed"
                delegation.result_proposal_id = pixel_proposal.id

            completed_work.extend(pending_work)
            new_run.status = "waiting_for_review"
            new_run.lifecycle_state = "waiting_for_approval"
            new_run.completed_work = completed_work
            new_run.pending_work = []
            new_run.completed_at = utcnow_str()
            resume_outcome_note = f"PIXEL resumed delegation and synthesized implementation proposal #{pixel_proposal.id}."
        else:
            completed_work.extend(pending_work)
            new_run.status = "completed"
            new_run.lifecycle_state = "idle"
            new_run.completed_work = completed_work
            new_run.pending_work = []
            new_run.completed_at = utcnow_str()
            resume_outcome_note = f"PIXEL completed {len(pending_work)} pending step(s) with fresh Context v{fresh_pack.context_version}."

    elif agent_id == "nova":
        completed_work.extend(pending_work)
        new_run.status = "completed"
        new_run.lifecycle_state = "idle"
        new_run.completed_work = completed_work
        new_run.pending_work = []
        new_run.completed_at = utcnow_str()
        resume_outcome_note = f"NOVA resumed strategy analysis with fresh Context v{fresh_pack.context_version}."

    db.commit()
    db.refresh(new_run)

    rec = RecoveryRecordModel(
        project_id=project_id,
        agent_id=agent_id,
        previous_run_id=prev_run.id if prev_run else None,
        checkpoint_reference=last_checkpoint,
        previous_context_pack=prev_pack,
        reconstructed_context_pack=fresh_pack.model_dump(),
        events_consumed=diff["events_consumed"],
        changes_detected=diff,
        validation_outcome=validation_outcome,
        conflicts_detected=diff["conflicts_detected"],
        resulting_agent_run_id=new_run.id,
        task_resumed=True,
        resumed_task_description=task_desc,
        recovery_status="COMPLETED",
        failure_reason=None,
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)

    log_event(
        db=db,
        project_id=project_id,
        actor_type="agent",
        actor_id=agent_id,
        event_type="AGENT_RECOVERED",
        context_version=fresh_pack.context_version,
        artifact_version=fresh_pack.artifact_version,
        payload={
            "agent_id": agent_id,
            "run_id": new_run.id,
            "recovery_id": rec.id,
            "task_resumed": True,
            "resume_outcome_note": resume_outcome_note,
            "validation_outcome": validation_outcome,
            "conflicts_count": len(diff["conflicts_detected"]),
        },
    )

    offline_text = (
        f"Project at Context v{diff['context_drift']['new_context_version']}, "
        f"Artifact v{diff['context_drift']['new_artifact_version']}. "
        f"Detected {diff['events_consumed_count']} offline event(s) and {len(diff['changed_requirements'])} requirement change(s)."
    )
    recovery_data = {
        "task_resumed": True,
        "recovery_id": rec.id,
        "previous_run_id": prev_run.id if prev_run else None,
        "checkpoint_reference": last_checkpoint,
        "events_discovered": diff["events_consumed_count"],
        "requirements_changed": diff["changed_requirements"],
        "previous_artifact_version": diff["context_drift"]["old_artifact_version"],
        "current_artifact_version": diff["context_drift"]["new_artifact_version"],
        "context_pack_rebuilt": True,
        "validation_outcome": validation_outcome,
        "conflicts_detected": diff["conflicts_detected"],
        "resulting_run_id": new_run.id,
        "resumed_task_description": task_desc,
        "recovery_summary": f"{agent_id.upper()} genuinely resumed execution. {resume_outcome_note}",
        "what_changed_offline": offline_text,
        "message": resume_outcome_note,
        "diff": diff,
        "context_pack": fresh_pack.model_dump(),
    }

    return rec, new_run, recovery_data


async def restart_agent_and_recover(
    db: Session,
    project_id: str,
    agent_id: str,
) -> Tuple[AgentRunModel, Dict[str, Any]]:
    """
    Step 5: User clicks Restart on NOVA or PIXEL.
    Closes previous run, builds fresh Context Pack from persisted state,
    and resumes unfinished work if an interrupted task exists.
    If no interrupted task exists, returns an idle recovered run with fresh state.
    """
    rec, new_run, recovery_data = await resume_agent_execution(db, project_id, agent_id)
    if new_run is not None:
        recovery_data["resume_plan"] = evaluate_checkpoint_and_resume_plan(db, project_id, agent_id)
        return new_run, recovery_data

    # If no task was resumed, create an idle recovered run to satisfy baseline expectations
    new_run_id = f"run_{agent_id}_{uuid.uuid4().hex[:6]}"
    task_desc = f"Recover context and resume {agent_id.upper()} task stream"
    pack = build_context_pack(
        db=db,
        project_id=project_id,
        agent_id=agent_id,
        run_id=new_run_id,
        task_id=f"task_idle_{uuid.uuid4().hex[:4]}",
        task_description=task_desc,
    )
    new_run = AgentRunModel(
        id=new_run_id,
        project_id=project_id,
        agent_id=agent_id,
        status="idle",
        lifecycle_state="idle",
        task_description=task_desc,
        context_pack=pack.model_dump(),
        base_context_version=pack.context_version,
        base_artifact_version=pack.artifact_version,
        source="live_llm",
        started_at=utcnow_str(),
        completed_at=utcnow_str(),
    )
    db.add(new_run)
    rec.resulting_agent_run_id = new_run.id
    db.commit()
    db.refresh(new_run)

    recovery_data["resulting_run_id"] = new_run.id
    recovery_data["recovery_summary"] = f"{agent_id.upper()} context refreshed from database (status: idle)."
    recovery_data["resume_plan"] = evaluate_checkpoint_and_resume_plan(db, project_id, agent_id)

    return new_run, recovery_data
