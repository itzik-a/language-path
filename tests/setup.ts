/* Browser bits the app touches at import time, for Vitest's Node environment. */
import "fake-indexeddb/auto";

const mem = new Map<string, string>();
const g = globalThis as unknown as Record<string, unknown>;
g.localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => { mem.set(k, String(v)); },
  removeItem: (k: string) => { mem.delete(k); },
  clear: () => mem.clear(),
  key: (i: number) => [...mem.keys()][i] ?? null,
  get length() { return mem.size; },
};
if (!g.window) g.window = globalThis;
if (!g.addEventListener) g.addEventListener = () => {};
