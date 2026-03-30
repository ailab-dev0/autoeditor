/**
 * Segments adapter — bridges EventBus intents to transport + signals.
 */

import { segments, approvals, selectedSegmentId, segmentsError } from './signals';
import { validateEditPackage, parseSegments } from './protocol';

export function setupSegmentsAdapter(bus, transport) {
  // In-flight lock per segmentId to prevent race conditions (#10)
  const inFlight = new Set();

  // Pipeline complete → parse edit package → hydrate segments
  bus.on('pipeline:complete', (data) => {
    try {
      const pkg = data?.editPackage || data;
      const validation = validateEditPackage(pkg);
      if (!validation.valid) {
        segmentsError.value = `Validation failed: ${validation.errors[0]}`;
        bus.emit('segments:error', { errors: validation.errors });
        return;
      }

      const parsed = parseSegments(pkg);
      segments.value = parsed;

      // Initialize all approvals to pending — don't carry stale state (#2)
      const initial = {};
      for (const seg of parsed) {
        initial[seg.id] = 'pending';
      }
      approvals.value = initial;
      segmentsError.value = null;

      bus.emit('segments:fetched', { count: parsed.length });
      transport.broadcastSync('segments:fetched', { count: parsed.length });
    } catch (err) {
      segmentsError.value = String(err);
      bus.emit('segments:error', { error: String(err) });
    }
  });

  // Approve a segment — optimistic with rollback on failure (#9, #10)
  bus.on('segments:approve', async ({ segmentId, projectId }) => {
    if (inFlight.has(segmentId)) return; // skip if in-flight (#10)
    inFlight.add(segmentId);

    const previous = approvals.value[segmentId];
    approvals.value = { ...approvals.value, [segmentId]: 'approved' };
    bus.emit('segments:approved', { segmentId });
    transport.broadcastSync('segments:approved', { segmentId });

    if (projectId) {
      const result = await transport.patch(
        `/api/projects/${projectId}/segments/bulk`,
        { segments: [{ id: segmentId, status: 'approved' }] }
      );
      if (!result.ok) {
        // Rollback on PATCH failure (#9)
        approvals.value = { ...approvals.value, [segmentId]: previous || 'pending' };
        bus.emit('segments:error', { error: result.error });
      }
    }

    inFlight.delete(segmentId);
  });

  // Reject a segment — optimistic with rollback on failure (#9, #10)
  bus.on('segments:reject', async ({ segmentId, projectId }) => {
    if (inFlight.has(segmentId)) return; // skip if in-flight (#10)
    inFlight.add(segmentId);

    const previous = approvals.value[segmentId];
    approvals.value = { ...approvals.value, [segmentId]: 'rejected' };
    bus.emit('segments:rejected', { segmentId });
    transport.broadcastSync('segments:rejected', { segmentId });

    if (projectId) {
      const result = await transport.patch(
        `/api/projects/${projectId}/segments/bulk`,
        { segments: [{ id: segmentId, status: 'rejected' }] }
      );
      if (!result.ok) {
        // Rollback on PATCH failure (#9)
        approvals.value = { ...approvals.value, [segmentId]: previous || 'pending' };
        bus.emit('segments:error', { error: result.error });
      }
    }

    inFlight.delete(segmentId);
  });

  // Fetch segments from backend
  bus.on('segments:fetch', async ({ projectId }) => {
    if (!projectId) return;
    const result = await transport.get(`/api/projects/${projectId}/marks`);
    if (result.ok && result.data) {
      const fetched = Array.isArray(result.data) ? result.data : (result.data.segments || []);
      segments.value = fetched;

      // Initialize approvals to pending (#2)
      const initial = {};
      for (const seg of fetched) {
        initial[seg.id] = 'pending';
      }
      approvals.value = initial;
      segmentsError.value = null;

      bus.emit('segments:fetched', { count: fetched.length });
    } else {
      segmentsError.value = result.error;
      bus.emit('segments:error', { error: result.error });
    }
  });

  // Select a segment — handles cross-domain writes (#14)
  bus.on('segments:select', ({ segmentId }) => {
    selectedSegmentId.value = segmentId || null;
  });
}
