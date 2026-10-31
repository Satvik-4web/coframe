import json
import logging
from typing import Dict, List, Set
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

    async def connect(self, websocket: WebSocket, project_id: str, identity_key: str):
        await websocket.accept()
        if project_id not in self.active_connections:
            self.active_connections[project_id] = []
            self.active_presence[project_id] = set()

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

    async def broadcast_presence(self, project_id: str):
        presence_list = list(self.active_presence.get(project_id, set()))
        message = {
            "type": "PRESENCE_UPDATE",
            "project_id": project_id,
            "online_members": presence_list,
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
