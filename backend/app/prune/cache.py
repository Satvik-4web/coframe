import hashlib
import json
import time
from typing import Dict, Any, Optional, Tuple

# Pricing benchmark per 1M tokens (standard baseline e.g. GPT-4o / Claude 3.5 / Gemini)
# Input: $2.50 / 1M tokens ($0.0000025 per token)
# Output: $10.00 / 1M tokens ($0.000010 per token)
INPUT_TOKEN_COST_USD = 0.0000025
OUTPUT_TOKEN_COST_USD = 0.000010


def compute_prompt_hash(system_prompt: str, user_prompt: str, model: str) -> str:
    """Computes a deterministic SHA-256 fingerprint for caching."""
    hasher = hashlib.sha256()
    hasher.update(system_prompt.strip().encode("utf-8"))
    hasher.update(b"|||")
    hasher.update(user_prompt.strip().encode("utf-8"))
    hasher.update(b"|||")
    hasher.update(model.strip().encode("utf-8"))
    return hasher.hexdigest()


def estimate_token_count(text: str) -> int:
    """Fast, accurate token estimation (approx ~4 characters per token)."""
    if not text:
        return 0
    return max(1, len(text) // 4)


def calculate_cost(prompt_tokens: int, completion_tokens: int) -> float:
    """Calculates standard dollar cost for tokens."""
    return round((prompt_tokens * INPUT_TOKEN_COST_USD) + (completion_tokens * OUTPUT_TOKEN_COST_USD), 6)


class PruneCache:
    """In-memory exact prompt cache for Prune gateway."""

    def __init__(self):
        self._store: Dict[str, Dict[str, Any]] = {}

    def get(self, prompt_hash: str) -> Optional[Dict[str, Any]]:
        entry = self._store.get(prompt_hash)
        if entry:
            entry["hit_count"] = entry.get("hit_count", 0) + 1
            return entry
        return None

    def set(
        self,
        prompt_hash: str,
        data: Any,
        prompt_tokens: int,
        completion_tokens: int,
        model: str,
    ) -> None:
        self._store[prompt_hash] = {
            "data": data,
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "cost_saved_usd": calculate_cost(prompt_tokens, completion_tokens),
            "model": model,
            "hit_count": 0,
            "created_at": time.time(),
        }

    def clear(self) -> None:
        self._store.clear()


# Global cache instance
prune_cache = PruneCache()
