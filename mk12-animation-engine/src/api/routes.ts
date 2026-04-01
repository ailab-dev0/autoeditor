// ─── API Routes ─────────────────────────────────────────────────────────────
// POST /api/generate   — takes content mark, returns animation props
// POST /api/render     — takes composition + props, queues render, returns job ID
// GET  /api/status/:id — render job status + download URL when complete
// GET  /api/jobs       — list all render jobs
// GET  /api/health     — health check

import { Router, type Request, type Response } from "express";
import path from "path";
import {
  type ContentMark,
  type CompositionId,
  routeContentMark,
} from "../lib/content-mark-router";
import { promptToProps } from "../lib/prompt-to-props";
import { getRenderQueue, type RenderJob } from "../lib/render-queue";
import { renderComposition } from "../render-impl";

const router = Router();
const queue = getRenderQueue();

// Wire up the render function to the queue
queue.setRenderFunction(async (job, opts) => {
  const outputPath = path.join(
    opts.outputDir,
    `${job.compositionId}-${job.id}.mp4`,
  );

  await renderComposition({
    compositionId: job.compositionId,
    inputProps: job.inputProps,
    durationInFrames: job.durationInFrames,
    outputPath,
    fps: opts.fps,
    width: opts.width,
    height: opts.height,
    onProgress: (progress) => {
      queue.updateProgress(job.id, progress * 100);
    },
  });

  return outputPath;
});

// ─── POST /api/generate ─────────────────────────────────────────────────────
// Takes a content mark, converts the prompt to template props using LLM.

router.post("/generate", async (req: Request, res: Response) => {
  try {
    const mark = req.body as ContentMark;

    if (!mark.asset_type || !mark.search_query) {
      res.status(400).json({
        ok: false,
        error: "Request body must include asset_type and search_query",
      });
      return;
    }

    const result = await promptToProps(mark);

    res.json({
      ok: true,
      data: {
        compositionId: result.compositionId,
        props: result.props,
        durationFrames: result.durationFrames,
        durationSeconds: +(result.durationFrames / 30).toFixed(2),
      },
    });
  } catch (error) {
    console.error("[API] Generate error:", error);
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
});

// ─── POST /api/render ───────────────────────────────────────────────────────
// Takes composition ID + props, queues a render job, returns job ID.

router.post("/render", async (req: Request, res: Response) => {
  try {
    const {
      compositionId,
      props,
      durationInFrames,
    } = req.body as {
      compositionId: CompositionId;
      props: Record<string, unknown>;
      durationInFrames?: number;
    };

    if (!compositionId || !props) {
      res.status(400).json({
        ok: false,
        error: "Request body must include compositionId and props",
      });
      return;
    }

    const duration = durationInFrames || 150;
    const job = queue.enqueue(compositionId, props, duration);

    res.status(202).json({
      ok: true,
      data: {
        jobId: job.id,
        status: job.status,
        compositionId: job.compositionId,
        durationInFrames: duration,
        message: "Render job queued",
      },
    });
  } catch (error) {
    console.error("[API] Render error:", error);
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
});

// ─── GET /api/status/:id ────────────────────────────────────────────────────
// Get render job status. Returns download path when complete.

router.get("/status/:id", (req: Request<{ id: string }>, res: Response) => {
  const job = queue.getJob(req.params.id);

  if (!job) {
    res.status(404).json({
      ok: false,
      error: `Job ${req.params.id} not found`,
    });
    return;
  }

  const response: Record<string, unknown> = {
    ok: true,
    data: {
      id: job.id,
      compositionId: job.compositionId,
      status: job.status,
      progress: job.progress,
      createdAt: job.createdAt.toISOString(),
      startedAt: job.startedAt?.toISOString(),
      completedAt: job.completedAt?.toISOString(),
    },
  };

  if (job.status === "completed" && job.outputPath) {
    (response.data as Record<string, unknown>).outputPath = job.outputPath;
    (response.data as Record<string, unknown>).downloadUrl = `/api/download/${job.id}`;
  }

  if (job.status === "failed" && job.error) {
    (response.data as Record<string, unknown>).error = job.error;
  }

  res.json(response);
});

// ─── GET /api/jobs ──────────────────────────────────────────────────────────
// List all render jobs with optional status filter.

router.get("/jobs", (req: Request, res: Response) => {
  const statusFilter = req.query.status as string | undefined;
  const jobs = queue.getAllJobs(statusFilter as RenderJob["status"] | undefined);
  const stats = queue.getStats();

  res.json({
    ok: true,
    data: {
      jobs: jobs.map((j) => ({
        id: j.id,
        compositionId: j.compositionId,
        status: j.status,
        progress: j.progress,
        createdAt: j.createdAt.toISOString(),
        completedAt: j.completedAt?.toISOString(),
        outputPath: j.outputPath,
        error: j.error,
      })),
      stats,
    },
  });
});

// ─── GET /api/download/:id ──────────────────────────────────────────────────
// Download a completed render.

router.get("/download/:id", (req: Request<{ id: string }>, res: Response) => {
  const job = queue.getJob(req.params.id);

  if (!job) {
    res.status(404).json({ ok: false, error: "Job not found" });
    return;
  }

  if (job.status !== "completed" || !job.outputPath) {
    res.status(400).json({
      ok: false,
      error: `Job is ${job.status}, not ready for download`,
    });
    return;
  }

  res.download(job.outputPath);
});

// ─── GET /api/health ────────────────────────────────────────────────────────

router.get("/health", (_req: Request, res: Response) => {
  const stats = queue.getStats();
  res.json({
    ok: true,
    service: "mk12-animation-engine",
    version: "1.0.0",
    queue: stats,
  });
});

export { router };
