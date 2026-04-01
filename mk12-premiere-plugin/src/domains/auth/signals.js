/**
 * Auth domain signals — token, user, login state.
 */
import { signal, computed } from '@preact/signals';

const stored = typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function'
  ? localStorage.getItem('editorlens:serverUrl')
  : null;

// Restore token from localStorage on startup
let storedToken = null;
let storedUser = null;
try {
  storedToken = localStorage.getItem('editorlens:token') || null;
  const u = localStorage.getItem('editorlens:user');
  if (u) storedUser = JSON.parse(u);
} catch (_) {}

/** @type {import('@preact/signals').Signal<string|null>} */
export const token = signal(storedToken);

/** @type {import('@preact/signals').Signal<object|null>} */
export const user = signal(storedUser);

export const isAuthenticated = computed(() => token.value !== null);

/** @type {import('@preact/signals').Signal<string|null>} */
export const loginError = signal(null);

/** @type {import('@preact/signals').Signal<string>} */
export const serverUrl = signal(stored || 'http://localhost:8000');
