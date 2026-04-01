import { h } from 'preact';
import { segments, approvals } from '../../segments/signals.js';

export function ExportReady({ bus, projectId }) {
  const segs = segments.value || [];
  const apps = approvals.value || {};

  const approvedCount = Object.values(apps).filter(s => s === 'approved').length;
  const cutCount = segs.filter(s => s.suggestion === 'cut' && apps[s.id] === 'approved').length;
  const keepCount = approvedCount - cutCount;
  const pendingCount = Object.values(apps).filter(s => s === 'pending').length;
  const totalDuration = segs
    .filter(s => apps[s.id] === 'approved' && s.suggestion !== 'cut')
    .reduce((sum, s) => sum + ((s.end || 0) - (s.start || 0)), 0);

  const formatDuration = (sec) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}m ${s}s`;
  };

  return h('div', {
    style: 'display:flex;height:100%;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif'
  },
    // Left — summary
    h('div', {
      style: 'flex:1;padding:16px;border-right:1px solid #333;display:flex;flex-direction:column;gap:12px;overflow-y:auto'
    },
      h('div', {
        style: 'display:flex;align-items:center;gap:8px'
      },
        h('div', {
          style: 'width:28px;height:28px;border-radius:50%;background:rgba(76,175,80,0.12);border:1.5px solid #4caf50;display:flex;align-items:center;justify-content:center;font-size:14px;color:#4caf50;flex-shrink:0'
        }, '\u2713'),
        h('div', { style: 'display:flex;flex-direction:column' },
          h('span', { style: 'font-size:13px;font-weight:700;color:#e0e0e0' }, 'Ready to Import'),
          h('span', { style: 'font-size:10px;color:#999' }, `${approvedCount} approved, ${pendingCount} pending`)
        )
      ),

      h('div', { style: 'height:1px;background:#333' }),

      // Stats
      h('div', { style: 'display:flex;flex-direction:column;gap:6px' },
        h('div', { style: 'display:flex;justify-content:space-between;font-size:11px' },
          h('span', { style: 'color:#999' }, 'Segments to place'),
          h('span', { style: 'color:#e0e0e0;font-weight:600' }, keepCount)
        ),
        h('div', { style: 'display:flex;justify-content:space-between;font-size:11px' },
          h('span', { style: 'color:#999' }, 'Segments cut'),
          h('span', { style: 'color:#ff4444' }, cutCount)
        ),
        h('div', { style: 'display:flex;justify-content:space-between;font-size:11px' },
          h('span', { style: 'color:#999' }, 'Total duration'),
          h('span', { style: 'color:#e0e0e0;font-weight:600' }, formatDuration(totalDuration))
        )
      )
    ),

    // Right — import button
    h('div', {
      style: 'flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;gap:14px'
    },
      h('div', {
        style: 'font-size:14px;font-weight:600;color:#e0e0e0'
      }, 'Import to Timeline'),

      h('div', {
        style: 'font-size:10px;color:#999;text-align:center;line-height:1.6'
      }, `Places ${keepCount} segment${keepCount !== 1 ? 's' : ''} on your timeline\nwith correct in/out points`),

      h('button', {
        onClick: () => bus.emit('timeline:import', {}),
        disabled: keepCount === 0,
        style: `border:none;border-radius:6px;height:36px;padding:0 28px;background:${keepCount > 0 ? '#4dabf7' : '#555'};color:#fff;font-size:12px;font-weight:600;cursor:${keepCount > 0 ? 'pointer' : 'not-allowed'};font-family:inherit;opacity:${keepCount > 0 ? 1 : 0.5}`
      }, 'Import to Timeline'),

      h('div', {
        style: 'font-size:9px;color:#666'
      }, 'Creates a single undo point')
    )
  );
}
