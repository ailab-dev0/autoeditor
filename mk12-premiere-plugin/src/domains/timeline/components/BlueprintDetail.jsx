import { h } from 'preact';
import { MARKER_COLORS } from '../../segments/protocol.js';

function formatTimecode(seconds) {
  if (seconds == null) return '--:--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const f = Math.floor((seconds % 1) * 30);
  return `${m}:${s.toString().padStart(2, '0')}:${f.toString().padStart(2, '0')}`;
}

export function BlueprintDetail({ segment, userChoice, onAccept, onReject, onPrev, onNext, currentIdx, totalCount }) {
  if (!segment) {
    return h('div', {
      style: 'display:flex;align-items:center;justify-content:center;height:100%;color:#666;font-size:12px'
    }, 'Select a segment to view details');
  }

  const color = MARKER_COLORS[segment.suggestion] || '#666';
  const conf = segment.confidence != null ? Math.round(segment.confidence * 100) : 0;
  const isAI = userChoice === 'ai';
  const isOriginal = userChoice === 'original';

  return h('div', {
    style: 'display:flex;flex-direction:column;height:100%;padding:16px;overflow-y:auto;gap:12px'
  },
    // Header row: role badge + importance + confidence + navigation
    h('div', {
      style: 'display:flex;align-items:center;gap:8px;flex-wrap:wrap'
    },
      h('span', {
        style: `display:inline-block;width:10px;height:10px;border-radius:50%;background:${color}`
      }),
      segment.role && h('span', {
        style: `font-size:10px;color:${color};font-weight:600;text-transform:uppercase`
      }, segment.role),
      segment.importance != null && h('span', {
        style: 'font-size:10px;color:#999;font-weight:500'
      }, `importance ${segment.importance}`),
      h('span', {
        style: `font-size:10px;color:${conf >= 85 ? '#4caf50' : '#ff9800'};font-weight:500`
      }, `${conf}% confident`),
      h('div', { style: 'flex:1' }),
      h('div', {
        style: 'display:flex;align-items:center;gap:4px;font-size:11px;color:#999'
      },
        h('span', {
          onClick: onPrev,
          style: 'cursor:pointer;padding:2px 6px;border-radius:3px;background:#333;color:#e0e0e0;user-select:none',
          title: 'Previous (J / \u2191)'
        }, '\u2190'),
        h('span', null, `${currentIdx + 1}/${totalCount}`),
        h('span', {
          onClick: onNext,
          style: 'cursor:pointer;padding:2px 6px;border-radius:3px;background:#333;color:#e0e0e0;user-select:none',
          title: 'Next (K / \u2193)'
        }, '\u2192')
      )
    ),

    // Topic title
    h('div', {
      style: 'font-size:16px;font-weight:700;color:#e0e0e0;line-height:1.3'
    }, segment.topic || segment.suggestion),

    // Transcript text
    segment.transcript && h('div', {
      style: 'font-size:12px;color:#999;line-height:1.5;max-height:80px;overflow-y:auto'
    }, segment.transcript),

    // Timecode + filename
    h('div', {
      style: 'font-size:10px;color:#666;display:flex;gap:12px'
    },
      h('span', null, `${formatTimecode(segment.start)} \u2192 ${formatTimecode(segment.end)}`),
      segment.videoPath && h('span', {
        style: 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap'
      }, segment.videoPath.split('/').pop())
    ),

    // Review cards side by side
    h('div', {
      style: 'display:flex;gap:10px;flex-wrap:wrap'
    },
      // AI card
      h('div', {
        style: [
          'flex:1;min-width:140px;border-radius:6px;padding:10px;display:flex;flex-direction:column;gap:8px',
          `border:1px solid ${isAI ? '#4dabf7' : '#333'}`,
          `background:${isAI ? 'rgba(77,171,247,0.05)' : '#2a2a2a'}`,
        ].join(';')
      },
        h('div', {
          style: 'font-size:11px;font-weight:600;color:#e0e0e0'
        }, `\u{1F916} AI: ${segment.suggestion}`),
        // Material thumbnail placeholder
        h('div', {
          style: 'height:64px;background:#1e1e1e;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#666;font-size:10px'
        }, segment.content_mark?.asset_type || 'preview'),
        segment.explanation && h('div', {
          style: 'font-size:10px;color:#999;line-height:1.4'
        }, segment.explanation),
        h('button', {
          onClick: onAccept,
          style: [
            'border:none;border-radius:4px;padding:6px 10px;cursor:pointer;font-size:11px;font-weight:600;font-family:inherit',
            isAI
              ? 'background:#4dabf7;color:#fff'
              : 'background:#333;color:#e0e0e0',
          ].join(';')
        }, 'Accept [A]')
      ),

      // Original card
      h('div', {
        style: [
          'flex:1;min-width:140px;border-radius:6px;padding:10px;display:flex;flex-direction:column;gap:8px',
          `border:1px solid ${isOriginal ? '#4caf50' : '#333'}`,
          `background:${isOriginal ? 'rgba(76,175,80,0.05)' : '#2a2a2a'}`,
        ].join(';')
      },
        h('div', {
          style: 'font-size:11px;font-weight:600;color:#e0e0e0'
        }, '\u{1F464} Keep original'),
        // Play icon placeholder
        h('div', {
          style: 'height:64px;background:#1e1e1e;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#666;font-size:18px'
        }, '\u25B6'),
        h('div', {
          style: 'font-size:10px;color:#999;line-height:1.4'
        }, 'Keep footage as-is'),
        h('button', {
          onClick: onReject,
          style: [
            'border:none;border-radius:4px;padding:6px 10px;cursor:pointer;font-size:11px;font-weight:600;font-family:inherit',
            isOriginal
              ? 'background:#4caf50;color:#fff'
              : 'background:#333;color:#e0e0e0',
          ].join(';')
        }, 'Keep [R]')
      )
    ),

    // Open in browser link
    h('div', {
      style: 'font-size:10px;color:#4dabf7;cursor:pointer;user-select:none'
    }, 'Open in Browser for full review \u2192'),

    // AI Analysis box
    segment.explanation && h('div', {
      style: 'background:#2a2a2a;border:1px solid #333;border-radius:6px;padding:10px'
    },
      h('div', {
        style: 'font-size:10px;color:#666;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;font-weight:600'
      }, 'AI Analysis'),
      h('div', {
        style: 'font-size:11px;color:#e0e0e0;line-height:1.5'
      }, segment.explanation)
    )
  );
}
