import logging
import uuid
import json
import datetime
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session

from backend.app.db.models import (
    ProjectModel,
    ProposalModel,
    DelegationModel,
    ImplementationPlanModel,
    AgentRunModel,
    RequirementModel,
    ArtifactSectionModel,
    ChatMessageModel,
    DecisionModel,
    EventModel,
)
from backend.app.context.pack_builder import (
    create_and_persist_agent_run,
    build_context_pack,
)
from backend.app.proposals.stamping import stamp_and_persist_proposal
from backend.app.proposals.serialization import serialize_proposal_for_api
from backend.app.proposals.output_transformers import build_pixel_implementation_data
from backend.app.agents.review import validate_agent_proposal_output
from backend.app.agents.provider import (
    call_llm_json,
    get_effective_model,
)
from backend.app.agents.tools import get_agent_tools
from backend.app.websocket.manager import ws_manager
from backend.app.events.logger import log_event

logger = logging.getLogger(__name__)

def utcnow_str() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


PIXEL_PRD_EXECUTION_PROMPT = """You are PIXEL, the Principal AI Software Engineer at COFRAME.
Your role is to translate confirmed Product Requirements Documents (PRDs) into concrete prototype changes.

CRITICAL INSTRUCTIONS:
1. Requirements are authoritative and have been confirmed by human leadership ({confirmed_by}).
2. Inspect the confirmed PRD:
   - PRD Title: {prd_title}
   - Objective: {prd_objective}
   - Functional Requirements: {functional_requirements}
   - Acceptance Criteria: {acceptance_criteria}
3. Generate structured UI implementation changes that fulfill these requirements.
4. Target sections MUST be from: ["approval_queue", "dashboard", "hero", "product_brief"].
5. Allowed operations:
   - "set_approval_queue_config" (for approval_queue)
   - "set_dashboard_metrics" (for dashboard)
   - "set_hero_content" (for hero)
   - "update_product_brief" (for product_brief)

Return a single JSON object strictly matching this schema:
{{
  "summary": "Short title describing the engineering implementation",
  "reasoning": "Technical explanation of how the implementation fulfills the confirmed requirements",
  "affected_requirements": {dependencies},
  "target_sections": {target_sections},
  "changes": {{
    "operations": [
      {{
        "op": "set_approval_queue_config",
        "section": "approval_queue",
        "config": {{
          "title": "Configurable Enterprise Approval Queue",
          "policy_note": "Rule: Tiered manager sign-off per confirmed PRD",
          "threshold": "$500.00"
        }},
        "items": [
          {{
            "id": "EXP-101",
            "submitter": "Sarah Chen",
            "department": "Engineering Core",
            "amount": "$1,250.00",
            "category": "AWS Infrastructure",
            "policy_flag": "Requires Alex Approval (> $500)",
            "status": "pending"
          }}
        ]
      }}
    ]
  }}
}}
"""


def _generate_pixel_fallback_for_prd(
    prd_title: str,
    prd_objective: str,
    functional_requirements: List[Any],
    acceptance_criteria: List[Any],
    target_sections: List[str],
    dependencies: List[str],
) -> Dict[str, Any]:
    """Generates structured deterministic implementation when LLM is unavailable or fails."""
    title_lower = (prd_title + " " + prd_objective).lower()
    is_metrics = any(k in title_lower for k in ["metric", "burn", "dashboard", "kpi", "analytics"])
    is_hero = any(k in title_lower for k in ["hero", "headline", "landing", "brand", "positioning"])

    if is_metrics:
        return {
            "summary": f"Telemetry & Spend Analytics: {prd_title[:45]}",
            "reasoning": f"Implements confirmed requirements for spend metrics dashboard ({prd_objective[:100]}).",
            "affected_requirements": dependencies or ["REQ_METRICS"],
            "target_sections": ["dashboard"],
            "changes": {
                "operations": [
                    {
                        "op": "set_dashboard_metrics",
                        "section": "dashboard",
                        "metrics": [
                            {"label": "Monthly Company Burn", "value": "$142,500", "trend": "-4.2%", "status": "nominal"},
                            {"label": "Pending Approvals", "value": "18", "trend": "+3", "status": "action_required"},
                            {"label": "Approval Velocity", "value": "1.4 hrs", "trend": "3.1x faster", "status": "positive"},
                            {"label": "Policy Compliance", "value": "99.4%", "trend": "+0.8%", "status": "positive"},
                        ],
                        "categories": [
                            {"name": "Engineering & Cloud", "spent": 64200, "budget": 80000},
                            {"name": "Sales Hospitality", "spent": 28400, "budget": 35000},
                            {"name": "Marketing & Ads", "spent": 31900, "budget": 40000},
                            {"name": "Facilities & Misc", "spent": 18000, "budget": 20000},
                        ],
                    }
                ]
            },
        }
    elif is_hero:
        return {
            "summary": f"Hero Section Positioning: {prd_title[:45]}",
            "reasoning": f"Implements confirmed requirements for product positioning ({prd_objective[:100]}).",
            "affected_requirements": dependencies or ["REQ_BRAND", "REQ_AUDIENCE"],
            "target_sections": ["hero"],
            "changes": {
                "operations": [
                    {
                        "op": "set_hero_content",
                        "section": "hero",
                        "fields": {
                            "headline": "Autonomous Corporate Spend Management",
                            "subheadline": "Real-time policy enforcement and intelligent approval delegation for high-growth enterprises.",
                            "cta_text": "Explore Enterprise Workflows",
                        },
                    }
                ]
            },
        }
    else:
        # Default: Approval Queue Policy Matrix
        return {
            "summary": f"Approval Queue Implementation: {prd_title[:45]}",
            "reasoning": f"Translates confirmed PRD requirements into tiered approval queue components. {prd_objective[:120]}",
            "affected_requirements": dependencies or ["REQ_APPROVAL_POLICY", "REQ_ROLES"],
            "target_sections": ["approval_queue"],
            "changes": {
                "operations": [
                    {
                        "op": "set_approval_queue_config",
                        "section": "approval_queue",
                        "config": {
                            "title": "Enterprise Multi-Tier Approval Queue",
                            "policy_note": f"Enforcing policy per confirmed PRD: '{prd_title}'. Threshold sign-off required.",
                            "threshold": "$500.00",
                        },
                        "items": [
                            {
                                "id": "EXP-401",
                                "submitter": "Sarah Chen",
                                "department": "Core Engineering",
                                "amount": "$1,450.00",
                                "category": "Datadog Cloud Observability",
                                "policy_flag": "Requires Founder Signoff (> $500)",
                                "status": "pending",
                            },
                            {
                                "id": "EXP-402",
                                "submitter": "David Kim",
                                "department": "Platform Security",
                                "amount": "$890.00",
                                "category": "Hardware Security Modules",
                                "policy_flag": "Standard Manager Review",
                                "status": "pending",
                            },
                            {
                                "id": "EXP-403",
                                "submitter": "Marcus Vance",
                                "department": "Strategic Accounts",
                                "amount": "$6,200.00",
                                "category": "Executive Briefing Dinner",
                                "policy_flag": "Escalated: High Value (> $5,000)",
                                "status": "escalated",
                            },
                        ],
                    }
                ]
            },
        }


async def delegate_confirmed_prd_to_pixel(
    db: Session,
    project_id: str,
    prd_proposal_id: str,
    confirmed_by: str = "alex",
) -> Dict[str, Any]:
    """
    Executes the authoritative delegation from confirmed NOVA PRD to PIXEL implementation:
    1. Validates PRD proposal and decider authority.
    2. Idempotency check: if already delegated and completed, returns existing linked task and proposal.
    3. Creates DelegationModel and ImplementationPlanModel.
    4. Builds fresh PIXEL Context Pack and creates AgentRunModel in 'working' state.
    5. Dispatches task to PIXEL (live Gemini LLM or deterministic fallback on error).
    6. Stamps and persists PIXEL's implementation proposal (linked to task and originating PRD).
    7. Conducts multi-layer NOVA review (verdict: PASS/WARNING/BLOCK).
    8. Records all relationships: PRD -> Delegation -> PIXEL Run -> PIXEL Proposal -> NOVA Review.
    9. Publishes notifications to Workspace Chat and broadcasts real-time WebSockets.
    """
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise ValueError(f"Project '{project_id}' not found")

    prd_prop = (
        db.query(ProposalModel)
        .filter(ProposalModel.id == prd_proposal_id, ProposalModel.project_id == project_id)
        .first()
    )
    if not prd_prop:
        raise ValueError(f"PRD proposal '{prd_proposal_id}' not found")

    # Idempotency Check:
    existing_del = (
        db.query(DelegationModel)
        .filter(
            DelegationModel.project_id == project_id,
            DelegationModel.correlation_id == prd_proposal_id,
        )
        .first()
    )
    if existing_del and existing_del.status == "completed" and existing_del.result_proposal_id:
        existing_prop = (
            db.query(ProposalModel)
            .filter(ProposalModel.id == existing_del.result_proposal_id)
            .first()
        )
        if existing_prop:
            logger.info(
                f"[IDEMPOTENCY] PRD {prd_proposal_id} already has completed PIXEL delegation {existing_del.id} and proposal {existing_prop.id}."
            )
            return {
                "status": "already_delegated",
                "delegation_id": existing_del.id,
                "proposal_id": existing_prop.id,
                "delegation": {
                    "id": existing_del.id,
                    "task": existing_del.task,
                    "status": existing_del.status,
                    "result_proposal_id": existing_del.result_proposal_id,
                },
                "proposal": serialize_proposal_for_api(existing_prop),
            }

    # Extract PRD metadata
    prd_data = prd_prop.prd_data or {}
    prd_title = prd_data.get("title") or prd_prop.summary or "Confirmed Product Requirements"
    prd_objective = (
        prd_data.get("objective")
        or prd_data.get("executive_summary", {}).get("what_proposed")
        or prd_prop.reasoning
    )
    functional_requirements = prd_data.get("functional_requirements") or []
    acceptance_criteria = prd_data.get("acceptance_criteria") or []
    dependencies = prd_data.get("dependencies") or prd_prop.affected_requirements or ["REQ_APPROVAL_POLICY"]

    target_sections = prd_prop.target_sections or ["approval_queue"]
    from backend.app.proposals.validation import ALLOWED_SECTIONS
    target_sections = [s for s in target_sections if s in ALLOWED_SECTIONS]
    if not target_sections:
        target_sections = ["approval_queue"]

    # 1. Create or retrieve DelegationModel
    if existing_del:
        delegation = existing_del
        delegation.status = "in_progress"
        delegation.updated_at = utcnow_str()
    else:
        del_id = f"del_{uuid.uuid4().hex[:10]}"
        criteria_list = [
            ac.get("criterion", str(ac)) if isinstance(ac, dict) else str(ac)
            for ac in acceptance_criteria
        ]
        delegation = DelegationModel(
            id=del_id,
            project_id=project_id,
            source_agent="nova",
            target_agent="pixel",
            task=f"Implement confirmed PRD: {prd_title}",
            scope=f"Target sections: {', '.join(target_sections)}",
            acceptance_criteria=criteria_list,
            context_version=project.context_version,
            artifact_version=project.artifact_version,
            dependencies=dependencies,
            correlation_id=prd_proposal_id,
            status="in_progress",
            created_at=utcnow_str(),
            updated_at=utcnow_str(),
        )
        db.add(delegation)

    db.commit()
    db.refresh(delegation)

    # 2. Create ImplementationPlanModel
    plan_id = f"plan_{uuid.uuid4().hex[:10]}"
    plan_tasks = []
    if functional_requirements:
        for idx, fr in enumerate(functional_requirements[:4]):
            desc = fr.get("description", str(fr)) if isinstance(fr, dict) else str(fr)
            sec = target_sections[0] if target_sections else "approval_queue"
            plan_tasks.append({
                "id": f"TASK-{idx + 1}",
                "task": desc[:80],
                "section": sec,
                "status": "ready",
            })
    else:
        plan_tasks = [
            {"id": "TASK-1", "task": f"Structure UI components for '{prd_title}'", "section": target_sections[0], "status": "ready"},
            {"id": "TASK-2", "task": "Configure policies and interactive handlers", "section": target_sections[0], "status": "ready"},
        ]

    plan = ImplementationPlanModel(
        id=plan_id,
        project_id=project_id,
        prd_id=prd_proposal_id,
        agent_id="pixel",
        title=f"Implementation Plan: {prd_title}",
        tasks=plan_tasks,
        target_sections=target_sections,
        dependencies=dependencies,
        expected_ui_changes=[f"Render updated {s} components matching confirmed PRD" for s in target_sections],
        acceptance_criteria_mapping=[
            {"req_id": f"REQ-{i+1}", "section": target_sections[0], "verified": True}
            for i in range(len(functional_requirements[:2]) or 1)
        ],
        status="executing",
        created_at=utcnow_str(),
    )
    db.add(plan)
    db.commit()

    # 3. Create fresh PIXEL Agent Run
    run_id = f"run_pixel_impl_{uuid.uuid4().hex[:6]}"
    task_desc = f"Implement confirmed PRD: {prd_title}"
    run = create_and_persist_agent_run(
        db=db,
        project_id=project_id,
        agent_id="pixel",
        run_id=run_id,
        task_id=delegation.id,
        task_description=task_desc,
        target_sections=target_sections,
        affected_requirements=dependencies,
    )

    # Notify via chat that PIXEL has started
    try:
        from backend.app.agents.chat_service import create_system_chat_notification
        create_system_chat_notification(
            db=db,
            project_id=project_id,
            conversation_id="conv_team_ledgerflow",
            content=f"Human Decision: {confirmed_by.capitalize()} confirmed NOVA's PRD: '{prd_title}'. Handing off to PIXEL (Task #{delegation.id[-6:]}) for engineering implementation.",
            related_proposal_id=prd_proposal_id,
            related_task_id=delegation.id,
        )
    except Exception as e:
        logger.warning(f"Could not post start chat notification: {e}")

    await ws_manager.broadcast(project_id, {
        "type": "DELEGATION_CREATED",
        "delegation_id": delegation.id,
        "source_agent": "nova",
        "target_agent": "pixel",
        "task": delegation.task,
        "parent_prd_id": prd_proposal_id,
    })

    # 4. Execute PIXEL Agent
    pixel_output = None
    source = "live_llm"
    is_simulated = False
    prune_meta = None

    try:
        user_prompt = PIXEL_PRD_EXECUTION_PROMPT.format(
            confirmed_by=confirmed_by.capitalize(),
            prd_title=prd_title,
            prd_objective=prd_objective,
            functional_requirements=json.dumps(functional_requirements, indent=2),
            acceptance_criteria=json.dumps(acceptance_criteria, indent=2),
            dependencies=json.dumps(dependencies),
            target_sections=json.dumps(target_sections),
        )

        pixel_model = get_effective_model("pixel")
        pixel_tools = get_agent_tools("pixel")

        res = await call_llm_json(
            system_prompt="You are PIXEL, the Principal AI Software Engineer at COFRAME.",
            user_prompt=user_prompt,
            timeout=22.0,
            model=pixel_model,
            agent_id="pixel",
            tools=pixel_tools,
        )
        pixel_output, source, is_simulated = res
        prune_meta = getattr(res, "prune_metadata", None)
    except Exception as e:
        logger.warning(f"PIXEL LLM execution failed or timed out: {e}. Utilizing deterministic engineering engine.")
        pixel_output = _generate_pixel_fallback_for_prd(
            prd_title=prd_title,
            prd_objective=prd_objective,
            functional_requirements=functional_requirements,
            acceptance_criteria=acceptance_criteria,
            target_sections=target_sections,
            dependencies=dependencies,
        )
        source = "cached_fallback"
        is_simulated = True

    # 5. Stamp and persist PIXEL's Implementation Proposal
    try:
        impl_data = build_pixel_implementation_data(pixel_output, project_id)
        pixel_prop = stamp_and_persist_proposal(
            db=db,
            project_id=project_id,
            run_id=run.id,
            raw_output=pixel_output,
            source=source,
            is_simulated=is_simulated,
            supersedes_proposal_id=prd_proposal_id,
            prune_metadata=prune_meta,
            created_by="pixel",
            author_type="agent",
            task_id=delegation.id,
            proposal_type="prototype_modification",
            implementation_data=impl_data,
        )
    except Exception as err:
        logger.error(f"Failed to stamp PIXEL proposal: {err}")
        delegation.status = "failed"
        delegation.feedback = str(err)
        run.status = "failed"
        run.lifecycle_state = "failed"
        db.commit()
        raise err

    # 6. Conduct Multi-Layer NOVA Review on PIXEL Proposal
    review_dict = dict(pixel_output)
    review_dict["base_context_version"] = project.context_version
    review_dict["base_section_versions"] = {s: 1 for s in target_sections}
    review_dict["target_sections"] = target_sections
    review_dict["affected_requirements"] = dependencies

    review_result = validate_agent_proposal_output(
        db=db,
        project_id=project_id,
        proposal_dict=review_dict,
        source_agent="pixel",
    )

    pixel_prop.reviewed_by = "nova"
    pixel_prop.review_outcome = review_result.verdict
    pixel_prop.review_findings = [
        {"code": f.code, "severity": f.severity, "message": f.message}
        for f in review_result.findings
    ]
    # Keep status pending_review for Human Approval
    pixel_prop.status = "pending_review"
    pixel_prop.requires_decision = True
    pixel_prop.assigned_decider_id = "alex"

    # 7. Finalize Delegation and Run
    delegation.result_proposal_id = pixel_prop.id
    delegation.status = "completed"
    delegation.updated_at = utcnow_str()

    plan.proposal_id = pixel_prop.id
    plan.status = "completed"

    run.status = "waiting_for_review"
    run.lifecycle_state = "completed"
    run.current_proposal_id = pixel_prop.id
    run.completed_at = utcnow_str()

    db.commit()
    db.refresh(delegation)
    db.refresh(pixel_prop)

    # 8. Chat Notification & WebSocket Broadcasts
    try:
        from backend.app.agents.chat_service import create_system_chat_notification
        create_system_chat_notification(
            db=db,
            project_id=project_id,
            conversation_id="conv_team_ledgerflow",
            content=f"Engineering Delivery: PIXEL completed implementation task '{delegation.id[-6:]}' and submitted proposal #{pixel_prop.id[-6:]} based on confirmed PRD '{prd_title}'. NOVA reviewed (Verdict: {review_result.verdict}). Ready for Alex's review.",
            related_proposal_id=pixel_prop.id,
            related_task_id=delegation.id,
        )
    except Exception as e:
        logger.warning(f"Could not post completion chat notification: {e}")

    await ws_manager.broadcast(project_id, {
        "type": "DELEGATION_COMPLETED",
        "delegation_id": delegation.id,
        "target_agent": "pixel",
        "proposal_id": pixel_prop.id,
        "review_verdict": review_result.verdict,
    })

    await ws_manager.broadcast(project_id, {
        "type": "PROPOSAL_CREATED",
        "proposal_id": pixel_prop.id,
        "author": "PIXEL",
        "summary": pixel_prop.summary,
    })

    await ws_manager.broadcast(project_id, {
        "type": "WORKFLOW_ADVANCED",
        "stage": "human_approval",
        "prd_proposal_id": prd_proposal_id,
        "pixel_proposal_id": pixel_prop.id,
    })

    return {
        "status": "success",
        "message": f"PRD confirmed by {confirmed_by.capitalize()}. PIXEL automatically engineered implementation proposal #{pixel_prop.id[-6:]}.",
        "delegation_id": delegation.id,
        "delegation": {
            "id": delegation.id,
            "source_agent": delegation.source_agent,
            "target_agent": delegation.target_agent,
            "task": delegation.task,
            "status": delegation.status,
            "result_proposal_id": delegation.result_proposal_id,
        },
        "implementation_plan": {
            "id": plan.id,
            "title": plan.title,
            "tasks": plan.tasks,
            "target_sections": plan.target_sections,
            "expected_ui_changes": plan.expected_ui_changes,
        },
        "proposal": serialize_proposal_for_api(pixel_prop),
    }


async def retry_pixel_delegation(
    db: Session,
    project_id: str,
    delegation_id: str,
) -> Dict[str, Any]:
    """Retries a failed or incomplete delegation."""
    delegation = (
        db.query(DelegationModel)
        .filter(DelegationModel.id == delegation_id, DelegationModel.project_id == project_id)
        .first()
    )
    if not delegation:
        raise ValueError(f"Delegation '{delegation_id}' not found")

    if delegation.status == "completed" and delegation.result_proposal_id:
        existing_prop = db.query(ProposalModel).filter(ProposalModel.id == delegation.result_proposal_id).first()
        if existing_prop:
            return {
                "status": "already_completed",
                "delegation_id": delegation.id,
                "proposal": serialize_proposal_for_api(existing_prop),
            }

    if not delegation.correlation_id:
        raise ValueError(f"Delegation '{delegation_id}' has no associated PRD proposal")

    return await delegate_confirmed_prd_to_pixel(
        db=db,
        project_id=project_id,
        prd_proposal_id=delegation.correlation_id,
        confirmed_by="alex",
    )
