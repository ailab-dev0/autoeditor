import { describe, it, expect, beforeEach } from 'vitest';
import { createTimelineFsm, timelineState } from '../../../src/domains/timeline/fsm';
import { createEventBus } from '../../../src/shared/event-bus';

describe('Timeline FSM', () => {
  let bus, fsm;

  beforeEach(() => {
    bus = createEventBus();
    timelineState.value = 'idle';
    fsm = createTimelineFsm(bus);
  });

  describe('valid transitions', () => {
    it('idle → previewing', () => {
      fsm.transition('previewing');
      expect(timelineState.value).toBe('previewing');
    });

    it('previewing → applying', () => {
      fsm.transition('previewing');
      fsm.transition('applying');
      expect(timelineState.value).toBe('applying');
    });

    it('previewing → idle (cancel)', () => {
      fsm.transition('previewing');
      fsm.transition('idle');
      expect(timelineState.value).toBe('idle');
    });

    it('applying → applied', () => {
      fsm.transition('previewing');
      fsm.transition('applying');
      fsm.transition('applied');
      expect(timelineState.value).toBe('applied');
    });

    it('applying → failed', () => {
      fsm.transition('previewing');
      fsm.transition('applying');
      fsm.transition('failed');
      expect(timelineState.value).toBe('failed');
    });

    it('applied → rolled-back', () => {
      fsm.transition('previewing');
      fsm.transition('applying');
      fsm.transition('applied');
      fsm.transition('rolled-back');
      expect(timelineState.value).toBe('rolled-back');
    });

    it('applied → idle', () => {
      fsm.transition('previewing');
      fsm.transition('applying');
      fsm.transition('applied');
      fsm.transition('idle');
      expect(timelineState.value).toBe('idle');
    });

    it('rolled-back → idle', () => {
      fsm.transition('previewing');
      fsm.transition('applying');
      fsm.transition('applied');
      fsm.transition('rolled-back');
      fsm.transition('idle');
      expect(timelineState.value).toBe('idle');
    });

    it('failed → idle', () => {
      fsm.transition('previewing');
      fsm.transition('applying');
      fsm.transition('failed');
      fsm.transition('idle');
      expect(timelineState.value).toBe('idle');
    });
  });

  describe('invalid transitions', () => {
    it('throws on idle → applied', () => {
      expect(() => fsm.transition('applied')).toThrow('Invalid timeline transition');
    });

    it('throws on previewing → applied', () => {
      fsm.transition('previewing');
      expect(() => fsm.transition('applied')).toThrow('Invalid timeline transition');
    });

    it('throws on applying → idle', () => {
      fsm.transition('previewing');
      fsm.transition('applying');
      expect(() => fsm.transition('idle')).toThrow('Invalid timeline transition');
    });
  });

  describe('events', () => {
    it('emits timeline:previewed on idle → previewing', () => {
      const events = [];
      bus.on('timeline:previewed', () => events.push('previewed'));
      fsm.transition('previewing');
      expect(events).toEqual(['previewed']);
    });

    it('emits timeline:applied on applying → applied', () => {
      const events = [];
      bus.on('timeline:applied', () => events.push('applied'));
      fsm.transition('previewing');
      fsm.transition('applying');
      fsm.transition('applied');
      expect(events).toEqual(['applied']);
    });

    it('emits timeline:rolled-back on applied → rolled-back', () => {
      const events = [];
      bus.on('timeline:rolled-back', () => events.push('rolled-back'));
      fsm.transition('previewing');
      fsm.transition('applying');
      fsm.transition('applied');
      fsm.transition('rolled-back');
      expect(events).toEqual(['rolled-back']);
    });

    it('emits timeline:error on applying → failed', () => {
      const events = [];
      bus.on('timeline:error', () => events.push('error'));
      fsm.transition('previewing');
      fsm.transition('applying');
      fsm.transition('failed');
      expect(events).toEqual(['error']);
    });
  });
});
