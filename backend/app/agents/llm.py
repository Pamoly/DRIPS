"""Optional large-language-model providers (standard library only).

The product works with **no API key at all** — every feature has a deterministic
implementation. When ``OPENAI_API_KEY`` or ``ANTHROPIC_API_KEY`` is present the mentor
upgrades its prose and can answer open-ended questions, while the findings, patches and
scores still come from the verified engine.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from dataclasses import dataclass, field

from ..config import settings


@dataclass
class LLMMessage:
    role: str
    content: str


@dataclass
class LLMResponse:
    text: str
    provider: str
    model: str
    usage: dict = field(default_factory=dict)
    error: str = ""

    @property
    def ok(self) -> bool:
        return bool(self.text) and not self.error


class LLMClient:
    """Tiny client for the two providers most people already have keys for."""

    def __init__(self) -> None:
        self.provider = settings.active_provider
        self.model = (
            settings.anthropic_model if self.provider == "anthropic" else settings.openai_model
        )

    @property
    def available(self) -> bool:
        return self.provider in {"openai", "anthropic"}

    # ------------------------------------------------------------------ public API
    def complete(
        self,
        system: str,
        messages: list[LLMMessage],
        max_tokens: int | None = None,
        temperature: float | None = None,
    ) -> LLMResponse:
        if not self.available:
            return LLMResponse("", "offline", "deterministic-engine", error="no_provider")
        try:
            if self.provider == "openai":
                return self._openai(system, messages, max_tokens, temperature)
            return self._anthropic(system, messages, max_tokens, temperature)
        except urllib.error.HTTPError as error:  # pragma: no cover - network dependent
            detail = error.read().decode("utf-8", "replace")[:400]
            return LLMResponse("", self.provider, self.model, error=f"HTTP {error.code}: {detail}")
        except Exception as error:  # pragma: no cover - network dependent
            return LLMResponse("", self.provider, self.model, error=str(error))

    # ------------------------------------------------------------------- providers
    def _openai(
        self,
        system: str,
        messages: list[LLMMessage],
        max_tokens: int | None,
        temperature: float | None,
    ) -> LLMResponse:
        payload = {
            "model": self.model,
            "messages": [{"role": "system", "content": system}]
            + [{"role": m.role, "content": m.content} for m in messages],
            "max_tokens": max_tokens or settings.max_output_tokens,
            "temperature": settings.temperature if temperature is None else temperature,
        }
        request = urllib.request.Request(
            "https://api.openai.com/v1/chat/completions",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {settings.openai_api_key}",
            },
        )
        with urllib.request.urlopen(request, timeout=settings.request_timeout) as response:
            body = json.loads(response.read().decode("utf-8"))
        text = body["choices"][0]["message"]["content"]
        return LLMResponse(text.strip(), "openai", self.model, body.get("usage", {}))

    def _anthropic(
        self,
        system: str,
        messages: list[LLMMessage],
        max_tokens: int | None,
        temperature: float | None,
    ) -> LLMResponse:
        payload = {
            "model": self.model,
            "system": system,
            "max_tokens": max_tokens or settings.max_output_tokens,
            "temperature": settings.temperature if temperature is None else temperature,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
        }
        request = urllib.request.Request(
            "https://api.anthropic.com/v1/messages",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "x-api-key": settings.anthropic_api_key,
                "anthropic-version": "2023-06-01",
            },
        )
        with urllib.request.urlopen(request, timeout=settings.request_timeout) as response:
            body = json.loads(response.read().decode("utf-8"))
        text = "".join(part.get("text", "") for part in body.get("content", []))
        return LLMResponse(text.strip(), "anthropic", self.model, body.get("usage", {}))


MENTOR_SYSTEM_PROMPT = """You are DRIPS Mentor, a patient senior engineer who teaches beginners.

Rules you must follow:
1. Explain before you change. Never rewrite code without saying what was wrong and why.
2. Use the findings, metrics and patches you are given as the source of truth. Do not
   invent problems that are not in that data.
3. Speak plainly. Short sentences. Define any term you use that a beginner would not know.
4. Prefer the smallest change that fixes the problem, then mention what to improve next.
5. Never claim code was applied to the user's files — a human approves every change.
6. When you are unsure, say so and show how the reader can verify it themselves.
"""


llm = LLMClient()
