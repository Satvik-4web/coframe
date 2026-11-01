import asyncio
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.db.database import get_db, SessionLocal
from backend.app.db.models import PixelBuildSessionModel, ProjectModel, ProposalModel, utcnow_str
from backend.app.schemas.pixel_builder import (
    PixelBuildRequest,
    PixelBuildSessionResponse,
    PixelBuildTask,
    PixelUIComponent,
)
from backend.app.agents.pixel_builder import (
    execute_pixel_live_build,
    _generate_deterministic_plan,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/projects/{project_id}/pixel", tags=["pixel_builder"])


def _to_response_model(session: PixelBuildSessionModel) -> PixelBuildSessionResponse:
    tasks = [
        PixelBuildTask(**t) if isinstance(t, dict) else t
        for t in (session.tasks or [])
    ]
    components = [
        PixelUIComponent(**c) if isinstance(c, dict) else c
        for c in (session.components or [])
    ]
    return PixelBuildSessionResponse(
        id=session.id,
        project_id=session.project_id,
        plan_id=session.plan_id,
        prd_id=session.prd_id,
        execution_assignment_id=session.execution_assignment_id,
        run_id=session.run_id,
        instruction=session.instruction,
        understanding=session.understanding,
        status=session.status,
        progress_pct=session.progress_pct,
        current_task_id=session.current_task_id,
        tasks=tasks,
        components=components,
        proposal_id=session.proposal_id,
        error_message=session.error_message,
        execution_source=session.execution_source or "live_llm",
        is_simulated=bool(session.is_simulated),
        tokens_used=session.tokens_used or 0,
        retry_count=session.retry_count or 0,
        created_at=session.created_at,
        updated_at=session.updated_at,
        completed_at=session.completed_at,
    )


async def _run_pixel_live_build_background(
    project_id: str,
    session_id: str,
    instruction: str,
    plan_id: Optional[str] = None,
    prd_id: Optional[str] = None,
    submitter_id: str = "alex",
):
    db = SessionLocal()
    try:
        await execute_pixel_live_build(
            db=db,
            project_id=project_id,
            session_id=session_id,
            instruction=instruction,
            plan_id=plan_id,
            prd_id=prd_id,
            submitter_id=submitter_id,
        )
    except Exception as e:
        logger.error(f"Background PIXEL build failed for session {session_id}: {e}", exc_info=True)
    finally:
        db.close()


@router.post("/build", response_model=PixelBuildSessionResponse)
async def start_pixel_build(
    project_id: str,
    payload: PixelBuildRequest,
    db: Session = Depends(get_db),
):
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    instruction = (payload.instruction or "").strip()
    plan_id = payload.plan_id
    prd_id = payload.prd_id

    # If plan_id is provided, validate it and use its details if instruction was empty
    if plan_id:
        plan_prop = db.query(ProposalModel).filter(ProposalModel.id == plan_id).first()
        if not plan_prop:
            raise HTTPException(status_code=404, detail=f"Plan proposal '{plan_id}' not found")
        if not instruction:
            instruction = f"Implement approved plan: {plan_prop.summary}"
        if not prd_id and plan_prop.supersedes_proposal_id:
            prd_id = plan_prop.supersedes_proposal_id

    if not instruction:
        raise HTTPException(status_code=400, detail="Instruction cannot be empty")

    submitter_id = payload.submitter_id or "alex"

    # Prevent concurrent duplicate builds on the exact same project if one is actively running
    active_session = (
        db.query(PixelBuildSessionModel)
        .filter(
            PixelBuildSessionModel.project_id == project_id,
            PixelBuildSessionModel.status.in_(["building", "pending"]),
        )
        .order_by(PixelBuildSessionModel.created_at.desc())
        .first()
    )
    if active_session:
        logger.info(f"Re-using currently active PIXEL build session: {active_session.id}")
        return _to_response_model(active_session)

    # Persist session synchronously BEFORE launching background worker
    # This guarantees zero race condition and eliminates fake pbs_pending IDs
    initial_understanding, initial_tasks, initial_components = _generate_deterministic_plan(instruction)

    session = PixelBuildSessionModel(
        project_id=project_id,
        plan_id=plan_id,
        prd_id=prd_id,
        instruction=instruction,
        understanding=initial_understanding,
        status="pending",
        progress_pct=5,
        current_task_id=initial_tasks[0]["id"] if initial_tasks else None,
        tasks=initial_tasks,
        components=initial_components,
        created_at=utcnow_str(),
        updated_at=utcnow_str(),
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    # Launch background live build worker
    asyncio.create_task(
        _run_pixel_live_build_background(
            project_id=project_id,
            session_id=session.id,
            instruction=instruction,
            plan_id=plan_id,
            prd_id=prd_id,
            submitter_id=submitter_id,
        )
    )

    return _to_response_model(session)


@router.get("/build/latest", response_model=Optional[PixelBuildSessionResponse])
def get_latest_pixel_build(
    project_id: str,
    db: Session = Depends(get_db),
):
    session = (
        db.query(PixelBuildSessionModel)
        .filter(PixelBuildSessionModel.project_id == project_id)
        .order_by(PixelBuildSessionModel.created_at.desc())
        .first()
    )
    if not session:
        return None
    return _to_response_model(session)


@router.get("/build/{session_id}", response_model=PixelBuildSessionResponse)
def get_pixel_build_by_id(
    project_id: str,
    session_id: str,
    db: Session = Depends(get_db),
):
    session = (
        db.query(PixelBuildSessionModel)
        .filter(
            PixelBuildSessionModel.project_id == project_id,
            PixelBuildSessionModel.id == session_id,
        )
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail=f"PIXEL build session '{session_id}' not found")
    return _to_response_model(session)
