"""Shared plumbing for the agents.

Design rule used throughout DRIPS: **the deterministic engine establishes facts, the
language model narrates them.** Findings, patches and scores always come from code that
can be unit tested; the LLM is only allowed to improve wording, answer free-form
questions and suggest *additional* findings, which are marked ``source="agent"`` and
carry a lower confidence so a human knows they were not machine-verified.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Iterable

from ..models import FileAnalysis, Finding


@dataclass
class AgentContext:
    """Everything an agent needs about the current editing session."""

    file_path: str
    source: str
    language: str = "python"
    analysis: FileAnalysis | None = None
    learner_level: str = "beginner"
    autonomy: str = "supervised"
    traceback_text: str = ""
    question: str = ""
    selection: str = ""
    extra: dict[str, Any] = field(default_factory=dict)

    @property
    def lines(self) -> list[str]:
        return self.source.splitlines()

    def line(self, number: int) -> str:
        lines = self.lines
        if 1 <= number <= len(lines):
            return lines[number - 1]
        return ""

    def findings(self, min_severity: str | None = None) -> list[Finding]:
        if not self.analysis:
            return []
        order = {"critical": 0, "major": 1, "minor": 2, "info": 3}
        items = self.analysis.findings
        if min_severity:
            items = [f for f in items if order.get(f.severity, 4) <= order.get(min_severity, 3)]
        return sorted(items, key=lambda f: (order.get(f.severity, 4), f.line))


@dataclass
class AgentResult:
    """What an agent returns: prose for the chat plus structured payloads for the UI."""

    agent: str
    headline: str
    markdown: str
    data: dict[str, Any] = field(default_factory=dict)
    follow_ups: list[str] = field(default_factory=list)
    xp: int = 0
    badge: tuple[str, str, str, str] | None = None  # id, name, description, icon

    def to_payload(self) -> dict[str, Any]:
        return {
            "agent": self.agent,
            "headline": self.headline,
            "markdown": self.markdown,
            "data": self.data,
            "follow_ups": self.follow_ups,
            "xp": self.xp,
        }


class Agent:
    """Base class: subclasses implement :meth:`run`."""

    name = "agent"
    description = ""
    keywords: tuple[str, ...] = ()

    def run(self, context: AgentContext) -> AgentResult:  # pragma: no cover - interface
        raise NotImplementedError

    # ------------------------------------------------------------------ helpers
    @staticmethod
    def bullet(items: Iterable[str], marker: str = "-") -> str:
        return "\n".join(f"{marker} {item}" for item in items if item)

    @staticmethod
    def code_block(code: str, language: str = "") -> str:
        return f"```{language}\n{code}\n```"

    @staticmethod
    def severity_icon(severity: str) -> str:
        return {
            "critical": "🛑",
            "major": "⚠️",
            "minor": "🔸",
            "info": "ℹ️",
        }.get(severity, "•")
