#!/usr/bin/env python3
"""Generate docs/RULES.md from the rule catalog.

The catalog is the single source of truth: the analyser, the dashboard, the mentor and
the review checklist all read the same wording. This script keeps the human-readable
reference in sync instead of letting a wiki page rot.

    python3 scripts/generate_rule_reference.py
"""

from __future__ import annotations

import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.app.analyzer.rules import RULES  # noqa: E402

SEVERITY_ORDER = {"critical": 0, "major": 1, "minor": 2, "info": 3}
AUTOFIXABLE_NOTE = {
    True: "yes — the fixer can prepare a patch for review",
    False: "no — the mentor explains it and you change it yourself",
}


def main() -> int:
    by_category: dict[str, list] = defaultdict(list)
    for rule in RULES.values():
        by_category[rule.category].append(rule)

    lines = [
        "# Rule reference",
        "",
        f"{len(RULES)} rules ship with the engine. Every rule answers the same three questions: "
        "**what** it is, **why it matters** in terms of consequences, and **how to fix** it. "
        "The mentor, the health report and the review checklist all read these definitions, so the "
        "wording never drifts.",
        "",
        "A rule fires with a **confidence** value. Below 100% means the analyser is inferring "
        "(for example, it cannot know whether an `except` block is intentional), and the UI shows that "
        "number so you can judge for yourself.",
        "",
        "---",
        "",
    ]

    for category in sorted(by_category):
        rules = sorted(by_category[category], key=lambda r: (SEVERITY_ORDER[r.severity], r.id))
        lines.append(f"## {category} ({len(rules)})")
        lines.append("")
        for rule in rules:
            lines.append(f"### `{rule.id}` — {rule.title}")
            lines.append("")
            lines.append(f"**Severity:** {rule.severity} · **Auto-fixable:** {AUTOFIXABLE_NOTE[rule.autofixable]}")
            lines.append("")
            lines.append(f"**Why it matters.** {rule.why_it_matters}")
            lines.append("")
            lines.append(f"**How to fix it.** {rule.how_to_fix}")
            if rule.references:
                lines.append("")
                lines.append("**Read more:** " + ", ".join(f"<{url}>" for url in rule.references))
            lines.append("")
        lines.append("---")
        lines.append("")

    target = ROOT / "docs" / "RULES.md"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")
    print(f"wrote {target.relative_to(ROOT)} with {len(RULES)} rules")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
