/**
 * Project CRUD routes.
 *
 * GET    /api/projects         — list all projects
 * POST   /api/projects         — create project
 * GET    /api/projects/:id     — get project details
 * PUT    /api/projects/:id     — update project
 * DELETE /api/projects/:id     — delete project
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
} from '../services/project-service.js';

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  video_paths: z.array(z.string()).optional(),
  source_urls: z.array(z.string().url()).optional(),
  brief: z.string().optional(),
  fps: z.number().positive().optional(),
  resolution: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
  }).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  status: z.enum(['created', 'analyzing', 'ready', 'exporting', 'error']).optional(),
  video_paths: z.array(z.string()).optional(),
  source_urls: z.array(z.string().url()).optional(),
  sourceUrl: z.string().url().optional(),
  brief: z.string().optional(),
  fps: z.number().positive().optional(),
  resolution: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
  }).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

export async function registerProjectRoutes(app: FastifyInstance): Promise<void> {
  // List all projects
  app.get('/api/projects', async (_req, reply) => {
    const projects = listProjects();
    return reply.send({ projects });
  });

  // Create project
  app.post('/api/projects', async (req, reply) => {
    const parsed = CreateProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parsed.error.issues,
      });
    }

    const project = await createProject(parsed.data);
    return reply.status(201).send({ project });
  });

  // Get project by ID
  app.get('/api/projects/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const project = getProject(id);

    if (!project) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    return reply.send({ project });
  });

  // Update project
  app.put('/api/projects/:id', async (req, reply) => {
    const { id } = req.params as { id: string };

    const parsed = UpdateProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parsed.error.issues,
      });
    }

    const project = await updateProject(id, parsed.data);
    if (!project) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    return reply.send({ project });
  });

  // Delete project
  app.delete('/api/projects/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const deleted = await deleteProject(id);

    if (!deleted) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    return reply.send({ success: true });
  });
}
