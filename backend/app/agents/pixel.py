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
from backend.app.db.models import (
    ProposalModel,
    AgentRunModel,
    ArtifactSectionModel,
    ProjectModel,
    utcnow_str,
)
from backend.app.events.logger import log_event
from backend.app.proposals.output_transformers import build_pixel_implementation_data
from backend.app.agents.review import validate_agent_proposal_output

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


async def reconcile_pixel_proposal(
    db: Session,
    project_id: str,
    original_proposal_id: str,
    requested_by: str = "maya",
) -> ProposalModel:
    """
    Executes actual agent work for PIXEL Reconcile:
    1. Loads conflicted/stale proposal.
    2. Identifies target sections and queries their current canonical versions & data.
    3. Builds fresh Context Pack and creates AgentRunModel for PIXEL.
    4. Harmonizes proposed changes with the latest human canonical updates.
    5. Stamps new proposal with supersedes_proposal_id set to original and updated base_section_versions.
    6. Runs multi-layer NOVA review (verdict, findings).
    7. Marks original proposal as 'superseded'.
    8. Emits events and returns new proposal.
    """
    orig_prop = db.query(ProposalModel).filter(ProposalModel.id == original_proposal_id).first()
    if not orig_prop:
        raise ValueError(f"Original proposal {original_proposal_id} not found")

    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise ValueError(f"Project {project_id} not found")

    target_sections = orig_prop.target_sections or ["hero"]
    sec_key = target_sections[0]

    # Look up current canonical section
    curr_sec = (
        db.query(ArtifactSectionModel)
        .filter(
            ArtifactSectionModel.project_id == project_id,
            ArtifactSectionModel.section_key == sec_key,
        )
        .first()
    )
    curr_version = curr_sec.version if curr_sec else 1
    curr_data = curr_sec.data if curr_sec else {}

    new_run_id = f"run_pixel_reconcile_{uuid.uuid4().hex[:6]}"
    task_desc = f"Reconcile conflicted proposal {original_proposal_id} with updated canonical {sec_key} section (v{curr_version}) per {requested_by}'s request"

    run = create_and_persist_agent_run(
        db=db,
        project_id=project_id,
        agent_id="pixel",
        run_id=new_run_id,
        task_id=f"task_reconcile_{uuid.uuid4().hex[:4]}",
        task_description=task_desc,
        target_sections=target_sections,
        affected_requirements=orig_prop.affected_requirements or ["REQ_BRAND"],
    )

    pack = run.context_pack
    user_prompt = (
        f"Original Conflicted Proposal:\n{json.dumps({'summary': orig_prop.summary, 'changes': orig_prop.changes}, indent=2)}\n\n"
        f"Current Canonical Section '{sec_key}' (v{curr_version}):\n{json.dumps(curr_data, indent=2)}\n\n"
        f"Reconcile Request by: {requested_by.capitalize()}\n"
        f"Fresh Context Pack:\n{json.dumps(pack, indent=2)}\n"
        f"Harmonize the proposed changes with the current canonical section. Preserve human updates while fulfilling confirmed requirements."
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
        logger.info(f"PIXEL Reconcile using deterministic fallback: {e}")
        # Build harmonized output based on current canonical section data
        if sec_key == "hero":
            headline = curr_data.get("headline", "Take control of company spending")
            subheadline = curr_data.get("subheadline", "Real-time expense management for high-velocity teams")
            cta_text = curr_data.get("cta_text", "Start Free Trial")
            raw_output = {
                "summary": f"Harmonized Hero: Unified {requested_by.capitalize()}'s Copy with Automated Approvals",
                "reasoning": f"Preserves {requested_by.capitalize()}'s live hero messaging (v{curr_version}) while integrating enterprise approval badge and policy guardrails per confirmed requirements.",
                "affected_requirements": orig_prop.affected_requirements or ["REQ_BRAND"],
                "target_sections": ["hero"],
                "changes": {
                    "operations": [
                        {
                            "op": "set_hero_content",
                            "section": "hero",
                            "fields": {
                                "headline": headline,
                                "subheadline": f"{subheadline} — enhanced with automated enterprise policies.",
                                "cta_text": cta_text,
                                "badge": "Enterprise Ready",
                            },
                        }
                    ]
                },
            }
        elif sec_key == "approval_queue":
            raw_output = {
                "summary": f"Harmonized Approval Queue: Synchronized with Active Configuration (v{curr_version})",
                "reasoning": f"Reconciled policy parameters with active canonical approval queue v{curr_version}.",
                "affected_requirements": orig_prop.affected_requirements or ["REQ_APPROVAL_POLICY"],
                "target_sections": ["approval_queue"],
                "changes": orig_prop.changes or {},
            }
        else:
            raw_output = {
                "summary": f"Reconciled {sec_key} with canonical v{curr_version}",
                "reasoning": f"Adapted proposal to canonical section state v{curr_version}.",
                "affected_requirements": orig_prop.affected_requirements or [],
                "target_sections": target_sections,
                "changes": orig_prop.changes or {},
            }
        source = "cached_fallback"
        is_simulated = True

    # Stamp proposal with the NEW canonical section version
    new_proposal = stamp_and_persist_proposal(
        db=db,
        project_id=project_id,
        run_id=run.id,
        raw_output=raw_output,
        source=source,
        is_simulated=is_simulated,
        supersedes_proposal_id=original_proposal_id,
        prune_metadata=prune_meta,
        created_by="pixel",
        author_type="agent",
        proposal_type="prototype_modification",
        implementation_data=build_pixel_implementation_data(raw_output, project_id),
    )

    # Explicitly ensure base_section_versions matches the CURRENT canonical version
    new_base_sec_vers = dict(new_proposal.base_section_versions or {})
    new_base_sec_vers[sec_key] = curr_version
    new_proposal.base_section_versions = new_base_sec_vers
    new_proposal.base_artifact_version = project.artifact_version
    new_proposal.base_context_version = project.context_version
    new_proposal.status = "pending_review"
    new_proposal.requires_decision = True
    new_proposal.assigned_decider_id = "alex"

    # NOVA Review on reconciled proposal
    review_dict = dict(raw_output)
    review_dict["base_context_version"] = project.context_version
    review_dict["base_section_versions"] = new_base_sec_vers
    review_dict["target_sections"] = target_sections
    review_dict["affected_requirements"] = new_proposal.affected_requirements

    review_result = validate_agent_proposal_output(
        db=db,
        project_id=project_id,
        proposal_dict=review_dict,
        source_agent="pixel",
    )
    new_proposal.reviewed_by = "nova"
    new_proposal.review_outcome = review_result.verdict
    new_proposal.review_findings = [
        {"code": f.code, "severity": f.severity, "message": f.message}
        for f in review_result.findings
    ]

    # Mark original proposal as superseded
    orig_prop.status = "superseded"
    orig_prop.updated_at = utcnow_str()
    db.commit()

    log_event(
        db=db,
        project_id=project_id,
        actor_type="agent",
        actor_id="pixel",
        event_type="PROPOSAL_RECONCILED",
        payload={
            "original_proposal_id": original_proposal_id,
            "new_proposal_id": new_proposal.id,
            "requested_by": requested_by,
            "reconciled_section": sec_key,
            "canonical_version": curr_version,
        },
    )

    run.status = "completed"
    run.lifecycle_state = "completed"
    run.current_proposal_id = new_proposal.id
    run.completed_at = utcnow_str()
    db.commit()
    db.refresh(new_proposal)

    return new_proposal
