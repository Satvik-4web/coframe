import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.db.database import get_db, SessionLocal
from backend.app.db.seed import reset_demo_database, DEMO_PROJECT_ID

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_baseline():
    db = SessionLocal()
    reset_demo_database(db, DEMO_PROJECT_ID)
    db.close()
    yield


def test_clean_baseline_state_reporting():
    """Verify that a clean reset reports zero proposals and Clean Baseline scenario."""
    res = client.get(f"/api/projects/{DEMO_PROJECT_ID}/state")
    assert res.status_code == 200
    data = res.json()
    assert data["is_clean_baseline"] is True
    assert data["scenario_label"] == "Clean Baseline"
    assert len(data["proposals"]) == 0
    assert "baseline" in data["observer_summary"]["what_changed"].lower()


def test_load_scenario_state_reporting():
    """Verify that loaded scenario establishes pre-seeded proposals and updates label."""
    load_res = client.post("/api/demo/load-scenario")
    assert load_res.status_code == 200
    assert load_res.json()["is_clean_baseline"] is False

    res = client.get(f"/api/projects/{DEMO_PROJECT_ID}/state")
    assert res.status_code == 200
    data = res.json()
    assert data["is_clean_baseline"] is False
    assert data["scenario_label"] == "Loaded Demo Scenario"
    assert len(data["proposals"]) == 3
    assert len(data["observer_summary"]["what_changed"]) > 0


def test_staged_prd_workflow_end_to_end():
    """
    Tests the complete staged product-development workflow:
    1. Alex submits product idea to NOVA.
    2. NOVA generates structured PRD with acceptance criteria & clarifying questions.
    3. Alex reviews and updates requirements.
    4. Alex confirms PRD.
    5. Context version increments.
    6. PIXEL creates implementation plan and prototype proposal.
    7. Multi-layer NOVA review verifies alignment.
    """
    # 1. Alex submits product idea
    prompt_payload = {
        "prompt": "We need enterprise multi-level expense approvals with a $500 threshold requiring Alex sign-off.",
        "constraints": "Strict role validation for all actions.",
        "submitter_id": "alex",
    }
    analyse_res = client.post(f"/api/projects/{DEMO_PROJECT_ID}/prd/analyse", json=prompt_payload)
    assert analyse_res.status_code == 200
    prd_data = analyse_res.json()["prd"]
    prd_id = prd_data["id"]

    assert prd_data["status"] == "awaiting_confirmation"
    assert len(prd_data["functional_requirements"]) >= 2
    assert len(prd_data["acceptance_criteria"]) >= 1
    assert len(prd_data["missing_information"]) >= 1
    assert "Enterprise" in prd_data["title"]

    # 2. Verify stage is Requirements Review
    stage_res = client.get(f"/api/projects/{DEMO_PROJECT_ID}/prd/workflow/stage")
    assert stage_res.status_code == 200
    assert stage_res.json()["stage"]["current_stage"] == "requirements_review"

    # 3. Alex updates PRD
    update_payload = {
        "title": "Enterprise Spend Governance & Threshold Policy",
        "target_audience": "Global Enterprise Finance Teams",
    }
    put_res = client.put(f"/api/projects/{DEMO_PROJECT_ID}/prd/{prd_id}", json=update_payload)
    assert put_res.status_code == 200

    # 4. Alex confirms PRD
    confirm_payload = {
        "confirmed_by": "alex",
        "note": "Alex confirmed requirements for enterprise tiered thresholds.",
    }
    confirm_res = client.post(f"/api/projects/{DEMO_PROJECT_ID}/prd/{prd_id}/confirm", json=confirm_payload)
    assert confirm_res.status_code == 200
    confirm_data = confirm_res.json()

    assert confirm_data["status"] == "success"
    assert confirm_data["context_version"] >= 2
    assert confirm_data["implementation_plan"]["title"] is not None
    assert len(confirm_data["implementation_plan"]["tasks"]) >= 2
    assert confirm_data["proposal"]["requires_decision"] is True
    assert confirm_data["proposal"]["assigned_decider_id"] == "alex"
    assert confirm_data["proposal"]["review_verdict"]["status"] == "PASS"

    # 5. Fetch latest PIXEL plan
    plan_res = client.get(f"/api/projects/{DEMO_PROJECT_ID}/prd/plan/latest")
    assert plan_res.status_code == 200
    assert plan_res.json()["plan"]["agent_id"] == "pixel"
    assert "approval_queue" in plan_res.json()["plan"]["target_sections"]

    # 6. Verify stage is now Human Approval
    stage_res_after = client.get(f"/api/projects/{DEMO_PROJECT_ID}/prd/workflow/stage")
    assert stage_res_after.status_code == 200
    assert stage_res_after.json()["stage"]["current_stage"] == "human_approval"
