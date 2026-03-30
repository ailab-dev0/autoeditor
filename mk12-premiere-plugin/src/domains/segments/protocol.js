/**
 * ProtocolV3 — Edit Package validation and parsing.
 *
 * Ported from v1 ProtocolV3.js. Functional exports, no class.
 */

export const VALID_SUGGESTIONS = Object.freeze([
  'keep', 'cut', 'trim_start', 'trim_end', 'trim_both',
  'rearrange', 'speed_up', 'merge', 'review',
]);

export const VALID_ASSET_TYPES = Object.freeze([
  'stock_video', 'article', 'linkedin_photo', 'animation',
  'ai_image', 'loom_recording', 'speaking_only',
]);

export const VALID_TRANSITIONS = Object.freeze([
  'cross_dissolve', 'dip_to_black', 'none',
]);

export const MARKER_COLORS = Object.freeze({
  keep: '#27AE60',
  cut: '#E74C3C',
  trim_start: '#F1C40F',
  trim_end: '#F1C40F',
  trim_both: '#F1C40F',
  rearrange: '#3498DB',
  speed_up: '#9B59B6',
  merge: '#1ABC9C',
  review: '#E67E22',
});

/**
 * Validate an edit package against the v3 schema.
 * @param {object} pkg
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateEditPackage(pkg) {
  const errors = [];

  if (!pkg || typeof pkg !== 'object') {
    return { valid: false, errors: ['Edit package must be a non-null object.'] };
  }

  if (pkg.version !== 'v3') {
    errors.push(`Invalid version: expected "v3", got "${pkg.version}".`);
  }
  if (typeof pkg.project_name !== 'string' || !pkg.project_name) {
    errors.push('Missing or empty "project_name" string.');
  }
  if (typeof pkg.pipeline_session_id !== 'string' || !pkg.pipeline_session_id) {
    errors.push('Missing or empty "pipeline_session_id" string.');
  }
  if (typeof pkg.pedagogy_score !== 'number' || pkg.pedagogy_score < 0 || pkg.pedagogy_score > 1) {
    errors.push('"pedagogy_score" must be a number between 0 and 1.');
  }

  if (!Array.isArray(pkg.chapters)) {
    errors.push('"chapters" must be an array.');
  } else {
    pkg.chapters.forEach((ch, ci) => {
      if (typeof ch.name !== 'string' || !ch.name) {
        errors.push(`chapters[${ci}]: missing or empty "name".`);
      }
      if (typeof ch.order !== 'number' || !Number.isInteger(ch.order) || ch.order < 0) {
        errors.push(`chapters[${ci}]: "order" must be a non-negative integer.`);
      }
      if (typeof ch.target_duration !== 'number' || ch.target_duration < 0) {
        errors.push(`chapters[${ci}]: "target_duration" must be a non-negative number.`);
      }
    });
  }

  if (!Array.isArray(pkg.videos)) {
    errors.push('"videos" must be an array.');
  } else if (pkg.videos.length === 0) {
    errors.push('"videos" must contain at least one entry.');
  } else {
    pkg.videos.forEach((vid, vi) => {
      if (typeof vid.video_path !== 'string' || !vid.video_path) {
        errors.push(`videos[${vi}]: missing or empty "video_path".`);
      }
      if (!Array.isArray(vid.segments)) {
        errors.push(`videos[${vi}]: "segments" must be an array.`);
      } else {
        validateSegments(vid.segments, vi, errors);
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

function validateSegments(segments, videoIndex, errors) {
  const seenIds = new Set();

  segments.forEach((seg, si) => {
    const p = `videos[${videoIndex}].segments[${si}]`;

    if (typeof seg.id !== 'string' || !seg.id) {
      errors.push(`${p}: missing or empty "id".`);
    } else if (seenIds.has(seg.id)) {
      errors.push(`${p}: duplicate segment id "${seg.id}".`);
    } else {
      seenIds.add(seg.id);
    }

    if (typeof seg.start !== 'number' || seg.start < 0) {
      errors.push(`${p}: "start" must be a non-negative number.`);
    }
    if (typeof seg.end !== 'number' || seg.end < 0) {
      errors.push(`${p}: "end" must be a non-negative number.`);
    }
    if (typeof seg.start === 'number' && typeof seg.end === 'number' && seg.end <= seg.start) {
      errors.push(`${p}: "end" (${seg.end}) must be greater than "start" (${seg.start}).`);
    }

    if (!VALID_SUGGESTIONS.includes(seg.suggestion)) {
      errors.push(`${p}: invalid suggestion "${seg.suggestion}".`);
    }

    if (typeof seg.confidence !== 'number' || seg.confidence < 0 || seg.confidence > 1) {
      errors.push(`${p}: "confidence" must be a number between 0 and 1.`);
    }

    if (typeof seg.explanation !== 'string') {
      errors.push(`${p}: "explanation" must be a string.`);
    }

    if (seg.content_mark != null) {
      if (typeof seg.content_mark !== 'object') {
        errors.push(`${p}: "content_mark" must be an object if present.`);
      } else if (!VALID_ASSET_TYPES.includes(seg.content_mark.asset_type)) {
        errors.push(`${p}: invalid content_mark.asset_type "${seg.content_mark.asset_type}".`);
      }
    }

    if (seg.transition_after != null && !VALID_TRANSITIONS.includes(seg.transition_after)) {
      errors.push(`${p}: invalid transition_after "${seg.transition_after}".`);
    }

    if (seg.handle_before != null && (typeof seg.handle_before !== 'number' || seg.handle_before < 0)) {
      errors.push(`${p}: "handle_before" must be a non-negative number.`);
    }
    if (seg.handle_after != null && (typeof seg.handle_after !== 'number' || seg.handle_after < 0)) {
      errors.push(`${p}: "handle_after" must be a non-negative number.`);
    }
  });
}

// Re-export from operations.js — canonical approval gate logic lives there
export { toMarkerData, toTimelineOperations } from './operations.js';

/**
 * Parse an edit package into a flat array of enriched segments.
 * @param {object} pkg - Validated edit package
 * @returns {Array<object>} Flat segment array with videoPath enrichment
 */
export function parseSegments(pkg) {
  const result = [];
  if (!pkg?.videos) return result;

  for (const video of pkg.videos) {
    if (!Array.isArray(video.segments)) continue;
    for (const seg of video.segments) {
      result.push({
        ...seg,
        videoPath: video.video_path,
        duration: seg.end - seg.start,
      });
    }
  }
  return result;
}
