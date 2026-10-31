import uuid
import json
import logging
from typing import Dict, Any, List
from sqlalchemy.orm import Session

from backend.app.context.pack_builder import create_and_persist_agent_run
from backend.app.proposals.stamping import stamp_and_persist_proposal
from backend.app.agents.provider import call_llm_json, get_effective_model
from backend.app.agents.tools import get_agent_tools
from backend.app.agents.prompts.pixel_prompt import PIXEL_SYSTEM_PROMPT
from backend.app.agents.fallback import (
    FALLBACK_PIXEL_PROPOSAL_C,
    FALLBACK_HIGH_IMPACT_APPROVAL_POLICY,
    FALLBACK_REDIRECTED_PROPOSAL_D,
)
from backend.app.db.models import ProposalModel, AgentRunModel, utcnow_str
from backend.app.events.logger import log_event

logger = logging.getLogger(__name__)


async def run_pixel_initial(db: Session, project_id: str) -> List[ProposalModel]:
    """
    Executes PIXEL initial run, producing Proposal C (Hero improvement -> REQ_BRAND).
    """
    run_id = f"run_pixel_{uuid.uuid4().hex[:6]}"
    task_id = "task_pixel_initial"
    task_desc = "Design hero component upgrade aligning with brand messaging requirements"

    run = create_and_persist_agent_run(
        db=db,
        project_id=project_id,
        agent_id="pixel",
        run_id=run_id,
        task_id=task_id,
        task_description=task_desc,
        target_sections=["hero"],
        affected_requirements=["REQ_BRAND"],
    )

    pack = run.context_pack
    user_prompt = (
        f"Design a high-conversion hero section upgrade using this Context Pack:\n{json.dumps(pack, indent=2)}\n"
        f"Target section: 'hero', Operation: 'set_hero_content'."
    )

    pixel_model = get_effective_model("pixel")
    pixel_tools = get_agent_tools("pixel")

    raw_c = None
    source_c = "live_llm"
    sim_c = False
    prune_meta_c = None
    try:
        res_c = await call_llm_json(
            system_prompt=PIXEL_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            timeout=12.0,
            model=pixel_model,
            agent_id="pixel",
            tools=pixel_tools,
        )
        raw_c, source_c, sim_c = res_c
        prune_meta_c = getattr(res_c, "prune_metadata", None)
    except Exception as e:
        logger.info(f"PIXEL Proposal C using deterministic fallback: {e}")
        raw_c = FALLBACK_PIXEL_PROPOSAL_C
        source_c = "cached_fallback"
        sim_c = True

    prop_c = stamp_and_persist_proposal(
        db=db,
        project_id=project_id,
        run_id=run.id,
        raw_output=raw_c,
        source=source_c,
        is_simulated=sim_c,
        prune_metadata=prune_meta_c,
        implementation_data=raw_c.get("implementation_data") if isinstance(raw_c, dict) else None,
    )
    run.status = "completed"
    run.lifecycle_state = "completed"
    run.completed_at = utcnow_str()
    db.commit()

    return [prop_c]


async def run_pixel_approval_policy(db: Session, project_id: str) -> ProposalModel:
    """
    Step 6: PIXEL proposes manager approval policy & queue config.
    Backend stamping automatically computes: requires_decision=True, assigned_decider_id="alex".
    """
    run_id = f"run_pixel_policy_{uuid.uuid4().hex[:6]}"
    task_desc = "Formulate enterprise manager approval policy and interactive approval queue"

    run = create_and_persist_agent_run(
        db=db,
        project_id=project_id,
        agent_id="pixel",
        run_id=run_id,
        task_id=f"task_policy_{uuid.uuid4().hex[:4]}",
        task_description=task_desc,
        target_sections=["approval_queue"],
        affected_requirements=["REQ_APPROVAL_POLICY", "REQ_ROLES"],
    )

    pack = run.context_pack
    user_prompt = (
        f"Context Pack:\n{json.dumps(pack, indent=2)}\n"
        f"Propose enterprise approval queue configuration based on REQ_APPROVAL_POLICY and REQ_ROLES."
    )

    pixel_model = get_effective_model("pixel")
    pixel_tools = get_agent_tools("pixel")

    raw_output = None
    source = "live_llm"
    is_simulated = False
    prune_meta = None
    try:
        res = await call_llm_json(
            system_prompt=PIXEL_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            timeout=12.0,
            model=pixel_model,
            agent_id="pixel",
            tools=pixel_tools,
        )
        raw_output, source, is_simulated = res
        prune_meta = getattr(res, "prune_metadata", None)
    except Exception as e:
        logger.info(f"PIXEL Policy using deterministic fallback: {e}")
        raw_output = FALLBACK_HIGH_IMPACT_APPROVAL_POLICY
        source = "cached_fallback"
        is_simulated = True

    proposal = stamp_and_persist_proposal(
        db=db,
        project_id=project_id,
        run_id=run.id,
        raw_output=raw_output,
        source=source,
        is_simulated=is_simulated,
        prune_metadata=prune_meta,
        implementation_data=raw_output.get("implementation_data") if isinstance(raw_output, dict) else None,
    )
    run.status = "completed"
    run.lifecycle_state = "completed"
    run.completed_at = utcnow_str()
    db.commit()

    return proposal


async def redirect_pixel_proposal(
    db: Session,
    project_id: str,
    original_proposal_id: str,
    human_instruction: str,
    decided_by: str = "alex",
) -> ProposalModel:
    """
    Step 6: Human Redirect action.
    Captures human instruction, builds fresh Context Pack, calls PIXEL,
    and persists a new linked proposal (supersedes_proposal_id).
    """
    orig_prop = db.query(ProposalModel).filter(ProposalModel.id == original_proposal_id).first()
    if not orig_prop:
        raise ValueError(f"Original proposal {original_proposal_id} not found")

    new_run_id = f"run_pixel_redirect_{uuid.uuid4().hex[:6]}"
    task_desc = f"Revise proposal {original_proposal_id} per {decided_by}'s redirect note: '{human_instruction}'"

    run = create_and_persist_agent_run(
        db=db,
        project_id=project_id,
        agent_id="pixel",
        run_id=new_run_id,
        task_id=f"task_redirect_{uuid.uuid4().hex[:4]}",
        task_description=task_desc,
    )

    pack = run.context_pack
    user_prompt = (
        f"Original Proposal:\n{json.dumps({'summary': orig_prop.summary, 'changes': orig_prop.changes}, indent=2)}\n\n"
        f"Human Director ({decided_by.upper()}) Redirect Instruction:\n'{human_instruction}'\n\n"
        f"Fresh Context Pack:\n{json.dumps(pack, indent=2)}\n"
        f"Produce a revised structured proposal strictly following the human instruction."
    )

    pixel_model = get_effective_model("pixel")
    pixel_tools = get_agent_tools("pixel")

    raw_output = None
    source = "live_llm"
    is_simulated = False
    prune_meta = None
    try:
        res = await call_llm_json(
            system_prompt=PIXEL_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            timeout=12.0,
            model=pixel_model,
            agent_id="pixel",
            tools=pixel_tools,
        )
        raw_output, source, is_simulated = res
        prune_meta = getattr(res, "prune_metadata", None)
    except Exception as e:
        logger.info(f"PIXEL Redirect using deterministic fallback: {e}")
        raw_output = FALLBACK_REDIRECTED_PROPOSAL_D
        source = "cached_fallback"
        is_simulated = True

    # Ensure title reflects redirect instruction
    if raw_output and isinstance(raw_output, dict):
        ops = raw_output.get("changes", {}).get("operations", [])
        for op in ops:
            cfg = op.get("config", {})
            if "configurable" in human_instruction.lower() and "Configurable" not in cfg.get("title", ""):
                cfg["title"] = f"Configurable {cfg.get('title', 'Expense Approval Queue')}"
                op["config"] = cfg

    new_proposal = stamp_and_persist_proposal(
        db=db,
        project_id=project_id,
        run_id=run.id,
        raw_output=raw_output,
        source=source,
        is_simulated=is_simulated,
        supersedes_proposal_id=original_proposal_id,
        prune_metadata=prune_meta,
        implementation_data=raw_output.get("implementation_data") if isinstance(raw_output, dict) else None,
    )

    # Mark original proposal as superseded/redirected
    orig_prop.status = "superseded"
    orig_prop.updated_at = utcnow_str()
    db.commit()

    log_event(
        db=db,
        project_id=project_id,
        actor_type="human",
        actor_id=decided_by,
        event_type="PROPOSAL_REDIRECTED",
        payload={
            "original_proposal_id": original_proposal_id,
            "new_proposal_id": new_proposal.id,
            "instruction": human_instruction,
            "decided_by": decided_by,
        },
    )

    run.status = "completed"
    run.lifecycle_state = "completed"
    run.completed_at = utcnow_str()
    db.commit()

    return new_proposal
