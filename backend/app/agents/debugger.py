"""The debugger agent: turns an error into an explanation and a repair plan.

It works the way an experienced engineer debugs:

1. **Read the traceback bottom-up.** The last line is the error type; the frames above it
   are the path the program took to get there.
2. **Find the exact line** in the file you are editing.
3. **Form ranked hypotheses** — what could make this line fail, ordered by evidence.
4. **Give one minimal experiment** that distinguishes between them, before changing code.
5. **Propose a fix**, but keep the human in the loop.
"""

from __future__ import annotations

import re

from ..models import Finding
from .base import Agent, AgentContext, AgentResult
from .fixer import fixer_agent

ERROR_KNOWLEDGE: dict[str, dict[str, str]] = {
    "NameError": {
        "means": "You used a name Python has never seen: it was not assigned, not imported, or it is spelled differently from where you defined it.",
        "usually": "A typo, a missing `import`, or using a variable that only exists inside another function.",
        "check": "Search the file for the name — count the definition and the uses. Add the import or pass it in as an argument.",
    },
    "UnboundLocalError": {
        "means": "The name exists in the module, but this function assigns to it somewhere, so Python treats it as local and it is not filled in yet.",
        "usually": "An assignment lower in the function turns a global into a local.",
        "check": "Move the assignment above the first read, or pass the value in as a parameter.",
    },
    "TypeError": {
        "means": "The operation received a value of the wrong type — a classic example is adding a number to a string.",
        "usually": "Data from a file, an API or `input()` arrives as text and is used as a number (or the other way round).",
        "check": "Print `type(value)` right before the failing line, then convert explicitly (`int(...)`, `str(...)`).",
    },
    "ValueError": {
        "means": "The type is right but the value is impossible — `int(\"abc\")` is the everyday case.",
        "usually": "Parsing user input or a file that does not match the expected format.",
        "check": "Validate the input before converting: strip it, check it is non-empty, then convert inside a `try`.",
    },
    "ZeroDivisionError": {
        "means": "Something was divided by zero — including by the length of an empty collection.",
        "usually": "A file, list or filter returned nothing and the code divided by `len(...)`.",
        "check": "Decide what an empty collection means and return early (`if not items: return 0`).",
    },
    "IndexError": {
        "means": "You asked for a position that does not exist — the list is shorter than you assumed.",
        "usually": "Off-by-one (`range(len(x) + 1)`) or a loop that assumes at least one element.",
        "check": "Print `len(collection)` before the line; use `for item in collection` instead of indexing.",
    },
    "KeyError": {
        "means": "The dictionary does not have the key you asked for.",
        "usually": "Optional data (a field missing from one record) or a typo in the key name.",
        "check": "Use `d.get(key, default)` when the key is optional, and keep `.get` for genuinely optional fields.",
    },
    "AttributeError": {
        "means": "The object does not have the attribute you used — often because it is `None` at that point.",
        "usually": "A function returned `None` on some path and the caller kept using the result.",
        "check": "Trace where the object came from; assert it is not `None` before the line.",
    },
    "ImportError": {
        "means": "Python could not import the module: it is not installed or the path is wrong.",
        "usually": "Missing dependency, a circular import, or running the file from the wrong directory.",
        "check": "Install it (`pip install …`) or fix the import path; run from the project root.",
    },
    "ModuleNotFoundError": {
        "means": "The module does not exist in the current environment.",
        "usually": "Dependency not installed, or a typo in the package name.",
        "check": "`python -m pip install <package>` and confirm you are in the right virtual environment.",
    },
    "IndentationError": {
        "means": "The indentation does not line up with the surrounding block.",
        "usually": "Mixed tabs and spaces, or a line that is indented without a reason.",
        "check": "Select the block and re-indent with four spaces; your editor can show whitespace.",
    },
    "SyntaxError": {
        "means": "Python could not parse the file, so nothing in it ran at all.",
        "usually": "A missing `:` or bracket, or a quote that was never closed.",
        "check": "Look at the reported line *and the line before it* — the real problem is often one line up.",
    },
    "RecursionError": {
        "means": "A function called itself forever and ran out of stack.",
        "usually": "A missing base case, or a base case that is never reached.",
        "check": "Write down the smallest input and confirm it stops; add an explicit stopping condition.",
    },
    "FileNotFoundError": {
        "means": "The path does not exist from the directory the program is running in.",
        "usually": "Relative paths depend on the working directory, not on where the file lives.",
        "check": "Print `os.getcwd()` and the absolute path you built; build paths with `pathlib.Path(__file__).parent`.",
    },
    "JSONDecodeError": {
        "means": "The text is not valid JSON — often an empty response body or an HTML error page.",
        "usually": "The request failed and the error page was parsed as data.",
        "check": "Check the status code and print the first 200 characters of the body before parsing.",
    },
    "PermissionError": {
        "means": "The operating system refused the operation for this user.",
        "usually": "Writing outside the project, or a file owned by another user.",
        "check": "Confirm the path and permissions; avoid privileged locations in application code.",
    },
    "TimeoutError": {
        "means": "An operation took longer than allowed.",
        "usually": "A network call without a timeout, or an infinite loop.",
        "check": "Pass an explicit timeout and handle the retry policy deliberately.",
    },
    "TypeError: unsupported operand": {
        "means": "Two values of incompatible types were combined, such as `str + int`.",
        "usually": "Reading numbers from a file or an API and forgetting to convert them.",
        "check": "Convert at the boundary: `float(raw)` as soon as the text arrives.",
    },
}

JS_ERROR_KNOWLEDGE = {
    "is not a function": "The name holds something that is not callable — usually a misspelled import or a default/named export mix-up.",
    "is not defined": "The identifier does not exist in this scope: a typo, a missing import, or a block-scoped variable used outside its block.",
    "undefined is not an object": "You read a property of something that is `undefined` — typically an awaited value that was never awaited, or a missing API field.",
    "Cannot read properties of undefined": "The object is `undefined` at that point. Log the value one line above and use optional chaining (`a?.b`) only after you know why it is empty.",
    "await is only valid in async": "`await` was used outside an `async` function — make the enclosing function `async`.",
    "Unexpected token": "A parse error: an unbalanced bracket or a stray character. The reported column points at where the parser gave up, not always at the mistake.",
    "NetworkError": "The request never reached the server — check the URL, CORS and whether the backend is running.",
    "CORS": "The browser blocked a cross-origin response; the server must return the right `Access-Control-Allow-Origin` header.",
}


class DebuggerAgent(Agent):
    name = "debugger"
    description = "Reads a traceback, explains the root cause and proposes a repair."
    keywords = ("error", "traceback", "bug", "debug", "crash", "fails", "exception", "not working", "broken")

    def run(self, context: AgentContext) -> AgentResult:
        frames, error_type, error_message = self.parse(context.traceback_text or context.question)
        knowledge = self._knowledge(error_type, error_message)
        failing_line = self._locate(context, frames)
        suspects = self._hypotheses(context, failing_line, error_type, error_message)
        patches = self._patches(context, suspects)
        experiment = self._experiment(context, failing_line, error_type)

        markdown_parts = [
            f"## What the error is telling you\n**`{error_type}`** — {knowledge['means']}",
            f"**As reported:** `{self._short(error_message, 220) or '(no message)'}`",
            f"**Why it usually happens:** {knowledge['usually']}",
            f"**How to confirm it:** {knowledge['check']}",
        ]
        if frames:
            markdown_parts.append(self._frame_table(frames))
        if failing_line:
            markdown_parts.append(
                f"## The line that broke (line {failing_line})\n"
                f"{self.code_block(context.line(failing_line), context.language)}"
            )
        if suspects:
            rows = ["## Ranked hypotheses", ""]
            for index, suspect in enumerate(suspects, start=1):
                rows.append(
                    f"**{index}. {suspect['title']}** (confidence {int(suspect['confidence'] * 100)}%)\n"
                    f"{suspect['reason']}\n"
                )
                if suspect.get("how_to_fix"):
                    rows.append(f"*Fix:* {suspect['how_to_fix']}\n")
            markdown_parts.append("\n".join(rows))
        markdown_parts.append(f"## Run this before changing anything\n{experiment}")
        if not patches and suspects:
            finding = next((f for f in context.findings() if f.rule == suspects[0].get("rule")), None)
            guidance = fixer_agent.manual_guidance(finding) if finding else ""
            if guidance:
                markdown_parts.append(f"## The change to make by hand\n{guidance}")
        if patches:
            markdown_parts.append(
                f"## Proposed repair ({len(patches)} patch{'es' if len(patches) > 1 else ''})\n"
                "I prepared the change but did **not** touch your file. Open the Review tab to read the diff and "
                "approve it — or tell me why it is wrong and I will try again."
            )

        return AgentResult(
            agent=self.name,
            headline=f"`{error_type}` at line {failing_line or '?'} — {self._short(error_message)}",
            markdown="\n\n".join(markdown_parts),
            data={
                "error_type": error_type,
                "error_message": error_message,
                "failing_line": failing_line,
                "frames": frames,
                "hypotheses": suspects,
                "patch_ids": [p.id for p in patches],
                "patches": [p.to_dict() for p in patches],
                "experiment": experiment,
            },
            follow_ups=[
                "Apply the repair and explain what changed",
                "Show me this error's usual causes in a beginner example",
                "What test would prevent this from coming back?",
            ],
            xp=20,
        )

    # ------------------------------------------------------------------ parsing
    def parse(self, text: str) -> tuple[list[dict], str, str]:
        """Extract frames, error type and message from a Python or JavaScript traceback."""
        text = (text or "").strip()
        if not text:
            return [], "UnknownError", "No traceback was provided — paste the error text and I will read it."

        frames: list[dict] = []
        for match in re.finditer(r'File "(?P<file>[^"]+)", line (?P<line>\d+), in (?P<func>[\w<>_]+)', text):
            frames.append({"file": match.group("file"), "line": int(match.group("line")), "function": match.group("func")})
        for match in re.finditer(r"at\s+(?P<func>[\w$.<>]+)\s+\((?P<file>[^:]+):(?P<line>\d+):(?P<col>\d+)\)", text):
            frames.append({"file": match.group("file"), "line": int(match.group("line")), "function": match.group("func")})

        error_type, error_message = "UnknownError", text.splitlines()[-1][:300]
        py_match = re.search(r"^(\w+(?:Error|Exception|Warning|Interrupt|Exit))\s*:\s*(.*)$", text, re.M)
        if py_match:
            error_type, error_message = py_match.group(1), py_match.group(2).strip()
        else:
            for line in reversed(text.splitlines()):
                stripped = line.strip()
                js_match = re.match(r"^([A-Za-z]*Error|TypeError|SyntaxError|ReferenceError)\s*:?\s*(.*)$", stripped)
                if js_match:
                    error_type, error_message = js_match.group(1) or "Error", js_match.group(2).strip()
                    break
                for signature in JS_ERROR_KNOWLEDGE:
                    if signature.lower() in stripped.lower():
                        error_type, error_message = "JavaScriptError", stripped
                        break
        return frames, error_type, error_message

    def _knowledge(self, error_type: str, message: str) -> dict[str, str]:
        for key, value in JS_ERROR_KNOWLEDGE.items():
            if key.lower() in (message or "").lower() and error_type in {"JavaScriptError", "TypeError", "UnknownError"}:
                return {
                    "means": value,
                    "usually": "A value that should have been loaded or awaited is missing at this point.",
                    "check": "Log the value one line above the failure and read what actually arrived.",
                }
        return ERROR_KNOWLEDGE.get(
            error_type,
            {
                "means": "This error type is not in my knowledge base yet, so read the message literally: it names the operation that failed and the value it refused.",
                "usually": "The last operation on the failing line received data it did not expect.",
                "check": "Print the inputs of that line, then compare them with what the code assumes.",
            },
        )

    def _locate(self, context: AgentContext, frames: list[dict]) -> int | None:
        for frame in reversed(frames):
            if frame["file"].endswith(context.file_path) or context.file_path.endswith(frame["file"]):
                line = int(frame["line"])
                if 1 <= line <= len(context.lines):
                    return line
        if frames:
            line = int(frames[-1]["line"])
            if 1 <= line <= len(context.lines):
                return line
        # no traceback: fall back to the highest severity finding
        findings = context.findings()
        if findings:
            return findings[0].line
        return None

    def _hypotheses(
        self, context: AgentContext, failing_line: int | None, error_type: str, message: str
    ) -> list[dict]:
        suspects: list[dict] = []
        if failing_line:
            for finding in context.findings():
                if abs(finding.line - failing_line) <= 2 and self._relevant(finding, error_type):
                    suspects.append(
                        {
                            "title": finding.title,
                            "reason": f"Rule `{finding.rule}` flagged line {finding.line}: {finding.message}",
                            "confidence": min(0.95, 0.5 + finding.confidence / 2),
                            "how_to_fix": finding.how_to_fix,
                            "finding_id": finding.id,
                            "rule": finding.rule,
                        }
                    )
            line_text = context.line(failing_line)
            if "/" in line_text and error_type == "ZeroDivisionError" and not any(s["rule"] == "PY005" for s in suspects):
                suspects.append(
                    {
                        "title": "Dividing by something that can be zero",
                        "reason": f"Line {failing_line} divides, so the denominator can be 0 — most often `len(empty_list)`.",
                        "confidence": 0.8,
                        "how_to_fix": "Guard the empty case before dividing and decide what the correct answer is for no data.",
                        "rule": "PY005",
                    }
                )
            if error_type in {"KeyError"} and "[" in line_text:
                suspects.append(
                    {
                        "title": "Dictionary key is missing for this record",
                        "reason": "Indexing with `[...]` raises KeyError when the key is absent; optional fields need `.get`.",
                        "confidence": 0.75,
                        "how_to_fix": 'Use `record.get("field", default)` for optional data and validate required fields explicitly.',
                        "rule": "PY004",
                    }
                )
            if error_type in {"TypeError", "ValueError"} and re.search(r"\b(float|int|Decimal)\(", line_text):
                suspects.append(
                    {
                        "title": "Text is being converted to a number without validation",
                        "reason": "`float('abc')` and `int('')` raise; user or file input must be checked first.",
                        "confidence": 0.7,
                        "how_to_fix": "Strip and validate the raw value before converting, and return a clear error instead of crashing.",
                        "rule": "PY002",
                    }
                )
            if error_type == "NameError":
                match = re.search(r"name '(\w+)' is not defined", message)
                name = match.group(1) if match else "the name"
                suspects.append(
                    {
                        "title": f"`{name}` is used before it exists",
                        "reason": "It is either never assigned in this scope, or assigned only on a branch that did not run.",
                        "confidence": 0.8,
                        "how_to_fix": f"Define `{name}` before the loop/branch that reads it, or pass it in as a parameter.",
                        "rule": "PY007",
                    }
                )
        suspects.sort(key=lambda s: s["confidence"], reverse=True)
        return suspects[:4]

    def _patches(self, context: AgentContext, suspects: list[dict]) -> list:
        by_id = {f.id: f for f in context.findings()}
        patches = []
        for suspect in suspects[:2]:
            finding: Finding | None = by_id.get(suspect.get("finding_id", ""))
            if finding:
                patch = fixer_agent.patch_for(context, finding)
                if patch:
                    patches.append(patch)
        if not patches and suspects:
            rule = suspects[0].get("rule")
            synthetic = next((f for f in context.findings() if f.rule == rule), None)
            if synthetic:
                patch = fixer_agent.patch_for(context, synthetic)
                if patch:
                    patches.append(patch)
        return patches

    def _experiment(self, context: AgentContext, failing_line: int | None, error_type: str) -> str:
        if not failing_line:
            return (
                "Run the smallest input that still fails, paste me the output, and I will narrow it down. "
                "Debugging without a reproduction is guessing."
            )
        line = context.line(failing_line).strip()
        probe = self._probe_variables(line, context)
        language = context.language
        if language == "python":
            snippet = "\n".join(
                f'    print("DEBUG {name}:", repr({name}), type({name}))' for name in probe
            ) or '    print("DEBUG line reached")'
            return (
                "Paste these two lines above line "
                f"{failing_line}, run it, then delete them:\n\n```python\n{snippet}\n```\n"
                f"This shows the *actual* values at the moment `{error_type}` happens — the difference between what "
                "you believe the code has and what it really has is the bug."
            )
        snippet = "\n".join(f"  console.log('DEBUG {name}:', {name});" for name in probe) or "  console.log('DEBUG line reached');"
        return (
            f"Add this above the failing line, reproduce, then remove it:\n\n```js\n{snippet}\n```\n"
            "Reading the real values beats re-reading the code."
        )

    def _frame_table(self, frames: list[dict]) -> str:
        rows = ["## The path the program took (read it bottom-up)", "", "| Frame | Function | File | Line |", "|---|---|---|---|"]
        for index, frame in enumerate(reversed(frames[-8:]), start=1):
            rows.append(f"| {index} | `{frame['function']}` | `{frame['file'].split('/')[-1]}` | {frame['line']} |")
        rows.append("")
        rows.append(
            "The bottom frame is where the crash happened; the ones above it are *how you got there*. "
            "The bug is often one frame up: the caller passed the wrong value."
        )
        return "\n".join(rows)

    # ------------------------------------------------------------------ helpers
    @staticmethod
    def _relevant(finding: Finding, error_type: str) -> bool:
        """Filters out cosmetics: a missing docstring never causes a ZeroDivisionError."""
        if error_type in {"SyntaxError", "IndentationError"}:
            return True
        if finding.category in {"docs", "style"}:
            return False
        if error_type == "ZeroDivisionError":
            return finding.rule in {"PY005", "PY056", "PY042"} or finding.category in {"bug", "security"}
        return finding.category in {"bug", "security", "complexity"}

    @staticmethod
    def _probe_variables(line: str, context: AgentContext) -> list[str]:
        """Pick the names worth printing: locals/parameters, never built-ins or callees."""
        import builtins

        called = set(re.findall(r"\b([a-zA-Z_]\w*)\s*\(", line))
        names = [
            name
            for name in re.findall(r"\b([a-zA-Z_]\w{1,})\b", line)
            if name not in dir(builtins)
            and name not in called
            and name not in {"self", "cls", "None", "True", "False", "return", "and", "or", "not", "in", "is", "for", "if"}
        ]
        params = set()
        if context.analysis and context.analysis.metrics.extra.get("functions"):
            for function in context.analysis.metrics.extra["functions"]:
                if function.get("line") and abs(function["line"] - len(line)) < 100:
                    params.add(function["name"])
        ordered = list(dict.fromkeys(name for name in names if name not in params))
        return ordered[-2:] if len(ordered) >= 2 else ordered

    @staticmethod
    def _short(message: str, limit: int = 90) -> str:
        message = (message or "").strip().replace("\n", " ")
        return message[: limit - 1] + "…" if len(message) > limit else message


debugger_agent = DebuggerAgent()
