import json
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from backend.app.db.models import (
    ProjectModel,
    ProposalModel,
    DecisionModel,
    ArtifactSectionModel,
    utcnow_str,
)


def export_approved_artifact_files(
    db: Session,
    project_id: str,
    proposal_id: str,
) -> Dict[str, str]:
    """
    Exports approved artifact state into the standard COFRAME Git repository layout:
    coframe-artifacts/
        ledgerflow/
            manifest.json
            product_brief.json
            hero.json
            dashboard.json
            approval_queue.json
            proposals/
                {proposal_id}.json
            CHANGELOG.md
    """
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise ValueError(f"Project '{project_id}' not found.")

    proposal = (
        db.query(ProposalModel)
        .filter(ProposalModel.id == proposal_id, ProposalModel.project_id == project_id)
        .first()
    )
    if not proposal:
        raise ValueError(f"Proposal '{proposal_id}' not found.")

    decision = (
        db.query(DecisionModel)
        .filter(DecisionModel.proposal_id == proposal_id, DecisionModel.decision == "approved")
        .order_by(DecisionModel.created_at.desc())
        .first()
    )
    decided_by = decision.decided_by if decision else "alex"

    sections = (
        db.query(ArtifactSectionModel)
        .filter(ArtifactSectionModel.project_id == project_id)
        .all()
    )
    section_map = {s.section_key: s for s in sections}
    section_versions = {s.section_key: s.version for s in sections}

    now_iso = utcnow_str()

    manifest = {
        "project_id": project.id,
        "proposal_id": proposal.id,
        "agent_identity": proposal.agent_id,
        "human_approver": decided_by,
        "context_version": project.context_version,
        "artifact_version": project.artifact_version,
        "section_versions": section_versions,
        "export_timestamp": now_iso,
        "export_format_version": "1.0",
        "generator": "COFRAME Collaborative Engine (Human + AI, One Shared Creation)",
    }

    base_dir = "coframe-artifacts/ledgerflow"
    files: Dict[str, str] = {}

    # 1. manifest.json
    files[f"{base_dir}/manifest.json"] = json.dumps(manifest, indent=2)

    # 2. Section JSON files
    standard_sections = ["product_brief", "hero", "dashboard", "approval_queue"]
    for sec_key in standard_sections:
        sec = section_map.get(sec_key)
        data = sec.data if sec else {}
        files[f"{base_dir}/{sec_key}.json"] = json.dumps(data, indent=2)

    # 3. Dedicated proposal record
    proposal_record = {
        "proposal_id": proposal.id,
        "project_id": proposal.project_id,
        "agent_id": proposal.agent_id,
        "summary": proposal.summary,
        "reasoning": proposal.reasoning,
        "affected_requirements": proposal.affected_requirements,
        "target_sections": proposal.target_sections,
        "changes": proposal.changes,
        "base_context_version": proposal.base_context_version,
        "base_artifact_version": proposal.base_artifact_version,
        "base_section_versions": proposal.base_section_versions,
        "status": proposal.status,
        "source": proposal.source,
        "approved_by": decided_by,
        "approved_at": decision.created_at if decision else now_iso,
    }
    files[f"{base_dir}/proposals/{proposal.id}.json"] = json.dumps(proposal_record, indent=2)

    # 4. Human-readable CHANGELOG.md
    target_secs_str = ", ".join(proposal.target_sections or ["general"])
    changelog_content = f"""# LedgerFlow Artifact Changelog

## [v{project.artifact_version}] - {now_iso}
- **Proposal ID:** `{proposal.id}`
- **Agent Identity:** `{proposal.agent_id.upper()}`
- **Approved by:** `{decided_by.capitalize()}`
- **Summary:** {proposal.summary}
- **Reasoning:** {proposal.reasoning}
- **Target Sections:** {target_secs_str}
- **Context Version:** v{project.context_version}
- **Artifact Version:** v{project.artifact_version}

### Approved Changes
```json
{json.dumps(proposal.changes, indent=2)}
```
---
*Exported automatically by COFRAME Engine following human signoff.*
"""
    files[f"{base_dir}/CHANGELOG.md"] = changelog_content

    return files
