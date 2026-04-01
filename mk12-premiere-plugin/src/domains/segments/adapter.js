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

  // Fetch segments from blueprint (includes review decisions from dashboard)
  bus.on('segments:fetch', async ({ projectId }) => {
    if (!projectId) return;

    // Try blueprint first — it has full segment data + userChoice from review
    const bpResult = await transport.get(`/api/projects/${projectId}/blueprint`);
    if (bpResult.ok && bpResult.data) {
      const bp = bpResult.data.blueprint || bpResult.data;
      const bpSegments = bp.segments || [];

      if (bpSegments.length > 0) {
        // Map blueprint segments to the format the plugin expects
        const fetched = bpSegments.map(seg => ({
          id: seg.segmentId,
          start: seg.start ?? 0,
          end: seg.end ?? 0,
          videoPath: seg.mediaPath,
          suggestion: seg.suggestion || 'review',
          confidence: seg.confidence || 0,
          explanation: seg.explanation || seg.aiPath?.reason || '',
          topic: seg.topic || '',
          role: seg.role || '',
          importance: seg.importance || 0,
          content_mark: seg.aiPath?.action !== 'keep_original' ? {
            asset_type: seg.aiPath?.material?.type || seg.aiPath?.action,
            search_query: seg.aiPath?.material?.source || seg.aiPath?.reason || '',
          } : undefined,
          transition_after: seg.aiPath?.transitionAfter || undefined,
          handle_before: undefined,
          handle_after: undefined,
          userChoice: seg.userChoice,
        }));

        segments.value = fetched;

        // Map userChoice to approval state — dashboard decisions carry over
        const apps = {};
        for (const seg of fetched) {
          if (seg.userChoice === 'ai' || seg.userChoice === 'original' || seg.userChoice === 'custom') {
            apps[seg.id] = 'approved';
          } else {
            apps[seg.id] = 'pending';
          }
        }
        approvals.value = apps;
        segmentsError.value = null;

        bus.emit('segments:fetched', { count: fetched.length });
        return;
      }
    }

    // Fallback: fetch from marks
    const result = await transport.get(`/api/projects/${projectId}/marks`);
    if (result.ok && result.data) {
      const fetched = Array.isArray(result.data)
        ? result.data
        : (result.data.segments || result.data.marks || []);
      segments.value = fetched;

      const initial = {};
      for (const seg of fetched) {
        initial[seg.id || seg.segment_id] = 'pending';
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
