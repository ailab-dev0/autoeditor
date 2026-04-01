/**
 * Project CRUD routes.
 *
 * GET    /api/projects                       — list user's projects
 * POST   /api/projects                       — create project (owned by user)
 * GET    /api/projects/:id                   — get project details (ownership check)
 * PUT    /api/projects/:id                   — update project (ownership check)
 * DELETE /api/projects/:id                   — delete project (ownership check)
 * GET    /api/projects/:id/video/:filename   — stream video file
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createReadStream, statSync, existsSync } from 'fs';
import { basename, resolve } from 'path';
import { requireRole } from '../middleware/rbac.js';
import {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
} from '../services/project-service.js';
import type { ListProjectsOptions } from '../services/project-service.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  video_paths: z.array(
    z.string().refine(
      (p) => !p.includes('..') && !p.startsWith('/') && !/^[a-zA-Z]:/.test(p),
      { message: 'video_paths must be relative paths without traversal sequences' },
    ),
  ).max(50).optional(),
  source_urls: z.array(z.string().url()).max(50).optional(),
  brief: z.string().optional(),
  fps: z.number().positive().optional(),
  resolution: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
  }).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

const ListProjectsQuerySchema = z.object({
  search: z.string().max(200).optional(),
  status: z.enum(['created', 'analyzing', 'ready', 'exporting', 'error']).optional(),
  sortBy: z.enum(['name', 'status', 'created_at']).optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  status: z.enum(['created', 'analyzing', 'ready', 'exporting', 'error']).optional(),
  video_paths: z.array(
    z.string().refine(
      (p) => !p.includes('..') && !p.startsWith('/') && !/^[a-zA-Z]:/.test(p),
      { message: 'video_paths must be relative paths without traversal sequences' },
    ),
  ).max(50).optional(),
  source_urls: z.array(z.string().url()).max(50).optional(),
  brief: z.string().optional(),
  fps: z.number().positive().optional(),
  resolution: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
  }).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

export async function registerProjectRoutes(app: FastifyInstance): Promise<void> {
  // List user's projects (with search, filter, sort, pagination)
  // No role guard — read access is intentionally open to all authenticated users
  app.get('/api/projects', async (req, reply) => {
    const parsed = ListProjectsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid query parameters',
        details: parsed.error.issues,
      });
    }

    const opts: ListProjectsOptions = {};
    if (parsed.data.search) opts.search = parsed.data.search;
    if (parsed.data.status) opts.status = parsed.data.status;
    if (parsed.data.sortBy) opts.sortBy = parsed.data.sortBy;
    if (parsed.data.sortDir) opts.sortDir = parsed.data.sortDir;
    if (parsed.data.page) opts.page = parsed.data.page;
    if (parsed.data.limit) opts.limit = parsed.data.limit;

    const result = await listProjects(req.user!.id, opts);
    return reply.send(result);
  });

  // Create project (editor, producer only) — owned by user
  app.post('/api/projects', { preHandler: [requireRole('editor', 'producer', 'creative_director')] }, async (req, reply) => {
    const parsed = CreateProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parsed.error.issues,
      });
    }

    const project = await createProject(req.user!.id, parsed.data);
    return reply.status(201).send({ project });
  });

  // Get project by ID (ownership check)
  app.get('/api/projects/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!UUID_RE.test(id)) {
      return reply.status(400).send({ error: 'Invalid project ID format' });
    }
    const project = await getProject(req.user!.id, id);

    if (!project) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    return reply.send({ project });
  });

  // Update project (editor, producer only, ownership check)
  app.put('/api/projects/:id', { preHandler: [requireRole('editor', 'producer', 'creative_director')] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!UUID_RE.test(id)) {
      return reply.status(400).send({ error: 'Invalid project ID format' });
    }

    const parsed = UpdateProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parsed.error.issues,
      });
    }

    if (Object.keys(parsed.data).length === 0) {
      return reply.status(400).send({ error: 'No fields to update' });
    }

    const project = await updateProject(req.user!.id, id, parsed.data);
    if (!project) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    return reply.send({ project });
  });

  // Delete project (editor, producer only, ownership check)
  app.delete('/api/projects/:id', { preHandler: [requireRole('editor', 'producer', 'creative_director')] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!UUID_RE.test(id)) {
      return reply.status(400).send({ error: 'Invalid project ID format' });
    }
    const deleted = await deleteProject(req.user!.id, id);

    if (!deleted) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    return reply.send({ success: true });
  });

  // Stream video file for a project (ownership check)
  app.get('/api/projects/:id/video/:filename', async (req, reply) => {
    const { id, filename } = req.params as { id: string; filename: string };
    if (!UUID_RE.test(id)) {
      return reply.status(400).send({ error: 'Invalid project ID format' });
    }
    const project = await getProject(req.user!.id, id);

    if (!project) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    const videoPaths = project.video_paths ?? [];
    const decodedFilename = decodeURIComponent(filename);

    // Reject path traversal attempts
    if (decodedFilename.includes('..') || decodedFilename.includes('/') || decodedFilename.includes('\\')) {
      return reply.status(400).send({ error: 'Invalid filename' });
    }

    // Find matching video path by basename only (covers full paths and bare filenames)
    const matchingPath = videoPaths.find(
      (vp) => basename(vp) === decodedFilename
    );

    if (!matchingPath) {
      return reply.status(404).send({ error: 'Video file not associated with this project' });
    }

    // Resolve the file path — check absolute, then common directories
    let filePath = resolve(matchingPath);

    if (!existsSync(filePath)) {
      const searchDirs = [
        '/tmp',
        process.cwd(),
        `${process.env.HOME}/Movies`,
        `${process.env.HOME}/Desktop`,
        `${process.env.HOME}/Downloads`,
        `${process.env.HOME}/Documents`,
      ];
      let found = false;
      for (const dir of searchDirs) {
        const candidate = resolve(dir, decodedFilename);
        if (existsSync(candidate)) {
          filePath = candidate;
          found = true;
          break;
        }
      }
      if (!found) {
        return reply.status(404).send({ error: 'Video file not found on disk' });
      }
    }

    const stat = statSync(filePath);
    const fileSize = stat.size;

    // Determine Content-Type from extension
    const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
    const mimeTypes: Record<string, string> = {
      mp4: 'video/mp4',
      webm: 'video/webm',
      mkv: 'video/x-matroska',
      mov: 'video/quicktime',
      avi: 'video/x-msvideo',
      m4v: 'video/mp4',
      ogv: 'video/ogg',
    };
    const contentType = mimeTypes[ext] ?? 'application/octet-stream';

    // Handle Range requests for seeking
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize) {
        reply.raw.writeHead(416, {
          'Content-Range': `bytes */${fileSize}`,
        });
        reply.raw.end();
        return;
      }

      const chunkSize = end - start + 1;
      const stream = createReadStream(filePath, { start, end });

      reply.raw.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType,
      });

      stream.pipe(reply.raw);
    } else {
      reply.raw.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
      });

      const stream = createReadStream(filePath);
      stream.pipe(reply.raw);
    }
  });
}
