import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.db.database import get_db
from backend.app.db.models import ProposalModel, DecisionModel, ProjectModel, AgentRunModel, utcnow_str
from backend.app.schemas.proposals import (
    ProposalApproveRequest,
    ProposalRejectRequest,
    ProposalRedirectRequest,
    ProposalReconcileRequest,
    HumanProposalCreateRequest,
    ConfirmRequirementsRequest,
)
from backend.app.proposals.apply import apply_proposal_atomically, ApplyValidationError
from backend.app.proposals.serialization import serialize_proposal_for_api
from backend.app.agents.nova import reconcile_nova_proposal, redirect_nova_proposal
from backend.app.agents.pixel import redirect_pixel_proposal
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
    return [serialize_proposal_for_api(p) for p in props]


@router.get("/projects/{project_id}/proposals/{proposal_id}")
async def get_proposal(project_id: str, proposal_id: str, db: Session = Depends(get_db)):
    p = (
        db.query(ProposalModel)
        .filter(ProposalModel.id == proposal_id, ProposalModel.project_id == project_id)
        .first()
    )
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found")
    return serialize_proposal_for_api(p)


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
    db: Session = Depends(get_db),
):
    """
    Step 6/7: Atomic apply-time validation and state update.
    Rechecks versions, stale events, and permissions in a database transaction.
    """
    if body.decided_by.lower() not in ("alex", "maya"):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid decider identity '{body.decided_by}'. Demo allows only 'alex' or 'maya'.",
        )

    try:
        approved_prop = apply_proposal_atomically(
            db=db,
            project_id=project_id,
            proposal_id=proposal_id,
            decided_by=body.decided_by,
        )
    except ApplyValidationError as e:
        status_code = 403 if e.is_forbidden else 409
        raise HTTPException(status_code=status_code, detail=e.message)

    await ws_manager.broadcast(project_id, {
        "type": "PROPOSAL_APPROVED",
        "proposal_id": approved_prop.id,
        "decided_by": body.decided_by,
    })

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
    Updates requirement state without modifying the canonical prototype sections.
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
        raise HTTPException(status_code=404, detail="Proposal not found")

    if p.status != "pending_review":
        raise HTTPException(status_code=400, detail=f"Proposal is already {p.status}.")

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

    try:
        from backend.app.agents.chat_service import create_system_chat_notification
        create_system_chat_notification(
            db=db,
            project_id=project_id,
            conversation_id="conv_team_ledgerflow",
            content=f"Human Decision: {body.confirmed_by.capitalize()} confirmed PRD requirements for '{p.summary}'. Requirements are now authoritative for implementation.",
            related_proposal_id=p.id,
        )
    except Exception:
        pass

    return serialize_proposal_for_api(p)


@router.post("/projects/{project_id}/proposals/{proposal_id}/reject")
async def reject_proposal(
    project_id: str,
    proposal_id: str,
    body: ProposalRejectRequest,
    db: Session = Depends(get_db),
):
    """Preserves proposal, records decision and reason."""
    if body.decided_by.lower() not in ("alex", "maya"):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid decider identity '{body.decided_by}'. Demo allows only 'alex' or 'maya'.",
        )

    p = (
        db.query(ProposalModel)
        .filter(ProposalModel.id == proposal_id, ProposalModel.project_id == project_id)
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
    db: Session = Depends(get_db),
):
    """
    Step 6 Redirect: Human enters required instruction note.
    Originating agent (NOVA or PIXEL) receives note + fresh Context Pack and produces a new linked proposal.
    """
    if body.decided_by.lower() not in ("alex", "maya"):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid decider identity '{body.decided_by}'. Demo allows only 'alex' or 'maya'.",
        )

    p = (
        db.query(ProposalModel)
        .filter(ProposalModel.id == proposal_id, ProposalModel.project_id == project_id)
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
    db: Session = Depends(get_db),
):
    """
    Step 4 Case A Reconcile: Human reconciles a stale proposal.
    NOVA reads updated requirements & fresh Context Pack and produces a new linked proposal.
    """
    p = (
        db.query(ProposalModel)
        .filter(ProposalModel.id == proposal_id, ProposalModel.project_id == project_id)
        .first()
    )
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found")

    new_proposal = await reconcile_nova_proposal(
        db=db,
        project_id=project_id,
        original_proposal_id=proposal_id,
        requested_by=body.requested_by,
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
    }
