import uuid
import json
import logging
from typing import Dict, Any, List
from sqlalchemy.orm import Session

from backend.app.context.pack_builder import create_and_persist_agent_run
from backend.app.proposals.stamping import stamp_and_persist_proposal
from backend.app.agents.provider import call_llm_json, get_effective_model
from backend.app.agents.tools import get_agent_tools
from backend.app.agents.prompts.nova_prompt import NOVA_SYSTEM_PROMPT
from backend.app.agents.prompts.reconcile_prompt import RECONCILE_SYSTEM_PROMPT
from backend.app.agents.fallback import (
    FALLBACK_NOVA_PROPOSAL_A,
    FALLBACK_NOVA_PROPOSAL_B,
    FALLBACK_RECONCILED_PROPOSAL_A,
    FALLBACK_REDIRECTED_NOVA_PROPOSAL,
)
from backend.app.db.models import ProposalModel, AgentRunModel, utcnow_str
from backend.app.events.logger import log_event

logger = logging.getLogger(__name__)


async def run_nova_initial(db: Session, project_id: str) -> List[ProposalModel]:
    """
    Executes NOVA initial run in parallel, producing:
    1. Proposal A (Audience positioning -> REQ_AUDIENCE)
    2. Proposal B (Metrics insight -> REQ_METRICS)
    """
    run_id = f"run_nova_{uuid.uuid4().hex[:6]}"
    task_id = "task_nova_initial"
    task_desc = "Analyze initial requirements and formulate positioning & metrics proposals"

    # 1. Build and persist immutable Context Pack
    run = create_and_persist_agent_run(
        db=db,
        project_id=project_id,
        agent_id="nova",
        run_id=run_id,
        task_id=task_id,
        task_description=task_desc,
    )

    pack = run.context_pack
    created_proposals = []
    nova_model = get_effective_model("nova")
    nova_tools = get_agent_tools("nova")

    # Proposal A — Audience Positioning
    user_prompt_a = (
        f"Analyze REQ_AUDIENCE in this Context Pack:\n{json.dumps(pack, indent=2)}\n"
        f"Propose audience positioning update for 'product_brief'."
    )
    raw_a = None
    source_a = "live_llm"
    sim_a = False
    prune_meta_a = None
    try:
        res_a = await call_llm_json(
            system_prompt=NOVA_SYSTEM_PROMPT,
            user_prompt=user_prompt_a,
            timeout=12.0,
            model=nova_model,
            agent_id="nova",
            tools=nova_tools,
        )
        raw_a, source_a, sim_a = res_a
        prune_meta_a = getattr(res_a, "prune_metadata", None)
    except Exception as e:
        logger.info(f"NOVA Proposal A using deterministic fallback: {e}")
        raw_a = FALLBACK_NOVA_PROPOSAL_A
        source_a = "cached_fallback"
        sim_a = True

    prop_a = stamp_and_persist_proposal(
        db=db,
        project_id=project_id,
        run_id=run.id,
        raw_output=raw_a,
        source=source_a,
        is_simulated=sim_a,
        prune_metadata=prune_meta_a,
        prd_data=raw_a.get("prd_data") if isinstance(raw_a, dict) else None,
    )
    created_proposals.append(prop_a)

    # Proposal B — Metrics Insight
    user_prompt_b = (
        f"Analyze REQ_METRICS in this Context Pack:\n{json.dumps(pack, indent=2)}\n"
        f"Propose metric visibility update for 'dashboard'."
    )
    raw_b = None
    source_b = "live_llm"
    sim_b = False
    prune_meta_b = None
    try:
        res_b = await call_llm_json(
            system_prompt=NOVA_SYSTEM_PROMPT,
            user_prompt=user_prompt_b,
            timeout=12.0,
            model=nova_model,
            agent_id="nova",
            tools=nova_tools,
        )
        raw_b, source_b, sim_b = res_b
        prune_meta_b = getattr(res_b, "prune_metadata", None)
    except Exception as e:
        logger.info(f"NOVA Proposal B using deterministic fallback: {e}")
        raw_b = FALLBACK_NOVA_PROPOSAL_B
        source_b = "cached_fallback"
        sim_b = True

    prop_b = stamp_and_persist_proposal(
        db=db,
        project_id=project_id,
        run_id=run.id,
        raw_output=raw_b,
        source=source_b,
        is_simulated=sim_b,
        prune_metadata=prune_meta_b,
        prd_data=raw_b.get("prd_data") if isinstance(raw_b, dict) else None,
    )
    created_proposals.append(prop_b)

    return created_proposals


async def reconcile_nova_proposal(
    db: Session,
    project_id: str,
    original_proposal_id: str,
    requested_by: str = "maya",
) -> ProposalModel:
    """
    Executes actual agent work for Reconcile:
    1. Loads old proposal.
    2. Builds fresh Context Pack.
    3. Prompts NOVA to adapt proposal to current requirements.
    4. Stamps new proposal with supersedes_proposal_id set to original.
    """
    orig_prop = db.query(ProposalModel).filter(ProposalModel.id == original_proposal_id).first()
    if not orig_prop:
        raise ValueError(f"Original proposal {original_proposal_id} not found")

    new_run_id = f"run_nova_reconcile_{uuid.uuid4().hex[:6]}"
    task_desc = f"Reconcile stale proposal {original_proposal_id} with updated enterprise context"

    run = create_and_persist_agent_run(
        db=db,
        project_id=project_id,
        agent_id="nova",
        run_id=new_run_id,
        task_id=f"task_reconcile_{uuid.uuid4().hex[:4]}",
        task_description=task_desc,
    )

    pack = run.context_pack
    user_prompt = (
        f"Original Proposal:\n{json.dumps({'summary': orig_prop.summary, 'reasoning': orig_prop.reasoning, 'stale_reason': orig_prop.stale_reason}, indent=2)}\n\n"
        f"Fresh Context Pack:\n{json.dumps(pack, indent=2)}\n"
        f"Adapt this proposal to align with the enterprise audience and requirements."
    )

    raw_output = None
    source = "live_llm"
    is_simulated = False
    prune_meta = None
    try:
        res = await call_llm_json(
            system_prompt=RECONCILE_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            timeout=12.0,
            model=get_effective_model("nova"),
            agent_id="nova",
            tools=get_agent_tools("nova"),
        )
        raw_output, source, is_simulated = res
        prune_meta = getattr(res, "prune_metadata", None)
    except Exception as e:
        logger.info(f"NOVA Reconcile using deterministic fallback: {e}")
        raw_output = FALLBACK_RECONCILED_PROPOSAL_A
        source = "cached_fallback"
        is_simulated = True

    new_proposal = stamp_and_persist_proposal(
        db=db,
        project_id=project_id,
        run_id=run.id,
        raw_output=raw_output,
        source=source,
        is_simulated=is_simulated,
        supersedes_proposal_id=original_proposal_id,
        prune_metadata=prune_meta,
        prd_data=raw_output.get("prd_data") if isinstance(raw_output, dict) else None,
    )

    # Mark original proposal superseded
    orig_prop.status = "superseded"
    orig_prop.updated_at = utcnow_str()
    db.commit()

    log_event(
        db=db,
        project_id=project_id,
        actor_type="agent",
        actor_id="nova",
        event_type="PROPOSAL_RECONCILED",
        payload={
            "original_proposal_id": original_proposal_id,
            "new_proposal_id": new_proposal.id,
            "requested_by": requested_by,
        },
    )

    return new_proposal


async def redirect_nova_proposal(
    db: Session,
    project_id: str,
    original_proposal_id: str,
    human_instruction: str,
    decided_by: str = "alex",
) -> ProposalModel:
    """
    Step 6 Redirect for NOVA:
    Captures human instruction, builds fresh Context Pack, prompts NOVA,
    and persists a new linked proposal (supersedes_proposal_id).
    """
    orig_prop = db.query(ProposalModel).filter(ProposalModel.id == original_proposal_id).first()
    if not orig_prop:
        raise ValueError(f"Original proposal {original_proposal_id} not found")

    new_run_id = f"run_nova_redirect_{uuid.uuid4().hex[:6]}"
    task_desc = f"Revise strategic proposal {original_proposal_id} per {decided_by}'s redirect note: '{human_instruction}'"

    run = create_and_persist_agent_run(
        db=db,
        project_id=project_id,
        agent_id="nova",
        run_id=new_run_id,
        task_id=f"task_redirect_{uuid.uuid4().hex[:4]}",
        task_description=task_desc,
    )

    pack = run.context_pack
    user_prompt = (
        f"Original Strategic Proposal:\n{json.dumps({'summary': orig_prop.summary, 'reasoning': orig_prop.reasoning, 'changes': orig_prop.changes}, indent=2)}\n\n"
        f"Human Director ({decided_by.upper()}) Redirect Instruction:\n'{human_instruction}'\n\n"
        f"Fresh Context Pack:\n{json.dumps(pack, indent=2)}\n"
        f"Produce a revised strategic proposal strictly incorporating the human guidance note."
    )

    raw_output = None
    source = "live_llm"
    is_simulated = False
    prune_meta = None
    try:
        res = await call_llm_json(
            system_prompt=NOVA_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            timeout=12.0,
            model=get_effective_model("nova"),
            agent_id="nova",
            tools=get_agent_tools("nova"),
        )
        raw_output, source, is_simulated = res
        prune_meta = getattr(res, "prune_metadata", None)
    except Exception as e:
        logger.info(f"NOVA Redirect using deterministic fallback: {e}")
        raw_output = FALLBACK_REDIRECTED_NOVA_PROPOSAL
        source = "cached_fallback"
        is_simulated = True

    new_proposal = stamp_and_persist_proposal(
        db=db,
        project_id=project_id,
        run_id=run.id,
        raw_output=raw_output,
        source=source,
        is_simulated=is_simulated,
        supersedes_proposal_id=original_proposal_id,
        prune_metadata=prune_meta,
        prd_data=raw_output.get("prd_data") if isinstance(raw_output, dict) else None,
    )

    # Mark original proposal as superseded
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
            "agent_id": "nova",
        },
    )

    return new_proposal
