"""The rule catalog.

Every rule carries the three things a beginner actually needs:

* ``why_it_matters`` — the consequence in plain language
* ``how_to_fix`` — the concrete next step
* ``references`` — where to read more (PEP 8, OWASP, MDN…)

Keeping the wording in one table means the chat mentor, the health dashboard and the
review checklist all explain a problem the same way.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal


@dataclass(frozen=True)
class Rule:
    id: str
    title: str
    severity: Literal["critical", "major", "minor", "info"]
    category: Literal[
        "bug",
        "security",
        "performance",
        "complexity",
        "style",
        "docs",
        "tests",
        "maintainability",
        "best-practice",
    ]
    why_it_matters: str
    how_to_fix: str
    weight: float = 1.0
    autofixable: bool = False
    references: tuple[str, ...] = field(default_factory=tuple)


def _r(*args, **kwargs) -> Rule:
    return Rule(*args, **kwargs)


RULES: dict[str, Rule] = {
    rule.id: rule
    for rule in [
        # ------------------------------------------------------------- parse failure
        _r(
            "PY000",
            "The file does not parse",
            "critical",
            "bug",
            "Python cannot run a file it cannot parse, so nothing else in the report matters "
            "until this is fixed — every other finding would be guesswork.",
            "Fix the reported line first (a missing `:` or an unbalanced bracket are the usual "
            "causes), then read the analysis again.",
            weight=2.0,
        ),
        # ------------------------------------------------------------------ bugs
        _r(
            "PY001",
            "Mutable default argument",
            "critical",
            "bug",
            "The default list/dict is created once and shared by every call, so values "
            "written during one call leak into the next one. This is the classic source of "
            "'why does my function remember the previous result?' bugs.",
            "Use `None` as the default and create the container inside the function.",
            weight=1.6,
            autofixable=True,
            references=("https://docs.python-guide.org/writing/gotchas/#mutable-default-arguments",),
        ),
        _r(
            "PY002",
            "Bare `except:` swallows everything",
            "major",
            "bug",
            "A bare except catches KeyboardInterrupt and SystemExit too, and hides the real "
            "error, so the program keeps running with corrupted state.",
            "Catch the specific exception you expect (for example `except ValueError:`) and "
            "log or re-raise anything unexpected.",
            weight=1.4,
            autofixable=True,
        ),
        _r(
            "PY003",
            "Comparison to None using `==`",
            "minor",
            "style",
            "`==` can be overloaded by objects and return surprising results; `is` compares "
            "identity and cannot be overridden.",
            "Write `if value is None:` and `if value is not None:`.",
            weight=0.8,
            autofixable=True,
            references=("https://peps.python.org/pep-0008/#programming-recommendations",),
        ),
        _r(
            "PY004",
            "Exception silently ignored",
            "major",
            "bug",
            "`except: pass` tells the reader nothing and hides failures. Bugs then surface far "
            "away from their cause.",
            "Handle it (fallback value), log it (`logging.exception`), or re-raise it.",
            weight=1.4,
        ),
        _r(
            "PY005",
            "Division without a zero guard",
            "major",
            "bug",
            "`sum(prices) / len(prices)` raises ZeroDivisionError on an empty list — a crash "
            "that only appears in production when the data happens to be empty.",
            "Guard the input (`if not prices: return 0`) or handle the exception explicitly.",
            weight=1.3,
        ),
        _r(
            "PY006",
            "`type(x) ==` instead of `isinstance`",
            "minor",
            "best-practice",
            "`type() ==` ignores subclasses and breaks with proxy or mock objects, which makes "
            "tests brittle.",
            "Use `isinstance(x, Expected)`.",
            weight=0.7,
            autofixable=True,
        ),
        _r(
            "PY007",
            "Shadowing a built-in name",
            "major",
            "bug",
            "Redefining `list`, `id`, `sum`, `type`… silently replaces a built-in for the rest "
            "of the module, so unrelated code starts misbehaving.",
            "Rename the variable (for example `total` instead of `sum`).",
            weight=1.2,
            autofixable=True,
        ),
        _r(
            "PY008",
            "`range(len(...))` loop",
            "info",
            "style",
            "Indexing by position is harder to read and easier to get wrong (off-by-one).",
            "Iterate the values directly, or use `enumerate()` when you need the index.",
            weight=0.5,
            autofixable=True,
        ),
        _r(
            "PY009",
            "File opened without `with`",
            "major",
            "bug",
            "If an exception happens before `close()`, the handle leaks and the file may stay "
            "locked.",
            "Use `with open(...) as handle:` so the file always closes.",
            weight=1.3,
            autofixable=True,
        ),
        _r(
            "PY010",
            "`open()` without an explicit encoding",
            "minor",
            "best-practice",
            "The default encoding depends on the machine, so the same file can read correctly on "
            "your laptop and crash on a server.",
            "Pass `encoding=\"utf-8\"`.",
            weight=0.6,
            autofixable=True,
        ),
        _r(
            "PY011",
            "`assert` used for runtime validation",
            "minor",
            "bug",
            "Asserts are removed when Python runs with `-O`, so validation silently disappears.",
            "Raise an explicit exception (`ValueError`) for data you must validate.",
            weight=0.8,
        ),
        _r(
            "PY012",
            "Loop can be replaced by `any()`/`all()`/`next()`",
            "info",
            "style",
            "Hand-rolled search loops hide the intent; built-ins express it in one line.",
            "Use `any(...)`, `all(...)` or a generator with `next()`, or `break` as soon as the "
            "answer is known.",
            weight=0.5,
        ),
        # -------------------------------------------------------------- security
        _r(
            "PY020",
            "`eval`/`exec` on dynamic input",
            "critical",
            "security",
            "Any value that reaches `eval` can execute arbitrary Python — a remote code "
            "execution hole (OWASP A03: Injection).",
            "Parse the data instead: `json.loads`, `int()`, `ast.literal_eval`, or a lookup "
            "dictionary of allowed operations.",
            weight=2.0,
            references=("https://owasp.org/Top10/A03_2021-Injection/",),
        ),
        _r(
            "PY021",
            "SQL built by string concatenation",
            "critical",
            "security",
            "Concatenated SQL enables SQL injection: a crafted query string reads or destroys "
            "the whole database.",
            "Use parameterised queries (`cursor.execute(sql, params)`) or an ORM.",
            weight=2.0,
            references=("https://owasp.org/Top10/A03_2021-Injection/",),
        ),
        _r(
            "PY022",
            "Shell command execution",
            "critical",
            "security",
            "`os.system` / `shell=True` hands user data to a shell, where `;` and `$()` run "
            "extra commands.",
            "Prefer `subprocess.run([...], shell=False)` with an argument list, and validate the "
            "input.",
            weight=1.9,
        ),
        _r(
            "PY023",
            "Hardcoded secret",
            "critical",
            "security",
            "Secrets in source end up in git history, CI logs and screenshots, and cannot be "
            "rotated safely.",
            "Move it to an environment variable or a secret manager and rotate the leaked value.",
            weight=2.0,
        ),
        _r(
            "PY024",
            "Unsafe deserialisation",
            "critical",
            "security",
            "`pickle` and `yaml.load` can construct arbitrary objects while parsing, which is "
            "equivalent to running the attacker's code.",
            "Use `json`, or `yaml.safe_load`.",
            weight=1.9,
        ),
        _r(
            "PY025",
            "Insecure randomness for a token",
            "major",
            "security",
            "`random` is predictable; an attacker who sees a few values can guess the next ones.",
            "Use the `secrets` module for tokens, passwords and reset codes.",
            weight=1.5,
        ),
        # ----------------------------------------------------------- complexity
        _r(
            "PY030",
            "Function is too complex",
            "major",
            "complexity",
            "Cyclomatic complexity above 10 means more branches than a reader can hold in their "
            "head at once, so the function is hard to test and easy to break.",
            "Extract cohesive blocks into small named helpers; each branch becomes a testable "
            "unit.",
            weight=1.5,
        ),
        _r(
            "PY031",
            "Function is too long",
            "major",
            "complexity",
            "Long functions mix several responsibilities, which is why they accumulate bugs "
            "faster than the rest of the codebase.",
            "Split it into helpers whose names describe the steps (``load``, ``validate``, "
            "``render``).",
            weight=1.3,
        ),
        _r(
            "PY032",
            "Deep nesting",
            "major",
            "complexity",
            "Every indent level adds a condition the reader must keep in mind. Four levels is "
            "usually the point where mistakes start.",
            "Use guard clauses (`if not valid: return`) and early returns to flatten the code.",
            weight=1.3,
        ),
        _r(
            "PY033",
            "Too many parameters",
            "minor",
            "maintainability",
            "Wide parameter lists are hard to call correctly and impossible to extend safely.",
            "Group related values into a dataclass or NamedTuple, or pass a config object.",
            weight=1.0,
        ),
        # ---------------------------------------------------------------- docs
        _r(
            "PY040",
            "Missing docstring",
            "minor",
            "docs",
            "A one-line docstring tells the next reader what the function promises — intent is "
            "the part tests cannot express.",
            "Add a short summary, then document parameters, return value and raised errors.",
            weight=0.7,
        ),
        _r(
            "PY041",
            "Module has no docstring",
            "info",
            "docs",
            "Without a module docstring, newcomers cannot tell what the file is responsible for.",
            "Add a one-paragraph summary at the very top.",
            weight=0.4,
        ),
        _r(
            "PY042",
            "Missing type annotations",
            "minor",
            "docs",
            "Type hints let editors catch mistakes before you run the program and double as "
            "documentation.",
            "Annotate parameters and return values, then check with `mypy`.",
            weight=0.8,
        ),
        _r(
            "PY043",
            "TODO left in the code",
            "info",
            "maintainability",
            "Unfinished work hidden in comments is forgotten work.",
            "Either do it now or create a tracked issue with an owner.",
            weight=0.3,
        ),
        # --------------------------------------------------------------- style
        _r(
            "PY050",
            "Line is too long",
            "minor",
            "style",
            "Long lines force horizontal scrolling and hide the structure of an expression.",
            "Wrap at 88–100 characters (PEP 8 + Black default).",
            weight=0.5,
            autofixable=False,
        ),
        _r(
            "PY051",
            "Trailing whitespace / tab indentation",
            "info",
            "style",
            "Whitespace noise pollutes diffs and, in Python, mixing tabs and spaces raises "
            "TabError.",
            "Configure your editor to trim trailing whitespace and insert 4 spaces.",
            weight=0.3,
            autofixable=True,
        ),
        _r(
            "PY052",
            "Multiple statements on one line",
            "minor",
            "style",
            "Semicolon-joined statements hide control flow and break line-based tooling.",
            "One statement per line.",
            weight=0.5,
            autofixable=True,
        ),
        _r(
            "PY053",
            "`print()` used for diagnostics",
            "minor",
            "best-practice",
            "Print debugging leaves noise in production output and cannot be switched off.",
            "Use the `logging` module, then set the level per environment.",
            weight=0.6,
        ),
        _r(
            "PY054",
            "Wildcard import",
            "minor",
            "maintainability",
            "`from x import *` hides where names come from and can silently shadow your own "
            "definitions.",
            "Import the names you use explicitly.",
            weight=0.8,
        ),
        _r(
            "PY055",
            "Unused import",
            "minor",
            "maintainability",
            "Dead imports mislead readers, slow startup and can hide circular dependencies.",
            "Delete the import (or use it). Ruff/Flake8 flag these automatically.",
            weight=0.6,
            autofixable=True,
        ),
        _r(
            "PY056",
            "Unused variable",
            "minor",
            "bug",
            "An assigned but never read value is usually a typo — often the very bug you are "
            "hunting.",
            "Remove it, or prefix with `_` if it is intentionally ignored.",
            weight=0.9,
            autofixable=True,
        ),
        _r(
            "PY057",
            "`global` statement",
            "minor",
            "maintainability",
            "Global mutable state makes behaviour depend on call order, which is nearly "
            "impossible to test.",
            "Pass the value in and return the new one, or hold it in an object.",
            weight=0.7,
        ),
        # ------------------------------------------------------------ structure
        _r(
            "PY060",
            "Duplicated code block",
            "major",
            "maintainability",
            "Copy-pasted logic must be fixed in every copy; sooner or later one copy is "
            "forgotten.",
            "Extract the block into a function and call it from both places.",
            weight=1.2,
        ),
        _r(
            "PY061",
            "No tests found for this module",
            "major",
            "tests",
            "Without a test, nobody can safely change this code — including you in three "
            "months.",
            "Add a `test_*.py` covering the happy path and one failure path.",
            weight=1.0,
        ),
        _r(
            "PY062",
            "Magic number",
            "info",
            "maintainability",
            "A bare number has no meaning; the reader cannot tell whether 0.2 is tax, a "
            "threshold or a typo.",
            "Name it: `TAX_RATE = 0.2`, ideally with a comment about the source.",
            weight=0.4,
        ),
        _r(
            "PY063",
            "Async function without `await`",
            "minor",
            "bug",
            "An `async def` with no await runs synchronously and blocks the event loop, defeating "
            "the point.",
            "Either await the work inside, or make it a normal `def`.",
            weight=0.8,
        ),
        _r(
            "PY064",
            "Falling off the end of a function",
            "major",
            "bug",
            "A function with a return-type promise but no `return` on some path returns `None`, "
            "so callers crash later with an unrelated error.",
            "Return an explicit value on every path (or make the type `None`).",
            weight=1.2,
        ),
        # ----------------------------------------------------------- javascript
        _r(
            "JS001",
            "`var` instead of `let`/`const`",
            "minor",
            "bug",
            "`var` is function-scoped and hoisted, so it leaks out of blocks and loops — the "
            "classic source of 'value is undefined' surprises.",
            "Use `const` by default and `let` only when you reassign.",
            weight=0.9,
            autofixable=True,
        ),
        _r(
            "JS002",
            "Loose equality (`==`)",
            "major",
            "bug",
            "`==` coerces types, so `\"0\" == false` is true and `null == undefined` is true. "
            "Real bugs hide in those conversions.",
            "Use `===` / `!==` (or `??` when you only care about nullish values).",
            weight=1.3,
            autofixable=True,
        ),
        _r(
            "JS003",
            "Assignment inside a condition",
            "critical",
            "bug",
            "`if (x = 0)` assigns instead of comparing, so the branch is never taken and `x` is "
            "silently overwritten.",
            "Use `===` for comparison; if assignment is intended, wrap it: `if ((x = next()))`.",
            weight=1.8,
        ),
        _r(
            "JS004",
            "Missing `await` on an async call",
            "major",
            "bug",
            "Without await you receive a Promise instead of the data, so `data.id` is "
            "`undefined` and the failure appears somewhere else entirely.",
            "Add `await` (inside an async function) or chain `.then()`.",
            weight=1.6,
            autofixable=True,
        ),
        _r(
            "JS005",
            "Floating promise",
            "major",
            "bug",
            "An async call that is neither awaited nor returned escapes error handling and the "
            "caller proceeds before it finishes.",
            "Return or await it, and add `.catch()` if you intentionally ignore it.",
            weight=1.4,
        ),
        _r(
            "JS006",
            "`console.log` left in application code",
            "minor",
            "style",
            "Console noise ships to users and can leak personal data into browser logs.",
            "Use a logger with levels and remove debug statements before merging.",
            weight=0.6,
            autofixable=True,
        ),
        _r(
            "JS007",
            "Swallowed error in `catch`",
            "major",
            "bug",
            "Catching an error and only printing it leaves callers believing the operation "
            "succeeded — the UI shows an order that was never created.",
            "Re-throw, return a typed error result, or show a retry path to the user.",
            weight=1.5,
        ),
        _r(
            "JS008",
            "`innerHTML` with dynamic data",
            "critical",
            "security",
            "Assigning user data to `innerHTML` executes injected scripts (XSS).",
            "Use `textContent`, or sanitise with a vetted library such as DOMPurify.",
            weight=1.9,
            references=("https://owasp.org/www-community/attacks/xss/",),
        ),
        _r(
            "JS009",
            "`eval` / `new Function`",
            "critical",
            "security",
            "Code strings execute with full page privileges, which is remote code execution in a "
            "browser context.",
            "Parse data (JSON.parse) or use a lookup table of allowed behaviour.",
            weight=2.0,
        ),
        _r(
            "JS010",
            "`JSON.parse` without error handling",
            "major",
            "bug",
            "Malformed or empty responses throw a SyntaxError that takes down the whole handler.",
            "Wrap it in try/catch (or validate with a schema) and return a useful error.",
            weight=1.2,
        ),
        _r(
            "JS011",
            "Hardcoded secret",
            "critical",
            "security",
            "Keys in front-end code are public by definition; anyone can read them in devtools.",
            "Proxy the call through your backend and keep the secret server-side.",
            weight=2.0,
        ),
        _r(
            "JS012",
            "Implied `any` / untyped value",
            "minor",
            "best-practice",
            "`any` disables the compiler, so refactoring mistakes become runtime errors.",
            "Give the value a real type (`CartItem[]`, a shared interface, or a generic).",
            weight=0.7,
        ),
        _r(
            "JS013",
            "`parseInt` without a radix",
            "minor",
            "bug",
            "Without a radix, `parseInt(\"08\")` and similar strings can be read in an "
            "unexpected base.",
            "Always pass the base: `parseInt(value, 10)` (or use `Number(value)`).",
            weight=0.6,
            autofixable=True,
        ),
        _r(
            "JS014",
            "Missing JSDoc on an exported function",
            "minor",
            "docs",
            "Export boundaries are the public API of a module; undocumented ones get used "
            "wrongly.",
            "Add a short JSDoc block with `@param` and `@returns`.",
            weight=0.7,
        ),
        _r(
            "JS015",
            "Callback / promise nesting too deep",
            "major",
            "complexity",
            "Deeply nested callbacks invert the reading order of the program and make error "
            "handling impossible to follow.",
            "Flatten with `async/await`, or extract named functions.",
            weight=1.3,
        ),
        _r(
            "JS016",
            "Function is too long",
            "major",
            "complexity",
            "Long functions mix responsibilities, which is why they collect bugs.",
            "Extract named helpers.",
            weight=1.2,
        ),
        _r(
            "JS017",
            "Too many parameters",
            "minor",
            "maintainability",
            "Wide parameter lists are easy to call in the wrong order.",
            "Pass an options object.",
            weight=0.9,
        ),
        _r(
            "JS018",
            "No JSDoc / type for a big module",
            "info",
            "docs",
            "A module without any documentation is hard to onboard into.",
            "Document the module purpose at the top of the file.",
            weight=0.4,
        ),
        _r(
            "JS019",
            "`let` never reassigned",
            "info",
            "style",
            "`const` communicates that the binding never changes, which removes a whole class of "
            "questions for the reader.",
            "Use `const`.",
            weight=0.4,
            autofixable=True,
        ),
        _r(
            "JS020",
            "`throw` of a non-Error value",
            "minor",
            "bug",
            "Throwing a string loses the stack trace, so you cannot see where it came from.",
            "Throw `new Error(\"message\")`.",
            weight=0.8,
        ),
        _r(
            "JS021",
            "TODO left in the code",
            "info",
            "maintainability",
            "Unfinished work hidden in comments is forgotten work.",
            "Track it as an issue.",
            weight=0.3,
        ),
        _r(
            "JS022",
            "Exported function without a test",
            "major",
            "tests",
            "Untested public behaviour regresses silently.",
            "Add a unit test for the happy path and one edge case.",
            weight=1.0,
        ),
        # ------------------------------------------------------- language agnostic
        _r(
            "GEN001",
            "Line is too long",
            "info",
            "style",
            "Very long lines hide the structure of an expression.",
            "Wrap the statement across several lines.",
            weight=0.3,
        ),
        _r(
            "GEN002",
            "TODO / FIXME marker",
            "info",
            "maintainability",
            "Unfinished work hidden in comments is forgotten work.",
            "Create a tracked issue with an owner.",
            weight=0.3,
        ),
        _r(
            "GEN003",
            "Hardcoded secret",
            "critical",
            "security",
            "Credentials in the repository can never be un-leaked; they must be rotated and moved "
            "to configuration.",
            "Read it from the environment or a secret manager.",
            weight=2.0,
        ),
        _r(
            "GEN004",
            "Deep nesting",
            "major",
            "complexity",
            "Each nesting level adds a condition the reader must hold in mind.",
            "Flatten with guard clauses.",
            weight=1.2,
        ),
        _r(
            "GEN005",
            "Commented-out code",
            "minor",
            "maintainability",
            "Commenting out code instead of deleting it makes readers guess whether it is still "
            "needed.",
            "Delete it — version control remembers.",
            weight=0.6,
        ),
        _r(
            "GEN006",
            "File is very large",
            "minor",
            "maintainability",
            "Files above a few hundred lines are hard to navigate and usually hold several "
            "responsibilities.",
            "Split by responsibility.",
            weight=0.9,
        ),
        _r(
            "GEN007",
            "Mixed line endings / missing final newline",
            "info",
            "style",
            "Inconsistent endings produce noisy diffs for the whole team.",
            "Normalise to LF and end files with a newline.",
            weight=0.2,
        ),
        _r(
            "GEN008",
            "Unbalanced brackets",
            "critical",
            "bug",
            "The parser cannot match the brackets, so nothing after this point is interpreted "
            "the way you intended — this is the most common reason a file will not start.",
            "Count the brackets on the reported line: every `{` needs `}`, every `(` needs `)`, "
            "every `[` needs `]`.",
            weight=1.6,
        ),
        _r(
            "GEN010",
            "Duplicated code block",
            "major",
            "maintainability",
            "Copy-pasted logic has to be fixed in every copy; sooner or later one copy is "
            "forgotten.",
            "Extract the repeated block into one named function and call it from both places.",
            weight=1.2,
        ),
    ]
}
