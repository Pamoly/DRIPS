"""A tiny, dependency-free HTTP router.

Deliberately small: path patterns (``/api/files/{path}``), JSON helpers, server-sent
events, and static file serving. This keeps the engine portable — no ASGI server, no
package installation, ``python3 -m backend.app.server`` and you are running.
"""

from __future__ import annotations

import json
import mimetypes
import re
import traceback
from dataclasses import dataclass, field
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Callable, Iterable
from urllib.parse import parse_qs, unquote, urlparse

Handler = Callable[..., Any]


@dataclass
class Request:
    """Everything a route handler needs, normalised."""

    method: str
    path: str
    params: dict[str, str] = field(default_factory=dict)
    query: dict[str, str] = field(default_factory=dict)
    headers: dict[str, str] = field(default_factory=dict)
    body: dict[str, Any] = field(default_factory=dict)
    raw_body: bytes = b""

    def q(self, key: str, default: str = "") -> str:
        return self.query.get(key, default)

    def j(self, key: str, default: Any = None) -> Any:
        return self.body.get(key, default)


class ApiError(Exception):
    """Raised by handlers to return a structured error with an HTTP status."""

    def __init__(self, message: str, status: int = 400, **extra: Any) -> None:
        super().__init__(message)
        self.message = message
        self.status = status
        self.extra = extra


@dataclass
class Response:
    status: int = 200
    body: Any = None
    content_type: str = "application/json; charset=utf-8"
    headers: dict[str, str] = field(default_factory=dict)

    @classmethod
    def ok(cls, body: Any = None) -> "Response":
        return cls(status=200, body=body)

    @classmethod
    def created(cls, body: Any = None) -> "Response":
        return cls(status=201, body=body)


class Router:
    """Pattern based router with a very small surface area."""

    def __init__(self) -> None:
        self._routes: list[tuple[str, re.Pattern[str], Handler]] = []

    def add(self, method: str, pattern: str, handler: Handler) -> None:
        regex = re.compile("^" + re.sub(r"\{(\w+)\}", r"(?P<\1>[^/]+)", pattern) + "$")
        self._routes.append((method.upper(), regex, handler))

    def route(self, method: str, pattern: str) -> Callable[[Handler], Handler]:
        def decorator(handler: Handler) -> Handler:
            self.add(method, pattern, handler)
            return handler

        return decorator

    def get(self, pattern: str) -> Callable[[Handler], Handler]:
        return self.route("GET", pattern)

    def post(self, pattern: str) -> Callable[[Handler], Handler]:
        return self.route("POST", pattern)

    def put(self, pattern: str) -> Callable[[Handler], Handler]:
        return self.route("PUT", pattern)

    def delete(self, pattern: str) -> Callable[[Handler], Handler]:
        return self.route("DELETE", pattern)

    def resolve(self, method: str, path: str) -> tuple[Handler | None, dict[str, str], int]:
        allowed = False
        for route_method, regex, handler in self._routes:
            match = regex.match(path)
            if not match:
                continue
            if route_method == method or (route_method == "GET" and method == "HEAD"):
                return handler, match.groupdict(), 200
            allowed = True
        return None, {}, 405 if allowed else 404

    def routes(self) -> list[tuple[str, str]]:
        return [(method, regex.pattern) for method, regex, _ in self._routes]


def sse_event(event: str, payload: dict[str, Any]) -> bytes:
    """Encode one server-sent event (NDJSON style payload, SSE framing)."""
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n".encode("utf-8")


def make_handler(router: Router, static_dir: str | None, cors_origin: str = "*"):
    """Build the ``BaseHTTPRequestHandler`` subclass bound to ``router``."""

    class DripsHandler(BaseHTTPRequestHandler):
        server_version = "DRIPS/1.0"
        protocol_version = "HTTP/1.1"

        # ------------------------------------------------------------- utilities
        def log_message(self, fmt: str, *args: Any) -> None:  # quieter logs
            if "?" in fmt:
                return
            super().log_message(fmt, *args)

        def _cors(self) -> None:
            self.send_header("Access-Control-Allow-Origin", cors_origin)
            self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Drips-Actor")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")

        def _read_body(self) -> tuple[dict[str, Any], bytes]:
            length = int(self.headers.get("Content-Length") or 0)
            if length <= 0:
                return {}, b""
            raw = self.rfile.read(length)
            if not raw:
                return {}, b""
            try:
                parsed = json.loads(raw.decode("utf-8"))
            except (json.JSONDecodeError, UnicodeDecodeError):
                return {}, raw
            return (parsed if isinstance(parsed, dict) else {"value": parsed}), raw

        # ------------------------------------------------------------- dispatch
        def _dispatch(self, method: str) -> None:
            parsed = urlparse(self.path)
            path = unquote(parsed.path)
            query = {k: v[0] for k, v in parse_qs(parsed.query).items()}
            headers = {k.lower(): v for k, v in self.headers.items()}

            if method == "OPTIONS":
                self.send_response(204)
                self._cors()
                self.send_header("Content-Length", "0")
                self.end_headers()
                return

            if not path.startswith("/api"):
                self._serve_static(path)
                return

            handler, params, status = router.resolve(method, path)
            if handler is None:
                self._send_json(
                    status,
                    {
                        "error": "not_found" if status == 404 else "method_not_allowed",
                        "path": path,
                        "hint": "GET /api/health lists every available endpoint.",
                    },
                )
                return

            body, raw = self._read_body()
            request = Request(
                method=method,
                path=path,
                params=params,
                query=query,
                headers=headers,
                body=body,
                raw_body=raw,
            )
            try:
                result = handler(request)
            except ApiError as exc:  # expected, structured failure
                self._send_json(exc.status, {"error": exc.message, **exc.extra})
                return
            except Exception as exc:  # unexpected — keep the server alive, report it
                self._send_json(
                    500,
                    {
                        "error": "internal_error",
                        "message": str(exc),
                        "traceback": traceback.format_exc().splitlines()[-6:],
                    },
                )
                return

            if isinstance(result, Response):
                if result.body is None:
                    self.send_response(result.status)
                    self._cors()
                    for key, value in result.headers.items():
                        self.send_header(key, value)
                    self.send_header("Content-Length", "0")
                    self.end_headers()
                else:
                    self._send_json(result.status, result.body, result.headers)
            elif isinstance(result, _Stream):
                self._send_stream(result)
            elif result is None:
                self._send_json(200, {"ok": True})
            else:
                self._send_json(200, result)

        # -------------------------------------------------------------- writers
        def _send_json(self, status: int, payload: Any, headers: dict[str, str] | None = None) -> None:
            data = json.dumps(payload, ensure_ascii=False, default=str).encode("utf-8")
            self.send_response(status)
            self._cors()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            for key, value in (headers or {}).items():
                self.send_header(key, value)
            self.end_headers()
            self.wfile.write(data)

        def _send_stream(self, stream: "_Stream") -> None:
            self.send_response(200)
            self._cors()
            self.send_header("Content-Type", "text/event-stream; charset=utf-8")
            self.send_header("Cache-Control", "no-cache, no-transform")
            self.send_header("Connection", "keep-alive")
            self.send_header("X-Accel-Buffering", "no")
            # no Content-Length: chunked encoding keeps tokens flowing immediately
            self.send_header("Transfer-Encoding", "chunked")
            self.end_headers()
            try:
                for chunk in stream.events:
                    self._write_chunk(chunk)
            except (BrokenPipeError, ConnectionResetError):
                return
            self._write_chunk(b"")
            self.wfile.write(b"0\r\n\r\n")
            self.wfile.flush()

        def _write_chunk(self, data: bytes) -> None:
            if not data:
                return
            self.wfile.write(f"{len(data):X}\r\n".encode("ascii"))
            self.wfile.write(data)
            self.wfile.write(b"\r\n")
            self.wfile.flush()

        def _serve_static(self, path: str) -> None:
            if not static_dir:
                self._send_json(
                    404,
                    {
                        "error": "frontend_not_built",
                        "hint": "Run `npm install && npm run build` in frontend/, or use the Vite dev server.",
                    },
                )
                return
            from pathlib import Path

            root = Path(static_dir)
            rel = path.lstrip("/") or "index.html"
            candidate = (root / rel).resolve()
            if root.resolve() not in candidate.parents and candidate != root.resolve():
                self._send_json(403, {"error": "forbidden"})
                return
            if not candidate.is_file():
                candidate = root / "index.html"  # SPA fallback
            if not candidate.is_file():
                self._send_json(404, {"error": "not_found"})
                return
            data = candidate.read_bytes()
            content_type = mimetypes.guess_type(str(candidate))[0] or "application/octet-stream"
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        # ------------------------------------------------------------ HTTP verbs
        def do_GET(self) -> None:  # noqa: N802
            self._dispatch("GET")

        def do_HEAD(self) -> None:  # noqa: N802
            self._dispatch("HEAD")

        def do_POST(self) -> None:  # noqa: N802
            self._dispatch("POST")

        def do_PUT(self) -> None:  # noqa: N802
            self._dispatch("PUT")

        def do_DELETE(self) -> None:  # noqa: N802
            self._dispatch("DELETE")

    return DripsHandler


@dataclass
class _Stream:
    """Marker wrapper so the handler knows to stream instead of buffering."""

    events: Iterable[bytes]


def stream(events: Iterable[bytes]) -> _Stream:
    return _Stream(events)


def serve(router: Router, host: str, port: int, static_dir: str | None, cors_origin: str = "*") -> ThreadingHTTPServer:
    handler = make_handler(router, static_dir, cors_origin)
    httpd = ThreadingHTTPServer((host, port), handler)
    httpd.daemon_threads = True
    return httpd


SERVICE_UNAVAILABLE = HTTPStatus.SERVICE_UNAVAILABLE
