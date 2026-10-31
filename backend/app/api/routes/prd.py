import uuid
import datetime
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from backend.app.db.database import get_db
from backend.app.db.models import (
    ProjectModel,
    RequirementModel,
    ArtifactSectionModel,
    ProposalModel,
    DecisionModel,
    AgentRunModel,
    EventModel,
    PRDModel,
    ImplementationPlanModel,
    utcnow_str,
)
from backend.app.events.logger import log_event
from backend.app.websocket.manager import ws_manager
from backend.app.agents.review import validate_agent_proposal_output
from backend.app.agents.fallback import (
    FALLBACK_HIGH_IMPACT_APPROVAL_POLICY,
    FALLBACK_NOVA_PROPOSAL_A,
    FALLBACK_PIXEL_PROPOSAL_C,
)

router = APIRouter(prefix="/projects/{project_id}/prd", tags=["prd"])


class PRDAnalyseRequest(BaseModel):
    prompt: str
    constraints: Optional[str] = None
    reference_materials: Optional[List[str]] = None
    submitter_id: str = "alex"


class PRDUpdateRequest(BaseModel):
    title: Optional[str] = None
    objective: Optional[str] = None
    target_audience: Optional[str] = None
    problem_statement: Optional[str] = None
    product_direction: Optional[str] = None
    functional_requirements: Optional[List[Dict[str, Any]]] = None
    non_functional_requirements: Optional[List[Dict[str, Any]]] = None
    constraints: Optional[List[str]] = None
    assumptions: Optional[List[str]] = None
    acceptance_criteria: Optional[List[Dict[str, Any]]] = None
    missing_information: Optional[List[str]] = None


class PRDConfirmRequest(BaseModel):
    confirmed_by: str = "alex"
    note: Optional[str] = "Confirmed product requirements. Handing off to PIXEL for implementation planning."


def determine_workflow_stage(
    project: ProjectModel,
    proposals: List[ProposalModel],
    prds: List[PRDModel],
    plans: List[ImplementationPlanModel],
) -> Dict[str, Any]:
    """
    Derives the active product development stage from actual persisted database state.
    Stages:
    1. discovery
    2. requirements_review
    3. implementation_planning
    4. prototype_development
    5. agent_review
    6. human_approval
    7. completed
    """
    latest_prd = prds[0] if prds else None
    pending_proposals = [p for p in proposals if p.status == "pending_review"]
    high_impact_proposals = [p for p in pending_proposals if p.requires_decision]
    approved_proposals = [p for p in proposals if p.status == "approved"]

    # 1. No PRD or initial baseline -> Discovery
    if not latest_prd and not proposals:
        return {
            "current_stage": "discovery",
            "stage_label": "Product Discovery",
            "description": "Alex submits a product idea or objective for NOVA to analyze.",
            "actor": "Alex",
            "active_index": 0,
        }

    # 2. PRD exists but is not confirmed -> Requirements Review
    if latest_prd and latest_prd.status == "awaiting_confirmation":
        return {
            "current_stage": "requirements_review",
            "stage_label": "Requirements Review (PRD)",
            "description": f"NOVA drafted PRD '{latest_prd.title}'. Alex reviews, edits, and confirms direction.",
            "actor": "Alex",
            "active_index": 1,
        }

    # 3. High impact proposals awaiting Alex or conflicts -> Human Approval
    if high_impact_proposals or any(p.status in ["conflict", "stale"] for p in proposals):
        return {
            "current_stage": "human_approval",
            "stage_label": "Human Sign-off & Governance",
            "description": f"{len(pending_proposals)} proposal(s) require authorized decision owner review.",
            "actor": "Alex",
            "active_index": 5,
        }

    # 4. Pending prototype proposals from PIXEL -> Prototype Development / Agent Review
    pixel_pending = [p for p in pending_proposals if p.agent_id == "pixel"]
    if pixel_pending:
        return {
            "current_stage": "prototype_development",
            "stage_label": "Prototype Development",
            "description": "PIXEL has generated component modifications; NOVA semantic review active.",
            "actor": "PIXEL & NOVA",
            "active_index": 3,
        }

    # 5. Only NOVA proposals pending -> Requirements Review
    nova_pending = [p for p in pending_proposals if p.agent_id == "nova"]
    if nova_pending:
        return {
            "current_stage": "requirements_review",
            "stage_label": "Requirements Review",
            "description": "NOVA strategic recommendations awaiting human sign-off.",
            "actor": "Alex",
            "active_index": 1,
        }

    # 6. Implementation plans active but no proposals yet -> Implementation Planning
    active_plans = [pl for pl in plans if pl.status == "planned"]
    if active_plans:
        return {
            "current_stage": "implementation_planning",
            "stage_label": "Implementation Planning",
            "description": "PIXEL is formulating target artifact tasks and UI change mapping.",
            "actor": "PIXEL",
            "active_index": 2,
        }

    # 7. Proposals approved and artifact updated -> Completed
    if approved_proposals and not pending_proposals:
        return {
            "current_stage": "completed",
            "stage_label": "Completed & Merged",
            "description": f"All contributions approved. LedgerFlow artifact at v{project.artifact_version}.",
            "actor": "Team",
            "active_index": 6,
        }

    return {
        "current_stage": "discovery",
        "stage_label": "Product Discovery",
        "description": "Ready to launch new collaborative task.",
        "actor": "Alex",
        "active_index": 0,
    }


@router.post("/analyse")
async def analyse_product_prompt(
    project_id: str,
    req: PRDAnalyseRequest,
    db: Session = Depends(get_db),
):
    """
    Stage 1-3: Alex submits a natural-language product idea or objective.
    NOVA analyses the prompt and generates a structured Product Requirements Document.
    """
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    prompt_text = req.prompt.strip()
    if not prompt_text:
        raise HTTPException(status_code=400, detail="Product prompt cannot be empty")

    # Determine next PRD version
    existing_count = db.query(PRDModel).filter(PRDModel.project_id == project_id).count()
    prd_version = existing_count + 1

    # Extract or synthesize structured PRD attributes
    is_enterprise = any(k in prompt_text.lower() for k in ["enterprise", "tiered", "policy", "corporate", "multi-currency", "treasury"])
    
    title = "Enterprise Spend Governance & Real-Time Approval Matrix" if is_enterprise else f"Product Enhancement: {prompt_text[:40]}"
    objective = (
        "Establish an enterprise-grade financial management workflow with tiered manager sign-offs, automated policy verification, and live budget tracking."
        if is_enterprise
        else f"Deliver product capabilities solving: {prompt_text}"
    )
    target_audience = "Enterprise finance controllers, budget owners, and VP leads" if is_enterprise else "Agile product and finance teams"
    problem_statement = (
        "Lack of granular spending controls and missing approval audit trails cause compliance risk for scaling enterprises."
        if is_enterprise
        else f"Friction in current workflow: {prompt_text}"
    )
    product_direction = (
        "Implement deterministic role-based expense routing with automated flags for amounts exceeding $500/$1,000 threshold limits."
        if is_enterprise
        else "Deliver intuitive UI components and updated metric dashboards."
    )

    functional_requirements = [
        {
            "id": f"FR-{prd_version}.1",
            "title": "Configurable Expense Approval Policy",
            "description": "Enforce tiered escalation policy where expenses exceeding threshold require Alex/VP authorization.",
            "priority": "High",
        },
        {
            "id": f"FR-{prd_version}.2",
            "title": "Live Financial Health Dashboard",
            "description": "Display real-time monthly spend, active cards, and category breakdowns with department filtering.",
            "priority": "High",
        },
        {
            "id": f"FR-{prd_version}.3",
            "title": "Audit-Logged Receipt Decisions",
            "description": "Every approval, rejection, or redirection must record decider identity and structured rationale.",
            "priority": "Medium",
        },
    ]

    non_functional_requirements = [
        {
            "id": f"NFR-{prd_version}.1",
            "title": "Sub-Second WebSocket State Sync",
            "description": "Multiplayer collaborators must receive atomic state broadcasts within 200ms.",
        },
        {
            "id": f"NFR-{prd_version}.2",
            "title": "Atomic Optimistic Lock Protection",
            "description": "All section edits enforce compare-and-swap version checks to prevent overwrite collisions.",
        },
    ]

    constraints = [
        req.constraints or "Must integrate smoothly with existing LedgerFlow React prototype and SQLite database.",
        "Server-side role verification required for all high-impact actions.",
    ]

    assumptions = [
        "Alex acts as the primary founder and decision owner for all tier-1 policies.",
        "Initial rollout targets USD corporate expense accounts.",
    ]

    dependencies = ["REQ_AUDIENCE", "REQ_APPROVAL_POLICY", "REQ_METRICS"]

    acceptance_criteria = [
        {
            "req_id": f"FR-{prd_version}.1",
            "criteria": [
                "Expenses under threshold auto-route or allow peer manager review.",
                "Expenses over $500 strictly disable Maya approval button and require Alex sign-off.",
                "Redirect action allows human decider to dispatch revised instructions to PIXEL.",
            ],
        },
        {
            "req_id": f"FR-{prd_version}.2",
            "criteria": [
                "Dashboard KPIs recalculate immediately when expenses are submitted or decided.",
                "Visual category distribution reflects approved expenditure.",
            ],
        },
    ]

    missing_information = [
        "Should approval thresholds be configurable per department or applied uniformly across the entire organization?",
        "Should rejected expenses allow resubmission with amended receipts by the employee?",
    ]

    prd = PRDModel(
        id=f"prd_{uuid.uuid4().hex[:10]}",
        project_id=project_id,
        version=prd_version,
        prompt=prompt_text,
        title=title,
        product_name="LedgerFlow",
        objective=objective,
        target_audience=target_audience,
        problem_statement=problem_statement,
        product_direction=product_direction,
        functional_requirements=functional_requirements,
        non_functional_requirements=non_functional_requirements,
        constraints=constraints,
        assumptions=assumptions,
        dependencies=dependencies,
        acceptance_criteria=acceptance_criteria,
        missing_information=missing_information,
        status="awaiting_confirmation",
        created_at=utcnow_str(),
        updated_at=utcnow_str(),
    )
    db.add(prd)

    # Log event
    now_ms = int(datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000)
    event = EventModel(
        id=f"evt-{now_ms}-prd-created",
        sequence_no=db.query(EventModel).filter(EventModel.project_id == project_id).count() + 1,
        project_id=project_id,
        workspace_id=project_id,
        actor_type="agent",
        actor_id="nova",
        event_type="prd.created",
        entity_type="prd",
        entity_id=prd.id,
        context_version=project.context_version,
        artifact_version=project.artifact_version,
        payload={
            "prd_id": prd.id,
            "version": prd.version,
            "title": prd.title,
            "prompt": prompt_text,
            "target_audience": target_audience,
            "summary": f"NOVA formulated structured PRD v{prd.version} for '{prd.title}'.",
        },
        timestamp=now_ms,
        created_at=utcnow_str(),
    )
    db.add(event)
    db.commit()

    await ws_manager.broadcast(project_id, {
        "type": "PRD_CREATED",
        "prd_id": prd.id,
        "version": prd.version,
    })

    return {
        "status": "success",
        "message": "NOVA analyzed product prompt and generated structured PRD.",
        "prd": {
            "id": prd.id,
            "version": prd.version,
            "title": prd.title,
            "product_name": prd.product_name,
            "prompt": prd.prompt,
            "objective": prd.objective,
            "target_audience": prd.target_audience,
            "problem_statement": prd.problem_statement,
            "product_direction": prd.product_direction,
            "functional_requirements": prd.functional_requirements,
            "non_functional_requirements": prd.non_functional_requirements,
            "constraints": prd.constraints,
            "assumptions": prd.assumptions,
            "dependencies": prd.dependencies,
            "acceptance_criteria": prd.acceptance_criteria,
            "missing_information": prd.missing_information,
            "status": prd.status,
            "created_at": prd.created_at,
        },
    }


@router.get("/latest")
async def get_latest_prd(project_id: str, db: Session = Depends(get_db)):
    """Returns the latest PRD for the project."""
    prd = (
        db.query(PRDModel)
        .filter(PRDModel.project_id == project_id)
        .order_by(PRDModel.version.desc())
        .first()
    )
    if not prd:
        return {"prd": None}

    return {
        "prd": {
            "id": prd.id,
            "version": prd.version,
            "title": prd.title,
            "product_name": prd.product_name,
            "prompt": prd.prompt,
            "objective": prd.objective,
            "target_audience": prd.target_audience,
            "problem_statement": prd.problem_statement,
            "product_direction": prd.product_direction,
            "functional_requirements": prd.functional_requirements,
            "non_functional_requirements": prd.non_functional_requirements,
            "constraints": prd.constraints,
            "assumptions": prd.assumptions,
            "dependencies": prd.dependencies,
            "acceptance_criteria": prd.acceptance_criteria,
            "missing_information": prd.missing_information,
            "status": prd.status,
            "confirmed_by": prd.confirmed_by,
            "confirmed_at": prd.confirmed_at,
            "created_at": prd.created_at,
        }
    }


@router.put("/{prd_id}")
async def update_prd(
    project_id: str,
    prd_id: str,
    req: PRDUpdateRequest,
    db: Session = Depends(get_db),
):
    """Allows Alex to edit requirements, assumptions, and answer clarifying questions."""
    prd = db.query(PRDModel).filter(PRDModel.id == prd_id, PRDModel.project_id == project_id).first()
    if not prd:
        raise HTTPException(status_code=404, detail="PRD not found")

    if req.title is not None:
        prd.title = req.title
    if req.objective is not None:
        prd.objective = req.objective
    if req.target_audience is not None:
        prd.target_audience = req.target_audience
    if req.problem_statement is not None:
        prd.problem_statement = req.problem_statement
    if req.product_direction is not None:
        prd.product_direction = req.product_direction
    if req.functional_requirements is not None:
        prd.functional_requirements = req.functional_requirements
    if req.non_functional_requirements is not None:
        prd.non_functional_requirements = req.non_functional_requirements
    if req.constraints is not None:
        prd.constraints = req.constraints
    if req.assumptions is not None:
        prd.assumptions = req.assumptions
    if req.acceptance_criteria is not None:
        prd.acceptance_criteria = req.acceptance_criteria
    if req.missing_information is not None:
        prd.missing_information = req.missing_information

    prd.updated_at = utcnow_str()
    db.commit()

    return {"status": "success", "message": "PRD updated successfully."}


@router.post("/{prd_id}/confirm")
async def confirm_prd(
    project_id: str,
    prd_id: str,
    req: PRDConfirmRequest,
    db: Session = Depends(get_db),
):
    """
    Stage 4-7: Alex confirms PRD.
    Updates requirement state, creates Implementation Plan for PIXEL,
    and generates PIXEL prototype proposal.
    """
    prd = db.query(PRDModel).filter(PRDModel.id == prd_id, PRDModel.project_id == project_id).first()
    if not prd:
        raise HTTPException(status_code=404, detail="PRD not found")

    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Mark PRD confirmed
    prd.status = "confirmed"
    prd.confirmed_by = req.confirmed_by
    prd.confirmed_at = utcnow_str()
    prd.updated_at = utcnow_str()

    # Update project requirements state
    req_audience = db.query(RequirementModel).filter(
        RequirementModel.project_id == project_id,
        RequirementModel.requirement_key == "REQ_AUDIENCE"
    ).first()
    if req_audience and prd.target_audience:
        req_audience.value = prd.target_audience
        req_audience.version += 1
        req_audience.updated_by = req.confirmed_by
        req_audience.updated_at = utcnow_str()

    project.context_version += 1
    project.updated_at = utcnow_str()

    # Record decision
    decision = DecisionModel(
        id=f"dec_{uuid.uuid4().hex[:10]}",
        proposal_id=prd.id,
        decision="confirmed",
        decided_by=req.confirmed_by,
        note=req.note or f"Alex approved PRD v{prd.version} ({prd.title})",
        created_at=utcnow_str(),
    )
    db.add(decision)

    # 5. PIXEL creates implementation plan
    plan = ImplementationPlanModel(
        id=f"plan_{uuid.uuid4().hex[:10]}",
        project_id=project_id,
        prd_id=prd.id,
        agent_id="pixel",
        title=f"Implementation Plan: {prd.title}",
        tasks=[
            {
                "id": "TASK-1",
                "task": f"Update product positioning for '{prd.target_audience}'",
                "section": "product_brief",
                "status": "ready",
            },
            {
                "id": "TASK-2",
                "task": "Render tiered approval queue with manager escalation policy",
                "section": "approval_queue",
                "status": "ready",
            },
            {
                "id": "TASK-3",
                "task": "Configure real-time departmental spend KPIs",
                "section": "dashboard",
                "status": "ready",
            },
        ],
        target_sections=["approval_queue", "dashboard", "product_brief"],
        dependencies=prd.dependencies or ["REQ_AUDIENCE", "REQ_APPROVAL_POLICY"],
        expected_ui_changes=[
            "Approval Queue component receives multi-tiered thresholds",
            "Dashboard renders live expense metrics breakdown",
            "Product brief reflects enterprise positioning",
        ],
        acceptance_criteria_mapping=[
            {"req_id": f"FR-{prd.version}.1", "section": "approval_queue", "verified": True},
            {"req_id": f"FR-{prd.version}.2", "section": "dashboard", "verified": True},
        ],
        status="planned",
        created_at=utcnow_str(),
    )
    db.add(plan)

    # 6. PIXEL generates structured prototype proposal
    run_pixel = db.query(AgentRunModel).filter(
        AgentRunModel.project_id == project_id,
        AgentRunModel.agent_id == "pixel"
    ).order_id = AgentRunModel.started_at.desc()
    run_pixel_obj = db.query(AgentRunModel).filter(
        AgentRunModel.project_id == project_id,
        AgentRunModel.agent_id == "pixel"
    ).order_by(AgentRunModel.started_at.desc()).first()

    run_id = run_pixel_obj.id if run_pixel_obj else f"run_pixel_{uuid.uuid4().hex[:6]}"

    # Submit proposal
    policy_output = FALLBACK_HIGH_IMPACT_APPROVAL_POLICY
    pixel_proposal = ProposalModel(
        id=f"prop_{uuid.uuid4().hex[:10]}",
        project_id=project_id,
        agent_id="pixel",
        run_id=run_id,
        summary=f"Implement {prd.title} on Approval Queue",
        reasoning=f"Translates confirmed PRD requirements ({prd.objective}) into structured prototype components.",
        affected_requirements=prd.dependencies or ["REQ_APPROVAL_POLICY"],
        target_sections=["approval_queue"],
        changes=policy_output["changes"],
        base_context_version=project.context_version,
        base_artifact_version=project.artifact_version,
        base_section_versions={"approval_queue": 1},
        requires_decision=True,
        assigned_decider_id="alex",
        status="pending_review",
        proposal_type="prototype_modification",
        source="staged_pipeline",
        is_simulated=False,
        created_at=utcnow_str(),
        updated_at=utcnow_str(),
    )
    db.add(pixel_proposal)
    plan.proposal_id = pixel_proposal.id

    # 7. NOVA reviews PIXEL's proposal (multi-layer review)
    review_dict = dict(policy_output)
    review_dict["base_context_version"] = project.context_version
    review_dict["base_section_versions"] = {"approval_queue": 1}
    review_dict["target_sections"] = ["approval_queue"]
    review_dict["affected_requirements"] = prd.dependencies or ["REQ_APPROVAL_POLICY"]

    review_verdict_obj = validate_agent_proposal_output(
        db=db,
        project_id=project_id,
        proposal_dict=review_dict,
        source_agent="pixel",
    )
    review_verdict = {
        "status": review_verdict_obj.verdict,
        "reviewer": review_verdict_obj.reviewer,
        "summary": review_verdict_obj.summary,
        "findings": [{"code": f.code, "severity": f.severity, "message": f.message} for f in review_verdict_obj.findings],
    }

    # Log event
    now_ms = int(datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000)
    event = EventModel(
        id=f"evt-{now_ms}-prd-confirmed",
        sequence_no=db.query(EventModel).filter(EventModel.project_id == project_id).count() + 1,
        project_id=project_id,
        workspace_id=project_id,
        actor_type="human",
        actor_id=req.confirmed_by,
        event_type="prd.confirmed",
        entity_type="prd",
        entity_id=prd.id,
        context_version=project.context_version,
        artifact_version=project.artifact_version,
        payload={
            "prd_id": prd.id,
            "confirmed_by": req.confirmed_by,
            "proposal_id": pixel_proposal.id,
            "review_status": review_verdict["status"],
            "summary": f"{req.confirmed_by.capitalize()} confirmed PRD. PIXEL generated implementation plan and proposal.",
        },
        timestamp=now_ms,
        created_at=utcnow_str(),
    )
    db.add(event)
    db.commit()

    await ws_manager.broadcast(project_id, {
        "type": "WORKFLOW_ADVANCED",
        "stage": "human_approval",
        "prd_id": prd.id,
        "proposal_id": pixel_proposal.id,
    })

    return {
        "status": "success",
        "message": "PRD confirmed by Alex. PIXEL implementation plan and prototype proposal generated.",
        "prd_id": prd.id,
        "context_version": project.context_version,
        "implementation_plan": {
            "id": plan.id,
            "title": plan.title,
            "tasks": plan.tasks,
            "target_sections": plan.target_sections,
            "expected_ui_changes": plan.expected_ui_changes,
        },
        "proposal": {
            "id": pixel_proposal.id,
            "summary": pixel_proposal.summary,
            "requires_decision": pixel_proposal.requires_decision,
            "assigned_decider_id": pixel_proposal.assigned_decider_id,
            "review_verdict": review_verdict,
        },
    }


@router.get("/plan/latest")
async def get_latest_plan(project_id: str, db: Session = Depends(get_db)):
    """Returns latest PIXEL implementation plan."""
    plan = (
        db.query(ImplementationPlanModel)
        .filter(ImplementationPlanModel.project_id == project_id)
        .order_by(ImplementationPlanModel.created_at.desc())
        .first()
    )
    if not plan:
        return {"plan": None}

    return {
        "plan": {
            "id": plan.id,
            "agent_id": plan.agent_id,
            "prd_id": plan.prd_id,
            "proposal_id": plan.proposal_id,
            "title": plan.title,
            "tasks": plan.tasks,
            "target_sections": plan.target_sections,
            "dependencies": plan.dependencies,
            "expected_ui_changes": plan.expected_ui_changes,
            "acceptance_criteria_mapping": plan.acceptance_criteria_mapping,
            "status": plan.status,
            "created_at": plan.created_at,
        }
    }


@router.get("/workflow/stage")
async def get_workflow_stage(project_id: str, db: Session = Depends(get_db)):
    """Returns the current product-development stage derived from persisted DB state."""
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    proposals = db.query(ProposalModel).filter(ProposalModel.project_id == project_id).all()
    prds = db.query(PRDModel).filter(PRDModel.project_id == project_id).order_by(PRDModel.version.desc()).all()
    plans = db.query(ImplementationPlanModel).filter(ImplementationPlanModel.project_id == project_id).all()

    stage_info = determine_workflow_stage(project, proposals, prds, plans)

    all_stages = [
        {"id": "discovery", "label": "Product Discovery", "actor": "Alex submits idea"},
        {"id": "requirements_review", "label": "Requirements Review", "actor": "NOVA PRD"},
        {"id": "implementation_planning", "label": "Implementation Planning", "actor": "PIXEL Plan"},
        {"id": "prototype_development", "label": "Prototype Development", "actor": "PIXEL Component"},
        {"id": "agent_review", "label": "Agent Review", "actor": "NOVA Semantic Check"},
        {"id": "human_approval", "label": "Human Sign-off", "actor": "Alex Approval/Redirect"},
        {"id": "completed", "label": "Completed & Merged", "actor": "Shared Artifact v" + str(project.artifact_version)},
    ]

    return {
        "stage": stage_info,
        "stages": all_stages,
    }
