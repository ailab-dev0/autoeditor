#!/bin/bash
# ============================================================
# Stage 1 ONLY — Audio extraction + AssemblyAI transcription
# Tests: single video, multiple videos, audio file, mixed media
# AssemblyAI primary, Deepgram fallback
# ============================================================

set -e

API="http://localhost:8000"
EMAIL="dev@test.com"
PASS="devtest123"

# Test files
VIDEO_1="/Users/miles/Downloads/The_Sales_Intelligence_Revolution.mp4"
VIDEO_2="/Users/miles/Downloads/Video_Direction_AI_Sales_Intelligence-videos/scene-10.mp4"
VIDEO_3="/Users/miles/Downloads/Video_Direction_AI_Sales_Intelligence-videos/scene-7.mp4"
# Find an audio file
AUDIO_1=$(find ~/Downloads -maxdepth 1 -name "*.mp3" -size +50k 2>/dev/null | head -1)

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
pass() { echo -e "${GREEN}✓ $1${NC}"; }
fail() { echo -e "${RED}✗ $1${NC}"; exit 1; }
info() { echo -e "${CYAN}→ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠ $1${NC}"; }

echo ""
echo "============================================"
echo " Stage 1: Audio + Transcription Tests"
echo " AssemblyAI primary, Deepgram fallback"
echo "============================================"
echo ""

# ── Preflight ──────────────────────────────────────────────
info "Checking API keys in .env..."
AAIKEY=$(grep "^ASSEMBLYAI_API_KEY=" /Users/miles/dev/autoeditor/mk12-backend/.env 2>/dev/null | cut -d'=' -f2)
DGKEY=$(grep "^DEEPGRAM_API_KEY=" /Users/miles/dev/autoeditor/mk12-backend/.env 2>/dev/null | cut -d'=' -f2)
[ -n "$AAIKEY" ] && pass "AssemblyAI: ${AAIKEY:0:8}... (primary)" || warn "No AssemblyAI key"
[ -n "$DGKEY" ] && pass "Deepgram: ${DGKEY:0:8}... (fallback)" || warn "No Deepgram key"
[ -z "$AAIKEY" ] && [ -z "$DGKEY" ] && fail "No transcription API key set"

info "Checking backend..."
curl -s "$API/api/health" > /dev/null 2>&1 || fail "Backend not running"
pass "Backend up"

info "Checking FFmpeg..."
/opt/homebrew/bin/ffmpeg -version 2>/dev/null | head -1 > /dev/null && pass "FFmpeg available" || fail "FFmpeg not found"

info "Checking MinIO..."
node -e "
const { S3Client, HeadBucketCommand } = require('@aws-sdk/client-s3');
new S3Client({ endpoint: 'http://localhost:9000', region: 'us-east-1', credentials: { accessKeyId: 'minioadmin', secretAccessKey: 'minioadmin' }, forcePathStyle: true })
  .send(new HeadBucketCommand({ Bucket: 'editorlens' })).then(() => { console.log('ok'); process.exit(0); }).catch(() => { process.exit(1); });
" && pass "MinIO bucket exists" || fail "MinIO bucket missing"

info "Checking test files..."
[ -f "$VIDEO_1" ] && pass "Video 1: $(basename "$VIDEO_1") ($(ls -lh "$VIDEO_1" | awk '{print $5}'))" || fail "Video 1 missing"
[ -f "$VIDEO_2" ] && pass "Video 2: $(basename "$VIDEO_2") ($(ls -lh "$VIDEO_2" | awk '{print $5}'))" || warn "Video 2 missing — multi test uses 2 files"
[ -f "$VIDEO_3" ] && pass "Video 3: $(basename "$VIDEO_3") ($(ls -lh "$VIDEO_3" | awk '{print $5}'))" || warn "Video 3 missing"
[ -n "$AUDIO_1" ] && [ -f "$AUDIO_1" ] && pass "Audio: $(basename "$AUDIO_1") ($(ls -lh "$AUDIO_1" | awk '{print $5}'))" || warn "No MP3 found in Downloads — audio test skipped"

# Auth
TOKEN=$(curl -s "$API/api/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" 2>/dev/null | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])" 2>/dev/null)
[ -n "$TOKEN" ] && pass "Authenticated" || fail "Auth failed"

# Helper: run a pipeline test
run_pipeline_test() {
  local TEST_NAME="$1"
  local PROJECT_NAME="$2"
  shift 2
  local FILES=("$@")

  echo ""
  echo "--------------------------------------------"
  echo " $TEST_NAME"
  echo "--------------------------------------------"
  echo ""

  # Create project
  local PROJ=$(curl -s "$API/api/projects" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "{\"name\":\"$PROJECT_NAME\"}")
  local PID=$(echo "$PROJ" | python3 -c "import sys,json;print(json.load(sys.stdin)['project']['id'])" 2>/dev/null)
  [ -n "$PID" ] && pass "Project: $PID" || { echo -e "${RED}✗ Failed to create project${NC}"; return 1; }

  # Register files
  for f in "${FILES[@]}"; do
    curl -s "$API/api/projects/$PID/upload" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "{\"path\":\"$f\"}" > /dev/null
    pass "Registered: $(basename "$f")"
  done

  # Verify paths
  local PATH_COUNT=$(curl -s "$API/api/projects/$PID" -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json;p=json.load(sys.stdin);print(len(p.get('project',p).get('video_paths',[])))" 2>/dev/null)
  pass "video_paths: $PATH_COUNT files"

  # Start pipeline — STAGE 1 ONLY
  local START=$(curl -s "$API/api/projects/$PID/pipeline/start" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"stop_after_stage":"transcription"}')
  echo "$START" | python3 -c "import sys,json;d=json.load(sys.stdin);print(f\"  Status: {d.get('pipeline_status',{}).get('status','?')}\")" 2>/dev/null
  pass "Pipeline started (Stage 1 only)"

  # Poll until completed or error
  info "Polling (max 5 min)..."
  local STAGE1_DONE=0
  for i in $(seq 1 60); do
    sleep 5
    local STATUS=$(curl -s "$API/api/projects/$PID/pipeline/status" -H "Authorization: Bearer $TOKEN" 2>/dev/null)
    local STAGE=$(echo "$STATUS" | python3 -c "
import sys,json
d=json.load(sys.stdin)
ps=d.get('pipeline_status') or d
if ps:
  print(f\"{ps.get('status','?')} | {ps.get('current_stage','?')} | {ps.get('overall_progress',0)}%\")
else:
  print('no status')
" 2>/dev/null)
    echo -ne "\r  [$i/60] $STAGE          "

    if echo "$STAGE" | grep -qE "completed|ready"; then
      echo ""
      pass "Stage 1 complete"
      STAGE1_DONE=1
      break
    fi
    if echo "$STAGE" | grep -q "error"; then
      echo ""
      echo -e "${RED}✗ Pipeline error: $STAGE${NC}"
      grep "Pipeline failed" /tmp/mk12-backend.log | tail -1
      return 1
    fi
  done

  [ "$STAGE1_DONE" -eq 0 ] && { echo ""; echo -e "${RED}✗ Timed out${NC}"; return 1; }

  # Check MinIO files
  info "Checking MinIO..."
  local MINIO_OUT=$(node -e "
const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const c = new S3Client({ endpoint: 'http://localhost:9000', region: 'us-east-1', credentials: { accessKeyId: 'minioadmin', secretAccessKey: 'minioadmin' }, forcePathStyle: true });
c.send(new ListObjectsV2Command({ Bucket: 'editorlens', Prefix: 'projects/$PID/' })).then(r => {
  const files = r.Contents || [];
  const audio = files.filter(f => f.Key.includes('/audio/'));
  const trans = files.filter(f => f.Key.includes('/transcripts/'));
  const manifest = files.filter(f => f.Key.includes('manifest.json'));
  console.log('AUDIO:' + audio.length);
  console.log('TRANSCRIPTS:' + trans.length);
  console.log('MANIFEST:' + manifest.length);
  console.log('TOTAL:' + files.length);
  for (const f of files) console.log('  ' + f.Key + ' (' + (f.Size/1024).toFixed(1) + ' KB)');
}).catch(e => console.log('ERROR:' + e.message));
")
  echo "$MINIO_OUT" | grep "^  " # print file list

  local AUDIO_COUNT=$(echo "$MINIO_OUT" | grep "^AUDIO:" | cut -d: -f2)
  local TRANS_COUNT=$(echo "$MINIO_OUT" | grep "^TRANSCRIPTS:" | cut -d: -f2)
  local MANIFEST_COUNT=$(echo "$MINIO_OUT" | grep "^MANIFEST:" | cut -d: -f2)

  [ "$MANIFEST_COUNT" -gt 0 ] && pass "Manifest in MinIO" || echo -e "${RED}✗ No manifest${NC}"
  [ "$AUDIO_COUNT" -gt 0 ] && pass "Audio files in MinIO: $AUDIO_COUNT" || warn "No audio in MinIO"
  [ "$TRANS_COUNT" -gt 0 ] && pass "Transcripts in MinIO: $TRANS_COUNT" || warn "No transcripts in MinIO"

  # Check backend logs for transcription details
  info "Transcription results from backend log:"
  grep -E "\[audio:assemblyai\] Result:|\[audio:deepgram\] Done:|\[pipeline\] Stage 1 complete:" /tmp/mk12-backend.log | tail -5

  echo ""
  pass "$TEST_NAME — DONE"
}

# ══════════════════════════════════════════════════════════════
# Test 1: Single Video
# ══════════════════════════════════════════════════════════════
run_pipeline_test "Test 1: Single Video" "Stage1 Single Video" "$VIDEO_1"

# ══════════════════════════════════════════════════════════════
# Test 2: Multiple Videos (parallel transcription)
# ══════════════════════════════════════════════════════════════
MULTI_FILES=("$VIDEO_1")
[ -f "$VIDEO_2" ] && MULTI_FILES+=("$VIDEO_2")
[ -f "$VIDEO_3" ] && MULTI_FILES+=("$VIDEO_3")

if [ "${#MULTI_FILES[@]}" -gt 1 ]; then
  run_pipeline_test "Test 2: Multiple Videos (${#MULTI_FILES[@]} files, parallel)" "Stage1 Multi Video" "${MULTI_FILES[@]}"
else
  warn "Skipping Test 2 — only 1 video available"
fi

# ══════════════════════════════════════════════════════════════
# Test 3: Audio file (MP3 — no video extraction needed)
# ══════════════════════════════════════════════════════════════
if [ -n "$AUDIO_1" ] && [ -f "$AUDIO_1" ]; then
  run_pipeline_test "Test 3: Audio File (MP3)" "Stage1 Audio Only" "$AUDIO_1"
else
  warn "Skipping Test 3 — no MP3 file found in Downloads"
fi

# ══════════════════════════════════════════════════════════════
# Test 4: Mixed media (video + audio together)
# ══════════════════════════════════════════════════════════════
if [ -n "$AUDIO_1" ] && [ -f "$AUDIO_1" ] && [ -f "$VIDEO_1" ]; then
  MIXED_FILES=("$VIDEO_1" "$AUDIO_1")
  [ -f "$VIDEO_2" ] && MIXED_FILES+=("$VIDEO_2")
  run_pipeline_test "Test 4: Mixed Media (video + audio, ${#MIXED_FILES[@]} files)" "Stage1 Mixed Media" "${MIXED_FILES[@]}"
else
  warn "Skipping Test 4 — need both video and audio files"
fi

echo ""
echo "============================================"
echo " ALL STAGE 1 TESTS COMPLETE"
echo "============================================"
echo ""
