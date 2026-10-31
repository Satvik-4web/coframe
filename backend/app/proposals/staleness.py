from typing import List, Dict, Any
from sqlalchemy.orm import Session
from backend.app.db.models import (
    ProposalModel,
    EventModel,
    RequirementModel,
    utcnow_str,
)
from backend.app.events.logger import log_event


def evaluate_selective_staleness(
    db: Session,
    project_id: str,
    changed_requirement_keys: List[str],
    old_value_summary: str = "",
    new_value_summary: str = "",
) -> List[ProposalModel]:
    """
    Evaluates pending proposals against changed requirements.
    Only proposals whose affected_requirements intersect with changed requirements
    are marked stale. Unrelated proposals remain eligible for review!
    """
    pending_proposals = (
        db.query(ProposalModel)
        .filter(ProposalModel.project_id == project_id, ProposalModel.status == "pending_review")
        .all()
    )

    staled_proposals = []
    changed_set = set(changed_requirement_keys)

    for prop in pending_proposals:
        affected_set = set(prop.affected_requirements or [])
        intersection = changed_set.intersection(affected_set)

        if intersection:
            intersected_list = list(intersection)
            plain_reason = (
                f"Requirements [{', '.join(intersected_list)}] changed after this proposal was created."
            )
            if "REQ_AUDIENCE" in intersection:
                plain_reason = f"Written for '{old_value_summary or 'previous audience'}'; the audience is now '{new_value_summary or 'enterprise finance teams'}'."

            prop.status = "stale"
            prop.stale_reason = plain_reason
            prop.updated_at = utcnow_str()
            staled_proposals.append(prop)

            log_event(
                db=db,
                project_id=project_id,
                actor_type="system",
                actor_id="system",
                event_type="PROPOSAL_MARKED_STALE",
                payload={
                    "proposal_id": prop.id,
                    "agent_id": prop.agent_id,
                    "stale_reason": plain_reason,
                    "changed_requirements": intersected_list,
                },
            )

    if staled_proposals:
        db.commit()

    return staled_proposals
