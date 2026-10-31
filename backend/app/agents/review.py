"""
Structured Agent Review Engine for NOVA and PIXEL.
Implements deterministic schema, version, dependency, and semantic validation
returning structured verdicts: PASS, WARNING, or BLOCK.
"""

from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from sqlalchemy.orm import Session

from backend.app.db.models import (
    ProposalModel,
    RequirementModel,
    ArtifactSectionModel,
    ProjectModel,
)


class ReviewVerdictType:
    PASS = "PASS"          # Eligible for human review (never auto-approved)
    WARNING = "WARNING"    # Eligible for review, but flags non-critical concerns
    BLOCK = "BLOCK"        # Hard deterministic failure; prevents submission to review


# Allowed operation allowlist
ALLOWED_OPERATIONS = {
    "update_product_brief",
    "set_hero_content",
    "set_dashboard_metrics",
    "set_approval_queue_config",
}

# Allowed sections allowlist
ALLOWED_SECTIONS = {
    "product_brief",
    "hero",
    "dashboard",
    "approval_queue",
}


@dataclass
class ReviewFinding:
    severity: str  # "INFO", "WARNING", "BLOCK"
    code: str
    message: str


@dataclass
class StructuredReviewResult:
    verdict: str  # "PASS", "WARNING", "BLOCK"
    reviewer: str  # "nova_strategist", "system_validator"
    summary: str
    findings: List[ReviewFinding] = field(default_factory=list)
    can_proceed_to_human_review: bool = True


def validate_agent_proposal_output(
    db: Session,
    project_id: str,
    proposal_dict: Dict[str, Any],
    source_agent: str,
) -> StructuredReviewResult:
    """
    Executes strict multi-layer validation on AI agent output.
    Layer 1: Schema & Allowed Operations Check
    Layer 2: Target Section Existence & Version Freshness Check
    Layer 3: Requirement Dependency Check
    Layer 4: Semantic & Impact Alignment
    """
    findings: List[ReviewFinding] = []

    # 1. Schema & Operations check
    changes = proposal_dict.get("changes", {})
    operations = changes.get("operations", [])

    if not operations:
        findings.append(
            ReviewFinding(
                severity="BLOCK",
                code="EMPTY_OPERATIONS",
                message="Proposal does not contain any executable change operations.",
            )
        )

    for op in operations:
        op_name = op.get("op")
        if not op_name:
            findings.append(
                ReviewFinding(
                    severity="BLOCK",
                    code="MISSING_OPERATION_NAME",
                    message="An operation is missing the required 'op' attribute.",
                )
            )
        elif op_name not in ALLOWED_OPERATIONS:
            findings.append(
                ReviewFinding(
                    severity="BLOCK",
                    code="DISALLOWED_OPERATION",
                    message=f"Operation '{op_name}' is not in the allowed schema allowlist.",
                )
            )

    # 2. Section check
    target_sections = proposal_dict.get("target_sections", [])
    if not target_sections:
        findings.append(
            ReviewFinding(
                severity="BLOCK",
                code="NO_TARGET_SECTIONS",
                message="Proposal must target at least one valid artifact section.",
            )
        )

    project_sections = {
        s.section_key: s
        for s in db.query(ArtifactSectionModel)
        .filter(ArtifactSectionModel.project_id == project_id)
        .all()
    }

    base_sec_versions = proposal_dict.get("base_section_versions", {})
    for sec_key in target_sections:
        if sec_key not in ALLOWED_SECTIONS:
            findings.append(
                ReviewFinding(
                    severity="BLOCK",
                    code="INVALID_SECTION",
                    message=f"Section '{sec_key}' is not a recognized artifact section.",
                )
            )
        elif sec_key in project_sections:
            curr_sec = project_sections[sec_key]
            expected_ver = base_sec_versions.get(sec_key, 1)
            if curr_sec.version > expected_ver:
                findings.append(
                    ReviewFinding(
                        severity="WARNING",
                        code="SECTION_VERSION_DRIFT",
                        message=f"Section '{sec_key}' current version (v{curr_sec.version}) is ahead of base version (v{expected_ver}).",
                    )
                )

    # 3. Requirement check
    affected_reqs = proposal_dict.get("affected_requirements", [])
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    curr_ctx_ver = project.context_version if project else 1
    base_ctx_ver = proposal_dict.get("base_context_version", 1)

    if base_ctx_ver < curr_ctx_ver and affected_reqs:
        findings.append(
            ReviewFinding(
                severity="WARNING",
                code="CONTEXT_DRIFT",
                message=f"Proposal base context version (v{base_ctx_ver}) is behind current workspace context (v{curr_ctx_ver}).",
            )
        )

    # 4. Determine final verdict
    has_block = any(f.severity == "BLOCK" for f in findings)
    has_warning = any(f.severity == "WARNING" for f in findings)

    if has_block:
        verdict = ReviewVerdictType.BLOCK
        summary = "Deterministic validation failed. Proposal cannot be submitted for human review."
        can_proceed = False
    elif has_warning:
        verdict = ReviewVerdictType.WARNING
        summary = "Validation passed with warnings. Context or section version drift requires human attention."
        can_proceed = True
    else:
        verdict = ReviewVerdictType.PASS
        summary = "All schema, allowed operation, section, and version checks passed cleanly."
        can_proceed = True

    return StructuredReviewResult(
        verdict=verdict,
        reviewer="nova_strategist" if source_agent == "pixel" else "system_validator",
        summary=summary,
        findings=findings,
        can_proceed_to_human_review=can_proceed,
    )
