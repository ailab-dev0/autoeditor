/**
 * Shell hierarchical FSM — 6 top-level states with validated transitions.
 * Uses Preact Signals for reactive state. Emits events on the shared bus.
 */
import { signal } from '@preact/signals';

export const STATES = {
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  CONNECTING: 'CONNECTING',
  READY: 'READY',
  WORKING: 'WORKING',
  REVIEWING: 'REVIEWING',
  APPLYING: 'APPLYING',
};

const TRANSITIONS = {
  UNAUTHENTICATED: ['CONNECTING'],
  CONNECTING: ['READY', 'UNAUTHENTICATED'],
  READY: ['WORKING', 'UNAUTHENTICATED'],
  WORKING: ['REVIEWING', 'READY'],
  REVIEWING: ['APPLYING', 'READY'],
  APPLYING: ['READY', 'REVIEWING'],
};

const MAX_HISTORY = 10;

/** Current top-level shell state */
export const shellState = signal(STATES.UNAUTHENTICATED);

/** Arbitrary context data (projectId, etc.) */
export const shellContext = signal({});

/**
 * Create the shell FSM bound to an event bus.
 * @param {import('../shared/event-bus').EventBus} bus
 */
export function createShellFsm(bus) {
  const history = [];

  function canTransition(newState) {
    const allowed = TRANSITIONS[shellState.value];
    return allowed ? allowed.includes(newState) : false;
  }

  function transition(newState, context = {}) {
    if (!canTransition(newState)) {
      throw new Error(
        `Invalid transition: ${shellState.value} → ${newState}. ` +
        `Allowed: ${TRANSITIONS[shellState.value]?.join(', ') || 'none'}`
      );
    }

    const from = shellState.value;
    shellState.value = newState;
    shellContext.value = { ...shellContext.value, ...context };

    const entry = { from, to: newState, context, timestamp: Date.now() };
    history.push(entry);
    if (history.length > MAX_HISTORY) history.shift();

    bus.emit('shell:transitioned', entry);
  }

  // Auto-transitions from domain events
  bus.on('pipeline:complete', () => {
    if (shellState.value === STATES.WORKING) {
      transition(STATES.REVIEWING);
    }
  });

  bus.on('timeline:applied', () => {
    if (shellState.value === STATES.APPLYING) {
      transition(STATES.READY);
    }
  });

  bus.on('auth:logged-in', () => {
    if (shellState.value === STATES.CONNECTING) {
      transition(STATES.READY);
    }
  });

  bus.on('auth:logged-out', () => {
    if (canTransition(STATES.UNAUTHENTICATED)) {
      transition(STATES.UNAUTHENTICATED);
    }
  });

  bus.on('auth:expired', () => {
    if (canTransition(STATES.UNAUTHENTICATED)) {
      transition(STATES.UNAUTHENTICATED);
    }
  });

  return {
    transition,
    canTransition,
    getHistory: () => [...history],
  };
}
