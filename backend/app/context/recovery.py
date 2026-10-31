import uuid
import json
from typing import Dict, Any, Tuple
from sqlalchemy.orm import Session
from backend.app.db.models import AgentRunModel, EventModel, ProjectModel, utcnow_str
from backend.app.context.pack_builder import build_context_pack
from backend.app.context.checkpointing import evaluate_checkpoint_and_resume_plan
from backend.app.agents.provider import call_llm_json
from backend.app.agents.prompts.recovery_prompt import RECOVERY_SYSTEM_PROMPT
from backend.app.events.logger import log_event


async def restart_agent_and_recover(
    db: Session,
    project_id: str,
    agent_id: str,
) -> Tuple[AgentRunModel, Dict[str, Any]]:
    """
    Closes the previous agent run, builds a fresh authoritative Context Pack
    from current persisted state, executes context recovery summary via LLM or deterministic fallback,
    and returns the new AgentRunModel with recovery details.
    """
    # 1. Evaluate previous checkpoint and resume plan
    resume_plan = evaluate_checkpoint_and_resume_plan(db, project_id, agent_id)

    # 2. Close/interrupt active previous runs for this agent
    prev_runs = (
        db.query(AgentRunModel)
        .filter(AgentRunModel.project_id == project_id, AgentRunModel.agent_id == agent_id)
        .all()
    )
    last_checkpoint = None
    for r in prev_runs:
        if r.status in ("working", "waiting_for_review"):
            r.status = "interrupted"
            r.lifecycle_state = "offline"
            r.completed_at = utcnow_str()
        if r.last_checkpoint and isinstance(r.last_checkpoint, dict):
            last_checkpoint = r.last_checkpoint

    db.commit()

    # 3. Build fresh Context Pack
    new_run_id = f"run_{agent_id}_{uuid.uuid4().hex[:6]}"
    task_id = f"task_recover_{uuid.uuid4().hex[:4]}"
    task_desc = f"Recover context and resume {agent_id.upper()} task stream"

    context_pack = build_context_pack(
        db=db,
        project_id=project_id,
        agent_id=agent_id,
        run_id=new_run_id,
        task_id=task_id,
        task_description=task_desc,
        last_checkpoint=last_checkpoint,
    )

    # 4. Generate recovery summary (LLM or deterministic fallback)
    user_prompt = f"Agent: {agent_id}\nContext Pack:\n{json.dumps(context_pack.model_dump(), indent=2)}"
    recovery_data = {}
    source = "live_llm"
    is_simulated = False

    try:
        raw_summary, source, is_simulated = await call_llm_json(
            system_prompt=RECOVERY_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            timeout=8.0,
        )
        recovery_data = {
            "recovery_summary": raw_summary.get("recovery_summary", f"{agent_id.upper()} resumed successfully with Context v{context_pack.context_version}."),
            "what_changed_offline": raw_summary.get("what_changed_offline", f"Context version is now v{context_pack.context_version}, Artifact is v{context_pack.artifact_version}."),
            "next_intended_action": raw_summary.get("next_intended_action", "Re-evaluating pending proposals and awaiting human instructions."),
            "resume_plan": resume_plan,
        }
    except Exception as e:
        source = "cached_fallback"
        is_simulated = True
        offline_count = len(context_pack.offline_changes)
        recovery_data = {
            "recovery_summary": f"{agent_id.upper()} successfully reconstructed context from persisted project state.",
            "what_changed_offline": (
                f"Project advanced to Context v{context_pack.context_version}, Artifact v{context_pack.artifact_version}. "
                f"Detected {offline_count} new event(s) and {len(context_pack.requirements)} verified requirements."
            ),
            "next_intended_action": (
                "Synthesizing enterprise requirement changes and preparing strategy alignment recommendations."
                if agent_id == "nova"
                else "Checking prototype section versions and standing by for component engineering tasks."
            ),
            "resume_plan": resume_plan,
        }

    # 5. Persist the new run with the fresh Context Pack & recovery metadata
    checkpoint_snapshot = {
        "timestamp": utcnow_str(),
        "resumed_from_plan": resume_plan["task_action"],
        "context_version": context_pack.context_version,
        "artifact_version": context_pack.artifact_version,
    }

    new_run = AgentRunModel(
        id=new_run_id,
        project_id=project_id,
        agent_id=agent_id,
        status="idle",
        lifecycle_state="idle",
        task_description=task_desc,
        context_pack=context_pack.model_dump(),
        base_context_version=context_pack.context_version,
        base_artifact_version=context_pack.artifact_version,
        last_checkpoint=checkpoint_snapshot,
        completed_work=resume_plan.get("completed_work", []),
        pending_work=resume_plan.get("pending_work", []),
        source=source,
        started_at=utcnow_str(),
        completed_at=utcnow_str(),
    )
    db.add(new_run)
    db.commit()
    db.refresh(new_run)

    # 6. Log context recovery event
    log_event(
        db=db,
        project_id=project_id,
        actor_type="agent",
        actor_id=agent_id,
        event_type="AGENT_RECOVERED",
        context_version=context_pack.context_version,
        artifact_version=context_pack.artifact_version,
        payload={
            "agent_id": agent_id,
            "run_id": new_run.id,
            "recovery_data": recovery_data,
            "resume_plan": resume_plan,
            "source": source,
            "is_simulated": is_simulated,
        },
    )

    return new_run, recovery_data
