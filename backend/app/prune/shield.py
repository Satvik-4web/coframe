import re
import logging
from typing import Tuple, Optional, List, Dict, Any

logger = logging.getLogger("coframe.prune.shield")

# Known prompt injection signatures
PROMPT_INJECTION_PATTERNS = [
    re.compile(r"ignore\s+(?:all\s+)?(?:previous|prior|above)\s+instructions", re.IGNORECASE),
    re.compile(r"disregard\s+(?:all\s+)?(?:previous|prior|above)\s+prompts", re.IGNORECASE),
    re.compile(r"bypass\s+(?:safety|guardrails|filters|restrictions)", re.IGNORECASE),
    re.compile(r"reveal\s+(?:system\s+prompt|internal\s+instructions|secret\s+key|credentials)", re.IGNORECASE),
    re.compile(r"dump\s+(?:all\s+)?(?:system|internal|config|keys|environment)", re.IGNORECASE),
    re.compile(r"DAN\s+mode|jailbreak|developer\s+mode\s+enabled", re.IGNORECASE),
    re.compile(r"you\s+are\s+now\s+unfiltered", re.IGNORECASE),
    re.compile(r"output\s+your\s+instructions\s+verbatim", re.IGNORECASE),
]

# Sensitive credentials & API keys regex
SECRET_PATTERNS = [
    re.compile(r"sk-[a-zA-Z0-9]{24,}"),               # OpenAI / Anthropic key
    re.compile(r"ghp_[a-zA-Z0-9]{36}"),                # GitHub PAT
    re.compile(r"AIza[0-9A-Za-z-_]{35}"),              # Google Gemini API key
    re.compile(r"AKIA[0-9A-Z]{16}"),                   # AWS Access Key
    re.compile(r"xox[baprs]-[0-9]{10,13}-[a-zA-Z0-9]{24}"), # Slack token
]

# PII Patterns
PII_PATTERNS = [
    re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),               # US SSN
    re.compile(r"\b(?:\d{4}[ -]?){3}\d{4}\b"),          # Credit Card
]


class ShieldViolationError(Exception):
    """Raised when Prune Shield blocks a request due to safety/security violations."""
    def __init__(self, reason: str, violation_type: str):
        super().__init__(f"Prune Shield Blocked Request: {reason}")
        self.reason = reason
        self.violation_type = violation_type


def inspect_text_safety(text: str) -> Tuple[bool, Optional[str], Optional[str]]:
    """
    Scans incoming text for prompt injection, secrets leakage, or PII.
    Returns: (is_safe, violation_type, reason)
    """
    if not text:
        return True, None, None

    # 1. Prompt Injection detection
    for pattern in PROMPT_INJECTION_PATTERNS:
        match = pattern.search(text)
        if match:
            reason = f"Prompt injection attempt detected: '{match.group(0)}'"
            logger.warning(f"Prune Shield Block: {reason}")
            return False, "prompt_injection", reason

    # 2. Secret leakage detection
    for pattern in SECRET_PATTERNS:
        match = pattern.search(text)
        if match:
            reason = f"Credential / API key leak detected matching signature '{pattern.pattern}'"
            logger.warning(f"Prune Shield Block: {reason}")
            return False, "secret_leak", reason

    # 3. PII detection
    for pattern in PII_PATTERNS:
        match = pattern.search(text)
        if match:
            reason = f"Unredacted PII detected matching pattern '{pattern.pattern}'"
            logger.warning(f"Prune Shield Block: {reason}")
            return False, "pii_leak", reason

    return True, None, None
