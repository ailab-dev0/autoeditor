/**
 * Cost tracking service.
 *
 * Records API costs per project and provides summaries.
 * Pricing is estimated from published rates (as of 2026-Q1).
 */

import { query as pgQuery } from '../db/postgres.js';

// ─── Pricing tables (USD) ────────────────────────────────────

const PRICING = {
  // OpenRouter per-token pricing (approximate, varies by model)
  openrouter: {
    'anthropic/claude-sonnet-4': { input: 3.0 / 1_000_000, output: 15.0 / 1_000_000 },
    'anthropic/claude-haiku-4-5': { input: 0.80 / 1_000_000, output: 4.0 / 1_000_000 },
    'qwen/qwen3.5-9b': { input: 0.20 / 1_000_000, output: 0.60 / 1_000_000 },
    default: { input: 3.0 / 1_000_000, output: 15.0 / 1_000_000 },
  },
  // AssemblyAI: $0.37/hour for Best model
  assemblyai: { perSecond: 0.37 / 3600 },
  // fal.ai image generation: ~$0.01-0.05 per image
  fal: { perImage: 0.03 },
  // Pexels: free
  pexels: { perSearch: 0 },
  // Remotion render: local CPU cost (estimate $0.01/render)
  remotion: { perRender: 0.01 },
} as const;

// ─── Public API ──────────────────────────────────────────────

export interface CostEvent {
  id: string;
  projectId: string;
  service: string;
  operation: string;
  model?: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface CostSummary {
  totalUsd: number;
  byService: Record<string, { count: number; costUsd: number }>;
  events: CostEvent[];
}

/**
 * Record a cost event for a project.
 */
export async function recordCost(opts: {
  projectId: string;
  service: string;
  operation: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const cost = opts.costUsd ?? estimateCost(opts);

  try {
    await pgQuery(
      `INSERT INTO cost_events (project_id, service, operation, model, input_tokens, output_tokens, cost_usd, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        opts.projectId,
        opts.service,
        opts.operation,
        opts.model ?? null,
        opts.inputTokens ?? 0,
        opts.outputTokens ?? 0,
        cost,
        JSON.stringify(opts.metadata ?? {}),
      ]
    );
  } catch (err) {
    console.warn('[cost] Failed to record cost event:', (err as Error).message);
  }
}

/**
 * Get cost summary for a project.
 */
export async function getProjectCosts(projectId: string): Promise<CostSummary> {
  const result = await pgQuery(
    `SELECT * FROM cost_events WHERE project_id = $1 ORDER BY created_at DESC`,
    [projectId]
  );

  const events: CostEvent[] = result.rows.map(row => ({
    id: row.id,
    projectId: row.project_id,
    service: row.service,
    operation: row.operation,
    model: row.model,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    costUsd: parseFloat(row.cost_usd),
    metadata: row.metadata,
    createdAt: row.created_at,
  }));

  const byService: Record<string, { count: number; costUsd: number }> = {};
  let totalUsd = 0;

  for (const e of events) {
    if (!byService[e.service]) byService[e.service] = { count: 0, costUsd: 0 };
    byService[e.service].count++;
    byService[e.service].costUsd += e.costUsd;
    totalUsd += e.costUsd;
  }

  return { totalUsd, byService, events };
}

/**
 * Get cost totals for all projects (for repository view).
 */
export async function getAllProjectCosts(): Promise<Map<string, number>> {
  const result = await pgQuery(
    `SELECT project_id, SUM(cost_usd)::numeric AS total
     FROM cost_events
     GROUP BY project_id`,
    []
  );

  const map = new Map<string, number>();
  for (const row of result.rows) {
    map.set(row.project_id, parseFloat(row.total));
  }
  return map;
}

// ─── Helpers ─────────────────────────────────────────────────

function estimateCost(opts: {
  service: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  metadata?: Record<string, unknown>;
}): number {
  switch (opts.service) {
    case 'openrouter': {
      const modelKey = opts.model ?? 'default';
      const rates = (PRICING.openrouter as Record<string, { input: number; output: number }>)[modelKey]
        ?? PRICING.openrouter.default;
      return (opts.inputTokens ?? 0) * rates.input + (opts.outputTokens ?? 0) * rates.output;
    }
    case 'assemblyai': {
      const durationSecs = (opts.metadata as any)?.durationSeconds ?? 0;
      return durationSecs * PRICING.assemblyai.perSecond;
    }
    case 'fal':
      return PRICING.fal.perImage;
    case 'pexels':
      return PRICING.pexels.perSearch;
    case 'remotion':
      return PRICING.remotion.perRender;
    default:
      return 0;
  }
}

/**
 * Helper to extract token counts from an OpenRouter response.
 */
export function extractOpenRouterUsage(data: any): { inputTokens: number; outputTokens: number; model: string } {
  const usage = data?.usage ?? {};
  return {
    inputTokens: usage.prompt_tokens ?? 0,
    outputTokens: usage.completion_tokens ?? 0,
    model: data?.model ?? 'unknown',
  };
}
