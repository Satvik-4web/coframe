from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from backend.app.db.models import (
    ProposalModel,
    ArtifactSectionModel,
    EventModel,
    utcnow_str,
)
from backend.app.events.logger import log_event


def evaluate_section_conflicts(
    db: Session,
    project_id: str,
    modified_section_key: str,
    editor_name: str = "Maya",
) -> List[ProposalModel]:
    """
    Evaluates pending proposals targeting a modified section.
    If proposal was based on an older section version, mark it as CONFLICT.
    """
    section = (
        db.query(ArtifactSectionModel)
        .filter(
            ArtifactSectionModel.project_id == project_id,
            ArtifactSectionModel.section_key == modified_section_key,
        )
        .first()
    )
    if not section:
        return []

    pending_proposals = (
        db.query(ProposalModel)
        .filter(ProposalModel.project_id == project_id, ProposalModel.status == "pending_review")
        .all()
    )

    conflicted_proposals = []
    for prop in pending_proposals:
        target_sections = prop.target_sections or []
        if modified_section_key in target_sections:
            base_versions = prop.base_section_versions or {}
            base_sec_ver = base_versions.get(modified_section_key, 1)

            if base_sec_ver < section.version:
                plain_reason = (
                    f"{editor_name} updated the '{modified_section_key}' section (now v{section.version}) "
                    f"after {prop.agent_id.upper()} created this proposal (based on v{base_sec_ver})."
                )
                prop.status = "conflict"
                prop.conflict_reason = plain_reason
                prop.updated_at = utcnow_str()
                conflicted_proposals.append(prop)

                log_event(
                    db=db,
                    project_id=project_id,
                    actor_type="system",
                    actor_id="system",
                    event_type="PROPOSAL_MARKED_CONFLICT",
                    payload={
                        "proposal_id": prop.id,
                        "agent_id": prop.agent_id,
                        "section_key": modified_section_key,
                        "base_version": base_sec_ver,
                        "current_version": section.version,
                        "conflict_reason": plain_reason,
                    },
                )

    if conflicted_proposals:
        db.commit()

    return conflicted_proposals
