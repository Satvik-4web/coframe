import sys
import os

# Add repository root to sys.path so 'backend' package imports resolve properly
repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if repo_root not in sys.path:
    sys.path.insert(0, repo_root)

from backend.app.main import app
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
    import logging
    logging.getLogger("coframe.serverless").warning(f"Serverless cold start initialization note: {e}")
