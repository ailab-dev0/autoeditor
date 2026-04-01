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
    // Each SegmentCard renders a colored dot (10px circle) — JSDOM normalizes styles with spaces
    const dots = container.querySelectorAll('div[style*="border-radius: 50%"][style*="width: 10px"]');
    expect(dots.length).toBeGreaterThanOrEqual(5);
  });

  it('renders filter pills', () => {
    segments.value = [];
    const { container } = render(<SegmentList bus={bus} />);
    // Filter pills show: "All 0", "✓ 0", "⏳ 0", "✂ 0"
    expect(container.textContent).toContain('All');
    expect(container.textContent).toContain('\u2713');
    expect(container.textContent).toContain('\u23F3');
    expect(container.textContent).toContain('\u2702');
  });

  it('segmentFilter signal controls displayed segments', () => {
    const segs = makeSegs(3);
    segments.value = segs;
    approvals.value = { 'seg-0': 'approved', 'seg-1': 'pending', 'seg-2': 'pending' };

    segmentFilter.value = 'approved';
    const { container } = render(<SegmentList bus={bus} />);
    // seg-0 has suggestion 'keep', so its card text includes 'keep'
    expect(container.textContent).toContain('keep');
    // seg-1 has suggestion 'cut' — should not appear in approved filter
    // Only 1 segment card dot should be rendered (the approved one)
    const dots = container.querySelectorAll('div[style*="border-radius: 50%"][style*="width: 10px"]');
    expect(dots.length).toBe(1);
  });

  it('shows stats in filter pills and footer', () => {
    const segs = makeSegs(4);
    segments.value = segs;
    approvals.value = {
      'seg-0': 'approved',
      'seg-1': 'rejected',
      'seg-2': 'pending',
      'seg-3': 'approved',
    };

    const { container } = render(<SegmentList bus={bus} />);
    // Filter pill shows "All 4"
    expect(container.textContent).toContain('All 4');
    // Filter pill shows "✓ 2" for 2 approved
    expect(container.textContent).toContain('\u2713 2');
    // Footer shows "Finalize & Export (3 reviewed)" — 2 approved + 1 rejected = 3
    expect(container.textContent).toContain('Finalize & Export (3 reviewed)');
  });
});
