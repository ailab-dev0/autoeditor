---
name: editorlens-mk12
description: EditorLens MK-12 system knowledge — Premiere Pro plugin, web dashboard, backend, animation engine, and integration patterns
metadata:
  tags: editorlens, mk12, premiere, uxp, dashboard, neo4j, remotion, animation, video-editing
---

## When to use

Use this skill whenever working on any part of the EditorLens MK-12 system:
- Premiere Pro UXP plugin development
- Web dashboard (Next.js 15) pages and components
- Backend API routes, services, WebSocket handlers
- Animation engine templates and rendering
- Integration between services
- Testing and UAT

## System Architecture

EditorLens MK-12 has 4 subsystems:

| Service | Location | Tech | Port |
|---------|----------|------|------|
| Premiere Plugin | `mk12-premiere-plugin/` | Vanilla JS, UXP v7, Spectrum Web Components | N/A (UXP panel) |
| Web Dashboard | `mk12-dashboard/` | Next.js 15, React 19, TanStack Query, Tailwind CSS 4 | 3000 |
| Backend | `mk12-backend/` | Fastify, Neo4j, WebSocket, SSE | 8000 |
| Animation Engine | `mk12-animation-engine/` | Remotion 4.0, Express | 4200 |

Load the relevant rule file for the subsystem you're working on:

- [rules/plugin.md](rules/plugin.md) — UXP plugin architecture, state machine, timeline operations
- [rules/dashboard.md](rules/dashboard.md) — Dashboard pages, hooks, components, API proxy
- [rules/backend.md](rules/backend.md) — API routes, services, WebSocket, Neo4j, pipeline
- [rules/animation.md](rules/animation.md) — Remotion templates, content mark routing, rendering
- [rules/integration.md](rules/integration.md) — Service wiring, protocols, real-time sync
- [rules/testing.md](rules/testing.md) — UAT structure, test patterns, regression workflow

## Key Decisions

1. **Plugin is vanilla JS** — no React, no npm, no bundlers. UXP v7 runtime only.
2. **Crash-resilient state machine** — localStorage ring buffer survives UXP reloads.
3. **Marker heatmap** — AI suggestions visualized as colored markers on EditorLens_V2 track.
4. **Non-destructive preview → explicit apply** — markers first, timeline rebuild only after approval.
5. **WebSocket-first + HTTP fallback** — NDJSON streaming for progressive results.
6. **Bidirectional approval sync** — plugin ↔ dashboard via WebSocket broadcast.
7. **TanStack Query with optimistic updates** — instant UI feedback on approve/reject.
8. **Content mark routing** — AI decides template type based on search query keywords.

## Running

```bash
# All services
bash scripts/dev.sh

# Or individually
cd mk12-backend && npx tsx src/server.ts
cd mk12-dashboard && NODE_OPTIONS="--localstorage-file=/tmp/next-ls" npx next dev
cd mk12-animation-engine && npx tsx src/api/server.ts

# Tests
cd mk12-uat/backend && npx vitest run      # 132 tests
cd mk12-uat/dashboard && npx vitest run     # 191 tests
cd mk12-uat/animation && npx vitest run     # 120 tests
cd mk12-uat/integration && npx vitest run   # 30 tests
cd mk12-uat/plugin && node --test tests/*   # 203 tests
cd mk12-premiere-plugin && node --test test/* # 103 tests
```

## Edit Package v3 Protocol

The core data format exchanged between backend → plugin → dashboard:
```json
{
  "version": "v3",
  "project_name": "string",
  "pipeline_session_id": "string",
  "pedagogy_score": 0.87,
  "chapters": [{ "name": "string", "order": 0, "target_duration": 180.0 }],
  "videos": [{
    "video_path": "string",
    "segments": [{
      "id": "seg-001",
      "start": 10.5, "end": 25.3,
      "suggestion": "keep|cut|trim_start|trim_end|trim_both|rearrange|speed_up|merge|review",
      "confidence": 0.94,
      "explanation": "string",
      "concept": "string",
      "chapter": "string",
      "content_mark": { "asset_type": "string", "search_query": "string", "research_links": ["url"] },
      "handle_before": 1.5, "handle_after": 1.5,
      "transition_after": "cross_dissolve|dip_to_black|none"
    }]
  }]
}
```

## Marker Colors

Decision markers: keep=#27AE60, cut=#E74C3C, trim=#F1C40F, rearrange=#3498DB, speed_up=#9B59B6, review=#E67E22
Content markers: stock_video=#00BCD4, article=#E91E63, linkedin_photo=#FFFFFF, animation=#8BC34A, ai_image=#FF69B4, loom_recording=#009688
