"""AST-based analyser for Python source.

The analyser walks the parsed tree once, collecting findings from the rule catalog plus
the metrics the health score needs (complexity, nesting, docstring coverage, …). Every
finding is attached to a real line and carries a plain-language explanation, because the
audience is a beginner learning to read code.
"""

from __future__ import annotations

import ast
import builtins
import io
import re
import tokenize
from dataclasses import dataclass, field
from typing import Iterable

from ..models import Finding, Metrics, new_id
from .rules import RULES

BUILTIN_NAMES = set(dir(builtins))
SECRET_PATTERN = re.compile(
    r"""(?ix)
    \b(
        api[_-]?key | secret[_-]?key | access[_-]?token | auth[_-]?token | client[_-]?secret |
        private[_-]?key | password | passwd | pwd | bearer
    )\b
    \s*[:=]\s*
    ["'][^"']{8,}["']
    """
)
UNSAFE_CALLS = {
    "eval": ("PY020", "critical"),
    "exec": ("PY020", "critical"),
    "compile": ("PY020", "critical"),
    "pickle.loads": ("PY024", "critical"),
    "yaml.load": ("PY024", "critical"),
    "os.system": ("PY022", "critical"),
    "os.popen": ("PY022", "critical"),
}
PRINT_ALLOWED_MODULES = {"manage.py", "cli.py", "__main__.py", "setup.py"}


@dataclass
class FunctionInfo:
    name: str
    qualname: str
    lineno: int
    end_lineno: int
    complexity: int
    max_nesting: int
    args: int
    has_docstring: bool
    is_async: bool
    has_await: bool
    returns_value: bool
    public: bool
    annotations: int = 0

    @property
    def length(self) -> int:
        return max(0, self.end_lineno - self.lineno)


@dataclass
class PythonScan:
    findings: list[Finding] = field(default_factory=list)
    metrics: Metrics = field(default_factory=Metrics)

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
                confidence=overrides.pop("confidence", 0.85),
                source=overrides.pop("source", "static"),
                references=list(rule.references),
                tags=overrides.pop("tags", []),
            )
        )


def _guarded_names(tree: ast.Module) -> set[str]:
    """Collect names that already have an emptiness guard in this file.

    ``if not prices: return 0`` (or ``if len(prices) == 0``) proves the author thought
    about the empty case, so the division further down is not a latent crash. Reporting
    it anyway is the kind of false positive that teaches beginners to ignore linters.
    """
    guarded: set[str] = set()
    for node in ast.walk(tree):
        if not isinstance(node, ast.If):
            continue
        test = node.test
        if isinstance(test, ast.UnaryOp) and isinstance(test.op, ast.Not):
            operand = test.operand
            if isinstance(operand, ast.Name):
                guarded.add(operand.id)
            elif isinstance(operand, ast.Call) and _call_name(operand.func) == "len" and operand.args:
                guarded.add(_call_name(operand.args[0]))
        elif isinstance(test, ast.Compare) and isinstance(test.left, (ast.Name, ast.Call)):
            left = test.left
            values = {getattr(comparator, "value", None) for comparator in test.comparators}
            names = {_call_name(comparator) for comparator in test.comparators}
            if isinstance(left, ast.Name) and (0 in values or not left.id.strip()):
                guarded.add(left.id)
            if isinstance(left, ast.Call) and _call_name(left.func) == "len" and left.args and (0 in values):
                guarded.add(_call_name(left.args[0]))
            if isinstance(left, ast.Call) and _call_name(left.func) == "len" and left.args and ("0" in names):
                guarded.add(_call_name(left.args[0]))
    return guarded


def _call_name(node: ast.AST) -> str:
    """Best-effort dotted name for a Call node (``os.system``, ``eval``, …)."""
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        prefix = _call_name(node.value)
        return f"{prefix}.{node.attr}" if prefix else node.attr
    return ""


def _complexity(node: ast.AST) -> int:
    """McCabe cyclomatic complexity: 1 + number of decision points."""
    score = 1
    for child in ast.walk(node):
        if isinstance(child, (ast.If, ast.For, ast.AsyncFor, ast.While, ast.ExceptHandler, ast.IfExp)):
            score += 1
        elif isinstance(child, ast.BoolOp):
            score += len(child.values) - 1
        elif isinstance(child, ast.comprehension):
            score += 1 + len(child.ifs)
        elif isinstance(child, ast.Match):  # pragma: no cover - py3.10+
            score += len(child.cases)
        elif isinstance(child, ast.Assert):
            score += 1
    return score


def _max_nesting(node: ast.AST, depth: int = 0) -> int:
    """Deepest block nesting inside ``node``."""
    nesting_nodes = (ast.If, ast.For, ast.AsyncFor, ast.While, ast.With, ast.AsyncWith, ast.Try)
    deepest = depth
    for child in ast.iter_child_nodes(node):
        if isinstance(child, nesting_nodes):
            deepest = max(deepest, _max_nesting(child, depth + 1))
        elif isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)) and depth > 0:
            # nested definitions start their own counter
            deepest = max(deepest, _max_nesting(child, depth))
        elif isinstance(child, (ast.If, ast.For, ast.While)):
            deepest = max(deepest, _max_nesting(child, depth))
        else:
            deepest = max(deepest, _max_nesting(child, depth))
    return deepest


def _has_await(node: ast.AST) -> bool:
    return any(isinstance(child, (ast.Await, ast.AsyncFor, ast.AsyncWith)) for child in ast.walk(node))


def _returns_value(node: ast.AST) -> bool:
    return any(
        isinstance(child, ast.Return) and child.value is not None and not isinstance(child.value, ast.Constant)
        for child in ast.walk(node)
    )


def _function_info(node: ast.FunctionDef | ast.AsyncFunctionDef, parents: list[str]) -> FunctionInfo:
    args = node.args
    arg_count = (
        len(args.posonlyargs)
        + len(args.args)
        + len(args.kwonlyargs)
        + (1 if args.vararg else 0)
        + (1 if args.kwarg else 0)
    )
    if arg_count and args.posonlyargs + args.args and (args.posonlyargs + args.args)[0].arg in {"self", "cls"}:
        arg_count -= 1
    annotations = sum(1 for a in list(args.posonlyargs) + list(args.args) + list(args.kwonlyargs) if a.annotation)
    if node.returns is not None:
        annotations += 1
    return FunctionInfo(
        name=node.name,
        qualname=".".join(parents + [node.name]),
        lineno=node.lineno,
        end_lineno=getattr(node, "end_lineno", node.lineno),
        complexity=_complexity(node),
        max_nesting=_max_nesting(node),
        args=arg_count,
        has_docstring=ast.get_docstring(node) is not None,
        is_async=isinstance(node, ast.AsyncFunctionDef),
        has_await=_has_await(node),
        returns_value=_returns_value(node),
        public=not node.name.startswith("_"),
        annotations=annotations,
    )


def _imported_names(tree: ast.Module) -> dict[str, tuple[str, int]]:
    names: dict[str, tuple[str, int]] = {}
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                names[(alias.asname or alias.name.split(".")[0])] = (alias.name, node.lineno)
        elif isinstance(node, ast.ImportFrom):
            if node.module == "__future__":  # compiler directives, never referenced by name
                continue
            for alias in node.names:
                if alias.name == "*":
                    continue
                names[alias.asname or alias.name] = (f"{node.module}.{alias.name}", node.lineno)
    return names


def _used_names(tree: ast.Module) -> set[str]:
    used: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Name) and isinstance(node.ctx, ast.Load):
            used.add(node.id)
        elif isinstance(node, ast.Attribute):
            base = _call_name(node.value)
            if base:
                used.add(base)
    return used


def _unused_imports(tree: ast.Module, source: str) -> list[tuple[str, str, int]]:
    imports = _imported_names(tree)
    if not imports:
        return []
    used = _used_names(tree)
    # names referenced through ``__all__`` or string annotations still count as used
    string_tokens = set(re.findall(r"[A-Za-z_][A-Za-z0-9_]*", "\n".join(
        line for line in source.splitlines() if "__all__" in line or "TYPE_CHECKING" in line
    )))
    return [
        (name, module, line)
        for name, (module, line) in imports.items()
        if name not in used and name not in string_tokens and f"{name}." not in source
    ]


def _unused_locals(tree: ast.Module, source: str) -> list[tuple[str, int]]:
    """Variables assigned in a function but never read afterwards."""
    results: list[tuple[str, int]] = []
    lines = source.splitlines()
    for node in ast.walk(tree):
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        assigned: dict[str, int] = {}
        for child in ast.walk(node):
            if isinstance(child, ast.Assign):
                for target in child.targets:
                    if isinstance(target, ast.Name) and target.id != "_":
                        assigned.setdefault(target.id, target.lineno)
            elif isinstance(child, ast.AnnAssign) and isinstance(child.target, ast.Name):
                assigned.setdefault(child.target.id, child.lineno)
        loads = {
            child.id
            for child in ast.walk(node)
            if isinstance(child, ast.Name) and isinstance(child.ctx, ast.Load)
        }
        for name, line in assigned.items():
            if name in loads or name.startswith("_"):
                continue
            if any(re.search(rf"\b{re.escape(name)}\b", ln) for ln in lines[line:line + 1] if "return" in ln):
                continue
            results.append((name, line))
    return results


def _check_comments_and_whitespace(source: str, scan: PythonScan, max_line_length: int = 100) -> None:
    lines = source.splitlines()
    for index, line in enumerate(lines, start=1):
        if len(line) > max_line_length:
            scan.add("PY050", index, f"Line {index} is {len(line)} characters long.", snippet=line.strip()[:120])
        stripped = line.rstrip("\n")
        if stripped != stripped.rstrip() and stripped.strip():
            scan.add(
                "PY051",
                index,
                f"Line {index} ends with trailing whitespace.",
                severity="info",
                confidence=0.95,
                snippet=stripped,
            )
        if re.match(r"^\s*\t", line):
            scan.add("PY051", index, f"Line {index} is indented with a tab.", severity="info", confidence=0.95)
        if re.search(r";\s*\S", line) and not line.lstrip().startswith(("#", '"', "'")):
            scan.add("PY052", index, "Multiple statements on one line.", snippet=line.strip())
        upper = line.upper()
        if "TODO" in upper or "FIXME" in upper:
            scan.add("PY043", index, f"Unfinished work marker on line {index}: {line.strip()[:80]}")
        if SECRET_PATTERN.search(line):
            scan.add(
                "PY023",
                index,
                "A credential-looking literal is assigned in source code.",
                snippet=line.strip()[:120],
                confidence=0.8,
            )


def _check_tokens(source: str, scan: PythonScan) -> None:
    """Comment-ratio metric and commented-out code detection (token based)."""
    try:
        tokens = list(tokenize.generate_tokens(io.StringIO(source).readline))
    except (tokenize.TokenError, IndentationError, SyntaxError):
        return
    comment_lines = {tok.start[0] for tok in tokens if tok.type == tokenize.COMMENT}
    code_lines = {tok.start[0] for tok in tokens if tok.type in {tokenize.NAME, tokenize.NUMBER, tokenize.STRING, tokenize.OP}}
    for line in sorted(comment_lines):
        text = next((tok.string for tok in tokens if tok.type == tokenize.COMMENT and tok.start[0] == line), "")
        body = text.lstrip("#").strip()
        looks_like_code = bool(re.match(r"^(def |class |import |from |print\(|return |if |for |while |with |[A-Za-z_][\w.]*\s*=)", body))
        if looks_like_code and len(body) > 8:
            scan.add("GEN005", line, f"Line {line} looks like commented-out code.", snippet=body[:100], severity="minor")
    scan.metrics.comment_lines = len(comment_lines)
    scan.metrics.code_lines = len(code_lines)


# --------------------------------------------------------------------------- main API
def analyze(source: str, path: str = "<python>") -> PythonScan:
    """Analyse Python ``source`` and return findings plus metrics."""
    scan = PythonScan()
    lines = source.splitlines()
    scan.metrics.lines = len(lines)
    scan.metrics.blank_lines = sum(1 for line in lines if not line.strip())

    try:
        tree = ast.parse(source, filename=path)
    except SyntaxError as error:
        scan.add(
            "PY000",
            error.lineno or 1,
            f"SyntaxError: {error.msg}",
            title="The file does not parse",
            severity="critical",
            category="bug",
            confidence=1.0,
            snippet=(error.text or "").strip(),
        )
        scan.findings[-1].why_it_matters = (
            "Python cannot run a file it cannot parse, so nothing else in this report matters yet."
        )
        scan.findings[-1].how_to_fix = (
            f"Fix line {error.lineno}: {error.msg}. Check the brackets, quotes and indentation just above it."
        )
        return scan

    if not ast.get_docstring(tree):
        scan.add("PY041", 1, "The module has no docstring explaining its responsibility.", confidence=0.9)

    _check_comments_and_whitespace(source, scan)
    _check_tokens(source, scan)

    metrics = scan.metrics
    functions: list[FunctionInfo] = []
    parents: list[str] = []
    module_locals = 0

    for node in ast.walk(tree):
        if isinstance(node, ast.ClassDef):
            metrics.classes += 1
            if not ast.get_docstring(node):
                scan.add("PY040", node.lineno, f"Class `{node.name}` has no docstring.", confidence=0.9)

        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            info = _function_info(node, parents)
            functions.append(info)
            if info.public and not info.has_docstring and not info.name.startswith("__"):
                scan.add(
                    "PY040",
                    node.lineno,
                    f"Function `{info.name}` has no docstring.",
                    confidence=0.75,
                )
            if info.complexity > 10:
                scan.add(
                    "PY030",
                    node.lineno,
                    f"`{info.name}` has cyclomatic complexity {info.complexity} (recommended maximum is 10).",
                    severity="major" if info.complexity < 20 else "critical",
                    confidence=0.9,
                    end_line=info.end_lineno,
                )
            if info.length > 40:
                scan.add(
                    "PY031",
                    node.lineno,
                    f"`{info.name}` is {info.length} lines long.",
                    end_line=info.end_lineno,
                    confidence=0.85,
                )
            if info.max_nesting >= 4:
                scan.add(
                    "PY032",
                    node.lineno,
                    f"`{info.name}` nests blocks {info.max_nesting} levels deep.",
                    end_line=info.end_lineno,
                    confidence=0.85,
                )
            if info.args > 5:
                scan.add(
                    "PY033",
                    node.lineno,
                    f"`{info.name}` takes {info.args} parameters.",
                    autofixable=False,
                )
            if info.is_async and not info.has_await:
                scan.add("PY063", node.lineno, f"`{info.name}` is async but never awaits anything.")
            if info.public and info.annotations == 0 and info.args > 0 and info.name not in {"main"}:
                scan.add("PY042", node.lineno, f"`{info.name}` has no type annotations.", confidence=0.7)
            if node.returns is not None and not info.returns_value:
                scan.add(
                    "PY064",
                    node.lineno,
                    f"`{info.name}` declares a return type but has no `return <value>` statement.",
                    end_line=info.end_lineno,
                )

            # mutable default arguments — the highest-value beginner bug
            for default in list(node.args.defaults) + [d for d in node.args.kw_defaults if d]:
                if isinstance(default, (ast.List, ast.Dict, ast.Set)):
                    scan.add(
                        "PY001",
                        node.lineno,
                        f"`{info.name}` uses a mutable default value (`{ast.unparse(default) if hasattr(ast,'unparse') else 'literal'}`).",
                        severity="major",
                        confidence=0.95,
                        end_line=info.end_lineno,
                    )
                elif isinstance(default, ast.Call) and _call_name(default.func) in {"list", "dict", "set"}:
                    scan.add(
                        "PY001",
                        node.lineno,
                        f"`{info.name}` uses a mutable default value (`{_call_name(default.func)}()`).",
                        severity="major",
                        confidence=0.9,
                    )

    for info in functions:
        metrics.functions += 1
        metrics.max_complexity = max(metrics.max_complexity, info.complexity)
        metrics.max_function_length = max(metrics.max_function_length, info.length)
        metrics.max_nesting = max(metrics.max_nesting, info.max_nesting)
        if info.has_docstring:
            metrics.extra["documented_functions"] = metrics.extra.get("documented_functions", 0) + 1

    documented = metrics.extra.get("documented_functions", 0)
    metrics.docstring_coverage = round(documented / metrics.functions * 100, 1) if metrics.functions else 100.0
    metrics.avg_complexity = round(
        sum(_complexity(n) for n in ast.walk(tree) if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))) / metrics.functions,
        1,
    ) if metrics.functions else 0.0
    metrics.comment_ratio = round(
        metrics.comment_lines / metrics.lines * 100, 1
    ) if metrics.lines else 0.0

    # names with an explicit emptiness guard anywhere in the file
    guarded_names = _guarded_names(tree)

    # ------------------------------------------------------------- node-level rules
    for node in ast.walk(tree):
        if isinstance(node, ast.ExceptHandler):
            if node.type is None:
                scan.add(
                    "PY002",
                    node.lineno,
                    "A bare `except:` catches every error, including Ctrl+C.",
                    confidence=0.95,
                )
            body_is_pass = len(node.body) == 1 and isinstance(node.body[0], ast.Pass)
            body_is_print = len(node.body) == 1 and isinstance(node.body[0], ast.Expr) and isinstance(node.body[0].value, ast.Call) and _call_name(node.body[0].value.func) in {"print", "logging.debug"}
            if body_is_pass or body_is_print:
                scan.add(
                    "PY004",
                    node.lineno,
                    "The exception is silently ignored (`pass`/print only).",
                    confidence=0.9,
                )

        if isinstance(node, ast.Compare):
            for op, comparator in zip(node.ops, node.comparators):
                if isinstance(op, (ast.Eq, ast.NotEq)) and isinstance(comparator, ast.Constant) and comparator.value is None:
                    scan.add("PY003", node.lineno, "Comparison with None uses `==`/`!=` instead of `is`/`is not`.")

        if isinstance(node, ast.Call):
            name = _call_name(node.func)
            short = name.split(".")[-1]
            if name in UNSAFE_CALLS:
                rule_id, severity = UNSAFE_CALLS[name]
                scan.add(
                    rule_id,
                    node.lineno,
                    f"Call to `{name}()` can execute untrusted input.",
                    severity=severity,
                    confidence=0.85,
                )
            elif name in {"eval", "exec"}:
                scan.add("PY020", node.lineno, f"Call to `{name}()` can execute arbitrary code.", confidence=0.9)
            if name in {"subprocess.run", "subprocess.Popen", "subprocess.call", "subprocess.check_output"}:
                for keyword in node.keywords:
                    if keyword.arg == "shell" and isinstance(keyword.value, ast.Constant) and keyword.value.value is True:
                        scan.add("PY022", node.lineno, "`shell=True` passes the command through a shell.", confidence=0.9)
            if name in {"random.random", "random.randint", "random.choice", "random.sample"}:
                scan.add("PY025", node.lineno, f"`{name}()` is not cryptographically secure.", confidence=0.6)
            if name == "open":
                has_encoding = any(k.arg == "encoding" for k in node.keywords)
                if not has_encoding:
                    scan.add("PY010", node.lineno, "`open()` without an explicit `encoding`.")
                parent_is_with = False
                for ancestor in ast.walk(tree):
                    if isinstance(ancestor, (ast.With, ast.AsyncWith)):
                        for item in ancestor.items:
                            if isinstance(item.context_expr, ast.Call) and item.context_expr is node:
                                parent_is_with = True
                if hasattr(node, "lineno") and not parent_is_with:
                    scan.add(
                        "PY009",
                        node.lineno,
                        "`open()` is not managed by a `with` block.",
                        confidence=0.6,
                    )
            if short == "load" and name.startswith("yaml"):
                scan.add("PY024", node.lineno, "`yaml.load` can construct arbitrary objects; use `safe_load`.")
            if short in {"len", "sum"} and isinstance(node.args[0] if node.args else None, ast.Call):
                inner = _call_name(node.args[0].func)
                if inner in {"range", "sum"}:
                    pass
            if short == "print" and not path.endswith(("manage.py", "cli.py", "setup.py")):
                scan.add(
                    "PY053",
                    node.lineno,
                    "`print()` is used for diagnostics.",
                    confidence=0.55,
                    tags=["debug-noise"],
                )

            if short == "isinstance" and len(node.args) == 2:
                pass
            if short == "type" and node.args:
                pass

        # SQL assembled from f-strings or concatenation — the injection classic
        sql_literal = None
        if isinstance(node, ast.JoinedStr):
            sql_literal = "".join(
                part.value if isinstance(part, ast.Constant) and isinstance(part.value, str) else "{?}"
                for part in node.values
            )
        elif isinstance(node, ast.BinOp) and isinstance(node.op, ast.Add):
            left, right = node.left, node.right
            if isinstance(left, ast.Constant) and isinstance(left.value, str):
                sql_literal = left.value
            elif isinstance(right, ast.Constant) and isinstance(right.value, str):
                sql_literal = right.value
        if sql_literal and re.search(r"\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION)\b", sql_literal, re.I):
            scan.add(
                "PY021",
                node.lineno,
                "A SQL statement is built by string concatenation/interpolation instead of parameters.",
                severity="critical",
                confidence=0.9,
                snippet=sql_literal.strip()[:120],
            )

        if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Div):
            right = node.right
            divides_by_length = isinstance(right, ast.Call) and _call_name(right.func) == "len"
            divides_by_name = isinstance(right, ast.Name) and right.id in {"count", "length", "n"}
            # a function that already returns early on empty input is not a ZeroDivision bug:
            # `if not prices: return 0.0` is exactly the guard this rule asks for
            denominator = (
                _call_name(right.args[0])
                if divides_by_length and right.args
                else (right.id if divides_by_name else "")
            )
            already_guarded = denominator in guarded_names
            if (divides_by_length or divides_by_name) and not already_guarded:
                scan.add(
                    "PY005",
                    node.lineno,
                    f"Division by `{ast.unparse(right) if hasattr(ast, 'unparse') else 'a variable'}` can raise ZeroDivisionError when the collection is empty.",
                    confidence=0.7,
                )

        if isinstance(node, ast.Call) and _call_name(node.func) == "type":
            pass
        if isinstance(node, ast.Compare):
            for left in [node.left, *node.comparators]:
                if isinstance(left, ast.Call) and _call_name(left.func) == "type":
                    scan.add("PY006", node.lineno, "Comparing `type(x) == ...` instead of `isinstance(x, ...)`.")

        if isinstance(node, ast.Assert):
            scan.add("PY011", node.lineno, "`assert` disappears under `python -O`; raise a real exception instead.")

        if isinstance(node, ast.Global):
            scan.add("PY057", node.lineno, f"`global {', '.join(node.names)}` mutates module state.")

        # shadowing built-ins with assignments or parameters
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id in BUILTIN_NAMES and target.id not in {"id"}:
                    scan.add(
                        "PY007",
                        target.lineno,
                        f"`{target.id}` shadows the built-in `{target.id}`.",
                        confidence=0.7,
                    )
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda)):
            for arg in getattr(node, "args", ast.arguments([], [], None, [], [], None, [])).args:
                if arg.arg in BUILTIN_NAMES and arg.arg not in {"id", "input"}:
                    scan.add("PY007", arg.lineno, f"Parameter `{arg.arg}` shadows the built-in `{arg.arg}`.", confidence=0.6)

        if isinstance(node, (ast.For, ast.AsyncFor)) and isinstance(node.iter, ast.Call) and _call_name(node.iter.func) == "range":
            if node.iter.args and isinstance(node.iter.args[0], ast.Call) and _call_name(node.iter.args[0].func) == "len":
                scan.add("PY008", node.lineno, "`for i in range(len(...))` — iterate the values directly or use `enumerate`.")

    for name, module, line in _unused_imports(tree, source):
        scan.add(
            "PY055",
            line,
            f"`{name}` is imported from `{module}` but never used.",
            confidence=0.75,
        )

    for name, line in _unused_locals(tree, source):
        scan.add("PY056", line, f"`{name}` is assigned but never read.", confidence=0.65)

    if re.search(r"^\s*from\s+\S+\s+import\s+\*", source, re.M):
        for index, line in enumerate(lines, start=1):
            if re.match(r"^\s*from\s+\S+\s+import\s+\*", line):
                scan.add("PY054", index, "Wildcard import hides where names come from.")

    # duplicated blocks inside the file are added by the engine (cross-file aware)
    metrics.max_complexity = max(metrics.max_complexity, 0)
    metrics.extra["functions"] = [
        {
            "name": info.qualname,
            "line": info.lineno,
            "length": info.length,
            "complexity": info.complexity,
            "nesting": info.max_nesting,
            "args": info.args,
            "documented": info.has_docstring,
        }
        for info in sorted(functions, key=lambda f: f.complexity, reverse=True)
    ]
    metrics.imports = len(_imported_names(tree))
    metrics.todo_count = sum(1 for line in lines if "TODO" in line.upper() or "FIXME" in line.upper())
    return scan


def module_functions(source: str) -> list[dict]:
    """Small helper used by the teacher agent when explaining a file."""
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return []
    return [
        {
            "name": node.name,
            "line": node.lineno,
            "end_line": getattr(node, "end_lineno", node.lineno),
            "docstring": (ast.get_docstring(node) or "").splitlines()[0] if ast.get_docstring(node) else "",
            "parameters": [a.arg for a in node.args.args],
        }
        for node in ast.walk(tree)
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
    ]


def iter_top_level_imports(tree: ast.Module) -> Iterable[str]:
    for node in tree.body:
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            yield ast.unparse(node) if hasattr(ast, "unparse") else ""
