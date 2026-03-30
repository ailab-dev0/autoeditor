/**
 * HeatmapOverlay — visual strip showing segment decisions as colored blocks.
 * Read-only imports from segments domain. Selection via bus intent.
 */
import { h } from 'preact';
import { segments, approvals, selectedSegmentId } from '../../segments/signals.js';
import { MARKER_COLORS } from '../../segments/protocol.js';

const COLOR_MAP = {
  keep: '#27AE60',
  cut: '#E74C3C',
  trim_start: '#F1C40F',
  trim_end: '#F1C40F',
  trim_both: '#F1C40F',
  rearrange: '#3498DB',
  speed_up: '#9B59B6',
  review: '#E67E22',
};

function getSegmentColor(seg, apps) {
  const status = apps[seg.id] || 'pending';
  if (status === 'rejected') return '#555';
  return COLOR_MAP[seg.suggestion] || '#666';
}

export function HeatmapOverlay({ bus }) {
  const segs = segments.value;
  const apps = approvals.value;
  const selectedId = selectedSegmentId.value;

  if (segs.length === 0) return null;

  const totalDuration = segs.reduce((sum, s) => {
    return sum + ((s.end || s.outPoint || 0) - (s.start || s.inPoint || 0));
  }, 0);
  if (totalDuration <= 0) return null;

  return (
    <div style="display:flex;flex-direction:column;gap:4px;padding:8px 10px">
      <div style="display:flex;flex-direction:row;height:24px;border-radius:3px;overflow:hidden" role="img" aria-label="Segment heatmap">
        {segs.map(seg => {
          const start = seg.start ?? seg.inPoint ?? 0;
          const end = seg.end ?? seg.outPoint ?? 0;
          const duration = end - start;
          const widthPct = (duration / totalDuration) * 100;
          const isSelected = seg.id === selectedId;
          const isLowConf = (seg.confidence || 0) < 0.85;
          const color = getSegmentColor(seg, apps);

          return (
            <div
              key={seg.id}
              onClick={() => { if (bus) bus.emit('segments:select', { segmentId: seg.id }); }}
              title={`${seg.suggestion} — ${start.toFixed(1)}s-${end.toFixed(1)}s (${Math.round((seg.confidence || 0) * 100)}%)`}
              style={`width:${widthPct}%;background:${color};cursor:pointer;position:relative;border-right:1px solid #1e1e1e;${isSelected ? 'box-shadow:inset 0 0 0 2px #4dabf7;' : ''}${isLowConf ? 'border-top:2px dashed #999;' : ''}`}
            />
          );
        })}
      </div>
      <div style="display:flex;justify-content:space-between;font-size:10px;color:#666">
        <span>0s</span>
        <span>{totalDuration.toFixed(1)}s</span>
      </div>
    </div>
  );
}
