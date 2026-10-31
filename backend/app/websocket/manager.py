import json
import logging
from typing import Dict, List, Set, Optional
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        # project_id -> list of active websockets
        self.active_connections: Dict[str, List[WebSocket]] = {}
        # project_id -> set of connected identities ("alex", "maya")
        self.active_presence: Dict[str, Set[str]] = {}
        # socket -> (project_id, identity_key)
        self.socket_meta: Dict[WebSocket, tuple] = {}
        # project_id -> {section_key: editor_id}
        self.editing_sections: Dict[str, Dict[str, str]] = {}

    async def connect(self, websocket: WebSocket, project_id: str, identity_key: str):
        await websocket.accept()
        if project_id not in self.active_connections:
            self.active_connections[project_id] = []
            self.active_presence[project_id] = set()
            self.editing_sections[project_id] = {}

        self.active_connections[project_id].append(websocket)
        self.active_presence[project_id].add(identity_key)
        self.socket_meta[websocket] = (project_id, identity_key)

        logger.info(f"WebSocket connected: {identity_key} on {project_id}")
        await self.broadcast_presence(project_id)

    def disconnect(self, websocket: WebSocket):
        meta = self.socket_meta.pop(websocket, None)
        if meta:
            project_id, identity_key = meta
            if project_id in self.active_connections:
                if websocket in self.active_connections[project_id]:
                    self.active_connections[project_id].remove(websocket)

                # Check if this identity still has other tabs open
                remaining_identities = {
                    self.socket_meta[ws][1]
                    for ws in self.active_connections[project_id]
                    if ws in self.socket_meta
                }
                self.active_presence[project_id] = remaining_identities

                # Clear any sections this identity was editing
                if project_id in self.editing_sections:
                    for sec_key, editor in list(self.editing_sections[project_id].items()):
                        if editor == identity_key:
                            del self.editing_sections[project_id][sec_key]

    async def set_section_editing(self, project_id: str, section_key: str, identity_key: str):
        if project_id not in self.editing_sections:
            self.editing_sections[project_id] = {}
        self.editing_sections[project_id][section_key] = identity_key
        await self.broadcast_editing_awareness(project_id)

    async def clear_section_editing(self, project_id: str, section_key: str, identity_key: str):
        if project_id in self.editing_sections and self.editing_sections[project_id].get(section_key) == identity_key:
            del self.editing_sections[project_id][section_key]
            await self.broadcast_editing_awareness(project_id)

    async def broadcast_editing_awareness(self, project_id: str):
        editing_map = dict(self.editing_sections.get(project_id, {}))
        message = {
            "type": "SECTION_EDITING_AWARENESS",
            "project_id": project_id,
            "editing_sections": editing_map,
        }
        await self.broadcast(project_id, message)

    async def broadcast_presence(self, project_id: str):
        presence_list = list(self.active_presence.get(project_id, set()))
        message = {
            "type": "PRESENCE_UPDATE",
            "project_id": project_id,
            "online_members": presence_list,
            "editing_sections": dict(self.editing_sections.get(project_id, {})),
        }
        await self.broadcast(project_id, message)

    async def broadcast(self, project_id: str, message: dict):
        if project_id not in self.active_connections:
            return

        text = json.dumps(message)
        dead_sockets = []
        for connection in list(self.active_connections[project_id]):
            try:
                await connection.send_text(text)
            except Exception as e:
                logger.warning(f"Failed to send to client: {e}")
                dead_sockets.append(connection)

        for dead in dead_sockets:
            self.disconnect(dead)


ws_manager = ConnectionManager()
