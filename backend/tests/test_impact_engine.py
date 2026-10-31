import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.app.db.database import Base
from backend.app.db.models import (
    ProjectModel,
    RequirementModel,
    ArtifactSectionModel,
    ProposalModel,
    AgentRunModel,
)
from backend.app.impact.impact_engine import (
    calculate_requirement_impact,
    revalidate_proposal_at_apply,
    ProposalImpactClassification,
    REQUIREMENT_DEPENDENCIES,
)


@pytest.fixture
def test_db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    # Seed minimal project
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
        title="Metrics",
        value="Monthly spend",
        version=1,
    )
    session.add_all([req1, req2])

    # Seed sections
    sec_hero = ArtifactSectionModel(
        id="s1",
        project_id="test-proj",
        section_key="hero",
        data={"headline": "Old headline"},
        version=1,
    )
    sec_dash = ArtifactSectionModel(
        id="s2",
        project_id="test-proj",
        section_key="dashboard",
        data={"metrics": []},
        version=1,
    )
    session.add_all([sec_hero, sec_dash])

    # Seed agent run
    run = AgentRunModel(
        id="run-1",
        project_id="test-proj",
        agent_id="pixel",
        status="idle",
        task_description="Build hero",
        context_pack={},
        base_context_version=1,
        base_artifact_version=1,
    )
    session.add(run)

    session.commit()
    yield session
    session.close()


def test_missing_agent_dependency_declaration_detected_by_registry(test_db):
    """
    CRITICAL: Tests that even if an agent FORGETS to declare REQ_AUDIENCE in affected_requirements,
    because it targets section 'hero', the Central Dependency Registry knows 'hero' depends on
    REQ_AUDIENCE, so when REQ_AUDIENCE changes, the engine correctly marks the proposal STALE!
    """
    # Create proposal targeting 'hero' but with empty affected_requirements!
    prop = ProposalModel(
        id="prop-undeclared",
        project_id="test-proj",
        agent_id="pixel",
        run_id="run-1",
        summary="Revise hero banner",
        reasoning="Better UI",
        affected_requirements=[],  # Agent forgot to declare REQ_AUDIENCE!
        target_sections=["hero"],
        changes={"operations": []},
        base_context_version=1,
        base_artifact_version=1,
        base_section_versions={"hero": 1},
        status="pending_review",
    )
    test_db.add(prop)
    test_db.commit()

    # Now Alex changes REQ_AUDIENCE
    result = calculate_requirement_impact(
        db=test_db,
        project_id="test-proj",
        changed_requirement_keys=["REQ_AUDIENCE"],
        old_value_summary="Small businesses",
        new_value_summary="Enterprise finance teams",
    )

    test_db.refresh(prop)
    assert prop.status == "stale"
    assert "Written for 'Small businesses'; the audience is now 'Enterprise finance teams'." in prop.stale_reason
    assert result.stale_count == 1
    assert result.unaffected_count == 0


def test_selective_staleness_preserves_unrelated_proposals(test_db):
    """
    Ensures proposals targeting unrelated sections/requirements remain UNAFFECTED and eligible.
    """
    prop_hero = ProposalModel(
        id="prop-hero",
        project_id="test-proj",
        agent_id="nova",
        run_id="run-1",
        summary="Positioning for small business",
        reasoning="Market fit",
        affected_requirements=["REQ_AUDIENCE"],
        target_sections=["hero"],
        changes={},
        base_context_version=1,
        base_artifact_version=1,
        base_section_versions={"hero": 1},
        status="pending_review",
    )
    prop_other = ProposalModel(
        id="prop-other",
        project_id="test-proj",
        agent_id="pixel",
        run_id="run-1",
        summary="General utility section",
        reasoning="Utility",
        affected_requirements=[],
        target_sections=["unrelated_section"],
        changes={},
        base_context_version=1,
        base_artifact_version=1,
        base_section_versions={"unrelated_section": 1},
        status="pending_review",
    )
    test_db.add_all([prop_hero, prop_other])
    test_db.commit()

    result = calculate_requirement_impact(
        db=test_db,
        project_id="test-proj",
        changed_requirement_keys=["REQ_AUDIENCE"],
    )

    test_db.refresh(prop_hero)
    test_db.refresh(prop_other)

    assert prop_hero.status == "stale"
    assert prop_other.status == "pending_review"  # Unaffected proposal preserved!
    assert result.stale_count == 1
    assert result.unaffected_count == 1


def test_proposal_stale_and_conflicted_coexistence(test_db):
    """
    Tests that STALE and CONFLICTED can coexist on a proposal when the requirement
    changed AND a human edited the target section.
    """
    # Maya edits the hero section to v2
    hero = test_db.query(ArtifactSectionModel).filter_by(section_key="hero").first()
    hero.version = 2
    test_db.commit()

    prop = ProposalModel(
        id="prop-both",
        project_id="test-proj",
        agent_id="pixel",
        run_id="run-1",
        summary="Old hero proposal",
        reasoning="Outdated",
        affected_requirements=["REQ_AUDIENCE"],
        target_sections=["hero"],
        changes={},
        base_context_version=1,
        base_artifact_version=1,
        base_section_versions={"hero": 1},  # Based on v1, but current is v2!
        status="pending_review",
    )
    test_db.add(prop)
    test_db.commit()

    result = calculate_requirement_impact(
        db=test_db,
        project_id="test-proj",
        changed_requirement_keys=["REQ_AUDIENCE"],
    )

    test_db.refresh(prop)
    assert prop.status == "conflict"
    assert prop.conflict_reason is not None
    assert prop.stale_reason is not None  # Both reasons captured!
    assert result.conflict_count == 1


def test_approval_time_revalidation_guard(test_db):
    """
    Tests that revalidate_proposal_at_apply catches modified section versions.
    """
    prop = ProposalModel(
        id="prop-apply",
        project_id="test-proj",
        agent_id="pixel",
        run_id="run-1",
        summary="Apply test",
        reasoning="Apply",
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

    # When section is at v1 -> safe
    err = revalidate_proposal_at_apply(test_db, "test-proj", prop)
    assert err is None

    # When section is edited to v2 -> blocked
    hero = test_db.query(ArtifactSectionModel).filter_by(section_key="hero").first()
    hero.version = 2
    test_db.commit()

    err2 = revalidate_proposal_at_apply(test_db, "test-proj", prop)
    assert err2 is not None
    assert "was modified to version 2" in err2
