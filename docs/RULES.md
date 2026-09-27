# Rule reference

71 rules ship with the engine. Every rule answers the same three questions: **what** it is, **why it matters** in terms of consequences, and **how to fix** it. The mentor, the health report and the review checklist all read these definitions, so the wording never drifts.

A rule fires with a **confidence** value. Below 100% means the analyser is inferring (for example, it cannot know whether an `except` block is intentional), and the UI shows that number so you can judge for yourself.

---

## best-practice (4)

### `JS012` — Implied `any` / untyped value

**Severity:** minor · **Auto-fixable:** no — the mentor explains it and you change it yourself

**Why it matters.** `any` disables the compiler, so refactoring mistakes become runtime errors.

**How to fix it.** Give the value a real type (`CartItem[]`, a shared interface, or a generic).

### `PY006` — `type(x) ==` instead of `isinstance`

**Severity:** minor · **Auto-fixable:** yes — the fixer can prepare a patch for review

**Why it matters.** `type() ==` ignores subclasses and breaks with proxy or mock objects, which makes tests brittle.

**How to fix it.** Use `isinstance(x, Expected)`.

### `PY010` — `open()` without an explicit encoding

**Severity:** minor · **Auto-fixable:** yes — the fixer can prepare a patch for review

**Why it matters.** The default encoding depends on the machine, so the same file can read correctly on your laptop and crash on a server.

**How to fix it.** Pass `encoding="utf-8"`.

### `PY053` — `print()` used for diagnostics

**Severity:** minor · **Auto-fixable:** no — the mentor explains it and you change it yourself

**Why it matters.** Print debugging leaves noise in production output and cannot be switched off.

**How to fix it.** Use the `logging` module, then set the level per environment.

---

## bug (21)

### `GEN008` — Unbalanced brackets

**Severity:** critical · **Auto-fixable:** no — the mentor explains it and you change it yourself

**Why it matters.** The parser cannot match the brackets, so nothing after this point is interpreted the way you intended — this is the most common reason a file will not start.

**How to fix it.** Count the brackets on the reported line: every `{` needs `}`, every `(` needs `)`, every `[` needs `]`.

### `JS003` — Assignment inside a condition

**Severity:** critical · **Auto-fixable:** no — the mentor explains it and you change it yourself

**Why it matters.** `if (x = 0)` assigns instead of comparing, so the branch is never taken and `x` is silently overwritten.

**How to fix it.** Use `===` for comparison; if assignment is intended, wrap it: `if ((x = next()))`.

### `PY000` — The file does not parse

**Severity:** critical · **Auto-fixable:** no — the mentor explains it and you change it yourself

**Why it matters.** Python cannot run a file it cannot parse, so nothing else in the report matters until this is fixed — every other finding would be guesswork.

**How to fix it.** Fix the reported line first (a missing `:` or an unbalanced bracket are the usual causes), then read the analysis again.

### `PY001` — Mutable default argument

**Severity:** critical · **Auto-fixable:** yes — the fixer can prepare a patch for review

**Why it matters.** The default list/dict is created once and shared by every call, so values written during one call leak into the next one. This is the classic source of 'why does my function remember the previous result?' bugs.

**How to fix it.** Use `None` as the default and create the container inside the function.

**Read more:** <https://docs.python-guide.org/writing/gotchas/#mutable-default-arguments>

### `JS002` — Loose equality (`==`)

**Severity:** major · **Auto-fixable:** yes — the fixer can prepare a patch for review

**Why it matters.** `==` coerces types, so `"0" == false` is true and `null == undefined` is true. Real bugs hide in those conversions.

**How to fix it.** Use `===` / `!==` (or `??` when you only care about nullish values).

### `JS004` — Missing `await` on an async call

**Severity:** major · **Auto-fixable:** yes — the fixer can prepare a patch for review

**Why it matters.** Without await you receive a Promise instead of the data, so `data.id` is `undefined` and the failure appears somewhere else entirely.

**How to fix it.** Add `await` (inside an async function) or chain `.then()`.

### `JS005` — Floating promise

**Severity:** major · **Auto-fixable:** no — the mentor explains it and you change it yourself

**Why it matters.** An async call that is neither awaited nor returned escapes error handling and the caller proceeds before it finishes.

**How to fix it.** Return or await it, and add `.catch()` if you intentionally ignore it.

### `JS007` — Swallowed error in `catch`

**Severity:** major · **Auto-fixable:** no — the mentor explains it and you change it yourself

**Why it matters.** Catching an error and only printing it leaves callers believing the operation succeeded — the UI shows an order that was never created.

**How to fix it.** Re-throw, return a typed error result, or show a retry path to the user.

### `JS010` — `JSON.parse` without error handling

**Severity:** major · **Auto-fixable:** no — the mentor explains it and you change it yourself

**Why it matters.** Malformed or empty responses throw a SyntaxError that takes down the whole handler.

**How to fix it.** Wrap it in try/catch (or validate with a schema) and return a useful error.

### `PY002` — Bare `except:` swallows everything

**Severity:** major · **Auto-fixable:** yes — the fixer can prepare a patch for review

**Why it matters.** A bare except catches KeyboardInterrupt and SystemExit too, and hides the real error, so the program keeps running with corrupted state.

**How to fix it.** Catch the specific exception you expect (for example `except ValueError:`) and log or re-raise anything unexpected.

### `PY004` — Exception silently ignored

**Severity:** major · **Auto-fixable:** no — the mentor explains it and you change it yourself

**Why it matters.** `except: pass` tells the reader nothing and hides failures. Bugs then surface far away from their cause.

**How to fix it.** Handle it (fallback value), log it (`logging.exception`), or re-raise it.

### `PY005` — Division without a zero guard

**Severity:** major · **Auto-fixable:** no — the mentor explains it and you change it yourself

**Why it matters.** `sum(prices) / len(prices)` raises ZeroDivisionError on an empty list — a crash that only appears in production when the data happens to be empty.

**How to fix it.** Guard the input (`if not prices: return 0`) or handle the exception explicitly.

### `PY007` — Shadowing a built-in name

**Severity:** major · **Auto-fixable:** yes — the fixer can prepare a patch for review

**Why it matters.** Redefining `list`, `id`, `sum`, `type`… silently replaces a built-in for the rest of the module, so unrelated code starts misbehaving.

**How to fix it.** Rename the variable (for example `total` instead of `sum`).

### `PY009` — File opened without `with`

**Severity:** major · **Auto-fixable:** yes — the fixer can prepare a patch for review

**Why it matters.** If an exception happens before `close()`, the handle leaks and the file may stay locked.

**How to fix it.** Use `with open(...) as handle:` so the file always closes.

### `PY064` — Falling off the end of a function

**Severity:** major · **Auto-fixable:** no — the mentor explains it and you change it yourself

**Why it matters.** A function with a return-type promise but no `return` on some path returns `None`, so callers crash later with an unrelated error.

**How to fix it.** Return an explicit value on every path (or make the type `None`).

### `JS001` — `var` instead of `let`/`const`

**Severity:** minor · **Auto-fixable:** yes — the fixer can prepare a patch for review

**Why it matters.** `var` is function-scoped and hoisted, so it leaks out of blocks and loops — the classic source of 'value is undefined' surprises.

**How to fix it.** Use `const` by default and `let` only when you reassign.

### `JS013` — `parseInt` without a radix

**Severity:** minor · **Auto-fixable:** yes — the fixer can prepare a patch for review

**Why it matters.** Without a radix, `parseInt("08")` and similar strings can be read in an unexpected base.

**How to fix it.** Always pass the base: `parseInt(value, 10)` (or use `Number(value)`).

### `JS020` — `throw` of a non-Error value

**Severity:** minor · **Auto-fixable:** no — the mentor explains it and you change it yourself

**Why it matters.** Throwing a string loses the stack trace, so you cannot see where it came from.

**How to fix it.** Throw `new Error("message")`.

### `PY011` — `assert` used for runtime validation

**Severity:** minor · **Auto-fixable:** no — the mentor explains it and you change it yourself

**Why it matters.** Asserts are removed when Python runs with `-O`, so validation silently disappears.

**How to fix it.** Raise an explicit exception (`ValueError`) for data you must validate.

### `PY056` — Unused variable

**Severity:** minor · **Auto-fixable:** yes — the fixer can prepare a patch for review

**Why it matters.** An assigned but never read value is usually a typo — often the very bug you are hunting.

**How to fix it.** Remove it, or prefix with `_` if it is intentionally ignored.

### `PY063` — Async function without `await`

**Severity:** minor · **Auto-fixable:** no — the mentor explains it and you change it yourself

**Why it matters.** An `async def` with no await runs synchronously and blocks the event loop, defeating the point.

**How to fix it.** Either await the work inside, or make it a normal `def`.

---

## complexity (6)

### `GEN004` — Deep nesting

**Severity:** major · **Auto-fixable:** no — the mentor explains it and you change it yourself

**Why it matters.** Each nesting level adds a condition the reader must hold in mind.

**How to fix it.** Flatten with guard clauses.

### `JS015` — Callback / promise nesting too deep

**Severity:** major · **Auto-fixable:** no — the mentor explains it and you change it yourself

**Why it matters.** Deeply nested callbacks invert the reading order of the program and make error handling impossible to follow.

**How to fix it.** Flatten with `async/await`, or extract named functions.

### `JS016` — Function is too long

**Severity:** major · **Auto-fixable:** no — the mentor explains it and you change it yourself

**Why it matters.** Long functions mix responsibilities, which is why they collect bugs.

**How to fix it.** Extract named helpers.

### `PY030` — Function is too complex

**Severity:** major · **Auto-fixable:** no — the mentor explains it and you change it yourself

**Why it matters.** Cyclomatic complexity above 10 means more branches than a reader can hold in their head at once, so the function is hard to test and easy to break.

**How to fix it.** Extract cohesive blocks into small named helpers; each branch becomes a testable unit.

### `PY031` — Function is too long

**Severity:** major · **Auto-fixable:** no — the mentor explains it and you change it yourself

**Why it matters.** Long functions mix several responsibilities, which is why they accumulate bugs faster than the rest of the codebase.

**How to fix it.** Split it into helpers whose names describe the steps (``load``, ``validate``, ``render``).

### `PY032` — Deep nesting

**Severity:** major · **Auto-fixable:** no — the mentor explains it and you change it yourself

**Why it matters.** Every indent level adds a condition the reader must keep in mind. Four levels is usually the point where mistakes start.

**How to fix it.** Use guard clauses (`if not valid: return`) and early returns to flatten the code.

---

## docs (5)

### `JS014` — Missing JSDoc on an exported function

**Severity:** minor · **Auto-fixable:** no — the mentor explains it and you change it yourself

**Why it matters.** Export boundaries are the public API of a module; undocumented ones get used wrongly.

**How to fix it.** Add a short JSDoc block with `@param` and `@returns`.

### `PY040` — Missing docstring

**Severity:** minor · **Auto-fixable:** no — the mentor explains it and you change it yourself

**Why it matters.** A one-line docstring tells the next reader what the function promises — intent is the part tests cannot express.

**How to fix it.** Add a short summary, then document parameters, return value and raised errors.

### `PY042` — Missing type annotations

**Severity:** minor · **Auto-fixable:** no — the mentor explains it and you change it yourself

**Why it matters.** Type hints let editors catch mistakes before you run the program and double as documentation.

**How to fix it.** Annotate parameters and return values, then check with `mypy`.

### `JS018` — No JSDoc / type for a big module

**Severity:** info · **Auto-fixable:** no — the mentor explains it and you change it yourself

**Why it matters.** A module without any documentation is hard to onboard into.

**How to fix it.** Document the module purpose at the top of the file.

### `PY041` — Module has no docstring

**Severity:** info · **Auto-fixable:** no — the mentor explains it and you change it yourself

**Why it matters.** Without a module docstring, newcomers cannot tell what the file is responsible for.

**How to fix it.** Add a one-paragraph summary at the very top.

---

## maintainability (13)

### `GEN010` — Duplicated code block

**Severity:** major · **Auto-fixable:** no — the mentor explains it and you change it yourself

**Why it matters.** Copy-pasted logic has to be fixed in every copy; sooner or later one copy is forgotten.

**How to fix it.** Extract the repeated block into one named function and call it from both places.

### `PY060` — Duplicated code block

**Severity:** major · **Auto-fixable:** no — the mentor explains it and you change it yourself

**Why it matters.** Copy-pasted logic must be fixed in every copy; sooner or later one copy is forgotten.

**How to fix it.** Extract the block into a function and call it from both places.

### `GEN005` — Commented-out code

**Severity:** minor · **Auto-fixable:** no — the mentor explains it and you change it yourself

**Why it matters.** Commenting out code instead of deleting it makes readers guess whether it is still needed.

**How to fix it.** Delete it — version control remembers.

### `GEN006` — File is very large

**Severity:** minor · **Auto-fixable:** no — the mentor explains it and you change it yourself

**Why it matters.** Files above a few hundred lines are hard to navigate and usually hold several responsibilities.

**How to fix it.** Split by responsibility.

### `JS017` — Too many parameters

**Severity:** minor · **Auto-fixable:** no — the mentor explains it and you change it yourself

**Why it matters.** Wide parameter lists are easy to call in the wrong order.

**How to fix it.** Pass an options object.

### `PY033` — Too many parameters

**Severity:** minor · **Auto-fixable:** no — the mentor explains it and you change it yourself

**Why it matters.** Wide parameter lists are hard to call correctly and impossible to extend safely.

**How to fix it.** Group related values into a dataclass or NamedTuple, or pass a config object.

### `PY054` — Wildcard import

**Severity:** minor · **Auto-fixable:** no — the mentor explains it and you change it yourself

**Why it matters.** `from x import *` hides where names come from and can silently shadow your own definitions.

**How to fix it.** Import the names you use explicitly.

### `PY055` — Unused import

**Severity:** minor · **Auto-fixable:** yes — the fixer can prepare a patch for review

**Why it matters.** Dead imports mislead readers, slow startup and can hide circular dependencies.

**How to fix it.** Delete the import (or use it). Ruff/Flake8 flag these automatically.

### `PY057` — `global` statement

**Severity:** minor · **Auto-fixable:** no — the mentor explains it and you change it yourself

**Why it matters.** Global mutable state makes behaviour depend on call order, which is nearly impossible to test.

**How to fix it.** Pass the value in and return the new one, or hold it in an object.

### `GEN002` — TODO / FIXME marker

**Severity:** info · **Auto-fixable:** no — the mentor explains it and you change it yourself

**Why it matters.** Unfinished work hidden in comments is forgotten work.

**How to fix it.** Create a tracked issue with an owner.

### `JS021` — TODO left in the code

**Severity:** info · **Auto-fixable:** no — the mentor explains it and you change it yourself

**Why it matters.** Unfinished work hidden in comments is forgotten work.

**How to fix it.** Track it as an issue.

### `PY043` — TODO left in the code

**Severity:** info · **Auto-fixable:** no — the mentor explains it and you change it yourself

**Why it matters.** Unfinished work hidden in comments is forgotten work.

**How to fix it.** Either do it now or create a tracked issue with an owner.

### `PY062` — Magic number

**Severity:** info · **Auto-fixable:** no — the mentor explains it and you change it yourself

**Why it matters.** A bare number has no meaning; the reader cannot tell whether 0.2 is tax, a threshold or a typo.

**How to fix it.** Name it: `TAX_RATE = 0.2`, ideally with a comment about the source.

---

## security (10)

### `GEN003` — Hardcoded secret

**Severity:** critical · **Auto-fixable:** no — the mentor explains it and you change it yourself

**Why it matters.** Credentials in the repository can never be un-leaked; they must be rotated and moved to configuration.

**How to fix it.** Read it from the environment or a secret manager.

### `JS008` — `innerHTML` with dynamic data

**Severity:** critical · **Auto-fixable:** no — the mentor explains it and you change it yourself

**Why it matters.** Assigning user data to `innerHTML` executes injected scripts (XSS).

**How to fix it.** Use `textContent`, or sanitise with a vetted library such as DOMPurify.

**Read more:** <https://owasp.org/www-community/attacks/xss/>

### `JS009` — `eval` / `new Function`

**Severity:** critical · **Auto-fixable:** no — the mentor explains it and you change it yourself

**Why it matters.** Code strings execute with full page privileges, which is remote code execution in a browser context.

**How to fix it.** Parse data (JSON.parse) or use a lookup table of allowed behaviour.

### `JS011` — Hardcoded secret

**Severity:** critical · **Auto-fixable:** no — the mentor explains it and you change it yourself

**Why it matters.** Keys in front-end code are public by definition; anyone can read them in devtools.

**How to fix it.** Proxy the call through your backend and keep the secret server-side.

### `PY020` — `eval`/`exec` on dynamic input

**Severity:** critical · **Auto-fixable:** no — the mentor explains it and you change it yourself

**Why it matters.** Any value that reaches `eval` can execute arbitrary Python — a remote code execution hole (OWASP A03: Injection).

**How to fix it.** Parse the data instead: `json.loads`, `int()`, `ast.literal_eval`, or a lookup dictionary of allowed operations.

**Read more:** <https://owasp.org/Top10/A03_2021-Injection/>

### `PY021` — SQL built by string concatenation

**Severity:** critical · **Auto-fixable:** no — the mentor explains it and you change it yourself

**Why it matters.** Concatenated SQL enables SQL injection: a crafted query string reads or destroys the whole database.

**How to fix it.** Use parameterised queries (`cursor.execute(sql, params)`) or an ORM.

**Read more:** <https://owasp.org/Top10/A03_2021-Injection/>

### `PY022` — Shell command execution

**Severity:** critical · **Auto-fixable:** no — the mentor explains it and you change it yourself

**Why it matters.** `os.system` / `shell=True` hands user data to a shell, where `;` and `$()` run extra commands.

**How to fix it.** Prefer `subprocess.run([...], shell=False)` with an argument list, and validate the input.

### `PY023` — Hardcoded secret

**Severity:** critical · **Auto-fixable:** no — the mentor explains it and you change it yourself

**Why it matters.** Secrets in source end up in git history, CI logs and screenshots, and cannot be rotated safely.

**How to fix it.** Move it to an environment variable or a secret manager and rotate the leaked value.

### `PY024` — Unsafe deserialisation

**Severity:** critical · **Auto-fixable:** no — the mentor explains it and you change it yourself

**Why it matters.** `pickle` and `yaml.load` can construct arbitrary objects while parsing, which is equivalent to running the attacker's code.

**How to fix it.** Use `json`, or `yaml.safe_load`.

### `PY025` — Insecure randomness for a token

**Severity:** major · **Auto-fixable:** no — the mentor explains it and you change it yourself

**Why it matters.** `random` is predictable; an attacker who sees a few values can guess the next ones.

**How to fix it.** Use the `secrets` module for tokens, passwords and reset codes.

---

## style (10)

### `JS006` — `console.log` left in application code

**Severity:** minor · **Auto-fixable:** yes — the fixer can prepare a patch for review

**Why it matters.** Console noise ships to users and can leak personal data into browser logs.

**How to fix it.** Use a logger with levels and remove debug statements before merging.

### `PY003` — Comparison to None using `==`

**Severity:** minor · **Auto-fixable:** yes — the fixer can prepare a patch for review

**Why it matters.** `==` can be overloaded by objects and return surprising results; `is` compares identity and cannot be overridden.

**How to fix it.** Write `if value is None:` and `if value is not None:`.

**Read more:** <https://peps.python.org/pep-0008/#programming-recommendations>

### `PY050` — Line is too long

**Severity:** minor · **Auto-fixable:** no — the mentor explains it and you change it yourself

**Why it matters.** Long lines force horizontal scrolling and hide the structure of an expression.

**How to fix it.** Wrap at 88–100 characters (PEP 8 + Black default).

### `PY052` — Multiple statements on one line

**Severity:** minor · **Auto-fixable:** yes — the fixer can prepare a patch for review

**Why it matters.** Semicolon-joined statements hide control flow and break line-based tooling.

**How to fix it.** One statement per line.

### `GEN001` — Line is too long

**Severity:** info · **Auto-fixable:** no — the mentor explains it and you change it yourself

**Why it matters.** Very long lines hide the structure of an expression.

**How to fix it.** Wrap the statement across several lines.

### `GEN007` — Mixed line endings / missing final newline

**Severity:** info · **Auto-fixable:** no — the mentor explains it and you change it yourself

**Why it matters.** Inconsistent endings produce noisy diffs for the whole team.

**How to fix it.** Normalise to LF and end files with a newline.

### `JS019` — `let` never reassigned

**Severity:** info · **Auto-fixable:** yes — the fixer can prepare a patch for review

**Why it matters.** `const` communicates that the binding never changes, which removes a whole class of questions for the reader.

**How to fix it.** Use `const`.

### `PY008` — `range(len(...))` loop

**Severity:** info · **Auto-fixable:** yes — the fixer can prepare a patch for review

**Why it matters.** Indexing by position is harder to read and easier to get wrong (off-by-one).

**How to fix it.** Iterate the values directly, or use `enumerate()` when you need the index.

### `PY012` — Loop can be replaced by `any()`/`all()`/`next()`

**Severity:** info · **Auto-fixable:** no — the mentor explains it and you change it yourself

**Why it matters.** Hand-rolled search loops hide the intent; built-ins express it in one line.

**How to fix it.** Use `any(...)`, `all(...)` or a generator with `next()`, or `break` as soon as the answer is known.

### `PY051` — Trailing whitespace / tab indentation

**Severity:** info · **Auto-fixable:** yes — the fixer can prepare a patch for review

**Why it matters.** Whitespace noise pollutes diffs and, in Python, mixing tabs and spaces raises TabError.

**How to fix it.** Configure your editor to trim trailing whitespace and insert 4 spaces.

---

## tests (2)

### `JS022` — Exported function without a test

**Severity:** major · **Auto-fixable:** no — the mentor explains it and you change it yourself

**Why it matters.** Untested public behaviour regresses silently.

**How to fix it.** Add a unit test for the happy path and one edge case.

### `PY061` — No tests found for this module

**Severity:** major · **Auto-fixable:** no — the mentor explains it and you change it yourself

**Why it matters.** Without a test, nobody can safely change this code — including you in three months.

**How to fix it.** Add a `test_*.py` covering the happy path and one failure path.

---
