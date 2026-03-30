/**
 * HeatmapOverlay — visual strip showing segment decisions as colored blocks.
 */
import { h } from 'preact';
import { segments, approvals, selectedSegmentId } from '../../segments/signals.js';
import { MARKER_COLORS } from '../../segments/protocol.js';

const COLOR_MAP = {
  keep: 'var(--spectrum-global-color-green-500, #2d9d78)',
  cut: 'var(--spectrum-global-color-red-500, #e34850)',
  trim_start: 'var(--spectrum-global-color-purple-500, #9256d9)',
  trim_end: 'var(--spectrum-global-color-purple-500, #9256d9)',
  trim_both: 'var(--spectrum-global-color-purple-500, #9256d9)',
  review: 'var(--spectrum-global-color-orange-500, #e68619)',
  speed: 'var(--spectrum-global-color-blue-500, #2680eb)',
  pending: 'var(--spectrum-global-color-gray-400, #999)',
};

function getSegmentColor(seg, apps) {
  const status = apps[seg.id] || 'pending';
  if (status === 'rejected') return 'var(--spectrum-global-color-gray-300, #bbb)';
  return COLOR_MAP[seg.suggestion] || COLOR_MAP.pending;
}

export function HeatmapOverlay({ bus }) {
  const segs = segments.value;
  const apps = approvals.value;
  const selectedId = selectedSegmentId.value;

  if (segs.length === 0) return null;

  // Calculate total duration for proportional widths
  const totalDuration = segs.reduce((sum, s) => sum + ((s.outPoint || 0) - (s.inPoint || 0)), 0);
  if (totalDuration <= 0) return null;

  return (
    <div class="heatmap-overlay flex-row" role="img" aria-label="Segment heatmap">
      {segs.map(seg => {
        const duration = (seg.outPoint || 0) - (seg.inPoint || 0);
        const widthPercent = (duration / totalDuration) * 100;
        const isSelected = seg.id === selectedId;

        return (
          <div
            key={seg.id}
            class={`heatmap-block${isSelected ? ' heatmap-block--selected' : ''}`}
            style={`width: ${widthPercent}%; background: ${getSegmentColor(seg, apps)};`}
            title={`${seg.suggestion} — ${seg.label || seg.id}`}
            onClick={() => {
              selectedSegmentId.value = seg.id;
              if (bus) bus.emit('segments:fetch', { segmentId: seg.id });
            }}
          />
        );
      })}
    </div>
  );
}
