from backend.app.schemas.proposals import (
    NovaReviewStatus,
    NovaRecommendedAction,
    NovaReverificationResult,
)
from backend.app.agents.prompts.reverify_prompt import NOVA_REVERIFY_SYSTEM_PROMPT
from backend.app.impact.impact_engine import (
    get_backend_inferred_requirements,
    get_effective_dependencies,
)
import uuid
import json
import logging
from typing import Dict, Any, List, Optional, Set
from sqlalchemy.orm import Session

from backend.app.context.pack_builder import create_and_persist_agent_run, build_context_pack
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
from backend.app.db.models import ProposalModel, AgentRunModel, RequirementModel, utcnow_str
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
        target_sections=["product_brief", "dashboard"],
        affected_requirements=["REQ_AUDIENCE", "REQ_METRICS"],
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

    if raw_a and isinstance(raw_a, dict):
        raw_a["affected_requirements"] = ["REQ_AUDIENCE"]

    prop_a = stamp_and_persist_proposal(
        db=db,
        project_id=project_id,
        run_id=run.id,
        raw_output=raw_a,
        source=source_a,
        is_simulated=sim_a,
        prune_metadata=prune_meta_a,
        prd_data=raw_a.get("prd_data") if isinstance(raw_a, dict) else None,
        created_by="nova",
        author_type="agent",
        proposal_type="prd_requirement",
    )
    created_proposals.append(prop_a)

    # Proposal B — Metrics Insight
    user_prompt_b = (
        f"Analyze REQ_METRICS in this Context Pack:\n{json.dumps(pack, indent=2)}\n"
        f"Propose metric visibility update for 'dashboard'. Note: This proposal must specifically and only target REQ_METRICS."
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

    if raw_b and isinstance(raw_b, dict):
        raw_b["affected_requirements"] = ["REQ_METRICS"]

    prop_b = stamp_and_persist_proposal(
        db=db,
        project_id=project_id,
        run_id=run.id,
        raw_output=raw_b,
        source=source_b,
        is_simulated=sim_b,
        prune_metadata=prune_meta_b,
        prd_data=raw_b.get("prd_data") if isinstance(raw_b, dict) else None,
        created_by="nova",
        author_type="agent",
        proposal_type="prd_requirement",
    )
    created_proposals.append(prop_b)

    run.status = "completed"
    run.lifecycle_state = "completed"
    run.completed_at = utcnow_str()
    db.commit()

    return created_proposals



def _record_nova_review(
    db: Session,
    project_id: str,
    proposal: ProposalModel,
    result: NovaReverificationResult,
):
    proposal.reviewed_by = "nova"
    if result.review_status == NovaReviewStatus.AFFECTED:
        proposal.review_outcome = "WARNING"
    elif result.review_status == NovaReviewStatus.NOT_AFFECTED:
        proposal.review_outcome = "PASS"
    elif result.review_status == NovaReviewStatus.UNCERTAIN:
        proposal.review_outcome = "WARNING"
    elif result.review_status == NovaReviewStatus.REVIEW_FAILED:
        proposal.review_outcome = "BLOCK"

    review_dict = result.model_dump()
    existing_findings = proposal.review_findings or []
    if not isinstance(existing_findings, list):
        existing_findings = []

    updated_findings = [f for f in existing_findings if isinstance(f, dict) and f.get("code") != "NOVA_REVERIFICATION"]
    updated_findings.append({
        "code": "NOVA_REVERIFICATION",
        "severity": "BLOCK" if result.review_status == NovaReviewStatus.REVIEW_FAILED else ("WARNING" if result.review_status in (NovaReviewStatus.AFFECTED, NovaReviewStatus.UNCERTAIN) else "INFO"),
        "message": result.impact_explanation,
        "details": review_dict,
    })
    proposal.review_findings = updated_findings

    if hasattr(proposal, "nova_review"):
        proposal.nova_review = review_dict

    if result.review_status == NovaReviewStatus.REVIEW_FAILED:
        if proposal.status not in ("conflict", "superseded", "approved", "rejected"):
            proposal.status = "stale"
            reason = f"NOVA review failed: {result.impact_explanation}"
            if not proposal.stale_reason:
                proposal.stale_reason = reason
            elif reason not in proposal.stale_reason:
                proposal.stale_reason += f" | {reason}"

    elif result.review_status == NovaReviewStatus.AFFECTED:
        if result.missing_dependencies:
            current_reqs = list(proposal.affected_requirements or [])
            for dep in result.missing_dependencies:
                if dep not in current_reqs:
                    current_reqs.append(dep)
            proposal.affected_requirements = current_reqs

        if proposal.status not in ("conflict", "superseded", "approved", "rejected"):
            proposal.status = "stale"
            if not proposal.stale_reason:
                proposal.stale_reason = f"NOVA re-verification: {result.impact_explanation}"
            elif result.impact_explanation not in proposal.stale_reason:
                proposal.stale_reason += f" | NOVA review: {result.impact_explanation}"

    elif result.review_status == NovaReviewStatus.UNCERTAIN:
        proposal.requires_decision = True
        if not proposal.assigned_decider_id:
            proposal.assigned_decider_id = "alex"
        if not proposal.stale_reason and result.impact_explanation:
            proposal.stale_reason = f"NOVA review uncertain: {result.impact_explanation}"

    proposal.updated_at = utcnow_str()
    db.commit()

    log_event(
        db=db,
        project_id=project_id,
        actor_type="agent",
        actor_id="nova",
        event_type="NOVA_REVERIFICATION_RECORDED",
        context_version=proposal.base_context_version,
        artifact_version=proposal.base_artifact_version,
        payload={
            "proposal_id": proposal.id,
            "review_status": result.review_status.value,
            "missing_dependencies": result.missing_dependencies,
            "affected_sections": result.affected_sections,
            "impact_explanation": result.impact_explanation,
            "recommended_action": result.recommended_action.value,
            "confidence": result.confidence,
            "reviewed_requirement_versions": result.reviewed_requirement_versions,
        },
        auto_commit=True,
    )


async def reverify_proposal_with_nova(
    db: Session,
    project_id: str,
    proposal_id: str,
    changed_requirement_keys: Optional[List[str]] = None,
    old_value_summary: str = "",
    new_value_summary: str = "",
    impact_findings: Optional[Dict[str, Any]] = None,
) -> NovaReverificationResult:
    """
    Executes independent NOVA AI re-verification for a proposal when requirements evolve.
    NOVA independently analyzes the original proposal, target sections, declared vs backend-inferred
    dependencies, and latest Context Pack to identify missing dependencies and assess impact.
    Never silently treats failures as successful.
    """
    prop = db.query(ProposalModel).filter(
        ProposalModel.id == proposal_id,
        ProposalModel.project_id == project_id,
    ).first()
    if not prop:
        raise ValueError(f"Proposal {proposal_id} not found in project {project_id}")

    reqs = db.query(RequirementModel).filter(RequirementModel.project_id == project_id).all()
    current_req_versions = {r.requirement_key: r.version for r in reqs}
    req_map = {r.requirement_key: r for r in reqs}

    declared_deps = list(prop.affected_requirements or [])
    target_secs = list(prop.target_sections or [])
    ops = (prop.changes or {}).get("operations", []) if isinstance(prop.changes, dict) else []
    backend_inferred = list(get_backend_inferred_requirements(target_secs, ops))
    effective_deps = list(get_effective_dependencies(declared_deps, target_secs, ops))

    changed_keys = changed_requirement_keys or []
    changed_req_details = {}
    for k in changed_keys:
        r_obj = req_map.get(k)
        changed_req_details[k] = {
            "current_version": r_obj.version if r_obj else None,
            "value": r_obj.value if r_obj else None,
            "old_value_summary": old_value_summary,
            "new_value_summary": new_value_summary,
        }

    # Build fresh Context Pack for NOVA review
    run_rev_id = f"run_nova_rev_{uuid.uuid4().hex[:6]}"
    pack = build_context_pack(
        db=db,
        project_id=project_id,
        agent_id="nova",
        run_id=run_rev_id,
        task_id=f"task_reverify_{prop.id}",
        task_description=f"Independently re-verify proposal {prop.id} against changed requirements {changed_keys}",
    )

    prop_dump = json.dumps({
        "proposal_id": prop.id,
        "agent_id": prop.agent_id,
        "created_by": prop.created_by,
        "summary": prop.summary,
        "reasoning": prop.reasoning,
        "target_sections": target_secs,
        "declared_dependencies": declared_deps,
        "changes": prop.changes,
        "base_context_version": prop.base_context_version,
        "base_section_versions": prop.base_section_versions,
    }, indent=2)
    changed_details_dump = json.dumps(changed_req_details, indent=2)
    req_versions_dump = json.dumps(current_req_versions, indent=2)
    impact_findings_dump = json.dumps(impact_findings or {}, indent=2)
    reqs_dump = json.dumps([{"key": r.key, "title": r.title, "version": r.version, "value": r.value} for r in pack.requirements], indent=2)
    artifacts_dump = json.dumps({k: {"version": v["version"], "data": v["data"]} for k, v in pack.artifact_summary.items()}, indent=2)

    user_prompt = (
        f"INDEPENDENT PROPOSAL RE-VERIFICATION TASK\n"
        f"-----------------------------------------\n"
        f"Original Proposal:\n{prop_dump}\n\n"
        f"Backend Dependency Registry Analysis:\n"
        f"- Backend-inferred dependencies for target sections {target_secs}: {backend_inferred}\n"
        f"- Effective combined dependencies: {effective_deps}\n\n"
        f"Requirement Changes Detected:\n"
        f"- Changed requirement keys: {changed_keys}\n"
        f"- Change details: {changed_details_dump}\n"
        f"- Proposal base context version: v{prop.base_context_version}\n"
        f"- Current workspace context version: v{pack.context_version}\n"
        f"- Current requirement versions: {req_versions_dump}\n\n"
        f"Deterministic Impact Engine Findings:\n{impact_findings_dump}\n\n"
        f"Workspace Context Summary:\n"
        f"- Requirements: {reqs_dump}\n"
        f"- Artifact Sections: {artifacts_dump}\n\n"
        f"Task: Reason independently about whether this proposal is affected by the changed requirements. Identify whether any requirement dependencies were missed by the agent. Explain the impact and specify recommended_action ('REGENERATE', 'REVIEW_MANUALLY', or 'NO_CHANGE')."
    )

    raw_output = None
    try:
        res = await call_llm_json(
            system_prompt=NOVA_REVERIFY_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            timeout=8.0,
            model=get_effective_model("nova"),
            agent_id="nova",
            tools=get_agent_tools("nova"),
        )
        raw_output = res[0] if isinstance(res, tuple) else res
    except Exception as e:
        logger.warning(f"NOVA independent review call failed or timed out: {e}")
        result = NovaReverificationResult(
            review_status=NovaReviewStatus.REVIEW_FAILED,
            missing_dependencies=[],
            affected_sections=target_secs,
            impact_explanation=f"NOVA review call failed or timed out: {str(e)}",
            recommended_action=NovaRecommendedAction.REVIEW_MANUALLY,
            confidence=0.0,
            reviewed_requirement_versions=current_req_versions,
        )
        _record_nova_review(db, project_id, prop, result)
        return result

    try:
        if not isinstance(raw_output, dict):
            raise ValueError(f"Output must be a JSON object, got {type(raw_output)}")
        if "reviewed_requirement_versions" not in raw_output or not raw_output["reviewed_requirement_versions"]:
            raw_output["reviewed_requirement_versions"] = current_req_versions
        result = NovaReverificationResult.model_validate(raw_output)
    except Exception as e:
        logger.warning(f"NOVA review response failed validation: {e}")
        result = NovaReverificationResult(
            review_status=NovaReviewStatus.REVIEW_FAILED,
            missing_dependencies=[],
            affected_sections=target_secs,
            impact_explanation=f"NOVA returned invalid structured review: {str(e)}",
            recommended_action=NovaRecommendedAction.REVIEW_MANUALLY,
            confidence=0.0,
            reviewed_requirement_versions=current_req_versions,
        )
        _record_nova_review(db, project_id, prop, result)
        return result

    _record_nova_review(db, project_id, prop, result)
    return result


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
        if "hero" in (orig_prop.target_sections or []):
            nova_review_data = getattr(orig_prop, "nova_review", None)
            missing_deps = nova_review_data.get("missing_dependencies", []) if nova_review_data else []
            raw_output = {
                "summary": "Enterprise Spend Governance Hero Banner",
                "reasoning": f"Reconciled hero banner with updated requirements. Resolves missing dependencies: {missing_deps}.",
                "affected_requirements": list(get_effective_dependencies(orig_prop.affected_requirements, orig_prop.target_sections)),
                "target_sections": ["hero"],
                "changes": {
                    "operations": [
                        {
                            "op": "set_hero_content",
                            "fields": {
                                "headline": "Enterprise Spend Governance & Compliance",
                                "subheadline": "Real-time policy controls, ERP synchronization, and automated audit trails for global finance teams.",
                                "cta_text": "Request Enterprise Access",
                            },
                        }
                    ]
                },
            }
        else:
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

    run.status = "completed"
    run.lifecycle_state = "completed"
    run.completed_at = utcnow_str()
    db.commit()

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

    run.status = "completed"
    run.lifecycle_state = "completed"
    run.completed_at = utcnow_str()
    db.commit()

    return new_proposal
