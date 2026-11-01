import time
import uuid
from typing import Dict, Any, Optional
from fastapi import Request, HTTPException, Depends
from sqlalchemy.orm import Session
from backend.app.db.database import get_db
from backend.app.db.models import ProjectMemberModel
from backend.app.db.seed import DEMO_PROJECT_ID

# In-memory store for active session tokens
# token -> { "session_token": str, "project_id": str, "identity_key": str, "role": str, "display_name": str, "created_at": float }
ACTIVE_SESSIONS: Dict[str, Dict[str, Any]] = {}


def create_session(project_id: str, identity_key: str, role: str, display_name: str) -> str:
    """Generates and registers an authoritative session token for a participant."""
    session_token = f"coframe_{identity_key}_{uuid.uuid4().hex[:16]}"
    ACTIVE_SESSIONS[session_token] = {
        "session_token": session_token,
        "project_id": project_id,
        "identity_key": identity_key,
        "role": role,
        "display_name": display_name,
        "created_at": time.time(),
    }
    return session_token


def get_current_identity(request: Request, db: Session = Depends(get_db)) -> Optional[Dict[str, Any]]:
    """
    Extracts and validates caller identity from session headers or auth tokens.
    Never trusts request body alone.
    """
    # 1. Check X-COFRAME-Session
    session_token = request.headers.get("X-COFRAME-Session")
    if not session_token:
        # Check Authorization Bearer
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header[7:].strip()

    if session_token and session_token in ACTIVE_SESSIONS:
        sess = ACTIVE_SESSIONS[session_token]
        return {
            "identity_key": sess["identity_key"],
            "role": sess["role"],
            "display_name": sess["display_name"],
            "project_id": sess["project_id"],
            "session_token": session_token,
            "authenticated": True,
        }

    # 2. Check X-COFRAME-Identity header
    identity_key = request.headers.get("X-COFRAME-Identity")
    if identity_key:
        identity_key = identity_key.lower().strip()
        # Verify in DB
        member = (
            db.query(ProjectMemberModel)
            .filter(ProjectMemberModel.identity_key == identity_key)
            .first()
        )
        if member:
            return {
                "identity_key": member.identity_key,
                "role": member.role,
                "display_name": member.display_name,
                "project_id": member.project_id,
                "session_token": None,
                "authenticated": True,
            }
        raise HTTPException(
            status_code=401,
            detail=f"Invalid credentials: Identity '{identity_key}' not found in project membership.",
        )

    return None


def verify_governance_authorization(
    caller: Optional[Dict[str, Any]],
    claimed_identity: str,
    action_type: str = "proposal_decision",
    db: Optional[Session] = None,
    project_id: Optional[str] = None,
) -> str:
    """
    Validates that:
    1. If caller is authenticated, claimed_identity must strictly match the caller.
    2. Claimed identity exists as a valid project member.
    3. Action permissions are respected (e.g. founder requirements, high-impact decisions).
    Returns verified identity key.
    """
    claimed = claimed_identity.lower().strip()

    if caller and caller.get("authenticated"):
        if caller["identity_key"] != claimed:
            raise HTTPException(
                status_code=403,
                detail=f"Security violation: Authenticated participant '{caller['identity_key']}' cannot perform action as '{claimed}'.",
            )
        verified_key = caller["identity_key"]
        role = caller["role"]
    else:
        # Validate claimed identity directly in membership
        if claimed not in ("alex", "maya"):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid decider identity '{claimed}'. Demo allows only 'alex' or 'maya'.",
            )
        role = "founder" if claimed == "alex" else "designer"

    # Enforce strategic founder restrictions
    is_founder = "founder" in str(role).lower() or claimed == "alex"
    if action_type == "founder_requirement" and not is_founder:
        raise HTTPException(
            status_code=403,
            detail=f"Permission denied: Strategic requirements can only be modified by the Founder (Alex). '{claimed.capitalize()}' is not authorized.",
        )

    return claimed
