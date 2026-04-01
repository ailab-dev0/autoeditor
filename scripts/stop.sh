#!/bin/bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# EditorLens MK-12 — Stop All Services
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo ""
echo "🔴 Stopping EditorLens services..."

# ── Stop local dev processes (if running) ────────
for pidfile in logs/.backend.pid logs/.dashboard.pid logs/.animation.pid; do
  if [ -f "$ROOT/$pidfile" ]; then
    PID=$(cat "$ROOT/$pidfile" 2>/dev/null)
    if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
      kill -15 "$PID" 2>/dev/null
      echo "   Stopped PID $PID ($(basename $pidfile .pid))"
    fi
    rm -f "$ROOT/$pidfile"
  fi
done

# Kill anything still on our ports
lsof -ti:8000 2>/dev/null | xargs kill -15 2>/dev/null || true
lsof -ti:3000 2>/dev/null | xargs kill -15 2>/dev/null || true
lsof -ti:4200 2>/dev/null | xargs kill -15 2>/dev/null || true

# ── Stop Docker containers ───────────────────────
if docker compose version &>/dev/null; then
  docker compose down 2>/dev/null
elif command -v docker-compose &>/dev/null; then
  docker-compose down 2>/dev/null
fi

# Also stop standalone MinIO if running
docker stop minio 2>/dev/null || true

sleep 1

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ All services stopped."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
