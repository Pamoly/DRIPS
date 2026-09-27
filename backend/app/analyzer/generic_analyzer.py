"""Language-agnostic checks.

Anything that cannot be parsed still benefits from: line-length limits, TODO tracking,
secret detection, nesting by indentation, brace balance (a missing ``}`` is the single
most common beginner syntax error) and commented-out code detection.
"""

from __future__ import annotations

import re

from ..models import Finding, Metrics, new_id
from .masking import indent_level, mask_source, normalise_line
from .rules import RULES

SUSPICIOUS_BALANCE = {"}": "{", ")": "(", "]": "["}
SECRET_PATTERN = re.compile(
    r"""(?ix)\b(api[_-]?key|secret|token|password|passwd|private[_-]?key|bearer|aws_secret)\b
        \s*[:=]\s*["'][^"']{10,}["']"""
)


class GenericScan:
    def __init__(self) -> None:
        self.findings: list[Finding] = []
        self.metrics = Metrics()

    def add(self, rule_id: str, line: int, message: str, **overrides) -> None:
        rule = RULES[rule_id]
        self.findings.append(
            Finding(
                id=new_id("f"),
                rule=rule.id,
                title=overrides.pop("title", rule.title),
                message=message,
                severity=overrides.pop("severity", rule.severity),
                category=overrides.pop("category", rule.category),
                line=line,
                column=overrides.pop("column", 1),
                snippet=overrides.pop("snippet", ""),
                why_it_matters=rule.why_it_matters,
                how_to_fix=rule.how_to_fix,
                autofixable=overrides.pop("autofixable", rule.autofixable),
                confidence=overrides.pop("confidence", 0.6),
                references=list(rule.references),
            )
        )


def check_balance(lines: list[str]) -> tuple[int, int] | None:
    """Return (line, depth) of the first unexpected closing bracket, if any."""
    depth = 0
    for number, line in enumerate(lines, start=1):
        for char in line:
            if char in "{[(":
                depth += 1
            elif char in "}])":
                depth -= 1
                if depth < 0:
                    return number, depth
    return None


def analyze(source: str, path: str = "<file>", language: str = "plaintext") -> GenericScan:
    scan = GenericScan()
    masked = mask_source(source, language)
    lines = masked.raw_lines
    code_lines = masked.code_lines

    scan.metrics.lines = len(lines)
    scan.metrics.blank_lines = sum(1 for line in lines if not line.strip())
    scan.metrics.comment_lines = len(masked.comment_lines)
    scan.metrics.code_lines = sum(1 for line in code_lines if line.strip())
    scan.metrics.comment_ratio = (
        round(scan.metrics.comment_lines / len(lines) * 100, 1) if lines else 0.0
    )

    for number, raw in enumerate(lines, start=1):
        if len(raw) > 120:
            scan.add("GEN001", number, f"Line {number} is {len(raw)} characters long.", snippet=raw.strip()[:110])
        upper = raw.upper()
        if "TODO" in upper or "FIXME" in upper:
            scan.add("GEN002", number, f"Unfinished work marker: {raw.strip()[:90]}")
        if SECRET_PATTERN.search(raw):
            scan.add("GEN003", number, "A credential-looking literal is committed in source.", confidence=0.75)

    # commented-out code
    for line, comment in masked.comments:
        body = comment.lstrip("/#* ").strip()
        if re.match(r"^(def |class |function |import |from |return |if |for |while |const |let |var |[A-Za-z_][\w.]*\s*[=(])", body):
            if len(body) > 8:
                scan.add(
                    "GEN005",
                    line,
                    f"Line {line} looks like commented-out code.",
                    snippet=body[:100],
                    severity="minor",
                    confidence=0.5,
                )

    # nesting by indentation (meaningful for indentation-based languages)
    if language in {"yaml", "ruby", "shell", "plaintext", "markdown"}:
        width = 2 if language == "yaml" else 4
        for number, raw in enumerate(lines, start=1):
            if indent_level(raw, width) >= 5:
                scan.add("GEN004", number, "This line is nested five or more levels deep.", confidence=0.5)

    if language in {"json", "javascript", "typescript", "java", "go", "rust", "c", "cpp", "css"}:
        imbalance = check_balance(code_lines)
        if imbalance:
            line, _ = imbalance
            scan.add(
                "GEN008",
                line,
                f"A closing bracket on line {line} does not match any opening bracket.",
                title="Unbalanced brackets",
                severity="critical",
                category="bug",
                confidence=0.8,
            )
        else:
            opened = sum(line.count("{") for line in code_lines) + sum(line.count("(") for line in code_lines) + sum(line.count("[") for line in code_lines)
            closed = sum(line.count("}") for line in code_lines) + sum(line.count(")") for line in code_lines) + sum(line.count("]") for line in code_lines)
            if opened != closed:
                scan.add(
                    "GEN008",
                    len(lines),
                    f"Brackets are unbalanced: {opened} opened vs {closed} closed. The file will not parse.",
                    title="Unbalanced brackets",
                    severity="critical",
                    category="bug",
                    confidence=0.7,
                )

    if scan.metrics.lines > 500:
        scan.add(
            "GEN006",
            1,
            f"This file has {scan.metrics.lines} lines — consider splitting it by responsibility.",
            confidence=0.6,
        )

    if source and not source.endswith("\n"):
        scan.add(
            "GEN007",
            len(lines),
            "The file does not end with a newline (POSIX tools and diffs prefer one).",
            severity="info",
            confidence=0.9,
        )
    if "\r\n" in source and "\n" in source.replace("\r\n", ""):
        scan.add(
            "GEN007",
            1,
            "The file mixes CRLF and LF line endings.",
            severity="info",
            confidence=0.9,
        )

    # duplication inside the file
    seen: dict[str, int] = {}
    window: list[str] = []
    for number, line in enumerate(code_lines, start=1):
        normalised = normalise_line(line)
        if not normalised or len(normalised) < 8:
            window = []
            continue
        window.append(normalised)
        if len(window) >= 5:
            key = "\n".join(window[-5:])
            if key in seen and seen[key] < number - 5:
                scan.add(
                    "PY060" if language == "python" else "GEN010",
                    number,
                    f"Lines {seen[key]}-{seen[key] + 4} and {number - 4}-{number} are near-identical "
                    "blocks — extract them into one function.",
                    title="Duplicated code block",
                    severity="major",
                    category="maintainability",
                    confidence=0.65,
                )
                seen.pop(key, None)
            else:
                seen[key] = number - 4
    if seen:
        scan.metrics.duplication = round(len(seen) / max(1, scan.metrics.code_lines) * 100, 1)

    return scan
