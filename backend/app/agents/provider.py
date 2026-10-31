import os
import json
import logging
from typing import Dict, Any, Optional, Tuple
import httpx

logger = logging.getLogger(__name__)

LLM_PROVIDER = os.getenv("LLM_PROVIDER", "gemini").lower()
LLM_MODEL = os.getenv("LLM_MODEL", "gemini-2.5-flash")
LLM_API_KEY = os.getenv("LLM_API_KEY", "")
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "")


async def call_llm_json(
    system_prompt: str,
    user_prompt: str,
    json_schema: Optional[Dict[str, Any]] = None,
    timeout: float = 15.0,
) -> Tuple[Dict[str, Any], str, bool]:
    """
    Calls the configured LLM provider expecting strict JSON output.
    Returns: (output_dict, source, is_simulated)
    If no valid API key is present or connection fails, raises an Exception
    so the agent runner can safely activate the labeled deterministic fallback.
    """
    if not LLM_API_KEY:
        raise ValueError("No LLM_API_KEY configured; fallback should be triggered.")

    # 1. Gemini / Google AI Studio provider
    if LLM_PROVIDER in ("gemini", "google"):
        base_url = LLM_BASE_URL or f"https://generativelanguage.googleapis.com/v1beta/models/{LLM_MODEL}:generateContent"
        params = {"key": LLM_API_KEY}
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

    # 2. OpenAI / OpenRouter / Groq provider
    elif LLM_PROVIDER in ("openai", "openrouter", "groq"):
        base_url = LLM_BASE_URL or (
            "https://openrouter.ai/api/v1/chat/completions"
            if LLM_PROVIDER == "openrouter"
            else "https://api.openai.com/v1/chat/completions"
        )
        headers = {
            "Authorization": f"Bearer {LLM_API_KEY}",
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

    # 3. Anthropic Claude provider
    elif LLM_PROVIDER == "anthropic":
        base_url = LLM_BASE_URL or "https://api.anthropic.com/v1/messages"
        headers = {
            "x-api-key": LLM_API_KEY,
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
