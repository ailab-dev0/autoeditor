/**
 * Timeline domain signals — transaction state, preview, undo, progress.
 */
import { signal, computed } from '@preact/signals';

/** @type {import('@preact/signals').Signal<'idle'|'previewing'|'applying'|'applied'|'rolled-back'|'failed'>} */
export const transactionState = signal('idle');

/** @type {import('@preact/signals').Signal<object|null>} */
export const transactionPreview = signal(null);

/** @type {import('@preact/signals').Signal<Array<object>>} */
export const undoStack = signal([]);

/** @type {import('@preact/signals').Signal<{current: number, total: number, label: string}|null>} */
export const applyProgress = signal(null);

/** @type {import('@preact/signals').Signal<string|null>} */
export const timelineError = signal(null);

export const canApply = computed(() => transactionState.value === 'previewing');

export const canRollback = computed(() =>
  transactionState.value === 'applied' && undoStack.value.length > 0
);
