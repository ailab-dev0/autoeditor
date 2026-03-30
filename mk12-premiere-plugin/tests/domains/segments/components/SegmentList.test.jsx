import { h } from 'preact';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/preact';
import { segments, approvals, segmentFilter } from '../../../../src/domains/segments/signals';
import { SegmentList } from '../../../../src/domains/segments/components/SegmentList';

function makeSegs(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: `seg-${i}`,
    start: i * 10,
    end: (i + 1) * 10,
    suggestion: i % 3 === 0 ? 'keep' : i % 3 === 1 ? 'cut' : 'trim_start',
    confidence: 0.8 + (i % 3) * 0.05,
    explanation: `Segment ${i}`,
  }));
}

describe('SegmentList', () => {
  let bus;

  beforeEach(() => {
    bus = { emit: vi.fn(), on: vi.fn() };
    segmentFilter.value = 'all';
    approvals.value = {};
  });

  it('renders segment cards for all segments', () => {
    const segs = makeSegs(5);
    segments.value = segs;
    approvals.value = Object.fromEntries(segs.map(s => [s.id, 'pending']));

    const { container } = render(<SegmentList bus={bus} />);
    const cards = container.querySelectorAll('[data-segment-id]');
    expect(cards.length).toBe(5);
  });

  it('renders filter buttons', () => {
    segments.value = [];
    const { container } = render(<SegmentList bus={bus} />);
    const buttons = container.querySelectorAll('sp-action-button');
    expect(buttons.length).toBe(5); // all, approved, rejected, pending, review
  });

  it('filter buttons change segmentFilter signal', () => {
    segments.value = makeSegs(3);
    approvals.value = { 'seg-0': 'approved', 'seg-1': 'pending', 'seg-2': 'pending' };

    const { container } = render(<SegmentList bus={bus} />);
    const buttons = container.querySelectorAll('sp-action-button');

    // Click "Approved" button (index 1)
    fireEvent.click(buttons[1]);
    expect(segmentFilter.value).toBe('approved');
  });

  it('filters segments by approval status', async () => {
    const segs = makeSegs(4);
    segments.value = segs;
    approvals.value = {
      'seg-0': 'approved',
      'seg-1': 'rejected',
      'seg-2': 'pending',
      'seg-3': 'approved',
    };

    segmentFilter.value = 'approved';

    const { container } = render(<SegmentList bus={bus} />);
    // Wait for signal effect
    await new Promise(r => setTimeout(r, 10));

    const cards = container.querySelectorAll('[data-segment-id]');
    expect(cards.length).toBe(2);
  });
});
