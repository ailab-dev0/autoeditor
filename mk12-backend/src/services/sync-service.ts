/**
 * Real-time sync coordination service.
 *
 * Manages cross-client synchronization of segment approvals
 * and pipeline status updates. Works alongside the WebSocket
 * handlers to ensure plugin and dashboard stay in sync.
 */

import type { Segment, WSSegmentUpdate, PipelineStatus, ClientType } from '../types/index.js';
import { approveSegment, rejectSegment } from './segment-service.js';

// Listener callback types
type SegmentUpdateListener = (projectId: string, update: WSSegmentUpdate, source: ClientType) => void;
type PipelineStatusListener = (projectId: string, status: PipelineStatus) => void;

// Registered listeners
const segmentListeners: SegmentUpdateListener[] = [];
const pipelineListeners: PipelineStatusListener[] = [];

/**
 * Register a listener for segment update events.
 * Returns an unsubscribe function.
 */
export function onSegmentUpdate(listener: SegmentUpdateListener): () => void {
  segmentListeners.push(listener);
  return () => {
    const idx = segmentListeners.indexOf(listener);
    if (idx >= 0) segmentListeners.splice(idx, 1);
  };
}

/**
 * Register a listener for pipeline status events.
 * Returns an unsubscribe function.
 */
export function onPipelineStatus(listener: PipelineStatusListener): () => void {
  pipelineListeners.push(listener);
  return () => {
    const idx = pipelineListeners.indexOf(listener);
    if (idx >= 0) pipelineListeners.splice(idx, 1);
  };
}

/**
 * Process a segment update from any client (plugin or dashboard).
 * Updates the segment store and notifies all listeners.
 */
export async function processSegmentUpdate(
  projectId: string,
  update: WSSegmentUpdate,
  source: ClientType
): Promise<Segment | undefined> {
  let segment: Segment | undefined;

  if (update.approved) {
    segment = await approveSegment(projectId, update.segmentId);
  } else {
    segment = await rejectSegment(
      projectId,
      update.segmentId,
      update.override?.decision
    );
  }

  if (segment) {
    // Notify all listeners (WebSocket handlers will broadcast to other clients)
    for (const listener of segmentListeners) {
      try {
        listener(projectId, update, source);
      } catch (err) {
        console.error('[sync-service] Segment listener error:', err);
      }
    }
  }

  return segment;
}

/**
 * Broadcast a pipeline status update to all listeners.
 */
export function broadcastPipelineStatus(projectId: string, status: PipelineStatus): void {
  for (const listener of pipelineListeners) {
    try {
      listener(projectId, status);
    } catch (err) {
      console.error('[sync-service] Pipeline listener error:', err);
    }
  }
}
