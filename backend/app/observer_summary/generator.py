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

        if etype == "PROJECT_INITIALIZED":
            what_changed = "Demo project reset to clean baseline."
            why = "Reset button triggered deterministic seed state."
            what_happens_next = "Click 'Start Collaboration' to launch NOVA and PIXEL parallel runs."

        elif etype == "HUMAN_REQUIREMENT_EDITED":
            req_key = payload.get("requirement_key", "REQ_AUDIENCE")
            new_val = payload.get("new_value", "Enterprise finance teams")
            what_changed = f"Requirement '{req_key}' updated to '{new_val}'."
            why = f"{latest_event.actor_id.capitalize()} shifted focus to enterprise workflows."
            what_happens_next = "Dependent proposals marked stale; NOVA will reconcile positioning."

        elif etype == "HUMAN_SECTION_EDITED":
            sec_key = payload.get("section_key", "hero")
            what_changed = f"Manual direct update made to '{sec_key}' section (now v{payload.get('new_version')})."
            why = f"{latest_event.actor_id.capitalize()} refined the prototype directly."
            what_happens_next = "Older agent proposals for this section now show a conflict badge."

        elif etype == "PROPOSAL_SUBMITTED":
            summary = payload.get("summary", "")
            agent = payload.get("agent_id", "agent").upper()
            what_changed = f"{agent} submitted proposal: '{summary}'."
            why = "Autonomous background task completed against current Context Pack."
            if payload.get("requires_decision"):
                what_happens_next = f"High-impact proposal awaiting decision by {payload.get('assigned_decider_id', 'Alex').upper()}."
            else:
                what_happens_next = "Awaiting review and approval by Alex or Maya."

        elif etype == "PROPOSAL_APPROVED":
            what_changed = f"Approved: '{payload.get('summary', 'Proposal')}'."
            why = f"Reviewed and approved by {payload.get('decided_by', 'human').capitalize()}."
            what_happens_next = f"Artifact advanced to v{payload.get('new_artifact_version')}. Prototype updated."

        elif etype == "PROPOSAL_REDIRECTED":
            what_changed = f"Human redirected agent: '{payload.get('instruction', '')}'."
            why = f"{payload.get('decided_by', 'Alex').capitalize()} requested modifications before approval."
            what_happens_next = "Agent is generating a linked revised proposal with updated context."

        elif etype == "PROPOSAL_RECONCILED":
            what_changed = "Stale proposal reconciled with fresh enterprise context."
            why = "Human initiated Reconcile action to adapt to new requirements."
            what_happens_next = "A new linked proposal has been created for review."

        elif etype == "AGENT_RECOVERED":
            agent = payload.get("agent_id", "NOVA").upper()
            what_changed = f"{agent} restarted and recovered context from persisted state."
            why = "Agent recovered from process restart using the fresh backend Context Pack."
            what_happens_next = f"{agent} resumed idle task stream ready for new assignments."

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
