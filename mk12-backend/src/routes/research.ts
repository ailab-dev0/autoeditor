/**
 * Deep Research routes.
 *
 * POST /api/projects/:id/research/:conceptId  — research a specific concept
 * POST /api/projects/:id/research/bulk        — research all concepts in project
 * GET  /api/projects/:id/research             — list all research results
 * GET  /api/projects/:id/research/:conceptId  — get research for concept
 */

import type { FastifyInstance } from 'fastify';
import { getResearchService } from '../services/research-service.js';

export async function registerResearchRoutes(app: FastifyInstance): Promise<void> {
  const researchService = getResearchService();

  // ── Research a specific concept ───────────────────────────────
  // NOTE: This must be registered BEFORE the GET /:conceptId route
  // but Fastify handles POST vs GET separately, so order is fine.

  app.post('/api/projects/:id/research/bulk', async (req, reply) => {
    const { id } = req.params as { id: string };

    try {
      const results = await researchService.bulkResearch(id);

      return reply.send({
        project_id: id,
        count: results.length,
        results,
      });
    } catch (err) {
      const message = (err as Error).message;

      if (message.includes('OPENROUTER_API_KEY')) {
        return reply.status(503).send({
          error: message,
          code: 'OPENROUTER_KEY_MISSING',
        });
      }

      if (message.includes('No concepts found')) {
        return reply.status(400).send({
          error: message,
          code: 'NO_CONCEPTS',
        });
      }

      return reply.status(500).send({
        error: `Bulk research failed: ${message}`,
        code: 'RESEARCH_FAILED',
      });
    }
  });

  app.post('/api/projects/:id/research/:conceptId', async (req, reply) => {
    const { id, conceptId } = req.params as { id: string; conceptId: string };

    try {
      const result = await researchService.researchConcept(id, conceptId);

      return reply.send({
        project_id: id,
        research: result,
      });
    } catch (err) {
      const message = (err as Error).message;

      if (message.includes('OPENROUTER_API_KEY')) {
        return reply.status(503).send({
          error: message,
          code: 'OPENROUTER_KEY_MISSING',
        });
      }

      if (message.includes('not found')) {
        return reply.status(404).send({
          error: message,
          code: 'NOT_FOUND',
        });
      }

      return reply.status(500).send({
        error: `Research failed: ${message}`,
        code: 'RESEARCH_FAILED',
      });
    }
  });

  // ── List all research results ─────────────────────────────────

  app.get('/api/projects/:id/research', async (req, reply) => {
    const { id } = req.params as { id: string };

    const results = await researchService.listResearch(id);

    return reply.send({
      project_id: id,
      count: results.length,
      results,
    });
  });

  // ── Get research for a specific concept ───────────────────────

  app.get('/api/projects/:id/research/:conceptId', async (req, reply) => {
    const { id, conceptId } = req.params as { id: string; conceptId: string };

    const result = await researchService.getResearch(id, conceptId);

    if (!result) {
      return reply.status(404).send({
        error: `No research found for concept ${conceptId}`,
        code: 'NOT_FOUND',
      });
    }

    return reply.send({
      project_id: id,
      research: result,
    });
  });
}
