/**
 * Animation routes.
 *
 * POST /api/projects/:id/animations/generate  — trigger animation generation for content marks
 * GET  /api/projects/:id/animations/status     — get status of all animation jobs
 * GET  /api/projects/:id/animations/status/:jobId — get status of a single job
 */

import type { FastifyInstance } from 'fastify';
import { getProject } from '../services/project-service.js';
import { listSegments } from '../services/segment-service.js';
import { getAnimationService } from '../services/animation-service.js';

export async function registerAnimationRoutes(app: FastifyInstance): Promise<void> {
  const animationService = getAnimationService();

  // Generate animations for all content marks in a project
  app.post('/api/projects/:id/animations/generate', async (req, reply) => {
    const { id } = req.params as { id: string };
    const project = await getProject(req.user!.id, id);

    if (!project) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    // Gather all segments that have content marks
    const segments = await listSegments(id);
    const markedSegments = segments
      .filter((seg) => seg.content_mark != null)
      .map((seg) => ({
        segmentId: seg.id,
        contentMark: seg.content_mark!,
      }));

    if (markedSegments.length === 0) {
      return reply.status(409).send({
        error: 'No content marks found. Run analysis pipeline first and add content marks.',
      });
    }

    // Check animation engine health
    const healthy = await animationService.healthCheck();
    if (!healthy) {
      return reply.status(503).send({
        error: 'Animation engine is not available. Ensure it is running on the configured URL.',
      });
    }

    try {
      const result = await animationService.batchGenerate(markedSegments);

      return reply.status(202).send({
        message: `Queued ${result.jobs.filter((j) => j.status !== 'failed').length} animation jobs`,
        total: markedSegments.length,
        jobs: result.jobs,
      });
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  // Get status of all animation jobs for a project
  app.get('/api/projects/:id/animations/status', async (req, reply) => {
    const { id } = req.params as { id: string };
    const project = await getProject(req.user!.id, id);

    if (!project) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    try {
      const jobs = await animationService.getAllJobStatuses();
      return reply.send({ jobs });
    } catch (err) {
      return reply.status(500).send({
        error: (err as Error).message,
        jobs: [],
      });
    }
  });

  // Get status of a single animation job
  app.get('/api/projects/:id/animations/status/:jobId', async (req, reply) => {
    const { id, jobId } = req.params as { id: string; jobId: string };
    const project = await getProject(req.user!.id, id);

    if (!project) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    try {
      const status = await animationService.getStatus(jobId);
      return reply.send({ job: status });
    } catch (err) {
      return reply.status(404).send({ error: (err as Error).message });
    }
  });
}
