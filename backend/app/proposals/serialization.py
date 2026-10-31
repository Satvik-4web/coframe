from typing import Dict, Any, Optional
from backend.app.db.models import ProposalModel


def serialize_proposal_for_api(p: ProposalModel) -> Dict[str, Any]:
    """
    Serializes a ProposalModel into the authoritative COFRAME API response format,
    strictly distinguishing AUTHOR, REVIEWER, and DECISION OWNER without fabrication.
    """
    # 1. Author and Author Type resolution
    author_id = p.created_by
    author_type = getattr(p, "author_type", None) or "agent"

    if not author_id:
        if p.agent_id in ("nova", "pixel"):
            author_id = p.agent_id
            author_type = "agent"
        elif p.agent_id in ("alex", "maya"):
            author_id = p.agent_id
            author_type = "human"
        else:
            # Acceptance Criterion 9: Legacy proposals with incomplete metadata
            # do not receive fabricated authorship.
            author_id = "Legacy / Unknown author"
            author_type = "unknown"

    # 2. Author Display Name and Role
    author_key = author_id.lower()
    if author_key == "nova":
        author_name = "NOVA"
        author_role = "AI Product Strategist"
        author_label = "NOVA · PRD"
    elif author_key == "pixel":
        author_name = "PIXEL"
        author_role = "AI Software Engineer"
        author_label = "PIXEL · Implementation"
    elif author_key == "alex":
        author_name = "Alex"
        author_role = "Founder / Decision Owner"
        author_label = "Human Contribution"
    elif author_key == "maya":
        author_name = "Maya"
        author_role = "Product Designer"
        author_label = "Human Contribution"
    elif author_id == "Legacy / Unknown author":
        author_name = "Legacy / Unknown author"
        author_role = "Unspecified Origin"
        author_label = "Legacy Contribution"
    else:
        author_name = author_id.capitalize()
        author_role = "Contributor"
        author_label = "Human Contribution" if author_type == "human" else "Contribution"

    # 3. Contribution Type Category
    raw_ptype = getattr(p, "proposal_type", None) or ""
    if author_type == "human" or raw_ptype == "human_contribution":
        contribution_type = "HUMAN CONTRIBUTION"
        proposal_type = "human_contribution"
    elif author_key == "nova" or raw_ptype in ("prd_requirement", "requirements", "product_requirements"):
        contribution_type = "PRODUCT REQUIREMENTS"
        proposal_type = raw_ptype or "prd_requirement"
    else:
        contribution_type = "IMPLEMENTATION"
        proposal_type = raw_ptype or "prototype_modification"

    # 4. Task ID resolution
    task_id = getattr(p, "task_id", None) or p.run_id or "task_default"

    # 5. Reviewer resolution
    reviewed_by = getattr(p, "reviewed_by", None)
    reviewer_name = None
    if reviewed_by:
        if reviewed_by.lower() in ("nova", "nova_strategist"):
            reviewer_name = "NOVA"
        else:
            reviewer_name = reviewed_by.capitalize()

    return {
        "proposal_id": p.id,
        "project_id": p.project_id,
        "agent_id": p.agent_id,
        "created_by": p.created_by or (author_id if author_id != "Legacy / Unknown author" else None),
        "author": author_name,
        "author_type": author_type,
        "author_role": author_role,
        "author_label": author_label,
        "contribution_type": contribution_type,
        "proposal_type": proposal_type,
        "task_id": task_id,
        "run_id": p.run_id,
        "supersedes_proposal_id": p.supersedes_proposal_id,
        "summary": p.summary,
        "reasoning": p.reasoning,
        "affected_requirements": p.affected_requirements or [],
        "target_sections": p.target_sections or [],
        "changes": p.changes or {},
        "base_context_version": p.base_context_version,
        "base_artifact_version": p.base_artifact_version,
        "base_section_versions": p.base_section_versions or {},
        "requires_decision": p.requires_decision,
        "assigned_decider_id": p.assigned_decider_id,
        "reviewed_by": reviewer_name,
        "review_outcome": getattr(p, "review_outcome", None),
        "review_findings": getattr(p, "review_findings", None) or [],
        "status": p.status,
        "stale_reason": p.stale_reason,
        "conflict_reason": p.conflict_reason,
        "source": p.source,
        "is_simulated": p.is_simulated,
        "prune_metadata": getattr(p, "prune_metadata", None),
        "created_at": p.created_at,
        "updated_at": p.updated_at,
    }
