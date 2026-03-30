/**
 * Auth adapter — handles login, refresh, logout intents via transport.
 */
import { token, user, loginError } from './signals.js';

export function setupAuthAdapter(bus, transport) {
  bus.on('auth:login', async ({ email, password }) => {
    loginError.value = null;
    const res = await transport.post('/api/auth/login', { email, password });
    if (res.ok) {
      token.value = res.data.token;
      user.value = res.data.user;
      try { localStorage.setItem('editorlens:token', res.data.token); } catch {}
      bus.emit('auth:logged-in', { user: res.data.user });
    } else {
      loginError.value = res.error || 'Login failed';
    }
  });

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
      try { localStorage.removeItem('editorlens:token'); } catch {}
      bus.emit('auth:expired', {});
    }
  });

  bus.on('auth:logout', () => {
    token.value = null;
    user.value = null;
    loginError.value = null;
    try { localStorage.removeItem('editorlens:token'); } catch {}
    bus.emit('auth:logged-out', {});
  });
}
