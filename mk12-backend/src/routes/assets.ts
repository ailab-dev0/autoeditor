/**
 * Asset analysis routes.
 *
 * POST /api/projects/:id/analyze-assets — launch async asset analysis
 * GET  /api/projects/:id/asset-manifest — retrieve stored manifest
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireRole } from '../middleware/rbac.js';
import { getProject } from '../services/project-service.js';
import { query as pgQuery } from '../db/postgres.js';
import { analyzeAssets } from '../services/asset-analysis-service.js';
import { generateEditScript } from '../services/script-generator-service.js';
import { broadcastPipelineStatus } from '../services/sync-service.js';
import type { MediaAsset, AssetManifest, PipelineStatus } from '../types/index.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Strip OpenRouter API keys from error messages before broadcasting. */
function sanitizeErrorMessage(message: string): string {
  return message.replace(/sk-or-[a-zA-Z0-9-]+/g, '[REDACTED]');
}

// ── Zod validation ────────────────────────────────────────────────

const MediaAssetSchema = z.object({
  name: z.string().min(1),
  path: z.string().min(1).refine(
    (p) => !p.includes('..') && !p.startsWith('/') && !/^[a-zA-Z]:/.test(p),
    { message: 'Asset paths must be relative without traversal sequences' },
  ),
  type: z.enum(['video', 'audio', 'image']),
  selected: z.boolean(),
  duration: z.number().optional(),
  dimensions: z.object({ width: z.number(), height: z.number() }).optional(),
  fps: z.number().optional(),
  codec: z.string().optional(),
  sizeBytes: z.number().optional(),
  keyframes: z.array(z.object({
    timestamp: z.number(),
    storagePath: z.string(),
    tags: z.array(z.string()).optional(),
    description: z.string().optional(),
  })).optional(),
  silenceRegions: z.array(z.object({
    start: z.number(),
    end: z.number(),
  })).optional(),
  waveformSummary: z.array(z.number()).optional(),
  transcriptPath: z.string().optional(),
});

const AnalyzeAssetsBodySchema = z.object({
  assets: z.array(MediaAssetSchema).min(1),
  brief: z.string().min(1).max(2000),
});

// ── Track running analyses to prevent duplicates ──────────────────

const runningAnalyses = new Set<string>();

// ── Routes ────────────────────────────────────────────────────────

export async function registerAssetRoutes(app: FastifyInstance): Promise<void> {

  // Launch async asset analysis
  app.post(
    '/api/projects/:id/analyze-assets',
    { preHandler: [requireRole('editor', 'producer', 'creative_director')] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      if (!UUID_RE.test(id)) {
        return reply.status(400).send({ error: 'Invalid project ID format' });
      }

      // SEC-4: Claim the analysis slot immediately to prevent race conditions.
      // If validation fails later, we remove it in the early-return paths below.
      if (runningAnalyses.has(id)) {
        return reply.status(409).send({ error: 'Asset analysis already running for this project' });
      }
      runningAnalyses.add(id);

      const project = await getProject(req.user!.id, id);

      if (!project) {
        runningAnalyses.delete(id);
        return reply.status(404).send({ error: 'Project not found' });
      }

      // Validate body
      const parsed = AnalyzeAssetsBodySchema.safeParse(req.body);
      if (!parsed.success) {
        runningAnalyses.delete(id);
        return reply.status(400).send({
          error: 'Invalid request body',
          details: parsed.error.issues,
        });
      }

      const { assets, brief } = parsed.data;

      // Return 202 immediately, run analysis in background
      reply.status(202).send({
        status: 'accepted',
        message: `Analyzing ${assets.length} asset(s)`,
        projectId: id,
      });

      // Background analysis
      (async () => {
        try {
          console.log(`[assets] Starting analysis for project ${id}: ${assets.length} asset(s)`);

          const analyzedAssets = await analyzeAssets(
            id,
            assets as MediaAsset[],
            (progress) => {
              // Broadcast progress via WebSocket using pipeline status pattern
              const status: PipelineStatus = {
                session_id: `asset-analysis-${id}-${Date.now()}`,
                project_id: id,
                status: 'running',
                current_stage: 'transcription', // Re-use existing stage for compat
                overall_progress: progress,
                stages: [{
                  name: 'transcription',
                  status: progress >= 100 ? 'completed' : 'running',
                  progress,
                  message: `Analyzing assets: ${progress}%`,
                }],
                started_at: new Date().toISOString(),
              };
              broadcastPipelineStatus(id, status);
            },
          );

          // Build manifest
          const manifest: AssetManifest = {
            assets: analyzedAssets,
            brief,
            scannedAt: new Date().toISOString(),
          };

          // Store manifest as JSONB on project settings
          await pgQuery(
            `UPDATE projects
             SET settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object('asset_manifest', $1::jsonb),
                 updated_at = NOW()
             WHERE id = $2`,
            [JSON.stringify(manifest), id],
          );

          console.log(`[assets] Analysis complete for project ${id}: ${analyzedAssets.length} asset(s) processed`);
        } catch (err) {
          console.error(`[assets] Analysis failed for project ${id}:`, (err as Error).message);
        } finally {
          runningAnalyses.delete(id);
        }
      })();
    },
  );

  // Get stored asset manifest
  // No role guard — read access is intentionally open to all authenticated users
  // (same pattern as GET /api/projects and GET /api/projects/:id)
  app.get(
    '/api/projects/:id/asset-manifest',
    async (req, reply) => {
      const { id } = req.params as { id: string };
      if (!UUID_RE.test(id)) {
        return reply.status(400).send({ error: 'Invalid project ID format' });
      }
      const project = await getProject(req.user!.id, id);

      if (!project) {
        return reply.status(404).send({ error: 'Project not found' });
      }

      // Read manifest from settings JSONB
      const result = await pgQuery(
        `SELECT settings->'asset_manifest' AS manifest FROM projects WHERE id = $1`,
        [id],
      );

      const manifest = result.rows[0]?.manifest;

      if (!manifest) {
        return reply.send({ asset_manifest: null, message: 'No asset manifest found' });
      }

      return reply.send({ asset_manifest: manifest });
    },
  );

  // ── Generate AI edit script ──────────────────────────────────────

  const runningScriptGens = new Set<string>();

  app.post(
    '/api/projects/:id/generate-script',
    { preHandler: [requireRole('editor', 'producer', 'creative_director')] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      if (!UUID_RE.test(id)) {
        return reply.status(400).send({ error: 'Invalid project ID format' });
      }

      if (runningScriptGens.has(id)) {
        return reply.status(409).send({ error: 'Script generation already running for this project' });
      }
      runningScriptGens.add(id);

      const project = await getProject(req.user!.id, id);
      if (!project) {
        runningScriptGens.delete(id);
        return reply.status(404).send({ error: 'Project not found' });
      }

      // Check that asset_manifest exists
      const manifestResult = await pgQuery(
        `SELECT settings->'asset_manifest' AS manifest FROM projects WHERE id = $1`,
        [id],
      );
      const manifest: AssetManifest | null = manifestResult.rows[0]?.manifest ?? null;

      if (!manifest) {
        runningScriptGens.delete(id);
        return reply.status(400).send({ error: 'No asset manifest found. Run asset analysis first.' });
      }

      // Return 202 immediately, run generation in background
      reply.status(202).send({
        status: 'accepted',
        message: 'Generating edit script',
        projectId: id,
      });

      // Background generation
      (async () => {
        try {
          console.log(`[assets] Starting script generation for project ${id}`);

          // Load transcript if available (first selected video's transcript)
          let transcript = '';
          const transcriptResult = await pgQuery(
            `SELECT settings->'transcript' AS transcript FROM projects WHERE id = $1`,
            [id],
          );
          const storedTranscript = transcriptResult.rows[0]?.transcript;
          if (typeof storedTranscript === 'string') {
            transcript = storedTranscript;
          } else if (storedTranscript?.text) {
            transcript = storedTranscript.text;
          }

          const script = await generateEditScript(
            id,
            manifest,
            transcript,
            (progress) => {
              const status: PipelineStatus = {
                session_id: `script-gen-${id}-${Date.now()}`,
                project_id: id,
                status: 'running',
                current_stage: 'director_decisions',
                overall_progress: progress,
                stages: [{
                  name: 'director_decisions',
                  status: progress >= 100 ? 'completed' : 'running',
                  progress,
                  message: `Generating edit script: ${progress}%`,
                }],
                started_at: new Date().toISOString(),
              };
              broadcastPipelineStatus(id, status);
            },
          );

          // Store edit script in project settings JSONB
          await pgQuery(
            `UPDATE projects
             SET settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object('edit_script', $1::jsonb),
                 updated_at = NOW()
             WHERE id = $2`,
            [JSON.stringify(script), id],
          );

          console.log(`[assets] Script generation complete for project ${id}`);

          // Broadcast completion
          broadcastPipelineStatus(id, {
            session_id: `script-gen-${id}-${Date.now()}`,
            project_id: id,
            status: 'completed',
            current_stage: 'director_decisions',
            overall_progress: 100,
            stages: [{
              name: 'director_decisions',
              status: 'completed',
              progress: 100,
              message: 'Edit script generated',
            }],
            started_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
          });
        } catch (err) {
          const rawMessage = (err as Error).message;
          console.error(`[assets] Script generation failed for project ${id}:`, rawMessage);

          // Broadcast error (sanitize to prevent API key leakage)
          const safeMessage = sanitizeErrorMessage(rawMessage);
          broadcastPipelineStatus(id, {
            session_id: `script-gen-${id}-${Date.now()}`,
            project_id: id,
            status: 'error',
            current_stage: 'director_decisions',
            overall_progress: 0,
            stages: [{
              name: 'director_decisions',
              status: 'error',
              progress: 0,
              error: safeMessage,
            }],
            started_at: new Date().toISOString(),
            error: safeMessage,
          });
        } finally {
          runningScriptGens.delete(id);
        }
      })();
    },
  );

  // ── Get stored edit script ───────────────────────────────────────

  app.get(
    '/api/projects/:id/edit-script',
    async (req, reply) => {
      const { id } = req.params as { id: string };
      if (!UUID_RE.test(id)) {
        return reply.status(400).send({ error: 'Invalid project ID format' });
      }

      const project = await getProject(req.user!.id, id);
      if (!project) {
        return reply.status(404).send({ error: 'Project not found' });
      }

      const result = await pgQuery(
        `SELECT settings->'edit_script' AS edit_script FROM projects WHERE id = $1`,
        [id],
      );

      const editScript = result.rows[0]?.edit_script;

      if (!editScript) {
        return reply.send({ edit_script: null, message: 'No edit script found' });
      }

      return reply.send({ edit_script: editScript });
    },
  );
}
