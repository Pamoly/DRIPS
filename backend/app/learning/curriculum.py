"""The curriculum: what to learn, in what order, and how to know you learned it.

The path is derived from what reviewers actually complain about, not from a list of
language features:

1. **Read code** — names, data flow, control flow, side effects.
2. **Write safe code** — edges, errors, types, immutability.
3. **Write clear code** — small functions, honest names, structure.
4. **Work in a team** — tests, reviews, small diffs, documentation.
5. **Design systems** — modules, boundaries, performance, security.

Every rule in the analyser maps to the skill it exercises, so the mentor can turn a
finding in *your* file into the next lesson.
"""

from __future__ import annotations

from dataclasses import dataclass, field

SKILL_READ_CODE = "reading code"
SKILL_SAFETY = "safe code & edges"
SKILL_CLARITY = "clarity & structure"
SKILL_TEAM = "tests & reviews"
SKILL_DESIGN = "design & security"

LEVELS = [
    {"n": 1, "title": "Curious Beginner", "xp": 0, "focus": "make something run, and learn to read it"},
    {"n": 2, "title": "Code Reader", "xp": 250, "focus": "predict what code does before running it"},
    {"n": 3, "title": "Careful Coder", "xp": 700, "focus": "handle the edges: empty, missing, invalid"},
    {"n": 4, "title": "Clear Writer", "xp": 1400, "focus": "small functions, honest names, no dead code"},
    {"n": 5, "title": "Team Contributor", "xp": 2400, "focus": "tests, reviews, small reviewable diffs"},
    {"n": 6, "title": "Professional Engineer", "xp": 4000, "focus": "design, performance, security, mentoring others"},
]

RULE_TO_SKILL: dict[str, str] = {
    # reading
    "PY040": SKILL_READ_CODE,
    "PY041": SKILL_READ_CODE,
    "PY042": SKILL_READ_CODE,
    "PY043": SKILL_READ_CODE,
    "PY008": SKILL_READ_CODE,
    "JS014": SKILL_READ_CODE,
    # safety
    "PY001": SKILL_SAFETY,
    "PY002": SKILL_SAFETY,
    "PY003": SKILL_SAFETY,
    "PY004": SKILL_SAFETY,
    "PY005": SKILL_SAFETY,
    "PY006": SKILL_SAFETY,
    "PY007": SKILL_SAFETY,
    "PY009": SKILL_SAFETY,
    "PY010": SKILL_SAFETY,
    "PY011": SKILL_SAFETY,
    "JS002": SKILL_SAFETY,
    "JS003": SKILL_SAFETY,
    "JS004": SKILL_SAFETY,
    "JS007": SKILL_SAFETY,
    "JS010": SKILL_SAFETY,
    "GEN008": SKILL_SAFETY,
    # clarity
    "PY030": SKILL_CLARITY,
    "PY031": SKILL_CLARITY,
    "PY032": SKILL_CLARITY,
    "PY033": SKILL_CLARITY,
    "PY050": SKILL_CLARITY,
    "PY051": SKILL_CLARITY,
    "PY052": SKILL_CLARITY,
    "PY053": SKILL_CLARITY,
    "PY054": SKILL_CLARITY,
    "PY055": SKILL_CLARITY,
    "PY056": SKILL_CLARITY,
    "PY057": SKILL_CLARITY,
    "PY060": SKILL_CLARITY,
    "PY062": SKILL_CLARITY,
    "JS001": SKILL_CLARITY,
    "JS006": SKILL_CLARITY,
    "JS015": SKILL_CLARITY,
    "JS016": SKILL_CLARITY,
    "JS019": SKILL_CLARITY,
    "GEN005": SKILL_CLARITY,
    "GEN006": SKILL_CLARITY,
    # team
    "PY061": SKILL_TEAM,
    "JS022": SKILL_TEAM,
    "GEN007": SKILL_TEAM,
    # design
    "PY020": SKILL_DESIGN,
    "PY021": SKILL_DESIGN,
    "PY022": SKILL_DESIGN,
    "PY023": SKILL_DESIGN,
    "PY024": SKILL_DESIGN,
    "PY025": SKILL_DESIGN,
    "JS008": SKILL_DESIGN,
    "JS009": SKILL_DESIGN,
    "JS011": SKILL_DESIGN,
}


@dataclass
class Lesson:
    id: str
    title: str
    skill: str
    minutes: int
    why: str
    read: list[str]
    practice: str
    check: str
    rules: list[str] = field(default_factory=list)


TRACKS: list[dict] = [
    {
        "id": "reading-code",
        "name": "Reading code like an engineer",
        "level": "beginner",
        "summary": "Stop scrolling and guessing: learn to predict what a file does in 60 seconds.",
        "lessons": [
            Lesson(
                id="read-1",
                title="The 60-second tour",
                skill=SKILL_READ_CODE,
                minutes=10,
                why="Reading order is a skill. Name → inputs → data flow → side effects → edges.",
                read=[
                    "Start at the module docstring, then the function names, then the parameters.",
                    "Follow one piece of data from where it is created to where it is used.",
                    "Look for side effects: print, file writes, network calls, mutations of arguments.",
                ],
                practice="Open the biggest file in this workspace and list, in order, the five most important lines.",
                check="You can explain what the file does without running it.",
                rules=["PY040", "PY041"],
            ),
            Lesson(
                id="read-2",
                title="Predicting loop results",
                skill=SKILL_READ_CODE,
                minutes=15,
                why="Loops are where beginners lose track of values. Tracing two iterations by hand fixes that.",
                read=[
                    "Write the loop variable's value at the start of each iteration on paper.",
                    "Track the accumulator separately — that is the value the function returns.",
                    "Ask what happens on the last iteration, and on zero iterations.",
                ],
                practice="Take a loop from your file, write the values for the first two iterations, then run it and compare.",
                check="Your hand-traced final value matches the printed one.",
                rules=["PY008", "PY012"],
            ),
        ],
    },
    {
        "id": "safe-code",
        "name": "Code that survives real data",
        "level": "beginner",
        "summary": "Empty lists, missing keys, text where a number was expected — the three sources of most crashes.",
        "lessons": [
            Lesson(
                id="safe-1",
                title="Mutable default arguments (the classic)",
                skill=SKILL_SAFETY,
                minutes=10,
                why="A default list is created once and shared by every call, so state leaks between calls.",
                read=[
                    "Default values are evaluated when the `def` line runs — once, not per call.",
                    "`def f(items=[])` gives every caller the same list object.",
                    "The fix is a `None` sentinel: `if items is None: items = []`.",
                ],
                practice="Find a function with a default list in this workspace and rewrite it with a None sentinel.",
                check="Calling the function twice with no argument returns two independent objects.",
                rules=["PY001"],
            ),
            Lesson(
                id="safe-2",
                title="Catching errors on purpose",
                skill=SKILL_SAFETY,
                minutes=12,
                why="A bare `except:` hides typos and even Ctrl+C; it is how bugs become silent corruption.",
                read=[
                    "Catch the specific exception you can handle: `except ValueError:`.",
                    "Never `except: pass` — log it, return a default, or re-raise.",
                    "Every `except` should answer: what does the caller see now?",
                ],
                practice="Rewrite the bare excepts in this workspace so each one either logs or returns a clear result.",
                check="An invalid input produces a message, not a silent zero.",
                rules=["PY002", "PY004"],
            ),
            Lesson(
                id="safe-3",
                title="The empty-collection trap",
                skill=SKILL_SAFETY,
                minutes=8,
                why="`sum(x) / len(x)` crashes on an empty list — often only in production, on a quiet day.",
                read=[
                    "Before dividing, ask what the answer means when there is no data.",
                    "Return early: `if not prices: return 0` — or raise a clear error.",
                    "Write the test with an empty list on purpose.",
                ],
                practice="Add a guard and the matching test to `average_price` in this workspace.",
                check="The function with an empty list returns your documented value instead of crashing.",
                rules=["PY005"],
            ),
        ],
    },
    {
        "id": "clear-code",
        "name": "Code other people can read",
        "level": "intermediate",
        "summary": "Small functions, names that describe intent, no dead code, no nesting pyramids.",
        "lessons": [
            Lesson(
                id="clear-1",
                title="Guard clauses instead of pyramids",
                skill=SKILL_CLARITY,
                minutes=12,
                why="Every nesting level is one more condition the reader must hold in memory.",
                read=[
                    "Handle the impossible first and return: `if not items: return []`.",
                    "Keep the happy path at the lowest indentation.",
                    "If a function needs a comment to explain a block, extract that block and let its name be the comment.",
                ],
                practice="Flatten the deepest function in this workspace using guard clauses.",
                check="Maximum nesting is 2 and the behaviour is unchanged.",
                rules=["PY032", "PY031"],
            ),
            Lesson(
                id="clear-2",
                title="Naming and dead code",
                skill=SKILL_CLARITY,
                minutes=10,
                why="Unused imports and variables are not just noise — they hide the real dependencies.",
                read=[
                    "A name should say what the value *means*, not its type: `tax_rate`, not `float1`.",
                    "Delete unused imports and variables; version control remembers them for you.",
                    "Replace magic numbers with named constants.",
                ],
                practice="Remove every unused import in this workspace and name one magic number.",
                check="Linters report zero unused imports.",
                rules=["PY055", "PY056", "PY062"],
            ),
        ],
    },
    {
        "id": "team-work",
        "name": "Working in a team",
        "level": "intermediate",
        "summary": "Tests, reviews and small diffs — the difference between code you own and code a team owns.",
        "lessons": [
            Lesson(
                id="team-1",
                title="A test is a promise you can check",
                skill=SKILL_TEAM,
                minutes=15,
                why="Untested code cannot be changed safely, so it stops being improved.",
                read=[
                    "Every test has three parts: arrange, act, assert.",
                    "Test the edge cases first: empty, one, invalid, maximum.",
                    "If the test cannot fail, it does not test anything.",
                ],
                practice="Use the Test tab to generate tests for this file, then read each assertion and fix the ones that are too weak.",
                check="At least one test fails if you deliberately break the function.",
                rules=["PY061", "JS022"],
            ),
            Lesson(
                id="team-2",
                title="Reviewing like a senior engineer",
                skill=SKILL_TEAM,
                minutes=15,
                why="Reviews catch the problems tests cannot see: wrong intent, missing context, risky shortcuts.",
                read=[
                    "Read the description first, then ask whether the diff does exactly that.",
                    "Separate blocking comments from suggestions; never mix them.",
                    "Review the tests before the code — they tell you what the author believes.",
                ],
                practice="Review the patch queue in the Review tab: approve one, reject one, and write why.",
                check="Your comment explains the consequence, not just the rule.",
                rules=[],
            ),
        ],
    },
    {
        "id": "design-security",
        "name": "Design, performance and security",
        "level": "advanced",
        "summary": "Injection, secrets, complexity budgets and the trade-offs that come with them.",
        "lessons": [
            Lesson(
                id="design-1",
                title="Injection: why string building is not SQL",
                skill=SKILL_DESIGN,
                minutes=15,
                why="Concatenated SQL lets data become commands; parameterised queries keep them separate.",
                read=[
                    "Never interpolate values into SQL, shell commands, HTML or regex.",
                    "Pass parameters and let the library escape them.",
                    "For dynamic structures (column names), validate against an allow-list.",
                ],
                practice="Rewrite the string-built query in this workspace using parameters.",
                check="A query string containing `' OR 1=1 --` returns no rows instead of everything.",
                rules=["PY021", "PY022", "JS008", "JS009"],
            ),
            Lesson(
                id="design-2",
                title="Managing complexity on purpose",
                skill=SKILL_DESIGN,
                minutes=12,
                why="Cyclomatic complexity above 10 means more branches than a reviewer can hold at once.",
                read=[
                    "Complexity 1-5: easy to test. 6-10: acceptable with tests. 11+: split it.",
                    "Extract cohesive blocks into named helpers — each becomes testable alone.",
                    "Prefer a lookup table over a long if/elif chain.",
                ],
                practice="Split the highest-complexity function in this workspace into two named helpers.",
                check="Both new functions are under complexity 8 and the tests still pass.",
                rules=["PY030", "JS016"],
            ),
        ],
    },
]

BADGES = {
    "first-analysis": ("First Scan", "Ran the health analysis on a file", "🔍"),
    "first-fix": ("Bug Hunter", "Proposed and approved your first fix", "🐛"),
    "clean-file": ("Clean Sheet", "Brought a file to health 90+", "✨"),
    "security-guard": ("Security Guard", "Fixed a critical security issue", "🛡️"),
    "test-writer": ("Test Author", "Added tests to a file that had none", "🧪"),
    "reviewer": ("Reviewer", "Approved a change after reading the diff", "👀"),
    "explainer": ("Explainer", "Worked through a full line-by-line reading", "📖"),
    "autopilot": ("Pilot", "Let autopilot apply safe fixes and confirmed the result", "🚀"),
    "zero-critical": ("All Clear", "Workspace has no critical findings", "🏅"),
}


def level_for_xp(xp: int) -> dict:
    current = LEVELS[0]
    for level in LEVELS:
        if xp >= level["xp"]:
            current = level
    index = LEVELS.index(current)
    next_level = LEVELS[index + 1] if index + 1 < len(LEVELS) else None
    return {
        "n": current["n"],
        "title": current["title"],
        "focus": current["focus"],
        "xp": xp,
        "next": next_level,
        "progress_to_next": (
            round((xp - current["xp"]) / max(1, next_level["xp"] - current["xp"]) * 100, 1) if next_level else 100.0
        ),
    }


def skill_for_rule(rule: str) -> str:
    return RULE_TO_SKILL.get(rule, SKILL_READ_CODE)


def recommend_track(findings: list[dict]) -> dict:
    """Choose the track whose rules match the most findings in the workspace."""
    scores: dict[str, int] = {}
    for track in TRACKS:
        for lesson in track["lessons"]:
            for rule in lesson.rules:
                if any(finding.get("rule") == rule for finding in findings):
                    scores[track["id"]] = scores.get(track["id"], 0) + 1
    if not scores:
        return {"id": TRACKS[0]["id"], "name": TRACKS[0]["name"], "reason": "Start with reading code — everything else builds on it."}
    best = max(scores, key=scores.get)
    track = next(t for t in TRACKS if t["id"] == best)
    return {
        "id": track["id"],
        "name": track["name"],
        "reason": (
            f"{scores[best]} of your current findings are in this track — fixing them teaches the skill "
            "you are already missing."
        ),
    }


def next_lessons(findings: list[dict], completed: list[str], limit: int = 3) -> list[dict]:
    """Lessons ordered by 'how many problems in this workspace would this fix'."""
    rule_counts: dict[str, int] = {}
    for finding in findings:
        rule_counts[finding.get("rule", "")] = rule_counts.get(finding.get("rule", ""), 0) + 1

    scored: list[tuple[float, Lesson]] = []
    for track in TRACKS:
        for lesson in track["lessons"]:
            if lesson.id in completed:
                continue
            matches = sum(rule_counts.get(rule, 0) for rule in lesson.rules)
            scored.append((matches * 3 + (2 - min(2, lesson.minutes / 15)), lesson))
    scored.sort(key=lambda item: item[0], reverse=True)
    return [
        {
            "id": lesson.id,
            "title": lesson.title,
            "skill": lesson.skill,
            "minutes": lesson.minutes,
            "why": lesson.why,
            "read": lesson.read,
            "practice": lesson.practice,
            "check": lesson.check,
            "rules": lesson.rules,
            "matched_findings": sum(rule_counts.get(rule, 0) for rule in lesson.rules),
        }
        for _, lesson in scored[:limit]
    ]
