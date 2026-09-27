"""Analysis engine: dispatch by language, cross-file duplication, health score.

Health score formula (documented because it drives the whole dashboard):

    penalty = Σ severity_weight × confidence      over every finding
    metrics_penalty = complexity + length + nesting + documentation + duplication terms
    score = clamp(100 − penalty − metrics_penalty, 0, 100)

The score is intentionally conservative: a file with three critical security findings can
never score above 60 no matter how tidy the rest of it is.
"""

from __future__ import annotations

import math
import time
from collections import defaultdict

from ..models import FileAnalysis, Finding, Metrics, new_id
from . import generic_analyzer, js_analyzer, python_analyzer
from .masking import normalise_line
from .rules import RULES
from ..store import detect_language, grade_for

SEVERITY_WEIGHT = {"critical": 12.0, "major": 5.5, "minor": 2.0, "info": 0.6}
SEVERITY_ORDER = {"critical": 0, "major": 1, "minor": 2, "info": 3}
PYTHON_RULE_PREFIX = ("PY",)
JS_RULE_PREFIX = ("JS",)

PYTHON_LANGUAGES = {"python"}
JS_LANGUAGES = {"javascript", "typescript"}


def analyze_text(source: str, path: str, language: str | None = None) -> FileAnalysis:
    """Analyse one file and return a complete :class:`FileAnalysis`."""
    started = time.perf_counter()
    language = (language or detect_language(path)).lower()

    findings: list[Finding] = []
    metrics = Metrics()

    if language in PYTHON_LANGUAGES:
        scan = python_analyzer.analyze(source, path)
        findings.extend(scan.findings)
        metrics = scan.metrics
    elif language in JS_LANGUAGES:
        scan = js_analyzer.analyze(source, path, language)
        findings.extend(scan.findings)
        metrics = scan.metrics
    else:
        scan = generic_analyzer.analyze(source, path, language)  # type: ignore[assignment]
        findings.extend(scan.findings)
        metrics = scan.metrics

    generic_scan = generic_analyzer.analyze(source, path, language)
    for finding in generic_scan.findings:
        if finding.rule in {"GEN005", "GEN006", "GEN007", "GEN008", "GEN010"}:
            findings.append(finding)
    findings.extend(_structural_findings(source, path, language, metrics))

    deduped = _dedupe(findings)
    deduped.sort(key=lambda f: (SEVERITY_ORDER.get(f.severity, 4), f.line))
    score = health_score(deduped, metrics, language)

    analysis = FileAnalysis(
        path=path,
        language=language,
        findings=deduped,
        metrics=metrics,
        health_score=score,
        grade=grade_for(score),
        duration_ms=round((time.perf_counter() - started) * 1000, 2),
    )
    analysis.summary = summarise(analysis)
    return analysis


def _structural_findings(source: str, path: str, language: str, metrics: Metrics) -> list[Finding]:
    """Problems that depend on whole-file metrics rather than a single line."""
    findings: list[Finding] = []
    lines = source.splitlines()

    if language in PYTHON_LANGUAGES and metrics.functions and metrics.docstring_coverage < 40:
        findings.append(
            _finding(
                "PY040",
                max(1, metrics.functions),
                f"Only {metrics.docstring_coverage:.0f}% of functions are documented.",
                severity="minor",
                confidence=0.7,
            )
        )
    if language in PYTHON_LANGUAGES and metrics.functions and metrics.avg_complexity > 6:
        findings.append(
            _finding(
                "PY030",
                max(1, metrics.functions),
                f"Average cyclomatic complexity is {metrics.avg_complexity} — aim for under 6.",
                severity="major",
                confidence=0.8,
            )
        )
    if "test" not in path.lower() and not path.lower().startswith("test_") and metrics.functions >= 3:
        findings.append(
            _finding(
                "PY061" if language in PYTHON_LANGUAGES else "JS022",
                1,
                "No test file references this module.",
                severity="major",
                confidence=0.55,
            )
        )
    if len(lines) > 500:
        findings.append(
            _finding("GEN006", 1, f"File length is {len(lines)} lines.", severity="minor", confidence=0.6)
        )
    return findings


def _finding(rule_id: str, line: int, message: str, **overrides) -> Finding:
    rule = RULES[rule_id]
    return Finding(
        id=new_id("f"),
        rule=rule.id,
        title=overrides.pop("title", rule.title),
        message=message,
        severity=overrides.pop("severity", rule.severity),
        category=overrides.pop("category", rule.category),
        line=line,
        confidence=overrides.pop("confidence", 0.7),
        why_it_matters=rule.why_it_matters,
        how_to_fix=rule.how_to_fix,
        autofixable=overrides.pop("autofixable", rule.autofixable),
        references=list(rule.references),
    )


def _dedupe(findings: list[Finding]) -> list[Finding]:
    """One finding per (rule, line) pair — keeps the report readable."""
    best: dict[tuple[str, int], Finding] = {}
    for finding in findings:
        key = (finding.rule, finding.line)
        existing = best.get(key)
        if existing is None or finding.confidence > existing.confidence:
            best[key] = finding
    return list(best.values())


def health_score(findings: list[Finding], metrics: Metrics, language: str = "python") -> float:
    penalty = 0.0
    for finding in findings:
        weight = SEVERITY_WEIGHT.get(finding.severity, 1.0)
        penalty += weight * max(0.25, finding.confidence)

    # metric based penalties — they catch "works but unmaintainable" files
    if metrics.max_complexity > 10:
        penalty += (metrics.max_complexity - 10) * 1.1
    if metrics.avg_complexity > 5:
        penalty += (metrics.avg_complexity - 5) * 1.4
    if metrics.max_function_length > 40:
        penalty += (metrics.max_function_length - 40) * 0.18
    if metrics.max_nesting >= 4:
        penalty += (metrics.max_nesting - 3) * 2.0
    if metrics.functions and metrics.docstring_coverage < 50:
        penalty += (50 - metrics.docstring_coverage) * 0.08
    if metrics.duplication > 10:
        penalty += (metrics.duplication - 10) * 0.4
    if not metrics.comment_lines and metrics.code_lines > 60:
        penalty += 3.0

    score = 100.0 - penalty
    # a critical security problem caps the score, whatever else is good
    criticals = sum(1 for f in findings if f.severity == "critical")
    if criticals:
        score = min(score, 65.0 if criticals == 1 else 55.0)
    return round(max(2.0, min(100.0, score)), 1)


def maintainability_index(metrics: Metrics) -> float:
    """Classic Halstead/SEI style index, scaled to 0-100 for the dashboard."""
    volume = max(1.0, float(metrics.code_lines))
    complexity = max(1.0, metrics.avg_complexity or 1.0)
    raw = 171 - 3.42 * math.log(complexity) - 0.23 * math.log(volume) - 16.2 * math.log(
        max(1.0, metrics.max_function_length or 1.0)
    )
    return round(max(0.0, min(100.0, raw * 100 / 171)), 1)


def summarise(analysis: FileAnalysis) -> str:
    """One paragraph a human can read without opening the dashboard."""
    counts = analysis.severity_counts()
    if not analysis.findings:
        return (
            f"{analysis.path} looks healthy: no problems found across {analysis.metrics.code_lines} "
            f"lines of code."
        )
    parts = [
        f"{counts['critical']} critical" if counts["critical"] else "",
        f"{counts['major']} major" if counts["major"] else "",
        f"{counts['minor']} minor" if counts["minor"] else "",
        f"{counts['info']} note(s)" if counts["info"] else "",
    ]
    breakdown = ", ".join(part for part in parts if part)
    worst = analysis.findings[0]
    return (
        f"{analysis.path}: health {analysis.health_score}/100 (grade {analysis.grade}) with {breakdown} "
        f"issues. Start with line {worst.line}: {worst.title.lower()}."
    )


# ------------------------------------------------------------------- duplication
def _windows(source: str, size: int = 6) -> dict[str, list[int]]:
    """Map every normalised sliding window of code to the lines where it appears."""
    index: dict[str, list[int]] = defaultdict(list)
    lines = source.splitlines()
    buffer: list[tuple[str, int]] = []
    for number, line in enumerate(lines, start=1):
        normalised = normalise_line(line)
        if len(normalised) < 8:
            buffer = []
            continue
        buffer.append((normalised, number))
        if len(buffer) >= size:
            chunk = buffer[-size:]
            key = "\n".join(item[0] for item in chunk)
            index[key].append(chunk[0][1])
    return index


def detect_duplication(sources: dict[str, str], min_block: int = 6) -> list[Finding]:
    """Cross-file clone detection — the same fix in three files is three future bugs."""
    seen: dict[str, tuple[str, int]] = {}
    findings: list[Finding] = []
    for path, source in sources.items():
        for key, positions in _windows(source, min_block).items():
            for position in positions:
                previous = seen.get(key)
                if previous and (previous[0] != path or previous[1] != position):
                    other_path, other_line = previous
                    finding = _finding(
                        "GEN010",
                        position,
                        f"Lines {position}-{position + min_block - 1} duplicate {other_path}:{other_line}.",
                        severity="major",
                        confidence=0.6,
                        title="Code duplicated across files",
                    )
                    finding.snippet = key.splitlines()[0][:120]
                    finding.tags = [path, other_path]  # both files own a copy of the clone
                    findings.append(finding)
                    break
                seen.setdefault(key, (path, position))
    return findings


def project_summary(sources: dict[str, str]) -> dict:
    """Analyse every file and roll the numbers up for the dashboard."""
    analyses = [analyze_text(source, path) for path, source in sources.items()]
    duplicates = detect_duplication(sources)
    if duplicates:
        # a clone belongs to both files, so both reports mention it
        for analysis in analyses:
            analysis.findings.extend([f for f in duplicates if analysis.path in f.tags])
            analysis.findings = _dedupe(analysis.findings)
            analysis.health_score = health_score(analysis.findings, analysis.metrics, analysis.language)
            analysis.grade = grade_for(analysis.health_score)
            analysis.summary = summarise(analysis)
    return {
        "analyses": {a.path: a.to_dict() for a in analyses},
        "duplicate_findings": [f.to_dict() for f in duplicates],
        "average_health": round(sum(a.health_score for a in analyses) / len(analyses), 1) if analyses else None,
        "maintainability": maintainability_index(Metrics(**{
            **Metrics().to_dict(),
            **{
                key: (sum(getattr(a.metrics, key) for a in analyses) / len(analyses))
                for key in ("code_lines", "avg_complexity", "max_function_length", "max_complexity")
            },
        })) if analyses else None,
    }
