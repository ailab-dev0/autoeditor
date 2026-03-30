import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createEventBus } from '../../../src/shared/event-bus';
import { setupTimelineAdapter } from '../../../src/domains/timeline/adapter';
import {
  transactionState, transactionPreview, undoStack,
  applyProgress, timelineError,
} from '../../../src/domains/timeline/signals';
import { timelineState } from '../../../src/domains/timeline/fsm';
import { segments, approvals } from '../../../src/domains/segments/signals';

// Mock premiere.js so transaction.execute doesn't call real API
vi.mock('../../../src/shared/premiere.js', () => ({
  removeClip: vi.fn(async () => ({ ok: true, data: { removed: true } })),
  trimClip: vi.fn(async () => ({ ok: true, data: { trimmed: true } })),
  setClipSpeed: vi.fn(async () => ({ ok: true, data: {} })),
  moveClip: vi.fn(async () => ({ ok: true, data: {} })),
  insertTransition: vi.fn(async () => ({ ok: true, data: {} })),
  createMarker: vi.fn(async () => ({ ok: true, data: { id: 'marker-1' } })),
}));

function mockTransport() {
  return {
    post: vi.fn(async () => ({ ok: true, data: {} })),
    get: vi.fn(async () => ({ ok: true, data: {} })),
  };
}

describe('Timeline Adapter', () => {
  let bus;

  beforeEach(() => {
    bus = createEventBus();
    transactionState.value = 'idle';
    transactionPreview.value = null;
    undoStack.value = [];
    applyProgress.value = null;
    timelineError.value = null;
    timelineState.value = 'idle';
    segments.value = [];
    approvals.value = {};
  });

  it('preview reads segments and creates transaction preview', () => {
    segments.value = [
      { id: 's1', suggestion: 'cut', trackIndex: 0, clipIndex: 2, start: 0, end: 5 },
      { id: 's2', suggestion: 'keep', trackIndex: 0, clipIndex: 0, start: 5, end: 10 },
    ];
    approvals.value = { s1: 'approved', s2: 'approved' };

    const transport = mockTransport();
    setupTimelineAdapter(bus, transport);

    bus.emit('timeline:preview', {});

    expect(transactionState.value).toBe('previewing');
    expect(transactionPreview.value).not.toBeNull();
    expect(transactionPreview.value.opCounts.remove_clip).toBe(1);
    expect(transactionPreview.value.opCounts.add_marker).toBe(1);
    expect(timelineState.value).toBe('previewing');
  });

  it('preview sets error when no approved segments', () => {
    segments.value = [{ id: 's1', suggestion: 'cut' }];
    approvals.value = { s1: 'pending' };

    const transport = mockTransport();
    setupTimelineAdapter(bus, transport);

    bus.emit('timeline:preview', {});

    expect(timelineError.value).toBe('No approved segments to apply');
    expect(transactionState.value).toBe('idle');
  });

  it('apply executes transaction and transitions to applied', async () => {
    segments.value = [
      { id: 's1', suggestion: 'cut', trackIndex: 0, clipIndex: 0, start: 0, end: 5 },
    ];
    approvals.value = { s1: 'approved' };

    const transport = mockTransport();
    setupTimelineAdapter(bus, transport);

    // Preview first
    bus.emit('timeline:preview', {});
    expect(transactionState.value).toBe('previewing');

    // Apply
    bus.emit('timeline:apply', {});
    await vi.waitFor(() => expect(transactionState.value).toBe('applied'));

    expect(undoStack.value.length).toBeGreaterThan(0);
    expect(applyProgress.value).not.toBeNull();
    expect(timelineState.value).toBe('applied');
  });

  it('apply sets error when no transaction is ready', () => {
    const transport = mockTransport();
    setupTimelineAdapter(bus, transport);

    bus.emit('timeline:apply', {});
    expect(timelineError.value).toBe('No transaction to apply');
  });

  it('rollback reverses the transaction', async () => {
    segments.value = [
      { id: 's1', suggestion: 'cut', trackIndex: 0, clipIndex: 0, start: 0, end: 5 },
    ];
    approvals.value = { s1: 'approved' };

    const transport = mockTransport();
    setupTimelineAdapter(bus, transport);

    bus.emit('timeline:preview', {});
    bus.emit('timeline:apply', {});
    await vi.waitFor(() => expect(transactionState.value).toBe('applied'));

    bus.emit('timeline:rollback', {});
    await vi.waitFor(() => expect(transactionState.value).toBe('rolled-back'));

    expect(undoStack.value).toEqual([]);
    expect(applyProgress.value).toBeNull();
  });
});
