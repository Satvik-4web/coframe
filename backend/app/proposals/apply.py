from typing import Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import select
from backend.app.db.models import (
    ProposalModel,
    ArtifactSectionModel,
    ProjectModel,
    DecisionModel,
    RequirementModel,
    EventModel,
    utcnow_str,
)
from backend.app.events.logger import log_event


class ApplyValidationError(Exception):
    def __init__(self, message: str, is_conflict: bool = False, is_stale: bool = False, is_forbidden: bool = False):
        super().__init__(message)
        self.message = message
        self.is_conflict = is_conflict
        self.is_stale = is_stale
        self.is_forbidden = is_forbidden


def apply_proposal_atomically(
    db: Session,
    project_id: str,
    proposal_id: str,
    decided_by: str,
) -> ProposalModel:
    """
    Executes atomic, transactional apply-time validation and updates.
    Prevents partial writes. Guarantees compare-and-swap version checks.
    """
    # 1. Fetch proposal
    proposal = (
        db.query(ProposalModel)
        .filter(ProposalModel.id == proposal_id, ProposalModel.project_id == project_id)
        .first()
    )
    if not proposal:
        raise ApplyValidationError(f"Proposal {proposal_id} not found")

    if proposal.status != "pending_review":
        raise ApplyValidationError(f"Proposal is not in 'pending_review' state (current: {proposal.status})")

    # 2. Check Decision Permission (Section 8)
    if proposal.requires_decision:
        if proposal.assigned_decider_id and decided_by.lower() != proposal.assigned_decider_id.lower():
            raise ApplyValidationError(
                f"Permission denied: This high-impact proposal requires decision by {proposal.assigned_decider_id.upper()}. '{decided_by.capitalize()}' is not authorized to approve it.",
                is_forbidden=True,
            )

    # 3. Lock Project & Verify Context Staleness
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).with_for_update(nowait=False).first()
    if not project:
        raise ApplyValidationError(f"Project {project_id} not found")

    # Check if any affected requirements have changed since base_context_version
    affected_reqs = set(proposal.affected_requirements or [])
    if affected_reqs:
        # Check requirement versions in project
        current_reqs = (
            db.query(RequirementModel)
            .filter(RequirementModel.project_id == project_id)
            .all()
        )
        for req in current_reqs:
            if req.requirement_key in affected_reqs:
                # If requirement version > 1 or context version has advanced with req events
                events = (
                    db.query(EventModel)
                    .filter(
                        EventModel.project_id == project_id,
                        EventModel.event_type == "HUMAN_REQUIREMENT_EDITED",
                        EventModel.context_version > proposal.base_context_version,
                    )
                    .all()
                )
                for ev in events:
                    if ev.payload.get("requirement_key") == req.requirement_key:
                        proposal.status = "stale"
                        proposal.stale_reason = f"Requirement '{req.requirement_key}' was changed after this proposal was created."
                        db.commit()
                        raise ApplyValidationError(
                            f"Atomic apply aborted: Proposal is STALE. {proposal.stale_reason}",
                            is_stale=True,
                        )

    # 4. Check Section Version compare-and-swap for all target sections
    target_sections = proposal.target_sections or []
    base_section_versions = proposal.base_section_versions or {}

    sections_to_update = {}
    for sec_key in target_sections:
        sec_model = (
            db.query(ArtifactSectionModel)
            .filter(
                ArtifactSectionModel.project_id == project_id,
                ArtifactSectionModel.section_key == sec_key,
            )
            .with_for_update(nowait=False)
            .first()
        )
        if not sec_model:
            raise ApplyValidationError(f"Target artifact section '{sec_key}' does not exist")

        expected_version = base_section_versions.get(sec_key)
        if expected_version is None:
            expected_version = sec_model.version  # fallback if not stamped

        if sec_model.version != expected_version:
            # Conflict detected! Rollback and mark proposal conflict
            proposal.status = "conflict"
            proposal.conflict_reason = (
                f"Section '{sec_key}' has evolved to version {sec_model.version} "
                f"(proposal was based on version {expected_version})."
            )
            db.commit()
            raise ApplyValidationError(
                f"Atomic apply aborted: CONFLICT detected on section '{sec_key}'. {proposal.conflict_reason}",
                is_conflict=True,
            )

        sections_to_update[sec_key] = sec_model

    # 5. Apply validated change operations in memory first
    operations = proposal.changes.get("operations", [])
    applied_sections = set()

    for op in operations:
        op_name = op.get("op")
        if op_name == "update_product_brief":
            sec = sections_to_update.get("product_brief")
            if sec:
                new_data = dict(sec.data)
                fields = op.get("fields", {})
                for k, v in fields.items():
                    new_data[k] = v
                sec.data = new_data
                applied_sections.add("product_brief")

        elif op_name == "set_hero_content":
            sec = sections_to_update.get("hero")
            if sec:
                new_data = dict(sec.data)
                fields = op.get("fields", {})
                for k, v in fields.items():
                    new_data[k] = v
                sec.data = new_data
                applied_sections.add("hero")

        elif op_name == "set_dashboard_metrics":
            sec = sections_to_update.get("dashboard")
            if sec:
                new_data = dict(sec.data)
                if "metrics" in op:
                    new_data["metrics"] = op["metrics"]
                if "categories" in op:
                    new_data["categories"] = op["categories"]
                if "title" in op:
                    new_data["title"] = op["title"]
                sec.data = new_data
                applied_sections.add("dashboard")

        elif op_name == "set_approval_queue_config":
            sec = sections_to_update.get("approval_queue")
            if sec:
                new_data = dict(sec.data)
                config = op.get("config", {})
                for k, v in config.items():
                    new_data[k] = v
                if "items" in op:
                    new_data["items"] = op["items"]
                sec.data = new_data
                applied_sections.add("approval_queue")

    # 6. Execute atomic version increments for all updated sections
    for sec_key in applied_sections:
        sec = sections_to_update[sec_key]
        sec.version += 1
        sec.updated_by = f"agent:{proposal.agent_id}"
        sec.updated_at = utcnow_str()

    # 7. Increment global artifact version
    project.artifact_version += 1
    project.updated_at = utcnow_str()

    # 8. Record approval decision and update proposal status
    proposal.status = "approved"
    proposal.updated_at = utcnow_str()

    decision = DecisionModel(
        proposal_id=proposal.id,
        decision="approved",
        decided_by=decided_by,
        note=f"Approved by {decided_by.capitalize()}",
        created_at=utcnow_str(),
    )
    db.add(decision)

    # 9. Append atomic apply event
    log_event(
        db=db,
        project_id=project_id,
        actor_type="human",
        actor_id=decided_by,
        event_type="PROPOSAL_APPROVED",
        context_version=project.context_version,
        artifact_version=project.artifact_version,
        payload={
            "proposal_id": proposal.id,
            "agent_id": proposal.agent_id,
            "summary": proposal.summary,
            "target_sections": list(applied_sections),
            "decided_by": decided_by,
            "new_artifact_version": project.artifact_version,
        },
    )

    db.commit()
    db.refresh(proposal)
    db.refresh(project)
    return proposal


def apply_manual_section_edit(
    db: Session,
    project_id: str,
    section_key: str,
    new_data: Dict[str, Any],
    expected_version: int,
    editor_id: str = "maya",
) -> ArtifactSectionModel:
    """
    Atomic compare-and-swap manual section edit by a human (e.g., Maya).
    """
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).with_for_update(nowait=False).first()
    if not project:
        raise ValueError(f"Project {project_id} not found")

    sec = (
        db.query(ArtifactSectionModel)
        .filter(
            ArtifactSectionModel.project_id == project_id,
            ArtifactSectionModel.section_key == section_key,
        )
        .with_for_update(nowait=False)
        .first()
    )
    if not sec:
        raise ValueError(f"Artifact section '{section_key}' not found")

    # Compare-and-swap check
    if sec.version != expected_version:
        raise ValueError(
            f"Section edit conflict: Expected version {expected_version}, but section is already at version {sec.version}."
        )

    # Update section
    sec.data = new_data
    sec.version += 1
    sec.updated_by = editor_id
    sec.updated_at = utcnow_str()

    # Increment global artifact version
    project.artifact_version += 1
    project.updated_at = utcnow_str()

    # Log human section edit event
    log_event(
        db=db,
        project_id=project_id,
        actor_type="human",
        actor_id=editor_id,
        event_type="HUMAN_SECTION_EDITED",
        context_version=project.context_version,
        artifact_version=project.artifact_version,
        payload={
            "section_key": section_key,
            "previous_version": expected_version,
            "new_version": sec.version,
            "editor_id": editor_id,
        },
    )

    db.commit()
    db.refresh(sec)
    db.refresh(project)

    # Check for conflicts with existing proposals targeting this section
    from backend.app.proposals.conflicts import evaluate_section_conflicts
    evaluate_section_conflicts(
        db=db,
        project_id=project_id,
        modified_section_key=section_key,
        editor_name=editor_id.capitalize(),
    )

    return sec
