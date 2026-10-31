from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from backend.app.db.database import get_db
from backend.app.observer_summary.generator import generate_observer_summary

router = APIRouter(tags=["observer_summary"])


@router.get("/projects/{project_id}/observer-summary")
async def get_summary(project_id: str, db: Session = Depends(get_db)):
    summary = await generate_observer_summary(db, project_id)
    return summary.model_dump()
