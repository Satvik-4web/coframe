"""
Agent Observability and Usage Telemetry for NOVA and PIXEL.
Tracks requests, token usage, latency, success/failure, fallback usage, and cost per agent.
Never logs credentials or private model reasoning.
"""

import datetime
from typing import Dict, Any, List, Optional
from collections import deque
from pydantic import BaseModel


def utcnow_str() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


# Estimated standard pricing per 1M tokens (USD)
ESTIMATED_PRICING: Dict[str, Dict[str, float]] = {
    # Gemini
    "gemini-2.5-flash": {"prompt": 0.075 / 1_000_000, "completion": 0.30 / 1_000_000},
    "gemini-1.5-flash": {"prompt": 0.075 / 1_000_000, "completion": 0.30 / 1_000_000},
    "gemini-1.5-pro": {"prompt": 1.25 / 1_000_000, "completion": 5.00 / 1_000_000},
    # OpenAI
    "gpt-4o": {"prompt": 2.50 / 1_000_000, "completion": 10.00 / 1_000_000},
    "gpt-4o-mini": {"prompt": 0.15 / 1_000_000, "completion": 0.60 / 1_000_000},
    # Anthropic
    "claude-3-5-sonnet-20241022": {"prompt": 3.00 / 1_000_000, "completion": 15.00 / 1_000_000},
    "claude-3-5-haiku-20241022": {"prompt": 0.80 / 1_000_000, "completion": 4.00 / 1_000_000},
}


class AgentCallRecord(BaseModel):
    id: str
    timestamp: str
    agent_id: str
    provider: str
    model: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    duration_ms: float = 0.0
    success: bool = True
    is_fallback: bool = False
    error_message: Optional[str] = None
    estimated_cost_usd: float = 0.0


class AgentTelemetryTracker:
    """In-memory agent telemetry tracker tracking operational metrics per agent."""

    def __init__(self, max_recent: int = 200):
        self.max_recent = max_recent
        self.records: deque[AgentCallRecord] = deque(maxlen=max_recent)
        self.agent_stats: Dict[str, Dict[str, Any]] = {
            "nova": self._init_stat_bucket("nova"),
            "pixel": self._init_stat_bucket("pixel"),
            "system": self._init_stat_bucket("system"),
        }

    def _init_stat_bucket(self, agent_id: str) -> Dict[str, Any]:
        return {
            "agent_id": agent_id,
            "total_requests": 0,
            "live_requests": 0,
            "fallback_requests": 0,
            "failed_requests": 0,
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": 0,
            "total_duration_ms": 0.0,
            "estimated_cost_usd": 0.0,
            "active_model": None,
            "active_provider": None,
            "last_active": None,
        }

    def record_call(
        self,
        agent_id: str,
        provider: str,
        model: str,
        prompt_tokens: int = 0,
        completion_tokens: int = 0,
        duration_ms: float = 0.0,
        success: bool = True,
        is_fallback: bool = False,
        error_message: Optional[str] = None,
    ) -> AgentCallRecord:
        import uuid
        now = utcnow_str()

        # Calculate cost
        pricing = ESTIMATED_PRICING.get(model, {"prompt": 0.10 / 1_000_000, "completion": 0.40 / 1_000_000})
        cost = 0.0
        if not is_fallback and success:
            cost = (prompt_tokens * pricing["prompt"]) + (completion_tokens * pricing["completion"])

        record = AgentCallRecord(
            id=f"call_{uuid.uuid4().hex[:10]}",
            timestamp=now,
            agent_id=agent_id,
            provider=provider,
            model=model,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=prompt_tokens + completion_tokens,
            duration_ms=round(duration_ms, 2),
            success=success,
            is_fallback=is_fallback,
            error_message=error_message,
            estimated_cost_usd=round(cost, 6),
        )

        self.records.appendleft(record)

        # Update per-agent aggregated stats
        if agent_id not in self.agent_stats:
            self.agent_stats[agent_id] = self._init_stat_bucket(agent_id)

        stats = self.agent_stats[agent_id]
        stats["total_requests"] += 1
        stats["active_model"] = model
        stats["active_provider"] = provider
        stats["last_active"] = now

        if is_fallback:
            stats["fallback_requests"] += 1
        elif success:
            stats["live_requests"] += 1
        else:
            stats["failed_requests"] += 1

        stats["prompt_tokens"] += prompt_tokens
        stats["completion_tokens"] += completion_tokens
        stats["total_tokens"] += prompt_tokens + completion_tokens
        stats["total_duration_ms"] += duration_ms
        stats["estimated_cost_usd"] += cost

        return record

    def get_agent_metrics(self, agent_id: str) -> Dict[str, Any]:
        stats = self.agent_stats.get(agent_id, self._init_stat_bucket(agent_id))
        total_reqs = stats["total_requests"]
        avg_latency = round(stats["total_duration_ms"] / total_reqs, 2) if total_reqs > 0 else 0.0
        return {
            "agent_id": agent_id,
            "provider": stats["active_provider"],
            "model": stats["active_model"],
            "total_requests": total_reqs,
            "live_requests": stats["live_requests"],
            "fallback_requests": stats["fallback_requests"],
            "failed_requests": stats["failed_requests"],
            "fallback_rate_pct": round((stats["fallback_requests"] / total_reqs * 100.0), 1) if total_reqs > 0 else 0.0,
            "prompt_tokens": stats["prompt_tokens"],
            "completion_tokens": stats["completion_tokens"],
            "total_tokens": stats["total_tokens"],
            "average_duration_ms": avg_latency,
            "estimated_cost_usd": round(stats["estimated_cost_usd"], 6),
            "last_active": stats["last_active"],
        }

    def get_all_metrics(self) -> Dict[str, Any]:
        return {
            "agents": {
                aid: self.get_agent_metrics(aid)
                for aid in ["nova", "pixel"]
            },
            "recent_records": [r.model_dump() for r in list(self.records)[:20]],
        }

    def reset(self) -> None:
        self.records.clear()
        self.agent_stats = {
            "nova": self._init_stat_bucket("nova"),
            "pixel": self._init_stat_bucket("pixel"),
            "system": self._init_stat_bucket("system"),
        }


# Global singleton tracker
telemetry_tracker = AgentTelemetryTracker()
