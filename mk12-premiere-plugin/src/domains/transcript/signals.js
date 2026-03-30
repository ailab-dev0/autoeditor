import { signal } from '@preact/signals';

/** @type {import('@preact/signals').Signal<{text: string, segments: Array<{start: number, end: number, text: string}>}|null>} */
export const transcript = signal(null);

/** @type {import('@preact/signals').Signal<string|null>} */
export const transcriptError = signal(null);

/** @type {import('@preact/signals').Signal<'srt'|'json'|'txt'>} */
export const exportFormat = signal('srt');
