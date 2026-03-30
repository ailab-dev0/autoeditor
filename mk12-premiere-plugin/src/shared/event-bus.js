/**
 * EventBus — Typed pub/sub for EditorLens v2.
 *
 * Factory function returning a bus instance with whitelisted events,
 * bounded listeners, wildcard debug support, and safe error isolation.
 */

const VALID_EVENTS = Object.freeze([
  // shell
  'shell:transitioned',

  // auth
  'auth:login', 'auth:logged-in',
  'auth:logout', 'auth:logged-out',
  'auth:refresh', 'auth:refreshed',
  'auth:expired', 'auth:error',

  // pipeline
  'pipeline:start', 'pipeline:started',
  'pipeline:complete', 'pipeline:cancelled',
  'pipeline:error',

  // segments
  'segments:fetch', 'segments:fetched',
  'segments:approve', 'segments:approved',
  'segments:reject', 'segments:rejected',
  'segments:error',

  // timeline
  'timeline:preview', 'timeline:previewed',
  'timeline:apply', 'timeline:applied',
  'timeline:rollback', 'timeline:rolled-back',
  'timeline:error',

  // stock
  'stock:search', 'stock:results',
  'stock:error',

  // transcript
  'transcript:fetch', 'transcript:fetched',
  'transcript:error',

  // export
  'export:start', 'export:completed',
  'export:error',

  // knowledge
  'knowledge:fetch', 'knowledge:fetched',
  'knowledge:error',

  // websocket raw
  'ws:analysis:progress', 'ws:analysis:complete',
  'ws:error',
]);

const WILDCARD = '*';
const MAX_LISTENERS_PER_EVENT = 20;

function createEventBus(options = {}) {
  const listeners = new Map();
  const debug = options.debug === true;
  let destroyed = false;

  function assertAlive() {
    if (destroyed) throw new Error('EventBus: instance has been destroyed.');
  }

  function validateEvent(event) {
    if (event !== WILDCARD && !VALID_EVENTS.includes(event)) {
      throw new Error(
        `EventBus: unknown event "${event}". ` +
        `Valid: ${VALID_EVENTS.join(', ')}, or "${WILDCARD}".`
      );
    }
  }

  function validateEmitEvent(event) {
    if (!VALID_EVENTS.includes(event)) {
      throw new Error(
        `EventBus: cannot emit unknown event "${event}".`
      );
    }
  }

  const bus = {
    on(event, handler) {
      assertAlive();
      validateEvent(event);
      if (typeof handler !== 'function') {
        throw new TypeError('EventBus: handler must be a function.');
      }

      let set = listeners.get(event);
      if (!set) {
        set = new Set();
        listeners.set(event, set);
      }

      if (set.size >= MAX_LISTENERS_PER_EVENT) {
        throw new Error(
          `EventBus: listener limit (${MAX_LISTENERS_PER_EVENT}) reached for "${event}".`
        );
      }

      set.add(handler);
      return () => bus.off(event, handler);
    },

    off(event, handler) {
      assertAlive();
      const set = listeners.get(event);
      if (set) {
        set.delete(handler);
        if (set.size === 0) listeners.delete(event);
      }
    },

    once(event, handler) {
      assertAlive();
      if (typeof handler !== 'function') {
        throw new TypeError('EventBus: handler must be a function.');
      }
      const wrapper = (data) => {
        bus.off(event, wrapper);
        handler(data);
      };
      wrapper._original = handler;
      return bus.on(event, wrapper);
    },

    emit(event, data) {
      assertAlive();
      validateEmitEvent(event);

      if (debug) {
        console.log(`[EventBus] ${event}`, data !== undefined ? data : '');
      }

      const exact = listeners.get(event);
      if (exact) {
        for (const fn of exact) {
          try { fn(data); } catch (err) {
            console.error(`[EventBus] Error in handler for "${event}":`, err);
          }
        }
      }

      if (event !== WILDCARD) {
        const wild = listeners.get(WILDCARD);
        if (wild) {
          for (const fn of wild) {
            try { fn({ event, data }); } catch (err) {
              console.error(`[EventBus] Error in wildcard handler:`, err);
            }
          }
        }
      }
    },

    listenerCount(event) {
      const set = listeners.get(event);
      return set ? set.size : 0;
    },

    clear() {
      listeners.clear();
    },

    destroy() {
      listeners.clear();
      destroyed = true;
    },
  };

  return bus;
}

export { createEventBus, VALID_EVENTS, WILDCARD, MAX_LISTENERS_PER_EVENT };
