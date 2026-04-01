import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { segments, approvals, selectedSegmentId, segmentFilter, filteredSegments, stats } from '../signals.js';
import { HeatmapOverlay } from '../../timeline/components/HeatmapOverlay.jsx';
import { SegmentCard } from './SegmentCard.jsx';
import { BlueprintDetail } from '../../timeline/components/BlueprintDetail.jsx';
import { onKey } from '../../../shared/keyboard.js';
import { hasExistingData } from '../../pipeline/project-loader.js';
import { shellContext } from '../../../shell/fsm.js';

const FILTERS = [
  { id: 'all', label: (s) => `All ${s.total}` },
  { id: 'approved', label: (s) => `\u2713 ${s.approvedCount}` },
  { id: 'pending', label: (s) => `\u23F3 ${s.pendingCount}` },
  { id: 'rejected', label: (s) => `\u2702 ${s.rejectedCount}` },
];

function getUserChoice(segId, apps) {
  const status = apps[segId];
  if (status === 'approved') return 'ai';
  if (status === 'rejected') return 'original';
  return null;
}

export function SegmentList({ bus }) {
  const segs = filteredSegments.value;
  const allSegs = segments.value;
  const apps = approvals.value;
  const st = stats.value;
  const filter = segmentFilter.value;
  const selId = selectedSegmentId.value;

  // Find selected index in filtered list
  const selectedIdx = segs.findIndex(s => s.id === selId);
  const selectedSeg = selectedIdx >= 0 ? segs[selectedIdx] : null;
  const userChoice = selId ? getUserChoice(selId, apps) : null;

  // Keyboard shortcuts
  useEffect(() => {
    const unsubs = [
      onKey('j', () => {
        const idx = segs.findIndex(s => s.id === selectedSegmentId.value);
        const prev = idx > 0 ? idx - 1 : 0;
        const id = segs[prev]?.id;
        if (id) {
          selectedSegmentId.value = id;
          bus.emit('segments:select', { segmentId: id });
        }
      }),
      onKey('k', () => {
        const idx = segs.findIndex(s => s.id === selectedSegmentId.value);
        const next = idx < segs.length - 1 ? idx + 1 : segs.length - 1;
        const id = segs[next]?.id;
        if (id) {
          selectedSegmentId.value = id;
          bus.emit('segments:select', { segmentId: id });
        }
      }),
      onKey('arrowup', () => {
        const idx = segs.findIndex(s => s.id === selectedSegmentId.value);
        const prev = idx > 0 ? idx - 1 : 0;
        const id = segs[prev]?.id;
        if (id) {
          selectedSegmentId.value = id;
          bus.emit('segments:select', { segmentId: id });
        }
      }),
      onKey('arrowdown', () => {
        const idx = segs.findIndex(s => s.id === selectedSegmentId.value);
        const next = idx < segs.length - 1 ? idx + 1 : segs.length - 1;
        const id = segs[next]?.id;
        if (id) {
          selectedSegmentId.value = id;
          bus.emit('segments:select', { segmentId: id });
        }
      }),
      onKey('a', () => {
        const id = selectedSegmentId.value;
        if (id) bus.emit('segments:approve', { segmentId: id });
      }),
      onKey('r', () => {
        const id = selectedSegmentId.value;
        if (id) bus.emit('segments:reject', { segmentId: id });
      }),
    ];
    return () => unsubs.forEach(fn => fn());
  }, [bus, segs]);

  function handleSelect(id) {
    selectedSegmentId.value = id;
    bus.emit('segments:select', { segmentId: id });
  }

  function handlePrev() {
    if (selectedIdx > 0) handleSelect(segs[selectedIdx - 1].id);
  }

  function handleNext() {
    if (selectedIdx < segs.length - 1) handleSelect(segs[selectedIdx + 1].id);
  }

  const reviewedCount = st.approvedCount + st.rejectedCount;

  return h('div', {
    style: 'display:flex;flex-direction:row;height:100%'
  },
    // Left panel
    h('div', {
      style: 'width:280px;min-width:240px;display:flex;flex-direction:column;height:100%;border-right:1px solid #333'
    },
      // Previous data banner
      hasExistingData.value && h('div', {
        style: 'display:flex;align-items:center;justify-content:space-between;padding:6px 10px;background:rgba(77,171,247,0.08);border-bottom:1px solid rgba(77,171,247,0.15);font-size:10px'
      },
        h('span', { style: 'color:#4dabf7' }, 'Previous analysis loaded'),
        h('span', {
          style: 'color:#999;cursor:pointer;text-decoration:underline',
          onClick: () => {
            const ctx = shellContext.value || {};
            bus.emit('pipeline:rerun', { projectId: ctx.projectId, projectName: ctx.projectName });
          }
        }, 'Re-run analysis')
      ),

      // Heatmap
      allSegs.length > 0 && h('div', {
        style: 'background:rgba(0,0,0,0.1);padding:10px'
      },
        h(HeatmapOverlay, { bus })
      ),

      // Filter pills
      h('div', {
        style: 'display:flex;gap:4px;padding:8px 10px;border-bottom:1px solid #333'
      },
        FILTERS.map(f => {
          const active = filter === f.id;
          return h('div', {
            key: f.id,
            onClick: () => { segmentFilter.value = f.id; },
            style: [
              'padding:3px 8px;border-radius:10px;font-size:10px;cursor:pointer;user-select:none;white-space:nowrap',
              `background:${active ? '#4dabf7' : '#333'}`,
              `color:${active ? '#fff' : '#999'}`,
            ].join(';')
          }, f.label(st));
        })
      ),

      // Scrollable segment list
      h('div', {
        style: 'flex:1;overflow-y:auto'
      },
        allSegs.length === 0
          ? h('div', { style: 'padding:32px 16px;text-align:center' },
              h('div', { style: 'font-size:24px;opacity:0.15;margin-bottom:8px' }, '○'),
              h('div', { style: 'font-size:12px;color:#666;margin-bottom:12px' }, 'No segments yet'),
              h('div', { style: 'font-size:10px;color:#555;line-height:1.5' }, 'Select a project with existing analysis or run the pipeline on new media.'),
            )
          : segs.length === 0
          ? h('div', { style: 'padding:20px;color:#666;font-size:11px;text-align:center' }, 'No segments match filter')
          : segs.map(seg => h(SegmentCard, {
              key: seg.id,
              segment: seg,
              approval: apps[seg.id] || 'pending',
              userChoice: getUserChoice(seg.id, apps),
              isSelected: seg.id === selId,
              onClick: handleSelect,
            }))
      ),

      // Footer
      h('div', {
        style: 'border-top:1px solid #333;padding:10px;display:flex;flex-direction:column;gap:6px'
      },
        h('button', {
          onClick: () => bus.emit('segments:finalize', {}),
          style: 'width:100%;border:none;border-radius:4px;padding:8px;background:#4dabf7;color:#fff;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit'
        }, `Finalize & Export (${reviewedCount} reviewed)`),
        h('div', {
          style: 'font-size:9px;color:#666;text-align:center;letter-spacing:0.3px'
        }, 'J prev  K next  A accept  R reject')
      )
    ),

    // Right panel: BlueprintDetail
    h('div', {
      style: 'flex:1;min-width:0;overflow:hidden'
    },
      h(BlueprintDetail, {
        segment: selectedSeg,
        userChoice,
        onAccept: () => selId && bus.emit('segments:approve', { segmentId: selId }),
        onReject: () => selId && bus.emit('segments:reject', { segmentId: selId }),
        onPrev: handlePrev,
        onNext: handleNext,
        currentIdx: selectedIdx >= 0 ? selectedIdx : 0,
        totalCount: segs.length,
      })
    )
  );
}
