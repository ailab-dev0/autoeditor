/**
 * Transport layer — HTTP + WebSocket + polling fallback.
 * Stub — full implementation in a follow-up task.
 */
import { signal } from '@preact/signals';

/** @type {import('@preact/signals').Signal<'disconnected'|'connecting'|'connected'|'reconnecting'>} */
export const connectionState = signal('disconnected');

/** @type {import('@preact/signals').Signal<number>} */
export const reconnectAttempt = signal(0);

export function createTransport(bus) {
  return {
    configure({ baseUrl, wsUrl } = {}) {},
    connect() {
      connectionState.value = 'connecting';
    },
    disconnect() {
      connectionState.value = 'disconnected';
      reconnectAttempt.value = 0;
    },
  };
}
