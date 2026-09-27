"""Start the DRIPS engine.

    python3 -m backend.app.server                 # http://localhost:8000
    python3 -m backend.app.server --port 8000     # explicit port
    python3 -m backend.app.server --reload-hint   # prints what to run for the UI

Serves the JSON/streaming API and, when ``frontend/dist`` exists, the built editor as
well — one process, one port, no proxy required.
"""

from __future__ import annotations

import argparse
import json
import socket
import sys
import webbrowser
from pathlib import Path

if __package__ in {None, ""}:  # allow `python backend/app/server.py`
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from backend.app import __version__
from backend.app.config import settings
from backend.app.router import serve
from backend.app.routes import build_router
from backend.app.store import store


def _free_port(preferred: int) -> int:
    """Return ``preferred`` when it can be bound, otherwise any free port.

    ``SO_REUSEADDR`` matters here: a port left in ``TIME_WAIT`` by a previous run is
    still usable by the server (``ThreadingHTTPServer`` sets the same flag), so probing
    without it would wrongly send the user to a random port after every restart.
    """
    with socket.socket() as probe:
        probe.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            probe.bind(("0.0.0.0", preferred))
            return preferred
        except OSError:
            pass
    with socket.socket() as probe:
        probe.bind(("0.0.0.0", 0))
        return probe.getsockname()[1]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="DRIPS — autonomous code editor engine")
    parser.add_argument("--host", default=settings.host, help="bind address (default 0.0.0.0)")
    parser.add_argument("--port", type=int, default=settings.port, help="port (default 8000)")
    parser.add_argument("--no-static", action="store_true", help="do not serve frontend/dist")
    parser.add_argument("--open", action="store_true", help="open a browser window")
    parser.add_argument("--status", action="store_true", help="print workspace status and exit")
    parser.add_argument("--json", action="store_true", help="machine-readable startup banner")
    args = parser.parse_args(argv)

    if args.status:
        print(json.dumps(store.health_overview(), indent=2))
        return 0

    static_dir = None if args.no_static else settings.frontend_dist
    if static_dir and not (Path(static_dir) / "index.html").is_file():
        static_dir = None

    port = _free_port(args.port)
    router = build_router()
    httpd = serve(router, args.host, port, str(static_dir) if static_dir else None, settings.cors_origin)
    reasoning = settings.describe()

    banner = {
        "service": "DRIPS engine",
        "version": __version__,
        "url": f"http://localhost:{port}",
        "api": f"http://localhost:{port}/api/health",
        "serving_ui": bool(static_dir),
        "files": [file.path for file in store.files.values()],
        "reasoning": reasoning,
    }

    if args.json:
        print(json.dumps(banner, indent=2))
    else:
        print(f"  DRIPS engine {__version__} → http://localhost:{port}")
        print(f"  API            : http://localhost:{port}/api/health")
        print(f"  Editor UI      : {'served from frontend/dist' if static_dir else 'run `npm run dev` in frontend/ (port 3000)'}")
        print(f"  Reasoning      : {reasoning['provider']} ({'LLM enabled' if reasoning['has_llm'] else 'offline, no API key needed'})")
        print(f"  Autonomy       : {store.autonomy}")
        print(f"  Workspace      : {len(store.files)} file(s) — {', '.join(file.path for file in store.files.values())[:90]}")
        print("  Human gate     : every change to a file waits for your approval in the Review tab", end="\n\n")

    if args.open:
        webbrowser.open(banner["url"])

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n  stopped — the workspace was saved to backend/data/workspace.json")
    finally:
        store.save()
        httpd.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
