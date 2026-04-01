# Dashboard Rules

## Tech Stack
Next.js 15 (App Router), React 19, TypeScript, TanStack Query v5, TanStack Virtual, Tailwind CSS 4, Radix UI, Lucide React

## Pages
All under `/project/[id]/` with shared layout + sidebar:
- `/` — Project list with status badges
- `/upload` — Drag-drop video, editorial brief
- `/pipeline` — 5-stage SSE progress
- `/review` — Video player + virtualized segment list + inspector + bulk actions (most complex)
- `/knowledge` — D3 force-directed knowledge graph
- `/transcript` — Raw/cleaned toggle, export
- `/marks` — Content marks + stock footage gallery
- `/export` — CSV, EDL, FCPXML, Premiere XML, JSON

## API Proxy
Dashboard API routes proxy to backend at `BACKEND_URL` via `src/lib/backend-proxy.ts`.
Client-side uses `NEXT_PUBLIC_API_URL` for direct backend calls.

## Key Hooks (TanStack Query)
- `use-project.ts` — CRUD with optimistic updates
- `use-segments.ts` — List/filter/approve/reject/bulk with WebSocket sync
- `use-pipeline.ts` — SSE subscription for progress
- `use-websocket.ts` — WebSocket lifecycle management
- `use-stock-footage.ts` — Pexels/Pixabay search integration

## Node.js 25 Compatibility
Dashboard requires `NODE_OPTIONS="--localstorage-file=/tmp/next-ls"` due to Node.js 25 built-in localStorage needing a valid file path.
