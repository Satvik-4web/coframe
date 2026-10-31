import os

# ==============================================================================
# PRUNE SEATBELT CONFIGURATION (BIOS V2 Hackathon Workshop)
# ==============================================================================

# Prune Gateway Base URL (Drop-in OpenAI-compatible proxy)
PRUNE_BASE_URL = os.getenv("PRUNE_BASE_URL", "https://api.withprune.com/v1").rstrip("/")

# Prune API Key (from app.withprune.com)
PRUNE_API_KEY = os.getenv("PRUNE_API_KEY", "")

# Whether Prune seatbelt protection & receipt generation is active
PRUNE_ENABLED = os.getenv("PRUNE_ENABLED", "true").lower() in ("true", "1", "yes")

# Spend cap in USD per key/session
PRUNE_MAX_SPEND_USD = float(os.getenv("PRUNE_MAX_SPEND_USD", "100.0"))

# Automatic fallback model if primary model fails
PRUNE_BACKUP_MODEL = os.getenv("PRUNE_BACKUP_MODEL", "gemini-2.5-flash")

# Provider Key Vault: provider keys are stored encrypted or routed through Prune proxy
PRUNE_VAULT_ENABLED = os.getenv("PRUNE_VAULT_ENABLED", "true").lower() in ("true", "1", "yes")
