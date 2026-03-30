import { h } from 'preact';
import { useRef, useState, useCallback } from 'preact/hooks';
import { useSignalEffect } from '@preact/signals';
import { filteredSegments, segmentFilter, approvals } from '../signals';
import { SegmentCard } from './SegmentCard';

const ROW_HEIGHT = 52;
const OVERSCAN = 4;
const FILTERS = ['all', 'approved', 'rejected', 'pending', 'review'];

export function SegmentList({ bus }) {
  const containerRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(400);
  const [segs, setSegs] = useState([]);

  useSignalEffect(() => {
    setSegs(filteredSegments.value);
  });

  const onScroll = useCallback((e) => {
    setScrollTop(e.target.scrollTop);
    setContainerHeight(e.target.clientHeight);
  }, []);

  const totalHeight = segs.length * ROW_HEIGHT;
  const startIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const endIdx = Math.min(segs.length, Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + OVERSCAN);
  const visibleSegs = segs.slice(startIdx, endIdx);

  return (
    <div class="flex-col gap-sm">
      <sp-action-group compact>
        {FILTERS.map(f => (
          <sp-action-button
            key={f}
            selected={segmentFilter.value === f ? '' : undefined}
            onClick={() => { segmentFilter.value = f; }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </sp-action-button>
        ))}
      </sp-action-group>

      <div
        ref={containerRef}
        class="segment-list-scroll"
        style={`height:100%;overflow-y:auto;position:relative`}
        onScroll={onScroll}
      >
        <div style={`height:${totalHeight}px;position:relative`}>
          {visibleSegs.map((seg, i) => (
            <div
              key={seg.id}
              style={`position:absolute;top:${(startIdx + i) * ROW_HEIGHT}px;height:${ROW_HEIGHT}px;width:100%`}
            >
              <SegmentCard
                segment={seg}
                approval={approvals.value[seg.id] || 'pending'}
                bus={bus}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
