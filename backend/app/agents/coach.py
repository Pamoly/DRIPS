"""The coach agent: turns analysis into a learning plan for the person, not the file.

It answers the question a beginner actually has — *what should I learn next, given what
my own code is struggling with?* — and it keeps score honestly: XP comes from real work
(reading, fixing, testing, reviewing), not from clicking.
"""

from __future__ import annotations

from ..learning import curriculum
from ..models import LearnerProfile
from .base import Agent, AgentContext, AgentResult


class CoachAgent(Agent):
    name = "coach"
    description = "Turns the analysis of your code into the next thing you should learn."
    keywords = ("learn", "teach me", "next step", "improve myself", "study", "practice", "path")

    def run(self, context: AgentContext) -> AgentResult:
        findings = [f.to_dict() for f in context.findings()]
        learner: LearnerProfile = context.extra.get("learner") or LearnerProfile()
        level = curriculum.level_for_xp(learner.xp)
        track = curriculum.recommend_track(findings)
        lessons = curriculum.next_lessons(findings, learner.completed_lessons, limit=3)
        weak_skills = self._weak_skills(findings)

        markdown = "\n\n".join(
            [
                f"## Where you are\n**Level {level['n']} · {level['title']}** — {level['xp']} XP "
                f"({level['progress_to_next']}% of the way to the next level).\nFocus right now: *{level['focus']}*.",
                f"## Recommended track: {track['name']}\n{track['reason']}",
                self._lessons_section(lessons),
                self._skills_section(weak_skills),
                self._plan_section(context),
            ]
        )

        return AgentResult(
            agent=self.name,
            headline=f"Next: {lessons[0]['title'] if lessons else track['name']} ({lessons[0]['minutes'] if lessons else 10} min)",
            markdown=markdown,
            data={
                "level": level,
                "track": track,
                "lessons": lessons,
                "skills": weak_skills,
                "xp": learner.xp,
                "badges": learner.badges,
            },
            follow_ups=[
                "Start the first lesson and quiz me at the end",
                "Which skill is my weakest?",
                "Show me a practice exercise from my own file",
            ],
            xp=5,
        )

    # ------------------------------------------------------------------ helpers
    def _weak_skills(self, findings: list[dict]) -> list[dict]:
        tally: dict[str, int] = {}
        for finding in findings:
            skill = curriculum.skill_for_rule(finding.get("rule", ""))
            weight = {"critical": 4, "major": 2, "minor": 1, "info": 0}.get(finding.get("severity", "info"), 0)
            tally[skill] = tally.get(skill, 0) + max(1, weight)
        ordered = sorted(tally.items(), key=lambda item: item[1], reverse=True)
        return [{"skill": skill, "weight": weight} for skill, weight in ordered]

    def _lessons_section(self, lessons: list[dict]) -> str:
        if not lessons:
            return "## Lessons\nEverything in the core path is done. Pick a real feature, build it, and bring me the diff for review."
        rows = ["## Your next lessons", ""]
        for lesson in lessons:
            matched = f" *({lesson['matched_findings']} findings in your code match this)*" if lesson["matched_findings"] else ""
            rows.append(
                f"### {lesson['title']} · {lesson['minutes']} min · {lesson['skill']}{matched}\n"
                f"**Why now:** {lesson['why']}\n\n"
                + self.bullet(lesson["read"])
                + f"\n\n**Practice:** {lesson['practice']}\n\n**You are done when:** {lesson['check']}\n"
            )
        return "\n".join(rows)

    def _skills_section(self, weak: list[dict]) -> str:
        if not weak:
            return "## Skills\nNo findings yet — run an analysis and I will rank your skills from the results."
        bars = []
        for item in weak[:5]:
            filled = min(10, item["weight"])
            bars.append(f"`{'█' * filled}{'░' * (10 - filled)}` **{item['skill']}** — {item['weight']} points of friction")
        return "## Where your code struggles most\n" + self.bullet(bars)

    def _plan_section(self, context: AgentContext) -> str:
        return "\n".join(
            [
                "## A 30-minute session that actually moves you forward",
                "",
                "1. **5 min — read.** Ask me to explain the file you find least familiar.",
                "2. **10 min — fix by hand.** Pick one finding, fix it yourself, then ask me to review your version.",
                "3. **10 min — test.** Add the test that would have caught it. This is the step people skip and the one that teaches most.",
                "4. **5 min — review.** Approve or reject the patches in the Review tab and write one sentence about why.",
            ]
        )


coach_agent = CoachAgent()
