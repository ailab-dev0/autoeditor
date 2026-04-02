# EditorLens MK-12 — User Guide

> This document only states what works. No fluff.

---

## What This Is

A web-based tool that takes a video file, analyzes its content using AI, and produces an edit plan. You review the plan, approve/reject segments, and export the decisions as timeline files for Premiere Pro, Final Cut Pro, or DaVinci Resolve.

It does NOT edit videos. It produces edit decisions that a human editor imports into their NLE.

---

## Starting the Tool

The tool is already installed. Open Terminal and run:

```bash
cd ~/Documents/editorlensmk12/autoeditor
./scripts/start.sh
```

Wait for all 4 services to show green. Then open the URL shown in the terminal — something like `http://10.10.x.x:3000` — in your browser.

To stop:
```bash
./scripts/stop.sh
```

If you get errors about Docker not running, open **Docker Desktop** first, wait for it to start, then run `./scripts/start.sh` again.

---

## Step-by-Step Usage

### 1. Create a Project

Go to the home page → "Create New Project". Enter a name. Click Create.

You land on the **Upload** page. All other pages are locked until you upload a video.

### 2. Upload a Video

Drag and drop or browse for a video file. Supports MP4, MOV, WebM, MKV. Up to 10GB. The file streams directly to MinIO storage — no memory issues with large files.

Upload time depends on file size and network speed. 632MB took ~3 minutes over WiFi between two laptops.

### 3. Run the Pipeline

After upload, click "Start Pipeline". Four stages run automatically:

| Stage | What Happens | Time (30s video) | Time (30min video) |
|-------|-------------|-------------------|---------------------|
| Transcribing | Sends audio to AssemblyAI, gets word-level transcript | ~10s | ~30s |
| Analyzing Content | Claude classifies each segment: role, importance, topic | ~15s | ~2-5min |
| Validating Chapters | Merges short chapters, splits long ones | instant | instant |
| Building Edit Plan | Claude decides: keep, cut, overlay, replace for each segment | ~10s | ~2-5min |

**What you see**: Progress bar with stage names updating. Pipeline page polls every 10 seconds. SSE provides faster updates when connected.

**What you get**: A blueprint with a decision for every segment of your video.

### 4. Review Decisions

The Review page shows every segment with two paths:
- **AI Director**: What the AI suggests (keep, cut, add overlay, add text)
- **Keep Original**: Keep the footage as-is

For each segment you can:
- Accept AI suggestion
- Keep original
- Write custom edit instructions
- Mark for review (flags it for later)

**Filter options**: All, Pending (not yet decided), Needs Review (flagged)

**What works**: Approving/rejecting segments, custom notes, bulk accept. Choices are saved and survive page reload.

**What doesn't work**: Video playback — you see segment metadata (text, timing, topic) but not the actual video frames. The segment text is the transcript excerpt.

### 5. View Transcript

Shows the full transcription. Only segments you've approved in Review appear here. Search by text or speaker name. Click any segment to see its timestamp.

### 6. Knowledge Graph

Shows topics extracted from your video as an interactive node graph. Tree layout. Click a node to see details. Research tab lets you ask Claude for deeper analysis of any concept — produces a summary, key facts, sources, and visual suggestions.

**What works**: Node display, community clustering, research generation.

**What doesn't work**: Edge relationships are sparse (derived from shared segments, not semantic analysis).

### 7. Content Marks

Shows segments where the AI suggests adding visual material. Three tabs:

**Marks**: Segments needing overlays, text, or replacement footage. Shows the topic and what type of content is suggested.

**Stock Footage**: Search Pexels + Pixabay for stock video. Browse thumbnails, download directly.

**AI Images**: Generate images with Nano Banana Pro model. Requires `FAL_KEY` in `.env`. $0.03 per image.

### 8. Export

Download your edit decisions in these formats:
- **Premiere Pro XML** — import as timeline
- **Final Cut Pro XML (FCPXML)** — import as timeline
- **EDL** — universal edit decision list
- **JSON** — full segment data with decisions
- **CSV** — spreadsheet with timestamps, decisions, confidence, transcript

Exports include actual blueprint decisions: which segments to keep, cut, overlay, with confidence scores and AI reasoning.

**Send to Premiere Pro**: Only appears after you've reviewed 100% of segments. Requires the EditorLens plugin running in Premiere Pro.

### 9. Repository

Table of all projects. Shows name, status, segment count, date, and API cost. Delete projects individually or in bulk.

---

## What It Costs Per Video

| Service | What | Cost |
|---------|------|------|
| AssemblyAI | Transcription | ~$0.37/hour of video |
| OpenRouter (Claude) | Content analysis + edit plan | ~$0.10-0.50 per video |
| fal.ai | AI image generation | $0.03/image (optional) |
| Pexels/Pixabay | Stock footage search | Free |

A 30-second test video costs ~$0.03. A 30-minute video costs ~$0.50. Costs are tracked per project and shown in the sidebar.

---

## Known Limitations

**These do not work without the Premiere Pro plugin:**
- Video playback in the review page
- Importing segments onto a Premiere timeline
- "Send to Premiere Pro" button

**These require optional API keys:**
- AI image generation (needs `FAL_KEY`)
- Stock footage search (needs `PEXELS_API_KEY`, but has a free tier)

**These are limitations of the current system:**
- No video preview — you review based on transcript text and AI analysis, not video frames
- Knowledge graph edges are weak — topics cluster by shared segments, not semantic meaning
- Pipeline progress is tracked in-memory — if the server restarts mid-pipeline, progress is lost (but checkpoints allow resume)
- Old projects created before the upload fix have broken video paths — delete and recreate them
- Research calls Claude per concept — bulk research on 100+ topics gets expensive

**These are working but imperfect:**
- Chapter naming — derived from first words of the segment, not always meaningful
- Overlay suggestions — AI sometimes suggests generic overlays ("concept visualization") instead of specific content
- Content marks search queries — improved but still based on topic text, not visual analysis

---

## Architecture (Simplified)

```
Browser → Dashboard (Next.js :3000)
              ↓ API calls
          Backend (Fastify :8000)
              ↓ stores files        ↓ stores users/projects
          MinIO (:9000)           Postgres (Neon cloud)
              ↓ AI calls
          AssemblyAI (transcription)
          OpenRouter/Claude (analysis)
          fal.ai (images, optional)
          Pexels (stock, optional)
```

All pipeline artifacts stored as JSONL in MinIO. No Neo4j dependency. Postgres only for auth and project metadata.

---

## File Structure That Matters

```
mk12-backend/
  src/analysis/pipeline.ts     — 4-stage pipeline orchestrator
  src/analysis/content-flow.ts — Claude content analysis + pre-classification
  src/analysis/production-blueprint.ts — edit decisions + material generation
  src/routes/                  — all API endpoints
  src/services/                — business logic (MinIO, costs, segments)
  docker-entrypoint.sh         — validates env vars on container start

mk12-dashboard/
  src/app/project/[id]/        — all project pages (upload, pipeline, review, etc.)
  src/hooks/                   — React Query hooks for data fetching
  src/lib/api-client.ts        — typed API client with response mappers

scripts/
  setup.sh    — first-time Docker setup
  start.sh    — start all services (Docker or --local)
  stop.sh     — stop everything
```

---

*Last verified: April 2, 2026. Tested on Docker across two MacBooks over WiFi.*
