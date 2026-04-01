export async function register() {
  // Polyfill localStorage for SSR — some dependencies access it at import time.
  // Node 22+ may expose a broken localStorage via --localstorage-file; detect that too.
  const ls = globalThis.localStorage;
  if (!ls || typeof ls.getItem !== "function") {
    const store = new Map<string, string>();
    (globalThis as any).localStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, String(value)),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
      get length() { return store.size; },
      key: (i: number) => [...store.keys()][i] ?? null,
    };
  }
}
