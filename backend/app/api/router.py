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
    prune,
    mcp,
    delegations,
    approvals,
    resources,
    expenses,
    prd,
    chat,
    pixel_builder,
)

base_router = APIRouter()

base_router.include_router(demo.router)
base_router.include_router(requirements.router)
base_router.include_router(artifact.router)
base_router.include_router(agents.router)
base_router.include_router(proposals.router)
base_router.include_router(events.router)
base_router.include_router(observer_summary.router)
base_router.include_router(github.router)
base_router.include_router(prune.router)
base_router.include_router(mcp.router)
base_router.include_router(delegations.router)
base_router.include_router(approvals.router)
base_router.include_router(resources.router)
base_router.include_router(expenses.router)
base_router.include_router(prd.router)
base_router.include_router(chat.router)
base_router.include_router(pixel_builder.router)

api_router = APIRouter(prefix="/api")
api_router.include_router(base_router)
