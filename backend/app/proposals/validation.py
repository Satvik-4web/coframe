from typing import List, Dict, Any, Tuple
from pydantic import ValidationError
from backend.app.schemas.proposals import ProposalModelOutput

ALLOWED_SECTIONS = {"product_brief", "hero", "dashboard", "approval_queue"}
ALLOWED_REQUIREMENTS = {
    "REQ_AUDIENCE",
    "REQ_METRICS",
    "REQ_BRAND",
    "REQ_APPROVAL_POLICY",
    "REQ_ROLES",
}
ALLOWED_OPERATIONS = {
    "update_product_brief",
    "set_hero_content",
    "set_dashboard_metrics",
    "set_approval_queue_config",
}


def validate_proposal_content(
    output_dict: Dict[str, Any],
    known_requirement_keys: List[str] = None,
) -> ProposalModelOutput:
    """
    Validates that the raw LLM output strictly conforms to the ProposalModelOutput schema
    and adheres to the allowed sections, requirements, and operations.
    """
    try:
        model_output = ProposalModelOutput(**output_dict)
    except ValidationError as e:
        raise ValueError(f"Proposal schema validation failed: {e}")

    # Validate target sections
    for sec in model_output.target_sections:
        if sec not in ALLOWED_SECTIONS:
            raise ValueError(f"Target section '{sec}' is not in allowed sections: {ALLOWED_SECTIONS}")

    # Validate affected requirements
    valid_keys = set(known_requirement_keys) if known_requirement_keys else ALLOWED_REQUIREMENTS
    for req in model_output.affected_requirements:
        if req not in valid_keys:
            raise ValueError(f"Affected requirement '{req}' is not a valid requirement key: {valid_keys}")

    # Validate operations
    operations = model_output.changes.get("operations", [])
    if not isinstance(operations, list):
        raise ValueError("Proposal 'changes.operations' must be a list of operations")

    for op in operations:
        op_name = op.get("op")
        if op_name not in ALLOWED_OPERATIONS:
            raise ValueError(f"Operation '{op_name}' is not in allowed operations: {ALLOWED_OPERATIONS}")

    return model_output


def compute_decision_policy(
    affected_requirements: List[str],
    target_sections: List[str],
    changes: Dict[str, Any],
) -> Tuple[bool, str | None]:
    """
    Server-side deterministic policy:
    Any proposal modifying the approval policy, thresholds, or role permissions
    MUST have requires_decision=True and assigned_decider_id="alex".
    Never trust LLM to set this.
    """
    high_impact_reqs = {"REQ_APPROVAL_POLICY", "REQ_ROLES"}
    if any(r in high_impact_reqs for r in affected_requirements):
        return True, "alex"

    # Also check if operations modify approval queue policy/threshold
    for op in changes.get("operations", []):
        if op.get("op") == "set_approval_queue_config":
            config = op.get("config", {})
            if "policy_note" in config or "threshold" in config or "requires_approval" in config:
                return True, "alex"

    return False, None
