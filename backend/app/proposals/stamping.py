import uuid
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from backend.app.db.models import (
    ProposalModel,
    AgentRunModel,
    EventModel,
    ProjectModel,
    utcnow_str,
)
from backend.app.proposals.validation import validate_proposal_content, compute_decision_policy
from backend.app.events.logger import log_event


def stamp_and_persist_proposal(
    db: Session,
    project_id: str,
    run_id: str,
    raw_output: Dict[str, Any],
    source: str = "live_llm",
    is_simulated: bool = False,
    supersedes_proposal_id: Optional[str] = None,
    prune_metadata: Optional[Dict[str, Any]] = None,
) -> ProposalModel:
    """
    Stamps authoritative backend metadata onto agent-produced content
    using the immutable Context Pack stored on the agent_runs record.
    """
    # 1. Load run and its immutable Context Pack
    run = db.query(AgentRunModel).filter(AgentRunModel.id == run_id).first()
    if not run:
        raise ValueError(f"Agent run {run_id} not found")

    context_pack = run.context_pack
    known_req_keys = [r["id"] for r in context_pack.get("requirements", [])]

    # 2, 3, 4. Validate output schema & content
    validated = validate_proposal_content(
        output_dict=raw_output,
        known_requirement_keys=known_req_keys,
    )

    # 5 & 6. Extract base section versions specifically for the proposal's target sections
    pack_section_versions = context_pack.get("section_versions", {})
    base_section_versions = {
        sec: pack_section_versions.get(sec, 1)
        for sec in validated.target_sections
    }

    # 7. Compute decision policy
    requires_decision, assigned_decider_id = compute_decision_policy(
        affected_requirements=validated.affected_requirements,
        target_sections=validated.target_sections,
        changes=validated.changes,
    )

    # Generate stable backend ID
    proposal_id = f"prop_{uuid.uuid4().hex[:8]}"

    # Ensure authentic Ed25519-signed Prune receipt is attached
    if not prune_metadata:
        try:
            from backend.app.prune import create_prune_receipt
            prune_metadata = create_prune_receipt(
                system_prompt=f"System directive for {run.agent_id}",
                user_prompt=run.task_description,
                data=raw_output,
                model="gemini-2.5-flash",
                source=source,
                is_simulated=is_simulated,
                cache_hit=(source == "cached_fallback"),
            )
        except Exception:
            prune_metadata = None

    # 8. Create proposal record
    proposal = ProposalModel(
        id=proposal_id,
        project_id=project_id,
        agent_id=run.agent_id,
        run_id=run_id,
        supersedes_proposal_id=supersedes_proposal_id,
        summary=validated.summary,
        reasoning=validated.reasoning,
        affected_requirements=validated.affected_requirements,
        target_sections=validated.target_sections,
        changes=validated.changes,
        base_context_version=run.base_context_version,
        base_artifact_version=run.base_artifact_version,
        base_section_versions=base_section_versions,
        requires_decision=requires_decision,
        assigned_decider_id=assigned_decider_id,
        status="pending_review",
        stale_reason=None,
        conflict_reason=None,
        source=source,
        is_simulated=is_simulated,
        prune_metadata=prune_metadata,
        created_at=utcnow_str(),
        updated_at=utcnow_str(),
    )
    db.add(proposal)

    # Update run status & Prune receipt
    run.status = "waiting_for_review"
    run.prune_metadata = prune_metadata
    run.completed_at = utcnow_str()

    db.commit()
    db.refresh(proposal)

    # Log event
    log_event(
        db=db,
        project_id=project_id,
        actor_type="agent",
        actor_id=run.agent_id,
        event_type="PROPOSAL_SUBMITTED",
        context_version=run.base_context_version,
        artifact_version=run.base_artifact_version,
        payload={
            "proposal_id": proposal.id,
            "agent_id": run.agent_id,
            "summary": proposal.summary,
            "affected_requirements": proposal.affected_requirements,
            "target_sections": proposal.target_sections,
            "requires_decision": proposal.requires_decision,
            "assigned_decider_id": proposal.assigned_decider_id,
            "source": source,
            "is_simulated": is_simulated,
        },
    )

    return proposal
