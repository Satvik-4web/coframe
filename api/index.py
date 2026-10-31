import sys
import os
import logging
import urllib.parse

# Add repository root to sys.path so 'backend' package imports resolve properly
repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if repo_root not in sys.path:
    sys.path.insert(0, repo_root)

from backend.app.main import app as fastapi_app
from backend.app.db.database import SessionLocal
from backend.app.db.seed import init_db, reset_demo_database, DEMO_PROJECT_ID
from backend.app.db.models import ProjectModel

# Ensure database tables and initial demo seed are created on cold-start in serverless
try:
    init_db()
    with SessionLocal() as db:
        if not db.query(ProjectModel).filter(ProjectModel.id == DEMO_PROJECT_ID).first():
            reset_demo_database(db, DEMO_PROJECT_ID)
except Exception as e:
    logging.getLogger("coframe.serverless").warning(f"Serverless cold start initialization note: {e}")


@fastapi_app.get("/api/health")
@fastapi_app.get("/health")
def api_health():
    return {
        "status": "online",
        "service": "COFRAME API on Vercel",
        "demo_project": DEMO_PROJECT_ID,
    }


class VercelASGIApp:
    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        if scope.get("type") == "http":
            qs = scope.get("query_string", b"").decode("latin1", "ignore")
            params = urllib.parse.parse_qs(qs)
            
            subpath = params.get("_subpath", [None])[0] or params.get("path", [None])[0]
            if subpath is not None:
                subpath_clean = subpath.lstrip("/")
                if subpath_clean.startswith("assets/") or subpath_clean in ("favicon.svg", "favicon.png", "icons.svg"):
                    scope["path"] = f"/{subpath_clean}"
                elif subpath_clean.startswith("api/"):
                    scope["path"] = f"/{subpath_clean}"
                elif scope.get("path") in ("/api/index", "/api/index.py", "/api"):
                    # Check if query parameter came from /api rewrite rule
                    if subpath_clean:
                        scope["path"] = f"/api/{subpath_clean}"
                    else:
                        scope["path"] = "/api"
                else:
                    scope["path"] = f"/{subpath_clean}"

        await self.inner(scope, receive, send)


app = VercelASGIApp(fastapi_app)
