/**
 * Transcript routes.
 *
 * GET /api/projects/:id/transcript          — get transcript
 * GET /api/projects/:id/transcript/export   — export transcript (text, srt, vtt, json)
 */

import type { FastifyInstance } from 'fastify';
import {
  getTranscripts,
  getLatestTranscript,
  exportAsText,
  exportAsSRT,
  exportAsVTT,
  exportAsJSON,
} from '../services/transcript-service.js';

export async function registerTranscriptRoutes(app: FastifyInstance): Promise<void> {
  // Get all transcripts for a project
  app.get('/api/projects/:id/transcript', async (req, reply) => {
    const { id } = req.params as { id: string };
    const query = req.query as Record<string, string | undefined>;

    if (query.video_path) {
      const transcript = await getLatestTranscript(id, query.video_path);
      if (!transcript) {
        return reply.status(404).send({ error: 'Transcript not found for this video' });
      }
      return reply.send({ transcript });
    }

    const transcripts = await getTranscripts(id);
    return reply.send({ transcripts });
  });

  // Export transcript in various formats
  app.get('/api/projects/:id/transcript/export', async (req, reply) => {
    const { id } = req.params as { id: string };
    const query = req.query as Record<string, string | undefined>;
    const format = query.format ?? 'text';

    const transcript = await getLatestTranscript(id, query.video_path);
    if (!transcript) {
      return reply.status(404).send({ error: 'Transcript not found' });
    }

    const projectName = id.slice(0, 8);

    switch (format) {
      case 'text': {
        const text = exportAsText(transcript);
        return reply
          .header('Content-Type', 'text/plain')
          .header('Content-Disposition', `attachment; filename="${projectName}_transcript.txt"`)
          .send(text);
      }

      case 'srt': {
        const srt = exportAsSRT(transcript);
        return reply
          .header('Content-Type', 'text/plain')
          .header('Content-Disposition', `attachment; filename="${projectName}_transcript.srt"`)
          .send(srt);
      }

      case 'vtt': {
        const vtt = exportAsVTT(transcript);
        return reply
          .header('Content-Type', 'text/vtt')
          .header('Content-Disposition', `attachment; filename="${projectName}_transcript.vtt"`)
          .send(vtt);
      }

      case 'json': {
        const json = exportAsJSON(transcript);
        return reply
          .header('Content-Type', 'application/json')
          .header('Content-Disposition', `attachment; filename="${projectName}_transcript.json"`)
          .send(json);
      }

      default:
        return reply.status(400).send({ error: `Unsupported format: ${format}. Use text, srt, vtt, or json.` });
    }
  });
}
