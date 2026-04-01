/**
 * Pipeline adapter — handles start intent, WS progress, HTTP polling fallback.
 */
import { stage, percent, eta, cost, pipelineError } from './signals.js';
import { createPipelineFsm, pipelineState } from './fsm.js';

export function setupPipelineAdapter(bus, transport) {
  const fsm = createPipelineFsm(bus);
  let pollTimer = null;

  bus.on('pipeline:start', async ({ projectId }) => {
    pipelineError.value = null;
    stage.value = 'idle';
    percent.value = 0;
    eta.value = null;
    cost.value = 0;

    const res = await transport.post(`/api/projects/${projectId}/pipeline/start`, {});

    // 409 means pipeline already running — just start polling
    if (!res.ok && res.error !== 'Pipeline already running') {
      pipelineError.value = res.error || 'Failed to start pipeline';
      return;
    }

    if (pipelineState.value === 'idle') {
      fsm.transition('running');
    }
    stage.value = 'transcription';
    bus.emit('pipeline:started', { projectId });

    // Start HTTP polling for progress
    startPolling(transport, projectId);
  });

  bus.on('ws:analysis:progress', (data) => {
    if (data.stage) stage.value = data.stage;
    if (data.percent != null) percent.value = data.percent;
    if (data.eta != null) eta.value = data.eta;
    if (data.cost != null) cost.value = data.cost;
  });

  bus.on('ws:analysis:complete', (data) => {
    stopPolling();
    stage.value = 'complete';
    percent.value = 100;
    if (pipelineState.value === 'running') {
      fsm.transition('complete', data);
    }
  });

  bus.on('ws:error', (data) => {
    stopPolling();
    pipelineError.value = data?.message || 'Pipeline error';
    if (pipelineState.value === 'running') {
      fsm.transition('failed');
    }
  });

  function startPolling(transport, projectId) {
    stopPolling();
    pollTimer = setInterval(async () => {
      const res = await transport.get(`/api/projects/${projectId}/pipeline/status`);
      if (!res.ok || !res.data) return;

      // Map backend format { pipeline_status: { stages, current_stage, overall_progress, status } }
      // to plugin format { stage, percent, eta, cost }
      const ps = res.data.pipeline_status || res.data;
      const currentStage = ps.current_stage || ps.stage || 'idle';
      const overallProgress = ps.overall_progress ?? ps.percent ?? 0;

      // Calculate progress from stages if available
      let calcProgress = overallProgress;
      if (ps.stages && ps.stages.length > 0) {
        const totalStages = ps.stages.length;
        let completedStages = 0;
        let currentStageProgress = 0;
        for (const s of ps.stages) {
          if (s.status === 'completed') completedStages++;
          else if (s.status === 'running') currentStageProgress = (s.progress || 0) / 100;
        }
        calcProgress = Math.round(((completedStages + currentStageProgress) / totalStages) * 100);
      }

      // Map backend stage names to plugin stage names
      const stageMap = {
        transcription: 'transcription',
        knowledge_graph: 'analysis',
        pedagogical_analysis: 'scoring',
        director_decisions: 'packaging',
        package_compilation: 'complete',
      };
      const mappedStage = stageMap[currentStage] || currentStage;

      bus.emit('ws:analysis:progress', {
        stage: mappedStage,
        percent: calcProgress,
        eta: ps.eta || null,
        cost: ps.cost || 0,
      });

      // Check if pipeline is done or errored
      if (ps.status === 'completed' || ps.status === 'complete') {
        // Fetch the actual edit package from the project
        const projRes = await transport.get(`/api/projects/${projectId}`);
        const editPackage = projRes.ok ? (projRes.data?.edit_package || projRes.data?.editPackage || projRes.data) : ps;
        bus.emit('ws:analysis:complete', { editPackage });
      } else if (ps.status === 'error' || ps.status === 'failed') {
        const errorMsg = ps.error || ps.stages?.find(s => s.status === 'error')?.error || 'Pipeline failed';
        bus.emit('ws:error', { message: errorMsg });
      }
    }, 3000); // Poll every 3s instead of 5s for better responsiveness
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  return { fsm, stopPolling };
}
