# Architecture

> The guiding rule: **the deterministic engine establishes facts, the language model
> narrates them, and a human approves every change.**

A beginner cannot verify an LLM's claim that "line 42 has a race condition". They *can*
verify a rule that points at line 42, explains the consequence, and offers a patch they
can read. That is why analysis, patches and scores never come from a model.

---

## 1. Layers

```
                 ┌──────────────────────────── frontend/ ────────────────────────────┐
                 │ React 18 · TypeScript · Vite · Tailwind · Monaco (local bundle)   │
                 │ one origin: relative URLs only, proxied in dev, served by the     │
                 │ engine in production                                              │
                 └───────────────┬───────────────────────────────┬───────────────────┘
                                 │ REST (JSON)                   │ SSE (agent trace)
                 ┌───────────────▼───────────────────────────────▼───────────────────┐
                 │ routes/api.py — workspace · intelligence · assistant · approval  │
                 │                runtime · learning · ops                           │
                 └───────────────┬───────────────────────────────┬───────────────────┘
        ┌────────────────────────▼───────────┐      ┌────────────▼────────────────────┐
        │ analyzer/                          │      │ agents/                         │
        │  rules.py      catalog (71 rules)  │      │  orchestrator.py  plans + streams│
        │  python_analyzer.py   AST          │      │  teacher · debugger · fixer      │
        │  js_analyzer.py       masked scan  │      │  reviewer · test_writer · coach  │
        │  generic_analyzer.py  anything     │      │  patch_service.py  THE GATE      │
        │  engine.py     metrics + score     │      │  llm.py   optional narration     │
        └────────────────────────┬───────────┘      └────────────┬────────────────────┘
                                 │                               │
                 ┌───────────────▼───────────────────────────────▼───────────────────┐
                 │ store.py — workspace state, JSON persistence, append-only audit   │
                 │ runtime/runner.py — sandboxed execution (rlimits · timeout · -I)  │
                 │ learning/curriculum.py — levels, tracks, lessons keyed by rule    │
                 └───────────────────────────────────────────────────────────────────┘
```

The engine is **dependency-free** on purpose: it is one `python3 -m backend.app.server`
away from running on any machine, which is what makes it usable in a classroom, a
container, or a sandboxed preview where `pip install` is not available.

---

## 2. The analysis pipeline

```
source ──► language detection (by extension)
             │
             ├─ python  ──► ast.parse ──► single walk:
             │                 complexity (McCabe) · nesting · defaults · calls ·
             │                 comparisons · imports · built-in shadowing · guards
             │
             ├─ js/ts   ──► masking.mask_source()  (comments + string contents blanked,
             │                 so prose never trips a rule) ──► brace-tracked function
             │                 blocks ──► readability/bug/security heuristics
             │
             └─ other   ──► line rules: length, TODOs, secrets, nested indentation,
                              bracket balance, commented-out code, clone windows
             │
             ▼
     Finding objects ── dedupe per (rule, line) ── sort by severity then line
             │
             ▼
     Metrics ──► health score ──► grade ──► one-paragraph summary
```

### Health score

```python
penalty       = Σ severity_weight(finding) × max(0.25, confidence)
metric_penalty = complexity + length + nesting + documentation + duplication terms
score          = clamp(100 − penalty − metric_penalty, 2, 100)
if any critical finding: score = min(score, 65 | 55)      # a cap, not a penalty
```

Severity weights: `critical 12 · major 5.5 · minor 2 · info 0.6`. The cap exists because
"mostly tidy but ships SQL injection" must not look like an 82. A separate
maintainability index (Halstead/SEI style) is reported for the project rollup.

### False positives are a feature to defend

Two examples that were fixed *because tests demanded it*:

* `if not prices: return 0.0` followed by `sum(prices) / len(prices)` is **not** a
  ZeroDivision bug — `_guarded_names()` collects emptiness guards and suppresses `PY005`.
* `from __future__ import annotations` is never "unused" — the import rule skips
  `__future__`, because a false positive teaches a beginner to ignore the tool.

Confidence is carried all the way to the UI, and the walkthrough says "I am 70% sure"
in words.

---

## 3. Agents

| agent | input | output | writes files? |
|---|---|---|---|
| `teacher` | source + analysis | structure map, line-by-line reading, concepts, quiz | no |
| `debugger` | traceback + analysis | frames, ranked hypotheses, experiment, repair | no |
| `fixer` | a finding | `Patch` (diff + learning note) | no |
| `reviewer` | analysis | recommendation, checklist, comments, questions | no |
| `test_writer` | functions + findings | test-file `Patch` | no |
| `coach` | findings + learner profile | next lessons, weak skills, session plan | no |
| `mentor` | any question | concept answer grounded in your file | no |
| `autopilot` | analysis | applies safe patches, then files a review | **yes — safe rules only** |

`fixer.py` is the largest module because each fix is a **verifying transformation**:

```python
def fix_mutable_default(lines, finding):
    index = finding.line - 1
    line  = lines[index]
    if not re.match(r"^\s*(async\s+)?def\s+\w+\s*\(", line):   # verify before changing
        ...                                                    # (else refuse silently)
    match = re.search(r"(\w+)\s*=\s*(\[\]|\{\}|set\(\))", line)
    if not match:
        return None                                            # pattern gone → no patch
```

Each fixer must (1) confirm the pattern is still there, (2) change the smallest possible
region, (3) insert *after* a docstring rather than before it, and (4) attach a note that
teaches the underlying rule.

---

## 4. The approval gate

`patch_service.apply()` is the only code path that writes to a workspace file, and it
enforces four invariants:

1. **A decision exists.** Status must be `approved`; otherwise → `403` with the reason.
2. **No stale writes.** The file's current content must equal the patch's `original`,
   otherwise → `409 conflict` ("re-analyse and propose again").
3. **Re-analysis after the write.** The health score, findings and revision are recomputed
   immediately, so the dashboard never shows pre-fix numbers.
4. **Reversibility + record.** `revert()` restores the previous content when the file has
   not been edited since, and every state change appends an `AuditEvent` (actor, action,
   target, detail, timestamp).

Autopilot is the narrow exception, and it is narrow by *rule id*:

```python
SAFE_AUTOFIX_RULES = { PY003, PY006, PY008, PY010, PY050, PY051, PY052,
                       PY054, PY055, JS001, JS002, JS013, JS019, GEN001, GEN007 }
# …and only when confidence ≥ 0.85 and risk ∈ {info, minor}
```

Everything else — a mutable default argument, a bare `except`, an SQL injection — must be
read by a person. The loop re-analyses after **each** write, because line numbers move as
soon as code is inserted or deleted.

---

## 5. Streaming protocol

`POST /api/chat/stream` returns `text/event-stream` with one JSON payload per frame:

| event | payload | purpose |
|---|---|---|
| `session` | chat id | correlation |
| `plan` | intents + steps | show the plan *before* the work, so the user can see the method |
| `analysis` | full analysis | the health panel updates while the answer streams |
| `step` | agent, action, status, xp | the agent trace |
| `message` | agent, headline, markdown, follow-ups | one rendered block per agent |
| `patch` | patch | appears in the Fixes tab immediately |
| `review` | review request | appears in the Review tab |
| `token` | text | the streamed summary |
| `done` / `close` | usage | end of stream |

The client reads the body with a stream reader (not `EventSource`, which is GET-only) so
the request can carry the file, the traceback and the session id. Chunked transfer
encoding is used deliberately: no `Content-Length`, so every token flushes immediately.

---

## 6. Security model

| concern | mitigation |
|---|---|
| running untrusted code | separate process, `python -I -B` (isolated, no bytecode), temporary working directory, minimal environment (no inherited secrets), wall-clock timeout, POSIX `RLIMIT_CPU` / `RLIMIT_AS` / `RLIMIT_NOFILE`, `DRIPS_ALLOW_EXECUTION=0` to switch it off |
| path traversal | static file serving resolves and checks the request path against the served root; SPA fallback only inside it |
| XSS from model output | assistant markdown is rendered through `marked` **and** sanitised with DOMPurify before it reaches the DOM |
| silent overwrites | patches carry their `original`; applying against changed content is a `409` conflict |
| unauthorised writes | no endpoint writes a file without an approved patch; the API returns `403` with the reason |
| leaked credentials | secrets are detected as findings, and the sandbox does not inherit the parent environment |
| who did what | every proposal, decision, apply, revert, run and lesson completion is appended to the audit trail |

The sandbox is honest about its scope: it protects against accidents and runaway loops,
not against an adversary. Hostile-code isolation belongs in a container or gVisor.

---

## 7. Learner model

Findings are mapped to five skills (`reading code`, `safe code & edges`, `clarity &
structure`, `tests & reviews`, `design & security`) through `RULE_TO_SKILL`. That mapping
powers three things:

* **Levels** — XP from real work (analysing, reading, fixing, testing, reviewing) moves the
  learner through six levels from *Curious Beginner* to *Professional Engineer*.
* **Lesson ranking** — `next_lessons()` scores every lesson by how many of *your* findings
  it would fix, so the curriculum follows your code instead of a fixed syllabus.
* **Badges** — tied to verifiable actions (first approved fix, first clean file, no critical
  findings in the workspace), never to clicks.

---

## 8. Extension points

| to add… | touch this |
|---|---|
| a new rule | `analyzer/rules.py` (catalog entry) + the detector in the right analyser |
| a new automatic fix | `agents/fixer.py`: one `Fixer` function + a `FIXERS` entry (+ `SAFE_AUTOFIX_RULES` only if it cannot change behaviour) |
| a new agent | `agents/`: subclass `Agent`, register in `Orchestrator.agents` and add an intent keyword |
| a new LLM provider | `agents/llm.py`: one `_yourprovider()` method returning `LLMResponse` |
| a database | `store.py`: keep the method names, change the storage |
| a lesson | `learning/curriculum.py`: append a `Lesson` with the rules it addresses |
| a new language | `analyzer/`: implement `analyze()` returning findings + metrics, dispatch in `engine.py` |

Because the rule catalog is the single source of truth, adding a rule automatically gives
it a chat explanation, a dashboard entry, a review comment and a lesson hook.
