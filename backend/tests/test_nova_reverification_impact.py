import pytest
import asyncio
import uuid
import json
from unittest.mock import patch, AsyncMock
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.db.database import Base
from backend.app.db.models import (
    ProjectModel,
    RequirementModel,
    ArtifactSectionModel,
    ProposalModel,
    AgentRunModel,
    EventModel,
    utcnow_str,
)
from backend.app.impact.impact_engine import (
    calculate_requirement_impact,
    revalidate_proposal_at_apply,
    get_backend_inferred_requirements,
    get_effective_dependencies,
    ProposalImpactClassification,
)
from backend.app.agents.nova import (
    reverify_proposal_with_nova,
    reconcile_nova_proposal,
    _record_nova_review,
)
from backend.app.schemas.proposals import (
    NovaReviewStatus,
    NovaRecommendedAction,
    NovaReverificationResult,
)
from backend.app.proposals.apply import (
    apply_proposal_atomically,
    ApplyValidationError,
)
from backend.app.events.logger import log_event


@pytest.fixture
def test_db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    # Seed baseline project
    proj = ProjectModel(id="test-proj", name="Test Project", context_version=1, artifact_version=1)
    session.add(proj)

    # Seed requirements
    req1 = RequirementModel(
        id="r1",
        project_id="test-proj",
        requirement_key="REQ_AUDIENCE",
        title="Target Audience",
        value="Small businesses",
        version=1,
    )
    req2 = RequirementModel(
        id="r2",
        project_id="test-proj",
        requirement_key="REQ_METRICS",
        title="Key Metrics",
        value="Monthly spend",
        version=1,
    )
    req3 = RequirementModel(
        id="r3",
        project_id="test-proj",
        requirement_key="REQ_APPROVAL_POLICY",
        title="Approval Policy",
        value="Strict multi-tier",
        version=1,
    )
    session.add_all([req1, req2, req3])

    # Seed artifact sections
    sec_hero = ArtifactSectionModel(
        id="s1",
        project_id="test-proj",
        section_key="hero",
        data={"headline": "Old hero headline"},
        version=1,
    )
    sec_dash = ArtifactSectionModel(
        id="s2",
        project_id="test-proj",
        section_key="dashboard",
        data={"metrics": []},
        version=1,
    )
    sec_queue = ArtifactSectionModel(
        id="s3",
        project_id="test-proj",
        section_key="approval_queue",
        data={"config": {}},
        version=1,
    )
    session.add_all([sec_hero, sec_dash, sec_queue])

    # Seed agent run for PIXEL
    run_pixel = AgentRunModel(
        id="run-pixel-001",
        project_id="test-proj",
        agent_id="pixel",
        status="idle",
        task_description="Build UI components",
        context_pack={"requirements": [], "section_versions": {}},
        base_context_version=1,
        base_artifact_version=1,
    )
    session.add(run_pixel)
    session.commit()

    yield session
    session.close()


# ==============================================================================
# Case 1: PIXEL declares no dependencies, but backend inference detects changed requirement
# ==============================================================================
def test_case_1_pixel_declares_no_dependencies_backend_inference_detects(test_db):
    """
    Case 1:
    PIXEL declares no dependencies (affected_requirements=[]), but targets 'hero'.
    When REQ_AUDIENCE changes, backend inference must detect that 'hero' depends on
    REQ_AUDIENCE and mark the proposal STALE.
    """
    prop = ProposalModel(
        id="prop-case-1",
        project_id="test-proj",
        agent_id="pixel",
        created_by="pixel",
        author_type="agent",
        run_id="run-pixel-001",
        summary="Revamp hero section",
        reasoning="Modern visual styling",
        affected_requirements=[],  # Undeclared by PIXEL
        target_sections=["hero"],
        changes={"operations": [{"op": "set_hero_content", "fields": {"headline": "New"}}]},
        base_context_version=1,
        base_artifact_version=1,
        base_section_versions={"hero": 1},
        status="pending_review",
    )
    test_db.add(prop)
    test_db.commit()

    # Verify helper directly
    inferred = get_backend_inferred_requirements(prop.target_sections)
    assert "REQ_AUDIENCE" in inferred

    effective = get_effective_dependencies(prop.affected_requirements, prop.target_sections)
    assert "REQ_AUDIENCE" in effective

    # Requirement changes mid-flight
    result = calculate_requirement_impact(
        db=test_db,
        project_id="test-proj",
        changed_requirement_keys=["REQ_AUDIENCE"],
        old_value_summary="Small businesses",
        new_value_summary="Enterprise finance teams",
    )

    test_db.refresh(prop)
    assert prop.status == "stale"
    assert result.stale_count == 1
    assert "Enterprise finance teams" in (prop.stale_reason or "")


# ==============================================================================
# Case 2: PIXEL declares some dependencies but misses another relevant dependency
# ==============================================================================
def test_case_2_pixel_declares_some_dependencies_but_misses_another(test_db):
    """
    Case 2:
    PIXEL creates a proposal targeting ['dashboard', 'hero'] and declares ['REQ_METRICS'],
    but forgets to declare 'REQ_AUDIENCE'.
    When REQ_AUDIENCE changes, backend inference MUST NOT be skipped simply because
    declared dependencies is non-empty. Effective dependencies = declared UNION inferred.
    """
    prop = ProposalModel(
        id="prop-case-2",
        project_id="test-proj",
        agent_id="pixel",
        created_by="pixel",
        author_type="agent",
        run_id="run-pixel-001",
        summary="Executive dashboard and hero banner",
        reasoning="Fulfills REQ_METRICS for leadership",
        affected_requirements=["REQ_METRICS"],  # PIXEL only declared REQ_METRICS!
        target_sections=["dashboard", "hero"],  # hero depends on REQ_AUDIENCE
        changes={
            "operations": [
                {"op": "set_dashboard_metrics", "metrics": []},
                {"op": "set_hero_content", "fields": {"headline": "Overview"}},
            ]
        },
        base_context_version=1,
        base_artifact_version=1,
        base_section_versions={"dashboard": 1, "hero": 1},
        status="pending_review",
    )
    test_db.add(prop)
    test_db.commit()

    # Check effective dependencies calculation
    effective = get_effective_dependencies(prop.affected_requirements, prop.target_sections)
    assert "REQ_METRICS" in effective
    assert "REQ_AUDIENCE" in effective

    # REQ_AUDIENCE changes
    result = calculate_requirement_impact(
        db=test_db,
        project_id="test-proj",
        changed_requirement_keys=["REQ_AUDIENCE"],
        old_value_summary="Small businesses",
        new_value_summary="Enterprise finance teams",
    )

    test_db.refresh(prop)
    assert prop.status == "stale"
    assert result.stale_count == 1
    assert "Enterprise finance teams" in (prop.stale_reason or "")


# ==============================================================================
# Case 3: An unrelated proposal remains unaffected
# ==============================================================================
def test_case_3_unrelated_proposal_remains_unaffected(test_db):
    """
    Case 3:
    Proposal targeting 'approval_queue' depends on REQ_APPROVAL_POLICY.
    When REQ_AUDIENCE changes, it must remain UNAFFECTED (pending_review),
    preserving independent work for review.
    """
    prop_unrelated = ProposalModel(
        id="prop-case-3-unrelated",
        project_id="test-proj",
        agent_id="pixel",
        created_by="pixel",
        author_type="agent",
        run_id="run-pixel-001",
        summary="Approval Queue Config",
        reasoning="Policy controls",
        affected_requirements=["REQ_APPROVAL_POLICY"],
        target_sections=["approval_queue"],
        changes={"operations": [{"op": "set_approval_queue_config", "config": {}}]},
        base_context_version=1,
        base_artifact_version=1,
        base_section_versions={"approval_queue": 1},
        status="pending_review",
    )
    test_db.add(prop_unrelated)
    test_db.commit()

    result = calculate_requirement_impact(
        db=test_db,
        project_id="test-proj",
        changed_requirement_keys=["REQ_AUDIENCE"],
        old_value_summary="Small businesses",
        new_value_summary="Enterprise finance teams",
    )

    test_db.refresh(prop_unrelated)
    assert prop_unrelated.status == "pending_review"
    assert result.stale_count == 0
    assert result.unaffected_count == 1


# ==============================================================================
# Case 4: Multiple requirements change simultaneously
# ==============================================================================
def test_case_4_multiple_requirements_change_simultaneously(test_db):
    """
    Case 4:
    Multiple requirements change in a batch (e.g. ['REQ_AUDIENCE', 'REQ_METRICS']).
    Proposals depending on either or both must be marked stale, while unaffected proposals survive.
    """
    prop_hero = ProposalModel(
        id="prop-case-4-hero",
        project_id="test-proj",
        agent_id="pixel",
        run_id="run-pixel-001",
        summary="Hero Proposal",
        reasoning="Hero",
        affected_requirements=[],
        target_sections=["hero"],  # depends on REQ_AUDIENCE
        changes={},
        base_context_version=1,
        base_artifact_version=1,
        base_section_versions={"hero": 1},
        status="pending_review",
    )
    prop_metrics = ProposalModel(
        id="prop-case-4-metrics",
        project_id="test-proj",
        agent_id="pixel",
        run_id="run-pixel-001",
        summary="Metrics Proposal",
        reasoning="Metrics",
        affected_requirements=["REQ_METRICS"],
        target_sections=["dashboard"],  # depends on REQ_METRICS
        changes={},
        base_context_version=1,
        base_artifact_version=1,
        base_section_versions={"dashboard": 1},
        status="pending_review",
    )
    prop_queue = ProposalModel(
        id="prop-case-4-queue",
        project_id="test-proj",
        agent_id="pixel",
        run_id="run-pixel-001",
        summary="Approval Proposal",
        reasoning="Policy",
        affected_requirements=["REQ_APPROVAL_POLICY"],
        target_sections=["approval_queue"],
        changes={},
        base_context_version=1,
        base_artifact_version=1,
        base_section_versions={"approval_queue": 1},
        status="pending_review",
    )
    test_db.add_all([prop_hero, prop_metrics, prop_queue])
    test_db.commit()

    result = calculate_requirement_impact(
        db=test_db,
        project_id="test-proj",
        changed_requirement_keys=["REQ_AUDIENCE", "REQ_METRICS"],
    )

    test_db.refresh(prop_hero)
    test_db.refresh(prop_metrics)
    test_db.refresh(prop_queue)

    assert prop_hero.status == "stale"
    assert prop_metrics.status == "stale"
    assert prop_queue.status == "pending_review"  # Unaffected!
    assert result.stale_count == 2
    assert result.unaffected_count == 1


# ==============================================================================
# Case 5: NOVA identifies a missing dependency
# ==============================================================================
@pytest.mark.asyncio
async def test_case_5_nova_identifies_missing_dependency(test_db):
    """
    Case 5:
    NOVA independently reviews a PIXEL proposal and identifies that PIXEL missed
    REQ_AUDIENCE. Returns structured finding with review_status=AFFECTED and
    recommended_action=REGENERATE.
    """
    prop = ProposalModel(
        id="prop-case-5-nova-finds",
        project_id="test-proj",
        agent_id="pixel",
        created_by="pixel",
        author_type="agent",
        run_id="run-pixel-001",
        summary="Spend Metrics Grid",
        reasoning="Basic spend numbers",
        affected_requirements=["REQ_METRICS"],
        target_sections=["dashboard"],
        changes={"operations": [{"op": "set_dashboard_metrics", "metrics": []}]},
        base_context_version=1,
        base_artifact_version=1,
        base_section_versions={"dashboard": 1},
        status="pending_review",
    )
    test_db.add(prop)
    test_db.commit()

    simulated_nova_output = {
        "review_status": "AFFECTED",
        "missing_dependencies": ["REQ_AUDIENCE"],
        "affected_sections": ["dashboard"],
        "impact_explanation": "Dashboard KPI tiers must reflect multi-subsidiary enterprise controllers instead of single-user SMB burn rate.",
        "recommended_action": "REGENERATE",
        "confidence": 0.94,
        "reviewed_requirement_versions": {"REQ_AUDIENCE": 2, "REQ_METRICS": 1},
    }

    with patch("backend.app.agents.nova.call_llm_json", new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = (simulated_nova_output, "live_llm", False)

        review = await reverify_proposal_with_nova(
            db=test_db,
            project_id="test-proj",
            proposal_id="prop-case-5-nova-finds",
            changed_requirement_keys=["REQ_AUDIENCE"],
        )

        assert review.review_status == NovaReviewStatus.AFFECTED
        assert "REQ_AUDIENCE" in review.missing_dependencies
        assert review.recommended_action == NovaRecommendedAction.REGENERATE
        assert review.confidence == 0.94

        test_db.refresh(prop)
        assert prop.reviewed_by == "nova"
        assert prop.review_outcome == "WARNING"
        assert prop.status == "stale"
        assert "REQ_AUDIENCE" in prop.affected_requirements
        assert prop.nova_review["review_status"] == "AFFECTED"


# ==============================================================================
# Case 6: NOVA finds no additional dependency
# ==============================================================================
@pytest.mark.asyncio
async def test_case_6_nova_finds_no_additional_dependency(test_db):
    """
    Case 6:
    NOVA independently reviews a proposal and determines that the proposal has no
    missing dependencies and is unaffected. Returns review_status=NOT_AFFECTED and
    recommended_action=NO_CHANGE.
    """
    prop = ProposalModel(
        id="prop-case-6-unaffected",
        project_id="test-proj",
        agent_id="pixel",
        created_by="pixel",
        author_type="agent",
        run_id="run-pixel-001",
        summary="Pure Styling Tweak",
        reasoning="CSS color adjustment",
        affected_requirements=[],
        target_sections=["dashboard"],
        changes={"operations": [{"op": "set_dashboard_metrics", "metrics": []}]},
        base_context_version=1,
        base_artifact_version=1,
        base_section_versions={"dashboard": 1},
        status="pending_review",
    )
    test_db.add(prop)
    test_db.commit()

    simulated_nova_output = {
        "review_status": "NOT_AFFECTED",
        "missing_dependencies": [],
        "affected_sections": [],
        "impact_explanation": "Proposal contains purely stylistic changes unaffected by policy or audience shifts.",
        "recommended_action": "NO_CHANGE",
        "confidence": 0.99,
        "reviewed_requirement_versions": {"REQ_APPROVAL_POLICY": 2},
    }

    with patch("backend.app.agents.nova.call_llm_json", new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = (simulated_nova_output, "live_llm", False)

        review = await reverify_proposal_with_nova(
            db=test_db,
            project_id="test-proj",
            proposal_id="prop-case-6-unaffected",
            changed_requirement_keys=["REQ_APPROVAL_POLICY"],
        )

        assert review.review_status == NovaReviewStatus.NOT_AFFECTED
        assert review.missing_dependencies == []
        assert review.recommended_action == NovaRecommendedAction.NO_CHANGE

        test_db.refresh(prop)
        assert prop.reviewed_by == "nova"
        assert prop.review_outcome == "PASS"
        assert prop.status == "pending_review"  # Remains eligible for review!


# ==============================================================================
# Case 7: NOVA returns invalid JSON
# ==============================================================================
@pytest.mark.asyncio
async def test_case_7_nova_returns_invalid_json(test_db):
    """
    Case 7:
    NOVA returns malformed data or a schema missing required fields.
    The backend must catch the validation error and record REVIEW_FAILED.
    Never silently treat as successful.
    """
    prop = ProposalModel(
        id="prop-case-7-invalid",
        project_id="test-proj",
        agent_id="pixel",
        created_by="pixel",
        author_type="agent",
        run_id="run-pixel-001",
        summary="Malformed Output Test",
        reasoning="Test",
        affected_requirements=[],
        target_sections=["hero"],
        changes={},
        base_context_version=1,
        base_artifact_version=1,
        base_section_versions={"hero": 1},
        status="pending_review",
    )
    test_db.add(prop)
    test_db.commit()

    # Invalid structure missing required fields and with invalid review_status
    invalid_output = {
        "review_status": "TOTALLY_INVALID_STATUS",
        "not_a_valid_field": 12345,
    }

    with patch("backend.app.agents.nova.call_llm_json", new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = (invalid_output, "live_llm", False)

        review = await reverify_proposal_with_nova(
            db=test_db,
            project_id="test-proj",
            proposal_id="prop-case-7-invalid",
            changed_requirement_keys=["REQ_AUDIENCE"],
        )

        assert review.review_status == NovaReviewStatus.REVIEW_FAILED
        assert review.recommended_action == NovaRecommendedAction.REVIEW_MANUALLY
        assert "failed validation" in review.impact_explanation.lower() or "invalid" in review.impact_explanation.lower()

        test_db.refresh(prop)
        assert prop.reviewed_by == "nova"
        assert prop.review_outcome == "BLOCK"
        assert prop.nova_review["review_status"] == "REVIEW_FAILED"


# ==============================================================================
# Case 8: NOVA times out or fails
# ==============================================================================
@pytest.mark.asyncio
async def test_case_8_nova_times_out_or_fails(test_db):
    """
    Case 8:
    NOVA call raises a TimeoutError or network exception.
    The backend must catch the failure gracefully and record REVIEW_FAILED.
    Never silently treat as successful.
    """
    prop = ProposalModel(
        id="prop-case-8-timeout",
        project_id="test-proj",
        agent_id="pixel",
        created_by="pixel",
        author_type="agent",
        run_id="run-pixel-001",
        summary="Timeout Test Proposal",
        reasoning="Test",
        affected_requirements=[],
        target_sections=["hero"],
        changes={},
        base_context_version=1,
        base_artifact_version=1,
        base_section_versions={"hero": 1},
        status="pending_review",
    )
    test_db.add(prop)
    test_db.commit()

    with patch("backend.app.agents.nova.call_llm_json", new_callable=AsyncMock) as mock_llm:
        mock_llm.side_effect = asyncio.TimeoutError("LLM call timed out after 8.0s")

        review = await reverify_proposal_with_nova(
            db=test_db,
            project_id="test-proj",
            proposal_id="prop-case-8-timeout",
            changed_requirement_keys=["REQ_AUDIENCE"],
        )

        assert review.review_status == NovaReviewStatus.REVIEW_FAILED
        assert review.recommended_action == NovaRecommendedAction.REVIEW_MANUALLY
        assert "timed out" in review.impact_explanation.lower()

        test_db.refresh(prop)
        assert prop.reviewed_by == "nova"
        assert prop.review_outcome == "BLOCK"
        assert prop.nova_review["review_status"] == "REVIEW_FAILED"


# ==============================================================================
# Case 9: A stale proposal cannot be approved or applied
# ==============================================================================
def test_case_9_stale_proposal_cannot_be_approved_or_applied(test_db):
    """
    Case 9:
    Deterministic backend enforcement:
    1. revalidate_proposal_at_apply blocks stale proposals.
    2. apply_proposal_atomically rejects stale proposals and rolls back all writes.
    3. Approval-time validation recalculates effective dependencies to catch undeclared changed requirements.
    """
    # Create proposal targeting hero
    prop = ProposalModel(
        id="prop-case-9-stale",
        project_id="test-proj",
        agent_id="pixel",
        created_by="pixel",
        author_type="agent",
        run_id="run-pixel-001",
        summary="Hero Apply Test",
        reasoning="Apply",
        affected_requirements=[],  # Undeclared, but targets hero -> REQ_AUDIENCE
        target_sections=["hero"],
        changes={"operations": [{"op": "set_hero_content", "fields": {"headline": "H"}}]},
        base_context_version=1,
        base_artifact_version=1,
        base_section_versions={"hero": 1},
        status="pending_review",
    )
    test_db.add(prop)
    test_db.commit()

    # Step 1: Pre-apply guard should pass while context is at v1
    assert revalidate_proposal_at_apply(test_db, "test-proj", prop) is None

    # Step 2: Now update REQ_AUDIENCE and increment project context_version to 2
    proj = test_db.query(ProjectModel).filter_by(id="test-proj").first()
    proj.context_version = 2
    req_aud = test_db.query(RequirementModel).filter_by(requirement_key="REQ_AUDIENCE").first()
    req_aud.version = 2
    test_db.commit()

    # Approval-time revalidation guard recalculates effective dependencies:
    # Even though affected_requirements was empty, effective dependencies includes REQ_AUDIENCE!
    err = revalidate_proposal_at_apply(test_db, "test-proj", prop)
    assert err is not None
    assert "REQ_AUDIENCE" in err
    assert "was updated to version 2" in err

    # Step 3: Atomic apply must fail and roll back transaction
    # Log requirement edit event at context_version 2
    ev = EventModel(
        sequence_no=1,
        project_id="test-proj",
        actor_type="human",
        actor_id="alex",
        event_type="HUMAN_REQUIREMENT_EDITED",
        context_version=2,
        artifact_version=1,
        payload={"requirement_key": "REQ_AUDIENCE"},
    )
    test_db.add(ev)
    test_db.commit()

    with pytest.raises(ApplyValidationError) as exc_info:
        apply_proposal_atomically(
            db=test_db,
            project_id="test-proj",
            proposal_id="prop-case-9-stale",
            decided_by="alex",
        )

    assert exc_info.value.is_stale is True
    assert "Proposal is STALE" in exc_info.value.message

    test_db.refresh(prop)
    assert prop.status == "stale"


# ==============================================================================
# Case 10: NOVA reconciliation creates revised proposal while preserving history
# ==============================================================================
@pytest.mark.asyncio
async def test_case_10_nova_reconciliation_creates_revised_proposal_preserving_history(test_db):
    """
    Case 10:
    NOVA reconciliation:
    1. Loads the original stale proposal and its NOVA review findings.
    2. Builds a fresh Context Pack.
    3. Reconciles into a new proposal linked via supersedes_proposal_id.
    4. Marks the original proposal as 'superseded', preserving its full history.
    5. The revised proposal requires human approval and is in 'pending_review' state.
    """
    orig_prop = ProposalModel(
        id="prop-case-10-orig",
        project_id="test-proj",
        agent_id="pixel",
        created_by="pixel",
        author_type="agent",
        run_id="run-pixel-001",
        summary="Original PIXEL Hero",
        reasoning="Small business hero banner",
        affected_requirements=["REQ_AUDIENCE"],
        target_sections=["hero"],
        changes={"operations": [{"op": "set_hero_content", "fields": {"headline": "SMB"}}]},
        base_context_version=1,
        base_artifact_version=1,
        base_section_versions={"hero": 1},
        status="stale",
        stale_reason="Audience shifted to enterprise finance teams",
        nova_review={
            "review_status": "AFFECTED",
            "missing_dependencies": ["REQ_AUDIENCE"],
            "impact_explanation": "Needs enterprise compliance framing",
            "recommended_action": "REGENERATE",
        },
    )
    test_db.add(orig_prop)
    test_db.commit()

    # Reconcile proposal
    new_prop = await reconcile_nova_proposal(
        db=test_db,
        project_id="test-proj",
        original_proposal_id="prop-case-10-orig",
        requested_by="maya",
    )

    # 1. New proposal links to original
    assert new_prop.supersedes_proposal_id == "prop-case-10-orig"
    # 2. New proposal is pending review (NEVER automatically approved)
    assert new_prop.status == "pending_review"
    # 3. Original proposal preserved in DB with 'superseded' status
    test_db.refresh(orig_prop)
    assert orig_prop.status == "superseded"
    assert orig_prop.id == "prop-case-10-orig"
    assert orig_prop.summary == "Original PIXEL Hero"


# ==============================================================================
# Case 11: Regression - Proposal with REVIEW_FAILED cannot be approved or applied
# ==============================================================================
@pytest.mark.asyncio
async def test_case_11_nova_review_failed_cannot_be_approved_or_applied(test_db):
    """
    Case 11:
    A proposal with NOVA review status REVIEW_FAILED must never be approved or applied.
    1. _record_nova_review marks proposal status as stale and review_outcome as BLOCK.
    2. Attempting to apply the proposal via apply_proposal_atomically fails.
    3. Even if status was somehow pending_review, apply_proposal_atomically explicitly rejects it.
    """
    prop = ProposalModel(
        id="prop-case-11-failed",
        project_id="test-proj",
        agent_id="pixel",
        created_by="pixel",
        author_type="agent",
        run_id="run-pixel-001",
        summary="Failed Review Proposal",
        reasoning="Test",
        affected_requirements=[],
        target_sections=["hero"],
        changes={"operations": [{"op": "set_hero_content", "fields": {"headline": "Test"}}]},
        base_context_version=1,
        base_artifact_version=1,
        base_section_versions={"hero": 1},
        status="pending_review",
    )
    test_db.add(prop)
    test_db.commit()

    failed_result = NovaReverificationResult(
        review_status=NovaReviewStatus.REVIEW_FAILED,
        missing_dependencies=[],
        affected_sections=["hero"],
        impact_explanation="LLM execution timed out after 8s",
        recommended_action=NovaRecommendedAction.REVIEW_MANUALLY,
        confidence=0.0,
        reviewed_requirement_versions={},
    )
    _record_nova_review(test_db, "test-proj", prop, failed_result)

    test_db.refresh(prop)
    assert prop.status == "stale"
    assert prop.review_outcome == "BLOCK"
    assert "LLM execution timed out" in prop.stale_reason

    # Attempt to apply fails because proposal is stale
    with pytest.raises(ApplyValidationError) as exc_info:
        apply_proposal_atomically(
            db=test_db,
            project_id="test-proj",
            proposal_id="prop-case-11-failed",
            decided_by="alex",
        )
    assert exc_info.value.is_stale

    # Even if status were manually reset to pending_review, apply_proposal_atomically rejects REVIEW_FAILED
    prop.status = "pending_review"
    test_db.commit()

    with pytest.raises(ApplyValidationError) as exc_info_2:
        apply_proposal_atomically(
            db=test_db,
            project_id="test-proj",
            proposal_id="prop-case-11-failed",
            decided_by="alex",
        )
    assert "Independent NOVA review failed" in exc_info_2.value.message


# ==============================================================================
# Case 12: Regression - Proposal with UNCERTAIN review requires manual review
# ==============================================================================
@pytest.mark.asyncio
async def test_case_12_nova_review_uncertain_requires_manual_review_and_permission_checks(test_db):
    """
    Case 12:
    A proposal with NOVA review status UNCERTAIN:
    1. _record_nova_review marks requires_decision=True, assigned_decider_id='alex'.
    2. Attempting standard approval without manual_review confirmation fails.
    3. Attempting approval by unauthorized contributor (maya) fails permission check.
    4. Legitimate manual review approval by alex succeeds when no version conflicts exist.
    """
    prop = ProposalModel(
        id="prop-case-12-uncertain",
        project_id="test-proj",
        agent_id="pixel",
        created_by="pixel",
        author_type="agent",
        run_id="run-pixel-001",
        summary="Uncertain Proposal",
        reasoning="Test",
        affected_requirements=[],
        target_sections=["hero"],
        changes={"operations": [{"op": "set_hero_content", "fields": {"headline": "Uncertain Headline"}}]},
        base_context_version=1,
        base_artifact_version=1,
        base_section_versions={"hero": 1},
        status="pending_review",
    )
    test_db.add(prop)
    test_db.commit()

    uncertain_result = NovaReverificationResult(
        review_status=NovaReviewStatus.UNCERTAIN,
        missing_dependencies=[],
        affected_sections=["hero"],
        impact_explanation="Ambiguous policy impact requires executive confirmation",
        recommended_action=NovaRecommendedAction.REVIEW_MANUALLY,
        confidence=0.5,
        reviewed_requirement_versions={},
    )
    _record_nova_review(test_db, "test-proj", prop, uncertain_result)

    test_db.refresh(prop)
    assert prop.requires_decision is True
    assert prop.assigned_decider_id == "alex"
    assert prop.review_outcome == "WARNING"

    # Attempt standard approval without manual_review=True fails
    with pytest.raises(ApplyValidationError) as exc_info_1:
        apply_proposal_atomically(
            db=test_db,
            project_id="test-proj",
            proposal_id="prop-case-12-uncertain",
            decided_by="alex",
            manual_review=False,
        )
    assert "UNCERTAIN" in exc_info_1.value.message
    assert "Manual review is required" in exc_info_1.value.message

    # Attempt approval by Maya (even with manual_review=True) fails permission check
    with pytest.raises(ApplyValidationError) as exc_info_2:
        apply_proposal_atomically(
            db=test_db,
            project_id="test-proj",
            proposal_id="prop-case-12-uncertain",
            decided_by="maya",
            manual_review=True,
        )
    assert exc_info_2.value.is_forbidden
    assert "ALEX" in exc_info_2.value.message

    # Valid manual review approval by Alex succeeds
    approved_prop = apply_proposal_atomically(
        db=test_db,
        project_id="test-proj",
        proposal_id="prop-case-12-uncertain",
        decided_by="alex",
        manual_review=True,
    )
    assert approved_prop.status == "approved"


# ==============================================================================
# Case 13: Regression - NOT_AFFECTED cannot override deterministic staleness
# ==============================================================================
@pytest.mark.asyncio
async def test_case_13_nova_not_affected_does_not_override_deterministic_staleness(test_db):
    """
    Case 13:
    Even if NOVA returns review_status=NOT_AFFECTED, it cannot override deterministic
    backend version and requirement changes.
    """
    prop = ProposalModel(
        id="prop-case-13-override-attempt",
        project_id="test-proj",
        agent_id="pixel",
        created_by="pixel",
        author_type="agent",
        run_id="run-pixel-001",
        summary="Dashboard Metrics",
        reasoning="Test",
        affected_requirements=["REQ_METRICS"],
        target_sections=["dashboard"],
        changes={"operations": [{"op": "set_dashboard_metrics", "metrics": []}]},
        base_context_version=1,
        base_artifact_version=1,
        base_section_versions={"dashboard": 1},
        status="pending_review",
    )
    test_db.add(prop)
    test_db.commit()

    # Record NOT_AFFECTED from NOVA
    not_affected_result = NovaReverificationResult(
        review_status=NovaReviewStatus.NOT_AFFECTED,
        missing_dependencies=[],
        affected_sections=[],
        impact_explanation="Proposal seems fine to LLM",
        recommended_action=NovaRecommendedAction.NO_CHANGE,
        confidence=0.99,
        reviewed_requirement_versions={},
    )
    _record_nova_review(test_db, "test-proj", prop, not_affected_result)

    # But project context evolved deterministically in backend!
    proj = test_db.query(ProjectModel).filter(ProjectModel.id == "test-proj").first()
    proj.context_version = 2
    test_db.commit()

    log_event(
        db=test_db,
        project_id="test-proj",
        actor_type="human",
        actor_id="alex",
        event_type="HUMAN_REQUIREMENT_EDITED",
        context_version=2,
        artifact_version=1,
        payload={"requirement_key": "REQ_METRICS", "new_value": "Real-time KPIs"},
        auto_commit=True,
    )

    # Apply attempt MUST fail because REQ_METRICS changed deterministically
    with pytest.raises(ApplyValidationError) as exc_info:
        apply_proposal_atomically(
            db=test_db,
            project_id="test-proj",
            proposal_id="prop-case-13-override-attempt",
            decided_by="alex",
        )
    assert exc_info.value.is_stale
    assert "Proposal is STALE" in exc_info.value.message


# ==============================================================================
# Case 14: Regression - String-based event payload deserialization during apply
# ==============================================================================
@pytest.mark.asyncio
async def test_case_14_string_based_event_payload_staleness_check(test_db):
    """
    Case 14:
    Confirms that apply_proposal_atomically safely handles event payloads stored
    as serialized JSON strings (e.g. from specific database drivers or raw writes).
    Uses json.loads to parse requirement_key and correctly detect staleness.
    """
    prop = ProposalModel(
        id="prop-case-14-json-str",
        project_id="test-proj",
        agent_id="pixel",
        created_by="pixel",
        author_type="agent",
        run_id="run-pixel-001",
        summary="String Payload Proposal",
        reasoning="Test",
        affected_requirements=["REQ_AUDIENCE"],
        target_sections=["hero"],
        changes={"operations": [{"op": "set_hero_content", "fields": {"headline": "H"}}]},
        base_context_version=1,
        base_artifact_version=1,
        base_section_versions={"hero": 1},
        status="pending_review",
    )
    test_db.add(prop)
    test_db.commit()

    proj = test_db.query(ProjectModel).filter(ProjectModel.id == "test-proj").first()
    proj.context_version = 2
    test_db.commit()

    # Create event with payload explicitly stored as JSON string
    raw_payload_str = json.dumps({"requirement_key": "REQ_AUDIENCE", "new_value": "Enterprise"})
    ev = EventModel(
        id=f"ev_str_{uuid.uuid4().hex[:6]}",
        sequence_no=500,
        project_id="test-proj",
        actor_type="human",
        actor_id="alex",
        event_type="HUMAN_REQUIREMENT_EDITED",
        context_version=2,
        artifact_version=1,
        payload=raw_payload_str,  # raw JSON string
        created_at=utcnow_str(),
    )
    test_db.add(ev)
    test_db.commit()

    # Apply attempt should safely parse the string payload and detect staleness
    with pytest.raises(ApplyValidationError) as exc_info:
        apply_proposal_atomically(
            db=test_db,
            project_id="test-proj",
            proposal_id="prop-case-14-json-str",
            decided_by="alex",
        )

    assert exc_info.value.is_stale
    assert "REQ_AUDIENCE" in exc_info.value.message


