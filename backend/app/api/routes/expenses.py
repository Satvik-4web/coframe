import uuid
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.app.db.database import get_db
from backend.app.db.models import (
    ExpenseModel,
    ProjectModel,
    ArtifactSectionModel,
    utcnow_str,
)
from backend.app.events.logger import log_event
from backend.app.websocket.manager import ws_manager

router = APIRouter(prefix="/projects/{project_id}/expenses", tags=["expenses"])

DEFAULT_APPROVAL_THRESHOLD_USD = 500.0


class SubmitExpenseRequest(BaseModel):
    amount: float = Field(..., gt=0, description="Expense amount (must be positive)")
    currency: str = Field("USD", description="Currency (USD, EUR, GBP)")
    category: str = Field(..., description="Category (Travel, Meals, Software, Equipment, Office)")
    description: str = Field(..., min_length=3, description="Description of the expense")
    expense_date: str = Field(..., description="Date of expense (YYYY-MM-DD)")
    reference: Optional[str] = Field(None, description="Optional reference or invoice code")
    submitted_by: str = Field("alex", description="Submitter identity key")


class ExpenseDecisionRequest(BaseModel):
    decision: str = Field(..., description="'approved' or 'rejected'")
    decided_by: str = Field(..., description="Identity of decider ('alex' or 'maya')")
    reason: Optional[str] = Field(None, description="Optional explanation for decision")


def get_approval_threshold(db: Session, project_id: str) -> float:
    """Reads configured approval threshold from approval_queue section, defaulting to $500."""
    queue_sec = (
        db.query(ArtifactSectionModel)
        .filter(
            ArtifactSectionModel.project_id == project_id,
            ArtifactSectionModel.section_key == "approval_queue",
        )
        .first()
    )
    if queue_sec and isinstance(queue_sec.data, dict):
        threshold = queue_sec.data.get("auto_approval_limit") or queue_sec.data.get("threshold")
        if threshold is not None:
            try:
                return float(threshold)
            except (ValueError, TypeError):
                pass
    return DEFAULT_APPROVAL_THRESHOLD_USD


def compute_expense_metrics(db: Session, project_id: str) -> Dict[str, Any]:
    """Calculates live aggregated financial metrics from persisted expense records."""
    expenses = db.query(ExpenseModel).filter(ExpenseModel.project_id == project_id).all()

    total_submitted = len(expenses)
    pending_count = sum(1 for e in expenses if e.status == "pending_approval")
    approved_count = sum(1 for e in expenses if e.status == "approved")
    rejected_count = sum(1 for e in expenses if e.status == "rejected")

    total_approved_amount = sum(e.amount for e in expenses if e.status == "approved")

    # Spending breakdown by category
    spending_by_category: Dict[str, float] = {}
    for e in expenses:
        if e.status == "approved":
            spending_by_category[e.category] = spending_by_category.get(e.category, 0.0) + e.amount

    return {
        "total_submitted": total_submitted,
        "pending_count": pending_count,
        "approved_count": approved_count,
        "rejected_count": rejected_count,
        "total_approved_amount": round(total_approved_amount, 2),
        "spending_by_category": spending_by_category,
    }


@router.post("")
async def submit_expense(
    project_id: str,
    body: SubmitExpenseRequest,
    db: Session = Depends(get_db),
):
    """
    Submits a new employee expense into LedgerFlow.
    Validates fields, determines whether approval threshold is exceeded,
    persists in database, and broadcasts event.
    """
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    threshold = get_approval_threshold(db, project_id)
    threshold_exceeded = body.amount > threshold

    expense = ExpenseModel(
        project_id=project_id,
        submitted_by=body.submitted_by.lower(),
        amount=round(body.amount, 2),
        currency=body.currency.upper(),
        category=body.category,
        description=body.description,
        expense_date=body.expense_date,
        reference=body.reference,
        status="pending_approval",
        threshold_exceeded=threshold_exceeded,
    )
    db.add(expense)
    db.commit()
    db.refresh(expense)

    # Log expense submitted event in COFRAME event log
    log_event(
        db=db,
        project_id=project_id,
        actor_type="human",
        actor_id=body.submitted_by.lower(),
        event_type="expense.submitted",
        context_version=project.context_version,
        artifact_version=project.artifact_version,
        payload={
            "expense_id": expense.id,
            "amount": expense.amount,
            "currency": expense.currency,
            "category": expense.category,
            "description": expense.description,
            "threshold_exceeded": threshold_exceeded,
            "requires_alex": threshold_exceeded,
        },
        auto_commit=True,
    )

    metrics = compute_expense_metrics(db, project_id)
    await ws_manager.broadcast(project_id, {
        "type": "EXPENSE_SUBMITTED",
        "expense_id": expense.id,
        "amount": expense.amount,
        "category": expense.category,
        "metrics": metrics,
    })

    return {
        "status": "success",
        "expense": {
            "id": expense.id,
            "amount": expense.amount,
            "currency": expense.currency,
            "category": expense.category,
            "description": expense.description,
            "expense_date": expense.expense_date,
            "status": expense.status,
            "threshold_exceeded": expense.threshold_exceeded,
            "submitted_by": expense.submitted_by,
            "created_at": expense.created_at,
        },
        "metrics": metrics,
    }


@router.get("")
def list_expenses(
    project_id: str,
    status: Optional[str] = Query(None, description="Filter by status (pending_approval, approved, rejected)"),
    category: Optional[str] = Query(None, description="Filter by category"),
    db: Session = Depends(get_db),
):
    """Lists expenses for the workspace with optional filters."""
    query = db.query(ExpenseModel).filter(ExpenseModel.project_id == project_id)
    if status:
        query = query.filter(ExpenseModel.status == status)
    if category:
        query = query.filter(ExpenseModel.category == category)

    expenses = query.order_by(ExpenseModel.created_at.desc()).all()
    metrics = compute_expense_metrics(db, project_id)

    return {
        "total": len(expenses),
        "expenses": [
            {
                "id": e.id,
                "amount": e.amount,
                "currency": e.currency,
                "category": e.category,
                "description": e.description,
                "expense_date": e.expense_date,
                "reference": e.reference,
                "status": e.status,
                "threshold_exceeded": e.threshold_exceeded,
                "submitted_by": e.submitted_by,
                "decided_by": e.decided_by,
                "decision_reason": e.decision_reason,
                "decided_at": e.decided_at,
                "created_at": e.created_at,
            }
            for e in expenses
        ],
        "metrics": metrics,
    }


@router.post("/{expense_id}/decision")
async def decide_expense(
    project_id: str,
    expense_id: str,
    body: ExpenseDecisionRequest,
    db: Session = Depends(get_db),
):
    """
    Approves or rejects a submitted expense.
    Enforces permissions:
      If amount > threshold ($500), ONLY Alex can approve/reject.
      Maya cannot approve high-threshold expenses.
    """
    decider = body.decided_by.lower()
    if decider not in ("alex", "maya"):
        raise HTTPException(status_code=400, detail="Invalid decider identity. Must be 'alex' or 'maya'.")

    decision = body.decision.lower()
    if decision not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="Decision must be 'approved' or 'rejected'.")

    expense = (
        db.query(ExpenseModel)
        .filter(ExpenseModel.id == expense_id, ExpenseModel.project_id == project_id)
        .first()
    )
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    if expense.status != "pending_approval":
        raise HTTPException(status_code=400, detail=f"Expense is already {expense.status}")

    # Enforce threshold policy permission
    if expense.threshold_exceeded and decider != "alex":
        raise HTTPException(
            status_code=403,
            detail=f"Approval policy restriction: Expenses over ${DEFAULT_APPROVAL_THRESHOLD_USD} require Alex's approval.",
        )

    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()

    expense.status = decision
    expense.decided_by = decider
    expense.decision_reason = body.reason
    expense.decided_at = utcnow_str()
    expense.updated_at = utcnow_str()

    db.commit()
    db.refresh(expense)

    event_type = "expense.approved" if decision == "approved" else "expense.rejected"
    log_event(
        db=db,
        project_id=project_id,
        actor_type="human",
        actor_id=decider,
        event_type=event_type,
        context_version=project.context_version if project else 1,
        artifact_version=project.artifact_version if project else 1,
        payload={
            "expense_id": expense.id,
            "amount": expense.amount,
            "status": decision,
            "decided_by": decider,
            "reason": body.reason,
        },
        auto_commit=True,
    )

    metrics = compute_expense_metrics(db, project_id)
    await ws_manager.broadcast(project_id, {
        "type": "EXPENSE_DECIDED",
        "expense_id": expense.id,
        "status": decision,
        "decided_by": decider,
        "metrics": metrics,
    })

    return {
        "status": "success",
        "expense": {
            "id": expense.id,
            "status": expense.status,
            "decided_by": expense.decided_by,
            "decided_at": expense.decided_at,
        },
        "metrics": metrics,
    }


@router.get("/metrics")
def get_metrics(project_id: str, db: Session = Depends(get_db)):
    """Returns live computed financial dashboard metrics."""
    return compute_expense_metrics(db, project_id)
