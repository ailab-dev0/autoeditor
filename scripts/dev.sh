#!/bin/bash
set -e

# ─────────────────────────────────────────────
# EditorLens MK-12 — Local Development Launcher
# Starts all services in development mode.
# Neo4j is assumed to be running locally.
# ─────────────────────────────────────────────

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

cleanup() {
    echo ""
    echo "Shutting down all services..."
    kill 0
    wait
    echo "All services stopped."
}
trap cleanup EXIT INT TERM

echo "╔══════════════════════════════════════╗"
echo "║   EditorLens MK-12 — Dev Launcher   ║"
echo "╚══════════════════════════════════════╝"
echo ""

echo "Starting MK-12 Backend..."
(cd mk12-backend && npx tsx watch src/server.ts) &

echo "Starting MK-12 Dashboard..."
(cd mk12-dashboard && NODE_OPTIONS="--localstorage-file=$ROOT/.next-localstorage" npx next dev) &

echo "Starting MK-12 Animation Engine..."
(cd mk12-animation-engine && npx tsx watch src/api/server.ts) &

echo ""
echo "All services starting..."
echo "  Backend:   http://localhost:8000"
echo "  Dashboard: http://localhost:3000"
echo "  Animation: http://localhost:4200"
echo "  Neo4j:     http://localhost:7474"
echo ""
echo "Press Ctrl+C to stop all services."

wait
