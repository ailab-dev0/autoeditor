import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTransport, connectionState, reconnectAttempt } from '../../src/shared/transport';
import { createEventBus } from '../../src/shared/event-bus';

describe('Transport', () => {
  let bus;
  let transport;

  beforeEach(() => {
    bus = createEventBus();
    transport = createTransport(bus);
    connectionState.value = 'disconnected';
    reconnectAttempt.value = 0;
  });

  afterEach(() => {
    transport.disconnect();
    vi.restoreAllMocks();
  });

  describe('configure', () => {
    it('accepts baseUrl override', () => {
      transport.configure({ baseUrl: 'http://example.com:9000' });
      expect(transport.getBaseUrl()).toBe('http://example.com:9000');
    });
  });

  describe('HTTP envelope', () => {
    it('GET returns {ok, data} on success', async () => {
      const mockData = { projects: [] };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockData),
      }));

      const result = await transport.get('/api/projects');
      expect(result.ok).toBe(true);
      expect(result.data).toEqual(mockData);
    });

    it('POST sends JSON body', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ id: '123' }),
      });
      vi.stubGlobal('fetch', fetchMock);

      await transport.post('/api/projects', { name: 'Test' });

      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toContain('/api/projects');
      expect(opts.method).toBe('POST');
      expect(opts.headers['Content-Type']).toBe('application/json');
      expect(JSON.parse(opts.body)).toEqual({ name: 'Test' });
    });

    it('returns error envelope on HTTP failure', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Internal error' }),
      }));

      const result = await transport.get('/api/health');
      expect(result.ok).toBe(false);
      expect(result.error).toBe('Internal error');
    });

    it('returns error envelope on network failure', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network unreachable')));

      const result = await transport.get('/api/health');
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Network unreachable');
    });
  });

  describe('401 refresh flow', () => {
    it('emits transport:auth-failed on 401, retries, then non-retryable on second 401', async () => {
      const authFailedCalls = [];
      bus.on('transport:auth-failed', (data) => authFailedCalls.push(data));

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'Unauthorized' }),
      }));

      const result = await transport.get('/api/projects');

      expect(authFailedCalls).toHaveLength(2);
      expect(authFailedCalls[0].retryable).toBe(true);
      expect(authFailedCalls[1].retryable).toBe(false);
      expect(result.ok).toBe(false);
      expect(result.error).toBe('Authentication expired');
    });
  });

  describe('disconnect', () => {
    it('resets connection state', () => {
      connectionState.value = 'connected';
      reconnectAttempt.value = 3;
      transport.disconnect();
      expect(connectionState.value).toBe('disconnected');
      expect(reconnectAttempt.value).toBe(0);
    });
  });
});
