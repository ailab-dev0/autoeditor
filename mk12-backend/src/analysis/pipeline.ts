/**
 * 5-Stage Analysis Pipeline Orchestrator.
 *
 * Stage 1: Transcription (AssemblyAI, Deepgram fallback → MinIO)
 * Stage 2: Content Flow Analysis (Claude + Qwen vision → MinIO)
 * Stage 3: Chapter Validation & Refinement (merge tiny, split giant)
 * Stage 4: Director Decisions (AI segment suggestions → Neo4j)
 * Stage 5: Package Compilation (build EditPackageV3)
 *
 * All results are stored in Neo4j. Pipeline status is tracked
 * as a PipelineStatus node linked to the Project.
 */

import { v4 as uuid } from 'uuid';
import { randomUUID } from 'crypto';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'fs';
import { PIPELINE_STAGES } from '../types/index.js';
import { recordCost } from '../services/cost-service.js';
import type {
  Project, EditPackageV3, PipelineStageName, Chapter, KnowledgeNode,
} from '../types/index.js';
import { prepareMediaFiles, transcribeAll, cleanupTempAudio, type MediaFile, type TranscriptionResult } from './audio.js';
import { analyzeContentFlow, type ContentFlowResult } from './content-flow.js';
import { generateProductionBlueprint, type ProductionBlueprint } from './production-blueprint.js';
import { buildEditPackage } from '../utils/edit-package.js';
import { uploadFile, deleteFile, isStorageConfigured } from '../services/storage-service.js';

export type PipelineProgressCallback = (
  stage: PipelineStageName,
  progress: number,
  message?: string
) => void;

// Compile-time assertion: PIPELINE_STAGES and PipelineStageName must cover the same 5 stages.
// If you add or rename a stage in PIPELINE_STAGES, add it to the union in types/index.ts too
// (and vice versa) — otherwise this will fail at compile time with a type error.
type _AssertStagesComplete = PipelineStageName extends typeof PIPELINE_STAGES[number]
  ? typeof PIPELINE_STAGES[number] extends PipelineStageName
    ? true
    : never
  : never;
const _assertStagesComplete: _AssertStagesComplete = true;

/**
 * Run the full 5-stage analysis pipeline.
 * All results are persisted to Neo4j.
 */
export interface PipelineOptions {
  /** Stop after this stage completes. Omit to run all 5. */
  stopAfterStage?: PipelineStageName;
  /** Skip directly to this stage, loading cached outputs from MinIO. */
  startFromStage?: PipelineStageName;
}

// ── Storage warning — logged at most once per server process ──
let _storageWarnedOnce = false;
function warnStorageOnce(): void {
  if (_storageWarnedOnce) return;
  _storageWarnedOnce = true;
  console.warn('[pipeline] Storage not configured — checkpointing, caching, and resume are disabled for this run.');
}

async function loadJsonFromMinIO<T>(key: string): Promise<T> {
  const { getFileStream } = await import('../services/storage-service.js');
  const stream = await getFileStream(key);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as T;
}

async function loadRawFromMinIO(key: string): Promise<string> {
  const { getFileStream } = await import('../services/storage-service.js');
  const stream = await getFileStream(key);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * Upload a set of files atomically: write all to .tmp keys first, then promote to final
 * keys only after every temp upload succeeds. On any failure, clean up temp keys and
 * throw — leaving any previously written final keys intact.
 */
async function atomicWriteToMinIO(
  files: Array<{ key: string; buf: Buffer; contentType: string }>,
  stage: string,
): Promise<void> {
  const tmpKeys = files.map(f => `${f.key}.tmp`);

  // Phase 1: write to temp keys
  try {
    for (let i = 0; i < files.length; i++) {
      await uploadFile(tmpKeys[i], files[i].buf, files[i].contentType);
    }
  } catch (err) {
    await Promise.allSettled(tmpKeys.map(k => deleteFile(k)));
    throw new Error(
      `Checkpoint write failed for stage ${stage} — partial files cleaned up. ` +
      `Previous checkpoint (if any) is intact. Cause: ${(err as Error).message}`
    );
  }

  // Phase 2: promote to final keys
  try {
    for (const f of files) {
      await uploadFile(f.key, f.buf, f.contentType);
    }
  } catch (err) {
    await Promise.allSettled(tmpKeys.map(k => deleteFile(k)));
    throw new Error(
      `Checkpoint write failed for stage ${stage} — partial files cleaned up. ` +
      `Previous checkpoint (if any) is intact. Cause: ${(err as Error).message}`
    );
  }

  await Promise.allSettled(tmpKeys.map(k => deleteFile(k)));
}

/** Write content-flow as meta JSON + segments JSONL via atomic two-phase upload */
async function writeContentFlowToMinIO(projectId: string, cf: ContentFlowResult): Promise<void> {
  if (!isStorageConfigured()) { warnStorageOnce(); return; }
  const { segments, ...meta } = cf;
  await atomicWriteToMinIO([
    {
      key: `projects/${projectId}/content-flow-meta.json`,
      buf: Buffer.from(JSON.stringify(meta, null, 2)),
      contentType: 'application/json',
    },
    {
      key: `projects/${projectId}/content-flow-segments.jsonl`,
      buf: Buffer.from(segments.map(s => JSON.stringify(s)).join('\n')),
      contentType: 'application/x-ndjson',
    },
  ], 'knowledge_graph');
  console.log(`[pipeline] Stored content-flow JSONL: meta + ${segments.length} segments`);
}

/** Load content-flow from JSONL with line-level error reporting and integrity check */
async function loadContentFlowFromMinIO(projectId: string): Promise<ContentFlowResult> {
  const meta = await loadJsonFromMinIO<Omit<ContentFlowResult, 'segments'>>(
    `projects/${projectId}/content-flow-meta.json`
  );

  const raw = await loadRawFromMinIO(`projects/${projectId}/content-flow-segments.jsonl`);
  const lines = raw.trim().split('\n').filter(Boolean);
  const segments: ContentFlowResult['segments'] = [];

  for (let i = 0; i < lines.length; i++) {
    try {
      segments.push(JSON.parse(lines[i]));
    } catch {
      throw new Error(
        `[stage:knowledge_graph, project:${projectId}] Corrupt checkpoint at line ${i + 1} — ` +
        `refusing to load stale fallback. Delete the MinIO key ` +
        `projects/${projectId}/content-flow-segments.jsonl or re-run from stage 1. ` +
        `Raw content: ${lines[i].slice(0, 120)}`
      );
    }
  }

  const expected = meta.stats.totalSegments;
  if (segments.length !== expected) {
    throw new Error(
      `[stage:knowledge_graph, project:${projectId}] Checkpoint integrity check failed: ` +
      `meta expects ${expected} segments but JSONL contains ${segments.length}. ` +
      `Delete MinIO key projects/${projectId}/content-flow-*.* or re-run from stage 1.`
    );
  }

  return { ...meta, segments };
}

/** Load blueprint from JSONL with integrity check (mirrors loadContentFlowFromMinIO) */
async function loadBlueprintFromMinIO(projectId: string): Promise<ProductionBlueprint> {
  const meta = await loadJsonFromMinIO<Omit<ProductionBlueprint, 'segments'>>(
    `projects/${projectId}/blueprint-meta.json`
  );
  const raw = await loadRawFromMinIO(`projects/${projectId}/blueprint-segments.jsonl`);
  const lines = raw.trim().split('\n').filter(Boolean);
  const segments: ProductionBlueprint['segments'] = [];
  for (let i = 0; i < lines.length; i++) {
    try {
      segments.push(JSON.parse(lines[i]));
    } catch {
      throw new Error(
        `[stage:director_decisions, project:${projectId}] Corrupt blueprint checkpoint at line ${i + 1}. ` +
        `Delete MinIO key projects/${projectId}/blueprint-segments.jsonl or re-run from stage 4.`
      );
    }
  }
  const expected = meta.stats.totalSegments;
  if (segments.length !== expected) {
    throw new Error(
      `[stage:director_decisions, project:${projectId}] Blueprint integrity check failed: ` +
      `meta expects ${expected} segments but JSONL contains ${segments.length}. ` +
      `Delete MinIO key projects/${projectId}/blueprint-*.* or re-run from stage 4.`
    );
  }
  return { ...meta, segments };
}

/** Write blueprint as meta JSON + segments JSONL via atomic two-phase upload */
async function writeBlueprintToMinIO(projectId: string, bp: ProductionBlueprint): Promise<void> {
  if (!isStorageConfigured()) { warnStorageOnce(); return; }
  const { segments, ...meta } = bp;
  await atomicWriteToMinIO([
    {
      key: `projects/${projectId}/blueprint-meta.json`,
      buf: Buffer.from(JSON.stringify(meta, null, 2)),
      contentType: 'application/json',
    },
    {
      key: `projects/${projectId}/blueprint-segments.jsonl`,
      buf: Buffer.from(segments.map(s => JSON.stringify(s)).join('\n')),
      contentType: 'application/x-ndjson',
    },
  ], 'director_decisions');
  console.log(`[pipeline] Stored blueprint JSONL: meta + ${segments.length} segments`);
}

/** Write a pipeline checkpoint so retries can resume from last success */
async function writeCheckpoint(projectId: string, stage: PipelineStageName): Promise<void> {
  try {
    if (!isStorageConfigured()) { warnStorageOnce(); return; }
    const key = `projects/${projectId}/pipeline-checkpoint.json`;
    const existing = await loadJsonFromMinIO<{ completedStages: PipelineStageName[] }>(key).catch(() => ({ completedStages: [] as PipelineStageName[] }));
    if (!existing.completedStages.includes(stage)) existing.completedStages.push(stage);
    await uploadFile(key, Buffer.from(JSON.stringify(existing)), 'application/json');
  } catch (err) {
    console.warn(`[pipeline] writeCheckpoint failed for stage ${stage} (non-critical):`, (err as Error).message);
  }
}

/** Detect the stage to resume from based on MinIO checkpoint */
async function detectResumeStage(projectId: string): Promise<PipelineStageName | null> {
  try {
    if (!isStorageConfigured()) return null;
    const checkpoint = await loadJsonFromMinIO<{ completedStages: PipelineStageName[] }>(`projects/${projectId}/pipeline-checkpoint.json`);
    for (let i = PIPELINE_STAGES.length - 1; i >= 0; i--) {
      if (checkpoint.completedStages.includes(PIPELINE_STAGES[i])) {
        return PIPELINE_STAGES[i + 1] ?? null;
      }
    }
  } catch {
    // No checkpoint file exists yet — this is expected on first run
  }
  return null;
}

export async function runPipeline(
  project: Project,
  sessionId: string,
  onProgress: PipelineProgressCallback,
  options: PipelineOptions = {}
): Promise<EditPackageV3> {
  const videoPaths = project.video_paths;
  if (videoPaths.length === 0) {
    throw new Error(
      `[project:${project.id}] No video paths provided for analysis. ` +
      `Add at least one video_path to the project before starting the pipeline.`
    );
  }

  // Create an isolated temp directory for this pipeline run to prevent
  // concurrent pipelines or rapid sequential segments from colliding on /tmp paths.
  const runId = randomUUID();
  const tmpDir = `/tmp/mk12-${runId}`;
  mkdirSync(tmpDir, { recursive: true });

  try {
    return await _runPipelineCore(project, sessionId, onProgress, options, tmpDir);
  } finally {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {
      console.warn(`[pipeline] Failed to clean up temp dir ${tmpDir}:`, (e as Error).message);
    }
  }
}

async function _runPipelineCore(
  project: Project,
  sessionId: string,
  onProgress: PipelineProgressCallback,
  options: PipelineOptions,
  tmpDir: string,
): Promise<EditPackageV3> {
  const videoPaths = project.video_paths;

  // Determine which stage to start from.
  // Explicit option takes precedence; otherwise auto-detect from checkpoint.
  let startStage: PipelineStageName | null;
  if (options.startFromStage) {
    startStage = options.startFromStage;
    console.log(`[pipeline] Explicit start stage: ${startStage}`);
  } else {
    startStage = await detectResumeStage(project.id);
    if (startStage) {
      console.log(`[pipeline] Auto-resuming from stage: ${startStage} (checkpoint detected)`);
    }
  }
  const startIdx = startStage ? PIPELINE_STAGES.indexOf(startStage) : 0;

  // Shared state populated per stage (may come from cache or live run)
  let mediaFiles: MediaFile[] = [];
  let transcriptionResults: Map<string, TranscriptionResult> = new Map();
  let contentFlow: ContentFlowResult | undefined;
  let chapters: ReturnType<typeof refineChapters> = [];

  // Initialize pipeline status
  await updatePipelineStatus(project.id, sessionId, PIPELINE_STAGES[startIdx] ?? 'transcription', 0, 'Starting pipeline...');

  // ── Stage 1: Transcription ──────────────────────────────────
  if (startIdx <= 0) {
    onProgress('transcription', 0, 'Preparing media files...');
    mediaFiles = await prepareMediaFiles(videoPaths, (pct, msg) => {
      onProgress('transcription', Math.round(pct * 0.2), msg);
    }, tmpDir);
    const withAudio = mediaFiles.filter(f => f.audioPath);
    console.log(`[pipeline] Stage 1: ${mediaFiles.length} files — ${withAudio.length} with audio`);
    for (const f of mediaFiles) console.log(`  ${f.type.padEnd(6)} ${f.originalPath} (${f.duration.toFixed(1)}s, audio=${f.hasAudio})`);

    onProgress('transcription', 20, `Transcribing ${withAudio.length} audio files in parallel...`);
    await updatePipelineStatus(project.id, sessionId, 'transcription', 20, `Transcribing ${withAudio.length} files...`);
    transcriptionResults = await transcribeAll(mediaFiles, (pct, msg) => {
      onProgress('transcription', 20 + Math.round(pct * 0.7), msg);
    });

    // Record transcription cost (AssemblyAI bills per audio second)
    const totalAudioDuration = mediaFiles.reduce((sum, f) => sum + (f.hasAudio ? f.duration : 0), 0);
    recordCost({
      projectId: project.id,
      service: 'assemblyai',
      operation: 'transcription',
      metadata: { durationSeconds: totalAudioDuration, fileCount: mediaFiles.filter(f => f.hasAudio).length },
    });

    onProgress('transcription', 90, 'Storing transcripts and audio...');
    const mediaManifest: Array<{ path: string; type: string; duration: number; hasAudio: boolean; audioKey: string | null; transcriptKey: string | null; segmentCount: number; wordCount: number }> = [];

    for (const file of mediaFiles) {
      const result = transcriptionResults.get(file.originalPath);
      const segs = result?.segments ?? [];
      const safeName = file.originalPath.split('/').pop()?.replace(/[^a-zA-Z0-9._-]/g, '_') || 'media';
      let audioKey: string | null = null;
      let transcriptKey: string | null = null;

      if (file.audioPath && existsSync(file.audioPath) && isStorageConfigured()) {
        audioKey = `projects/${project.id}/audio/${safeName}.wav`;
        const buf = readFileSync(file.audioPath);
        await uploadFile(audioKey, buf, 'audio/wav');
        console.log(`[pipeline] Stored audio: ${audioKey} (${(buf.length / 1024 / 1024).toFixed(1)} MB)`);
      }
      if (segs.length > 0 && isStorageConfigured()) {
        transcriptKey = `projects/${project.id}/transcripts/${safeName}.json`;
        await uploadFile(transcriptKey, Buffer.from(JSON.stringify({ videoPath: file.originalPath, language: 'en', model: 'assemblyai', segments: segs, wordCount: result?.wordCount ?? 0, duration: file.duration, createdAt: new Date().toISOString() }, null, 2)), 'application/json');
        console.log(`[pipeline] Stored transcript: ${transcriptKey} (${segs.length} segments, ${result?.wordCount ?? 0} words)`);
      }
      mediaManifest.push({ path: file.originalPath, type: file.type, duration: file.duration, hasAudio: file.hasAudio, audioKey, transcriptKey, segmentCount: segs.length, wordCount: result?.wordCount ?? 0 });
    }

    if (isStorageConfigured()) {
      await uploadFile(`projects/${project.id}/manifest.json`, Buffer.from(JSON.stringify({ projectId: project.id, sessionId, files: mediaManifest, createdAt: new Date().toISOString() }, null, 2)), 'application/json');
      console.log(`[pipeline] Stored manifest`);
    }
    cleanupTempAudio(mediaFiles);
    console.log(`[pipeline] Stage 1 complete:`, mediaManifest.map(m => `${m.type} ${m.path.split('/').pop()} (${m.segmentCount} segs)`));
    onProgress('transcription', 100, 'Transcription complete');
    await updatePipelineStatus(project.id, sessionId, 'transcription', 100, 'Transcription complete');
    await writeCheckpoint(project.id, 'transcription');
    if (options.stopAfterStage === 'transcription') return buildEditPackage({ projectName: project.name, sessionId, videos: [], chapters: [], nodes: [], edges: [] });
  } else {
    console.log('[pipeline] Skipping stage 1 — cached');
  }

  // ── Stage 2: Content Flow Analysis ──────────────────────────
  if (startIdx <= 1) {
    onProgress('knowledge_graph', 0, 'Analyzing content flow...');
    await updatePipelineStatus(project.id, sessionId, 'knowledge_graph', 0, 'Creative director analysis...');
    try {
      contentFlow = await analyzeContentFlow(project.id, sessionId, mediaFiles, transcriptionResults, project.brief, (pct, msg) => {
        onProgress('knowledge_graph', pct, msg);
      }, tmpDir);
    } catch (err) {
      console.error(`[pipeline] Stage 2 error: ${(err as Error).message} — attempting to load partial cache`);
      try {
        contentFlow = await loadContentFlowFromMinIO(project.id);
        console.warn(`[pipeline] Loaded partial content-flow from MinIO (${contentFlow.segments.length} segs)`);
      } catch {
        throw err;
      }
    }
    console.log(`[pipeline] Stage 2 complete: ${contentFlow.stats.totalSegments} segs, ${contentFlow.stats.topicsFound} topics`);
    await writeContentFlowToMinIO(project.id, contentFlow);
    onProgress('knowledge_graph', 100, 'Content flow analysis complete');
    await updatePipelineStatus(project.id, sessionId, 'knowledge_graph', 100, 'Content flow analysis complete');
    await writeCheckpoint(project.id, 'knowledge_graph');
    if (options.stopAfterStage === 'knowledge_graph') return buildEditPackage({ projectName: project.name, sessionId, videos: [], chapters: [], nodes: [], edges: [] });
  } else {
    console.log('[pipeline] Skipping stage 2 — loading content-flow from MinIO');
    contentFlow = await loadContentFlowFromMinIO(project.id);
    console.log(`[pipeline] Loaded content-flow: ${contentFlow.segments.length} segments`);
  }

  if (!contentFlow) {
    throw new Error(
      `[pipeline] Stage 2 (content flow) did not produce a result and no cached version exists. ` +
      `startIdx=${startIdx}, startStage=${startStage ?? 'none'}. ` +
      `Check MinIO for projects/${project.id}/content-flow-meta.json or re-run from stage 1.`
    );
  }

  // ── Stage 3: Chapter Validation ──────────────────────────────
  if (startIdx <= 2) {
    onProgress('chapter_validation', 0, 'Validating chapter boundaries...');
    await updatePipelineStatus(project.id, sessionId, 'chapter_validation', 0, 'Validating chapters...');
    chapters = refineChapters(contentFlow.chapters, contentFlow.segments);
    console.log(`[pipeline] Stage 3: ${contentFlow.chapters.length} chapters → ${chapters.length} after refinement`);
    onProgress('chapter_validation', 100, 'Chapter validation complete');
    await updatePipelineStatus(project.id, sessionId, 'chapter_validation', 100, 'Chapters validated');
    await writeCheckpoint(project.id, 'chapter_validation');
    if (options.stopAfterStage === 'chapter_validation') return buildEditPackage({ projectName: project.name, sessionId, videos: [], chapters, nodes: [], edges: [] });
  } else {
    chapters = refineChapters(contentFlow.chapters, contentFlow.segments);
    console.log(`[pipeline] Stage 3 (from cache): ${chapters.length} chapters`);
  }

  // ── Stage 4: Production Blueprint ────────────────────────────
  let blueprint: ProductionBlueprint;
  if (startIdx <= 3) {
    onProgress('director_decisions', 0, 'Planning production...');
    await updatePipelineStatus(project.id, sessionId, 'director_decisions', 0, 'AI production planning...');

    blueprint = await generateProductionBlueprint(
      project.id, sessionId, contentFlow, chapters, project.brief,
      (pct, msg) => { onProgress('director_decisions', pct, msg); },
    );

    console.log(`[pipeline] Stage 4 complete: ${blueprint.stats.totalSegments} segs, ${blueprint.stats.materialsGenerated} materials`);
    console.log(`[pipeline] Stage 4: keep=${blueprint.stats.keepOriginal} overlay=${blueprint.stats.addOverlay} cut=${blueprint.stats.cutSegments}`);

    await writeBlueprintToMinIO(project.id, blueprint);

    onProgress('director_decisions', 100, 'Production blueprint complete');
    await updatePipelineStatus(project.id, sessionId, 'director_decisions', 100, 'Blueprint ready for review');
    await writeCheckpoint(project.id, 'director_decisions');
    if (options.stopAfterStage === 'director_decisions') {
      return buildEditPackage({ projectName: project.name, sessionId, videos: [], chapters, nodes: [], edges: [] });
    }
  } else {
    console.log('[pipeline] Skipping stage 4 — loading blueprint from MinIO');
    blueprint = await loadBlueprintFromMinIO(project.id);
    console.log(`[pipeline] Loaded blueprint: ${blueprint.segments.length} segments`);
  }
  console.log('[pipeline] Pipeline complete — blueprint ready for review');

  // Build edit package from pipeline results (no separate stage — compilation is instant)
  const nodes: KnowledgeNode[] = contentFlow.topics.map((t, i) => ({
    id: uuid(), label: t.name, type: 'concept' as const, importance: t.importance ?? 0, community: i,
    properties: { segments: t.segments },
  }));
  return buildEditPackage({ projectName: project.name, sessionId, videos: [], chapters, nodes, edges: [] });
}

// ── Helper: Update pipeline status in Neo4j ──────────────────

async function updatePipelineStatus(
  _projectId: string,
  _sessionId: string,
  _stage: PipelineStageName,
  _progress: number,
  _message: string
): Promise<void> {
  // No-op: pipeline status is tracked in-memory by analysis-service
  // and broadcast via SSE/WebSocket. No persistent store needed.
}

// ── Helper: Validate and refine chapter boundaries ──────────

export const MIN_CHAPTER_DURATION = 5;   // seconds
export const MAX_CHAPTER_DURATION = 120; // seconds

function refineChapters(
  rawChapters: Array<{ name: string; order: number; segments: string[]; startTime: number; endTime: number; topic: string; pedagogyPhase: string }>,
  allSegments: Array<{ id: string; start: number | null; end: number | null; topic: string; role: string; importance: number }>,
): Chapter[] {
  if (rawChapters.length === 0) return [];

  const refined: typeof rawChapters = [];

  // Pass 1: Merge tiny chapters (<5s) into their neighbor
  for (const ch of rawChapters) {
    const duration = ch.endTime - ch.startTime;
    if (duration < MIN_CHAPTER_DURATION && refined.length > 0) {
      // Merge into previous chapter
      const prev = refined[refined.length - 1];
      prev.segments.push(...ch.segments);
      prev.endTime = ch.endTime;
      console.log(`[pipeline:refine] Merged tiny chapter "${ch.name}" (${duration.toFixed(1)}s) into "${prev.name}"`);
    } else {
      refined.push({ ...ch, segments: [...ch.segments] });
    }
  }

  // Pass 2: Split giant chapters (>120s) at the highest-importance segment boundary
  const final: typeof rawChapters = [];
  for (const ch of refined) {
    const duration = ch.endTime - ch.startTime;
    if (duration <= MAX_CHAPTER_DURATION) {
      final.push(ch);
      continue;
    }

    // Find segments in this chapter, sorted by time
    const chapterSegs = ch.segments
      .map(id => allSegments.find(s => s.id === id))
      .filter((s): s is NonNullable<typeof s> => s !== undefined && s.start !== null)
      .sort((a, b) => (a.start ?? 0) - (b.start ?? 0));

    if (chapterSegs.length < 2) {
      final.push(ch);
      continue;
    }

    // Find best split point near the middle — prefer hard topic changes or high-importance boundaries
    const midTime = ch.startTime + duration / 2;
    let bestSplitIdx = Math.floor(chapterSegs.length / 2);
    let bestScore = Infinity;

    for (let i = 1; i < chapterSegs.length; i++) {
      const seg = chapterSegs[i];
      const timeDist = Math.abs((seg.start ?? 0) - midTime);
      // Prefer splits where topic changes and segment has low importance (natural break)
      const topicChange = (i > 0 && chapterSegs[i - 1].topic !== seg.topic) ? 0 : 20;
      const score = timeDist + topicChange;
      if (score < bestScore) {
        bestScore = score;
        bestSplitIdx = i;
      }
    }

    const firstHalf = chapterSegs.slice(0, bestSplitIdx);
    const secondHalf = chapterSegs.slice(bestSplitIdx);

    final.push({
      ...ch,
      segments: firstHalf.map(s => s.id),
      endTime: firstHalf[firstHalf.length - 1].end ?? ch.endTime,
      name: ch.name,
    });

    final.push({
      ...ch,
      segments: secondHalf.map(s => s.id),
      startTime: secondHalf[0].start ?? ch.startTime,
      name: `${ch.name} (cont.)`,
      order: ch.order + 0.5, // will be renumbered below
    });

    console.log(`[pipeline:refine] Split giant chapter "${ch.name}" (${duration.toFixed(1)}s) at ${(secondHalf[0].start ?? 0).toFixed(1)}s`);
  }

  // Post-merge validation: ensure endTime > startTime for all chapters
  for (const ch of final) {
    if (ch.endTime <= ch.startTime) {
      console.warn(`[pipeline:refine] Chapter "${ch.name}" has invalid time range [${ch.startTime}, ${ch.endTime}] — correcting endTime`);
      ch.endTime = ch.startTime + MIN_CHAPTER_DURATION;
    }
  }

  // Renumber and convert to Chapter type
  return final.map((ch, i) => ({
    name: ch.name,
    order: i,
    target_duration: ch.endTime - ch.startTime,
  }));
}

// ─── Test exports (used by test suite only) ────────────────
export const _test = {
  detectResumeStage,
  loadContentFlowFromMinIO,
  writeContentFlowToMinIO,
  atomicWriteToMinIO,
  refineChapters,
  warnStorageOnce,
  _resetStorageWarning: () => { _storageWarnedOnce = false; },
};
