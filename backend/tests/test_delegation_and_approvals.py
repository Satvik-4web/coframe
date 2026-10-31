import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.db.database import SessionLocal
from backend.app.db.seed import reset_demo_database


@pytest.fixture(autouse=True)
def setup_clean_db():
    db = SessionLocal()
    reset_demo_database(db)
    db.close()


@pytest.fixture
def client():
    return TestClient(app)


def test_create_and_fetch_delegations(client):
    # 1. Create a delegation
    res = client.post(
        "/api/projects/demo-ledgerflow/delegations",
        json={
            "source_agent": "nova",
            "target_agent": "pixel",
            "task": "Render quarterly expense comparison chart",
            "scope": "metric_grid",
            "acceptance_criteria": [
                "Include Q1 through Q4 metrics",
                "Display trend arrows",
            ],
        },
    )
    assert res.status_code == 200
    del_data = res.json()
    assert del_data["status"] == "success"
    delegation = del_data["delegation"]
    assert delegation["source_agent"] == "nova"
    assert delegation["target_agent"] == "pixel"

    # 2. Fetch delegations
    list_res = client.get("/api/projects/demo-ledgerflow/delegations")
    assert list_res.status_code == 200
    res_data = list_res.json()
    delegations = res_data["delegations"]
    assert any(d["id"] == delegation["id"] for d in delegations)


def test_trigger_demo_nova_to_pixel_delegation(client):
    res = client.post("/api/projects/demo-ledgerflow/delegations/demo-nova-to-pixel")
    assert res.status_code == 200
    data = res.json()

    assert data["status"] == "success"
    assert "delegation_id" in data
    assert "proposal_id" in data
    assert data["delegation_id"].startswith("del_")
    assert data["proposal_id"].startswith("prop_")


def test_approvals_alex_permission_enforcement(client):
    # 1. Trigger NOVA policy proposal which generates high-impact approval
    res = client.post("/api/projects/demo-ledgerflow/agents/propose-policy")
    assert res.status_code == 200
    proposal = res.json()
    assert proposal["requires_decision"] is True
    assert proposal["assigned_decider_id"] == "alex"

    # 2. Fetch approvals
    appr_res = client.get("/api/projects/demo-ledgerflow/approvals")
    assert appr_res.status_code == 200
    approvals = appr_res.json()["approvals"]
    pending = [a for a in approvals if a["status"] == "pending"]
    assert len(pending) > 0
    target_appr = pending[0]

    # 3. Maya attempts to approve -> HTTP 403 Forbidden
    maya_res = client.post(
        f"/api/projects/demo-ledgerflow/approvals/{target_appr['id']}/resolve",
        json={
            "action": "approved",
            "decided_by": "maya",
            "note": "Designer approval attempt",
        },
    )
    assert maya_res.status_code == 403
    assert "access denied" in maya_res.json()["detail"].lower()

    # 4. Alex approves -> HTTP 200 OK
    alex_res = client.post(
        f"/api/projects/demo-ledgerflow/approvals/{target_appr['id']}/resolve",
        json={
            "action": "approved",
            "decided_by": "alex",
            "note": "Alex approves policy change as Founder",
        },
    )
    assert alex_res.status_code == 200
    res_data = alex_res.json()
    assert res_data["status"] == "success"
    assert res_data["approval"]["status"] == "approved"
    assert res_data["approval"]["resolved_by"] == "alex"
