#!/usr/bin/env bash
# Start DRIPS: the engine (port 8000) and, when requested, the Vite dev server (3000).
#
#   ./start.sh            # engine only — the built UI is served on http://localhost:8000
#   ./start.sh --dev      # engine + Vite dev server with hot reload on http://localhost:3000
#   ./start.sh --install  # install frontend dependencies first
#
# The engine needs no dependencies at all; it runs on the Python standard library.
set -euo pipefail

cd "$(dirname "$0")"

PORT="${DRIPS_PORT:-8000}"
MODE="prod"

for arg in "$@"; do
  case "$arg" in
    --dev) MODE="dev" ;;
    --install) MODE="install" ;;
    -h|--help)
      sed -n '2,9p' "$0"
      exit 0
      ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required (3.10 or newer)." >&2
  exit 1
fi

if [ "$MODE" = "install" ] || [ "$MODE" = "dev" ]; then
  if [ ! -d frontend/node_modules ]; then
    echo "→ installing frontend dependencies (once)…"
    (cd frontend && npm install --no-audit --no-fund)
  fi
  if [ ! -d frontend/dist ] || [ "$MODE" = "dev" ]; then
    echo "→ building the editor UI…"
    (cd frontend && npm run build)
  fi
fi

if [ "$MODE" = "install" ]; then
  echo "→ done. Run ./start.sh to launch."
  exit 0
fi

cleanup() {
  echo
  echo "→ stopping…"
  [ -n "${ENGINE_PID:-}" ] && kill "$ENGINE_PID" 2>/dev/null || true
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "→ engine on http://localhost:${PORT}"
python3 -u -m backend.app.server --port "$PORT" &
ENGINE_PID=$!

if [ "$MODE" = "dev" ]; then
  echo "→ editor UI (hot reload) on http://localhost:3000"
  (cd frontend && DRIPS_ENGINE_URL="http://127.0.0.1:${PORT}" npm run dev)
else
  echo "→ open http://localhost:${PORT}"
  wait "$ENGINE_PID"
fi
