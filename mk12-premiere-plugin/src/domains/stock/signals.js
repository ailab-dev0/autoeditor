import { signal, computed } from '@preact/signals';

/** @type {import('@preact/signals').Signal<Array<object>>} */
export const results = signal([]);

/** @type {import('@preact/signals').Signal<string>} */
export const query = signal('');

/** @type {import('@preact/signals').Signal<'pexels'|'pixabay'>} */
export const provider = signal('pexels');

/** @type {import('@preact/signals').Signal<string|null>} */
export const stockError = signal(null);

/** @type {import('@preact/signals').Signal<boolean>} */
export const isSearching = signal(false);

export const resultCount = computed(() => results.value.length);
