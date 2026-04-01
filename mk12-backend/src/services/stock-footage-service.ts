/**
 * Stock footage search service.
 *
 * Queries free stock footage APIs (Pexels, Pixabay) and returns
 * curated suggestions for content marks.
 *
 * When API keys are not configured the service returns empty results
 * with a warning — no mock data is generated.
 *
 * Results are cached for 5 minutes to avoid hitting rate limits.
 */

import { config } from '../config.js';
import type { ContentMark } from '../types/index.js';

// ──────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────

export interface StockResult {
  id: string;
  provider: 'pexels' | 'pixabay';
  thumbnailUrl: string;
  previewUrl: string;
  downloadUrl: string;
  duration?: number;
  width: number;
  height: number;
  description: string;
  tags: string[];
}

export interface StockSuggestion {
  segment_id: string;
  asset_type: string;
  search_query: string;
  results: StockResult[];
  warnings?: string[];
}

// ──────────────────────────────────────────────────────────────────
// Pexels API types (https://www.pexels.com/api/documentation/)
// ──────────────────────────────────────────────────────────────────

interface PexelsVideoFile {
  id: number;
  quality: string;
  file_type: string;
  width: number;
  height: number;
  link: string;
}

interface PexelsVideoPicture {
  id: number;
  picture: string;
  nr: number;
}

interface PexelsVideo {
  id: number;
  width: number;
  height: number;
  url: string;
  image: string;
  duration: number;
  video_files: PexelsVideoFile[];
  video_pictures: PexelsVideoPicture[];
}

interface PexelsSearchResponse {
  page: number;
  per_page: number;
  total_results: number;
  videos: PexelsVideo[];
}

// ──────────────────────────────────────────────────────────────────
// Pixabay API types (https://pixabay.com/api/docs/)
// ──────────────────────────────────────────────────────────────────

interface PixabayVideoSize {
  url: string;
  width: number;
  height: number;
  size: number;
}

interface PixabayVideo {
  id: number;
  pageURL: string;
  tags: string;
  duration: number;
  videos: {
    large: PixabayVideoSize;
    medium: PixabayVideoSize;
    small: PixabayVideoSize;
    tiny: PixabayVideoSize;
  };
  userImageURL: string;
}

interface PixabaySearchResponse {
  total: number;
  totalHits: number;
  hits: PixabayVideo[];
}

// ──────────────────────────────────────────────────────────────────
// Cache
// ──────────────────────────────────────────────────────────────────

interface CacheEntry {
  results: StockResult[];
  timestamp: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ──────────────────────────────────────────────────────────────────
// Service
// ──────────────────────────────────────────────────────────────────

export class StockFootageService {
  private pexelsKey: string;
  private pixabayKey: string;
  private cache = new Map<string, CacheEntry>();

  constructor() {
    this.pexelsKey = config.pexelsApiKey;
    this.pixabayKey = config.pixabayApiKey;

    if (!this.pexelsKey) {
      console.warn('[stock-footage] PEXELS_API_KEY not set — Pexels searches will return empty results');
    }
    if (!this.pixabayKey) {
      console.warn('[stock-footage] PIXABAY_API_KEY not set — Pixabay searches will return empty results');
    }
  }

  // ── Cache helpers ──────────────────────────────────────────────

  private getCached(key: string): StockResult[] | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      this.cache.delete(key);
      return null;
    }
    return entry.results;
  }

  private setCache(key: string, results: StockResult[]): void {
    this.cache.set(key, { results, timestamp: Date.now() });

    // Evict oldest entries if cache grows too large (max 500 entries)
    if (this.cache.size > 500) {
      const oldest = [...this.cache.entries()]
        .sort((a, b) => a[1].timestamp - b[1].timestamp)
        .slice(0, 100);
      for (const [k] of oldest) {
        this.cache.delete(k);
      }
    }
  }

  // ── Pexels ──────────────────────────────────────────────────────

  async searchPexels(query: string, perPage: number = 10): Promise<StockResult[]> {
    if (!this.pexelsKey) {
      return [];
    }

    const cacheKey = `pexels:${query}:${perPage}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      const url = new URL('https://api.pexels.com/videos/search');
      url.searchParams.set('query', query);
      url.searchParams.set('per_page', String(Math.min(perPage, 80)));
      url.searchParams.set('orientation', 'landscape');

      const res = await fetch(url.toString(), {
        headers: { Authorization: this.pexelsKey },
        signal: AbortSignal.timeout(10_000),
      });

      if (res.status === 429) {
        console.warn('[stock-footage] Pexels rate limit hit — returning empty results');
        return [];
      }

      if (!res.ok) {
        console.error(`[stock-footage] Pexels API error: ${res.status} ${res.statusText}`);
        return [];
      }

      const data: PexelsSearchResponse = await res.json();

      const results = data.videos.map((v): StockResult => {
        // Pick the best quality file that is at least 720p
        const bestFile = v.video_files
          .filter((f) => f.quality === 'hd' || f.width >= 1280)
          .sort((a, b) => b.width - a.width)[0] ?? v.video_files[0];

        const thumbnail = v.video_pictures[0]?.picture ?? v.image;

        return {
          id: `pexels-${v.id}`,
          provider: 'pexels',
          thumbnailUrl: thumbnail,
          previewUrl: v.image,
          downloadUrl: bestFile?.link ?? v.url,
          duration: v.duration,
          width: bestFile?.width ?? v.width,
          height: bestFile?.height ?? v.height,
          description: `Pexels video #${v.id}`,
          tags: query.toLowerCase().split(/\s+/),
        };
      });

      this.setCache(cacheKey, results);
      return results;
    } catch (err) {
      const message = (err as Error).message;
      if (message.includes('timeout') || message.includes('abort')) {
        console.error('[stock-footage] Pexels request timed out');
      } else {
        console.error('[stock-footage] Pexels fetch failed:', message);
      }
      return [];
    }
  }

  // ── Pixabay ─────────────────────────────────────────────────────

  async searchPixabay(query: string, perPage: number = 10): Promise<StockResult[]> {
    if (!this.pixabayKey) {
      return [];
    }

    const cacheKey = `pixabay:${query}:${perPage}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      const url = new URL('https://pixabay.com/api/videos/');
      url.searchParams.set('key', this.pixabayKey);
      url.searchParams.set('q', query);
      url.searchParams.set('per_page', String(Math.min(perPage, 200)));

      const res = await fetch(url.toString(), {
        signal: AbortSignal.timeout(10_000),
      });

      if (res.status === 429) {
        console.warn('[stock-footage] Pixabay rate limit hit — returning empty results');
        return [];
      }

      if (!res.ok) {
        console.error(`[stock-footage] Pixabay API error: ${res.status} ${res.statusText}`);
        return [];
      }

      const data: PixabaySearchResponse = await res.json();

      const results = data.hits.map((v): StockResult => {
        const best = v.videos.large ?? v.videos.medium;
        const tags = v.tags.split(',').map((t) => t.trim().toLowerCase());

        return {
          id: `pixabay-${v.id}`,
          provider: 'pixabay',
          thumbnailUrl: v.videos.tiny.url.replace(/\.mp4.*/, '.jpg'),
          previewUrl: v.videos.small.url,
          downloadUrl: best.url,
          duration: v.duration,
          width: best.width,
          height: best.height,
          description: `Pixabay video #${v.id}: ${tags.slice(0, 3).join(', ')}`,
          tags,
        };
      });

      this.setCache(cacheKey, results);
      return results;
    } catch (err) {
      const message = (err as Error).message;
      if (message.includes('timeout') || message.includes('abort')) {
        console.error('[stock-footage] Pixabay request timed out');
      } else {
        console.error('[stock-footage] Pixabay fetch failed:', message);
      }
      return [];
    }
  }

  // ── Combined search ─────────────────────────────────────────────

  async search(query: string, count: number = 15): Promise<{ results: StockResult[]; warnings: string[] }> {
    const warnings: string[] = [];
    const perProvider = Math.ceil(count / 2);

    if (!this.pexelsKey) {
      warnings.push('PEXELS_API_KEY not configured — Pexels results unavailable');
    }
    if (!this.pixabayKey) {
      warnings.push('PIXABAY_API_KEY not configured — Pixabay results unavailable');
    }

    const [pexels, pixabay] = await Promise.allSettled([
      this.searchPexels(query, perProvider),
      this.searchPixabay(query, perProvider),
    ]);

    const allResults: StockResult[] = [];

    if (pexels.status === 'fulfilled') {
      allResults.push(...pexels.value);
    } else {
      warnings.push(`Pexels search failed: ${pexels.reason}`);
    }

    if (pixabay.status === 'fulfilled') {
      allResults.push(...pixabay.value);
    } else {
      warnings.push(`Pixabay search failed: ${pixabay.reason}`);
    }

    // Interleave results from both providers for variety
    const interleaved: StockResult[] = [];
    const pexelsResults = allResults.filter((r) => r.provider === 'pexels');
    const pixabayResults = allResults.filter((r) => r.provider === 'pixabay');
    const maxLen = Math.max(pexelsResults.length, pixabayResults.length);

    for (let i = 0; i < maxLen; i++) {
      if (i < pexelsResults.length) interleaved.push(pexelsResults[i]);
      if (i < pixabayResults.length) interleaved.push(pixabayResults[i]);
    }

    return {
      results: interleaved.slice(0, count),
      warnings,
    };
  }

  // ── Suggestions for content marks ───────────────────────────────

  async getSuggestionsForMark(contentMark: ContentMark & { segment_id: string }): Promise<StockSuggestion> {
    const query = contentMark.search_query ?? contentMark.asset_type;
    const { results, warnings } = await this.search(query, 15);

    return {
      segment_id: contentMark.segment_id,
      asset_type: contentMark.asset_type,
      search_query: query,
      results,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Generate suggestions for all stock-eligible content marks in a project.
   * Returns 10-20 suggestions per segment as described in the MK-12 spec.
   */
  async getSuggestionsForProject(
    marks: Array<ContentMark & { segment_id: string }>,
  ): Promise<StockSuggestion[]> {
    const stockMarks = marks.filter(
      (m) => m.asset_type === 'stock_video' || m.asset_type === 'animation',
    );

    // Process in parallel batches of 5 to avoid rate limits
    const batchSize = 5;
    const suggestions: StockSuggestion[] = [];

    for (let i = 0; i < stockMarks.length; i += batchSize) {
      const batch = stockMarks.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((mark) => this.getSuggestionsForMark(mark)),
      );
      suggestions.push(...batchResults);
    }

    return suggestions;
  }
}

// Singleton instance
let instance: StockFootageService | null = null;

export function getStockFootageService(): StockFootageService {
  if (!instance) {
    instance = new StockFootageService();
  }
  return instance;
}
