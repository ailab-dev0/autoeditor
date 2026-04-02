#!/bin/sh
# EditorLens Backend — Docker Entrypoint
# Validates required environment variables before starting the server.
# Supports .env file at /app/.env (mounted via volume or copied manually).

set -e

# ── Load .env file if it exists (supports mounting or manual copy) ──
if [ -f /app/.env ]; then
  echo "[entrypoint] Loading .env file..."
  export $(grep -v '^#' /app/.env | grep -v '^\s*$' | xargs)
fi

# Also check common mount points
if [ -f /config/.env ]; then
  echo "[entrypoint] Loading /config/.env..."
  export $(grep -v '^#' /config/.env | grep -v '^\s*$' | xargs)
fi

# ── Validate required vars ──
MISSING=""

if [ -z "$DATABASE_URL" ]; then
  MISSING="$MISSING DATABASE_URL"
fi

if [ -z "$JWT_SECRET" ]; then
  # Auto-generate if not set (dev convenience)
  export JWT_SECRET="editorlens-auto-$(head -c 16 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9')"
  echo "[entrypoint] WARNING: JWT_SECRET not set — auto-generated (not persistent across restarts)"
fi

if [ -z "$MINIO_ENDPOINT" ]; then
  export MINIO_ENDPOINT="http://minio:9000"
  echo "[entrypoint] MINIO_ENDPOINT defaulting to http://minio:9000"
fi

if [ -z "$MINIO_ACCESS_KEY" ]; then
  export MINIO_ACCESS_KEY="minioadmin"
fi

if [ -z "$MINIO_SECRET_KEY" ]; then
  export MINIO_SECRET_KEY="minioadmin"
fi

if [ -z "$MINIO_BUCKET" ]; then
  export MINIO_BUCKET="editorlens"
fi

# ── Report status ──
echo ""
echo "┌──────────────────────────────────────────────┐"
echo "│  EditorLens MK-12 — Environment Check        │"
echo "├──────────────────────────────────────────────┤"
echo "│  DATABASE_URL:     $([ -n "$DATABASE_URL" ] && echo '✅ set' || echo '❌ MISSING')"
echo "│  OPENROUTER_API_KEY: $([ -n "$OPENROUTER_API_KEY" ] && echo '✅ set' || echo '⚠️  not set (pipeline disabled)')"
echo "│  ASSEMBLYAI_API_KEY: $([ -n "$ASSEMBLYAI_API_KEY" ] && echo '✅ set' || echo '⚠️  not set (transcription disabled)')"
echo "│  MINIO_ENDPOINT:   $MINIO_ENDPOINT"
echo "│  JWT_SECRET:       $([ -n "$JWT_SECRET" ] && echo '✅ set' || echo '❌ MISSING')"
echo "└──────────────────────────────────────────────┘"
echo ""

if [ -n "$MISSING" ]; then
  echo "❌ Missing required environment variables:$MISSING"
  echo ""
  echo "   Fix options:"
  echo "   1. Create mk12-backend/.env with your values"
  echo "   2. Mount .env as volume: -v /path/to/.env:/app/.env"
  echo "   3. Pass via docker run: -e DATABASE_URL=... -e JWT_SECRET=..."
  echo "   4. Set in docker-compose.yml environment: section"
  echo ""
  exit 1
fi

# ── Start the server ──
exec npx tsx src/server.ts
