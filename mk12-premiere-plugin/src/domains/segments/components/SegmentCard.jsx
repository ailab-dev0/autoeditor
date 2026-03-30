import { h } from 'preact';
import { selectedSegmentId } from '../signals';
import { MARKER_COLORS } from '../protocol';
import { ConfidenceRibbon } from './ConfidenceRibbon';

export function SegmentCard({ segment, approval, bus }) {
  const isSelected = selectedSegmentId.value === segment.id;
  const color = MARKER_COLORS[segment.suggestion] || MARKER_COLORS.review;
  const duration = (segment.end - segment.start).toFixed(1);
  const label = segment.label || segment.explanation || '';
  const truncated = label.length > 60 ? label.slice(0, 57) + '...' : label;

  return (
    <div
      class={`flex-row gap-sm p-sm segment-card ${isSelected ? 'segment-card--selected' : ''}`}
      onClick={() => { selectedSegmentId.value = segment.id; }}
      role="button"
      data-segment-id={segment.id}
    >
      <span
        class="segment-badge"
        style={`background:${color};color:#fff;padding:2px 6px;border-radius:3px;font-size:11px;white-space:nowrap`}
      >
        {segment.suggestion}
      </span>

      <span class="segment-label" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
        {truncated}
      </span>

      <ConfidenceRibbon confidence={segment.confidence} />

      <span class="text-muted" style="font-size:11px;white-space:nowrap">
        {duration}s
      </span>

      <span class="segment-actions" style="display:flex;gap:4px">
        <sp-action-button
          size="s"
          disabled={approval === 'approved' ? '' : undefined}
          onClick={(e) => {
            e.stopPropagation();
            bus.emit('segments:approve', { segmentId: segment.id });
          }}
        >
          ✓
        </sp-action-button>
        <sp-action-button
          size="s"
          disabled={approval === 'rejected' ? '' : undefined}
          onClick={(e) => {
            e.stopPropagation();
            bus.emit('segments:reject', { segmentId: segment.id });
          }}
        >
          ✗
        </sp-action-button>
      </span>
    </div>
  );
}
