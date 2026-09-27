"""Heuristic analyser for JavaScript / TypeScript (and JSX/TSX).

A real project would reach for the TypeScript compiler or ESLint; this engine stays
dependency-free by scanning a masked copy of the source (comments and string contents
blanked out) and tracking block nesting with a brace counter. It deliberately reports a
confidence value with every finding so the mentor can say "I am 70% sure" out loud.
"""

from __future__ import annotations

import re

from ..models import Finding, Metrics, new_id
from .masking import count_params, mask_source
from .rules import RULES

FUNCTION_START = re.compile(
    r"""(?x)
    (?P<kind>async\s+)?(?:function\s*(?P<name1>[A-Za-z_$][\w$]*)\s*)?      # function foo
    (?:const|let|var)\s+(?P<name2>[A-Za-z_$][\w$]*)\s*=\s*(?P<async2>async\s*)?\(
    """
)
ARROW_ASSIGN = re.compile(r"(?:const|let|var)\s+(?P<name>[A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\((?P<params>[^)]*)\)\s*=>")
FUNC_DECL = re.compile(r"(?P<async>async\s+)?function\s*(?P<name>[A-Za-z_$][\w$]*)?\s*\((?P<params>[^)]*)\)")
METHOD_DECL = re.compile(r"^\s*(?P<async>async\s+)?(?P<name>[A-Za-z_$][\w$]*)\s*\((?P<params>[^)]*)\)\s*\{")
SECRET_PATTERN = re.compile(
    r"""(?ix)\b(api[_-]?key|secret|token|password|passwd|client[_-]?secret|private[_-]?key|bearer)\b
        \s*[:=]\s*["'`][^"'`]{10,}["'`]"""
)
KNOWN_ASYNC_CALLS = (
    "fetch(",
    ".json(",
    ".text(",
    ".blob(",
    ".arrayBuffer(",
    "axios.",
    "fs.promises",
    "readFile(",
    "writeFile(",
    "query(",
)
DECISION_TOKENS = re.compile(r"\b(if|for|while|case|catch)\b|&&|\|\||\?\?")


class JSScan:
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
                end_line=overrides.pop("end_line", None),
                snippet=overrides.pop("snippet", ""),
                why_it_matters=rule.why_it_matters,
                how_to_fix=rule.how_to_fix,
                autofixable=overrides.pop("autofixable", rule.autofixable),
                confidence=overrides.pop("confidence", 0.7),
                source="static",
                references=list(rule.references),
                tags=overrides.pop("tags", []),
            )
        )


def _brace_delta(line: str) -> int:
    return line.count("{") - line.count("}")


def _function_blocks(code_lines: list[str]) -> list[dict]:
    """Locate top-level-ish function bodies and measure them."""
    blocks: list[dict] = []
    index = 0
    total = len(code_lines)
    while index < total:
        line = code_lines[index]
        match = FUNC_DECL.search(line) or ARROW_ASSIGN.search(line) or METHOD_DECL.match(line)
        if not match:
            index += 1
            continue
        params = match.groupdict().get("params") or ""
        name = (
            match.groupdict().get("name")
            or match.groupdict().get("name1")
            or match.groupdict().get("name2")
            or f"anonymous@{index + 1}"
        )
        # find the opening brace
        depth = _brace_delta(line)
        cursor = index
        while depth <= 0 and "{" not in line and cursor + 1 < total:
            cursor += 1
            depth += _brace_delta(code_lines[cursor])
            if cursor - index > 3:
                break
        if "{" not in "\n".join(code_lines[index : cursor + 1]):
            index += 1
            continue
        body_start = cursor
        depth = 0
        cursor = body_start
        max_depth = 0
        complexity = 1
        while cursor < total:
            current = code_lines[cursor]
            depth += _brace_delta(current)
            max_depth = max(max_depth, depth)
            complexity += len(DECISION_TOKENS.findall(current))
            if depth <= 0 and cursor > body_start:
                break
            cursor += 1
        body = "\n".join(code_lines[body_start : cursor + 1])
        blocks.append(
            {
                "name": name,
                "line": index + 1,
                "end_line": cursor + 1,
                "length": cursor - index,
                "complexity": complexity,
                "nesting": max_depth,
                "params": count_params(params),
                "params_raw": params,
                "body": body,
                "is_async": bool(match.groupdict().get("async") or match.groupdict().get("async2")),
                "has_await": "await " in body,
                "has_doc": bool(re.search(r"/\*\*", "\n".join(code_lines[max(0, index - 6) : index]))),
                "is_exported": index > 0 and "export" in code_lines[index - 1],
            }
        )
        index = max(cursor, index + 1)
    return blocks


def analyze(source: str, path: str = "<javascript>", language: str = "javascript") -> JSScan:
    scan = JSScan()
    masked = mask_source(source, language)
    code_lines = masked.code_lines
    raw_lines = masked.raw_lines

    scan.metrics.lines = len(raw_lines)
    scan.metrics.blank_lines = sum(1 for line in raw_lines if not line.strip())
    scan.metrics.comment_lines = len(masked.comment_lines)
    scan.metrics.code_lines = sum(1 for line in code_lines if line.strip())
    scan.metrics.comment_ratio = (
        round(scan.metrics.comment_lines / scan.metrics.lines * 100, 1) if scan.metrics.lines else 0.0
    )
    scan.metrics.todo_count = sum(1 for line in raw_lines if "TODO" in line.upper() or "FIXME" in line.upper())

    # --------------------------------------------------------------- line rules
    for number, line in enumerate(code_lines, start=1):
        raw = raw_lines[number - 1]
        if len(raw) > 120:
            scan.add("GEN001", number, f"Line {number} is {len(raw)} characters long.", snippet=raw.strip()[:110])

        if re.search(r"\bvar\s+[A-Za-z_$]", line):
            scan.add("JS001", number, "`var` is function scoped and hoisted; prefer `const`/`let`.", snippet=raw.strip()[:100])

        if re.search(r"(?<![=!<>])(?:==|!=)(?!=)", line) and "=>" not in line:
            scan.add("JS002", number, "Loose equality coerces types; use `===`/`!==`.", snippet=raw.strip()[:100])

        assign_in_condition = re.search(r"\bif\s*\(\s*[A-Za-z_$][\w$.]*\s*=\s*[^=]", line)
        if assign_in_condition:
            scan.add(
                "JS003",
                number,
                "This condition assigns instead of comparing, so the branch never runs as intended.",
                severity="critical",
                confidence=0.9,
                snippet=raw.strip()[:120],
            )

        if "console.log" in line or "console.debug" in line:
            scan.add("JS006", number, "Debug logging left in application code.", confidence=0.9, snippet=raw.strip()[:110])

        if re.search(r"\beval\s*\(|new\s+Function\s*\(", line):
            scan.add("JS009", number, "Dynamic code execution can run attacker-controlled strings.", confidence=0.9)

        if re.search(r"\.innerHTML\s*=", line) and not re.search(r"\.innerHTML\s*=\s*[\"'`]\s*[\"'`]", line):
            scan.add("JS008", number, "Assigning to `innerHTML` with dynamic data enables XSS.", confidence=0.6, snippet=raw.strip()[:110])

        if re.search(r"document\.write\s*\(", line):
            scan.add(
                "JS008",
                number,
                "`document.write` injects markup directly into the page.",
                severity="major",
                confidence=0.8,
            )

        if re.search(r"throw\s+[\"'`]", line):
            scan.add("JS020", number, "Throwing a non-Error value loses the stack trace.")

        if re.search(r"parseInt\s*\(\s*[^,)]*\)", line):
            scan.add("JS013", number, "`parseInt` without a radix can parse in an unexpected base.", confidence=0.7)

        if re.search(r"JSON\.parse\s*\(", line):
            # is there a try/catch nearby?
            window = "\n".join(code_lines[max(0, number - 12) : number + 3])
            if "try" not in window and "catch" not in window and ".catch(" not in window:
                scan.add("JS010", number, "`JSON.parse` can throw on malformed input and is not guarded.", confidence=0.65)

        if SECRET_PATTERN.search(raw):
            scan.add("JS011", number, "A hardcoded credential-looking literal is present in front-end code.", confidence=0.8)

        if "TODO" in raw.upper() or "FIXME" in raw.upper():
            scan.add("JS021", number, f"Unfinished work marker: {raw.strip()[:90]}")

        if re.search(r"\blet\s+[A-Za-z_$][\w$]*\s*=", line):
            assigned = re.search(r"\blet\s+([A-Za-z_$][\w$]*)", line)
            if assigned and len(re.findall(rf"\b{re.escape(assigned.group(1))}\s*=[^=]", "\n".join(code_lines))) <= 1:
                scan.add("JS019", number, f"`{assigned.group(1)}` is declared with `let` but never reassigned.")

        # missing await: an async call assigned directly to a variable
        for call in KNOWN_ASYNC_CALLS:
            if call in line and "await" not in line:
                statement = line.strip()
                if re.match(r"^(const|let|var)\s+\w+\s*=\s*", statement) or re.match(r"^\w+(\.\w+)*\s*=\s*", statement):
                    scan.add(
                        "JS004",
                        number,
                        f"`{call.rstrip('(')}` returns a promise but the result is used as a value — `await` is missing.",
                        confidence=0.8,
                        snippet=statement[:110],
                    )
                    break
        if re.search(r"^\s*(return\s+)?(fetch|axios\.\w+)\(", line) and "await" not in line and "return" in line:
            scan.add("JS005", number, "This promise is returned without error handling; add `.catch()` or `try/await`.", confidence=0.5)

    # ---------------------------------------------------------------- structure
    blocks = _function_blocks(code_lines)
    scan.metrics.functions = len(blocks)
    scan.metrics.classes = len(re.findall(r"\bclass\s+[A-Za-z_$]", masked.text)) - len(re.findall(r"\bclass\s*=", masked.text))
    for block in blocks:
        scan.metrics.max_complexity = max(scan.metrics.max_complexity, block["complexity"])
        scan.metrics.max_function_length = max(scan.metrics.max_function_length, block["length"])
        scan.metrics.max_nesting = max(scan.metrics.max_nesting, block["nesting"])
        if block["complexity"] > 10:
            scan.add(
                "JS016",
                block["line"],
                f"`{block['name']}` has cyclomatic complexity {block['complexity']}.",
                severity="major",
                confidence=0.75,
                end_line=block["end_line"],
            )
        if block["length"] > 50:
            scan.add(
                "JS016",
                block["line"],
                f"`{block['name']}` is {block['length']} lines long.",
                confidence=0.7,
                end_line=block["end_line"],
            )
        if block["nesting"] >= 5:
            scan.add(
                "JS015",
                block["line"],
                f"`{block['name']}` nests blocks {block['nesting']} levels deep.",
                confidence=0.6,
                end_line=block["end_line"],
            )
        if block["params"] > 4:
            scan.add("JS017", block["line"], f"`{block['name']}` takes {block['params']} parameters.")
        if block["is_async"] and not block["has_await"]:
            scan.add("JS005", block["line"], f"`{block['name']}` is async but never awaits.", confidence=0.6)
        if re.search(r":\s*any\b", block["params_raw"]) or re.search(r":\s*any\b", block["body"][:400]):
            scan.add("JS012", block["line"], f"`{block['name']}` uses the `any` type, which disables checking.")
        if block["is_exported"] and not block["has_doc"]:
            scan.add("JS014", block["line"], f"Exported function `{block['name']}` has no JSDoc block.")
        if block["is_exported"]:
            scan.metrics.extra.setdefault("exports", []).append(block["name"])

    documented = sum(1 for b in blocks if b["has_doc"])
    scan.metrics.docstring_coverage = round(documented / len(blocks) * 100, 1) if blocks else 100.0
    scan.metrics.avg_complexity = round(sum(b["complexity"] for b in blocks) / len(blocks), 1) if blocks else 0.0
    scan.metrics.imports = len(re.findall(r"^\s*import\s", masked.text, re.M))
    scan.metrics.extra["functions"] = [
        {
            "name": block["name"],
            "line": block["line"],
            "length": block["length"],
            "complexity": block["complexity"],
            "nesting": block["nesting"],
            "args": block["params"],
            "documented": block["has_doc"],
        }
        for block in sorted(blocks, key=lambda b: b["complexity"], reverse=True)
    ]
    if not re.search(r"/\*\*|^\s*//", source, re.M):
        scan.add("JS018", 1, "This module has no header comment or documentation.", confidence=0.6)

    # unused identifiers (very small scope: declared but never referenced again)
    for name, line in _unused_declarations(code_lines):
        scan.add("JS007", line, f"`{name}` is declared but never used.", severity="minor", confidence=0.55)

    return scan


def _unused_declarations(code_lines: list[str]) -> list[tuple[str, int]]:
    text = "\n".join(code_lines)
    results: list[tuple[str, int]] = []
    for number, line in enumerate(code_lines, start=1):
        for declaration in re.finditer(r"\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)", line):
            name = declaration.group(1)
            if name.startswith("_"):
                continue
            occurrences = len(re.findall(rf"\b{re.escape(name)}\b", text))
            if occurrences <= 1 and "export" not in line:
                results.append((name, number))
        for declaration in re.finditer(r"^\s*import\s+(?:\{([^}]*)\}|([A-Za-z_$][\w$]*))\s+from", line):
            names = []
            if declaration.group(1):
                names = [part.strip().split(" as ")[-1].strip() for part in declaration.group(1).split(",")]
            elif declaration.group(2):
                names = [declaration.group(2)]
            for name in names:
                if name and len(re.findall(rf"\b{re.escape(name)}\b", text)) <= 1:
                    results.append((name, number))
    return results
