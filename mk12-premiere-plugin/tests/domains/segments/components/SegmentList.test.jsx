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
    bus = { emit: vi.fn(), on: vi.fn(), off: vi.fn() };
    segmentFilter.value = 'all';
    approvals.value = {};
  });

  it('renders segment cards for all segments', () => {
    const segs = makeSegs(5);
    segments.value = segs;
    approvals.value = Object.fromEntries(segs.map(s => [s.id, 'pending']));

    const { container } = render(<SegmentList bus={bus} />);
    // SegmentCard renders with ConfidenceRibbon which has percentage text
    // Count by checking for Approve buttons (one per segment)
    const approveButtons = container.querySelectorAll('sp-button');
    // At minimum we should have Approve All + Reject All + per-segment buttons
    expect(approveButtons.length).toBeGreaterThanOrEqual(5);
  });

  it('renders filter buttons', () => {
    segments.value = [];
    const { container } = render(<SegmentList bus={bus} />);
    // Filter buttons are now divs with filter names
    expect(container.textContent).toContain('All');
    expect(container.textContent).toContain('Approved');
    expect(container.textContent).toContain('Rejected');
    expect(container.textContent).toContain('Pending');
    expect(container.textContent).toContain('Review');
  });

  it('segmentFilter signal controls displayed segments', () => {
    const segs = makeSegs(3);
    segments.value = segs;
    approvals.value = { 'seg-0': 'approved', 'seg-1': 'pending', 'seg-2': 'pending' };

    segmentFilter.value = 'approved';
    const { container } = render(<SegmentList bus={bus} />);
    // Only approved segment should have its Approve/Reject buttons
    // The component should show fewer segments than total
    expect(container.textContent).toContain('Segment 0');
    expect(container.textContent).not.toContain('Segment 1');
  });

  it('shows stats summary', () => {
    const segs = makeSegs(4);
    segments.value = segs;
    approvals.value = {
      'seg-0': 'approved',
      'seg-1': 'rejected',
      'seg-2': 'pending',
      'seg-3': 'approved',
    };

    const { container } = render(<SegmentList bus={bus} />);
    expect(container.textContent).toContain('4 segments');
    expect(container.textContent).toContain('2 approved');
  });
});
