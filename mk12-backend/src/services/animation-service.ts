/**
 * Animation Engine client service.
 *
 * Communicates with the MK-12 Animation Engine (Express/Remotion)
 * to generate and render content mark animations.
 *
 * Animation Engine endpoints:
 *   POST /api/generate       — content mark -> template props (via LLM)
 *   POST /api/render         — queue a render job
 *   GET  /api/status/:id     — check render job status
 *   GET  /api/jobs           — list all render jobs
 */

import type { ContentMark } from '../types/index.js';

// ──────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────

export interface GenerateResult {
  compositionId: string;
  props: Record<string, unknown>;
  durationFrames: number;
  durationSeconds: number;
}

export interface RenderJobStatus {
  id: string;
  compositionId: string;
  status: 'queued' | 'rendering' | 'completed' | 'failed';
  progress: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  outputPath?: string;
  downloadUrl?: string;
  error?: string;
}

export interface AnimationJob {
  jobId: string;
  segmentId: string;
  contentMark: ContentMark;
  status: RenderJobStatus['status'];
}

// ──────────────────────────────────────────────────────────────────
// Service
// ──────────────────────────────────────────────────────────────────

export class AnimationService {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? process.env.ANIMATION_ENGINE_URL ?? 'http://localhost:4200';
  }

  /**
   * Generate animation props from a content mark via the animation engine's LLM pipeline.
   * POST /api/generate
   */
  async generateAnimation(contentMark: ContentMark): Promise<{ jobId: string; compositionId: string }> {
    // Step 1: Generate template props from the content mark
    const generateRes = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(contentMark),
    });

    if (!generateRes.ok) {
      const err = await generateRes.json().catch(() => ({ error: 'Generate failed' }));
      throw new Error(`Animation generate failed: ${err.error ?? generateRes.statusText}`);
    }

    const generateData = await generateRes.json() as {
      ok: boolean;
      data: GenerateResult;
    };

    if (!generateData.ok) {
      throw new Error('Animation engine returned non-ok response');
    }

    // Step 2: Queue a render job with the generated props
    const renderRes = await fetch(`${this.baseUrl}/api/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        compositionId: generateData.data.compositionId,
        props: generateData.data.props,
        durationInFrames: generateData.data.durationFrames,
      }),
    });

    if (!renderRes.ok) {
      const err = await renderRes.json().catch(() => ({ error: 'Render queue failed' }));
      throw new Error(`Animation render queue failed: ${err.error ?? renderRes.statusText}`);
    }

    const renderData = await renderRes.json() as {
      ok: boolean;
      data: { jobId: string; compositionId: string };
    };

    return {
      jobId: renderData.data.jobId,
      compositionId: renderData.data.compositionId,
    };
  }

  /**
   * Get the status of a render job.
   * GET /api/status/:id
   */
  async getStatus(jobId: string): Promise<RenderJobStatus> {
    const res = await fetch(`${this.baseUrl}/api/status/${jobId}`);

    if (!res.ok) {
      if (res.status === 404) {
        throw new Error(`Animation job not found: ${jobId}`);
      }
      throw new Error(`Failed to get animation status: ${res.statusText}`);
    }

    const data = await res.json() as { ok: boolean; data: RenderJobStatus };
    return data.data;
  }

  /**
   * Batch generate animations for multiple content marks.
   * Queues all content marks for rendering and returns job IDs.
   */
  async batchGenerate(
    marks: Array<{ segmentId: string; contentMark: ContentMark }>
  ): Promise<{ jobs: AnimationJob[] }> {
    const jobs: AnimationJob[] = [];

    for (const { segmentId, contentMark } of marks) {
      try {
        const result = await this.generateAnimation(contentMark);
        jobs.push({
          jobId: result.jobId,
          segmentId,
          contentMark,
          status: 'queued',
        });
      } catch (err) {
        console.error(`[animation-service] Failed to generate animation for segment ${segmentId}:`, err);
        jobs.push({
          jobId: '',
          segmentId,
          contentMark,
          status: 'failed',
        });
      }
    }

    return { jobs };
  }

  /**
   * Get status of all animation jobs.
   * GET /api/jobs
   */
  async getAllJobStatuses(): Promise<RenderJobStatus[]> {
    const res = await fetch(`${this.baseUrl}/api/jobs`);

    if (!res.ok) {
      throw new Error(`Failed to list animation jobs: ${res.statusText}`);
    }

    const data = await res.json() as {
      ok: boolean;
      data: { jobs: RenderJobStatus[] };
    };

    return data.data.jobs;
  }

  /**
   * Health check for the animation engine.
   */
  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/health`);
      return res.ok;
    } catch {
      return false;
    }
  }
}

// Singleton instance
let instance: AnimationService | null = null;

export function getAnimationService(): AnimationService {
  if (!instance) {
    instance = new AnimationService();
  }
  return instance;
}
