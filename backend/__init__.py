"""DRIPS backend — an autonomous, human-supervised code editor engine.

The engine is intentionally dependency-free (Python standard library only) so the
whole product can be started with a single command:

    python3 -m backend.app.server --port 8000

It provides:

* ``/api/analysis``  — static intelligence: findings, metrics, health score
* ``/api/chat``      — the master assistant ("Mentor") with a streaming agent trace
* ``/api/patches``   — proposed fixes that require explicit human approval
* ``/api/reviews``   — human review requests, comments and decisions
* ``/api/runtime``   — sandboxed execution of the active file
* ``/api/learning``  — curriculum, exercises and skill progression
"""

__all__ = ["__version__"]

__version__ = "1.0.0"
