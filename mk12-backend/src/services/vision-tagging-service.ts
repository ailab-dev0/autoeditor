/**
 * Vision tagging service — Qwen VL via Ollama.
 *
 * Batch-tags keyframes and images using Qwen 3.5 VL 0.8B running locally
 * via Ollama. Falls back gracefully when Ollama is unavailable (the
 * downstream Claude vision step in T5 will handle untagged assets).
 *
 * API reference:
 *   POST /api/generate  — generate with image input
 *   GET  /api/tags      — list available models
 */

import { config } from '../config.js';
import { getFileStream, isStorageConfigured } from './storage-service.js';
import type { MediaAsset, KeyframeInfo } from '../types/index.js';

// ──────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────

const TAG_TAXONOMY = [
  'interview', 'b-roll', 'product', 'text-graphic', 'outdoor', 'indoor',
  'closeup', 'wide', 'action', 'static', 'title-card', 'logo', 'person',
  'group', 'object', 'nature', 'urban', 'presentation', 'screen-recording',
  'behind-scenes',
] as const;

const FRAME_TIMEOUT_MS = 30_000;

const VISION_PROMPT = `Classify this video frame. Return a JSON object with: tags (array of relevant tags from: ${TAG_TAXONOMY.join(', ')}) and description (1-2 sentence description). Only return valid JSON.`;

// ──────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────

interface OllamaGenerateResponse {
  model: string;
  response: string;
  done: boolean;
}

interface TagResult {
  tags: string[];
  description: string;
}

// ──────────────────────────────────────────────────────────────────
// Ollama health check
// ──────────────────────────────────────────────────────────────────

/**
 * Check if Ollama is running and the vision model is available.
 * Returns false gracefully on connection refused or missing model.
 */
export async function checkOllamaAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${config.ollamaUrl}/api/tags`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return false;

    const data = (await res.json()) as { models?: Array<{ name: string }> };
    const models = data.models ?? [];
    const modelAvailable = models.some(
      (m) => m.name === config.ollamaVisionModel || m.name.startsWith(config.ollamaVisionModel),
    );

    if (!modelAvailable) {
      console.warn(
        `[vision-tagging] Ollama is running but model "${config.ollamaVisionModel}" not found. ` +
        `Pull it with: ollama pull ${config.ollamaVisionModel}`,
      );
      return false;
    }

    return true;
  } catch {
    // Connection refused or timeout — Ollama not running
    return false;
  }
}

// ──────────────────────────────────────────────────────────────────
// Internal helpers
// ──────────────────────────────────────────────────────────────────

/**
 * Read a file from MinIO and return its contents as a base64 string.
 */
async function readImageAsBase64(storagePath: string): Promise<string> {
  const stream = await getFileStream(storagePath);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('base64');
}

/**
 * Call Ollama /api/generate with an image and return the parsed tag result.
 * Retries once on malformed response.
 */
async function callOllamaVision(
  base64Image: string,
  prompt: string,
  retryCount = 0,
): Promise<TagResult> {
  const res = await fetch(`${config.ollamaUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.ollamaVisionModel,
      prompt,
      images: [base64Image],
      stream: false,
      format: 'json',
    }),
    signal: AbortSignal.timeout(FRAME_TIMEOUT_MS),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => 'Unknown error');
    throw new Error(`Ollama API error ${res.status}: ${body}`);
  }

  const data: OllamaGenerateResponse = await res.json();

  try {
    const parsed = JSON.parse(data.response);
    const tags: string[] = Array.isArray(parsed.tags)
      ? parsed.tags.filter((t: unknown) => typeof t === 'string' && TAG_TAXONOMY.includes(t as typeof TAG_TAXONOMY[number]))
      : [];
    const description: string = typeof parsed.description === 'string'
      ? parsed.description
      : '';
    return { tags, description };
  } catch {
    if (retryCount < 1) {
      console.warn('[vision-tagging] Malformed response, retrying...');
      return callOllamaVision(base64Image, prompt, retryCount + 1);
    }
    console.warn('[vision-tagging] Malformed response after retry, skipping frame');
    return { tags: [], description: '' };
  }
}

// ──────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────

/**
 * Tag a single keyframe image from MinIO.
 */
export async function tagKeyframe(
  imagePath: string,
  context?: string,
): Promise<TagResult> {
  const truncatedContext = context ? context.slice(0, 500) : undefined;
  const prompt = truncatedContext
    ? `${VISION_PROMPT}\n\nAdditional context: ${truncatedContext}`
    : VISION_PROMPT;

  const base64 = await readImageAsBase64(imagePath);
  return callOllamaVision(base64, prompt);
}

/**
 * Tag an image-type asset. Stores the result as a single keyframe
 * entry at timestamp 0.
 */
export async function tagImage(
  projectId: string,
  asset: MediaAsset,
): Promise<MediaAsset> {
  if (asset.type !== 'image') return asset;

  // T3 uploads the image to MinIO and stores the path in keyframes[0].storagePath
  const storagePath = asset.keyframes?.[0]?.storagePath;
  if (!storagePath) {
    console.warn(
      `[vision-tagging] Image asset "${asset.name}" has no storagePath in keyframes — skipping`,
    );
    return asset;
  }

  try {
    const result = await tagKeyframe(storagePath);
    const keyframe: KeyframeInfo = {
      timestamp: 0,
      storagePath,
      tags: result.tags,
      description: result.description,
    };
    asset.keyframes = [keyframe];
  } catch (err) {
    console.warn(
      `[vision-tagging] Failed to tag image "${asset.name}": ${(err as Error).message}`,
    );
  }

  return asset;
}

/**
 * Batch-tag all keyframes across video assets and all image assets.
 *
 * Processing is sequential to avoid overwhelming the local GPU.
 * Falls back gracefully if Ollama is unavailable.
 */
export async function batchTagAssets(
  projectId: string,
  assets: MediaAsset[],
  onProgress?: (progress: number) => void,
): Promise<MediaAsset[]> {
  // Pre-flight check
  const available = await checkOllamaAvailable();
  if (!available) {
    console.warn(
      '[vision-tagging] Ollama unavailable — returning assets untagged. ' +
      'Claude vision (T5) will handle tagging downstream.',
    );
    return assets;
  }

  if (!isStorageConfigured()) {
    console.warn('[vision-tagging] MinIO not configured — cannot read keyframes');
    return assets;
  }

  // Count total items to process for progress tracking
  let totalItems = 0;
  for (const asset of assets) {
    if (asset.type === 'image') {
      totalItems++;
    } else if (asset.type === 'video' && asset.keyframes) {
      totalItems += asset.keyframes.length;
    }
  }

  if (totalItems === 0) {
    console.log('[vision-tagging] No keyframes or images to tag');
    onProgress?.(100);
    return assets;
  }

  console.log(`[vision-tagging] Tagging ${totalItems} items across ${assets.length} assets`);
  let processed = 0;

  for (const asset of assets) {
    if (asset.type === 'image') {
      // Tag image asset directly
      await tagImage(projectId, asset);
      processed++;
      onProgress?.(Math.round((processed / totalItems) * 100));
    } else if (asset.type === 'video' && asset.keyframes) {
      // Tag each keyframe sequentially
      for (const kf of asset.keyframes) {
        try {
          const result = await tagKeyframe(kf.storagePath);
          kf.tags = result.tags;
          kf.description = result.description;
        } catch (err) {
          console.warn(
            `[vision-tagging] Failed to tag keyframe at ${kf.timestamp}s ` +
            `in "${asset.name}": ${(err as Error).message}`,
          );
        }
        processed++;
        onProgress?.(Math.round((processed / totalItems) * 100));
      }
    }
  }

  console.log(`[vision-tagging] Completed: ${processed}/${totalItems} items tagged`);
  onProgress?.(100);
  return assets;
}
