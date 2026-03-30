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
    if (!res.ok) {
      pipelineError.value = res.error || 'Failed to start pipeline';
      return;
    }

    fsm.transition('running');
    stage.value = 'transcription';

    // Start HTTP polling fallback (real WS would supersede this)
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
      fsm.transition('complete');
    }
    // pipeline:complete is emitted by the FSM transition above.
    // The payload is available on the 'ws:analysis:complete' event that domains can listen for.
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
      if (res.ok && res.data) {
        bus.emit('ws:analysis:progress', res.data);
        if (res.data.stage === 'complete') {
          bus.emit('ws:analysis:complete', res.data);
        }
      }
    }, 5000);
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  return { fsm, stopPolling };
}
