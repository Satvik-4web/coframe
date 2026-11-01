import uuid
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from backend.app.api.auth import get_current_identity, verify_governance_authorization
from backend.app.db.database import get_db
from backend.app.db.models import (
    ProposalModel,
    DecisionModel,
    ProjectModel,
    AgentRunModel,
    RequirementModel,
    ArtifactSectionModel,
    ArtifactSectionVersionModel,
    DelegationModel,
    ImplementationPlanModel,
    utcnow_str,
)
from backend.app.schemas.proposals import (
    ProposalApproveRequest,
    ProposalRejectRequest,
    ProposalRedirectRequest,
    ProposalReconcileRequest,
    HumanProposalCreateRequest,
    ConfirmRequirementsRequest,
    ConflictResolutionRequest,
    ProposalConflictResponse,
    ProposalStatsResponse,
)
from backend.app.proposals.apply import apply_proposal_atomically, ApplyValidationError
from backend.app.proposals.serialization import serialize_proposal_for_api
from backend.app.agents.nova import reconcile_nova_proposal, redirect_nova_proposal
from backend.app.agents.pixel import redirect_pixel_proposal, reconcile_pixel_proposal
from backend.app.events.logger import log_event
from backend.app.websocket.manager import ws_manager

router = APIRouter(tags=["proposals"])


@router.get("/projects/{project_id}/proposals")
async def list_proposals(project_id: str, db: Session = Depends(get_db)):
    props = (
        db.query(ProposalModel)
        .filter(ProposalModel.project_id == project_id)
        .order_by(ProposalModel.created_at.desc())
        .all()
    )
    return [serialize_proposal_for_api(p, db=db) for p in props]


@router.get("/projects/{project_id}/proposals/stats")
async def get_proposal_stats(project_id: str, db: Session = Depends(get_db)):
    props = db.query(ProposalModel).filter(ProposalModel.project_id == project_id).all()
    sections = {
        s.section_key: s.version
        for s in db.query(ArtifactSectionModel).filter(ArtifactSectionModel.project_id == project_id).all()
    }

    awaiting_confirmation = 0
    ready_for_review = 0
    conflicted = 0
    recently_applied = 0
    by_contributor = {"nova": 0, "pixel": 0, "human": 0}

    for p in props:
        auth = (p.created_by or p.agent_id or "").lower()
        if auth in ("alex", "maya") or p.author_type == "human" or p.proposal_type == "human_contribution":
            by_contributor["human"] += 1
        elif auth == "nova" or p.proposal_type in ("prd_requirement", "product_requirements", "requirements"):
            by_contributor["nova"] += 1
        elif auth == "pixel" or p.proposal_type in ("prototype_modification", "implementation"):
            by_contributor["pixel"] += 1

        is_prd = (
            auth == "nova"
            or p.proposal_type in ("prd_requirement", "product_requirements", "requirements")
            or bool(p.prd_data and isinstance(p.prd_data, dict))
        )

        # Check section versions
        is_conf = (p.status == "conflict")
        if p.status == "pending_review":
            base_sec_vers = p.base_section_versions or {}
            for sec_k in (p.target_sections or []):
                if sections.get(sec_k, 1) > base_sec_vers.get(sec_k, 1):
                    is_conf = True
                    break

        if is_conf:
            conflicted += 1
        elif p.status == "pending_review":
            if is_prd:
                awaiting_confirmation += 1
            else:
                ready_for_review += 1
        elif p.status == "approved":
            recently_applied += 1

    active_dels = (
        db.query(DelegationModel)
        .filter(
            DelegationModel.project_id == project_id,
            DelegationModel.status.in_(["in_progress", "executing"]),
        )
        .count()
    )
    active_plans = (
        db.query(ImplementationPlanModel)
        .filter(
            ImplementationPlanModel.project_id == project_id,
            ImplementationPlanModel.status == "executing",
        )
        .count()
    )
    active_runs = (
        db.query(AgentRunModel)
        .filter(
            AgentRunModel.project_id == project_id,
            AgentRunModel.status.in_(["working", "in_progress"]),
        )
        .count()
    )
    implementations_in_progress = max(active_dels, active_plans, active_runs)

    return {
        "awaiting_confirmation": awaiting_confirmation,
        "implementations_in_progress": implementations_in_progress,
        "ready_for_review": ready_for_review,
        "conflicted": conflicted,
        "recently_applied": recently_applied,
        "total": len(props),
        "by_contributor": by_contributor,
    }


@router.get("/projects/{project_id}/proposals/{proposal_id}")
async def get_proposal(project_id: str, proposal_id: str, db: Session = Depends(get_db)):
    p = (
        db.query(ProposalModel)
        .filter(ProposalModel.id == proposal_id, ProposalModel.project_id == project_id)
        .first()
    )
    if not p:
        p = (
            db.query(ProposalModel)
            .filter(ProposalModel.project_id == project_id)
            .filter(
                (ProposalModel.task_id == proposal_id)
                | (ProposalModel.run_id == proposal_id)
                | (ProposalModel.supersedes_proposal_id == proposal_id)
            )
            .first()
        )
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found")
    return serialize_proposal_for_api(p, db=db)


@router.get("/projects/{project_id}/proposals/{proposal_id}/conflict")
async def get_proposal_conflict_detail(
    project_id: str,
    proposal_id: str,
    db: Session = Depends(get_db),
):
    p = (
        db.query(ProposalModel)
        .filter(ProposalModel.id == proposal_id, ProposalModel.project_id == project_id)
        .first()
    )
    if not p:
        p = (
            db.query(ProposalModel)
            .filter(ProposalModel.project_id == project_id)
            .filter(
                (ProposalModel.task_id == proposal_id)
                | (ProposalModel.run_id == proposal_id)
                | (ProposalModel.supersedes_proposal_id == proposal_id)
            )
            .first()
        )
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found")

    sec_key = p.target_sections[0] if p.target_sections else "hero"
    curr_sec = (
        db.query(ArtifactSectionModel)
        .filter(
            ArtifactSectionModel.project_id == project_id,
            ArtifactSectionModel.section_key == sec_key,
        )
        .first()
    )
    base_ver = (p.base_section_versions or {}).get(sec_key, 1)
    canonical_ver = curr_sec.version if curr_sec else 1
    canonical_data = curr_sec.data if curr_sec else {}

    is_conflicted = (canonical_ver > base_ver) or (p.status == "conflict")

    intervening_sec_ver = (
        db.query(ArtifactSectionVersionModel)
        .filter(
            ArtifactSectionVersionModel.project_id == project_id,
            ArtifactSectionVersionModel.section_key == sec_key,
            ArtifactSectionVersionModel.version == canonical_ver,
        )
        .first()
    )
    if intervening_sec_ver:
        intervening_user = intervening_sec_ver.updated_by
        intervening_timestamp = intervening_sec_ver.created_at
    else:
        intervening_user = curr_sec.updated_by if curr_sec else "maya"
        intervening_timestamp = curr_sec.updated_at if curr_sec else utcnow_str()

    intervening_summary = f"Manual {sec_key} update by {intervening_user.capitalize()} (saved as v{canonical_ver})"

    ops = (p.changes or {}).get("operations", [])
    target_op = next((op for op in ops if op.get("section") == sec_key), ops[0] if ops else {})
    proposed_content = (
        target_op.get("fields")
        or target_op.get("config")
        or target_op.get("metrics")
        or target_op.get("content")
        or target_op
    )

    conflicting_fields = []
    if isinstance(proposed_content, dict) and isinstance(canonical_data, dict):
        all_keys = set(proposed_content.keys()) | set(canonical_data.keys())
        for k in all_keys:
            prop_val = proposed_content.get(k)
            canon_val = canonical_data.get(k)
            if prop_val != canon_val:
                conflicting_fields.append({
                    "field": k,
                    "proposed": prop_val,
                    "canonical": canon_val,
                })

    conflict_reason = p.conflict_reason or (
        f"{intervening_user.capitalize()} updated the '{sec_key}' section to v{canonical_ver} "
        f"after {p.agent_id.upper() if p.agent_id else 'contributor'} submitted this proposal based on v{base_ver}."
    )

    return {
        "is_conflicted": is_conflicted,
        "proposal_id": p.id,
        "section_key": sec_key,
        "base_version": base_ver,
        "canonical_version": canonical_ver,
        "intervening_user": intervening_user,
        "intervening_timestamp": intervening_timestamp,
        "intervening_summary": intervening_summary,
        "conflict_reason": conflict_reason,
        "proposed_content": proposed_content if isinstance(proposed_content, dict) else {"raw": proposed_content},
        "canonical_content": canonical_data,
        "conflicting_fields": conflicting_fields,
        "can_auto_reconcile": True,
    }


@router.post("/projects/{project_id}/proposals/human")
async def create_human_proposal(
    project_id: str,
    body: HumanProposalCreateRequest,
    db: Session = Depends(get_db),
):
    """
    Creates an authoritative human contribution authored by Alex or Maya.
    Strictly validates caller identity to prevent spoofing.
    """
    author_clean = body.author.strip().lower()
    if author_clean not in ("alex", "maya"):
        raise HTTPException(
            status_code=403,
            detail=f"Unauthorized contributor '{body.author}'. Only registered project members ('alex', 'maya') can submit human contributions.",
        )

    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Ensure AgentRun record exists for foreign key integrity
    run_id = f"run_human_{uuid.uuid4().hex[:8]}"
    human_run = AgentRunModel(
        id=run_id,
        project_id=project_id,
        agent_id=author_clean,
        status="completed",
        lifecycle_state="idle",
        task_description=f"Human contribution by {author_clean.capitalize()}: {body.summary}",
        base_context_version=project.context_version,
        base_artifact_version=project.artifact_version,
        context_pack={"requirements": [], "section_versions": {}},
        source="human_entry",
        started_at=utcnow_str(),
        completed_at=utcnow_str(),
    )
    db.add(human_run)

    proposal_id = f"prop_human_{uuid.uuid4().hex[:8]}"
    base_sec_vers = {sec: 1 for sec in body.target_sections}

    proposal = ProposalModel(
        id=proposal_id,
        project_id=project_id,
        agent_id=author_clean,
        created_by=author_clean,
        author_type="human",
        task_id=body.task_id or f"task_human_{uuid.uuid4().hex[:6]}",
        reviewed_by=None,
        review_outcome=None,
        review_findings=[],
        run_id=run_id,
        summary=body.summary,
        reasoning=body.reasoning,
        affected_requirements=body.affected_requirements or [],
        target_sections=body.target_sections,
        changes=body.changes,
        base_context_version=project.context_version,
        base_artifact_version=project.artifact_version,
        base_section_versions=base_sec_vers,
        requires_decision=bool(body.requires_decision),
        assigned_decider_id=body.assigned_decider_id or "alex",
        status="pending_review",
        proposal_type="human_contribution",
        source="human_entry",
        is_simulated=False,
        prune_metadata=None,
        created_at=utcnow_str(),
        updated_at=utcnow_str(),
    )
    db.add(proposal)
    db.commit()
    db.refresh(proposal)

    # Log proposal submitted event
    log_event(
        db=db,
        project_id=project_id,
        actor_type="human",
        actor_id=author_clean,
        event_type="PROPOSAL_SUBMITTED",
        context_version=project.context_version,
        artifact_version=project.artifact_version,
        payload={
            "proposal_id": proposal.id,
            "created_by": proposal.created_by,
            "author_type": proposal.author_type,
            "summary": proposal.summary,
            "target_sections": proposal.target_sections,
            "proposal_type": proposal.proposal_type,
            "requires_decision": proposal.requires_decision,
        },
    )

    await ws_manager.broadcast(project_id, {
        "type": "PROPOSAL_SUBMITTED",
        "proposal_id": proposal.id,
        "author": author_clean,
    })

    return serialize_proposal_for_api(proposal)


@router.post("/projects/{project_id}/proposals/{proposal_id}/approve")
async def approve_proposal(
    project_id: str,
    proposal_id: str,
    body: ProposalApproveRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Step 6/7: Atomic apply-time validation and state update.
    Rechecks versions, stale events, and permissions in a database transaction.
    """
    caller = get_current_identity(request, db)
    verified_decider = verify_governance_authorization(
        caller=caller,
        claimed_identity=body.decided_by,
        action_type="proposal_decision",
        db=db,
        project_id=project_id,
    )

    try:
        approved_prop = apply_proposal_atomically(
            db=db,
            project_id=project_id,
            proposal_id=proposal_id,
            decided_by=verified_decider,
            manual_review=body.manual_review,
        )
    except ApplyValidationError as e:
        status_code = 403 if e.is_forbidden else 409
        raise HTTPException(status_code=status_code, detail=e.message)

    await ws_manager.broadcast(project_id, {
        "type": "PROPOSAL_APPROVED",
        "proposal_id": approved_prop.id,
        "decided_by": verified_decider,
    })

    try:
        from backend.app.services.workflow_service import update_workflow_stage
        await update_workflow_stage(
            db=db,
            project_id=project_id,
            stage="implementation_applied",
            active_pixel_proposal_id=approved_prop.id,
            last_action_by=body.decided_by,
        )
    except Exception as e:
        logger.warning(f"Could not update workflow stage for approved proposal: {e}")

    try:
        from backend.app.agents.chat_service import create_system_chat_notification
        create_system_chat_notification(
            db=db,
            project_id=project_id,
            conversation_id="conv_team_ledgerflow",
            content=f"Human Decision: {body.decided_by.capitalize()} approved implementation '{approved_prop.summary}'. Canvas updated to v{approved_prop.base_artifact_version + 1}.",
            related_proposal_id=approved_prop.id,
        )
    except Exception:
        pass

    return {
        "status": "success",
        "message": f"Proposal {proposal_id} approved and applied.",
        "proposal_id": approved_prop.id,
        "artifact_version": approved_prop.base_artifact_version + 1,
    }



@router.post("/projects/{project_id}/proposals/{proposal_id}/confirm_requirements")
async def confirm_proposal_requirements(
    project_id: str,
    proposal_id: str,
    body: ConfirmRequirementsRequest,
    db: Session = Depends(get_db),
):
    """
    Confirms NOVA's Product Requirements Document (PRD) proposal.
    Transitions proposal from READY FOR REVIEW -> CONFIRMED.
    Updates requirement state without modifying canonical prototype sections.
    Automatically delegates confirmed requirements to PIXEL for autonomous engineering implementation.
    """
    if body.confirmed_by.lower() not in ("alex", "maya"):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid decider identity '{body.confirmed_by}'. Only 'alex' or 'maya' may confirm requirements.",
        )

    p = (
        db.query(ProposalModel)
        .filter(ProposalModel.id == proposal_id, ProposalModel.project_id == project_id)
        .first()
    )
    if not p:
        p = (
            db.query(ProposalModel)
            .filter(ProposalModel.project_id == project_id)
            .filter(
                (ProposalModel.task_id == proposal_id)
                | (ProposalModel.run_id == proposal_id)
                | (ProposalModel.supersedes_proposal_id == proposal_id)
            )
            .first()
        )
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found")

    # Idempotency / Repeated click support
    if p.status == "approved" and p.prd_data and isinstance(p.prd_data, dict) and p.prd_data.get("status") == "confirmed":
        from backend.app.agents.delegation_service import delegate_confirmed_prd_to_pixel
        delegation_res = await delegate_confirmed_prd_to_pixel(
            db=db,
            project_id=project_id,
            prd_proposal_id=p.id,
            confirmed_by=body.confirmed_by,
        )
        resp = serialize_proposal_for_api(p)
        resp["delegation"] = delegation_res.get("delegation")
        resp["implementation_proposal"] = delegation_res.get("proposal")
        resp["implementation_plan"] = delegation_res.get("implementation_plan")
        return resp

    if p.status != "pending_review":
        raise HTTPException(status_code=400, detail=f"Proposal is already {p.status}.")

    # Validate that proposal is genuinely a NOVA requirements document
    is_nova_prd = (
        p.agent_id == "nova"
        or p.created_by == "nova"
        or p.proposal_type in ("prd_requirement", "product_requirements", "requirements")
        or (p.prd_data and isinstance(p.prd_data, dict))
    )
    if not is_nova_prd:
        raise HTTPException(
            status_code=400,
            detail="Only NOVA Product Requirements Documents (PRDs) can be confirmed via this workflow.",
        )

    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    p.status = "approved"
    p.updated_at = utcnow_str()

    if p.prd_data and isinstance(p.prd_data, dict):
        p.prd_data["status"] = "confirmed"
        p.prd_data["confirmed_by"] = body.confirmed_by.lower()
        p.prd_data["confirmed_at"] = utcnow_str()
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(p, "prd_data")

        # Update authoritative requirement versions if audience was specified
        aud_val = (
            p.prd_data.get("target_audience")
            or p.prd_data.get("target_users", {}).get("primary_users")
        )
        if aud_val:
            req_aud = (
                db.query(RequirementModel)
                .filter(
                    RequirementModel.project_id == project_id,
                    RequirementModel.requirement_key == "REQ_AUDIENCE",
                )
                .first()
            )
            if req_aud:
                req_aud.value = aud_val
                req_aud.version += 1
                req_aud.updated_by = body.confirmed_by.lower()
                req_aud.updated_at = utcnow_str()

    decision = DecisionModel(
        id=f"dec_{uuid.uuid4().hex[:10]}",
        proposal_id=p.id,
        decision="confirmed",
        decided_by=body.confirmed_by,
        note=body.note or f"Confirmed requirements for '{p.summary}'",
        created_at=utcnow_str(),
    )
    db.add(decision)

    project.context_version += 1
    project.updated_at = utcnow_str()

    db.commit()
    db.refresh(p)

    log_event(
        db=db,
        project_id=project_id,
        actor_type="human",
        actor_id=body.confirmed_by,
        event_type="PROPOSAL_REQUIREMENTS_CONFIRMED",
        context_version=project.context_version,
        artifact_version=project.artifact_version,
        payload={
            "proposal_id": p.id,
            "confirmed_by": body.confirmed_by,
            "summary": p.summary,
        },
    )

    await ws_manager.broadcast(project_id, {
        "type": "PROPOSAL_APPROVED",
        "proposal_id": p.id,
        "decided_by": body.confirmed_by,
    })

    # Automatically delegate confirmed PRD to PIXEL
    from backend.app.agents.delegation_service import delegate_confirmed_prd_to_pixel
    delegation_res = await delegate_confirmed_prd_to_pixel(
        db=db,
        project_id=project_id,
        prd_proposal_id=p.id,
        confirmed_by=body.confirmed_by,
    )

    resp = serialize_proposal_for_api(p)
    resp["delegation"] = delegation_res.get("delegation")
    resp["implementation_proposal"] = delegation_res.get("proposal")
    resp["implementation_plan"] = delegation_res.get("implementation_plan")
    return resp


@router.post("/projects/{project_id}/proposals/{proposal_id}/reject")
async def reject_proposal(
    project_id: str,
    proposal_id: str,
    body: ProposalRejectRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Preserves proposal, records decision and reason."""
    caller = get_current_identity(request, db)
    verified_decider = verify_governance_authorization(
        caller=caller,
        claimed_identity=body.decided_by,
        action_type="proposal_decision",
        db=db,
        project_id=project_id,
    )

    p = (
        db.query(ProposalModel)
        .filter(ProposalModel.id == proposal_id, ProposalModel.project_id == project_id)
        .first()
    )
    if not p:
        p = (
            db.query(ProposalModel)
            .filter(ProposalModel.project_id == project_id)
            .filter(
                (ProposalModel.task_id == proposal_id)
                | (ProposalModel.run_id == proposal_id)
                | (ProposalModel.supersedes_proposal_id == proposal_id)
            )
            .first()
        )
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found")

    if p.requires_decision and p.assigned_decider_id:
        if body.decided_by.lower() != p.assigned_decider_id.lower():
            raise HTTPException(
                status_code=403,
                detail=f"Permission denied: High-impact decision must be made by {p.assigned_decider_id.upper()}.",
            )

    p.status = "rejected"
    p.updated_at = utcnow_str()

    decision = DecisionModel(
        proposal_id=p.id,
        decision="rejected",
        decided_by=body.decided_by,
        note=body.reason or f"Rejected by {body.decided_by.capitalize()}",
        created_at=utcnow_str(),
    )
    db.add(decision)

    log_event(
        db=db,
        project_id=project_id,
        actor_type="human",
        actor_id=body.decided_by,
        event_type="PROPOSAL_REJECTED",
        payload={
            "proposal_id": p.id,
            "agent_id": p.agent_id,
            "created_by": p.created_by or p.agent_id,
            "author_type": p.author_type,
            "decided_by": body.decided_by,
            "reason": body.reason,
        },
    )
    db.commit()

    await ws_manager.broadcast(project_id, {
        "type": "PROPOSAL_REJECTED",
        "proposal_id": p.id,
        "decided_by": body.decided_by,
    })

    return {"status": "success", "message": f"Proposal {proposal_id} rejected."}


@router.post("/projects/{project_id}/proposals/{proposal_id}/redirect")
async def redirect_proposal(
    project_id: str,
    proposal_id: str,
    body: ProposalRedirectRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Step 6 Redirect: Human enters required instruction note.
    Originating agent (NOVA or PIXEL) receives note + fresh Context Pack and produces a new linked proposal.
    """
    caller = get_current_identity(request, db)
    verified_decider = verify_governance_authorization(
        caller=caller,
        claimed_identity=body.decided_by,
        action_type="proposal_decision",
        db=db,
        project_id=project_id,
    )

    p = (
        db.query(ProposalModel)
        .filter(ProposalModel.id == proposal_id, ProposalModel.project_id == project_id)
        .first()
    )
    if not p:
        p = (
            db.query(ProposalModel)
            .filter(ProposalModel.project_id == project_id)
            .filter(
                (ProposalModel.task_id == proposal_id)
                | (ProposalModel.run_id == proposal_id)
                | (ProposalModel.supersedes_proposal_id == proposal_id)
            )
            .first()
        )
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found")

    if p.requires_decision and p.assigned_decider_id:
        if body.decided_by.lower() != p.assigned_decider_id.lower():
            raise HTTPException(
                status_code=403,
                detail=f"Permission denied: Redirect on this high-impact proposal must be authorized by {p.assigned_decider_id.upper()}.",
            )

    if p.agent_id == "pixel":
        new_proposal = await redirect_pixel_proposal(
            db=db,
            project_id=project_id,
            original_proposal_id=proposal_id,
            human_instruction=body.instruction,
            decided_by=body.decided_by,
        )
    elif p.agent_id == "nova":
        new_proposal = await redirect_nova_proposal(
            db=db,
            project_id=project_id,
            original_proposal_id=proposal_id,
            human_instruction=body.instruction,
            decided_by=body.decided_by,
        )
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported agent '{p.agent_id}' for redirect",
        )

    await ws_manager.broadcast(project_id, {
        "type": "PROPOSAL_REDIRECTED",
        "original_proposal_id": proposal_id,
        "new_proposal_id": new_proposal.id,
    })

    return {
        "status": "success",
        "message": f"{p.agent_id.upper()} redirected; created revised proposal {new_proposal.id}.",
        "original_proposal_id": proposal_id,
        "new_proposal_id": new_proposal.id,
        "new_proposal": serialize_proposal_for_api(new_proposal),
    }


@router.post("/projects/{project_id}/proposals/{proposal_id}/reconcile")
async def reconcile_proposal(
    project_id: str,
    proposal_id: str,
    body: ProposalReconcileRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    caller = get_current_identity(request, db)
    verified_requester = verify_governance_authorization(
        caller=caller,
        claimed_identity=body.requested_by,
        action_type="proposal_reconcile",
        db=db,
        project_id=project_id,
    )
    """
    Step 4 Case A Reconcile: Human reconciles a stale or conflicted proposal.
    Routes to PIXEL for engineering proposals or NOVA for PRD proposals.
    """
    p = (
        db.query(ProposalModel)
        .filter(ProposalModel.id == proposal_id, ProposalModel.project_id == project_id)
        .first()
    )
    if not p:
        p = (
            db.query(ProposalModel)
            .filter(ProposalModel.project_id == project_id)
            .filter(
                (ProposalModel.task_id == proposal_id)
                | (ProposalModel.run_id == proposal_id)
                | (ProposalModel.supersedes_proposal_id == proposal_id)
            )
            .first()
        )
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found")

    is_nova = (
        p.agent_id == "nova"
        or p.proposal_type in ("prd_requirement", "requirements", "product_requirements")
    )

    if is_nova:
        new_proposal = await reconcile_nova_proposal(
            db=db,
            project_id=project_id,
            original_proposal_id=proposal_id,
            requested_by=verified_requester,
        )
    else:
        new_proposal = await reconcile_pixel_proposal(
            db=db,
            project_id=project_id,
            original_proposal_id=proposal_id,
            requested_by=verified_requester,
        )

    await ws_manager.broadcast(project_id, {
        "type": "PROPOSAL_RECONCILED",
        "original_proposal_id": proposal_id,
        "new_proposal_id": new_proposal.id,
    })

    return {
        "status": "success",
        "message": f"Proposal reconciled; created new proposal {new_proposal.id}.",
        "original_proposal_id": proposal_id,
        "new_proposal_id": new_proposal.id,
        "new_proposal": serialize_proposal_for_api(new_proposal, db=db),
    }


@router.post("/projects/{project_id}/proposals/{proposal_id}/resolve-conflict")
async def resolve_proposal_conflict(
    project_id: str,
    proposal_id: str,
    body: ConflictResolutionRequest,
    db: Session = Depends(get_db),
):
    """
    First-class conflict resolution endpoint with three explicit paths:
    1. 'reconcile_pixel': Asks PIXEL to synthesize a linked revision adapted to current canonical canvas.
    2. 'keep_human': Preserves human canonical changes and dismisses/supersedes the conflicted proposal.
    3. 'custom_merge': Authoritative custom resolution providing merged section changes.
    """
    if body.decided_by.lower() not in ("alex", "maya"):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid decider identity '{body.decided_by}'. Must be 'alex' or 'maya'.",
        )

    p = (
        db.query(ProposalModel)
        .filter(ProposalModel.id == proposal_id, ProposalModel.project_id == project_id)
        .first()
    )
    if not p:
        p = (
            db.query(ProposalModel)
            .filter(ProposalModel.project_id == project_id)
            .filter(
                (ProposalModel.task_id == proposal_id)
                | (ProposalModel.run_id == proposal_id)
                | (ProposalModel.supersedes_proposal_id == proposal_id)
            )
            .first()
        )
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found")

    mode = body.resolution_mode.lower()

    if mode == "reconcile_pixel":
        new_proposal = await reconcile_pixel_proposal(
            db=db,
            project_id=project_id,
            original_proposal_id=proposal_id,
            requested_by=body.decided_by,
        )
        await ws_manager.broadcast(project_id, {
            "type": "PROPOSAL_RECONCILED",
            "original_proposal_id": proposal_id,
            "new_proposal_id": new_proposal.id,
        })
        return {
            "status": "success",
            "resolution_mode": "reconcile_pixel",
            "message": f"PIXEL synthesized reconciled proposal {new_proposal.id} adhering to current canonical canvas.",
            "original_proposal_id": proposal_id,
            "new_proposal_id": new_proposal.id,
            "new_proposal": serialize_proposal_for_api(new_proposal, db=db),
        }

    elif mode == "keep_human":
        p.status = "superseded"
        p.updated_at = utcnow_str()
        reason = body.note or f"Preserved human canonical changes; dismissed conflicted proposal per {body.decided_by.capitalize()}."
        decision = DecisionModel(
            id=f"dec_{uuid.uuid4().hex[:10]}",
            proposal_id=p.id,
            decision="superseded",
            decided_by=body.decided_by,
            note=reason,
            created_at=utcnow_str(),
        )
        db.add(decision)
        db.commit()

        log_event(
            db=db,
            project_id=project_id,
            actor_type="human",
            actor_id=body.decided_by,
            event_type="PROPOSAL_CONFLICT_DISMISSED",
            payload={
                "proposal_id": p.id,
                "decided_by": body.decided_by,
                "reason": reason,
            },
        )

        await ws_manager.broadcast(project_id, {
            "type": "PROPOSAL_SUPERSEDED",
            "proposal_id": p.id,
            "decided_by": body.decided_by,
        })

        return {
            "status": "success",
            "resolution_mode": "keep_human",
            "message": f"Preserved human version. Proposal {proposal_id} dismissed.",
            "proposal_id": p.id,
        }

    elif mode == "custom_merge":
        if not body.custom_changes:
            raise HTTPException(status_code=400, detail="custom_changes required for custom_merge resolution")
        sec_key = p.target_sections[0] if p.target_sections else "hero"
        curr_sec = (
            db.query(ArtifactSectionModel)
            .filter(
                ArtifactSectionModel.project_id == project_id,
                ArtifactSectionModel.section_key == sec_key,
            )
            .first()
        )
        curr_ver = curr_sec.version if curr_sec else 1
        new_prop_id = f"prop_merged_{uuid.uuid4().hex[:8]}"
        merged_prop = ProposalModel(
            id=new_prop_id,
            project_id=project_id,
            agent_id="pixel",
            created_by=body.decided_by,
            author_type="human",
            task_id=p.task_id or f"task_merge_{uuid.uuid4().hex[:6]}",
            supersedes_proposal_id=p.id,
            summary=f"Custom Merged Resolution by {body.decided_by.capitalize()}: {p.summary}",
            reasoning=body.note or f"Manually resolved conflict with live canonical v{curr_ver}.",
            affected_requirements=p.affected_requirements or [],
            target_sections=p.target_sections or [sec_key],
            changes=body.custom_changes,
            base_context_version=p.base_context_version,
            base_artifact_version=p.base_artifact_version,
            base_section_versions={sec_key: curr_ver},
            requires_decision=False,
            status="pending_review",
            proposal_type="prototype_modification",
            source="human_entry",
            is_simulated=False,
            created_at=utcnow_str(),
            updated_at=utcnow_str(),
        )
        db.add(merged_prop)
        p.status = "superseded"
        db.commit()
        db.refresh(merged_prop)

        return {
            "status": "success",
            "resolution_mode": "custom_merge",
            "message": f"Custom merged proposal {merged_prop.id} created.",
            "original_proposal_id": proposal_id,
            "new_proposal_id": merged_prop.id,
            "new_proposal": serialize_proposal_for_api(merged_prop, db=db),
        }
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown resolution_mode '{mode}'. Allowed: 'reconcile_pixel', 'keep_human', 'custom_merge'.",
        )


@router.post("/projects/{project_id}/proposals/{proposal_id}/reverify")
async def reverify_proposal(
    project_id: str,
    proposal_id: str,
    db: Session = Depends(get_db),
):
    """
    Independent NOVA AI Re-Verification.
    NOVA independently evaluates the proposal against current requirements,
    detecting missed dependencies and assessing impact.
    """
    p = (
        db.query(ProposalModel)
        .filter(ProposalModel.id == proposal_id, ProposalModel.project_id == project_id)
        .first()
    )
    if not p:
        p = (
            db.query(ProposalModel)
            .filter(ProposalModel.project_id == project_id)
            .filter(
                (ProposalModel.task_id == proposal_id)
                | (ProposalModel.run_id == proposal_id)
                | (ProposalModel.supersedes_proposal_id == proposal_id)
            )
            .first()
        )
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found")

    from backend.app.agents.nova import reverify_proposal_with_nova
    rev_res = await reverify_proposal_with_nova(
        db=db,
        project_id=project_id,
        proposal_id=proposal_id,
        changed_requirement_keys=p.affected_requirements or [],
    )

    await ws_manager.broadcast(project_id, {
        "type": "PROPOSAL_REVERIFIED",
        "proposal_id": proposal_id,
        "review_status": rev_res.review_status.value,
        "recommended_action": rev_res.recommended_action.value,
        "nova_review": rev_res.model_dump(),
        "new_status": p.status,
    })

    return {
        "status": "success",
        "proposal_id": proposal_id,
        "nova_review": rev_res.model_dump(),
        "proposal": serialize_proposal_for_api(p),
    }
