/**
 * Timeline sub-FSM — idle, previewing, applying, applied, rolled-back, failed.
 */
import { signal } from '@preact/signals';

const TRANSITIONS = {
  idle: ['previewing'],
  previewing: ['applying', 'idle'],
  applying: ['applied', 'failed'],
  applied: ['rolled-back', 'idle'],
  'rolled-back': ['idle'],
  failed: ['idle'],
};

/** @type {import('@preact/signals').Signal<string>} */
export const timelineState = signal('idle');

export function createTimelineFsm(bus) {
  function canTransition(newState) {
    const allowed = TRANSITIONS[timelineState.value];
    return allowed ? allowed.includes(newState) : false;
  }

  function transition(newState) {
    if (!canTransition(newState)) {
      throw new Error(
        `Invalid timeline transition: ${timelineState.value} → ${newState}. ` +
        `Allowed: ${TRANSITIONS[timelineState.value]?.join(', ') || 'none'}`
      );
    }

    timelineState.value = newState;

    const eventMap = {
      previewing: 'timeline:previewed',
      applied: 'timeline:applied',
      'rolled-back': 'timeline:rolled-back',
      failed: 'timeline:error',
    };

    const event = eventMap[newState];
    if (event) bus.emit(event, {});
  }

  return { transition, canTransition };
}
