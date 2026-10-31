import logging
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session

from backend.app.db.database import SessionLocal
from backend.app.db.models import (
    WorkflowStateModel,
    ProposalModel,
    DelegationModel,
    utcnow_str,
)
from backend.app.websocket.manager import ws_manager

logger = logging.getLogger(__name__)

STAGE_METADATA: Dict[str, Dict[str, str]] = {
    "product_discovery": {
        "display_label": "Product Discovery",
        "description": "NOVA is understanding your product idea",
        "nova_status": "Analyzing product ideas",
        "pixel_status": "Waiting for confirmed requirements",
    },
    "product_clarification": {
        "display_label": "Product Clarification",
        "description": "NOVA is clarifying requirements for your idea",
        "nova_status": "Clarifying scope & requirements",
        "pixel_status": "Waiting for confirmed requirements",
    },
    "prd_generation": {
        "display_label": "PRD Formulation",
        "description": "NOVA is formulating formal PRD proposal",
        "nova_status": "Formulating formal PRD proposal",
        "pixel_status": "Waiting for confirmed requirements",
    },
    "prd_awaiting_confirmation": {
        "display_label": "Waiting for Alex to confirm requirements",
        "description": "NOVA submitted PRD proposal · Waiting for Alex to confirm requirements",
        "nova_status": "PRD submitted for review",
        "pixel_status": "Waiting for confirmed requirements",
    },
    "prd_confirmed": {
        "display_label": "Requirements Confirmed",
        "description": "Requirements confirmed by human decider · Handoff to PIXEL",
        "nova_status": "Requirements confirmed",
        "pixel_status": "Initializing implementation task",
    },
    "implementation_in_progress": {
        "display_label": "PIXEL has started implementation",
        "description": "PIXEL is implementing confirmed requirements",
        "nova_status": "Tracking requirements alignment",
        "pixel_status": "PIXEL has started implementation",
    },
    "implementation_submitted": {
        "display_label": "Implementation Submitted",
        "description": "NOVA is reviewing PIXEL's contribution",
        "nova_status": "NOVA is reviewing PIXEL's contribution",
        "pixel_status": "Implementation proposal submitted",
    },
    "implementation_awaiting_approval": {
        "display_label": "Awaiting Final Human Approval",
        "description": "Awaiting final human approval in Proposals",
        "nova_status": "Reviewed (PASS)",
        "pixel_status": "Implementation awaiting human approval",
    },
    "implementation_applied": {
        "display_label": "Implementation Applied",
        "description": "Changes applied to LedgerFlow · Ready for next product improvement",
        "nova_status": "Ready for product direction",
        "pixel_status": "Waiting for confirmed requirements",
    },
}


def serialize_workflow_state(wf: WorkflowStateModel) -> Dict[str, Any]:
    meta = STAGE_METADATA.get(wf.current_stage, STAGE_METADATA["product_discovery"])
    return {
        "project_id": wf.project_id,
        "current_stage": wf.current_stage,
        "display_label": wf.display_label or meta["display_label"],
        "description": meta.get("description", ""),
        "nova_status": wf.nova_status or meta["nova_status"],
        "pixel_status": wf.pixel_status or meta["pixel_status"],
        "active_prd_id": wf.active_prd_id,
        "active_pixel_proposal_id": wf.active_pixel_proposal_id,
        "active_task_id": wf.active_task_id,
        "last_action_by": wf.last_action_by,
        "updated_at": wf.updated_at,
        "stage_label": wf.display_label or meta["display_label"],
    }


def get_or_sync_workflow_stage(db: Optional[Session] = None, project_id: str = "demo-ledgerflow") -> Dict[str, Any]:
    """
    Evaluates ground-truth database records (PRDs, Delegations, PIXEL proposals, Human decisions)
    to keep WorkflowStateModel perfectly synchronized. Uses an isolated database session
    to prevent session collision or object expiration in calling transactions.
    """
    session = SessionLocal()
    try:
        wf = session.query(WorkflowStateModel).filter(WorkflowStateModel.project_id == project_id).first()
        if not wf:
            wf = WorkflowStateModel(
                id=f"wf_{project_id}",
                project_id=project_id,
                current_stage="product_discovery",
                display_label=STAGE_METADATA["product_discovery"]["display_label"],
                nova_status=STAGE_METADATA["product_discovery"]["nova_status"],
                pixel_status=STAGE_METADATA["product_discovery"]["pixel_status"],
                updated_at=utcnow_str(),
            )
            session.add(wf)
            session.commit()
            session.refresh(wf)

        # 1. Check for pending PIXEL proposals
        pending_pixel = (
            session.query(ProposalModel)
            .filter(
                ProposalModel.project_id == project_id,
                ProposalModel.agent_id == "pixel",
                ProposalModel.status == "pending_review",
            )
            .order_by(ProposalModel.created_at.desc())
            .first()
        )
        if pending_pixel:
            wf.active_pixel_proposal_id = pending_pixel.id
            wf.active_prd_id = pending_pixel.supersedes_proposal_id
            if pending_pixel.reviewed_by == "nova" or pending_pixel.review_outcome:
                wf.current_stage = "implementation_awaiting_approval"
                wf.display_label = "Awaiting final human approval"
                outcome = pending_pixel.review_outcome or "PASS"
                wf.nova_status = f"Reviewed ({outcome})"
                wf.pixel_status = "Implementation awaiting human approval"
            else:
                wf.current_stage = "implementation_submitted"
                wf.display_label = "NOVA is reviewing PIXEL's contribution"
                wf.nova_status = "Reviewing PIXEL's contribution"
                wf.pixel_status = "Implementation proposal submitted"
            wf.updated_at = utcnow_str()
            session.commit()
            return serialize_workflow_state(wf)

        # 2. Check for in-progress delegations
        active_del = (
            session.query(DelegationModel)
            .filter(
                DelegationModel.project_id == project_id,
                DelegationModel.status == "in_progress",
            )
            .order_by(DelegationModel.created_at.desc())
            .first()
        )
        if active_del:
            wf.current_stage = "implementation_in_progress"
            wf.display_label = "PIXEL has started implementation"
            wf.nova_status = "Tracking requirements alignment"
            wf.pixel_status = "PIXEL has started implementation"
            wf.active_task_id = active_del.id
            wf.active_prd_id = active_del.correlation_id
            wf.updated_at = utcnow_str()
            session.commit()
            return serialize_workflow_state(wf)

        # 3. Check for pending NOVA PRD proposals
        pending_prd = (
            session.query(ProposalModel)
            .filter(
                ProposalModel.project_id == project_id,
                ProposalModel.status == "pending_review",
                (ProposalModel.agent_id == "nova") | (ProposalModel.proposal_type.in_(["prd_requirement", "product_requirements"])),
            )
            .order_by(ProposalModel.created_at.desc())
            .first()
        )
        if pending_prd:
            wf.current_stage = "prd_awaiting_confirmation"
            wf.display_label = "Waiting for Alex to confirm requirements"
            wf.nova_status = f"Submitted PRD #{pending_prd.id[-6:]} for review"
            wf.pixel_status = "Waiting for confirmed requirements"
            wf.active_prd_id = pending_prd.id
            wf.updated_at = utcnow_str()
            session.commit()
            return serialize_workflow_state(wf)

        # 4. Check if there was an applied implementation recently
        approved_pixel = (
            session.query(ProposalModel)
            .filter(
                ProposalModel.project_id == project_id,
                ProposalModel.agent_id == "pixel",
                ProposalModel.status == "approved",
            )
            .order_by(ProposalModel.updated_at.desc())
            .first()
        )
        if approved_pixel and wf.current_stage in ("implementation_awaiting_approval", "implementation_applied"):
            wf.current_stage = "implementation_applied"
            wf.display_label = "Implementation Applied"
            wf.nova_status = "Ready for product direction"
            wf.pixel_status = "Waiting for confirmed requirements"
            wf.active_pixel_proposal_id = approved_pixel.id
            wf.updated_at = utcnow_str()
            session.commit()
            return serialize_workflow_state(wf)

        # 5. Respect recent conversational stages if set explicitly
        if wf.current_stage in ("product_clarification", "prd_generation"):
            return serialize_workflow_state(wf)

        # 6. Default to product_discovery
        wf.current_stage = "product_discovery"
        meta = STAGE_METADATA["product_discovery"]
        wf.display_label = meta["display_label"]
        wf.nova_status = meta["nova_status"]
        wf.pixel_status = meta["pixel_status"]
        wf.updated_at = utcnow_str()
        session.commit()
        return serialize_workflow_state(wf)
    finally:
        session.close()


async def update_workflow_stage(
    db: Optional[Session] = None,
    project_id: str = "demo-ledgerflow",
    stage: str = "product_discovery",
    active_prd_id: Optional[str] = None,
    active_pixel_proposal_id: Optional[str] = None,
    active_task_id: Optional[str] = None,
    last_action_by: Optional[str] = None,
    custom_label: Optional[str] = None,
    custom_nova_status: Optional[str] = None,
    custom_pixel_status: Optional[str] = None,
) -> Dict[str, Any]:
    """Updates workflow state explicitly and broadcasts changes to WebSocket clients using an isolated session."""
    session = SessionLocal()
    try:
        wf = session.query(WorkflowStateModel).filter(WorkflowStateModel.project_id == project_id).first()
        if not wf:
            wf = WorkflowStateModel(
                id=f"wf_{project_id}",
                project_id=project_id,
            )
            session.add(wf)

        meta = STAGE_METADATA.get(stage, STAGE_METADATA["product_discovery"])
        wf.current_stage = stage
        wf.display_label = custom_label or meta["display_label"]
        wf.nova_status = custom_nova_status or meta["nova_status"]
        wf.pixel_status = custom_pixel_status or meta["pixel_status"]

        if active_prd_id is not None:
            wf.active_prd_id = active_prd_id
        if active_pixel_proposal_id is not None:
            wf.active_pixel_proposal_id = active_pixel_proposal_id
        if active_task_id is not None:
            wf.active_task_id = active_task_id
        if last_action_by is not None:
            wf.last_action_by = last_action_by

        wf.updated_at = utcnow_str()
        session.commit()
        session.refresh(wf)
        data = serialize_workflow_state(wf)
    finally:
        session.close()

    try:
        await ws_manager.broadcast(project_id, {
            "type": "WORKFLOW_STAGE_UPDATED",
            "stage": data,
        })
    except Exception as e:
        logger.warning(f"Could not broadcast WORKFLOW_STAGE_UPDATED: {e}")

    return data
