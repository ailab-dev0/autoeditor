/**
 * Annotation REST routes.
 *
 * GET    /api/projects/:id/annotations              — list all annotations
 * POST   /api/projects/:id/annotations              — create annotation
 * PUT    /api/projects/:id/annotations/:annotationId — update annotation
 * DELETE /api/projects/:id/annotations/:annotationId — delete annotation
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  listAnnotations,
  createAnnotation,
  updateAnnotation,
  deleteAnnotation,
} from '../services/annotation-service.js';

const CreateAnnotationSchema = z.object({
  text: z.string().min(1, 'Annotation text is required'),
  timestamp: z.number().min(0, 'Timestamp must be >= 0'),
  segment_id: z.string().min(1, 'Segment ID is required'),
  author_id: z.string().min(1, 'Author ID is required'),
  author_name: z.string().min(1, 'Author name is required'),
  color: z.string().optional(),
});

const UpdateAnnotationSchema = z.object({
  text: z.string().min(1).optional(),
  timestamp: z.number().min(0).optional(),
}).refine(
  (data) => data.text !== undefined || data.timestamp !== undefined,
  { message: 'At least one field (text or timestamp) must be provided' },
);

export async function registerAnnotationRoutes(app: FastifyInstance): Promise<void> {
  // ── List all annotations for a project ────────────────────────────
  app.get('/api/projects/:id/annotations', async (req, reply) => {
    const { id } = req.params as { id: string };

    const annotations = await listAnnotations(id);
    return reply.send({ annotations, count: annotations.length });
  });

  // ── Create a new annotation ───────────────────────────────────────
  app.post('/api/projects/:id/annotations', async (req, reply) => {
    const { id } = req.params as { id: string };

    const parsed = CreateAnnotationSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parsed.error.issues,
      });
    }

    // Extract collab client ID from header for broadcast exclusion
    const collabClientId = (req.headers['x-collab-client-id'] as string) ?? undefined;

    const annotation = await createAnnotation(id, parsed.data);
    return reply.status(201).send({ annotation });
  });

  // ── Update an annotation ──────────────────────────────────────────
  app.put('/api/projects/:id/annotations/:annotationId', async (req, reply) => {
    const { id, annotationId } = req.params as { id: string; annotationId: string };

    const parsed = UpdateAnnotationSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parsed.error.issues,
      });
    }

    const collabClientId = (req.headers['x-collab-client-id'] as string) ?? undefined;

    const annotation = await updateAnnotation(id, annotationId, parsed.data);
    if (!annotation) {
      return reply.status(404).send({ error: 'Annotation not found' });
    }

    return reply.send({ annotation });
  });

  // ── Delete an annotation ──────────────────────────────────────────
  app.delete('/api/projects/:id/annotations/:annotationId', async (req, reply) => {
    const { id, annotationId } = req.params as { id: string; annotationId: string };

    const collabClientId = (req.headers['x-collab-client-id'] as string) ?? undefined;

    const deleted = await deleteAnnotation(id, annotationId);
    if (!deleted) {
      return reply.status(404).send({ error: 'Annotation not found' });
    }

    return reply.status(204).send();
  });
}
