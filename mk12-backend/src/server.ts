/**
 * MK-12 Backend Server — main entry point.
 *
 * Combined backend service for the Premiere Pro Plugin and Web Dashboard.
 * Fastify server with CORS, WebSocket, REST routes, Neo4j connection,
 * and graceful shutdown handling.
 *
 * REQUIRES Neo4j — the server will NOT start without it.
 *
 * Run: npx tsx src/server.ts
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import multipart from '@fastify/multipart';
import { config } from './config.js';
import { connectPostgres, initPostgresSchema, closePostgres } from './db/postgres.js';

// Auth middleware
import { authenticate } from './middleware/auth.js';

// Routes
import { registerAuthRoutes } from './routes/auth.js';
import { registerProjectRoutes } from './routes/projects.js';
import { registerSegmentRoutes } from './routes/segments.js';
import { registerPipelineRoutes } from './routes/pipeline.js';
import { registerBlueprintRoutes } from './routes/blueprint.js';
// finalize.ts removed — export.ts handles all export formats
import { registerTranscriptRoutes } from './routes/transcript.js';
import { registerKnowledgeRoutes } from './routes/knowledge.js';
import { registerMarksRoutes } from './routes/marks.js';
import { registerExportRoutes } from './routes/export.js';
import { registerAnimationRoutes } from './routes/animations.js';
import { registerStockRoutes } from './routes/stock.js';
import { registerTemplateRoutes } from './routes/templates.js';
import { registerAnnotationRoutes } from './routes/annotations.js';
import { registerImageRoutes } from './routes/images.js';
import { registerResearchRoutes } from './routes/research.js';
import { registerUploadRoutes } from './routes/upload.js';
import { registerAssetRoutes } from './routes/assets.js';

// WebSocket handlers
import { registerPremiereWS } from './ws/premiere.js';
import { registerDashboardWS } from './ws/dashboard.js';
import { registerCollabWS } from './ws/collaboration.js';
import { syncManager } from './ws/sync.js';

// ──────────────────────────────────────────────────────────────────
// Server setup
// ──────────────────────────────────────────────────────────────────

let loggerConfig: any = { level: config.logLevel };

// Use pino-pretty if available
try {
  require.resolve('pino-pretty');
  loggerConfig.transport = {
    target: 'pino-pretty',
    options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' },
  };
} catch {
  // pino-pretty not installed — use default JSON logger
}

const app = Fastify({ logger: loggerConfig });

async function start(): Promise<void> {
  // ── Connect to Postgres (Neon) ───────────────────────────
  console.log('[server] Connecting to Postgres (Neon)...');
  await connectPostgres();
  await initPostgresSchema();

  try {
    // ── Register plugins ───────────────────────────────────────
    await app.register(cors, {
      origin: (origin, callback) => {
        // Allow all local network origins (192.168.x.x, 10.x.x.x, localhost)
        if (!origin || /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/.test(origin)) {
          callback(null, true);
        } else if (config.corsOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(null, false);
        }
      },
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Collab-Client-Id'],
      credentials: true,
    });

    await app.register(websocket, {
      options: {
        maxPayload: 10 * 1024 * 1024, // 10 MB max message size
      },
    });

    await app.register(multipart, {
      limits: {
        fileSize: 10 * 1024 * 1024 * 1024, // 10 GB max file size
        files: 5,
      },
    });

    // ── Register auth routes (no authentication required) ──────
    await registerAuthRoutes(app);

    // ── Apply JWT authentication to all /api/ routes ────────────
    //    EXCEPT /api/auth/* and /api/health and /api/status
    app.addHook('onRequest', async (req, reply) => {
      const url = req.url;

      // Skip auth for these paths
      if (
        url.startsWith('/api/auth/') ||
        url === '/api/health' ||
        url === '/api/status' ||
        url === '/' ||
        url.startsWith('/ws/')
      ) {
        return;
      }

      // All other /api/ routes require authentication
      if (url.startsWith('/api/')) {
        await authenticate(req, reply);
      }
    });

    // ── Register REST routes ───────────────────────────────────
    await registerProjectRoutes(app);
    await registerSegmentRoutes(app);
    await registerPipelineRoutes(app);
    await registerBlueprintRoutes(app);
    // registerFinalizeRoutes removed — export routes handle all formats
    await registerTranscriptRoutes(app);
    await registerKnowledgeRoutes(app);
    await registerMarksRoutes(app);
    await registerExportRoutes(app);
    await registerAnimationRoutes(app);
    await registerStockRoutes(app);
    await registerTemplateRoutes(app);
    await registerAnnotationRoutes(app);
    await registerImageRoutes(app);
    await registerResearchRoutes(app);
    await registerUploadRoutes(app);
    await registerAssetRoutes(app);

    // ── Register WebSocket handlers ────────────────────────────
    await registerPremiereWS(app);
    await registerDashboardWS(app);
    await registerCollabWS(app);

    // ── Cost tracking endpoints ────────────────────────────────
    const { getProjectCosts, getAllProjectCosts } = await import('./services/cost-service.js');

    app.get('/api/projects/:id/costs', async (req, reply) => {
      const { id } = req.params as { id: string };
      const costs = await getProjectCosts(id);
      return reply.send({ costs });
    });

    app.get('/api/costs/summary', async (_req, reply) => {
      const costMap = await getAllProjectCosts();
      const summary = Object.fromEntries(costMap);
      return reply.send({ costs: summary });
    });

    // ── Job queue endpoints ─────────────────────────────────────
    const { getJobQueue } = await import('./services/queue-service.js');
    const queue = getJobQueue({ concurrency: 2, maxRetries: 3 });

    app.get('/api/jobs/:id', async (req, reply) => {
      const { id } = req.params as { id: string };
      const job = queue.getJob(id);
      if (!job) return reply.status(404).send({ error: 'Job not found' });
      return reply.send({ job });
    });

    app.get('/api/jobs', async (req, reply) => {
      const query = req.query as Record<string, string | undefined>;
      const status = query.status as any;
      return reply.send({ jobs: queue.listJobs(status), stats: queue.getStats() });
    });

    // ── Health check endpoint ──────────────────────────────────
    app.get('/api/health', async (_req, reply) => {
      const queueStats = queue.getStats();
      const { getLogDiskUsage } = await import('./utils/logger.js');
      const logDisk = getLogDiskUsage();
      const memUsage = process.memoryUsage();

      return reply.send({
        status: 'ok',
        version: '0.1.0',
        uptime: Math.round(process.uptime()),
        queue: queueStats,
        memory: {
          heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
          heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
          rssMB: Math.round(memUsage.rss / 1024 / 1024),
        },
        logs: {
          totalMB: logDisk.totalBytes >= 0 ? +(logDisk.totalBytes / 1024 / 1024).toFixed(1) : -1,
          fileCount: logDisk.fileCount,
        },
        limits: {
          maxUploadGB: 10,
          jobTimeoutMin: 30,
          requestTimeoutSec: 120,
          pipelineTimeoutMin: 45,
        },
        timestamp: new Date().toISOString(),
      });
    });

    // ── Status endpoint (for HTTP polling fallback) ────────────
    app.get('/api/status', async (_req, reply) => {
      return reply.send({
        type: 'status',
        payload: {
          server: 'mk12-backend',
          version: '0.1.0',
          ready: true,
        },
      });
    });

    // ── Root endpoint ──────────────────────────────────────────
    app.get('/', async (_req, reply) => {
      return reply.send({
        name: 'EditorLens MK-12 Backend',
        version: '0.1.0',
        endpoints: {
          health: '/api/health',
          projects: '/api/projects',
          websocket_premiere: '/ws/premiere/:projectId',
          websocket_dashboard: '/ws/dashboard/:projectId',
          websocket_collab: '/ws/collab/:projectId',
          annotations: '/api/projects/:id/annotations',
          images: '/api/projects/:id/images',
          research: '/api/projects/:id/research',
        },
      });
    });

    // ── Start listening ────────────────────────────────────────
    // ── Request timeout — scale by endpoint type ──
    app.addHook('onRequest', async (req, reply) => {
      const url = req.url;
      // Upload/pipeline/export routes get 45 minutes (8GB upload + 30min processing)
      // All other routes get 2 minutes
      const isLongRunning = url.includes('/upload') || url.includes('/pipeline') || url.includes('/export') || url.includes('/blueprint/regenerate');
      const timeoutMs = isLongRunning ? 45 * 60 * 1000 : 120_000;
      reply.raw.setTimeout(timeoutMs, () => {
        if (!reply.sent) {
          reply.status(408).send({ error: 'Request timeout' });
        }
      });
    });

    // ── Global error handler ──────────────────────────────────
    app.setErrorHandler(async (error: Error & { statusCode?: number }, req, reply) => {
      const { logger } = await import('./utils/logger.js');
      logger.error(`[${req.method} ${req.url}] ${error.message}`, error, {
        statusCode: error.statusCode,
      });
      const code = error.statusCode ?? 500;
      return reply.status(code).send({
        error: code >= 500 ? 'Internal server error' : error.message,
        ...(process.env.NODE_ENV !== 'production' && { stack: error.stack }),
      });
    });

    // ── Upload size limits ────────────────────────────────────
    app.addContentTypeParser('application/octet-stream', { bodyLimit: 10 * 1024 * 1024 * 1024 }, (_req, payload, done) => {
      done(null, payload);
    });

    await app.listen({ port: config.port, host: '0.0.0.0' });

    console.log('');
    console.log('┌─────────────────────────────────────────────────┐');
    console.log('│          EditorLens MK-12 Backend                │');
    console.log('│                                                  │');
    console.log(`│  HTTP:       http://0.0.0.0:${config.port}                │`);
    console.log(`│  WS Plugin:  ws://0.0.0.0:${config.port}/ws/premiere      │`);
    console.log(`│  WS Dash:    ws://0.0.0.0:${config.port}/ws/dashboard     │`);
    console.log(`│  WS Collab:  ws://0.0.0.0:${config.port}/ws/collab        │`);
    console.log('│  Bound:      0.0.0.0 (WiFi accessible)          │');
    console.log('└─────────────────────────────────────────────────┘');
    console.log('');

  } catch (err) {
    console.error('[server] Failed to start:', err);
    process.exit(1);
  }
}

// ──────────────────────────────────────────────────────────────────
// Graceful shutdown
// ──────────────────────────────────────────────────────────────────

async function shutdown(signal: string): Promise<void> {
  const { logger, closeLogger } = await import('./utils/logger.js');
  logger.info(`Received ${signal} — shutting down gracefully...`);

  // 1. Drain the job queue (wait for active jobs to finish)
  try {
    const { getJobQueue } = await import('./services/queue-service.js');
    const queue = getJobQueue();
    logger.info(`Draining queue: ${queue.getStats().active} active jobs...`);
    await queue.drain(60000); // 60s drain — allow active uploads/pipelines to finish
  } catch (err) {
    logger.warn('Queue drain failed', { error: (err as Error).message });
  }

  // 2. Destroy sync manager (closes all WebSocket tracking)
  syncManager.destroy();

  // 3. Close Fastify (stops accepting new connections, waits for in-flight)
  await app.close();

  // 4. Disconnect databases
  await closePostgres();

  // 5. Close log files
  closeLogger();

  console.log('[server] Shutdown complete');
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// ── Global error safety nets ──────────────────────────────────

process.on('uncaughtException', async (err) => {
  try {
    const { logger } = await import('./utils/logger.js');
    logger.fatal('Uncaught exception', err);
  } catch { console.error('FATAL uncaught exception:', err); }
  process.exit(1);
});

process.on('unhandledRejection', async (reason) => {
  try {
    const { logger } = await import('./utils/logger.js');
    logger.error('Unhandled rejection', reason instanceof Error ? reason : new Error(String(reason)));
  } catch { console.error('Unhandled rejection:', reason); }
});

// ──────────────────────────────────────────────────────────────────
// Start
// ──────────────────────────────────────────────────────────────────

start();
