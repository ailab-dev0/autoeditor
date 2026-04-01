/**
 * Video upload routes.
 *
 * POST /api/projects/:id/upload    — Upload video file to MinIO, add path to project
 * GET  /api/projects/:id/videos    — List uploaded videos with presigned URLs
 * DELETE /api/projects/:id/videos/:key — Delete an uploaded video
 */

import type { FastifyInstance } from 'fastify';
import { requireRole } from '../middleware/rbac.js';
import { getProject, updateProject } from '../services/project-service.js';
import {
  uploadVideo,
  listProjectVideos,
  deleteFile,
  isStorageConfigured,
} from '../services/storage-service.js';
import { query as pgQuery } from '../db/postgres.js';

export async function registerUploadRoutes(app: FastifyInstance): Promise<void> {
  // Upload video file
  app.post(
    '/api/projects/:id/upload',
    { preHandler: [requireRole('editor', 'producer', 'creative_director')] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const userId = req.user!.id;

      const project = await getProject(userId, id);
      if (!project) return reply.status(404).send({ error: 'Project not found' });

      if (!isStorageConfigured()) {
        return reply.status(503).send({
          error: 'Object storage not configured',
          detail: 'Set MINIO_ENDPOINT, MINIO_ACCESS_KEY, and MINIO_SECRET_KEY in .env',
        });
      }

      // Fastify multipart — read the raw body as a file
      const contentType = (req.headers['content-type'] || '').toLowerCase();

      if (contentType.includes('multipart')) {
        // Multipart file upload — stream directly to MinIO (no memory buffering)
        const data = await req.file();
        if (!data) return reply.status(400).send({ error: 'No file in request' });

        const filename = data.filename || `video-${Date.now()}.mp4`;

        const { key, url } = await uploadVideo(id, filename, data.file, data.mimetype || 'video/mp4');

        // Add to project video_paths
        const currentPaths = project.video_paths || [];
        const minioPath = `minio://${key}`;
        if (!currentPaths.includes(minioPath)) {
          await pgQuery(
            `UPDATE projects SET video_paths = video_paths || $1::jsonb, updated_at = NOW() WHERE id = $2 AND user_id = $3`,
            [JSON.stringify([minioPath]), id, userId],
          );
        }

        return reply.status(201).send({
          uploaded: { key, filename, url, size: 0 },
          project_id: id,
        });
      }

      // JSON body with URL or local path
      const body = req.body as { url?: string; path?: string; filename?: string } | undefined;
      if (body?.url) {
        // Download from URL and stream to MinIO (no memory buffering)
        const filename = body.filename || body.url.split('/').pop() || `video-${Date.now()}.mp4`;
        const response = await fetch(body.url);
        if (!response.ok) return reply.status(400).send({ error: `Failed to fetch URL: ${response.status}` });
        if (!response.body) return reply.status(400).send({ error: 'URL response has no body' });

        const { Readable } = await import('stream');
        const nodeStream = Readable.fromWeb(response.body as any);
        const { key, url } = await uploadVideo(id, filename, nodeStream);

        const minioPath = `minio://${key}`;
        const currentPaths = project.video_paths || [];
        if (!currentPaths.includes(minioPath)) {
          await pgQuery(
            `UPDATE projects SET video_paths = video_paths || $1::jsonb, updated_at = NOW() WHERE id = $2 AND user_id = $3`,
            [JSON.stringify([minioPath]), id, userId],
          );
        }

        return reply.status(201).send({
          uploaded: { key, filename, url, size: 0 },
          project_id: id,
        });
      }

      if (body?.path) {
        // Register a local file path (no upload — file stays on editor's machine)
        const currentPaths = project.video_paths || [];
        if (!currentPaths.includes(body.path)) {
          await pgQuery(
            `UPDATE projects SET video_paths = video_paths || $1::jsonb, updated_at = NOW() WHERE id = $2 AND user_id = $3`,
            [JSON.stringify([body.path]), id, userId],
          );
        }
        return reply.status(200).send({ registered: body.path, project_id: id });
      }

      return reply.status(400).send({ error: 'Provide a file, url, or path' });
    },
  );

  // List uploaded videos
  app.get('/api/projects/:id/videos', async (req, reply) => {
    const { id } = req.params as { id: string };
    const userId = req.user!.id;

    const project = await getProject(userId, id);
    if (!project) return reply.status(404).send({ error: 'Project not found' });

    if (!isStorageConfigured()) {
      // Return local paths only
      return reply.send({
        videos: (project.video_paths || []).map((p: string) => ({
          key: p,
          filename: p.split('/').pop(),
          source: p.startsWith('minio://') ? 'minio' : 'local',
          url: null,
        })),
      });
    }

    try {
      const minioVideos = await listProjectVideos(id);
      const localPaths = (project.video_paths || [])
        .filter((p: string) => !p.startsWith('minio://'))
        .map((p: string) => ({ key: p, filename: p.split('/').pop(), source: 'local', url: null, size: 0 }));

      return reply.send({ videos: [...minioVideos.map((v) => ({ ...v, source: 'minio' })), ...localPaths] });
    } catch (err) {
      return reply.send({
        videos: (project.video_paths || []).map((p: string) => ({
          key: p, filename: p.split('/').pop(), source: p.startsWith('minio://') ? 'minio' : 'local', url: null,
        })),
        warning: `MinIO error: ${(err as Error).message}`,
      });
    }
  });

  // Delete uploaded video
  app.delete('/api/projects/:id/videos/:key', async (req, reply) => {
    const { id, key } = req.params as { id: string; key: string };
    const userId = req.user!.id;

    const project = await getProject(userId, id);
    if (!project) return reply.status(404).send({ error: 'Project not found' });

    const decodedKey = decodeURIComponent(key);

    if (isStorageConfigured()) {
      try { await deleteFile(decodedKey); } catch (_) { /* may not exist in MinIO */ }
    }

    // Remove from project video_paths
    const minioPath = `minio://${decodedKey}`;
    const currentPaths = (project.video_paths || []).filter((p: string) => p !== decodedKey && p !== minioPath);
    await pgQuery(
      `UPDATE projects SET video_paths = $1::jsonb, updated_at = NOW() WHERE id = $2 AND user_id = $3`,
      [JSON.stringify(currentPaths), id, userId],
    );

    return reply.send({ deleted: decodedKey });
  });

  // Get a presigned download URL for any MinIO key (used by plugin to download media)
  app.get('/api/upload/download-url', async (req, reply) => {
    const { key } = req.query as { key?: string };
    if (!key) return reply.status(400).send({ error: 'key parameter required' });

    try {
      const { getPresignedUrl } = await import('../services/storage-service.js');
      const url = await getPresignedUrl(key, 3600); // 1 hour
      return reply.send({ url, key, expiresIn: 3600 });
    } catch (err) {
      return reply.status(404).send({ error: `File not found: ${key}` });
    }
  });
}
