# A five-minute tour

Open `http://localhost:8000`. Three sample files are loaded:

| file | health | why it exists |
|---|---|---|
| `inventory.py` | 24 · F | the messy one: a shared mutable default, bare `except`, SQL built by concatenation, a division that crashes on empty input |
| `checkout.ts` | 62 · D | the same problems in JavaScript: `var`, loose equality, `cart.length = 0` in a condition, a missing `await`, a swallowed error |
| `reference_quality.py` | 89 · B | what the same ideas look like when a professional writes them (frozen dataclass, `Decimal`, guards, docstrings) |

Everything below happens off the `inventory.py` tab. **Nothing is ever written to your
file until you press Apply on a patch you approved.**

---

## 1 · Read it first (30 seconds)

Click **Code** → the questions in the right-hand panel are the ones a reviewer would ask.
Notice the coloured squiggles: the analyser publishes its findings as real editor markers,
so problems appear where they live, not in a separate report.

## 2 · Get the health report (30 seconds)

Press **Analyze** (or the **Health** tab).

* a 0–100 score and a grade, with severity counts;
* metric meters — max complexity, longest function, nesting, docstring coverage, duplication;
* a table of functions with the *worst first*, because that is where to spend your time;
* the workspace hotspot list, so you know which file to open next.

Read one finding and you get the same three things every time: **what** it is, **why it
matters** as a consequence, and **how to fix it** — with a link to PEP 8 or OWASP.

## 3 · Learn to read code, not just run it (1 minute)

In the **Mentor** tab, click **Explain this file**.

You get a structure map, then a line-by-line walkthrough of the most complex function,
then the concepts it uses (mutation, default arguments, error handling) explained where
they appear in *your* file, then *how a professional reads this file* — and finally
self-check questions with the answers folded away.

Read the walkthrough out loud. The line where you stumble is the line to re-read.

## 4 · Debug something real (1 minute)

Press **Run**.

The file executes in a separate process with a memory limit and a 6-second timeout, and
the **Run** tab shows stdout, stderr and an exit code. When it fails, the debugger reads
the traceback for you: the frames bottom-up, the failing line, the usual causes of that
error type, ranked hypotheses (with the evidence), and **one experiment to run before you
change anything** — printing the real values, because debugging by re-reading code is
guessing.

You can also paste any traceback into the mentor (`Debug this` → paste → send).

## 5 · Prepare the fix — then decide (1 minute)

Click **Fix what you can** in the mentor, or **Propose fixes** in the toolbar.

Every autofixable finding becomes a patch in the **Fixes** tab: a unified diff, a
confidence, a risk level, and a learning note explaining what was wrong. Nothing has
changed in the file yet.

Then:

1. **Approve** one patch (add a note — it goes in the audit trail with your name);
2. **Apply** it — the file updates, the health score is recomputed instantly, and the
   finding disappears from the list;
3. switch to **History** and see the record;
4. press **Revert** because you disagree with yourself.

Try applying a patch you have *not* approved, from the API:

```bash
curl -X POST localhost:8000/api/patches/<id>/apply
# → 403  "This patch has not been approved yet. Approve it first — the whole point is that
#         a human reads the diff before it touches the file."
```

## 6 · Let it run the safe part (30 seconds)

Switch the toolbar to **Autopilot** and say *“clean up this file with autopilot”*.

Only transformations that cannot change behaviour are applied (whitespace, dead imports,
`==` → `===`, explicit encodings) — and a review request is filed so the change is signed
off like any other. Logic fixes are listed under **Left for you** with the reason each one
needs a human. Autopilot never touches a mutable default argument or an SQL query.

## 7 · Review like a senior engineer (30 seconds)

Click **Review**. The reviewer agent prepares the work *for* you:

* a recommendation — *Approve*, *Approve with follow-ups*, *Changes requested* or
  *Blocked* — with the reasoning;
* a **must pass before merge** list versus **should improve** (so suggestions never hide
  next to blockers);
* ready-to-post comments, tagged `blocker` or `suggestion`;
* the acceptance tests the author must demonstrate;
* the questions only a human can answer.

Now *you* decide: approve, request changes, or reject — with a note.

## 8 · Turn your own bugs into a curriculum (30 seconds)

Open the **Learn** tab. The lessons are not a fixed syllabus: they are ranked by how many
of *your* current findings each one would fix, across six levels from *Curious Beginner* to
*Professional Engineer*. Start one with the mentor, do the practice step, mark it complete
(+25 XP), and collect the badges that come from real work.

---

## The pattern to take away

```
read           →  explain the file before touching it
measure        →  health score, complexity, the worst function first
diagnose       →  traceback → failing line → hypotheses → one experiment
propose        →  a diff with a reason and a confidence, not a rewrite
decide         →  approve, reject, request changes — as a human, on the record
verify         →  apply, re-analyse, run, revert if the numbers disagree
learn          →  the fix teaches the rule, and the rule becomes your next lesson
```

That sequence *is* the difference between code that works today and code a team can still
change next year.
