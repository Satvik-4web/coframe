import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from starlette.testclient import TestClient

from backend.app.main import app
from backend.app.db.database import Base
from backend.app.db.models import (
    ProjectModel,
    RequirementModel,
    RequirementVersionModel,
    ArtifactSectionModel,
    ProposalModel,
)
from backend.app.db.seed import reset_demo_database, DEMO_PROJECT_ID
from backend.app.context.retrieval import HybridRetriever, retriever
from backend.app.context.pack_builder import build_context_pack, create_and_persist_agent_run


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()
    reset_demo_database(session, DEMO_PROJECT_ID)
    try:
        yield session
    finally:
        session.close()


def test_version_aware_retrieval(db_session):
    """
    Improvement 1: Version-Aware Retrieval
    - Retrieve the latest valid project information.
    - Track requirement and artifact versions.
    - Distinguish approved, draft, rejected and outdated information.
    - Prevent stale/outdated info from masquerading as current.
    - Preserve historical information in historical_context for comparison.
    """
    client = TestClient(app)
    client.post("/api/demo/reset")

    # Initially REQ_AUDIENCE is v1 ("Small businesses")
    pack_v1 = build_context_pack(
        db=db_session,
        project_id=DEMO_PROJECT_ID,
        agent_id="nova",
        run_id="run_v1",
        task_id="task_strat_v1",
        task_description="Formulate audience strategy",
    )
    req_aud_v1 = next(r for r in pack_v1.requirements if r.key == "REQ_AUDIENCE")
    assert req_aud_v1.version == 1
    assert req_aud_v1.value == "Small businesses"
    assert req_aud_v1.is_current is True
    assert req_aud_v1.status == "approved"

    # Simulate Alex editing REQ_AUDIENCE to v2 ("Enterprise finance teams")
    resp_update = client.patch(
        f"/api/projects/{DEMO_PROJECT_ID}/requirements/REQ_AUDIENCE",
        json={"value": "Enterprise finance teams", "editor_id": "alex"},
    )
    assert resp_update.status_code == 200
    assert resp_update.json()["version"] == 2

    # Verify history endpoint provides historical tracking
    resp_hist = client.get(f"/api/projects/{DEMO_PROJECT_ID}/requirements/REQ_AUDIENCE/history")
    assert resp_hist.status_code == 200
    history_items = resp_hist.json()
    assert len(history_items) >= 2
    assert any(h["version"] == 2 and h["status"] == "approved" for h in history_items)
    assert any(h["version"] == 1 and h["status"] == "outdated" for h in history_items)

    # Re-retrieve context pack via API
    resp_pack = client.get(f"/api/projects/{DEMO_PROJECT_ID}/agents/nova/context-pack")
    # Alternatively build pack directly with updated DB session
    from backend.app.db.database import SessionLocal
    live_db = SessionLocal()
    try:
        pack_v2 = build_context_pack(
            db=live_db,
            project_id=DEMO_PROJECT_ID,
            agent_id="nova",
            run_id="run_v2",
            task_id="task_strat_v2",
            task_description="Formulate audience strategy",
        )
        req_aud_v2 = next(r for r in pack_v2.requirements if r.key == "REQ_AUDIENCE")
        assert req_aud_v2.version == 2
        assert req_aud_v2.value == "Enterprise finance teams"
        assert req_aud_v2.is_current is True

        # Historical context preserves v1 without treating it as current
        outdated_req = next((h for h in pack_v2.historical_context if h.key == "REQ_AUDIENCE"), None)
        assert outdated_req is not None
        assert outdated_req.version == 1
        assert outdated_req.status == "outdated"
        assert outdated_req.superseded_by_version == 2
    finally:
        live_db.close()


def test_task_based_context_retrieval(db_session):
    """
    Improvement 2: Task-Based Context Retrieval
    - NOVA receives product strategy-related context (REQ_AUDIENCE, REQ_METRICS).
    - PIXEL receives approved product direction, artifact requirements and technical constraints (REQ_BRAND, REQ_APPROVAL_POLICY, REQ_ROLES).
    - Retrieve only information relevant to the current task.
    - Include necessary dependencies.
    """
    # NOVA Task
    nova_pack = build_context_pack(
        db=db_session,
        project_id=DEMO_PROJECT_ID,
        agent_id="nova",
        run_id="run_nova_test",
        task_id="task_nova_strat",
        task_description="Analyze market audience and financial metrics strategy",
        target_sections=["product_brief", "dashboard"],
        affected_requirements=["REQ_AUDIENCE", "REQ_METRICS"],
    )

    # In NOVA pack, top ranked requirements should be REQ_AUDIENCE or REQ_METRICS
    top_nova_req_keys = [r.key for r in nova_pack.requirements[:2]]
    assert "REQ_AUDIENCE" in top_nova_req_keys or "REQ_METRICS" in top_nova_req_keys

    # PIXEL Hero Task
    pixel_hero_pack = build_context_pack(
        db=db_session,
        project_id=DEMO_PROJECT_ID,
        agent_id="pixel",
        run_id="run_pixel_hero_test",
        task_id="task_pixel_hero",
        task_description="Design high conversion hero section aligning with brand messaging",
        target_sections=["hero"],
        affected_requirements=["REQ_BRAND"],
    )

    # PIXEL hero task must have REQ_BRAND as #1 requirement
    assert pixel_hero_pack.requirements[0].key == "REQ_BRAND"
    assert pixel_hero_pack.requirements[0].provenance.relevance_score > 0.65
    assert "Direct requirement dependency" in pixel_hero_pack.requirements[0].provenance.retrieval_reason

    # PIXEL Policy Task
    pixel_policy_pack = build_context_pack(
        db=db_session,
        project_id=DEMO_PROJECT_ID,
        agent_id="pixel",
        run_id="run_pixel_policy_test",
        task_id="task_pixel_policy",
        task_description="Formulate manager approval queue configuration and threshold policies",
        target_sections=["approval_queue"],
        affected_requirements=["REQ_APPROVAL_POLICY", "REQ_ROLES"],
    )
    policy_top_keys = [r.key for r in pixel_policy_pack.requirements[:2]]
    assert "REQ_APPROVAL_POLICY" in policy_top_keys
    assert "REQ_ROLES" in policy_top_keys


def test_hybrid_retrieval_keyword_semantic_metadata(db_session):
    """
    Improvement 3: Hybrid Retrieval
    - Exact keyword matching for IDs and technical terms.
    - Semantic search for meaning-based retrieval.
    - Metadata filtering for project, version, agent, and status.
    """
    # Test Exact ID match boost
    cands, hist, metrics = retriever.retrieve(
        db=db_session,
        project_id=DEMO_PROJECT_ID,
        agent_id="pixel",
        task_id="task_exact_req",
        task_description="Inspect REQ_APPROVAL_POLICY specification",
    )
    req_policy_cand = next(c for c in cands if c.key == "REQ_APPROVAL_POLICY")
    assert req_policy_cand.keyword_score >= 0.8
    assert req_policy_cand.final_score > 0.65

    # Test Semantic Match (query uses conceptual words not present in the key)
    cands_sem, _, _ = retriever.retrieve(
        db=db_session,
        project_id=DEMO_PROJECT_ID,
        agent_id="nova",
        task_id="task_concept",
        task_description="Explore enterprise market positioning and growth strategy for founders",
    )
    strat_cand = next(c for c in cands_sem if c.key == "REQ_AUDIENCE")
    assert strat_cand.semantic_score > 0.0
    assert "nova" in strat_cand.retrieval_reason.lower() or "strategy" in strat_cand.retrieval_reason.lower()


def test_context_ranking_and_deterministic_guards(db_session):
    """
    Improvement 4: Context Ranking & Relevance Scoring
    - Deterministic rules for version and approval validation.
    - Outdated or stale info cannot override approved current items.
    """
    # Create an outdated requirement version manually to test the deterministic gate
    db_session.add(
        RequirementVersionModel(
            id="test-outdated-exact-match",
            project_id=DEMO_PROJECT_ID,
            requirement_key="REQ_BRAND",
            title="Archived Brand Voice with EXACT KEYWORD MATCH",
            value="Old deprecated brand message",
            version=0,
            status="outdated",
            updated_by="alex",
        )
    )
    db_session.commit()

    primary, historical, _ = retriever.retrieve(
        db=db_session,
        project_id=DEMO_PROJECT_ID,
        agent_id="pixel",
        task_id="task_hero_guard",
        task_description="Design hero using REQ_BRAND and EXACT KEYWORD MATCH",
    )

    # Deterministic rule: The outdated item with exact keyword match MUST NOT be in primary context
    primary_ids = [c.source_id for c in primary]
    assert "test-outdated-exact-match" not in primary_ids

    # It MUST be safely routed to historical context with outdated status
    hist_ids = [c.source_id for c in historical]
    assert "test-outdated-exact-match" in hist_ids
    archived_cand = next(c for c in historical if c.source_id == "test-outdated-exact-match")
    assert archived_cand.status == "outdated"
    assert archived_cand.approval_multiplier <= 0.35


def test_provenance_and_performance_metrics(db_session):
    """
    Improvement 5: Context Provenance, Traceability & Latency/Token Metrics
    - Every retrieved item exposes source ID, source type, project ID, version,
      timestamp, approval status, retrieval reason, and relevance score.
    - Measure retrieval latency and token usage.
    """
    pack = build_context_pack(
        db=db_session,
        project_id=DEMO_PROJECT_ID,
        agent_id="pixel",
        run_id="run_prov_001",
        task_id="task_prov_001",
        task_description="Build hero section aligning with REQ_BRAND",
        target_sections=["hero"],
        affected_requirements=["REQ_BRAND"],
    )

    # Check retrieval metrics
    assert pack.retrieval_metrics is not None
    assert pack.retrieval_metrics.retrieval_latency_ms >= 0.0
    assert pack.retrieval_metrics.estimated_token_count > 0
    assert pack.retrieval_metrics.total_candidates_evaluated > 0

    # Check item provenance records
    assert len(pack.item_provenance) > 0
    for prov in pack.item_provenance:
        assert prov.source_id is not None
        assert prov.source_type in ("requirement", "artifact_section", "decision", "event", "proposal")
        assert prov.project_id == DEMO_PROJECT_ID
        assert isinstance(prov.version, int)
        assert prov.timestamp is not None
        assert prov.approval_status in ("approved", "draft", "pending_review")
        assert len(prov.retrieval_reason) > 0
        assert 0.0 <= prov.relevance_score <= 1.0
        assert "keyword_score" in prov.scoring_breakdown
        assert "semantic_score" in prov.scoring_breakdown
        assert "task_dependency_score" in prov.scoring_breakdown
        assert "freshness_score" in prov.scoring_breakdown
        assert "source_reliability" in prov.scoring_breakdown

    # Check on-demand API retrieval endpoint
    client = TestClient(app)
    resp_adhoc = client.post(
        f"/api/projects/{DEMO_PROJECT_ID}/context/retrieve",
        json={
            "agent_id": "nova",
            "task_id": "test_adhoc",
            "task_description": "Analyze market audience and revenue metrics",
            "target_sections": ["dashboard"],
            "affected_requirements": ["REQ_METRICS"],
        },
    )
    assert resp_adhoc.status_code == 200
    data = resp_adhoc.json()
    assert data["status"] == "success"
    assert data["retrieval_metrics"]["retrieval_latency_ms"] >= 0.0
    assert data["retrieval_metrics"]["estimated_token_count"] > 0
    assert len(data["requirements"]) > 0
    assert data["requirements"][0]["provenance"]["relevance_score"] > 0
