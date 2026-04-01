/**
 * Animation template routes.
 *
 * GET  /api/templates                                — list available animation templates
 * POST /api/projects/:id/templates/generate          — auto-generate animations from knowledge graph
 * GET  /api/projects/:id/templates/status             — status of template generation jobs
 */

import type { FastifyInstance } from 'fastify';
import { getTemplateService } from '../services/template-service.js';

// Static template registry — describes available Remotion compositions
const AVAILABLE_TEMPLATES = [
  {
    id: 'KnowledgeGraphAnim',
    name: 'Knowledge Graph Animation',
    description: 'Animated force-directed knowledge graph with community coloring and PageRank sizing.',
    category: 'visualization',
    props_schema: ['nodes', 'edges', 'title', 'duration'],
  },
  {
    id: 'DataDashboard',
    name: 'Data Dashboard',
    description: 'Animated statistics dashboard with counters, pie chart, bar chart, and pedagogy gauge.',
    category: 'analytics',
    props_schema: ['stats', 'pedagogyScore', 'title'],
  },
  {
    id: 'ProcessFlow',
    name: 'Process Flow Diagram',
    description: 'Step-by-step animated workflow diagram for processes and procedures.',
    category: 'diagram',
    props_schema: ['steps', 'title', 'direction'],
  },
  {
    id: 'InfoGraphic',
    name: 'Infographic',
    description: 'Data visualization with flow, bar, or card layouts.',
    category: 'visualization',
    props_schema: ['title', 'subtitle', 'steps', 'layout'],
  },
  {
    id: 'ConceptExplainer',
    name: 'Concept Explainer',
    description: 'Animated concept explanation with bullet points and icons.',
    category: 'education',
    props_schema: ['title', 'intro', 'points', 'conclusion'],
  },
  {
    id: 'ChapterTitle',
    name: 'Chapter Title',
    description: 'Chapter title card with number, title, and duration.',
    category: 'title',
    props_schema: ['chapterNumber', 'title', 'subtitle', 'duration', 'totalChapters'],
  },
  {
    id: 'TextOverlay',
    name: 'Text Overlay',
    description: 'Lower third, full screen, or centered text overlay.',
    category: 'overlay',
    props_schema: ['text', 'secondaryText', 'variant'],
  },
  {
    id: 'ArticleReference',
    name: 'Article Reference',
    description: 'News article or source reference card.',
    category: 'reference',
    props_schema: ['headline', 'source', 'date', 'summary'],
  },
  {
    id: 'StockFootagePlaceholder',
    name: 'Stock Footage Placeholder',
    description: 'Placeholder card for stock footage segments.',
    category: 'placeholder',
    props_schema: ['searchQuery', 'scenario', 'description'],
  },
];

export async function registerTemplateRoutes(app: FastifyInstance): Promise<void> {
  const templateService = getTemplateService();

  // ── List available templates ────────────────────────────────

  app.get('/api/templates', async (_req, reply) => {
    return reply.send({
      templates: AVAILABLE_TEMPLATES,
      count: AVAILABLE_TEMPLATES.length,
    });
  });

  // ── Generate animations from knowledge graph ────────────────

  app.post('/api/projects/:id/templates/generate', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as {
      template_ids?: string[];
      concept_id?: string;
    };

    // If a specific concept and template are requested, generate just that
    if (body.concept_id && body.template_ids?.length === 1) {
      try {
        const result = await templateService.generatePropsFromConcept(
          id,
          body.concept_id,
          body.template_ids[0],
        );
        return reply.send({ templates: [result] });
      } catch (err) {
        return reply.status(400).send({
          error: (err as Error).message,
        });
      }
    }

    // Otherwise, generate all templates for the project
    const job = await templateService.generateAllForProject(id);

    return reply.send({
      job_id: job.id,
      status: job.status,
      template_count: job.templates.length,
      templates: job.templates,
      started_at: job.started_at,
      completed_at: job.completed_at,
      error: job.error,
    });
  });

  // ── Check generation status ──────────────────────────────────

  app.get('/api/projects/:id/templates/status', async (req, reply) => {
    const { id } = req.params as { id: string };
    const query = req.query as Record<string, string | undefined>;
    const jobId = query.job_id;

    // If a specific job ID is provided, return that job
    if (jobId) {
      const job = templateService.getJob(jobId);
      if (!job) {
        return reply.status(404).send({ error: 'Job not found' });
      }
      return reply.send({
        job_id: job.id,
        project_id: job.project_id,
        status: job.status,
        template_count: job.templates.length,
        templates: job.templates,
        started_at: job.started_at,
        completed_at: job.completed_at,
        error: job.error,
      });
    }

    // Otherwise return the latest job for this project
    const latest = templateService.getLatestJob(id);
    if (!latest) {
      return reply.send({
        project_id: id,
        status: 'none',
        message: 'No template generation jobs found. POST to /templates/generate to start one.',
      });
    }

    return reply.send({
      job_id: latest.id,
      project_id: latest.project_id,
      status: latest.status,
      template_count: latest.templates.length,
      templates: latest.templates,
      started_at: latest.started_at,
      completed_at: latest.completed_at,
      error: latest.error,
    });
  });
}
