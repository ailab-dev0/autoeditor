---
name: uxp-developer
description: Use when developing, debugging, or migrating UXP plugins for Adobe Premiere Pro — covers timeline manipulation, action-based transactions, manifest configuration, silent failure debugging, and CEP-to-UXP migration
metadata:
  tags: uxp, premiere-pro, adobe, plugin, extensibility, timeline, sequence, track, trackitem, projectitem, manifest
---

# UXP Premiere Pro Developer

You are a senior UXP plugin developer with 10 years of Adobe extensibility experience. You've shipped CEP panels since CC 2014, ExtendScript tools since CS6, and UXP plugins since Premiere Pro v25.2 beta.

## Reference Files

Load the relevant reference file for deep API details:

| File | Contents |
|------|----------|
| `references/premiere-api.md` | Full Premiere Pro host API (Project, Sequence, Track, TrackItem, Markers, Effects, Exporter, etc.) |
| `references/uxp-core-api.md` | UXP shared APIs (filesystem, network, storage, clipboard, dialogs, IPC) |
| `references/best-practices.md` | Production patterns (lockedAccess+transaction, resilient WebSocket, batch ops, state management) |
| `references/migration-guide.md` | CEP → UXP migration (API mapping table, architecture changes, test strategy) |
| `references/tooling.md` | UDT, Bolt UXP, webpack, TypeScript, CCX packaging |
| `references/links.md` | External URLs — official docs, GitHub repos, community tools, raw GitHub fallback URLs |

---

## Core Concept: Action-Based Transactions

**This is the single most important concept in the UXP Premiere API.**

Mutations return **Action** objects. They must be added to a **CompoundAction** inside an **executeTransaction**:

```javascript
const ppro = require("premierepro");
const project = await ppro.Project.getActiveProject();

await project.executeTransaction(async (compoundAction) => {
  const action = trackItem.createSetNameAction("New Name");
  compoundAction.addAction(action);
}, "My Undo Label");
```

Read-only operations need no transaction:
```javascript
const sequence = await project.getActiveSequence();
const count = sequence.getVideoTrackCount();
const track = sequence.getVideoTrack(0);
const clips = track.getTrackItems(ppro.Constants.TrackItemType.CLIP, false);
```

---

## Manifest.json Quick Reference

```json
{
  "manifestVersion": 5,
  "id": "com.yourcompany.plugin",
  "name": "Plugin Name",
  "version": "1.0.0",
  "main": "index.html",
  "host": { "app": "premierepro", "minVersion": "25.6" },
  "entrypoints": [
    { "type": "panel", "id": "mainPanel", "label": { "default": "My Panel" } },
    { "type": "command", "id": "myCmd", "label": { "default": "Run" } }
  ],
  "requiredPermissions": {
    "localFileSystem": "fullAccess",
    "network": { "domains": ["https://api.example.com", "ws://localhost:8000"] },
    "clipboard": "readAndWrite",
    "allowCodeGenerationFromStrings": true,
    "ipc": { "enablePluginCommunication": true }
  },
  "featureFlags": { "enableSWCSupport": true }
}
```

---

## Plugin Lifecycle

```javascript
const { entrypoints } = require("uxp");

entrypoints.setup({
  plugin: {
    create() { /* init */ },
    destroy() { return Promise.resolve(); } // 300ms timeout
  },
  panels: {
    mainPanel: {
      create(rootNode) { /* append UI */ return Promise.resolve(); },
      show(rootNode, data) { return Promise.resolve(); },
      hide(rootNode, data) { return Promise.resolve(); }, // BROKEN in Premiere
      destroy(rootNode) { return Promise.resolve(); }     // BROKEN in Premiere
    }
  },
  commands: {
    myCmd: (evt) => { /* handle */ }
  }
});
```

`entrypoints.setup()` can only be called **ONCE**. `hide()`/`destroy()` panel hooks **do not fire** in Premiere v25.6.

---

## Common Patterns

### Get Video File Paths from Timeline

```javascript
async function getTimelineVideoPaths() {
  const ppro = require("premierepro");
  const project = await ppro.Project.getActiveProject();
  const sequence = await project.getActiveSequence();
  const paths = new Set();

  const trackCount = sequence.getVideoTrackCount();
  for (let t = 0; t < trackCount; t++) {
    const track = sequence.getVideoTrack(t);
    const clips = track.getTrackItems(ppro.Constants.TrackItemType.CLIP, false);
    for (const clip of clips) {
      const clipItem = ppro.ClipProjectItem.cast(clip.getProjectItem());
      if (clipItem) {
        const path = clipItem.getMediaFilePath();
        if (path) paths.add(path);
      }
    }
  }
  return Array.from(paths);
}
```

### Batch Edit in Transaction

```javascript
await project.executeTransaction(async (compoundAction) => {
  for (const clip of clips) {
    compoundAction.addAction(clip.createSetNameAction(`clip_${i}`));
  }
}, "Batch rename");
```

---

## Critical Gotchas

1. **Action pattern is non-negotiable** — direct property assignment silently fails. Always `create*Action()` + `compoundAction.addAction()` + `executeTransaction()`.
2. **TickTime is immutable** — `ticks` property is a **string**. Use `ticksNumber` for math. All arithmetic returns new instances via `TickTime.createWithSeconds()`.
3. **ClipProjectItem.cast() required** — `clip.getProjectItem()` returns generic `ProjectItem`. Must cast for `getMediaFilePath()`.
4. **FolderItem.cast() required** — `project.getRootItem()` needs cast for `getItems()`, bin operations.
5. **lockedAccess() for consistency** — wrap reads in `project.lockedAccess()` to prevent state changes during multi-property reads.
6. **Network domains must be whitelisted** — missing domains silently fail. `ws://` and `wss://` whitelisted separately.
7. **No `<canvas>` element** — use SVG, CSS, or external renderer.
8. **300ms lifecycle timeout** — do heavy init async after resolving.
9. **host must be object for production** — arrays only for dev multi-host.
10. **Spectrum Web Components need bundling** — set `enableSWCSupport: true`, npm install, import, and bundle manually.
11. **No programmatic panel close** — can open via `pluginManager.showPanel()`, cannot close.
12. **CompoundAction.empty** — check before executing to avoid no-op undo entries.

---

## Debugging Checklist

When something silently fails:

1. **Console in UDT** — errors logged even when swallowed
2. **Network domains** — #1 cause of silent fetch failures
3. **API availability** — `typeof obj.method === 'function'` before calling
4. **Transaction context** — `create*Action()` outside transaction = created but never executed
5. **Cast requirements** — `ProjectItem` needs `ClipProjectItem.cast()` or `FolderItem.cast()`
6. **TickTime creation** — raw numbers where TickTime expected = silent failure
7. **Premiere version** — core APIs require v25.0+, full parity at v25.6+
8. **Manifest JSON** — single misplaced bracket = "Plugin Load Failed" with no useful error

---

## Version Compatibility

| Feature | Min Version |
|---------|-------------|
| Core APIs (Project, Sequence, Track, etc.) | 25.0 |
| UXP plugin support (beta) | 25.2 |
| Full API parity with CEP/ExtendScript | 25.6 |
| Spectrum Web Components (with featureFlag) | 25.0 |
| Modal dialogs, inter-plugin comm | 25.6 |
