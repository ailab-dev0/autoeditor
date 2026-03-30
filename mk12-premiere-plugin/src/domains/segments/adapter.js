/**
 * Segments adapter — bridges EventBus intents to transport + signals.
 */

import { segments, approvals, segmentsError } from './signals';
import { validateEditPackage, parseSegments } from './protocol';

export function setupSegmentsAdapter(bus, transport) {
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

      // Initialize all approvals to pending
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

  // Approve a segment
  bus.on('segments:approve', async ({ segmentId, projectId }) => {
    approvals.value = { ...approvals.value, [segmentId]: 'approved' };
    bus.emit('segments:approved', { segmentId });
    transport.broadcastSync('segments:approved', { segmentId });

    if (projectId) {
      const result = await transport.patch(
        `/api/projects/${projectId}/segments/bulk`,
        { segments: [{ id: segmentId, status: 'approved' }] }
      );
      if (!result.ok) {
        bus.emit('segments:error', { error: result.error });
      }
    }
  });

  // Reject a segment
  bus.on('segments:reject', async ({ segmentId, projectId }) => {
    approvals.value = { ...approvals.value, [segmentId]: 'rejected' };
    bus.emit('segments:rejected', { segmentId });
    transport.broadcastSync('segments:rejected', { segmentId });

    if (projectId) {
      const result = await transport.patch(
        `/api/projects/${projectId}/segments/bulk`,
        { segments: [{ id: segmentId, status: 'rejected' }] }
      );
      if (!result.ok) {
        bus.emit('segments:error', { error: result.error });
      }
    }
  });

  // Fetch segments from backend
  bus.on('segments:fetch', async ({ projectId }) => {
    const result = await transport.get(`/api/projects/${projectId}/marks`);
    if (result.ok && result.data) {
      segments.value = Array.isArray(result.data) ? result.data : (result.data.segments || []);
      segmentsError.value = null;
      bus.emit('segments:fetched', { count: segments.value.length });
    } else {
      segmentsError.value = result.error;
      bus.emit('segments:error', { error: result.error });
    }
  });
}
