"""Domain model for the DRIPS engine.

Plain dataclasses (no third-party validation library) that serialise to JSON for the
web client. Keeping the model here makes the API contract explicit and testable.
"""

from __future__ import annotations

import time
import uuid
from dataclasses import asdict, dataclass, field
from typing import Any, Literal

Severity = Literal["critical", "major", "minor", "info"]
Category = Literal[
    "bug",
    "security",
    "performance",
    "complexity",
    "style",
    "docs",
    "tests",
    "maintainability",
    "best-practice",
]
PatchStatus = Literal["proposed", "approved", "rejected", "applied", "reverted", "expired"]
ReviewStatus = Literal["pending", "in-review", "approved", "changes-requested", "rejected"]


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def now() -> float:
    return round(time.time(), 3)


class Serializable:
    """Mixin giving dataclasses a stable ``to_dict``/``from_dict`` round trip."""

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)  # type: ignore[arg-type]

    @classmethod
    def from_dict(cls, payload: dict[str, Any]):
        fields = {f for f in cls.__dataclass_fields__}  # type: ignore[attr-defined]
        return cls(**{k: v for k, v in payload.items() if k in fields})  # type: ignore[misc]


@dataclass
class Finding(Serializable):
    """A single problem identified by a static rule or by an agent."""

    id: str
    rule: str
    title: str
    message: str
    severity: Severity
    category: Category
    line: int
    column: int = 1
    end_line: int | None = None
    snippet: str = ""
    why_it_matters: str = ""
    how_to_fix: str = ""
    autofixable: bool = False
    confidence: float = 0.8
    source: str = "static"  # static | agent | runtime
    references: list[str] = field(default_factory=list)
    tags: list[str] = field(default_factory=list)


@dataclass
class Metrics(Serializable):
    """Numeric health signals for one file (or a whole project)."""

    lines: int = 0
    code_lines: int = 0
    comment_lines: int = 0
    blank_lines: int = 0
    functions: int = 0
    classes: int = 0
    max_complexity: int = 0
    avg_complexity: float = 0.0
    max_function_length: int = 0
    max_nesting: int = 0
    docstring_coverage: float = 0.0
    comment_ratio: float = 0.0
    duplication: float = 0.0
    todo_count: int = 0
    imports: int = 0
    test_ratio: float = 0.0
    maintainability: float = 0.0
    extra: dict[str, Any] = field(default_factory=dict)


@dataclass
class FileAnalysis(Serializable):
    """Result of analysing one file."""

    path: str
    language: str
    findings: list[Finding] = field(default_factory=list)
    metrics: Metrics = field(default_factory=Metrics)
    health_score: float = 100.0
    grade: str = "A"
    summary: str = ""
    analyzed_at: float = field(default_factory=now)
    duration_ms: float = 0.0
    revision: int = 0

    def severity_counts(self) -> dict[str, int]:
        counts = {"critical": 0, "major": 0, "minor": 0, "info": 0}
        for finding in self.findings:
            counts[finding.severity] = counts.get(finding.severity, 0) + 1
        return counts


@dataclass
class Patch(Serializable):
    """A proposed change. Never applied without an explicit human decision."""

    id: str
    file_path: str
    finding_id: str | None
    title: str
    rationale: str
    diff: str
    original: str
    patched: str
    confidence: float = 0.7
    risk: Severity = "minor"
    status: PatchStatus = "proposed"
    created_by: str = "fixer-agent"
    created_at: float = field(default_factory=now)
    decided_at: float | None = None
    decided_by: str | None = None
    decision_note: str = ""
    learning_note: str = ""
    verification: dict[str, Any] = field(default_factory=dict)


@dataclass
class ReviewComment(Serializable):
    id: str
    author: str
    body: str
    line: int = 1
    kind: Literal["comment", "suggestion", "blocker", "praise"] = "comment"
    resolved: bool = False
    created_at: float = field(default_factory=now)


@dataclass
class ReviewRequest(Serializable):
    """Human-in-the-loop gate: agents may recommend, humans decide."""

    id: str
    file_path: str
    title: str
    summary: str
    author: str = "mentor-agent"
    reviewer: str = "you"
    status: ReviewStatus = "pending"
    checklist: list[dict[str, Any]] = field(default_factory=list)
    comments: list[ReviewComment] = field(default_factory=list)
    patch_ids: list[str] = field(default_factory=list)
    risk: Severity = "minor"
    created_at: float = field(default_factory=now)
    updated_at: float = field(default_factory=now)
    decision_at: float | None = None
    decision_note: str = ""


@dataclass
class RunResult(Serializable):
    id: str
    file_path: str
    language: str
    command: str
    exit_code: int
    stdout: str
    stderr: str
    duration_ms: float
    timed_out: bool = False
    created_at: float = field(default_factory=now)
    traceback_summary: str = ""


@dataclass
class ChatMessage(Serializable):
    id: str
    role: Literal["user", "assistant", "system", "tool"]
    content: str
    created_at: float = field(default_factory=now)
    agent: str = "mentor"
    kind: str = "text"  # text | plan | finding | patch | review | run | quiz
    data: dict[str, Any] = field(default_factory=dict)


@dataclass
class AgentStep(Serializable):
    """One observable step of the master assistant's plan — the agent trace."""

    id: str
    agent: str
    action: str
    detail: str
    status: Literal["running", "done", "failed", "skipped"] = "running"
    started_at: float = field(default_factory=now)
    finished_at: float | None = None
    result: dict[str, Any] = field(default_factory=dict)


@dataclass
class WorkspaceFile(Serializable):
    path: str
    content: str
    language: str = "python"
    updated_at: float = field(default_factory=now)
    revision: int = 1  # revision 1 is the original content; every write bumps it


@dataclass
class LearnerProfile(Serializable):
    id: str = "learner"
    name: str = "Alex"
    level_n: int = 1
    title: str = "Curious Beginner"
    xp: int = 0
    streak_days: int = 1
    skills: dict[str, float] = field(default_factory=dict)
    badges: list[dict[str, Any]] = field(default_factory=list)
    completed_lessons: list[str] = field(default_factory=list)
    updated_at: float = field(default_factory=now)


@dataclass
class AuditEvent(Serializable):
    """Append-only trail: who/what changed the code, and whether a human signed off."""

    id: str
    action: str
    actor: str
    target: str
    detail: str = ""
    created_at: float = field(default_factory=now)
    metadata: dict[str, Any] = field(default_factory=dict)
