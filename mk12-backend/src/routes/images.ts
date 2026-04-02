/**
 * AI image generation routes.
 *
 * POST /api/projects/:id/images/generate                 — generate image from prompt
 * POST /api/projects/:id/segments/:segId/generate-image   — generate from content mark
 * GET  /api/projects/:id/images                           — list generated images
 * GET  /api/projects/:id/images/:imageId                  — get single image
 */

import type { FastifyInstance } from 'fastify';
import { getImageGenerationService } from '../services/image-generation-service.js';
import type { ImageModel, AspectRatio } from '../services/image-generation-service.js';

export async function registerImageRoutes(app: FastifyInstance): Promise<void> {
  const imageService = getImageGenerationService();

  // ── Generate image from prompt ────────────────────────────────

  app.post('/api/projects/:id/images/generate', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as {
      prompt?: string;
      model?: ImageModel;
      width?: number;
      height?: number;
      aspectRatio?: AspectRatio;
    };

    if (!body.prompt?.trim()) {
      return reply.status(400).send({
        error: 'Missing required field: prompt',
      });
    }

    try {
      const image = await imageService.generateImage(id, body.prompt.trim(), {
        model: body.model,
        width: body.width,
        height: body.height,
        aspectRatio: body.aspectRatio,
      });

      // Record image generation cost
      const { recordCost } = await import('../services/cost-service.js');
      recordCost({
        projectId: id,
        service: 'fal',
        operation: 'image_generation',
        model: body.model ?? 'flux',
        metadata: { prompt: body.prompt.trim().slice(0, 100), width: image.width, height: image.height },
      });

      return reply.send({ image });
    } catch (err) {
      const message = (err as Error).message;

      // If it's a config error, return 503
      if (message.includes('FAL_API_KEY')) {
        return reply.status(503).send({
          error: message,
          code: 'FAL_API_KEY_MISSING',
        });
      }

      return reply.status(500).send({
        error: `Image generation failed: ${message}`,
        code: 'GENERATION_FAILED',
      });
    }
  });

  // ── Generate image from content mark ──────────────────────────

  app.post('/api/projects/:id/segments/:segId/generate-image', async (req, reply) => {
    const { id, segId } = req.params as { id: string; segId: string };
    const body = req.body as {
      model?: ImageModel;
      width?: number;
      height?: number;
      aspectRatio?: AspectRatio;
    } | null;

    try {
      const image = await imageService.generateForContentMark(id, segId, {
        model: body?.model,
        width: body?.width,
        height: body?.height,
        aspectRatio: body?.aspectRatio,
      });

      const { recordCost } = await import('../services/cost-service.js');
      recordCost({
        projectId: id,
        service: 'fal',
        operation: 'image_generation',
        model: body?.model ?? 'flux',
        metadata: { segmentId: segId, width: image.width, height: image.height },
      });

      return reply.send({ image });
    } catch (err) {
      const message = (err as Error).message;

      if (message.includes('FAL_API_KEY')) {
        return reply.status(503).send({
          error: message,
          code: 'FAL_API_KEY_MISSING',
        });
      }

      if (message.includes('not found') || message.includes('no content mark')) {
        return reply.status(404).send({
          error: message,
          code: 'NOT_FOUND',
        });
      }

      return reply.status(500).send({
        error: `Image generation failed: ${message}`,
        code: 'GENERATION_FAILED',
      });
    }
  });

  // ── List generated images ─────────────────────────────────────

  app.get('/api/projects/:id/images', async (req, reply) => {
    const { id } = req.params as { id: string };
    const images = imageService.listGenerated(id);

    return reply.send({
      project_id: id,
      count: images.length,
      images,
    });
  });

  // ── Get single image ──────────────────────────────────────────

  app.get('/api/projects/:id/images/:imageId', async (req, reply) => {
    const { id, imageId } = req.params as { id: string; imageId: string };
    const image = imageService.getImage(id, imageId);

    if (!image) {
      return reply.status(404).send({
        error: `Image ${imageId} not found`,
        code: 'NOT_FOUND',
      });
    }

    return reply.send({ image });
  });
}
