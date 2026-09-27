# DRIPS — an autonomous code editor with a mentor, not a black box

DRIPS is a code editor that **teaches while it works**. A master assistant ("the Mentor")
reads your file with you line by line, scores its health, debugs your errors, prepares
fixes, writes the tests that would have caught them — and then **waits for your approval
before it changes a single character of your code**.

That last sentence is the design, not a limitation. Agents propose; humans decide. Every
decision is written to an audit trail, every change can be reverted in one click.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  DRIPS  ·  autonomous editor             [ manual | supervised | autopilot ] │
├───────────────┬──────────────────────────────────────────┬───────────────────┤
│  WORKSPACE    │  CODE (Monaco)                           │  MENTOR           │
│  ● inventory  │  def apply_discount(items, discount=0):   │  agent trace      │
│    grade F    │      if discount == None:   ◀ line 18    │  ✓ analysed       │
│  ● checkout   │          discount = 0                    │  ✓ explained      │
│    grade D    │      ...                                 │  ✓ 8 patches      │
│  ● reference  │                                          ├───────────────────┤
│    grade B    │  FINDINGS (why it matters + how to fix)   │  Fixes · Review   │
│               │  🛑 L80 SQL by concatenation              │  Learn · History  │
│               │  ⚠️ L32 mutable default argument          │                   │
│               │  ⚠️ L39 bare except swallows everything   │  [Approve] [Reject]│
├───────────────┴──────────────────────────────────────────┴───────────────────┤
│ project 58/100 · 1 critical · deterministic engine · supervised · 12 runs     │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Quick start

Two commands. No accounts, no API keys, no database.

```bash
# 1. the engine (Python 3.10+, standard library only — nothing to install)
python3 -m backend.app.server --port 8000

# 2. open http://localhost:8000
```

The engine serves the built UI itself. Three sample files are loaded on first run — one
deliberately messy (`inventory.py`), one messy in a different language (`checkout.ts`),
and one written the professional way (`reference_samples/reference_quality.py`) so you
can compare.

To work on the UI with hot reload:

```bash
cd frontend && npm install && npm run dev     # http://localhost:3000, proxies the API
```

`./start.sh` does both (install if needed, start the engine, start Vite).

### Optional: upgrade the mentor's prose with an LLM

```bash
export OPENAI_API_KEY=sk-...          # or ANTHROPIC_API_KEY=...
python3 -m backend.app.server
```

The model only **narrates**. Findings, patches, health scores and the approval gate are
produced by the deterministic engine, and the API response tells you which provider
answered. Without a key — the default — every feature still works: explanations are
generated from the parsed syntax tree, the curriculum and the rule catalog.

## What it actually does

### 1. Teaches you to read code (beginner → professional)

Ask *“explain this file”* and the teacher agent parses the source and answers with:

* **What this file is** — purpose, size, structure, the author's own words;
* **Structure map** — every function with its inputs and an inferred purpose, in reading order;
* **Line-by-line walkthrough** — what each line *does*, with the thing beginners miss
  (side effects, mutations, the value a `return` actually produces);
* **Concepts** — comprehensions, default arguments, async/await, mutation… explained
  where they appear in *your* code;
* **How a professional reads this file** — the five-step reading order;
* **Self-check questions with answers** — so you learn that you learned it.

Repeated boilerplate lines are collapsed, because ten identical explanations teach nothing ten times.

### 2. Checks code health (and explains every number)

71 rules across Python, JavaScript/TypeScript and language-agnostic checks. Not a linter
dump — each finding carries *why it matters* and *how to fix it*, plus a reference:

| | |
|---|---|
| **Bugs** | mutable default arguments, bare `except`, silently swallowed errors, division without a zero guard, files opened without `with`, unguarded JSON parsing, missing `await`, assignment inside a condition |
| **Security** | SQL built by concatenation, `eval`/`exec`, shell execution, hardcoded secrets, unsafe deserialisation, insecure randomness, `innerHTML` |
| **Complexity** | cyclomatic complexity per function, function length, nesting depth, parameter count, cross-file duplication |
| **Docs & team** | docstring coverage, type annotations, missing tests, TODO debt |
| **Style that hides bugs** | shadowed built-ins, unused imports/variables, `==` vs `is`, loose equality, `var`, commented-out code |

The **health score** (0–100 + a letter grade) combines severity-weighted penalties with
metric penalties, and caps the score when a critical security problem exists. The formula
is documented in `backend/app/analyzer/engine.py` — the same place it is computed.

### 3. Debugs with you

Paste a traceback (or press **Run** and let it crash) and the debugger agent:

1. parses the frames for Python *and* JavaScript, bottom-up;
2. maps the failing frame to the line in your file;
3. explains the error type — what it means, why it usually happens, how to confirm it —
   from a knowledge base of 20+ common errors;
4. ranks hypotheses, using the static findings near that line, filtering out cosmetics
   (a missing docstring never caused a `ZeroDivisionError`);
5. gives you **one experiment to run before changing anything** — printing the actual
   values, because debugging by re-reading code is guessing;
6. proposes the minimal repair, which still needs your approval.

### 4. Fixes — with a diff, a reason, and your signature

Every fix is a **patch**: a unified diff, a confidence, a risk level, and a learning note
explaining what was wrong so you stop writing it. The flow is deliberately slow:

```
propose  →  read the diff  →  approve or reject (with a note)  →  apply  →  verify  →  revert if you disagree
```

* applying an **unapproved** patch returns `403` with an explanation (there is a test for this);
* a patch generated against older content is refused as a **conflict** rather than
  silently overwriting someone's edit;
* applying a patch re-analyses the file, updates the health score and closes the finding;
* **Autopilot** (opt-in) applies only transformations that cannot change behaviour —
  whitespace, dead imports, `==`→`===`, explicit encodings — and then files a review
  request so a human still signs off. Logic fixes never auto-apply.

### 5. Reviews like a senior engineer (and keeps you in charge)

The reviewer agent produces the review *for* you: a decision recommendation with its
reasoning, a **must-pass** vs **should-improve** checklist, ready-to-post comments split
into blockers and suggestions, the acceptance tests the author must demonstrate, and the
questions only a human can answer. You approve, request changes or reject — with your name
and note in the audit trail.

## The master assistant: how a request travels

You ask in plain language; every request becomes a visible plan.

```
"explain this, then fix what you can"
        │
        ├─ intents: research · fix · review            ← rule-based routing, no LLM needed
        ├─ plan:    [teacher] → [fixer-agent] → [reviewer]     ← streamed to the UI
        │
        ├─ teacher      → line-by-line reading, concepts, quiz
        ├─ fixer-agent  → 8 patches, each a diff + a learning note   (file untouched)
        └─ reviewer     → "Blocked: a critical security issue is present"
        │
        └─ summary → tokens stream back; nothing was written to disk
```

The stream is server-sent events over `POST /api/chat/stream`, so the plan, the agent
trace, the findings, the patches and the final answer all appear as they happen — and you
can read *how* a senior engineer approaches the file, not just the conclusion.

## Autonomy levels

| mode | the agents may | you must |
|---|---|---|
| **manual** | explain, analyse, teach | ask before anything is proposed |
| **supervised** *(default)* | propose patches with diffs and reasons | approve each patch before it is applied |
| **autopilot** | apply provably safe transformations, then file a review | confirm (or revert) the result |

## Architecture

```
frontend/  React 18 + TypeScript + Vite + Tailwind + Monaco (bundled locally, no CDN)
   │  relative URLs only → works behind any host, port or sandbox proxy
   │  POST /api/chat/stream → the agent trace, streamed
backend/   Python standard library only (no FastAPI, no dependencies)
   ├── analyzer/   71 rules · AST for Python, masked-source heuristics for JS/TS
   │               metrics · duplication · health score
   ├── agents/     mentor · teacher · debugger · fixer · reviewer · test-writer · coach · autopilot
   │               llm.py = optional narration · patch_service.py = the approval gate
   ├── runtime/    sandboxed execution: separate process, rlimits, timeout, isolated interpreter
   ├── learning/   levels, tracks, lessons — mapped to the rules you actually trip
   └── store.py    JSON-persisted workspace + append-only audit trail
samples/   three files chosen to demonstrate every capability
tests/     28 unit tests (unittest) + a 91-check end-to-end journey test
```

Full detail, including the security model and the extension points, is in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). The complete rule reference is generated
from the catalog into [`docs/RULES.md`](docs/RULES.md).

## Tests

```bash
python3 -m unittest discover -s tests            # 28 unit tests, no server needed
python3 -m backend.app.server --port 8000 &      # engine
python3 tests/test_journey.py                    # 91 end-to-end checks
```

New here? [`docs/WALKTHROUGH.md`](docs/WALKTHROUGH.md) is a five-minute guided tour of a
single file, from reading it to reviewing the fix.

The journey test walks the product the way a person does — read, diagnose, propose,
approve, apply, revert, run, review, audit — and asserts the promises, including that
**autopilot only touches rules on the safe list** and that **an unapproved patch cannot be
applied**.

```
91/91 checks passed
The whole loop works: read → diagnose → propose → approve → apply → revert → review.
```

## Configuration

| variable | default | meaning |
|---|---|---|
| `DRIPS_PORT` / `--port` | `8000` | listen port |
| `DRIPS_AUTONOMY` | `supervised` | `manual` · `supervised` · `autopilot` |
| `DRIPS_ALLOW_EXECUTION` | `1` | set to `0` to disable the Run button entirely |
| `DRIPS_EXECUTION_TIMEOUT` | `6` | seconds before a runaway program is killed |
| `DRIPS_EXECUTION_MEMORY_MB` | `256` | address-space limit for the sandboxed process |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | — | enable LLM narration (optional) |
| `DRIPS_PROVIDER` | `auto` | force `offline`, `openai` or `anthropic` |

## Honest limitations

* The JavaScript analyser is heuristic (masked source + brace tracking), not a compiler.
  Findings carry confidence values, and the mentor says "I am 70% sure" out loud.
* The sandbox is a learning sandbox: isolated process, rlimits and a timeout — not a
  security boundary for hostile code.
* The workspace is a single-user JSON store. `store.py` is the only module that touches
  persistence, so replacing it with a real database is a contained change.
* Autopilot deliberately handles a small set of transformations. A tool that rewrites
  logic you did not read is the thing this project exists to avoid.

## License

MIT — see `LICENSE`.
