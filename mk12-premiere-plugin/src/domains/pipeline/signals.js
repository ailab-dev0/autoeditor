/**
 * Pipeline domain signals — stage, progress, cost tracking.
 */
import { signal, computed } from '@preact/signals';

const STAGE_LABELS = {
  idle: 'Idle',
  transcription: 'Transcribing',
  analysis: 'Analyzing',
  scoring: 'Scoring',
  packaging: 'Packaging',
  complete: 'Complete',
};

/** @type {import('@preact/signals').Signal<'idle'|'transcription'|'analysis'|'scoring'|'packaging'|'complete'>} */
export const stage = signal('idle');

/** @type {import('@preact/signals').Signal<number>} percent 0-100 */
export const percent = signal(0);

/** @type {import('@preact/signals').Signal<number|null>} ETA in ms */
export const eta = signal(null);

/** @type {import('@preact/signals').Signal<number>} cost in cents */
export const cost = signal(0);

/** @type {import('@preact/signals').Signal<string|null>} */
export const pipelineError = signal(null);

export const isRunning = computed(() => stage.value !== 'idle' && stage.value !== 'complete');

export const stageLabel = computed(() => STAGE_LABELS[stage.value] || stage.value);

export const STAGES = Object.keys(STAGE_LABELS);
