import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createEventBus } from '../../../src/shared/event-bus';
import { setupAuthAdapter } from '../../../src/domains/auth/adapter';
import { token, user, loginError } from '../../../src/domains/auth/signals';

function mockTransport(responses = {}) {
  return {
    post: vi.fn(async (path) => {
      return responses[path] || { ok: false, error: 'Not found' };
    }),
    get: vi.fn(async () => ({ ok: true, data: {} })),
  };
}

// Provide a simple localStorage mock
const storage = {};
const mockStorage = {
  getItem: vi.fn((key) => storage[key] ?? null),
  setItem: vi.fn((key, val) => { storage[key] = String(val); }),
  removeItem: vi.fn((key) => { delete storage[key]; }),
  clear: vi.fn(() => { for (const k in storage) delete storage[k]; }),
};
Object.defineProperty(globalThis, 'localStorage', { value: mockStorage, writable: true });

describe('Auth Adapter', () => {
  let bus;

  beforeEach(() => {
    bus = createEventBus();
    token.value = null;
    user.value = null;
    loginError.value = null;
    mockStorage.clear();
    vi.clearAllMocks();
  });

  describe('auth:login', () => {
    it('sets token and user on success', async () => {
      const transport = mockTransport({
        '/api/auth/login': { ok: true, data: { token: 'abc123', user: { id: 1, email: 'a@b.com' } } },
      });
      setupAuthAdapter(bus, transport);

      const events = [];
      bus.on('auth:logged-in', e => events.push(e));

      bus.emit('auth:login', { email: 'a@b.com', password: 'pass' });
      await vi.waitFor(() => expect(token.value).toBe('abc123'));

      expect(user.value).toEqual({ id: 1, email: 'a@b.com' });
      expect(loginError.value).toBeNull();
      expect(events).toHaveLength(1);
      expect(mockStorage.setItem).toHaveBeenCalledWith('editorlens:token', 'abc123');
    });

    it('sets loginError on failure', async () => {
      const transport = mockTransport({
        '/api/auth/login': { ok: false, error: 'Invalid credentials' },
      });
      setupAuthAdapter(bus, transport);

      bus.emit('auth:login', { email: 'a@b.com', password: 'wrong' });
      await vi.waitFor(() => expect(loginError.value).toBe('Invalid credentials'));

      expect(token.value).toBeNull();
      expect(user.value).toBeNull();
    });

    it('clears loginError before attempting login', async () => {
      loginError.value = 'Old error';
      const transport = mockTransport({
        '/api/auth/login': { ok: true, data: { token: 'x', user: { id: 1 } } },
      });
      setupAuthAdapter(bus, transport);

      bus.emit('auth:login', { email: 'a@b.com', password: 'pass' });
      expect(loginError.value).toBeNull();
    });
  });

  describe('auth:refresh', () => {
    it('updates token on success', async () => {
      token.value = 'old-token';
      const transport = mockTransport({
        '/api/auth/refresh': { ok: true, data: { token: 'new-token' } },
      });
      setupAuthAdapter(bus, transport);

      const events = [];
      bus.on('auth:refreshed', () => events.push(true));

      bus.emit('auth:refresh', {});
      await vi.waitFor(() => expect(token.value).toBe('new-token'));

      expect(events).toHaveLength(1);
      expect(mockStorage.setItem).toHaveBeenCalledWith('editorlens:token', 'new-token');
    });

    it('clears state and emits auth:expired on failure', async () => {
      token.value = 'old-token';
      user.value = { id: 1 };
      const transport = mockTransport({
        '/api/auth/refresh': { ok: false, error: 'Expired' },
      });
      setupAuthAdapter(bus, transport);

      const events = [];
      bus.on('auth:expired', () => events.push(true));

      bus.emit('auth:refresh', {});
      await vi.waitFor(() => expect(token.value).toBeNull());

      expect(user.value).toBeNull();
      expect(events).toHaveLength(1);
    });

    it('does nothing when no token exists', async () => {
      const transport = mockTransport();
      setupAuthAdapter(bus, transport);

      bus.emit('auth:refresh', {});
      await new Promise(r => setTimeout(r, 10));
      expect(transport.post).not.toHaveBeenCalled();
    });
  });

  describe('auth:logout', () => {
    it('clears all auth state', () => {
      token.value = 'abc';
      user.value = { id: 1 };
      loginError.value = 'some error';

      const transport = mockTransport();
      setupAuthAdapter(bus, transport);

      const events = [];
      bus.on('auth:logged-out', () => events.push(true));

      bus.emit('auth:logout', {});

      expect(token.value).toBeNull();
      expect(user.value).toBeNull();
      expect(loginError.value).toBeNull();
      expect(mockStorage.removeItem).toHaveBeenCalledWith('editorlens:token');
      expect(events).toHaveLength(1);
    });
  });
});
