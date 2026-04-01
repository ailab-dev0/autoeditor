/**
 * Analysis pipeline orchestration service.
 *
 * Coordinates the 5-stage analysis pipeline, calling into the
 * analysis modules and emitting progress events.
 */

import { v4 as uuid } from 'uuid';
import type {
  Project, PipelineStatus, PipelineStageName, PipelineStage,
  EditPackageV3, PIPELINE_STAGES,
} from '../types/index.js';
import { runPipeline, type PipelineProgressCallback, type PipelineOptions } from '../analysis/pipeline.js';
import { setEditPackage, setPipelineStatus, setProjectStatus } from './project-service.js';
import { broadcastPipelineStatus } from './sync-service.js';

// Active pipeline sessions: projectId -> PipelineStatus
const activePipelines = new Map<string, PipelineStatus>();

// SSE listeners: projectId -> Set of callback functions
const sseListeners = new Map<string, Set<(event: string, data: unknown) => void>>();

/**
 * Start the analysis pipeline for a project.
 */
// Lock set to prevent race between check and set
const startingPipelines = new Set<string>();

export async function startPipeline(project: Project, options?: PipelineOptions): Promise<PipelineStatus> {
  if (activePipelines.has(project.id) || startingPipelines.has(project.id)) {
    throw new Error(`Pipeline already running for project ${project.id}`);
  }
  startingPipelines.add(project.id);

  const sessionId = uuid();
  const status: PipelineStatus = {
    session_id: sessionId,
    project_id: project.id,
    status: 'running',
    current_stage: 'transcription',
    overall_progress: 0,
    stages: [
      { name: 'transcription', status: 'pending', progress: 0 },
      { name: 'knowledge_graph', status: 'pending', progress: 0 },
      { name: 'chapter_validation', status: 'pending', progress: 0 },
      { name: 'director_decisions', status: 'pending', progress: 0 },
    ],
    started_at: new Date().toISOString(),
  };

  activePipelines.set(project.id, status);
  startingPipelines.delete(project.id);
  await setPipelineStatus(project.id, status);
  await setProjectStatus(project.id, 'analyzing');

  // Tracks whether any status persistence attempt failed after retries.
  // If true, we include a warning in the completion SSE so the UI can inform the user.
  let statusBroadcastDegraded = false;

  /**
   * Attempt to persist pipeline status with up to 2 retries (500ms apart).
   * Non-critical: failure is logged and flagged but never halts the pipeline.
   */
  async function persistStatusWithRetry(pid: string, ps: PipelineStatus): Promise<void> {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await setPipelineStatus(pid, ps);
        return;
      } catch (err) {
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 500));
        } else {
          console.error('[analysis-service] Pipeline status persist failed after 3 attempts', {
            projectId: pid,
            stage: ps.current_stage,
            error: (err as Error).message,
          });
          statusBroadcastDegraded = true;
        }
      }
    }
  }

  // Progress callback — updates status and emits SSE events
  const onProgress: PipelineProgressCallback = (
    stageName: PipelineStageName,
    stageProgress: number,
    message?: string
  ) => {
    const pipelineStatus = activePipelines.get(project.id);
    if (!pipelineStatus) return;

    // Update stage
    const stage = pipelineStatus.stages.find((s) => s.name === stageName);
    if (stage) {
      if (stageProgress > 0 && stage.status === 'pending') {
        stage.status = 'running';
        stage.started_at = new Date().toISOString();
      }
      stage.progress = stageProgress;
      if (message) stage.message = message;
      if (stageProgress >= 100) {
        stage.status = 'completed';
        stage.completed_at = new Date().toISOString();
      }
    }

    // Update current stage and overall progress
    pipelineStatus.current_stage = stageName;
    const stageIndex = pipelineStatus.stages.findIndex((s) => s.name === stageName);
    pipelineStatus.overall_progress = Math.round(
      ((stageIndex * 100 + stageProgress) / (pipelineStatus.stages.length * 100)) * 100
    );

    // Fire-and-forget persist with retry — persistStatusWithRetry handles all
    // logging and sets statusBroadcastDegraded internally; this catch is intentional
    // to suppress the unhandled rejection from the async fire-and-forget call.
    persistStatusWithRetry(project.id, pipelineStatus).catch(() => { /* handled inside */ });
    broadcastPipelineStatus(project.id, pipelineStatus);

    // Emit SSE events matching frontend PipelineSSEEvent types
    if (stageProgress === 0 && stage?.status === 'running') {
      emitSSE(project.id, 'stage_start', { stage: stageName, progress: 0 });
    }
    if (stageProgress > 0 && stageProgress < 100) {
      emitSSE(project.id, 'stage_progress', {
        stage: stageName,
        progress: stageProgress,
      });
    }
    if (stageProgress >= 100) {
      emitSSE(project.id, 'stage_complete', { stage: stageName, progress: 100 });
    }
  };

  // If no explicit start stage, auto-resume is handled inside runPipeline via checkpoint detection
  // Run pipeline asynchronously
  runPipeline(project, sessionId, onProgress, options)
    .then(async (editPackage) => {
      const pipelineStatus = activePipelines.get(project.id);
      if (pipelineStatus) {
        pipelineStatus.overall_progress = 100;
        pipelineStatus.status = 'completed';
        pipelineStatus.completed_at = new Date().toISOString();
        await setPipelineStatus(project.id, pipelineStatus);
      }

      // Don't set edit_package yet — user must review blueprint first
      // Pipeline status = review (not ready)
      await setProjectStatus(project.id, 'review');

      emitSSE(project.id, 'pipeline_complete', {
        status: 'review',
        message: 'Blueprint ready for review',
        ...(statusBroadcastDegraded && {
          warning: 'Pipeline completed but real-time status updates may have been unreliable.',
        }),
      });
      broadcastPipelineStatus(project.id, pipelineStatus!);
      // Keep in map for 60 seconds so status polls can find it
      setTimeout(() => activePipelines.delete(project.id), 60000);
    })
    .catch(async (err) => {
      console.error(`[analysis-service] Pipeline failed for ${project.id}:`, err);

      const pipelineStatus = activePipelines.get(project.id);
      if (pipelineStatus) {
        pipelineStatus.status = 'error';
        pipelineStatus.error = (err as Error).message;
        const currentStage = pipelineStatus.stages.find(
          (s) => s.name === pipelineStatus.current_stage
        );
        if (currentStage) {
          currentStage.status = 'error';
          currentStage.error = (err as Error).message;
        }
        await setPipelineStatus(project.id, pipelineStatus);
        broadcastPipelineStatus(project.id, pipelineStatus);
      }

      await setProjectStatus(project.id, 'error');
      emitSSE(project.id, 'stage_error', {
        stage: pipelineStatus?.current_stage,
        error: (err as Error).message,
      });
      activePipelines.delete(project.id);
    });

  return status;
}

/**
 * Get the current pipeline status for a project.
 * Checks in-memory active pipelines first, then falls back to Neo4j
 * (handles the case where the server restarted or the 60s TTL expired).
 */
export async function getPipelineStatus(projectId: string): Promise<PipelineStatus | undefined> {
  const inMemory = activePipelines.get(projectId);
  if (inMemory) return inMemory;

  // Fallback: check persisted status from Postgres via project-service
  const { getProjectById } = await import('./project-service.js');
  const project = await getProjectById(projectId);
  return project?.pipeline_status;
}

/**
 * Register an SSE listener for a project's pipeline events.
 * Returns an unsubscribe function.
 */
export function registerSSEListener(
  projectId: string,
  listener: (event: string, data: unknown) => void
): () => void {
  let listenerSet = sseListeners.get(projectId);
  if (!listenerSet) {
    listenerSet = new Set();
    sseListeners.set(projectId, listenerSet);
  }
  listenerSet.add(listener);

  return () => {
    const listeners = sseListeners.get(projectId);
    if (listeners) {
      listeners.delete(listener);
      if (listeners.size === 0) {
        sseListeners.delete(projectId);
      }
    }
  };
}

/**
 * Emit an SSE event to all listeners for a project.
 */
function emitSSE(projectId: string, event: string, data: unknown): void {
  const listeners = sseListeners.get(projectId);
  if (!listeners) return;

  for (const listener of listeners) {
    try {
      listener(event, data);
    } catch (err) {
      console.error('[analysis-service] SSE listener error:', err);
    }
  }
}
