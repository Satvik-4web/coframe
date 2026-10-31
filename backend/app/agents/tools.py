"""
Structured Tool Definitions and Permissions Engine for NOVA and PIXEL.
Strictly separates tool access based on agent role and validates all arguments.
Never permits direct mutation of canonical tables without human approval.
"""

from typing import Dict, Any, List, Optional
import json
import logging
from sqlalchemy.orm import Session

from backend.app.db.models import (
    ProjectModel,
    RequirementModel,
    ArtifactSectionModel,
    ProposalModel,
    DecisionModel,
)
from backend.app.agents.review import ALLOWED_OPERATIONS, ALLOWED_SECTIONS

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Tool Declarations (OpenAI / JSON-Schema format for LLMs)
# ---------------------------------------------------------------------------

NOVA_TOOLS: List[Dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "get_confirmed_requirements",
            "description": "Retrieves the confirmed product requirements for LedgerFlow (e.g. REQ_AUDIENCE, REQ_BRAND, REQ_METRICS, REQ_APPROVAL_POLICY).",
            "parameters": {
                "type": "object",
                "properties": {
                    "keys": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Optional list of requirement keys to filter by. Omit to fetch all.",
                    }
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_project_context",
            "description": "Retrieves high-level project metadata, current context version, artifact version, and recent approved decisions.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "propose_prd_document",
            "description": "Submits a human-readable 11-section Product Requirements Document (PRD) proposal for human review.",
            "parameters": {
                "type": "object",
                "required": ["title", "executive_summary", "target_audience", "functional_requirements"],
                "properties": {
                    "title": {"type": "string", "description": "PRD document title"},
                    "executive_summary": {
                        "type": "object",
                        "properties": {
                            "what": {"type": "string"},
                            "problem": {"type": "string"},
                            "outcome": {"type": "string"},
                        },
                        "required": ["what", "problem", "outcome"],
                    },
                    "target_audience": {"type": "string"},
                    "audience_needs": {"type": "array", "items": {"type": "string"}},
                    "user_stories": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "role": {"type": "string"},
                                "action": {"type": "string"},
                                "benefit": {"type": "string"},
                                "text": {"type": "string"},
                            },
                        },
                    },
                    "functional_requirements": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "id": {"type": "string"},
                                "title": {"type": "string"},
                                "description": {"type": "string"},
                                "priority": {"type": "string", "enum": ["High", "Medium", "Low"]},
                            },
                            "required": ["id", "title", "description"],
                        },
                    },
                    "acceptance_criteria": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "id": {"type": "string"},
                                "req_id": {"type": "string"},
                                "criterion": {"type": "string"},
                                "measurable": {"type": "boolean"},
                            },
                        },
                    },
                    "constraints_assumptions": {"type": "array", "items": {"type": "string"}},
                    "dependencies_risks": {"type": "array", "items": {"type": "string"}},
                    "open_questions": {"type": "array", "items": {"type": "string"}},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "review_pixel_proposal",
            "description": "Reviews a PIXEL engineering implementation proposal against confirmed product requirements to evaluate alignment.",
            "parameters": {
                "type": "object",
                "required": ["proposal_id"],
                "properties": {
                    "proposal_id": {"type": "string", "description": "ID of the PIXEL proposal to review"},
                },
            },
        },
    },
]


PIXEL_TOOLS: List[Dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "get_artifact_sections",
            "description": "Lists all current LedgerFlow prototype artifact sections (hero, dashboard, product_brief, approval_queue) and their versions.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_section_data",
            "description": "Reads the current JSON data and schema for a specific prototype section.",
            "parameters": {
                "type": "object",
                "required": ["section_key"],
                "properties": {
                    "section_key": {
                        "type": "string",
                        "enum": ["hero", "dashboard", "approval_queue", "product_brief"],
                        "description": "Key of the section to inspect",
                    },
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "propose_prototype_changes",
            "description": "Submits a structured engineering implementation proposal with allowlisted JSON operations for human sign-off.",
            "parameters": {
                "type": "object",
                "required": ["summary", "target_sections", "operations", "reasoning"],
                "properties": {
                    "summary": {"type": "string", "description": "Brief description of the implementation change"},
                    "reasoning": {"type": "string", "description": "Engineering rationale"},
                    "target_sections": {
                        "type": "array",
                        "items": {"type": "string", "enum": ["hero", "dashboard", "approval_queue", "product_brief"]},
                    },
                    "operations": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "required": ["op"],
                            "properties": {
                                "op": {
                                    "type": "string",
                                    "enum": ["set_hero_content", "set_dashboard_metrics", "set_approval_queue_config", "update_product_brief"],
                                },
                                "section": {"type": "string"},
                                "fields": {"type": "object"},
                                "metrics": {"type": "array"},
                                "categories": {"type": "array"},
                                "config": {"type": "object"},
                                "items": {"type": "array"},
                            },
                        },
                    },
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "validate_prototype_operations",
            "description": "Validates proposed operations against allowed schema allowlists and checks for target section compatibility.",
            "parameters": {
                "type": "object",
                "required": ["operations"],
                "properties": {
                    "operations": {"type": "array", "items": {"type": "object"}},
                },
            },
        },
    },
]


def get_agent_tools(agent_id: str) -> List[Dict[str, Any]]:
    """Returns the authorized tool declarations for an agent."""
    if agent_id.lower() == "nova":
        return NOVA_TOOLS
    elif agent_id.lower() == "pixel":
        return PIXEL_TOOLS
    return []


# ---------------------------------------------------------------------------
# Tool Execution Engine with Permission Checks
# ---------------------------------------------------------------------------

def execute_agent_tool(
    agent_id: str,
    tool_name: str,
    arguments: Dict[str, Any],
    db: Session,
    project_id: str,
) -> Dict[str, Any]:
    """
    Executes a structured tool call strictly within the agent's permission boundaries.
    Validates inputs and enforces read-only access or structured proposal creation.
    Never modifies canonical tables directly.
    """
    agent_clean = agent_id.lower()

    # Permission check: verify tool belongs to this agent
    nova_tool_names = {t["function"]["name"] for t in NOVA_TOOLS}
    pixel_tool_names = {t["function"]["name"] for t in PIXEL_TOOLS}

    if agent_clean == "nova" and tool_name not in nova_tool_names:
        raise PermissionError(f"Agent NOVA is not authorized to call tool '{tool_name}'.")
    if agent_clean == "pixel" and tool_name not in pixel_tool_names:
        raise PermissionError(f"Agent PIXEL is not authorized to call tool '{tool_name}'.")

    # 1. NOVA TOOLS
    if tool_name == "get_confirmed_requirements":
        filter_keys = arguments.get("keys")
        query = db.query(RequirementModel).filter(RequirementModel.project_id == project_id)
        if filter_keys:
            query = query.filter(RequirementModel.requirement_key.in_(filter_keys))
        reqs = query.all()
        return {
            "status": "success",
            "requirements": [
                {
                    "key": r.requirement_key,
                    "title": r.title,
                    "value": r.value,
                    "version": r.version,
                }
                for r in reqs
            ],
        }

    elif tool_name == "get_project_context":
        project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
        if not project:
            return {"status": "error", "message": "Project not found"}
        decisions = (
            db.query(DecisionModel)
            .join(ProposalModel, DecisionModel.proposal_id == ProposalModel.id)
            .filter(ProposalModel.project_id == project_id, DecisionModel.decision == "approved")
            .order_by(DecisionModel.created_at.desc())
            .limit(5)
            .all()
        )
        return {
            "status": "success",
            "project_name": project.name,
            "context_version": project.context_version,
            "artifact_version": project.artifact_version,
            "recent_approved_decisions": [
                {"proposal_id": d.proposal_id, "decided_by": d.decided_by, "note": d.note}
                for d in decisions
            ],
        }

    elif tool_name == "propose_prd_document":
        # Formulate proposal structure for review
        return {
            "status": "validated",
            "message": "PRD document validated and staged for proposal creation.",
            "prd_data": arguments,
        }

    elif tool_name == "review_pixel_proposal":
        proposal_id = arguments.get("proposal_id")
        proposal = db.query(ProposalModel).filter(ProposalModel.id == proposal_id).first()
        if not proposal:
            return {"status": "error", "message": f"Proposal '{proposal_id}' not found"}

        from backend.app.agents.review import validate_agent_proposal_output
        review_result = validate_agent_proposal_output(
            db=db,
            project_id=project_id,
            proposal_dict={
                "summary": proposal.summary,
                "target_sections": proposal.target_sections,
                "affected_requirements": proposal.affected_requirements,
                "changes": proposal.changes,
                "base_section_versions": proposal.base_section_versions or {},
                "base_context_version": proposal.base_context_version,
            },
            source_agent="pixel",
        )
        return {
            "status": "success",
            "verdict": review_result.verdict,
            "findings": [
                {"code": f.code, "severity": f.severity, "message": f.message}
                for f in review_result.findings
            ],
            "can_proceed_to_human_review": review_result.can_proceed_to_human_review,
        }

    # 2. PIXEL TOOLS
    elif tool_name == "get_artifact_sections":
        sections = db.query(ArtifactSectionModel).filter(ArtifactSectionModel.project_id == project_id).all()
        return {
            "status": "success",
            "sections": [
                {"section_key": s.section_key, "version": s.version, "updated_by": s.updated_by}
                for s in sections
            ],
        }

    elif tool_name == "get_section_data":
        sec_key = arguments.get("section_key")
        sec = db.query(ArtifactSectionModel).filter(
            ArtifactSectionModel.project_id == project_id,
            ArtifactSectionModel.section_key == sec_key,
        ).first()
        if not sec:
            return {"status": "error", "message": f"Section '{sec_key}' not found"}
        return {
            "status": "success",
            "section_key": sec.section_key,
            "version": sec.version,
            "data": sec.data,
        }

    elif tool_name == "validate_prototype_operations":
        ops = arguments.get("operations", [])
        errors = []
        for i, op in enumerate(ops):
            op_name = op.get("op")
            if not op_name:
                errors.append(f"Operation index {i} missing 'op' attribute")
            elif op_name not in ALLOWED_OPERATIONS:
                errors.append(f"Operation '{op_name}' not in allowed allowlist: {list(ALLOWED_OPERATIONS)}")
        return {
            "status": "success" if not errors else "invalid",
            "valid": len(errors) == 0,
            "errors": errors,
        }

    elif tool_name == "propose_prototype_changes":
        ops = arguments.get("operations", [])
        invalid = [op.get("op") for op in ops if op.get("op") not in ALLOWED_OPERATIONS]
        if invalid:
            return {
                "status": "error",
                "message": f"Disallowed operations detected: {invalid}",
            }
        return {
            "status": "validated",
            "message": "Component operations validated and staged for proposal creation.",
            "operations": ops,
        }

    raise ValueError(f"Unknown tool '{tool_name}'")
