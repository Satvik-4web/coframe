import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.db.database import SessionLocal, Base, engine
from backend.app.db.models import ExpenseModel, ProjectModel
from backend.app.db.seed import DEMO_PROJECT_ID, reset_demo_database

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    reset_demo_database(db, DEMO_PROJECT_ID)
    db.close()
    yield


def test_submit_expense_persists_and_calculates():
    """Tests employee expense submission and live metrics calculation."""
    payload = {
        "amount": 249.50,
        "currency": "USD",
        "category": "Travel",
        "description": "Flight to client demo in SF",
        "expense_date": "2026-11-01",
        "submitted_by": "maya",
    }
    res = client.post(f"/api/projects/{DEMO_PROJECT_ID}/expenses", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert data["expense"]["amount"] == 249.50
    assert data["expense"]["threshold_exceeded"] is False
    assert data["metrics"]["total_submitted"] >= 1
    assert data["metrics"]["pending_count"] >= 1


def test_low_threshold_expense_can_be_approved_by_maya():
    """Expenses <= $500 can be approved by Maya."""
    # 1. Submit
    res_sub = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/expenses",
        json={
            "amount": 85.00,
            "category": "Meals",
            "description": "Team lunch",
            "expense_date": "2026-11-01",
            "submitted_by": "alex",
        },
    )
    expense_id = res_sub.json()["expense"]["id"]

    # 2. Maya approves
    res_dec = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/expenses/{expense_id}/decision",
        json={"decision": "approved", "decided_by": "maya", "reason": "Compliant with meal policy"},
    )
    assert res_dec.status_code == 200
    assert res_dec.json()["expense"]["status"] == "approved"
    assert res_dec.json()["expense"]["decided_by"] == "maya"


def test_high_threshold_expense_requires_alex_permission():
    """Expenses > $500 MUST be approved by Alex; Maya is denied."""
    # 1. Submit large expense
    res_sub = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/expenses",
        json={
            "amount": 1499.00,
            "category": "Equipment",
            "description": "Enterprise GPU workstation for PIXEL model training",
            "expense_date": "2026-11-01",
            "submitted_by": "maya",
        },
    )
    expense_id = res_sub.json()["expense"]["id"]
    assert res_sub.json()["expense"]["threshold_exceeded"] is True

    # 2. Maya tries to approve -> 403 Forbidden!
    res_maya = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/expenses/{expense_id}/decision",
        json={"decision": "approved", "decided_by": "maya"},
    )
    assert res_maya.status_code == 403
    assert "require Alex's approval" in res_maya.json()["detail"]

    # 3. Alex approves -> Success!
    res_alex = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/expenses/{expense_id}/decision",
        json={"decision": "approved", "decided_by": "alex", "reason": "Approved enterprise capital asset"},
    )
    assert res_alex.status_code == 200
    assert res_alex.json()["expense"]["status"] == "approved"


def test_manager_can_reject_expense_with_reason():
    """Tests rejecting an expense with a logged justification."""
    res_sub = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/expenses",
        json={
            "amount": 350.00,
            "category": "Office",
            "description": "Unapproved luxury espresso machine",
            "expense_date": "2026-11-01",
            "submitted_by": "maya",
        },
    )
    expense_id = res_sub.json()["expense"]["id"]

    res_rej = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/expenses/{expense_id}/decision",
        json={"decision": "rejected", "decided_by": "alex", "reason": "Non-standard equipment request"},
    )
    assert res_rej.status_code == 200
    assert res_rej.json()["expense"]["status"] == "rejected"


def test_live_dashboard_metrics_aggregation():
    """Verifies that metrics compute real database sums rather than static numbers."""
    client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/expenses",
        json={
            "amount": 200.00,
            "category": "Software",
            "description": "Cloud hosting",
            "expense_date": "2026-11-01",
            "submitted_by": "alex",
        },
    )
    res_sub2 = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/expenses",
        json={
            "amount": 300.00,
            "category": "Software",
            "description": "Figma Enterprise license",
            "expense_date": "2026-11-01",
            "submitted_by": "maya",
        },
    )
    exp2_id = res_sub2.json()["expense"]["id"]

    # Approve second
    client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/expenses/{exp2_id}/decision",
        json={"decision": "approved", "decided_by": "maya"},
    )

    res_metrics = client.get(f"/api/projects/{DEMO_PROJECT_ID}/expenses/metrics")
    assert res_metrics.status_code == 200
    m = res_metrics.json()
    assert m["total_submitted"] >= 2
    assert m["approved_count"] >= 1
    assert m["pending_count"] >= 1
    assert m["total_approved_amount"] >= 300.00
    assert "Software" in m["spending_by_category"]
