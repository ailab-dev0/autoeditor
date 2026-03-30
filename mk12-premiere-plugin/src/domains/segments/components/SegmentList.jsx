/**
 * SegmentList — filter bar, stats, scrollable segment cards, bulk actions.
 * UXP: styled divs for filter bar, sp-button for actions.
 */
import { h } from 'preact';
import { filteredSegments, segments, segmentFilter, approvals, stats } from '../signals';
import { SegmentCard } from './SegmentCard';

const FILTERS = ['all', 'approved', 'rejected', 'pending', 'review'];

function filterCount(filter, segs, apps) {
  if (filter === 'all') return segs.length;
  if (filter === 'review') return segs.filter(s => s.suggestion === 'review').length;
  return segs.filter(s => (apps[s.id] || 'pending') === filter).length;
}

export function SegmentList({ bus }) {
  const segs = segments.value;
  const apps = approvals.value;
  const filtered = filteredSegments.value;
  const st = stats.value;
  const currentFilter = segmentFilter.value;

  return (
    <div style="display:flex;flex-direction:column;height:100%">
      <div style="display:flex;flex-direction:row;gap:4px;padding:8px 10px;border-bottom:1px solid #333;flex-wrap:wrap">
        {FILTERS.map(f => {
          const active = currentFilter === f;
          const count = filterCount(f, segs, apps);
          return (
            <div
              key={f}
              onClick={() => { segmentFilter.value = f; }}
              style={`padding:4px 10px;border-radius:3px;font-size:11px;cursor:pointer;user-select:none;background:${active ? '#4dabf7' : '#333'};color:${active ? '#fff' : '#999'}`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)} ({count})
            </div>
          );
        })}
      </div>

      <div style="padding:6px 10px;color:#999;font-size:11px;border-bottom:1px solid #333">
        {st.total} segments | {st.approvedCount} approved | {st.rejectedCount} rejected | Avg confidence: {Math.round(st.avgConfidence * 100)}%
      </div>

      <div style="flex:1;overflow-y:auto">
        {filtered.length === 0 && (
          <div style="padding:16px;color:#666;font-size:12px;text-align:center">No segments match filter</div>
        )}
        {filtered.map(seg => (
          <SegmentCard
            key={seg.id}
            segment={seg}
            approval={apps[seg.id] || 'pending'}
            bus={bus}
          />
        ))}
      </div>

      <div style="display:flex;flex-direction:row;gap:8px;padding:8px 10px;border-top:1px solid #333">
        <sp-button
          variant="accent"
          style="flex:1"
          onClick={() => {
            segs.forEach(s => bus.emit('segments:approve', { segmentId: s.id }));
          }}
        >
          Approve All
        </sp-button>
        <sp-button
          variant="negative"
          style="flex:1"
          onClick={() => {
            segs.forEach(s => bus.emit('segments:reject', { segmentId: s.id }));
          }}
        >
          Reject All
        </sp-button>
      </div>
    </div>
  );
}
