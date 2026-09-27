"""Static intelligence: rule-based findings, metrics and the health score."""

from .engine import (  # noqa: F401
    SEVERITY_WEIGHT,
    analyze_text,
    detect_duplication,
    health_score,
    maintainability_index,
    project_summary,
    summarise,
)
from .rules import RULES  # noqa: F401

__all__ = [
    "RULES",
    "SEVERITY_WEIGHT",
    "analyze_text",
    "detect_duplication",
    "health_score",
    "maintainability_index",
    "project_summary",
    "summarise",
]
