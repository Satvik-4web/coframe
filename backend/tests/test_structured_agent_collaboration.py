import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.app.db.database import Base
from backend.app.db.models import ProjectModel, ArtifactSectionModel
from backend.app.agents.review import (
    validate_agent_proposal_output,
    ReviewVerdictType,
)


@pytest.fixture
def review_db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    proj = ProjectModel(id="test-rev-proj", name="Review Proj", context_version=1, artifact_version=1)
    session.add(proj)

    sec = ArtifactSectionModel(
        id="s1",
        project_id="test-rev-proj",
        section_key="hero",
        data={"headline": "Test"},
        version=1,
    )
    session.add(sec)
    session.commit()

    yield session
    session.close()


def test_valid_proposal_returns_pass(review_db):
    """Tests that a fully compliant proposal receives PASS verdict."""
    prop_dict = {
        "summary": "Valid hero update",
        "affected_requirements": [],
        "target_sections": ["hero"],
        "base_context_version": 1,
        "base_section_versions": {"hero": 1},
        "changes": {
            "operations": [
                {
                    "op": "set_hero_content",
                    "fields": {"headline": "Valid new headline"},
                }
            ]
        },
    }

    result = validate_agent_proposal_output(review_db, "test-rev-proj", prop_dict, "pixel")
    assert result.verdict == ReviewVerdictType.PASS
    assert result.can_proceed_to_human_review is True
    assert len(result.findings) == 0


def test_disallowed_operation_returns_block(review_db):
    """Tests that arbitrary or disallowed operations are BLOCKED deterministically."""
    prop_dict = {
        "summary": "Malicious or unsupported op",
        "target_sections": ["hero"],
        "changes": {
            "operations": [
                {
                    "op": "execute_arbitrary_shell_command",
                    "cmd": "rm -rf /",
                }
            ]
        },
    }

    result = validate_agent_proposal_output(review_db, "test-rev-proj", prop_dict, "pixel")
    assert result.verdict == ReviewVerdictType.BLOCK
    assert result.can_proceed_to_human_review is False
    assert any(f.code == "DISALLOWED_OPERATION" for f in result.findings)


def test_section_version_drift_returns_warning(review_db):
    """Tests that section version drift yields WARNING (does not block review)."""
    # Current hero is v1 in DB, but proposal is based on v0
    prop_dict = {
        "summary": "Stale section base",
        "target_sections": ["hero"],
        "base_section_versions": {"hero": 0},  # Drift!
        "changes": {
            "operations": [
                {
                    "op": "set_hero_content",
                    "fields": {"headline": "Headline"},
                }
            ]
        },
    }

    result = validate_agent_proposal_output(review_db, "test-rev-proj", prop_dict, "pixel")
    assert result.verdict == ReviewVerdictType.WARNING
    assert result.can_proceed_to_human_review is True
    assert any(f.code == "SECTION_VERSION_DRIFT" for f in result.findings)
