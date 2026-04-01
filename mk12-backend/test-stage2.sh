#!/bin/bash
# ============================================================
# Stage 2: Content Flow Analysis (Creative Director)
# Tests with single video AND multi-media (video + audio)
# ============================================================

set -e

API="http://localhost:8000"
EMAIL="dev@test.com"
PASS="devtest123"
VIDEO_1="/Users/miles/Downloads/The_Sales_Intelligence_Revolution.mp4"
VIDEO_2="/Users/miles/Downloads/Video_Direction_AI_Sales_Intelligence-videos/scene-10.mp4"
AUDIO_1=$(find ~/Downloads -maxdepth 1 -name "*.mp3" -size +50k 2>/dev/null | head -1)
IMAGE_1=$(find ~/Downloads -maxdepth 1 -type f \( -name "*.png" -o -name "*.jpg" \) -size +10k 2>/dev/null | head -1)

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
pass() { echo -e "${GREEN}✓ $1${NC}"; }
fail() { echo -e "${RED}✗ $1${NC}"; exit 1; }
info() { echo -e "${CYAN}→ $1${NC}"; }

check_flow() {
  local PID="$1"
  local TEST_NAME="$2"

  echo ""
  info "Checking MinIO for content flow ($TEST_NAME)..."
  node -e "
const { S3Client, GetObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const c = new S3Client({ endpoint: 'http://localhost:9000', region: 'us-east-1', credentials: { accessKeyId: 'minioadmin', secretAccessKey: 'minioadmin' }, forcePathStyle: true });

async function main() {
  const list = await c.send(new ListObjectsV2Command({ Bucket: 'editorlens', Prefix: 'projects/$PID/' }));
  console.log('FILES:');
  for (const f of (list.Contents || [])) console.log('  ' + f.Key + ' (' + (f.Size/1024).toFixed(1) + ' KB)');

  const obj = await c.send(new GetObjectCommand({ Bucket: 'editorlens', Key: 'projects/$PID/content-flow.json' }));
  const body = await obj.Body.transformToString();
  const flow = JSON.parse(body);

  console.log('');
  console.log('STATS:');
  console.log('  Segments: ' + flow.segments.length);
  console.log('  Topics: ' + flow.topics.length);
  console.log('  Chapters: ' + flow.chapters.length);
  console.log('  Heatmap: ' + flow.heatmap.length + ' points');
  console.log('  CrossMedia: ' + flow.crossMediaLinks.length);
  console.log('  CutCandidates: ' + flow.stats.cutCandidates);
  console.log('  KeepCandidates: ' + flow.stats.keepCandidates);

  console.log('');
  console.log('TOPICS:');
  for (const t of flow.topics.slice(0, 8)) {
    console.log('  [imp=' + t.importance + '] ' + t.name + ' (' + t.segments.length + ' segs)');
  }

  console.log('');
  console.log('CHAPTERS:');
  for (const ch of flow.chapters.slice(0, 8)) {
    console.log('  [' + ch.startTime.toFixed(1) + 's-' + ch.endTime.toFixed(1) + 's] ' + ch.name + ' (' + ch.pedagogyPhase + ')');
  }

  console.log('');
  console.log('PEDAGOGY:');
  for (const p of flow.pedagogy.phases.slice(0, 10)) {
    console.log('  ' + p.phase + ' (' + p.segments.length + ' segs)');
  }
  if (flow.pedagogy.concepts.length > 0) {
    console.log('  Concepts: ' + flow.pedagogy.concepts.map(c => c.name).join(', '));
  }

  console.log('');
  console.log('SEGMENTS (first 8):');
  for (const s of flow.segments.slice(0, 8)) {
    const time = s.start !== null ? '[' + s.start.toFixed(1) + 's-' + s.end.toFixed(1) + 's]' : '[image]';
    const file = s.mediaPath.split('/').pop();
    const cut = s.hard_cut_before ? ' HARDCUT' : '';
    const vis = s.visual_scene ? ' eye=' + s.visual_scene : '';
    console.log('  ' + time + ' ' + s.role.padEnd(12) + ' imp=' + s.importance + ' conf=' + s.confidence.toFixed(2) + cut + vis);
    console.log('    topic: ' + s.topic);
    if (s.text) console.log('    text: ' + JSON.stringify(s.text.slice(0, 80)));
    if (s.placement) console.log('    placement: ' + s.placement);
  }

  if (flow.crossMediaLinks.length > 0) {
    console.log('');
    console.log('CROSS-MEDIA:');
    for (const link of flow.crossMediaLinks) {
      console.log('  ' + link.relationship + ': ' + link.reason);
    }
  }

  // Validation
  console.log('');
  console.log('VALID:' + (flow.segments.length > 1 ? 'YES' : 'NO'));
}
main().catch(e => console.log('ERROR: ' + e.message));
  "
}

run_test() {
  local TEST_NAME="$1"
  local PROJECT_NAME="$2"
  shift 2
  local FILES=("$@")

  echo ""
  echo "============================================"
  echo " $TEST_NAME"
  echo "============================================"
  echo ""

  # Create project
  local PROJ=$(curl -s "$API/api/projects" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
    -d "{\"name\":\"$PROJECT_NAME\",\"brief\":\"An explainer about sales intelligence and data-driven selling\"}")
  local PID=$(echo "$PROJ" | python3 -c "import sys,json;print(json.load(sys.stdin)['project']['id'])" 2>/dev/null)
  pass "Project: $PID"

  for f in "${FILES[@]}"; do
    curl -s "$API/api/projects/$PID/upload" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "{\"path\":\"$f\"}" > /dev/null
    pass "Registered: $(basename "$f")"
  done

  # Start pipeline — Stage 1 + 2
  curl -s "$API/api/projects/$PID/pipeline/start" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
    -d '{"stop_after_stage":"knowledge_graph"}' > /dev/null
  pass "Pipeline started (Stage 1+2)"

  # Poll
  info "Polling (max 5 min)..."
  for i in $(seq 1 60); do
    sleep 5
    local STATUS=$(curl -s "$API/api/projects/$PID/pipeline/status" -H "Authorization: Bearer $TOKEN" 2>/dev/null)
    local STAGE=$(echo "$STATUS" | python3 -c "
import sys,json
d=json.load(sys.stdin)
ps=d.get('pipeline_status') or d
if ps: print(f\"{ps.get('status','?')} | {ps.get('current_stage','?')} | {ps.get('overall_progress',0)}%\")
else: print('no status')
" 2>/dev/null)
    echo -ne "\r  [$i/60] $STAGE          "

    if echo "$STAGE" | grep -qE "completed|ready"; then
      echo ""
      pass "Pipeline completed"
      break
    fi
    if echo "$STAGE" | grep -q "error"; then
      echo ""
      echo -e "${RED}✗ Pipeline error${NC}"
      grep "Pipeline failed" /tmp/mk12-backend.log | tail -1
      return 1
    fi
  done

  check_flow "$PID" "$TEST_NAME"

  local RESULT=$(node -e "
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const c = new S3Client({ endpoint: 'http://localhost:9000', region: 'us-east-1', credentials: { accessKeyId: 'minioadmin', secretAccessKey: 'minioadmin' }, forcePathStyle: true });
c.send(new GetObjectCommand({ Bucket: 'editorlens', Key: 'projects/$PID/content-flow.json' }))
  .then(async r => { const f = JSON.parse(await r.Body.transformToString()); console.log(f.segments.length > 1 ? 'PASS' : 'FAIL'); })
  .catch(() => console.log('FAIL'));
  ")

  [ "$RESULT" = "PASS" ] && pass "$TEST_NAME — PASSED" || echo -e "${RED}✗ $TEST_NAME — FAILED (only ${RESULT} segments)${NC}"
}

# ── Preflight ──────────────────────────────────────────────
echo ""
echo "============================================"
echo " Stage 2: Content Flow Analysis Tests"
echo "============================================"
echo ""

ORKEY=$(grep "^OPENROUTER_API_KEY=" /Users/miles/dev/autoeditor/mk12-backend/.env 2>/dev/null | cut -d'=' -f2)
[ -n "$ORKEY" ] && pass "OpenRouter key found" || fail "No OPENROUTER_API_KEY"
curl -s "$API/api/health" > /dev/null 2>&1 || fail "Backend not running"
pass "Backend up"

TOKEN=$(curl -s "$API/api/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])" 2>/dev/null)
[ -n "$TOKEN" ] && pass "Authenticated" || fail "Auth failed"

# Test 1: Single video
run_test "Test 1: Single Video" "Stage2 Single" "$VIDEO_1"

# Test 2: Multi-media (video + video + audio)
MULTI_FILES=("$VIDEO_1")
[ -f "$VIDEO_2" ] && MULTI_FILES+=("$VIDEO_2")
[ -n "$AUDIO_1" ] && [ -f "$AUDIO_1" ] && MULTI_FILES+=("$AUDIO_1")

if [ "${#MULTI_FILES[@]}" -gt 1 ]; then
  run_test "Test 2: Multi-Media (${#MULTI_FILES[@]} files)" "Stage2 Multi" "${MULTI_FILES[@]}"
fi

# Test 3: Video + Image (image analysis via Qwen vision)
if [ -n "$IMAGE_1" ] && [ -f "$IMAGE_1" ]; then
  run_test "Test 3: Video + Image (${IMAGE_1##*/})" "Stage2 Image" "$VIDEO_1" "$IMAGE_1"
fi

echo ""
echo "============================================"
echo " ALL STAGE 2 TESTS COMPLETE"
echo "============================================"
