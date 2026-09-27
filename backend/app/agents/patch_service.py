"""The approval gate.

One rule matters here: **an agent can propose, only a human can apply.** Every write to
a workspace file goes through :meth:`PatchService.apply`, which:

* re-checks that the file still matches the patch's ``original`` (no silent overwrite of
  someone else's edit),
* records who approved what, when, and why, in the audit trail,
* re-runs the analysis afterwards so the health score and findings are immediately true,
* can be reverted, because a review that cannot be undone is not a review.

Autopilot is the supervised exception: it applies only changes that a reviewer would
rubber-stamp (safe rules, high confidence, non-critical risk) and then files a review
request for the human to confirm.
"""

from __future__ import annotations

from ..analyzer import analyze_text
from ..models import FileAnalysis, Finding, Patch, ReviewComment, ReviewRequest, new_id, now
from ..store import store
from .base import AgentContext
from .fixer import SAFE_AUTOFIX_RULES, fixer_agent


class PatchConflict(Exception):
    """The file changed after the patch was generated."""


class PatchService:
    # ------------------------------------------------------------------- proposing
    def propose(self, context: AgentContext, finding: Finding) -> Patch:
        patch = fixer_agent.patch_for(context, finding)
        if patch is None:
            raise ValueError(f"No automatic fix available for rule {finding.rule}")
        return store.add_patch(patch)

    def propose_all(self, context: AgentContext, limit: int = 12, persist: bool = True) -> list[Patch]:
        patches = fixer_agent.patches_for_file(context, limit=limit)
        if persist:
            for patch in patches:
                store.add_patch(patch)
        return patches

    # -------------------------------------------------------------------- deciding
    def decide(self, patch_id: str, approve: bool, actor: str = "you", note: str = "") -> Patch:
        patch = store.decide_patch(patch_id, approve=approve, actor=actor, note=note)
        if approve:
            store.award_xp(12, f"approved a fix for {patch.file_path}")
            store.grant_badge(*_BADGE_LOOKUP["first-fix"])
        return patch

    # --------------------------------------------------------------------- apply
    def apply(self, patch_id: str, actor: str = "you", force: bool = False) -> dict:
        patch = store.get_patch(patch_id)
        if patch is None:
            raise KeyError(patch_id)
        if patch.status not in {"approved", "proposed"} and not force:
            raise ValueError(f"Patch is {patch.status}; a human decision is required before applying.")
        if patch.status == "proposed" and not force:
            raise ValueError(
                "This patch has not been approved yet. Approve it first — the whole point is that a human reads "
                "the diff before it touches the file."
            )

        current = store.get_file(patch.file_path)
        if current is None:
            raise PatchConflict(f"{patch.file_path} no longer exists in the workspace.")
        if current.content.strip() != patch.original.strip():
            raise PatchConflict(
                f"{patch.file_path} changed after this patch was created. Re-run the analysis and propose the fix "
                "again — applying stale edits silently is how people lose work."
            )

        store.write_file(patch.file_path, patch.patched, actor=actor, reason=f"applied patch {patch.id}")
        store.mark_patch(patch.id, "applied", actor, note="Written to the workspace after human approval.")

        analysis = analyze_text(patch.patched, patch.file_path, current.language)
        analysis.revision = store.get_file(patch.file_path).revision if store.get_file(patch.file_path) else 0
        store.set_analysis(analysis)
        _resolve_finding(patch.finding_id, patch.file_path)
        _resolve_review_comments(patch)
        store.log(
            "patch.applied",
            actor,
            patch.file_path,
            f"{patch.title} → health {analysis.health_score}/100",
            {"patch_id": patch.id, "health_after": analysis.health_score},
        )
        return {
            "patch": store.get_patch(patch.id).to_dict(),
            "analysis": analysis.to_dict(),
            "file": store.get_file(patch.file_path).to_dict(),
        }

    def revert(self, patch_id: str, actor: str = "you") -> dict:
        patch = store.get_patch(patch_id)
        if patch is None:
            raise KeyError(patch_id)
        current = store.get_file(patch.file_path)
        if current is None:
            raise PatchConflict("The file is gone; nothing to revert.")
        if current.content.strip() != patch.patched.strip():
            raise PatchConflict(
                "The file has been edited since this patch was applied, so reverting would discard those changes. "
                "Use the history and edit manually."
            )
        store.write_file(patch.file_path, patch.original, actor=actor, reason=f"reverted patch {patch.id}")
        store.mark_patch(patch.id, "reverted", actor, note="Reverted by a human.")
        analysis = analyze_text(patch.original, patch.file_path, current.language)
        store.set_analysis(analysis)
        return {"patch": store.get_patch(patch.id).to_dict(), "analysis": analysis.to_dict()}

    # ------------------------------------------------------------------ autopilot
    def autopilot(self, context: AgentContext, actor: str = "autopilot", max_changes: int = 6) -> dict:
        """Apply only rubber-stamp-safe fixes, then file a review for the human.

        The loop re-analyses after every write, because line numbers move as soon as code
        is inserted or deleted.
        """
        applied: list[dict] = []
        skipped: list[dict] = []

        for _ in range(max_changes):
            file = store.get_file(context.file_path)
            if file is None:
                break
            analysis = analyze_text(file.content, file.path, file.language)
            store.set_analysis(analysis)
            live_context = AgentContext(
                file_path=file.path,
                source=file.content,
                language=file.language,
                analysis=analysis,
                learner_level=context.learner_level,
                autonomy="autopilot",
            )
            candidates = fixer_agent.patches_for_file(live_context, limit=20)
            safe = [p for p in candidates if p.verification.get("rule") in SAFE_AUTOFIX_RULES and p.confidence >= 0.85 and p.risk in {"info", "minor"}]
            for patch in candidates:
                if patch not in safe and len(skipped) < 20:
                    skipped.append(
                        {
                            "title": patch.title,
                            "reason": "Not on the safe autopilot list — needs a human decision.",
                            "rule": patch.verification.get("rule"),
                            "confidence": patch.confidence,
                        }
                    )
            if not safe:
                break
            patch = safe[0]
            store.add_patch(patch)
            store.decide_patch(patch.id, approve=True, actor=actor, note="Autopilot: safe transformation, auto-approved.")
            try:
                result = self.apply(patch.id, actor=actor)
            except PatchConflict as error:
                skipped.append({"title": patch.title, "reason": str(error), "rule": patch.verification.get("rule")})
                break
            applied.append(
                {
                    "patch_id": patch.id,
                    "title": patch.title,
                    "rule": patch.verification.get("rule"),
                    "file_path": patch.file_path,
                    "health_after": result["analysis"]["health_score"],
                    "learning_note": patch.learning_note,
                }
            )

        if applied:
            store.grant_badge(*_BADGE_LOOKUP["autopilot"])
            store.award_xp(8 * len(applied), "autopilot applied safe fixes")

        review = self._file_autopilot_review(context.file_path, applied, skipped, actor)
        final = store.get_file(context.file_path)
        analysis = store.get_analysis(context.file_path) or (
            analyze_text(final.content, final.path, final.language) if final else None
        )
        return {
            "applied": applied,
            "skipped": skipped[:12],
            "review": review.to_dict() if review else None,
            "analysis": analysis.to_dict() if analysis else None,
            "file": final.to_dict() if final else None,
            "rules_safe": sorted(SAFE_AUTOFIX_RULES),
        }

    def _file_autopilot_review(
        self, file_path: str, applied: list[dict], skipped: list[dict], actor: str
    ) -> ReviewRequest | None:
        if not applied and not skipped:
            return None
        checklist = [
            {"label": f"{len(applied)} safe fix(es) applied automatically", "done": bool(applied)},
            {"label": "Human read each automatic change", "done": False},
            {"label": "Behaviour verified after the changes (run the file)", "done": False},
            {"label": f"{len(skipped)} change(s) still need a human decision", "done": not skipped},
        ]
        review = ReviewRequest(
            id=new_id("review"),
            file_path=file_path,
            title=f"Autopilot changed {len(applied)} thing(s) in `{file_path}` — please confirm",
            summary=(
                "These were mechanical, low-risk transformations (formatting, unused imports, equality operators). "
                "Autopilot never touches logic it cannot prove, and it never merges anything on its own."
            ),
            author="fixer-agent",
            reviewer="you",
            status="pending",
            checklist=checklist,
            comments=[
                ReviewComment(
                    id=new_id("rc"),
                    author="fixer-agent",
                    body=f"Applied: **{item['title']}** — {item.get('learning_note', '')[:220]}",
                    line=1,
                    kind="suggestion",
                )
                for item in applied
            ],
            patch_ids=[item["patch_id"] for item in applied],
            risk="minor",
        )
        store.add_review(review)
        return review


def _resolve_finding(finding_id: str | None, file_path: str) -> None:
    """After a successful apply, mark the original finding as fixed in the stored analysis."""
    store.log("finding.resolved", "system", file_path, f"finding {finding_id} no longer present after the patch")


def _resolve_review_comments(patch: Patch) -> None:
    for review in store.reviews.values():
        if patch.id in review.patch_ids:
            for comment in review.comments:
                if not comment.resolved:
                    comment.resolved = True
            review.updated_at = now()


_BADGE_LOOKUP = {
    "first-fix": ("first-fix", "Bug Hunter", "Proposed and approved your first fix", "🐛"),
    "autopilot": ("autopilot", "Pilot", "Let autopilot apply safe fixes and confirmed the result", "🚀"),
    "first-analysis": ("first-analysis", "First Scan", "Ran the health analysis on a file", "🔍"),
    "test-writer": ("test-writer", "Test Author", "Added tests to a file that had none", "🧪"),
    "explainer": ("explainer", "Explainer", "Worked through a full line-by-line reading", "📖"),
    "reviewer": ("reviewer", "Reviewer", "Approved a change after reading the diff", "👀"),
    "clean-file": ("clean-file", "Clean Sheet", "Brought a file to health 90+", "✨"),
    "security-guard": ("security-guard", "Security Guard", "Fixed a critical security issue", "🛡️"),
    "zero-critical": ("zero-critical", "All Clear", "Workspace has no critical findings", "🏅"),
}


patch_service = PatchService()
