# Plugin v2 UI Rebuild — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild all plugin UI components to match the revised design spec — minimal login, list-only projects, heatmap-first review, keyboard shortcuts, inline loading states.

**Architecture:** Preact + Preact Signals. Domain-module pattern with shell FSM router. Each component is a self-contained .jsx file with inline styles (UXP-safe). Components read signals and emit bus events. No external CSS dependencies.

**Tech Stack:** Preact 10, @preact/signals, Webpack 5, Vitest, @testing-library/preact

**Design Reference:** `mk12-premiere-plugin/src/design-preview.html` (serve on port 9999)

**Existing code:** 2196 lines across 17 components — most will be rewritten in place.

---

## File Map

### Shell (orchestration)
- Modify: `src/shell/Shell.jsx` — add keyboard event listener
- Modify: `src/shell/router.jsx` — update tab list (remove Export tab), pass keyboard handler
- Modify: `src/shell/status-bar.jsx` — add review progress + keyboard hint
- Modify: `src/shell/fsm.js` — no changes needed (states already correct)

### Auth Domain
- Rewrite: `src/domains/auth/components/LoginForm.jsx` — minimal layout, no branding wall
- Rewrite: `src/domains/auth/components/ServerConnect.jsx` — centered spinner, smaller
- Rewrite: `src/domains/auth/components/ProjectSelector.jsx` — list only, no detail panel
- Create: `src/domains/auth/components/NewProjectForm.jsx` — inline form (name + brief + tags)

### Pipeline Domain
- Rewrite: `src/domains/pipeline/components/MediaSelector.jsx` — compact checkboxes
- Rewrite: `src/domains/pipeline/components/ProgressPanel.jsx` — split: progress left + live log right

### Segments Domain
- Rewrite: `src/domains/segments/components/SegmentList.jsx` — heatmap-first, simplified cards, keyboard nav, finalize button
- Rewrite: `src/domains/segments/components/SegmentCard.jsx` — 3 things only: dot + topic + decision
- Keep: `src/domains/segments/components/ConfidenceRibbon.jsx` — used in detail panel only

### Timeline Domain
- Rewrite: `src/domains/timeline/components/HeatmapOverlay.jsx` — 32px tall, clickable, tooltips
- Rewrite: `src/domains/timeline/components/ApplySummary.jsx` — split layout: stats left + success right
- Create: `src/domains/timeline/components/BlueprintDetail.jsx` — AI vs Original side-by-side with keyboard hints
- Create: `src/domains/timeline/components/ExportReady.jsx` — download list + apply button

### Stock Domain
- Rewrite: `src/domains/stock/components/StockBrowser.jsx` — 3-column grid, compact

### Transcript Domain
- Rewrite: `src/domains/transcript/components/TranscriptView.jsx` — timecoded lines, cut markers

### Knowledge Domain
- Rewrite: `src/domains/knowledge/components/KnowledgeGraph.jsx` — split: concept list + detail

### Shared
- Create: `src/shared/keyboard.js` — keyboard shortcut handler (J/K/A/R/arrows)
- Modify: `src/shared/styles/utilities.css` — add any missing utility classes

### Tests
- Modify: `tests/shell/router.test.jsx`
- Create: `tests/shell/keyboard.test.js`
- Modify: `tests/domains/segments/components/SegmentList.test.jsx`

---

## Task 1: Keyboard Handler

**Files:**
- Create: `src/shared/keyboard.js`
- Create: `tests/shell/keyboard.test.js`

- [ ] **Step 1: Write keyboard handler**

```javascript
// src/shared/keyboard.js
import { signal } from '@preact/signals';

export const keyboardEnabled = signal(true);

const handlers = new Map();

export function onKey(key, callback) {
  handlers.set(key, callback);
  return () => handlers.delete(key);
}

export function handleKeyDown(e) {
  if (!keyboardEnabled.value) return;
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  const handler = handlers.get(e.key.toLowerCase());
  if (handler) {
    e.preventDefault();
    handler(e);
  }
}

export function clearKeys() {
  handlers.clear();
}
```

- [ ] **Step 2: Write test**

```javascript
// tests/shell/keyboard.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleKeyDown, onKey, clearKeys, keyboardEnabled } from '../../src/shared/keyboard';

describe('Keyboard Handler', () => {
  beforeEach(() => {
    clearKeys();
    keyboardEnabled.value = true;
  });

  it('calls registered handler on keypress', () => {
    const fn = vi.fn();
    onKey('j', fn);
    handleKeyDown({ key: 'j', preventDefault: vi.fn(), target: { tagName: 'DIV' } });
    expect(fn).toHaveBeenCalled();
  });

  it('ignores when focused on input', () => {
    const fn = vi.fn();
    onKey('j', fn);
    handleKeyDown({ key: 'j', preventDefault: vi.fn(), target: { tagName: 'INPUT' } });
    expect(fn).not.toHaveBeenCalled();
  });

  it('ignores when disabled', () => {
    const fn = vi.fn();
    onKey('j', fn);
    keyboardEnabled.value = false;
    handleKeyDown({ key: 'j', preventDefault: vi.fn(), target: { tagName: 'DIV' } });
    expect(fn).not.toHaveBeenCalled();
  });

  it('unsubscribes via returned function', () => {
    const fn = vi.fn();
    const unsub = onKey('j', fn);
    unsub();
    handleKeyDown({ key: 'j', preventDefault: vi.fn(), target: { tagName: 'DIV' } });
    expect(fn).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/shell/keyboard.test.js`
Expected: 4 tests pass

- [ ] **Step 4: Commit**

```bash
git add src/shared/keyboard.js tests/shell/keyboard.test.js
git commit -m "feat(plugin): keyboard shortcut handler"
```

---

## Task 2: Minimal Login

**Files:**
- Rewrite: `src/domains/auth/components/LoginForm.jsx`

- [ ] **Step 1: Rewrite LoginForm — minimal, no branding wall**

Replace entire file. Centered layout, just fields + button + error. No split panel. References design-preview.html Row 1 Frame 1.

Key changes from old version:
- Remove serverUrl signal import (put inline)
- Single column centered, max-width 280px
- "EditorLens" text at 18px, no tagline
- Server URL field collapsed (11px font)
- Error below button in red

- [ ] **Step 2: Update LoginForm test to match new structure**

The test checks for `form`, `sp-button`, and error text. Verify these still exist in new layout.

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/domains/auth`
Expected: All pass

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(plugin): minimal login — no branding wall"
```

---

## Task 3: Simplified Connecting + Connection Error

**Files:**
- Rewrite: `src/domains/auth/components/ServerConnect.jsx`

- [ ] **Step 1: Rewrite ServerConnect — centered spinner, compact**

Centered layout. Spinner circle (CSS animated border) + "Connecting..." + progress bar + server URL + cancel button. References design-preview.html Row 1 Frame 2.

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(plugin): compact connecting screen"
```

---

## Task 4: List-Only Project Selector + New Project Form

**Files:**
- Rewrite: `src/domains/auth/components/ProjectSelector.jsx`
- Create: `src/domains/auth/components/NewProjectForm.jsx`

- [ ] **Step 1: Rewrite ProjectSelector — list only, no detail pane**

Single column list. Each project card: name + metadata line + status badge. No split layout. "+ New" button opens inline form. "Log Out" at bottom. References design-preview.html Row 2 Frame 1.

- [ ] **Step 2: Create NewProjectForm**

Inline form: name input + brief textarea + tag pills + create/cancel buttons. Shown when "+ New" clicked in ProjectSelector. Emits project creation via transport.post.

- [ ] **Step 3: Update router if needed**

ProjectSelector now imports NewProjectForm. Router doesn't change — it's within the READY state.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(plugin): list-only projects + inline new project form"
```

---

## Task 5: Compact Media Selector

**Files:**
- Rewrite: `src/domains/pipeline/components/MediaSelector.jsx`

- [ ] **Step 1: Rewrite MediaSelector — compact, no file paths shown by default**

Each item: checkbox + filename + duration + type badge. No file paths (too long for panel). All/None toggle. Back + Analyze buttons. References design-preview.html Row 2 Frame 3.

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(plugin): compact media selector"
```

---

## Task 6: Pipeline Progress with Live Log

**Files:**
- Rewrite: `src/domains/pipeline/components/ProgressPanel.jsx`

- [ ] **Step 1: Rewrite ProgressPanel — split: progress left + log right**

Left panel: stages dots + progress bar + stage message + cancel. Right panel: monospace live log (scrollable) + ETA + cost. References design-preview.html Row 3 Frame 1.

Add a `pipelineLog` signal in pipeline/signals.js to accumulate log entries.

- [ ] **Step 2: Add pipelineLog signal**

```javascript
// Add to src/domains/pipeline/signals.js
export const pipelineLog = signal([]);
```

- [ ] **Step 3: Update pipeline adapter to push log entries**

In the progress handler, push entries to pipelineLog.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(plugin): pipeline progress with live log panel"
```

---

## Task 7: Heatmap-First Blueprint Review

This is the largest task — the main review screen.

**Files:**
- Rewrite: `src/domains/timeline/components/HeatmapOverlay.jsx` — 32px tall, clickable
- Rewrite: `src/domains/segments/components/SegmentCard.jsx` — 3 items only
- Rewrite: `src/domains/segments/components/SegmentList.jsx` — heatmap + simplified cards + keyboard nav + finalize
- Create: `src/domains/timeline/components/BlueprintDetail.jsx` — AI vs Original side-by-side
- Rewrite: `src/shell/router.jsx` — pass keyboard handler, remove Export tab

- [ ] **Step 1: Rewrite HeatmapOverlay — 32px, clickable, tooltips**

Each block has title attribute with segment info. Click emits segments:select. Dashed top border for low confidence. Duration labels at ends. "TIMELINE HEATMAP" label. References design-preview.html Row 4, left panel top.

- [ ] **Step 2: Rewrite SegmentCard — simplified to 3 things**

Just: colored dot (10px) + topic name + decision emoji (🤖/👤/none). Time + role in secondary line. No confidence bar in the card (moved to detail panel). References design-preview.html Row 4, segment list items.

- [ ] **Step 3: Create BlueprintDetail — AI vs Original side-by-side**

Reads selected segment from signal. Shows: role badge + importance + confidence in header. Topic title + transcript text + timecode. Two review cards: AI path (with material thumbnail) + Original path. Accept/Reject buttons with keyboard hints (A/R). "Open in Browser" link. AI Analysis explanation. References design-preview.html Row 4, right panel.

Needs new signals:
```javascript
// Add to src/domains/timeline/signals.js
export const selectedBlueprintSegment = signal(null);
```

- [ ] **Step 4: Rewrite SegmentList — compose all pieces**

Layout: HeatmapOverlay (top) + filter pills + segment card list (scrollable) + footer with Finalize button + keyboard hints (J/K/A/R). Right side: BlueprintDetail.

Wire keyboard shortcuts: J = select prev, K = select next, A = accept AI, R = reject/keep original.

- [ ] **Step 5: Update router — remove Export tab, wire keyboard**

Tab bar: Segments, Stock, Transcript, Knowledge (no Export). The Shell.jsx adds keydown listener to the outer div.

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(plugin): heatmap-first review with keyboard shortcuts"
```

---

## Task 8: Stock, Transcript, Knowledge Tabs

**Files:**
- Rewrite: `src/domains/stock/components/StockBrowser.jsx`
- Rewrite: `src/domains/transcript/components/TranscriptView.jsx`
- Rewrite: `src/domains/knowledge/components/KnowledgeGraph.jsx`

- [ ] **Step 1: Rewrite StockBrowser — 3-column grid, compact**

Search bar + provider toggle pills + 3-column result grid. Selected item has blue border. Each card: gradient placeholder + title + duration + source. References design-preview.html Row 5 Frame 1.

- [ ] **Step 2: Rewrite TranscriptView — timecoded lines with cut markers**

Monospace timecodes + text. Selected line highlighted blue. Filler lines dimmed with strikethrough + CUT badge. Speaker info bar. SRT/JSON/TXT export buttons. References design-preview.html Row 5 Frame 2.

- [ ] **Step 3: Rewrite KnowledgeGraph — split list + detail**

Left: concept cards with connection count badge. Right: selected concept detail (description, relationships, segment appearances). References design-preview.html Row 5 Frame 3.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(plugin): polished stock, transcript, knowledge tabs"
```

---

## Task 9: Finalize & Apply

**Files:**
- Create: `src/domains/timeline/components/ExportReady.jsx`
- Rewrite: `src/domains/timeline/components/ApplySummary.jsx`

- [ ] **Step 1: Create ExportReady — download list + apply confirmation**

Split layout. Left: file list (Premiere XML, FCPXML, EDL, JSON) with download links. Right: "Apply to Timeline?" with operation summary + big Apply button. References design-preview.html Row 6 Frame 1.

This is shown when project status = 'ready' (after finalize). Wire to `GET /api/projects/:id/finalize/status` and `GET /api/projects/:id/finalize/download?format=`.

- [ ] **Step 2: Rewrite ApplySummary — split: stats + success**

Left: "Timeline Updated" + operation counts. Right: big green checkmark + "11 ops in 2.4s" + Rollback/Done buttons. References design-preview.html Row 6 Frame 2.

- [ ] **Step 3: Wire finalize flow in router/FSM**

When user clicks "Finalize & Export" in SegmentList → POST /api/projects/:id/finalize → show ExportReady → user clicks "Apply to Timeline" → APPLYING state → ApplySummary.

Need a new state or reuse APPLYING for both finalize-complete and timeline-applied.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(plugin): finalize export + apply to timeline"
```

---

## Task 10: Shell Integration + Status Bar + Tests

**Files:**
- Modify: `src/shell/Shell.jsx`
- Modify: `src/shell/status-bar.jsx`
- Modify: `tests/shell/router.test.jsx`

- [ ] **Step 1: Update Shell.jsx — add keyboard listener**

Attach `onKeyDown={handleKeyDown}` to the outer div. Import from shared/keyboard.js.

- [ ] **Step 2: Update status-bar — add review progress + keyboard hint**

When in REVIEWING state: show "X/Y reviewed" + progress bar + percentage. Always show "? help" keyboard badge.

- [ ] **Step 3: Update router tests**

Fix any assertions that reference removed Export tab or old component structure.

- [ ] **Step 4: Build + test full suite**

Run: `npx vitest run && npm run build`
Expected: All tests pass, webpack 0 warnings.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(plugin): shell integration, status bar, tests passing"
```

---

## Task 11: Build Verification + Preview Update

- [ ] **Step 1: Run full build**

```bash
npm run build
```
Expected: 0 warnings, dist/ has index.js

- [ ] **Step 2: Update browser preview**

Update `src/preview.jsx` to use the new components. Verify on port 9999 that all screens render.

- [ ] **Step 3: Run full test suite**

```bash
npx vitest run
```
Expected: All tests pass

- [ ] **Step 4: Final commit**

```bash
git commit -m "feat(plugin): v2 UI rebuild complete — all screens match design spec"
```

---

## Execution Notes

- Tasks 1-6 are independent and can be parallelized (3 agents max)
- Task 7 depends on Task 1 (keyboard handler)
- Tasks 8-9 depend on Task 7 (router changes)
- Task 10-11 depend on all previous tasks
- Each task should take 5-15 minutes for an agent
- Total estimated: ~2 hours sequential, ~45 min with parallel agents
