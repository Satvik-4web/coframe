from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.db.database import get_db
from backend.app.db.models import (
    ApprovalRequestModel,
    ProposalModel,
    ProjectModel,
    DecisionModel,
    utcnow_str,
)
from backend.app.events.logger import log_event
from backend.app.websocket.manager import ws_manager
from backend.app.proposals.apply import apply_proposal_atomically, ApplyValidationError

router = APIRouter(prefix="/projects/{project_id}/approvals", tags=["approvals"])


class ResolveApprovalRequest(BaseModel):
    action: Optional[str] = Field(None, description="Action: approved, rejected, redirected, clarification_requested")
    decision: Optional[str] = Field(None, description="Alternative key for action")
    decided_by: str = Field(..., description="Identity of decider: alex, maya")
    note: Optional[str] = Field(None, description="Resolution rationale or redirect instructions")


@router.get("")
def list_approvals(
    project_id: str,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Lists human approval requests for the workspace."""
    query = db.query(ApprovalRequestModel).filter(ApprovalRequestModel.project_id == project_id)
    if status:
        query = query.filter(ApprovalRequestModel.status == status)

    approvals = query.order_by(ApprovalRequestModel.created_at.desc()).all()

    return {
        "total": len(approvals),
        "approvals": [
            {
                "id": a.id,
                "project_id": a.project_id,
                "requested_by": a.requested_by,
                "title": a.title,
                "explanation": a.explanation,
                "escalation_reason": a.escalation_reason,
                "affected_requirements": a.affected_requirements,
                "affected_sections": a.affected_sections,
                "expected_impact": a.expected_impact,
                "assigned_decider_id": a.assigned_decider_id,
                "proposal_id": a.proposal_id,
                "status": a.status,
                "resolved_by": a.resolved_by,
                "resolution_note": a.resolution_note,
                "resolved_at": a.resolved_at,
                "created_at": a.created_at,
                "updated_at": a.updated_at,
            }
            for a in approvals
        ],
    }


@router.post("/{approval_id}/resolve")
async def resolve_approval(
    project_id: str,
    approval_id: str,
    body: ResolveApprovalRequest,
    db: Session = Depends(get_db),
):
    """
    Resolves a pending human approval request with server-side identity validation.
    Restricts high-impact signoffs to the assigned decider (Alex).
    """
    approval = (
        db.query(ApprovalRequestModel)
        .filter(ApprovalRequestModel.project_id == project_id, ApprovalRequestModel.id == approval_id)
        .first()
    )
    if not approval:
        raise HTTPException(status_code=404, detail="Approval request not found")

    if approval.status != "pending":
        raise HTTPException(status_code=400, detail=f"Approval request already resolved as '{approval.status}'")

    decider = body.decided_by.lower().strip()
    required_decider = approval.assigned_decider_id.lower().strip()

    # Strict server-side permission validation
    if required_decider and decider != required_decider:
        raise HTTPException(
            status_code=403,
            detail=f"Access denied: High-impact decision '{approval.title}' requires approval by {approval.assigned_decider_id.capitalize()} (Decision Owner). {body.decided_by.capitalize()} cannot resolve this request.",
        )

    action = (body.action or body.decision or "approved").lower().strip()
    approval.status = action
    approval.resolved_by = decider
    approval.resolution_note = body.note
    approval.resolved_at = utcnow_str()
    approval.updated_at = utcnow_str()

    db.commit()

    # If linked to a proposal and action is 'approved', atomically apply proposal to artifact
    applied_result = None
    if action == "approved" and approval.proposal_id:
        try:
            applied_result = apply_proposal_atomically(
                db=db,
                project_id=project_id,
                proposal_id=approval.proposal_id,
                decided_by=decider,
            )
        except ApplyValidationError as ave:
            raise HTTPException(status_code=409, detail=str(ave))

    elif action == "rejected" and approval.proposal_id:
        prop = db.query(ProposalModel).filter(ProposalModel.id == approval.proposal_id).first()
        if prop:
            prop.status = "rejected"
            db.commit()

    # Log typed event
    log_event(
        db=db,
        project_id=project_id,
        actor_type="human",
        actor_id=decider,
        event_type="approval.resolved",
        payload={
            "approval_id": approval.id,
            "action": action,
            "title": approval.title,
            "resolved_by": decider,
            "proposal_id": approval.proposal_id,
            "note": body.note,
        },
        auto_commit=True,
    )

    await ws_manager.broadcast(project_id, {
        "type": "APPROVAL_RESOLVED",
        "approval_id": approval.id,
        "action": action,
        "resolved_by": decider,
        "proposal_id": approval.proposal_id,
    })

    return {
        "status": "success",
        "approval_id": approval.id,
        "resolution": action,
        "resolved_by": decider,
        "applied_result": applied_result,
        "approval": {
            "id": approval.id,
            "status": approval.status,
            "resolved_by": approval.resolved_by,
        },
    }
