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
1. ONLY ask clarifying questions (and set "proposal_intent": false) when a message contains an unexplained bare acronym with NO surrounding context (e.g. standalone "SAI" with zero description). Any message describing an improvement, feature, problem, or capability is sufficient to produce a PRD immediately.
2. For ANY product idea, feature request, UX improvement, workflow change, or capability request — even short ones like "make the UI better", "add multi-currency support", or "improve the dashboard" — IMMEDIATELY formulate a comprehensive PRD and set "proposal_intent": true. Do NOT ask for more clarification. Make reasonable assumptions and document them in constraints_and_assumptions.
3. For pure exploratory questions (e.g. "how should we structure...", "what do you think about...") where no product change is requested, provide strategic guidance and set "proposal_intent": false.
4. When "proposal_intent": true, you MUST include a complete PRD object in "prd_data" with ALL required fields.
5. The "message" field must summarize the PRD you just created. Do NOT suggest the user type a follow-up command. Create the PRD immediately and confirm it has been submitted for approval.

DECISION RULE (follow exactly):
- Unexplained bare acronym with zero context → "proposal_intent": false, ask for clarification
- ANY product/feature/UX/improvement/workflow request (however brief) → "proposal_intent": true, create PRD now

Respond with valid JSON:
{
  "message": "Professional GitHub-flavored Markdown summary confirming PRD creation and outlining key sections.",
  "proposal_intent": true,
  "proposal_summary": "Short descriptive title (never null when proposal_intent is true)",
  "affected_requirements": ["REQ_AUDIENCE", "REQ_METRICS", "REQ_BRAND", or "REQ_ROLES"],
  "target_sections": ["product_brief", "dashboard", "approval_queue", or "hero"],
  "prd_data": {
    "title": "...",
    "objective": "...",
    "executive_summary": "...",
    "problem_statement": "...",
    "target_audience": "...",
    "proposed_solution": "...",
    "functional_requirements": ["..."],
    "non_functional_requirements": ["..."],
    "user_stories": ["As a [role], I want [feature] so that [benefit]"],
    "acceptance_criteria": ["..."],
    "constraints_and_assumptions": "...",
    "dependencies_and_risks": "...",
    "open_questions": "..."
  }
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


def _detect_ambiguity(message: str) -> bool:
    """Detects whether a product prompt contains ambiguous acronyms or underspecified requests."""
    m_lower = message.lower().strip()
    words = [w.strip(".,!?:;\"'()") for w in m_lower.split()]

    ambiguous_acronyms = ["sai", "erp", "sso", "ai", "ml", "nlp"]
    has_ambiguous_acronym = any(acronym in words for acronym in ambiguous_acronyms)

    known_expansions = [
        "smart automated invoicing",
        "spend anomaly intelligence",
        "strategic account integration",
        "single sign on",
        "enterprise resource planning",
    ]
    if any(exp in m_lower for exp in known_expansions):
        return False

    if has_ambiguous_acronym:
        return True

    ui_or_feature_words = [
        "ui", "ux", "design", "better", "improve", "redesign", "feature", "travel",
        "currency", "expense", "policy", "receipt", "approval", "workflow", "matrix",
        "dashboard", "table", "button", "card", "view", "component", "export",
    ]
    if any(w in m_lower for w in ui_or_feature_words):
        return False

    if len(words) <= 5 and not any(t in m_lower for t in ["create proposal", "create prd", "generate prd", "submit prd"]):
        return True

    return False


def _should_create_proposal(user_message: str, raw_output: dict, agent_id: str) -> bool:
    m_lower = user_message.lower().strip()

    if raw_output.get("force_proposal") is True:
        return True

    if agent_id == "nova":
        if _detect_ambiguity(user_message):
            return False
        if bool(raw_output.get("proposal_intent")) or bool(raw_output.get("prd_data")):
            return True
        product_triggers = [
            "ui", "ux", "design", "better", "improve", "redesign", "feature", "add", "make",
            "build", "create", "update", "change", "fix", "enhance", "integrate", "workflow",
            "approval", "expense", "currency", "invoice", "policy", "receipt", "travel",
            "report", "analytics", "ocr", "notification", "alert", "export", "import",
            "chart", "table", "filter", "search", "permission", "audit", "compliance",
            "budget", "spending", "vendor", "category", "create proposal", "create prd",
            "generate prd", "submit prd", "generate proposal",
        ]
        if any(t in m_lower for t in product_triggers):
            return True
        return bool(raw_output.get("target_sections"))

    return bool(raw_output.get("proposal_intent")) and bool(
        raw_output.get("target_sections") or raw_output.get("operations")
    )


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

    if should_propose:
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
                run_id=run_id,
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
            message_text += f"\n\n**Actionable Proposal Created:** I've submitted a formal requirements proposal for review: [View PRD Proposal #{prop.id[-6:]}](/proposals). Requirements are awaiting Alex's confirmation before PIXEL begins implementation."
            run.status = "waiting_for_review"
            run.lifecycle_state = "completed"
            run.completed_at = utcnow_str()
            db.commit()

            try:
                from backend.app.services.workflow_service import update_workflow_stage
                await update_workflow_stage(
                    db=db,
                    project_id=project_id,
                    stage="prd_awaiting_confirmation",
                    active_prd_id=prop.id,
                    last_action_by="nova",
                )
            except Exception as e:
                logger.warning(f"Could not update workflow stage for NOVA PRD: {e}")
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

        try:
            from backend.app.services.workflow_service import update_workflow_stage
            is_clarification = any(w in message_text.lower() for w in ["clarif", "could you", "which of these", "what does", "sai"])
            stage = "product_clarification" if is_clarification else "product_discovery"
            await update_workflow_stage(
                db=db,
                project_id=project_id,
                stage=stage,
                last_action_by="nova",
            )
        except Exception as e:
            logger.warning(f"Could not update workflow stage for NOVA conversational turn: {e}")

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
                run_id=run_id,
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
    """Sequential, stage-aware team orchestration.
    Entire Team is a shared collaboration channel with deterministic, role-aware routing.
    It does NOT broadcast messages to execute both agents in parallel or inject fake listening messages.
    """
    from backend.app.services.workflow_service import get_or_sync_workflow_stage
    stage_data = get_or_sync_workflow_stage(db, project_id)
    current_stage = stage_data.get("current_stage", "product_discovery")

    responses: List[ChatMessageModel] = []

    # 1. Product idea / discovery / clarification / PRD stages: NOVA leads alone.
    # PIXEL does NOT execute and does NOT post fake messages. PIXEL status is "Waiting for confirmed requirements".
    if current_stage in ("product_discovery", "product_clarification", "prd_generation", "prd_awaiting_confirmation"):
        nova_resp = await handle_nova_chat(db, project_id, conversation_id, user_id, user_message)
        if nova_resp:
            responses.append(nova_resp)
        return responses

    # 2. Implementation in progress stage: PIXEL executes if technical, otherwise NOVA guides
    if current_stage == "implementation_in_progress":
        intent = _classify_team_intent(user_message)
        if intent == "implementation_led" or any(k in user_message.lower() for k in ["code", "pixel", "component", "build", "frontend", "bug", "style"]):
            pixel_resp = await handle_pixel_chat(db, project_id, conversation_id, user_id, user_message)
            if pixel_resp:
                responses.append(pixel_resp)
        else:
            nova_resp = await handle_nova_chat(db, project_id, conversation_id, user_id, user_message)
            if nova_resp:
                responses.append(nova_resp)
        return responses

    # 3. Implementation awaiting human approval stage:
    if current_stage == "implementation_awaiting_approval":
        intent = _classify_team_intent(user_message)
        if intent == "implementation_led":
            pixel_resp = await handle_pixel_chat(db, project_id, conversation_id, user_id, user_message)
            if pixel_resp:
                responses.append(pixel_resp)
        else:
            nova_resp = await handle_nova_chat(db, project_id, conversation_id, user_id, user_message)
            if nova_resp:
                responses.append(nova_resp)
        return responses

    # 4. Default / implementation_applied stage:
    # A new cycle begins: product ideas route to NOVA
    intent = _classify_team_intent(user_message)
    if intent == "implementation_led":
        pixel_resp = await handle_pixel_chat(db, project_id, conversation_id, user_id, user_message)
        if pixel_resp:
            responses.append(pixel_resp)
    else:
        nova_resp = await handle_nova_chat(db, project_id, conversation_id, user_id, user_message)
        if nova_resp:
            responses.append(nova_resp)

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
            "proposal_type": proposal.proposal_type,
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

    # Ambiguity check for acronyms like "SAI"
    if "sai" in m_lower and not any(kw in m_lower for kw in ["smart automated invoicing", "spend anomaly", "stands for", "create proposal", "create prd", "generate prd"]):
        return {
            "message": """### Product Discovery & Clarification · NOVA

I noticed your idea mentions **"SAI"** for LedgerFlow. Because "SAI" can refer to multiple distinct capabilities in financial systems, let's clarify your target scope first:

1. **Smart Automated Invoicing (SAI)**: AI-powered extraction of line items, vendor tax IDs, and GL codes from incoming supplier bills.
2. **Spend Anomaly Intelligence (SAI)**: Machine learning heuristics that flag unusual department spend velocity or duplicate expense submissions.
3. **Strategic Account Integration (SAI)**: Deep bidirectional ERP sync with enterprise ledgers like NetSuite, SAP, or QuickBooks.

**Key Clarifying Questions:**
- Which of these directions matches your vision?
- Who is the primary target audience (e.g. finance controllers vs employee submitters)?
- What is the primary success metric for this capability?

*Once you clarify the core objective, I will formulate a formal 11-section PRD proposal for Alex's review. PIXEL will remain waiting for confirmed requirements.*""",
            "proposal_intent": False,
        }

    # Clarified PRD request for Smart Automated Invoicing (SAI)
    if "smart automated invoicing" in m_lower or ("sai" in m_lower and any(kw in m_lower for kw in ["stands for", "invoice", "invoicing", "create prd", "create proposal", "generate prd"])):
        return {
            "message": """### Formal Product Requirements Document · Smart Automated Invoicing (SAI)

I have formulated a comprehensive 11-section PRD for **Smart Automated Invoicing (SAI)** in LedgerFlow.

**Key Strategic Specifications:**
- **Objective:** Eliminate manual invoice data entry by extracting line items, currency amounts, and GL codes automatically.
- **Target Audience:** Accounts Payable Specialists and Financial Controllers managing 100+ supplier invoices monthly.
- **Core Capabilities:** Optical character recognition (OCR), automated duplicate invoice detection, and tiered manager approval routing.
- **Acceptance Criteria:** 99.2% line item extraction accuracy on standard PDFs; sub-2-second sync with LedgerFlow's approval queue.

I have submitted this PRD proposal for human review. **PIXEL is waiting for Alex's confirmation** before starting implementation.""",
            "proposal_intent": True,
            "force_proposal": True,
            "proposal_summary": "PRD: Smart Automated Invoicing (SAI) Engine",
            "target_sections": ["approval_queue", "dashboard", "product_brief"],
            "affected_requirements": ["REQ_AUDIENCE", "REQ_ROLES"],
            "prd_data": {
                "title": "Smart Automated Invoicing (SAI) Engine",
                "objective": "Automate supplier bill ingestion, OCR line-item extraction, and approval routing.",
                "executive_summary": {
                    "what_proposed": "Deploy an AI-powered Smart Automated Invoicing engine within LedgerFlow.",
                    "problem_addressed": "Finance teams spend 15+ hours weekly manually transcribing invoice PDFs into spreadsheets.",
                    "target_outcomes": "Reduce bill processing time by 85% and prevent duplicate vendor payouts."
                },
                "problem_statement": "Manual invoice processing introduces human transcription errors, payment delays, and lack of visibility into unapproved liabilities.",
                "target_audience": "Accounts Payable teams, Finance Directors, and Enterprise Controllers",
                "proposed_solution": "Direct PDF upload interface with optical extraction, GL code suggestion, and escalation to Alex for invoices exceeding $500.",
                "functional_requirements": [
                    {"id": "FR-SAI-1", "title": "Automated PDF Line Item Ingestion", "description": "Extract invoice number, vendor name, invoice date, line items, and tax breakdown.", "priority": "High"},
                    {"id": "FR-SAI-2", "title": "Tiered Governance Escalation", "description": "Invoices exceeding $500 ceiling require Alex sign-off before GL posting.", "priority": "High"},
                    {"id": "FR-SAI-3", "title": "Real-Time Liability KPI", "description": "Update Pending Approvals KPI in Dashboard immediately upon invoice ingest.", "priority": "Medium"}
                ],
                "non_functional_requirements": [
                    {"id": "NFR-1", "category": "Performance", "requirement": "OCR parsing completes in under 2.5 seconds per document."},
                    {"id": "NFR-2", "category": "Compliance", "requirement": "Maintain immutable audit log of all extraction changes."}
                ],
                "user_stories": [
                    {"role": "Accounts Payable Specialist", "action": "upload a vendor invoice PDF", "benefit": "I do not have to manually retype line items into LedgerFlow.", "text": "As an AP Specialist, I want to upload an invoice PDF so that line items are populated automatically."},
                    {"role": "Finance Director", "action": "enforce approval tiers on automated invoices", "benefit": "unauthorized large liabilities are blocked.", "text": "As a Finance Director, I want high-value invoices escalated to Alex so that capital is protected."}
                ],
                "acceptance_criteria": [
                    {"id": "AC-SAI-1", "req_id": "FR-SAI-1", "criterion": "Line items match vendor total with zero variance.", "measurable": True},
                    {"id": "AC-SAI-2", "req_id": "FR-SAI-2", "criterion": "Invoices > $500 route to Alex with flagged warning badge.", "measurable": True}
                ],
                "constraints_and_assumptions": [
                    "Assumes supported formats include PDF, PNG, and JPEG up to 15MB.",
                    "Assumes standard currency formatting adhering to LedgerFlow multi-currency standards."
                ],
                "dependencies_and_risks": [
                    "Dependency on LedgerFlow approval queue state machine.",
                    "Risk: Low-resolution scans may require manual fallback editing."
                ],
                "open_questions": [
                    "Should international vendor invoices auto-convert to USD or display native currency?"
                ]
            }
        }

    # Specific policy question handler (e.g. international travel expense approval)
    proposal_kws = ["create proposal", "create a proposal", "create prd", "generate prd", "generate proposal", "submit proposal", "formalize"]
    if ("travel" in m_lower or "policy" in m_lower or "international" in m_lower or "expense approval" in m_lower) and not any(kw in m_lower for kw in proposal_kws):
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
    elif ("idea" in m_lower or "define" in m_lower) and not any(kw in m_lower for kw in proposal_kws):
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
    elif any(w in m_lower for w in ["ui", "ux", "better", "improve", "redesign", "user experience", "design", "usability"]) and not any(kw in m_lower for kw in proposal_kws):
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
        # Dynamically formulate a formal 11-section PRD for any product improvement / feature / policy request
        import re
        clean = message.strip()
        clean = re.sub(r'^(team|nova|alex|hey|hi)[\s,:]+', '', clean, flags=re.IGNORECASE).strip()
        clean = re.sub(r'^(create proposal for|create a proposal for|create prd for|generate prd for|generate proposal for|create proposal|create prd|how should we handle|how do we handle|how should we structure|can we add|let us add|let\'s add|we need to add|we need|i want to integrate|i want to add|i want to introduce|please add|please build)\s+', '', clean, flags=re.IGNORECASE).strip(' ?.')
        title_words = [w.capitalize() for w in clean.split()]
        feature_name = ' '.join(title_words) or 'Product Feature'
        if len(feature_name) > 60:
            feature_name = feature_name[:57] + '...'

        prd_title = f"{feature_name} Specification"
        summary = f"PRD: {feature_name}"

        return {
            "message": f"""### Formal Product Requirements Document · {feature_name}

I have analyzed your product request: *"{message}"*.

I have formulated a comprehensive 11-section PRD for **{feature_name}** in LedgerFlow and created a formal proposal awaiting human confirmation.

**Key Strategic Specifications:**
- **Objective:** Integrate {feature_name.lower()} to enhance financial workflow efficiency and eliminate manual operational bottlenecks.
- **Target Audience:** Finance Controllers, Operational Managers, and Accounts Payable Specialists.
- **Core Capabilities:** Automated ingestion, intelligent validation, and tiered policy escalation.
- **Acceptance Criteria:** Seamless integration into LedgerFlow approval queue with sub-2-second sync and automated executive escalation for amounts > $500.

I have submitted this PRD proposal for review. **PIXEL is waiting for your confirmation in the Proposals tab** before technical implementation begins.""",
            "proposal_intent": True,
            "force_proposal": True,
            "proposal_summary": summary,
            "target_sections": ["approval_queue", "dashboard", "product_brief"],
            "affected_requirements": ["REQ_AUDIENCE", "REQ_ROLES"],
            "prd_data": {
                "title": prd_title,
                "objective": f"Formulate, validate, and integrate {feature_name.lower()} into LedgerFlow.",
                "executive_summary": {
                    "what_proposed": f"Deploy a production-grade {feature_name.lower()} engine within LedgerFlow.",
                    "problem_addressed": f"Lack of automated {feature_name.lower()} leads to operational friction, compliance risks, and delayed approvals.",
                    "target_outcomes": "Reduce manual processing overhead by 80% and enforce real-time governance."
                },
                "problem_statement": f"Teams currently face manual processing bottlenecks and policy ambiguities around {feature_name.lower()}.",
                "target_audience": "Finance Directors, Department Managers, and Expense Submitters",
                "proposed_solution": f"Automated LedgerFlow integration for {feature_name.lower()} with tiered policy thresholds and executive approval escalation.",
                "functional_requirements": [
                    {"id": "FR-1", "title": f"Automated {feature_name} Processing", "description": f"Intelligently process and validate {feature_name.lower()} data entries.", "priority": "High"},
                    {"id": "FR-2", "title": "Tiered Governance Escalation", "description": "High-value or out-of-policy items route directly to Alex for final approval.", "priority": "High"},
                    {"id": "FR-3", "title": "Real-Time Metric Synchronization", "description": "Reflect transaction state instantly in LedgerFlow dashboard metrics.", "priority": "Medium"}
                ],
                "non_functional_requirements": [
                    {"id": "NFR-1", "category": "Performance", "requirement": "Processing and verification executes under 2 seconds per item."},
                    {"id": "NFR-2", "category": "Security & Compliance", "requirement": "Cryptographically auditable and compliant with corporate spend governance standards."}
                ],
                "user_stories": [
                    {"role": "Operational Manager", "action": f"utilize {feature_name.lower()}", "benefit": "my team saves hours of manual entry each cycle.", "text": f"As a Manager, I want {feature_name.lower()} so that expense cycles move faster."},
                    {"role": "Finance Director", "action": "enforce approval policies", "benefit": "all high-value expenditures are validated before disbursement.", "text": "As a Finance Director, I want high-value items escalated to Alex so that capital is protected."}
                ],
                "acceptance_criteria": [
                    {"id": "AC-1", "req_id": "FR-1", "criterion": f"{feature_name} processes valid inputs with zero schema error.", "measurable": True},
                    {"id": "AC-2", "req_id": "FR-2", "criterion": "Transactions exceeding $500 ceiling route to Alex with flagged review badge.", "measurable": True}
                ],
                "constraints_and_assumptions": [
                    "Assumes modern browser compatibility and secure REST/WebSocket connectivity.",
                    "Assumes multi-currency support adhering to LedgerFlow ISO currency standards."
                ],
                "dependencies_and_risks": [
                    "Dependency on LedgerFlow approval queue state machine.",
                    "Risk: Non-standard formats may require fallback manual verification."
                ],
                "open_questions": [
                    f"Are there department-specific exemption policies for {feature_name.lower()}?"
                ]
            }
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
