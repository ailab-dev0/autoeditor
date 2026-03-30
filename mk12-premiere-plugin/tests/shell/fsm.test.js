import { describe, it, expect, beforeEach } from 'vitest';
import { createShellFsm, shellState, shellContext, STATES } from '../../src/shell/fsm';
import { createEventBus } from '../../src/shared/event-bus';

describe('Shell FSM', () => {
  let bus, fsm;

  beforeEach(() => {
    bus = createEventBus();
    shellState.value = STATES.UNAUTHENTICATED;
    shellContext.value = {};
    fsm = createShellFsm(bus);
  });

  describe('valid transitions', () => {
    it('transitions UNAUTHENTICATED → CONNECTING', () => {
      fsm.transition(STATES.CONNECTING);
      expect(shellState.value).toBe(STATES.CONNECTING);
    });

    it('transitions CONNECTING → READY', () => {
      fsm.transition(STATES.CONNECTING);
      fsm.transition(STATES.READY);
      expect(shellState.value).toBe(STATES.READY);
    });

    it('transitions READY → WORKING → REVIEWING → APPLYING → READY', () => {
      fsm.transition(STATES.CONNECTING);
      fsm.transition(STATES.READY);
      fsm.transition(STATES.WORKING);
      fsm.transition(STATES.REVIEWING);
      fsm.transition(STATES.APPLYING);
      fsm.transition(STATES.READY);
      expect(shellState.value).toBe(STATES.READY);
    });

    it('transitions CONNECTING → UNAUTHENTICATED on failure', () => {
      fsm.transition(STATES.CONNECTING);
      fsm.transition(STATES.UNAUTHENTICATED);
      expect(shellState.value).toBe(STATES.UNAUTHENTICATED);
    });

    it('transitions READY → UNAUTHENTICATED on logout', () => {
      fsm.transition(STATES.CONNECTING);
      fsm.transition(STATES.READY);
      fsm.transition(STATES.UNAUTHENTICATED);
      expect(shellState.value).toBe(STATES.UNAUTHENTICATED);
    });

    it('transitions REVIEWING → READY on reset', () => {
      fsm.transition(STATES.CONNECTING);
      fsm.transition(STATES.READY);
      fsm.transition(STATES.WORKING);
      fsm.transition(STATES.REVIEWING);
      fsm.transition(STATES.READY);
      expect(shellState.value).toBe(STATES.READY);
    });

    it('transitions APPLYING → REVIEWING on rollback', () => {
      fsm.transition(STATES.CONNECTING);
      fsm.transition(STATES.READY);
      fsm.transition(STATES.WORKING);
      fsm.transition(STATES.REVIEWING);
      fsm.transition(STATES.APPLYING);
      fsm.transition(STATES.REVIEWING);
      expect(shellState.value).toBe(STATES.REVIEWING);
    });
  });

  describe('invalid transitions', () => {
    it('throws on UNAUTHENTICATED → READY', () => {
      expect(() => fsm.transition(STATES.READY)).toThrow('Invalid transition');
    });

    it('throws on READY → APPLYING', () => {
      fsm.transition(STATES.CONNECTING);
      fsm.transition(STATES.READY);
      expect(() => fsm.transition(STATES.APPLYING)).toThrow('Invalid transition');
    });

    it('throws on WORKING → APPLYING', () => {
      fsm.transition(STATES.CONNECTING);
      fsm.transition(STATES.READY);
      fsm.transition(STATES.WORKING);
      expect(() => fsm.transition(STATES.APPLYING)).toThrow('Invalid transition');
    });
  });

  describe('canTransition', () => {
    it('returns true for valid transitions', () => {
      expect(fsm.canTransition(STATES.CONNECTING)).toBe(true);
    });

    it('returns false for invalid transitions', () => {
      expect(fsm.canTransition(STATES.READY)).toBe(false);
    });
  });

  describe('context', () => {
    it('merges context on transition', () => {
      fsm.transition(STATES.CONNECTING, { projectId: '123' });
      expect(shellContext.value.projectId).toBe('123');
    });

    it('preserves previous context through transitions', () => {
      fsm.transition(STATES.CONNECTING, { projectId: '123' });
      fsm.transition(STATES.READY, { projectName: 'Test' });
      expect(shellContext.value.projectId).toBe('123');
      expect(shellContext.value.projectName).toBe('Test');
    });
  });

  describe('history', () => {
    it('tracks transition history', () => {
      fsm.transition(STATES.CONNECTING);
      fsm.transition(STATES.READY);
      const history = fsm.getHistory();
      expect(history).toHaveLength(2);
      expect(history[0].from).toBe(STATES.UNAUTHENTICATED);
      expect(history[0].to).toBe(STATES.CONNECTING);
      expect(history[1].from).toBe(STATES.CONNECTING);
      expect(history[1].to).toBe(STATES.READY);
    });

    it('bounds history to 10 entries', () => {
      // Walk through states repeatedly to generate >10 transitions
      for (let i = 0; i < 6; i++) {
        fsm.transition(STATES.CONNECTING);
        fsm.transition(STATES.READY);
        // Reset back to UNAUTHENTICATED for next loop
        if (i < 5) fsm.transition(STATES.UNAUTHENTICATED);
      }
      expect(fsm.getHistory().length).toBeLessThanOrEqual(10);
    });
  });

  describe('bus events', () => {
    it('emits shell:transitioned on transition', () => {
      const events = [];
      bus.on('shell:transitioned', e => events.push(e));
      fsm.transition(STATES.CONNECTING);
      expect(events).toHaveLength(1);
      expect(events[0].from).toBe(STATES.UNAUTHENTICATED);
      expect(events[0].to).toBe(STATES.CONNECTING);
      expect(events[0].timestamp).toBeGreaterThan(0);
    });

    it('auto-transitions WORKING → REVIEWING on pipeline:complete', () => {
      fsm.transition(STATES.CONNECTING);
      fsm.transition(STATES.READY);
      fsm.transition(STATES.WORKING);
      bus.emit('pipeline:complete', {});
      expect(shellState.value).toBe(STATES.REVIEWING);
    });

    it('auto-transitions APPLYING → READY on timeline:applied', () => {
      fsm.transition(STATES.CONNECTING);
      fsm.transition(STATES.READY);
      fsm.transition(STATES.WORKING);
      fsm.transition(STATES.REVIEWING);
      fsm.transition(STATES.APPLYING);
      bus.emit('timeline:applied', {});
      expect(shellState.value).toBe(STATES.READY);
    });

    it('auto-transitions to UNAUTHENTICATED on auth:expired', () => {
      fsm.transition(STATES.CONNECTING);
      fsm.transition(STATES.READY);
      bus.emit('auth:expired', {});
      expect(shellState.value).toBe(STATES.UNAUTHENTICATED);
    });

    it('ignores pipeline:complete when not in WORKING', () => {
      fsm.transition(STATES.CONNECTING);
      fsm.transition(STATES.READY);
      bus.emit('pipeline:complete', {});
      expect(shellState.value).toBe(STATES.READY);
    });

    it('auto-transitions CONNECTING → READY on auth:logged-in', () => {
      fsm.transition(STATES.CONNECTING);
      bus.emit('auth:logged-in', { user: { id: 1 } });
      expect(shellState.value).toBe(STATES.READY);
    });

    it('ignores auth:logged-in when not in CONNECTING', () => {
      fsm.transition(STATES.CONNECTING);
      fsm.transition(STATES.READY);
      bus.emit('auth:logged-in', {});
      expect(shellState.value).toBe(STATES.READY);
    });

    it('auto-transitions to UNAUTHENTICATED on auth:logged-out', () => {
      fsm.transition(STATES.CONNECTING);
      fsm.transition(STATES.READY);
      bus.emit('auth:logged-out', {});
      expect(shellState.value).toBe(STATES.UNAUTHENTICATED);
    });
  });
});
