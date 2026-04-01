# Backend Rules

## Tech Stack
Fastify, TypeScript, Neo4j driver, WebSocket (@fastify/websocket), Zod, tsx

## Routes
- `/api/projects/*` — CRUD
- `/api/projects/:id/segments/*` — list, filter, approve, reject, bulk
- `/api/projects/:id/pipeline/*` — start, status, SSE stream
- `/api/projects/:id/transcript` — get, export (text/srt/vtt/json)
- `/api/projects/:id/knowledge` — Neo4j graph data
- `/api/projects/:id/marks` — content marks CRUD
- `/api/projects/:id/export` — CSV, EDL, FCPXML, Premiere XML, JSON
- `/api/stock/*` — Pexels/Pixabay search
- `/api/templates` — animation template registry
- `/api/projects/:id/animations/*` — trigger + status

## WebSocket
- `/ws/premiere/:projectId` — plugin connection (analyze_request, segment_update, heartbeat)
- `/ws/dashboard/:projectId` — dashboard connection (segment_update, approval sync)
- SyncManager broadcasts segment approvals to all clients, prevents echo loops

## Services
- `project-service.ts` — In-memory + Neo4j dual storage
- `analysis-service.ts` — 5-stage pipeline orchestrator
- `segment-service.ts` — Approval tracking
- `stock-footage-service.ts` — Pexels + Pixabay with mock fallback
- `animation-service.ts` — Proxies to animation engine
- `template-service.ts` — Auto-populates template props from knowledge graph
- `sync-service.ts` — Real-time coordination

## Neo4j Schema
Nodes: Project, Video, Segment, Concept, Chapter, Transcript
Indexes on: Project.id, Segment.id, Concept.name
