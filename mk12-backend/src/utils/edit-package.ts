/**
 * EditPackageV3 builder.
 *
 * Assembles the v3 JSON format matching the plugin's ProtocolV3 schema.
 * Includes chapters, segments with decisions, content marks, handles,
 * and transitions.
 */

import type {
  EditPackageV3, Video, Chapter, KnowledgeNode, KnowledgeEdge,
} from '../types/index.js';

export interface BuildEditPackageInput {
  projectName: string;
  sessionId: string;
  videos: Video[];
  chapters: Chapter[];
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
}

/**
 * Build a complete EditPackageV3 from analysis results.
 */
export function buildEditPackage(input: BuildEditPackageInput): EditPackageV3 {
  const { projectName, sessionId, videos, chapters, nodes, edges } = input;

  // Compute pedagogy score based on:
  // - concept coverage (how many concepts are covered by kept segments)
  // - prerequisite ordering (are prerequisites taught before dependents)
  // - confidence distribution
  const pedagogyScore = computePedagogyScore(videos, nodes, edges);

  const editPackage: EditPackageV3 = {
    version: 'v3',
    project_name: projectName,
    pipeline_session_id: sessionId,
    pedagogy_score: pedagogyScore,
    chapters: chapters.map((ch) => ({
      name: ch.name,
      order: ch.order,
      target_duration: ch.target_duration,
    })),
    videos: videos.map((video) => ({
      video_path: video.video_path,
      duration: video.duration,
      fps: video.fps,
      resolution: video.resolution,
      segments: video.segments.map((seg) => ({
        id: seg.id,
        start: seg.start,
        end: seg.end,
        suggestion: seg.suggestion,
        confidence: seg.confidence,
        explanation: seg.explanation,
        chapter: seg.chapter,
        transcript: seg.transcript,
        concepts: seg.concepts,
        content_mark: seg.content_mark,
        transition_after: seg.transition_after,
        handle_before: seg.handle_before,
        handle_after: seg.handle_after,
      })),
    })),
    knowledge_graph: {
      nodes: nodes.map((n) => ({
        id: n.id,
        label: n.label,
        type: n.type,
        importance: n.importance,
        community: n.community,
        properties: n.properties,
      })),
      edges: edges.map((e) => ({
        source: e.source,
        target: e.target,
        relationship: e.relationship,
        weight: e.weight,
      })),
    },
    metadata: {
      generated_by: 'mk12-backend',
      analysis_version: '1.0.0',
    },
    created_at: new Date().toISOString(),
  };

  return editPackage;
}

/**
 * Compute a pedagogy score (0-1) for the edit package.
 *
 * Considers:
 * - Concept coverage: what % of important concepts are in kept segments
 * - Order quality: are prerequisites before dependents
 * - Confidence: average segment confidence
 */
function computePedagogyScore(
  videos: Video[],
  nodes: KnowledgeNode[],
  edges: KnowledgeEdge[]
): number {
  if (nodes.length === 0) return 0.5;

  const allSegments = videos.flatMap((v) => v.segments);
  const keptSegments = allSegments.filter(
    (s) => s.suggestion !== 'cut'
  );

  if (keptSegments.length === 0) return 0;

  // 1. Concept coverage score
  const importantConcepts = nodes.filter((n) => n.importance > 0.3);
  const coveredConcepts = new Set<string>();

  for (const seg of keptSegments) {
    if (seg.concepts) {
      for (const concept of seg.concepts) {
        const node = nodes.find((n) => n.label.toLowerCase() === concept.toLowerCase());
        if (node) coveredConcepts.add(node.id);
      }
    }
  }

  const coverageScore = importantConcepts.length > 0
    ? coveredConcepts.size / importantConcepts.length
    : 1;

  // 2. Prerequisite ordering score
  let orderingScore = 1;
  const prereqEdges = edges.filter((e) => e.relationship === 'PREREQUISITE_OF');

  if (prereqEdges.length > 0) {
    let correctOrder = 0;
    let totalPrereqs = 0;

    for (const edge of prereqEdges) {
      const sourceSegIndex = keptSegments.findIndex(
        (s) => s.concepts?.some((c) => {
          const node = nodes.find((n) => n.id === edge.source);
          return node && c.toLowerCase() === node.label.toLowerCase();
        })
      );
      const targetSegIndex = keptSegments.findIndex(
        (s) => s.concepts?.some((c) => {
          const node = nodes.find((n) => n.id === edge.target);
          return node && c.toLowerCase() === node.label.toLowerCase();
        })
      );

      if (sourceSegIndex >= 0 && targetSegIndex >= 0) {
        totalPrereqs++;
        if (sourceSegIndex < targetSegIndex) {
          correctOrder++;
        }
      }
    }

    orderingScore = totalPrereqs > 0 ? correctOrder / totalPrereqs : 1;
  }

  // 3. Confidence score
  const avgConfidence = keptSegments.reduce((sum, s) => sum + s.confidence, 0) / keptSegments.length;

  // Weighted average
  const score = (coverageScore * 0.4) + (orderingScore * 0.35) + (avgConfidence * 0.25);
  return Math.round(Math.min(1, Math.max(0, score)) * 1000) / 1000;
}
