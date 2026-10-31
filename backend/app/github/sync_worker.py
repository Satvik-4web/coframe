import asyncio
import logging
from typing import Optional
from sqlalchemy.orm import Session

from backend.app.db.database import SessionLocal
from backend.app.db.models import GitHubSyncJobModel, GitHubConnectionModel, ProposalModel, utcnow_str
from backend.app.github.contribution_service import ContributionService

logger = logging.getLogger("coframe.github.sync_worker")


async def process_single_job(job_id: str):
    """Processes a single pending GitHub sync job in its own database session."""
    db: Session = SessionLocal()
    try:
        job = db.query(GitHubSyncJobModel).filter(GitHubSyncJobModel.id == job_id).first()
        if not job or job.status != "pending":
            return

        job.status = "processing"
        job.attempts += 1
        job.updated_at = utcnow_str()
        db.commit()

        service = ContributionService(db)
        await service.publish_approved_proposal(
            project_id=job.project_id,
            proposal_id=job.proposal_id,
            decided_by="alex",
        )
    except Exception as e:
        logger.error(f"Error processing GitHub sync job '{job_id}': {e}", exc_info=True)
    finally:
        db.close()


def enqueue_sync_job_async(job_id: str):
    """Enqueues async execution of the sync job on the running event loop."""
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(process_single_job(job_id))
    except RuntimeError:
        # If no loop is running, run synchronously or pass
        asyncio.run(process_single_job(job_id))
