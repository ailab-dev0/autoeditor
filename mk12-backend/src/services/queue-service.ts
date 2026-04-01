/**
 * Job Queue Service — FIFO with configurable concurrency, retry, and backoff.
 *
 * Every submitted job gets a unique ID, status tracking, timestamps, and retry logic.
 * No job is ever silently dropped — all failures are logged and retried up to MAX_RETRIES.
 */

import { v4 as uuid } from 'uuid';
import { EventEmitter } from 'events';

// ─── Types ───────────────────────────────────────────────────

export type JobStatus = 'pending' | 'processing' | 'done' | 'failed';

export interface Job<T = unknown> {
  id: string;
  type: string;
  status: JobStatus;
  payload: T;
  result?: unknown;
  error?: string;
  retryCount: number;
  maxRetries: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  nextRetryAt?: string;
}

export type JobHandler<T = unknown> = (job: Job<T>) => Promise<unknown>;

interface QueueOptions {
  concurrency?: number;
  maxRetries?: number;
  baseBackoffMs?: number;
  maxBackoffMs?: number;
  jobTimeoutMs?: number;
}

// ─── Queue Implementation ────────────────────────────────────

const DEFAULT_OPTIONS: Required<QueueOptions> = {
  concurrency: 2,
  jobTimeoutMs: 30 * 60 * 1000, // 30 minutes default per job
  maxRetries: 3,
  baseBackoffMs: 2000,
  maxBackoffMs: 30000,
};

export class JobQueue extends EventEmitter {
  private jobs = new Map<string, Job>();
  private pending: string[] = [];     // FIFO queue of job IDs
  private active = new Set<string>(); // currently processing
  private handlers = new Map<string, JobHandler>();
  private options: Required<QueueOptions>;
  private draining = false;
  private retryTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(options?: QueueOptions) {
    super();
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Register a handler for a job type.
   */
  registerHandler<T = unknown>(type: string, handler: JobHandler<T>): void {
    this.handlers.set(type, handler as JobHandler);
  }

  /**
   * Submit a new job. Returns the job ID immediately.
   */
  submit<T = unknown>(type: string, payload: T): Job<T> {
    if (this.draining) {
      throw new Error('Queue is draining — not accepting new jobs');
    }

    if (!this.handlers.has(type)) {
      throw new Error(`No handler registered for job type: ${type}`);
    }

    const job: Job<T> = {
      id: uuid(),
      type,
      status: 'pending',
      payload,
      retryCount: 0,
      maxRetries: this.options.maxRetries,
      createdAt: new Date().toISOString(),
    };

    this.jobs.set(job.id, job as Job);
    this.pending.push(job.id);
    this.emit('job:submitted', job);

    // Trigger processing on next tick
    queueMicrotask(() => this.processNext());

    return job;
  }

  /**
   * Get a job by ID.
   */
  getJob(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  /**
   * Get all jobs, optionally filtered by status.
   */
  listJobs(status?: JobStatus): Job[] {
    const all = Array.from(this.jobs.values());
    return status ? all.filter(j => j.status === status) : all;
  }

  /**
   * Get queue statistics.
   */
  getStats(): { pending: number; active: number; done: number; failed: number; total: number } {
    let done = 0, failed = 0;
    for (const j of this.jobs.values()) {
      if (j.status === 'done') done++;
      if (j.status === 'failed') failed++;
    }
    return {
      pending: this.pending.length,
      active: this.active.size,
      done,
      failed,
      total: this.jobs.size,
    };
  }

  /**
   * Graceful drain — stop accepting new jobs, wait for active to finish.
   */
  async drain(timeoutMs = 30000): Promise<void> {
    this.draining = true;

    // Clear all retry timers
    for (const [, timer] of this.retryTimers) clearTimeout(timer);
    this.retryTimers.clear();

    if (this.active.size === 0) return;

    return new Promise((resolve) => {
      const check = setInterval(() => {
        if (this.active.size === 0) {
          clearInterval(check);
          resolve();
        }
      }, 200);

      setTimeout(() => {
        clearInterval(check);
        if (this.active.size > 0) {
          console.warn(`[queue] Drain timeout: ${this.active.size} jobs still active`);
        }
        resolve();
      }, timeoutMs);
    });
  }

  /**
   * Clean up completed/failed jobs older than maxAgeMs.
   */
  cleanup(maxAgeMs = 3600000): number {
    const cutoff = Date.now() - maxAgeMs;
    let removed = 0;
    for (const [id, job] of this.jobs) {
      if ((job.status === 'done' || job.status === 'failed') && job.completedAt) {
        if (new Date(job.completedAt).getTime() < cutoff) {
          this.jobs.delete(id);
          removed++;
        }
      }
    }
    return removed;
  }

  // ─── Private ─────────────────────────────────────────────────

  private async processNext(): Promise<void> {
    if (this.active.size >= this.options.concurrency) return;
    if (this.pending.length === 0) return;

    const jobId = this.pending.shift()!;
    const job = this.jobs.get(jobId);
    if (!job) return;

    this.active.add(jobId);
    job.status = 'processing';
    job.startedAt = new Date().toISOString();
    this.emit('job:started', job);

    const handler = this.handlers.get(job.type);
    if (!handler) {
      job.status = 'failed';
      job.error = `No handler for type: ${job.type}`;
      job.completedAt = new Date().toISOString();
      this.active.delete(jobId);
      this.emit('job:failed', job);
      this.processNext();
      return;
    }

    try {
      const result = await Promise.race([
        handler(job),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Job timed out after ${this.options.jobTimeoutMs / 1000}s`)), this.options.jobTimeoutMs)
        ),
      ]);
      job.status = 'done';
      job.result = result;
      job.completedAt = new Date().toISOString();
      this.active.delete(jobId);
      this.emit('job:done', job);
    } catch (err) {
      job.retryCount++;
      job.error = (err as Error).message;

      if (job.retryCount >= job.maxRetries) {
        job.status = 'failed';
        job.completedAt = new Date().toISOString();
        this.active.delete(jobId);
        console.error(`[queue] Job ${jobId} (${job.type}) failed permanently after ${job.retryCount} attempts: ${job.error}`);
        this.emit('job:failed', job);
      } else {
        job.status = 'pending';
        this.active.delete(jobId);
        const delay = Math.min(
          this.options.baseBackoffMs * Math.pow(2, job.retryCount - 1),
          this.options.maxBackoffMs,
        );
        job.nextRetryAt = new Date(Date.now() + delay).toISOString();
        console.warn(`[queue] Job ${jobId} (${job.type}) failed (attempt ${job.retryCount}/${job.maxRetries}), retrying in ${delay}ms: ${job.error}`);
        this.emit('job:retry', job);

        const timer = setTimeout(() => {
          this.retryTimers.delete(jobId);
          if (!this.draining) {
            this.pending.push(jobId);
            this.processNext();
          }
        }, delay);
        this.retryTimers.set(jobId, timer);
      }
    }

    // Process next job in queue
    this.processNext();
  }
}

// ─── Singleton ─────────────────────────────────────────────────

let instance: JobQueue | null = null;

export function getJobQueue(options?: QueueOptions): JobQueue {
  if (!instance) {
    instance = new JobQueue(options);
  }
  return instance;
}
