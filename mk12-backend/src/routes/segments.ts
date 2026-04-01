/**
 * Segment management routes.
 *
 * GET /api/projects/:id/segments           — list segments with filters
 * PUT /api/projects/:id/segments/:segId/approve  — approve segment
 * PUT /api/projects/:id/segments/:segId/reject   — reject with override
 * PUT /api/projects/:id/segments/bulk      — bulk approve/reject
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireRole } from '../middleware/rbac.js';
import {
  listSegments,
  approveSegment,
  rejectSegment,
  bulkUpdateSegments,
  getApprovalStats,
} from '../services/segment-service.js';
import { processSegmentUpdate } from '../services/sync-service.js';
import type { Suggestion } from '../types/index.js';

const VALID_SUGGESTIONS = [
  'keep', 'cut', 'trim_start', 'trim_end', 'trim_both',
  'rearrange', 'speed_up', 'merge', 'review',
] as const;

const RejectSchema = z.object({
  override_decision: z.enum(VALID_SUGGESTIONS).optional(),
  reason: z.string().optional(),
});

const BulkUpdateSchema = z.object({
  segment_ids: z.array(z.string()).min(1),
  approved: z.boolean(),
});

export async function registerSegmentRoutes(app: FastifyInstance): Promise<void> {
  // List segments with optional filters
  app.get('/api/projects/:id/segments', async (req, reply) => {
    const { id } = req.params as { id: string };
    const query = req.query as Record<string, string | undefined>;

    const filters: {
      decision?: Suggestion;
      minConfidence?: number;
      maxConfidence?: number;
      chapter?: string;
      approved?: boolean;
    } = {};

    if (query.decision && VALID_SUGGESTIONS.includes(query.decision as any)) {
      filters.decision = query.decision as Suggestion;
    }
    if (query.minConfidence) {
      filters.minConfidence = parseFloat(query.minConfidence);
    }
    if (query.maxConfidence) {
      filters.maxConfidence = parseFloat(query.maxConfidence);
    }
    if (query.chapter) {
      filters.chapter = query.chapter;
    }
    if (query.approved !== undefined) {
      filters.approved = query.approved === 'true';
    }

    const segments = await listSegments(id, Object.keys(filters).length > 0 ? filters : undefined);
    const stats = await getApprovalStats(id);

    return reply.send({ segments, stats });
  });

  // Approve a segment (editor, creative_director only)
  app.put('/api/projects/:id/segments/:segId/approve', { preHandler: [requireRole('editor', 'creative_director')] }, async (req, reply) => {
    const { id, segId } = req.params as { id: string; segId: string };

    const segment = await approveSegment(id, segId);
    if (!segment) {
      return reply.status(404).send({ error: 'Segment not found' });
    }

    // Broadcast via sync service
    await processSegmentUpdate(id, {
      segmentId: segId,
      approved: true,
      override: null,
      timestamp: Date.now(),
      source: 'dashboard',
    }, 'dashboard');

    return reply.send({ segment, stats: await getApprovalStats(id) });
  });

  // Reject a segment (editor, creative_director only)
  app.put('/api/projects/:id/segments/:segId/reject', { preHandler: [requireRole('editor', 'creative_director')] }, async (req, reply) => {
    const { id, segId } = req.params as { id: string; segId: string };

    const parsed = RejectSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parsed.error.issues,
      });
    }

    const segment = await rejectSegment(id, segId, parsed.data.override_decision);
    if (!segment) {
      return reply.status(404).send({ error: 'Segment not found' });
    }

    // Broadcast via sync service
    await processSegmentUpdate(id, {
      segmentId: segId,
      approved: false,
      override: parsed.data.override_decision
        ? { decision: parsed.data.override_decision, reason: parsed.data.reason }
        : null,
      timestamp: Date.now(),
      source: 'dashboard',
    }, 'dashboard');

    return reply.send({ segment, stats: await getApprovalStats(id) });
  });

  // Bulk approve/reject (editor, creative_director only)
  app.put('/api/projects/:id/segments/bulk', { preHandler: [requireRole('editor', 'creative_director')] }, async (req, reply) => {
    const { id } = req.params as { id: string };

    const parsed = BulkUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parsed.error.issues,
      });
    }

    const updated = await bulkUpdateSegments(id, parsed.data.segment_ids, parsed.data.approved);

    // Broadcast each update
    for (const seg of updated) {
      await processSegmentUpdate(id, {
        segmentId: seg.id,
        approved: parsed.data.approved,
        override: null,
        timestamp: Date.now(),
        source: 'dashboard',
      }, 'dashboard');
    }

    return reply.send({
      updated: updated.length,
      stats: await getApprovalStats(id),
    });
  });
}
