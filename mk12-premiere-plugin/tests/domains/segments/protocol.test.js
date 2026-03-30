import { describe, it, expect } from 'vitest';
import {
  validateEditPackage, parseSegments,
  VALID_SUGGESTIONS, VALID_ASSET_TYPES, VALID_TRANSITIONS, MARKER_COLORS,
} from '../../../src/domains/segments/protocol';
import { toMarkerData, toTimelineOperations } from '../../../src/domains/segments/operations';

// ---------------------------------------------------------------------------
// Test fixture
// ---------------------------------------------------------------------------
function makePackage(overrides = {}) {
  return {
    version: 'v3',
    project_name: 'Test Project',
    pipeline_session_id: 'sess-123',
    pedagogy_score: 0.85,
    chapters: [{ name: 'Intro', order: 0, target_duration: 60 }],
    videos: [{
      video_path: '/test/video.mp4',
      segments: [
        makeSeg('s1', 0, 10, 'keep', 0.95),
        makeSeg('s2', 10, 20, 'cut', 0.90),
        makeSeg('s3', 20, 30, 'trim_start', 0.60),
        makeSeg('s4', 30, 40, 'review', 0.40),
      ],
    }],
    ...overrides,
  };
}

function makeSeg(id, start, end, suggestion, confidence, extras = {}) {
  return { id, start, end, suggestion, confidence, explanation: `Explanation for ${id}`, ...extras };
}

// ---------------------------------------------------------------------------
// validateEditPackage
// ---------------------------------------------------------------------------
describe('validateEditPackage', () => {
  it('accepts a valid package', () => {
    const result = validateEditPackage(makePackage());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects null', () => {
    const result = validateEditPackage(null);
    expect(result.valid).toBe(false);
  });

  it('rejects wrong version', () => {
    const result = validateEditPackage(makePackage({ version: 'v2' }));
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('version');
  });

  it('rejects missing project_name', () => {
    const result = validateEditPackage(makePackage({ project_name: '' }));
    expect(result.valid).toBe(false);
  });

  it('rejects invalid segment suggestion', () => {
    const pkg = makePackage();
    pkg.videos[0].segments[0].suggestion = 'invalid';
    const result = validateEditPackage(pkg);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('suggestion'))).toBe(true);
  });

  it('rejects out-of-range confidence', () => {
    const pkg = makePackage();
    pkg.videos[0].segments[0].confidence = 1.5;
    const result = validateEditPackage(pkg);
    expect(result.valid).toBe(false);
  });

  it('rejects end <= start', () => {
    const pkg = makePackage();
    pkg.videos[0].segments[0].end = 0;
    pkg.videos[0].segments[0].start = 5;
    const result = validateEditPackage(pkg);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('greater than'))).toBe(true);
  });

  it('rejects duplicate segment ids', () => {
    const pkg = makePackage();
    pkg.videos[0].segments[1].id = 's1';
    const result = validateEditPackage(pkg);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('duplicate'))).toBe(true);
  });

  it('rejects empty videos array', () => {
    const result = validateEditPackage(makePackage({ videos: [] }));
    expect(result.valid).toBe(false);
  });

  it('validates content_mark asset_type', () => {
    const pkg = makePackage();
    pkg.videos[0].segments[0].content_mark = { asset_type: 'invalid_type' };
    const result = validateEditPackage(pkg);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('asset_type'))).toBe(true);
  });

  it('validates transition_after', () => {
    const pkg = makePackage();
    pkg.videos[0].segments[0].transition_after = 'wipe';
    const result = validateEditPackage(pkg);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('transition_after'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// parseSegments
// ---------------------------------------------------------------------------
describe('parseSegments', () => {
  it('flattens segments from all videos with videoPath', () => {
    const segs = parseSegments(makePackage());
    expect(segs).toHaveLength(4);
    expect(segs[0].id).toBe('s1');
    expect(segs[0].videoPath).toBe('/test/video.mp4');
    expect(segs[0].duration).toBe(10);
  });

  it('returns empty array for null input', () => {
    expect(parseSegments(null)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// toMarkerData
// ---------------------------------------------------------------------------
describe('toMarkerData', () => {
  it('maps suggestion to correct color', () => {
    const segs = parseSegments(makePackage());
    const markers = toMarkerData(segs);

    expect(markers[0].color).toBe(MARKER_COLORS.keep);  // s1: keep, 95%
    expect(markers[1].color).toBe(MARKER_COLORS.cut);   // s2: cut, 90%
  });

  it('forces low-confidence (<85%) to review color', () => {
    const segs = parseSegments(makePackage());
    const markers = toMarkerData(segs);

    // s3: trim_start, 60% → forced to review color
    expect(markers[2].color).toBe(MARKER_COLORS.review);
    // s4: review, 40% → already review color
    expect(markers[3].color).toBe(MARKER_COLORS.review);
  });

  it('includes label with suggestion and percentage', () => {
    const segs = parseSegments(makePackage());
    const markers = toMarkerData(segs);
    expect(markers[0].label).toBe('KEEP (95%)');
    expect(markers[1].label).toBe('CUT (90%)');
  });

  it('includes explanation as comment', () => {
    const segs = parseSegments(makePackage());
    const markers = toMarkerData(segs);
    expect(markers[0].comment).toBe('Explanation for s1');
  });
});

// ---------------------------------------------------------------------------
// toTimelineOperations — APPROVAL GATE
// ---------------------------------------------------------------------------
describe('toTimelineOperations', () => {
  const segs = parseSegments(makePackage());

  it('approved keep → keep (no-op)', () => {
    const approvals = { s1: 'approved', s2: 'approved', s3: 'approved', s4: 'approved' };
    const ops = toTimelineOperations(segs, approvals);
    const keepOp = ops.find(o => o.segmentId === 's1');
    expect(keepOp.type).toBe('keep');
  });

  it('approved cut → remove_clip', () => {
    const approvals = { s1: 'approved', s2: 'approved', s3: 'approved', s4: 'approved' };
    const ops = toTimelineOperations(segs, approvals);
    const cutOp = ops.find(o => o.segmentId === 's2');
    expect(cutOp.type).toBe('remove_clip');
  });

  it('approved trim_start → trim_clip', () => {
    const approvals = { s1: 'approved', s2: 'approved', s3: 'approved', s4: 'approved' };
    const ops = toTimelineOperations(segs, approvals);
    const trimOp = ops.find(o => o.segmentId === 's3');
    expect(trimOp.type).toBe('trim_clip');
    expect(trimOp.trimType).toBe('start');
  });

  it('rejected segments are SKIPPED', () => {
    const approvals = { s1: 'approved', s2: 'rejected', s3: 'approved', s4: 'approved' };
    const ops = toTimelineOperations(segs, approvals);
    expect(ops.find(o => o.segmentId === 's2')).toBeUndefined();
  });

  it('pending segments are SKIPPED', () => {
    const approvals = { s1: 'approved', s2: 'pending', s3: 'approved', s4: 'approved' };
    const ops = toTimelineOperations(segs, approvals);
    expect(ops.find(o => o.segmentId === 's2')).toBeUndefined();
  });

  it('review suggestion NEVER generates destructive ops even when approved', () => {
    const approvals = { s1: 'approved', s2: 'approved', s3: 'approved', s4: 'approved' };
    const ops = toTimelineOperations(segs, approvals);
    // s4 is review — should not appear
    expect(ops.find(o => o.segmentId === 's4')).toBeUndefined();
  });

  it('no approvals → empty operations', () => {
    const ops = toTimelineOperations(segs, {});
    expect(ops).toHaveLength(0);
  });

  it('all rejected → empty operations', () => {
    const approvals = { s1: 'rejected', s2: 'rejected', s3: 'rejected', s4: 'rejected' };
    const ops = toTimelineOperations(segs, approvals);
    expect(ops).toHaveLength(0);
  });

  it('speed_up generates set_speed op', () => {
    const speedSegs = parseSegments({
      ...makePackage(),
      videos: [{ video_path: '/v.mp4', segments: [makeSeg('sp1', 0, 10, 'speed_up', 0.95, { speed: 2.0 })] }],
    });
    const ops = toTimelineOperations(speedSegs, { sp1: 'approved' });
    expect(ops[0].type).toBe('set_speed');
    expect(ops[0].speed).toBe(2.0);
  });

  it('rearrange generates move_clip op', () => {
    const moveSegs = parseSegments({
      ...makePackage(),
      videos: [{ video_path: '/v.mp4', segments: [makeSeg('mv1', 0, 10, 'rearrange', 0.95, { new_position: 50 })] }],
    });
    const ops = toTimelineOperations(moveSegs, { mv1: 'approved' });
    expect(ops[0].type).toBe('move_clip');
    expect(ops[0].newPosition).toBe(50);
  });

  it('includes transition_after when not "none"', () => {
    const transSegs = parseSegments({
      ...makePackage(),
      videos: [{ video_path: '/v.mp4', segments: [makeSeg('t1', 0, 10, 'keep', 0.95, { transition_after: 'cross_dissolve' })] }],
    });
    const ops = toTimelineOperations(transSegs, { t1: 'approved' });
    expect(ops[0].transitionAfter).toBe('cross_dissolve');
  });

  it('applies handle_before and handle_after', () => {
    const handleSegs = parseSegments({
      ...makePackage(),
      videos: [{ video_path: '/v.mp4', segments: [makeSeg('h1', 5, 15, 'cut', 0.95, { handle_before: 1, handle_after: 2 })] }],
    });
    const ops = toTimelineOperations(handleSegs, { h1: 'approved' });
    expect(ops[0].inPoint).toBe(4);
    expect(ops[0].outPoint).toBe(17);
  });
});
