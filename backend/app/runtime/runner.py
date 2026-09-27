"""Run the active file, safely enough for a learning environment.

Guard rails, in the order they matter:

1. **Separate process**, never ``exec`` inside the server — a crash or an infinite loop
   stays contained.
2. **Wall-clock timeout** plus (on POSIX) CPU and address-space rlimits, so a runaway
   loop or an accidental memory bomb dies instead of taking the machine down.
3. **Isolated interpreter** (``-I -B``): no user site-packages, no ``PYTHONPATH`` tricks,
   no ``.pyc`` litter, and a minimal environment so secrets in the parent process are not
   inherited.
4. **Temporary directory** as the working directory, with the file copied in — relative
   paths cannot wander into the repository.

This is a learning sandbox, not a security boundary: it is honest about that in the docs
and in the API response.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

from ..config import settings
from ..models import RunResult, new_id

SUPPORTED = {"python": "Python", "javascript": "Node.js", "typescript": "Node.js"}


class Runner:
    """Executes a source file in a throwaway directory."""

    def run_source(self, source: str, file_path: str, language: str = "python", stdin: str = "") -> RunResult:
        started = time.perf_counter()
        language = (language or "python").lower()

        if language not in SUPPORTED:
            return RunResult(
                id=new_id("run"),
                file_path=file_path,
                language=language,
                command="",
                exit_code=127,
                stdout="",
                stderr=f"Running {language} files is not supported by this sandbox yet.",
                duration_ms=round((time.perf_counter() - started) * 1000, 2),
            )

        if language == "python" and not settings.allow_execution:
            return RunResult(
                id=new_id("run"),
                file_path=file_path,
                language=language,
                command="",
                exit_code=126,
                stdout="",
                stderr="Execution is disabled (DRIPS_ALLOW_EXECUTION=0).",
                duration_ms=0.0,
            )

        with tempfile.TemporaryDirectory(prefix="drips-run-") as workdir:
            target = Path(workdir) / Path(file_path).name
            target.write_text(source, encoding="utf-8")

            if language == "python":
                command = [sys.executable, "-I", "-B", str(target)]
            else:
                node = shutil.which("node")
                if node is None:
                    return RunResult(
                        id=new_id("run"),
                        file_path=file_path,
                        language=language,
                        command="node",
                        exit_code=127,
                        stdout="",
                        stderr="Node.js is not installed in this environment, so JavaScript cannot be executed here.",
                        duration_ms=round((time.perf_counter() - started) * 1000, 2),
                    )
                command = [node, "--no-warnings", str(target)]

            try:
                completed = subprocess.run(
                    command,
                    cwd=workdir,
                    input=stdin,
                    capture_output=True,
                    text=True,
                    timeout=settings.execution_timeout,
                    env={
                        "PATH": os.environ.get("PATH", ""),
                        "LANG": "C.UTF-8",
                        "PYTHONIOENCODING": "utf-8",
                        "HOME": workdir,
                    },
                    preexec_fn=_limits(settings.execution_memory_mb),
                    check=False,
                )
                stdout, stderr, code, timed_out = completed.stdout, completed.stderr, completed.returncode, False
            except subprocess.TimeoutExpired as expired:
                stdout = (expired.stdout or b"").decode("utf-8", "replace") if isinstance(expired.stdout, bytes) else (expired.stdout or "")
                stderr = (
                    f"Stopped after {settings.execution_timeout:.0f}s. The usual causes are a loop whose "
                    "condition never becomes false, or waiting for input that never arrives."
                )
                code, timed_out = 124, True
            except OSError as error:
                stdout, stderr, code, timed_out = "", f"Could not start the process: {error}", 126, False

        duration = round((time.perf_counter() - started) * 1000, 2)
        result = RunResult(
            id=new_id("run"),
            file_path=file_path,
            language=language,
            command=" ".join(command),
            exit_code=code,
            stdout=stdout[-20000:],
            stderr=stderr[-20000:],
            duration_ms=duration,
            timed_out=timed_out,
            traceback_summary=_traceback_summary(stderr, code),
        )
        return result

    def run_command(self, args: list[str], cwd: str | None = None, timeout: float | None = None) -> RunResult:
        """Escape hatch used by tests (`pytest`, `npm test`)."""
        started = time.perf_counter()
        try:
            completed = subprocess.run(
                args,
                cwd=cwd,
                capture_output=True,
                text=True,
                timeout=timeout or settings.execution_timeout,
                check=False,
            )
            stdout, stderr, code = completed.stdout, completed.stderr, completed.returncode
        except FileNotFoundError:
            stdout, stderr, code = "", f"{args[0]} is not installed.", 127
        except subprocess.TimeoutExpired:
            stdout, stderr, code = "", "Command timed out.", 124
        return RunResult(
            id=new_id("run"),
            file_path=cwd or ".",
            language="shell",
            command=" ".join(args),
            exit_code=code,
            stdout=stdout[-20000:],
            stderr=stderr[-20000:],
            duration_ms=round((time.perf_counter() - started) * 1000, 2),
            traceback_summary=_traceback_summary(stderr, code),
        )


def _limits(memory_mb: int):
    """POSIX rlimits: CPU seconds and address space. No-op where unsupported."""
    try:
        import resource
    except ImportError:  # pragma: no cover - Windows
        return None

    def apply() -> None:  # pragma: no cover - runs in the child process
        try:
            cpu = int(settings.execution_timeout) + 1
            resource.setrlimit(resource.RLIMIT_CPU, (cpu, cpu + 1))
            if memory_mb:
                limit = memory_mb * 1024 * 1024
                resource.setrlimit(resource.RLIMIT_AS, (limit, limit))
            resource.setrlimit(resource.RLIMIT_NOFILE, (256, 256))
        except (ValueError, OSError):
            pass

    return apply


def _traceback_summary(stderr: str, code: int) -> str:
    if not stderr or code == 0:
        return ""
    lines = [line for line in stderr.strip().splitlines() if line.strip()]
    return lines[-1][:300] if lines else ""


runner = Runner()
