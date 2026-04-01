# EditorLens Pipeline — Stage 1 & 2

How Stage 1 (Transcription) and Stage 2 (Content Flow Analysis) work. Based on actual code as of 2026-03-31.

## Infrastructure (Stage 1 & 2 only)

| Component | Role |
|---|---|
| **MinIO** (port 9000) | Stores audio, transcripts, manifest, content flow |
| **AssemblyAI** | Primary transcription |
| **Deepgram** | Fallback transcription |
| **Claude Sonnet 4** | Content flow analysis (via OpenRouter) |
| **Qwen 3.5 9B** | Vision for ambiguous video segments (via OpenRouter) |
| **FFmpeg** | Audio extraction from video |
| **FFprobe** | Media probing (type, duration, audio streams) |

No Neo4j or Postgres touched in Stage 1 or 2. All output goes to MinIO.

---

## Stage 1: Transcription

**File:** `src/analysis/audio.ts`

### What happens

```
For each media file (video, audio, or image):

  1. resolveMediaPath()
     └─ Local path → use directly
     └─ minio:// → download from MinIO to /tmp
     └─ http:// → download to /tmp

  2. probeMedia() via FFprobe
     └─ Returns: type (video/audio/image), duration, hasAudio, hasVideo

  3. extractAudio() via FFmpeg (only if video with audio)
     └─ Command: ffmpeg -i input -vn -acodec pcm_s16le -ar 16000 -ac 1 output.wav
     └─ Result: 16kHz mono WAV (optimal for speech recognition)
     └─ Images → skip
     └─ Audio files → use directly, no extraction
     └─ Video without audio → skip

Then ALL audio files transcribed IN PARALLEL (max 5 concurrent):

  4. transcribeAudio()
     PRIMARY — AssemblyAI:
       a. POST /v2/upload → upload audio binary → get hosted URL
       b. POST /v2/transcript → create job with:
          - language_detection: true
          - speaker_labels: true
          - speech_models: [universal-3-pro, universal-2]
       c. Poll GET /v2/transcript/{id} every 3s until status=completed (max 5 min)
       d. Parse: words array → split by sentence punctuation → TranscriptSegment[]
          └─ Sentences end at: . ! ?
          └─ Force-split at 15s if no punctuation

     FALLBACK — Deepgram (if AssemblyAI fails):
       a. POST /v1/listen with audio binary
       b. Parse utterances or words

  5. Store in MinIO:
     - projects/{id}/audio/{filename}.wav
     - projects/{id}/transcripts/{filename}.json
     - projects/{id}/manifest.json
```

### Transcript segment shape

```json
{
  "id": "uuid",
  "start": 2.3,
  "end": 6.3,
  "text": "Today, we're diving into how sales went from an art to a science.",
  "speaker": "Speaker A",
  "words": [
    { "word": "Today,", "start": 2.3, "end": 2.5, "confidence": 0.99 }
  ]
}
```

A 2.5 minute video produces ~42 segments, ~380 words.

### What gets stored in MinIO

| Key | Content | Size |
|---|---|---|
| `projects/{id}/audio/{name}.wav` | 16kHz mono PCM | ~4MB per 2min |
| `projects/{id}/transcripts/{name}.json` | Segments + words + metadata | ~50-60KB |
| `projects/{id}/manifest.json` | All files, types, durations, MinIO keys | ~1KB |

### Manifest shape

```json
{
  "projectId": "uuid",
  "sessionId": "uuid",
  "files": [
    {
      "path": "/Users/miles/Downloads/video.mp4",
      "type": "video",
      "duration": 142.1,
      "hasAudio": true,
      "audioKey": "projects/{id}/audio/video.mp4.wav",
      "transcriptKey": "projects/{id}/transcripts/video.mp4.json",
      "segmentCount": 42,
      "wordCount": 380
    }
  ],
  "createdAt": "2026-03-31T..."
}
```

### Timing

| Scenario | Time |
|---|---|
| Single 2.5min video | ~30s |
| 3 files parallel | ~35s |
| FFmpeg extraction | <2s per file |
| AssemblyAI transcription | 15-25s per file |

---

## Stage 2: Content Flow Analysis

**File:** `src/analysis/content-flow.ts`

### What happens

```
1. Build unified segment list from ALL media + transcripts
   └─ Videos: one segment per transcript sentence (from Stage 1)
   └─ Audio files: one segment per transcript sentence
   └─ Images: one segment with no time range
   └─ Silent video: one segment covering full duration, no text

2. Send ALL segments to Claude Sonnet 4 (single API call):
   Prompt: "You are a creative director analyzing media content."

   Claude returns per segment:
     - topic: "Sales Evolution Hook" (3-5 word label)
     - role: hook | intro | core | example | deep-dive | tangent |
             filler | recap | transition | aside | ambient |
             visual-aid | b-roll
     - importance: 1-5
     - pedagogy: "Sets context and grabs viewer attention"
     - continues_from: segment ID this flows from (or null)
     - redundant_with: segment ID this repeats (or null)
     - confidence: 0.0-1.0
     - hard_cut_before: true/false
     - placement: null, or "overlay on {id}" for supplementary media

3. LOW-CONFIDENCE VIDEO SEGMENTS (confidence < 0.6) → Qwen 3.5 vision:
   - FFmpeg extracts 10s video snippet from source
   - Encode as base64, send to qwen/qwen3.5-9b via OpenRouter
   - Qwen classifies scene: talking-head / screen-recording /
     slide-presentation / product-demo / b-roll / graphic / transition
   - Result MODIFIES Claude's analysis:
     └─ screen-recording → role becomes "core", importance ≥ 4
     └─ slide-presentation → hard_cut_before = true
     └─ talking-head + filler confirmed → stays filler

4. Build derived structures (local computation, no AI):
   - Topics: group segments by topic label, rank by max importance
   - Chapters: new chapter at every hard_cut_before or topic change
   - Pedagogy flow: ordered list of role phases
     (hook → intro → core → example → core → recap)
   - Concepts: extracted from topics, with prerequisite chains
     via continues_from links
   - Heatmap: one importance point per second across all media
   - Cross-media links:
     └─ Images → "illustrates" the highest-importance video segment
        with matching topic
     └─ Audio → "accompanies" the intro/hook video segment

5. Store in MinIO: projects/{id}/content-flow.json
```

### Segment roles — what they mean for editing

| Role | What it is | Edit action |
|---|---|---|
| `hook` | First 15s, grabs attention | Always keep |
| `intro` | Sets up the topic | Usually keep |
| `core` | The actual substance | Always keep |
| `example` | Demonstrates a concept | Keep if clear |
| `deep-dive` | Extended exploration | Keep for long-form |
| `tangent` | Off-topic detour | Cut or move to extras |
| `filler` | "um", dead air, repetition | Cut |
| `recap` | Summarizes earlier content | Keep one, cut duplicates |
| `transition` | Bridges topics | Keep if short |
| `aside` | Personal note from speaker | Depends on tone |
| `ambient` | Background audio/music | Overlay, not standalone |
| `visual-aid` | Image that supports a point | Insert at matching segment |
| `b-roll` | Supplementary footage | Overlay on talking head |

### Content flow output shape

```json
{
  "projectId": "uuid",
  "sessionId": "uuid",
  "segments": [
    {
      "id": "uuid",
      "mediaPath": "/path/to/video.mp4",
      "mediaType": "video",
      "start": 0.3,
      "end": 1.8,
      "text": "Welcome to The Explainer.",
      "topic": "Show Introduction",
      "role": "hook",
      "importance": 4,
      "pedagogy": "Sets context and grabs viewer attention",
      "continues_from": null,
      "redundant_with": null,
      "visual_scene": null,
      "confidence": 0.95,
      "hard_cut_before": false,
      "placement": null
    }
  ],
  "topics": [...],
  "chapters": [...],
  "pedagogy": {
    "phases": [
      { "phase": "hook", "segments": ["id1", "id2"] },
      { "phase": "intro", "segments": ["id3", "id4"] },
      { "phase": "core", "segments": ["id5", "id6", "id7"] }
    ],
    "concepts": [
      {
        "name": "Sales Evolution",
        "first_mentioned": "id2",
        "segments": ["id2", "id5"],
        "prerequisites": []
      }
    ],
    "gaps": []
  },
  "heatmap": [
    { "time": 0, "importance": 4, "topic": "Show Introduction", "role": "hook" }
  ],
  "crossMediaLinks": [
    {
      "sourceSegment": "audio-1",
      "targetSegment": "video-1",
      "relationship": "accompanies",
      "reason": "Audio accompanies hook segment"
    }
  ],
  "stats": {
    "totalDuration": 142,
    "totalSegments": 42,
    "mediaFiles": 1,
    "topicsFound": 42,
    "chaptersFound": 42,
    "cutCandidates": 1,
    "keepCandidates": 27
  }
}
```

### Real test results

**Single video (2.5 min explainer):**
- 42 segments analyzed
- Roles detected: hook(2), intro(2), core(27), example(3), transition(5), filler(1), recap(2)
- 1 cut candidate ("It's been, well, quite the evolution." — filler)
- 27 keep candidates
- Hard cuts at topic transitions
- Pedagogy flow: hook → intro → transition → core → example → core (repeating)

**Multi-media (video + scene clip + audio):**
- 44 segments across 3 files
- 1 cross-media link: audio "accompanies" hook segment
- Silent video classified as "Silent Scene"
- Short audio clip classified as "Empty Audio"

### Timing

| Scenario | Stage 1 | Stage 2 | Total |
|---|---|---|---|
| Single video (42 segs) | ~30s | ~90s | ~120s |
| 3 files (44 segs) | ~35s | ~100s | ~140s |

---

## Data flow

```
Media files (video/audio/image)
       │
       ▼
┌─── STAGE 1 ──────────────────────────────────┐
│  FFprobe → probe type/duration/audio          │
│  FFmpeg  → extract 16kHz mono WAV             │
│  AssemblyAI → transcribe (parallel)           │
│  MinIO   → store audio + transcripts          │
│                                               │
│  Output: manifest.json + per-file transcripts │
└──────────────────┬────────────────────────────┘
                   │
                   ▼
┌─── STAGE 2 ──────────────────────────────────┐
│  Claude Sonnet 4 → creative director analysis │
│    topic, role, importance, continuity, cuts   │
│  Qwen 3.5 → vision (low-confidence only)      │
│  Local → topics, chapters, heatmap, links      │
│  MinIO → store content-flow.json               │
│                                                │
│  Output: unified content timeline              │
└────────────────────────────────────────────────┘
```

## Env vars (Stage 1 & 2 only)

| Key | Required | Purpose |
|---|---|---|
| `ASSEMBLYAI_API_KEY` | Yes | Primary transcription |
| `DEEPGRAM_API_KEY` | No | Fallback transcription |
| `OPENROUTER_API_KEY` | Yes | Claude (Stage 2) + Qwen vision |
| `FFMPEG_PATH` | Yes | Audio extraction |
| `FFPROBE_PATH` | Yes | Media probing |
| `MINIO_ENDPOINT` | Yes | Object storage |
| `MINIO_ACCESS_KEY` | Yes | MinIO auth |
| `MINIO_SECRET_KEY` | Yes | MinIO auth |

## Testing

```bash
./test-stage1.sh    # Stage 1 only (4 tests: single, multi, audio, mixed)
./test-stage2.sh    # Stage 1+2 (single video + multi-media)
```
