// ─── Render Queue ───────────────────────────────────────────────────────────
// Queue system for batch rendering of Remotion compositions.

import { v4 as uuid } from "uuid";
import path from "path";
import fs from "fs";

// ─── Types ──────────────────────────────────────────────────────────────────

export type RenderJobStatus =
  | "queued"
  | "rendering"
  | "completed"
  | "failed";

export interface RenderJob {
  id: string;
  compositionId: string;
  inputProps: Record<string, unknown>;
  durationInFrames: number;
  status: RenderJobStatus;
  progress: number; // 0-100
  outputPath?: string;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface RenderQueueOptions {
  /** Directory to output rendered files */
  outputDir: string;
  /** Maximum concurrent renders */
  concurrency: number;
  /** Default FPS */
  fps: number;
  /** Default resolution */
  width: number;
  height: number;
}

const DEFAULT_OPTIONS: RenderQueueOptions = {
  outputDir: path.join(process.cwd(), "out"),
  concurrency: 1,
  fps: 30,
  width: 1920,
  height: 1080,
};

// ─── Queue ──────────────────────────────────────────────────────────────────

export class RenderQueue {
  private jobs: Map<string, RenderJob> = new Map();
  private queue: string[] = [];
  private activeCount = 0;
  private options: RenderQueueOptions;
  private renderFn: ((job: RenderJob, opts: RenderQueueOptions) => Promise<string>) | null = null;

  constructor(options: Partial<RenderQueueOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };

    // Ensure output directory exists
    if (!fs.existsSync(this.options.outputDir)) {
      fs.mkdirSync(this.options.outputDir, { recursive: true });
    }
  }

  /**
   * Set the render function. This is injected so the queue module
   * doesn't directly depend on @remotion/renderer (which requires
   * a bundled Remotion project).
   */
  setRenderFunction(
    fn: (job: RenderJob, opts: RenderQueueOptions) => Promise<string>,
  ): void {
    this.renderFn = fn;
  }

  /**
   * Add a render job to the queue.
   */
  enqueue(
    compositionId: string,
    inputProps: Record<string, unknown>,
    durationInFrames: number,
  ): RenderJob {
    const job: RenderJob = {
      id: uuid(),
      compositionId,
      inputProps,
      durationInFrames,
      status: "queued",
      progress: 0,
      createdAt: new Date(),
    };

    this.jobs.set(job.id, job);
    this.queue.push(job.id);
    this.processQueue();

    return job;
  }

  /**
   * Get a job by ID.
   */
  getJob(id: string): RenderJob | undefined {
    return this.jobs.get(id);
  }

  /**
   * Get all jobs, optionally filtered by status.
   */
  getAllJobs(status?: RenderJobStatus): RenderJob[] {
    const all = Array.from(this.jobs.values());
    if (status) {
      return all.filter((j) => j.status === status);
    }
    return all;
  }

  /**
   * Update job progress (called by render function).
   */
  updateProgress(id: string, progress: number): void {
    const job = this.jobs.get(id);
    if (job) {
      job.progress = Math.round(progress);
    }
  }

  /**
   * Get queue statistics.
   */
  getStats(): {
    queued: number;
    rendering: number;
    completed: number;
    failed: number;
    total: number;
  } {
    const jobs = Array.from(this.jobs.values());
    return {
      queued: jobs.filter((j) => j.status === "queued").length,
      rendering: jobs.filter((j) => j.status === "rendering").length,
      completed: jobs.filter((j) => j.status === "completed").length,
      failed: jobs.filter((j) => j.status === "failed").length,
      total: jobs.length,
    };
  }

  // ─── Private ────────────────────────────────────────────────────────

  private async processQueue(): Promise<void> {
    if (this.activeCount >= this.options.concurrency) return;
    if (this.queue.length === 0) return;

    const jobId = this.queue.shift();
    if (!jobId) return;

    const job = this.jobs.get(jobId);
    if (!job) return;

    this.activeCount++;
    job.status = "rendering";
    job.startedAt = new Date();

    try {
      if (!this.renderFn) {
        throw new Error(
          "No render function set. Call setRenderFunction() before enqueuing jobs.",
        );
      }

      const outputPath = await this.renderFn(job, this.options);

      job.status = "completed";
      job.progress = 100;
      job.outputPath = outputPath;
      job.completedAt = new Date();
    } catch (error) {
      job.status = "failed";
      job.error = error instanceof Error ? error.message : String(error);
      job.completedAt = new Date();
    } finally {
      this.activeCount--;
      // Continue processing remaining jobs
      this.processQueue();
    }
  }
}

// Singleton instance
let _queue: RenderQueue | null = null;

export function getRenderQueue(
  options?: Partial<RenderQueueOptions>,
): RenderQueue {
  if (!_queue) {
    _queue = new RenderQueue(options);
  }
  return _queue;
}
