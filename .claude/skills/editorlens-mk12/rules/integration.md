# Integration Rules

## Service Communication

```
Plugin ←→ Backend ←→ Dashboard
                  ←→ Animation Engine
                  ←→ Neo4j
```

## Protocols
| Path | Protocol | Direction |
|------|----------|-----------|
| Plugin → Backend | WebSocket ws://localhost:8000/ws/premiere/:id | Bidirectional |
| Dashboard → Backend | HTTP REST + WebSocket /ws/dashboard/:id | Both |
| Dashboard → Backend | SSE /api/projects/:id/pipeline/stream | Server→Client |
| Backend → Animation | HTTP REST http://localhost:4200/api/* | Request/Response |
| Backend → Neo4j | Bolt bolt://localhost:7687 | Bidirectional |

## Approval Sync Flow
1. Client (plugin or dashboard) approves segment
2. Sends `{ type: "segment_update", segment_id, approved: true }` via WebSocket
3. Backend stores in Neo4j + in-memory
4. SyncManager broadcasts to ALL other connected clients (prevents echo)
5. Other clients update UI optimistically

## Dashboard API Proxy
Dashboard API routes at `/api/*` proxy to backend via `backend-proxy.ts`.
Client-side calls go directly to `NEXT_PUBLIC_API_URL` (backend).

## Environment Variables
```
BACKEND_URL=http://localhost:8000          # Dashboard server-side
NEXT_PUBLIC_API_URL=http://localhost:8000   # Dashboard client-side
NEXT_PUBLIC_WS_URL=ws://localhost:8000      # Dashboard WebSocket
ANIMATION_ENGINE_URL=http://localhost:4200  # Backend → Animation
NEO4J_URI=bolt://localhost:7687            # Backend → Neo4j
```
