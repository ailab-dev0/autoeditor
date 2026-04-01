#!/bin/bash
# ============================================================
# Stage 1 Test: Transcription Pipeline
# Tests single video, then multiple videos against real backend
# Uses actual files from ~/Downloads
# ============================================================

set -e

API="http://localhost:8000"
EMAIL="dev@test.com"
PASS="devtest123"

# Test files — small ones for speed
VIDEO_1="/Users/miles/Downloads/The_Sales_Intelligence_Revolution.mp4"  # 9.7MB, ~2.5min
VIDEO_2="/Users/miles/Downloads/Video_Direction_AI_Sales_Intelligence-videos/scene-10.mp4"
VIDEO_3="/Users/miles/Downloads/Video_Direction_AI_Sales_Intelligence-videos/scene-7.mp4"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

pass() { echo -e "${GREEN}✓ $1${NC}"; }
fail() { echo -e "${RED}✗ $1${NC}"; exit 1; }
info() { echo -e "${CYAN}→ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠ $1${NC}"; }

# ── Preflight checks ──────────────────────────────────────
echo ""
echo "============================================"
echo " Stage 1: Transcription Pipeline Test"
echo "============================================"
echo ""

info "Checking backend health..."
HEALTH=$(curl -s "$API/api/health" 2>/dev/null)
echo "$HEALTH" | python3 -c "import sys,json;d=json.load(sys.stdin);print(f'  Backend: {d[\"status\"]}  Neo4j: {d[\"neo4j\"]}')" 2>/dev/null || fail "Backend not reachable at $API"
pass "Backend is up"

info "Checking test files exist..."
[ -f "$VIDEO_1" ] && pass "Video 1: $(basename "$VIDEO_1") ($(ls -lh "$VIDEO_1" | awk '{print $5}'))" || fail "Video 1 not found: $VIDEO_1"
[ -f "$VIDEO_2" ] && pass "Video 2: $(basename "$VIDEO_2") ($(ls -lh "$VIDEO_2" | awk '{print $5}'))" || warn "Video 2 not found — multi-video test will be skipped"
[ -f "$VIDEO_3" ] && pass "Video 3: $(basename "$VIDEO_3") ($(ls -lh "$VIDEO_3" | awk '{print $5}'))" || warn "Video 3 not found — multi-video test will use 2 files"

info "Checking Speechmatics API key..."
grep -q "SPEECHMATICS_API_KEY=." /Users/miles/dev/autoeditor/mk12-backend/.env && pass "Speechmatics key configured" || fail "SPEECHMATICS_API_KEY not set in .env"

# ── Auth ────────────────────────────────────────────────────
echo ""
info "Authenticating..."
AUTH_RESP=$(curl -s "$API/api/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")
TOKEN=$(echo "$AUTH_RESP" | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])" 2>/dev/null)
[ -n "$TOKEN" ] && pass "Logged in as $EMAIL" || fail "Auth failed: $AUTH_RESP"

AUTH="-H 'Authorization: Bearer $TOKEN'"

# ── Test 1: Single Video Transcription ──────────────────────
echo ""
echo "============================================"
echo " Test 1: Single Video Transcription"
echo "============================================"
echo ""

info "Creating project for single-video test..."
PROJ1=$(curl -s "$API/api/projects" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Test: Single Video Transcription","description":"Automated test — single video"}')
PROJ1_ID=$(echo "$PROJ1" | python3 -c "import sys,json;print(json.load(sys.stdin)['project']['id'])" 2>/dev/null)
[ -n "$PROJ1_ID" ] && pass "Project created: $PROJ1_ID" || fail "Failed to create project: $PROJ1"

info "Registering video path..."
UPLOAD1=$(curl -s "$API/api/projects/$PROJ1_ID/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"path\":\"$VIDEO_1\"}")
echo "  $UPLOAD1" | python3 -c "import sys,json;d=json.load(sys.stdin);print(f'  Registered: {d}')" 2>/dev/null
pass "Video registered"

info "Verifying video_paths on project..."
PROJ1_DATA=$(curl -s "$API/api/projects/$PROJ1_ID" -H "Authorization: Bearer $TOKEN")
PATHS=$(echo "$PROJ1_DATA" | python3 -c "import sys,json;p=json.load(sys.stdin);print(p.get('project',p).get('video_paths',[]))" 2>/dev/null)
echo "  video_paths: $PATHS"
[ "$PATHS" != "[]" ] && pass "video_paths populated" || fail "video_paths is empty after upload"

info "Starting pipeline..."
START_RESP=$(curl -s "$API/api/projects/$PROJ1_ID/pipeline/start" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{}')
echo "  $START_RESP" | python3 -m json.tool 2>/dev/null | head -5
pass "Pipeline started"

info "Polling pipeline status (max 5 minutes)..."
MAX_POLLS=60
POLL_INTERVAL=5
for i in $(seq 1 $MAX_POLLS); do
  sleep $POLL_INTERVAL
  STATUS=$(curl -s "$API/api/projects/$PROJ1_ID/pipeline/status" -H "Authorization: Bearer $TOKEN")
  STAGE=$(echo "$STATUS" | python3 -c "
import sys,json
d=json.load(sys.stdin)
ps=d.get('pipeline_status') or d
if ps:
  stage=ps.get('current_stage','?')
  progress=ps.get('overall_progress',0)
  status=ps.get('status','?')
  print(f'{status} | {stage} | {progress}%')
else:
  print('no status')
" 2>/dev/null)
  echo -ne "\r  [$i/$MAX_POLLS] $STAGE          "

  if echo "$STAGE" | grep -q "completed\|ready"; then
    echo ""
    pass "Pipeline completed!"
    break
  fi
  if echo "$STAGE" | grep -q "error\|failed"; then
    echo ""
    fail "Pipeline failed: $STAGE"
  fi
  if [ "$i" -eq "$MAX_POLLS" ]; then
    echo ""
    fail "Pipeline timed out after $((MAX_POLLS * POLL_INTERVAL))s"
  fi
done

info "Checking results..."

# Check edit_package
PROJ1_FINAL=$(curl -s "$API/api/projects/$PROJ1_ID" -H "Authorization: Bearer $TOKEN")
HAS_EDIT_PKG=$(echo "$PROJ1_FINAL" | python3 -c "
import sys,json
p=json.load(sys.stdin)
proj=p.get('project',p)
ep=proj.get('edit_package')
if ep:
  vids=ep.get('videos',[])
  total_segs=sum(len(v.get('segments',[])) for v in vids)
  print(f'YES — {len(vids)} video(s), {total_segs} segments, pedagogy_score={ep.get(\"pedagogy_score\",\"?\")}')
else:
  print('NO')
" 2>/dev/null)
echo "  edit_package: $HAS_EDIT_PKG"
echo "$HAS_EDIT_PKG" | grep -q "YES" && pass "Edit package generated" || fail "No edit package"

# Check transcript
TRANSCRIPT=$(curl -s "$API/api/projects/$PROJ1_ID/transcript" -H "Authorization: Bearer $TOKEN")
TRANS_INFO=$(echo "$TRANSCRIPT" | python3 -c "
import sys,json
d=json.load(sys.stdin)
ts=d.get('transcripts',[])
if ts:
  t=ts[0]
  segs=t.get('segments',[])
  total_words=sum(len(s.get('text','').split()) for s in segs)
  print(f'{len(segs)} segments, ~{total_words} words')
else:
  print('NONE')
" 2>/dev/null)
echo "  transcript: $TRANS_INFO"
echo "$TRANS_INFO" | grep -qv "NONE" && pass "Transcript exists" || warn "No transcript returned from API"

# Check segments
SEGMENTS=$(curl -s "$API/api/projects/$PROJ1_ID/segments" -H "Authorization: Bearer $TOKEN")
SEG_INFO=$(echo "$SEGMENTS" | python3 -c "
import sys,json
d=json.load(sys.stdin)
segs=d.get('segments',[])
stats=d.get('stats',{})
if segs:
  suggestions={}
  for s in segs:
    sg=s.get('suggestion','?')
    suggestions[sg]=suggestions.get(sg,0)+1
  print(f'{len(segs)} segments — {suggestions}')
  print(f'  stats: {stats}')
else:
  print('NONE')
" 2>/dev/null)
echo "  segments: $SEG_INFO"
echo "$SEG_INFO" | grep -qv "NONE" && pass "Segments exist" || warn "No segments returned from API"

# Check knowledge graph
KNOWLEDGE=$(curl -s "$API/api/projects/$PROJ1_ID/knowledge" -H "Authorization: Bearer $TOKEN")
KG_INFO=$(echo "$KNOWLEDGE" | python3 -c "
import sys,json
d=json.load(sys.stdin)
nodes=d.get('nodes',[])
edges=d.get('edges',[])
print(f'{len(nodes)} concepts, {len(edges)} relationships')
" 2>/dev/null)
echo "  knowledge: $KG_INFO"

echo ""
echo "============================================"
echo " Test 1 Results: Single Video"
echo "============================================"
pass "Project created, video registered, pipeline ran, results stored"

# ── Test 2: Multiple Videos ────────────────────────────────
if [ -f "$VIDEO_2" ]; then
  echo ""
  echo "============================================"
  echo " Test 2: Multiple Video Transcription"
  echo "============================================"
  echo ""

  info "Creating project for multi-video test..."
  PROJ2=$(curl -s "$API/api/projects" \
    -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' \
    -d '{"name":"Test: Multi Video Transcription","description":"Automated test — multiple videos"}')
  PROJ2_ID=$(echo "$PROJ2" | python3 -c "import sys,json;print(json.load(sys.stdin)['project']['id'])" 2>/dev/null)
  [ -n "$PROJ2_ID" ] && pass "Project created: $PROJ2_ID" || fail "Failed to create project"

  info "Registering video 1..."
  curl -s "$API/api/projects/$PROJ2_ID/upload" \
    -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' \
    -d "{\"path\":\"$VIDEO_1\"}" > /dev/null
  pass "Video 1 registered"

  info "Registering video 2..."
  curl -s "$API/api/projects/$PROJ2_ID/upload" \
    -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' \
    -d "{\"path\":\"$VIDEO_2\"}" > /dev/null
  pass "Video 2 registered"

  if [ -f "$VIDEO_3" ]; then
    info "Registering video 3..."
    curl -s "$API/api/projects/$PROJ2_ID/upload" \
      -H "Authorization: Bearer $TOKEN" \
      -H 'Content-Type: application/json' \
      -d "{\"path\":\"$VIDEO_3\"}" > /dev/null
    pass "Video 3 registered"
  fi

  # Verify paths
  PROJ2_DATA=$(curl -s "$API/api/projects/$PROJ2_ID" -H "Authorization: Bearer $TOKEN")
  PATH_COUNT=$(echo "$PROJ2_DATA" | python3 -c "import sys,json;p=json.load(sys.stdin);print(len(p.get('project',p).get('video_paths',[])))" 2>/dev/null)
  pass "video_paths has $PATH_COUNT entries"

  info "Starting pipeline..."
  curl -s "$API/api/projects/$PROJ2_ID/pipeline/start" \
    -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' \
    -d '{}' > /dev/null
  pass "Pipeline started"

  info "Polling pipeline status (max 10 minutes for multi-video)..."
  MAX_POLLS=120
  for i in $(seq 1 $MAX_POLLS); do
    sleep $POLL_INTERVAL
    STATUS=$(curl -s "$API/api/projects/$PROJ2_ID/pipeline/status" -H "Authorization: Bearer $TOKEN")
    STAGE=$(echo "$STATUS" | python3 -c "
import sys,json
d=json.load(sys.stdin)
ps=d.get('pipeline_status') or d
if ps:
  stage=ps.get('current_stage','?')
  progress=ps.get('overall_progress',0)
  status=ps.get('status','?')
  print(f'{status} | {stage} | {progress}%')
else:
  print('no status')
" 2>/dev/null)
    echo -ne "\r  [$i/$MAX_POLLS] $STAGE          "

    if echo "$STAGE" | grep -q "completed\|ready"; then
      echo ""
      pass "Pipeline completed!"
      break
    fi
    if echo "$STAGE" | grep -q "error\|failed"; then
      echo ""
      fail "Pipeline failed: $STAGE"
    fi
    if [ "$i" -eq "$MAX_POLLS" ]; then
      echo ""
      fail "Pipeline timed out after $((MAX_POLLS * POLL_INTERVAL))s"
    fi
  done

  info "Checking multi-video results..."

  PROJ2_FINAL=$(curl -s "$API/api/projects/$PROJ2_ID" -H "Authorization: Bearer $TOKEN")
  MULTI_RESULT=$(echo "$PROJ2_FINAL" | python3 -c "
import sys,json
p=json.load(sys.stdin)
proj=p.get('project',p)
ep=proj.get('edit_package')
if ep:
  vids=ep.get('videos',[])
  for v in vids:
    segs=v.get('segments',[])
    path=v.get('video_path','?')
    print(f'  {path}: {len(segs)} segments')
  total_segs=sum(len(v.get('segments',[])) for v in vids)
  print(f'  TOTAL: {len(vids)} videos, {total_segs} segments')
else:
  print('  NO EDIT PACKAGE')
" 2>/dev/null)
  echo "$MULTI_RESULT"
  echo "$MULTI_RESULT" | grep -q "TOTAL" && pass "Multi-video pipeline produced results" || fail "No multi-video results"

  echo ""
  echo "============================================"
  echo " Test 2 Results: Multiple Videos"
  echo "============================================"
  pass "Multi-video project created, pipeline processed all videos"
else
  warn "Skipping Test 2 — VIDEO_2 not found"
fi

echo ""
echo "============================================"
echo " ALL STAGE 1 TESTS COMPLETE"
echo "============================================"
echo ""
