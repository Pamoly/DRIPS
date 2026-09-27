"""The master assistant: plan → act → observe → report, with a human in the loop.

Every request becomes an explicit plan the user can watch execute. The plan is a list of
steps, each step names the agent that runs it, and each step emits events while it works.
That transparency is the product: a beginner can see *how* a senior engineer approaches a
messy file, and can interrupt at any point because nothing is applied without approval.

Supported intents (they can be combined in one sentence — "explain this then fix it"):

===========================  ==========================================================
intent                       what it does
===========================  ==========================================================
``explain`` / ``teach``      line-by-line reading, concepts, self-check questions
``health``                   metrics, score, worst offenders, what to fix first
``debug`` / ``error``        traceback triage and ranked hypotheses
``fix`` / ``repair``         builds patches (never applies them)
``review``                   senior review checklist and a recommendation
``test``                     proposes the tests that would catch the findings
``learn`` / ``next``         the next lesson from your own code's weak spots
``run``                      executes the file in the sandbox and reads the output
``autopilot`` / ``clean up`` applies only provably safe fixes, then files a review
free-form question           concept explanations grounded in your file + the engine
===========================  ==========================================================
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Callable, Iterator

from ..analyzer import analyze_text
from ..models import ChatMessage, new_id
from ..runtime.runner import runner
from ..store import store
from .base import AgentContext, AgentResult
from .chat import chat_agent
from .coach import coach_agent
from .debugger import debugger_agent
from .fixer import fixer_agent
from .patch_service import patch_service
from .reviewer import reviewer_agent
from .teacher import teacher_agent
from .test_writer import test_writer_agent


@dataclass
class Step:
    agent: str
    action: str
    detail: str
    run: Callable[[AgentContext], AgentResult] | None = None
    status: str = "pending"
    result: AgentResult | None = None
    payload: dict = field(default_factory=dict)


INTENT_KEYWORDS: list[tuple[str, tuple[str, ...]]] = [
    ("autopilot", ("autopilot", "clean up everything", "fix everything", "auto fix", "auto-fix", "tidy this file")),
    ("run", ("run the file", "run this", "execute", "run it", "what does it output")),
    ("debug", ("traceback", "error", "exception", "bug", "crash", "debug", "fails", "not working", "broken", "why does it fail")),
    ("fix", ("fix", "repair", "patch", "correct", "resolve", "make it work")),
    ("review", ("review", "approve", "merge", "pull request", "sign off", "checklist")),
    ("test", ("test", "tests", "pytest", "vitest", "jest", "coverage")),
    ("research", ("explain", "walk me through", "what does this do", "help me read", "understand", "teach me this file", "read this")),
    ("learn", ("learn", "next step", "study", "practice", "exercise", "path", "level up", "improve myself")),
    ("health", ("health", "score", "metrics", "quality", "complexity", "how bad", "report", "analyse", "analyze", "audit")),
]

ORDER = ["health", "research", "debug", "fix", "test", "review", "learn", "run", "autopilot"]


class Orchestrator:
    """Routes a request to agents, streams the trace, and enforces the approval gate."""

    def __init__(self) -> None:
        self.agents = {
            "teacher": teacher_agent,
            "debugger": debugger_agent,
            "reviewer": reviewer_agent,
            "test-writer": test_writer_agent,
            "coach": coach_agent,
            "mentor": chat_agent,
        }

    # ----------------------------------------------------------------- entry points
    def handle(
        self,
        message: str,
        *,
        file_path: str | None = None,
        source: str | None = None,
        language: str | None = None,
        question: str = "",
        traceback_text: str = "",
        actor: str = "you",
        session_id: str | None = None,
    ) -> Iterator[dict]:
        """Run one request and yield events: plan, step, analysis, message, patch, done."""
        session_id = session_id or new_id("chat")
        session = store.chat.setdefault(session_id, [])
        session.append(ChatMessage(id=new_id("m"), role="user", content=message).to_dict())

        yield {"type": "session", "session_id": session_id}

        # ---- load the file under discussion (or analyse a snippet the user pasted)
        file = store.get_file(file_path) if file_path else None
        if file is None and file_path and source:
            content, lang = source, (language or "python")
        elif file is not None:
            content, lang = file.content, file.language
        elif source:
            content, lang = source, (language or "python")
        else:
            content, lang = "", (language or "python")
        file_path = file_path or "<snippet>"

        analysis = analyze_text(content, file_path, lang) if content else None
        if analysis and file is not None:
            analysis.revision = file.revision
            store.set_analysis(analysis)

        context = AgentContext(
            file_path=file_path,
            source=content,
            language=lang,
            analysis=analysis,
            learner_level=store.learner.title,
            autonomy=store.autonomy,
            traceback_text=traceback_text or (message if _looks_like_traceback(message) else ""),
            question=question or message,
            extra={"learner": store.learner, "actor": actor, "session_id": session_id},
        )

        covered_findings = [f.rule for f in (analysis.findings if analysis else [])][:6]
        # ---- pick a model to narrate when one is configured (grounded in the facts above)
        intents = self.classify(message)
        steps = self.plan(intents, context, message)

        yield {
            "type": "plan",
            "session_id": session_id,
            "file": file_path,
            "language": lang,
            "intents": intents,
            "autonomy": store.autonomy,
            "steps": [{"agent": s.agent, "action": s.action, "detail": s.detail} for s in steps],
        }

        if analysis:
            yield {
                "type": "analysis",
                "analysis": analysis.to_dict(),
                "summary": analysis.summary,
            }

        for index, step in enumerate(steps):
            yield {
                "type": "step",
                "index": index,
                "status": "running",
                "agent": step.agent,
                "action": step.action,
                "detail": step.detail,
            }
            try:
                yield from self._execute_step(step, context, index, actor)
            except Exception as error:  # keep the session alive, report honestly
                yield {
                    "type": "step",
                    "index": index,
                    "status": "failed",
                    "agent": step.agent,
                    "action": step.action,
                    "detail": f"{type(error).__name__}: {error}",
                }

        summary_message = self._final_message(steps, analysis, covered_findings, context)
        session.append(summary_message.to_dict())
        for chunk in _chunk(summary_message.content):
            yield {"type": "token", "text": chunk}
        yield {"type": "message", "message": summary_message.to_dict()}
        yield {
            "type": "done",
            "session_id": session_id,
            "xp": store.learner.xp,
            "level": store.learner.level_n if hasattr(store.learner, "level_n") else None,
            "autonomy": store.autonomy,
        }

    def run_sync(self, message: str, **kwargs) -> dict:
        """Non-streaming convenience wrapper (used by tests and simple clients)."""
        events = list(self.handle(message, **kwargs))
        return {
            "events": events,
            "message": next((e["message"] for e in events if e["type"] == "message"), None),
            "analysis": next((e["analysis"] for e in events if e["type"] == "analysis"), None),
            "patches": [e["patch"] for e in events if e["type"] == "patch"],
            "review": next((e["review"] for e in events if e["type"] == "review"), None),
        }

    # ------------------------------------------------------------------ classifying
    def classify(self, message: str) -> list[str]:
        lowered = message.lower()
        matched = [
            intent
            for intent, keywords in INTENT_KEYWORDS
            if any(keyword in lowered for keyword in keywords)
        ]
        if not matched:
            matched = ["mentor"]
        ordered = [intent for intent in ORDER if intent in matched]
        # "fix" implies a review proposal; "research" on a code question implies health too
        if "fix" in ordered and "review" not in ordered:
            ordered.append("review")
        if "autopilot" in ordered:
            for implied in ("health", "fix", "review"):
                if implied not in ordered:
                    ordered.insert(ordered.index("autopilot"), implied)
            ordered = [intent for intent in ordered if intent != "fix" or True]
        return ordered or ["mentor"]

    # ---------------------------------------------------------------------- planning
    def plan(self, intents: list[str], context: AgentContext, message: str) -> list[Step]:
        steps: list[Step] = []
        if context.analysis is None:
            steps.append(Step("analysis-engine", "analyse", "Parse the file and compute the code-health metrics."))
        for intent in intents:
            if intent == "health":
                steps.append(Step("analysis-engine", "health report", "Rank the findings by what to fix first."))
            elif intent == "research":
                steps.append(Step("teacher", "explain", "Read the file and explain it line by line.", teacher_agent.run))
            elif intent == "debug":
                steps.append(Step("debugger", "triage", "Read the traceback, locate the failing line, rank the causes.", debugger_agent.run))
            elif intent == "fix":
                steps.append(Step("fixer-agent", "prepare patches", "Build minimal patches for the autofixable findings.", self._step_fix))
            elif intent == "test":
                steps.append(Step("test-writer", "propose tests", "Write the tests that would have caught these findings.", test_writer_agent.run))
            elif intent == "review":
                steps.append(Step("reviewer", "review", "Assemble the review checklist and the human decision.", reviewer_agent.run))
            elif intent == "learn":
                steps.append(Step("coach", "coach", "Turn your findings into the next lesson.", coach_agent.run))
            elif intent == "run":
                steps.append(Step("runtime", "execute", "Run the file in the sandbox and read the output.", self._step_run))
            elif intent == "autopilot":
                steps.append(
                    Step(
                        "autopilot",
                        "apply safe fixes",
                        "Apply only provably safe changes, then ask a human to confirm.",
                        self._step_autopilot,
                    )
                )
            elif intent == "mentor":
                steps.append(Step("mentor", "answer", "Answer using the engine's verified facts.", chat_agent.run))
        if not steps:
            steps.append(Step("teacher", "explain", "Read the file and explain it.", teacher_agent.run))
        return steps

    # -------------------------------------------------------------------- executing
    def _execute_step(self, step: Step, context: AgentContext, index: int, actor: str) -> Iterator[dict]:
        if step.run is None:
            yield {
                "type": "step",
                "index": index,
                "status": "done",
                "agent": step.agent,
                "action": step.action,
                "detail": step.detail,
                "result": {},
            }
            return

        result = step.run(context)
        payload: dict = {}

        if step.agent == "fixer-agent":
            patches = result.data.get("patches", [])
            payload = {"patches": patches}
            for patch in patches:
                yield {"type": "patch", "patch": patch}
            if patches:
                store.award_xp(4, f"proposed {len(patches)} fix(es)")
            yield {"type": "message", "message": result.to_payload()}
        elif step.agent == "autopilot":
            payload = result.data
            for applied in result.data.get("applied", []):
                yield {"type": "autopilot", "applied": applied}
            if result.data.get("review"):
                yield {"type": "review", "review": result.data["review"]}
            if result.data.get("analysis"):
                yield {"type": "analysis", "analysis": result.data["analysis"], "summary": result.data["analysis"].get("summary", "")}
            if result.data.get("file"):
                yield {"type": "file", "file": result.data["file"]}
            yield {"type": "message", "message": result.to_payload()}
        else:
            payload = result.data
            if step.agent == "reviewer" and result.data.get("review"):
                review = result.data["review"]
                store.add_review(_review_from_dict(review))
                yield {"type": "review", "review": store.get_review(review["id"]).to_dict()}
            if step.agent == "test-writer" and result.data.get("patch"):
                patch = result.data["patch"]
                store.add_patch(_patch_from_dict(patch))
                yield {"type": "patch", "patch": store.get_patch(patch["id"]).to_dict()}
            if step.agent == "debugger" and result.data.get("patches"):
                for patch in result.data["patches"]:
                    stored = store.get_patch(patch["id"]) or store.add_patch(_patch_from_dict(patch))
                    yield {"type": "patch", "patch": stored.to_dict()}
            if step.agent == "teacher":
                store.grant_badge("explainer", "Explainer", "Worked through a full line-by-line reading", "📖")
            if step.agent == "coach":
                store.award_xp(3, "asked for the next lesson")

            yield {"type": "message", "message": result.to_payload()}

        if result.xp:
            store.award_xp(result.xp, f"{step.agent}: {step.action}")
        if result.badge:
            store.grant_badge(*result.badge)

        yield {
            "type": "step",
            "index": index,
            "status": "done",
            "agent": step.agent,
            "action": step.action,
            "detail": result.headline,
            "result": payload,
            "xp": result.xp,
        }

    # ------------------------------------------------------------------- step impls
    def _step_fix(self, context: AgentContext) -> AgentResult:
        if context.analysis is None:
            return AgentResult(agent="fixer-agent", headline="Nothing to analyse", markdown="No source was loaded.")
        patches = patch_service.propose_all(context, limit=12)
        manual = [
            (finding, fixer_agent.manual_guidance(finding))
            for finding in context.findings()
            if fixer_agent.manual_guidance(finding)
        ]
        if not patches and not manual:
            return AgentResult(
                agent="fixer-agent",
                headline="No automatic fixes needed",
                markdown="Every autofixable rule is already satisfied. Ask me to review the file for the design-level issues.",
                data={"patches": []},
            )
        lines = [
            f"## {len(patches)} patch{'es' if len(patches) != 1 else ''} ready for your approval",
            "I have **not** changed anything. Read each diff, then approve or reject it in the Review tab.",
            "",
        ]
        for patch in patches:
            lines.append(
                f"### {patch.title}  \n"
                f"*Confidence {int(patch.confidence * 100)}% · risk {patch.risk}*\n\n"
                f"{patch.diff}\n\n**Why:** {patch.learning_note or patch.rationale}\n"
            )
        for finding, guidance in manual[:3]:
            lines.append(
                f"### Line {finding.line}: {finding.title} *(by hand — I will not guess)*\n"
                f"{finding.why_it_matters}\n\n{guidance}\n"
            )
        return AgentResult(
            agent="fixer-agent",
            headline=f"{len(patches)} patch(es) awaiting your approval",
            markdown="\n".join(lines),
            data={
                "patches": [p.to_dict() for p in patches],
                "manual": [{"finding": f.to_dict(), "guidance": g} for f, g in manual[:5]],
            },
            follow_ups=[
                "Apply the first patch and explain what changed",
                "Show me only the safe fixes",
                "Why is this fix minimal?",
            ],
            xp=5,
        )

    def _step_run(self, context: AgentContext) -> AgentResult:
        result = runner.run_source(context.source, context.file_path, context.language)
        markdown = [
            f"## Ran `{context.file_path}` ({result.duration_ms:.0f} ms, exit code {result.exit_code})",
            f"```\n{result.stdout.strip() or '(no output)'}\n```",
        ]
        if result.stderr.strip():
            markdown.append(f"### stderr\n```\n{result.stderr.strip()[:4000]}\n```")
        if result.timed_out:
            markdown.append("The run was stopped by the timeout — look for a loop that never ends.")
        if result.exit_code != 0 and result.stderr:
            diagnosis = debugger_agent.run(
                AgentContext(
                    file_path=context.file_path,
                    source=context.source,
                    language=context.language,
                    analysis=context.analysis,
                    traceback_text=result.stderr,
                )
            )
            markdown.append("### I read the output for you\n" + diagnosis.markdown)
        return AgentResult(
            agent="runtime",
            headline=f"exit code {result.exit_code} in {result.duration_ms:.0f} ms",
            markdown="\n\n".join(markdown),
            data={"run": result.to_dict()},
            follow_ups=["Debug the failing line", "Add a test for this behaviour", "Explain this output"],
            xp=5,
        )

    def _step_autopilot(self, context: AgentContext) -> AgentResult:
        outcome = patch_service.autopilot(context)
        applied = outcome["applied"]
        skipped = outcome["skipped"]
        markdown = [
            f"## Autopilot finished — {len(applied)} safe change(s) applied",
            "Autopilot only touches transformations that cannot change behaviour (formatting, dead imports, "
            "equality operators, explicit encodings). Everything else waits for you.",
        ]
        for item in applied:
            markdown.append(f"- **{item['title']}** → health now {item['health_after']}/100\n  {item.get('learning_note', '')[:240]}")
        if skipped:
            markdown.append("### Left for you (reason included)")
            markdown.extend(f"- {item['title']} — {item['reason']}" for item in skipped[:8])
        markdown.append(
            "A review request was created so the change is signed off like any other. Reverting is one click if you disagree."
        )
        return AgentResult(
            agent="autopilot",
            headline=f"{len(applied)} safe fix(es) applied, {len(skipped)} left for a human",
            markdown="\n".join(markdown),
            data=outcome,
            follow_ups=[
                "Show me the diff of everything autopilot changed",
                "Explain why one of these was safe",
                "Run the file to prove nothing broke",
            ],
            xp=15,
        )

    # --------------------------------------------------------------------- summary
    def _final_message(self, steps: list[Step], analysis, covered: list[str], context: AgentContext) -> ChatMessage:
        completed = [s for s in steps if s.status != "failed"]
        intent_line = " → ".join(s.action for s in completed)
        health = f"Health {analysis.health_score}/100 (grade {analysis.grade}), " if analysis else ""
        counts = analysis.severity_counts() if analysis else {}
        finding_line = (
            f"{counts.get('critical', 0)} critical, {counts.get('major', 0)} major, {counts.get('minor', 0)} minor"
            if analysis
            else "no file loaded"
        )
        headline = f"{health}{finding_line}."
        next_step = "Read the sections above, then decide what to approve."
        if analysis and analysis.findings:
            worst = analysis.findings[0]
            next_step = (
                f"Start with line {worst.line} ({worst.title}). "
                + ("A patch is waiting for your review." if store.list_patches("proposed") else "Ask me to prepare the fix.")
            )
        content = (
            f"**Done.** I ran: {intent_line}.\n\n{headline}\n\n{next_step}"
        )
        return ChatMessage(
            id=new_id("m"),
            role="assistant",
            content=content,
            agent="orchestrator",
            kind="summary",
            data={"steps": [{"agent": s.agent, "action": s.action, "status": s.status} for s in steps]},
        )


def _looks_like_traceback(text: str) -> bool:
    return bool(re.search(r"Traceback \(most recent call last\)|^\s+at\s+\S+\s*\(", text, re.M))


def _chunk(text: str, size: int = 24) -> Iterator[str]:
    words = text.split(" ")
    buffer = ""
    for word in words:
        buffer += word + " "
        if len(buffer) >= size:
            yield buffer
            buffer = ""
    if buffer:
        yield buffer


def _review_from_dict(payload: dict):
    from ..models import ReviewComment, ReviewRequest

    review = ReviewRequest.from_dict(payload)
    review.comments = [ReviewComment.from_dict(c) for c in payload.get("comments", [])]
    return review


def _patch_from_dict(payload: dict):
    from ..models import Patch

    return Patch.from_dict(payload)


orchestrator = Orchestrator()
