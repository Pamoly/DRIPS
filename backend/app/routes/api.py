"""The REST + streaming surface of DRIPS.

Grouped by the part of the product it serves:

* **workspace** — files, the bootstrap payload the editor loads on start-up
* **intelligence** — analysis, health, dashboard rollups, the rule catalog
* **assistant** — the master chat, streaming its agent trace, and the review requests
* **approval** — patches: propose, decide, apply, revert (the human gate)
* **runtime** — sandboxed execution and its history
* **learning** — curriculum, lessons, XP
"""

from __future__ import annotations

import json
from typing import Any

from .. import __version__
from ..analyzer import RULES, analyze_text, detect_duplication, project_summary
from ..agents.base import AgentContext
from ..agents.orchestrator import orchestrator
from ..agents.patch_service import PatchConflict, patch_service
from ..config import settings
from ..learning import curriculum
from ..models import ReviewComment, ReviewRequest, RunResult, new_id
from ..router import ApiError, Request, Response, sse_event, stream
from ..runtime.runner import runner
from ..store import detect_language, grade_for, store


# --------------------------------------------------------------------------- helpers
def _require_file(path: str):
    file = store.get_file(path)
    if file is None:
        raise ApiError(f"No such file: {path}", status=404, available=[f["path"] for f in store.list_files()])
    return file


def _actor(request: Request) -> str:
    return request.q("actor") or request.headers.get("x-drips-actor") or "you"


def _analysis_for(file) -> dict:
    analysis = store.get_analysis(file.path)
    if analysis is None or analysis.revision != file.revision:
        analysis = analyze_text(file.content, file.path, file.language)
        analysis.revision = file.revision
        store.set_analysis(analysis)
    return analysis.to_dict()


def _context(file, autonomy: str | None = None, traceback_text: str = "") -> AgentContext:
    analysis = analyze_text(file.content, file.path, file.language)
    store.set_analysis(analysis)
    return AgentContext(
        file_path=file.path,
        source=file.content,
        language=file.language,
        analysis=analysis,
        learner_level=store.learner.title,
        autonomy=autonomy or store.autonomy,
        traceback_text=traceback_text,
        extra={"learner": store.learner},
    )


def build_router():
    from ..router import Router

    router = Router()

    # ------------------------------------------------------------------- service
    @router.get("/api/health")
    def health(request: Request) -> dict:
        return {
            "service": "DRIPS engine",
            "version": __version__,
            "status": "ok",
            "reasoning": settings.describe(),
            "autonomy": store.autonomy,
            "workspace": {
                "files": len(store.files),
                "analysed": len(store.analyses),
                "pending_patches": sum(1 for p in store.patches.values() if p.status == "proposed"),
                "open_reviews": sum(1 for r in store.reviews.values() if r.status in {"pending", "in-review"}),
            },
            "promise": (
                "Agents analyse, explain, debug and propose. A human approves every change to a file — "
                "that invitation is the product, not a limitation."
            ),
            "endpoints": sorted({f"{method} {path}" for method, path in _endpoint_list(router)}),
        }

    def _endpoint_list(r) -> list[tuple[str, str]]:
        return [
            ("GET", "/api/health"),
            ("GET", "/api/workspace"),
            ("GET", "/api/files"),
            ("POST", "/api/files"),
            ("GET", "/api/files/{path}"),
            ("PUT", "/api/files/{path}"),
            ("DELETE", "/api/files/{path}"),
            ("POST", "/api/files/{path}/analyze"),
            ("POST", "/api/analysis"),
            ("GET", "/api/health/overview"),
            ("GET", "/api/rules"),
            ("POST", "/api/chat"),
            ("GET", "/api/chat/stream"),
            ("POST", "/api/chat/stream"),
            ("GET", "/api/chat/history"),
            ("GET", "/api/patches"),
            ("POST", "/api/patches/propose"),
            ("POST", "/api/patches/{patch_id}/decision"),
            ("POST", "/api/patches/{patch_id}/apply"),
            ("POST", "/api/patches/{patch_id}/revert"),
            ("GET", "/api/reviews"),
            ("POST", "/api/reviews"),
            ("POST", "/api/reviews/{review_id}/decision"),
            ("POST", "/api/reviews/{review_id}/comments"),
            ("GET", "/api/audit"),
            ("POST", "/api/runtime/run"),
            ("GET", "/api/runtime/runs"),
            ("GET", "/api/learning"),
            ("POST", "/api/learning/complete"),
            ("POST", "/api/learning/lesson"),
            ("POST", "/api/autonomy"),
            ("POST", "/api/workspace/reset"),
        ]

    # ----------------------------------------------------------------- workspace
    @router.get("/api/workspace")
    def workspace(request: Request) -> dict:
        overview = store.health_overview()
        return {
            "files": store.list_files(),
            "overview": overview,
            "learner": store.learner.to_dict(),
            "level": curriculum.level_for_xp(store.learner.xp),
            "patches": store.list_patches(),
            "reviews": store.list_reviews(),
            "audit": store.list_audit(30),
            "runs": store.list_runs(10),
            "rules": [rule.__dict__ for rule in RULES.values()],
            "autonomy": store.autonomy,
            "reasoning": settings.describe(),
            "version": __version__,
        }

    @router.get("/api/files")
    def list_files(request: Request) -> dict:
        return {"files": store.list_files()}

    @router.post("/api/files")
    def create_file(request: Request) -> Response:
        path = (request.j("path") or "").strip()
        if not path:
            raise ApiError("A file needs a path, for example `cart.py`.", status=422)
        if store.get_file(path):
            raise ApiError(f"{path} already exists.", status=409)
        content = request.j("content")
        if content is None:
            content = _starter_for(detect_language(path))
        file = store.write_file(path, content, actor=_actor(request), reason="created")
        analysis = analyze_text(content, path, file.language)
        store.set_analysis(analysis)
        store.log("file.created", _actor(request), path, f"{len(content.splitlines())} lines")
        return Response.created({"file": file.to_dict(), "analysis": analysis.to_dict()})

    @router.get("/api/files/{path}")
    def get_file(request: Request) -> dict:
        file = _require_file(request.params["path"])
        return {"file": file.to_dict(), "analysis": _analysis_for(file), "patches": store.list_patches()}

    @router.put("/api/files/{path}")
    def update_file(request: Request) -> dict:
        file = _require_file(request.params["path"])
        content = request.j("content")
        if content is None:
            raise ApiError("Send the new file content in the `content` field.", status=422)
        updated = store.write_file(file.path, content, actor=_actor(request), reason=request.j("reason", "manual edit"))
        analysis = analyze_text(content, file.path, updated.language)
        analysis.revision = updated.revision
        store.set_analysis(analysis)
        return {"file": updated.to_dict(), "analysis": analysis.to_dict()}

    @router.delete("/api/files/{path}")
    def delete_file(request: Request) -> dict:
        path = request.params["path"]
        _require_file(path)
        store.delete_file(path, actor=_actor(request))
        return {"deleted": path}

    # ---------------------------------------------------------------- intelligence
    @router.post("/api/files/{path}/analyze")
    def analyze_file(request: Request) -> dict:
        file = _require_file(request.params["path"])
        analysis = analyze_text(file.content, file.path, file.language)
        analysis.revision = file.revision
        store.set_analysis(analysis)
        store.grant_badge("first-analysis", "First Scan", "Ran the health analysis on a file", "🔍")
        store.award_xp(8, f"analysed {file.path}")
        if analysis.health_score >= 90:
            store.grant_badge("clean-file", "Clean Sheet", "Brought a file to health 90+", "✨")
        return {
            "analysis": analysis.to_dict(),
            "summary": analysis.summary,
            "recommended_fixes": [f.to_dict() for f in analysis.findings if f.autofixable][:8],
        }

    @router.post("/api/analysis")
    def analyze_source(request: Request) -> dict:
        source = request.j("content") or ""
        path = request.j("path") or "snippet.txt"
        language = request.j("language") or detect_language(path)
        analysis = analyze_text(source, path, language)
        return {"analysis": analysis.to_dict(), "summary": analysis.summary}

    @router.get("/api/health/overview")
    def health_overview(request: Request) -> dict:
        sources = {file.path: file.content for file in store.files.values()}
        summary = project_summary(sources) if sources else {"analyses": {}}
        for path, payload in summary.get("analyses", {}).items():
            from ..models import FileAnalysis

            store.set_analysis(FileAnalysis.from_dict(payload))
        duplicates = detect_duplication(sources)
        overview = store.health_overview()
        overview["duplicates"] = [d.to_dict() for d in duplicates]
        overview["maintainability"] = summary.get("maintainability")
        criticals = sum(1 for analysis in store.analyses.values() for finding in analysis.findings if finding.severity == "critical")
        overview["critical_findings"] = criticals
        if criticals == 0 and store.analyses:
            store.grant_badge("zero-critical", "All Clear", "Workspace has no critical findings", "🏅")
        return overview

    @router.get("/api/rules")
    def rules(request: Request) -> dict:
        return {
            "count": len(RULES),
            "rules": [
                {
                    "id": rule.id,
                    "title": rule.title,
                    "severity": rule.severity,
                    "category": rule.category,
                    "why_it_matters": rule.why_it_matters,
                    "how_to_fix": rule.how_to_fix,
                    "autofixable": rule.autofixable,
                    "references": list(rule.references),
                    "weight": rule.weight,
                }
                for rule in RULES.values()
            ],
        }

    # ------------------------------------------------------------------ assistant
    def _chat_payload(request: Request) -> dict:
        message = (request.j("message") or request.q("message") or "").strip()
        if not message and not request.q("traceback"):
            raise ApiError("Tell me what you need — for example `explain this file`.", status=422)
        file_path = request.j("file") or request.q("file") or None
        return {
            "message": message or "debug this traceback",
            "file_path": file_path,
            "source": request.j("source"),
            "language": request.j("language"),
            "traceback_text": request.j("traceback") or request.q("traceback") or "",
            "actor": _actor(request),
            "session_id": request.j("session_id") or request.q("session_id") or None,
        }

    @router.post("/api/chat")
    def chat(request: Request) -> dict:
        payload = _chat_payload(request)
        result = orchestrator.run_sync(**payload)
        return result

    @router.post("/api/chat/stream")
    def chat_stream_post(request: Request):
        payload = _chat_payload(request)
        return stream(_stream_chat(**payload))

    @router.get("/api/chat/stream")
    def chat_stream_get(request: Request):
        payload = {
            "message": request.q("message") or "explain this file",
            "file_path": request.q("file") or None,
            "source": None,
            "language": None,
            "traceback_text": request.q("traceback"),
            "actor": _actor(request),
            "session_id": request.q("session_id") or None,
        }
        return stream(_stream_chat(**payload))

    def _stream_chat(**payload):
        # every frame carries a `type` field so a client can switch on one key
        yield sse_event("open", {"type": "open", "ok": True, "file": payload.get("file_path")})
        try:
            for event in orchestrator.handle(**payload):
                yield sse_event(event["type"], event)
        except Exception as error:  # the stream must always terminate cleanly
            yield sse_event("error", {"type": "error", "error": f"{type(error).__name__}: {error}"})
        yield sse_event("close", {"type": "close", "ok": True})

    @router.get("/api/chat/history")
    def chat_history(request: Request) -> dict:
        session_id = request.q("session_id")
        if session_id:
            return {"session_id": session_id, "messages": store.chat.get(session_id, [])}
        return {
            "sessions": [
                {"session_id": key, "messages": len(value), "last": value[-1] if value else None}
                for key, value in store.chat.items()
            ]
        }

    # ------------------------------------------------------------------- approval
    @router.get("/api/patches")
    def list_patches(request: Request) -> dict:
        return {"patches": store.list_patches(request.q("status") or None)}

    @router.post("/api/patches/propose")
    def propose_patches(request: Request) -> dict:
        path = request.j("file")
        if not path:
            raise ApiError("Which file should I fix? Pass `file`.", status=422)
        file = _require_file(path)
        context = _context(file, autonomy=request.j("autonomy"))
        patches = patch_service.propose_all(context, limit=int(request.j("limit") or 12))
        return {
            "patches": [patch.to_dict() for patch in patches],
            "needs_approval": True,
            "message": (
                f"{len(patches)} patch(es) proposed. Nothing has been written to {file.path}; "
                "approve them individually in the Review tab."
            ),
        }

    @router.post("/api/patches/{patch_id}/decision")
    def decide_patch(request: Request) -> dict:
        patch_id = request.params["patch_id"]
        if store.get_patch(patch_id) is None:
            raise ApiError(f"Unknown patch: {patch_id}", status=404)
        approve = bool(request.j("approve", False))
        patch = patch_service.decide(
            patch_id,
            approve=approve,
            actor=_actor(request),
            note=request.j("note", ""),
        )
        return {"patch": patch.to_dict(), "applied": False, "next": "POST /api/patches/{id}/apply to write it" if approve else None}

    @router.post("/api/patches/{patch_id}/apply")
    def apply_patch(request: Request) -> dict:
        try:
            return patch_service.apply(request.params["patch_id"], actor=_actor(request), force=bool(request.j("force", False)))
        except KeyError:
            raise ApiError("Unknown patch.", status=404)
        except PatchConflict as conflict:
            raise ApiError(str(conflict), status=409, kind="conflict")
        except ValueError as error:
            raise ApiError(str(error), status=403, kind="needs_approval")

    @router.post("/api/patches/{patch_id}/revert")
    def revert_patch(request: Request) -> dict:
        try:
            return patch_service.revert(request.params["patch_id"], actor=_actor(request))
        except KeyError:
            raise ApiError("Unknown patch.", status=404)
        except PatchConflict as conflict:
            raise ApiError(str(conflict), status=409, kind="conflict")

    @router.get("/api/reviews")
    def list_reviews(request: Request) -> dict:
        return {"reviews": store.list_reviews(request.q("status") or None)}

    @router.post("/api/reviews")
    def create_review(request: Request) -> Response:
        path = request.j("file")
        if not path:
            raise ApiError("Pass `file` — the file you want reviewed.", status=422)
        file = _require_file(path)
        context = _context(file)
        from ..agents.reviewer import reviewer_agent

        result = reviewer_agent.run(context)
        from ..models import ReviewComment as RC
        from ..models import ReviewRequest as RR

        payload = result.data["review"]
        review = RR.from_dict(payload)
        review.comments = [RC.from_dict(comment) for comment in payload.get("comments", [])]
        for patch in result.data.get("patches", []):
            from ..models import Patch

            store.add_patch(Patch.from_dict(patch))
        store.add_review(review)
        return Response.created({"review": store.get_review(review.id).to_dict(), "recommendation": result.data["decision"]})

    @router.post("/api/reviews/{review_id}/decision")
    def decide_review(request: Request) -> dict:
        review_id = request.params["review_id"]
        review = store.get_review(review_id)
        if review is None:
            raise ApiError("Unknown review.", status=404)
        decision = request.j("decision", "")
        mapping = {
            "approve": "approved",
            "approved": "approved",
            "reject": "rejected",
            "rejected": "rejected",
            "changes": "changes-requested",
            "changes-requested": "changes-requested",
            "start": "in-review",
        }
        if decision not in mapping:
            raise ApiError(
                "decision must be one of: approve, reject, changes-requested, start",
                status=422,
            )
        updated = store.update_review(
            review_id,
            status=mapping[decision],
            decision_note=request.j("note", ""),
            reviewer=_actor(request),
        )
        if mapping[decision] == "approved":
            store.grant_badge("reviewer", "Reviewer", "Approved a change after reading the diff", "👀")
            store.award_xp(15, "completed a review")
        return {"review": updated.to_dict()}

    @router.post("/api/reviews/{review_id}/comments")
    def add_comment(request: Request) -> dict:
        review = store.get_review(request.params["review_id"])
        if review is None:
            raise ApiError("Unknown review.", status=404)
        body = (request.j("body") or "").strip()
        if not body:
            raise ApiError("A comment needs a body.", status=422)
        comment = ReviewComment(
            id=new_id("rc"),
            author=_actor(request),
            body=body,
            line=int(request.j("line") or 1),
            kind=request.j("kind") or "comment",
        )
        updated = store.add_review_comment(review.id, comment)
        return {"review": updated.to_dict()}

    @router.get("/api/audit")
    def audit(request: Request) -> dict:
        return {"events": store.list_audit(int(request.q("limit") or 60))}

    # -------------------------------------------------------------------- runtime
    @router.post("/api/runtime/run")
    def run_file(request: Request) -> dict:
        path = request.j("file")
        source = request.j("source")
        language = request.j("language")
        if path and not source:
            file = _require_file(path)
            source, language = file.content, file.language
            path = file.path
        if source is None:
            raise ApiError("Pass `file` (a workspace path) or `source` (raw code).", status=422)
        result = runner.run_source(source, path or "snippet", language or detect_language(path or "snippet.txt"), request.j("stdin", ""))
        store.add_run(result)
        payload: dict[str, Any] = {"run": result.to_dict()}
        if result.exit_code != 0:
            from ..agents.debugger import debugger_agent

            context = AgentContext(
                file_path=path or "snippet",
                source=source,
                language=language or "python",
                analysis=analyze_text(source, path or "snippet", language or "python"),
                traceback_text=result.stderr,
            )
            diagnosis = debugger_agent.run(context)
            payload["diagnosis"] = {**diagnosis.to_payload(), "patch_ids": diagnosis.data.get("patch_ids", [])}
            for patch in diagnosis.data.get("patches", [])[:3]:
                from ..models import Patch

                stored = store.add_patch(Patch.from_dict(patch))
                payload.setdefault("patches", []).append(stored.to_dict())
        return payload

    @router.get("/api/runtime/runs")
    def list_runs(request: Request) -> dict:
        return {"runs": store.list_runs(int(request.q("limit") or 20))}

    # -------------------------------------------------------------------- learning
    @router.get("/api/learning")
    def learning(request: Request) -> dict:
        findings = [f.to_dict() for analysis in store.analyses.values() for f in analysis.findings]
        learner = store.learner
        level = curriculum.level_for_xp(learner.xp)
        return {
            "learner": learner.to_dict(),
            "level": level,
            "levels": curriculum.LEVELS,
            "badges": [{"id": key, "name": value[0], "description": value[1], "icon": value[2]} for key, value in curriculum.BADGES.items()],
            "tracks": [
                {
                    "id": track["id"],
                    "name": track["name"],
                    "level": track["level"],
                    "summary": track["summary"],
                    "lessons": [
                        {
                            "id": lesson.id,
                            "title": lesson.title,
                            "skill": lesson.skill,
                            "minutes": lesson.minutes,
                            "why": lesson.why,
                            "rules": lesson.rules,
                            "completed": lesson.id in learner.completed_lessons,
                        }
                        for lesson in track["lessons"]
                    ],
                }
                for track in curriculum.TRACKS
            ],
            "recommended_track": curriculum.recommend_track(findings),
            "next_lessons": curriculum.next_lessons(findings, learner.completed_lessons),
        }

    @router.post("/api/learning/lesson")
    def lesson_detail(request: Request) -> dict:
        lesson_id = request.j("lesson") or request.q("lesson")
        for track in curriculum.TRACKS:
            for lesson in track["lessons"]:
                if lesson.id == lesson_id:
                    return {
                        "lesson": {
                            "id": lesson.id,
                            "title": lesson.title,
                            "skill": lesson.skill,
                            "minutes": lesson.minutes,
                            "why": lesson.why,
                            "read": lesson.read,
                            "practice": lesson.practice,
                            "check": lesson.check,
                            "rules": lesson.rules,
                            "track": track["name"],
                        }
                    }
        raise ApiError(f"Unknown lesson: {lesson_id}", status=404)

    @router.post("/api/learning/complete")
    def complete_lesson(request: Request) -> dict:
        lesson_id = request.j("lesson")
        if not lesson_id:
            raise ApiError("Pass the `lesson` id you finished.", status=422)
        if lesson_id not in store.learner.completed_lessons:
            store.learner.completed_lessons.append(lesson_id)
        store.award_xp(int(request.j("xp") or 25), f"completed lesson {lesson_id}")
        store.grant_badge("learner", "Student", "Completed a lesson from the path", "🎓")
        store.save()
        return {"learner": store.learner.to_dict(), "level": curriculum.level_for_xp(store.learner.xp)}

    # ------------------------------------------------------------------ meta / ops
    @router.post("/api/autonomy")
    def set_autonomy(request: Request) -> dict:
        mode = request.j("mode", "")
        if mode not in {"manual", "supervised", "autopilot"}:
            raise ApiError("mode must be manual, supervised or autopilot", status=422)
        store.autonomy = mode
        store.log("policy.autonomy", _actor(request), "workspace", f"autonomy set to {mode}")
        store.save()
        return {
            "autonomy": mode,
            "explanation": {
                "manual": "I explain and point things out. I never propose patches unless you ask.",
                "supervised": "I propose patches with diffs; you approve each one before it is written. (default)",
                "autopilot": "I apply only provably safe transformations, then file a review you can revert in one click.",
            }[mode],
        }

    @router.post("/api/workspace/reset")
    def reset_workspace(request: Request) -> dict:
        store.files.clear()
        store.analyses.clear()
        store.patches.clear()
        store.reviews.clear()
        store.runs.clear()
        store._seed()
        store.save()
        return {"files": store.list_files(), "reset": True}

    return router


def _starter_for(language: str) -> str:
    if language == "python":
        return (
            '"""New file created from the DRIPS editor."""\n\n'
            "from __future__ import annotations\n\n\n"
            "def main() -> None:\n"
            '    """Say hello.\n\n'
            "    Run this file and then ask the mentor to explain it line by line.\n"
            '    """\n'
            '    print("hello from DRIPS")\n\n\n'
            'if __name__ == "__main__":\n'
            "    main()\n"
        )
    if language in {"javascript", "typescript"}:
        return (
            "// New file created from the DRIPS editor.\n"
            "// Run it, then ask the mentor to explain it line by line.\n\n"
            "function main() {\n"
            "  const message = \"hello from DRIPS\";\n"
            "  console.log(message);\n"
            "}\n\n"
            "main();\n"
        )
    return "# New file created from the DRIPS editor.\n"
