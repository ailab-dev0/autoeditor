# UXP Production Best Practices

Patterns and practices for building stable, performant UXP plugins.

## Locked Access + Transaction Pattern

The production-recommended pattern for all mutations:

```javascript
const ppro = require("premierepro");

async function safeEdit(description, buildActions) {
  const project = await ppro.Project.getActiveProject();
  await project.lockedAccess(async () => {
    await project.executeTransaction(async (compoundAction) => {
      await buildActions(compoundAction, project);
    }, description);
  });
}

// Usage
await safeEdit("Trim all clips", async (compoundAction, project) => {
  const sequence = await project.getActiveSequence();
  const track = sequence.getVideoTrack(0);
  const clips = track.getTrackItems(ppro.Constants.TrackItemType.CLIP, false);
  for (const clip of clips) {
    const action = clip.createSetEndAction(ppro.TickTime.createWithSeconds(30));
    compoundAction.addAction(action);
  }
});
```

## CRITICAL: lockedAccess is Synchronous

The callback passed to lockedAccess() is synchronous — you cannot use await inside it.
But executeTransaction's callback IS async. The correct nested pattern:

```javascript
await project.lockedAccess(() => {
  // This outer callback is SYNC
  project.executeTransaction(async (compoundAction) => {
    // This inner callback IS async
    await someAsyncSetup();
    compoundAction.addAction(action);
  }, "My Edit");
});
```

## Version-Safe API Access

```javascript
function safeCall(obj, method, ...args) {
  if (obj && typeof obj[method] === "function") {
    return obj[method](...args);
  }
  console.warn(`[Plugin] ${method} not available on`, obj);
  return null;
}
```

## Graceful Degradation for Older Premiere Versions

```javascript
async function getVideoTracksSafe(sequence) {
  if (typeof sequence.getVideoTrackCount === "function") {
    const count = sequence.getVideoTrackCount();
    const tracks = [];
    for (let i = 0; i < count; i++) tracks.push(sequence.getVideoTrack(i));
    return tracks;
  }
  // Legacy fallback
  if (sequence.videoTracks) {
    const tracks = sequence.videoTracks;
    const count = tracks.numTracks || tracks.length || 0;
    const result = [];
    for (let i = 0; i < count; i++) result.push(tracks[i]);
    return result;
  }
  return [];
}
```

## Batch Operations with Progress Feedback

```javascript
async function batchProcess(items, processFn, batchSize = 50) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processFn));
    results.push(...batchResults);
    await new Promise(resolve => setTimeout(resolve, 0)); // yield to UI
  }
  return results;
}
```

## Robust WebSocket with Auto-Reconnect

```javascript
class ResilientWebSocket {
  constructor(url, options = {}) {
    this.url = url;
    this.maxRetries = options.maxRetries || 5;
    this.baseDelay = options.baseDelay || 1000;
    this.maxDelay = options.maxDelay || 30000;
    this.retries = 0;
    this.handlers = { message: [], open: [], close: [], error: [] };
  }

  connect() {
    this.ws = new WebSocket(this.url);
    this.ws.onopen = () => {
      this.retries = 0;
      this.handlers.open.forEach(fn => fn());
    };
    this.ws.onmessage = (e) => this.handlers.message.forEach(fn => fn(e));
    this.ws.onerror = (e) => this.handlers.error.forEach(fn => fn(e));
    this.ws.onclose = () => {
      this.handlers.close.forEach(fn => fn());
      if (this.retries < this.maxRetries) {
        const delay = Math.min(this.baseDelay * Math.pow(2, this.retries), this.maxDelay);
        this.retries++;
        setTimeout(() => this.connect(), delay);
      }
    };
  }

  on(event, handler) { this.handlers[event].push(handler); }
  send(data) { if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(data); }
  close() { this.maxRetries = 0; this.ws?.close(); }
}
```

## Network Gotchas Quick Reference

| Issue | Symptom | Fix |
|-------|---------|-----|
| requiredPermissions inside host array | All network calls silently fail | Move to manifest root level |
| "domains": ["all"] (array) | Network denied | Use "domains": "all" (string) |
| localhost in fetch | "Network request failed" on macOS | Use 127.0.0.1 |
| 127.0.0.1 in WebSocket domain | Silent connection failure | Use localhost in manifest |
| Missing ws:// in domains | WebSocket silently never connects | Add ws://localhost/ |
| Self-signed HTTPS certs | "Network error" no detail | Use HTTP via localhost proxy |
| response.blob() | Returns empty/undefined | Use response.arrayBuffer() then new Blob([buffer]) |
| FormData file upload | Empty payload sent | Instantiate FormData inside upload function |
| HTTP error (404/500) | Promise resolves (not rejects) | Check response.ok explicitly |
| WebSocket onerror | Event object is {} | Cannot debug from error; verify server independently |
| Manifest not reloaded | Old permissions cached | Full plugin unload/reload in UDT |

## Singleton State Management

```javascript
class PluginState {
  static #instance;
  #state = {};

  static getInstance() {
    if (!PluginState.#instance) PluginState.#instance = new PluginState();
    return PluginState.#instance;
  }

  get(key) { return this.#state[key]; }
  set(key, value) { this.#state[key] = value; }
  save() { localStorage.setItem("pluginState", JSON.stringify(this.#state)); }
  load() {
    try {
      const saved = localStorage.getItem("pluginState");
      if (saved) this.#state = JSON.parse(saved);
    } catch (_) { /* corrupted — start fresh */ }
  }
}
```

## React Error Boundary

```jsx
class UXPErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("[Plugin Error]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return <sp-body>Something went wrong. Check the console.</sp-body>;
    }
    return this.props.children;
  }
}
```

## Minimize API Calls

```javascript
// BAD: API call per property per clip
for (const clip of clips) {
  const name = clip.getName();
  const start = clip.getStartTime();
  const end = clip.getEndTime();
}

// BETTER: Collect data in one pass, process later
const clipData = clips.map(clip => ({
  name: clip.getName(),
  start: clip.getStartTime(),
  end: clip.getEndTime(),
}));
```

## Cleanup Pattern for Premiere

Since panel `hide()` and `destroy()` hooks are unreliable in Premiere, `plugin.destroy()` is the **only** reliable cleanup hook. Use it for all teardown:

```javascript
entrypoints.setup({
  plugin: {
    destroy() {
      ws?.close();
      PluginState.getInstance().save();
      clearInterval(pollingTimer);
      return Promise.resolve();
    }
  }
});
```

## Manifest Validation

- Always validate manifest.json with a JSON linter — misplaced bracket = "Plugin Load Failed" with no error
- `host` must be a single object for production (arrays only for development multi-host)
- Every network domain must be whitelisted (ws:// and wss:// separately)
- `enableSWCSupport: true` required in featureFlags for Spectrum Web Components
