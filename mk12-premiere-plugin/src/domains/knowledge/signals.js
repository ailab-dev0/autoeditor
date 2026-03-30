import { signal } from '@preact/signals';

/** @type {import('@preact/signals').Signal<{nodes: Array<object>, edges: Array<object>}|null>} */
export const graphData = signal(null);

/** @type {import('@preact/signals').Signal<string|null>} */
export const selectedConcept = signal(null);

/** @type {import('@preact/signals').Signal<string|null>} */
export const knowledgeError = signal(null);
