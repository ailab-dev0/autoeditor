import { describe, it, expect, vi } from 'vitest';
import { createEventBus, VALID_EVENTS, WILDCARD, MAX_LISTENERS_PER_EVENT } from '../../src/shared/event-bus';

describe('EventBus', () => {
  it('emits and receives events', () => {
    const bus = createEventBus();
    const handler = vi.fn();
    bus.on('auth:login', handler);
    bus.emit('auth:login', { user: 'test' });
    expect(handler).toHaveBeenCalledWith({ user: 'test' });
  });

  it('rejects unknown events on subscribe', () => {
    const bus = createEventBus();
    expect(() => bus.on('bogus:event', () => {})).toThrow('unknown event');
  });

  it('rejects unknown events on emit', () => {
    const bus = createEventBus();
    expect(() => bus.emit('bogus:event')).toThrow('cannot emit unknown event');
  });

  it('cannot emit wildcard', () => {
    const bus = createEventBus();
    expect(() => bus.emit(WILDCARD)).toThrow();
  });

  it('enforces listener limit', () => {
    const bus = createEventBus();
    for (let i = 0; i < MAX_LISTENERS_PER_EVENT; i++) {
      bus.on('auth:login', () => {});
    }
    expect(() => bus.on('auth:login', () => {})).toThrow('listener limit');
  });

  it('wildcard receives all events', () => {
    const bus = createEventBus();
    const handler = vi.fn();
    bus.on(WILDCARD, handler);
    bus.emit('auth:login', { a: 1 });
    bus.emit('pipeline:start', { b: 2 });
    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler).toHaveBeenCalledWith({ event: 'auth:login', data: { a: 1 } });
    expect(handler).toHaveBeenCalledWith({ event: 'pipeline:start', data: { b: 2 } });
  });

  it('off removes a listener', () => {
    const bus = createEventBus();
    const handler = vi.fn();
    bus.on('auth:login', handler);
    bus.off('auth:login', handler);
    bus.emit('auth:login');
    expect(handler).not.toHaveBeenCalled();
  });

  it('on() returns disposer', () => {
    const bus = createEventBus();
    const handler = vi.fn();
    const dispose = bus.on('auth:login', handler);
    dispose();
    bus.emit('auth:login');
    expect(handler).not.toHaveBeenCalled();
  });

  it('once fires handler only once', () => {
    const bus = createEventBus();
    const handler = vi.fn();
    bus.once('pipeline:start', handler);
    bus.emit('pipeline:start', 'first');
    bus.emit('pipeline:start', 'second');
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith('first');
  });

  it('isolates handler errors', () => {
    const bus = createEventBus();
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const bad = () => { throw new Error('boom'); };
    const good = vi.fn();
    bus.on('auth:login', bad);
    bus.on('auth:login', good);
    bus.emit('auth:login', 'data');
    expect(good).toHaveBeenCalledWith('data');
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('destroy prevents further use', () => {
    const bus = createEventBus();
    bus.destroy();
    expect(() => bus.on('auth:login', () => {})).toThrow('destroyed');
    expect(() => bus.emit('auth:login')).toThrow('destroyed');
  });

  it('listenerCount reports correctly', () => {
    const bus = createEventBus();
    expect(bus.listenerCount('auth:login')).toBe(0);
    bus.on('auth:login', () => {});
    bus.on('auth:login', () => {});
    expect(bus.listenerCount('auth:login')).toBe(2);
  });

  it('clear removes all listeners without destroying', () => {
    const bus = createEventBus();
    bus.on('auth:login', () => {});
    bus.clear();
    expect(bus.listenerCount('auth:login')).toBe(0);
    // Still usable after clear
    const handler = vi.fn();
    bus.on('auth:login', handler);
    bus.emit('auth:login');
    expect(handler).toHaveBeenCalled();
  });

  it('VALID_EVENTS includes all expected domains', () => {
    const domains = ['shell', 'auth', 'pipeline', 'segments', 'timeline', 'stock', 'transcript', 'export', 'knowledge', 'ws'];
    for (const domain of domains) {
      const hasEvent = VALID_EVENTS.some(e => e.startsWith(`${domain}:`));
      expect(hasEvent, `missing events for domain: ${domain}`).toBe(true);
    }
  });
});
