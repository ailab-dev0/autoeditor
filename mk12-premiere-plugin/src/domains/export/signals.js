import { signal, computed } from '@preact/signals';

/** @type {import('@preact/signals').Signal<'edit_package'|'premiere'|'resolve'|'fcp'|'srt'|'json'|'csv'>} */
export const exportFormat = signal('edit_package');

/** @type {import('@preact/signals').Signal<{percent: number, label: string}|null>} */
export const exportProgress = signal(null);

/** @type {import('@preact/signals').Signal<string|null>} */
export const exportError = signal(null);

/** @type {import('@preact/signals').Signal<string|null>} */
export const exportOutput = signal(null);

export const isExporting = computed(() => exportProgress.value !== null);
