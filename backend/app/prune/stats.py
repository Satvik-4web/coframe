import datetime
from typing import Dict, Any, List
from collections import deque

class PruneStatsManager:
    """Manages aggregate statistics, savings metrics, and recent receipts for Prune Seatbelt."""

    def __init__(self, max_recent_receipts: int = 100):
        self.total_requests: int = 0
        self.cache_hits: int = 0
        self.total_cost_usd: float = 0.0
        self.total_saved_usd: float = 0.0
        self.shield_blocks: int = 0
        self.recent_receipts: deque = deque(maxlen=max_recent_receipts)

    def record_request(
        self,
        cache_hit: bool,
        cost_usd: float,
        cost_saved_usd: float,
        shield_blocked: bool,
        receipt: Dict[str, Any],
    ) -> None:
        self.total_requests += 1
        if shield_blocked:
            self.shield_blocks += 1
        elif cache_hit:
            self.cache_hits += 1
            self.total_saved_usd += cost_saved_usd
        else:
            self.total_cost_usd += cost_usd

        self.recent_receipts.appendleft(receipt)

    def get_summary(self) -> Dict[str, Any]:
        hit_rate = (self.cache_hits / self.total_requests * 100.0) if self.total_requests > 0 else 0.0
        return {
            "total_requests": self.total_requests,
            "cache_hits": self.cache_hits,
            "cache_hit_rate": round(hit_rate, 1),
            "total_cost_usd": round(self.total_cost_usd, 6),
            "total_saved_usd": round(self.total_saved_usd, 6),
            "shield_blocks": self.shield_blocks,
        }

    def get_recent_receipts(self, limit: int = 20) -> List[Dict[str, Any]]:
        return list(self.recent_receipts)[:limit]

    def get_receipt_by_id(self, receipt_id: str) -> Dict[str, Any] | None:
        for r in self.recent_receipts:
            if r.get("receipt_id") == receipt_id:
                return r
        return None

    def reset(self) -> None:
        self.total_requests = 0
        self.cache_hits = 0
        self.total_cost_usd = 0.0
        self.total_saved_usd = 0.0
        self.shield_blocks = 0
        self.recent_receipts.clear()


prune_stats = PruneStatsManager()
