#!/bin/bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# EditorLens MK-12 — Start All Services
# Usage: ./scripts/start.sh [--local]
#   --local: run without Docker (dev mode, requires node)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# ── Detect WiFi IP ───────────────────────────────
if [[ "$OSTYPE" == "darwin"* ]]; then
  WIFI_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "localhost")
elif [[ "$OSTYPE" == "linux"* ]]; then
  WIFI_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")
else
  WIFI_IP="localhost"
fi

# ── Local dev mode ───────────────────────────────
if [[ "$1" == "--local" ]]; then
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  EditorLens MK-12 — Starting (local dev mode)"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""

  # Start MinIO in Docker (always Docker — it's a server)
  echo "🟢 Starting MinIO..."
  docker start minio 2>/dev/null || \
    docker run -d --name minio -p 9000:9000 -p 9001:9001 \
      -v minio_data:/data \
      -e MINIO_ROOT_USER=minioadmin -e MINIO_ROOT_PASSWORD=minioadmin \
      minio/minio server /data --console-address ":9001" 2>/dev/null
  echo "✅ MinIO on :9000"

  # Kill any old processes on our ports
  lsof -ti:8000 2>/dev/null | xargs kill -9 2>/dev/null || true
  lsof -ti:3000 2>/dev/null | xargs kill -9 2>/dev/null || true
  lsof -ti:4200 2>/dev/null | xargs kill -9 2>/dev/null || true
  sleep 1

  # Update dashboard env with current IP
  cat > mk12-dashboard/.env.local <<EOF
BACKEND_URL=http://${WIFI_IP}:8000
NEXT_PUBLIC_API_URL=http://${WIFI_IP}:8000
NEXT_PUBLIC_WS_URL=ws://${WIFI_IP}:8000
EOF

  # Start services in background
  echo "🟢 Starting Backend..."
  cd "$ROOT/mk12-backend" && npx tsx src/server.ts > "$ROOT/logs/backend.log" 2>&1 &
  BACKEND_PID=$!
  echo "   PID: $BACKEND_PID"

  sleep 3

  echo "🟢 Starting Dashboard..."
  cd "$ROOT/mk12-dashboard" && npx next dev --port 3000 --hostname 0.0.0.0 > "$ROOT/logs/dashboard.log" 2>&1 &
  DASH_PID=$!
  echo "   PID: $DASH_PID"

  echo "🟢 Starting Animation Engine..."
  cd "$ROOT/mk12-animation-engine" && npx tsx src/api/server.ts > "$ROOT/logs/animation.log" 2>&1 &
  ANIM_PID=$!
  echo "   PID: $ANIM_PID"

  # Save PIDs for stop script
  mkdir -p "$ROOT/logs"
  echo "$BACKEND_PID" > "$ROOT/logs/.backend.pid"
  echo "$DASH_PID" > "$ROOT/logs/.dashboard.pid"
  echo "$ANIM_PID" > "$ROOT/logs/.animation.pid"

  sleep 3

  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  ✅ All services running (local dev mode)"
  echo ""
  echo "  Dashboard:  http://${WIFI_IP}:3000"
  echo "  Backend:    http://${WIFI_IP}:8000"
  echo "  Animation:  http://${WIFI_IP}:4200"
  echo "  MinIO:      http://${WIFI_IP}:9001"
  echo ""
  echo "  Logs:       tail -f logs/backend.log"
  echo "  Stop:       ./scripts/stop.sh"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  exit 0
fi

# ── Docker mode (default) ────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  EditorLens MK-12 — Starting (Docker)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check Docker is running
if ! docker info &>/dev/null; then
  echo "❌ Docker is not running. Start Docker Desktop first."
  exit 1
fi

# Ensure .env exists
if [ ! -f "$ROOT/mk12-backend/.env" ]; then
  echo "⚠️  mk12-backend/.env not found — creating from .env.example"
  cp "$ROOT/.env.example" "$ROOT/mk12-backend/.env"
  echo "❗ Edit mk12-backend/.env with your API keys before running pipeline"
fi

# Detect compose command
if docker compose version &>/dev/null; then
  COMPOSE="docker compose"
elif command -v docker-compose &>/dev/null; then
  COMPOSE="docker-compose"
else
  echo "❌ docker compose not found."
  exit 1
fi

# Update dashboard env
cat > mk12-dashboard/.env.local <<EOF
BACKEND_URL=http://${WIFI_IP}:8000
NEXT_PUBLIC_API_URL=http://${WIFI_IP}:8000
NEXT_PUBLIC_WS_URL=ws://${WIFI_IP}:8000
EOF

# Export for docker compose build args
export NEXT_PUBLIC_API_URL="http://${WIFI_IP}:8000"
export NEXT_PUBLIC_WS_URL="ws://${WIFI_IP}:8000"

echo "🚀 Starting all containers..."
$COMPOSE up -d --build 2>&1 | grep -v "^$"

echo ""
echo "⏳ Waiting for services to be healthy..."
sleep 10

# Check health
BACKEND_OK=$(curl -sf http://localhost:8000/api/health | grep -c '"ok"' 2>/dev/null || echo "0")
DASH_OK=$(curl -sf -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null || echo "000")

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$BACKEND_OK" = "1" ]; then
  echo "  ✅ Backend:    http://${WIFI_IP}:8000"
else
  echo "  ⏳ Backend:    http://${WIFI_IP}:8000 (starting...)"
fi
if [ "$DASH_OK" = "200" ]; then
  echo "  ✅ Dashboard:  http://${WIFI_IP}:3000"
else
  echo "  ⏳ Dashboard:  http://${WIFI_IP}:3000 (starting...)"
fi
echo "  🟢 MinIO:      http://${WIFI_IP}:9001"
echo "  🟢 Animation:  http://${WIFI_IP}:4200"
echo ""
echo "  Health:     http://${WIFI_IP}:8000/api/health"
echo "  Logs:       $COMPOSE logs -f"
echo "  Stop:       ./scripts/stop.sh"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
