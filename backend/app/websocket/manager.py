import json
import logging
import time
import uuid
from dataclasses import dataclass, field
from typing import Dict, List, Set, Optional, Any
from fastapi import WebSocket

logger = logging.getLogger(__name__)

VALID_PARTICIPANT_STATES = {
    "online",
    "offline",
    "idle",
    "working",
    "viewing",
    "editing",
    "waiting_for_approval",
    "recovering",
    "failed",
}


@dataclass
class SessionInfo:
    session_id: str
    websocket: WebSocket
    identity_key: str
    role: str
    status: str = "online"
    section_key: Optional[str] = None
    connected_at: str = ""
    last_heartbeat: float = field(default_factory=time.time)


@dataclass
class AgentPresence:
    agent_id: str
    role: str
    status: str = "idle"
    current_task: Optional[str] = None
    last_active: str = ""


class ConnectionManager:
    def __init__(self):
        # project_id -> session_id -> SessionInfo
        self.sessions: Dict[str, Dict[str, SessionInfo]] = {}
        # websocket -> (project_id, session_id)
        self.socket_to_session: Dict[WebSocket, tuple] = {}
        # project_id -> agent_id -> AgentPresence
        self.agent_presence: Dict[str, Dict[str, AgentPresence]] = {}
        # project_id -> identity_key -> {"status": str, "section_key": Optional[str], "updated_at": float}
        self.participant_activity: Dict[str, Dict[str, dict]] = {}

    @property
    def active_connections(self) -> Dict[str, List[WebSocket]]:
        """Backward-compatible mapping of project_id -> list of active WebSockets."""
        result: Dict[str, List[WebSocket]] = {}
        for proj_id, sess_map in self.sessions.items():
            result[proj_id] = [s.websocket for s in sess_map.values()]
        return result

    @property
    def active_presence(self) -> Dict[str, Set[str]]:
        """Backward-compatible mapping of project_id -> set of active human identities."""
        result: Dict[str, Set[str]] = {}
        for proj_id, sess_map in self.sessions.items():
            result[proj_id] = {s.identity_key for s in sess_map.values()}
        return result

    def _ensure_project(self, project_id: str):
        if project_id not in self.sessions:
            self.sessions[project_id] = {}
        if project_id not in self.agent_presence:
            self.agent_presence[project_id] = {
                "nova": AgentPresence(
                    agent_id="nova",
                    role="strategist",
                    status="idle",
                    current_task=None,
                    last_active=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                ),
                "pixel": AgentPresence(
                    agent_id="pixel",
                    role="engineer",
                    status="idle",
                    current_task=None,
                    last_active=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                ),
            }

    async def connect(
        self,
        websocket: WebSocket,
        project_id: str,
        identity_key: str,
        session_id: Optional[str] = None,
        role: Optional[str] = None,
    ) -> str:
        await websocket.accept()
        self._ensure_project(project_id)

        if not session_id:
            session_id = f"sess_{identity_key}_{uuid.uuid4().hex[:8]}"

        if not role:
            role = "founder" if identity_key == "alex" else "designer"

        session = SessionInfo(
            session_id=session_id,
            websocket=websocket,
            identity_key=identity_key,
            role=role,
            status="online",
            section_key=None,
            connected_at=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            last_heartbeat=time.time(),
        )

        self.sessions[project_id][session_id] = session
        self.socket_to_session[websocket] = (project_id, session_id)

        logger.info(
            f"WebSocket connected: participant='{identity_key}' session='{session_id}' on project='{project_id}'"
        )
        await self.broadcast_presence(project_id)
        return session_id

    def disconnect(self, websocket: WebSocket) -> Optional[tuple]:
        meta = self.socket_to_session.pop(websocket, None)
        if not meta:
            return None

        project_id, session_id = meta
        if project_id in self.sessions and session_id in self.sessions[project_id]:
            sess = self.sessions[project_id].pop(session_id)
            identity_key = sess.identity_key
            logger.info(
                f"WebSocket disconnected: participant='{identity_key}' session='{session_id}' on project='{project_id}'"
            )
            # If no remaining sessions for this participant, reset their activity cache
            remaining = [
                s for s in self.sessions[project_id].values()
                if s.identity_key == identity_key
            ]
            if not remaining:
                if project_id in self.participant_activity and identity_key in self.participant_activity[project_id]:
                    self.participant_activity[project_id][identity_key] = {
                        "status": "offline",
                        "section_key": None,
                        "updated_at": time.time(),
                    }
            return (project_id, identity_key)

        return None

    def record_heartbeat(self, websocket: WebSocket) -> Optional[SessionInfo]:
        meta = self.socket_to_session.get(websocket)
        if not meta:
            return None
        project_id, session_id = meta
        sess = self.sessions.get(project_id, {}).get(session_id)
        if sess:
            sess.last_heartbeat = time.time()
        return sess

    async def update_participant_status(
        self,
        project_id: str,
        identity_key: str,
        status: str,
        section_key: Optional[str] = None,
        session_id: Optional[str] = None,
    ):
        if status not in VALID_PARTICIPANT_STATES:
            raise ValueError(f"Invalid participant state '{status}'. Must be one of {VALID_PARTICIPANT_STATES}")

        self._ensure_project(project_id)
        # Record participant activity cache
        if project_id not in self.participant_activity:
            self.participant_activity[project_id] = {}
        self.participant_activity[project_id][identity_key] = {
            "status": status,
            "section_key": section_key,
            "updated_at": time.time(),
        }

        if session_id and session_id in self.sessions[project_id]:
            sess = self.sessions[project_id][session_id]
            sess.status = status
            sess.section_key = section_key
            sess.last_heartbeat = time.time()
        else:
            for s in self.sessions[project_id].values():
                if s.identity_key == identity_key:
                    s.status = status
                    s.section_key = section_key
                    s.last_heartbeat = time.time()

        # Always broadcast updated presence
        await self.broadcast_presence(project_id)

    async def set_agent_status(
        self,
        project_id: str,
        agent_id: str,
        status: str,
        current_task: Optional[str] = None,
    ):
        if status not in VALID_PARTICIPANT_STATES:
            raise ValueError(f"Invalid agent state '{status}'. Must be one of {VALID_PARTICIPANT_STATES}")

        self._ensure_project(project_id)
        agent = self.agent_presence[project_id].get(agent_id)
        if not agent:
            role = "strategist" if agent_id == "nova" else "engineer"
            agent = AgentPresence(agent_id=agent_id, role=role)
            self.agent_presence[project_id][agent_id] = agent

        agent.status = status
        agent.current_task = current_task
        agent.last_active = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

        await self.broadcast_presence(project_id)

    async def reap_stale_sessions(self, project_id: str, timeout_seconds: float = 45.0) -> List[str]:
        """Detects and cleans up sessions that missed heartbeats beyond timeout threshold."""
        if project_id not in self.sessions:
            return []

        now = time.time()
        reaped: List[str] = []
        stale_sockets: List[WebSocket] = []

        for sess_id, sess in list(self.sessions[project_id].items()):
            if (now - sess.last_heartbeat) > timeout_seconds:
                reaped.append(sess_id)
                stale_sockets.append(sess.websocket)

        for ws in stale_sockets:
            try:
                await ws.close(code=1001, reason="Heartbeat timeout")
            except Exception:
                pass
            self.disconnect(ws)

        if reaped:
            logger.info(f"Reaped {len(reaped)} stale session(s) in {project_id}: {reaped}")
            await self.broadcast_presence(project_id)

        return reaped

    def get_online_members(self, project_id: str) -> List[str]:
        """Returns distinct human identity keys with active sessions."""
        sess_map = self.sessions.get(project_id, {})
        return sorted(list({s.identity_key for s in sess_map.values()}))

    def get_presence_payload(self, project_id: str) -> dict:
        self._ensure_project(project_id)
        sess_map = self.sessions.get(project_id, {})

        # Group sessions by human identity
        human_sessions: Dict[str, List[SessionInfo]] = {}
        for s in sess_map.values():
            human_sessions.setdefault(s.identity_key, []).append(s)

        participants: Dict[str, Any] = {}

        # Standard human participants: Alex and Maya
        for ident, default_role in [("alex", "founder"), ("maya", "designer")]:
            sessions = human_sessions.get(ident, [])
            if sessions:
                # Priority: editing > viewing > working > online > idle
                priority_order = ["editing", "viewing", "working", "online", "idle"]
                active_status = "online"
                active_section = None
                for prio in priority_order:
                    matching = [s for s in sessions if s.status == prio]
                    if matching:
                        active_status = prio
                        active_section = matching[0].section_key
                        break

                participants[ident] = {
                    "type": "human",
                    "role": sessions[0].role or default_role,
                    "status": active_status,
                    "is_online": True,
                    "active_sessions": len(sessions),
                    "section_key": active_section,
                    "session_ids": [s.session_id for s in sessions],
                    "last_active": max([s.connected_at for s in sessions]),
                }
            else:
                act = self.participant_activity.get(project_id, {}).get(ident)
                if act and act.get("status") in ("viewing", "editing", "working"):
                    participants[ident] = {
                        "type": "human",
                        "role": default_role,
                        "status": act["status"],
                        "is_online": True,
                        "active_sessions": 0,
                        "section_key": act.get("section_key"),
                        "session_ids": [],
                        "last_active": "",
                    }
                else:
                    participants[ident] = {
                        "type": "human",
                        "role": default_role,
                        "status": "offline",
                        "is_online": False,
                        "active_sessions": 0,
                        "section_key": None,
                        "session_ids": [],
                        "last_active": "",
                    }

        # AI agent participants: NOVA and PIXEL
        for agent_id, agent in self.agent_presence.get(project_id, {}).items():
            participants[agent_id] = {
                "type": "agent",
                "role": agent.role,
                "status": agent.status,
                "is_online": agent.status != "offline",
                "current_task": agent.current_task,
                "last_active": agent.last_active,
            }

        editing_sections = {}
        for ident, p_data in participants.items():
            if p_data.get("status") == "editing" and p_data.get("section_key"):
                editing_sections[p_data["section_key"]] = ident

        return {
            "type": "PRESENCE_UPDATE",
            "project_id": project_id,
            "online_members": self.get_online_members(project_id),
            "participants": participants,
            "editing_sections": editing_sections,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }

    async def broadcast_presence(self, project_id: str):
        payload = self.get_presence_payload(project_id)
        await self.broadcast(project_id, payload)

    async def broadcast(self, project_id: str, message: dict):
        sess_map = self.sessions.get(project_id, {})
        if not sess_map:
            return

        text = json.dumps(message)
        dead_sockets: List[WebSocket] = []

        for session in list(sess_map.values()):
            try:
                await session.websocket.send_text(text)
            except Exception as e:
                logger.warning(f"Failed to send to client {session.session_id}: {e}")
                dead_sockets.append(session.websocket)

        for dead in dead_sockets:
            self.disconnect(dead)


ws_manager = ConnectionManager()
