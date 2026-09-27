"""Comment/string masking shared by the non-Python analysers.

Static rules for JavaScript and other braced languages need the code *without* the
contents of comments and string literals, otherwise every rule trips on prose. This
scanner is a deliberately small state machine: it keeps line numbers stable (it never
changes the number of newlines) and records where comments were found so those lines can
still be reported as documentation.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

REGEX_PREFIXES = set("(,=:[!&|?{};+-*/%~^<>")


@dataclass
class MaskedSource:
    raw_lines: list[str] = field(default_factory=list)
    code_lines: list[str] = field(default_factory=list)
    comment_lines: set[int] = field(default_factory=set)
    string_lines: set[int] = field(default_factory=set)
    comments: list[tuple[int, str]] = field(default_factory=list)

    @property
    def text(self) -> str:
        return "\n".join(self.code_lines)


def mask_source(source: str, language: str = "javascript") -> MaskedSource:
    masked = MaskedSource()
    raw_lines = source.splitlines()
    masked.raw_lines = raw_lines
    code_lines: list[str] = []

    # languages where ``#`` starts a comment
    hash_comments = language in {"ruby", "shell", "yaml", "toml", "python"}
    slash_comments = not hash_comments

    for number, line in enumerate(raw_lines, start=1):
        out: list[str] = []
        i = 0
        length = len(line)
        while i < length:
            char = line[i]
            nxt = line[i + 1] if i + 1 < length else ""

            if char == "#" and hash_comments:
                masked.comment_lines.add(number)
                masked.comments.append((number, line[i + 1:].strip()))
                i = length
                break

            if slash_comments and char == "/" and nxt == "/":
                masked.comment_lines.add(number)
                masked.comments.append((number, line[i + 2:].strip()))
                i = length
                break

            if slash_comments and char == "/" and nxt == "*":
                masked.comment_lines.add(number)
                end = line.find("*/", i + 2)
                if end == -1:  # multi-line block comment: mask the rest of this line
                    masked.comments.append((number, line[i + 2:].strip()))
                    out.append(" " * (length - i))
                    i = length
                else:
                    masked.comments.append((number, line[i + 2:end].strip()))
                    out.append(" " * (end + 2 - i))
                    i = end + 2
                continue

            if char in {'"', "'", "`"}:
                quote = char
                masked.string_lines.add(number)
                start = i
                i += 1
                while i < length:
                    current = line[i]
                    if current == "\\":
                        i += 2
                        continue
                    if current == quote:
                        i += 1
                        break
                    i += 1
                out.append(line[start:i] if len(line[start:i]) <= 2 else line[start] + " " * (i - start - 2) + quote)
                continue

            if slash_comments and char == "/":
                previous = line[:i].rstrip()[-1:] or ""
                if previous in REGEX_PREFIXES or not previous:
                    # probable regex literal — mask it
                    i += 1
                    while i < length and line[i] != "/":
                        if line[i] == "\\":
                            i += 1
                        i += 1
                    i += 1
                    out.append("/ /")
                    continue

            out.append(char)
            i += 1

        code_lines.append("".join(out))

    masked.code_lines = code_lines
    return masked


def strip_block_comments_deep(lines: list[str]) -> list[str]:
    """Fallback helper for languages with ``/* ... */`` spanning many lines."""
    inside = False
    result: list[str] = []
    for line in lines:
        if inside:
            end = line.find("*/")
            if end == -1:
                result.append("")
                continue
            inside = False
            line = " " * (end + 2) + line[end + 2:]
        while "/*" in line:
            start = line.find("/*")
            end = line.find("*/", start + 2)
            if end == -1:
                line = line[:start]
                inside = True
                break
            line = line[:start] + " " * (end + 2 - start) + line[end + 2:]
        result.append(line)
    return result


def indent_level(line: str, width: int = 2) -> int:
    """Nesting depth from leading indentation (used for indentation-based languages)."""
    if not line.strip():
        return 0
    spaces = len(line) - len(line.lstrip(" \t"))
    tabs = line[: len(line) - len(line.lstrip("\t"))].count("\t")
    return tabs + spaces // max(1, width)


def count_params(param_text: str) -> int:
    depth = 0
    count = 0
    current_has_token = False
    for char in param_text:
        if char in "([{<":
            depth += 1
        elif char in ")]}>":
            depth -= 1
        elif char == "," and depth == 0:
            if current_has_token:
                count += 1
            current_has_token = False
            continue
        if not char.isspace():
            current_has_token = True
    if current_has_token:
        count += 1
    return count


def normalise_line(line: str) -> str:
    """Normalise a code line so near-identical duplicates compare equal."""
    stripped = re.sub(r"\s+", " ", line.strip())
    stripped = re.sub(r'"[^"]*"', '"S"', stripped)
    stripped = re.sub(r"'[^']*'", "'S'", stripped)
    stripped = re.sub(r"\b\d+\b", "N", stripped)
    return stripped
