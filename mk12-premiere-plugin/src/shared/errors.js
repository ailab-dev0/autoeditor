/**
 * Toast queue and error categorization.
 * Stub — full implementation in a follow-up task.
 */
import { signal, computed } from '@preact/signals';

/** @type {import('@preact/signals').Signal<Array<{id: number, message: string, category: string}>>} */
export const toasts = signal([]);

export const toastCount = computed(() => toasts.value.length);

let nextId = 1;

export function addToast(message, category = 'backend') {
  toasts.value = [...toasts.value, { id: nextId++, message, category }].slice(-3);
}

export function dismissToast(id) {
  toasts.value = toasts.value.filter(t => t.id !== id);
}

export function clearToasts() {
  toasts.value = [];
}
