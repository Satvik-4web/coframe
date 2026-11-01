import pytest
import time
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.websocket.manager import ws_manager
from backend.app.db.seed import reset_demo_database, DEMO_PROJECT_ID
from backend.app.db.database import SessionLocal

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db():
    db = SessionLocal()
    try:
        reset_demo_database(db, DEMO_PROJECT_ID)
    finally:
        db.close()


def test_multi_session_presence_and_states():
    """
    Requirement A1, A2, A3:
    1. Independent sessions for same participant.
    2. Closing Tab A does not mark user offline while Tab B is active.
    3. Granular participant states (viewing, editing, online, offline).
    """
    # Connect Tab 1 as Alex
    with client.websocket_connect(f"/ws/{DEMO_PROJECT_ID}/alex?session_id=alex_tab_1") as ws1:
        # Receive initial presence update
        data1 = ws1.receive_json()
        assert data1["type"] == "PRESENCE_UPDATE"
        assert "alex" in data1["online_members"]
        assert data1["participants"]["alex"]["active_sessions"] == 1
        assert data1["participants"]["alex"]["status"] == "online"

        # Connect Tab 2 as Alex
        with client.websocket_connect(f"/ws/{DEMO_PROJECT_ID}/alex?session_id=alex_tab_2") as ws2:
            data2 = ws2.receive_json()
            assert data2["participants"]["alex"]["active_sessions"] == 2

            # Alex starts editing hero section in Tab 2
            ws2.send_json({"type": "SECTION_EDIT_START", "section_key": "hero"})
            update = ws2.receive_json()
            assert update["type"] == "PRESENCE_UPDATE"
            assert update["participants"]["alex"]["status"] == "editing"
            assert update["participants"]["alex"]["section_key"] == "hero"

            # Tab 2 finishes editing and switches to viewing dashboard
            ws2.send_json({"type": "SECTION_FOCUS", "section_key": "dashboard"})
            update2 = ws2.receive_json()
            assert update2["participants"]["alex"]["status"] == "viewing"
            assert update2["participants"]["alex"]["section_key"] == "dashboard"

        # Tab 2 closed: Alex should still be online via Tab 1!
        presence = ws_manager.get_presence_payload(DEMO_PROJECT_ID)
        assert presence["participants"]["alex"]["is_online"] is True
        assert presence["participants"]["alex"]["active_sessions"] == 1

    # Tab 1 closed: Alex should now be offline
    presence_after = ws_manager.get_presence_payload(DEMO_PROJECT_ID)
    assert presence_after["participants"]["alex"]["is_online"] is False
    assert presence_after["participants"]["alex"]["active_sessions"] == 0
    assert presence_after["participants"]["alex"]["status"] == "offline"


def test_heartbeat_timeout_reaping():
    """
    Requirement A5:
    Heartbeats touch timestamp; missing heartbeats beyond timeout are reaped.
    """
    with client.websocket_connect(f"/ws/{DEMO_PROJECT_ID}/maya?session_id=maya_tab_1") as ws:
        _ = ws.receive_json()
        # Send heartbeat
        ws.send_json({"type": "HEARTBEAT", "session_id": "maya_tab_1"})
        pong = ws.receive_json()
        assert pong["type"] == "PONG"

        # Simulate timeout by artificially aging the heartbeat
        sess = ws_manager.sessions[DEMO_PROJECT_ID]["maya_tab_1"]
        sess.last_heartbeat = time.time() - 100.0

        # Run reaper with 30s threshold
        import asyncio
        reaped = asyncio.run(ws_manager.reap_stale_sessions(DEMO_PROJECT_ID, timeout_seconds=30.0))
        assert "maya_tab_1" in reaped

        # Maya should now be offline
        presence = ws_manager.get_presence_payload(DEMO_PROJECT_ID)
        assert presence["participants"]["maya"]["is_online"] is False


def test_agent_presence_lifecycle():
    """
    Requirement A4:
    AI agents (NOVA & PIXEL) transition accurately through states:
    working -> waiting_for_approval -> recovering -> idle.
    """
    # Baseline presence
    p_initial = ws_manager.get_presence_payload(DEMO_PROJECT_ID)
    assert p_initial["participants"]["nova"]["role"] == "strategist"
    assert p_initial["participants"]["pixel"]["role"] == "engineer"

    # Start agents
    resp = client.post(f"/api/projects/{DEMO_PROJECT_ID}/agents/start")
    assert resp.status_code == 200

    # After initial completion, agents are waiting for human review
    p_after = ws_manager.get_presence_payload(DEMO_PROJECT_ID)
    assert p_after["participants"]["nova"]["status"] == "waiting_for_approval"
    assert p_after["participants"]["pixel"]["status"] == "waiting_for_approval"

    # Restart NOVA (recovers context)
    r_restart = client.post(f"/api/projects/{DEMO_PROJECT_ID}/agents/nova/restart")
    assert r_restart.status_code == 200

    p_restart = ws_manager.get_presence_payload(DEMO_PROJECT_ID)
    assert p_restart["participants"]["nova"]["status"] == "idle"


def test_persistent_events_and_replay():
    """
    Requirement B1, B2, B3:
    1. Events are persisted with monotonic sequence numbers.
    2. Reconnection replay allows requesting events since_sequence_no.
    """
    # Perform actions that generate events
    client.patch(
        f"/api/projects/{DEMO_PROJECT_ID}/requirements/REQ_AUDIENCE",
        json={"value": "Global Fortune 500 Treasury Teams", "editor_id": "alex"},
        headers={"X-COFRAME-Identity": "alex"},
    )
    client.post(f"/api/projects/{DEMO_PROJECT_ID}/agents/start")

    # Fetch all events
    r_all = client.get(f"/api/projects/{DEMO_PROJECT_ID}/events")
    assert r_all.status_code == 200
    all_events = r_all.json()
    assert len(all_events) >= 2

    # Verify monotonic sequencing
    seqs = [e["sequence_no"] for e in all_events]
    assert seqs == sorted(seqs)

    cutoff = seqs[0]
    # Replay events since cutoff
    r_replay = client.get(f"/api/projects/{DEMO_PROJECT_ID}/events?since_sequence_no={cutoff}")
    assert r_replay.status_code == 200
    replay_events = r_replay.json()

    assert all(e["sequence_no"] > cutoff for e in replay_events)
    assert len(replay_events) == len(all_events) - 1


def test_server_side_governance_and_identity_validation():
    """
    Requirement C1, C2:
    1. Join issues authoritative session token.
    2. Identity spoofing is strictly rejected (e.g. Maya header with Alex decided_by).
    3. Unauthorized actions (e.g. Maya editing founder requirements) return HTTP 403.
    """
    # Join as Maya
    r_join = client.post(f"/api/projects/{DEMO_PROJECT_ID}/join", json={"identity_key": "maya"})
    assert r_join.status_code == 200
    token = r_join.json()["session_token"]
    assert token.startswith("coframe_maya_")

    # 1. Spoofing test: Maya presents session token but claims to be Alex in request body
    # Trigger high impact proposal first
    r_prop = client.post(f"/api/projects/{DEMO_PROJECT_ID}/agents/propose-policy")
    prop_id = r_prop.json()["proposal_id"]

    r_spoof = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/proposals/{prop_id}/approve",
        json={"decided_by": "alex"},
        headers={"X-COFRAME-Session": token},
    )
    # Server rejects spoofing attempt!
    assert r_spoof.status_code == 403
    assert "cannot perform action as 'alex'" in r_spoof.json()["detail"]

    # 2. Strategic requirement protection: Maya cannot edit REQ_AUDIENCE
    r_req_maya = client.patch(
        f"/api/projects/{DEMO_PROJECT_ID}/requirements/REQ_AUDIENCE",
        json={"value": "Illegal Maya update", "editor_id": "maya"},
        headers={"X-COFRAME-Identity": "maya"},
    )
    assert r_req_maya.status_code == 403
    assert "Founder" in r_req_maya.json()["detail"]

    # 3. Alex can edit REQ_AUDIENCE
    r_req_alex = client.patch(
        f"/api/projects/{DEMO_PROJECT_ID}/requirements/REQ_AUDIENCE",
        json={"value": "Authorized Alex update", "editor_id": "alex"},
        headers={"X-COFRAME-Identity": "alex"},
    )
    assert r_req_alex.status_code == 200
    assert r_req_alex.json()["status"] == "success"

    # 4. Unknown/malicious identity header rejected
    r_unauth = client.patch(
        f"/api/projects/{DEMO_PROJECT_ID}/requirements/REQ_AUDIENCE",
        json={"value": "Hacked", "editor_id": "hacker"},
        headers={"X-COFRAME-Identity": "hacker"},
    )
    assert r_unauth.status_code == 401


def test_section_collaborator_indicators():
    """
    Requirement D1:
    Display who is viewing or editing a section in the artifact API & state.
    """
    # Maya reports editing the hero section
    r_act = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/artifact/sections/hero/activity",
        json={"participant_id": "maya", "activity": "editing"},
        headers={"X-COFRAME-Identity": "maya"},
    )
    assert r_act.status_code == 200

    # Fetch artifact and verify active collaborators attached to hero section
    r_art = client.get(f"/api/projects/{DEMO_PROJECT_ID}/artifact")
    assert r_art.status_code == 200
    hero_collabs = r_art.json()["sections"]["hero"]["active_collaborators"]
    assert len(hero_collabs) == 1
    assert hero_collabs[0]["participant_id"] == "maya"
    assert hero_collabs[0]["status"] == "editing"

    # Maya stops editing (returns to idle/online)
    client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/artifact/sections/hero/activity",
        json={"participant_id": "maya", "activity": "idle"},
        headers={"X-COFRAME-Identity": "maya"},
    )

    r_art2 = client.get(f"/api/projects/{DEMO_PROJECT_ID}/artifact")
    hero_collabs2 = r_art2.json()["sections"]["hero"]["active_collaborators"]
    assert len(hero_collabs2) == 0
