"""The reviewer agent: prepares the human review so it takes two minutes, not twenty.

It never approves anything on its own. It produces:

* a **decision recommendation** with the reason (block / request changes / approve),
* a **checklist** split into "must pass" and "should improve",
* ready-made **line comments** a human can keep, edit or delete,
* the **questions a reviewer must answer** — the part that actually requires judgement.
"""

from __future__ import annotations

from ..models import Finding, ReviewComment, ReviewRequest, new_id
from .base import Agent, AgentContext, AgentResult
from .fixer import fixer_agent

# Blocking means "this will hurt somebody if it ships": correctness and security.
# Everything else — missing tests, documentation, style — is a follow-up request.
MUST_PASS_RULES = {
    "PY001",
    "PY002",
    "PY004",
    "PY005",
    "PY009",
    "PY064",
    "PY020",
    "PY021",
    "PY022",
    "PY023",
    "PY024",
    "PY025",
    "JS003",
    "JS004",
    "JS007",
    "JS008",
    "JS009",
    "JS011",
    "GEN008",
}

REVIEW_QUESTIONS = [
    "Does this change do what the description says — no more, no less?",
    "Can I explain to the author why each line exists?",
    "What happens with empty input, one item, and a very large input?",
    "If it fails at 3am, what will the logs tell the on-call engineer?",
    "What would have to be true for the new test to fail? If nothing, the test proves nothing.",
    "Is the smallest possible change the one that was made?",
]


class ReviewerAgent(Agent):
    name = "reviewer"
    description = "Reviews a file like a senior engineer and prepares the human decision."
    keywords = ("review", "approve", "check", "is this ok", "pull request", "before merge")

    def run(self, context: AgentContext) -> AgentResult:
        findings = context.findings()
        blocking = [f for f in findings if self._is_blocking(f)]
        improvements = [f for f in findings if not self._is_blocking(f)]
        decision, reason = self._decision(findings, blocking)
        patches = self._suggested_patches(context, blocking)

        markdown = "\n\n".join(
            [
                f"## Recommendation: **{decision}**\n{reason}",
                self._checklist(findings, blocking),
                self._comments_preview(blocking, improvements),
                self._acceptance_tests(context, blocking),
                self._questions(),
            ]
        )

        request = self._build_request(context, decision, reason, findings, patches)
        return AgentResult(
            agent=self.name,
            headline=f"Review ready for `{context.file_path}` — {decision} ({len(blocking)} blocking)",
            markdown=markdown,
            data={
                "decision": decision,
                "blocking": [f.to_dict() for f in blocking],
                "improvements": [f.to_dict() for f in improvements],
                "review": request.to_dict(),
                "patch_ids": [p.id for p in patches],
                "patches": [p.to_dict() for p in patches],
            },
            follow_ups=[
                "Create the review request so I can approve it",
                "Draft the comments I should leave",
                "Which of these issues would block a release?",
            ],
            xp=10,
        )

    # ------------------------------------------------------------------ internals
    @staticmethod
    def _is_blocking(finding: Finding) -> bool:
        if finding.severity == "critical":
            return True
        if finding.severity == "major" and finding.rule in MUST_PASS_RULES:
            return True
        return finding.severity == "major" and finding.category in {"bug", "security"}

    def _decision(self, findings: list[Finding], blocking: list[Finding]) -> tuple[str, str]:
        if any(f.category == "security" and f.severity == "critical" for f in blocking):
            return (
                "Blocked",
                "A critical security issue is present. Security problems do not ship 'for now' — they are the "
                "hardest thing to remove later because other code starts depending on them.",
            )
        if blocking:
            titles = ", ".join(f"“{f.title}”" for f in blocking[:3])
            return (
                "Changes requested",
                f"{len(blocking)} blocking issue(s) must be fixed before merge: {titles}. "
                "Everything else can follow as a separate, smaller change.",
            )
        if any(f.severity == "major" for f in findings):
            return (
                "Approve with follow-ups",
                "Nothing blocks the merge. The listed improvements should be tracked so they are not forgotten — "
                "dead 'we will fix it later' comments are how code ages badly.",
            )
        return (
            "Approve",
            "No blocking or major issues found. Read the questions below once more before you sign off — the "
            "checklist cannot judge intent.",
        )

    def _checklist(self, findings: list[Finding], blocking: list[Finding]) -> str:
        counts = {"critical": 0, "major": 0, "minor": 0, "info": 0}
        for finding in findings:
            counts[finding.severity] = counts.get(finding.severity, 0) + 1
        must = [
            f"{'🛑' if f.severity == 'critical' else '⚠️'} **{f.title}** — line {f.line} ({f.category})"
            for f in blocking
        ] or ["✅ No blocking issues detected by the static rules."]
        should = [
            f"🔸 {f.title} — line {f.line}"
            for f in findings
            if not self._is_blocking(f) and f.severity in {"major", "minor"}
        ][:8] or ["✅ Nothing queued as an improvement."]
        return "\n".join(
            [
                "## Review checklist",
                "",
                f"**Severity summary:** {counts['critical']} critical · {counts['major']} major · "
                f"{counts['minor']} minor · {counts['info']} notes",
                "",
                "**Must pass before merge**",
                self.bullet(must),
                "",
                "**Should improve (can be a follow-up)**",
                self.bullet(should),
            ]
        )

    def _comments_preview(self, blocking: list[Finding], improvements: list[Finding]) -> str:
        if not blocking and not improvements:
            return ""
        rows = ["## Comments ready to post", ""]
        for finding in (blocking + improvements)[:6]:
            tone = "blocker" if self._is_blocking(finding) else "suggestion"
            text = self._comment_text(finding)
            rows.append(f"**Line {finding.line}** · `{tone}` · `{finding.rule}`\n{text}\n")
        return "\n".join(rows)

    def _comment_text(self, finding: Finding) -> str:
        if self._is_blocking(finding):
            return (
                f"This is blocking: {finding.why_it_matters} Suggested change: {finding.how_to_fix}"
            )
        return f"Non-blocking suggestion: {finding.how_to_fix} The reason: {finding.why_it_matters}"

    def _acceptance_tests(self, context: AgentContext, blocking: list[Finding]) -> str:
        if not blocking:
            return ""
        rows = ["## What the author should demonstrate before merge", ""]
        for finding in blocking[:4]:
            rows.append(f"- A test that **fails on the current code** for: *{finding.title}* (line {finding.line}).")
        rows.append(
            "- A manual run with the smallest real input, with the output pasted into the review."
        )
        rows.append(
            "- Confirmation that the fix was verified by someone other than the author (or at least by a second run)."
        )
        return "\n".join(rows)

    def _questions(self) -> str:
        return "## Questions only a human can answer\n" + self.bullet(REVIEW_QUESTIONS)

    def _suggested_patches(self, context: AgentContext, blocking: list[Finding]) -> list:
        patches = []
        for finding in blocking[:5]:
            patch = fixer_agent.patch_for(context, finding)
            if patch:
                patches.append(patch)
        return patches

    def _build_request(
        self,
        context: AgentContext,
        decision: str,
        reason: str,
        findings: list[Finding],
        patches: list,
    ) -> ReviewRequest:
        status = "pending" if decision in {"Blocked", "Changes requested"} else "in-review"
        comments = [
            ReviewComment(
                id=new_id("rc"),
                author="reviewer-agent",
                body=self._comment_text(finding),
                line=finding.line,
                kind="blocker" if self._is_blocking(finding) else "comment",
            )
            for finding in findings[:8]
        ]
        return ReviewRequest(
            id=new_id("review"),
            file_path=context.file_path,
            title=f"Review `{context.file_path}` — {decision}",
            summary=reason,
            reviewer="you",
            status=status,  # type: ignore[arg-type]
            checklist=[
                {"label": "Static analysis clean", "done": not any(self._is_blocking(f) for f in findings)},
                {"label": "Tests exist for the changed behaviour", "done": not any(f.rule in {"PY061", "JS022"} for f in findings)},
                {"label": "No blocking review comments", "done": not any(self._is_blocking(f) for f in findings)},
                {"label": "Human read every proposed change", "done": False},
            ],
            comments=comments,
            patch_ids=[p.id for p in patches],
            risk="critical" if any(f.severity == "critical" for f in findings) else "minor",
        )


reviewer_agent = ReviewerAgent()
