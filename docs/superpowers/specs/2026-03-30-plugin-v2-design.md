# EditorLens Plugin v2 — Design Spec

## Overview

Full rewrite of the Premiere Pro UXP plugin. Replaces the monolithic v1 LensApp.js (3200 lines) with a domain-module architecture. Retains full analysis + auto-assembly flow, redesigned.

## Decisions

| Decision | Choice |
|---|---|
| Scope | Full flow (analysis + assembly), redesigned |
| Architecture | Layer-based with domain module isolation |
| UI Framework | Preact (JSX, hooks, 3KB) |
| State | Preact Signals (domain-scoped) |
| Backend coupling | Event-driven adapter (intents → transport) |
| FSM | Hierarchical (shell FSM + domain sub-FSMs) |
| Panels | Multi-panel (Main, Stock, Transcript) |
| Error handling | Inline + toast + persistent status bar |
| Styling | Utility classes on Spectrum design tokens + sp-* components |

## Architecture

### Domain Modules

8 domains, each self-contained with signals, adapter, and components:

- **auth/** — login, token management, session
- **pipeline/** — analysis orchestration, progress tracking
- **segments/** — edit package parsing, segment review, approval tracking
- **timeline/** — heatmap overlay, transaction execution, undo
- **stock/** — stock footage search (Pexels/Pixabay)
- **transcript/** — transcript display and export
- **export/** — 7-format export (Edit Package, Premiere, Resolve, FCP, SRT, JSON, CSV)
- **knowledge/** — knowledge graph visualization, research

### Shared Infrastructure

Thin, no business logic:

- **event-bus.js** — typed event whitelist, max listeners, wildcard debug support
- **transport.js** — HTTP + WebSocket + automatic fallback to polling. Auth token auto-injected. Reconnect with exponential backoff.
- **errors.js** — toast queue, error categorization (validation, backend, transport, premiere)
- **premiere.js** — async-only UXP API wrapper, `safe()` envelope, version fallback chains, tick conversion
- **styles/** — Spectrum design tokens + ~40 utility CSS classes

### Panel Composition

Three UXP panels registered in manifest.json. Each is an independent Preact root that imports domain modules:

- **Main panel** (editorlens.main) — shell FSM, auth, pipeline, segments, timeline. Primary workflow.
- **Stock panel** (editorlens.stock) — stock domain + read-only segment signals.
- **Transcript panel** (editorlens.transcript) — transcript domain.

Panels run in separate JS contexts. Cross-panel sync via BroadcastChannel — each panel's adapters hydrate from the same EventBus events independently.

## Directory Structure

```
src/
├── shell/
│   ├── Shell.jsx             # Top-level Preact component
│   ├── fsm.js                # Shell hierarchical FSM
│   ├── router.js             # FSM state → domain rendering
│   └── status-bar.jsx        # Connection/error status bar
│
├── domains/
│   ├── auth/
│   │   ├── signals.js
│   │   ├── adapter.js
│   │   └── components/
│   │       ├── LoginForm.jsx
│   │       └── ServerConnect.jsx
│   │
│   ├── pipeline/
│   │   ├── signals.js
│   │   ├── adapter.js
│   │   ├── fsm.js            # idle → running → complete → failed
│   │   └── components/
│   │       └── ProgressPanel.jsx
│   │
│   ├── segments/
│   │   ├── signals.js
│   │   ├── adapter.js
│   │   ├── protocol.js       # V3 edit package parsing/validation
│   │   └── components/
│   │       ├── SegmentList.jsx
│   │       ├── SegmentCard.jsx
│   │       └── ConfidenceRibbon.jsx
│   │
│   ├── timeline/
│   │   ├── signals.js
│   │   ├── adapter.js
│   │   ├── fsm.js            # idle → previewing → applying → applied → rolled-back
│   │   ├── transaction.js    # Ordered operations
│   │   └── components/
│   │       ├── HeatmapOverlay.jsx
│   │       └── ApplySummary.jsx
│   │
│   ├── stock/
│   │   ├── signals.js
│   │   ├── adapter.js
│   │   └── components/
│   │       └── StockBrowser.jsx
│   │
│   ├── transcript/
│   │   ├── signals.js
│   │   ├── adapter.js
│   │   └── components/
│   │       └── TranscriptView.jsx
│   │
│   ├── export/
│   │   ├── signals.js
│   │   ├── adapter.js
│   │   └── components/
│   │       └── ExportPanel.jsx
│   │
│   └── knowledge/
│       ├── signals.js
│       ├── adapter.js
│       └── components/
│           └── KnowledgeGraph.jsx
│
├── shared/
│   ├── event-bus.js
│   ├── transport.js
│   ├── errors.js
│   ├── premiere.js
│   └── styles/
│       ├── tokens.js
│       └── utilities.css
│
├── panels/
│   ├── main/
│   │   ├── index.html
│   │   └── index.jsx
│   ├── stock/
│   │   ├── index.html
│   │   └── index.jsx
│   └── transcript/
│       ├── index.html
│       └── index.jsx
│
├── plugin/
│   ├── manifest.json
│   └── icons/
│
└── webpack.config.js         # Multi-entry (one per panel)
```

## Hierarchical FSM

### Shell FSM (top-level)

```
UNAUTHENTICATED → CONNECTING → READY → WORKING → REVIEWING → APPLYING
       ↑               ↑          ↑                    │          │
       └───────────────┘          └────────────────────┘          │
       (disconnect/logout)        (new project / reset)           │
                                  ←───────────────────────────────┘
```

6 states. V1's CONNECTED + PROJECT_LINKED merge into READY (project selection is UI within READY, not a separate state).

### Domain Sub-FSMs

| Domain | States |
|---|---|
| pipeline/ | idle → running → complete → failed |
| timeline/ | idle → previewing → applying → applied → rolled-back |

Auth and segments use signals only — simple enough without FSM.

### Composition

- Shell → WORKING triggers pipeline sub-FSM to `running`
- Pipeline `complete` emits `pipeline:complete` → shell → REVIEWING
- User applies → shell → APPLYING triggers timeline sub-FSM to `previewing`
- Timeline `applied` → shell → READY

### Connection Tracking

Orthogonal to the shell FSM. Lives in `shared/transport.js` as a signal: `disconnected | connecting | connected | reconnecting`. Status bar reads it directly. Pipeline handles its own WS→HTTP fallback internally.

## Event-Driven Adapter

### Intent → Event Model

Components emit intents. Adapters handle transport. Components never call fetch or touch WebSocket.

```
Component → bus.emit('pipeline:start', { projectId })
Adapter   → listens, calls transport, emits result
Component → reads updated signals
```

### Event Naming

```
{domain}:{action}      — intents (components emit)
{domain}:{past-tense}  — results (adapters emit)
{domain}:error         — failures
ws:{type}              — raw WebSocket messages (transport emits)
```

### Transport Layer

Single module, three responsibilities:

1. **HTTP** — get/post/patch with auto auth token injection, `{ ok, data, error }` envelopes
2. **WebSocket** — managed lifecycle, auth handshake, heartbeat, reconnect (exponential backoff, max 5)
3. **Fallback** — auto-switch to HTTP polling if WS fails. Transparent to adapters.

Auth threading: transport reads the token signal directly. 401 triggers auto-refresh, retries once, then emits `auth:expired`.

Base URL configurable via `transport.configure({ baseUrl, wsUrl })`. Read from localStorage with fallback to `localhost:8000`.

## Signals & Cross-Domain Data Flow

### Signal Types Per Domain

1. **Core state** — writable only by that domain's adapter
2. **Derived** — computed from core state
3. **UI state** — writable by components, domain-local

### Cross-Domain Rules

- **No domain writes another domain's signals**
- **Read-only signal imports allowed** — e.g., stock reads segments' approvals
- **Mutations cross domains via EventBus only** — e.g., `pipeline:complete` carries the edit package, segments adapter parses it

### Multi-Panel Signal Sync

Panels run in separate JS contexts. Each panel's adapters hydrate from BroadcastChannel events independently. The transport layer broadcasts all adapter result events (e.g., `pipeline:complete`, `segments:approved`) to sibling panels via a `editorlens-sync` BroadcastChannel. Intents and UI state are not broadcast — only backend-sourced state changes. No SharedWorker dependency (UXP Worker support is limited). Brief cross-panel sync delay is acceptable.

## Error Handling

### Three Tiers

| Tier | Scope | Display | Clears |
|---|---|---|---|
| Inline | Domain-specific, field-level | `sp-help-text` next to relevant UI | On next user action |
| Toast | Cross-cutting backend errors | `sp-toast` stack, max 3 visible | Auto-dismiss 5s |
| Status bar | Connection-level | Persistent footer, colored dot | On reconnect |

### Four Categories

| Category | Tier | Example |
|---|---|---|
| validation | Inline | "Project name required" |
| backend | Toast | "Pipeline failed: transcription timeout" |
| transport | Status bar | "WebSocket disconnected, retrying in 5s" |
| premiere | Toast | "Failed to access active sequence" |

### Flow

Adapter catches error → categorizes → domain error writes inline signal, transport error updates connectionState, unexpected error fires toast.

## Styling

### Spectrum Token Utilities

~40 CSS utility classes mapped to Spectrum CSS custom properties. Auto-adapts to Premiere light/dark theme.

Categories: layout (flex, gap), spacing (p, m variants), typography (text-sm/md/lg, text-muted), surfaces (surface, bordered), status colors (text-positive/negative/notice).

### Component Styling

- Standard controls: Spectrum Web Components (`sp-button`, `sp-textfield`, `sp-progress-bar`, `sp-toast`)
- Layout and spacing: utility classes
- Domain-specific visuals (heatmap, knowledge graph): scoped CSS files in the domain directory

### No Inline Styles

All styling through utility classes or scoped CSS. Zero `style={}` in JSX.

## UXP Integration

### Panel Lifecycle

```js
export function show() {
  // init bus → init transport → render Preact root
}
export function hide() {
  // disconnect transport → clear bus → unmount Preact
}
```

Transport connects on show, disconnects on hide. Preact unmounts on hide. BroadcastChannel stays open for rehydration on reopen.

### Premiere API Wrapper

- Lazy module loading: `premierepro` resolved on first access
- `safe(fn)` wrapper: never throws, returns `{ ok, data, error }`
- Version fallback chains centralized (v25.6+ async → legacy property)
- Tick conversion: `TICKS_PER_SECOND = 254016000000`

### Manifest

- UXP v5, Premiere Pro 25.6+
- 3 panel entrypoints
- Network domains: localhost:8000/8001, Pexels, Pixabay, FAL.run, OpenRouter, Speechmatics
- localFileSystem: fullAccess
- launchProcess for media files

## Testing

### Three Levels

| Level | What | Tooling |
|---|---|---|
| Unit | Domain signals + adapter logic | Vitest |
| Integration | Cross-domain event chains | Vitest + real EventBus |
| Component | Preact rendering + intent emission | @testing-library/preact |

### What We Don't Test

- UXP/Premiere API calls — mocked behind `shared/premiere.js`, tested manually in Premiere
- Visual regression — not worth the complexity for a panel plugin
- E2E through backend — that's mk12-backend's test suite

### Key Principle

Never mock the EventBus between domains. Use the real bus, mock only transport responses.

## Backend Endpoints (Carried from v1)

| Endpoint | Method | Domain |
|---|---|---|
| /api/health | GET | shell |
| /api/auth/login | POST | auth |
| /api/auth/refresh | POST | auth |
| /api/projects | GET/POST | shell (project selection in READY) |
| /api/projects/{id} | GET | shell |
| /api/projects/{id}/pipeline/start | POST | pipeline |
| /api/projects/{id}/pipeline/status | GET | pipeline (HTTP fallback) |
| /api/projects/{id}/segments/bulk | PATCH | segments |
| /api/projects/{id}/asset-manifest | GET | stock |
| /api/projects/{id}/analyze-assets | POST | stock |
| /api/projects/{id}/generate-script | POST | timeline |
| /api/projects/{id}/export | POST/GET | export |
| /api/projects/{id}/transcript | GET | transcript |
| /api/projects/{id}/knowledge | GET | knowledge |
| /api/projects/{id}/marks | GET | segments |
| /api/projects/{id}/annotations | GET/POST | segments |
| /api/stock/search | GET | stock |
| /api/projects/{id}/research/{conceptId} | GET | knowledge |
| /api/projects/{id}/segments/{segmentId}/generate-image | POST | segments |

WebSocket channels:
- `ws://host/ws/premiere/:projectId` — analysis streaming (NDJSON)
- `ws://host/ws/collab/:projectId` — collaboration/presence (future)

## Migration Notes

### What Carries Over from v1

- TimelineTransaction operation ordering logic (remove → trim → speed → move → insert → transition → marker)
- ProtocolV3 edit package schema and parsing
- Premiere API version fallback chains
- Tick conversion constants
- ErrorHandler categorization concept (refined to 4 categories)
- EventBus whitelist + max listener patterns
- WebSocket reconnect strategy (exponential backoff, max 5)

### What's New in v2

- Domain module isolation (no file > 300 lines)
- Preact components replace el() factory
- Preact Signals replace manual state + EventBus-for-UI
- Hierarchical FSM replaces flat 7-state machine
- Multi-panel with native Premiere docking
- BroadcastChannel for cross-panel sync
- Utility CSS on Spectrum tokens replaces inline styles
- Vitest test suite
- Configurable base URL (no hardcoded localhost)
- Transport-level auto auth and token refresh
