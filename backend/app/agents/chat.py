"""Free-form conversation: concepts, "why is this like that?", and general questions.

Offline (no API key) the mentor answers from a curated, workspace-aware knowledge base:
each topic knows the definition, the pitfall, an example, and where the current file
touches it. With an API key the large model writes the prose, but the *facts* still come
from this module and from the analyser — so the mentor cannot invent a finding.
"""

from __future__ import annotations

import ast
import re

from .base import Agent, AgentContext, AgentResult
from .llm import MENTOR_SYSTEM_PROMPT, LLMMessage, llm

TOPICS: dict[str, dict] = {
    "variable": {
        "title": "Variables",
        "what": "A variable is a name pointing at a value. In Python the name is created by assignment; in JavaScript `const`/`let` declare it.",
        "pitfall": "Reusing one name for two meanings ('data' for both the raw and the cleaned input) is the most common source of confusion in beginner code.",
        "example": "```python\nprice = 10.0      # a float\nquantity = 3      # an int\ntotal = price * quantity\n```",
        "try_it": "Rename one variable in this file so the name states what the value *means*.",
    },
    "loop": {
        "title": "Loops",
        "what": "A loop repeats work for every item in a collection (`for`) or while a condition holds (`while`).",
        "pitfall": "Tracking two things at once — an index and a value — is where off-by-one and stale-index bugs come from. Iterate the values, and use `enumerate` when you need the position.",
        "example": "```python\nfor index, item in enumerate(cart):\n    print(index, item[\"name\"])\n```",
        "try_it": "Find a `range(len(...))` loop in this workspace and rewrite it with `enumerate`.",
    },
    "function": {
        "title": "Functions",
        "what": "A function is a named block with inputs (parameters) and one output (the return value). Its name is a promise about what it does.",
        "pitfall": "Functions that do several things at once cannot be named honestly, cannot be tested in isolation and grow without limit. If the name needs 'and', split it.",
        "example": "```python\ndef line_total(price: float, quantity: int) -> float:\n    return price * quantity\n```",
        "try_it": "Take the longest function in this file and name the two responsibilities inside it.",
    },
    "list": {
        "title": "Lists",
        "what": "A list is an ordered collection you can change: append, remove, sort. Indexing starts at 0.",
        "pitfall": "Lists are passed by reference. If a function appends to a list argument, the caller's list changes too — that is a side effect nobody sees in the signature.",
        "example": "```python\ncart.append(item)        # mutates the list in place\nsafe = [*cart, item]     # creates a new list instead\n```",
        "try_it": "Look for `.append(` inside a function that receives a list, and decide whether the caller expects that mutation.",
    },
    "dictionary": {
        "title": "Dictionaries",
        "what": "A dictionary maps keys to values, with lookup by name instead of position — the natural structure for records.",
        "pitfall": "`d[key]` raises `KeyError` when the key is missing. For optional fields use `d.get(key, default)` and decide explicitly what 'missing' means.",
        "example": "```python\nprice = item.get(\"price\", 0)      # optional field\nname = item[\"sku\"]               # required: failing early is correct here\n```",
        "try_it": "Find every `[...]` lookup on external data in this file and ask: can this key legitimately be absent?",
    },
    "error": {
        "title": "Errors and exceptions",
        "what": "An exception is how code reports 'I cannot do this'. `try/except` decides what happens next.",
        "pitfall": "A bare `except:` (or `except: pass`) hides typos, `KeyboardInterrupt` and real bugs. Catch the specific error you can actually handle.",
        "example": "```python\ntry:\n    quantity = int(raw)\nexcept ValueError:\n    quantity = 0          # documented fallback\n```",
        "try_it": "Rewrite a bare except in this workspace, and say what the caller sees after the change.",
    },
    "default argument": {
        "title": "Default arguments (and the mutable trap)",
        "what": "A default makes a parameter optional: `def f(items=[])`. Python evaluates that default **once**, when the `def` line runs — not on every call.",
        "pitfall": "Because there is only one list object, values appended during one call are still there on the next call. This is the single most common 'why does my function remember?' bug, and it is silent.",
        "example": "```python\ndef add_item(item, basket=None):      # None is the safe default\n    if basket is None:\n        basket = []                  # fresh list per call\n    basket.append(item)\n    return basket\n```",
        "try_it": "Find a `=[]` or `={}` default in this workspace and rewrite it with the `None` sentinel.",
    },
    "mutation": {
        "title": "Mutation and side effects",
        "what": "Mutating means changing an object in place (`items.append(x)`, `record['k'] = v`). Every other holder of that object sees the change.",
        "pitfall": "A function that mutates its argument has an invisible output: the caller's variable changes, and nothing in the signature said so. Shared state then makes bugs depend on call order.",
        "example": "```python\ndef with_tax(items):\n    return [*items, tax]        # new list — the caller's data is untouched\n```",
        "try_it": "Look for `.append(`/`.update(` inside a function that receives a list or dict, and decide whether the caller knows.",
    },
    "duplication": {
        "title": "Duplicated code",
        "what": "Two blocks that are nearly identical. They are cheap to write and expensive to own.",
        "pitfall": "Every copy has to be fixed separately, so sooner or later one is forgotten — and the two copies then disagree about the truth. Reviewers stop reading carefully when a diff is mostly repetition.",
        "example": "```python\ndef line_total(item):              # written once\n    return item[\"price\"] * item[\"quantity\"]\n\ntotal = sum(line_total(item) for item in cart)\n```",
        "try_it": "Run the project overview and look for cross-file clones; extract the shared block into one function and call it twice.",
    },
    "naming": {
        "title": "Naming",
        "what": "A name is the cheapest documentation you will ever write. It should say what the value *means*, not what type it is.",
        "pitfall": "Names like `data`, `temp`, `process()`, `handle2` force the reader to reverse-engineer the intent from the body — which is exactly what you were trying to avoid.",
        "example": "```python\nnet_total = subtotal - discount      # the name answers \"which total?\"\n```",
        "try_it": "Find one variable in this file whose name would not survive a code review, and rename it.",
    },
    "side effect": {
        "title": "Side effects",
        "what": "A side effect is anything a function does beyond returning a value: printing, writing a file, calling the network, mutating an argument.",
        "pitfall": "Side effects are what make functions hard to test and impossible to reason about in isolation. A function whose name is a noun ('receipt') should probably not write files.",
        "example": "```python\ndef build_receipt(cart) -> str:      # pure: same input, same output\n    return NEWLINE.join(line(item) for item in cart)\n```".replace("NEWLINE", "chr(10)"),
        "try_it": "List every side effect in the active file, then ask which of them the caller would be surprised by.",
    },
    "none": {
        "title": "None / null / undefined",
        "what": "`None` (Python) and `null`/`undefined` (JavaScript) mean 'no value'. They are the most common source of `AttributeError` and 'Cannot read properties of undefined'.",
        "pitfall": "Comparing with `== None`, or assuming a function always returns a value when some path returns nothing.",
        "example": "```python\nif value is None:      # identity, cannot be overloaded\n    return 0\n```",
        "try_it": "List every function in this file that can return `None` and check each caller.",
    },
    "test": {
        "title": "Tests",
        "what": "A test is executable proof that a function does what you claim. Arrange the input, act by calling it, assert the result.",
        "pitfall": "Tests that only cover the happy path give false confidence. The empty list, the missing key and the invalid string are where the bugs are.",
        "example": "```python\ndef test_average_price_of_empty_list_returns_zero():\n    assert average_price([]) == 0\n```",
        "try_it": "Generate tests for this file and then break the function on purpose — at least one test must fail.",
    },
    "complexity": {
        "title": "Cyclomatic complexity",
        "what": "A count of the independent paths through a function: 1 plus every `if`, loop, `and`/`or` and `except`.",
        "pitfall": "Above 10 you cannot hold all the paths in your head, so reviews stop catching things. Extract cohesive blocks until each function is under about 8.",
        "example": "```python\nif a and b:      # complexity +2 for this line\n    ...\n```",
        "try_it": "Open the health report and look at the highest-complexity function; find the block that deserves a name.",
    },
    "security": {
        "title": "Security basics that apply every day",
        "what": "Never let data become code or commands: parameterise SQL, avoid `eval`, use `textContent` instead of `innerHTML`, keep secrets out of source.",
        "pitfall": "String building feels convenient and works in every test you write, which is why injection survives to production.",
        "example": "```python\ncursor.execute(\"SELECT * FROM products WHERE name LIKE ?\", (f\"%{query}%\",))\n```",
        "try_it": "Search this workspace for `+ query +` and replace it with parameters.",
    },
    "async": {
        "title": "Async / await",
        "what": "`await` pauses your function until a slow operation finishes, letting the program do other work meanwhile.",
        "pitfall": "Forgetting `await` gives you a Promise instead of the data — `data.id` silently becomes `undefined`.",
        "example": "```js\nconst response = await fetch(url);\nconst data = await response.json();\n```",
        "try_it": "Find an async call in this workspace without `await` and explain what the caller receives instead.",
    },
    "type": {
        "title": "Types and annotations",
        "what": "Annotations name the kind of value a function expects and returns. They are documentation your editor can check.",
        "pitfall": "Mixed types in one variable (`total` that is sometimes a number and sometimes a string) cause errors far from where the mistake was made.",
        "example": "```python\ndef total_with_tax(cart: list[dict], rate: float = 0.2) -> float:\n```",
        "try_it": "Annotate one function and run it — annotations should never change behaviour.",
    },
    "git": {
        "title": "Git and small changes",
        "what": "Each commit should be one idea you could revert alone. Small diffs are easier to review and easier to debug later.",
        "pitfall": "Mixing a rename, a feature and a formatting pass in one diff makes every review superficial.",
        "example": "```bash\ngit add -p          # stage only the hunks you mean\ngit commit -m \"fix: guard empty price list in average_price\"\n```",
        "try_it": "Approve a patch in the Review tab and commit it on its own, using the description as the message.",
    },
}

SYNONYMS = {
    "variable": ["variable", "assignment", "const", "let", "var"],
    "loop": ["loop", "for", "while", "iterate", "iteration", "enumerate", "range"],
    "function": ["function", "def", "method", "parameter", "argument", "return"],
    "list": ["list", "array", "append", "tuple"],
    "dictionary": ["dict", "dictionary", "hash", "map", "key", "json", "object"],
    "error": ["error", "exception", "try", "except", "catch", "finally", "raise", "throw"],
    "none": ["none", "null", "undefined", "optional", "missing"],
    "default argument": ["mutable default", "default argument", "default value", "defaults", "default parameter"],
    "mutation": ["mutation", "mutations", "mutate", "mutating", "mutates", "in place", "in-place", "append", "reference"],
    "side effect": ["side effect", "side effects", "side-effect", "side-effects", "pure function", "impure", "stateful"],
    "duplication": ["duplicate", "duplication", "clone", "copy-paste", "copy paste", "repeated code", "dry"],
    "naming": ["naming", "name", "rename", "readable", "readability", "too short"],
    "test": ["test", "pytest", "vitest", "jest", "assert", "coverage"],
    "complexity": ["complexity", "cyclomatic", "nesting", "refactor", "long function"],
    "security": ["security", "sql", "injection", "secret", "xss", "eval", "password"],
    "async": ["async", "await", "promise", "concurrency", "fetch"],
    "type": ["type", "annotation", "hint", "mypy", "typed"],
    "git": ["git", "commit", "branch", "merge", "diff", "pull request", "pr"],
}


class ChatAgent(Agent):
    name = "mentor"
    description = "The master assistant: concepts, decisions and general questions."
    keywords = ()

    def run(self, context: AgentContext) -> AgentResult:
        question = (context.question or "").strip()
        topics = self._match_topics(question)
        symbol = self._target_symbol(context, question)
        offline = self._offline_answer(context, question, topics, symbol)
        answer, provider = self._maybe_upgrade(context, question, offline)

        return AgentResult(
            agent=self.name,
            headline=self._headline(question, topics, symbol),
            markdown=answer,
            data={
                "topics": [topic["title"] for topic in topics],
                "provider": provider,
                "grounded": True,
                "offline_answer_used": provider == "offline",
            },
            follow_ups=self._follow_ups(topics, context),
            xp=5 if topics else 2,
        )

    # ------------------------------------------------------------------ retrieval
    def _match_topics(self, question: str) -> list[dict]:
        lowered = question.lower()
        scored: list[tuple[int, dict]] = []
        for key, synonyms in SYNONYMS.items():
            score = sum(
                1 for synonym in synonyms if re.search(rf"\b{re.escape(synonym)}(?:s|es|ing)?\b", lowered)
            )
            if score:
                scored.append((score, TOPICS[key]))
        scored.sort(key=lambda item: item[0], reverse=True)
        return [topic for _, topic in scored[:3]]

    def _offline_answer(self, context: AgentContext, question: str, topics: list[dict], symbol: str | None = None) -> str:
        parts: list[str] = []
        if symbol:
            parts.append(self._describe_symbol(context, symbol))
        if topics:
            main = topics[0]
            parts.append(f"## {main['title']}\n{main['what']}")
            parts.append(f"### The pitfall\n{main['pitfall']}")
            parts.append(f"### Small example\n{main['example']}")

            usage = self._usage_in_file(context, main["title"].lower())
            if usage:
                parts.append(f"### Where this shows up in your file\n{usage}")
            parts.append(f"### Try it now\n{main['try_it']}")
            if len(topics) > 1:
                parts.append(
                    "### Related\n"
                    + self.bullet([f"**{topic['title']}** — {topic['what'].split('.')[0]}." for topic in topics[1:]])
                )
        elif symbol:
            pass  # already answered above, from the source itself
        else:
            parts.append(
                "## I need one more clue\n"
                "I could not match your question to a concept I can explain precisely, and I would rather say so "
                "than guess. Try one of these, or paste the line of code you are staring at:"
            )
            parts.append(
                self.bullet(
                    [
                        "“Explain this file” — a full guided read of the editor's active file.",
                        "“Why is `load_cart` dangerous?” — a question about a specific function.",
                        "“What is a mutable default argument?” — a concept from the glossary.",
                        "“Debug this traceback: …” — paste the error and I will read it.",
                        "“Review this file” — a senior-engineer review checklist.",
                    ]
                )
            )
            findings = context.findings()
            if findings:
                worst = findings[0]
                parts.append(
                    f"### Meanwhile, in your file\nLine {worst.line}: *{worst.title}*. "
                    f"{worst.why_it_matters} Ask me to fix it and I will prepare the patch."
                )
        return "\n\n".join(parts)

    def _target_symbol(self, context: AgentContext, question: str) -> str | None:
        """Find a function or class in the file that the question names.

        "Why is `load_cart` dangerous?" should be answered about *that* function, from the
        source, not with a generic concept card.
        """
        if not question:
            return None
        named = set(re.findall(r"[`'\"]([A-Za-z_][\w]*)[`'\"]|\b([a-z_][a-z0-9_]{3,})\b", question))
        candidates = {first or second for first, second in named}
        symbols = self._symbols(context)
        for name in symbols:
            if name in candidates:
                return name
        return None

    def _symbols(self, context: AgentContext) -> dict[str, dict]:
        """Functions and classes in the file, with their line range and outline."""
        symbols: dict[str, dict] = {}
        if context.language == "python":
            try:
                tree = ast.parse(context.source)
            except SyntaxError:
                return symbols
            for node in ast.walk(tree):
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                    symbols[node.name] = {
                        "kind": "class" if isinstance(node, ast.ClassDef) else "function",
                        "line": node.lineno,
                        "end_line": getattr(node, "end_lineno", node.lineno),
                        "docstring": ast.get_docstring(node) or "",
                        "params": [a.arg for a in getattr(node, "args", ast.arguments([], [], None, [], [], None, [])).args],
                        "outline": self._outline(node),
                        "node": node,
                    }
            return symbols
        from .teacher import _js_blocks

        for block in _js_blocks(context):
            symbols[block["name"]] = {
                "kind": "function",
                "line": block["line"],
                "end_line": block["end_line"],
                "docstring": "",
                "params": [p.strip() for p in block["params_raw"].split(",") if p.strip()],
                "outline": [
                    line.strip()
                    for line in block["body"].splitlines()
                    if line.strip() and not line.strip().startswith(("//", "/*", "*"))
                ][:8],
                "node": None,
            }
        return symbols

    @staticmethod
    def _outline(node: ast.AST) -> list[str]:
        """One short line per top-level statement — the shape of the function at a glance."""
        steps: list[str] = []
        for statement in getattr(node, "body", []):
            if isinstance(statement, ast.AST) and hasattr(ast, "unparse"):
                text = ast.unparse(statement).splitlines()[0].strip()
                if len(text) > 96:
                    text = text[:93] + "…"
                steps.append(text)
        return steps[:10]

    def _describe_symbol(self, context: AgentContext, name: str) -> str:
        symbol = self._symbols(context).get(name)
        if not symbol:
            return ""
        findings = [
            finding
            for finding in context.findings()
            if symbol["line"] <= finding.line <= symbol["end_line"]
        ]
        complexity = ""
        if context.analysis:
            for function in context.analysis.metrics.extra.get("functions", []):
                if function.get("name", "").split(".")[-1] == name:
                    complexity = (
                        f"\n**Cost to read:** cyclomatic complexity {function['complexity']}, "
                        f"{function['length']} lines, {function['nesting']} level(s) of nesting."
                    )
                    break

        lines = [
            f"## `{name}` — {symbol['kind']} at line {symbol['line']}",
            f"**Inputs:** " + (", ".join(f"`{p}`" for p in symbol["params"]) or "*none*")
            + f"  ·  **Body:** lines {symbol['line']}–{symbol['end_line']}",
        ]
        if symbol["docstring"]:
            lines.append(f"**The author says:** “{symbol['docstring'].strip().splitlines()[0]}”")
        else:
            lines.append(
                "**No docstring**, so the name carries the whole promise. Ask yourself: could you rename this "
                "function without lying?"
            )
        if symbol["outline"]:
            steps = "\n".join(f"{index}. `{step}`" for index, step in enumerate(symbol["outline"][:8], start=1))
            lines.append(f"### What it actually does, statement by statement\n{steps}")
        if complexity:
            lines.append(complexity.strip())

        if findings:
            rows = ["### Problems inside it"]
            for finding in findings[:4]:
                rows.append(
                    f"- {self.severity_icon(finding.severity)} **{finding.title}** (line {finding.line}) — "
                    f"{finding.why_it_matters} *Fix:* {finding.how_to_fix}"
                )
            lines.append("\n".join(rows))
        else:
            lines.append("### Problems inside it\nNone found by the static rules — the risk here is design, not syntax.")
        lines.append(
            "### Check your understanding\n"
            f"Cover the body and predict what `{name}` returns for the smallest realistic input, then run it. "
            "If your prediction and the output disagree, that gap is the thing to learn next."
        )
        return "\n\n".join(lines)

    def _usage_in_file(self, context: AgentContext, topic_title: str) -> str:
        signals = {
            "loops": r"^\s*(for|while)\s",
            "dictionaries": r"\[[\"'][\w_]+[\"']\]",
            "errors and exceptions": r"\b(try|except|raise)\b",
            "lists": r"\.append\(|\[[^\]]*\]",
            "functions": r"^\s*def\s",
            "none / null / undefined": r"\bNone\b|\bnull\b|\bundefined\b",
            "complexity": r"^\s*(if|elif|for|while)\b",
            "async / await": r"\b(await|async)\b",
            "tests": r"\bassert\b",
        }
        pattern = signals.get(topic_title)
        if not pattern:
            return ""
        for number, line in enumerate(context.lines, start=1):
            if re.search(pattern, line):
                return f"`{context.file_path}` line {number}:\n\n```{context.language}\n{line.strip()}\n```"
        return ""

    # --------------------------------------------------------------------- llm mix
    def _maybe_upgrade(self, context: AgentContext, question: str, offline: str) -> tuple[str, str]:
        if not llm.available:
            return offline, "offline"
        brief = self._context_brief(context)
        response = llm.complete(
            MENTOR_SYSTEM_PROMPT,
            [
                LLMMessage("user", "Context about the file the user is editing:\n" + brief),
                LLMMessage("user", f"Question: {question}"),
                LLMMessage(
                    "user",
                    "Here is the verified, deterministic answer produced by the analysis engine. "
                    "Rewrite it in a warmer teaching voice, keep every fact, add no new findings:\n\n" + offline,
                ),
            ],
        )
        if response.ok:
            return response.text, f"{response.provider}:{response.model}"
        return offline + f"\n\n*(The {llm.provider} provider returned an error — `{response.error}` — so this answer came from the built-in engine, which needs no API key.)*", "offline"

    def _context_brief(self, context: AgentContext) -> str:
        analysis = context.analysis
        lines = [
            f"File: {context.file_path} ({context.language}, {len(context.lines)} lines)",
            f"Health: {analysis.health_score}/100 grade {analysis.grade}" if analysis else "Health: not analysed",
        ]
        if analysis:
            for finding in analysis.findings[:6]:
                lines.append(f"- [{finding.severity}] line {finding.line}: {finding.title} — {finding.message}")
        return "\n".join(lines)

    def _headline(self, question: str, topics: list[dict], symbol: str | None = None) -> str:
        if symbol:
            return f"`{symbol}` — read from your source, with the problems inside it"
        if topics:
            return f"{topics[0]['title']} — explained with an example from your code"
        return "Let me point you at what I can do precisely"

    def _follow_ups(self, topics: list[dict], context: AgentContext) -> list[str]:
        if topics:
            return [
                f"Show me a bigger example of {topics[0]['title'].lower()}",
                "Now explain how my file uses it",
                "Give me an exercise to practise it",
            ]
        return ["Explain this file", "Check the health of this file", "Review this file"]


chat_agent = ChatAgent()
