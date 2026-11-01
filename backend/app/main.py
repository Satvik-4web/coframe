import os
import logging
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

# Suppress httpx URL logging to prevent credential exposure in logs
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager

from backend.app.api.router import api_router, base_router
from backend.app.websocket.manager import ws_manager
from backend.app.db.database import SessionLocal
from backend.app.db.seed import init_db, reset_demo_database, DEMO_PROJECT_ID
import asyncio
import json
import time
from typing import Optional
from backend.app.db.models import ProjectModel, ProjectMemberModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("coframe")


async def reap_stale_sessions_loop(interval_seconds: float = 15.0, timeout_seconds: float = 45.0):
    while True:
        try:
            await asyncio.sleep(interval_seconds)
            for project_id in list(ws_manager.sessions.keys()):
                await ws_manager.reap_stale_sessions(project_id, timeout_seconds=timeout_seconds)
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.warning(f"Error in reap_stale_sessions_loop: {e}")


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

    # Schedule stale-session heartbeat cleanup in the FastAPI application lifecycle
    reaper_task = asyncio.create_task(reap_stale_sessions_loop(interval_seconds=15.0, timeout_seconds=45.0))
    yield
    reaper_task.cancel()
    try:
        await reaper_task
    except asyncio.CancelledError:
        pass
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

# Include API routes (both prefixed and base for serverless flexibility)
app.include_router(api_router)
app.include_router(base_router)


@app.get("/health")
@app.get("/api/health")
async def health_check():
    return {
        "status": "online",
        "service": "COFRAME Collaborative Engine",
        "version": "1.0.0",
        "demo_project": DEMO_PROJECT_ID,
    }


@app.websocket("/ws/{project_id}/{identity_key}")
async def websocket_endpoint(
    websocket: WebSocket,
    project_id: str,
    identity_key: str,
    session_id: Optional[str] = None,
):
    # Server-side validation: project exists & participant belongs to project
    db = SessionLocal()
    try:
        project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
        if not project and project_id != DEMO_PROJECT_ID:
            await websocket.close(code=4004, reason="Project not found")
            return

        valid_identities = {"alex", "maya"}
        if identity_key not in valid_identities:
            member = (
                db.query(ProjectMemberModel)
                .filter(
                    ProjectMemberModel.project_id == project_id,
                    ProjectMemberModel.identity_key == identity_key,
                )
                .first()
            )
            if not member:
                await websocket.close(code=4003, reason="Unauthorized participant identity")
                return
    finally:
        db.close()

    actual_session_id = await ws_manager.connect(
        websocket=websocket,
        project_id=project_id,
        identity_key=identity_key,
        session_id=session_id,
    )

    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                ws_manager.record_heartbeat(websocket)
                await websocket.send_text("pong")
            else:
                try:
                    msg = json.loads(data)
                    msg_type = msg.get("type", "")
                    if msg_type in ("ping", "HEARTBEAT"):
                        ws_manager.record_heartbeat(websocket)
                        await websocket.send_text(json.dumps({"type": "PONG", "timestamp": time.time()}))
                    elif msg_type == "SET_STATUS":
                        await ws_manager.update_participant_status(
                            project_id=project_id,
                            identity_key=identity_key,
                            status=msg.get("status", "online"),
                            section_key=msg.get("section_key"),
                            session_id=actual_session_id,
                        )
                    elif msg_type == "SECTION_FOCUS":
                        await ws_manager.update_participant_status(
                            project_id=project_id,
                            identity_key=identity_key,
                            status="viewing",
                            section_key=msg.get("section_key"),
                            session_id=actual_session_id,
                        )
                    elif msg_type == "SECTION_EDIT_START":
                        await ws_manager.update_participant_status(
                            project_id=project_id,
                            identity_key=identity_key,
                            status="editing",
                            section_key=msg.get("section_key"),
                            session_id=actual_session_id,
                        )
                    elif msg_type == "SECTION_EDIT_END":
                        await ws_manager.update_participant_status(
                            project_id=project_id,
                            identity_key=identity_key,
                            status="online",
                            section_key=None,
                            session_id=actual_session_id,
                        )
                except json.JSONDecodeError:
                    ws_manager.record_heartbeat(websocket)
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
        await ws_manager.broadcast_presence(project_id)
    except Exception as e:
        logger.warning(f"WebSocket error: {e}")
        ws_manager.disconnect(websocket)
        await ws_manager.broadcast_presence(project_id)


# Serve built frontend if exists
frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../frontend/dist"))
if not os.path.exists(frontend_dist):
    for candidate in [
        "/var/task/frontend/dist",
        os.path.abspath("frontend/dist"),
        os.path.abspath("../frontend/dist"),
    ]:
        if os.path.exists(candidate):
            frontend_dist = candidate
            break

if os.path.exists(frontend_dist):
    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api") or full_path.startswith("ws"):
            raise HTTPException(status_code=404, detail="Not Found")
        target_path = os.path.join(frontend_dist, full_path)
        if full_path and os.path.exists(target_path) and os.path.isfile(target_path):
            return FileResponse(target_path)
        return FileResponse(os.path.join(frontend_dist, "index.html"))
