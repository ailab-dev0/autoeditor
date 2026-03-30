import { signal, computed } from '@preact/signals';

/** @type {import('@preact/signals').Signal<Array<object>>} */
export const segments = signal([]);

/** @type {import('@preact/signals').Signal<Record<string, 'approved'|'rejected'|'pending'>>} */
export const approvals = signal({});

/** @type {import('@preact/signals').Signal<string|null>} */
export const selectedSegmentId = signal(null);

/** @type {import('@preact/signals').Signal<'all'|'approved'|'rejected'|'pending'|'review'>} */
export const segmentFilter = signal('all');

/** @type {import('@preact/signals').Signal<string|null>} */
export const segmentsError = signal(null);

export const filteredSegments = computed(() => {
  const segs = segments.value;
  const apps = approvals.value;
  const filter = segmentFilter.value;

  if (filter === 'all') return segs;

  return segs.filter(seg => {
    if (filter === 'review') return seg.suggestion === 'review';
    const status = apps[seg.id] || 'pending';
    return status === filter;
  });
});

export const stats = computed(() => {
  const segs = segments.value;
  const apps = approvals.value;
  const total = segs.length;

  if (total === 0) {
    return {
      total: 0, keepCount: 0, cutCount: 0, trimCount: 0,
      avgConfidence: 0, approvedCount: 0, rejectedCount: 0, pendingCount: 0,
    };
  }

  let keepCount = 0, cutCount = 0, trimCount = 0, confidenceSum = 0;
  let approvedCount = 0, rejectedCount = 0, pendingCount = 0;

  for (const seg of segs) {
    confidenceSum += seg.confidence || 0;

    switch (seg.suggestion) {
      case 'keep': keepCount++; break;
      case 'cut': cutCount++; break;
      case 'trim_start': case 'trim_end': case 'trim_both': trimCount++; break;
    }

    const status = apps[seg.id] || 'pending';
    if (status === 'approved') approvedCount++;
    else if (status === 'rejected') rejectedCount++;
    else pendingCount++;
  }

  return {
    total,
    keepCount,
    cutCount,
    trimCount,
    avgConfidence: Math.round((confidenceSum / total) * 1000) / 1000,
    approvedCount,
    rejectedCount,
    pendingCount,
  };
});

export const selectedSegment = computed(() => {
  const id = selectedSegmentId.value;
  if (!id) return null;
  return segments.value.find(s => s.id === id) || null;
});
