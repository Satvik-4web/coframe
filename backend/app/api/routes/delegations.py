from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.db.database import get_db
from backend.app.db.models import (
    DelegationModel,
    ProjectModel,
    AgentRunModel,
    ProposalModel,
    utcnow_str,
)
from backend.app.events.logger import log_event
from backend.app.websocket.manager import ws_manager
from backend.app.agents.pixel import run_pixel_approval_policy

router = APIRouter(prefix="/projects/{project_id}/delegations", tags=["delegations"])


class CreateDelegationRequest(BaseModel):
    source_agent: str = Field(..., description="Delegating agent (nova)")
    target_agent: str = Field(..., description="Target agent (pixel)")
    task: str = Field(..., description="Task instruction")
    scope: Optional[str] = Field(None, description="Scope boundaries")
    acceptance_criteria: List[str] = Field(default_factory=list, description="Criteria for success")
    dependencies: List[str] = Field(default_factory=list, description="Required requirements or sections")
    correlation_id: Optional[str] = Field(None, description="Correlation tracing ID")


class CompleteDelegationRequest(BaseModel):
    result_proposal_id: Optional[str] = None
    feedback: Optional[str] = None
    status: str = Field("completed", description="completed, failed, cancelled")


@router.get("")
def list_delegations(project_id: str, db: Session = Depends(get_db)):
    """Lists all agent-to-agent delegations for the workspace."""
    delegations = (
        db.query(DelegationModel)
        .filter(DelegationModel.project_id == project_id)
        .order_by(DelegationModel.created_at.desc())
        .all()
    )
    return {
        "total": len(delegations),
        "delegations": [
            {
                "id": d.id,
                "project_id": d.project_id,
                "source_agent": d.source_agent,
                "target_agent": d.target_agent,
                "task": d.task,
                "scope": d.scope,
                "acceptance_criteria": d.acceptance_criteria,
                "context_version": d.context_version,
                "artifact_version": d.artifact_version,
                "dependencies": d.dependencies,
                "status": d.status,
                "result_proposal_id": d.result_proposal_id,
                "feedback": d.feedback,
                "correlation_id": d.correlation_id,
                "created_at": d.created_at,
                "updated_at": d.updated_at,
            }
            for d in delegations
        ],
    }


@router.post("")
async def create_delegation(
    project_id: str,
    body: CreateDelegationRequest,
    db: Session = Depends(get_db),
):
    """Creates a new agent-to-agent delegation assignment."""
    if body.source_agent.lower() == body.target_agent.lower():
        raise HTTPException(status_code=400, detail="Self-delegation is prohibited.")

    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    delegation = DelegationModel(
        project_id=project_id,
        source_agent=body.source_agent.lower(),
        target_agent=body.target_agent.lower(),
        task=body.task,
        scope=body.scope,
        acceptance_criteria=body.acceptance_criteria,
        context_version=project.context_version,
        artifact_version=project.artifact_version,
        dependencies=body.dependencies,
        correlation_id=body.correlation_id,
        status="in_progress",
    )
    db.add(delegation)

    # Update agent presence
    target_run = (
        db.query(AgentRunModel)
        .filter(AgentRunModel.project_id == project_id, AgentRunModel.agent_id == body.target_agent.lower())
        .order_by(AgentRunModel.started_at.desc())
        .first()
    )
    if target_run:
        target_run.lifecycle_state = "working"
        target_run.current_task = f"Delegated from {body.source_agent.upper()}: {body.task}"
        target_run.last_heartbeat = utcnow_str()

    db.commit()
    db.refresh(delegation)

    log_event(
        db=db,
        project_id=project_id,
        actor_type="agent",
        actor_id=body.source_agent.lower(),
        event_type="delegation.created",
        payload={
            "delegation_id": delegation.id,
            "source_agent": delegation.source_agent,
            "target_agent": delegation.target_agent,
            "task": delegation.task,
        },
        correlation_id=body.correlation_id,
        auto_commit=True,
    )

    await ws_manager.broadcast(project_id, {
        "type": "DELEGATION_CREATED",
        "delegation_id": delegation.id,
        "source_agent": delegation.source_agent,
        "target_agent": delegation.target_agent,
        "task": delegation.task,
    })

    return {
        "status": "success",
        "delegation_id": delegation.id,
        "delegation": {
            "id": delegation.id,
            "source_agent": delegation.source_agent,
            "target_agent": delegation.target_agent,
            "task": delegation.task,
            "status": delegation.status,
            "created_at": delegation.created_at,
        },
    }


@router.post("/demo-nova-to-pixel")
async def trigger_demo_delegation(
    project_id: str,
    db: Session = Depends(get_db),
):
    """
    Demonstrates OpenAgents Phase 5: Agent-to-Agent Delegation.
    NOVA strategizes an enterprise expense governance policy, delegates implementation
    to PIXEL, and PIXEL engineers the approval policy queue component.
    """
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    task_desc = "Implement a tiered manager spend governance queue with configurable approval thresholds."
    delegation = DelegationModel(
        project_id=project_id,
        source_agent="nova",
        target_agent="pixel",
        task=task_desc,
        scope="approval_queue section in LedgerFlow artifact",
        acceptance_criteria=[
            "Support dual thresholds ($1,000 baseline, $5,000 escalated)",
            "Mark out-of-policy expenses with visual badges",
            "Require Alex sign-off before artifact application",
        ],
        context_version=project.context_version,
        artifact_version=project.artifact_version,
        dependencies=["REQ_APPROVAL_POLICY", "REQ_AUDIENCE"],
        status="in_progress",
    )
    db.add(delegation)
    db.commit()
    db.refresh(delegation)

    log_event(
        db=db,
        project_id=project_id,
        actor_type="agent",
        actor_id="nova",
        event_type="delegation.created",
        payload={
            "delegation_id": delegation.id,
            "source_agent": "nova",
            "target_agent": "pixel",
            "task": task_desc,
        },
        auto_commit=True,
    )

    await ws_manager.broadcast(project_id, {
        "type": "DELEGATION_CREATED",
        "delegation_id": delegation.id,
        "source_agent": "nova",
        "target_agent": "pixel",
        "task": task_desc,
    })

    # Execute PIXEL implementation of the delegated task
    proposal = await run_pixel_approval_policy(db, project_id)

    # Link proposal to delegation
    delegation.result_proposal_id = proposal.id
    delegation.status = "completed"
    delegation.feedback = "PIXEL generated structured approval queue with high-impact escalation."
    delegation.updated_at = utcnow_str()

    db.commit()

    log_event(
        db=db,
        project_id=project_id,
        actor_type="agent",
        actor_id="pixel",
        event_type="delegation.completed",
        payload={
            "delegation_id": delegation.id,
            "result_proposal_id": proposal.id,
            "target_agent": "pixel",
        },
        auto_commit=True,
    )

    await ws_manager.broadcast(project_id, {
        "type": "DELEGATION_COMPLETED",
        "delegation_id": delegation.id,
        "result_proposal_id": proposal.id,
    })

    return {
        "status": "success",
        "delegation_id": delegation.id,
        "proposal_id": proposal.id,
        "message": "NOVA successfully delegated policy implementation to PIXEL.",
    }
