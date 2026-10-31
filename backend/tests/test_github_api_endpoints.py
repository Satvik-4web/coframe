import pytest
import httpx
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

from backend.app.main import app
from backend.app.db.database import SessionLocal, Base, engine
from backend.app.db.seed import reset_demo_database, DEMO_PROJECT_ID
from backend.app.db.models import ProposalModel, GitHubConnectionModel, GitHubContributionModel
from backend.tests.test_github_integration import mock_github_handler


@pytest.fixture(scope="function")
def client():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    reset_demo_database(db, DEMO_PROJECT_ID)
    db.close()
    with TestClient(app) as test_client:
        yield test_client


def test_api_github_status_not_configured(client: TestClient):
    with patch("backend.app.github.authentication.GitHubConfig.get_token", return_value=None):
        res = client.get("/api/github/status")
        assert res.status_code == 200
        data = res.json()
        assert not data["is_configured"]
        assert data["connection_status"] == "not_configured"


def test_api_github_connect_and_overview(client: TestClient):
    mock_transport = httpx.MockTransport(mock_github_handler)
    with patch("backend.app.github.authentication.GitHubConfig.get_token", return_value="ghp_test"):
        with patch("backend.app.github.client.GitHubClient.__init__", lambda self, *args, **kwargs: setattr(self, "token", "ghp_test") or setattr(self, "base_url", "https://api.github.com") or setattr(self, "transport", mock_transport) or setattr(self, "timeout", 10.0)):
            # Connect repository
            conn_res = client.post(
                "/api/github/connect",
                json={
                    "owner": "test-owner",
                    "repository_name": "test-repo",
                    "default_branch": "main",
                },
            )
            assert conn_res.status_code == 200
            conn_data = conn_res.json()
            assert conn_data["connection_status"] == "connected"
            assert conn_data["repository_full_name"] == "test-owner/test-repo"

            # Get repo details
            repo_res = client.get("/api/github/repository")
            assert repo_res.status_code == 200
            assert repo_res.json()["name"] == "test-repo"

            # Get branches
            branch_res = client.get("/api/github/branches")
            assert branch_res.status_code == 200
            branches = branch_res.json()
            assert len(branches) >= 2

            # Get commits
            commits_res = client.get("/api/github/commits")
            assert commits_res.status_code == 200
            commits = commits_res.json()
            assert len(commits) >= 1
            assert commits[0]["is_coframe_commit"]


def test_api_publish_and_contributions(client: TestClient):
    mock_transport = httpx.MockTransport(mock_github_handler)
    db = SessionLocal()
    # Seed connection and approved proposal
    conn = GitHubConnectionModel(
        project_id=DEMO_PROJECT_ID,
        owner="test-owner",
        repository_name="test-repo",
        repository_full_name="test-owner/test-repo",
        repository_url="https://github.com/test-owner/test-repo",
        default_branch="main",
        connection_status="connected",
    )
    db.add(conn)

    prop = ProposalModel(
        id="prop_api_001",
        project_id=DEMO_PROJECT_ID,
        agent_id="pixel",
        run_id="run_1",
        summary="API level proposal publish",
        reasoning="Testing API publish endpoint",
        affected_requirements=["REQ_METRICS"],
        target_sections=["dashboard"],
        changes={"operations": []},
        base_context_version=1,
        base_artifact_version=1,
        base_section_versions={"dashboard": 1},
        status="approved",
    )
    db.add(prop)
    db.commit()
    db.close()

    with patch("backend.app.github.authentication.GitHubConfig.get_token", return_value="ghp_test"):
        with patch("backend.app.github.client.GitHubClient.__init__", lambda self, *args, **kwargs: setattr(self, "token", "ghp_test") or setattr(self, "base_url", "https://api.github.com") or setattr(self, "transport", mock_transport) or setattr(self, "timeout", 10.0)):
            # Publish proposal
            pub_res = client.post("/api/github/proposals/prop_api_001/publish?decided_by=alex")
            assert pub_res.status_code == 200
            pub_data = pub_res.json()
            assert pub_data["status"] == "success"
            assert pub_data["pr_number"] == 42

            # List contributions
            contrib_res = client.get("/api/github/contributions")
            assert contrib_res.status_code == 200
            contribs = contrib_res.json()
            assert len(contribs) == 1
            assert contribs[0]["proposal_id"] == "prop_api_001"
            assert contribs[0]["pr_number"] == 42

            # List pull requests
            prs_res = client.get("/api/github/pull-requests")
            assert prs_res.status_code == 200
            prs = prs_res.json()
            assert len(prs) >= 0
