/**
 * Audio extraction + transcription module.
 *
 * Flow:
 *   1. extractAudio() — FFmpeg extracts audio from video → 16kHz mono WAV
 *   2. transcribeAudio() — Uploads to AssemblyAI, polls for result
 *   3. transcribeAll() — Parallel transcription of multiple audio files
 *
 * AssemblyAI: speaker diarization, language detection, universal-3-pro model.
 */

import { existsSync, statSync, readFileSync, unlinkSync } from 'fs';
import { createWriteStream } from 'fs';
import { pipeline as streamPipeline } from 'stream/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { v4 as uuid } from 'uuid';
import { config } from '../config.js';
import type { TranscriptSegment } from '../types/index.js';

const execFileAsync = promisify(execFile);

const ASSEMBLYAI_BASE = 'https://api.assemblyai.com';

// ─── Types ──────────────────────────────────────────────────

export interface MediaFile {
  originalPath: string;
  resolvedPath: string;
  audioPath: string | null;
  type: 'video' | 'audio' | 'image';
  duration: number;
  hasAudio: boolean;
}

export interface TranscriptionResult {
  originalPath: string;
  audioPath: string;
  segments: TranscriptSegment[];
  durationSeconds: number;
  wordCount: number;
}

// ─── Audio Extraction ───────────────────────────────────────

export async function probeMedia(filePath: string): Promise<{
  type: 'video' | 'audio' | 'image';
  duration: number;
  hasAudio: boolean;
  hasVideo: boolean;
}> {
  try {
    const { stdout } = await execFileAsync(config.ffprobePath, [
      '-v', 'error',
      '-show_entries', 'format=duration:stream=codec_type',
      '-of', 'json',
      filePath,
    ]);
    const data = JSON.parse(stdout);
    const streams: string[] = (data.streams || []).map((s: any) => s.codec_type);
    const duration = parseFloat(data.format?.duration || '0');
    const hasVideo = streams.includes('video');
    const hasAudio = streams.includes('audio');

    let type: 'video' | 'audio' | 'image' = 'video';
    if (!hasVideo && hasAudio) type = 'audio';
    else if (hasVideo && !hasAudio && duration <= 0.1) type = 'image';

    return { type, duration, hasAudio, hasVideo };
  } catch (err) {
    console.warn(`[audio:probe] Failed to probe ${filePath}:`, (err as Error).message);
    return { type: 'video', duration: 0, hasAudio: false, hasVideo: true };
  }
}

export async function extractAudio(videoPath: string, tmpDir?: string): Promise<string | null> {
  const probe = await probeMedia(videoPath);
  if (!probe.hasAudio) {
    console.log(`[audio:extract] No audio stream in ${videoPath} — skipping`);
    return null;
  }

  const filename = videoPath.split('/').pop()?.replace(/\.[^.]+$/, '') || 'audio';
  const dir = tmpDir ?? '/tmp';
  const outputPath = `${dir}/mk12-audio-${filename}.wav`;

  console.log(`[audio:extract] Extracting: ${videoPath} → ${outputPath}`);

  try {
    await execFileAsync(config.ffmpegPath, [
      '-i', videoPath,
      '-vn',
      '-acodec', 'pcm_s16le',
      '-ar', '16000',
      '-ac', '1',
      '-y',
      outputPath,
    ], { timeout: 120_000 });

    const size = statSync(outputPath).size;
    console.log(`[audio:extract] Done: ${(size / 1024 / 1024).toFixed(1)} MB (${probe.duration.toFixed(1)}s)`);
    return outputPath;
  } catch (err) {
    console.error(`[audio:extract] FFmpeg failed:`, (err as Error).message);
    return null;
  }
}

export async function prepareMediaFiles(
  videoPaths: string[],
  onProgress?: (progress: number, message: string) => void,
  tmpDir?: string,
): Promise<MediaFile[]> {
  const files: MediaFile[] = [];
  const total = videoPaths.length;

  for (let i = 0; i < total; i++) {
    const originalPath = videoPaths[i];
    onProgress?.(Math.round((i / total) * 100), `Preparing ${originalPath.split('/').pop()}...`);

    const resolvedPath = await resolveMediaPath(originalPath, tmpDir);
    const probe = await probeMedia(resolvedPath);
    console.log(`[audio:prepare] ${originalPath.split('/').pop()} → type=${probe.type} dur=${probe.duration.toFixed(1)}s audio=${probe.hasAudio}`);

    let audioPath: string | null = null;
    if (probe.type === 'audio') {
      audioPath = resolvedPath;
    } else if (probe.type === 'video' && probe.hasAudio) {
      audioPath = await extractAudio(resolvedPath, tmpDir);
    }

    files.push({ originalPath, resolvedPath, audioPath, type: probe.type, duration: probe.duration, hasAudio: probe.hasAudio });
  }

  onProgress?.(100, `Prepared ${files.length} files`);
  console.log(`[audio:prepare] ${files.filter(f => f.audioPath).length}/${files.length} files have audio`);
  return files;
}

// ─── AssemblyAI Transcription ───────────────────────────────

/**
 * Upload a local audio file to AssemblyAI and return the hosted URL.
 */
async function uploadToAssemblyAI(audioPath: string, apiKey: string): Promise<string> {
  const fileBuffer = readFileSync(audioPath);
  const res = await fetch(`${ASSEMBLYAI_BASE}/v2/upload`, {
    method: 'POST',
    headers: {
      'authorization': apiKey,
      'content-type': 'application/octet-stream',
    },
    body: fileBuffer,
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`AssemblyAI upload failed (${res.status}): ${errBody}`);
  }

  const data = await res.json() as { upload_url: string };
  return data.upload_url;
}

/**
 * Transcribe a single audio file via AssemblyAI.
 * Upload → create transcript → poll → parse.
 */
export async function transcribeAudio(
  audioPath: string,
  onProgress?: (progress: number) => void,
): Promise<TranscriptSegment[]> {
  // Primary: AssemblyAI. Fallback: Deepgram.
  if (config.assemblyaiApiKey) {
    try {
      return await transcribeWithAssemblyAI(audioPath, config.assemblyaiApiKey, onProgress);
    } catch (err) {
      console.warn(`[audio] AssemblyAI failed, trying Deepgram fallback:`, (err as Error).message);
      if (config.deepgramApiKey) {
        return await transcribeWithDeepgram(audioPath, config.deepgramApiKey, onProgress);
      }
      throw err;
    }
  }
  if (config.deepgramApiKey) {
    return await transcribeWithDeepgram(audioPath, config.deepgramApiKey, onProgress);
  }
  throw new Error('No transcription API key set. Set ASSEMBLYAI_API_KEY or DEEPGRAM_API_KEY in .env');
}

async function transcribeWithAssemblyAI(
  audioPath: string,
  apiKey: string,
  onProgress?: (progress: number) => void,
): Promise<TranscriptSegment[]> {

  const fileSize = statSync(audioPath).size;
  const filename = audioPath.split('/').pop() ?? 'audio.wav';

  console.log(`[audio:assemblyai] Uploading: ${filename} (${(fileSize / 1024 / 1024).toFixed(1)} MB)`);
  onProgress?.(5);

  // Step 1: Upload audio file
  const audioUrl = await uploadToAssemblyAI(audioPath, apiKey);
  console.log(`[audio:assemblyai] Uploaded: ${audioUrl.slice(0, 60)}...`);
  onProgress?.(20);

  // Step 2: Create transcript job
  const createRes = await fetch(`${ASSEMBLYAI_BASE}/v2/transcript`, {
    method: 'POST',
    headers: {
      'authorization': apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      audio_url: audioUrl,
      language_detection: true,
      speaker_labels: true,
      auto_chapters: false,
      speech_models: ['universal-3-pro', 'universal-2'],
    }),
  });

  if (!createRes.ok) {
    const errBody = await createRes.text();
    throw new Error(`AssemblyAI transcript create failed (${createRes.status}): ${errBody}`);
  }

  const createData = await createRes.json() as { id: string; status: string };
  const transcriptId = createData.id;
  console.log(`[audio:assemblyai] Job created: ${transcriptId}`);
  onProgress?.(30);

  // Step 3: Poll for completion (3s intervals, 5 min max)
  const maxAttempts = 100;
  let attempts = 0;
  let result: any = null;

  while (attempts < maxAttempts) {
    await new Promise(r => setTimeout(r, 3000));
    attempts++;

    const pollRes = await fetch(`${ASSEMBLYAI_BASE}/v2/transcript/${transcriptId}`, {
      headers: { 'authorization': apiKey },
    });

    if (!pollRes.ok) continue;
    result = await pollRes.json();

    onProgress?.(30 + Math.min(60, attempts * 2));

    if (result.status === 'completed') {
      console.log(`[audio:assemblyai] Done after ${attempts * 3}s`);
      break;
    }
    if (result.status === 'error') {
      throw new Error(`AssemblyAI transcription failed: ${result.error}`);
    }
    // status === 'queued' or 'processing' — keep polling
  }

  if (!result || result.status !== 'completed') {
    console.warn(`[audio:assemblyai] Job ${transcriptId} timed out — returning empty`);
    return [];
  }

  onProgress?.(90);

  // Step 4: Parse result into segments
  const segments = parseAssemblyAIResult(result);

  onProgress?.(100);
  const wordCount = segments.reduce((sum, s) => sum + s.text.split(' ').length, 0);
  console.log(`[audio:assemblyai] Result: ${segments.length} segments, ${wordCount} words, ${(result.audio_duration || 0).toFixed(1)}s`);
  return segments;
}

/**
 * Transcribe multiple audio files IN PARALLEL.
 */
export async function transcribeAll(
  mediaFiles: MediaFile[],
  onProgress?: (progress: number, message: string) => void,
): Promise<Map<string, TranscriptionResult>> {
  const results = new Map<string, TranscriptionResult>();
  const filesToTranscribe = mediaFiles.filter(f => f.audioPath !== null);

  if (filesToTranscribe.length === 0) {
    console.warn('[audio:transcribeAll] No files with audio to transcribe');
    onProgress?.(100, 'No audio to transcribe');
    return results;
  }

  console.log(`[audio:transcribeAll] Transcribing ${filesToTranscribe.length} files in parallel`);
  onProgress?.(0, `Transcribing ${filesToTranscribe.length} files...`);

  // AssemblyAI handles parallel jobs fine — submit all at once
  const MAX_CONCURRENT = 5;
  let completed = 0;

  for (let i = 0; i < filesToTranscribe.length; i += MAX_CONCURRENT) {
    const batch = filesToTranscribe.slice(i, i + MAX_CONCURRENT);

    const batchResults = await Promise.allSettled(
      batch.map(async (file) => {
        const segments = await transcribeAudio(file.audioPath!);
        completed++;
        onProgress?.(Math.round((completed / filesToTranscribe.length) * 100), `Transcribed ${completed}/${filesToTranscribe.length}`);

        const wordCount = segments.reduce((sum, s) => sum + s.text.split(' ').length, 0);
        return { originalPath: file.originalPath, audioPath: file.audioPath!, segments, durationSeconds: file.duration, wordCount } as TranscriptionResult;
      })
    );

    for (const r of batchResults) {
      if (r.status === 'fulfilled') results.set(r.value.originalPath, r.value);
      else console.error(`[audio:transcribeAll] Failed:`, r.reason);
    }
  }

  // Files with no audio get empty results
  for (const file of mediaFiles) {
    if (!results.has(file.originalPath)) {
      results.set(file.originalPath, { originalPath: file.originalPath, audioPath: file.audioPath || '', segments: [], durationSeconds: file.duration, wordCount: 0 });
    }
  }

  console.log(`[audio:transcribeAll] Complete: ${results.size} files, ${completed} transcribed`);
  return results;
}

export function cleanupTempAudio(files: MediaFile[]): void {
  for (const f of files) {
    if (f.audioPath && f.audioPath.startsWith('/tmp/mk12-audio-')) {
      try { unlinkSync(f.audioPath); } catch { /* intentional: best-effort cleanup */ }
    }
  }
}

// ─── Legacy compat ──────────────────────────────────────────

export async function transcribeVideo(
  videoPath: string,
  onProgress?: (progress: number) => void,
): Promise<TranscriptSegment[]> {
  const probe = await probeMedia(videoPath);
  if (!probe.hasAudio) return [];

  onProgress?.(5);
  const audioPath = await extractAudio(videoPath);
  if (!audioPath) return [];

  onProgress?.(15);
  const segments = await transcribeAudio(audioPath, (p) => {
    onProgress?.(15 + Math.round(p * 0.85));
  });

  if (audioPath.startsWith('/tmp/mk12-audio-')) {
    try { unlinkSync(audioPath); } catch { /* intentional: best-effort cleanup */ }
  }
  return segments;
}

// ─── AssemblyAI result parser ───────────────────────────────

interface AssemblyAIUtterance {
  start: number;
  end: number;
  text: string;
  confidence: number;
  speaker: string;
  words: Array<{ text: string; start: number; end: number; confidence: number; speaker: string }>;
}

function parseAssemblyAIResult(result: any): TranscriptSegment[] {
  // Always prefer words array — gives us precise timestamps for sentence splitting
  const words: Array<{ text: string; start: number; end: number; confidence: number; speaker?: string }> = result.words || [];

  if (words.length > 0) {
    // Split by sentence boundaries using word-level timestamps
    const segments = splitWordsBySentence(words);
    console.log(`[audio:assemblyai] Parsed ${words.length} words → ${segments.length} segments`);
    return segments;
  }

  // Fallback: use utterances if words not available
  const utterances: AssemblyAIUtterance[] = result.utterances;
  if (utterances && utterances.length > 0) {
    // Split long utterances using their word arrays
    const allSegments: TranscriptSegment[] = [];
    for (const utt of utterances) {
      if (utt.words && utt.words.length > 0 && (utt.end - utt.start) > 15000) {
        // Long utterance — split by sentences using words
        const split = splitWordsBySentence(utt.words);
        for (const s of split) {
          s.speaker = utt.speaker ? `Speaker ${utt.speaker}` : undefined;
        }
        allSegments.push(...split);
      } else {
        allSegments.push({
          id: uuid(),
          start: utt.start / 1000,
          end: utt.end / 1000,
          text: utt.text,
          speaker: utt.speaker ? `Speaker ${utt.speaker}` : undefined,
          words: (utt.words || []).map(w => ({
            word: w.text, start: w.start / 1000, end: w.end / 1000, confidence: w.confidence,
          })),
        });
      }
    }
    return allSegments;
  }

  // Last fallback: split full text into sentences (no timestamps)
  const fullText: string = result.text || '';
  if (fullText.length > 0) {
    const sentences = fullText.match(/[^.!?]+[.!?]+/g) ?? [fullText];
    const duration = (result.audio_duration || 60) as number;
    const avgDur = duration / sentences.length;
    return sentences.map((s, i) => ({
      id: uuid(),
      start: i * avgDur,
      end: (i + 1) * avgDur,
      text: s.trim(),
      words: [],
    }));
  }

  return [];
}

/**
 * Split words into sentence-level segments using punctuation and time gaps.
 * Each segment is a natural sentence with precise start/end timestamps.
 */
function splitWordsBySentence(
  words: Array<{ text: string; start: number; end: number; confidence: number; speaker?: string }>
): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  let currentWords: typeof words = [];
  let currentText = '';

  for (const w of words) {
    const startSec = w.start / 1000;
    const endSec = w.end / 1000;
    currentWords.push(w);
    currentText += (currentText ? ' ' : '') + w.text;

    // Split on sentence-ending punctuation or long segments (>15s)
    const isSentenceEnd = /[.!?]$/.test(w.text);
    const segStart = currentWords[0].start / 1000;
    const tooLong = (endSec - segStart) > 15;

    if (isSentenceEnd || tooLong) {
      segments.push({
        id: uuid(),
        start: segStart,
        end: endSec,
        text: currentText.trim(),
        speaker: w.speaker ? `Speaker ${w.speaker}` : undefined,
        words: currentWords.map(cw => ({
          word: cw.text, start: cw.start / 1000, end: cw.end / 1000, confidence: cw.confidence,
        })),
      });
      currentWords = [];
      currentText = '';
    }
  }

  // Remaining words
  if (currentWords.length > 0) {
    segments.push({
      id: uuid(),
      start: currentWords[0].start / 1000,
      end: currentWords[currentWords.length - 1].end / 1000,
      text: currentText.trim(),
      speaker: currentWords[0].speaker ? `Speaker ${currentWords[0].speaker}` : undefined,
      words: currentWords.map(cw => ({
        word: cw.text, start: cw.start / 1000, end: cw.end / 1000, confidence: cw.confidence,
      })),
    });
  }

  return segments;
}

// wordsToSegments removed — replaced by splitWordsBySentence above

// ─── Deepgram fallback ──────────────────────────────────────

async function transcribeWithDeepgram(
  audioPath: string,
  apiKey: string,
  onProgress?: (progress: number) => void,
): Promise<TranscriptSegment[]> {
  const fileBuffer = readFileSync(audioPath);
  const filename = audioPath.split('/').pop() ?? 'audio.wav';

  console.log(`[audio:deepgram] Submitting: ${filename} (${(fileBuffer.length / 1024 / 1024).toFixed(1)} MB)`);
  onProgress?.(20);

  const params = new URLSearchParams({
    model: 'nova-3', smart_format: 'true', diarize: 'true',
    punctuate: 'true', utterances: 'true', utt_split: '0.8',
  });

  const res = await fetch(`https://api.deepgram.com/v1/listen?${params}`, {
    method: 'POST',
    headers: { 'Authorization': `Token ${apiKey}`, 'Content-Type': 'audio/wav' },
    body: fileBuffer,
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Deepgram failed (${res.status}): ${errBody}`);
  }

  onProgress?.(80);
  const data = await res.json() as any;

  // Parse utterances
  const utterances = data.results?.utterances;
  if (utterances && utterances.length > 0) {
    onProgress?.(100);
    return utterances.map((utt: any) => ({
      id: uuid(),
      start: utt.start,
      end: utt.end,
      text: utt.transcript,
      speaker: utt.speaker != null ? `Speaker ${utt.speaker}` : undefined,
      words: (utt.words || []).map((w: any) => ({
        word: w.punctuated_word || w.word,
        start: w.start, end: w.end, confidence: w.confidence,
      })),
    }));
  }

  // Fallback: words from first channel
  const words = data.results?.channels?.[0]?.alternatives?.[0]?.words;
  if (words && words.length > 0) {
    onProgress?.(100);
    return splitWordsBySentence(words.map((w: any) => ({
      text: w.punctuated_word || w.word,
      start: w.start * 1000, end: w.end * 1000,
      confidence: w.confidence, speaker: w.speaker?.toString(),
    })));
  }

  onProgress?.(100);
  return [];
}

// ─── Path resolution ────────────────────────────────────────

async function resolveMediaPath(mediaPath: string, tmpDir?: string): Promise<string> {
  if (existsSync(mediaPath)) return mediaPath;
  const dir = tmpDir ?? '/tmp';

  if (mediaPath.startsWith('minio://')) {
    const key = mediaPath.slice('minio://'.length);
    const { getFileStream } = await import('../services/storage-service.js');
    const tmpPath = `${dir}/mk12-media-${key.split('/').pop()}`;
    console.log(`[audio:resolve] Downloading from MinIO: ${key} → ${tmpPath}`);
    try {
      const stream = await getFileStream(key);
      await streamPipeline(stream, createWriteStream(tmpPath));
      const size = statSync(tmpPath).size;
      console.log(`[audio:resolve] Downloaded: ${(size / 1024 / 1024).toFixed(1)} MB`);
      if (size === 0) throw new Error('Downloaded file is empty');
    } catch (err) {
      console.error(`[audio:resolve] MinIO download failed for ${key}:`, (err as Error).message);
      throw new Error(`Failed to download media from MinIO: ${key} — ${(err as Error).message}`);
    }
    return tmpPath;
  }

  if (mediaPath.startsWith('http://') || mediaPath.startsWith('https://')) {
    const tmpPath = `${dir}/mk12-media-${mediaPath.split('/').pop() || 'media'}`;
    const res = await fetch(mediaPath);
    if (!res.ok) throw new Error(`Download failed: ${res.status} ${mediaPath}`);
    await streamPipeline(res.body as any, createWriteStream(tmpPath));
    return tmpPath;
  }

  const searchDirs = ['/tmp', process.cwd(), `${process.env.HOME}/Movies`, `${process.env.HOME}/Desktop`, `${process.env.HOME}/Downloads`];
  for (const dir of searchDirs) {
    const p = `${dir}/${mediaPath}`;
    if (existsSync(p)) return p;
  }

  throw new Error(`Media file not accessible: "${mediaPath}"`);
}
