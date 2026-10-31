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


def test_get_workspace_resources_aggregated(client):
    res = client.get("/api/projects/demo-ledgerflow/resources")
    assert res.status_code == 200
    data = res.json()
    assert "resources" in data
    resources = data["resources"]
    assert isinstance(resources, list)
    assert len(resources) > 0

    # Must contain prototype sections
    types = {r["resource_type"] for r in resources}
    assert "prototype" in types
    assert "requirement" in types

    # Inspect a prototype resource
    hero_res = next((r for r in resources if "hero" in r["title"].lower()), None)
    assert hero_res is not None
    assert "headline" in hero_res["data"]


def test_create_custom_shared_resource(client):
    create_res = client.post(
        "/api/projects/demo-ledgerflow/resources",
        json={
            "resource_type": "file",
            "title": "Design Tokens 2026",
            "description": "Shared color palette and typography spec",
            "data": {
                "palette": {
                    "primary": "#0D9488",
                    "background": "#F6F8FB",
                },
            },
            "creator_id": "maya",
            "creator_type": "human",
        },
    )
    assert create_res.status_code == 200
    data = create_res.json()
    assert data["status"] == "success"
    created = data["resource"]
    assert created["title"] == "Design Tokens 2026"
    assert created["resource_type"] == "file"

    # Verify query filtered by type
    filter_res = client.get("/api/projects/demo-ledgerflow/resources?resource_type=file")
    assert filter_res.status_code == 200
    file_resources = filter_res.json()["resources"]
    assert any(r["id"] == created["resource_id"] or r.get("resource_id") == created["resource_id"] for r in file_resources)
