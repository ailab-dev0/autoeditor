/**
 * Segment management service.
 *
 * Segments are read from blueprint JSONL in MinIO.
 * Write operations (approve/reject) are no-ops — actual data lives in the blueprint JSONL.
 */

import type { Segment, Suggestion } from '../types/index.js';

/**
 * Store segments for a project.
 * No-op: the pipeline writes directly to MinIO.
 */
export async function setSegments(_projectId: string, _segments: Segment[], _videoPath?: string): Promise<void> {
  return;
}

/**
 * List segments for a project with optional filters.
 */
export async function listSegments(
  projectId: string,
  filters?: {
    decision?: Suggestion;
    minConfidence?: number;
    maxConfidence?: number;
    chapter?: string;
    approved?: boolean;
  }
): Promise<Segment[]> {
  let segments = await listSegmentsFromMinIO(projectId);

  if (filters) {
    if (filters.decision) {
      segments = segments.filter(s => (s.override_decision ?? s.suggestion) === filters.decision);
    }
    if (filters.minConfidence !== undefined) {
      segments = segments.filter(s => s.confidence >= filters.minConfidence!);
    }
    if (filters.maxConfidence !== undefined) {
      segments = segments.filter(s => s.confidence <= filters.maxConfidence!);
    }
    if (filters.chapter) {
      segments = segments.filter(s => s.chapter === filters.chapter);
    }
    if (filters.approved !== undefined) {
      segments = segments.filter(s => (s.approved ?? false) === filters.approved);
    }
  }

  return segments;
}

/**
 * Get a single segment.
 */
export async function getSegment(projectId: string, segmentId: string): Promise<Segment | undefined> {
  const segments = await listSegmentsFromMinIO(projectId);
  return segments.find(s => s.id === segmentId);
}

/**
 * Approve a segment.
 * No-op: approval state lives in the blueprint JSONL.
 */
export async function approveSegment(_projectId: string, _segmentId: string): Promise<Segment | undefined> {
  return undefined;
}

/**
 * Reject a segment with optional override decision.
 * No-op: rejection state lives in the blueprint JSONL.
 */
export async function rejectSegment(
  _projectId: string,
  _segmentId: string,
  _overrideDecision?: Suggestion
): Promise<Segment | undefined> {
  return undefined;
}

/**
 * Bulk approve or reject segments.
 * No-op: approval state lives in the blueprint JSONL.
 */
export async function bulkUpdateSegments(
  _projectId: string,
  _segmentIds: string[],
  _approved: boolean
): Promise<Segment[]> {
  return [];
}

/**
 * Clear all segments for a project.
 * No-op: segments are managed via MinIO.
 */
export async function clearSegments(_projectId: string): Promise<void> {
  return;
}

/**
 * Get approval statistics for a project.
 */
export async function getApprovalStats(projectId: string): Promise<{
  total: number;
  approved: number;
  rejected: number;
  pending: number;
}> {
  const segments = await listSegmentsFromMinIO(projectId);
  const total = segments.length;
  const approved = segments.filter(s => s.approved).length;
  const rejected = segments.filter(s => s.rejected).length;
  return { total, approved, rejected, pending: total - approved - rejected };
}

/**
 * Get segment statistics grouped by decision type.
 */
export async function getSegmentStats(projectId: string): Promise<Record<string, number>> {
  const segments = await listSegmentsFromMinIO(projectId);
  const stats: Record<string, number> = {};
  for (const seg of segments) {
    const decision = seg.override_decision ?? seg.suggestion;
    if (decision) stats[decision] = (stats[decision] ?? 0) + 1;
  }
  return stats;
}

/**
 * Load segments from blueprint JSONL in MinIO.
 */
async function listSegmentsFromMinIO(projectId: string): Promise<Segment[]> {
  try {
    const { isStorageConfigured, getFileStream } = await import('./storage-service.js');
    if (!isStorageConfigured()) return [];

    const stream = await getFileStream(`projects/${projectId}/blueprint-segments.jsonl`);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    const lines = Buffer.concat(chunks).toString('utf8').trim().split('\n').filter(Boolean);

    return lines.map(line => {
      const bp = JSON.parse(line);
      return {
        id: bp.segmentId,
        start: bp.start ?? 0,
        end: bp.end ?? 0,
        suggestion: bp.suggestion ?? 'review',
        confidence: bp.confidence ?? 0,
        explanation: bp.explanation ?? bp.aiPath?.reason ?? '',
        chapter: bp.topic,
        transcript: bp.text,
        content_mark: bp.aiPath?.action !== 'keep_original' ? {
          asset_type: bp.aiPath?.material?.type ?? 'stock_video',
          search_query: bp.aiPath?.material?.source ?? bp.aiPath?.reason ?? bp.topic,
        } : undefined,
      } as Segment;
    });
  } catch {
    return [];
  }
}
