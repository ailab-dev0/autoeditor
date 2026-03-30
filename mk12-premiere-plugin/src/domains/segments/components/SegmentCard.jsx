/**
 * SegmentCard — individual segment with approve/reject.
 * UXP: sp-button for actions, inline styles for dark theme.
 */
import { h } from 'preact';
import { selectedSegmentId } from '../signals';
import { MARKER_COLORS } from '../protocol';
import { ConfidenceRibbon } from './ConfidenceRibbon';

export function SegmentCard({ segment, approval, bus }) {
  const isSelected = selectedSegmentId.value === segment.id;
  const color = MARKER_COLORS[segment.suggestion] || MARKER_COLORS.review;
  const startTime = (segment.start ?? segment.inPoint ?? 0).toFixed(1);
  const endTime = (segment.end ?? segment.outPoint ?? 0).toFixed(1);
  const label = segment.label || segment.explanation || segment.id;
  const truncated = label.length > 50 ? label.slice(0, 47) + '...' : label;

  return (
    <div
      onClick={() => {
        if (bus) bus.emit('segments:select', { segmentId: segment.id });
      }}
      style={`display:flex;flex-direction:row;align-items:center;gap:8px;padding:8px 10px;background:#2a2a2a;border-bottom:1px solid #333;border-left:3px solid ${isSelected ? '#4dabf7' : 'transparent'};cursor:pointer`}
    >
      <span style={`display:inline-block;width:12px;height:12px;border-radius:50%;background:${color};flex-shrink:0`} />

      <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px">
        <span style="color:#e0e0e0;font-weight:600;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{truncated}</span>
        <div style="display:flex;flex-direction:row;gap:8px;align-items:center">
          <span style="color:#999;font-size:10px">{startTime}s - {endTime}s</span>
          <span style={`color:${color};font-size:10px;font-weight:500`}>{segment.suggestion}</span>
          <ConfidenceRibbon confidence={segment.confidence || 0} />
        </div>
      </div>

      <div style="display:flex;flex-direction:row;gap:4px;flex-shrink:0">
        <sp-button
          size="s"
          variant={approval === 'approved' ? 'accent' : 'secondary'}
          onClick={(e) => { e.stopPropagation(); bus.emit('segments:approve', { segmentId: segment.id }); }}
          style="min-width:0;padding:2px 8px;font-size:11px"
        >
          {approval === 'approved' ? 'Approved' : 'Approve'}
        </sp-button>
        <sp-button
          size="s"
          variant={approval === 'rejected' ? 'negative' : 'secondary'}
          onClick={(e) => { e.stopPropagation(); bus.emit('segments:reject', { segmentId: segment.id }); }}
          style="min-width:0;padding:2px 8px;font-size:11px"
        >
          {approval === 'rejected' ? 'Rejected' : 'Reject'}
        </sp-button>
      </div>
    </div>
  );
}
