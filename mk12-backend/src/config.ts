/**
 * Environment configuration for MK-12 Backend.
 *
 * All values have sensible defaults for local development.
 * Override via environment variables in production.
 *
 * OpenRouter API key is loaded from:
 *   1. process.env.OPENROUTER_API_KEY
 *   2. /Users/miles/.claude/plugins/ana/.env (ANA plugin fallback)
 */

import { readFileSync } from 'fs';
import { config as dotenvConfig } from 'dotenv';

// Load .env file into process.env
dotenvConfig();

export interface Config {
  port: number;
  host: string;
  neo4jUri: string;
  neo4jUser: string;
  neo4jPassword: string;
  autoEditorPath: string;
  ffmpegPath: string;
  ffprobePath: string;
  openrouterApiKey: string;
  speechmaticsApiKey: string;
  deepgramApiKey: string;
  assemblyaiApiKey: string;
  falApiKey: string;
  animationEngineUrl: string;
  corsOrigins: string[];
  logLevel: string;
  jwtSecret: string;
  pexelsApiKey: string;
  pixabayApiKey: string;
  databaseUrl: string;
  minioEndpoint: string;
  minioAccessKey: string;
  minioSecretKey: string;
  minioRegion: string;
  minioBucket: string;
  ollamaUrl: string;
  ollamaVisionModel: string;
  scriptGeneratorModel: string;
}

function env(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

/**
 * Load OpenRouter API key — check process.env first, then ANA .env file.
 */
function loadOpenRouterKey(): string {
  // 1. Check process.env
  if (process.env.OPENROUTER_API_KEY) {
    return process.env.OPENROUTER_API_KEY;
  }

  // 2. Try reading from ANA plugin .env
  const anaEnvPath = '/Users/miles/.claude/plugins/ana/.env';
  try {
    const content = readFileSync(anaEnvPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('OPENROUTER_API_KEY=')) {
        const value = trimmed.slice('OPENROUTER_API_KEY='.length).trim();
        // Strip surrounding quotes if present
        const unquoted = value.replace(/^['"]|['"]$/g, '');
        if (unquoted) {
          console.log('[config] Loaded OPENROUTER_API_KEY from ANA plugin .env');
          return unquoted;
        }
      }
    }
  } catch {
    // File not found or unreadable — that's fine
  }

  return '';
}

export const config: Config = {
  port: parseInt(env('PORT', '8000'), 10),
  host: env('HOST', '0.0.0.0'),

  // Neo4j
  neo4jUri: env('NEO4J_URI', 'bolt://localhost:7687'),
  neo4jUser: env('NEO4J_USER', 'neo4j'),
  neo4jPassword: env('NEO4J_PASSWORD', 'password'),

  // Tool paths (auto-detected on this system)
  autoEditorPath: env('AUTO_EDITOR_PATH', 'auto-editor'),
  ffmpegPath: env('FFMPEG_PATH', 'ffmpeg'),
  ffprobePath: env('FFPROBE_PATH', 'ffprobe'),

  // OpenRouter for AI analysis (loaded from env or ANA plugin)
  openrouterApiKey: loadOpenRouterKey(),

  // Speechmatics Batch API (cloud transcription — preferred over local Whisper)
  speechmaticsApiKey: env('SPEECHMATICS_API_KEY', ''),

  // Deepgram API (fallback transcription)
  deepgramApiKey: env('DEEPGRAM_API_KEY', ''),

  // AssemblyAI (primary transcription provider)
  assemblyaiApiKey: env('ASSEMBLYAI_API_KEY', ''),

  // Fal.ai for AI image generation (Flux, Stable Diffusion)
  falApiKey: env('FAL_API_KEY', ''),

  // Animation Engine
  animationEngineUrl: env('ANIMATION_ENGINE_URL', 'http://localhost:4200'),

  // CORS — allow dashboard dev server and production origins
  corsOrigins: env('CORS_ORIGINS', 'http://localhost:3000,http://localhost:5173,http://localhost:4321')
    .split(',')
    .map((s) => s.trim()),

  logLevel: env('LOG_LEVEL', 'info'),

  // JWT authentication
  jwtSecret: env('JWT_SECRET', 'mk12-dev-secret'),

  // Stock footage API keys
  pexelsApiKey: env('PEXELS_API_KEY', ''),
  pixabayApiKey: env('PIXABAY_API_KEY', ''),

  // Neon PostgreSQL (relational store for users + projects)
  databaseUrl: env('DATABASE_URL', ''),

  // MinIO / S3 object storage (video files, generated assets)
  minioEndpoint: env('MINIO_ENDPOINT', 'http://localhost:9000'),
  minioAccessKey: env('MINIO_ACCESS_KEY', ''),
  minioSecretKey: env('MINIO_SECRET_KEY', ''),
  minioRegion: env('MINIO_REGION', 'us-east-1'),
  minioBucket: env('MINIO_BUCKET', 'editorlens'),

  // Ollama (local vision model for keyframe tagging)
  ollamaUrl: env('OLLAMA_URL', 'http://localhost:11434'),
  ollamaVisionModel: env('OLLAMA_VISION_MODEL', 'qwen3.5-vl:0.8b'),

  // AI script generation model (via OpenRouter)
  scriptGeneratorModel: env('SCRIPT_GENERATOR_MODEL', 'anthropic/claude-sonnet-4'),
};
