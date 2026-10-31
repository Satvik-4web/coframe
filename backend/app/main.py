import os
import logging
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager

from backend.app.api.router import api_router
from backend.app.websocket.manager import ws_manager
from backend.app.db.database import SessionLocal
from backend.app.db.seed import init_db, reset_demo_database, DEMO_PROJECT_ID
from backend.app.db.models import ProjectModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("coframe")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB tables and seed baseline demo project if not present
    logger.info("Initializing database...")
    init_db()
    db = SessionLocal()
    try:
        project = db.query(ProjectModel).filter(ProjectModel.id == DEMO_PROJECT_ID).first()
        if not project:
            logger.info("Demo project not found; seeding baseline...")
            reset_demo_database(db, DEMO_PROJECT_ID)
    finally:
        db.close()
    yield
    logger.info("Shutting down COFRAME...")


app = FastAPI(
    title="COFRAME API",
    description="Multiplayer workspace where two humans and two AI agents collaborate on LedgerFlow",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router)


@app.get("/health")
async def health_check():
    return {
        "status": "online",
        "service": "COFRAME Collaborative Engine",
        "version": "1.0.0",
        "demo_project": DEMO_PROJECT_ID,
    }


@app.websocket("/ws/{project_id}/{identity_key}")
async def websocket_endpoint(websocket: WebSocket, project_id: str, identity_key: str):
    await ws_manager.connect(websocket, project_id, identity_key)
    try:
        while True:
            # Keep socket alive and receive any client ping
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
        await ws_manager.broadcast_presence(project_id)
    except Exception as e:
        logger.warning(f"WebSocket error: {e}")
        ws_manager.disconnect(websocket)
        await ws_manager.broadcast_presence(project_id)


# Serve built frontend if exists
frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../frontend/dist"))
if os.path.exists(frontend_dist):
    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api") or full_path.startswith("ws") or full_path == "health":
            return None
        target_path = os.path.join(frontend_dist, full_path)
        if full_path and os.path.exists(target_path) and os.path.isfile(target_path):
            return FileResponse(target_path)
        return FileResponse(os.path.join(frontend_dist, "index.html"))
