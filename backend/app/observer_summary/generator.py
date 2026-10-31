import json
import logging
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from backend.app.db.models import EventModel, ProjectModel, ProposalModel, RequirementModel
from backend.app.schemas.summary import ObserverSummaryResponse
from backend.app.agents.provider import call_llm_json

logger = logging.getLogger(__name__)

OBSERVER_SYSTEM_PROMPT = """
You are the COFRAME Observer Summary Generator.
You analyze recent events, requirements, and pending proposals to produce a high-level, human-understandable 3-part summary for non-technical users and judges.
Return ONLY a JSON object:
{
  "what_changed": "Brief statement of the single most meaningful recent change.",
  "why": "Human intention, requirement change, or strategic reason behind it.",
  "what_happens_next": "Next pending human decision or agent task."
}
No extra text.
"""


async def generate_observer_summary(
    db: Session,
    project_id: str,
) -> ObserverSummaryResponse:
    """
    Produces the authoritative Observer Summary from persisted project events & state.
    Uses LLM when available, with a reliable deterministic rule-based fallback.
    """
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        return ObserverSummaryResponse(
            what_changed="Project initialized.",
            why="Workspace loaded with baseline LedgerFlow state.",
            what_happens_next="Ready to start human and AI collaboration.",
            source_event_ids=[],
            context_version=1,
            artifact_version=1,
            source="rule_based_fallback",
            is_simulated=False,
        )

    # Fetch last 8 events
    events = (
        db.query(EventModel)
        .filter(EventModel.project_id == project_id)
        .order_by(EventModel.sequence_no.desc())
        .limit(8)
        .all()
    )
    event_ids = [e.id for e in events]
    latest_event = events[0] if events else None

    # Pending proposals
    pending = (
        db.query(ProposalModel)
        .filter(ProposalModel.project_id == project_id, ProposalModel.status == "pending_review")
        .all()
    )

    # Stale/Conflict proposals
    stale_or_conflicted = (
        db.query(ProposalModel)
        .filter(ProposalModel.project_id == project_id, ProposalModel.status.in_(["stale", "conflict"]))
        .all()
    )

    # Determine rule-based summary dynamically
    what_changed = "Collaboration workspace active."
    why = "Team is evolving the LedgerFlow expense management artifact."
    what_happens_next = "Review pending proposals or update requirements."

    if latest_event:
        etype = latest_event.event_type
        payload = latest_event.payload or {}

        if etype in ["PROJECT_INITIALIZED", "workspace.initialized"]:
            if pending or stale_or_conflicted:
                total = len(pending) + len(stale_or_conflicted)
                what_changed = f"Active demo scenario loaded with {total} proposals."
                why = "Workspace loaded with pre-seeded collaborative contributions."
                what_happens_next = "Review pending proposals in the Proposals view."
            else:
                what_changed = "Clean baseline initialized."
                why = "Workspace reset to baseline state with no pending proposals."
                what_happens_next = "Start a new product task to engage NOVA."

        elif etype in ["HUMAN_REQUIREMENT_EDITED", "requirement.updated"]:
            req_key = payload.get("requirement_key", "REQ_AUDIENCE")
            new_val = payload.get("new_value", "Enterprise finance teams")
            what_changed = f"Requirement '{req_key}' updated to '{new_val}'."
            why = f"{latest_event.actor_id.capitalize()} shifted focus to enterprise workflows."
            what_happens_next = "Dependent proposals marked stale; NOVA will reconcile positioning."

        elif etype in ["HUMAN_SECTION_EDITED", "artifact.updated"]:
            sec_key = payload.get("section_key", "hero")
            what_changed = f"Manual direct update made to '{sec_key}' section (now v{payload.get('new_version')})."
            why = f"{latest_event.actor_id.capitalize()} refined the prototype directly."
            what_happens_next = "Older agent proposals for this section now show a conflict badge."

        elif etype in ["PROPOSAL_SUBMITTED", "proposal.created"]:
            summary = payload.get("summary", "")
            agent = payload.get("agent_id", "agent").upper()
            what_changed = f"{agent} submitted proposal: '{summary}'."
            why = "Autonomous background task completed against current Context Pack."
            if payload.get("requires_decision"):
                what_happens_next = f"High-impact proposal awaiting decision by {payload.get('assigned_decider_id', 'Alex').upper()}."
            else:
                what_happens_next = "Awaiting review and approval by Alex or Maya."

        elif etype in ["PROPOSAL_APPROVED", "proposal.approved"]:
            what_changed = f"Approved: '{payload.get('summary', 'Proposal')}'."
            why = f"Reviewed and approved by {payload.get('decided_by', 'human').capitalize()}."
            what_happens_next = f"Artifact advanced to v{payload.get('new_artifact_version')}. Prototype updated."

        elif etype in ["PROPOSAL_REDIRECTED", "proposal.redirected"]:
            what_changed = f"Human redirected agent: '{payload.get('instruction', '')}'."
            why = f"{payload.get('decided_by', 'Alex').capitalize()} requested modifications before approval."
            what_happens_next = "Agent is generating a linked revised proposal with updated context."

        elif etype in ["PROPOSAL_RECONCILED", "proposal.reconciled"]:
            what_changed = "Stale proposal reconciled with fresh enterprise context."
            why = "Human initiated Reconcile action to adapt to new requirements."
            what_happens_next = "A new linked proposal has been created for review."

        elif etype in ["AGENT_RECOVERED", "context.recovered"]:
            agent = payload.get("agent_id", "NOVA").upper()
            what_changed = f"{agent} restarted and recovered context from persisted state."
            why = "Agent recovered from process restart using the fresh backend Context Pack."
            what_happens_next = f"{agent} resumed idle task stream ready for new assignments."

        elif etype in ["APPROVAL_REQUESTED", "approval.requested"]:
            what_changed = f"Approval requested: '{payload.get('title', 'High-impact decision')}'."
            why = payload.get("escalation_reason", "Important product policy change requires owner sign-off.")
            what_happens_next = f"Awaiting review by {payload.get('assigned_decider_id', 'Alex').capitalize()}."

        elif etype in ["APPROVAL_RESOLVED", "approval.resolved"]:
            what_changed = f"Approval resolved ({payload.get('status', 'resolved')}): '{payload.get('title', '')}'."
            why = f"Actioned by {payload.get('resolved_by', 'human').capitalize()}."
            what_happens_next = "Associated proposal and tasks can proceed."

        elif etype in ["DELEGATION_CREATED", "delegation.created"]:
            what_changed = f"Agent delegation: {payload.get('source_agent', 'NOVA').upper()} → {payload.get('target_agent', 'PIXEL').upper()}."
            why = payload.get("task", "Multi-agent autonomous collaboration assignment.")
            what_happens_next = f"{payload.get('target_agent', 'PIXEL').upper()} will generate an implementation proposal."

        elif etype in ["expense.submitted", "EXPENSE_SUBMITTED"]:
            amount = payload.get("amount", 0)
            category = payload.get("category", "Expense")
            what_changed = f"Expense submitted: ${amount:.2f} ({category}) by {latest_event.actor_id.capitalize()}."
            why = payload.get("description", "Employee business expense submitted into LedgerFlow.")
            if payload.get("threshold_exceeded"):
                what_happens_next = "Amount exceeds $500 threshold; requires Alex approval."
            else:
                what_happens_next = "Awaiting review and approval by Alex or Maya."

        elif etype in ["expense.approved", "EXPENSE_APPROVED"]:
            amount = payload.get("amount", 0)
            what_changed = f"Expense approved: ${amount:.2f} by {payload.get('decided_by', 'manager').capitalize()}."
            why = payload.get("reason") or "Verified compliant with corporate spending policy."
            what_happens_next = "Financial dashboard metrics and reimbursement ledger updated."

        elif etype in ["impact.calculated", "IMPACT_ANALYSIS_COMPLETED"]:
            stale_c = payload.get("stale_count", 0)
            conflict_c = payload.get("conflict_count", 0)
            what_changed = f"Smart Impact Engine analyzed {stale_c} stale and {conflict_c} conflicted proposal(s)."
            why = f"Dependency registry detected updates to {len(payload.get('changed_requirements', []))} requirement(s)."
            what_happens_next = "Review Attention Required cards or reconcile affected proposals."
            why = payload.get("task", "Cross-agent task delegation.")
            what_happens_next = f"{payload.get('target_agent', 'PIXEL').upper()} will engineer proposal."

        elif etype in ["DELEGATION_COMPLETED", "delegation.completed"]:
            what_changed = f"Delegation completed by {payload.get('target_agent', 'PIXEL').upper()}."
            why = "Implementation submitted for human review."
            what_happens_next = "Resulting proposal is ready for approval in workspace."

    # Try live LLM summary if provider is configured
    try:
        context_data = {
            "latest_event": {
                "type": latest_event.event_type if latest_event else None,
                "actor": latest_event.actor_id if latest_event else None,
                "payload": latest_event.payload if latest_event else {},
            },
            "pending_count": len(pending),
            "stale_count": len(stale_or_conflicted),
            "context_version": project.context_version,
            "artifact_version": project.artifact_version,
        }
        res, source, is_sim = await call_llm_json(
            system_prompt=OBSERVER_SYSTEM_PROMPT,
            user_prompt=f"Generate 3-part observer summary for:\n{json.dumps(context_data, indent=2)}",
            timeout=5.0,
        )
        if "what_changed" in res and "why" in res and "what_happens_next" in res:
            return ObserverSummaryResponse(
                what_changed=res["what_changed"],
                why=res["why"],
                what_happens_next=res["what_happens_next"],
                source_event_ids=event_ids[:3],
                context_version=project.context_version,
                artifact_version=project.artifact_version,
                source="live_llm",
                is_simulated=False,
            )
    except Exception:
        pass

    # Deterministic rule-based fallback
    return ObserverSummaryResponse(
        what_changed=what_changed,
        why=why,
        what_happens_next=what_happens_next,
        source_event_ids=event_ids[:3],
        context_version=project.context_version,
        artifact_version=project.artifact_version,
        source="rule_based_fallback",
        is_simulated=False,
    )
