/**
 * AI Director module.
 *
 * Makes intelligent segment-level edit decisions based on transcript
 * content, motion analysis, knowledge graph, and pedagogical structure.
 *
 * When OpenRouter API is available, uses AI for decision-making.
 * Otherwise uses a rule-based heuristic system.
 */

import { v4 as uuid } from 'uuid';
import { config } from '../config.js';
import type {
  Segment, Suggestion, TranscriptSegment, KnowledgeNode,
  KnowledgeEdge, Chapter, ContentMark, Transition,
  VALID_SUGGESTIONS,
} from '../types/index.js';
import type { MotionSegment } from './motion.js';

/**
 * Find the best matching motion segment for a transcript segment using overlap,
 * not full containment. Returns the motion segment with the largest overlap duration,
 * or undefined if no motion segment overlaps at all.
 */
function findBestMotionMatch(
  ts: { start: number; end: number },
  motionSegments: MotionSegment[],
): MotionSegment | undefined {
  let best: MotionSegment | undefined;
  let bestOverlap = 0;
  for (const m of motionSegments) {
    // Overlap condition: m.start < ts.end && m.end > ts.start
    if (m.start < ts.end && m.end > ts.start) {
      const overlap = Math.min(m.end, ts.end) - Math.max(m.start, ts.start);
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        best = m;
      }
    }
  }
  return best;
}

/**
 * Generate director-level edit decisions for all segments.
 */
export async function generateDirectorDecisions(
  transcriptSegments: TranscriptSegment[],
  motionSegments: MotionSegment[],
  concepts: KnowledgeNode[],
  edges: KnowledgeEdge[],
  chapters: Chapter[],
  brief?: string
): Promise<Segment[]> {
  if (config.openrouterApiKey) {
    try {
      return await generateWithAI(
        transcriptSegments, motionSegments, concepts, edges, chapters, brief
      );
    } catch (err) {
      console.warn('[director] AI generation failed, using heuristic:', (err as Error).message);
    }
  }

  return generateHeuristic(transcriptSegments, motionSegments, concepts, chapters);
}

// ── AI-powered decisions ─────────────────────────────────────

async function generateWithAI(
  transcriptSegments: TranscriptSegment[],
  motionSegments: MotionSegment[],
  concepts: KnowledgeNode[],
  edges: KnowledgeEdge[],
  chapters: Chapter[],
  brief?: string
): Promise<Segment[]> {
  // Prepare compact context for the AI
  const segmentData = transcriptSegments.map((ts) => {
    const motion = findBestMotionMatch(ts, motionSegments);
    return {
      id: ts.id,
      start: ts.start,
      end: ts.end,
      text: ts.text,
      motion: motion?.type ?? 'unknown',
      motionScore: motion?.motionScore ?? 0.5,
    };
  });

  const conceptLabels = concepts.slice(0, 20).map((c) => c.label);
  const chapterNames = chapters.map((c) => c.name);

  const prompt = `You are an expert video editor. Analyze these transcript segments and make edit decisions.

${brief ? `Creative brief: ${brief}\n` : ''}
Key concepts in this video: ${conceptLabels.join(', ')}
Chapters: ${chapterNames.join(', ')}

For each segment, decide:
- suggestion: one of "keep", "cut", "trim_start", "trim_end", "trim_both", "rearrange", "speed_up", "merge", "review"
- confidence: 0-1 how sure you are
- explanation: brief reason
- chapter: which chapter this belongs to (from the list above)
- content_mark: if a B-roll or visual aid would help, specify asset_type (one of: stock_video, article, linkedin_photo, animation, ai_image, loom_recording, speaking_only) and search_query

Segments:
${JSON.stringify(segmentData.slice(0, 50), null, 0)}

Return a JSON array with objects: { id, suggestion, confidence, explanation, chapter, content_mark? }
Return ONLY valid JSON.`;

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
        { role: 'system', content: 'You are an expert video editor AI. Return only valid JSON arrays.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 8000,
      temperature: 0.4,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter API error: ${response.status}`);
  }

  const data = await response.json() as any;
  const content = data.choices?.[0]?.message?.content ?? '[]';
  const jsonStr = content.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim();
  const decisions = JSON.parse(jsonStr);

  if (!Array.isArray(decisions)) {
    throw new Error('AI response is not an array');
  }

  // Merge AI decisions with transcript data
  const decisionMap = new Map(decisions.map((d: any) => [d.id, d]));

  return transcriptSegments.map((ts) => {
    const decision = decisionMap.get(ts.id) as any;
    const motion = findBestMotionMatch(ts, motionSegments);

    const validSuggestions = [
      'keep', 'cut', 'trim_start', 'trim_end', 'trim_both',
      'rearrange', 'speed_up', 'merge', 'review',
    ];

    const suggestion: Suggestion = validSuggestions.includes(decision?.suggestion)
      ? decision.suggestion
      : 'review';

    const segment: Segment = {
      id: ts.id,
      start: ts.start,
      end: ts.end,
      suggestion,
      confidence: Math.min(1, Math.max(0, Number(decision?.confidence) || 0.5)),
      explanation: decision?.explanation ?? 'AI analysis pending',
      chapter: decision?.chapter,
      transcript: ts.text,
      concepts: [],
    };

    // Add content mark if AI suggested one
    if (decision?.content_mark) {
      segment.content_mark = {
        asset_type: decision.content_mark.asset_type ?? 'stock_video',
        search_query: decision.content_mark.search_query,
      };
    }

    // Add motion-based transition suggestion
    if (motion && motion.type === 'static') {
      segment.transition_after = 'cross_dissolve';
    }

    return segment;
  });
}

// ── Heuristic-based decisions ────────────────────────────────

function generateHeuristic(
  transcriptSegments: TranscriptSegment[],
  motionSegments: MotionSegment[],
  concepts: KnowledgeNode[],
  chapters: Chapter[]
): Segment[] {
  const conceptLabels = new Set(concepts.map((c) => c.label.toLowerCase()));

  return transcriptSegments.map((ts, index) => {
    const duration = ts.end - ts.start;
    const text = ts.text.toLowerCase();
    const wordCount = ts.text.split(/\s+/).length;

    // Find matching motion segment
    const motion = findBestMotionMatch(ts, motionSegments);
    const motionScore = motion?.motionScore ?? 0.5;

    // Count concept mentions in this segment
    let conceptMentions = 0;
    const mentionedConcepts: string[] = [];
    for (const label of conceptLabels) {
      if (text.includes(label)) {
        conceptMentions++;
        mentionedConcepts.push(label);
      }
    }

    // ── Decision heuristics ──────────────────────────────────

    let suggestion: Suggestion = 'keep';
    let confidence = 0.5;
    let explanation = '';

    // Very short segments with little content → trim or cut
    if (duration < 1.5 && wordCount < 3) {
      suggestion = 'cut';
      confidence = 0.8;
      explanation = 'Very short segment with minimal content.';
    }
    // Long pauses / silence (no words, low motion)
    else if (wordCount < 2 && motionScore < 0.15) {
      suggestion = 'cut';
      confidence = 0.85;
      explanation = 'Silent segment with no significant motion.';
    }
    // Filler content detection
    else if (/\b(um+|uh+|like,?\s+like|you know|basically)\b/i.test(ts.text) && wordCount < 8) {
      suggestion = 'trim_both';
      confidence = 0.7;
      explanation = 'Contains filler words with low information density.';
    }
    // High concept density → definitely keep
    else if (conceptMentions >= 3) {
      suggestion = 'keep';
      confidence = 0.9;
      explanation = `Covers ${conceptMentions} key concepts: ${mentionedConcepts.slice(0, 3).join(', ')}.`;
    }
    // Good content with motion
    else if (conceptMentions >= 1 && motionScore > 0.3) {
      suggestion = 'keep';
      confidence = 0.8;
      explanation = `Covers concept "${mentionedConcepts[0]}" with good visual activity.`;
    }
    // Decent content, no concepts
    else if (wordCount > 10 && motionScore > 0.2) {
      suggestion = 'keep';
      confidence = 0.6;
      explanation = 'Contains substantial narration with visual activity.';
    }
    // Repetitive or low-value
    else if (wordCount < 5 && motionScore < 0.3) {
      suggestion = 'speed_up';
      confidence = 0.6;
      explanation = 'Low information density — can be sped up.';
    }
    // Default: needs review
    else {
      suggestion = 'review';
      confidence = 0.4;
      explanation = 'Requires manual review for edit decision.';
    }

    // Assign to chapter based on position in timeline
    let chapter: string | undefined;
    if (chapters.length > 0) {
      const segmentPosition = index / transcriptSegments.length;
      const chapterIndex = Math.min(
        Math.floor(segmentPosition * chapters.length),
        chapters.length - 1
      );
      chapter = chapters[chapterIndex].name;
    }

    // Content mark suggestions
    let contentMark: ContentMark | undefined;
    if (suggestion === 'keep' && conceptMentions >= 2) {
      contentMark = {
        asset_type: 'stock_video',
        search_query: mentionedConcepts.slice(0, 2).join(' '),
      };
    }

    // Transition suggestions
    let transitionAfter: Transition | undefined;
    if (motion?.type === 'static' && suggestion === 'keep') {
      transitionAfter = 'cross_dissolve';
    }

    const segment: Segment = {
      id: ts.id,
      start: ts.start,
      end: ts.end,
      suggestion,
      confidence: Math.round(confidence * 100) / 100,
      explanation,
      chapter,
      transcript: ts.text,
      concepts: mentionedConcepts,
      content_mark: contentMark,
      transition_after: transitionAfter,
      handle_before: suggestion.includes('trim') ? 0.5 : undefined,
      handle_after: suggestion.includes('trim') ? 0.5 : undefined,
    };

    return segment;
  });
}

// ─── Test exports (used by test suite only) ────────────────
export const _test = { findBestMotionMatch };
