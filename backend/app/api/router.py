from fastapi import APIRouter
from backend.app.api.routes import (
    demo,
    requirements,
    artifact,
    agents,
    proposals,
    events,
    observer_summary,
    github,
)

api_router = APIRouter(prefix="/api")

api_router.include_router(demo.router)
api_router.include_router(requirements.router)
api_router.include_router(artifact.router)
api_router.include_router(agents.router)
api_router.include_router(proposals.router)
api_router.include_router(events.router)
api_router.include_router(observer_summary.router)
api_router.include_router(github.router)
