"""The teacher agent: teaches a person to *read* code, not just to run it.

Everything is derived from the actual source (Python is parsed; other languages are
scanned), so the explanation always matches the file on screen. Output is deliberately
structured — overview, structure map, line-by-line walkthrough, concepts, self-check
questions — because reading order is the skill being taught.
"""

from __future__ import annotations

import ast
import re

from ..analyzer import python_analyzer
from ..models import Finding
from .base import Agent, AgentContext, AgentResult

# --------------------------------------------------------------------------- glossary
LINE_PATTERNS: list[tuple[str, str]] = [
    (r"^\s*@\w+", "a **decorator**: it wraps the function below with extra behaviour before the function body even runs."),
    (r"^\s*(async\s+)?def\s+(\w+)", "**defines a function** called `{name}` — a named block you can run again and again with different inputs."),
    (r"^\s*class\s+(\w+)", "**declares a class** `{name}` — a template that bundles data with the operations that belong to it."),
    (r"^\s*return\b", "**hands a value back** to whoever called this function; nothing after it in the function runs."),
    (r"^\s*(import|from)\s+", "**imports** code someone else already wrote so you can reuse it instead of inventing it."),
    (r"^\s*if\b", "**asks a yes/no question**; the indented lines below only run when the answer is yes."),
    (r"^\s*elif\b", "**checks another condition** because the previous one was false."),
    (r"^\s*else\b", "**the fallback path**: runs when every condition above was false."),
    (r"^\s*for\s+\w+\s+in\b", "**iterates**: takes each item from the collection, one at a time, and runs the block for it."),
    (r"^\s*while\b", "**repeats** the block as long as the condition stays true — make sure something inside eventually changes it."),
    (r"^\s*try\s*:", "**starts a protected block**: if anything inside raises an error, control jumps to `except` instead of crashing."),
    (r"^\s*except\b", "**catches an error** and decides what to do instead of letting the program stop."),
    (r"^\s*finally\s*:", "**always runs**, whether the block succeeded or failed — used for cleanup."),
    (r"^\s*raise\b", "**deliberately reports a problem** so the caller cannot ignore it."),
    (r"^\s*with\b", "**manages a resource** (a file, a connection) and releases it automatically, even on failure."),
    (r"^\s*print\s*\(", "**writes to the console** — useful while learning, better replaced by `logging` in real projects."),
    (r"^\s*assert\b", "**states an expectation**; it is a debugging aid, and it disappears when Python runs with `-O`."),
    (r"^\s*#", "a **comment**: a note for humans. Python ignores it completely."),
    (r"^\s*\"\"\"|^\s*'''", "a **docstring**: documentation that lives with the code, and tools can read it."),
    (r"\blambda\b", "a **lambda**: a tiny throwaway function written inline."),
    (r"\byield\b", "**produces a value lazily** — the function pauses here and continues when the next value is asked for."),
    (r"\bawait\b", "**waits for an asynchronous result** without blocking the rest of the program."),
    (r"\[.*\bfor\b.*\bin\b.*\]", "a **comprehension**: builds a list (or dict/set) in one expression instead of a loop plus append."),
    (r"\bglobal\b", "**reaches out to module-level state** — legal, but it makes behaviour depend on call order."),
    (r"^\s*\w[\w.\[\]'\"]*\s*\([^)]*\)\s*[;,]?\s*$", "**calls a function** — the parentheses are the instruction “run this now”; the value it returns is used (or ignored) on this line."),
    (r"__ASSIGNMENT_MARKER__", "**assigns a value**: the name on the left now points at whatever the right-hand side produced."),
    (r"^\s*if\s+__name__\s*==\s*['\"]__main__['\"]", "**the entry point check**: this block runs only when the file is executed directly, not when it is imported."),
    (r"//", "a **comment** for humans (JavaScript ignores it)."),
    (r"=>", "an **arrow function**: a compact way to write a function in JavaScript."),
    (r"\bconst\b|\blet\b", "**declares a block-scoped variable** — `const` cannot be reassigned, `let` can."),
]

CONCEPT_SIGNALS: dict[str, tuple[str, str]] = {
    "comprehension": (
        r"\[[^\]]*\bfor\b[^\]]*\bin\b[^\]]*\]",
        "A **comprehension** builds a collection in a single expression: `[x * 2 for x in numbers]` means 'give me x*2 for every x'. It replaces the loop-and-append pattern.",
    ),
    "try/except": (
        r"\btry\s*:",
        "**Error handling**: wrap code that might fail, then decide what to do when it does. Catch the *specific* error, otherwise real bugs get hidden.",
    ),
    "default argument": (
        r"def\s+\w+\([^)]*=",
        "**Default arguments** make a parameter optional. Never use a list or a dict as the default — the same object would be reused across calls.",
    ),
    "class": (
        r"^\s*class\s+\w+",
        "A **class** groups related data (attributes) and behaviour (methods) under one name, so callers see one concept instead of many loose functions.",
    ),
    "async/await": (
        r"\bawait\b|\basync\b",
        "**Async/await** lets the program wait for slow work (files, network) without freezing everything else, at the cost of having to be explicit about where you wait.",
    ),
    "generator": (
        r"\byield\b",
        "A **generator** produces values on demand instead of building the whole list, which keeps memory flat for large or infinite data.",
    ),
    "decorator": (
        r"^\s*@\w+",
        "A **decorator** (`@something`) wraps a function with extra behaviour — caching, logging, permissions — without editing the function itself.",
    ),
    "dataclass": (
        r"@dataclass|from dataclasses import",
        "A **dataclass** generates the boilerplate (`__init__`, equality, repr) for a record type, so you only declare the fields.",
    ),
    "type hints": (
        r"->|\w+:\s*(int|str|float|bool|list|dict|Decimal|Optional|None)\b",
        "**Type hints** are executable documentation: they let editors catch mistakes before you run anything.",
    ),
    "higher-order function": (
        r"\b(map|filter|sorted|reduce)\s*\(",
        "A **higher-order function** takes another function as an argument — `sorted(items, key=...)` is the everyday example.",
    ),
    "mutation": (
        r"\.append\(|\.pop\(|\.update\(|\.remove\(",
        "**Mutation** changes an existing object in place. It is efficient but easy to leak: the caller sees the change too, which surprises people.",
    ),
    "immutability": (
        r"frozen=True|const \w+\s*=|from typing import Final|tuple\(",
        "**Immutability** means a value cannot change after creation. It removes a whole class of bugs where two parts of the program share something you thought was private.",
    ),
}


class TeacherAgent(Agent):
    name = "teacher"
    description = "Explains code so a beginner can read it and a professional can review it."
    keywords = ("explain", "what does", "walk me through", "read", "understand", "teach", "why")

    def __init__(self) -> None:
        self._current_params: set[str] = set()

    # ------------------------------------------------------------------ public API
    def run(self, context: AgentContext) -> AgentResult:
        target = self._pick_target(context)
        overview = self._overview(context)
        structure = self._structure_map(context)
        walkthrough, quiz = self._walkthrough(context, target)
        concepts = self._concepts(context)
        professional = self._how_professionals_read(context)
        practice = self._practice(context)

        markdown = "\n\n".join(
            section
            for section in [
                f"## What this file is\n{overview}",
                structure,
                walkthrough,
                concepts,
                professional,
                practice,
            ]
            if section
        )
        return AgentResult(
            agent=self.name,
            headline=f"Reading `{context.file_path}` — {self._headline_for(context, target)}",
            markdown=markdown,
            data={
                "target": target,
                "quiz": quiz,
                "concepts": [name for name in CONCEPT_SIGNALS if re.search(CONCEPT_SIGNALS[name][0], context.source, re.M)],
                "line_notes": self._line_notes(context, target),
            },
            follow_ups=[
                f"Why is `{target}` written that way?",
                "Show me the health report for this file",
                "Give me a practice exercise based on this file",
            ],
            xp=15,
        )

    # ------------------------------------------------------------------- sections
    def _pick_target(self, context: AgentContext) -> str:
        if context.selection:
            return "your selection"
        functions = self._functions(context)
        if functions:
            return max(functions, key=lambda f: f["length"])["name"]
        return context.file_path

    def _functions(self, context: AgentContext) -> list[dict]:
        if context.language == "python":
            try:
                tree = ast.parse(context.source)
            except SyntaxError:
                return []
            result = []
            for node in ast.walk(tree):
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    result.append(
                        {
                            "name": node.name,
                            "line": node.lineno,
                            "end_line": getattr(node, "end_lineno", node.lineno),
                            "length": getattr(node, "end_lineno", node.lineno) - node.lineno,
                            "params": [a.arg for a in node.args.args],
                            "docstring": ast.get_docstring(node) or "",
                            "source": ast.get_source_segment(context.source, node) or "",
                        }
                    )
            return result
        return [
            {
                "name": block["name"],
                "line": block["line"],
                "end_line": block["end_line"],
                "length": block["length"],
                "params": [p.strip() for p in block["params_raw"].split(",") if p.strip()],
                "docstring": "",
                "source": block["body"],
            }
            for block in _js_blocks(context)
        ]

    def _overview(self, context: AgentContext) -> str:
        lines = context.lines
        docstring = ""
        if context.language == "python":
            try:
                docstring = ast.get_docstring(ast.parse(context.source)) or ""
            except SyntaxError:
                docstring = ""
        else:
            header = [line.strip("/# ").strip() for line in lines[:6] if line.strip().startswith(("//", "/*", "#"))]
            docstring = " ".join(header[:3])

        functions = self._functions(context)
        metrics = context.analysis.metrics if context.analysis else None
        bullets = [
            f"**Language:** {context.language} • **Size:** {len(lines)} lines "
            f"({metrics.code_lines if metrics else '?'} of code, {metrics.comment_lines if metrics else 0} comments)"
            if metrics
            else f"**Language:** {context.language} • **Size:** {len(lines)} lines",
            f"**Building blocks:** {len(functions)} function(s)"
            + (f", {metrics.classes} class(es)" if metrics and metrics.classes else ""),
        ]
        if docstring:
            bullets.append(f"**The author's own words:** “{docstring.strip().splitlines()[0]}”")
        else:
            bullets.append(
                "**No module docstring.** Professionals open a file by reading its purpose statement first — "
                "adding one is a five-second change that saves every future reader."
            )
        return self.bullet(bullets)

    def _structure_map(self, context: AgentContext) -> str:
        functions = self._functions(context)
        if not functions:
            return "## Structure\nNo functions or classes yet — everything happens top to bottom, statement by statement."
        rows = ["## Structure (read in this order)", "", "| Line | Name | Inputs | Purpose |", "|---|---|---|---|"]
        for function in sorted(functions, key=lambda f: f["line"]):
            purpose = function["docstring"].splitlines()[0] if function["docstring"] else self._infer_purpose(function)
            inputs = ", ".join(f"`{p}`" for p in function["params"]) or "—"
            rows.append(f"| {function['line']} | `{function['name']}` | {inputs} | {purpose} |")
        rows.append("")
        rows.append(
            "Read top to bottom: imports first (what the file depends on), then constants, then functions "
            "in the order a reader needs them."
        )
        return "\n".join(rows)

    def _infer_purpose(self, function: dict) -> str:
        name = function["name"].replace("_", " ")
        source = function.get("source", "")
        bits = []
        if re.search(r"\bprint\(|return\s+f?['\"]", source):
            bits.append("builds text")
        if re.search(r"\bopen\(|\.read\(|\.write\(", source):
            bits.append("touches files")
        if re.search(r"\bexecute\(|SELECT|INSERT|UPDATE|DELETE", source, re.I):
            bits.append("talks to a database")
        if re.search(r"for\s+\w+\s+in", source):
            bits.append("loops over a collection")
        if re.search(r"return\s+\w+\s*[+\-*/]\s*", source):
            bits.append("computes a value")
        if re.search(r"raise\s+\w+Error", source):
            bits.append("validates input")
        hint = f" ({', '.join(bits)})" if bits else ""
        return f"Does the “{name}” step{hint}."

    def _walkthrough(self, context: AgentContext, target: str) -> tuple[str, list[dict]]:
        lines = context.lines
        functions = self._functions(context)
        selected = next((f for f in functions if f["name"] == target), None)
        start, end = (selected["line"], selected["end_line"] + 1) if selected else (1, min(len(lines), 30))
        start = max(1, start)
        end = min(len(lines), max(end, start + 1))

        notes = self._line_notes(context, target)
        rows = [f"## Line by line: `{target}` (lines {start}–{end})", ""]
        for note in notes[:24]:
            repeats = note.get("repeat", 1)
            if repeats > 1:
                label = (
                    f"**Lines {note['line']}–{note['end_line']}** — {repeats} nearly identical lines, "
                    f"e.g. `{note['code']}`"
                )
            else:
                label = f"**Line {note['line']}** — `{note['code']}`"
            rows.append(f"{label}\n{note['explanation']}\n")

        quiz = self._quiz(context, selected, notes)
        if quiz:
            rows.append("### Check yourself (answers below)")
            for index, question in enumerate(quiz, start=1):
                rows.append(f"{index}. {question['question']}")
            rows.append("")
            rows.append("<details><summary>Answers</summary>\n")
            for index, question in enumerate(quiz, start=1):
                rows.append(f"**{index}.** {question['answer']}\n")
            rows.append("</details>")
        return "\n".join(rows), quiz

    def _line_notes(self, context: AgentContext, target: str) -> list[dict]:
        lines = context.lines
        functions = self._functions(context)
        selected = next((f for f in functions if f["name"] == target), None)
        start, end = (selected["line"], selected["end_line"] + 1) if selected else (1, min(len(lines), 30))
        self._current_params = set(selected["params"]) if selected else set()
        notes: list[dict] = []
        for number in range(max(1, start), min(len(lines), end) + 1):
            raw = lines[number - 1]
            stripped = raw.strip()
            if not stripped or stripped.startswith("#") is False and not stripped:
                continue
            if stripped.startswith("#") and len(stripped) < 4:
                continue
            explained = self._explain_line(stripped, raw, context)
            if not explained:
                continue
            kind, explanation = explained
            # Collapse runs of the same shape (ten identical `append` lines teach nothing
            # ten times over) into one note that spans the range.
            previous = notes[-1] if notes else None
            if (
                previous
                and previous["kind"] == kind
                and previous["line"] + previous["repeat"] == number
                and kind in COMPRESSIBLE_KINDS
            ):
                previous["repeat"] += 1
                previous["end_line"] = number
                continue
            notes.append(
                {
                    "line": number,
                    "end_line": number,
                    "repeat": 1,
                    "kind": kind,
                    "code": stripped[:120],
                    "explanation": explanation,
                }
            )
        return notes

    def _explain_line(self, stripped: str, raw: str, context: AgentContext) -> tuple[str, str] | None:
        name = ""
        if re.match(r"^\s*(async\s+)?def\s+(\w+)", raw):
            name = re.match(r"^\s*(async\s+)?def\s+(\w+)", raw).group(2)
        elif re.match(r"^\s*class\s+(\w+)", raw):
            name = re.match(r"^\s*class\s+(\w+)", raw).group(1)
        elif re.match(r"^\s*(?:const|let|var)\s+(\w+)\s*=", raw):
            name = re.match(r"^\s*(?:const|let|var)\s+(\w+)\s*=", raw).group(1)
        elif re.match(r"^\s*function\s+(\w+)", raw):
            name = re.match(r"^\s*function\s+(\w+)", raw).group(1)

        assignment = _assignment_target(raw)
        for pattern, template in LINE_PATTERNS:
            if pattern == "__ASSIGNMENT_MARKER__":
                if not assignment:
                    continue
                text = template.replace("the name on the left", f"`{assignment}`")
                text += f" The right-hand side (`{_assignment_value(raw)[:50]}`) is evaluated first."
                return "assign", self._add_detail(text, stripped, raw)
            if re.search(pattern, raw):
                text = template
                if name and "{name}" in text:
                    text = text.replace("{name}", name)
                return _kind_for(pattern, raw), self._add_detail(text, stripped, raw)
        return None

    def _add_detail(self, text: str, stripped: str, raw: str) -> str:
        """Append the concrete 'so what' for this specific line."""
        details: list[str] = []
        if re.match(r"^\s*(async\s+)?def\s+\w+", raw):
            match = re.search(r"\(([^)]*)\)", raw)
            params = [p.strip() for p in (match.group(1) if match else "").split(",") if p.strip() and p.strip() not in {"self", "cls"}]
            details.append(
                f"Here it takes {len(params)} input(s): " + (", ".join(f"`{p}`" for p in params) if params else "*none*")
            )
        if re.match(r"^\s*for\s+(\w+)\s+in\s+(.+)", raw):
            loop = re.match(r"^\s*for\s+(\w+)\s+in\s+(.+)", raw)
            details.append(f"`{loop.group(1)}` is the current item taken from `{loop.group(2).rstrip(':')}`")
        if re.match(r"^\s*if\s+(.+)", raw):
            condition = re.match(r"^\s*if\s+(.+?)\s*:", raw)
            if condition:
                details.append(f"The question being asked is: {self._humanise_condition(condition.group(1))}")
        if "return" in stripped:
            returned = re.sub(r"^\s*return\s*", "", stripped) or "nothing (which means `None` in Python)"
            details.append(f"It returns `{returned[:60]}`")
        mutation = re.search(r"([A-Za-z_]\w*)\.(append|pop|update|remove|sort|extend)\(", raw)
        if mutation:
            target = mutation.group(1)
            if target in self._current_params:
                details.append(
                    f"Note the mutation: `{target}` came in as a parameter, so the caller's list changes too — "
                    "that is a side effect the signature does not show"
                )
            else:
                details.append(f"`{target}` grows by one element; the list itself is reused, not rebuilt")
        if "print(" in raw and "logger" not in raw:
            details.append("Debug output — fine while learning, but it will run in production too")
        return text + (" — " + "; ".join(details) + "." if details else "")

    def _humanise_condition(self, condition: str) -> str:
        conditions = {
            "==": "is it exactly equal to",
            "!=": "is it different from",
            "<": "is it less than",
            ">": "is it greater than",
            "in": "does it contain",
            "not": "is it NOT true that",
            "and": "and",
            "or": "or",
        }
        readable = condition
        for symbol, words in conditions.items():
            readable = readable.replace(symbol, f" {words} ")
        readable = re.sub(r"\s+", " ", readable).strip()
        return f"“{readable}?”"

    def _concepts(self, context: AgentContext) -> str:
        found = [(name, text) for name, (pattern, text) in CONCEPT_SIGNALS.items() if re.search(pattern, context.source, re.M)]
        if not found:
            return ""
        rows = ["## Concepts in this file", ""]
        for name, text in found[:6]:
            line = self._first_line(context, CONCEPT_SIGNALS[name][0])
            where = f" *(first appears on line {line})*" if line else ""
            rows.append(f"**{name}**{where}\n{text}\n")
        return "\n".join(rows)

    def _first_line(self, context: AgentContext, pattern: str) -> int | None:
        for number, line in enumerate(context.lines, start=1):
            if re.search(pattern, line):
                return number
        return None

    def _how_professionals_read(self, context: AgentContext) -> str:
        order = [
            "**1. Read the name and the docstring.** They answer 'what is this supposed to do?' before any detail.",
            "**2. Find the data.** Which functions create, change and return values? Data flow is the plot of the file.",
            "**3. Follow one path end to end.** Pick the happy path (valid input) and trace it. Ignore error branches the first time.",
            "**4. Notice side effects.** `print`, file writes, network calls and mutations of arguments are the parts you cannot see from the signature.",
            "**5. Only then read the edge cases.** Empty input, missing keys, zero, `None` — that is where bugs live.",
        ]
        if context.analysis and context.analysis.metrics.max_complexity > 10:
            order.append(
                f"**Watch out:** the most complex function has cyclomatic complexity "
                f"{context.analysis.metrics.max_complexity}. Read it twice — once for what it should do, once for "
                "the branch you would forget."
            )
        return "## How a professional reads this file\n" + self.bullet(order)

    def _practice(self, context: AgentContext) -> str:
        if not context.analysis or not context.analysis.findings:
            return (
                "## Practice\nPick one function and rewrite it from memory in a new file, then diff your version "
                "against the original. That exercise exposes exactly which parts you only *thought* you understood."
            )
        weakest = context.analysis.findings[0]
        return "\n".join(
            [
                "## Practice from your own file",
                "",
                f"- Fix line {weakest.line} yourself first (*{weakest.title}*), then ask me to compare my patch "
                "with yours.",
                "- Add one test that would have caught it. If you cannot write that test, the bug is not understood yet.",
                "- Explain the function out loud in three sentences. Stumbling on a sentence marks the line to re-read.",
            ]
        )

    def _headline_for(self, context: AgentContext, target: str) -> str:
        functions = self._functions(context)
        if not functions:
            return "a straightforward script"
        selected = next((f for f in functions if f["name"] == target), None)
        if not selected:
            return f"{len(functions)} function(s)"
        purpose = self._infer_purpose(selected).rstrip(".")
        return f"`{target}` is the main thing to understand — {purpose.lower()}."

    # ----------------------------------------------------------------------- quiz
    def _quiz(self, context: AgentContext, selected: dict | None, notes: list[dict]) -> list[dict]:
        questions: list[dict] = []
        lines = context.lines
        if selected:
            params = selected["params"]
            questions.append(
                {
                    "question": f"What does `{selected['name']}` return when it receives "
                    f"{'an empty list' if params else 'no arguments'}?",
                    "answer": self._answer_for_empty(context, selected),
                }
            )
            questions.append(
                {
                    "question": f"If line {selected['line'] + 1} were deleted, what would break first?",
                    "answer": "Trace the value that line produces: everything below it that reads that value would "
                    "either raise a `NameError`/`undefined` or silently compute the wrong result.",
                }
            )
        for finding in (context.analysis.findings[:2] if context.analysis else []):
            questions.append(
                {
                    "question": f"Line {finding.line}: why is “{finding.title}” a problem?",
                    "answer": finding.why_it_matters,
                }
            )
        if not questions and lines:
            questions.append(
                {
                    "question": f"What would happen on line {min(len(lines), 5)} if the first input were an empty string?",
                    "answer": "Work through the first operation that assumes content: it either returns early, or it "
                    "raises — the fix is to decide which of the two you want on purpose.",
                }
            )
        return questions[:4]

    def _answer_for_empty(self, context: AgentContext, selected: dict) -> str:
        source = selected.get("source", "")
        if re.search(r"if\s+not\s+\w+\s*:", source):
            return "It takes the early-return branch, so it returns whatever that guard returns — the author thought about the empty case."
        if re.search(r"for\s+\w+\s+in\s+\w+\s*:", source) and "/ len(" in source:
            return "It will raise `ZeroDivisionError` when dividing by the length of the empty collection — a guard is missing."
        if re.search(r"for\s+\w+\s+in\s+\w+\s*:", source):
            return "The loop body never runs, so the accumulator keeps its starting value (for example `0`)."
        return "Trace the first statement that touches the input; usually the function returns its initial accumulator unchanged."


def _assignment_target(raw: str) -> str:
    """Return the name being assigned on this line, or '' when it is not an assignment."""
    line = re.sub(r"#[^\n]*$", "", raw)
    line = re.sub(r"//[^\n]*$", "", line)
    match = re.match(r"^\s*(?:const|let|var\s+)?([A-Za-z_$][\w$.\[\]'\"]*)\s*:\s*[\w\[\]|.<>\s]+\s*=(?!=)", line)
    if not match:
        match = re.match(r"^\s*(?:const|let|var\s+)?([A-Za-z_$][\w$.\[\]'\"]*)\s*=(?!=)", line)
    if not match:
        return ""
    # reject compound operators (==, +=, <=, …) and keyword lines
    head = line[: match.end()]
    if re.search(r"[+\-*/%&|^]=$", head) or re.search(r"[=!<>]=$", head):
        return ""
    if re.match(r"^\s*(if|while|for|return|assert|elif)\b", line):
        return ""
    return match.group(1)


def _assignment_value(raw: str) -> str:
    match = re.match(r"^\s*(?:const|let|var\s+)?[A-Za-z_$][\w$.\[\]'\"]*\s*=(?!=)\s*(.*)$", re.sub(r"#[^\n]*$", "", raw))
    return (match.group(1).strip() if match else raw.strip())


def _js_blocks(context: AgentContext) -> list[dict]:
    from ..analyzer.js_analyzer import _function_blocks
    from ..analyzer.masking import mask_source

    return _function_blocks(mask_source(context.source, context.language).code_lines)


teacher_agent = TeacherAgent()

COMPRESSIBLE_KINDS = {"assign", "call.append", "call.other", "comment"}


def _kind_for(pattern: str, raw: str) -> str:
    """Short label used to collapse repetitive lines in the walkthrough."""
    if ".append(" in raw or ".extend(" in raw:
        return "call.append"
    if pattern.startswith("^\\s*\\w[\\w"):
        return "call.other"
    for marker, kind in (
        ("def ", "def"),
        ("class ", "class"),
        ("import", "import"),
        ("if ", "if"),
        ("elif", "elif"),
        ("else", "else"),
        ("for ", "for"),
        ("while ", "while"),
        ("try", "try"),
        ("except", "except"),
        ("return", "return"),
        ("with ", "with"),
        ("raise", "raise"),
        ("print(", "print"),
        ("assert", "assert"),
        ("yield", "yield"),
        ("await", "await"),
        ("global", "global"),
    ):
        if marker in raw:
            return kind
    if raw.lstrip().startswith(("#", "//", '"""', "'" + "'" * 2)):
        return "comment"
    return "other"
