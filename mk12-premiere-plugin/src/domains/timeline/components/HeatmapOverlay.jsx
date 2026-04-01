import { h } from 'preact';
import { segments, approvals } from '../../segments/signals.js';
import { MARKER_COLORS } from '../../segments/protocol.js';

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function HeatmapOverlay({ bus }) {
  const segs = segments.value;
  const apps = approvals.value;

  if (!segs.length) {
    return h('div', { style: 'padding:10px;color:#666;font-size:10px' }, 'No segments loaded');
  }

  const totalDuration = segs.reduce((sum, s) => sum + (s.end - s.start), 0);

  return h('div', { style: 'padding:0' },
    h('div', {
      style: 'font-size:9px;color:#666;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;font-weight:600'
    }, 'TIMELINE HEATMAP'),
    h('div', {
      style: 'display:flex;flex-direction:row;height:32px;border-radius:4px;overflow:hidden;cursor:pointer'
    },
      segs.map(seg => {
        const duration = seg.end - seg.start;
        const widthPct = totalDuration > 0 ? (duration / totalDuration) * 100 : 0;
        const color = MARKER_COLORS[seg.suggestion] || '#666';
        const conf = seg.confidence || 0;
        const lowConf = conf < 0.85;

        return h('div', {
          key: seg.id,
          onClick: () => bus.emit('segments:select', { segmentId: seg.id }),
          title: `${seg.topic || seg.suggestion} (${Math.round(conf * 100)}%)`,
          style: `width:${widthPct}%;min-width:2px;background:${color};border-top:${lowConf ? '2px dashed rgba(255,255,255,0.5)' : '2px solid transparent'};transition:opacity 0.15s;opacity:${apps[seg.id] === 'rejected' ? '0.4' : '1'}`
        });
      })
    ),
    h('div', {
      style: 'display:flex;justify-content:space-between;margin-top:3px;font-size:9px;color:#666'
    },
      h('span', null, '0:00'),
      h('span', null, formatTime(totalDuration))
    )
  );
}
