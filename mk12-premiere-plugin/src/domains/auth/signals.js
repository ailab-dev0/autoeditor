/**
 * Auth domain signals — token, user, login state.
 */
import { signal, computed } from '@preact/signals';

const stored = typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function'
  ? localStorage.getItem('editorlens:serverUrl')
  : null;

/** @type {import('@preact/signals').Signal<string|null>} */
export const token = signal(null);

/** @type {import('@preact/signals').Signal<object|null>} */
export const user = signal(null);

export const isAuthenticated = computed(() => token.value !== null);

/** @type {import('@preact/signals').Signal<string|null>} */
export const loginError = signal(null);

/** @type {import('@preact/signals').Signal<string>} */
export const serverUrl = signal(stored || 'http://localhost:8000');
