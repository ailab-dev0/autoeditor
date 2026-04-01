#!/bin/bash
# ============================================================
# Stage 4A: Production Blueprint Test
# Runs Stage 1+2+3+4A, checks blueprint in MinIO
# ============================================================

set -e

API="http://localhost:8000"
EMAIL="dev@test.com"
PASS="devtest123"
VIDEO="/Users/miles/Downloads/The_Sales_Intelligence_Revolution.mp4"

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
pass() { echo -e "${GREEN}✓ $1${NC}"; }
fail() { echo -e "${RED}✗ $1${NC}"; exit 1; }
info() { echo -e "${CYAN}→ $1${NC}"; }

echo ""
echo "============================================"
echo " Stage 4A: Production Blueprint Test"
echo "============================================"
echo ""

curl -s "$API/api/health" > /dev/null 2>&1 || fail "Backend not running"
pass "Backend up"

TOKEN=$(curl -s "$API/api/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])" 2>/dev/null)
[ -n "$TOKEN" ] && pass "Authenticated" || fail "Auth failed"

PROJ=$(curl -s "$API/api/projects" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Stage 4A Blueprint Test","brief":"Explainer about sales intelligence evolution"}')
PID=$(echo "$PROJ" | python3 -c "import sys,json;print(json.load(sys.stdin)['project']['id'])" 2>/dev/null)
pass "Project: $PID"

curl -s "$API/api/projects/$PID/upload" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "{\"path\":\"$VIDEO\"}" > /dev/null
pass "Video registered"

# Run through Stage 4A
curl -s "$API/api/projects/$PID/pipeline/start" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"stop_after_stage":"director_decisions"}' > /dev/null
pass "Pipeline started (Stage 1-4A)"

info "Polling (max 8 min)..."
for i in $(seq 1 96); do
  sleep 5
  STATUS=$(curl -s "$API/api/projects/$PID/pipeline/status" -H "Authorization: Bearer $TOKEN" 2>/dev/null)
  STAGE=$(echo "$STATUS" | python3 -c "
import sys,json
d=json.load(sys.stdin)
ps=d.get('pipeline_status') or d
if ps: print(f\"{ps.get('status','?')} | {ps.get('current_stage','?')} | {ps.get('overall_progress',0)}%\")
else: print('no status')
" 2>/dev/null)
  echo -ne "\r  [$i/96] $STAGE          "
  echo "$STAGE" | grep -qE "completed|ready" && echo "" && pass "Pipeline completed" && break
  echo "$STAGE" | grep -q "error" && echo "" && grep "Pipeline failed" /tmp/mk12-backend.log | tail -1 && fail "Pipeline error"
done

# Check blueprint in MinIO
echo ""
info "Checking blueprint..."
node -e "
const { S3Client, GetObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const c = new S3Client({ endpoint: 'http://localhost:9000', region: 'us-east-1', credentials: { accessKeyId: 'minioadmin', secretAccessKey: 'minioadmin' }, forcePathStyle: true });

async function main() {
  const list = await c.send(new ListObjectsV2Command({ Bucket: 'editorlens', Prefix: 'projects/$PID/' }));
  console.log('FILES:');
  for (const f of (list.Contents || [])) console.log('  ' + f.Key + ' (' + (f.Size/1024).toFixed(1) + ' KB)');

  const obj = await c.send(new GetObjectCommand({ Bucket: 'editorlens', Key: 'projects/$PID/blueprint.json' }));
  const bp = JSON.parse(await obj.Body.transformToString());

  console.log('');
  console.log('STATS:');
  console.log('  Segments: ' + bp.stats.totalSegments);
  console.log('  Keep original: ' + bp.stats.keepOriginal);
  console.log('  Add overlay: ' + bp.stats.addOverlay);
  console.log('  Replace footage: ' + bp.stats.replaceFootage);
  console.log('  Add text: ' + bp.stats.addText);
  console.log('  Add animation: ' + bp.stats.addAnimation);
  console.log('  Cut: ' + bp.stats.cutSegments);
  console.log('  Materials: ' + bp.stats.materialsGenerated);

  console.log('');
  console.log('MATERIALS:');
  for (const m of bp.materials.slice(0, 5)) {
    console.log('  [' + m.type + '] ' + m.source.slice(0, 60) + ' (' + m.provider + ')');
    if (m.thumbnailUrl) console.log('    thumb: ' + m.thumbnailUrl.slice(0, 80));
  }

  console.log('');
  console.log('SAMPLE SEGMENTS:');
  for (const s of bp.segments.slice(0, 8)) {
    const time = s.start !== null ? '[' + s.start.toFixed(1) + 's-' + s.end.toFixed(1) + 's]' : '';
    const mat = s.aiPath.material ? ' +' + s.aiPath.material.type : '';
    console.log('  ' + time + ' ' + s.suggestion.padEnd(8) + ' action=' + s.aiPath.action + mat);
    console.log('    topic: ' + s.topic);
    if (s.aiPath.reason) console.log('    reason: ' + s.aiPath.reason.slice(0, 80));
    console.log('    reviewUrl: ' + s.reviewUrl);
  }

  console.log('');
  console.log('VALID:YES');
}
main().catch(e => console.log('ERROR: ' + e.message));
"

echo ""
echo "============================================"
echo " Stage 4A Test Complete"
echo "============================================"
