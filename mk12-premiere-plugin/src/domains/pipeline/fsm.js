/**
 * Pipeline sub-FSM — idle, running, complete, failed.
 */
import { signal } from '@preact/signals';

const TRANSITIONS = {
  idle: ['running'],
  running: ['complete', 'failed'],
  complete: ['idle'],
  failed: ['idle'],
};

/** @type {import('@preact/signals').Signal<'idle'|'running'|'complete'|'failed'>} */
export const pipelineState = signal('idle');

export function createPipelineFsm(bus) {
  function canTransition(newState) {
    const allowed = TRANSITIONS[pipelineState.value];
    return allowed ? allowed.includes(newState) : false;
  }

  function transition(newState) {
    if (!canTransition(newState)) {
      throw new Error(
        `Invalid pipeline transition: ${pipelineState.value} → ${newState}. ` +
        `Allowed: ${TRANSITIONS[pipelineState.value]?.join(', ') || 'none'}`
      );
    }

    pipelineState.value = newState;

    if (newState === 'running') bus.emit('pipeline:started', {});
    if (newState === 'complete') bus.emit('pipeline:complete', {});
    if (newState === 'failed') bus.emit('pipeline:error', {});
  }

  return { transition, canTransition };
}
