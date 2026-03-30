/**
 * Segment export transforms — marker data and timeline operations.
 *
 * Split from protocol.js to keep files under 300 lines.
 * Approval gate logic is SAFETY CRITICAL.
 */

import { MARKER_COLORS } from './protocol';

const LOW_CONFIDENCE_THRESHOLD = 0.85;

/**
 * Transform segments into marker placement data.
 * Low-confidence segments (<85%) are forced to review color.
 *
 * @param {Array<object>} segments
 * @param {Record<string, string>} approvals
 * @returns {Array<{time: number, duration: number, color: string, label: string, comment: string}>}
 */
export function toMarkerData(segments, approvals = {}) {
  return segments.map(seg => {
    const decision = seg.suggestion;
    const isLowConfidence = seg.confidence < LOW_CONFIDENCE_THRESHOLD;
    const color = isLowConfidence ? MARKER_COLORS.review : (MARKER_COLORS[decision] || MARKER_COLORS.review);

    return {
      time: seg.start,
      duration: seg.end - seg.start,
      color,
      label: `${decision.toUpperCase()} (${Math.round(seg.confidence * 100)}%)`,
      comment: seg.explanation || '',
    };
  });
}

/**
 * Transform segments into ordered timeline edit operations.
 *
 * APPROVAL GATE (SAFETY CRITICAL):
 * - Only APPROVED segments generate destructive operations
 * - Rejected segments are SKIPPED entirely
 * - Pending segments are SKIPPED — user must approve first
 * - 'review' suggestion NEVER generates destructive ops regardless of approval
 *
 * @param {Array<object>} segments
 * @param {Record<string, string>} approvals - {segmentId: 'approved'|'rejected'|'pending'}
 * @returns {Array<object>} Timeline operations
 */
export function toTimelineOperations(segments, approvals = {}) {
  const ops = [];

  const sorted = segments.slice().sort((a, b) => a.start - b.start);

  for (const seg of sorted) {
    const status = approvals[seg.id] || 'pending';

    // APPROVAL GATE: skip rejected and pending
    if (status === 'rejected') continue;
    if (status === 'pending') continue;

    // status === 'approved' beyond this point
    const decision = seg.suggestion;

    // 'review' NEVER generates destructive ops
    if (decision === 'review') continue;

    const op = {
      segmentId: seg.id,
      videoPath: seg.videoPath,
      inPoint: seg.start,
      outPoint: seg.end,
      decision,
    };

    // Handle adjustments
    if (seg.handle_before != null && seg.handle_before > 0) {
      op.inPoint = Math.max(0, seg.start - seg.handle_before);
    }
    if (seg.handle_after != null && seg.handle_after > 0) {
      op.outPoint = seg.end + seg.handle_after;
    }

    switch (decision) {
      case 'cut':
        op.type = 'remove_clip';
        break;
      case 'trim_start':
        op.type = 'trim_clip';
        op.trimType = 'start';
        break;
      case 'trim_end':
        op.type = 'trim_clip';
        op.trimType = 'end';
        break;
      case 'trim_both':
        op.type = 'trim_clip';
        op.trimType = 'both';
        break;
      case 'speed_up':
        op.type = 'set_speed';
        op.speed = seg.speed || 1.5;
        break;
      case 'rearrange':
        op.type = 'move_clip';
        op.newPosition = seg.new_position || seg.newPosition || seg.start;
        break;
      case 'keep':
      case 'merge':
        op.type = 'keep';
        break;
      default:
        op.type = 'keep';
        break;
    }

    if (seg.transition_after && seg.transition_after !== 'none') {
      op.transitionAfter = seg.transition_after;
    }

    ops.push(op);
  }

  return ops;
}
