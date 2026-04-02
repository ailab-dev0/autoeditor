/**
 * Export routes.
 *
 * GET /api/projects/:id/export?format=csv|edl|fcpxml|premiere_xml|json
 */

import type { FastifyInstance } from 'fastify';
import { getProject } from '../services/project-service.js';
import { generateExport } from '../services/export-service.js';
import type { ExportFormat } from '../types/index.js';

const VALID_FORMATS: ExportFormat[] = ['csv', 'edl', 'fcpxml', 'premiere_xml', 'json'];

export async function registerExportRoutes(app: FastifyInstance): Promise<void> {
  // GET with query param
  app.get('/api/projects/:id/export', async (req, reply) => {
    const { id } = req.params as { id: string };
    const query = req.query as Record<string, string | undefined>;
    const format = (query.format ?? 'json') as ExportFormat;
    const fps = parseFloat(query.fps ?? '24');
    return handleExport(req, reply, id, format, fps);
  });

  // POST with body (dashboard uses this)
  app.post('/api/projects/:id/export', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { format?: string; fps?: number } | undefined;
    const format = (body?.format ?? 'json') as ExportFormat;
    const fps = body?.fps ?? 24;
    return handleExport(req, reply, id, format, fps);
  });

  async function handleExport(req: any, reply: any, id: string, format: ExportFormat, fps: number) {
    if (!VALID_FORMATS.includes(format)) {
      return reply.status(400).send({
        error: `Invalid format: ${format}. Supported: ${VALID_FORMATS.join(', ')}`,
      });
    }

    const project = await getProject(req.user!.id, id);
    if (!project) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    // Build edit package from blueprint if not stored on project
    let editPackage = project.edit_package;
    if (!editPackage) {
      try {
        const { isStorageConfigured, getFileStream } = await import('../services/storage-service.js');
        const { buildEditPackage } = await import('../utils/edit-package.js');
        if (!isStorageConfigured()) {
          return reply.status(409).send({ error: 'No edit package and storage not configured.' });
        }

        // Load content-flow meta for chapters + knowledge graph
        const metaStream = await getFileStream(`projects/${id}/content-flow-meta.json`);
        const metaChunks: Buffer[] = [];
        for await (const chunk of metaStream) metaChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        const meta = JSON.parse(Buffer.concat(metaChunks).toString('utf8'));

        // Load blueprint segments for actual decisions
        let blueprintSegments: any[] = [];
        try {
          const bpStream = await getFileStream(`projects/${id}/blueprint-segments.jsonl`);
          const bpChunks: Buffer[] = [];
          for await (const chunk of bpStream) bpChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          blueprintSegments = Buffer.concat(bpChunks).toString('utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
        } catch { /* no blueprint yet */ }

        const chapters = (meta.chapters ?? []).map((ch: any, i: number) => ({
          name: ch.name ?? `Chapter ${i + 1}`,
          order: ch.order ?? i,
          target_duration: (ch.endTime ?? 0) - (ch.startTime ?? 0),
        }));

        const nodes = (meta.topics ?? []).slice(0, 30).map((t: any, i: number) => ({
          id: `topic-${i}`, label: t.name, type: 'concept' as const,
          importance: (t.importance ?? 0) / 5, community: i % 5,
        }));

        // Build segments with actual decisions for export
        const segments = blueprintSegments.map((seg: any) => ({
          id: seg.segmentId,
          start: seg.start ?? 0,
          end: seg.end ?? 0,
          suggestion: seg.suggestion ?? 'keep',
          confidence: seg.confidence ?? 0,
          explanation: seg.explanation ?? '',
          chapter: seg.topic,
          transcript: seg.text,
          content_mark: seg.aiPath?.action !== 'keep_original' ? {
            asset_type: seg.aiPath?.material?.type ?? seg.aiPath?.action,
            search_query: seg.topic || seg.aiPath?.reason || '',
          } : undefined,
        }));

        // Group segments by video path
        const videoPathMap = new Map<string, any[]>();
        for (const seg of blueprintSegments) {
          const path = seg.mediaPath || 'unknown';
          if (!videoPathMap.has(path)) videoPathMap.set(path, []);
          videoPathMap.get(path)!.push(seg);
        }

        const videos = Array.from(videoPathMap.entries()).map(([path, segs]) => ({
          video_path: path,
          segments: segs.map((seg: any) => ({
            id: seg.segmentId,
            start: seg.start ?? 0,
            end: seg.end ?? 0,
            suggestion: seg.suggestion ?? 'keep',
            confidence: seg.confidence ?? 0,
            explanation: seg.explanation ?? seg.aiPath?.reason ?? '',
            chapter: seg.topic,
            transcript: seg.text,
          })),
        }));

        editPackage = buildEditPackage({
          projectName: project.name,
          sessionId: 'export',
          videos,
          chapters,
          nodes,
          edges: [],
        });
      } catch (err) {
        return reply.status(409).send({
          error: 'No edit package available. Run the analysis pipeline first.',
        });
      }
    }

    try {
      const result = generateExport(editPackage, format, fps);

      return reply
        .header('Content-Type', result.contentType)
        .header('Content-Disposition', `attachment; filename="${result.filename}"`)
        .send(result.data);
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  }
}
