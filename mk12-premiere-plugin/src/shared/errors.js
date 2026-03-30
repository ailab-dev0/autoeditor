/**
 * Toast queue and error categorization.
 *
 * Four categories: validation, backend, transport, premiere.
 * Toast queue capped at 3, auto-dismiss after 5s.
 */
import { signal, computed } from '@preact/signals';

/** @type {import('@preact/signals').Signal<Array<{id: number, message: string, category: string, timestamp: number}>>} */
export const toasts = signal([]);

export const toastCount = computed(() => toasts.value.length);

let nextId = 1;
const AUTO_DISMISS_MS = 5000;
const MAX_TOASTS = 3;

/**
 * Categorize an error into one of four tiers.
 * @param {Error|string|{type?: string, status?: number}} err
 * @returns {'validation'|'backend'|'transport'|'premiere'}
 */
export function categorizeError(err) {
  if (!err) return 'backend';

  const msg = typeof err === 'string' ? err : err.message || '';
  const type = err.type || '';

  // Explicit type hints
  if (type === 'validation' || /required|invalid|must be/i.test(msg)) return 'validation';
  if (type === 'transport' || /fetch|network|timeout|websocket|disconnected/i.test(msg)) return 'transport';
  if (type === 'premiere' || /sequence|track|clip|marker|premiere|uxp/i.test(msg)) return 'premiere';

  // HTTP status codes
  if (err.status >= 400 && err.status < 500) return 'validation';
  if (err.status >= 500) return 'backend';

  return 'backend';
}

export function addToast(message, category = 'backend') {
  const id = nextId++;
  const timestamp = Date.now();
  toasts.value = [...toasts.value, { id, message, category, timestamp }].slice(-MAX_TOASTS);

  // Auto-dismiss
  setTimeout(() => dismissToast(id), AUTO_DISMISS_MS);

  return id;
}

export function dismissToast(id) {
  toasts.value = toasts.value.filter(t => t.id !== id);
}

export function clearToasts() {
  toasts.value = [];
}
