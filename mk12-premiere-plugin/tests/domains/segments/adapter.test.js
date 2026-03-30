import { describe, it, expect, vi, beforeEach } from 'vitest';
import { segments, approvals, selectedSegmentId, segmentsError } from '../../../src/domains/segments/signals';
import { setupSegmentsAdapter } from '../../../src/domains/segments/adapter';
import { createEventBus } from '../../../src/shared/event-bus';

function makePackage() {
  return {
    version: 'v3',
    project_name: 'Test',
    pipeline_session_id: 'sess-1',
    pedagogy_score: 0.9,
    chapters: [{ name: 'Ch1', order: 0, target_duration: 30 }],
    videos: [{
      video_path: '/v.mp4',
      segments: [
        { id: 'a', start: 0, end: 5, suggestion: 'keep', confidence: 0.9, explanation: 'good' },
        { id: 'b', start: 5, end: 10, suggestion: 'cut', confidence: 0.8, explanation: 'bad' },
      ],
    }],
  };
}

function makeTransport(overrides = {}) {
  return {
    get: vi.fn().mockResolvedValue({ ok: true, data: [] }),
    post: vi.fn().mockResolvedValue({ ok: true, data: {} }),
    patch: vi.fn().mockResolvedValue({ ok: true, data: {} }),
    broadcastSync: vi.fn(),
    ...overrides,
  };
}

describe('Segments Adapter', () => {
  let bus, transport;

  beforeEach(() => {
    bus = createEventBus();
    transport = makeTransport();
    segments.value = [];
    approvals.value = {};
    selectedSegmentId.value = null;
    segmentsError.value = null;
    setupSegmentsAdapter(bus, transport);
  });

  it('pipeline:complete hydrates segments and sets all approvals to pending', () => {
    bus.emit('pipeline:complete', { editPackage: makePackage() });

    expect(segments.value).toHaveLength(2);
    expect(segments.value[0].id).toBe('a');
    expect(approvals.value).toEqual({ a: 'pending', b: 'pending' });
    expect(segmentsError.value).toBeNull();
  });

  it('pipeline:complete with invalid package sets error', () => {
    const errorHandler = vi.fn();
    bus.on('segments:error', errorHandler);

    bus.emit('pipeline:complete', { editPackage: { version: 'v2' } });

    expect(segmentsError.value).toContain('Validation failed');
    expect(errorHandler).toHaveBeenCalled();
  });

  it('segments:approve updates approval signal and emits event', () => {
    bus.emit('pipeline:complete', { editPackage: makePackage() });

    const handler = vi.fn();
    bus.on('segments:approved', handler);

    bus.emit('segments:approve', { segmentId: 'a' });

    expect(approvals.value.a).toBe('approved');
    expect(handler).toHaveBeenCalledWith({ segmentId: 'a' });
    expect(transport.broadcastSync).toHaveBeenCalledWith('segments:approved', { segmentId: 'a' });
  });

  it('segments:reject updates approval signal and emits event', () => {
    bus.emit('pipeline:complete', { editPackage: makePackage() });

    const handler = vi.fn();
    bus.on('segments:rejected', handler);

    bus.emit('segments:reject', { segmentId: 'b' });

    expect(approvals.value.b).toBe('rejected');
    expect(handler).toHaveBeenCalledWith({ segmentId: 'b' });
  });

  it('segments:approve with projectId calls transport.patch', async () => {
    bus.emit('pipeline:complete', { editPackage: makePackage() });
    bus.emit('segments:approve', { segmentId: 'a', projectId: 'proj-1' });

    await new Promise(r => setTimeout(r, 10));

    expect(transport.patch).toHaveBeenCalledWith(
      '/api/projects/proj-1/segments/bulk',
      { segments: [{ id: 'a', status: 'approved' }] }
    );
  });

  it('segments:approve reverts on PATCH failure (#9)', async () => {
    const failTransport = makeTransport({
      patch: vi.fn().mockResolvedValue({ ok: false, error: 'Server error' }),
    });
    bus = createEventBus();
    segments.value = [];
    approvals.value = {};
    setupSegmentsAdapter(bus, failTransport);

    bus.emit('pipeline:complete', { editPackage: makePackage() });
    expect(approvals.value.a).toBe('pending');

    bus.emit('segments:approve', { segmentId: 'a', projectId: 'proj-1' });

    await new Promise(r => setTimeout(r, 50));

    // Should revert to previous state
    expect(approvals.value.a).toBe('pending');
  });

  it('segments:approve ignores concurrent calls for same segment (#10)', async () => {
    const slowTransport = makeTransport({
      patch: vi.fn(() => new Promise(r => setTimeout(() => r({ ok: true, data: {} }), 100))),
    });
    bus = createEventBus();
    segments.value = [];
    approvals.value = {};
    setupSegmentsAdapter(bus, slowTransport);

    bus.emit('pipeline:complete', { editPackage: makePackage() });

    // Fire two approvals for same segment rapidly
    bus.emit('segments:approve', { segmentId: 'a', projectId: 'proj-1' });
    bus.emit('segments:approve', { segmentId: 'a', projectId: 'proj-1' });

    await new Promise(r => setTimeout(r, 200));

    // Should only have called PATCH once
    expect(slowTransport.patch).toHaveBeenCalledTimes(1);
  });

  it('segments:fetch calls transport.get and inits approvals to pending (#2)', async () => {
    const mockData = [
      { id: 'x', start: 0, end: 5, suggestion: 'keep', confidence: 0.9 },
      { id: 'y', start: 5, end: 10, suggestion: 'cut', confidence: 0.8 },
    ];
    transport.get.mockResolvedValue({ ok: true, data: mockData });

    bus.emit('segments:fetch', { projectId: 'proj-2' });
    await new Promise(r => setTimeout(r, 10));

    expect(transport.get).toHaveBeenCalledWith('/api/projects/proj-2/marks');
    expect(segments.value).toEqual(mockData);
    expect(approvals.value).toEqual({ x: 'pending', y: 'pending' });
  });

  it('segments:select sets selectedSegmentId (#14)', () => {
    bus.emit('segments:select', { segmentId: 'seg-1' });
    expect(selectedSegmentId.value).toBe('seg-1');
  });

  it('segments:select clears with null', () => {
    selectedSegmentId.value = 'seg-1';
    bus.emit('segments:select', { segmentId: null });
    expect(selectedSegmentId.value).toBeNull();
  });
});
