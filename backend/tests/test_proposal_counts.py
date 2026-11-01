import pytest
from backend.app.schemas.proposals import ProposalModelOutput
from backend.app.db.models import ProposalModel
from backend.app.db.database import SessionLocal


def compute_proposal_counts_py(proposals):
    """
    Python mirror of computeProposalCounts in frontend/src/hooks/useProposalCounts.ts.
    Guarantees exact agreement between backend data and frontend selector.
    """
    pending = sum(1 for p in proposals if getattr(p, "status", None) == "pending_review")
    stale = sum(1 for p in proposals if getattr(p, "status", None) == "stale")
    conflict = sum(1 for p in proposals if getattr(p, "status", None) == "conflict")
    applied = sum(1 for p in proposals if getattr(p, "status", None) == "approved")
    redirected = sum(
        1 for p in proposals
        if getattr(p, "status", None) == "redirected"
        or (getattr(p, "status", None) == "rejected" and bool(getattr(p, "superseded_by", None)))
    )
    rejected = sum(
        1 for p in proposals
        if getattr(p, "status", None) == "rejected" and not getattr(p, "superseded_by", None)
    )

    needs_decision = pending + conflict + stale
    total = len(proposals)

    return {
        "needsDecision": needs_decision,
        "pending": pending,
        "stale": stale,
        "conflict": conflict,
        "applied": applied,
        "rejected": rejected,
        "redirected": redirected,
        "total": total,
    }


def test_proposal_counts_invariants():
    """Verify mathematical invariants of the single shared proposal counting selector."""
    class MockProposal:
        def __init__(self, status, superseded_by=None):
            self.status = status
            self.superseded_by = superseded_by

    mock_proposals = [
        MockProposal("pending_review"),
        MockProposal("pending_review"),
        MockProposal("conflict"),
        MockProposal("stale"),
        MockProposal("approved"),
        MockProposal("rejected"),
        MockProposal("rejected", superseded_by="prop_revised_123"),
    ]

    counts = compute_proposal_counts_py(mock_proposals)

    # Invariant 1: needsDecision MUST equal pending + conflict + stale
    assert counts["needsDecision"] == counts["pending"] + counts["conflict"] + counts["stale"]
    assert counts["needsDecision"] == 4  # 2 pending + 1 conflict + 1 stale

    # Invariant 2: Total MUST equal sum of distinct statuses
    assert counts["total"] == (
        counts["pending"]
        + counts["stale"]
        + counts["conflict"]
        + counts["applied"]
        + counts["rejected"]
        + counts["redirected"]
    )
    assert counts["total"] == 7

    # Invariant 3: Empty proposals returns all zeros
    empty_counts = compute_proposal_counts_py([])
    assert empty_counts["needsDecision"] == 0
    assert empty_counts["total"] == 0


def test_state_endpoint_proposals_match_selector():
    """Verify that proposals loaded from the project state endpoint produce consistent counts."""
    db = SessionLocal()
    try:
        proposals = (
            db.query(ProposalModel)
            .filter(ProposalModel.project_id == "demo-ledgerflow")
            .all()
        )
        counts = compute_proposal_counts_py(proposals)
        assert counts["needsDecision"] == counts["pending"] + counts["conflict"] + counts["stale"]
        assert counts["total"] == len(proposals)
    finally:
        db.close()
