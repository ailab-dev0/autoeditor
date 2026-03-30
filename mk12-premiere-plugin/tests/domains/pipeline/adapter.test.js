import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createEventBus } from '../../../src/shared/event-bus';
import { setupPipelineAdapter } from '../../../src/domains/pipeline/adapter';
import { stage, percent, eta, cost, pipelineError } from '../../../src/domains/pipeline/signals';
import { pipelineState } from '../../../src/domains/pipeline/fsm';

function mockTransport(responses = {}) {
  return {
    post: vi.fn(async (path) => responses[path] || { ok: true, data: {} }),
    get: vi.fn(async (path) => responses[path] || { ok: true, data: {} }),
  };
}

describe('Pipeline Adapter', () => {
  let bus;

  beforeEach(() => {
    bus = createEventBus();
    stage.value = 'idle';
    percent.value = 0;
    eta.value = null;
    cost.value = 0;
    pipelineError.value = null;
    pipelineState.value = 'idle';
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts pipeline and transitions FSM to running', async () => {
    const transport = mockTransport({
      '/api/projects/p1/pipeline/start': { ok: true, data: {} },
    });
    const { stopPolling } = setupPipelineAdapter(bus, transport);

    bus.emit('pipeline:start', { projectId: 'p1' });
    await vi.waitFor(() => expect(pipelineState.value).toBe('running'));

    expect(stage.value).toBe('transcription');
    stopPolling();
  });

  it('sets pipelineError when start fails', async () => {
    const transport = mockTransport({
      '/api/projects/p1/pipeline/start': { ok: false, error: 'No video' },
    });
    setupPipelineAdapter(bus, transport);

    bus.emit('pipeline:start', { projectId: 'p1' });
    await vi.waitFor(() => expect(pipelineError.value).toBe('No video'));

    expect(pipelineState.value).toBe('idle');
  });

  it('updates signals on ws:analysis:progress', async () => {
    const transport = mockTransport({
      '/api/projects/p1/pipeline/start': { ok: true, data: {} },
    });
    const { stopPolling } = setupPipelineAdapter(bus, transport);

    bus.emit('pipeline:start', { projectId: 'p1' });
    await vi.waitFor(() => expect(pipelineState.value).toBe('running'));

    bus.emit('ws:analysis:progress', {
      stage: 'analysis',
      percent: 45,
      eta: 30000,
      cost: 150,
    });

    expect(stage.value).toBe('analysis');
    expect(percent.value).toBe(45);
    expect(eta.value).toBe(30000);
    expect(cost.value).toBe(150);
    stopPolling();
  });

  it('completes pipeline on ws:analysis:complete', async () => {
    const transport = mockTransport({
      '/api/projects/p1/pipeline/start': { ok: true, data: {} },
    });
    const { stopPolling } = setupPipelineAdapter(bus, transport);

    const completeEvents = [];
    bus.on('pipeline:complete', () => completeEvents.push(true));

    bus.emit('pipeline:start', { projectId: 'p1' });
    await vi.waitFor(() => expect(pipelineState.value).toBe('running'));

    bus.emit('ws:analysis:complete', { editPackage: {} });

    expect(pipelineState.value).toBe('complete');
    expect(stage.value).toBe('complete');
    expect(percent.value).toBe(100);
    expect(completeEvents.length).toBeGreaterThanOrEqual(1);
    stopPolling();
  });

  it('handles ws:error', async () => {
    const transport = mockTransport({
      '/api/projects/p1/pipeline/start': { ok: true, data: {} },
    });
    const { stopPolling } = setupPipelineAdapter(bus, transport);

    bus.emit('pipeline:start', { projectId: 'p1' });
    await vi.waitFor(() => expect(pipelineState.value).toBe('running'));

    bus.emit('ws:error', { message: 'Transcription failed' });

    expect(pipelineState.value).toBe('failed');
    expect(pipelineError.value).toBe('Transcription failed');
    stopPolling();
  });
});
