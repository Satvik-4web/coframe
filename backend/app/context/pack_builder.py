from typing import Dict, Any, Optional, List, Set
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
from backend.app.schemas.context import (
    ContextPack,
    RequirementItem,
    HistoricalContextItem,
    ContextProvenance,
    ContextRetrievalMetrics,
    AgentTask,
)
from backend.app.context.retrieval import retriever, SECTION_DEPENDENCY_MAP


def build_context_pack(
    db: Session,
    project_id: str,
    agent_id: str,
    run_id: str,
    task_id: str,
    task_description: str,
    last_checkpoint: Optional[str] = None,
    target_sections: Optional[List[str]] = None,
    affected_requirements: Optional[List[str]] = None,
) -> ContextPack:
    """
    Builds the authoritative, version-aware, task-tailored Context Pack for an agent run
    from persisted project state using Hybrid Retrieval.
    """
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise ValueError(f"Project {project_id} not found")

    # 1. Execute Hybrid Retrieval & Ranking
    primary_cands, hist_cands, retrieval_metrics = retriever.retrieve(
        db=db,
        project_id=project_id,
        agent_id=agent_id,
        task_id=task_id,
        task_description=task_description,
        target_sections=target_sections,
        affected_requirements=affected_requirements,
    )

    # 2. Build Provenance objects for each primary item
    item_provenance: List[ContextProvenance] = []
    for c in primary_cands:
        prov = ContextProvenance(
            source_id=c.source_id,
            source_type=c.source_type,
            project_id=c.project_id,
            version=c.version,
            timestamp=c.timestamp,
            approval_status=c.status,
            retrieval_reason=c.retrieval_reason,
            relevance_score=c.final_score,
            scoring_breakdown={
                "keyword_score": round(c.keyword_score, 4),
                "semantic_score": round(c.semantic_score, 4),
                "task_dependency_score": round(c.task_dependency_score, 4),
                "freshness_score": round(c.freshness_score, 4),
                "source_reliability": round(c.source_reliability, 4),
                "approval_multiplier": round(c.approval_multiplier, 4),
            },
        )
        item_provenance.append(prov)

    # 3. Requirements (Ranked by task relevance, with embedded provenance)
    req_cands = [c for c in primary_cands if c.source_type == "requirement"]
    if not req_cands:
        req_models = db.query(RequirementModel).filter(RequirementModel.project_id == project_id).all()
        requirements = [
            RequirementItem(
                id=r.requirement_key,
                key=r.requirement_key,
                title=r.title,
                value=r.value,
                version=r.version,
                status=getattr(r, "status", "approved"),
                is_current=True,
            )
            for r in req_models
        ]
    else:
        requirements = [
            RequirementItem(
                id=c.key,
                key=c.key,
                title=c.title,
                value=c.raw_data,
                version=c.version,
                status=c.status,
                is_current=c.is_current,
                provenance=next((p for p in item_provenance if p.source_id == c.source_id), None),
            )
            for c in req_cands
        ]

    # 4. Historical Context (Preserved for comparison without polluting current requirements)
    historical_context: List[HistoricalContextItem] = [
        HistoricalContextItem(
            source_id=c.source_id,
            source_type=c.source_type,
            key=c.key,
            title=c.title,
            value=c.raw_data,
            version=c.version,
            status=c.status,
            timestamp=c.timestamp,
            reason_archived=c.retrieval_reason,
            superseded_by_version=c.latest_version if c.latest_version != c.version else None,
        )
        for c in hist_cands
    ]

    # 5. Artifact Sections & Section Versions (Bounded to target sections and dependencies when provided)
    all_sections = db.query(ArtifactSectionModel).filter(ArtifactSectionModel.project_id == project_id).all()
    section_versions: Dict[str, int] = {s.section_key: s.version for s in all_sections}

    if target_sections:
        needed_section_keys: Set[str] = set(target_sections)
        # Also include any sections retrieved in primary candidates
        for c in primary_cands:
            if c.source_type == "artifact_section":
                needed_section_keys.add(c.key)
        relevant_sections = [s for s in all_sections if s.section_key in needed_section_keys]
        if not relevant_sections:
            relevant_sections = all_sections
    else:
        relevant_sections = all_sections

    artifact_summary: Dict[str, Any] = {
        s.section_key: {
            "version": s.version,
            "data": s.data,
            "updated_by": s.updated_by,
        }
        for s in relevant_sections
    }

    # 6. Approved decisions
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

    # 7. Context Recovery & Relevant Events
    offline_changes = []
    if last_checkpoint:
        # Full retrieval of all missed events since checkpoint (no 15-event cutoff)
        if last_checkpoint.isdigit():
            checkpoint_events = (
                db.query(EventModel)
                .filter(EventModel.project_id == project_id, EventModel.sequence_no > int(last_checkpoint))
                .order_by(EventModel.sequence_no.asc())
                .all()
            )
        else:
            last_evt = db.query(EventModel).filter(
                EventModel.project_id == project_id,
                EventModel.id == last_checkpoint,
            ).first()
            if last_evt:
                checkpoint_events = (
                    db.query(EventModel)
                    .filter(EventModel.project_id == project_id, EventModel.sequence_no > last_evt.sequence_no)
                    .order_by(EventModel.sequence_no.asc())
                    .all()
                )
            else:
                checkpoint_events = (
                    db.query(EventModel)
                    .filter(EventModel.project_id == project_id, EventModel.created_at > last_checkpoint)
                    .order_by(EventModel.sequence_no.asc())
                    .all()
                )

        offline_changes = [
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
            for e in checkpoint_events
        ]
        relevant_events = offline_changes
    else:
        # Default baseline: last 15 events
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

    # 8. Open proposals
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

    # 9. Task info
    agent_task = AgentTask(
        task_id=task_id,
        description=task_description,
        last_checkpoint=last_checkpoint,
        target_sections=target_sections or [],
        affected_requirements=affected_requirements or [],
    )

    # 10. Authoritative vs Advisory Context Partitioning
    authoritative_context = {
        "requirements": [r.model_dump() for r in requirements if getattr(r, "status", "approved") == "approved"],
        "artifact_sections": artifact_summary,
        "approved_decisions": approved_decisions,
    }

    advisory_context = {
        "draft_requirements": [r.model_dump() for r in requirements if getattr(r, "status", "approved") != "approved"],
        "open_proposals": open_proposals,
    }

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
        authoritative_context=authoritative_context,
        advisory_context=advisory_context,
        historical_context=historical_context,
        item_provenance=item_provenance,
        retrieval_metrics=retrieval_metrics,
        retrieval_mode="hybrid_task_aware",
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
    target_sections: Optional[List[str]] = None,
    affected_requirements: Optional[List[str]] = None,
) -> AgentRunModel:
    """
    Creates an AgentRunModel, builds its immutable, version-aware Context Pack,
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
        target_sections=target_sections,
        affected_requirements=affected_requirements,
    )

    now_str = utcnow_str()
    run = AgentRunModel(
        id=run_id,
        project_id=project_id,
        agent_id=agent_id,
        status="working",
        lifecycle_state="working",
        task_description=task_description,
        context_pack=pack.model_dump(),
        base_context_version=pack.context_version,
        base_artifact_version=pack.artifact_version,
        last_checkpoint=last_checkpoint,
        source=source,
        started_at=now_str,
        last_heartbeat=now_str,
        current_task=task_description,
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return run
