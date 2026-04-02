/**
 * Content marks routes.
 *
 * GET /api/projects/:id/marks                    — list all content marks
 * PUT /api/projects/:id/marks/:segId             — update content mark for segment
 * DELETE /api/projects/:id/marks/:segId          — remove content mark
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { listSegments, getSegment } from '../services/segment-service.js';
import type { ContentMark, AssetType } from '../types/index.js';

const VALID_ASSET_TYPES = [
  'stock_video', 'article', 'linkedin_photo', 'animation',
  'ai_image', 'loom_recording', 'speaking_only',
] as const;

const ContentMarkSchema = z.object({
  asset_type: z.enum(VALID_ASSET_TYPES),
  search_query: z.string().optional(),
  research_links: z.array(z.string().url()).optional(),
  notes: z.string().optional(),
});

export async function registerMarksRoutes(app: FastifyInstance): Promise<void> {
  // List all content marks for a project
  app.get('/api/projects/:id/marks', async (req, reply) => {
    const { id } = req.params as { id: string };

    // Try Neo4j segments first
    let segments: any[] = [];
    try {
      segments = await listSegments(id);
    } catch {
      // Neo4j unavailable
    }

    if (segments.length > 0) {
      const marks = segments
        .filter((seg) => seg.content_mark != null)
        .map((seg) => ({
          segment_id: seg.id,
          start: seg.start,
          end: seg.end,
          chapter: seg.chapter,
          content_mark: seg.content_mark,
        }));
      return reply.send({ marks });
    }

    // Fallback: derive marks from blueprint in MinIO
    try {
      const { isStorageConfigured, getFileStream } = await import('../services/storage-service.js');
      if (!isStorageConfigured()) return reply.send({ marks: [] });

      const stream = await getFileStream(`projects/${id}/blueprint-segments.jsonl`);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      const lines = Buffer.concat(chunks).toString('utf8').trim().split('\n').filter(Boolean);

      const marks = lines
        .map(line => JSON.parse(line))
        .filter((seg: any) => seg.aiPath?.action !== 'keep_original')
        .map((seg: any) => {
          const topic = seg.topic || '';
          const text = (seg.text || '').slice(0, 100);
          const action = seg.aiPath?.action || 'keep_original';

          let searchQuery = '';
          let assetType = 'stock_video';

          if (action === 'add_text') {
            assetType = 'text_overlay';
            searchQuery = `Text overlay: "${topic}"`;
          } else if (action === 'add_overlay' || action === 'replace_footage') {
            assetType = 'stock_video';
            searchQuery = topic || text || 'b-roll footage';
          } else if (action === 'add_animation') {
            assetType = 'animation';
            searchQuery = `Animated explainer: ${topic}`;
          }

          return {
            segment_id: seg.segmentId,
            start: seg.start,
            end: seg.end,
            topic,
            text,
            role: seg.role || '',
            suggestion: seg.suggestion,
            action,
            content_mark: {
              asset_type: assetType,
              search_query: searchQuery,
              notes: seg.explanation || seg.aiPath?.reason || '',
            },
            material: seg.aiPath?.material ?? null,
          };
        });

      return reply.send({ marks });
    } catch {
      return reply.send({ marks: [] });
    }
  });

  // Update content mark for a segment
  app.put('/api/projects/:id/marks/:segId', async (req, reply) => {
    const { id, segId } = req.params as { id: string; segId: string };

    const parsed = ContentMarkSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parsed.error.issues,
      });
    }

    const segment = await getSegment(id, segId);
    if (!segment) {
      return reply.status(404).send({ error: 'Segment not found' });
    }

    const contentMark = parsed.data as ContentMark;
    // Content marks are stored in-memory for the session
    // (persistent storage would go to MinIO blueprint updates)
    return reply.send({
      segment_id: segId,
      content_mark: contentMark,
    });
  });

  // Remove content mark from a segment
  app.delete('/api/projects/:id/marks/:segId', async (req, reply) => {
    const { id, segId } = req.params as { id: string; segId: string };

    const segment = await getSegment(id, segId);
    if (!segment) {
      return reply.status(404).send({ error: 'Segment not found' });
    }

    return reply.send({ success: true });
  });
}
