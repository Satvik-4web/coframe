"""
Unified LLM Provider Adapter with Multi-Model Support, Tool Calling, and Telemetry.
Supports: Gemini (Google), OpenAI, Anthropic, OpenRouter, Groq, and Prune.
Protects credentials: Never logs API keys or sends them to the frontend.
"""

import os
import json
import time
import logging
from typing import Dict, Any, Optional, Tuple, List
import httpx
from dotenv import load_dotenv

# Ensure .env is loaded
load_dotenv()

# Suppress httpx URL logging to prevent credential exposure in logs
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)

from backend.app.prune import (
    execute_with_prune_seatbelt,
    PRUNE_ENABLED,
    PRUNE_API_KEY,
    PRUNE_BASE_URL,
)
from backend.app.agents.telemetry import telemetry_tracker

logger = logging.getLogger(__name__)


def get_effective_provider(agent_id: Optional[str] = None) -> str:
    """Returns the configured LLM provider name in lowercase."""
    return os.getenv("LLM_PROVIDER", "gemini").lower()


def get_effective_model(agent_id: Optional[str] = None, provider: Optional[str] = None) -> str:
    """
    Resolves the model identifier. Supports independent models for NOVA and PIXEL.
    Falls back to LLM_MODEL or verified provider defaults.
    """
    prov = provider or get_effective_provider(agent_id)

    if agent_id == "nova" and os.getenv("NOVA_MODEL"):
        return os.getenv("NOVA_MODEL", "").strip()
    if agent_id == "pixel" and os.getenv("PIXEL_MODEL"):
        return os.getenv("PIXEL_MODEL", "").strip()
    if os.getenv("LLM_MODEL"):
        return os.getenv("LLM_MODEL", "").strip()

    # Verified stable provider defaults
    defaults = {
        "gemini": "gemini-2.5-flash",
        "google": "gemini-2.5-flash",
        "openai": "gpt-4o",
        "openrouter": "openai/gpt-4o",
        "groq": "llama-3.3-70b-versatile",
        "anthropic": "claude-3-5-sonnet-20241022",
        "prune": "gpt-4o",
    }
    return defaults.get(prov, "gemini-2.5-flash")


def get_effective_api_key(provider: Optional[str] = None) -> str:
    """
    Resolves the API key securely.
    Checks universal LLM_API_KEY first, then provider-specific keys.
    Never logs or exposes the key.
    """
    prov = (provider or get_effective_provider()).lower()

    # 1. Check universal key
    universal_key = os.getenv("LLM_API_KEY", "").strip()
    if universal_key:
        return universal_key

    # 2. Check provider-specific keys
    if prov in ("gemini", "google"):
        return os.getenv("GEMINI_API_KEY", "").strip() or os.getenv("GOOGLE_API_KEY", "").strip()
    elif prov == "openai":
        return os.getenv("OPENAI_API_KEY", "").strip()
    elif prov == "anthropic":
        return os.getenv("ANTHROPIC_API_KEY", "").strip()
    elif prov == "groq":
        return os.getenv("GROQ_API_KEY", "").strip()
    elif prov == "openrouter":
        return os.getenv("OPENROUTER_API_KEY", "").strip()
    elif prov in ("prune", "withprune"):
        return os.getenv("PRUNE_API_KEY", "").strip()

    return ""


class LLMResult(tuple):
    """
    Subclasses tuple(data, source, is_simulated) so legacy callers unpacking
    `data, source, is_sim = await call_llm_json(...)` continue to work with 100%
    compatibility, while also exposing `.prune_metadata`, `.usage`, `.duration_ms`,
    `.model`, and `.provider`.
    """
    def __new__(
        cls,
        data: Dict[str, Any],
        source: str,
        is_simulated: bool,
        prune_metadata: Optional[Dict[str, Any]] = None,
        usage: Optional[Dict[str, int]] = None,
        duration_ms: float = 0.0,
        model: str = "",
        provider: str = "",
    ):
        inst = super().__new__(cls, (data, source, is_simulated))
        inst.data = data
        inst.source = source
        inst.is_simulated = is_simulated
        inst.prune_metadata = prune_metadata
        inst.usage = usage or {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
        inst.duration_ms = duration_ms
        inst.model = model
        inst.provider = provider
        return inst


async def call_llm_json(
    system_prompt: str,
    user_prompt: str,
    json_schema: Optional[Dict[str, Any]] = None,
    timeout: float = 15.0,
    model: Optional[str] = None,
    agent_id: Optional[str] = None,
    tools: Optional[List[Dict[str, Any]]] = None,
) -> LLMResult:
    """
    Calls the configured LLM provider expecting strict JSON output.
    Returns: LLMResult(output_dict, source, is_simulated, prune_metadata, usage, duration_ms, model, provider)

    If no valid API key is present or connection fails, raises an Exception
    so the agent runner can safely activate the labeled deterministic fallback.
    """
    prov = get_effective_provider(agent_id)
    eff_model = model or get_effective_model(agent_id, prov)
    effective_key = get_effective_api_key(prov)

    # Validate key existence before execution
    if not effective_key and prov != "prune":
        raise ValueError(
            f"No API key configured for provider '{prov}'. "
            f"Set LLM_API_KEY, {prov.upper()}_API_KEY, or GOOGLE_API_KEY to activate live execution."
        )

    start_time = time.perf_counter()

    async def _raw_provider_call() -> Tuple[Dict[str, Any], str, bool, Dict[str, int]]:
        usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}

        # 1. Prune Native Gateway (OpenAI compatible)
        if prov in ("prune", "withprune"):
            base_url = f"{PRUNE_BASE_URL}/chat/completions"
            headers = {
                "Authorization": f"Bearer {effective_key or PRUNE_API_KEY}",
                "Content-Type": "application/json",
            }
            payload = {
                "model": eff_model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "response_format": {"type": "json_object"},
                "temperature": 0.2,
            }
            if tools:
                payload["tools"] = tools

            async with httpx.AsyncClient(timeout=timeout) as client:
                resp = await client.post(base_url, headers=headers, json=payload)
                resp.raise_for_status()
                data = resp.json()
                choices = data.get("choices", [])
                if not choices:
                    raise ValueError("Prune provider returned empty choices")
                content = choices[0].get("message", {}).get("content", "{}")
                result = json.loads(content)

                if "usage" in data:
                    usage = {
                        "prompt_tokens": data["usage"].get("prompt_tokens", 0),
                        "completion_tokens": data["usage"].get("completion_tokens", 0),
                        "total_tokens": data["usage"].get("total_tokens", 0),
                    }
                return result, "live_llm", False, usage

        # 2. Gemini / Google AI Studio provider
        elif prov in ("gemini", "google"):
            candidate_models = [eff_model]
            for alt in ["gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3-flash-preview", "gemini-2.5-flash"]:
                if alt not in candidate_models:
                    candidate_models.append(alt)

            last_err = None
            for current_model in candidate_models:
                base_url = os.getenv("LLM_BASE_URL") or f"https://generativelanguage.googleapis.com/v1beta/models/{current_model}:generateContent"
                headers = {
                    "Content-Type": "application/json",
                    "x-goog-api-key": effective_key,
                }
                payload = {
                    "contents": [
                        {
                            "parts": [
                                {
                                    "text": (
                                        f"System Directive:\n{system_prompt}\n\n"
                                        f"Task:\n{user_prompt}\n\n"
                                        "Respond ONLY with a valid JSON object matching the required schema. Do not include markdown codeblocks."
                                    )
                                }
                            ]
                        }
                    ],
                    "generationConfig": {
                        "response_mime_type": "application/json",
                        "temperature": 0.2,
                    },
                }

                try:
                    async with httpx.AsyncClient(timeout=timeout) as client:
                        resp = await client.post(base_url, headers=headers, json=payload)
                        if resp.status_code in (429, 404, 503) and current_model != candidate_models[-1]:
                            logger.warning(f"Gemini model {current_model} returned {resp.status_code}. Retrying with next model in fallback chain...")
                            continue
                        resp.raise_for_status()
                        data = resp.json()
                        candidates = data.get("candidates", [])
                        if not candidates:
                            raise ValueError("Gemini returned empty candidates")
                        text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "{}")
                        result = json.loads(text.strip("` \n"))

                        meta = data.get("usageMetadata", {})
                        usage = {
                            "prompt_tokens": meta.get("promptTokenCount", 0),
                            "completion_tokens": meta.get("candidatesTokenCount", 0),
                            "total_tokens": meta.get("totalTokenCount", 0),
                        }
                        return result, "live_llm", False, usage
                except Exception as err:
                    last_err = err
                    if current_model == candidate_models[-1]:
                        raise err
                    logger.warning(f"Error calling {current_model}: {err}. Retrying with next model...")

            if last_err:
                raise last_err

        # 3. OpenAI / OpenRouter / Groq provider
        elif prov in ("openai", "openrouter", "groq"):
            base_url = os.getenv("LLM_BASE_URL") or (
                "https://openrouter.ai/api/v1/chat/completions"
                if prov == "openrouter"
                else "https://api.groq.com/openai/v1/chat/completions"
                if prov == "groq"
                else "https://api.openai.com/v1/chat/completions"
            )
            headers = {
                "Authorization": f"Bearer {effective_key}",
                "Content-Type": "application/json",
            }
            payload = {
                "model": eff_model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "response_format": {"type": "json_object"},
                "temperature": 0.2,
            }
            if tools:
                payload["tools"] = tools

            async with httpx.AsyncClient(timeout=timeout) as client:
                resp = await client.post(base_url, headers=headers, json=payload)
                resp.raise_for_status()
                data = resp.json()
                choices = data.get("choices", [])
                if not choices:
                    raise ValueError("LLM provider returned empty choices")
                content = choices[0].get("message", {}).get("content", "{}")
                result = json.loads(content)

                if "usage" in data:
                    usage = {
                        "prompt_tokens": data["usage"].get("prompt_tokens", 0),
                        "completion_tokens": data["usage"].get("completion_tokens", 0),
                        "total_tokens": data["usage"].get("total_tokens", 0),
                    }
                return result, "live_llm", False, usage

        # 4. Anthropic Claude provider
        elif prov == "anthropic":
            base_url = os.getenv("LLM_BASE_URL") or "https://api.anthropic.com/v1/messages"
            headers = {
                "x-api-key": effective_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            }
            payload = {
                "model": eff_model,
                "system": system_prompt,
                "messages": [
                    {"role": "user", "content": f"{user_prompt}\nReturn ONLY raw JSON, with no markdown codeblocks."}
                ],
                "max_tokens": 2500,
                "temperature": 0.2,
            }

            async with httpx.AsyncClient(timeout=timeout) as client:
                resp = await client.post(base_url, headers=headers, json=payload)
                resp.raise_for_status()
                data = resp.json()
                content_blocks = data.get("content", [])
                text = "".join(b.get("text", "") for b in content_blocks if b.get("type") == "text")
                result = json.loads(text.strip("` \n"))

                if "usage" in data:
                    usage = {
                        "prompt_tokens": data["usage"].get("input_tokens", 0),
                        "completion_tokens": data["usage"].get("output_tokens", 0),
                        "total_tokens": data["usage"].get("input_tokens", 0) + data["usage"].get("output_tokens", 0),
                    }
                return result, "live_llm", False, usage

        raise ValueError(f"Unsupported LLM_PROVIDER: {prov}")

    # Wrap the raw execution with the Prune Seatbelt if enabled
    try:
        if PRUNE_ENABLED:
            async def _bridge_call():
                d, s, is_sim, u = await _raw_provider_call()
                return d, s, is_sim

            data, source, is_sim, prune_receipt = await execute_with_prune_seatbelt(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                model=eff_model,
                upstream_fn=_bridge_call,
            )
            # Rough estimation if wrapped
            usage_est = {
                "prompt_tokens": prune_receipt.get("tokens_prompt", 0),
                "completion_tokens": prune_receipt.get("tokens_completion", 0),
                "total_tokens": prune_receipt.get("tokens_prompt", 0) + prune_receipt.get("tokens_completion", 0),
            }
            duration_ms = (time.perf_counter() - start_time) * 1000.0

            # Record telemetry
            telemetry_tracker.record_call(
                agent_id=agent_id or "system",
                provider=prov,
                model=eff_model,
                prompt_tokens=usage_est["prompt_tokens"],
                completion_tokens=usage_est["completion_tokens"],
                duration_ms=duration_ms,
                success=True,
                is_fallback=False,
            )

            return LLMResult(
                data=data,
                source=source,
                is_simulated=is_sim,
                prune_metadata=prune_receipt,
                usage=usage_est,
                duration_ms=duration_ms,
                model=eff_model,
                provider=prov,
            )
        else:
            data, source, is_sim, usage = await _raw_provider_call()
            duration_ms = (time.perf_counter() - start_time) * 1000.0

            telemetry_tracker.record_call(
                agent_id=agent_id or "system",
                provider=prov,
                model=eff_model,
                prompt_tokens=usage.get("prompt_tokens", 0),
                completion_tokens=usage.get("completion_tokens", 0),
                duration_ms=duration_ms,
                success=True,
                is_fallback=False,
            )

            return LLMResult(
                data=data,
                source=source,
                is_simulated=is_sim,
                prune_metadata=None,
                usage=usage,
                duration_ms=duration_ms,
                model=eff_model,
                provider=prov,
            )

    except Exception as exc:
        duration_ms = (time.perf_counter() - start_time) * 1000.0
        telemetry_tracker.record_call(
            agent_id=agent_id or "system",
            provider=prov,
            model=eff_model,
            duration_ms=duration_ms,
            success=False,
            is_fallback=True,
            error_message=str(exc),
        )
        raise exc
