import pytest
from starlette.testclient import TestClient
from backend.app.main import app
from backend.app.db.seed import DEMO_PROJECT_ID

client = TestClient(app)


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "online"


def test_demo_reset_endpoint():
    response = client.post("/api/demo/reset")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["context_version"] == 1
    assert data["artifact_version"] == 1


def test_get_project_state():
    response = client.get(f"/api/projects/{DEMO_PROJECT_ID}/state")
    assert response.status_code == 200
    data = response.json()
    assert "project" in data
    assert "requirements" in data
    assert "sections" in data
    assert "observer_summary" in data


def test_join_demo_identity():
    # Valid Alex join
    resp_alex = client.post(f"/api/projects/{DEMO_PROJECT_ID}/join", json={"identity_key": "alex"})
    assert resp_alex.status_code == 200
    assert resp_alex.json()["identity_key"] == "alex"

    # Valid Maya join
    resp_maya = client.post(f"/api/projects/{DEMO_PROJECT_ID}/join", json={"identity_key": "maya"})
    assert resp_maya.status_code == 200
    assert resp_maya.json()["identity_key"] == "maya"

    # Invalid identity rejected
    resp_bad = client.post(f"/api/projects/{DEMO_PROJECT_ID}/join", json={"identity_key": "hacker"})
    assert resp_bad.status_code == 400


def test_full_seven_step_api_flow():
    # 1. Reset
    r_reset = client.post("/api/demo/reset")
    assert r_reset.status_code == 200

    # 2. Start collaboration
    r_start = client.post(f"/api/projects/{DEMO_PROJECT_ID}/agents/start")
    assert r_start.status_code == 200
    proposals = r_start.json()["proposals"]
    assert len(proposals) >= 3

    # Find proposal A (Audience) and C (Hero)
    prop_a = next(p for p in proposals if "REQ_AUDIENCE" in p["affected_requirements"])
    prop_b = next(p for p in proposals if "REQ_METRICS" in p["affected_requirements"])
    prop_c = next(p for p in proposals if "hero" in p["target_sections"])

    # 3. Alex changes REQ_AUDIENCE to "Enterprise finance teams"
    r_req = client.patch(
        f"/api/projects/{DEMO_PROJECT_ID}/requirements/REQ_AUDIENCE",
        json={"value": "Enterprise finance teams", "editor_id": "alex"},
    )
    assert r_req.status_code == 200

    # 4. Check selective staleness
    r_props = client.get(f"/api/projects/{DEMO_PROJECT_ID}/proposals")
    all_props = r_props.json()
    curr_a = next(p for p in all_props if p["proposal_id"] == prop_a["id"])
    curr_b = next(p for p in all_props if p["proposal_id"] == prop_b["id"])
    assert curr_a["status"] == "stale"
    assert curr_b["status"] == "pending_review"

    # Case B: Maya manually edits hero section
    r_edit = client.patch(
        f"/api/projects/{DEMO_PROJECT_ID}/artifact/sections/hero",
        json={
            "expected_version": 1,
            "data": {
                "headline": "Enterprise Spend Governance by Maya",
                "subheadline": "Precision finance workflow",
                "cta_text": "Request Access",
            },
            "editor_id": "maya",
        },
    )
    assert r_edit.status_code == 200
    assert r_edit.json()["version"] == 2

    # Check Proposal C conflict
    r_prop_c = client.get(f"/api/projects/{DEMO_PROJECT_ID}/proposals/{prop_c['id']}")
    assert r_prop_c.json()["status"] == "conflict"

    # 5. Restart NOVA and recover context
    r_restart = client.post(f"/api/projects/{DEMO_PROJECT_ID}/agents/nova/restart")
    assert r_restart.status_code == 200
    assert "recovery" in r_restart.json()

    # Reconcile Proposal A
    r_reconcile = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/proposals/{prop_a['id']}/reconcile",
        json={"requested_by": "maya"},
    )
    assert r_reconcile.status_code == 200
    new_prop_a_id = r_reconcile.json()["new_proposal_id"]

    # 6. High impact decision: Propose approval policy
    r_policy = client.post(f"/api/projects/{DEMO_PROJECT_ID}/agents/propose-policy")
    assert r_policy.status_code == 200
    policy_prop_id = r_policy.json()["proposal_id"]
    assert r_policy.json()["requires_decision"] is True
    assert r_policy.json()["assigned_decider_id"] == "alex"

    # Maya tries to approve policy -> 403 Forbidden!
    r_maya_app = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/proposals/{policy_prop_id}/approve",
        json={"decided_by": "maya"},
    )
    assert r_maya_app.status_code == 403

    # Alex redirects with human note
    r_redirect = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/proposals/{policy_prop_id}/redirect",
        json={
            "decided_by": "alex",
            "instruction": "Make approval thresholds configurable per organisation",
        },
    )
    assert r_redirect.status_code == 200
    revised_policy_id = r_redirect.json()["new_proposal_id"]

    # Alex approves revised proposal
    r_alex_app = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/proposals/{revised_policy_id}/approve",
        json={"decided_by": "alex"},
    )
    assert r_alex_app.status_code == 200

    # 7. Verify resulting shared product artifact
    r_art = client.get(f"/api/projects/{DEMO_PROJECT_ID}/artifact")
    assert r_art.status_code == 200
    queue_sec = r_art.json()["sections"]["approval_queue"]
    assert queue_sec["version"] >= 2
    assert "Configurable" in queue_sec["data"]["title"]
