import { describe, it, expect, vi, beforeEach } from 'vitest';
import { transcript, transcriptError } from '../../../src/domains/transcript/signals';
import { setupTranscriptAdapter } from '../../../src/domains/transcript/adapter';
import { createEventBus } from '../../../src/shared/event-bus';

function makeTransport() {
  return {
    get: vi.fn().mockResolvedValue({ ok: true, data: null }),
    post: vi.fn().mockResolvedValue({ ok: true, data: {} }),
    patch: vi.fn().mockResolvedValue({ ok: true, data: {} }),
    broadcastSync: vi.fn(),
  };
}

describe('Transcript Adapter', () => {
  let bus, transport;

  beforeEach(() => {
    bus = createEventBus();
    transport = makeTransport();
    transcript.value = null;
    transcriptError.value = null;
    setupTranscriptAdapter(bus, transport);
  });

  it('transcript:fetch hydrates transcript signal', async () => {
    const mockTranscript = {
      text: 'Hello world',
      segments: [{ start: 0, end: 5, text: 'Hello world' }],
    };
    transport.get.mockResolvedValue({ ok: true, data: mockTranscript });

    bus.emit('transcript:fetch', { projectId: 'proj-1' });
    await new Promise(r => setTimeout(r, 10));

    expect(transport.get).toHaveBeenCalledWith('/api/projects/proj-1/transcript');
    expect(transcript.value).toEqual(mockTranscript);
    expect(transcriptError.value).toBeNull();
  });

  it('transcript:fetch emits transcript:fetched on success', async () => {
    transport.get.mockResolvedValue({ ok: true, data: { text: '', segments: [] } });
    const handler = vi.fn();
    bus.on('transcript:fetched', handler);

    bus.emit('transcript:fetch', { projectId: 'proj-1' });
    await new Promise(r => setTimeout(r, 10));

    expect(handler).toHaveBeenCalledWith({ projectId: 'proj-1' });
  });

  it('transcript:fetch sets error on failure', async () => {
    transport.get.mockResolvedValue({ ok: false, error: 'Not found' });

    bus.emit('transcript:fetch', { projectId: 'proj-1' });
    await new Promise(r => setTimeout(r, 10));

    expect(transcriptError.value).toBe('Not found');
  });

  it('transcript:fetch emits transcript:error on failure', async () => {
    transport.get.mockResolvedValue({ ok: false, error: 'Timeout' });
    const handler = vi.fn();
    bus.on('transcript:error', handler);

    bus.emit('transcript:fetch', { projectId: 'proj-1' });
    await new Promise(r => setTimeout(r, 10));

    expect(handler).toHaveBeenCalledWith({ error: 'Timeout' });
  });
});
