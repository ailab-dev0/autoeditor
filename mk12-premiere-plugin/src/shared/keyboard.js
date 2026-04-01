import { signal } from '@preact/signals';

export const keyboardEnabled = signal(true);

const handlers = new Map();

export function onKey(key, callback) {
  handlers.set(key.toLowerCase(), callback);
  return () => handlers.delete(key.toLowerCase());
}

export function handleKeyDown(e) {
  if (!keyboardEnabled.value) return;
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SP-TEXTFIELD') return;
  const handler = handlers.get(e.key.toLowerCase());
  if (handler) {
    e.preventDefault();
    handler(e);
  }
}

export function clearKeys() {
  handlers.clear();
}
