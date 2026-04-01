/**
 * Pipeline control routes.
 *
 * POST /api/projects/:id/pipeline/start    — start 5-stage analysis
 * GET  /api/projects/:id/pipeline/status   — current pipeline status
 * GET  /api/projects/:id/pipeline/stream   — SSE stream of progress events
 */

import type { FastifyInstance } from 'fastify';
import { requireRole } from '../middleware/rbac.js';
import { getProject, getProjectById } from '../services/project-service.js';
import {
  startPipeline,
  getPipelineStatus,
  registerSSEListener,
} from '../services/analysis-service.js';

export async function registerPipelineRoutes(app: FastifyInstance): Promise<void> {
  // Start pipeline (editor, producer only)
  app.post('/api/projects/:id/pipeline/start', { preHandler: [requireRole('editor', 'producer', 'creative_director')] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const project = await getProject(req.user!.id, id);

    if (!project) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    if (project.status === 'analyzing') {
      return reply.status(409).send({
        error: 'Pipeline already running',
        pipeline_status: await getPipelineStatus(id),
      });
    }

    // Validate video paths exist
    const videoPaths = project.video_paths ?? [];
    if (videoPaths.length === 0) {
      return reply.status(400).send({
        error: 'No video files to analyze',
        detail: 'Add video_paths to the project before starting the pipeline.',
      });
    }

    console.log(`[pipeline] Starting analysis with ${videoPaths.length} video(s):`, videoPaths);

    try {
      const body = req.body as { stop_after_stage?: string; start_from_stage?: string } | undefined;
      const options: import('../analysis/pipeline.js').PipelineOptions = {};
      if (body?.stop_after_stage) options.stopAfterStage = body.stop_after_stage as any;
      if (body?.start_from_stage) options.startFromStage = body.start_from_stage as any;
      const status = await startPipeline(project, Object.keys(options).length ? options : undefined);
      return reply.status(202).send({ pipeline_status: status });
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  // Get pipeline status
  app.get('/api/projects/:id/pipeline/status', async (req, reply) => {
    const { id } = req.params as { id: string };
    const project = await getProject(req.user!.id, id);

    if (!project) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    const status = await getPipelineStatus(id);
    if (!status) {
      return reply.send({
        pipeline_status: null,
        message: 'No pipeline has been run for this project',
      });
    }

    // Ensure completed/error pipelines always have a status field
    if (!status.status && status.overall_progress >= 100) {
      status.status = 'completed';
    }
    if (!status.status && project.status === 'ready') {
      status.status = 'completed';
    }
    if (!status.status && project.status === 'error') {
      status.status = 'error';
    }

    return reply.send({ pipeline_status: status });
  });

  // SSE stream of pipeline progress
  app.get('/api/projects/:id/pipeline/stream', async (req, reply) => {
    const { id } = req.params as { id: string };
    const project = await getProject(req.user!.id, id);

    if (!project) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    // Set SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering
    });

    // Send initial status as unnamed SSE event so browser onmessage catches it
    const currentStatus = await getPipelineStatus(id);
    if (currentStatus) {
      reply.raw.write(`data: ${JSON.stringify({ type: 'initial_status', status: currentStatus })}\n\n`);
    }

    // Register for progress events — send as unnamed events with type in payload
    const unsubscribe = registerSSEListener(id, (event, data) => {
      try {
        const payload = { type: event, ...(data as Record<string, unknown>) };
        reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
      } catch {
        // Client disconnected
        unsubscribe();
      }
    });

    // Keep-alive ping every 15 seconds
    const keepAlive = setInterval(() => {
      try {
        reply.raw.write(`:keepalive\n\n`);
      } catch {
        clearInterval(keepAlive);
        unsubscribe();
      }
    }, 15000);

    // Cleanup on client disconnect
    req.raw.on('close', () => {
      clearInterval(keepAlive);
      unsubscribe();
    });
  });
}
