"""Direct route tests for PRD generation without a network-bound TestClient."""

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.api.routes import prd as prd_routes
from backend.app.db.database import Base
from backend.app.db.seed import DEMO_PROJECT_ID, reset_demo_database
from backend.app.db.models import ArtifactSectionModel
from backend.app.api.routes.expenses import get_approval_threshold, SubmitExpenseRequest
from pydantic import ValidationError


def run_without_io(coroutine):
    """Run direct route logic whose external awaits are mocked to complete immediately."""
    try:
        coroutine.send(None)
    except StopIteration as result:
        return result.value
    raise AssertionError("Unexpected network or event-loop operation in direct route test")


@pytest.fixture
def db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    reset_demo_database(session, DEMO_PROJECT_ID)
    yield session
    session.close()
    engine.dispose()


def test_expense_policy_uses_configured_limit_and_rejects_unsupported_currency(db):
    assert get_approval_threshold(db, DEMO_PROJECT_ID) == 500
    queue = db.query(ArtifactSectionModel).filter_by(
        project_id=DEMO_PROJECT_ID, section_key="approval_queue"
    ).one()
    queue.data = {"threshold": "$1,250.00"}
    db.flush()
    assert get_approval_threshold(db, DEMO_PROJECT_ID) == 1250
    with pytest.raises(ValidationError):
        SubmitExpenseRequest(
            amount=100, currency="EUR", category="Meals", description="Client dinner",
            expense_date="2026-11-26",
        )


def test_prd_uses_request_specific_live_output_and_blocks_maya(db, monkeypatch):
    async def fake_model(**kwargs):
        assert "receipt reconciliation" in kwargs["user_prompt"]
        return ({
            "title": "Receipt reconciliation",
            "objective": "Match expenses against receipts",
            "target_audience": "Finance operators",
            "problem_statement": "Missing receipts delay close",
            "product_direction": "Flag unmatched expenses",
            "functional_requirements": [{"title": "Match receipts", "description": "Identify unmatched expenses", "priority": "High"}],
            "non_functional_requirements": [],
            "assumptions": [],
            "missing_information": [],
        }, "provider", False)

    monkeypatch.setattr(prd_routes, "call_llm_json", fake_model)
    async def no_broadcast(*args, **kwargs):
        return None
    monkeypatch.setattr(prd_routes.ws_manager, "broadcast", no_broadcast)
    request = prd_routes.PRDAnalyseRequest(prompt="Build receipt reconciliation", submitter_id="alex")
    result = run_without_io(prd_routes.analyse_product_prompt(DEMO_PROJECT_ID, request, db))
    assert result["generation_mode"] == "live_model"
    assert result["prd"]["functional_requirements"][0]["title"] == "Match receipts"

    with pytest.raises(HTTPException) as exc:
        run_without_io(prd_routes.confirm_prd(
            DEMO_PROJECT_ID, result["prd"]["id"],
            prd_routes.PRDConfirmRequest(confirmed_by="maya"), db,
        ))
    assert exc.value.status_code == 403

    run_without_io(prd_routes.confirm_prd(
        DEMO_PROJECT_ID, result["prd"]["id"],
        prd_routes.PRDConfirmRequest(confirmed_by="alex"), db,
    ))
    from backend.app.db.models import ProposalModel
    proposal = db.query(ProposalModel).filter_by(project_id=DEMO_PROJECT_ID).order_by(
        ProposalModel.created_at.desc()
    ).first()
    assert proposal.target_sections == ["product_brief"]
    assert proposal.is_simulated is True


def test_prd_fallback_is_disclosed(db, monkeypatch):
    async def unavailable(**kwargs):
        raise RuntimeError("provider unavailable")

    monkeypatch.setattr(prd_routes, "call_llm_json", unavailable)
    async def no_broadcast(*args, **kwargs):
        return None
    monkeypatch.setattr(prd_routes.ws_manager, "broadcast", no_broadcast)
    result = run_without_io(prd_routes.analyse_product_prompt(
        DEMO_PROJECT_ID,
        prd_routes.PRDAnalyseRequest(prompt="Improve approval policies"), db,
    ))
    assert result["generation_mode"] == "template_fallback"
    assert "template" in result["message"].lower()
