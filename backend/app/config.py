"""Runtime configuration.

Everything is driven by environment variables so the engine can run in three modes:

1. **offline** (default) — the deterministic local reasoning engine answers every
   request. No network access, no API keys, fully reproducible.
2. **openai** — ``OPENAI_API_KEY`` is set, the master assistant upgrades to a large
   language model while keeping the same tool/approval protocol.
3. **anthropic** — ``ANTHROPIC_API_KEY`` is set, same protocol, Claude backend.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "backend" / "data"
WORKSPACE_FILE = DATA_DIR / "workspace.json"
FRONTEND_DIST = ROOT / "frontend" / "dist"


def _bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


@dataclass
class Settings:
    """Engine settings resolved once at import time."""

    host: str = os.environ.get("DRIPS_HOST", "0.0.0.0")
    port: int = int(os.environ.get("DRIPS_PORT", "8000"))
    provider: str = os.environ.get("DRIPS_PROVIDER", "auto").lower()
    openai_api_key: str = os.environ.get("OPENAI_API_KEY", "")
    anthropic_api_key: str = os.environ.get("ANTHROPIC_API_KEY", "")
    openai_model: str = os.environ.get("DRIPS_OPENAI_MODEL", "gpt-4o-mini")
    anthropic_model: str = os.environ.get("DRIPS_ANTHROPIC_MODEL", "claude-3-5-sonnet-latest")
    request_timeout: int = int(os.environ.get("DRIPS_REQUEST_TIMEOUT", "60"))
    max_output_tokens: int = int(os.environ.get("DRIPS_MAX_TOKENS", "1600"))
    temperature: float = float(os.environ.get("DRIPS_TEMPERATURE", "0.2"))
    data_dir: Path = DATA_DIR
    workspace_file: Path = WORKSPACE_FILE
    frontend_dist: Path = FRONTEND_DIST
    allow_execution: bool = _bool("DRIPS_ALLOW_EXECUTION", True)
    execution_timeout: float = float(os.environ.get("DRIPS_EXECUTION_TIMEOUT", "6"))
    execution_memory_mb: int = int(os.environ.get("DRIPS_EXECUTION_MEMORY_MB", "256"))
    autonomy: str = os.environ.get("DRIPS_AUTONOMY", "supervised")  # manual | supervised | autopilot
    cors_origin: str = os.environ.get("DRIPS_CORS_ORIGIN", "*")
    tags: list[str] = field(default_factory=list)

    # ------------------------------------------------------------------ helpers
    @property
    def active_provider(self) -> str:
        """Resolve which reasoning backend is actually available."""
        if self.provider in {"openai", "anthropic"}:
            return self.provider
        if self.provider == "offline":
            return "offline"
        # auto
        if self.anthropic_api_key:
            return "anthropic"
        if self.openai_api_key:
            return "openai"
        return "offline"

    @property
    def has_llm(self) -> bool:
        return self.active_provider in {"openai", "anthropic"}

    def describe(self) -> dict:
        return {
            "provider": self.active_provider,
            "has_llm": self.has_llm,
            "autonomy": self.autonomy,
            "allow_execution": self.allow_execution,
            "execution_timeout": self.execution_timeout,
            "models": {
                "openai": self.openai_model,
                "anthropic": self.anthropic_model,
            },
        }


settings = Settings()
settings.data_dir.mkdir(parents=True, exist_ok=True)
