import uuid
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from backend.app.db.models import (
    ProjectModel,
    RequirementModel,
    ArtifactSectionModel,
    ProposalModel,
    EventModel,
    SharedResourceModel,
    utcnow_str,
)


def get_all_workspace_resources(db: Session, project_id: str) -> List[Dict[str, Any]]:
    """
    Assembles a unified, authoritative registry of all shared creation resources:
    - LedgerFlow prototype sections
    - Active product requirements
    - Approved, pending, and rejected proposals
    - Persisted reference files and materials
    - Artifact snapshots
    """
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        return []

    resources: List[Dict[str, Any]] = []

    # 1. Custom / persisted resources from `resources` table
    custom_resources = (
        db.query(SharedResourceModel)
        .filter(SharedResourceModel.project_id == project_id)
        .order_by(SharedResourceModel.created_at.desc())
        .all()
    )
    for r in custom_resources:
        resources.append({
            "id": r.id,
            "resource_id": r.id,
            "resource_type": r.resource_type,
            "title": r.title,
            "description": r.description,
            "creator": f"{r.creator_type}:{r.creator_id}",
            "created_at": r.created_at,
            "related_proposal_id": r.related_proposal_id,
            "related_event_id": r.related_event_id,
            "artifact_version": r.artifact_version,
            "visibility": r.visibility,
            "data": r.data,
        })

    # 2. Artifact Prototype Sections
    sections = (
        db.query(ArtifactSectionModel)
        .filter(ArtifactSectionModel.project_id == project_id)
        .all()
    )
    for s in sections:
        res_id = f"res-proto-{s.section_key}"
        resources.append({
            "id": res_id,
            "resource_id": res_id,
            "resource_type": "prototype",
            "title": f"LedgerFlow Prototype: {s.section_key.replace('_', ' ').title()}",
            "description": f"Live rendered React section (v{s.version})",
            "creator": f"human:{s.updated_by}",
            "created_at": s.updated_at,
            "related_proposal_id": None,
            "related_event_id": None,
            "artifact_version": project.artifact_version,
            "visibility": "workspace",
            "data": {
                "section_key": s.section_key,
                "version": s.version,
                "fields": s.data,
            },
        })

    # 3. Product Requirements
    reqs = (
        db.query(RequirementModel)
        .filter(RequirementModel.project_id == project_id)
        .all()
    )
    for r in reqs:
        res_id = f"res-req-{r.requirement_key.lower()}"
        resources.append({
            "id": res_id,
            "resource_id": res_id,
            "resource_type": "requirement",
            "title": f"Requirement: {r.title}",
            "description": f"Key {r.requirement_key} (v{r.version})",
            "creator": f"human:{r.updated_by}",
            "created_at": r.updated_at,
            "related_proposal_id": None,
            "related_event_id": None,
            "artifact_version": project.artifact_version,
            "visibility": "workspace",
            "data": {
                "requirement_key": r.requirement_key,
                "value": r.value,
                "version": r.version,
            },
        })

    # 4. Proposals (Approved, Pending, Stale, Conflict)
    proposals = (
        db.query(ProposalModel)
        .filter(ProposalModel.project_id == project_id)
        .order_by(ProposalModel.created_at.desc())
        .limit(30)
        .all()
    )
    for p in proposals:
        res_id = f"res-prop-{p.id}"
        resources.append({
            "id": res_id,
            "resource_id": res_id,
            "resource_type": "proposal",
            "title": f"Proposal: {p.summary}",
            "description": f"Agent contribution by {p.agent_id.upper()} [{p.status.upper()}]",
            "creator": f"agent:{p.agent_id}",
            "created_at": p.created_at,
            "related_proposal_id": p.id,
            "related_event_id": None,
            "artifact_version": p.base_artifact_version,
            "visibility": "restricted" if p.requires_decision else "workspace",
            "data": {
                "status": p.status,
                "reasoning": p.reasoning,
                "target_sections": p.target_sections,
                "affected_requirements": p.affected_requirements,
                "changes": p.changes,
            },
        })

    return resources
