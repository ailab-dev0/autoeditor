import { describe, it, expect, vi, beforeEach } from 'vitest';
import { graphData, knowledgeError } from '../../../src/domains/knowledge/signals';
import { setupKnowledgeAdapter } from '../../../src/domains/knowledge/adapter';
import { createEventBus } from '../../../src/shared/event-bus';

function makeTransport() {
  return {
    get: vi.fn().mockResolvedValue({ ok: true, data: null }),
    post: vi.fn().mockResolvedValue({ ok: true, data: {} }),
    patch: vi.fn().mockResolvedValue({ ok: true, data: {} }),
    broadcastSync: vi.fn(),
  };
}

describe('Knowledge Adapter', () => {
  let bus, transport;

  beforeEach(() => {
    bus = createEventBus();
    transport = makeTransport();
    graphData.value = null;
    knowledgeError.value = null;
    setupKnowledgeAdapter(bus, transport);
  });

  it('knowledge:fetch hydrates graphData signal', async () => {
    const mockGraph = {
      nodes: [{ id: 'n1', label: 'React' }],
      edges: [{ source: 'n1', target: 'n2' }],
    };
    transport.get.mockResolvedValue({ ok: true, data: mockGraph });

    bus.emit('knowledge:fetch', { projectId: 'proj-1' });
    await new Promise(r => setTimeout(r, 10));

    expect(transport.get).toHaveBeenCalledWith('/api/projects/proj-1/knowledge');
    expect(graphData.value).toEqual(mockGraph);
  });

  it('knowledge:fetch emits knowledge:fetched on success', async () => {
    transport.get.mockResolvedValue({ ok: true, data: { nodes: [], edges: [] } });
    const handler = vi.fn();
    bus.on('knowledge:fetched', handler);

    bus.emit('knowledge:fetch', { projectId: 'proj-1' });
    await new Promise(r => setTimeout(r, 10));

    expect(handler).toHaveBeenCalledWith({ projectId: 'proj-1' });
  });

  it('knowledge:fetch sets error on failure', async () => {
    transport.get.mockResolvedValue({ ok: false, error: 'Graph unavailable' });

    bus.emit('knowledge:fetch', { projectId: 'proj-1' });
    await new Promise(r => setTimeout(r, 10));

    expect(knowledgeError.value).toBe('Graph unavailable');
  });

  it('knowledge:fetch emits knowledge:error on failure', async () => {
    transport.get.mockResolvedValue({ ok: false, error: 'Timeout' });
    const handler = vi.fn();
    bus.on('knowledge:error', handler);

    bus.emit('knowledge:fetch', { projectId: 'proj-1' });
    await new Promise(r => setTimeout(r, 10));

    expect(handler).toHaveBeenCalledWith({ error: 'Timeout' });
  });
});
