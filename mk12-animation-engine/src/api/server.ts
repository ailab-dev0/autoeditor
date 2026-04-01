#!/usr/bin/env node
// ─── MK-12 Animation Engine API Server ──────────────────────────────────────
//
// HTTP API for generating and rendering content mark animations.
//
// Usage:
//   npx tsx src/api/server.ts
//   npx tsx src/api/server.ts --port 4200
//
// Endpoints:
//   POST /api/generate        — convert content mark to template props
//   POST /api/render          — queue a render job
//   GET  /api/status/:id      — check render job status
//   GET  /api/jobs             — list all render jobs
//   GET  /api/download/:id    — download completed render
//   GET  /api/health          — health check

import express from "express";
import path from "path";
import { router } from "./routes";

const PORT = parseInt(process.env.PORT || "4200", 10);
const HOST = process.env.HOST || "0.0.0.0";

const app = express();

// ─── Middleware ──────────────────────────────────────────────────────────────

app.use(express.json({ limit: "10mb" }));

// CORS (allow dashboard and local dev)
app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (_req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

// Request logging
app.use((req, _res, next) => {
  const timestamp = new Date().toISOString().split("T")[1].replace("Z", "");
  console.log(`[${timestamp}] ${req.method} ${req.url}`);
  next();
});

// ─── Routes ─────────────────────────────────────────────────────────────────

app.use("/api", router);

// Static file serving for rendered outputs
const outputDir = path.resolve(process.cwd(), "out");
app.use("/out", express.static(outputDir));

// Root info
app.get("/", (_req, res) => {
  res.json({
    service: "MK-12 Animation Engine",
    version: "1.0.0",
    description:
      "Remotion-powered content mark animation generator for EditorLens MK-12",
    endpoints: {
      "POST /api/generate":
        "Convert content mark to template props (uses LLM)",
      "POST /api/render": "Queue a render job",
      "GET /api/status/:id": "Check render job status",
      "GET /api/jobs": "List all render jobs",
      "GET /api/download/:id": "Download completed render",
      "GET /api/health": "Health check",
    },
    templates: [
      "InfoGraphic",
      "TextOverlay",
      "StockFootagePlaceholder",
      "ArticleReference",
      "ConceptExplainer",
      "ChapterTitle",
    ],
    contentMarkTypes: [
      "animation",
      "stock_video",
      "article",
      "ai_image",
      "loom_recording",
      "speaking_only",
      "chapter_boundary",
    ],
  });
});

// ─── Start ──────────────────────────────────────────────────────────────────

app.listen(PORT, HOST, () => {
  console.log(`
  ╔══════════════════════════════════════════════════════╗
  ║         MK-12 Animation Engine API Server           ║
  ╠══════════════════════════════════════════════════════╣
  ║  URL:  http://${HOST}:${PORT}                         ║
  ║  API:  http://${HOST}:${PORT}/api                     ║
  ╚══════════════════════════════════════════════════════╝
  `);
  console.log("  Endpoints:");
  console.log("    POST /api/generate   — content mark → template props");
  console.log("    POST /api/render     — queue render job");
  console.log("    GET  /api/status/:id — render job status");
  console.log("    GET  /api/jobs       — list all jobs");
  console.log("    GET  /api/health     — health check");
  console.log();
});

export { app };
