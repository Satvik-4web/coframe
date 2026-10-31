import uuid
import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException

from backend.app.db.models import (
    ProjectModel,
    RequirementModel,
    ArtifactSectionModel,
    ProposalModel,
    AgentRunModel,
    EventModel,
    DelegationModel,
    ApprovalRequestModel,
    ProjectMemberModel,
    utcnow_str,
)
from backend.app.events.logger import log_event
from backend.app.proposals.stamping import stamp_and_persist_proposal
from backend.app.context.pack_builder import create_and_persist_agent_run
from backend.app.websocket.manager import ws_manager
from backend.app.mcp.schemas import (
    GetWorkspaceContextInput,
    GetWorkspaceContextOutput,
    GetArtifactInput,
    GetArtifactOutput,
    GetProposalHistoryInput,
    GetProposalHistoryOutput,
    CreateProposalInput,
    CreateProposalOutput,
    SendWorkspaceMessageInput,
    SendWorkspaceMessageOutput,
    RequestHumanDecisionInput,
    RequestHumanDecisionOutput,
    GetAgentStatusInput,
    GetAgentStatusOutput,
    AgentPresenceInfo,
    GetWorkspaceEventsInput,
    GetWorkspaceEventsOutput,
    DelegateToAgentInput,
    DelegateToAgentOutput,
)


# -------------------------------------------------------------
# Tool 1: get_workspace_context
# -------------------------------------------------------------
async def execute_get_workspace_context(
    db: Session, args: GetWorkspaceContextInput
) -> GetWorkspaceContextOutput:
    project = db.query(ProjectModel).filter(ProjectModel.id == args.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    reqs = (
        db.query(RequirementModel)
        .filter(RequirementModel.project_id == args.project_id)
        .all()
    )
    sections = (
        db.query(ArtifactSectionModel)
        .filter(ArtifactSectionModel.project_id == args.project_id)
        .all()
    )
    members = (
        db.query(ProjectMemberModel)
        .filter(ProjectMemberModel.project_id == args.project_id)
        .all()
    )

    section_versions = {s.section_key: s.version for s in sections}

    log_event(
        db=db,
        project_id=args.project_id,
        actor_type="agent",
        actor_id=args.agent_id,
        event_type="mcp.tool_invoked",
        payload={
            "tool": "get_workspace_context",
            "context_version": project.context_version,
            "artifact_version": project.artifact_version,
        },
        auto_commit=True,
    )

    return GetWorkspaceContextOutput(
        project_id=project.id,
        project_name=project.name,
        context_version=project.context_version,
        artifact_version=project.artifact_version,
        requirements=[
            {
                "key": r.requirement_key,
                "title": r.title,
                "value": r.value,
                "version": r.version,
                "updated_by": r.updated_by,
            }
            for r in reqs
        ],
        section_versions=section_versions,
        members=[
            {
                "identity": m.identity_key,
                "name": m.display_name,
                "role": m.role,
            }
            for m in members
        ],
    )


# -------------------------------------------------------------
# Tool 2: get_artifact
# -------------------------------------------------------------
async def execute_get_artifact(
    db: Session, args: GetArtifactInput
) -> GetArtifactOutput:
    project = db.query(ProjectModel).filter(ProjectModel.id == args.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    query = db.query(ArtifactSectionModel).filter(ArtifactSectionModel.project_id == args.project_id)
    if args.section_key:
        query = query.filter(ArtifactSectionModel.section_key == args.section_key)

    sections = query.all()
    section_dict = {
        s.section_key: {
            "version": s.version,
            "data": s.data,
            "updated_by": s.updated_by,
            "updated_at": s.updated_at,
        }
        for s in sections
    }

    return GetArtifactOutput(
        project_id=project.id,
        artifact_version=project.artifact_version,
        sections=section_dict,
    )


# -------------------------------------------------------------
# Tool 3: get_proposal_history
# -------------------------------------------------------------
async def execute_get_proposal_history(
    db: Session, args: GetProposalHistoryInput
) -> GetProposalHistoryOutput:
    query = db.query(ProposalModel).filter(ProposalModel.project_id == args.project_id)
    if args.status:
        query = query.filter(ProposalModel.status == args.status)
    if args.agent_id:
        query = query.filter(ProposalModel.agent_id == args.agent_id)

    proposals = query.order_by(ProposalModel.created_at.desc()).limit(args.limit).all()

    return GetProposalHistoryOutput(
        total=len(proposals),
        proposals=[
            {
                "proposal_id": p.id,
                "agent_id": p.agent_id,
                "summary": p.summary,
                "reasoning": p.reasoning,
                "status": p.status,
                "requires_decision": p.requires_decision,
                "assigned_decider_id": p.assigned_decider_id,
                "target_sections": p.target_sections,
                "affected_requirements": p.affected_requirements,
                "base_context_version": p.base_context_version,
                "base_artifact_version": p.base_artifact_version,
                "supersedes_proposal_id": p.supersedes_proposal_id,
                "created_at": p.created_at,
            }
            for p in proposals
        ],
    )


# -------------------------------------------------------------
# Tool 4: create_proposal
# -------------------------------------------------------------
async def execute_create_proposal(
    db: Session, args: CreateProposalInput
) -> CreateProposalOutput:
    # 1. Look up active run or assign/create run
    latest_run = (
        db.query(AgentRunModel)
        .filter(AgentRunModel.project_id == args.project_id, AgentRunModel.agent_id == args.agent_id)
        .order_by(AgentRunModel.started_at.desc())
        .first()
    )
    if not latest_run:
        latest_run = create_and_persist_agent_run(
            db=db,
            project_id=args.project_id,
            agent_id=args.agent_id,
            run_id=f"run_{args.agent_id}_{uuid.uuid4().hex[:6]}",
            task_id=f"task_mcp_{args.agent_id}",
            task_description=args.summary,
        )

    # 2. Build structured proposal payload dictionary
    raw_output = {
        "summary": args.summary,
        "reasoning": args.reasoning,
        "affected_requirements": args.affected_requirements,
        "target_sections": args.target_sections,
        "changes": args.changes,
    }

    # 3. Stamp authoritatively using backend proposal engine
    proposal = stamp_and_persist_proposal(
        db=db,
        project_id=args.project_id,
        run_id=latest_run.id,
        raw_output=raw_output,
        source="live_llm",
        is_simulated=False,
        supersedes_proposal_id=args.supersedes_proposal_id,
    )

    # If correlation_id provided, update
    if args.correlation_id:
        log_event(
            db=db,
            project_id=args.project_id,
            actor_type="agent",
            actor_id=args.agent_id,
            event_type="proposal.created",
            payload={
                "proposal_id": proposal.id,
                "summary": proposal.summary,
                "correlation_id": args.correlation_id,
            },
            correlation_id=args.correlation_id,
            auto_commit=True,
        )

    # Broadcast proposal creation
    await ws_manager.broadcast(args.project_id, {
        "type": "PROPOSAL_CREATED",
        "proposal_id": proposal.id,
        "agent_id": proposal.agent_id,
        "summary": proposal.summary,
        "requires_decision": proposal.requires_decision,
    })

    return CreateProposalOutput(
        proposal_id=proposal.id,
        status=proposal.status,
        created_at=proposal.created_at,
        requires_decision=proposal.requires_decision,
        summary=proposal.summary,
    )


# -------------------------------------------------------------
# Tool 5: send_workspace_message
# -------------------------------------------------------------
async def execute_send_workspace_message(
    db: Session, args: SendWorkspaceMessageInput
) -> SendWorkspaceMessageOutput:
    now_ms = int(datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000)

    event = log_event(
        db=db,
        project_id=args.project_id,
        actor_type="agent" if args.sender_id in ["nova", "pixel"] else "human",
        actor_id=args.sender_id,
        event_type="workspace.message.posted",
        payload={
            "sender_id": args.sender_id,
            "message": args.message,
            "message_type": args.message_type,
            "metadata": args.metadata or {},
        },
        timestamp=now_ms,
        auto_commit=True,
    )

    await ws_manager.broadcast(args.project_id, {
        "type": "WORKSPACE_MESSAGE",
        "event_id": event.id,
        "sender_id": args.sender_id,
        "message": args.message,
        "message_type": args.message_type,
        "timestamp": now_ms,
    })

    return SendWorkspaceMessageOutput(
        status="sent",
        event_id=event.id,
        timestamp=now_ms,
    )


# -------------------------------------------------------------
# Tool 6: request_human_decision
# -------------------------------------------------------------
async def execute_request_human_decision(
    db: Session, args: RequestHumanDecisionInput
) -> RequestHumanDecisionOutput:
    approval = ApprovalRequestModel(
        project_id=args.project_id,
        requested_by=args.requested_by,
        title=args.title,
        explanation=args.explanation,
        escalation_reason=args.escalation_reason,
        affected_requirements=args.affected_requirements,
        affected_sections=args.affected_sections,
        expected_impact=args.expected_impact,
        assigned_decider_id=args.assigned_decider_id,
        proposal_id=args.proposal_id,
        correlation_id=args.correlation_id,
        status="pending",
    )
    db.add(approval)

    # If linked to a proposal, mark proposal as requiring decision
    if args.proposal_id:
        prop = db.query(ProposalModel).filter(ProposalModel.id == args.proposal_id).first()
        if prop:
            prop.requires_decision = True
            prop.assigned_decider_id = args.assigned_decider_id

    db.commit()
    db.refresh(approval)

    # Log typed event
    log_event(
        db=db,
        project_id=args.project_id,
        actor_type="agent",
        actor_id=args.requested_by,
        event_type="approval.requested",
        payload={
            "approval_id": approval.id,
            "title": approval.title,
            "escalation_reason": approval.escalation_reason,
            "assigned_decider_id": approval.assigned_decider_id,
            "proposal_id": approval.proposal_id,
            "expected_impact": approval.expected_impact,
        },
        correlation_id=args.correlation_id,
        auto_commit=True,
    )

    await ws_manager.broadcast(args.project_id, {
        "type": "APPROVAL_REQUESTED",
        "approval_id": approval.id,
        "title": approval.title,
        "requested_by": approval.requested_by,
        "assigned_decider_id": approval.assigned_decider_id,
    })

    return RequestHumanDecisionOutput(
        approval_id=approval.id,
        status=approval.status,
        assigned_decider_id=approval.assigned_decider_id,
        title=approval.title,
    )


# -------------------------------------------------------------
# Tool 7: get_agent_status
# -------------------------------------------------------------
async def execute_get_agent_status(
    db: Session, args: GetAgentStatusInput
) -> GetAgentStatusOutput:
    query = db.query(AgentRunModel).filter(AgentRunModel.project_id == args.project_id)
    if args.agent_id:
        query = query.filter(AgentRunModel.agent_id == args.agent_id)

    runs = query.all()
    # Deduplicate by agent_id taking latest run
    agent_map: Dict[str, AgentRunModel] = {}
    for r in runs:
        if r.agent_id not in agent_map or r.started_at > agent_map[r.agent_id].started_at:
            agent_map[r.agent_id] = r

    results = []
    for agent_id in ["nova", "pixel"]:
        if args.agent_id and args.agent_id != agent_id:
            continue
        run = agent_map.get(agent_id)
        if run:
            results.append(
                AgentPresenceInfo(
                    agent_id=run.agent_id,
                    status=run.status,
                    lifecycle_state=run.lifecycle_state or run.status or "idle",
                    task_description=run.task_description,
                    current_task=run.current_task,
                    current_proposal_id=run.current_proposal_id,
                    task_start_time=run.task_start_time or run.started_at,
                    last_completed_task=run.last_completed_task,
                    last_heartbeat=run.last_heartbeat or run.started_at,
                )
            )
        else:
            results.append(
                AgentPresenceInfo(
                    agent_id=agent_id,
                    status="idle",
                    lifecycle_state="idle",
                    task_description="Awaiting assignment",
                    last_heartbeat=utcnow_str(),
                )
            )

    return GetAgentStatusOutput(agents=results)


# -------------------------------------------------------------
# Tool 8: get_workspace_events
# -------------------------------------------------------------
async def execute_get_workspace_events(
    db: Session, args: GetWorkspaceEventsInput
) -> GetWorkspaceEventsOutput:
    query = db.query(EventModel).filter(EventModel.project_id == args.project_id)
    if args.event_type:
        query = query.filter(EventModel.event_type == args.event_type)
    if args.correlation_id:
        query = query.filter(EventModel.correlation_id == args.correlation_id)

    events = query.order_by(EventModel.sequence_no.desc()).limit(args.limit).all()

    return GetWorkspaceEventsOutput(
        total=len(events),
        events=[e.to_envelope() for e in events],
    )


# -------------------------------------------------------------
# Tool 9: delegate_to_agent
# -------------------------------------------------------------
async def execute_delegate_to_agent(
    db: Session, args: DelegateToAgentInput
) -> DelegateToAgentOutput:
    if args.source_agent == args.target_agent:
        raise HTTPException(
            status_code=400,
            detail="Self-delegation is prohibited to prevent recursive execution loops."
        )

    project = db.query(ProjectModel).filter(ProjectModel.id == args.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    delegation = DelegationModel(
        project_id=args.project_id,
        source_agent=args.source_agent,
        target_agent=args.target_agent,
        task=args.task,
        scope=args.scope,
        acceptance_criteria=args.acceptance_criteria,
        context_version=project.context_version,
        artifact_version=project.artifact_version,
        dependencies=args.dependencies,
        correlation_id=args.correlation_id,
        status="pending",
    )
    db.add(delegation)

    # Update target agent presence to working
    target_run = (
        db.query(AgentRunModel)
        .filter(AgentRunModel.project_id == args.project_id, AgentRunModel.agent_id == args.target_agent)
        .order_by(AgentRunModel.started_at.desc())
        .first()
    )
    if target_run:
        target_run.lifecycle_state = "working"
        target_run.current_task = f"Delegated from {args.source_agent.upper()}: {args.task}"
        target_run.last_heartbeat = utcnow_str()

    db.commit()
    db.refresh(delegation)

    # Log typed event
    log_event(
        db=db,
        project_id=args.project_id,
        actor_type="agent",
        actor_id=args.source_agent,
        event_type="delegation.created",
        payload={
            "delegation_id": delegation.id,
            "source_agent": args.source_agent,
            "target_agent": args.target_agent,
            "task": args.task,
            "scope": args.scope,
        },
        correlation_id=args.correlation_id,
        auto_commit=True,
    )

    await ws_manager.broadcast(args.project_id, {
        "type": "DELEGATION_CREATED",
        "delegation_id": delegation.id,
        "source_agent": args.source_agent,
        "target_agent": args.target_agent,
        "task": args.task,
    })

    return DelegateToAgentOutput(
        delegation_id=delegation.id,
        status=delegation.status,
        source_agent=delegation.source_agent,
        target_agent=delegation.target_agent,
        task=delegation.task,
        created_at=delegation.created_at,
    )
