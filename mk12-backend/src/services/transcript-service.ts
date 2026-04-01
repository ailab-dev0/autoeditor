/**
 * Transcript storage and export service.
 *
 * All transcript data is read from MinIO.
 * Write operations are no-ops — the pipeline stores to MinIO directly.
 */

import { v4 as uuid } from 'uuid';
import type { TranscriptVersion, TranscriptSegment } from '../types/index.js';

/**
 * Store a transcript version for a project.
 * No-op: the pipeline stores transcripts directly to MinIO.
 */
export async function addTranscript(
  _projectId: string,
  _videoPath: string,
  _segments: TranscriptSegment[],
  _language: string = 'en',
  _model: string = 'whisper-large-v3'
): Promise<TranscriptVersion> {
  return {
    id: uuid(),
    project_id: _projectId,
    video_path: _videoPath,
    segments: _segments,
    language: _language,
    model: _model,
    created_at: new Date().toISOString(),
  };
}

/**
 * Get all transcript versions for a project.
 */
export async function getTranscripts(projectId: string): Promise<TranscriptVersion[]> {
  return getTranscriptsFromMinIO(projectId);
}

/**
 * Get the latest transcript for a specific video in a project.
 */
export async function getLatestTranscript(projectId: string, videoPath?: string): Promise<TranscriptVersion | undefined> {
  const transcripts = await getTranscriptsFromMinIO(projectId);
  if (videoPath) {
    return transcripts.find(t => t.video_path === videoPath) ?? transcripts[0];
  }
  return transcripts[0];
}

/**
 * Export transcript as plain text.
 */
export function exportAsText(transcript: TranscriptVersion): string {
  return transcript.segments
    .map((seg) => seg.text)
    .join(' ');
}

/**
 * Export transcript as SRT subtitle format.
 */
export function exportAsSRT(transcript: TranscriptVersion): string {
  return transcript.segments
    .map((seg, i) => {
      const startTC = formatSRTTime(seg.start);
      const endTC = formatSRTTime(seg.end);
      return `${i + 1}\n${startTC} --> ${endTC}\n${seg.text}\n`;
    })
    .join('\n');
}

/**
 * Export transcript as VTT subtitle format.
 */
export function exportAsVTT(transcript: TranscriptVersion): string {
  const header = 'WEBVTT\n\n';
  const cues = transcript.segments
    .map((seg) => {
      const startTC = formatVTTTime(seg.start);
      const endTC = formatVTTTime(seg.end);
      return `${startTC} --> ${endTC}\n${seg.text}\n`;
    })
    .join('\n');

  return header + cues;
}

/**
 * Export transcript as JSON.
 */
export function exportAsJSON(transcript: TranscriptVersion): string {
  return JSON.stringify(transcript, null, 2);
}

// ── Helpers ──────────────────────────────────────────────────────

function formatSRTTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${pad2(h)}:${pad2(m)}:${pad2(s)},${pad3(ms)}`;
}

function formatVTTTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}.${pad3(ms)}`;
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function pad3(n: number): string {
  return n.toString().padStart(3, '0');
}

/**
 * Load transcripts from MinIO.
 * Reads the manifest to find transcript files, then loads each one.
 */
async function getTranscriptsFromMinIO(projectId: string): Promise<TranscriptVersion[]> {
  try {
    const { isStorageConfigured, getFileStream } = await import('./storage-service.js');
    if (!isStorageConfigured()) return [];

    // Load manifest to find transcript keys
    const manifestStream = await getFileStream(`projects/${projectId}/manifest.json`);
    const manifestChunks: Buffer[] = [];
    for await (const chunk of manifestStream) manifestChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    const manifest = JSON.parse(Buffer.concat(manifestChunks).toString('utf8'));

    const files: Array<{ path: string; transcriptKey: string | null }> = manifest.files ?? [];
    const transcripts: TranscriptVersion[] = [];

    for (const f of files) {
      if (!f.transcriptKey) continue;
      try {
        const stream = await getFileStream(f.transcriptKey);
        const chunks: Buffer[] = [];
        for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));

        const segments: TranscriptSegment[] = (data.segments ?? []).map((s: any) => ({
          id: s.id ?? uuid(),
          start: s.start ?? 0,
          end: s.end ?? 0,
          text: s.text ?? '',
          words: (s.words ?? []).map((w: any) => ({
            word: w.word ?? w.text ?? '',
            start: w.start ?? 0,
            end: w.end ?? 0,
            confidence: w.confidence ?? 1,
          })),
          speaker: s.speaker ?? undefined,
        }));

        transcripts.push({
          id: `minio-${f.transcriptKey}`,
          project_id: projectId,
          video_path: data.videoPath ?? f.path,
          segments,
          language: data.language ?? 'en',
          model: data.model ?? 'unknown',
          created_at: data.createdAt ?? new Date().toISOString(),
        });
      } catch (err) {
        console.warn(`[transcript] Failed to load ${f.transcriptKey}:`, (err as Error).message);
      }
    }

    return transcripts;
  } catch {
    return [];
  }
}
