import os
import json
import logging
from typing import Dict, Any, Optional, Tuple
import httpx

from backend.app.prune import (
    execute_with_prune_seatbelt,
    PRUNE_ENABLED,
    PRUNE_API_KEY,
    PRUNE_BASE_URL,
)

logger = logging.getLogger(__name__)

LLM_PROVIDER = os.getenv("LLM_PROVIDER", "gemini").lower()
LLM_MODEL = os.getenv("LLM_MODEL", "gemini-2.5-flash")
LLM_API_KEY = os.getenv("LLM_API_KEY", "")
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "")


class LLMResult(tuple):
    """
    Subclasses tuple(data, source, is_simulated) so legacy callers unpacking
    `data, source, is_sim = await call_llm_json(...)` continue to work with 100%
    compatibility, while also exposing `.prune_metadata` containing the Ed25519 signed receipt.
    """
    def __new__(cls, data: Dict[str, Any], source: str, is_simulated: bool, prune_metadata: Optional[Dict[str, Any]] = None):
        inst = super().__new__(cls, (data, source, is_simulated))
        inst.data = data
        inst.source = source
        inst.is_simulated = is_simulated
        inst.prune_metadata = prune_metadata
        return inst


async def call_llm_json(
    system_prompt: str,
    user_prompt: str,
    json_schema: Optional[Dict[str, Any]] = None,
    timeout: float = 15.0,
) -> LLMResult:
    """
    Calls the configured LLM provider expecting strict JSON output, protected by the Prune Seatbelt.
    Returns: LLMResult(output_dict, source, is_simulated, prune_metadata)
    If no valid API key is present or connection fails, raises an Exception
    so the agent runner can safely activate the labeled deterministic fallback.
    """

    async def _raw_provider_call() -> Tuple[Dict[str, Any], str, bool]:
        effective_key = LLM_API_KEY or PRUNE_API_KEY
        if not effective_key and LLM_PROVIDER != "prune":
            raise ValueError("No LLM_API_KEY or PRUNE_API_KEY configured; fallback should be triggered.")

        # 1. Prune Native Gateway (OpenAI compatible)
        if LLM_PROVIDER in ("prune", "withprune"):
            base_url = f"{PRUNE_BASE_URL}/chat/completions"
            headers = {
                "Authorization": f"Bearer {effective_key}",
                "Content-Type": "application/json",
            }
            payload = {
                "model": LLM_MODEL or "gpt-4o",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "response_format": {"type": "json_object"},
                "temperature": 0.2,
            }
            async with httpx.AsyncClient(timeout=timeout) as client:
                resp = await client.post(base_url, headers=headers, json=payload)
                resp.raise_for_status()
                data = resp.json()
                choices = data.get("choices", [])
                if not choices:
                    raise ValueError("Prune provider returned empty choices")
                content = choices[0].get("message", {}).get("content", "{}")
                result = json.loads(content)
                return result, "live_llm", False

        # 2. Gemini / Google AI Studio provider
        elif LLM_PROVIDER in ("gemini", "google"):
            base_url = LLM_BASE_URL or f"https://generativelanguage.googleapis.com/v1beta/models/{LLM_MODEL}:generateContent"
            params = {"key": effective_key}
            headers = {"Content-Type": "application/json"}
            payload = {
                "contents": [
                    {
                        "parts": [
                            {"text": f"System Directive:\n{system_prompt}\n\nTask:\n{user_prompt}\n\nRespond ONLY with a valid JSON object matching the required schema."}
                        ]
                    }
                ],
                "generationConfig": {
                    "response_mime_type": "application/json",
                    "temperature": 0.2,
                },
            }

            async with httpx.AsyncClient(timeout=timeout) as client:
                resp = await client.post(base_url, params=params, headers=headers, json=payload)
                resp.raise_for_status()
                data = resp.json()
                candidates = data.get("candidates", [])
                if not candidates:
                    raise ValueError("Gemini returned empty candidates")
                text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "{}")
                result = json.loads(text)
                return result, "live_llm", False

        # 3. OpenAI / OpenRouter / Groq provider
        elif LLM_PROVIDER in ("openai", "openrouter", "groq"):
            base_url = LLM_BASE_URL or (
                "https://openrouter.ai/api/v1/chat/completions"
                if LLM_PROVIDER == "openrouter"
                else "https://api.openai.com/v1/chat/completions"
            )
            headers = {
                "Authorization": f"Bearer {effective_key}",
                "Content-Type": "application/json",
            }
            payload = {
                "model": LLM_MODEL,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "response_format": {"type": "json_object"},
                "temperature": 0.2,
            }

            async with httpx.AsyncClient(timeout=timeout) as client:
                resp = await client.post(base_url, headers=headers, json=payload)
                resp.raise_for_status()
                data = resp.json()
                choices = data.get("choices", [])
                if not choices:
                    raise ValueError("LLM provider returned empty choices")
                content = choices[0].get("message", {}).get("content", "{}")
                result = json.loads(content)
                return result, "live_llm", False

        # 4. Anthropic Claude provider
        elif LLM_PROVIDER == "anthropic":
            base_url = LLM_BASE_URL or "https://api.anthropic.com/v1/messages"
            headers = {
                "x-api-key": effective_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            }
            payload = {
                "model": LLM_MODEL or "claude-3-5-sonnet-20241022",
                "system": system_prompt,
                "messages": [
                    {"role": "user", "content": f"{user_prompt}\nReturn ONLY raw JSON, with no markdown codeblocks."}
                ],
                "max_tokens": 2048,
                "temperature": 0.2,
            }

            async with httpx.AsyncClient(timeout=timeout) as client:
                resp = await client.post(base_url, headers=headers, json=payload)
                resp.raise_for_status()
                data = resp.json()
                content_blocks = data.get("content", [])
                text = "".join(b.get("text", "") for b in content_blocks if b.get("type") == "text")
                result = json.loads(text.strip("` \n"))
                return result, "live_llm", False

        raise ValueError(f"Unsupported LLM_PROVIDER: {LLM_PROVIDER}")

    # Wrap the raw execution with the Prune Seatbelt (Shield + Cache + Fallback + Signed Ed25519 Receipt)
    if PRUNE_ENABLED:
        data, source, is_sim, prune_receipt = await execute_with_prune_seatbelt(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            model=LLM_MODEL,
            upstream_fn=_raw_provider_call,
        )
        return LLMResult(data, source, is_sim, prune_metadata=prune_receipt)
    else:
        data, source, is_sim = await _raw_provider_call()
        return LLMResult(data, source, is_sim, prune_metadata=None)
