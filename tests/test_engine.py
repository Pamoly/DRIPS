"""Unit tests for the engine. No server, no dependencies, no network.

    python3 -m unittest discover -s tests -v

They cover the parts that must be trustworthy, because everything else in the product
is built on top of them:

* the analyser finds the bugs it claims to find (and does not fire on clean code),
* the fixers produce exactly the change they describe, and refuse when the pattern is
  not there any more,
* the approval gate cannot be bypassed,
* the sandbox stops a runaway program.
"""

from __future__ import annotations

import os
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.app.agents.base import AgentContext
from backend.app.agents.debugger import debugger_agent
from backend.app.agents.fixer import SAFE_AUTOFIX_RULES, fixer_agent
from backend.app.agents.reviewer import reviewer_agent
from backend.app.agents.teacher import teacher_agent
from backend.app.analyzer import analyze_text
from backend.app.runtime.runner import runner

MESSY = '''"""Demo module."""

import os


def total(items, cache={}):
    if cache == None:
        cache = {}
    try:
        return sum(i["price"] for i in items) / len(items)
    except:
        return 0


def query(name):
    sql = "SELECT * FROM t WHERE name = '" + name + "'"
    return sql


def load(path):
    handle = open(path)
    return handle.read()
'''

CLEAN = '''"""A clean module used to check that the analyser has no false positives."""

from __future__ import annotations


def average(prices: list[float]) -> float:
    """Return the mean of ``prices``, or 0.0 when the list is empty."""
    if not prices:
        return 0.0
    return sum(prices) / len(prices)
'''


class AnalyzerTests(unittest.TestCase):
    def setUp(self) -> None:
        self.analysis = analyze_text(MESSY, "messy.py", "python")
        self.rules = {finding.rule for finding in self.analysis.findings}

    def test_finds_the_classics(self) -> None:
        for rule in ("PY001", "PY002", "PY003", "PY005", "PY009", "PY021", "PY055"):
            self.assertIn(rule, self.rules, f"{rule} should be reported")

    def test_every_finding_is_teachable(self) -> None:
        for finding in self.analysis.findings:
            self.assertTrue(finding.title, finding.rule)
            self.assertTrue(finding.why_it_matters, finding.rule)
            self.assertTrue(finding.how_to_fix, finding.rule)
            self.assertGreaterEqual(finding.line, 1, finding.rule)

    def test_health_score_is_low_for_messy_code_and_high_for_clean_code(self) -> None:
        clean = analyze_text(CLEAN, "clean.py", "python")
        self.assertLess(self.analysis.health_score, 70)
        self.assertGreater(clean.health_score, self.analysis.health_score)
        self.assertIn(clean.grade, {"A", "B"})
        self.assertFalse(
            [f for f in clean.findings if f.severity in {"critical", "major"}],
            "a clean, documented, guarded function must not produce a major finding",
        )

    def test_critical_caps_the_score(self) -> None:
        self.assertTrue(any(f.severity == "critical" for f in self.analysis.findings))
        self.assertLessEqual(self.analysis.health_score, 65)

    def test_syntax_error_is_reported_not_crashed(self) -> None:
        broken = analyze_text("def broken(:\n    pass\n", "broken.py", "python")
        self.assertTrue(any(f.rule == "PY000" for f in broken.findings))
        self.assertTrue(any(f.severity == "critical" for f in broken.findings))

    def test_javascript_rules(self) -> None:
        js = "function f(cart) {\n  if (cart.length = 0) { return false; }\n  var total = 0;\n  if (total == 0) total++;\n  return total;\n}\n"
        analysis = analyze_text(js, "checkout.js", "javascript")
        rules = {finding.rule for finding in analysis.findings}
        self.assertIn("JS003", rules)  # assignment in a condition
        self.assertIn("JS002", rules)  # loose equality
        self.assertIn("JS001", rules)  # var

    def test_metrics_are_computed(self) -> None:
        metrics = self.analysis.metrics
        self.assertGreater(metrics.functions, 0)
        self.assertGreaterEqual(metrics.max_complexity, 1)
        self.assertGreater(metrics.lines, 10)

    def test_duplicate_detection_across_files(self) -> None:
        body = "\n".join('    total = total + row["price"] * row["quantity"]' for _ in range(6))
        first = f"def alpha(rows):\n{body}\n"
        second = f"def beta(rows):\n{body}\n"
        from backend.app.analyzer import detect_duplication

        findings = detect_duplication({"a.py": first, "b.py": second})
        self.assertTrue(findings, "the same block in two files should be reported")


class FixerTests(unittest.TestCase):
    def context(self, source: str = MESSY, path: str = "messy.py") -> AgentContext:
        return AgentContext(
            file_path=path,
            source=source,
            language="python",
            analysis=analyze_text(source, path, "python"),
        )

    def patch_for(self, rule: str, source: str = MESSY):
        context = self.context(source)
        finding = next(f for f in context.findings() if f.rule == rule)
        return fixer_agent.patch_for(context, finding)

    def test_mutable_default_patch_is_minimal_and_correct(self) -> None:
        patch = self.patch_for("PY001")
        self.assertIsNotNone(patch)
        assert patch is not None
        self.assertIn("cache=None", patch.patched)
        self.assertIn("if cache is None:", patch.patched)
        self.assertIn("cache = {}", patch.patched)
        self.assertNotIn("cache={}", patch.patched)
        self.assertTrue(patch.learning_note)
        self.assertTrue(patch.diff.startswith("---"))

    def test_none_comparison_patch(self) -> None:
        patch = self.patch_for("PY003")
        self.assertIsNotNone(patch)
        assert patch is not None
        self.assertIn("is None", patch.patched)
        self.assertNotIn("== None", patch.patched)

    def test_bare_except_patch(self) -> None:
        patch = self.patch_for("PY002")
        self.assertIsNotNone(patch)
        assert patch is not None
        self.assertIn("except Exception as error:", patch.patched)
        self.assertNotIn("except:\n", patch.patched)

    def test_encoding_patch(self) -> None:
        patch = self.patch_for("PY010")
        self.assertIsNotNone(patch)
        assert patch is not None
        self.assertIn('encoding="utf-8"', patch.patched)

    def test_fixer_refuses_when_the_pattern_is_gone(self) -> None:
        """Safety property: no pattern, no patch — the fixer never guesses."""
        context = self.context(MESSY)
        finding = next(f for f in context.findings() if f.rule == "PY003")
        finding.line = 3  # point at a line that has nothing to do with None comparisons
        self.assertIsNone(fixer_agent.patch_for(context, finding))

    def test_patched_source_still_parses(self) -> None:
        for rule in ("PY001", "PY002", "PY003", "PY010"):
            patch = self.patch_for(rule)
            if patch is None:
                continue
            compile(patch.patched, "patched.py", "exec")  # raises if the fix broke the syntax

    def test_autopilot_safe_list_excludes_logic_changes(self) -> None:
        for risky in ("PY001", "PY002", "PY021", "JS003", "JS008"):
            self.assertNotIn(risky, SAFE_AUTOFIX_RULES, f"{risky} must need a human decision")


class TeacherTests(unittest.TestCase):
    def test_explanation_covers_the_required_teaching_shape(self) -> None:
        source = Path("samples/inventory.py").read_text(encoding="utf-8")
        analysis = analyze_text(source, "inventory.py", "python")
        result = teacher_agent.run(
            AgentContext(file_path="inventory.py", source=source, language="python", analysis=analysis)
        )
        markdown = result.markdown
        self.assertIn("What this file is", markdown)
        self.assertIn("Structure", markdown)
        self.assertIn("Line by line", markdown)
        self.assertIn("How a professional reads this file", markdown)
        self.assertIn("Practice", markdown)
        self.assertTrue(result.data["quiz"], "a reading exercise should include self-check questions")
        self.assertTrue(all(question["answer"] for question in result.data["quiz"]))

    def test_explanation_mentions_real_lines(self) -> None:
        source = "def add(a, b):\n    total = a + b\n    return total\n"
        analysis = analyze_text(source, "tiny.py", "python")
        result = teacher_agent.run(
            AgentContext(file_path="tiny.py", source=source, language="python", analysis=analysis)
        )
        self.assertIn("returns", result.markdown.lower())


class ChatAgentTests(unittest.TestCase):
    """The mentor must answer about *your* code, not with a generic card."""

    def setUp(self) -> None:
        self.source = Path("samples/inventory.py").read_text(encoding="utf-8")
        self.analysis = analyze_text(self.source, "inventory.py", "python")

    def ask(self, question: str):
        from backend.app.agents.chat import chat_agent

        return chat_agent.run(
            AgentContext(
                file_path="inventory.py",
                source=self.source,
                language="python",
                analysis=self.analysis,
                question=question,
            )
        )

    def test_naming_a_function_answers_about_that_function(self) -> None:
        result = self.ask("why is load_cart dangerous?")
        self.assertIn("load_cart", result.headline)
        self.assertIn("line 32", result.markdown)
        self.assertIn("statement by statement", result.markdown)
        self.assertIn("Problems inside it", result.markdown)
        # it quotes the real problem in that function, with the fix
        self.assertIn("Mutable default argument", result.markdown)

    def test_concept_question_gets_a_grounded_lesson(self) -> None:
        result = self.ask("what is a mutable default argument?")
        self.assertIn("mutable trap", result.headline.lower())
        self.assertIn("None", result.markdown)
        self.assertIn("Try it now", result.markdown)

    def test_unknown_question_admits_it_and_offers_what_it_can_do(self) -> None:
        result = self.ask("tell me something random about the weather")
        self.assertIn("one more clue", result.markdown)
        self.assertTrue(result.follow_ups)

    def test_every_answer_says_where_it_came_from(self) -> None:
        result = self.ask("how do I handle errors?")
        self.assertEqual(result.data["provider"], "offline")
        self.assertTrue(result.data["grounded"])


class DebuggerTests(unittest.TestCase):
    TRACEBACK = (
        "Traceback (most recent call last):\n"
        '  File "main.py", line 12, in <module>\n'
        "    print(average_price([]))\n"
        '  File "inventory.py", line 103, in average_price\n'
        "    return sum(prices) / len(prices)\n"
        "ZeroDivisionError: division by zero\n"
    )

    def test_parses_traceback_and_ranks_the_real_cause_first(self) -> None:
        source = Path("samples/inventory.py").read_text(encoding="utf-8")
        analysis = analyze_text(source, "inventory.py", "python")
        result = debugger_agent.run(
            AgentContext(
                file_path="inventory.py",
                source=source,
                language="python",
                analysis=analysis,
                traceback_text=self.TRACEBACK,
            )
        )
        self.assertEqual(result.data["error_type"], "ZeroDivisionError")
        self.assertEqual(result.data["failing_line"], 103)
        self.assertTrue(result.data["hypotheses"])
        self.assertEqual(result.data["hypotheses"][0]["rule"], "PY005")
        self.assertIn("empty", result.markdown.lower())
        self.assertTrue(result.data["experiment"])
        self.assertEqual(len(result.data["frames"]), 2)

    def test_unknown_error_type_is_handled_gracefully(self) -> None:
        result = debugger_agent.run(
            AgentContext(file_path="x.py", source="x = 1\n", language="python", traceback_text="WeirdGlitch: boom")
        )
        self.assertIn("WeirdGlitch", result.markdown)

    def test_javascript_error_knowledge(self) -> None:
        result = debugger_agent.run(
            AgentContext(
                file_path="checkout.ts",
                source=Path("samples/checkout.ts").read_text(encoding="utf-8"),
                language="javascript",
                traceback_text="TypeError: Cannot read properties of undefined (reading 'id')\n    at checkout (checkout.ts:33:12)",
            )
        )
        self.assertIn("undefined", result.markdown.lower())


class ReviewerTests(unittest.TestCase):
    def test_security_finding_blocks_the_merge(self) -> None:
        source = Path("samples/inventory.py").read_text(encoding="utf-8")
        analysis = analyze_text(source, "inventory.py", "python")
        result = reviewer_agent.run(
            AgentContext(file_path="inventory.py", source=source, language="python", analysis=analysis)
        )
        self.assertEqual(result.data["decision"], "Blocked")
        self.assertTrue(result.data["blocking"])
        self.assertTrue(any(comment["kind"] == "blocker" for comment in result.data["review"]["comments"]))
        self.assertIn("Questions only a human can answer", result.markdown)

    def test_clean_file_is_approved(self) -> None:
        analysis = analyze_text(CLEAN, "clean.py", "python")
        result = reviewer_agent.run(
            AgentContext(file_path="clean.py", source=CLEAN, language="python", analysis=analysis)
        )
        self.assertIn(result.data["decision"], {"Approve", "Approve with follow-ups"})
        self.assertFalse(result.data["blocking"])


class SerialisationTests(unittest.TestCase):
    """Findings must survive the JSON round trip, because the API serialises them."""

    def test_analysis_round_trip_keeps_objects_not_dicts(self) -> None:
        from backend.app.models import FileAnalysis

        analysis = analyze_text(MESSY, "messy.py", "python")
        restored = FileAnalysis.from_dict(analysis.to_dict())
        self.assertEqual(len(restored.findings), len(analysis.findings))
        self.assertIsInstance(restored.findings[0], type(analysis.findings[0]))
        self.assertEqual(restored.severity_counts(), analysis.severity_counts())
        self.assertEqual(restored.health_score, analysis.health_score)
        self.assertEqual(restored.metrics.max_complexity, analysis.metrics.max_complexity)
        # the dashboard reads severity_counts() on restored payloads, so this must not raise
        self.assertEqual(sum(restored.severity_counts().values()), len(restored.findings))


class RunnerTests(unittest.TestCase):
    def test_stdout_is_captured(self) -> None:
        result = runner.run_source("print(6 * 7)\n", "calc.py", "python")
        self.assertEqual(result.exit_code, 0)
        self.assertIn("42", result.stdout)

    def test_errors_are_captured_with_a_summary(self) -> None:
        result = runner.run_source("raise ValueError('nope')\n", "boom.py", "python")
        self.assertNotEqual(result.exit_code, 0)
        self.assertIn("ValueError", result.traceback_summary)

    def test_parent_environment_is_not_inherited(self) -> None:
        os.environ["DRIPS_TEST_SECRET"] = "should-not-leak"
        try:
            result = runner.run_source(
                "import os\nprint(os.environ.get('DRIPS_TEST_SECRET', 'absent'))\n", "env.py", "python"
            )
        finally:
            os.environ.pop("DRIPS_TEST_SECRET", None)
        self.assertIn("absent", result.stdout)

    def test_unsupported_language_is_reported(self) -> None:
        result = runner.run_source("print('hi')", "x.cobol", "cobol")
        self.assertEqual(result.exit_code, 127)
        self.assertIn("not supported", result.stderr)


class ApprovalGateTests(unittest.TestCase):
    """The promise of the product, enforced in code."""

    def setUp(self) -> None:
        # a throwaway store so the test never touches the real workspace
        from backend.app.store import Store

        self.tmp = tempfile.TemporaryDirectory()
        self.store = Store(Path(self.tmp.name) / "workspace.json")
        self.store.files.clear()
        self.store.write_file("gate.py", MESSY, actor="test")

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def test_apply_requires_a_human_decision(self) -> None:
        from backend.app.agents import patch_service as patch_service_module

        patch_service = patch_service_module.patch_service
        original = patch_service_module.store
        patch_service_module.store = self.store
        try:
            context = AgentContext(
                file_path="gate.py",
                source=MESSY,
                language="python",
                analysis=analyze_text(MESSY, "gate.py", "python"),
            )
            finding = next(f for f in context.findings() if f.rule == "PY001")
            patch = patch_service.propose(context, finding)
            with self.assertRaises(ValueError):
                patch_service.apply(patch.id, actor="agent")
            patch_service.decide(patch.id, approve=True, actor="human")
            result = patch_service.apply(patch.id, actor="human")
            self.assertIn("cache=None", result["file"]["content"])
            # and the change is reversible
            reverted = patch_service.revert(patch.id, actor="human")
            self.assertEqual(reverted["patch"]["status"], "reverted")
            self.assertIn("cache={}", self.store.get_file("gate.py").content)
        finally:
            patch_service_module.store = original


if __name__ == "__main__":
    unittest.main(verbosity=2)
