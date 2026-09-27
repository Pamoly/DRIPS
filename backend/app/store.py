"""In-process workspace store with JSON persistence.

The engine keeps everything (files, analyses, patches, reviews, runs, audit trail,
learner profile) in memory behind a lock and mirrors it to
``backend/data/workspace.json`` so the editor survives a restart. Swapping this module
for a real database is a contained change: every access goes through ``Store``.
"""

from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import Any

from .config import ROOT, settings
from .models import (
    AuditEvent,
    FileAnalysis,
    LearnerProfile,
    Patch,
    ReviewComment,
    ReviewRequest,
    RunResult,
    WorkspaceFile,
    new_id,
    now,
)

LANGUAGE_BY_SUFFIX = {
    ".py": "python",
    ".pyw": "python",
    ".js": "javascript",
    ".mjs": "javascript",
    ".cjs": "javascript",
    ".jsx": "javascript",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".json": "json",
    ".md": "markdown",
    ".html": "html",
    ".css": "css",
    ".java": "java",
    ".go": "go",
    ".rs": "rust",
    ".rb": "ruby",
    ".php": "php",
    ".sql": "sql",
    ".yml": "yaml",
    ".yaml": "yaml",
    ".sh": "shell",
}


def detect_language(path: str) -> str:
    return LANGUAGE_BY_SUFFIX.get(Path(path).suffix.lower(), "plaintext")


DEFAULT_AUTONOMY_NOTE = (
    "Agents analyse and propose. Nothing is written to your files until a human "
    "approves the patch in the Review tab."
)


class Store:
    """Thread-safe workspace state."""

    def __init__(self, workspace_file: Path | None = None) -> None:
        self._lock = threading.RLock()
        self._path = Path(workspace_file or settings.workspace_file)
        self.files: dict[str, WorkspaceFile] = {}
        self.analyses: dict[str, FileAnalysis] = {}
        self.patches: dict[str, Patch] = {}
        self.reviews: dict[str, ReviewRequest] = {}
        self.runs: list[RunResult] = []
        self.audit: list[AuditEvent] = []
        self.chat: dict[str, list[dict[str, Any]]] = {}
        self.learner = LearnerProfile()
        self.autonomy = settings.autonomy
        self._load()

    # ------------------------------------------------------------------ seeding
    def _seed(self) -> None:
        samples_dir = ROOT / "samples"
        if samples_dir.is_dir():
            for path in sorted(samples_dir.iterdir()):
                if path.is_file() and path.suffix in LANGUAGE_BY_SUFFIX:
                    self.files[path.name] = WorkspaceFile(
                        path=path.name,
                        content=path.read_text(encoding="utf-8"),
                        language=detect_language(path.name),
                    )
        if not self.files:
            self.files["playground.py"] = WorkspaceFile(
                path="playground.py",
                content='def greet(name):\n    return "Hello, " + name\n\n\nprint(greet("world"))\n',
                language="python",
            )
        self._log("workspace.seeded", "system", "workspace", f"{len(self.files)} files loaded")

    # -------------------------------------------------------------- persistence
    def _load(self) -> None:
        if self._path.is_file():
            try:
                payload = json.loads(self._path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                payload = {}
            for raw in payload.get("files", []):
                file = WorkspaceFile.from_dict(raw)
                self.files[file.path] = file
            for raw in payload.get("patches", []):
                patch = Patch.from_dict(raw)
                self.patches[patch.id] = patch
            for raw in payload.get("reviews", []):
                review = ReviewRequest.from_dict(raw)
                review.comments = [ReviewComment.from_dict(c) for c in raw.get("comments", [])]
                self.reviews[review.id] = review
            for raw in payload.get("runs", [])[-50:]:
                self.runs.append(RunResult.from_dict(raw))
            for raw in payload.get("audit", [])[-300:]:
                self.audit.append(AuditEvent.from_dict(raw))
            if payload.get("learner"):
                self.learner = LearnerProfile.from_dict(payload["learner"])
            self.autonomy = payload.get("autonomy", self.autonomy)
        if not self.files:
            self._seed()

    def _save_locked(self) -> None:
        payload = {
            "saved_at": now(),
            "autonomy": self.autonomy,
            "files": [f.to_dict() for f in self.files.values()],
            "patches": [p.to_dict() for p in self.patches.values()],
            "reviews": [r.to_dict() for r in self.reviews.values()],
            "runs": [r.to_dict() for r in self.runs[-50:]],
            "audit": [e.to_dict() for e in self.audit[-300:]],
            "learner": self.learner.to_dict(),
        }
        self._path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self._path.with_suffix(".tmp")
        tmp.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
        tmp.replace(self._path)

    def save(self) -> None:
        with self._lock:
            self._save_locked()

    # -------------------------------------------------------------------- files
    def list_files(self) -> list[dict[str, Any]]:
        with self._lock:
            items = []
            for file in sorted(self.files.values(), key=lambda f: f.path):
                analysis = self.analyses.get(file.path)
                items.append(
                    {
                        **file.to_dict(),
                        "health_score": analysis.health_score if analysis else None,
                        "grade": analysis.grade if analysis else None,
                        "finding_count": len(analysis.findings) if analysis else 0,
                    }
                )
            return items

    def get_file(self, path: str) -> WorkspaceFile | None:
        with self._lock:
            return self.files.get(path)

    def read_content(self, path: str) -> str:
        file = self.get_file(path)
        if file is None:
            raise KeyError(path)
        return file.content

    def write_file(self, path: str, content: str, actor: str = "user", reason: str = "") -> WorkspaceFile:
        with self._lock:
            language = (self.files[path].language if path in self.files else detect_language(path))
            file = WorkspaceFile(
                path=path,
                content=content,
                language=language,
                revision=(self.files[path].revision + 1) if path in self.files else 1,
            )
            self.files[path] = file
            self.analyses.pop(path, None)
            self._log("file.write", actor, path, reason or f"revision {file.revision}")
            self._save_locked()
            return file

    def delete_file(self, path: str, actor: str = "user") -> bool:
        with self._lock:
            existed = self.files.pop(path, None) is not None
            self.analyses.pop(path, None)
            if existed:
                self._log("file.delete", actor, path)
                self._save_locked()
            return existed

    def touch_revision(self, path: str) -> None:
        with self._lock:
            if path in self.files:
                self.files[path].revision += 1
                self.files[path].updated_at = now()

    # ---------------------------------------------------------------- analyses
    def set_analysis(self, analysis: FileAnalysis) -> None:
        with self._lock:
            self.analyses[analysis.path] = analysis

    def get_analysis(self, path: str) -> FileAnalysis | None:
        with self._lock:
            return self.analyses.get(path)

    def invalidate(self, path: str) -> None:
        with self._lock:
            self.analyses.pop(path, None)

    def health_overview(self) -> dict[str, Any]:
        """Project-level rollup used by the dashboard."""
        with self._lock:
            files = list(self.files.values())
            analyses = [self.analyses[f.path] for f in files if f.path in self.analyses]
            total_findings = sum(len(a.findings) for a in analyses)
            severities = {"critical": 0, "major": 0, "minor": 0, "info": 0}
            for analysis in analyses:
                for key, value in analysis.severity_counts().items():
                    severities[key] += value
            score = round(sum(a.health_score for a in analyses) / len(analyses), 1) if analyses else None
            hotspots = sorted(analyses, key=lambda a: a.health_score)[:5]
            return {
                "files": len(files),
                "analyzed": len(analyses),
                "average_health": score,
                "grade": grade_for(score) if score is not None else None,
                "findings": total_findings,
                "severities": severities,
                "pending_patches": sum(1 for p in self.patches.values() if p.status == "proposed"),
                "approved_patches": sum(1 for p in self.patches.values() if p.status in {"approved", "applied"}),
                "open_reviews": sum(1 for r in self.reviews.values() if r.status in {"pending", "in-review"}),
                "hotspots": [
                    {
                        "path": a.path,
                        "health_score": a.health_score,
                        "grade": a.grade,
                        "top_issue": a.findings[0].title if a.findings else "",
                    }
                    for a in hotspots
                ],
                "autonomy": self.autonomy,
                "note": DEFAULT_AUTONOMY_NOTE,
            }

    # ------------------------------------------------------------------ patches
    def add_patch(self, patch: Patch) -> Patch:
        with self._lock:
            self.patches[patch.id] = patch
            self._log("patch.proposed", patch.created_by, patch.file_path, patch.title, {"patch_id": patch.id})
            self._save_locked()
            return patch

    def list_patches(self, status: str | None = None) -> list[dict[str, Any]]:
        with self._lock:
            items = sorted(self.patches.values(), key=lambda p: p.created_at, reverse=True)
            if status:
                items = [p for p in items if p.status == status]
            return [p.to_dict() for p in items]

    def get_patch(self, patch_id: str) -> Patch | None:
        with self._lock:
            return self.patches.get(patch_id)

    def decide_patch(self, patch_id: str, approve: bool, actor: str, note: str = "", edits: str | None = None) -> Patch:
        """Record a human decision. This is the only path that makes a patch applicable."""
        with self._lock:
            patch = self.patches.get(patch_id)
            if patch is None:
                raise KeyError(patch_id)
            if edits is not None:
                patch.patched = edits
                patch.diff = ""  # recomputed by the caller
            patch.status = "approved" if approve else "rejected"
            patch.decided_at = now()
            patch.decided_by = actor
            patch.decision_note = note
            self._log(
                "patch.approved" if approve else "patch.rejected",
                actor,
                patch.file_path,
                note or patch.title,
                {"patch_id": patch.id, "confidence": patch.confidence},
            )
            self._save_locked()
            return patch

    def mark_patch(self, patch_id: str, status: str, actor: str, note: str = "") -> Patch:
        with self._lock:
            patch = self.patches[patch_id]
            patch.status = status  # type: ignore[assignment]
            patch.decided_at = now()
            patch.decided_by = actor
            if note:
                patch.decision_note = note
            self._log(f"patch.{status}", actor, patch.file_path, note or patch.title, {"patch_id": patch.id})
            self._save_locked()
            return patch

    # ------------------------------------------------------------------ reviews
    def add_review(self, review: ReviewRequest) -> ReviewRequest:
        with self._lock:
            self.reviews[review.id] = review
            self._log("review.requested", review.author, review.file_path, review.title, {"review_id": review.id})
            self._save_locked()
            return review

    def list_reviews(self, status: str | None = None) -> list[dict[str, Any]]:
        with self._lock:
            items = sorted(self.reviews.values(), key=lambda r: r.updated_at, reverse=True)
            if status:
                items = [r for r in items if r.status == status]
            return [r.to_dict() for r in items]

    def get_review(self, review_id: str) -> ReviewRequest | None:
        with self._lock:
            return self.reviews.get(review_id)

    def update_review(self, review_id: str, **changes: Any) -> ReviewRequest:
        with self._lock:
            review = self.reviews.get(review_id)
            if review is None:
                raise KeyError(review_id)
            for key, value in changes.items():
                if hasattr(review, key):
                    setattr(review, key, value)
            review.updated_at = now()
            if review.status in {"approved", "rejected", "changes-requested"} and review.decision_at is None:
                review.decision_at = now()
            self._log(f"review.{review.status}", changes.get("actor", "reviewer"), review.file_path, review.title, {"review_id": review.id})
            self._save_locked()
            return review

    def add_review_comment(self, review_id: str, comment: ReviewComment) -> ReviewRequest:
        with self._lock:
            review = self.reviews.get(review_id)
            if review is None:
                raise KeyError(review_id)
            review.comments.append(comment)
            review.updated_at = now()
            self._log("review.comment", comment.author, review.file_path, comment.body[:120], {"review_id": review_id})
            self._save_locked()
            return review

    # --------------------------------------------------------------------- runs
    def add_run(self, run: RunResult) -> RunResult:
        with self._lock:
            self.runs.append(run)
            self.runs = self.runs[-100:]
            self._log(
                "runtime.run",
                "user",
                run.file_path,
                f"exit={run.exit_code}{' (timeout)' if run.timed_out else ''}",
                {"run_id": run.id, "duration_ms": run.duration_ms},
            )
            self._save_locked()
            return run

    def list_runs(self, limit: int = 20) -> list[dict[str, Any]]:
        with self._lock:
            return [r.to_dict() for r in reversed(self.runs[-limit:])]

    # ------------------------------------------------------------------- audit
    def _log(self, action: str, actor: str, target: str, detail: str = "", metadata: dict[str, Any] | None = None) -> None:
        self.audit.append(
            AuditEvent(
                id=new_id("ev"),
                action=action,
                actor=actor,
                target=target,
                detail=detail,
                metadata=metadata or {},
            )
        )
        self.audit = self.audit[-500:]

    def log(self, action: str, actor: str, target: str, detail: str = "", metadata: dict[str, Any] | None = None) -> None:
        with self._lock:
            self._log(action, actor, target, detail, metadata)
            self._save_locked()

    def list_audit(self, limit: int = 60) -> list[dict[str, Any]]:
        with self._lock:
            return [e.to_dict() for e in reversed(self.audit[-limit:])]

    # ------------------------------------------------------------------ learner
    def award_xp(self, amount: int, reason: str) -> LearnerProfile:
        with self._lock:
            self.learner.xp += max(0, amount)
            self.learner.level_n = 1 + self.learner.xp // 250
            self._log("learner.xp", "mentor-agent", self.learner.id, f"+{amount} XP — {reason}")
            self._save_locked()
            return self.learner

    def grant_badge(self, badge_id: str, name: str, description: str, icon: str = "star") -> None:
        with self._lock:
            if any(b.get("id") == badge_id for b in self.learner.badges):
                return
            self.learner.badges.append(
                {"id": badge_id, "name": name, "description": description, "icon": icon, "earned_at": now()}
            )
            self._log("learner.badge", "mentor-agent", badge_id, name)
            self._save_locked()


def grade_for(score: float | None) -> str:
    if score is None:
        return "—"
    if score >= 90:
        return "A"
    if score >= 80:
        return "B"
    if score >= 70:
        return "C"
    if score >= 60:
        return "D"
    return "F"


store = Store()
