/**
 * Production Blueprint routes (Stage 4B — review & decisions).
 *
 * GET  /api/projects/:id/blueprint           — get full blueprint
 * GET  /api/projects/:id/blueprint/segment/:segId — get single segment blueprint
 * PUT  /api/projects/:id/blueprint/segment/:segId — update user choice for segment
 * PUT  /api/projects/:id/blueprint/bulk       — bulk accept/reject segments
 * POST /api/projects/:id/blueprint/regenerate/:segId — regenerate material for segment
 * GET  /api/projects/:id/blueprint/stats      — review progress stats
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireRole } from '../middleware/rbac.js';
import { getProject } from '../services/project-service.js';
import { isStorageConfigured, getPresignedUrl } from '../services/storage-service.js';
import { syncManager } from '../ws/sync.js';

// In-memory review state (per project)
// Persisted to MinIO on each update
const reviewState = new Map<string, Map<string, { choice: string; customNotes?: string; updatedAt: string }>>();

export async function registerBlueprintRoutes(app: FastifyInstance): Promise<void> {

  // ── Get full blueprint ──────────────────────────────────────
  app.get('/api/projects/:id/blueprint', async (req, reply) => {
    const { id } = req.params as { id: string };
    const project = await getProject(req.user!.id, id);
    if (!project) return reply.status(404).send({ error: 'Project not found' });

    const blueprint = await loadBlueprint(id);
    if (!blueprint) return reply.status(404).send({ error: 'No blueprint — run pipeline first' });

    // Merge review state
    const state = reviewState.get(id);
    if (state) {
      for (const seg of blueprint.segments) {
        const review = state.get(seg.segmentId);
        if (review) {
          seg.userChoice = review.choice as any;
        }
      }
    }

    // Add review stats
    const stats = getReviewStats(id, blueprint);

    return reply.send({ blueprint, reviewStats: stats });
  });

  // ── Get single segment ──────────────────────────────────────
  app.get('/api/projects/:id/blueprint/segment/:segId', async (req, reply) => {
    const { id, segId } = req.params as { id: string; segId: string };
    const project = await getProject(req.user!.id, id);
    if (!project) return reply.status(404).send({ error: 'Project not found' });

    const blueprint = await loadBlueprint(id);
    if (!blueprint) return reply.status(404).send({ error: 'No blueprint' });

    const segment = blueprint.segments.find((s: any) => s.segmentId === segId);
    if (!segment) return reply.status(404).send({ error: 'Segment not found in blueprint' });

    // Get alternatives — other materials of the same type
    const alternatives = blueprint.materials.filter((m: any) =>
      m.type === segment.aiPath.material?.type && m.id !== segment.aiPath.material?.id
    );

    const state = reviewState.get(id);
    const review = state?.get(segId);

    return reply.send({
      segment: { ...segment, userChoice: review?.choice || null },
      alternatives,
      reviewUrl: `/project/${id}/review#${segId}`,
    });
  });

  // ── Update user choice for segment ──────────────────────────
  const UpdateChoiceSchema = z.object({
    choice: z.enum(['ai', 'original', 'custom']),
    customNotes: z.string().optional(),
    customMaterialUrl: z.string().optional(),
  });

  app.put('/api/projects/:id/blueprint/segment/:segId', {
    preHandler: [requireRole('editor', 'producer', 'creative_director')]
  }, async (req, reply) => {
    const { id, segId } = req.params as { id: string; segId: string };
    const project = await getProject(req.user!.id, id);
    if (!project) return reply.status(404).send({ error: 'Project not found' });

    const parsed = UpdateChoiceSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid input', details: parsed.error.issues });

    const { choice, customNotes } = parsed.data;

    // Store choice
    if (!reviewState.has(id)) reviewState.set(id, new Map());
    reviewState.get(id)!.set(segId, {
      choice,
      customNotes,
      updatedAt: new Date().toISOString(),
    });

    // Persist to MinIO
    await persistReviewState(id);

    // Broadcast via WebSocket (so plugin gets the update)
    try {
      syncManager.broadcastSegmentUpdate(id, {
        segmentId: segId,
        approved: choice === 'ai',
        override: choice === 'custom' && customNotes ? { decision: 'review' as const, reason: customNotes } : null,
        timestamp: Date.now(),
        source: 'dashboard',
      }, 'dashboard');
    } catch (err) {
      console.warn('[blueprint] WS broadcast failed:', (err as Error).message);
    }

    const blueprint = await loadBlueprint(id);
    const stats = blueprint ? getReviewStats(id, blueprint) : null;

    return reply.send({ segmentId: segId, choice, stats });
  });

  // ── Bulk update ─────────────────────────────────────────────
  const BulkSchema = z.object({
    segmentIds: z.array(z.string()),
    choice: z.enum(['ai', 'original']),
  });

  app.put('/api/projects/:id/blueprint/bulk', {
    preHandler: [requireRole('editor', 'producer', 'creative_director')]
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const project = await getProject(req.user!.id, id);
    if (!project) return reply.status(404).send({ error: 'Project not found' });

    const parsed = BulkSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid input' });

    const { segmentIds, choice } = parsed.data;

    if (!reviewState.has(id)) reviewState.set(id, new Map());
    const state = reviewState.get(id)!;

    for (const segId of segmentIds) {
      state.set(segId, { choice, updatedAt: new Date().toISOString() });
    }

    await persistReviewState(id);

    const blueprint = await loadBlueprint(id);
    const stats = blueprint ? getReviewStats(id, blueprint) : null;

    return reply.send({ updated: segmentIds.length, stats });
  });

  // ── Regenerate material for segment ─────────────────────────
  app.post('/api/projects/:id/blueprint/regenerate/:segId', {
    preHandler: [requireRole('editor', 'producer', 'creative_director')]
  }, async (req, reply) => {
    const { id, segId } = req.params as { id: string; segId: string };
    const body = req.body as { query?: string; type?: string } | undefined;

    const project = await getProject(req.user!.id, id);
    if (!project) return reply.status(404).send({ error: 'Project not found' });

    // TODO: fetch new stock/AI material based on query, update blueprint
    // For now, return a placeholder
    return reply.send({
      segmentId: segId,
      message: 'Regeneration queued',
      query: body?.query || 'default',
    });
  });

  // ── Review progress stats ───────────────────────────────────
  app.get('/api/projects/:id/blueprint/stats', async (req, reply) => {
    const { id } = req.params as { id: string };
    const project = await getProject(req.user!.id, id);
    if (!project) return reply.status(404).send({ error: 'Project not found' });

    const blueprint = await loadBlueprint(id);
    if (!blueprint) return reply.status(404).send({ error: 'No blueprint' });

    return reply.send(getReviewStats(id, blueprint));
  });
}

// ─── Helpers ────────────────────────────────────────────────

async function loadBlueprint(projectId: string): Promise<any | null> {
  if (!isStorageConfigured()) return null;

  try {
    const { getFileStream } = await import('../services/storage-service.js');

    // Load meta JSON
    const metaStream = await getFileStream(`projects/${projectId}/blueprint-meta.json`);
    const metaChunks: Buffer[] = [];
    for await (const chunk of metaStream) metaChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    const meta = JSON.parse(Buffer.concat(metaChunks).toString('utf8'));

    // Load segments JSONL
    const segStream = await getFileStream(`projects/${projectId}/blueprint-segments.jsonl`);
    const segChunks: Buffer[] = [];
    for await (const chunk of segStream) segChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    const lines = Buffer.concat(segChunks).toString('utf8').trim().split('\n').filter(Boolean);
    const segments = [];
    for (let i = 0; i < lines.length; i++) {
      try { segments.push(JSON.parse(lines[i])); }
      catch { console.warn(`[blueprint] Corrupt segment at line ${i + 1}, skipping`); }
    }

    return { ...meta, segments };
  } catch (err) {
    console.warn(`[blueprint] Failed to load for project ${projectId}:`, (err as Error).message);
    return null;
  }
}

async function persistReviewState(projectId: string): Promise<void> {
  const state = reviewState.get(projectId);
  if (!state || !isStorageConfigured()) return;

  try {
    const { uploadFile } = await import('../services/storage-service.js');
    const data = Object.fromEntries(state);
    await uploadFile(
      `projects/${projectId}/review-state.json`,
      Buffer.from(JSON.stringify(data, null, 2)),
      'application/json',
    );
  } catch (err) {
    console.warn('[blueprint:review] Failed to persist state:', (err as Error).message);
  }
}

function getReviewStats(projectId: string, blueprint: any) {
  const total = blueprint.segments.length;
  const state = reviewState.get(projectId);
  let aiAccepted = 0, originalChosen = 0, custom = 0, pending = 0;

  for (const seg of blueprint.segments) {
    const review = state?.get(seg.segmentId);
    if (!review) { pending++; continue; }
    if (review.choice === 'ai') aiAccepted++;
    else if (review.choice === 'original') originalChosen++;
    else if (review.choice === 'custom') custom++;
  }

  return {
    total,
    reviewed: total - pending,
    pending,
    aiAccepted,
    originalChosen,
    custom,
    percentComplete: Math.round(((total - pending) / total) * 100),
  };
}
