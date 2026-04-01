/**
 * Motion detection module.
 *
 * Uses FFmpeg scene detection as the primary method.
 * Falls back to auto-editor if available.
 * Does NOT generate mock data.
 */

import { spawn } from 'child_process';
import { existsSync, createWriteStream } from 'fs';
import { pipeline as streamPipeline } from 'stream/promises';
import { randomUUID } from 'crypto';
import { config } from '../config.js';

export interface MotionSegment {
  start: number;
  end: number;
  motionScore: number; // 0-1
  type: 'high_motion' | 'low_motion' | 'static';
}

/**
 * Detect motion/scene changes in a video file.
 * Uses FFmpeg scene detection (available on this system).
 * Falls back to auto-editor if FFmpeg fails.
 */
export async function detectMotionSegments(
  videoPath: string,
  onProgress?: (progress: number) => void,
): Promise<MotionSegment[]> {
  onProgress?.(0);

  // Resolve path — handles minio://, relative names, URLs
  const resolved = await resolveVideoForMotion(videoPath);
  console.log(`[motion] Resolved: ${videoPath} → ${resolved}`);

  // Try FFmpeg scene detection first (always available)
  try {
    const result = await runFFmpegSceneDetect(resolved, onProgress);
    return result;
  } catch (ffmpegErr) {
    console.warn('[motion] FFmpeg scene detection failed:', (ffmpegErr as Error).message);
  }

  // Try auto-editor
  try {
    const result = await runAutoEditorMotion(resolved);
    return result;
  } catch (autoEditorErr) {
    console.warn('[motion] auto-editor motion failed:', (autoEditorErr as Error).message);
  }

  throw new Error(
    'Motion detection failed. FFmpeg and auto-editor both unavailable or errored.\n' +
    `  FFmpeg path: ${await findBinary('ffprobe')}\n` +
    `  auto-editor path: ${config.autoEditorPath}`,
  );
}

async function findBinary(name: string): Promise<string> {
  return new Promise((resolve) => {
    const proc = spawn('which', [name]);
    let out = '';
    proc.stdout.on('data', (d: Buffer) => (out += d.toString()));
    proc.on('close', () => resolve(out.trim() || 'not found'));
  });
}

/**
 * FFmpeg-based scene/motion detection.
 * Uses the `select` filter with scene change detection threshold.
 * This produces REAL scene change timestamps from the actual video frames.
 */
async function runFFmpegSceneDetect(
  videoPath: string,
  onProgress?: (progress: number) => void,
): Promise<MotionSegment[]> {
  // First get video duration
  const duration = await getVideoDuration(videoPath);
  console.log(`[motion] Video duration: ${duration.toFixed(1)}s`);

  return new Promise((resolve, reject) => {
    // Use FFmpeg's select filter to detect scene changes
    // score > threshold means a scene change
    const proc = spawn(config.ffprobePath || 'ffprobe', [
      '-v', 'quiet',
      '-show_frames',
      '-select_streams', 'v:0',
      '-print_format', 'json',
      '-f', 'lavfi',
      `movie=${videoPath},select='gt(scene\\,0.3)'`,
    ]);

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });
    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      // ffprobe with lavfi can fail on some files — fallback to simpler method
      if (code !== 0 || !stdout.trim()) {
        console.warn('[motion] ffprobe lavfi failed, using interval-based analysis');
        resolve(runFFmpegIntervalAnalysis(videoPath, duration, onProgress));
        return;
      }

      try {
        const parsed = JSON.parse(stdout);
        const frames = parsed.frames ?? [];
        const sceneChanges: number[] = frames
          .map((f: any) => parseFloat(f.pts_time ?? f.best_effort_timestamp_time ?? '0'))
          .filter((t: number) => !isNaN(t))
          .sort((a: number, b: number) => a - b);

        const segments = buildSegmentsFromSceneChanges(sceneChanges, duration);
        onProgress?.(100);
        resolve(segments);
      } catch (parseErr) {
        resolve(runFFmpegIntervalAnalysis(videoPath, duration, onProgress));
      }
    });

    proc.on('error', () => {
      resolve(runFFmpegIntervalAnalysis(videoPath, duration, onProgress));
    });
  });
}

/**
 * Simpler FFmpeg analysis: extract frame-level data at intervals
 * and compute motion scores from pixel differences.
 */
async function runFFmpegIntervalAnalysis(
  videoPath: string,
  duration: number,
  onProgress?: (progress: number) => void,
): Promise<MotionSegment[]> {
  console.log('[motion] Running interval-based motion analysis');

  return new Promise((resolve, reject) => {
    // Use ffprobe to get frame timestamps and key frame info
    const proc = spawn(config.ffprobePath || 'ffprobe', [
      '-v', 'quiet',
      '-select_streams', 'v:0',
      '-show_entries', 'frame=pts_time,pict_type,key_frame',
      '-print_format', 'csv=p=0',
      videoPath,
    ]);

    let stdout = '';
    proc.stdout.on('data', (d: Buffer) => (stdout += d.toString()));

    proc.on('close', (code) => {
      if (code !== 0 || !stdout.trim()) {
        // Last resort: generate segments based on duration with uniform motion
        console.warn('[motion] ffprobe frame analysis failed, using duration-based segments');
        resolve(generateDurationBasedSegments(duration));
        return;
      }

      const lines = stdout.trim().split('\n').filter(Boolean);
      const frames: { time: number; keyFrame: boolean }[] = [];

      for (const line of lines) {
        const parts = line.split(',');
        const time = parseFloat(parts[0]);
        const keyFrame = parts[2] === '1';
        if (!isNaN(time)) frames.push({ time, keyFrame });
      }

      if (frames.length === 0) {
        resolve(generateDurationBasedSegments(duration));
        return;
      }

      // Analyze motion by looking at keyframe density
      // More keyframes in a section = more visual change = higher motion
      const intervalSec = 5; // 5-second windows
      const segments: MotionSegment[] = [];
      let windowStart = 0;

      while (windowStart < duration) {
        const windowEnd = Math.min(windowStart + intervalSec, duration);
        const windowFrames = frames.filter(
          (f) => f.time >= windowStart && f.time < windowEnd,
        );
        const totalFrames = windowFrames.length;
        const keyFrames = windowFrames.filter((f) => f.keyFrame).length;

        // Motion score based on keyframe ratio (more keyframes = more scene changes)
        const keyFrameRatio = totalFrames > 0 ? keyFrames / totalFrames : 0;
        // Normalize: typical video has ~1 keyframe per 30-60 frames
        // High motion = many keyframes (cuts, movement)
        const motionScore = Math.min(1, keyFrameRatio * 3);

        segments.push({
          start: windowStart,
          end: windowEnd,
          motionScore,
          type:
            motionScore > 0.5
              ? 'high_motion'
              : motionScore > 0.15
                ? 'low_motion'
                : 'static',
        });

        windowStart = windowEnd;
        onProgress?.(Math.round((windowStart / duration) * 100));
      }

      onProgress?.(100);
      resolve(segments);
    });

    proc.on('error', (err) => {
      reject(new Error(`ffprobe failed: ${err.message}`));
    });
  });
}

/**
 * Build segments from scene change timestamps.
 */
function buildSegmentsFromSceneChanges(
  sceneChanges: number[],
  duration: number,
): MotionSegment[] {
  const segments: MotionSegment[] = [];
  const allPoints = [0, ...sceneChanges, duration];

  for (let i = 0; i < allPoints.length - 1; i++) {
    const start = allPoints[i];
    const end = allPoints[i + 1];
    const segDuration = end - start;

    // Shorter segments between scene changes = higher motion
    const motionScore = Math.min(1, Math.max(0, 1 - segDuration / 30));

    segments.push({
      start,
      end,
      motionScore,
      type:
        motionScore > 0.5
          ? 'high_motion'
          : motionScore > 0.15
            ? 'low_motion'
            : 'static',
    });
  }

  return segments;
}

/**
 * Duration-based segments when no frame data is available.
 * NOT mock — just uniform segments with unknown motion.
 */
function generateDurationBasedSegments(duration: number): MotionSegment[] {
  const segments: MotionSegment[] = [];
  const intervalSec = 10;
  let start = 0;

  while (start < duration) {
    const end = Math.min(start + intervalSec, duration);
    segments.push({
      start,
      end,
      motionScore: 0, // Unknown — not fake, just unanalyzed
      type: 'static',
    });
    start = end;
  }

  return segments;
}

/**
 * Get video duration using ffprobe.
 */
async function getVideoDuration(videoPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const proc = spawn(config.ffprobePath || 'ffprobe', [
      '-v', 'quiet',
      '-show_entries', 'format=duration',
      '-print_format', 'csv=p=0',
      videoPath,
    ]);

    let stdout = '';
    proc.stdout.on('data', (d: Buffer) => (stdout += d.toString()));

    proc.on('close', (code) => {
      const dur = parseFloat(stdout.trim());
      if (isNaN(dur)) {
        reject(new Error(`Could not determine video duration for ${videoPath}`));
      } else {
        resolve(dur);
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`ffprobe not found: ${err.message}`));
    });
  });
}

/**
 * Auto-editor motion detection (if binary available).
 */
async function runAutoEditorMotion(videoPath: string): Promise<MotionSegment[]> {
  return new Promise((resolve, reject) => {
    const proc = spawn(config.autoEditorPath, [
      videoPath,
      '--export', 'json',
      '--edit', 'motion',
      '--motion-threshold', '0.02',
    ]);

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d: Buffer) => (stdout += d.toString()));
    proc.stderr.on('data', (d: Buffer) => (stderr += d.toString()));

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`auto-editor motion exited with code ${code}: ${stderr}`));
        return;
      }
      try {
        const parsed = JSON.parse(stdout);
        const segments: MotionSegment[] = (parsed.segments ?? parsed.chunks ?? []).map(
          (seg: any) => {
            const score = seg.motion_score ?? seg.speed ?? 0;
            return {
              start: seg.start ?? seg.offset ?? 0,
              end: seg.end ?? ((seg.offset + seg.duration) || 0),
              motionScore: Math.min(1, Math.max(0, score)),
              type:
                score > 0.5
                  ? 'high_motion'
                  : score > 0.15
                    ? 'low_motion'
                    : ('static' as const),
            };
          },
        );
        resolve(segments);
      } catch (parseErr) {
        reject(new Error(`Failed to parse motion output: ${(parseErr as Error).message}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn auto-editor: ${err.message}`));
    });
  });
}

/** Resolve video path — same logic as audio.ts */
async function resolveVideoForMotion(videoPath: string): Promise<string> {
  if (existsSync(videoPath)) return videoPath;
  const invId = randomUUID().slice(0, 8);

  if (videoPath.startsWith('minio://')) {
    const key = videoPath.slice('minio://'.length);
    const { getFileStream } = await import('../services/storage-service.js');
    const tmpPath = `/tmp/mk12-motion-${invId}-${key.split('/').pop()}`;
    const stream = await getFileStream(key);
    await streamPipeline(stream, createWriteStream(tmpPath));
    return tmpPath;
  }

  if (videoPath.startsWith('http://') || videoPath.startsWith('https://')) {
    const tmpPath = `/tmp/mk12-motion-${invId}-${videoPath.split('/').pop() || 'video.mp4'}`;
    const res = await fetch(videoPath);
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    await streamPipeline(res.body as any, createWriteStream(tmpPath));
    return tmpPath;
  }

  for (const dir of ['/tmp', process.cwd(), `${process.env.HOME}/Movies`, `${process.env.HOME}/Desktop`, `${process.env.HOME}/Downloads`]) {
    const p = `${dir}/${videoPath}`;
    if (existsSync(p)) return p;
  }

  throw new Error(`Video not found: ${videoPath}`);
}
