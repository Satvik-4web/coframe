from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.db.database import get_db
from backend.app.db.models import ProposalModel, DecisionModel, utcnow_str
from backend.app.schemas.proposals import (
    ProposalApproveRequest,
    ProposalRejectRequest,
    ProposalRedirectRequest,
    ProposalReconcileRequest,
)
from backend.app.proposals.apply import apply_proposal_atomically, ApplyValidationError
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
    return [
        {
            "proposal_id": p.id,
            "project_id": p.project_id,
            "agent_id": p.agent_id,
            "run_id": p.run_id,
            "supersedes_proposal_id": p.supersedes_proposal_id,
            "summary": p.summary,
            "reasoning": p.reasoning,
            "affected_requirements": p.affected_requirements,
            "target_sections": p.target_sections,
            "changes": p.changes,
            "base_context_version": p.base_context_version,
            "base_artifact_version": p.base_artifact_version,
            "base_section_versions": p.base_section_versions,
            "requires_decision": p.requires_decision,
            "assigned_decider_id": p.assigned_decider_id,
            "status": p.status,
            "stale_reason": p.stale_reason,
            "conflict_reason": p.conflict_reason,
            "source": p.source,
            "is_simulated": p.is_simulated,
            "prune_metadata": getattr(p, "prune_metadata", None),
            "created_at": p.created_at,
            "updated_at": p.updated_at,
        }
        for p in props
    ]


@router.get("/projects/{project_id}/proposals/{proposal_id}")
async def get_proposal(project_id: str, proposal_id: str, db: Session = Depends(get_db)):
    p = (
        db.query(ProposalModel)
        .filter(ProposalModel.id == proposal_id, ProposalModel.project_id == project_id)
        .first()
    )
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found")
    return {
        "proposal_id": p.id,
        "project_id": p.project_id,
        "agent_id": p.agent_id,
        "run_id": p.run_id,
        "supersedes_proposal_id": p.supersedes_proposal_id,
        "summary": p.summary,
        "reasoning": p.reasoning,
        "affected_requirements": p.affected_requirements,
        "target_sections": p.target_sections,
        "changes": p.changes,
        "base_context_version": p.base_context_version,
        "base_artifact_version": p.base_artifact_version,
        "base_section_versions": p.base_section_versions,
        "requires_decision": p.requires_decision,
        "assigned_decider_id": p.assigned_decider_id,
        "status": p.status,
        "stale_reason": p.stale_reason,
        "conflict_reason": p.conflict_reason,
        "source": p.source,
        "is_simulated": p.is_simulated,
        "prune_metadata": getattr(p, "prune_metadata", None),
        "created_at": p.created_at,
        "updated_at": p.updated_at,
    }


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

    return {
        "status": "success",
        "message": f"Proposal {proposal_id} approved and applied.",
        "proposal_id": approved_prop.id,
        "artifact_version": approved_prop.base_artifact_version + 1,
    }


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
        "new_proposal": {
            "id": new_proposal.id,
            "agent_id": new_proposal.agent_id,
            "summary": new_proposal.summary,
            "supersedes_proposal_id": new_proposal.supersedes_proposal_id,
            "requires_decision": new_proposal.requires_decision,
        },
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
