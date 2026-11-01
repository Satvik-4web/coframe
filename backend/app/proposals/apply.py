import uuid
import json
from typing import Dict, Any, Tuple, Optional
from sqlalchemy.orm import Session
from sqlalchemy import update
from backend.app.db.models import (
    ProposalModel,
    ArtifactSectionModel,
    ArtifactSectionVersionModel,
    ProjectModel,
    DecisionModel,
    RequirementModel,
    EventModel,
    GitHubConnectionModel,
    GitHubSyncJobModel,
    utcnow_str,
)
from backend.app.events.logger import log_event
from backend.app.github.sync_worker import enqueue_sync_job_async
from backend.app.impact.impact_engine import get_effective_dependencies


class ApplyValidationError(Exception):
    def __init__(self, message: str, is_conflict: bool = False, is_stale: bool = False, is_forbidden: bool = False):
        super().__init__(message)
        self.message = message
        self.is_conflict = is_conflict
        self.is_stale = is_stale
        self.is_forbidden = is_forbidden


def _mark_proposal_failed_in_new_tx(
    db: Session,
    project_id: str,
    proposal_id: str,
    new_status: str,
    reason: str,
    event_type: str,
):
    """
    Separate clean transaction to record stale/conflict status when an apply fails,
    without contaminating the rolled-back apply transaction.
    """
    try:
        prop = db.query(ProposalModel).filter(ProposalModel.id == proposal_id).first()
        if prop:
            prop.status = new_status
            if new_status == "stale":
                prop.stale_reason = reason
            elif new_status == "conflict":
                prop.conflict_reason = reason
            prop.updated_at = utcnow_str()

        log_event(
            db=db,
            project_id=project_id,
            actor_type="system",
            actor_id="system",
            event_type=event_type,
            payload={
                "proposal_id": proposal_id,
                "reason": reason,
                "status": new_status,
            },
            auto_commit=True,
        )
    except Exception:
        db.rollback()


def apply_proposal_atomically(
    db: Session,
    project_id: str,
    proposal_id: str,
    decided_by: str,
    manual_review: bool = False,
) -> ProposalModel:
    """
    Executes atomic, transactional apply-time validation and updates.
    All section updates, project artifact version, proposal status, decision,
    and event records commit TOGETHER in a single atomic transaction.
    If any check or version comparison fails, all writes are completely rolled back.
    """
    # 0. Role validation
    if decided_by.lower() not in ("alex", "maya"):
        raise ApplyValidationError(
            f"Invalid decider identity '{decided_by}'. Must be 'alex' or 'maya'.",
            is_forbidden=True,
        )

    # 1. Fetch proposal
    proposal = (
        db.query(ProposalModel)
        .filter(ProposalModel.id == proposal_id, ProposalModel.project_id == project_id)
        .first()
    )
    if not proposal:
        raise ApplyValidationError(f"Proposal {proposal_id} not found")

    if proposal.status != "pending_review":
        raise ApplyValidationError(
            f"Proposal is not in 'pending_review' state (current: {proposal.status})",
            is_conflict=(proposal.status == "conflict"),
            is_stale=(proposal.status == "stale"),
        )

    # 1b. Check NOVA Re-Verification outcome guards
    nova_rev = getattr(proposal, "nova_review", None)
    if isinstance(nova_rev, dict):
        rev_status = nova_rev.get("review_status")
        if rev_status == "REVIEW_FAILED":
            raise ApplyValidationError(
                f"Apply rejected: Independent NOVA review failed ({nova_rev.get('impact_explanation', 'Review failed')}). "
                "A proposal with failed review cannot be approved or applied.",
                is_stale=True,
            )
        elif rev_status == "AFFECTED":
            raise ApplyValidationError(
                f"Apply rejected: Proposal is marked AFFECTED by NOVA re-verification ({nova_rev.get('impact_explanation', '')}). "
                "The proposal must be reconciled before applying.",
                is_stale=True,
            )
        elif rev_status == "UNCERTAIN" and not manual_review:
            raise ApplyValidationError(
                f"Apply rejected: Independent NOVA review returned UNCERTAIN ({nova_rev.get('impact_explanation', 'Uncertain impact')}). "
                "Manual review is required before this proposal can be approved.",
                is_forbidden=False,
            )

    # 2. Check Decision Permission (Priority 3 & Section 8)
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

    # Check if any effective requirements (declared UNION inferred) have changed since base_context_version
    ops = (proposal.changes or {}).get("operations", []) if isinstance(proposal.changes, dict) else []
    effective_reqs = get_effective_dependencies(
        proposal.affected_requirements,
        proposal.target_sections,
        ops,
    )
    if effective_reqs:
        events = (
            db.query(EventModel)
            .filter(
                EventModel.project_id == project_id,
                EventModel.event_type.in_(["HUMAN_REQUIREMENT_EDITED", "requirement.updated"]),
                EventModel.context_version > proposal.base_context_version,
            )
            .all()
        )
        for ev in events:
            p_dict = ev.payload if isinstance(ev.payload, dict) else (json.loads(ev.payload) if isinstance(ev.payload, str) else {})
            changed_key = p_dict.get("requirement_key")
            if changed_key in effective_reqs:
                db.rollback()
                reason = f"Requirement '{changed_key}' was changed after this proposal was created."
                _mark_proposal_failed_in_new_tx(
                    db=db,
                    project_id=project_id,
                    proposal_id=proposal_id,
                    new_status="stale",
                    reason=reason,
                    event_type="PROPOSAL_MARKED_STALE",
                )
                raise ApplyValidationError(
                    f"Atomic apply aborted: Proposal is STALE. {reason}",
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
            db.rollback()
            raise ApplyValidationError(f"Target artifact section '{sec_key}' does not exist")

        expected_version = base_section_versions.get(sec_key)
        if expected_version is None:
            expected_version = sec_model.version

        if sec_model.version != expected_version:
            db.rollback()
            reason = (
                f"Section '{sec_key}' has evolved to version {sec_model.version} "
                f"(proposal was based on version {expected_version})."
            )
            _mark_proposal_failed_in_new_tx(
                db=db,
                project_id=project_id,
                proposal_id=proposal_id,
                new_status="conflict",
                reason=reason,
                event_type="PROPOSAL_MARKED_CONFLICT",
            )
            raise ApplyValidationError(
                f"Atomic apply aborted: CONFLICT detected on section '{sec_key}'. {reason}",
                is_conflict=True,
            )

        sections_to_update[sec_key] = sec_model

    # 5. Compute new section data from change operations
    operations = proposal.changes.get("operations", [])
    new_section_data = {}

    for op in operations:
        op_name = op.get("op")
        if op_name == "update_product_brief":
            sec = sections_to_update.get("product_brief")
            if sec:
                data_copy = dict(new_section_data.get("product_brief", sec.data))
                fields = op.get("fields", {})
                for k, v in fields.items():
                    data_copy[k] = v
                new_section_data["product_brief"] = data_copy

        elif op_name == "set_hero_content":
            sec = sections_to_update.get("hero")
            if sec:
                data_copy = dict(new_section_data.get("hero", sec.data))
                fields = op.get("fields", {})
                for k, v in fields.items():
                    data_copy[k] = v
                new_section_data["hero"] = data_copy

        elif op_name == "set_dashboard_metrics":
            sec = sections_to_update.get("dashboard")
            if sec:
                data_copy = dict(new_section_data.get("dashboard", sec.data))
                if "metrics" in op:
                    data_copy["metrics"] = op["metrics"]
                if "categories" in op:
                    data_copy["categories"] = op["categories"]
                if "title" in op:
                    data_copy["title"] = op["title"]
                new_section_data["dashboard"] = data_copy

        elif op_name == "set_approval_queue_config":
            sec = sections_to_update.get("approval_queue")
            if sec:
                data_copy = dict(new_section_data.get("approval_queue", sec.data))
                config = op.get("config", {})
                for k, v in config.items():
                    data_copy[k] = v
                if "items" in op:
                    data_copy["items"] = op["items"]
                new_section_data["approval_queue"] = data_copy

    try:
        # 6. Execute atomic compare-and-swap updates for all updated sections
        for sec_key, updated_data in new_section_data.items():
            expected_ver = base_section_versions.get(sec_key, sections_to_update[sec_key].version)
            stmt_sec = (
                update(ArtifactSectionModel)
                .where(
                    ArtifactSectionModel.project_id == project_id,
                    ArtifactSectionModel.section_key == sec_key,
                    ArtifactSectionModel.version == expected_ver,
                )
                .values(
                    data=updated_data,
                    version=expected_ver + 1,
                    updated_by=f"agent:{proposal.agent_id}",
                    updated_at=utcnow_str(),
                )
            )
            res_sec = db.execute(stmt_sec)
            if res_sec.rowcount != 1:
                db.rollback()
                raise ApplyValidationError(
                    f"Atomic apply aborted: Concurrent modification detected on section '{sec_key}'.",
                    is_conflict=True,
                )

            # Record section version snapshot in history
            db.add(
                ArtifactSectionVersionModel(
                    id=f"{sections_to_update[sec_key].id}-v{expected_ver + 1}",
                    project_id=project_id,
                    section_key=sec_key,
                    data=updated_data,
                    version=expected_ver + 1,
                    status="approved",
                    updated_by=f"agent:{proposal.agent_id}",
                    created_at=utcnow_str(),
                )
            )

        # 7. Atomically increment global artifact version
        expected_art_ver = project.artifact_version
        stmt_proj = (
            update(ProjectModel)
            .where(
                ProjectModel.id == project_id,
                ProjectModel.artifact_version == expected_art_ver,
            )
            .values(
                artifact_version=expected_art_ver + 1,
                updated_at=utcnow_str(),
            )
        )
        res_proj = db.execute(stmt_proj)
        if res_proj.rowcount != 1:
            db.rollback()
            raise ApplyValidationError("Atomic apply aborted: Concurrent modification on project artifact version.")

        # 8. Atomically update proposal status to approved
        stmt_prop = (
            update(ProposalModel)
            .where(
                ProposalModel.id == proposal_id,
                ProposalModel.project_id == project_id,
                ProposalModel.status == "pending_review",
            )
            .values(
                status="approved",
                updated_at=utcnow_str(),
            )
        )
        res_prop = db.execute(stmt_prop)
        if res_prop.rowcount != 1:
            db.rollback()
            raise ApplyValidationError("Atomic apply aborted: Proposal status was modified concurrently.")

        # 9. Add Decision record
        decision = DecisionModel(
            proposal_id=proposal.id,
            decision="approved",
            decided_by=decided_by,
            note=f"Approved by {decided_by.capitalize()}",
            created_at=utcnow_str(),
        )
        db.add(decision)

        # 10. Add event with auto_commit=False (commits together!)
        new_artifact_version = expected_art_ver + 1
        log_event(
            db=db,
            project_id=project_id,
            actor_type="human",
            actor_id=decided_by,
            event_type="PROPOSAL_APPROVED",
            context_version=project.context_version,
            artifact_version=new_artifact_version,
            payload={
                "proposal_id": proposal.id,
                "agent_id": proposal.agent_id,
                "created_by": proposal.created_by or proposal.agent_id,
                "author_type": proposal.author_type,
                "reviewed_by": proposal.reviewed_by,
                "review_outcome": proposal.review_outcome,
                "summary": proposal.summary,
                "target_sections": list(new_section_data.keys()),
                "decided_by": decided_by,
                "new_artifact_version": new_artifact_version,
            },
            auto_commit=False,
        )

        # 11. Transactionally record GitHub sync job if connected (Outbox Pattern)
        conn = (
            db.query(GitHubConnectionModel)
            .filter(GitHubConnectionModel.project_id == project_id)
            .first()
        )
        sync_job = None
        if conn and conn.connection_status == "connected":
            sync_job = GitHubSyncJobModel(
                id=str(uuid.uuid4()),
                project_id=project_id,
                proposal_id=proposal.id,
                status="pending",
                attempts=0,
                created_at=utcnow_str(),
                updated_at=utcnow_str(),
            )
            db.add(sync_job)

        # Final single commit committing sections, project, proposal, decision, event, and sync job!
        db.commit()
        db.refresh(proposal)
        db.refresh(project)

        # Asynchronously dispatch the Outbox sync job after successful commit
        if sync_job:
            enqueue_sync_job_async(sync_job.id)

        return proposal

    except Exception:
        db.rollback()
        raise


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
    Section update, project artifact version, and event commit together atomically.
    """
    if editor_id.lower() not in ("alex", "maya"):
        raise ValueError(f"Invalid editor identity '{editor_id}'. Must be 'alex' or 'maya'.")

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

    if sec.version != expected_version:
        raise ValueError(
            f"Section edit conflict: Expected version {expected_version}, but section is already at version {sec.version}."
        )

    try:
        # 1. Compare-and-swap update on section
        stmt_sec = (
            update(ArtifactSectionModel)
            .where(
                ArtifactSectionModel.project_id == project_id,
                ArtifactSectionModel.section_key == section_key,
                ArtifactSectionModel.version == expected_version,
            )
            .values(
                data=new_data,
                version=expected_version + 1,
                updated_by=editor_id,
                updated_at=utcnow_str(),
            )
        )
        res_sec = db.execute(stmt_sec)
        if res_sec.rowcount != 1:
            db.rollback()
            raise ValueError(f"Section edit conflict: Section '{section_key}' was concurrently updated.")

        # Record section version snapshot in history
        db.add(
            ArtifactSectionVersionModel(
                id=f"{sec.id}-v{expected_version + 1}",
                project_id=project_id,
                section_key=section_key,
                data=new_data,
                version=expected_version + 1,
                status="approved",
                updated_by=editor_id,
                created_at=utcnow_str(),
            )
        )

        # 2. Increment project artifact version
        expected_art_ver = project.artifact_version
        stmt_proj = (
            update(ProjectModel)
            .where(
                ProjectModel.id == project_id,
                ProjectModel.artifact_version == expected_art_ver,
            )
            .values(
                artifact_version=expected_art_ver + 1,
                updated_at=utcnow_str(),
            )
        )
        res_proj = db.execute(stmt_proj)
        if res_proj.rowcount != 1:
            db.rollback()
            raise ValueError("Concurrent update on project artifact version.")

        # 3. Log event with auto_commit=False
        log_event(
            db=db,
            project_id=project_id,
            actor_type="human",
            actor_id=editor_id,
            event_type="HUMAN_SECTION_EDITED",
            context_version=project.context_version,
            artifact_version=expected_art_ver + 1,
            payload={
                "section_key": section_key,
                "previous_version": expected_version,
                "new_version": expected_version + 1,
                "editor_id": editor_id,
            },
            auto_commit=False,
        )

        db.commit()
        db.refresh(sec)
        db.refresh(project)

        # Trigger conflict detection on older pending proposals in separate clean session
        from backend.app.proposals.conflicts import evaluate_section_conflicts
        evaluate_section_conflicts(
            db=db,
            project_id=project_id,
            modified_section_key=section_key,
            editor_name=editor_id.capitalize(),
        )

        return sec

    except Exception:
        db.rollback()
        raise
