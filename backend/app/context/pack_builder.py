from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session
from backend.app.db.models import (
    ProjectModel,
    RequirementModel,
    ArtifactSectionModel,
    EventModel,
    ProposalModel,
    AgentRunModel,
    DecisionModel,
    utcnow_str,
)
from backend.app.schemas.context import ContextPack, RequirementItem, AgentTask


def build_context_pack(
    db: Session,
    project_id: str,
    agent_id: str,
    run_id: str,
    task_id: str,
    task_description: str,
    last_checkpoint: Optional[str] = None,
) -> ContextPack:
    """
    Builds the authoritative, immutable Context Pack for an agent run
    from persisted project state.
    """
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise ValueError(f"Project {project_id} not found")

    # 1. Requirements
    req_models = db.query(RequirementModel).filter(RequirementModel.project_id == project_id).all()
    requirements: List[RequirementItem] = [
        RequirementItem(
            id=r.requirement_key,
            key=r.requirement_key,
            title=r.title,
            value=r.value,
            version=r.version,
        )
        for r in req_models
    ]

    # 2. Artifact Sections & Section Versions
    sections = db.query(ArtifactSectionModel).filter(ArtifactSectionModel.project_id == project_id).all()
    section_versions: Dict[str, int] = {s.section_key: s.version for s in sections}
    artifact_summary: Dict[str, Any] = {
        s.section_key: {
            "version": s.version,
            "data": s.data,
            "updated_by": s.updated_by,
        }
        for s in sections
    }

    # 3. Approved decisions
    decisions = (
        db.query(DecisionModel)
        .join(ProposalModel, DecisionModel.proposal_id == ProposalModel.id)
        .filter(ProposalModel.project_id == project_id, DecisionModel.decision == "approved")
        .order_by(DecisionModel.created_at.desc())
        .limit(10)
        .all()
    )
    approved_decisions = [
        {
            "id": d.id,
            "proposal_id": d.proposal_id,
            "decision": d.decision,
            "decided_by": d.decided_by,
            "note": d.note,
            "created_at": d.created_at,
        }
        for d in decisions
    ]

    # 4. Relevant events (last 15 events)
    events = (
        db.query(EventModel)
        .filter(EventModel.project_id == project_id)
        .order_by(EventModel.sequence_no.desc())
        .limit(15)
        .all()
    )
    relevant_events = [
        {
            "id": e.id,
            "sequence_no": e.sequence_no,
            "actor_type": e.actor_type,
            "actor_id": e.actor_id,
            "event_type": e.event_type,
            "context_version": e.context_version,
            "artifact_version": e.artifact_version,
            "payload": e.payload,
            "created_at": e.created_at,
        }
        for e in reversed(events)
    ]

    # 5. Open proposals
    open_props = (
        db.query(ProposalModel)
        .filter(ProposalModel.project_id == project_id, ProposalModel.status == "pending_review")
        .all()
    )
    open_proposals = [
        {
            "proposal_id": p.id,
            "agent_id": p.agent_id,
            "summary": p.summary,
            "affected_requirements": p.affected_requirements,
            "target_sections": p.target_sections,
            "status": p.status,
        }
        for p in open_props
    ]

    # 6. Task info
    agent_task = AgentTask(
        task_id=task_id,
        description=task_description,
        last_checkpoint=last_checkpoint,
    )

    # 7. Offline changes if this is a recovery run
    offline_changes = []
    if last_checkpoint:
        # Fetch events after checkpoint
        post_checkpoint_events = [e for e in relevant_events if e["created_at"] > last_checkpoint]
        offline_changes = post_checkpoint_events

    context_pack = ContextPack(
        project_id=project_id,
        agent_id=agent_id,
        run_id=run_id,
        context_version=project.context_version,
        artifact_version=project.artifact_version,
        section_versions=section_versions,
        requirements=requirements,
        approved_decisions=approved_decisions,
        artifact_summary=artifact_summary,
        relevant_events=relevant_events,
        open_proposals=open_proposals,
        agent_task=agent_task,
        offline_changes=offline_changes,
    )

    return context_pack


def create_and_persist_agent_run(
    db: Session,
    project_id: str,
    agent_id: str,
    run_id: str,
    task_id: str,
    task_description: str,
    last_checkpoint: Optional[str] = None,
    source: str = "live_llm",
) -> AgentRunModel:
    """
    Creates an AgentRunModel, builds its immutable Context Pack,
    and commits it to the database before the agent starts executing.
    """
    pack = build_context_pack(
        db=db,
        project_id=project_id,
        agent_id=agent_id,
        run_id=run_id,
        task_id=task_id,
        task_description=task_description,
        last_checkpoint=last_checkpoint,
    )

    run = AgentRunModel(
        id=run_id,
        project_id=project_id,
        agent_id=agent_id,
        status="working",
        task_description=task_description,
        context_pack=pack.model_dump(),
        base_context_version=pack.context_version,
        base_artifact_version=pack.artifact_version,
        last_checkpoint=last_checkpoint,
        source=source,
        started_at=utcnow_str(),
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return run
