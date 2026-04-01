/**
 * Stock footage routes.
 *
 * GET  /api/stock/search?q=query&count=10              — search stock footage
 * GET  /api/projects/:id/stock-suggestions              — get suggestions for all content marks
 * POST /api/projects/:id/stock-suggestions/generate     — trigger AI-enhanced search queries
 */

import type { FastifyInstance } from 'fastify';
import { getStockFootageService } from '../services/stock-footage-service.js';
import { listSegments } from '../services/segment-service.js';
import type { ContentMark } from '../types/index.js';

// In-memory cache for generated suggestions: projectId -> suggestions
const suggestionsCache = new Map<string, {
  suggestions: unknown[];
  generated_at: string;
}>();

// In-memory store for selected stock per segment
const selectedStock = new Map<string, Map<string, string[]>>(); // projectId -> segmentId -> stockIds

export async function registerStockRoutes(app: FastifyInstance): Promise<void> {
  const stockService = getStockFootageService();

  // ── Search stock footage ─────────────────────────────────────

  app.get('/api/stock/search', async (req, reply) => {
    const query = req.query as Record<string, string | undefined>;
    const q = query.q?.trim();

    if (!q) {
      return reply.status(400).send({
        error: 'Missing required query parameter: q',
      });
    }

    const count = Math.min(Math.max(parseInt(query.count ?? query.limit ?? '10', 10) || 10, 1), 50);
    const { results, warnings } = await stockService.search(q, count);

    return reply.send({
      query: q,
      count: results.length,
      results,
      ...(warnings.length > 0 ? { warnings } : {}),
    });
  });

  // ── Get suggestions for a project ───────────────────────────

  app.get('/api/projects/:id/stock-suggestions', async (req, reply) => {
    const { id } = req.params as { id: string };

    // Return cached suggestions if available
    const cached = suggestionsCache.get(id);
    if (cached) {
      return reply.send({
        project_id: id,
        generated_at: cached.generated_at,
        suggestions: cached.suggestions,
      });
    }

    // Generate on-the-fly from current content marks
    const segments = await listSegments(id);
    const marksWithSegments = segments
      .filter((seg) => seg.content_mark != null)
      .map((seg) => ({
        ...seg.content_mark!,
        segment_id: seg.id,
      }));

    if (marksWithSegments.length === 0) {
      return reply.send({
        project_id: id,
        suggestions: [],
        message: 'No content marks found. Run the pipeline first.',
      });
    }

    const suggestions = await stockService.getSuggestionsForProject(marksWithSegments);
    const now = new Date().toISOString();

    suggestionsCache.set(id, { suggestions, generated_at: now });

    return reply.send({
      project_id: id,
      generated_at: now,
      suggestions,
    });
  });

  // ── Generate AI-enhanced search queries ─────────────────────

  app.post('/api/projects/:id/stock-suggestions/generate', async (req, reply) => {
    const { id } = req.params as { id: string };

    const segments = await listSegments(id);
    const marksWithSegments = segments
      .filter((seg) => seg.content_mark != null)
      .map((seg) => ({
        ...seg.content_mark!,
        segment_id: seg.id,
      }));

    if (marksWithSegments.length === 0) {
      return reply.status(400).send({
        error: 'No content marks found for this project.',
      });
    }

    // Enhance search queries using context from the segment transcript
    const enhancedMarks = marksWithSegments.map((mark) => {
      const segment = segments.find((s) => s.id === mark.segment_id);
      const transcript = segment?.transcript ?? '';

      // Build a richer search query from transcript context
      const baseQuery = mark.search_query ?? mark.asset_type;
      const contextWords = transcript
        .split(/\s+/)
        .filter((w) => w.length > 4)
        .slice(0, 5)
        .join(' ');

      return {
        ...mark,
        search_query: contextWords ? `${baseQuery} ${contextWords}` : baseQuery,
      };
    });

    const suggestions = await stockService.getSuggestionsForProject(enhancedMarks);
    const now = new Date().toISOString();

    suggestionsCache.set(id, { suggestions, generated_at: now });

    return reply.send({
      project_id: id,
      generated_at: now,
      suggestion_count: suggestions.length,
      total_results: suggestions.reduce((sum, s) => sum + s.results.length, 0),
      suggestions,
    });
  });

  // ── Select stock for a segment ──────────────────────────────

  app.post('/api/projects/:id/stock-suggestions/select', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { segment_id?: string; stock_ids?: string[] };

    if (!body.segment_id || !body.stock_ids?.length) {
      return reply.status(400).send({
        error: 'Missing required fields: segment_id, stock_ids',
      });
    }

    if (!selectedStock.has(id)) {
      selectedStock.set(id, new Map());
    }
    selectedStock.get(id)!.set(body.segment_id, body.stock_ids);

    return reply.send({
      project_id: id,
      segment_id: body.segment_id,
      selected_stock_ids: body.stock_ids,
    });
  });

  // ── Get selected stock for a project ────────────────────────

  app.get('/api/projects/:id/stock-suggestions/selected', async (req, reply) => {
    const { id } = req.params as { id: string };
    const selections = selectedStock.get(id);

    if (!selections) {
      return reply.send({ project_id: id, selections: {} });
    }

    const result: Record<string, string[]> = {};
    for (const [segId, stockIds] of selections) {
      result[segId] = stockIds;
    }

    return reply.send({ project_id: id, selections: result });
  });
}
