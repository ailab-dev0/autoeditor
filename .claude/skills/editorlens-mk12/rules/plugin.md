# Premiere Pro Plugin Rules

## Architecture
- **Pure vanilla JS** — no TypeScript, React, npm, or bundlers. UXP v7 runtime only.
- **Adobe Spectrum Web Components** — `sp-button`, `sp-textfield`, `sp-dropdown`, `sp-progress-bar`, `sp-toast`
- **ESM imports** for own modules, `require('premierepro')` only for UXP host APIs
- **300px sidebar** panel, expandable to 450px

## File Structure
```
mk12-premiere-plugin/
├── src/core/          — Business logic (UXP-agnostic, testable)
│   ├── StateMachine.js    — 6-state machine with crash recovery
│   ├── StateSnapshot.js   — Ring buffer localStorage persistence
│   ├── EventBus.js        — Typed pub/sub (13 event types + wildcard)
│   └── ProtocolV3.js      — Edit Package v3 validation/parsing
├── src/adapters/      — UXP integration layer
│   ├── PremiereAPI.js     — Sequence, marker, track, clip, playhead ops
│   ├── WebSocketManager.js — Auto-reconnect + HTTP fallback + NDJSON
│   ├── TimelineHeatmap.js — Marker-based heatmap (batched, 200+ markers)
│   └── TimelineTransaction.js — Atomic timeline modifications
├── src/components/    — UI components
│   ├── SegmentVirtualList.js — Virtual scrolling, 52px rows, multi-select
│   ├── ProgressPanel.js   — 5-stage analysis progress
│   └── ConfidenceRibbon.js — SVG confidence bars
├── src/utils/         — Shared utilities
└── src/LensApp.js     — Root controller (state-driven rendering)
```

## State Machine
States: `DISCONNECTED` → `CONNECTED` → `PROJECT_LINKED` → `ANALYZING` → `RESULTS_READY` → `APPLIED`

All states can return to `DISCONNECTED`. Recovery from localStorage snapshot on UXP reload.

## Key Patterns
- Every class has `destroy()` with `_destroyed` guard
- PremiereAPI methods return `{ ok: boolean, data?, error? }` — never throw
- Marker operations batched in groups of 50 via `executeTransaction()`
- Timeline modifications ordered: removes (desc index) → trims → speed → moves → transitions
- Confirmation dialog required before Apply mode
- Keyboard shortcuts: J/K (nav), A/R (approve/reject), Space (play), P (preview), Enter (apply)
