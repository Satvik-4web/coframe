from typing import List, Dict, Any
from sqlalchemy.orm import Session
from backend.app.db.models import ProposalModel
from backend.app.impact.impact_engine import calculate_requirement_impact


def evaluate_selective_staleness(
    db: Session,
    project_id: str,
    changed_requirement_keys: List[str],
    old_value_summary: str = "",
    new_value_summary: str = "",
) -> List[ProposalModel]:
    """
    Evaluates pending proposals against changed requirements using the Smart Change Impact Engine.
    Only proposals whose affected requirements or target sections depend on the changed requirements
    are marked stale. Unrelated proposals remain eligible for review!
    """
    impact_result = calculate_requirement_impact(
        db=db,
        project_id=project_id,
        changed_requirement_keys=changed_requirement_keys,
        old_value_summary=old_value_summary,
        new_value_summary=new_value_summary,
    )
    return impact_result.affected_proposals
