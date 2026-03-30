import { describe, it, expect, beforeEach } from 'vitest';
import { createPipelineFsm, pipelineState } from '../../../src/domains/pipeline/fsm';
import { createEventBus } from '../../../src/shared/event-bus';

describe('Pipeline FSM', () => {
  let bus, fsm;

  beforeEach(() => {
    bus = createEventBus();
    pipelineState.value = 'idle';
    fsm = createPipelineFsm(bus);
  });

  describe('valid transitions', () => {
    it('idle → running', () => {
      fsm.transition('running');
      expect(pipelineState.value).toBe('running');
    });

    it('running → complete', () => {
      fsm.transition('running');
      fsm.transition('complete');
      expect(pipelineState.value).toBe('complete');
    });

    it('running → failed', () => {
      fsm.transition('running');
      fsm.transition('failed');
      expect(pipelineState.value).toBe('failed');
    });

    it('complete → idle', () => {
      fsm.transition('running');
      fsm.transition('complete');
      fsm.transition('idle');
      expect(pipelineState.value).toBe('idle');
    });

    it('failed → idle', () => {
      fsm.transition('running');
      fsm.transition('failed');
      fsm.transition('idle');
      expect(pipelineState.value).toBe('idle');
    });
  });

  describe('invalid transitions', () => {
    it('throws on idle → complete', () => {
      expect(() => fsm.transition('complete')).toThrow('Invalid pipeline transition');
    });

    it('throws on idle → failed', () => {
      expect(() => fsm.transition('failed')).toThrow('Invalid pipeline transition');
    });

    it('throws on running → idle', () => {
      fsm.transition('running');
      expect(() => fsm.transition('idle')).toThrow('Invalid pipeline transition');
    });
  });

  describe('canTransition', () => {
    it('returns true for valid', () => {
      expect(fsm.canTransition('running')).toBe(true);
    });

    it('returns false for invalid', () => {
      expect(fsm.canTransition('complete')).toBe(false);
    });
  });

  describe('events', () => {
    it('emits pipeline:started on idle → running', () => {
      const events = [];
      bus.on('pipeline:started', () => events.push('started'));
      fsm.transition('running');
      expect(events).toEqual(['started']);
    });

    it('emits pipeline:complete on running → complete', () => {
      const events = [];
      bus.on('pipeline:complete', () => events.push('complete'));
      fsm.transition('running');
      fsm.transition('complete');
      expect(events).toEqual(['complete']);
    });

    it('emits pipeline:error on running → failed', () => {
      const events = [];
      bus.on('pipeline:error', () => events.push('error'));
      fsm.transition('running');
      fsm.transition('failed');
      expect(events).toEqual(['error']);
    });
  });
});
