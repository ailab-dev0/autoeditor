/**
 * Stage 2: Content Flow Analysis — Creative Director's Mind
 *
 * Builds a unified content timeline across all media:
 *   - Segment-level analysis (topic, role, importance, pedagogy)
 *   - Cross-media linking (which audio goes with which video)
 *   - Pedagogical flow mapping (hook → problem → solution → example → recap)
 *   - Per-second heatmap of content importance
 *   - Hard cut detection and continuity tracking
 *
 * Uses Claude for transcript analysis, Qwen 3.5 for visual ambiguity resolution.
 */

import { v4 as uuid } from 'uuid';
import { config } from '../config.js';
import { recordCost, extractOpenRouterUsage } from '../services/cost-service.js';
import type { TranscriptSegment } from '../types/index.js';
import type { MediaFile, TranscriptionResult } from './audio.js';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { readFileSync, existsSync, unlinkSync, statSync } from 'fs';

const execFileAsync = promisify(execFile);

// ─── Output types ───────────────────────────────────────────

export interface ContentSegment {
  id: string;
  /** Source media file path */
  mediaPath: string;
  mediaType: 'video' | 'audio' | 'image';
  /** Time range in source file (null for images) */
  start: number | null;
  end: number | null;
  /** Transcript text for this segment (empty if no speech) */
  text: string;
  /** What this segment is about */
  topic: string;
  /** Creative role in the edit */
  role: 'hook' | 'intro' | 'core' | 'example' | 'deep-dive' | 'tangent' | 'filler' | 'recap' | 'transition' | 'aside' | 'ambient' | 'visual-aid' | 'b-roll';
  /** 1-5 importance to the final edit */
  importance: number;
  /** Pedagogical function */
  pedagogy: string;
  /** ID of segment this continues from (narrative flow) */
  continues_from: string | null;
  /** ID of segment this repeats/is redundant with */
  redundant_with: string | null;
  /** Visual scene type (filled by vision model for low-confidence segments) */
  visual_scene: string | null;
  /** Director's confidence in this analysis (0-1) */
  confidence: number;
  /** Hard cut: should this be a cut point? */
  hard_cut_before: boolean;
  /** Suggested placement for cross-media (e.g., "overlay on seg-3") */
  placement: string | null;
}

export interface ContentTopic {
  name: string;
  segments: string[];
  importance: number;
  pedagogyRole: string;
}

export interface ContentChapter {
  name: string;
  order: number;
  segments: string[];
  startTime: number;
  endTime: number;
  topic: string;
  pedagogyPhase: string;
}

export interface HeatmapPoint {
  time: number;
  importance: number;
  topic: string;
  role: string;
  mediaPath: string;
}

export interface ContentFlowResult {
  projectId: string;
  sessionId: string;
  /** All segments across all media, unified */
  segments: ContentSegment[];
  /** Topic clusters */
  topics: ContentTopic[];
  /** Chapter structure */
  chapters: ContentChapter[];
  /** Per-second heatmap */
  heatmap: HeatmapPoint[];
  /** Cross-media placement suggestions */
  crossMediaLinks: Array<{
    sourceSegment: string;
    targetSegment: string;
    relationship: 'overlays' | 'illustrates' | 'replaces' | 'accompanies';
    reason: string;
  }>;
  /** Summary stats */
  stats: {
    totalDuration: number;
    totalSegments: number;
    mediaFiles: number;
    topicsFound: number;
    chaptersFound: number;
    cutCandidates: number;
    keepCandidates: number;
  };
  createdAt: string;
}

// ─── Image analysis via Qwen 3.5 ────────────────────────────

async function analyzeImage(imagePath: string): Promise<string> {
  if (!config.openrouterApiKey) return '';

  try {
    const resolved = existsSync(imagePath) ? imagePath : '';
    if (!resolved) return '';

    const fileSize = statSync(resolved).size;
    if (fileSize > 20 * 1024 * 1024) {
      console.log(`[content-flow:image] Skipping ${imagePath} — too large (${(fileSize / 1024 / 1024).toFixed(1)} MB)`);
      return '';
    }

    const buffer = readFileSync(resolved);
    const ext = imagePath.split('.').pop()?.toLowerCase() || 'png';
    const mimeMap: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp', tiff: 'image/tiff', svg: 'image/svg+xml' };
    const mime = mimeMap[ext] || 'image/png';
    const base64 = buffer.toString('base64');

    console.log(`[content-flow:image] Analyzing: ${imagePath.split('/').pop()} (${(fileSize / 1024).toFixed(0)} KB)`);

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.openrouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://editorlens.dev',
      },
      body: JSON.stringify({
        model: 'qwen/qwen3.5-9b',
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } },
            { type: 'text', text: 'Describe this image in 2-3 sentences. What does it show? What topic or concept does it relate to? If it contains text, mention the key text.' },
          ],
        }],
        max_tokens: 300,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      console.warn(`[content-flow:image] Qwen failed (${response.status})`);
      return '';
    }

    const data = await response.json() as any;
    const description = data.choices?.[0]?.message?.content?.trim() ?? '';
    console.log(`[content-flow:image] Result: "${description.slice(0, 100)}..."`);
    return description;
  } catch (err) {
    console.warn(`[content-flow:image] Failed:`, (err as Error).message);
    return '';
  }
}

// ─── Main entry ─────────────────────────────────────────────

export async function analyzeContentFlow(
  projectId: string,
  sessionId: string,
  mediaFiles: MediaFile[],
  transcriptionResults: Map<string, TranscriptionResult>,
  brief: string | undefined,
  onProgress?: (progress: number, message: string) => void,
  tmpDir?: string,
): Promise<ContentFlowResult> {

  onProgress?.(0, 'Preparing content for analysis...');

  // ── Step 1: Build unified transcript context ──────────────
  const allSegments: Array<{
    id: string;
    mediaPath: string;
    mediaType: 'video' | 'audio' | 'image';
    start: number | null;
    end: number | null;
    text: string;
    duration: number;
  }> = [];

  for (const file of mediaFiles) {
    const result = transcriptionResults.get(file.originalPath);
    const segments = result?.segments ?? [];

    if (file.type === 'image') {
      // Analyze image content with vision model
      const imageDescription = await analyzeImage(file.resolvedPath);
      const filename = file.originalPath.split('/').pop() || 'image';
      allSegments.push({
        id: uuid(),
        mediaPath: file.originalPath,
        mediaType: 'image',
        start: null,
        end: null,
        text: imageDescription || `[Image: ${filename}]`,
        duration: 0,
      });
    } else if (segments.length > 0) {
      for (const seg of segments) {
        allSegments.push({
          id: seg.id,
          mediaPath: file.originalPath,
          mediaType: file.type,
          start: seg.start,
          end: seg.end,
          text: seg.text,
          duration: seg.end - seg.start,
        });
      }
    } else {
      // Media with no transcript — single segment covering full duration
      allSegments.push({
        id: uuid(),
        mediaPath: file.originalPath,
        mediaType: file.type,
        start: 0,
        end: file.duration,
        text: '',
        duration: file.duration,
      });
    }
  }

  console.log(`[content-flow] ${allSegments.length} segments across ${mediaFiles.length} files`);
  onProgress?.(10, `Analyzing ${allSegments.length} segments...`);

  // ── Step 2: Claude analyzes all content ────────────────────
  const claudeResult = await analyzeWithClaude(allSegments, mediaFiles, brief, projectId);
  onProgress?.(60, 'Content analysis complete');

  // ── Step 3: Vision model for low-confidence segments ──────
  const lowConfidence = claudeResult.filter(s => s.confidence < 0.6 && s.mediaType === 'video');
  if (lowConfidence.length > 0 && config.openrouterApiKey) {
    onProgress?.(65, `Analyzing ${lowConfidence.length} ambiguous segments with vision...`);
    await resolveWithVision(lowConfidence, mediaFiles, tmpDir);
    onProgress?.(80, 'Vision analysis complete');
  }

  // ── Step 4: Build derived structures ──────────────────────
  onProgress?.(85, 'Building content map...');

  const topics = buildTopics(claudeResult);
  const chapters = buildChapters(claudeResult);
  const heatmap = buildHeatmap(claudeResult);
  const crossMediaLinks = buildCrossMediaLinks(claudeResult, mediaFiles);

  const cutCandidates = claudeResult.filter(s => ['filler', 'tangent'].includes(s.role) || s.redundant_with).length;
  const keepCandidates = claudeResult.filter(s => ['core', 'hook', 'deep-dive'].includes(s.role) && s.importance >= 4).length;

  onProgress?.(100, 'Content flow analysis complete');

  return {
    projectId,
    sessionId,
    segments: claudeResult,
    topics,
    chapters,
    heatmap,
    crossMediaLinks,
    stats: {
      totalDuration: mediaFiles.reduce((sum, f) => sum + f.duration, 0),
      totalSegments: claudeResult.length,
      mediaFiles: mediaFiles.length,
      topicsFound: topics.length,
      chaptersFound: chapters.length,
      cutCandidates,
      keepCandidates,
    },
    createdAt: new Date().toISOString(),
  };
}

// ─── Pass 1: Local pre-classification ───────────────────────

interface LocalClassification {
  role: ContentSegment['role'];
  importance: number;
  confidence: number;
  redundant_with: string | null;
}

function preClassifiedPedagogy(role: ContentSegment['role'], redundantWith: string | null): string {
  if (redundantWith) return `Repeats concept from segment ${redundantWith}`;
  switch (role) {
    case 'filler':    return 'Non-essential content — safe to cut';
    case 'b-roll':    return 'Supplementary visual material';
    case 'ambient':   return 'Supplementary visual material';
    case 'visual-aid': return 'Static visual reference material';
    case 'hook':      return 'Attention-capturing opening element';
    default:          return '';
  }
}

/**
 * Classify obvious segments locally without calling Claude (~60% coverage).
 * Only uncertain segments (actual spoken content) are sent to Claude.
 */
function preClassifySegments(
  segments: Array<{ id: string; mediaPath: string; mediaType: string; start: number | null; end: number | null; text: string; duration: number }>,
): { classified: Map<string, LocalClassification>; uncertain: typeof segments } {
  const classified = new Map<string, LocalClassification>();
  const uncertain: typeof segments = [];
  const seenTexts: Array<{ id: string; words: Set<string> }> = [];
  let foundHook = false;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const text = seg.text.trim();

    // Images → visual-aid
    if (seg.mediaType === 'image') {
      classified.set(seg.id, { role: 'visual-aid', importance: 3, confidence: 0.9, redundant_with: null });
      seenTexts.push({ id: seg.id, words: new Set() });
      continue;
    }

    // No speech → b-roll or ambient
    if (!text) {
      const role: ContentSegment['role'] = seg.mediaType === 'audio' ? 'ambient' : 'b-roll';
      classified.set(seg.id, { role, importance: 2, confidence: 0.9, redundant_with: null });
      seenTexts.push({ id: seg.id, words: new Set() });
      continue;
    }

    const words = text.split(/\s+/);
    const wordSet = new Set(words.map(w => w.toLowerCase()).filter(w => w.length > 3));

    // Filler: starts with filler words OR very short (≤2s, ≤5 words)
    const isFillerStart = /^(um+[\s,]|uh+[\s,]|ah+[\s,]|er[\s,]|hmm+[\s,]|so[\s,]|like[\s,]|you know|let me|okay so|alright so|right so|anyway|so yeah|yeah so)/i.test(text);
    const isVeryShort = seg.duration <= 2.0 && words.length <= 5;
    if (isFillerStart || isVeryShort) {
      classified.set(seg.id, { role: 'filler', importance: 1, confidence: 0.85, redundant_with: null });
      seenTexts.push({ id: seg.id, words: wordSet });
      continue;
    }

    // First real content segment → hook
    if (!foundHook) {
      foundHook = true;
      classified.set(seg.id, { role: 'hook', importance: 4, confidence: 0.8, redundant_with: null });
      seenTexts.push({ id: seg.id, words: wordSet });
      continue;
    }

    // Redundant: >85% word overlap with a recent segment
    const redundantMatch = findRedundantSegment(wordSet, seenTexts.slice(-15));
    if (redundantMatch) {
      classified.set(seg.id, { role: 'filler', importance: 1, confidence: 0.8, redundant_with: redundantMatch });
      seenTexts.push({ id: seg.id, words: wordSet });
      continue;
    }

    // Uncertain — needs Claude
    uncertain.push(seg);
    seenTexts.push({ id: seg.id, words: wordSet });
  }

  return { classified, uncertain };
}

function findRedundantSegment(
  words: Set<string>,
  candidates: Array<{ id: string; words: Set<string> }>,
): string | null {
  if (words.size === 0) return null;
  for (const c of candidates) {
    if (c.words.size === 0) continue;
    let overlap = 0;
    for (const w of words) if (c.words.has(w)) overlap++;
    const ratio = overlap / Math.max(words.size, c.words.size);
    if (ratio > 0.85) return c.id;
  }
  return null;
}

// ─── Claude: content analysis ───────────────────────────────

async function analyzeWithClaude(
  segments: Array<{ id: string; mediaPath: string; mediaType: string; start: number | null; end: number | null; text: string; duration: number }>,
  mediaFiles: MediaFile[],
  brief?: string,
  projectId?: string,
): Promise<ContentSegment[]> {

  if (!config.openrouterApiKey) {
    console.warn('[content-flow] No OpenRouter key — using heuristic analysis');
    return heuristicAnalysis(segments);
  }

  // Pass 1: local pre-classification (~60% handled without Claude)
  const { classified, uncertain } = preClassifySegments(segments);
  console.log(`[content-flow] Pre-classified ${classified.size}/${segments.length} locally; ${uncertain.length} sent to Claude`);

  const claudeResults = new Map<string, any>();

  if (uncertain.length > 0) {
    const mediaContext = mediaFiles.map(f =>
      `- ${f.type}: "${f.originalPath.split('/').pop()}" (${f.duration.toFixed(1)}s)`
    ).join('\n');

    const buildPrompt = (batch: typeof uncertain) => {
      const segmentContext = batch.map(s => {
        const time = s.start !== null ? `[${s.start.toFixed(1)}s-${s.end?.toFixed(1)}s]` : '[image]';
        return `${s.id} ${time}: "${s.text.slice(0, 80)}"`;
      }).join('\n');

      return `You are a creative director analyzing media content for video editing.

MEDIA FILES:
${mediaContext}

${brief ? `BRIEF: ${brief}\n` : ''}SEGMENTS (${batch.length}):
${segmentContext}

For EACH segment return a JSON array object:
{"id","topic","role","importance","pedagogy","continues_from","redundant_with","confidence","hard_cut_before","placement"}

Roles: hook|intro|core|example|deep-dive|tangent|filler|recap|transition|aside|ambient|visual-aid|b-roll
importance: 1(cut) to 5(essential), confidence: 0-1
continues_from/redundant_with: segment id or null
placement: null or "overlay on [id]"/"insert at [id]"

DIRECTOR RULES:
- Filler = um/uh/dead air/repeated points → role filler, importance 1
- Core = actual substance → importance 3-5
- Tangents break flow → importance 1-2
- B continues_from A if it directly references A's content
- hard_cut_before=true where topics shift abruptly

Return ONLY the JSON array.`;
    };

    const BATCH_SIZE = 80;
    const totalBatches = Math.ceil(uncertain.length / BATCH_SIZE);

    for (let i = 0; i < uncertain.length; i += BATCH_SIZE) {
      const batch = uncertain.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      console.log(`[content-flow] Batch ${batchNum}/${totalBatches}: ${batch.length} uncertain segments → Claude`);

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.openrouterApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://editorlens.dev',
        },
        body: JSON.stringify({
          model: 'anthropic/claude-sonnet-4',
          messages: [
            { role: 'system', content: 'You are a creative director. Return only valid JSON arrays.' },
            { role: 'user', content: buildPrompt(batch) },
          ],
          max_tokens: 16000,
          temperature: 0.2,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenRouter error: ${response.status}`);
      }

      const data = await response.json() as any;
      if (projectId) {
        const usage = extractOpenRouterUsage(data);
        recordCost({ projectId, service: 'openrouter', operation: 'content_flow', ...usage });
      }
      const content = data.choices?.[0]?.message?.content ?? '[]';
      const jsonStr = content.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim();
      const batchParsed = JSON.parse(jsonStr) as any[];
      for (const item of batchParsed) claudeResults.set(item.id, item);
      console.log(`[content-flow] Batch ${batchNum}/${totalBatches}: ${batchParsed.length} analyzed`);
    }
  }

  console.log(`[content-flow] Claude analyzed ${claudeResults.size}; pre-classified ${classified.size}`);

  // Merge in original segment order
  return segments.map(seg => {
    const pre = classified.get(seg.id);
    if (pre) {
      return {
        id: seg.id,
        mediaPath: seg.mediaPath,
        mediaType: seg.mediaType as 'video' | 'audio' | 'image',
        start: seg.start,
        end: seg.end,
        text: seg.text,
        topic: seg.text.slice(0, 30) || seg.mediaPath.split('/').pop() || 'pre-classified',
        role: pre.role,
        importance: pre.importance,
        pedagogy: preClassifiedPedagogy(pre.role, pre.redundant_with),
        continues_from: null,
        redundant_with: pre.redundant_with,
        visual_scene: null,
        confidence: pre.confidence,
        hard_cut_before: false,
        placement: (pre.role === 'b-roll' || pre.role === 'visual-aid') ? `insert at ${segments[0]?.id}` : null,
      };
    }

    const analysis = claudeResults.get(seg.id) || {};
    return {
      id: seg.id,
      mediaPath: seg.mediaPath,
      mediaType: seg.mediaType as 'video' | 'audio' | 'image',
      start: seg.start,
      end: seg.end,
      text: seg.text,
      topic: analysis.topic || 'unknown',
      role: analysis.role || 'core',
      importance: analysis.importance || 3,
      pedagogy: analysis.pedagogy || '',
      continues_from: analysis.continues_from || null,
      redundant_with: analysis.redundant_with || null,
      visual_scene: null,
      confidence: analysis.confidence || 0.5,
      hard_cut_before: analysis.hard_cut_before || false,
      placement: analysis.placement || null,
    };
  });
}

// ─── Qwen 3.5: vision for ambiguous segments ───────────────

async function resolveWithVision(
  lowConfSegments: ContentSegment[],
  mediaFiles: MediaFile[],
  tmpDir?: string,
): Promise<void> {
  console.log(`[content-flow] Sending ${lowConfSegments.length} segments to Qwen 3.5 vision`);
  const dir = tmpDir ?? '/tmp';

  for (const seg of lowConfSegments) {
    if (seg.start === null || seg.end === null) continue;

    const file = mediaFiles.find(f => f.originalPath === seg.mediaPath);
    if (!file) continue;

    try {
      // Extract a short video snippet (max 10s) for this segment
      const snippetDuration = Math.min(seg.end - seg.start, 10);
      const snippetPath = `${dir}/mk12-snippet-${seg.id}.mp4`;

      await execFileAsync(config.ffmpegPath, [
        '-ss', String(seg.start),
        '-i', file.resolvedPath,
        '-t', String(snippetDuration),
        '-c:v', 'libx264', '-preset', 'ultrafast',
        '-an', // no audio — we already have transcript
        '-y', snippetPath,
      ], { timeout: 30_000 });

      // Read snippet as base64
      const snippetBuffer = readFileSync(snippetPath);
      const base64Video = snippetBuffer.toString('base64');

      // Send to Qwen 3.5 via OpenRouter
      const visionResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.openrouterApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://editorlens.dev',
        },
        body: JSON.stringify({
          model: 'qwen/qwen3.5-9b',
          messages: [{
            role: 'user',
            content: [
              {
                type: 'video_url',
                video_url: { url: `data:video/mp4;base64,${base64Video}` },
              },
              {
                type: 'text',
                text: `Describe this video clip in one sentence. What is visually happening? Classify as one of: talking-head, screen-recording, slide-presentation, product-demo, b-roll, graphic, transition, or other. Return JSON: {"scene": "classification", "description": "one sentence"}`,
              },
            ],
          }],
          max_tokens: 200,
          temperature: 0.1,
        }),
      });

      if (visionResponse.ok) {
        const vData = await visionResponse.json() as any;
        const vContent = vData.choices?.[0]?.message?.content ?? '';
        const vJson = vContent.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim();
        try {
          const vResult = JSON.parse(vJson);
          seg.visual_scene = vResult.scene || vResult.description || vContent;
          console.log(`[content-flow:vision] ${seg.id}: ${seg.visual_scene}`);

          // Vision can boost confidence and adjust role
          if (seg.visual_scene === 'talking-head' && seg.role === 'filler') {
            seg.confidence = 0.8; // confirm it's filler
          } else if (seg.visual_scene === 'screen-recording' || seg.visual_scene === 'product-demo') {
            seg.role = 'core'; // visual content = valuable
            seg.importance = Math.max(seg.importance, 4);
            seg.confidence = 0.85;
          } else if (seg.visual_scene === 'slide-presentation') {
            seg.hard_cut_before = true; // slides = natural cut points
            seg.confidence = 0.8;
          }
        } catch {
          // Vision response was not JSON — treat raw string as scene description
          seg.visual_scene = vContent.slice(0, 100);
        }
      }

      // Cleanup snippet — failure is harmless, run tmpDir cleanup handles it
      try { unlinkSync(snippetPath); } catch { /* intentional: tmpDir cleanup covers this */ }
    } catch (err) {
      console.warn(`[content-flow:vision] Failed for ${seg.id}:`, (err as Error).message);
    }
  }
}

// ─── Heuristic fallback (no AI) ─────────────────────────────

function heuristicAnalysis(
  segments: Array<{ id: string; mediaPath: string; mediaType: string; start: number | null; end: number | null; text: string; duration: number }>
): ContentSegment[] {
  return segments.map((seg, i) => {
    const text = seg.text.toLowerCase();
    const isFirst = i < 3;
    const isFiller = /^(um|uh|so|like|you know|let me|okay so)/i.test(seg.text.trim());
    const isShort = seg.duration < 3;

    let role: ContentSegment['role'] = 'core';
    let importance = 3;

    if (seg.mediaType === 'image') { role = 'visual-aid'; importance = 3; }
    else if (!seg.text) { role = 'b-roll'; importance = 2; }
    else if (isFiller) { role = 'filler'; importance = 1; }
    else if (isFirst && seg.text.length > 20) { role = 'intro'; importance = 4; }
    else if (isShort && isFiller) { role = 'filler'; importance = 1; }

    return {
      id: seg.id,
      mediaPath: seg.mediaPath,
      mediaType: seg.mediaType as 'video' | 'audio' | 'image',
      start: seg.start,
      end: seg.end,
      text: seg.text,
      topic: 'unknown',
      role,
      importance,
      pedagogy: preClassifiedPedagogy(role, null),
      continues_from: i > 0 ? segments[i - 1].id : null,
      redundant_with: null,
      visual_scene: null,
      confidence: 0.3,
      hard_cut_before: false,
      placement: seg.mediaType === 'image' ? `insert at ${segments[0]?.id}` : null,
    };
  });
}

// ─── Build derived structures ───────────────────────────────

function buildTopics(segments: ContentSegment[]): ContentTopic[] {
  const topicMap = new Map<string, ContentTopic>();

  for (const seg of segments) {
    if (!topicMap.has(seg.topic)) {
      topicMap.set(seg.topic, {
        name: seg.topic,
        segments: [],
        importance: 0,
        pedagogyRole: '',
      });
    }
    // Safe: we just set this key above if it didn't exist
    const topic = topicMap.get(seg.topic) as ContentTopic;
    topic.segments.push(seg.id);
    topic.importance = Math.max(topic.importance, seg.importance);
    if (!topic.pedagogyRole && seg.pedagogy) topic.pedagogyRole = seg.pedagogy;
  }

  return Array.from(topicMap.values()).sort((a, b) => b.importance - a.importance);
}

function buildChapters(segments: ContentSegment[]): ContentChapter[] {
  const chapters: ContentChapter[] = [];
  let currentChapter: ContentChapter | null = null;

  for (const seg of segments) {
    if (seg.hard_cut_before || !currentChapter || currentChapter.topic !== seg.topic) {
      if (currentChapter) chapters.push(currentChapter);
      currentChapter = {
        name: seg.topic,
        order: chapters.length,
        segments: [seg.id],
        startTime: seg.start ?? 0,
        endTime: seg.end ?? 0,
        topic: seg.topic,
        pedagogyPhase: seg.role,
      };
    } else {
      currentChapter.segments.push(seg.id);
      if (seg.end !== null) currentChapter.endTime = seg.end;
    }
  }
  if (currentChapter) chapters.push(currentChapter);

  return chapters;
}

function buildHeatmap(segments: ContentSegment[]): HeatmapPoint[] {
  const points: HeatmapPoint[] = [];

  for (const seg of segments) {
    if (seg.start === null || seg.end === null) continue;

    // One point per second within the segment
    for (let t = Math.floor(seg.start); t < Math.ceil(seg.end); t++) {
      points.push({
        time: t,
        importance: seg.importance,
        topic: seg.topic,
        role: seg.role,
        mediaPath: seg.mediaPath,
      });
    }
  }

  return points.sort((a, b) => a.time - b.time);
}

function buildCrossMediaLinks(segments: ContentSegment[], mediaFiles: MediaFile[]): ContentFlowResult['crossMediaLinks'] {
  const links: ContentFlowResult['crossMediaLinks'] = [];

  // Find images and audio-only files — suggest where they fit
  const images = segments.filter(s => s.mediaType === 'image');
  const audioOnly = segments.filter(s => s.mediaType === 'audio');
  const videoSegs = segments.filter(s => s.mediaType === 'video');

  for (const img of images) {
    // Find the most important video segment with matching topic
    const match = videoSegs
      .filter(v => v.topic === img.topic || img.placement?.includes(v.id))
      .sort((a, b) => b.importance - a.importance)[0];

    if (match) {
      links.push({
        sourceSegment: img.id,
        targetSegment: match.id,
        relationship: 'illustrates',
        reason: `Image "${img.mediaPath.split('/').pop()}" illustrates "${match.topic}"`,
      });
    }
  }

  for (const aud of audioOnly) {
    // Audio overlays the intro or first core segment
    const target = videoSegs.find(v => v.role === 'intro' || v.role === 'hook') || videoSegs[0];
    if (target) {
      links.push({
        sourceSegment: aud.id,
        targetSegment: target.id,
        relationship: 'accompanies',
        reason: `Audio "${aud.mediaPath.split('/').pop()}" accompanies ${target.role} segment`,
      });
    }
  }

  return links;
}

// ─── Test exports (used by test suite only) ────────────────
export const _test = { preClassifiedPedagogy, preClassifySegments };
