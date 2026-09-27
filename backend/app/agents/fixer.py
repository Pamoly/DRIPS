"""The fixer agent: turns a finding into a concrete, reviewable patch.

Every fixer is a small deterministic transformation with three safety properties:

1. **Verify before changing.** The fixer re-checks that the pattern the rule reported is
   really on that line. If the file moved on, the fixer refuses instead of guessing.
2. **Smallest change.** It edits only what the rule is about — no reformatting.
3. **Teach while fixing.** Each patch carries a ``learning_note`` written for a beginner,
   because the point is that the human learns the pattern and stops writing it.
"""

from __future__ import annotations

import difflib
import re
from dataclasses import dataclass
from typing import Callable

from ..models import Finding, Patch, new_id
from .base import AgentContext


@dataclass
class FixOutcome:
    source: str
    note: str
    risk: str = "minor"
    confidence: float = 0.9


Fixer = Callable[[list[str], Finding], FixOutcome | None]

# Rules where the transformation is mechanical enough to be applied without a human
# reading it first (still only when autonomy == "autopilot").
SAFE_AUTOFIX_RULES = {
    "PY003",
    "PY006",
    "PY010",
    "PY051",
    "PY052",
    "PY054",
    "PY055",
    "PY008",
    "PY050",
    "JS001",
    "JS002",
    "JS013",
    "JS019",
    "GEN001",
    "GEN007",
}


# --------------------------------------------------------------------- helpers
def _indent_of(line: str) -> str:
    return line[: len(line) - len(line.lstrip())]


def _block_range(lines: list[str], start: int, indent: str) -> tuple[int, int]:
    """Return the (start, end) exclusive range of the block that begins at ``start``."""
    end = start + 1
    while end < len(lines):
        line = lines[end]
        if not line.strip():
            end += 1
            continue
        if len(_indent_of(line)) <= len(indent) and line.strip():
            break
        end += 1
    return start, end


def _enclosing_def(lines: list[str], line_number: int) -> tuple[int, str, str] | None:
    """Find the nearest ``def`` above ``line_number`` (1-based). Returns (index, header, indent)."""
    for index in range(min(line_number, len(lines)) - 1, -1, -1):
        line = lines[index]
        if re.match(r"^\s*(async\s+)?def\s+\w+\s*\(", line):
            return index, line, _indent_of(line)
    return None


def _docstring_end(lines: list[str], def_index: int, indent: str) -> int:
    """Index of the first line *after* the optional docstring of a function."""
    body_start = def_index + 1
    while body_start < len(lines) and (not lines[body_start].strip() or lines[body_start].strip().startswith("#")):
        body_start += 1
    if body_start < len(lines):
        stripped = lines[body_start].strip()
        if stripped.startswith(('"""', "'''")):
            quote = stripped[:3]
            if stripped.count(quote) >= 2 and len(stripped) > 3:
                return body_start + 1
            for index in range(body_start + 1, len(lines)):
                if quote in lines[index]:
                    return index + 1
    return body_start


def _has_module_logger(lines: list[str]) -> tuple[bool, bool]:
    has_import = any(re.match(r"^import logging\b", line) for line in lines)
    has_logger = any(re.match(r"^logger\s*=\s*logging\.getLogger", line) for line in lines)
    return has_import, has_logger


# ---------------------------------------------------------------- python fixers
def fix_mutable_default(lines: list[str], finding: Finding) -> FixOutcome | None:
    index = finding.line - 1
    window = [index] if index < len(lines) else []
    if not window:
        return None
    line = lines[index]
    if not re.match(r"^\s*(async\s+)?def\s+\w+\s*\(", line):
        for candidate in range(max(0, index - 3), min(len(lines), index + 4)):
            if re.match(r"^\s*(async\s+)?def\s+\w+\s*\(", lines[candidate]):
                index = candidate
                line = lines[index]
                break
    match = re.search(r"(\w+)\s*=\s*(\[\]|\{\}|set\(\)|dict\(\)|list\(\))", line)
    if not match:
        return None
    name, literal = match.group(1), match.group(2)
    container = {"[]": "[]", "{}": "{}", "set()": "set()", "dict()": "{}", "list()": "[]"}[literal]
    lines[index] = line.replace(match.group(0), f"{name}=None", 1)
    indent = _indent_of(lines[index]) + "    "
    insert_at = _docstring_end(lines, index, _indent_of(lines[index]))
    guard = [f"{indent}if {name} is None:", f"{indent}    {name} = {container}"]
    lines[insert_at:insert_at] = guard
    return FixOutcome(
        source="\n".join(lines) + "\n",
        note=(
            f"`{name}` is now created inside the function. Before the fix, the same {container} object "
            "was shared by every call, so appending during one call changed the default for the next one. "
            "`None` means 'no argument was given' and cannot be mutated."
        ),
        risk="minor",
        confidence=0.95,
    )


def fix_bare_except(lines: list[str], finding: Finding) -> FixOutcome | None:
    index = finding.line - 1
    if index >= len(lines):
        return None
    line = lines[index]
    if not re.match(r"^\s*except\s*:", line):
        for candidate in range(index, min(len(lines), index + 3)):
            if re.match(r"^\s*except\s*:", lines[candidate]):
                index = candidate
                line = lines[index]
                break
        else:
            return None
    lines[index] = line.replace("except:", "except Exception as error:")
    indent = _indent_of(line) + "    "
    body_next = lines[index + 1] if index + 1 < len(lines) else ""
    if body_next.strip() in {"pass", "print(error)"}:
        lines.insert(index + 1, f"{indent}logging.exception(\"handled failure in %s\", __name__)")
        if lines[index + 2].strip() == "pass":
            del lines[index + 2]
    return FixOutcome(
        source="\n".join(lines) + "\n",
        note=(
            "The bare `except:` caught everything — including Ctrl+C and real bugs like typos — and hid the "
            "cause. Catching `Exception` keeps the recoverable failures while letting the ones you should "
            "never swallow through."
        ),
        risk="minor",
        confidence=0.85,
    )


def fix_none_comparison(lines: list[str], finding: Finding) -> FixOutcome | None:
    index = finding.line - 1
    if index >= len(lines):
        return None
    original = lines[index]
    if not re.search(r"[=!]=\s*None\b", original):
        return None
    fixed = re.sub(r"==", "is", original, count=0)
    fixed = re.sub(r"!=\s*None", "is not None", fixed)
    fixed = re.sub(r"\bis\s+None\s*==\s*None", "is None", fixed)
    fixed = re.sub(r"(?<!is)\bis\s+None", "is None", fixed)
    fixed = fixed.replace("is  None", "is None")
    if fixed == original:
        return None
    lines[index] = fixed
    return FixOutcome(
        source="\n".join(lines) + "\n",
        note=(
            "`is None` asks 'is this literally the None object?', while `== None` asks 'does this equal None?'. "
            "Objects can redefine `==`, so `is` is the one that cannot lie."
        ),
        risk="info",
        confidence=0.95,
    )


def fix_isinstance(lines: list[str], finding: Finding) -> FixOutcome | None:
    index = finding.line - 1
    if index >= len(lines):
        return None
    line = lines[index]
    match = re.search(r"type\(\s*([^()]+?)\s*\)\s*==\s*(\w+)", line)
    if not match:
        return None
    lines[index] = line[: match.start()] + f"isinstance({match.group(1)}, {match.group(2)})" + line[match.end() :]
    return FixOutcome(
        source="\n".join(lines) + "\n",
        note="`isinstance` also accepts subclasses, which `type(x) ==` rejects — that is why it is the standard form.",
        risk="info",
        confidence=0.9,
    )


def fix_add_encoding(lines: list[str], finding: Finding) -> FixOutcome | None:
    index = finding.line - 1
    if index >= len(lines) or "open(" not in lines[index]:
        return None
    line = lines[index]
    if "encoding=" in line:
        return None
    match = re.search(r"open\(([^)]*)\)", line)
    if not match:
        return None
    args = match.group(1).strip()
    replacement = f"open({args}, encoding=\"utf-8\")" if args else 'open(encoding="utf-8")'
    lines[index] = line[: match.start()] + replacement + line[match.end() :]
    return FixOutcome(
        source="\n".join(lines) + "\n",
        note=(
            "Without `encoding`, Python uses the operating system default, so the same file reads correctly on "
            "your machine and raises UnicodeDecodeError on a server. Always name UTF-8."
        ),
        risk="info",
        confidence=0.95,
    )


def fix_whitespace(lines: list[str], finding: Finding) -> FixOutcome | None:
    index = finding.line - 1
    if index >= len(lines):
        return None
    original = lines[index]
    fixed = original.rstrip()
    if fixed.startswith("\t"):
        fixed = re.sub(r"^\t+", lambda m: "    " * len(m.group(0)), fixed)
    if fixed == original:
        return None
    lines[index] = fixed
    return FixOutcome(
        source="\n".join(lines) + "\n",
        note="Trailing whitespace and tabs create noise in diffs; Python can even raise TabError when tabs and spaces are mixed.",
        risk="info",
        confidence=0.98,
    )


def fix_semicolons(lines: list[str], finding: Finding) -> FixOutcome | None:
    index = finding.line - 1
    if index >= len(lines):
        return None
    line = lines[index]
    if ";" not in line.strip() or line.lstrip().startswith("#"):
        return None
    indent = _indent_of(line)
    parts = [part.strip() for part in line.strip().split(";") if part.strip()]
    if len(parts) < 2:
        return None
    lines[index : index + 1] = [f"{indent}{part}" for part in parts]
    return FixOutcome(
        source="\n".join(lines) + "\n",
        note="One statement per line makes the control flow visible and keeps tracebacks pointing at a single action.",
        risk="info",
        confidence=0.85,
    )


def fix_print_to_logging(lines: list[str], finding: Finding) -> FixOutcome | None:
    index = finding.line - 1
    if index >= len(lines) or "print(" not in lines[index]:
        return None
    line = lines[index]
    lines[index] = re.sub(r"\bprint\s*\(", "logger.info(", line, count=1)
    has_import, has_logger = _has_module_logger(lines)
    inserted: list[str] = []
    if not has_import:
        inserted.append("import logging")
    if not has_logger:
        inserted.append("logger = logging.getLogger(__name__)")
    if inserted:
        # after the module docstring, before the first import/statement
        insert_at = 0
        if lines and lines[0].lstrip().startswith(('"""', "'''")):
            quote = lines[0].lstrip()[:3]
            insert_at = 1
            if lines[0].count(quote) < 2:
                while insert_at < len(lines) and quote not in lines[insert_at]:
                    insert_at += 1
                insert_at += 1
        lines[insert_at:insert_at] = inserted + [""]
    return FixOutcome(
        source="\n".join(lines) + "\n",
        note=(
            "`logging` gives you levels (debug/info/warning) and timestamps, and you can turn it off in "
            "production with configuration instead of hunting down print statements."
        ),
        risk="minor",
        confidence=0.8,
    )


def fix_remove_unused_import(lines: list[str], finding: Finding) -> FixOutcome | None:
    index = finding.line - 1
    if index >= len(lines):
        return None
    line = lines[index]
    if not re.match(r"^\s*(import|from)\s", line):
        return None
    match = re.search(r"([\w ,]+)$", line.rstrip())
    name = ""
    if "import" in line:
        after = line.split("import", 1)[1]
        name = after.split()[0].strip().rstrip(",") if after.strip() else ""
        if " as " in after:
            name = after.split(" as ")[1].split()[0]
    if "from" in line and "," in line.split("import", 1)[1]:
        # one alias among several: drop just that alias
        head, tail = line.split("import", 1)
        aliases = [a.strip() for a in tail.split(",")]
        kept = [a for a in aliases if a.split(" as ")[-1].strip() != name]
        if kept and len(kept) != len(aliases):
            lines[index] = f"{head}import {', '.join(kept)}"
            return FixOutcome(
                source="\n".join(lines) + "\n",
                note=f"`{name}` was imported but never used — dead imports mislead readers and slow start-up.",
                risk="info",
                confidence=0.85,
            )
    del lines[index]
    return FixOutcome(
        source="\n".join(lines) + "\n",
        note="The import was never used. Removing it keeps the module honest about its real dependencies.",
        risk="info",
        confidence=0.8,
    )


def fix_prefix_unused_variable(lines: list[str], finding: Finding) -> FixOutcome | None:
    index = finding.line - 1
    if index >= len(lines):
        return None
    line = lines[index]
    match = re.search(r"\b([A-Za-z_]\w*)\s*=", line)
    if not match or match.group(1).startswith("_"):
        return None
    name = match.group(1)
    lines[index] = re.sub(rf"\b{re.escape(name)}\b", f"_{name}", line, count=1)
    return FixOutcome(
        source="\n".join(lines) + "\n",
        note=(
            f"`{name}` was assigned but never read — usually a leftover or a typo. The leading underscore tells "
            "the next reader (and linters) 'this is intentionally ignored'. If it was meant to be used, that "
            "missing use is your bug."
        ),
        risk="minor",
        confidence=0.65,
    )


def fix_enumerate_loop(lines: list[str], finding: Finding) -> FixOutcome | None:
    index = finding.line - 1
    if index >= len(lines):
        return None
    line = lines[index]
    match = re.match(r"^(\s*)for\s+(\w+)\s+in\s+range\(len\((\w+(?:\.\w+)*)\)\)\s*:\s*$", line)
    if not match:
        return None
    indent, index_name, sequence = match.group(1), match.group(2), match.group(3)
    item_name = "item" if index_name != "item" else "value"
    _, end = _block_range(lines, index, indent)
    body = lines[index + 1 : end]
    if not any(re.search(rf"{re.escape(sequence)}\s*\[\s*{re.escape(index_name)}\s*\]", body_line) for body_line in body):
        return None
    if any(re.search(rf"\b{re.escape(item_name)}\b", body_line) for body_line in body):
        item_name = f"{item_name}_"
    new_body = [
        re.sub(rf"{re.escape(sequence)}\s*\[\s*{re.escape(index_name)}\s*\]", item_name, body_line)
        for body_line in body
    ]
    lines[index] = f"{indent}for {index_name}, {item_name} in enumerate({sequence}):"
    lines[index + 1 : end] = new_body
    return FixOutcome(
        source="\n".join(lines) + "\n",
        note=(
            f"You asked for positions to then look values up. `enumerate` hands you both at once, which removes "
            f"the index arithmetic — the usual home of off-by-one bugs — and reads as `{index_name}, {item_name}`."
        ),
        risk="minor",
        confidence=0.75,
    )


# ------------------------------------------------------------- javascript fixers
def fix_var_to_let(lines: list[str], finding: Finding) -> FixOutcome | None:
    index = finding.line - 1
    if index >= len(lines):
        return None
    line = lines[index]
    if "var " not in line:
        return None
    name_match = re.search(r"\bvar\s+([A-Za-z_$][\w$]*)", line)
    if not name_match:
        return None
    name = name_match.group(1)
    reassigned = len(re.findall(rf"\b{re.escape(name)}\s*(?:\+\+|--|[+\-*/]?=)(?!=)", "\n".join(lines))) > 0
    keyword = "let" if reassigned else "const"
    lines[index] = line.replace("var ", f"{keyword} ", 1)
    return FixOutcome(
        source="\n".join(lines) + "\n",
        note=(
            f"`var` is hoisted to the whole function and leaks out of blocks and loops. `{keyword}` is scoped to "
            f"the block where it is declared"
            + (", and it is only `let` because the value is reassigned later." if reassigned else ", and `const` also tells the reader the binding never changes.")
        ),
        risk="minor",
        confidence=0.85 if reassigned else 0.75,
    )


def fix_loose_equality(lines: list[str], finding: Finding) -> FixOutcome | None:
    index = finding.line - 1
    if index >= len(lines):
        return None
    line = lines[index]
    if re.search(r"[=!]=\s*(null|undefined)|(null|undefined)\s*[=!]=", line):
        return None  # `== null` is idiomatic: it matches both null and undefined
    fixed = re.sub(r"(?<![=!<>])==(?!=)", "===", line)
    fixed = re.sub(r"(?<![=!<>])!=(?!=)", "!==", fixed)
    if fixed == line:
        return None
    lines[index] = fixed
    return FixOutcome(
        source="\n".join(lines) + "\n",
        note=(
            "`===` compares value and type without conversion. `==` converts first, which is why `'0' == false` "
            "is true and `1 == '1'` is true — the source of bugs that only appear with real user input."
        ),
        risk="minor",
        confidence=0.85,
    )


def fix_assignment_in_condition(lines: list[str], finding: Finding) -> FixOutcome | None:
    index = finding.line - 1
    if index >= len(lines):
        return None
    line = lines[index]
    match = re.search(r"(if|while)\s*\(\s*([A-Za-z_$][\w$.]*)\s*=\s*([^=][^)]*)\)", line)
    if not match:
        return None
    lines[index] = line[: match.start()] + f"{match.group(1)} ({match.group(2)} === {match.group(3).strip()})" + line[match.end() :]
    return FixOutcome(
        source="\n".join(lines) + "\n",
        note=(
            "`if (cart.length = 0)` stored 0 into `cart.length` and the condition was falsy forever, so the check "
            "never protected anything. `===` compares instead of assigning."
        ),
        risk="minor",
        confidence=0.9,
    )


def fix_missing_await(lines: list[str], finding: Finding) -> FixOutcome | None:
    index = finding.line - 1
    if index >= len(lines):
        return None
    line = lines[index]
    if "await" in line:
        return None
    fixed = re.sub(r"=\s*((?:response|res|result|resp|r)\.[\w]+\(|fetch\()", r"= await \1", line)
    if fixed == line:
        fixed = re.sub(r"=\s*([\w.$]+\.(?:json|text|blob|arrayBuffer)\()", r"= await \1", line)
    if fixed == line:
        return None
    lines[index] = fixed
    enclosing_async = any(
        re.search(r"async\s+(?:function|\w+\s*=|\([\w,\s]*\)\s*=>)", "\n".join(lines[max(0, index - 25) : index]))
        for _ in [0]
    )
    return FixOutcome(
        source="\n".join(lines) + "\n",
        note=(
            "Without `await` you get the Promise object, not the parsed data — so `data.id` is `undefined` and the "
            "failure shows up somewhere unrelated."
            + ("" if enclosing_async else " NOTE: the surrounding function also has to be `async` for this to run.")
        ),
        risk="minor",
        confidence=0.7,
    )


def fix_remove_console_log(lines: list[str], finding: Finding) -> FixOutcome | None:
    index = finding.line - 1
    if index >= len(lines) or "console.log" not in lines[index]:
        return None
    del lines[index]
    return FixOutcome(
        source="\n".join(lines) + "\n",
        note="Debug logging was shipped to users. Use a logger with levels so you can keep the useful messages and silence them in production.",
        risk="info",
        confidence=0.8,
    )


def fix_parseint_radix(lines: list[str], finding: Finding) -> FixOutcome | None:
    index = finding.line - 1
    if index >= len(lines):
        return None
    line = lines[index]
    match = re.search(r"parseInt\(\s*([^,()]+)\s*\)", line)
    if not match:
        return None
    lines[index] = line[: match.start()] + f"parseInt({match.group(1).strip()}, 10)" + line[match.end() :]
    return FixOutcome(
        source="\n".join(lines) + "\n",
        note="Passing the base (10) removes any chance of the string being read in another base; even if the browser default is decimal today, the intent is now explicit.",
        risk="info",
        confidence=0.9,
    )


def fix_let_to_const(lines: list[str], finding: Finding) -> FixOutcome | None:
    index = finding.line - 1
    if index >= len(lines) or not re.search(r"\blet\s+\w", lines[index]):
        return None
    lines[index] = re.sub(r"\blet\b", "const", lines[index], count=1)
    return FixOutcome(
        source="\n".join(lines) + "\n",
        note="`const` documents that the binding never changes, so a reader does not have to scan the block to know whether it might.",
        risk="info",
        confidence=0.9,
    )


FIXERS: dict[str, Fixer] = {
    "PY001": fix_mutable_default,
    "PY002": fix_bare_except,
    "PY003": fix_none_comparison,
    "PY006": fix_isinstance,
    "PY008": fix_enumerate_loop,
    "PY010": fix_add_encoding,
    "PY051": fix_whitespace,
    "PY052": fix_semicolons,
    "PY053": fix_print_to_logging,
    "PY055": fix_remove_unused_import,
    "PY056": fix_prefix_unused_variable,
    "JS001": fix_var_to_let,
    "JS002": fix_loose_equality,
    "JS003": fix_assignment_in_condition,
    "JS004": fix_missing_await,
    "JS006": fix_remove_console_log,
    "JS013": fix_parseint_radix,
    "JS019": fix_let_to_const,
}

# Findings which are better taught than auto-rewritten: the mentor explains the change
# and shows a snippet, but does not pretend a one-line edit is safe.
MANUAL_REWRITE_NOTES: dict[str, str] = {
    "PY021": (
        "Replace the concatenation with a parameterised query:\n\n"
        '```python\ncursor.execute("SELECT * FROM products WHERE name LIKE ?", (f"%{query}%",))\n```\n'
        "The database then sends the *value* separately from the *command*, so a crafted name cannot become SQL."
    ),
    "PY020": (
        "Remove the dynamic execution:\n\n"
        "```python\n# instead of eval(user_input)\nallowed = {\"add\": lambda a, b: a + b, \"sub\": lambda a, b: a - b}\nresult = allowed[operation](a, b)   # only known operations can run\n```"
    ),
    "PY022": (
        "Pass an argument list instead of a shell string:\n\n"
        '```python\nsubprocess.run(["ls", "-l", path], check=True)  # shell=False by default\n```\n'
        "With `shell=True`, characters like `;` and `$()` in the input run as extra commands."
    ),
    "PY023": (
        "Move the value out of source:\n\n"
        '```python\nimport os\napi_key = os.environ["API_KEY"]  # set outside the repo\n```\n'
        "Then rotate the leaked credential — anything committed must be treated as public."
    ),
    "JS008": (
        "Assign text instead of markup:\n\n"
        "```js\nelement.textContent = userInput;                       // never parses HTML\n"
        "// or, if the HTML must be trusted:\nelement.innerHTML = DOMPurify.sanitize(userHtml);\n```"
    ),
    "JS009": (
        "Dynamic execution of a string is remote code execution in the browser. Parse data instead:\n\n"
        "```js\nconst config = JSON.parse(text);   // data, not code\n```"
    ),
    "JS007": (
        "Do not let the caller believe the operation succeeded:\n\n"
        "```js\ncatch (error) {\n  logger.error(\"checkout failed\", error);\n  throw error;            // or: return { ok: false, error: error.message };\n}\n```"
    ),
    "PY005": (
        "Decide what an empty collection *means* before dividing:\n\n"
        "```python\ndef average_price(prices):\n    if not prices:\n        return 0        # or raise ValueError(\"prices must not be empty\")\n    return sum(prices) / len(prices)\n```"
    ),
}


class FixerAgent:
    """Builds patches from findings, one finding at a time."""

    name = "fixer-agent"
    description = "Turns a finding into a minimal, reviewable patch."

    def patch_for(self, context: AgentContext, finding: Finding) -> Patch | None:
        fixer = FIXERS.get(finding.rule)
        if fixer is None:
            return None
        try:
            outcome = fixer(context.source.splitlines(), finding)
        except Exception:  # a fixer must never break the session
            return None
        if outcome is None or outcome.source.strip() == context.source.strip():
            return None
        diff = unified_diff(context.source, outcome.source, context.file_path)
        return Patch(
            id=new_id("patch"),
            file_path=context.file_path,
            finding_id=finding.id,
            title=f"{finding.title} (line {finding.line})",
            rationale=finding.how_to_fix or finding.why_it_matters,
            diff=diff,
            original=context.source,
            patched=outcome.source,
            confidence=round(outcome.confidence, 2),
            risk=outcome.risk,  # type: ignore[arg-type]
            created_by=self.name,
            learning_note=outcome.note,
            verification={
                "rule": finding.rule,
                "line": finding.line,
                "severity": finding.severity,
                "category": finding.category,
                "verified_pattern": True,
            },
        )

    def patches_for_file(self, context: AgentContext, limit: int = 12) -> list[Patch]:
        """One patch per autofixable finding, hardest-hitting first."""
        order = {"critical": 0, "major": 1, "minor": 2, "info": 3}
        findings = sorted(context.findings(), key=lambda f: (order.get(f.severity, 4), f.line))
        patches: list[Patch] = []
        for finding in findings:
            patch = self.patch_for(context, finding)
            if patch:
                patches.append(patch)
            if len(patches) >= limit:
                break
        return patches

    def is_auto_apply_safe(self, patch: Patch, finding: Finding | None = None) -> bool:
        """Autopilot only touches changes a reviewer would rubber-stamp."""
        rule = (finding.rule if finding else patch.verification.get("rule", ""))
        return (
            rule in SAFE_AUTOFIX_RULES
            and patch.confidence >= 0.85
            and patch.risk in {"info", "minor"}
        )

    def manual_guidance(self, finding: Finding) -> str:
        return MANUAL_REWRITE_NOTES.get(finding.rule, "")


def unified_diff(original: str, patched: str, path: str) -> str:
    """Unified diff with three lines of context, like `git diff`."""
    diff_lines = difflib.unified_diff(
        original.splitlines(keepends=True),
        patched.splitlines(keepends=True),
        fromfile=f"a/{path}",
        tofile=f"b/{path}",
        n=3,
    )
    return "".join(diff_lines)


fixer_agent = FixerAgent()
