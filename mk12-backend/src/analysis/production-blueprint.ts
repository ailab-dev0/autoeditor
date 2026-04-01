/**
 * Stage 4A: Production Blueprint + Material Generation
 *
 * For each segment from Stage 2's content flow:
 *   1. Claude decides what visual material would improve it
 *   2. Materials are fetched/generated in parallel (stock, AI images)
 *   3. Two paths produced: AI Director's cut vs Original
 *   4. Blueprint stored in MinIO — consumable by plugin + dashboard
 *
 * Plugin shows: thumbnail + description + [Accept] [Review in Browser →]
 * Dashboard shows: full side-by-side comparison + alternatives
 */

import { v4 as uuid } from 'uuid';
import { config } from '../config.js';
import { recordCost, extractOpenRouterUsage } from '../services/cost-service.js';
import type { ContentSegment, ContentFlowResult } from './content-flow.js';
import type { Chapter } from '../types/index.js';
import { uploadFile, isStorageConfigured } from '../services/storage-service.js';

// ─── Output types ───────────────────────────────────────────

export interface MaterialAsset {
  id: string;
  type: 'stock_video' | 'stock_image' | 'ai_image' | 'animation_template' | 'text_overlay';
  /** Where the asset is stored (MinIO key or external URL) */
  url: string;
  thumbnailUrl: string | null;
  /** Search query or prompt used to find/generate this */
  source: string;
  provider: string;
  width?: number;
  height?: number;
  duration?: number;
}

export interface SegmentBlueprint {
  segmentId: string;
  mediaPath: string;
  start: number | null;
  end: number | null;
  text: string;
  topic: string;
  role: string;
  importance: number;

  /** AI's edit suggestion */
  suggestion: 'keep' | 'cut' | 'trim_start' | 'trim_end' | 'trim_both' | 'replace' | 'overlay' | 'enhance' | 'review';
  confidence: number;
  explanation: string;

  /** What the AI director suggests showing */
  aiPath: {
    action: 'keep_original' | 'add_overlay' | 'replace_footage' | 'add_text' | 'add_animation';
    material: MaterialAsset | null;
    reason: string;
    /** Premiere-ready placement */
    trackIndex: number;
    inPoint: number | null;
    outPoint: number | null;
    transitionBefore: string | null;
    transitionAfter: string | null;
  };

  /** Original = keep as-is */
  originalPath: {
    action: 'keep_original';
  };

  /** User's choice: null = not yet decided */
  userChoice: 'ai' | 'original' | 'custom' | null;

  /** Review URL for dashboard */
  reviewUrl: string;
}

export interface ProductionBlueprint {
  projectId: string;
  sessionId: string;
  segments: SegmentBlueprint[];
  /** All generated materials (for gallery/alternatives) */
  materials: MaterialAsset[];
  stats: {
    totalSegments: number;
    keepOriginal: number;
    addOverlay: number;
    replaceFootage: number;
    addText: number;
    addAnimation: number;
    cutSegments: number;
    materialsGenerated: number;
  };
  /** Non-fatal issues detected during blueprint generation */
  warnings: string[];
  createdAt: string;
}

// ─── Main entry ─────────────────────────────────────────────

export async function generateProductionBlueprint(
  projectId: string,
  sessionId: string,
  contentFlow: ContentFlowResult,
  chapters: Chapter[],
  brief: string | undefined,
  onProgress?: (progress: number, message: string) => void,
): Promise<ProductionBlueprint> {

  onProgress?.(0, 'Planning production...');

  // Step 1: Claude decides what each segment needs
  const decisions = await planWithClaude(contentFlow, chapters, brief, projectId);
  onProgress?.(30, 'Production plan ready');

  // Detect segments with no decision from Claude (blueprint gap)
  const warnings: string[] = [];
  const decidedIds = new Set(decisions.map(d => d.segmentId));
  const missingSegmentIds = contentFlow.segments
    .map(s => s.id)
    .filter(id => !decidedIds.has(id));
  if (missingSegmentIds.length > 0) {
    warnings.push(`${missingSegmentIds.length} segment(s) had no AI decision and were defaulted to needs_review: ${missingSegmentIds.join(', ')}`);
    console.warn(`[blueprint] ${warnings[warnings.length - 1]}`);
    for (const id of missingSegmentIds) {
      decisions.push({
        segmentId: id,
        action: 'keep_original',
        suggestion: 'review',
        confidence: 0.5,
        explanation: 'No AI decision returned — flagged for manual review',
        reason: 'Missing from AI response',
        materialType: null,
        materialQuery: null,
        trackIndex: 0,
        transitionBefore: null,
        transitionAfter: null,
      });
    }
  }

  // Step 2: Generate/fetch materials in parallel
  onProgress?.(35, 'Generating materials...');
  const materials = await generateMaterials(projectId, decisions, onProgress);
  onProgress?.(85, `Generated ${materials.length} materials`);

  // Step 3: Build blueprint
  onProgress?.(90, 'Building blueprint...');
  const segments: SegmentBlueprint[] = contentFlow.segments.map(seg => {
    const decision = decisions.find(d => d.segmentId === seg.id);
    const material = decision?.materialId ? materials.find(m => m.id === decision.materialId) : null;

    return {
      segmentId: seg.id,
      mediaPath: seg.mediaPath,
      start: seg.start,
      end: seg.end,
      text: seg.text,
      topic: seg.topic,
      role: seg.role,
      importance: seg.importance,
      suggestion: decision?.suggestion || mapRoleToSuggestion(seg.role, seg.importance),
      confidence: decision?.confidence || seg.confidence,
      explanation: decision?.explanation || seg.pedagogy,
      aiPath: {
        action: decision?.action || 'keep_original',
        material: material || null,
        reason: decision?.reason || '',
        trackIndex: decision?.trackIndex ?? 0,
        inPoint: seg.start,
        outPoint: seg.end,
        transitionBefore: decision?.transitionBefore || null,
        transitionAfter: decision?.transitionAfter || null,
      },
      originalPath: { action: 'keep_original' },
      userChoice: null,
      reviewUrl: `/project/${projectId}/review#${seg.id}`,
    };
  });

  // Stats
  const stats = {
    totalSegments: segments.length,
    keepOriginal: segments.filter(s => s.aiPath.action === 'keep_original').length,
    addOverlay: segments.filter(s => s.aiPath.action === 'add_overlay').length,
    replaceFootage: segments.filter(s => s.aiPath.action === 'replace_footage').length,
    addText: segments.filter(s => s.aiPath.action === 'add_text').length,
    addAnimation: segments.filter(s => s.aiPath.action === 'add_animation').length,
    cutSegments: segments.filter(s => s.suggestion === 'cut').length,
    materialsGenerated: materials.length,
  };

  onProgress?.(100, 'Blueprint complete');

  return {
    projectId,
    sessionId,
    segments,
    materials,
    stats,
    warnings,
    createdAt: new Date().toISOString(),
  };
}

// ─── Pass 1: Local blueprint pre-classification ─────────────

/**
 * Pre-classify segments with obvious blueprint decisions locally.
 * Filler/cuts, high-value core keeps, b-roll, and hooks are handled
 * without calling Claude (~50-60% coverage).
 */
function preClassifyBlueprintDecisions(
  segments: ContentSegment[],
): { classified: Map<string, ProductionDecision>; uncertain: ContentSegment[] } {
  const classified = new Map<string, ProductionDecision>();
  const uncertain: ContentSegment[] = [];

  for (const seg of segments) {
    const duration = seg.start !== null && seg.end !== null ? seg.end - seg.start : 0;

    // Filler → always cut
    if (seg.role === 'filler') {
      classified.set(seg.id, {
        segmentId: seg.id, suggestion: 'cut', confidence: 0.95,
        explanation: 'Filler removed', action: 'keep_original', reason: 'Filler cut',
        materialType: null, materialQuery: null, trackIndex: 0,
        transitionBefore: null, transitionAfter: null,
      });
      continue;
    }
    // Low-value tangent → cut
    if (seg.role === 'tangent' && seg.importance <= 2) {
      classified.set(seg.id, {
        segmentId: seg.id, suggestion: 'cut', confidence: 0.9,
        explanation: 'Low-value tangent removed', action: 'keep_original', reason: 'Tangent cut',
        materialType: null, materialQuery: null, trackIndex: 0,
        transitionBefore: null, transitionAfter: null,
      });
      continue;
    }
    // B-roll / ambient / visual-aid → keep original (no material needed)
    if (seg.role === 'b-roll' || seg.role === 'ambient' || seg.role === 'visual-aid') {
      classified.set(seg.id, {
        segmentId: seg.id, suggestion: 'keep', confidence: 0.85,
        explanation: `${seg.role} — keep as-is`, action: 'keep_original', reason: 'Secondary content',
        materialType: null, materialQuery: null, trackIndex: 0,
        transitionBefore: null, transitionAfter: null,
      });
      continue;
    }
    // Core / deep-dive with high importance and short duration → keep original
    if ((seg.role === 'core' || seg.role === 'deep-dive') && seg.importance >= 4 && duration <= 15) {
      classified.set(seg.id, {
        segmentId: seg.id, suggestion: 'keep', confidence: 0.9,
        explanation: 'High-value core — keep original', action: 'keep_original', reason: 'Core preserved',
        materialType: null, materialQuery: null, trackIndex: 0,
        transitionBefore: null, transitionAfter: null,
      });
      continue;
    }
    // Hook → text overlay with title
    if (seg.role === 'hook') {
      classified.set(seg.id, {
        segmentId: seg.id, suggestion: 'keep', confidence: 0.9,
        explanation: 'Hook — title text overlay', action: 'add_text', reason: 'Title on hook',
        materialType: 'text_overlay', materialQuery: seg.topic,
        trackIndex: 1, transitionBefore: null, transitionAfter: null,
      });
      continue;
    }
    // Uncertain — send to Claude
    uncertain.push(seg);
  }

  return { classified, uncertain };
}

// ─── Claude: production planning ────────────────────────────

interface ProductionDecision {
  segmentId: string;
  suggestion: SegmentBlueprint['suggestion'];
  confidence: number;
  explanation: string;
  action: SegmentBlueprint['aiPath']['action'];
  reason: string;
  materialType: MaterialAsset['type'] | null;
  materialQuery: string | null;
  materialId?: string;
  trackIndex: number;
  transitionBefore: string | null;
  transitionAfter: string | null;
}

async function planWithClaude(
  contentFlow: ContentFlowResult,
  chapters: Chapter[],
  brief?: string,
  projectId?: string,
): Promise<ProductionDecision[]> {

  if (!config.openrouterApiKey) {
    console.warn('[blueprint] No OpenRouter key — using heuristic planning');
    return heuristicPlan(contentFlow);
  }

  const chapterSummary = chapters.map(c => `${c.name} (${c.target_duration.toFixed(0)}s)`).join(', ');

  // Research-backed editing constraints
  const totalSegments = contentFlow.segments.length;
  const maxOverlays = Math.ceil(totalSegments * 0.30);
  const maxDissolves = Math.max(2, chapters.length);

  // Pass 1: pre-classify obvious decisions locally (~50-60% handled without Claude)
  const { classified: preClassified, uncertain } = preClassifyBlueprintDecisions(contentFlow.segments);
  console.log(`[blueprint] Pre-classified ${preClassified.size}/${totalSegments} decisions locally; ${uncertain.length} sent to Claude`);

  if (uncertain.length === 0) {
    return enforceConstraints(Array.from(preClassified.values()), contentFlow, maxOverlays, maxDissolves);
  }

  const buildPrompt = (batch: ContentSegment[]) => {
    const batchSummary = batch.map(s => {
      const time = s.start !== null ? `[${s.start.toFixed(1)}s-${s.end?.toFixed(1)}s]` : '[image]';
      return `${s.id} ${time} role=${s.role} imp=${s.importance} topic="${s.topic}" text="${(s.text || '').slice(0, 100)}"`;
    }).join('\n');

    return `You are a professional video editor making production decisions. Follow these rules STRICTLY — they are based on published research.

${brief ? `BRIEF: ${brief}\n` : ''}
CHAPTERS: ${chapterSummary}
TOTAL SEGMENTS IN THIS BATCH: ${batch.length}

RESEARCH-BACKED CONSTRAINTS (MUST FOLLOW):
1. MAX ${maxOverlays} segments get overlays (20-30% of total). The rest stay as talking head. Do NOT overlay every segment.
2. "filler" role segments MUST be cut. Real editors cut 75-90% of filler.
3. "tangent" role with importance ≤ 2 MUST be cut.
4. 95-99% of transitions should be hard cuts (no transition effect). Only ${maxDissolves} dissolves max, placed at chapter boundaries.
5. Talking head is fine for 10-15 seconds. Only add B-roll if a single shot exceeds 15s with no visual change.
6. B-roll clips should be 2-5 seconds, not the full segment duration.
7. "core" segments with importance 4-5: keep_original unless >15s talking head.
8. "hook" (first segment): add_text with title overlay only. No stock footage on hooks.
9. Do NOT use animation_template — use ai_image instead for data/concept visuals.

SEGMENTS:
${batchSummary}

For each segment return:
- segment_id, suggestion (keep|cut|trim_start|trim_end|trim_both|overlay|review)
- action (keep_original|add_overlay|add_text)
- material_type (stock_video|stock_image|ai_image|text_overlay) or null
- material_query (specific search query) or null
- confidence (0-1), explanation, reason
- track_index (0=primary, 1=overlay, 2=text)
- transition_after ("cross_dissolve" ONLY at chapter boundaries, null otherwise)

Return ONLY a valid JSON array.`;
  };

  // Batch uncertain segments into chunks of 80
  const BATCH_SIZE = 80;
  const parsed: any[] = [];
  const segments = uncertain;
  const totalBatches = Math.ceil(segments.length / BATCH_SIZE);

  console.log(`[blueprint] Sending ${segments.length} uncertain segments to Claude in ${totalBatches} batches...`);

  for (let i = 0; i < segments.length; i += BATCH_SIZE) {
    const batch = segments.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const batchPrompt = buildPrompt(batch);

    console.log(`[blueprint] Sending batch ${batchNum}/${totalBatches} (${batch.length} segments)...`);

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
          { role: 'system', content: 'You are an AI video production director. Return only valid JSON.' },
          { role: 'user', content: batchPrompt },
        ],
        max_tokens: 16000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) throw new Error(`OpenRouter error: ${response.status}`);

    const data = await response.json() as any;
    if (projectId) {
      const usage = extractOpenRouterUsage(data);
      recordCost({ projectId, service: 'openrouter', operation: 'blueprint', ...usage });
    }
    const content = data.choices?.[0]?.message?.content ?? '[]';
    const jsonStr = content.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim();
    const batchParsed = JSON.parse(jsonStr) as any[];
    parsed.push(...batchParsed);
    console.log(`[blueprint] Batch ${batchNum}/${totalBatches}: ${batchParsed.length} decisions`);
  }

  console.log(`[blueprint] Claude returned ${parsed.length} decisions; ${preClassified.size} pre-classified`);

  // Map raw decisions
  const rawDecisions: ProductionDecision[] = parsed.map(d => ({
    segmentId: d.segment_id,
    suggestion: d.suggestion || 'keep',
    confidence: d.confidence || 0.7,
    explanation: d.explanation || '',
    action: d.action || 'keep_original',
    reason: d.reason || '',
    materialType: d.material_type || null,
    materialQuery: d.material_query || null,
    trackIndex: d.track_index ?? 0,
    transitionBefore: d.transition_before || null,
    transitionAfter: d.transition_after || null,
  }));

  // ── Post-processing: merge pre-classified + Claude, enforce constraints ──
  // Pre-classified overlays (add_text hooks) already consume overlay budget — adjust cap before
  // running enforceConstraints on AI decisions so hooks don't steal budget from substantive overlays.
  const preClassifiedOverlayCount = Array.from(preClassified.values()).filter(
    d => d.action !== 'keep_original' && d.suggestion !== 'cut'
  ).length;
  const aiOverlayCap = Math.max(0, maxOverlays - preClassifiedOverlayCount);

  const constrainedAiDecisions = enforceConstraints(rawDecisions, contentFlow, aiOverlayCap, maxDissolves);
  return [...Array.from(preClassified.values()), ...constrainedAiDecisions];
}

// ─── Constraint enforcement ─────────────────────────────────

function enforceConstraints(
  decisions: ProductionDecision[],
  contentFlow: ContentFlowResult,
  maxOverlays: number,
  maxDissolves: number,
): ProductionDecision[] {
  let fixes = 0;

  // Rule 1: Filler and low-importance tangents MUST be cut
  for (const d of decisions) {
    const seg = contentFlow.segments.find(s => s.id === d.segmentId);
    if (!seg) continue;

    if (seg.role === 'filler' && d.suggestion !== 'cut') {
      d.suggestion = 'cut';
      d.action = 'keep_original';
      d.materialType = null;
      d.materialQuery = null;
      d.explanation = 'Filler — cut (auto-enforced)';
      fixes++;
    }
    if (seg.role === 'tangent' && seg.importance <= 2 && d.suggestion !== 'cut') {
      d.suggestion = 'cut';
      d.action = 'keep_original';
      d.materialType = null;
      d.materialQuery = null;
      d.explanation = 'Low-value tangent — cut (auto-enforced)';
      fixes++;
    }
  }

  // Rule 2: Cap overlays at maxOverlays (30%)
  const overlayDecisions = decisions.filter(d => d.action !== 'keep_original' && d.suggestion !== 'cut');
  if (overlayDecisions.length > maxOverlays) {
    // Sort by importance (from content flow), keep the most important overlays
    const ranked = overlayDecisions.map(d => {
      const seg = contentFlow.segments.find(s => s.id === d.segmentId);
      return { decision: d, importance: seg?.importance ?? 0 };
    }).sort((a, b) => b.importance - a.importance);

    // Demote excess overlays back to keep_original
    for (let i = maxOverlays; i < ranked.length; i++) {
      const d = ranked[i].decision;
      d.action = 'keep_original';
      d.materialType = null;
      d.materialQuery = null;
      d.suggestion = 'keep';
      d.reason = 'Overlay demoted — 30% cap reached (research-backed)';
      fixes++;
    }
  }

  // Rule 3: Cap dissolves at maxDissolves, only at chapter boundaries
  const chapterBoundaryIds = new Set(
    contentFlow.segments.filter(s => s.hard_cut_before).map(s => s.id)
  );
  let dissolveCount = 0;
  for (const d of decisions) {
    if (d.transitionAfter === 'cross_dissolve') {
      if (!chapterBoundaryIds.has(d.segmentId) || dissolveCount >= maxDissolves) {
        d.transitionAfter = null; // hard cut (default)
        fixes++;
      } else {
        dissolveCount++;
      }
    }
  }

  // Rule 4: Convert animation_template to ai_image
  for (const d of decisions) {
    if (d.materialType === 'animation_template') {
      d.materialType = 'ai_image';
      fixes++;
    }
  }

  // Rule 5: If action needs material but none specified, demote to keep_original
  for (const d of decisions) {
    if (d.action !== 'keep_original' && d.suggestion !== 'cut' && !d.materialType) {
      d.action = 'keep_original';
      d.suggestion = 'keep';
      fixes++;
    }
  }

  if (fixes > 0) {
    console.log(`[blueprint] Enforced ${fixes} constraint fixes`);
  }

  // Log final ratios
  const total = decisions.length;
  const finalOverlays = decisions.filter(d => d.action !== 'keep_original' && d.suggestion !== 'cut').length;
  const finalCuts = decisions.filter(d => d.suggestion === 'cut').length;
  const finalDissolves = decisions.filter(d => d.transitionAfter === 'cross_dissolve').length;
  console.log(`[blueprint] Final ratios: overlays=${finalOverlays}/${total} (${(finalOverlays/total*100).toFixed(0)}%), cuts=${finalCuts}, dissolves=${finalDissolves}`);

  return decisions;
}

// ─── Material generation ────────────────────────────────────

async function generateMaterials(
  projectId: string,
  decisions: ProductionDecision[],
  onProgress?: (progress: number, message: string) => void,
): Promise<MaterialAsset[]> {
  const materials: MaterialAsset[] = [];
  const needsMaterial = decisions.filter(d => d.materialType && d.materialQuery);

  if (needsMaterial.length === 0) {
    console.log('[blueprint] No materials to generate');
    return materials;
  }

  console.log(`[blueprint] Generating ${needsMaterial.length} materials...`);

  const MAX_CONCURRENT = 3;
  let completed = 0;

  for (let i = 0; i < needsMaterial.length; i += MAX_CONCURRENT) {
    const batch = needsMaterial.slice(i, i + MAX_CONCURRENT);

    const results = await Promise.allSettled(
      batch.map(async (decision) => {
        const materialId = uuid();
        let asset: MaterialAsset | null = null;

        // materialQuery is guaranteed non-null here: needsMaterial filtered for d.materialQuery above
        const query = decision.materialQuery ?? '';
        switch (decision.materialType) {
          case 'stock_video':
          case 'stock_image':
            asset = await fetchStockMaterial(projectId, materialId, query, decision.materialType);
            break;
          case 'ai_image':
            asset = await generateAIImage(projectId, materialId, query);
            break;
          case 'text_overlay':
            asset = createTextOverlay(materialId, query);
            break;
          case 'animation_template':
            asset = createAnimationTemplate(materialId, query);
            break;
        }

        if (asset) {
          decision.materialId = asset.id;
          completed++;
          const pct = 35 + Math.round((completed / needsMaterial.length) * 50);
          onProgress?.(pct, `Material ${completed}/${needsMaterial.length}`);
        }

        return asset;
      })
    );

    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) {
        materials.push(r.value);
      }
    }
  }

  console.log(`[blueprint] Generated ${materials.length}/${needsMaterial.length} materials`);
  return materials;
}

async function fetchStockMaterial(
  projectId: string,
  materialId: string,
  query: string,
  type: 'stock_video' | 'stock_image',
): Promise<MaterialAsset | null> {
  try {
    // Use Pexels API (already configured in backend)
    if (!config.pexelsApiKey) {
      console.warn('[blueprint:stock] No Pexels key — skipping');
      return null;
    }

    const isVideo = type === 'stock_video';
    const endpoint = isVideo
      ? `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=1&size=medium`
      : `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&size=medium`;

    const res = await fetch(endpoint, {
      headers: { 'Authorization': config.pexelsApiKey },
    });

    if (!res.ok) return null;
    const data = await res.json() as any;

    if (isVideo) {
      const video = data.videos?.[0];
      if (!video) return null;
      const file = video.video_files?.find((f: any) => f.quality === 'sd') || video.video_files?.[0];
      return {
        id: materialId,
        type: 'stock_video',
        url: file?.link || '',
        thumbnailUrl: video.image || null,
        source: query,
        provider: 'pexels',
        width: file?.width,
        height: file?.height,
        duration: video.duration,
      };
    } else {
      const photo = data.photos?.[0];
      if (!photo) return null;
      return {
        id: materialId,
        type: 'stock_image',
        url: photo.src?.large || photo.src?.medium || '',
        thumbnailUrl: photo.src?.small || null,
        source: query,
        provider: 'pexels',
        width: photo.width,
        height: photo.height,
      };
    }
  } catch (err) {
    console.warn(`[blueprint:stock] Search failed for "${query}":`, (err as Error).message);
    return null;
  }
}

async function generateAIImage(
  projectId: string,
  materialId: string,
  prompt: string,
): Promise<MaterialAsset | null> {
  if (!config.falApiKey) {
    console.warn('[blueprint:ai-image] No FAL key — skipping');
    return null;
  }

  try {
    const { fal } = await import('@fal-ai/client');
    fal.config({ credentials: config.falApiKey });

    const result = await fal.subscribe('fal-ai/flux/schnell', {
      input: { prompt, image_size: 'landscape_16_9' },
    }) as any;

    const imageUrl = result.images?.[0]?.url;
    if (!imageUrl) return null;

    // Download and store in MinIO
    if (isStorageConfigured()) {
      const imageRes = await fetch(imageUrl);
      if (imageRes.ok) {
        const buffer = Buffer.from(await imageRes.arrayBuffer());
        const key = `projects/${projectId}/materials/${materialId}.png`;
        await uploadFile(key, buffer, 'image/png');
        console.log(`[blueprint:ai-image] Stored: ${key}`);
      }
    }

    return {
      id: materialId,
      type: 'ai_image',
      url: imageUrl,
      thumbnailUrl: imageUrl,
      source: prompt,
      provider: 'fal-flux',
      width: 1280,
      height: 720,
    };
  } catch (err) {
    console.warn(`[blueprint:ai-image] Generation failed:`, (err as Error).message);
    return null;
  }
}

function createTextOverlay(materialId: string, text: string): MaterialAsset {
  // Text overlays don't need a file — the renderer creates them
  return {
    id: materialId,
    type: 'text_overlay',
    url: '', // rendered at playback time
    thumbnailUrl: null,
    source: text,
    provider: 'local',
  };
}

function createAnimationTemplate(materialId: string, description: string): MaterialAsset {
  // Animation templates reference Remotion component IDs
  // Actual rendering happens separately via the animation engine
  return {
    id: materialId,
    type: 'animation_template',
    url: '', // rendered by Remotion on demand
    thumbnailUrl: null,
    source: description,
    provider: 'remotion',
  };
}

// ─── Heuristic fallback ─────────────────────────────────────

function heuristicPlan(contentFlow: ContentFlowResult): ProductionDecision[] {
  return contentFlow.segments.map(seg => {
    let action: ProductionDecision['action'] = 'keep_original';
    let suggestion: SegmentBlueprint['suggestion'] = 'keep';
    let materialType: MaterialAsset['type'] | null = null;
    let materialQuery: string | null = null;

    if (seg.role === 'filler' || (seg.role === 'tangent' && seg.importance <= 2)) {
      suggestion = 'cut';
    } else if (seg.role === 'example' && seg.importance >= 3) {
      action = 'add_overlay';
      materialType = 'stock_image';
      materialQuery = seg.topic;
    } else if (seg.role === 'hook') {
      action = 'add_text';
      materialType = 'text_overlay';
      materialQuery = seg.topic;
    }

    return {
      segmentId: seg.id,
      suggestion,
      confidence: seg.confidence,
      explanation: seg.pedagogy,
      action,
      reason: '',
      materialType,
      materialQuery,
      trackIndex: action === 'keep_original' ? 0 : 1,
      transitionBefore: null,
      transitionAfter: seg.hard_cut_before ? 'cross_dissolve' : null,
    };
  });
}

// ─── Helpers ────────────────────────────────────────────────

function mapRoleToSuggestion(role: string, importance: number): SegmentBlueprint['suggestion'] {
  if (role === 'filler') return 'cut';
  if (role === 'tangent' && importance <= 2) return 'cut';
  if (role === 'hook' || role === 'core' || role === 'deep-dive') return 'keep';
  if (role === 'recap' || role === 'transition') return importance >= 3 ? 'keep' : 'trim_both';
  return 'review';
}

// ─── Test exports (used by test suite only) ────────────────
export const _test = { enforceConstraints, preClassifyBlueprintDecisions };
