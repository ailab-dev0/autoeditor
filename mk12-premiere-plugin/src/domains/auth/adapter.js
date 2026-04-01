/**
 * Auth adapter — handles login, refresh, logout intents via transport.
 *
 * Connection enforcement: EVERY path to authenticated state goes through
 * a health check first. No proceeding without a confirmed backend connection.
 *
 * Flow: login/auto-login → CONNECTING → health check → READY
 */
import { token, user, loginError } from './signals.js';
import { setTokenSignal } from '../../shared/transport.js';
import { connectionState } from '../../shared/transport.js';

export function setupAuthAdapter(bus, transport) {
  setTokenSignal(token);

  /**
   * Verify backend connection before allowing authenticated state.
   * Returns true if connected, false if not.
   */
  async function verifyConnection() {
    connectionState.value = 'connecting';
    try {
      const res = await transport.get('/api/health');
      if (res.ok) {
        connectionState.value = 'connected';
        return true;
      }
    } catch {}
    connectionState.value = 'disconnected';
    return false;
  }

  // ── Login ──────────────────────────────────────────────────
  bus.on('auth:login', async ({ email, password }) => {
    loginError.value = null;

    // Step 1: Check backend is reachable
    bus.emit('shell:connecting', {});
    const connected = await verifyConnection();
    if (!connected) {
      loginError.value = 'Cannot reach server. Check the URL and try again.';
      return;
    }

    // Step 2: Authenticate
    const res = await transport.post('/api/auth/login', { email, password });
    if (res.ok) {
      token.value = res.data.token;
      user.value = res.data.user;
      try {
        localStorage.setItem('editorlens:token', res.data.token);
        localStorage.setItem('editorlens:user', JSON.stringify(res.data.user));
      } catch {}
      bus.emit('auth:logged-in', { user: res.data.user });
    } else {
      loginError.value = res.error || 'Login failed';
    }
  });

  // ── Health check (from ServerConnect) ──────────────────────
  bus.on('health:check', async () => {
    const connected = await verifyConnection();
    if (!connected) {
      // Stay in CONNECTING — ServerConnect shows the error
      loginError.value = 'Server unreachable';
    }
  });

  // ── Refresh ────────────────────────────────────────────────
  bus.on('auth:refresh', async () => {
    if (!token.value) return;
    const res = await transport.post('/api/auth/refresh', { token: token.value });
    if (res.ok) {
      token.value = res.data.token;
      try { localStorage.setItem('editorlens:token', res.data.token); } catch {}
      bus.emit('auth:refreshed', {});
    } else {
      token.value = null;
      user.value = null;
      try { localStorage.removeItem('editorlens:token'); localStorage.removeItem('editorlens:user'); } catch {}
      bus.emit('auth:expired', {});
    }
  });

  // ── Logout ─────────────────────────────────────────────────
  bus.on('auth:logout', () => {
    token.value = null;
    user.value = null;
    loginError.value = null;
    connectionState.value = 'disconnected';
    try { localStorage.removeItem('editorlens:token'); localStorage.removeItem('editorlens:user'); } catch {}
    bus.emit('auth:logged-out', {});
  });

  // ── Auto-login with stored token ──────────────────────────
  // Must verify connection BEFORE emitting auth:logged-in
  if (token.value) {
    (async () => {
      // Transition to CONNECTING first
      bus.emit('shell:connecting', {});

      // Verify backend is reachable
      const connected = await verifyConnection();
      if (!connected) {
        // Can't reach backend — clear token, go back to login
        token.value = null;
        user.value = null;
        try { localStorage.removeItem('editorlens:token'); localStorage.removeItem('editorlens:user'); } catch {}
        bus.emit('auth:expired', {});
        return;
      }

      // Verify token is still valid
      const res = await transport.get('/api/projects');
      if (res.ok) {
        bus.emit('auth:logged-in', { user: user.value });
      } else {
        token.value = null;
        user.value = null;
        try { localStorage.removeItem('editorlens:token'); localStorage.removeItem('editorlens:user'); } catch {}
        bus.emit('auth:expired', {});
      }
    })();
  }

  // ── Transport auth failure ─────────────────────────────────
  bus.on('transport:auth-failed', ({ retryable }) => {
    if (!token.value) return;
    if (retryable) {
      bus.emit('auth:refresh', {});
    } else {
      token.value = null;
      user.value = null;
      loginError.value = 'Authentication expired';
      connectionState.value = 'disconnected';
      try { localStorage.removeItem('editorlens:token'); localStorage.removeItem('editorlens:user'); } catch {}
      bus.emit('auth:expired', {});
    }
  });
}
