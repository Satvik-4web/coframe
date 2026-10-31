import pytest
import json
import httpx
from unittest.mock import patch, MagicMock, AsyncMock
from sqlalchemy.orm import Session

from backend.app.db.database import SessionLocal, engine, Base
from backend.app.db.seed import reset_demo_database, DEMO_PROJECT_ID
from backend.app.db.models import (
    GitHubConnectionModel,
    GitHubContributionModel,
    GitHubSyncJobModel,
    ProposalModel,
    ProjectModel,
    ArtifactSectionModel,
    DecisionModel,
)
from backend.app.github.client import (
    GitHubClient,
    GitHubAuthError,
    GitHubNotFoundError,
    GitHubRateLimitError,
    GitHubNetworkError,
)
from backend.app.github.repository import RepositoryService
from backend.app.github.branches import BranchService, generate_branch_name, parse_coframe_branch
from backend.app.github.commits import CommitService, format_commit_message, parse_coframe_commit
from backend.app.github.pull_requests import PullRequestService, format_pr_content, parse_coframe_pr
from backend.app.github.exporter import export_approved_artifact_files
from backend.app.github.contribution_service import ContributionService
from backend.app.proposals.apply import apply_proposal_atomically, ApplyValidationError


@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    reset_demo_database(db, DEMO_PROJECT_ID)
    try:
        yield db
    finally:
        db.close()


def mock_github_handler(request: httpx.Request) -> httpx.Response:
    """Mock handler simulating GitHub REST & Git Database APIs."""
    url = str(request.url)
    method = request.method

    clean_url = url.split("?")[0]

    # 1. GET /user
    if "/user" in clean_url and method == "GET":
        return httpx.Response(200, json={"login": "test-collaborator", "id": 12345})

    # 2. GET /repos/{owner}/{repo}
    if "/repos/test-owner/test-repo" in clean_url and method == "GET" and not any(k in clean_url for k in ["/branches", "/commits", "/pulls", "/git"]):
        return httpx.Response(
            200,
            json={
                "name": "test-repo",
                "full_name": "test-owner/test-repo",
                "owner": {"login": "test-owner"},
                "default_branch": "main",
                "html_url": "https://github.com/test-owner/test-repo",
                "stargazers_count": 42,
                "forks_count": 5,
                "open_issues_count": 2,
                "private": False,
            },
        )

    # 3. GET /repos/{owner}/{repo}/branches
    if clean_url.endswith("/branches") and method == "GET":
        return httpx.Response(
            200,
            json=[
                {"name": "main", "commit": {"sha": "base-sha-1234567890"}},
                {"name": "coframe/pixel-proposal-prop_mock_001", "commit": {"sha": "sha-prop-001"}},
            ],
        )

    if "/branches/" in clean_url and method == "GET":
        branch_part = clean_url.split("/branches/")[1]
        return httpx.Response(
            200,
            json={
                "name": branch_part,
                "commit": {
                    "sha": "base-sha-1234567890",
                    "commit": {"tree": {"sha": "tree-sha-base-12345"}},
                },
            },
        )

    # 4. POST /git/refs (create branch)
    if "/git/refs" in url and method == "POST":
        return httpx.Response(201, json={"ref": "refs/heads/new-branch", "object": {"sha": "base-sha-1234567890"}})

    # 5. POST /git/blobs
    if "/git/blobs" in url and method == "POST":
        return httpx.Response(201, json={"sha": "blob-sha-abc1234"})

    # 6. POST /git/trees
    if "/git/trees" in url and method == "POST":
        return httpx.Response(201, json={"sha": "tree-sha-new-5678"})

    # 7. POST /git/commits
    if "/git/commits" in url and method == "POST":
        return httpx.Response(201, json={"sha": "commit-sha-99998888"})

    # 8. PATCH /git/refs/heads/
    if "/git/refs/heads/" in url and method == "PATCH":
        return httpx.Response(200, json={"ref": "refs/heads/branch", "object": {"sha": "commit-sha-99998888"}})

    # 9. POST /pulls & GET /pulls
    if clean_url.endswith("/pulls") and method == "GET":
        return httpx.Response(
            200,
            json=[
                {
                    "number": 42,
                    "title": "feat: Test PR",
                    "html_url": "https://github.com/test-owner/test-repo/pull/42",
                    "state": "open",
                    "user": {"login": "test-collaborator"},
                    "head": {"ref": "coframe/pixel-proposal-prop_mock_001"},
                    "base": {"ref": "main"},
                    "created_at": "2026-10-31T12:00:00Z",
                }
            ],
        )

    if "/pulls" in clean_url and method == "POST":
        return httpx.Response(
            201,
            json={
                "number": 42,
                "title": "feat: Test PR",
                "html_url": "https://github.com/test-owner/test-repo/pull/42",
                "state": "open",
                "user": {"login": "test-collaborator"},
                "head": {"ref": "coframe/pixel-proposal-prop_mock_001"},
                "base": {"ref": "main"},
                "created_at": "2026-10-31T12:00:00Z",
            },
        )

    # 10. GET /pulls/{number}
    if "/pulls/42" in url and method == "GET":
        return httpx.Response(
            200,
            json={
                "number": 42,
                "title": "feat: Test PR",
                "html_url": "https://github.com/test-owner/test-repo/pull/42",
                "state": "open",
                "merged_at": None,
                "head": {"ref": "coframe/pixel-proposal-prop_mock_001"},
                "base": {"ref": "main"},
                "created_at": "2026-10-31T12:00:00Z",
            },
        )

    # 11. GET /commits
    if "/commits" in url and method == "GET":
        return httpx.Response(
            200,
            json=[
                {
                    "sha": "commit-sha-99998888",
                    "commit": {
                        "message": "feat(coframe): Test commit\n\nProposal ID: prop_mock_001\nAgent: PIXEL\nApproved by: Alex",
                        "author": {"name": "Alex", "date": "2026-10-31T12:00:00Z"},
                    },
                    "html_url": "https://github.com/test-owner/test-repo/commit/commit-sha-99998888",
                }
            ],
        )

    return httpx.Response(404, json={"message": "Not found in mock"})


@pytest.fixture
def mock_client():
    transport = httpx.MockTransport(mock_github_handler)
    return GitHubClient(token="ghp_test_token_12345", transport=transport)


# --------------------------------------------------------------------------
# Test 1 & 2: Missing token and invalid auth handling
# --------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_missing_token_status(db_session: Session):
    with patch("backend.app.github.authentication.GitHubConfig.get_token", return_value=None):
        service = RepositoryService(db_session)
        status = await service.get_connection_status(DEMO_PROJECT_ID)
        assert not status.is_configured
        assert status.connection_status == "not_configured"


@pytest.mark.asyncio
async def test_invalid_token_error():
    def auth_fail_handler(request: httpx.Request):
        return httpx.Response(401, json={"message": "Bad credentials"})

    client = GitHubClient(token="bad_token", transport=httpx.MockTransport(auth_fail_handler))
    with pytest.raises(GitHubAuthError):
        await client.get_repository("owner", "repo")


# --------------------------------------------------------------------------
# Test 3 & 4: Repository access validation & details retrieval
# --------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_repository_connection_and_details(db_session: Session, mock_client: GitHubClient):
    with patch("backend.app.github.authentication.GitHubConfig.get_token", return_value="ghp_valid"):
        service = RepositoryService(db_session, client=mock_client)
        conn = await service.connect_repository(
            project_id=DEMO_PROJECT_ID,
            owner="test-owner",
            repository_name="test-repo",
            default_branch="main",
        )
        assert conn.connection_status == "connected"
        assert conn.repository_full_name == "test-owner/test-repo"

        details = await service.get_repository_details(DEMO_PROJECT_ID)
        assert details.name == "test-repo"
        assert details.stars_count == 42
        assert details.default_branch == "main"


# --------------------------------------------------------------------------
# Test 5 & 6: Branch listing and isolated branch creation
# --------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_branch_listing_and_creation(db_session: Session, mock_client: GitHubClient):
    with patch("backend.app.github.authentication.GitHubConfig.get_token", return_value="ghp_valid"):
        rep_service = RepositoryService(db_session, client=mock_client)
        await rep_service.connect_repository(DEMO_PROJECT_ID, "test-owner", "test-repo")

        branch_service = BranchService(db_session, client=mock_client)
        branches = await branch_service.list_branches(DEMO_PROJECT_ID)
        assert len(branches) >= 2
        main_b = next(b for b in branches if b.name == "main")
        assert main_b.is_default

        coframe_b = next(b for b in branches if b.name == "coframe/pixel-proposal-prop_mock_001")
        assert coframe_b.is_coframe_branch
        assert coframe_b.related_proposal_id == "prop_mock_001"

        new_branch = await branch_service.create_isolated_branch(
            project_id=DEMO_PROJECT_ID,
            agent_id="pixel",
            proposal_id="prop_mock_002",
        )
        assert new_branch == "coframe/pixel-proposal-prop_mock_002"


# --------------------------------------------------------------------------
# Test 7: Artifact export layout and metadata
# --------------------------------------------------------------------------
def test_artifact_export_structure(db_session: Session):
    # Create approved proposal fixture
    prop = ProposalModel(
        id="prop_export_001",
        project_id=DEMO_PROJECT_ID,
        agent_id="pixel",
        run_id="run_1",
        summary="Introduce enterprise expense policy",
        reasoning="Required by large finance teams.",
        affected_requirements=["REQ_APPROVAL_POLICY"],
        target_sections=["approval_queue"],
        changes={"operations": [{"op": "set_approval_queue_config", "config": {"threshold": 5000}}]},
        base_context_version=1,
        base_artifact_version=1,
        base_section_versions={"approval_queue": 1},
        status="approved",
    )
    db_session.add(prop)
    db_session.add(
        DecisionModel(
            proposal_id="prop_export_001",
            decision="approved",
            decided_by="alex",
            note="Approved by Alex",
        )
    )
    db_session.commit()

    files = export_approved_artifact_files(db_session, DEMO_PROJECT_ID, "prop_export_001")
    assert "coframe-artifacts/ledgerflow/manifest.json" in files
    assert "coframe-artifacts/ledgerflow/hero.json" in files
    assert "coframe-artifacts/ledgerflow/approval_queue.json" in files
    assert "coframe-artifacts/ledgerflow/proposals/prop_export_001.json" in files
    assert "coframe-artifacts/ledgerflow/CHANGELOG.md" in files

    manifest = json.loads(files["coframe-artifacts/ledgerflow/manifest.json"])
    assert manifest["proposal_id"] == "prop_export_001"
    assert manifest["agent_identity"] == "pixel"
    assert manifest["human_approver"] == "alex"


# --------------------------------------------------------------------------
# Test 8, 9 & 10: Atomic commit, Pull Request, and duplicate prevention (idempotency)
# --------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_full_publish_and_idempotency(db_session: Session, mock_client: GitHubClient):
    with patch("backend.app.github.authentication.GitHubConfig.get_token", return_value="ghp_valid"):
        rep_service = RepositoryService(db_session, client=mock_client)
        await rep_service.connect_repository(DEMO_PROJECT_ID, "test-owner", "test-repo")

        # Create approved proposal
        prop = ProposalModel(
            id="prop_publish_001",
            project_id=DEMO_PROJECT_ID,
            agent_id="pixel",
            run_id="run_1",
            summary="Enterprise dashboard upgrade",
            reasoning="For financial auditors",
            affected_requirements=["REQ_METRICS"],
            target_sections=["dashboard"],
            changes={"operations": []},
            base_context_version=1,
            base_artifact_version=1,
            base_section_versions={"dashboard": 1},
            status="approved",
        )
        db_session.add(prop)
        db_session.commit()

        service = ContributionService(db_session, client=mock_client)
        res1 = await service.publish_approved_proposal(
            project_id=DEMO_PROJECT_ID,
            proposal_id="prop_publish_001",
            decided_by="alex",
        )
        assert res1.status == "success"
        assert res1.pr_number == 42
        assert res1.commit_sha == "commit-sha-99998888"

        # Idempotency: publishing again returns existing contribution without duplicating PR
        res2 = await service.publish_approved_proposal(
            project_id=DEMO_PROJECT_ID,
            proposal_id="prop_publish_001",
            decided_by="alex",
        )
        assert res2.status == "success"
        assert res2.pr_number == 42
        assert "already published" in res2.message.lower()


# --------------------------------------------------------------------------
# Test 11 & 12: Rate limiting and network error handling
# --------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_rate_limit_and_network_error():
    def rate_limit_handler(request: httpx.Request):
        return httpx.Response(429, json={"message": "API rate limit exceeded"})

    rl_client = GitHubClient(token="token", transport=httpx.MockTransport(rate_limit_handler))
    with pytest.raises(GitHubRateLimitError):
        await rl_client.get_repository("owner", "repo")

    def timeout_handler(request: httpx.Request):
        raise httpx.ConnectTimeout("Connection timed out")

    timeout_client = GitHubClient(token="token", transport=httpx.MockTransport(timeout_handler))
    with pytest.raises(GitHubNetworkError):
        await timeout_client.get_repository("owner", "repo")


# --------------------------------------------------------------------------
# Test 13 & 14: Failed contribution retry & PR status refresh
# --------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_retry_and_pr_refresh(db_session: Session, mock_client: GitHubClient):
    with patch("backend.app.github.authentication.GitHubConfig.get_token", return_value="ghp_valid"):
        rep_service = RepositoryService(db_session, client=mock_client)
        await rep_service.connect_repository(DEMO_PROJECT_ID, "test-owner", "test-repo")

        # Create approved proposal
        prop = ProposalModel(
            id="prop_retry_001",
            project_id=DEMO_PROJECT_ID,
            agent_id="pixel",
            run_id="run_1",
            summary="Retryable dashboard upgrade",
            reasoning="For financial auditors",
            affected_requirements=["REQ_METRICS"],
            target_sections=["dashboard"],
            changes={"operations": []},
            base_context_version=1,
            base_artifact_version=1,
            base_section_versions={"dashboard": 1},
            status="approved",
        )
        db_session.add(prop)

        # Create failed contribution record
        contrib = GitHubContributionModel(
            id="contrib_fail_001",
            project_id=DEMO_PROJECT_ID,
            proposal_id="prop_retry_001",
            repository_full_name="test-owner/test-repo",
            branch_name="coframe/pixel-proposal-prop_retry_001",
            base_branch="main",
            sync_status="sync_failed",
            error_message="Network glitch",
        )
        db_session.add(contrib)
        db_session.commit()

        service = ContributionService(db_session, client=mock_client)
        retry_res = await service.retry_failed_contribution(DEMO_PROJECT_ID, "contrib_fail_001")
        assert retry_res.status == "success"
        assert retry_res.pr_number == 42

        pr_service = PullRequestService(db_session, client=mock_client)
        refresh_res = await pr_service.refresh_pull_request_status(DEMO_PROJECT_ID, 42)
        assert refresh_res.pr_number == 42
        assert refresh_res.pr_status == "open"


# --------------------------------------------------------------------------
# Test 15 & 16: Outbox sync job creation & rejected proposal rejection
# --------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_rejected_proposal_cannot_be_published(db_session: Session, mock_client: GitHubClient):
    with patch("backend.app.github.authentication.GitHubConfig.get_token", return_value="ghp_valid"):
        rep_service = RepositoryService(db_session, client=mock_client)
        await rep_service.connect_repository(DEMO_PROJECT_ID, "test-owner", "test-repo")

        prop = ProposalModel(
            id="prop_rejected_001",
            project_id=DEMO_PROJECT_ID,
            agent_id="nova",
            run_id="run_1",
            summary="Rejected strategy",
            reasoning="Not viable",
            status="rejected",
            base_context_version=1,
            base_artifact_version=1,
        )
        db_session.add(prop)
        db_session.commit()

        service = ContributionService(db_session, client=mock_client)
        with pytest.raises(ValueError, match="Only approved proposals"):
            await service.publish_approved_proposal(DEMO_PROJECT_ID, "prop_rejected_001")


# --------------------------------------------------------------------------
# Test 17 & 18: Outbox transactional creation on apply & failure isolation
# --------------------------------------------------------------------------
def test_outbox_job_created_on_apply_and_failure_isolated(db_session: Session):
    # Connect repository first
    conn = GitHubConnectionModel(
        project_id=DEMO_PROJECT_ID,
        owner="test-owner",
        repository_name="test-repo",
        repository_full_name="test-owner/test-repo",
        repository_url="https://github.com/test-owner/test-repo",
        default_branch="main",
        connection_status="connected",
    )
    db_session.add(conn)

    prop = ProposalModel(
        id="prop_apply_outbox_001",
        project_id=DEMO_PROJECT_ID,
        agent_id="pixel",
        run_id="run_1",
        summary="Metric card updates",
        reasoning="Clearer KPI visual",
        affected_requirements=["REQ_METRICS"],
        target_sections=["dashboard"],
        changes={"operations": [{"op": "set_dashboard_metrics", "metrics": [{"id": "m1", "title": "Spend", "value": "$10k"}]}]},
        base_context_version=1,
        base_artifact_version=1,
        base_section_versions={"dashboard": 1},
        status="pending_review",
    )
    db_session.add(prop)
    db_session.commit()

    # Apply proposal atomically
    with patch("backend.app.proposals.apply.enqueue_sync_job_async") as mock_enqueue:
        applied_prop = apply_proposal_atomically(
            db=db_session,
            project_id=DEMO_PROJECT_ID,
            proposal_id="prop_apply_outbox_001",
            decided_by="alex",
        )
        assert applied_prop.status == "approved"
        mock_enqueue.assert_called_once()

    # Verify sync job was created in the database
    job = (
        db_session.query(GitHubSyncJobModel)
        .filter(GitHubSyncJobModel.proposal_id == "prop_apply_outbox_001")
        .first()
    )
    assert job is not None
    assert job.status == "pending"


# --------------------------------------------------------------------------
# Test 19: Failed GitHub sync does not roll back approved COFRAME artifact
# --------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_failed_github_sync_does_not_rollback_artifact(db_session: Session):
    def failing_handler(request: httpx.Request):
        return httpx.Response(500, json={"message": "GitHub API Internal Server Error"})

    failing_client = GitHubClient(token="token", transport=httpx.MockTransport(failing_handler))

    with patch("backend.app.github.authentication.GitHubConfig.get_token", return_value="ghp_valid"):
        rep_service = RepositoryService(db_session, client=failing_client)
        conn = GitHubConnectionModel(
            project_id=DEMO_PROJECT_ID,
            owner="test-owner",
            repository_name="test-repo",
            repository_full_name="test-owner/test-repo",
            repository_url="https://github.com/test-owner/test-repo",
            default_branch="main",
            connection_status="connected",
        )
        db_session.add(conn)

        # Create approved proposal
        prop = ProposalModel(
            id="prop_fail_sync_001",
            project_id=DEMO_PROJECT_ID,
            agent_id="pixel",
            run_id="run_1",
            summary="Hero banner refine",
            reasoning="Better visual",
            affected_requirements=["REQ_BRAND"],
            target_sections=["hero"],
            changes={"operations": []},
            base_context_version=1,
            base_artifact_version=1,
            base_section_versions={"hero": 1},
            status="approved",
        )
        db_session.add(prop)
        db_session.commit()

        initial_artifact_ver = db_session.query(ProjectModel).filter(ProjectModel.id == DEMO_PROJECT_ID).first().artifact_version

        service = ContributionService(db_session, client=failing_client)
        res = await service.publish_approved_proposal(DEMO_PROJECT_ID, "prop_fail_sync_001")
        assert res.status == "failed"

        # Verify proposal remains approved and artifact version is intact!
        db_session.refresh(prop)
        assert prop.status == "approved"
        current_artifact_ver = db_session.query(ProjectModel).filter(ProjectModel.id == DEMO_PROJECT_ID).first().artifact_version
        assert current_artifact_ver == initial_artifact_ver


# --------------------------------------------------------------------------
# Test 20: WebSocket event broadcast verification
# --------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_websocket_broadcast_on_publish(db_session: Session, mock_client: GitHubClient):
    with patch("backend.app.github.authentication.GitHubConfig.get_token", return_value="ghp_valid"):
        rep_service = RepositoryService(db_session, client=mock_client)
        await rep_service.connect_repository(DEMO_PROJECT_ID, "test-owner", "test-repo")

        prop = ProposalModel(
            id="prop_ws_001",
            project_id=DEMO_PROJECT_ID,
            agent_id="nova",
            run_id="run_1",
            summary="Strategic brief refine",
            reasoning="Align with enterprise",
            affected_requirements=["REQ_AUDIENCE"],
            target_sections=["product_brief"],
            changes={"operations": []},
            base_context_version=1,
            base_artifact_version=1,
            base_section_versions={"product_brief": 1},
            status="approved",
        )
        db_session.add(prop)
        db_session.commit()

        with patch("backend.app.websocket.manager.ws_manager.broadcast", new_callable=AsyncMock) as mock_broadcast:
            service = ContributionService(db_session, client=mock_client)
            await service.publish_approved_proposal(DEMO_PROJECT_ID, "prop_ws_001")

            # Check that events were broadcasted
            broadcast_types = [call.args[1]["type"] for call in mock_broadcast.call_args_list]
            assert "GITHUB_BRANCH_CREATED" in broadcast_types
            assert "GITHUB_COMMIT_CREATED" in broadcast_types
            assert "GITHUB_PULL_REQUEST_OPENED" in broadcast_types
