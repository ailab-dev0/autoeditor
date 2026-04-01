/**
 * Asset analysis service — FFmpeg keyframe + metadata extraction.
 *
 * Extracts metadata, keyframes, and silence regions from video/audio/image
 * assets using FFmpeg/FFprobe, storing results in MinIO.
 */

import { spawn } from 'child_process';
import { existsSync, readFileSync, unlinkSync, readdirSync } from 'fs';
import { mkdirSync } from 'fs';
import { join, basename, extname } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { config } from '../config.js';
import { uploadFile } from './storage-service.js';
import type { MediaAsset, KeyframeInfo, TimeRegion } from '../types/index.js';

// ── Orchestrator ──────────────────────────────────────────────────

/**
 * Analyze all assets, dispatching to type-specific handlers.
 * Reports progress 0-100% via optional callback.
 */
export async function analyzeAssets(
  projectId: string,
  assets: MediaAsset[],
  onProgress?: (progress: number) => void,
): Promise<MediaAsset[]> {
  if (assets.length === 0) return [];

  onProgress?.(0);
  const results: MediaAsset[] = [];

  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i];
    console.log(`[asset-analysis] Analyzing ${asset.type} asset: ${asset.name} (${i + 1}/${assets.length})`);

    try {
      let analyzed: MediaAsset;
      switch (asset.type) {
        case 'video':
          analyzed = await analyzeVideo(projectId, asset);
          break;
        case 'audio':
          analyzed = await analyzeAudio(projectId, asset);
          break;
        case 'image':
          analyzed = await analyzeImage(projectId, asset);
          break;
        default:
          console.warn(`[asset-analysis] Unknown asset type: ${(asset as any).type}, skipping`);
          analyzed = asset;
      }
      results.push(analyzed);
    } catch (err) {
      console.error(`[asset-analysis] Failed to analyze ${asset.name}:`, (err as Error).message);
      results.push(asset); // Return unmodified on error
    }

    const progress = Math.round(((i + 1) / assets.length) * 100);
    onProgress?.(progress);
  }

  return results;
}

// ── Video Analysis ────────────────────────────────────────────────

/**
 * Analyze a video asset: extract metadata via ffprobe, then extract
 * keyframes and upload them to MinIO.
 */
export async function analyzeVideo(
  projectId: string,
  asset: MediaAsset,
): Promise<MediaAsset> {
  const meta = await probeMetadata(asset.path);
  const updated: MediaAsset = {
    ...asset,
    duration: meta.duration,
    fps: meta.fps,
    dimensions: meta.dimensions,
    codec: meta.codec,
    sizeBytes: meta.sizeBytes,
  };

  // Extract keyframes
  const keyframes = await extractKeyframes(projectId, updated);
  updated.keyframes = keyframes;

  return updated;
}

// ── Audio Analysis ────────────────────────────────────────────────

/**
 * Analyze an audio asset: extract metadata and detect silence regions.
 */
export async function analyzeAudio(
  projectId: string,
  asset: MediaAsset,
): Promise<MediaAsset> {
  const meta = await probeMetadata(asset.path);
  const updated: MediaAsset = {
    ...asset,
    duration: meta.duration,
    codec: meta.codec,
    sizeBytes: meta.sizeBytes,
  };

  // Detect silence regions
  const silenceRegions = await detectSilence(asset.path);
  updated.silenceRegions = silenceRegions;

  return updated;
}

// ── Image Analysis ────────────────────────────────────────────────

/**
 * Analyze an image asset: extract dimensions, then upload a copy
 * to MinIO for downstream processing (e.g. Qwen vision).
 */
export async function analyzeImage(
  projectId: string,
  asset: MediaAsset,
): Promise<MediaAsset> {
  const meta = await probeMetadata(asset.path);
  const updated: MediaAsset = {
    ...asset,
    dimensions: meta.dimensions,
    sizeBytes: meta.sizeBytes,
    codec: meta.codec,
  };

  // Upload copy to MinIO keyframes path
  const safeName = sanitizeFilename(asset.name);
  const storagePath = `projects/${projectId}/keyframes/${safeName}.jpg`;

  try {
    const imageData = readFileSync(asset.path);
    await uploadFile(storagePath, imageData, 'image/jpeg');
    updated.keyframes = [{
      timestamp: 0,
      storagePath,
    }];
    console.log(`[asset-analysis] Uploaded image to ${storagePath}`);
  } catch (err) {
    console.warn(`[asset-analysis] Failed to upload image ${asset.name}:`, (err as Error).message);
  }

  return updated;
}

// ── FFprobe Metadata ──────────────────────────────────────────────

interface ProbeResult {
  duration?: number;
  fps?: number;
  dimensions?: { width: number; height: number };
  codec?: string;
  sizeBytes?: number;
}

/**
 * Run ffprobe to extract metadata from any media file.
 */
async function probeMetadata(filePath: string): Promise<ProbeResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn(config.ffprobePath || 'ffprobe', [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      filePath,
    ]);

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d: Buffer) => (stdout += d.toString()));
    proc.stderr.on('data', (d: Buffer) => (stderr += d.toString()));

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffprobe exited with code ${code}: ${stderr}`));
        return;
      }

      try {
        const data = JSON.parse(stdout);
        const format = data.format ?? {};
        const streams = data.streams ?? [];

        // Find video stream (if any)
        const videoStream = streams.find((s: any) => s.codec_type === 'video');
        // Find audio stream (if any)
        const audioStream = streams.find((s: any) => s.codec_type === 'audio');

        const result: ProbeResult = {
          duration: format.duration ? parseFloat(format.duration) : undefined,
          sizeBytes: format.size ? parseInt(format.size, 10) : undefined,
        };

        if (videoStream) {
          result.dimensions = {
            width: videoStream.width,
            height: videoStream.height,
          };
          result.codec = videoStream.codec_name;

          // Parse FPS from r_frame_rate (e.g. "30000/1001")
          if (videoStream.r_frame_rate) {
            const parts = videoStream.r_frame_rate.split('/');
            if (parts.length === 2) {
              const num = parseInt(parts[0], 10);
              const den = parseInt(parts[1], 10);
              if (den > 0) result.fps = Math.round((num / den) * 100) / 100;
            }
          }
        } else if (audioStream) {
          result.codec = audioStream.codec_name;
        }

        resolve(result);
      } catch (parseErr) {
        reject(new Error(`Failed to parse ffprobe output: ${(parseErr as Error).message}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`ffprobe not found: ${err.message}`));
    });
  });
}

// ── Keyframe Extraction ───────────────────────────────────────────

/**
 * Extract keyframes from a video. Uses I-frame selection for short
 * videos, interval-based (1 per 5s) for long videos (>60s).
 * Uploads each keyframe to MinIO.
 */
async function extractKeyframes(
  projectId: string,
  asset: MediaAsset,
): Promise<KeyframeInfo[]> {
  const duration = asset.duration ?? 0;
  const safeName = sanitizeFilename(asset.name);

  // Create temp directory for keyframe output
  const tmpDir = join(tmpdir(), `mk12-kf-${projectId}-${randomUUID().slice(0, 8)}`);
  mkdirSync(tmpDir, { recursive: true });

  const outputPattern = join(tmpDir, `${safeName}_%04d.jpg`);

  try {
    // Choose extraction strategy based on duration
    if (duration > 60) {
      // Long video: 1 keyframe per 5 seconds
      await runFFmpegKeyframeExtract(asset.path, outputPattern, 'interval');
    } else {
      // Short video: extract I-frames
      await runFFmpegKeyframeExtract(asset.path, outputPattern, 'iframes');
    }

    // Read extracted files, upload to MinIO
    const files = readdirSync(tmpDir)
      .filter((f) => f.endsWith('.jpg'))
      .sort();

    const keyframes: KeyframeInfo[] = [];

    for (let i = 0; i < files.length; i++) {
      const filePath = join(tmpDir, files[i]);
      const fileData = readFileSync(filePath);

      // Estimate timestamp from frame index
      const timestamp = duration > 60
        ? i * 5 // interval-based: 5s apart
        : duration > 0
          ? (i / Math.max(files.length - 1, 1)) * duration
          : i;

      const storagePath = `projects/${projectId}/keyframes/${safeName}_${timestamp.toFixed(2)}s.jpg`;

      await uploadFile(storagePath, fileData, 'image/jpeg');

      keyframes.push({
        timestamp: Math.round(timestamp * 100) / 100,
        storagePath,
      });

      // Clean up temp file
      unlinkSync(filePath);
    }

    console.log(`[asset-analysis] Extracted ${keyframes.length} keyframes for ${asset.name}`);
    return keyframes;
  } catch (err) {
    console.warn(`[asset-analysis] Keyframe extraction failed for ${asset.name}:`, (err as Error).message);
    return [];
  } finally {
    // Clean up temp dir
    try {
      readdirSync(tmpDir).forEach((f) => {
        try { unlinkSync(join(tmpDir, f)); } catch { /* intentional: best-effort file cleanup */ }
      });
      // rmdir only works on empty dirs
      require('fs').rmdirSync(tmpDir);
    } catch (err) {
      console.warn(`[asset-analysis] Failed to clean up temp dir ${tmpDir}:`, (err as Error).message);
    }
  }
}

/**
 * Spawn FFmpeg to extract keyframes.
 * mode 'iframes' uses I-frame selection, 'interval' extracts 1 per 5s.
 */
function runFFmpegKeyframeExtract(
  inputPath: string,
  outputPattern: string,
  mode: 'iframes' | 'interval',
): Promise<void> {
  return new Promise((resolve, reject) => {
    const args: string[] = ['-i', inputPath];

    if (mode === 'iframes') {
      args.push(
        '-vf', "select='eq(pict_type,I)'",
        '-vsync', 'vfr',
        '-q:v', '2',
        outputPattern,
      );
    } else {
      args.push(
        '-vf', 'fps=1/5',
        '-q:v', '2',
        outputPattern,
      );
    }

    const proc = spawn(config.ffmpegPath || 'ffmpeg', args);

    let stderr = '';
    proc.stderr.on('data', (d: Buffer) => (stderr += d.toString()));

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`FFmpeg keyframe extraction exited with code ${code}: ${stderr.slice(-500)}`));
        return;
      }
      resolve();
    });

    proc.on('error', (err) => {
      reject(new Error(`FFmpeg not found: ${err.message}`));
    });
  });
}

// ── Silence Detection ─────────────────────────────────────────────

/**
 * Detect silence regions in an audio/video file.
 * Uses FFmpeg silencedetect filter.
 */
async function detectSilence(filePath: string): Promise<TimeRegion[]> {
  return new Promise((resolve, reject) => {
    const proc = spawn(config.ffmpegPath || 'ffmpeg', [
      '-i', filePath,
      '-af', 'silencedetect=noise=-30dB:d=0.5',
      '-f', 'null',
      '-',
    ]);

    let stderr = '';
    proc.stderr.on('data', (d: Buffer) => (stderr += d.toString()));

    proc.on('close', (code) => {
      // silencedetect outputs to stderr even on success
      const regions = parseSilenceOutput(stderr);
      resolve(regions);
    });

    proc.on('error', (err) => {
      console.warn(`[asset-analysis] Silence detection failed: ${err.message}`);
      resolve([]);
    });
  });
}

/**
 * Parse FFmpeg silencedetect output from stderr.
 * Lines look like:
 *   [silencedetect @ 0x...] silence_start: 1.234
 *   [silencedetect @ 0x...] silence_end: 5.678 | silence_duration: 4.444
 */
function parseSilenceOutput(stderr: string): TimeRegion[] {
  const regions: TimeRegion[] = [];
  const lines = stderr.split('\n');

  let currentStart: number | null = null;

  for (const line of lines) {
    const startMatch = line.match(/silence_start:\s*([\d.]+)/);
    if (startMatch) {
      currentStart = parseFloat(startMatch[1]);
      continue;
    }

    const endMatch = line.match(/silence_end:\s*([\d.]+)/);
    if (endMatch && currentStart !== null) {
      regions.push({
        start: Math.round(currentStart * 1000) / 1000,
        end: Math.round(parseFloat(endMatch[1]) * 1000) / 1000,
      });
      currentStart = null;
    }
  }

  return regions;
}

// ── Helpers ───────────────────────────────────────────────────────

/**
 * Sanitize a filename for use in storage paths.
 */
function sanitizeFilename(name: string): string {
  const base = basename(name, extname(name));
  return base.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100);
}
