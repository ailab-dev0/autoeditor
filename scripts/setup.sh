#!/bin/bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# EditorLens MK-12 — First-Time Setup
# Run once after cloning: ./scripts/setup.sh
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  EditorLens MK-12 — Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── 1. Check Docker ──────────────────────────────
echo "🔍 Checking Docker..."
if ! command -v docker &>/dev/null; then
  echo "❌ Docker not found."
  echo ""
  if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "   Install Docker Desktop for Mac:"
    echo "   https://docs.docker.com/desktop/install/mac-install/"
    echo ""
    echo "   Or with Homebrew:"
    echo "   brew install --cask docker"
  elif [[ "$OSTYPE" == "linux"* ]]; then
    echo "   Install Docker Engine:"
    echo "   curl -fsSL https://get.docker.com | sh"
    echo "   sudo usermod -aG docker \$USER"
  fi
  echo ""
  echo "   After installing, run this script again."
  exit 1
fi
echo "✅ Docker found: $(docker --version)"

# Check Docker is running
if ! docker info &>/dev/null; then
  echo "❌ Docker is not running. Start Docker Desktop and try again."
  exit 1
fi
echo "✅ Docker is running"

# Check docker compose
if docker compose version &>/dev/null; then
  COMPOSE="docker compose"
elif command -v docker-compose &>/dev/null; then
  COMPOSE="docker-compose"
else
  echo "❌ docker compose not found. Install Docker Compose plugin."
  exit 1
fi
echo "✅ Compose found: $($COMPOSE version --short 2>/dev/null || echo 'available')"

# ── 2. Environment file ─────────────────────────
echo ""
echo "🔧 Setting up environment..."
if [ ! -f mk12-backend/.env ]; then
  cp .env.example mk12-backend/.env
  echo "✅ Created mk12-backend/.env from .env.example"
  echo ""
  echo "⚠️  IMPORTANT: Edit mk12-backend/.env and fill in:"
  echo "   - DATABASE_URL (Postgres/Neon connection string)"
  echo "   - OPENROUTER_API_KEY (for AI analysis)"
  echo "   - ASSEMBLYAI_API_KEY (for transcription)"
  echo "   - JWT_SECRET (random string for auth)"
  echo ""
  read -p "   Press Enter after editing .env, or Ctrl+C to do it later... "
else
  echo "✅ mk12-backend/.env already exists"
fi

# ── 3. Detect WiFi IP ────────────────────────────
echo ""
echo "🌐 Detecting network IP..."
if [[ "$OSTYPE" == "darwin"* ]]; then
  WIFI_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "")
elif [[ "$OSTYPE" == "linux"* ]]; then
  WIFI_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "")
fi

if [ -z "$WIFI_IP" ]; then
  WIFI_IP="localhost"
  echo "⚠️  Could not detect WiFi IP — using localhost"
else
  echo "✅ WiFi IP: $WIFI_IP"
fi

# Write dashboard env
cat > mk12-dashboard/.env.local <<EOF
BACKEND_URL=http://${WIFI_IP}:8000
NEXT_PUBLIC_API_URL=http://${WIFI_IP}:8000
NEXT_PUBLIC_WS_URL=ws://${WIFI_IP}:8000
EOF
echo "✅ Dashboard .env.local configured for $WIFI_IP"

# ── 4. Build Docker images ───────────────────────
echo ""
echo "🏗️  Building Docker images (this may take a few minutes)..."
export NEXT_PUBLIC_API_URL="http://${WIFI_IP}:8000"
export NEXT_PUBLIC_WS_URL="ws://${WIFI_IP}:8000"

$COMPOSE build --parallel 2>&1 | tail -5

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ Setup complete!"
echo ""
echo "  Start all services:  ./scripts/start.sh"
echo "  Stop all services:   ./scripts/stop.sh"
echo ""
echo "  Dashboard:  http://${WIFI_IP}:3000"
echo "  Backend:    http://${WIFI_IP}:8000"
echo "  MinIO:      http://${WIFI_IP}:9001"
echo "  Animation:  http://${WIFI_IP}:4200"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
