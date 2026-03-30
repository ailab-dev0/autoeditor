/**
 * Transport layer — HTTP + WebSocket + polling fallback.
 * Stub — full implementation in a follow-up task.
 */
export function createTransport(bus) {
  return {
    configure({ baseUrl, wsUrl } = {}) {},
    connect() {},
    disconnect() {},
  };
}
