# EditorLens MK-12 — Feature Documentation

> AI-powered video editing pipeline with web dashboard, cost tracking, and real-time collaboration.

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Analysis Pipeline](#analysis-pipeline)
3. [Dashboard — Project Management](#dashboard--project-management)
4. [Dashboard — Pipeline](#dashboard--pipeline)
5. [Dashboard — Production Review](#dashboard--production-review)
6. [Dashboard — Transcript](#dashboard--transcript)
7. [Dashboard — Knowledge Graph](#dashboard--knowledge-graph)
8. [Dashboard — Content Marks](#dashboard--content-marks)
9. [Dashboard — Export](#dashboard--export)
10. [Dashboard — Repository](#dashboard--repository)
11. [Authentication & Authorization](#authentication--authorization)
12. [Real-Time Communication](#real-time-communication)
13. [Cost Tracking](#cost-tracking)
14. [Job Queue](#job-queue)
15. [Storage](#storage)
16. [API Reference](#api-reference)
17. [Deployment](#deployment)

---

## System Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│  Dashboard   │────▶│   Backend    │────▶│  MinIO (S3)      │
│  (Next.js)   │     │  (Fastify)   │     │  Object Storage  │
│  :3000       │     │  :8000       │     │  :9000           │
└──────────────┘     └──────┬───────┘     └──────────────────┘
                            │
                     ┌──────┴───────┐
                     │  Postgres    │
                     │  (Neon)      │
                     │  Auth/CRUD   │
                     └──────────────┘
                            │
                     ┌──────┴───────┐
                     │  Animation   │
                     │  Engine      │
                     │  (Remotion)  │
                     │  :4200       │
                     └──────────────┘
```

### Services

| Service | Technology | Port | Purpose |
|---------|-----------|------|---------|
| Backend | Fastify + TypeScript | 8000 | API, pipeline orchestration, WebSocket |
| Dashboard | Next.js 15 + React | 3000 | Web UI for project management and review |
| Animation Engine | Remotion + TypeScript | 4200 | AI-generated animations and text overlays |
| MinIO | S3-compatible object store | 9000 | Video files, pipeline artifacts, blueprints |
| Postgres | Neon (serverless) | — | Users, projects, auth tokens, cost events |

---

## Analysis Pipeline

The pipeline processes uploaded videos through 4 stages. All artifacts are stored in MinIO as JSONL split files (meta + segments).

### Stage 1 — Transcription
- **Input**: Video file (uploaded to MinIO, up to 10GB)
- **Process**: 
  - Downloads video from MinIO to temp directory
  - Extracts audio with FFmpeg (16kHz mono WAV)
  - Uploads to AssemblyAI for transcription
  - Speaker diarization and word-level timestamps
- **Output**: `manifest.json`, `transcripts/{filename}.json`, `audio/{filename}.wav`
- **Cost**: ~$0.37/hour of audio (AssemblyAI)

### Stage 2 — Content Flow Analysis
- **Input**: Transcription segments + media files
- **Process**:
  - Pre-classifies ~60% of segments locally (images, silence, filler, hooks, redundant)
  - Sends uncertain segments to Claude (OpenRouter) in batches of 80
  - Assigns: topic, role, importance (1-5), pedagogy, confidence
  - Roles: hook, intro, core, example, deep-dive, tangent, filler, recap, transition
  - Optional: Qwen 3.5 vision for ambiguous video segments
- **Output**: `content-flow-meta.json` + `content-flow-segments.jsonl`
- **Cost**: ~$0.02-0.10 per batch (Claude Sonnet via OpenRouter)

### Stage 3 — Chapter Validation
- **Input**: Content flow chapters + segments
- **Process**:
  - Merges tiny chapters (<5s) into neighbors
  - Splits giant chapters (>120s) at topic boundaries
  - Validates endTime > startTime for all chapters
- **Output**: Refined chapter list (in-memory, used by Stage 4)
- **Cost**: None (heuristic, no AI)

### Stage 4 — Production Blueprint
- **Input**: Content flow + chapters
- **Process**:
  - Pre-classifies ~50-60% of decisions locally (filler→cut, hooks→add_text, etc.)
  - Sends uncertain segments to Claude for edit decisions
  - Decisions: keep_original, add_overlay, replace_footage, add_text, add_animation
  - Generates materials (stock footage via Pexels, AI images via fal.ai)
  - Enforces constraints: 30% overlay cap, dissolve limits, chapter boundaries
  - Missing AI decisions get explicit `needs_review` status
- **Output**: `blueprint-meta.json` + `blueprint-segments.jsonl`
- **Cost**: ~$0.02-0.10 per batch (Claude) + $0.03/image (fal.ai) + free (Pexels)

### Checkpoint & Resume
- Each stage writes a checkpoint to MinIO after completion
- On failure, the pipeline auto-resumes from the last completed stage
- Explicit `startFromStage` option to force resume from a specific stage
- Atomic JSONL writes: `.tmp` keys first, then promote to final keys
- Integrity check: segment count must match meta on load

### Pre-Classification (Cost Optimization)
~60% of segments are classified locally without AI calls:
- Images → `visual-aid`
- No speech → `b-roll` or `ambient`
- Filler words (um, uh, like) → `filler`
- Very short (≤2s, ≤5 words) → `filler`
- First real content → `hook`
- >85% word overlap with recent segment → `redundant`

Each pre-classified segment gets a deterministic pedagogy string instead of empty:
- filler: "Non-essential content — safe to cut"
- b-roll: "Supplementary visual material"
- hook: "Attention-capturing opening element"
- redundant: "Repeats concept from segment {id}"

---

## Dashboard — Project Management

### Home Page (`/`)
- List all projects with status badges (created, analyzing, ready, review, error)
- Create new project with name, description, brief, tags
- Upload videos via drag-and-drop or file browser (MP4, MOV, WebM, MKV)
- Technical settings: FPS, resolution

### Project Overview (`/project/[id]`)
- Sidebar navigation: Upload, Pipeline, Review, Knowledge, Transcript, Marks, Export
- Project status and segment/approval counts
- API cost display in sidebar (per-service breakdown)
- WebSocket connection for real-time collaboration

---

## Dashboard — Pipeline

### Pipeline Page (`/project/[id]/pipeline`)
- 4-stage progress display with icons and labels
- Real-time updates via SSE (Server-Sent Events)
- Polling fallback (10s) for pipeline start detection
- 5s polling when SSE is unavailable
- Stage display names:
  - transcription → "Transcribing"
  - knowledge_graph → "Analyzing Content"
  - chapter_validation → "Validating Chapters"
  - director_decisions → "Building Edit Plan"
- SSE reconnect with exponential backoff (2s, 4s, 8s), max 3 attempts
- Token refresh before SSE reconnect if JWT is expiring
- "Start Pipeline" / "Re-run Pipeline" button

---

## Dashboard — Production Review

### Review Page (`/project/[id]/review`)
- Two-panel layout: segment list (left) + detail panel (right)
- Three filter modes: All, Pending, Needs Review
- For each segment:
  - **AI Director path**: action, material preview, reason, provider badges (Pexels, AI Generated)
  - **Keep Original path**: original footage reference
  - **Custom Edit path**: textarea for custom instructions
- Material preview: thumbnail → preview link → nothing (no empty placeholders)
- Segment navigation: prev/next buttons, keyboard-friendly
- "Mark for Review" button on each segment
- Bulk "Accept All AI" button
- Warning banner for segments needing manual review
- Optimistic mutations with rollback on error
- Cache invalidation: blueprint + project queries updated on choice change
- Review stats: reviewed/total count with progress bar

### Blueprint Warnings
- Segments with no AI decision get `needs_review` status
- Warning banner: "{N} segments need manual review — AI classification was incomplete"
- Needs-review segments have yellow left border + warning icon in list
- Filterable via "Review" filter button

---

## Dashboard — Transcript

### Transcript Page (`/project/[id]/transcript`)
- **Only shows approved segments** — cross-references blueprint `userChoice`
- Search bar with match count
- Word-level highlighting during playback
- Search result highlighting (yellow marks)
- Click-to-seek: click any segment to jump to that time
- Link to review page for each segment (hover icon)
- WebSocket subscription for `transcript_updated` events
- Export SRT button

---

## Dashboard — Knowledge Graph

### Knowledge Page (`/project/[id]/knowledge`)
- Interactive SVG graph visualization
- **Tree/branch layout** (not circular) — derived from content flow topics
- Label collision avoidance — labels shift down when overlapping
- Labels truncated at 25 characters
- Node size proportional to importance
- Community colors for topic clusters
- Curved edge paths between connected nodes
- Click node to inspect details

### Sidebar — Two Tabs
1. **Inspector**: Node details (type, importance, community, segment count), community legend
2. **Research**: Deep research panel with concept research via Claude
   - Research button per concept
   - Bulk research all concepts
   - Results: summary, key facts, sources (with links), teaching notes, visual suggestions
   - Research stored in MinIO per concept

---

## Dashboard — Content Marks

### Marks Page (`/project/[id]/marks`)
- Three tabs: Marks, Stock Footage, AI Images

#### Marks Tab
- Grid of content marks derived from blueprint
- Each mark shows: title, description, time range
- Click to generate image for that mark

#### Stock Footage Tab
- Search Pexels + Pixabay stock footage
- Thumbnail grid with lazy loading
- Provider badges, duration badges, resolution badges
- **Download button** on each thumbnail
- Select multiple items
- No "Generate Suggestions" — removed

#### AI Images Tab
- **Single model**: Nano Banana Pro
- Prompt input for free-form generation
- Aspect ratio options: 16:9, 4:3, 1:1
- Generated image gallery — **no display cap** (all images shown)
- Download button on each generated image
- Per-segment generation from content marks

---

## Dashboard — Export

### Export Page (`/project/[id]/export`)
- **Send to Premiere Pro**: only visible after review is 100% complete
  - Sends `timeline_import` command via WebSocket
  - Plugin receives and imports approved segments to timeline
- NLE Timeline exports:
  - Premiere Pro XML
  - Final Cut Pro XML (FCPXML)
  - EDL (Edit Decision List)
- Data exports:
  - JSON (full segment and blueprint data)
  - CSV (spreadsheet analysis)
- Edit package built on-the-fly from MinIO data (no pre-stored package)

---

## Dashboard — Repository

### Repository Page (`/repository`)
- Table of all projects with: name, status, segments, updated date, **API cost**
- Multi-select with checkboxes (select all, individual)
- Bulk delete with two-step confirmation
- Per-row delete with inline confirm/cancel
- Cost column shows per-project total

---

## Authentication & Authorization

### Auth System
- JWT-based authentication with refresh tokens
- Stored in localStorage (`mk12_token`, `mk12_refresh_token`)
- Auto-refresh 60 seconds before expiry
- Roles: admin, editor, reviewer, viewer, creative_director, producer
- Role-based access control (RBAC) on mutation endpoints
- Dev token endpoint for development (non-production only)

### Endpoints
- `POST /api/auth/register` — create account
- `POST /api/auth/login` — get JWT
- `POST /api/auth/refresh` — refresh token
- `GET /api/auth/me` — current user info
- `POST /api/auth/dev-token` — dev-only token creation

---

## Real-Time Communication

### WebSocket (Segments + Collaboration)
- Singleton client per project (owned by layout component)
- Connection states: connecting, connected, disconnected, error
- Exponential backoff reconnect: 1s, 2s, 4s, 8s... max 30s, 10 attempts
- Message types: segment_update, approval_sync, pipeline_status, project_update, transcript_updated
- `useWebSocket(projectId)` — connection owner (layout only)
- `useWebSocketSubscribe()` — event subscriber (any component)
- Cross-client sync: dashboard ↔ plugin segment approvals

### SSE (Pipeline Progress)
- `GET /api/projects/:id/pipeline/stream` — unnamed events with `type` field
- Event types: stage_start, stage_progress, stage_complete, stage_error, pipeline_complete, initial_status
- Reconnect with backoff: 2s, 4s, 8s, max 3 attempts
- Token refresh before reconnect if JWT is expiring
- Polling fallback (5s) after 3 failed reconnects
- Auth error state: "Session expired — please refresh the page"

### Collaboration WebSocket
- Presence tracking (who's online)
- Annotation broadcasting
- Heartbeat with timeout

---

## Cost Tracking

### Tracked Services
| Service | Operation | Pricing |
|---------|-----------|---------|
| AssemblyAI | Transcription | $0.37/hour of audio |
| OpenRouter | Content flow analysis | ~$3/M input, $15/M output tokens (Claude Sonnet) |
| OpenRouter | Blueprint decisions | ~$3/M input, $15/M output tokens (Claude Sonnet) |
| fal.ai | Image generation | ~$0.03/image |
| Pexels | Stock search | Free |

### Storage
- `cost_events` table in Postgres
- Per-event: project_id, service, operation, model, input_tokens, output_tokens, cost_usd, metadata
- API: `GET /api/projects/:id/costs` (per-project), `GET /api/costs/summary` (all projects)

### Display
- **Project sidebar**: total cost + per-service breakdown
- **Repository table**: cost column per project
- **CostBadge component**: `$0.0234` format, green badge

---

## Job Queue

### Queue Service
- FIFO with configurable concurrency (default: 2)
- Per-job timeout: 30 minutes
- Retry: up to 3 attempts with exponential backoff (2s, 4s, 8s, max 30s)
- Status tracking: pending → processing → done/failed
- Race condition protection via `startingPipelines` lock set
- Graceful drain on shutdown (60s window)
- Auto-cleanup of old completed jobs

### Endpoints
- `GET /api/jobs/:id` — check job status
- `GET /api/jobs` — list all jobs with stats

---

## Storage

### MinIO (S3-Compatible)
All pipeline artifacts stored under `projects/{projectId}/`:

| Key | Format | Contents |
|-----|--------|----------|
| `manifest.json` | JSON | File list, audio/transcript keys |
| `audio/{filename}.wav` | WAV | Extracted audio (16kHz mono) |
| `transcripts/{filename}.json` | JSON | AssemblyAI transcription result |
| `content-flow-meta.json` | JSON | Topics, chapters, stats (no segments) |
| `content-flow-segments.jsonl` | JSONL | One segment per line |
| `blueprint-meta.json` | JSON | Stats, warnings, materials list |
| `blueprint-segments.jsonl` | JSONL | One blueprint segment per line |
| `pipeline-checkpoint.json` | JSON | Completed stages list |
| `videos/{filename}` | Video | Uploaded source video |
| `research/{conceptId}.json` | JSON | Per-concept research brief |
| `research/index.json` | JSON | Research index for listing |

### Atomic Writes
- Write to `.tmp` keys first
- Promote to final keys only after all uploads succeed
- Cleanup `.tmp` keys on failure
- Previous checkpoint always intact

### Streaming Uploads
- Multipart upload for files >64MB (64MB parts)
- No memory buffering — streams directly from request to MinIO
- Supports up to 10GB file uploads
- Abort multipart on failure (no orphaned parts)

---

## API Reference

### Projects
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | List projects (paginated, filterable) |
| POST | `/api/projects` | Create project |
| GET | `/api/projects/:id` | Get project |
| PUT | `/api/projects/:id` | Update project |
| DELETE | `/api/projects/:id` | Delete project + MinIO cleanup |

### Pipeline
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/projects/:id/pipeline/start` | Start analysis pipeline |
| GET | `/api/projects/:id/pipeline/status` | Get pipeline status |
| GET | `/api/projects/:id/pipeline/stream` | SSE stream of progress |

### Blueprint
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects/:id/blueprint` | Get full blueprint + review stats |
| PUT | `/api/projects/:id/blueprint/segment/:segId` | Update user choice |
| PUT | `/api/projects/:id/blueprint/bulk` | Bulk accept/reject |

### Transcript
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects/:id/transcript` | Get transcript (MinIO fallback) |

### Knowledge
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects/:id/knowledge` | Get knowledge graph (MinIO-derived) |

### Research
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/projects/:id/research/:conceptId` | Research a concept |
| GET | `/api/projects/:id/research/:conceptId` | Get cached research |
| GET | `/api/projects/:id/research` | List all research |

### Content Marks
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects/:id/marks` | List content marks |

### Images
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/projects/:id/images/generate` | Generate from prompt |
| POST | `/api/projects/:id/segments/:segId/generate-image` | Generate from content mark |
| GET | `/api/projects/:id/images` | List generated images |

### Stock
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stock/search?q=...&provider=...` | Search stock footage |

### Export
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects/:id/export?format=...` | Download export |
| POST | `/api/projects/:id/export` | Generate export |

### Upload
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/projects/:id/upload` | Upload video (multipart) |
| GET | `/api/projects/:id/videos` | List uploaded videos |
| GET | `/api/upload/download-url?key=...` | Presigned download URL |

### System
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check (queue, memory, disk, limits) |
| GET | `/api/jobs/:id` | Job status |
| GET | `/api/jobs` | All jobs + stats |
| GET | `/api/projects/:id/costs` | Project cost breakdown |
| GET | `/api/costs/summary` | All project costs |

---

## Deployment

### Docker Compose (Recommended)
```bash
git clone https://github.com/ailab-dev0/autoeditor.git
cd autoeditor
./scripts/setup.sh    # checks Docker, creates .env, builds images
./scripts/start.sh    # starts all services
./scripts/stop.sh     # stops everything
```

### Environment Variables
Create `mk12-backend/.env` with:
```
DATABASE_URL=postgresql://...          # Required
OPENROUTER_API_KEY=sk-or-v1-...       # Required for pipeline
ASSEMBLYAI_API_KEY=...                 # Required for transcription
JWT_SECRET=...                         # Auto-generated if missing
MINIO_ENDPOINT=http://minio:9000      # Default in Docker
```

### WiFi Network Access
- All services bind to `0.0.0.0`
- CORS allows all private IPs (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
- Dashboard `NEXT_PUBLIC_API_URL` must be set to the host IP (not localhost)
- `setup.sh` auto-detects WiFi IP and configures dashboard

### Container Entrypoint
- Validates required env vars on startup
- Shows ✅/❌ status table
- Fails fast with fix instructions if `DATABASE_URL` is missing
- Auto-generates `JWT_SECRET` for dev convenience
- Loads `.env` from `/app/.env` (volume mount) or `/config/.env`

### Scripts
| Script | Purpose |
|--------|---------|
| `scripts/setup.sh` | First-time setup (Docker check, .env, build) |
| `scripts/start.sh` | Start all services (Docker or `--local` dev mode) |
| `scripts/stop.sh` | Stop all services |
| `scripts/start-all.scpt` | macOS AppleScript — opens Terminal tabs |
| `scripts/stop-all.scpt` | macOS AppleScript — kills all services |

### Resilience
- Graceful shutdown: SIGTERM → drain queue (60s) → close WebSockets → close Fastify → close Postgres
- Global error handlers: uncaughtException logs + exits, unhandledRejection logs (no crash)
- Persistent logging: `logs/error.log` + `logs/access.log` with auto-rotation at 50MB (5 files max)
- Request timeouts: 120s for API, 45min for upload/pipeline
- Postgres pool error handler survives Neon idle connection drops
- Pipeline checkpoint resume on crash recovery

---

*Generated for EditorLens MK-12 handoff. Last updated: April 2026.*
