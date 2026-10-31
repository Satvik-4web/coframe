import time
import re
import math
import json
from typing import Dict, Any, List, Optional, Tuple, Set
from sqlalchemy.orm import Session

from backend.app.db.models import (
    ProjectModel,
    RequirementModel,
    RequirementVersionModel,
    ArtifactSectionModel,
    ArtifactSectionVersionModel,
    EventModel,
    ProposalModel,
    DecisionModel,
    utcnow_str,
)
from backend.app.schemas.context import (
    ContextProvenance,
    RequirementItem,
    HistoricalContextItem,
    ContextRetrievalMetrics,
)

# Strategic vs Engineering keyword clusters
STRATEGY_KEYWORDS = {
    "audience", "customer", "market", "positioning", "strategy", "metrics",
    "kpi", "spend", "overview", "brief", "problem", "value", "growth",
    "proposition", "business", "enterprise", "user"
}

ENGINEERING_KEYWORDS = {
    "hero", "component", "ui", "design", "brand", "button", "cta", "heading",
    "headline", "approval", "queue", "policy", "threshold", "roles", "manager",
    "permission", "layout", "visual", "color", "styling", "frontend"
}

# Explicit dependency mappings: section_key -> set of requirement keys
SECTION_DEPENDENCY_MAP = {
    "product_brief": {"REQ_AUDIENCE"},
    "dashboard": {"REQ_METRICS"},
    "hero": {"REQ_BRAND"},
    "approval_queue": {"REQ_APPROVAL_POLICY", "REQ_ROLES"},
}

# Agent affinity map
AGENT_AFFINITY = {
    "nova": {
        "preferred_reqs": {"REQ_AUDIENCE", "REQ_METRICS"},
        "preferred_sections": {"product_brief", "dashboard"},
        "base_weight": 1.2,
    },
    "pixel": {
        "preferred_reqs": {"REQ_BRAND", "REQ_APPROVAL_POLICY", "REQ_ROLES"},
        "preferred_sections": {"hero", "approval_queue", "dashboard"},
        "base_weight": 1.2,
    },
}

# Semantic concept clusters for deep meaning-based matching without external heavy models
SEMANTIC_CONCEPT_CLUSTERS = {
    "REQ_AUDIENCE": {"market", "positioning", "audience", "customer", "user", "segment", "demographic", "persona", "enterprise", "business", "b2b", "growth"},
    "REQ_METRICS": {"metrics", "spend", "kpi", "finance", "revenue", "cost", "tracking", "numbers", "analytics", "dashboard", "overview"},
    "REQ_BRAND": {"brand", "messaging", "voice", "tone", "identity", "copy", "hero", "look", "feel", "design", "conversion"},
    "REQ_APPROVAL_POLICY": {"approval", "policy", "threshold", "manager", "governance", "limit", "compliance", "rules", "queue"},
    "REQ_ROLES": {"roles", "permissions", "access", "rbac", "manager", "employee", "admin", "security"},
    "product_brief": {"strategy", "brief", "problem", "solution", "value", "proposition", "positioning", "audience", "market"},
    "hero": {"hero", "headline", "cta", "banner", "landing", "conversion", "button", "subheadline"},
    "dashboard": {"dashboard", "metrics", "analytics", "overview", "spend", "charts", "kpi"},
    "approval_queue": {"approval", "queue", "workflow", "policy", "manager", "review", "expenses"},
}


def _tokenize(text: str) -> List[str]:
    """Tokenize and lowercase alphanumeric terms."""
    if not text:
        return []
    return re.findall(r"\b[a-zA-Z0-9_-]+\b", text.lower())


def _cosine_similarity(vec1: Dict[str, float], vec2: Dict[str, float]) -> float:
    """Computes cosine similarity between two sparse frequency vectors."""
    intersection = set(vec1.keys()) & set(vec2.keys())
    if not intersection:
        return 0.0
    numerator = sum(vec1[k] * vec2[k] for k in intersection)
    sum1 = sum(v ** 2 for v in vec1.values())
    sum2 = sum(v ** 2 for v in vec2.values())
    denominator = math.sqrt(sum1) * math.sqrt(sum2)
    if denominator == 0:
        return 0.0
    return min(1.0, max(0.0, numerator / denominator))


def _build_term_freq(tokens: List[str]) -> Dict[str, float]:
    """Builds normalized term frequency vector."""
    if not tokens:
        return {}
    tf: Dict[str, float] = {}
    for t in tokens:
        tf[t] = tf.get(t, 0.0) + 1.0
    total = len(tokens)
    return {k: v / total for k, v in tf.items()}


_TIKTOKEN_ENCODER = None


def estimate_token_count(text_or_obj: Any) -> int:
    """
    Accurately estimates token count using tiktoken (cl100k_base)
    with defensive fallback to character heuristic (~4 chars/token).
    """
    global _TIKTOKEN_ENCODER
    if text_or_obj is None:
        return 0

    if isinstance(text_or_obj, str):
        raw_str = text_or_obj
    else:
        try:
            raw_str = json.dumps(text_or_obj)
        except Exception:
            raw_str = str(text_or_obj)

    if not raw_str:
        return 0

    try:
        if _TIKTOKEN_ENCODER is None:
            import tiktoken
            _TIKTOKEN_ENCODER = tiktoken.get_encoding("cl100k_base")
        return max(1, len(_TIKTOKEN_ENCODER.encode(raw_str)))
    except Exception:
        return max(1, math.ceil(len(raw_str) / 4.0))


class ContextCandidate:
    """Internal candidate representation for scoring and ranking."""
    def __init__(
        self,
        source_id: str,
        source_type: str,
        key: str,
        title: str,
        content_text: str,
        raw_data: Any,
        version: int,
        latest_version: int,
        status: str,  # "approved", "draft", "outdated", "rejected", "stale", "pending_review"
        is_current: bool,
        actor_id: str,
        timestamp: str,
        project_id: str,
    ):
        self.source_id = source_id
        self.source_type = source_type
        self.key = key
        self.title = title
        self.content_text = content_text
        self.raw_data = raw_data
        self.version = version
        self.latest_version = latest_version
        self.status = status
        self.is_current = is_current
        self.actor_id = actor_id
        self.timestamp = timestamp
        self.project_id = project_id

        # Computed scores
        self.keyword_score = 0.0
        self.semantic_score = 0.0
        self.freshness_score = 1.0
        self.approval_multiplier = 1.0
        self.task_dependency_score = 0.0
        self.source_reliability = 0.8
        self.final_score = 0.0
        self.retrieval_reason = ""


class HybridRetriever:
    """
    Production-grade hybrid context retrieval engine combining:
    1. Version-aware filtering and deterministic gates.
    2. Task-based semantic and keyword matching.
    3. Freshness, approval status, and dependency scoring.
    4. Mandatory dependency preservation.
    5. Comprehensive provenance stamping and latency measurement.
    """

    def __init__(
        self,
        keyword_weight: float = 0.30,
        semantic_weight: float = 0.25,
        task_dep_weight: float = 0.20,
        freshness_weight: float = 0.15,
        source_weight: float = 0.10,
    ):
        self.keyword_weight = keyword_weight
        self.semantic_weight = semantic_weight
        self.task_dep_weight = task_dep_weight
        self.freshness_weight = freshness_weight
        self.source_weight = source_weight

    def extract_candidates(
        self,
        db: Session,
        project_id: str,
    ) -> List[ContextCandidate]:
        """Gathers all candidate items from DB across current and historical models."""
        candidates: List[ContextCandidate] = []

        # 1. Current Requirements
        current_reqs = db.query(RequirementModel).filter(RequirementModel.project_id == project_id).all()
        for r in current_reqs:
            content = f"{r.requirement_key} {r.title} {str(r.value)}"
            candidates.append(
                ContextCandidate(
                    source_id=r.id,
                    source_type="requirement",
                    key=r.requirement_key,
                    title=r.title,
                    content_text=content,
                    raw_data=r.value,
                    version=r.version,
                    latest_version=r.version,
                    status=getattr(r, "status", "approved"),
                    is_current=True,
                    actor_id=r.updated_by,
                    timestamp=r.updated_at,
                    project_id=project_id,
                )
            )

        # 2. Historical Requirement Versions
        hist_reqs = (
            db.query(RequirementVersionModel)
            .filter(
                RequirementVersionModel.project_id == project_id,
                RequirementVersionModel.status.in_(["outdated", "rejected", "superseded"]),
            )
            .all()
        )
        req_latest_map = {r.requirement_key: r.version for r in current_reqs}
        for hr in hist_reqs:
            max_v = req_latest_map.get(hr.requirement_key, hr.version)
            content = f"{hr.requirement_key} {hr.title} {str(hr.value)} historical outdated version {hr.version}"
            candidates.append(
                ContextCandidate(
                    source_id=hr.id,
                    source_type="historical_requirement",
                    key=hr.requirement_key,
                    title=f"{hr.title} (Archived v{hr.version})",
                    content_text=content,
                    raw_data=hr.value,
                    version=hr.version,
                    latest_version=max_v,
                    status=hr.status,
                    is_current=False,
                    actor_id=hr.updated_by,
                    timestamp=hr.created_at,
                    project_id=project_id,
                )
            )

        # 3. Current Artifact Sections
        current_secs = db.query(ArtifactSectionModel).filter(ArtifactSectionModel.project_id == project_id).all()
        for s in current_secs:
            content = f"{s.section_key} {str(s.data)}"
            candidates.append(
                ContextCandidate(
                    source_id=s.id,
                    source_type="artifact_section",
                    key=s.section_key,
                    title=f"Section {s.section_key.replace('_', ' ').title()}",
                    content_text=content,
                    raw_data=s.data,
                    version=s.version,
                    latest_version=s.version,
                    status=getattr(s, "status", "approved"),
                    is_current=True,
                    actor_id=s.updated_by,
                    timestamp=s.updated_at,
                    project_id=project_id,
                )
            )

        # 4. Historical Artifact Section Versions
        hist_secs = (
            db.query(ArtifactSectionVersionModel)
            .filter(
                ArtifactSectionVersionModel.project_id == project_id,
                ArtifactSectionVersionModel.status.in_(["outdated", "superseded"]),
            )
            .all()
        )
        sec_latest_map = {s.section_key: s.version for s in current_secs}
        for hs in hist_secs:
            max_v = sec_latest_map.get(hs.section_key, hs.version)
            content = f"{hs.section_key} {str(hs.data)} historical outdated version {hs.version}"
            candidates.append(
                ContextCandidate(
                    source_id=hs.id,
                    source_type="historical_artifact_section",
                    key=hs.section_key,
                    title=f"Section {hs.section_key.replace('_', ' ').title()} (Archived v{hs.version})",
                    content_text=content,
                    raw_data=hs.data,
                    version=hs.version,
                    latest_version=max_v,
                    status=hs.status,
                    is_current=False,
                    actor_id=hs.updated_by,
                    timestamp=hs.created_at,
                    project_id=project_id,
                )
            )

        # 5. Approved Decisions
        decisions = (
            db.query(DecisionModel)
            .join(ProposalModel, DecisionModel.proposal_id == ProposalModel.id)
            .filter(ProposalModel.project_id == project_id)
            .order_by(DecisionModel.created_at.desc())
            .limit(10)
            .all()
        )
        for d in decisions:
            content = f"Decision {d.decision} by {d.decided_by} for proposal {d.proposal_id}: {d.note or ''}"
            candidates.append(
                ContextCandidate(
                    source_id=d.id,
                    source_type="decision",
                    key=d.proposal_id,
                    title=f"Decision on {d.proposal_id}",
                    content_text=content,
                    raw_data={"decision": d.decision, "decided_by": d.decided_by, "note": d.note},
                    version=1,
                    latest_version=1,
                    status="approved" if d.decision == "approved" else "rejected",
                    is_current=True,
                    actor_id=d.decided_by,
                    timestamp=d.created_at,
                    project_id=project_id,
                )
            )

        # 6. Open Proposals & Superseded Proposals
        proposals = (
            db.query(ProposalModel)
            .filter(ProposalModel.project_id == project_id)
            .order_by(ProposalModel.created_at.desc())
            .limit(10)
            .all()
        )
        for p in proposals:
            content = f"Proposal {p.id} agent {p.agent_id} status {p.status}: {p.summary} {p.reasoning or ''}"
            is_cur = p.status in ("pending_review", "approved")
            candidates.append(
                ContextCandidate(
                    source_id=p.id,
                    source_type="proposal",
                    key=p.id,
                    title=f"Proposal by {p.agent_id.upper()}: {p.summary[:40]}...",
                    content_text=content,
                    raw_data={
                        "proposal_id": p.id,
                        "agent_id": p.agent_id,
                        "summary": p.summary,
                        "affected_requirements": p.affected_requirements,
                        "target_sections": p.target_sections,
                        "status": p.status,
                        "stale_reason": p.stale_reason,
                        "conflict_reason": p.conflict_reason,
                    },
                    version=p.base_context_version,
                    latest_version=p.base_context_version,
                    status=p.status,
                    is_current=is_cur,
                    actor_id=p.agent_id,
                    timestamp=p.created_at,
                    project_id=project_id,
                )
            )

        return candidates

    def score_candidate(
        self,
        candidate: ContextCandidate,
        agent_id: str,
        task_id: str,
        task_description: str,
        query_tokens: List[str],
        query_tf: Dict[str, float],
        declared_sections: Set[str],
        declared_reqs: Set[str],
    ):
        """Scores an individual candidate against task, agent role, and deterministic gates."""
        content_tokens = _tokenize(candidate.content_text)
        content_tf = _build_term_freq(content_tokens)

        # 1. Keyword Score (Exact key match + term overlap)
        exact_match = 0.0
        candidate_key_lower = candidate.key.lower()
        for qt in query_tokens:
            if qt == candidate_key_lower:
                exact_match = 1.0
                break
            if qt in candidate_key_lower:
                exact_match = max(exact_match, 0.75)

        token_overlap = 0.0
        if query_tokens and content_tokens:
            common = set(query_tokens) & set(content_tokens)
            token_overlap = len(common) / len(set(query_tokens))

        if exact_match == 1.0:
            candidate.keyword_score = 1.0
        else:
            candidate.keyword_score = min(1.0, (exact_match * 0.6) + (token_overlap * 0.4))

        # 2. Semantic Score (Cosine similarity + concept cluster overlap + topic affinity)
        base_cosine = _cosine_similarity(query_tf, content_tf)

        cluster = SEMANTIC_CONCEPT_CLUSTERS.get(candidate.key, set())
        cluster_overlap = 0.0
        if cluster and query_tokens:
            common_concepts = cluster & set(query_tokens)
            if common_concepts:
                cluster_overlap = min(0.6, len(common_concepts) * 0.18)

        topic_bonus = 0.0
        lower_desc = task_description.lower()
        if agent_id == "nova":
            overlap_strat = sum(1 for kw in STRATEGY_KEYWORDS if kw in lower_desc and kw in content_tokens)
            topic_bonus = min(0.3, overlap_strat * 0.08)
        elif agent_id == "pixel":
            overlap_eng = sum(1 for kw in ENGINEERING_KEYWORDS if kw in lower_desc and kw in content_tokens)
            topic_bonus = min(0.3, overlap_eng * 0.08)

        candidate.semantic_score = min(1.0, base_cosine + cluster_overlap + topic_bonus)

        # 3. Task Dependency Score
        dep_score = 0.0
        reasons = []

        if candidate.key in declared_reqs:
            dep_score += 0.5
            reasons.append(f"Direct requirement dependency declared for task: '{candidate.key}'")
        if candidate.key in declared_sections:
            dep_score += 0.5
            reasons.append(f"Target artifact section declared for task: '{candidate.key}'")

        for sec in declared_sections:
            req_deps = SECTION_DEPENDENCY_MAP.get(sec, set())
            if candidate.key in req_deps:
                dep_score += 0.4
                reasons.append(f"Derived requirement dependency for target section '{sec}'")

        affinity_data = AGENT_AFFINITY.get(agent_id, {})
        pref_reqs = affinity_data.get("preferred_reqs", set())
        pref_secs = affinity_data.get("preferred_sections", set())

        if candidate.key in pref_reqs:
            dep_score += 0.3
            reasons.append(f"Aligned with {agent_id.upper()} domain requirements")
        if candidate.key in pref_secs:
            dep_score += 0.2
            reasons.append(f"Aligned with {agent_id.upper()} target artifact domain")

        candidate.task_dependency_score = min(1.0, dep_score)

        # 4. Freshness Score
        if candidate.latest_version > 0:
            version_diff = max(0, candidate.latest_version - candidate.version)
            candidate.freshness_score = max(0.1, 1.0 - (version_diff * 0.45))
        else:
            candidate.freshness_score = 1.0

        # 5. Source Reliability
        if candidate.actor_id in ("alex", "maya", "human"):
            candidate.source_reliability = 1.0
        elif candidate.actor_id in ("system", "seed"):
            candidate.source_reliability = 0.9
        else:
            candidate.source_reliability = 0.8

        # 6. Deterministic Validation & Status Multipliers
        if candidate.status == "approved":
            candidate.approval_multiplier = 1.0
        elif candidate.status == "draft":
            candidate.approval_multiplier = 0.85
            reasons.append("Draft item pending review")
        elif candidate.status in ("outdated", "superseded"):
            candidate.approval_multiplier = 0.30
            reasons.append(f"Archived historical item (superseded by v{candidate.latest_version})")
        elif candidate.status == "stale":
            candidate.approval_multiplier = 0.35
            reasons.append(f"Stale item: {candidate.raw_data.get('stale_reason', 'Requirements changed') if isinstance(candidate.raw_data, dict) else 'Requirements changed'}")
        elif candidate.status in ("rejected", "conflict"):
            candidate.approval_multiplier = 0.20
            reasons.append(f"Rejected or conflicting state ({candidate.status})")
        else:
            candidate.approval_multiplier = 0.70

        raw_weighted = (
            (self.keyword_weight * candidate.keyword_score)
            + (self.semantic_weight * candidate.semantic_score)
            + (self.task_dep_weight * candidate.task_dependency_score)
            + (self.freshness_weight * candidate.freshness_score)
            + (self.source_weight * candidate.source_reliability)
        )

        candidate.final_score = round(raw_weighted * candidate.approval_multiplier, 4)

        if not reasons:
            if candidate.keyword_score > 0.5:
                reasons.append(f"High keyword term overlap with task ({candidate.keyword_score:.2f})")
            elif candidate.semantic_score > 0.4:
                reasons.append(f"Semantic conceptual alignment with task ({candidate.semantic_score:.2f})")
            elif candidate.is_current and candidate.status == "approved":
                reasons.append("Authoritative current approved project baseline")
            else:
                reasons.append(f"Context candidate evaluated for project {candidate.project_id}")

        candidate.retrieval_reason = "; ".join(reasons)

    def retrieve(
        self,
        db: Session,
        project_id: str,
        agent_id: str,
        task_id: str,
        task_description: str,
        target_sections: Optional[List[str]] = None,
        affected_requirements: Optional[List[str]] = None,
        top_k: int = 8,
    ) -> Tuple[List[ContextCandidate], List[ContextCandidate], ContextRetrievalMetrics]:
        """
        Executes hybrid retrieval, returning:
        1. Ranked primary valid context candidates (current, approved/draft),
           filtered to top-K with mandatory dependency preservation.
        2. Preserved historical context candidates (outdated, stale, superseded).
        3. Retrieval performance metrics (latency_ms, tokens, count).
        """
        t0 = time.perf_counter()

        candidates = self.extract_candidates(db=db, project_id=project_id)

        query_text = f"{task_id} {task_description} {' '.join(target_sections or [])} {' '.join(affected_requirements or [])}"
        query_tokens = _tokenize(query_text)
        query_tf = _build_term_freq(query_tokens)

        dec_sections = set(target_sections or [])
        dec_reqs = set(affected_requirements or [])

        lower_desc = task_description.lower()
        for sec in ["product_brief", "hero", "dashboard", "approval_queue"]:
            if sec in lower_desc or sec.replace("_", " ") in lower_desc:
                dec_sections.add(sec)

        for req_k in ["REQ_AUDIENCE", "REQ_METRICS", "REQ_BRAND", "REQ_APPROVAL_POLICY", "REQ_ROLES"]:
            if req_k.lower() in lower_desc:
                dec_reqs.add(req_k)

        for c in candidates:
            self.score_candidate(
                candidate=c,
                agent_id=agent_id,
                task_id=task_id,
                task_description=task_description,
                query_tokens=query_tokens,
                query_tf=query_tf,
                declared_sections=dec_sections,
                declared_reqs=dec_reqs,
            )

        # Deterministic Separation:
        # Primary: is_current=True and status in ("approved", "draft", "pending_review")
        # Historical: is_current=False or status in ("outdated", "superseded", "stale", "rejected")
        all_primary: List[ContextCandidate] = []
        historical_candidates: List[ContextCandidate] = []

        for c in candidates:
            if c.is_current and c.status in ("approved", "draft", "pending_review"):
                all_primary.append(c)
            else:
                historical_candidates.append(c)

        all_primary.sort(key=lambda x: x.final_score, reverse=True)
        historical_candidates.sort(key=lambda x: x.final_score, reverse=True)

        # Top-K candidate selection with mandatory dependency preservation
        # 1. Take top_k candidates from all_primary
        selected_primary = all_primary[:top_k]
        selected_keys = {c.key for c in selected_primary}

        # 2. Mandatory preservation:
        # Check all selected sections or declared sections, ensure their mapped requirement dependencies are included
        mandatory_req_keys: Set[str] = set()
        for c in selected_primary:
            if c.source_type == "artifact_section":
                mandatory_req_keys.update(SECTION_DEPENDENCY_MAP.get(c.key, set()))
        for sec in dec_sections:
            mandatory_req_keys.update(SECTION_DEPENDENCY_MAP.get(sec, set()))

        # Also ensure declared requirements are included
        mandatory_req_keys.update(dec_reqs)

        for c in all_primary:
            if c.key in mandatory_req_keys and c.key not in selected_keys:
                selected_primary.append(c)
                selected_keys.add(c.key)

        # Keep primary candidates sorted by score
        selected_primary.sort(key=lambda x: x.final_score, reverse=True)

        t1 = time.perf_counter()
        latency_ms = round((t1 - t0) * 1000.0, 2)

        # Estimate accurate token usage across retrieved candidates
        token_count = 0
        for c in selected_primary:
            token_count += estimate_token_count(c.raw_data)
        for c in historical_candidates:
            token_count += estimate_token_count(c.raw_data)
        token_count += estimate_token_count(task_description)

        metrics = ContextRetrievalMetrics(
            retrieval_latency_ms=latency_ms,
            estimated_token_count=token_count,
            total_candidates_evaluated=len(candidates),
            items_retrieved=len(selected_primary) + len(historical_candidates),
        )

        return selected_primary, historical_candidates, metrics


# Module-level retriever instance
retriever = HybridRetriever()
