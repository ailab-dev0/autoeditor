/**
 * Transport layer — HTTP + WebSocket + polling fallback.
 *
 * Single module, three responsibilities:
 * 1. HTTP get/post/patch with auto auth token, {ok, data, error} envelopes
 * 2. WebSocket lifecycle with auth handshake, heartbeat, reconnect
 * 3. Auto-fallback to HTTP polling if WS fails
 */
import { signal } from '@preact/signals';

// ---------------------------------------------------------------------------
// Auth token — set by auth adapter after import, reads null until then
// ---------------------------------------------------------------------------
let tokenSignal = signal(null);

/** Allow auth domain to inject its token signal after import. */
export function setTokenSignal(sig) {
  if (sig) tokenSignal = sig;
}

/** @type {import('@preact/signals').Signal<'disconnected'|'connecting'|'connected'|'reconnecting'>} */
export const connectionState = signal('disconnected');

/** @type {import('@preact/signals').Signal<number>} */
export const reconnectAttempt = signal(0);

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const DEFAULT_BASE = 'http://localhost:8000';
const DEFAULT_WS = 'ws://localhost:8000';
const MAX_RECONNECT = 5;
const MAX_BACKOFF_MS = 30000;
const HEARTBEAT_MS = 15000;
const POLL_INTERVAL_MS = 5000;

// Events that get broadcast across panels
const SYNC_EVENTS = [
  'auth:logged-in', 'auth:logged-out', 'auth:expired',
  'pipeline:started', 'pipeline:complete', 'pipeline:cancelled',
  'segments:fetched', 'segments:approved', 'segments:rejected',
  'timeline:previewed', 'timeline:applied', 'timeline:rolled-back',
  'stock:results',
  'transcript:fetched',
  'export:completed',
  'knowledge:fetched',
];

function createTransport(bus) {
  let baseUrl = DEFAULT_BASE;
  let wsUrl = DEFAULT_WS;
  let ws = null;
  let heartbeatTimer = null;
  let pollTimer = null;
  let pollCallback = null;
  let syncChannel = null;

  // Try to read config from localStorage
  try {
    const stored = localStorage.getItem('editorlens-config');
    if (stored) {
      const cfg = JSON.parse(stored);
      if (cfg.baseUrl) baseUrl = cfg.baseUrl;
      if (cfg.wsUrl) wsUrl = cfg.wsUrl;
    }
  } catch (_) {}

  // BroadcastChannel for cross-panel sync
  try {
    syncChannel = new BroadcastChannel('editorlens-sync');
    syncChannel.onmessage = (e) => {
      if (e.data && e.data.event && bus) {
        try { bus.emit(e.data.event, e.data.data); } catch (_) {}
      }
    };
  } catch (_) {
    // BroadcastChannel may not be available in all UXP environments
  }

  function broadcastSync(event, data) {
    if (syncChannel && SYNC_EVENTS.includes(event)) {
      try { syncChannel.postMessage({ event, data }); } catch (_) {}
    }
  }

  // ---------------------------------------------------------------------------
  // HTTP
  // ---------------------------------------------------------------------------
  function authHeaders(hasBody) {
    const token = tokenSignal?.value;
    const headers = {};
    if (hasBody) headers['Content-Type'] = 'application/json';
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }

  async function httpRequest(method, path, body) {
    const url = `${baseUrl}${path}`;
    const hasBody = body !== undefined;
    const opts = { method, headers: authHeaders(hasBody) };
    if (hasBody) opts.body = JSON.stringify(body);

    try {
      let res = await fetch(url, opts);

      // 401 — skip retry for auth endpoints (they handle their own errors)
      if (res.status === 401) {
        if (path.startsWith('/api/auth/')) {
          return { ok: false, error: 'Invalid credentials' };
        }
        bus.emit('transport:auth-failed', { path, retryable: true });
        await new Promise(r => setTimeout(r, 500));
        opts.headers = authHeaders(hasBody);
        res = await fetch(url, opts);
        if (res.status === 401) {
          bus.emit('transport:auth-failed', { path, retryable: false });
          return { ok: false, error: 'Authentication expired' };
        }
      }

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        return { ok: false, error: data?.error || data?.message || `HTTP ${res.status}` };
      }
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }

  // ---------------------------------------------------------------------------
  // WebSocket
  // ---------------------------------------------------------------------------
  function connectWs(path) {
    if (ws) {
      try { ws.close(); } catch (_) {}
    }

    const fullUrl = `${wsUrl}${path}`;
    connectionState.value = 'connecting';

    try {
      ws = new WebSocket(fullUrl);
    } catch (err) {
      connectionState.value = 'disconnected';
      startPolling(path);
      return;
    }

    ws.onopen = () => {
      connectionState.value = 'connected';
      reconnectAttempt.value = 0;

      // Auth handshake
      const token = tokenSignal?.value;
      if (token) {
        ws.send(JSON.stringify({ type: 'auth', token }));
      }

      // Heartbeat
      clearInterval(heartbeatTimer);
      heartbeatTimer = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'heartbeat' }));
        }
      }, HEARTBEAT_MS);
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'pong' || msg.type === 'connected') return;

        // Map backend WS protocol → plugin internal events
        if (msg.type === 'pipeline_status') {
          // Backend: {type:'pipeline_status', payload:{stage,percentage,stages,error}}
          const p = msg.payload || msg;
          bus.emit('ws:analysis:progress', {
            stage: p.stage || p.current_stage || 'analysis',
            percent: p.percentage ?? p.overall_progress ?? 0,
            eta: p.eta || null,
            cost: p.cost || 0,
          });
        } else if (msg.type === 'analyze_response') {
          // Backend: {type:'analyze_response', payload:{stage,percentage,message,session_id}}
          const p = msg.payload || msg;
          bus.emit('ws:analysis:progress', {
            stage: p.stage || 'transcription',
            percent: p.percentage ?? 0,
          });
        } else if (msg.type === 'edit_package') {
          // Backend: {type:'edit_package', payload: <editPackage>}
          bus.emit('ws:analysis:complete', { editPackage: msg.payload });
        } else if (msg.type === 'analysis:progress') {
          bus.emit('ws:analysis:progress', msg);
        } else if (msg.type === 'analysis:complete') {
          bus.emit('ws:analysis:complete', msg);
        } else if (msg.type === 'error') {
          bus.emit('ws:error', msg.payload || msg);
        } else if (msg.type === 'segment_update') {
          // Segment sync from dashboard — update local state
          const p = msg.payload || msg;
          if (p.segmentId) {
            bus.emit(p.approved ? 'segments:approve' : 'segments:reject', { segmentId: p.segmentId });
          }
        } else if (msg.type === 'project_update') {
          // Dashboard commands — e.g. "send to timeline"
          const p = msg.payload || msg;
          if (p.action === 'timeline_import') {
            // Fetch latest segments then trigger import
            bus.emit('segments:fetch', { projectId: p.projectId });
            // Small delay to let segments load, then trigger import
            setTimeout(() => bus.emit('timeline:import', {}), 2000);
          }
        }
      } catch (_) {}
    };

    ws.onclose = () => {
      clearInterval(heartbeatTimer);
      if (reconnectAttempt.value < MAX_RECONNECT) {
        connectionState.value = 'reconnecting';
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempt.value), MAX_BACKOFF_MS);
        reconnectAttempt.value++;
        setTimeout(() => connectWs(path), delay);
      } else {
        connectionState.value = 'disconnected';
        startPolling(path);
      }
    };

    ws.onerror = () => {};
  }

  // ---------------------------------------------------------------------------
  // HTTP polling fallback
  // ---------------------------------------------------------------------------
  function startPolling(wsPath) {
    stopPolling();
    const pollPath = wsPath.replace(/^\/ws\//, '/api/projects/').replace(/\/([^/]+)$/, '/$1/pipeline/status');
    pollTimer = setInterval(async () => {
      const result = await httpRequest('GET', pollPath);
      if (result.ok && pollCallback) pollCallback(result.data);
    }, POLL_INTERVAL_MS);
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------
  return {
    configure({ baseUrl: b, wsUrl: w } = {}) {
      if (b) baseUrl = b;
      if (w) wsUrl = w;
    },

    getBaseUrl() { return baseUrl; },

    get: (path) => httpRequest('GET', path),
    post: (path, body) => httpRequest('POST', path, body),
    patch: (path, body) => httpRequest('PATCH', path, body),
    put: (path, body) => httpRequest('PUT', path, body),

    connectWs,

    onPoll(callback) { pollCallback = callback; },

    broadcastSync,

    disconnect() {
      clearInterval(heartbeatTimer);
      stopPolling();
      if (ws) {
        try { ws.close(); } catch (_) {}
        ws = null;
      }
      connectionState.value = 'disconnected';
      reconnectAttempt.value = 0;
    },
  };
}

export { createTransport };
