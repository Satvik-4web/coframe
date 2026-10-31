"""
Smart Change Impact Engine
Central Dependency Registry and Impact Analysis Service.
Independently calculates the impact of requirement changes using backend-owned
dependency information, ensuring proposals are correctly classified as STALE,
CONFLICTED, POTENTIALLY_AFFECTED, or UNAFFECTED.
"""

from typing import List, Dict, Any, Optional, Set
from dataclasses import dataclass, field
from sqlalchemy.orm import Session

from backend.app.db.models import (
    ProposalModel,
    RequirementModel,
    ArtifactSectionModel,
    ProjectModel,
    utcnow_str,
)
from backend.app.events.logger import log_event


# ---------------------------------------------------------------------------
# Central Backend Dependency Registry
# ---------------------------------------------------------------------------

REQUIREMENT_DEPENDENCIES: Dict[str, List[str]] = {
    "REQ_AUDIENCE": [
        "product_brief",
        "hero",
    ],
    "REQ_METRICS": [
        "dashboard",
    ],
    "REQ_APPROVAL_POLICY": [
        "approval_queue",
    ],
}


class ProposalImpactClassification:
    STALE = "STALE"
    CONFLICTED = "CONFLICTED"
    POTENTIALLY_AFFECTED = "POTENTIALLY_AFFECTED"
    UNAFFECTED = "UNAFFECTED"


@dataclass
class ProposalImpactExplanation:
    proposal_id: str
    agent_id: str
    classification: str
    changed_requirement: str
    previous_value: str
    new_value: str
    affected_sections: List[str]
    reason: str
    recommended_action: str
    is_stale: bool = False
    is_conflicted: bool = False


@dataclass
class ImpactAnalysisResult:
    project_id: str
    changed_requirements: List[str]
    stale_count: int
    conflict_count: int
    potentially_affected_count: int
    unaffected_count: int
    explanations: List[ProposalImpactExplanation] = field(default_factory=list)
    affected_proposals: List[ProposalModel] = field(default_factory=list)


def get_sections_for_requirement(requirement_key: str) -> List[str]:
    """Returns all artifact sections dependent on a specific requirement key."""
    return REQUIREMENT_DEPENDENCIES.get(requirement_key, [])


def get_requirements_for_section(section_key: str) -> List[str]:
    """Returns all requirements that a specific artifact section depends upon."""
    dependent_reqs = []
    for req_key, sections in REQUIREMENT_DEPENDENCIES.items():
        if section_key in sections:
            dependent_reqs.append(req_key)
    return dependent_reqs


def calculate_requirement_impact(
    db: Session,
    project_id: str,
    changed_requirement_keys: List[str],
    old_value_summary: str = "",
    new_value_summary: str = "",
) -> ImpactAnalysisResult:
    """
    Independently calculates impact when requirements change mid-flight.
    Inspects pending proposals, checks agent-declared dependencies AND
    backend registry section dependencies, and classifies proposals as:
      - STALE: Requirement changed after proposal was formulated
      - CONFLICTED: Section was updated after proposal base section version
      - POTENTIALLY_AFFECTED: Related but not directly obsoleted
      - UNAFFECTED: Independent work remains eligible for human review
    """
    pending_proposals = (
        db.query(ProposalModel)
        .filter(ProposalModel.project_id == project_id, ProposalModel.status == "pending_review")
        .all()
    )

    current_sections = {
        s.section_key: s
        for s in db.query(ArtifactSectionModel)
        .filter(ArtifactSectionModel.project_id == project_id)
        .all()
    }

    changed_set = set(changed_requirement_keys)
    result = ImpactAnalysisResult(
        project_id=project_id,
        changed_requirements=changed_requirement_keys,
        stale_count=0,
        conflict_count=0,
        potentially_affected_count=0,
        unaffected_count=0,
    )

    updated_proposals = []

    for prop in pending_proposals:
        affected_reqs = set(prop.affected_requirements or [])
        target_secs = prop.target_sections or []
        base_sec_vers = prop.base_section_versions or {}

        # 1. Check direct requirement intersection
        direct_req_intersect = changed_set.intersection(affected_reqs)

        # 2. Check registry-inferred requirement intersection if undeclared
        inferred_req_intersect = set()
        if not affected_reqs:
            for sec_key in target_secs:
                dep_reqs = get_requirements_for_section(sec_key)
                inferred_req_intersect.update(changed_set.intersection(dep_reqs))

        all_req_intersect = direct_req_intersect.union(inferred_req_intersect)
        is_stale = len(all_req_intersect) > 0

        # 3. Check section version conflict (Human edit vs Agent base section version)
        has_section_conflict = False
        conflict_sec_keys = []
        for sec_key in target_secs:
            base_ver = base_sec_vers.get(sec_key, 1)
            current_sec = current_sections.get(sec_key)
            if current_sec and current_sec.version > base_ver:
                has_section_conflict = True
                conflict_sec_keys.append(sec_key)

        # Determine classification
        if is_stale and has_section_conflict:
            classification = ProposalImpactClassification.CONFLICTED
            result.conflict_count += 1
            result.stale_count += 1
        elif is_stale:
            classification = ProposalImpactClassification.STALE
            result.stale_count += 1
        elif has_section_conflict:
            classification = ProposalImpactClassification.CONFLICTED
            result.conflict_count += 1
        elif len(target_secs) > 0:
            classification = ProposalImpactClassification.UNAFFECTED
            result.unaffected_count += 1
        else:
            classification = ProposalImpactClassification.UNAFFECTED
            result.unaffected_count += 1

        # Build structured explanation
        stale_msg = ""
        conflict_msg = ""
        if is_stale:
            if "REQ_AUDIENCE" in all_req_intersect:
                stale_msg = f"Written for '{old_value_summary or 'Small businesses'}'; the audience is now '{new_value_summary or 'Enterprise finance teams'}'."
            else:
                stale_msg = f"Requirement [{', '.join(all_req_intersect)}] changed after this proposal was created."

        if has_section_conflict:
            conflict_msg = f"Sections [{', '.join(conflict_sec_keys)}] have been updated by human edits to higher versions."

        explanation_reason = stale_msg or conflict_msg or "Proposal remains unaffected by requirement updates."
        recommended_action = (
            "Reconcile proposal with latest enterprise context."
            if is_stale
            else "Inspect human version conflict in side-by-side compare modal."
            if has_section_conflict
            else "Ready for human review and approval."
        )

        explanation = ProposalImpactExplanation(
            proposal_id=prop.id,
            agent_id=prop.agent_id,
            classification=classification,
            changed_requirement=", ".join(changed_requirement_keys),
            previous_value=old_value_summary,
            new_value=new_value_summary,
            affected_sections=target_secs,
            reason=explanation_reason,
            recommended_action=recommended_action,
            is_stale=is_stale,
            is_conflicted=has_section_conflict,
        )
        result.explanations.append(explanation)

        # Update proposal state if affected
        if is_stale or has_section_conflict:
            if has_section_conflict:
                prop.status = "conflict"
                prop.conflict_reason = conflict_msg
                if is_stale:
                    prop.stale_reason = stale_msg
            elif is_stale:
                prop.status = "stale"
                prop.stale_reason = stale_msg

            prop.updated_at = utcnow_str()
            updated_proposals.append(prop)
            result.affected_proposals.append(prop)

            # Log system event
            log_event(
                db=db,
                project_id=project_id,
                actor_type="system",
                actor_id="system",
                event_type="PROPOSAL_MARKED_STALE" if is_stale else "PROPOSAL_CONFLICT_DETECTED",
                payload={
                    "proposal_id": prop.id,
                    "agent_id": prop.agent_id,
                    "classification": classification,
                    "stale_reason": stale_msg,
                    "conflict_reason": conflict_msg,
                    "changed_requirements": list(all_req_intersect),
                    "affected_sections": target_secs,
                },
            )

    if updated_proposals:
        db.commit()

    # Log overarching impact event
    log_event(
        db=db,
        project_id=project_id,
        actor_type="system",
        actor_id="system",
        event_type="impact.calculated",
        payload={
            "changed_requirements": changed_requirement_keys,
            "stale_count": result.stale_count,
            "conflict_count": result.conflict_count,
            "unaffected_count": result.unaffected_count,
        },
        auto_commit=True,
    )

    return result


def revalidate_proposal_at_apply(
    db: Session,
    project_id: str,
    proposal: ProposalModel,
) -> Optional[str]:
    """
    Approval-time revalidation guard.
    Returns None if valid and safe to apply, or an error message if invalid.
    """
    if proposal.status != "pending_review":
        return f"Proposal is not pending review (status: {proposal.status})"

    # Recheck section versions
    current_sections = {
        s.section_key: s
        for s in db.query(ArtifactSectionModel)
        .filter(ArtifactSectionModel.project_id == project_id)
        .all()
    }
    for sec_key in proposal.target_sections or []:
        current_sec = current_sections.get(sec_key)
        expected_ver = (proposal.base_section_versions or {}).get(sec_key, 1)
        if current_sec and current_sec.version != expected_ver:
            return f"Section '{sec_key}' was modified to version {current_sec.version} (expected {expected_ver})."

    # Recheck requirement staleness
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if project and proposal.base_context_version < project.context_version:
        # Check if any affected requirements changed
        for req_key in proposal.affected_requirements or []:
            req = (
                db.query(RequirementModel)
                .filter(
                    RequirementModel.project_id == project_id,
                    RequirementModel.requirement_key == req_key,
                )
                .first()
            )
            if req and req.version > 1:
                return f"Requirement '{req_key}' was updated to version {req.version}."

    return None
