import uuid
import json
import logging
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session

from backend.app.db.models import (
    ConversationModel,
    ConversationParticipantModel,
    ChatMessageModel,
    ProjectModel,
    RequirementModel,
    ArtifactSectionModel,
    ProposalModel,
    utcnow_str,
)
from backend.app.agents.provider import call_llm_json
from backend.app.context.pack_builder import create_and_persist_agent_run
from backend.app.proposals.stamping import stamp_and_persist_proposal
from backend.app.websocket.manager import ws_manager

logger = logging.getLogger(__name__)

# System directives for conversational execution
NOVA_CHAT_SYSTEM_PROMPT = """You are NOVA, the Principal AI Product Strategist at COFRAME collaborating on LedgerFlow, an enterprise expense-management platform.
Your collaborators are:
- Alex (Founder / Decision Owner)
- Maya (Product Designer)
- PIXEL (AI Software Engineer)

Your role:
1. Clarify user requirements, target audience, business value, constraints, and measurable acceptance criteria.
2. Provide strategic guidance and formulate Product Requirement Documents (PRDs).
3. Do NOT make up fake technical capabilities; respect COFRAME's proposal lifecycle.
4. When the user proposes a concrete requirement or asks to define a feature/PRD, generate:
   - Clear markdown analysis with headings, bullet points, and acceptance criteria.
   - Propose affected requirements and target sections.

Respond with valid JSON containing:
{
  "message": "Your conversational response in clear, professional GitHub-flavored Markdown",
  "proposal_intent": true or false,
  "proposal_summary": "Short title if proposing a requirements change",
  "affected_requirements": ["REQ_AUDIENCE" or "REQ_METRICS" or "REQ_BRAND" or "REQ_APPROVAL_POLICY"],
  "target_sections": ["product_brief" or "dashboard"]
}
"""

PIXEL_CHAT_SYSTEM_PROMPT = """You are PIXEL, the Principal AI Software Engineer at COFRAME building LedgerFlow, an enterprise expense-management prototype.
Your collaborators are:
- Alex (Founder / Decision Owner)
- Maya (Product Designer)
- NOVA (AI Product Strategist)

Your role:
1. Discuss implementation, frontend components, state management, and artifact changes.
2. Inspect current section versions and confirmed requirements before proposing changes.
3. You NEVER modify canonical artifact sections directly from chat. You create structured proposals that require human review and approval.
4. Supported operations allowlist:
   - set_hero_content (fields: headline, subheadline, cta_primary, cta_secondary)
   - set_dashboard_metrics (metrics: list of {label, value, change})
   - set_approval_queue_config (config: {threshold, policy_mode, escalation_chain})
   - update_product_brief (fields: target_audience, value_proposition)

Respond with valid JSON containing:
{
  "message": "Your conversational response explaining the implementation approach in Markdown",
  "proposal_intent": true or false,
  "proposal_summary": "Short title if proposing an artifact change",
  "target_sections": ["hero" or "dashboard" or "approval_queue"],
  "operations": [
    {"op": "set_hero_content" or "set_dashboard_metrics" or "set_approval_queue_config", "section": "...", "fields": {...}}
  ]
}
"""


async def dispatch_chat_message(
    db: Session,
    project_id: str,
    conversation_id: str,
    sender_id: str,
    recipient: str,
    message_content: str,
    related_task_id: Optional[str] = None,
) -> Tuple[ChatMessageModel, List[ChatMessageModel]]:
    """
    Main dispatch service:
    1. Validates sender authorization (Alex or Maya).
    2. Persists human message in database.
    3. Broadcasts message over WebSocket.
    4. Dispatches to NOVA, PIXEL, or Team Orchestration based on recipient.
    5. Returns (human_msg, agent_responses).
    """
    sender_clean = sender_id.strip().lower()
    if sender_clean not in ("alex", "maya"):
        raise ValueError(f"Unauthorized sender '{sender_id}'. Only 'alex' or 'maya' may send messages.")

    conversation = db.query(ConversationModel).filter(
        ConversationModel.id == conversation_id,
        ConversationModel.project_id == project_id,
    ).first()
    if not conversation:
        # Fallback to default team conversation if exists or create
        conversation = db.query(ConversationModel).filter(
            ConversationModel.project_id == project_id,
            ConversationModel.conversation_type == "team_shared",
        ).first()
        if not conversation:
            conversation = ConversationModel(
                id=conversation_id,
                project_id=project_id,
                title="LedgerFlow · Shared Team Conversation",
                conversation_type="team_shared",
                created_by=sender_clean,
            )
            db.add(conversation)
            db.commit()

    # 1. Persist human message
    now_str = utcnow_str()
    human_msg = ChatMessageModel(
        id=f"msg_h_{uuid.uuid4().hex[:8]}",
        conversation_id=conversation.id,
        sender_id=sender_clean,
        sender_type="human",
        recipient_id=recipient,
        recipient_type="agent" if recipient in ("nova", "pixel") else "team",
        message_content=message_content,
        message_type="human_message",
        status="delivered",
        related_task_id=related_task_id,
        created_at=now_str,
    )
    db.add(human_msg)
    conversation.updated_at = now_str
    db.commit()
    db.refresh(human_msg)

    # Broadcast human message
    await ws_manager.broadcast(project_id, {
        "type": "CHAT_MESSAGE_CREATED",
        "conversation_id": conversation.id,
        "message": serialize_chat_message(human_msg),
    })

    # 2. Agent Dispatch
    agent_responses: List[ChatMessageModel] = []
    recipient_clean = recipient.lower().strip()

    if recipient_clean == "nova":
        resp = await handle_nova_chat(db, project_id, conversation.id, sender_clean, message_content)
        if resp:
            agent_responses.append(resp)
    elif recipient_clean == "pixel":
        resp = await handle_pixel_chat(db, project_id, conversation.id, sender_clean, message_content)
        if resp:
            agent_responses.append(resp)
    else:
        # Team broadcast
        resps = await handle_team_chat(db, project_id, conversation.id, sender_clean, message_content)
        agent_responses.extend(resps)

    return human_msg, agent_responses


async def handle_nova_chat(
    db: Session,
    project_id: str,
    conversation_id: str,
    user_id: str,
    user_message: str,
) -> Optional[ChatMessageModel]:
    """Executes NOVA conversational logic and optionally creates requirements proposal."""
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    requirements = db.query(RequirementModel).filter(RequirementModel.project_id == project_id).all()
    reqs_summary = "\n".join([f"- {r.requirement_key}: {r.value} (v{r.version})" for r in requirements])

    user_prompt = f"""Current LedgerFlow Confirmed Requirements:
{reqs_summary}

User ({user_id.capitalize()}):
"{user_message}"

Provide a strategic analysis, clarifying questions, and next development steps."""

    raw_output = None
    source = "live_llm"
    is_simulated = False
    try:
        res = await call_llm_json(
            system_prompt=NOVA_CHAT_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            timeout=10.0,
        )
        raw_output, source, is_simulated = res
    except Exception as e:
        logger.info(f"NOVA Chat using deterministic intelligence fallback: {e}")
        source = "cached_fallback"
        is_simulated = True
        raw_output = _generate_nova_chat_fallback(user_message, requirements)

    message_text = raw_output.get("message") or "I have reviewed your strategic prompt."
    proposal_intent = raw_output.get("proposal_intent", False)
    related_proposal_id = None

    # If NOVA determines proposal intent (e.g. defining PRD / new feature), create a proposal
    if proposal_intent and raw_output.get("target_sections"):
        summary = raw_output.get("proposal_summary") or f"NOVA Requirements: {user_message[:40]}"
        try:
            run_id = f"run_nova_chat_{uuid.uuid4().hex[:6]}"
            create_and_persist_agent_run(
                db=db,
                project_id=project_id,
                agent_id="nova",
                run_id=run_id,
                task_id=f"chat_{conversation_id}",
                task_description=f"NOVA Chat Consultation: {summary}",
            )
            prop = stamp_and_persist_proposal(
                db=db,
                project_id=project_id,
                run_id=run_id,
                raw_output={
                    "summary": summary,
                    "reasoning": f"Formulated in workspace chat discussion with {user_id.capitalize()}: '{user_message}'",
                    "affected_requirements": raw_output.get("affected_requirements", ["REQ_AUDIENCE"]),
                    "target_sections": raw_output.get("target_sections", ["product_brief"]),
                    "changes": {
                        "operations": [
                            {
                                "op": "update_product_brief",
                                "section": "product_brief",
                                "fields": {"strategic_note": summary},
                            }
                        ]
                    },
                },
                source=source,
                is_simulated=is_simulated,
                created_by="nova",
                author_type="agent",
                proposal_type="prd_requirement",
            )
            related_proposal_id = prop.id
            message_text += f"\n\n**Actionable Proposal Created:** I've submitted a formal requirements proposal for review. Link: `#{prop.id[-6:]}`."
        except Exception as err:
            logger.warning(f"Could not create proposal from NOVA chat: {err}")

    now_str = utcnow_str()
    agent_msg = ChatMessageModel(
        id=f"msg_nova_{uuid.uuid4().hex[:8]}",
        conversation_id=conversation_id,
        sender_id="nova",
        sender_type="agent",
        recipient_id=user_id,
        recipient_type="human",
        message_content=message_text,
        message_type="agent_message",
        status="delivered",
        related_proposal_id=related_proposal_id,
        msg_metadata={
            "agent_role": "AI Product Strategist",
            "source": source,
            "is_simulated": is_simulated,
        },
        created_at=now_str,
    )
    db.add(agent_msg)
    db.commit()
    db.refresh(agent_msg)

    await ws_manager.broadcast(project_id, {
        "type": "CHAT_MESSAGE_CREATED",
        "conversation_id": conversation_id,
        "message": serialize_chat_message(agent_msg),
    })

    return agent_msg


async def handle_pixel_chat(
    db: Session,
    project_id: str,
    conversation_id: str,
    user_id: str,
    user_message: str,
) -> Optional[ChatMessageModel]:
    """Executes PIXEL implementation assistant and creates implementation proposals when requested."""
    sections = db.query(ArtifactSectionModel).filter(ArtifactSectionModel.project_id == project_id).all()
    sec_summary = "\n".join([f"- § {s.section_key} (v{s.version})" for s in sections])

    user_prompt = f"""Current LedgerFlow Artifact Sections:
{sec_summary}

User ({user_id.capitalize()}):
"{user_message}"

Explain the engineering approach and provide structured component updates if applicable."""

    raw_output = None
    source = "live_llm"
    is_simulated = False
    try:
        res = await call_llm_json(
            system_prompt=PIXEL_CHAT_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            timeout=10.0,
        )
        raw_output, source, is_simulated = res
    except Exception as e:
        logger.info(f"PIXEL Chat using deterministic intelligence fallback: {e}")
        source = "cached_fallback"
        is_simulated = True
        raw_output = _generate_pixel_chat_fallback(user_message, sections)

    message_text = raw_output.get("message") or "I have analyzed the LedgerFlow prototype architecture."
    proposal_intent = raw_output.get("proposal_intent", False)
    related_proposal_id = None

    if proposal_intent and raw_output.get("operations"):
        summary = raw_output.get("proposal_summary") or f"PIXEL Implementation: {user_message[:40]}"
        target_secs = raw_output.get("target_sections") or [raw_output["operations"][0].get("section", "hero")]
        try:
            run_id = f"run_pixel_chat_{uuid.uuid4().hex[:6]}"
            create_and_persist_agent_run(
                db=db,
                project_id=project_id,
                agent_id="pixel",
                run_id=run_id,
                task_id=f"chat_{conversation_id}",
                task_description=f"PIXEL Chat Implementation: {summary}",
            )
            prop = stamp_and_persist_proposal(
                db=db,
                project_id=project_id,
                run_id=run_id,
                raw_output={
                    "summary": summary,
                    "reasoning": f"Implementation requested via Workspace Chat by {user_id.capitalize()}: '{user_message}'",
                    "affected_requirements": [],
                    "target_sections": target_secs,
                    "changes": {"operations": raw_output["operations"]},
                },
                source=source,
                is_simulated=is_simulated,
                created_by="pixel",
                author_type="agent",
                proposal_type="prototype_modification",
            )
            related_proposal_id = prop.id
            message_text += f"\n\n**Implementation Proposal Submitted:** I've prepared the component modifications and submitted proposal `#{prop.id[-6:]}` for review. It requires human sign-off before applying to the canvas."
        except Exception as err:
            logger.warning(f"Could not create proposal from PIXEL chat: {err}")

    now_str = utcnow_str()
    agent_msg = ChatMessageModel(
        id=f"msg_pixel_{uuid.uuid4().hex[:8]}",
        conversation_id=conversation_id,
        sender_id="pixel",
        sender_type="agent",
        recipient_id=user_id,
        recipient_type="human",
        message_content=message_text,
        message_type="agent_message",
        status="delivered",
        related_proposal_id=related_proposal_id,
        msg_metadata={
            "agent_role": "AI Software Engineer",
            "source": source,
            "is_simulated": is_simulated,
        },
        created_at=now_str,
    )
    db.add(agent_msg)
    db.commit()
    db.refresh(agent_msg)

    await ws_manager.broadcast(project_id, {
        "type": "CHAT_MESSAGE_CREATED",
        "conversation_id": conversation_id,
        "message": serialize_chat_message(agent_msg),
    })

    return agent_msg


async def handle_team_chat(
    db: Session,
    project_id: str,
    conversation_id: str,
    user_id: str,
    user_message: str,
) -> List[ChatMessageModel]:
    """Orchestrates responses when messages are sent to the Entire Team."""
    msg_lower = user_message.lower()
    responses: List[ChatMessageModel] = []

    # If code/ui/dashboard/implementation: PIXEL responds
    is_implementation = any(w in msg_lower for w in ["pixel", "code", "dashboard", "hero", "ui", "component", "button", "build", "frontend"])
    # If strategy/idea/requirements/prd/audience/milestone: NOVA responds
    is_product = any(w in msg_lower for w in ["nova", "idea", "requirement", "prd", "audience", "market", "milestone", "strategy", "define"])

    if is_product or not is_implementation:
        resp_nova = await handle_nova_chat(db, project_id, conversation_id, user_id, user_message)
        if resp_nova:
            responses.append(resp_nova)

    if is_implementation or "milestone" in msg_lower or "team" in msg_lower:
        resp_pixel = await handle_pixel_chat(db, project_id, conversation_id, user_id, user_message)
        if resp_pixel:
            responses.append(resp_pixel)

    return responses


def create_system_chat_notification(
    db: Session,
    project_id: str,
    notification_text: str,
    related_proposal_id: Optional[str] = None,
    related_task_id: Optional[str] = None,
) -> Optional[ChatMessageModel]:
    """Appends an event-native system notification to the team conversation."""
    conversation = db.query(ConversationModel).filter(
        ConversationModel.project_id == project_id,
        ConversationModel.conversation_type == "team_shared",
    ).first()
    if not conversation:
        return None

    msg = ChatMessageModel(
        id=f"msg_sys_{uuid.uuid4().hex[:8]}",
        conversation_id=conversation.id,
        sender_id="system",
        sender_type="system",
        recipient_id="team",
        recipient_type="team",
        message_content=notification_text,
        message_type="system_notification",
        status="delivered",
        related_proposal_id=related_proposal_id,
        related_task_id=related_task_id,
        created_at=utcnow_str(),
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg


def serialize_chat_message(m: ChatMessageModel, proposal: Optional[ProposalModel] = None) -> Dict[str, Any]:
    """Formats chat message for API/WebSocket client consumers."""
    sender_name = m.sender_id.upper() if m.sender_type == "agent" else m.sender_id.capitalize()
    sender_role = "AI Product Strategist" if m.sender_id == "nova" else "AI Software Engineer" if m.sender_id == "pixel" else "Founder / Decision Owner" if m.sender_id == "alex" else "Product Designer" if m.sender_id == "maya" else "System Event"

    prop_summary = None
    if proposal:
        prop_summary = {
            "id": proposal.id,
            "proposal_id": proposal.id,
            "summary": proposal.summary,
            "status": proposal.status,
            "author": proposal.created_by,
        }

    return {
        "id": m.id,
        "conversation_id": m.conversation_id,
        "sender_id": m.sender_id,
        "sender_key": m.sender_id,
        "sender_name": sender_name,
        "sender_role": sender_role,
        "sender_type": m.sender_type,
        "recipient_id": m.recipient_id,
        "recipient_type": m.recipient_type,
        "message_content": m.message_content,
        "content": m.message_content,
        "message_type": m.message_type,
        "status": m.status,
        "related_task_id": m.related_task_id,
        "related_proposal_id": m.related_proposal_id,
        "related_proposal": prop_summary,
        "metadata": m.msg_metadata or {},
        "created_at": m.created_at,
    }


def _generate_nova_chat_fallback(message: str, requirements: List[RequirementModel]) -> Dict[str, Any]:
    """High-quality deterministic fallback response for NOVA."""
    m_lower = message.lower()
    if "idea" in m_lower or "define" in m_lower:
        return {
            "message": """### Strategic Product Framing · NOVA Analysis

I've analyzed your product idea for **LedgerFlow**. To translate this into a measurable PRD, here is our initial strategic specification:

1. **Target User Profile**: Finance directors and operational controllers needing audit-safe spend controls.
2. **Key Functional Requirements**:
   - Automated receipts ingestion with AI verification.
   - Granular multi-tier manager approval thresholds.
   - Real-time spend policy alerts.
3. **Acceptance Criteria**:
   - Expenses > $5,000 automatically escalate to executive review.
   - Instant visual diff on modified requirements.

Shall I generate a formal PRD proposal for review?""",
            "proposal_intent": True,
            "proposal_summary": "Define enterprise spend governance requirements",
            "affected_requirements": ["REQ_AUDIENCE", "REQ_APPROVAL_POLICY"],
            "target_sections": ["product_brief"],
        }
    elif "metric" in m_lower or "dashboard" in m_lower:
        return {
            "message": """### Metrics Visibility Guidance · NOVA

Tracking visibility is critical for financial controllers. For the LedgerFlow dashboard, I recommend:
- **Primary Metric**: Monthly aggregate spend against departmental budget.
- **Secondary Metrics**: Pending approval backlog, average time-to-approve, and category variance.

I have submitted this requirement alignment to keep PIXEL's component work synchronized.""",
            "proposal_intent": False,
        }
    else:
        return {
            "message": f"""### Product Guidance · NOVA

I've reviewed your request: *"{message}"*.

From a product strategy perspective:
- We should ensure alignment with our current **small business to enterprise** roadmap.
- Any change that modifies high-level approval limits requires **Alex's approval** to prevent unauthorized context drift.

Ready to assist you with PRD documentation or requirements synthesis.""",
            "proposal_intent": False,
        }


def _generate_pixel_chat_fallback(message: str, sections: List[ArtifactSectionModel]) -> Dict[str, Any]:
    """High-quality deterministic fallback response for PIXEL."""
    m_lower = message.lower()
    if "dashboard" in m_lower or "metric" in m_lower:
        return {
            "message": """### Engineering Blueprint · PIXEL Implementation

I've inspected the `dashboard` section of LedgerFlow. I will upgrade the live metrics visualization with:
- Monthly Spend Counter with trend indicator.
- Category breakdown pie chart integration.
- Real-time expense transaction feed.

Submitting structured implementation proposal for approval.""",
            "proposal_intent": True,
            "proposal_summary": "Upgrade dashboard with live spend analytics",
            "target_sections": ["dashboard"],
            "operations": [
                {
                    "op": "set_dashboard_metrics",
                    "section": "dashboard",
                    "metrics": [
                        {"label": "Monthly Spend", "value": "$42,850", "change": "+8.2%"},
                        {"label": "Pending Approvals", "value": "7 reports", "change": "-2.1%"},
                        {"label": "Policy Violations", "value": "0", "change": "0%"},
                    ],
                }
            ],
        }
    elif "hero" in m_lower or "header" in m_lower or "improve" in m_lower:
        return {
            "message": """### Component Enhancement · PIXEL Engineering

I've prepared an overhaul for the **hero** section with high-conversion corporate messaging and interactive CTA buttons.

Generating an atomic implementation proposal with allowlisted JSON operations.""",
            "proposal_intent": True,
            "proposal_summary": "Modernize hero header with enterprise spend CTAs",
            "target_sections": ["hero"],
            "operations": [
                {
                    "op": "set_hero_content",
                    "section": "hero",
                    "fields": {
                        "headline": "Modern Corporate Spend Management",
                        "subheadline": "Real-time visibility, automated multi-level approval routing, and seamless accounting sync.",
                        "cta_primary": "Launch Enterprise Trial",
                        "cta_secondary": "Explore Live Dashboard",
                    },
                }
            ],
        }
    else:
        return {
            "message": f"""### Implementation Assessment · PIXEL

I've analyzed your engineering query: *"{message}"*.

The current LedgerFlow frontend artifact is stable at the latest version. I am ready to formulate new UI sections, modify approval routing, or optimize dashboard components upon your command.""",
            "proposal_intent": False,
        }
