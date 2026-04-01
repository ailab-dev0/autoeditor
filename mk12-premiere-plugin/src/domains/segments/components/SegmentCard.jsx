import { h } from 'preact';
import { MARKER_COLORS } from '../protocol.js';

function formatTime(seconds) {
  if (seconds == null) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function SegmentCard({ segment, approval, userChoice, isSelected, onClick }) {
  const isCut = segment.suggestion === 'cut';
  const color = MARKER_COLORS[segment.suggestion] || '#666';

  const emoji = userChoice === 'ai' ? '\u{1F916}' : userChoice === 'original' ? '\u{1F464}' : '';

  const containerStyle = [
    'display:flex;flex-direction:row;align-items:center;padding:8px 10px;cursor:pointer;gap:8px;transition:background 0.1s',
    `border-left:${isSelected ? '3px solid #4dabf7' : '3px solid transparent'}`,
    `background:${isSelected ? 'rgba(77,171,247,0.08)' : 'transparent'}`,
    `opacity:${isCut ? '0.35' : '1'}`,
  ].join(';');

  return h('div', {
    style: containerStyle,
    onClick: () => onClick(segment.id),
    onMouseEnter: (e) => { if (!isSelected) e.currentTarget.style.background = '#333'; },
    onMouseLeave: (e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; },
  },
    // Left: colored dot
    h('div', {
      style: `width:10px;height:10px;border-radius:50%;background:${color};flex-shrink:0`
    }),

    // Middle: topic + time/role
    h('div', { style: 'flex:1;min-width:0;overflow:hidden' },
      h('div', {
        style: `font-size:11px;font-weight:600;color:#e0e0e0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;${isCut ? 'text-decoration:line-through' : ''}`
      }, segment.topic || segment.suggestion),
      h('div', { style: 'font-size:9px;color:#666;margin-top:1px;display:flex;gap:6px;align-items:center' },
        h('span', null, formatTime(segment.start)),
        segment.role && h('span', null, segment.role),
        isCut && h('span', { style: 'color:#E74C3C' }, '\u2702 cut')
      )
    ),

    // Right: decision emoji
    emoji && h('div', { style: 'font-size:14px;flex-shrink:0' }, emoji)
  );
}
