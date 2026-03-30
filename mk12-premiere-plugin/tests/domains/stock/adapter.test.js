import { describe, it, expect, vi, beforeEach } from 'vitest';
import { results, query, provider, stockError, isSearching } from '../../../src/domains/stock/signals';
import { setupStockAdapter } from '../../../src/domains/stock/adapter';
import { createEventBus } from '../../../src/shared/event-bus';

function makeTransport() {
  return {
    get: vi.fn().mockResolvedValue({ ok: true, data: [] }),
    post: vi.fn().mockResolvedValue({ ok: true, data: {} }),
    patch: vi.fn().mockResolvedValue({ ok: true, data: {} }),
    broadcastSync: vi.fn(),
  };
}

describe('Stock Adapter', () => {
  let bus, transport;

  beforeEach(() => {
    bus = createEventBus();
    transport = makeTransport();
    results.value = [];
    query.value = '';
    stockError.value = null;
    isSearching.value = false;
    setupStockAdapter(bus, transport);
  });

  it('stock:search calls GET and hydrates results', async () => {
    const mockResults = [{ id: '1', title: 'Nature', duration: 15 }];
    transport.get.mockResolvedValue({ ok: true, data: mockResults });

    bus.emit('stock:search', { query: 'nature', provider: 'pexels' });
    await new Promise(r => setTimeout(r, 10));

    expect(transport.get).toHaveBeenCalledWith('/api/stock/search?q=nature&provider=pexels');
    expect(results.value).toEqual(mockResults);
    expect(query.value).toBe('nature');
    expect(isSearching.value).toBe(false);
  });

  it('stock:search emits stock:results on success', async () => {
    transport.get.mockResolvedValue({ ok: true, data: [{ id: '1' }] });
    const handler = vi.fn();
    bus.on('stock:results', handler);

    bus.emit('stock:search', { query: 'test', provider: 'pixabay' });
    await new Promise(r => setTimeout(r, 10));

    expect(handler).toHaveBeenCalledWith({ count: 1 });
  });

  it('stock:search sets error on failure', async () => {
    transport.get.mockResolvedValue({ ok: false, error: 'API limit reached' });

    bus.emit('stock:search', { query: 'test', provider: 'pexels' });
    await new Promise(r => setTimeout(r, 10));

    expect(stockError.value).toBe('API limit reached');
    expect(results.value).toEqual([]);
  });

  it('stock:search emits stock:error on failure', async () => {
    transport.get.mockResolvedValue({ ok: false, error: 'fail' });
    const handler = vi.fn();
    bus.on('stock:error', handler);

    bus.emit('stock:search', { query: 'test', provider: 'pexels' });
    await new Promise(r => setTimeout(r, 10));

    expect(handler).toHaveBeenCalledWith({ error: 'fail' });
  });
});
