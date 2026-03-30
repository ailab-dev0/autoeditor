/**
 * Typed event bus with whitelist and max listener support.
 * Stub — full implementation in a follow-up task.
 */
export function createEventBus() {
  const listeners = new Map();

  return {
    on(event, fn) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(fn);
    },
    off(event, fn) {
      listeners.get(event)?.delete(fn);
    },
    emit(event, data) {
      listeners.get(event)?.forEach(fn => fn(data));
    },
    clear() {
      listeners.clear();
    },
  };
}
