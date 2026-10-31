import uuid
import json
import logging
import time
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
    AgentRunModel,
    utcnow_str,
)
from backend.app.agents.provider import call_llm_json, get_effective_model
from backend.app.agents.tools import get_agent_tools
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
2. Provide strategic guidance, answer product questions, and formulate Product Requirement Documents (PRDs).
3. Do NOT make up fake technical capabilities; respect COFRAME's proposal lifecycle.
4. Maintain continuity across multiple conversation turns: remember prior discussion points, requirements, and decisions.
5. Answer questions conversationally and thoughtfully by default.
6. ONLY set "proposal_intent": true when the user explicitly requests to create/generate/submit a proposal or PRD, or specifically asks to propose a concrete change. For exploratory or policy questions (e.g. "how should we structure...", "what do you think...", "can you explain..."), provide clear strategic advice and set "proposal_intent": false.

Respond with valid JSON containing:
{
  "message": "Your conversational response in clear, professional GitHub-flavored Markdown",
  "proposal_intent": false,
  "proposal_summary": "Short title if proposing a requirements change (null otherwise)",
  "affected_requirements": ["REQ_AUDIENCE" or "REQ_METRICS" or "REQ_BRAND" or "REQ_ROLES"],
  "target_sections": ["product_brief" or "dashboard" or "approval_queue" or "hero"]
}
"""

PIXEL_CHAT_SYSTEM_PROMPT = """You are PIXEL, the Principal AI Software Engineer at COFRAME building LedgerFlow, an enterprise expense-management prototype.
Your collaborators are:
- Alex (Founder / Decision Owner)
- Maya (Product Designer)
- NOVA (AI Product Strategist)

Your role:
1. Discuss implementation, frontend components, state management, architecture, and artifact changes.
2. Inspect current section versions and confirmed requirements before proposing changes.
3. Maintain conversation continuity: remember what was previously discussed or proposed in this conversation.
4. You NEVER modify canonical artifact sections directly from chat. You create structured proposals that require human review and approval.
5. Supported operations allowlist:
   - set_hero_content (fields: headline, subheadline, cta_primary, cta_secondary)
   - set_dashboard_metrics (metrics: list of {label, value, change})
   - set_approval_queue_config (config: {threshold, policy_mode, escalation_chain})
   - update_product_brief (fields: target_audience, value_proposition)
6. ONLY set "proposal_intent": true and provide "operations" when the user explicitly requests code changes, UI updates, or a proposal (e.g. "update the hero", "implement this", "create proposal"). For general engineering discussions or questions, provide an engineering breakdown and set "proposal_intent": false.

Respond with valid JSON containing:
{
  "message": "Your conversational response explaining the implementation approach in Markdown",
  "proposal_intent": false,
  "proposal_summary": "Short title if proposing an artifact change (null otherwise)",
  "target_sections": ["hero" or "dashboard" or "approval_queue"],
  "operations": []
}
"""


def _build_multi_turn_context(
    db: Session,
    project_id: str,
    conversation_id: str,
    user_id: str,
    user_message: str,
    agent_id: str,
    max_history_turns: int = 8,
) -> Tuple[str, List[str], List[str]]:
    """
    Builds an authoritative, token-bounded multi-turn context including:
    1. Past conversation transcript (up to max_history_turns preceding messages).
    2. Confirmed project requirements with versions.
    3. Canonical artifact section versions.
    4. Recent active proposals with statuses.
    5. The incoming user prompt.

    Returns: (assembled_user_prompt, valid_requirement_keys, target_section_keys)
    """
    requirements = db.query(RequirementModel).filter(RequirementModel.project_id == project_id).all()
    valid_req_keys = [r.requirement_key for r in requirements] or ["REQ_AUDIENCE", "REQ_METRICS", "REQ_BRAND", "REQ_ROLES"]
    reqs_summary = "\n".join([f"- {r.requirement_key}: {r.value} (v{r.version})" for r in requirements])

    sections = db.query(ArtifactSectionModel).filter(ArtifactSectionModel.project_id == project_id).all()
    section_keys = [s.section_key for s in sections] or ["hero", "dashboard", "approval_queue", "product_brief"]
    secs_summary = "\n".join([f"- § {s.section_key} (v{s.version})" for s in sections])

    recent_proposals = (
        db.query(ProposalModel)
        .filter(ProposalModel.project_id == project_id)
        .order_by(ProposalModel.created_at.desc())
        .limit(3)
        .all()
    )
    props_summary = "\n".join([
        f"- #{p.id[-6:]} ({p.created_by}): {p.summary} [{p.status}]"
        for p in recent_proposals
    ]) or "None"

    # Prior messages (excluding the message that just arrived if it is already in DB)
    all_msgs = (
        db.query(ChatMessageModel)
        .filter(ChatMessageModel.conversation_id == conversation_id)
        .order_by(ChatMessageModel.created_at.asc())
        .all()
    )
    prior_msgs = [
        m for m in all_msgs
        if not (m.sender_type == "human" and m.message_content.strip() == user_message.strip() and m == all_msgs[-1])
    ]
    recent_history = prior_msgs[-max_history_turns:] if len(prior_msgs) > max_history_turns else prior_msgs

    history_lines = []
    for m in recent_history:
        sender_label = m.sender_id.upper() if m.sender_type == "agent" else m.sender_id.capitalize()
        content_preview = m.message_content.strip()
        if len(content_preview) > 300:
            content_preview = content_preview[:300] + "... [truncated]"
        history_lines.append(f"{sender_label}: \"{content_preview}\"")

    history_text = "\n".join(history_lines) if history_lines else "(No prior conversation messages)"

    user_name = user_id.capitalize()
    assembled_prompt = f"""=== Multi-Turn Conversation History ===
{history_text}

=== Confirmed LedgerFlow Requirements ===
{reqs_summary}

=== Current Canvas Sections ===
{secs_summary}

=== Recent Active Proposals ===
{props_summary}

=== Current User Message ===
User ({user_name}):
"{user_message}"

Instruction for {agent_id.upper()}:
- Review the conversation history and maintain context continuity.
- Directly address {user_name}'s question or request.
- Only propose formal artifact or PRD updates if explicitly requested or needed.
"""
    return assembled_prompt, valid_req_keys, section_keys


def _should_create_proposal(user_message: str, raw_output: Dict[str, Any], agent_id: str) -> bool:
    """
    Separates general conversational questions from explicit proposal actions.
    Proposals are created if:
    1. The user explicitly requests a proposal/PRD/implementation/improvement.
    2. The LLM output provides complete PRD data or concrete operations
       AND the user message is NOT a pure informational/exploratory question ('how should we', 'what do you think', etc.).
    """
    m_lower = user_message.lower().strip()

    # Pure conversational/exploratory questions should NOT create premature proposals
    is_exploratory_question = any(
        m_lower.startswith(q) or f" {q}" in m_lower
        for q in [
            "how should we", "how do we", "how would we", "what do you think",
            "can you explain", "what are the options", "tell me about", "what is"
        ]
    )

    # Explicit proposal triggers always create proposal if agent supports it
    explicit_triggers = [
        "create proposal", "create a proposal", "submit proposal", "submit a proposal",
        "generate proposal", "generate a proposal", "propose a change", "propose an update",
        "create prd", "generate prd", "submit prd", "update hero", "update dashboard",
        "implement this", "apply this change",
    ]
    if any(t in m_lower for t in explicit_triggers):
        return bool(raw_output.get("proposal_intent"))

    if is_exploratory_question:
        # Don't create a proposal for exploratory questions even if LLM defaulted to proposal_intent=True
        return False

    if raw_output.get("force_proposal") is True:
        return True

    # Otherwise, if the agent returned proposal_intent with target sections or operations
    return bool(raw_output.get("proposal_intent")) and bool(raw_output.get("target_sections") or raw_output.get("operations"))


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
    4. Routes to NOVA, PIXEL, or Team Orchestration based on recipient or mention.
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

    # 2. Agent Dispatch with intelligent recipient detection
    agent_responses: List[ChatMessageModel] = []
    recipient_clean = recipient.lower().strip()
    m_lower = message_content.lower().strip()

    # Intelligent addressing: if recipient is 'team', check for direct agent mention/prefix
    if recipient_clean == "team":
        nova_prefixes = ["nova,", "nova:", "@nova", "hey nova", "to nova:"]
        pixel_prefixes = ["pixel,", "pixel:", "@pixel", "hey pixel", "to pixel:"]
        if any(m_lower.startswith(p) for p in nova_prefixes):
            recipient_clean = "nova"
        elif any(m_lower.startswith(p) for p in pixel_prefixes):
            recipient_clean = "pixel"

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
    """Executes NOVA conversational logic, maintaining multi-turn context and run lifecycle."""
    user_prompt, valid_req_keys, section_keys = _build_multi_turn_context(
        db=db,
        project_id=project_id,
        conversation_id=conversation_id,
        user_id=user_id,
        user_message=user_message,
        agent_id="nova",
    )

    # 1. Initialize and persist Agent Run tracking this conversational turn
    run_id = f"run_nova_chat_{uuid.uuid4().hex[:6]}"
    task_desc = f"NOVA Chat Consultation: {user_message[:50]}"
    run = create_and_persist_agent_run(
        db=db,
        project_id=project_id,
        agent_id="nova",
        run_id=run_id,
        task_id=f"chat_{conversation_id}",
        task_description=task_desc,
        target_sections=section_keys[:2],
        affected_requirements=valid_req_keys[:2],
    )

    raw_output = None
    source = "live_llm"
    is_simulated = False
    try:
        res = await call_llm_json(
            system_prompt=NOVA_CHAT_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            timeout=25.0,
            model=get_effective_model("nova"),
            agent_id="nova",
            tools=get_agent_tools("nova"),
        )
        raw_output, source, is_simulated = res
    except Exception as e:
        logger.info(f"NOVA Chat using deterministic intelligence fallback: {e}")
        source = "cached_fallback"
        is_simulated = True
        requirements = db.query(RequirementModel).filter(RequirementModel.project_id == project_id).all()
        raw_output = _generate_nova_chat_fallback(user_message, requirements)

    message_text = raw_output.get("message") or "I have reviewed your strategic prompt."
    related_proposal_id = None

    # Determine if proposal should be created
    should_propose = _should_create_proposal(user_message, raw_output, "nova")

    if should_propose and raw_output.get("target_sections"):
        summary = raw_output.get("proposal_summary") or f"NOVA Requirements: {user_message[:40]}"
        # Ensure affected requirements only contain valid requirement keys
        candidate_reqs = raw_output.get("affected_requirements") or []
        filtered_reqs = [r for r in candidate_reqs if r in valid_req_keys]
        if not filtered_reqs:
            filtered_reqs = [valid_req_keys[0]] if valid_req_keys else ["REQ_AUDIENCE"]

        candidate_secs = raw_output.get("target_sections") or []
        filtered_secs = [s for s in candidate_secs if s in section_keys]
        if not filtered_secs:
            filtered_secs = ["product_brief"]

        try:
            prop = stamp_and_persist_proposal(
                db=db,
                project_id=project_id,
                run_id=run.id,
                raw_output={
                    "summary": summary,
                    "reasoning": f"Formulated in workspace chat discussion with {user_id.capitalize()}: '{user_message}'",
                    "affected_requirements": filtered_reqs,
                    "target_sections": filtered_secs,
                    "changes": {
                        "operations": [
                            {
                                "op": "update_product_brief",
                                "section": filtered_secs[0],
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
                prd_data=raw_output.get("prd_data") if isinstance(raw_output, dict) else None,
            )
            related_proposal_id = prop.id
            message_text += f"\n\n**Actionable Proposal Created:** I've submitted a formal requirements proposal for review. Link: `#{prop.id[-6:]}`."
            run.status = "waiting_for_review"
            run.lifecycle_state = "completed"
            run.completed_at = utcnow_str()
            db.commit()
        except Exception as err:
            logger.warning(f"Could not create proposal from NOVA chat: {err}")
            run.status = "completed"
            run.lifecycle_state = "completed"
            run.completed_at = utcnow_str()
            db.commit()
    else:
        # Conversational answer completed
        run.status = "completed"
        run.lifecycle_state = "completed"
        run.completed_at = utcnow_str()
        db.commit()

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
            "run_id": run.id,
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
    """Executes PIXEL implementation assistant, maintaining multi-turn context and run lifecycle."""
    user_prompt, valid_req_keys, section_keys = _build_multi_turn_context(
        db=db,
        project_id=project_id,
        conversation_id=conversation_id,
        user_id=user_id,
        user_message=user_message,
        agent_id="pixel",
    )

    # 1. Initialize and persist Agent Run
    run_id = f"run_pixel_chat_{uuid.uuid4().hex[:6]}"
    task_desc = f"PIXEL Chat Implementation: {user_message[:50]}"
    run = create_and_persist_agent_run(
        db=db,
        project_id=project_id,
        agent_id="pixel",
        run_id=run_id,
        task_id=f"chat_{conversation_id}",
        task_description=task_desc,
        target_sections=section_keys[:2],
        affected_requirements=valid_req_keys[:2],
    )

    raw_output = None
    source = "live_llm"
    is_simulated = False
    try:
        res = await call_llm_json(
            system_prompt=PIXEL_CHAT_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            timeout=25.0,
            model=get_effective_model("pixel"),
            agent_id="pixel",
            tools=get_agent_tools("pixel"),
        )
        raw_output, source, is_simulated = res
    except Exception as e:
        logger.info(f"PIXEL Chat using deterministic intelligence fallback: {e}")
        source = "cached_fallback"
        is_simulated = True
        sections = db.query(ArtifactSectionModel).filter(ArtifactSectionModel.project_id == project_id).all()
        raw_output = _generate_pixel_chat_fallback(user_message, sections)

    message_text = raw_output.get("message") or "I have analyzed the LedgerFlow prototype architecture."
    related_proposal_id = None

    should_propose = _should_create_proposal(user_message, raw_output, "pixel")

    if should_propose and raw_output.get("operations"):
        summary = raw_output.get("proposal_summary") or f"PIXEL Implementation: {user_message[:40]}"
        target_secs = raw_output.get("target_sections") or [raw_output["operations"][0].get("section", "hero")]
        filtered_secs = [s for s in target_secs if s in section_keys] or ["hero"]

        try:
            prop = stamp_and_persist_proposal(
                db=db,
                project_id=project_id,
                run_id=run.id,
                raw_output={
                    "summary": summary,
                    "reasoning": f"Implementation requested via Workspace Chat by {user_id.capitalize()}: '{user_message}'",
                    "affected_requirements": [],
                    "target_sections": filtered_secs,
                    "changes": {"operations": raw_output["operations"]},
                },
                source=source,
                is_simulated=is_simulated,
                created_by="pixel",
                author_type="agent",
                proposal_type="prototype_modification",
                implementation_data=raw_output.get("implementation_data") if isinstance(raw_output, dict) else None,
            )
            related_proposal_id = prop.id
            message_text += f"\n\n**Implementation Proposal Submitted:** I've prepared the component modifications and submitted proposal `#{prop.id[-6:]}` for review. It requires human sign-off before applying to the canvas."
            run.status = "waiting_for_review"
            run.lifecycle_state = "completed"
            run.completed_at = utcnow_str()
            db.commit()
        except Exception as err:
            logger.warning(f"Could not create proposal from PIXEL chat: {err}")
            run.status = "completed"
            run.lifecycle_state = "completed"
            run.completed_at = utcnow_str()
            db.commit()
    else:
        run.status = "completed"
        run.lifecycle_state = "completed"
        run.completed_at = utcnow_str()
        db.commit()

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
            "run_id": run.id,
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


def _classify_team_intent(message: str) -> str:
    """Deterministic intent classifier for team messages. No LLM required.

    Returns:
        'product_led'        - NOVA leads, PIXEL listens
        'implementation_led' - PIXEL leads, NOVA tracks
        'both_parallel'      - milestone/planning -> both respond
        'greeting_or_general'- greeting or unknown -> both respond
    """
    m = message.lower()

    product_kws = {
        "ui", "ux", "design", "better", "improve", "redesign",
        "user experience", "usability", "workflow", "product", "feature",
        "suggest", "idea", "strategy", "requirement", "prd",
        "audience", "market",
    }
    impl_kws = {
        "code", "implement", "build", "component", "button",
        "frontend", "fix the bug", "change the color", "update the text",
        "add a field",
    }
    both_kws = {
        "milestone", "deadline", "sprint", "status", "progress",
        "roadmap", "plan", "update",
    }
    greeting_kws = {
        "hi", "hey", "hello", "good morning", "good afternoon",
        "what do you", "how are",
    }

    has_product = any(kw in m for kw in product_kws)
    has_impl = any(kw in m for kw in impl_kws)
    has_both = any(kw in m for kw in both_kws)
    has_greeting = any(kw in m for kw in greeting_kws)

    if has_product and not has_impl:
        return "product_led"
    elif has_impl and not has_product:
        return "implementation_led"
    elif has_product and has_impl:
        return "product_led"
    elif has_both:
        return "both_parallel"
    elif has_greeting:
        return "greeting_or_general"
    else:
        return "greeting_or_general"


async def _handle_pixel_listening_mode(
    db: Session,
    project_id: str,
    conversation_id: str,
    user_id: str,
    user_message: str,
) -> Optional[ChatMessageModel]:
    """PIXEL's response when NOVA is leading on a product/UX topic."""
    now_str = utcnow_str()
    listen_text = (
        "### Engineering Readiness · PIXEL\n\n"
        "I've received the product improvement request and I'm waiting for "
        "**NOVA's requirements analysis** before preparing implementation details.\n\n"
        "**My current stance:**\n"
        "- I've reviewed the existing LedgerFlow prototype sections (hero, dashboard, product_brief, approval_queue)\n"
        "- I'm ready to map NOVA's product guidance onto concrete component changes\n"
        "- I will prepare a scoped implementation proposal once requirements are confirmed\n\n"
        "**What I'll do when NOVA completes the PRD:**\n"
        "1. Map confirmed functional requirements to specific React components\n"
        "2. Prepare before/after component diffs\n"
        "3. Submit a structured implementation proposal for Alex's review\n\n"
        "Waiting for NOVA's product direction before acting."
    )

    agent_msg = ChatMessageModel(
        id=f"msg_pixel_{uuid.uuid4().hex[:8]}",
        conversation_id=conversation_id,
        sender_id="pixel",
        sender_type="agent",
        recipient_id=user_id,
        recipient_type="human",
        message_content=listen_text,
        message_type="agent_message",
        status="delivered",
        msg_metadata={
            "agent_role": "AI Software Engineer",
            "source": "orchestration",
            "is_simulated": False,
            "orchestration_mode": "listening",
            "waiting_for": "nova_requirements",
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


async def _handle_nova_requirements_tracking(
    db: Session,
    project_id: str,
    conversation_id: str,
    user_id: str,
    user_message: str,
) -> Optional[ChatMessageModel]:
    """NOVA's brief response when PIXEL is leading on an implementation task."""
    now_str = utcnow_str()
    track_text = (
        "### Requirements Alignment · NOVA\n\n"
        "I'm tracking this implementation request against our confirmed product requirements.\n\n"
        "**Requirements Check:**\n"
        "- This change should align with our current audience targeting (small business → enterprise)\n"
        "- Any UI modifications must maintain WCAG AA contrast compliance\n"
        "- Component changes touching approval flows require Alex's sign-off per our governance policy\n\n"
        "**My Advisory Role:**\n"
        "Once PIXEL submits the implementation proposal, I will conduct a requirements-alignment review "
        "and flag any divergence from the confirmed PRD before Alex makes the approval decision.\n\n"
        "Let me know if you'd like me to generate a formal requirement first."
    )

    agent_msg = ChatMessageModel(
        id=f"msg_nova_{uuid.uuid4().hex[:8]}",
        conversation_id=conversation_id,
        sender_id="nova",
        sender_type="agent",
        recipient_id=user_id,
        recipient_type="human",
        message_content=track_text,
        message_type="agent_message",
        status="delivered",
        msg_metadata={
            "agent_role": "AI Product Strategist",
            "source": "orchestration",
            "is_simulated": False,
            "orchestration_mode": "requirements_tracking",
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
    """Role-aware team orchestration.
    NOVA owns product strategy. PIXEL owns engineering.
    For product/UX messages: NOVA leads, PIXEL acknowledges readiness.
    For implementation messages: PIXEL leads, NOVA tracks requirements.
    For general team messages: both respond in parallel.
    """
    intent = _classify_team_intent(user_message)
    responses: List[ChatMessageModel] = []

    if intent == "product_led":
        nova_resp = await handle_nova_chat(db, project_id, conversation_id, user_id, user_message)
        if nova_resp:
            responses.append(nova_resp)
        pixel_ack = await _handle_pixel_listening_mode(db, project_id, conversation_id, user_id, user_message)
        if pixel_ack:
            responses.append(pixel_ack)
    elif intent == "implementation_led":
        pixel_resp = await handle_pixel_chat(db, project_id, conversation_id, user_id, user_message)
        if pixel_resp:
            responses.append(pixel_resp)
        nova_track = await _handle_nova_requirements_tracking(db, project_id, conversation_id, user_id, user_message)
        if nova_track:
            responses.append(nova_track)
    else:
        nova_resp = await handle_nova_chat(db, project_id, conversation_id, user_id, user_message)
        if nova_resp:
            responses.append(nova_resp)
        pixel_resp = await handle_pixel_chat(db, project_id, conversation_id, user_id, user_message)
        if pixel_resp:
            responses.append(pixel_resp)

    return responses


def create_system_chat_notification(
    db: Session,
    project_id: str,
    notification_text: Optional[str] = None,
    related_proposal_id: Optional[str] = None,
    related_task_id: Optional[str] = None,
    conversation_id: Optional[str] = None,
    content: Optional[str] = None,
) -> Optional[ChatMessageModel]:
    """Appends an event-native system notification to the team conversation."""
    actual_text = notification_text or content or ""
    conversation = None
    if conversation_id:
        conversation = db.query(ConversationModel).filter(
            ConversationModel.id == conversation_id,
            ConversationModel.project_id == project_id,
        ).first()

    if not conversation:
        conversation = db.query(ConversationModel).filter(
            ConversationModel.project_id == project_id,
            ConversationModel.conversation_type == "team_shared",
        ).first()

    if not conversation:
        conversation = ConversationModel(
            id=conversation_id or "conv_team_ledgerflow",
            project_id=project_id,
            title="LedgerFlow · Shared Team Conversation",
            conversation_type="team_shared",
            created_by="system",
        )
        db.add(conversation)
        db.commit()

    msg = ChatMessageModel(
        id=f"msg_sys_{uuid.uuid4().hex[:8]}",
        conversation_id=conversation.id,
        sender_id="system",
        sender_type="system",
        recipient_id="team",
        recipient_type="team",
        message_content=actual_text,
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
    sender_role = (
        "AI Product Strategist" if m.sender_id == "nova"
        else "AI Software Engineer" if m.sender_id == "pixel"
        else "Founder / Decision Owner" if m.sender_id == "alex"
        else "Product Designer" if m.sender_id == "maya"
        else "System Event"
    )

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

    # Specific policy question handler (e.g. international travel expense approval)
    if "travel" in m_lower or "policy" in m_lower or "international" in m_lower or "expense approval" in m_lower:
        return {
            "message": """### Strategic Policy Architecture · International Travel & Spend Governance

To structure LedgerFlow's international travel expense policy effectively while ensuring compliance and friction-free employee experience, I recommend a three-tiered framework:

1. **Pre-Trip Authorization**:
   - Automated travel request routing for international trips exceeding $1,000.
   - Built-in per-diem rate validation based on GSA/destination benchmarks.
2. **Multi-Currency & VAT Compliance**:
   - Real-time foreign exchange rate freezing at time of swipe.
   - Automatic VAT/GST receipt separation for corporate tax reclamation.
3. **Escalation & Approvals**:
   - Standard business expenses under $500: auto-approved by direct manager.
   - High-variance expenses (>$1,500) or out-of-policy flights: automatically escalate to executive review (Alex).

*Would you like me to formalize this into a PRD requirements proposal for Alex's review? If so, reply: `Create proposal for international travel policy`.*""",
            "proposal_intent": False,
        }
    elif "idea" in m_lower or "define" in m_lower:
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

*If you would like me to submit this as a formal PRD proposal, reply `Create proposal`.*""",
            "proposal_intent": False,
        }
    elif any(w in m_lower for w in ["ui", "ux", "better", "improve", "redesign", "user experience", "design", "usability"]):
        return {
            "message": """### UX & Product Improvement Analysis · NOVA

I've reviewed the LedgerFlow product for improvement opportunities. Here's my analysis:

**Current Product State:**
- The hero section communicates our core value proposition
- The dashboard surfaces key spend metrics
- The approval queue implements our governance policy
- The product brief anchors our market positioning

**Top UX Improvement Opportunities:**
1. **Hero Messaging**: Sharpen the headline to resonate with our target segment (finance directors at 50-500 person companies)
2. **Approval Workflow Clarity**: The escalation path ($500 threshold → Alex) needs a clearer visual indicator
3. **Dashboard Hierarchy**: Monthly spend should be the dominant metric with secondary breakdowns visible on interaction
4. **Empty State Handling**: No expense submissions should show a clear action prompt rather than an empty table

**My Recommendation:**
We should formalize a UX Improvement Brief. Once confirmed, PIXEL can map these to specific component changes.

*If you want me to submit this as a formal PRD proposal, reply `Create proposal for UX improvements`.*""",
            "proposal_intent": False,
        }
    else:
        return {
            "message": f"""### Product Guidance · NOVA

I've reviewed your request: *"{message}"*.

From a product strategy perspective:
- We should ensure alignment with our current **small business to enterprise** roadmap.
- Any change that modifies high-level approval limits requires **Alex's approval** to prevent unauthorized context drift.

Ready to assist you with PRD documentation or requirements synthesis. If you'd like a formal proposal, reply `Create proposal`.""",
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
    elif "hero" in m_lower or "header" in m_lower:
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
