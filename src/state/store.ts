/* App state: one object in memory, saved to IndexedDB (localStorage is capped at ~5 MB on Safari).
   Every change goes through update() (usually from src/state/actions.ts). New fields must be optional in
   normalize() so older saved copies still load. */
import { openDB, type IDBPDatabase } from "idb";
import { useSyncExternalStore } from "react";
import { defaultSettings, seedState } from "../data/seed";
import { LANGS, type AppState, type LangSettings, type Settings } from "../types";

export type { AppState };

const DB = "languagePath";
const STORE = "kv";
const KEY = "state";

export const defaults = (): AppState => seedState();

const arr = <T,>(v: unknown, d: T[]): T[] => (Array.isArray(v) ? (v as T[]) : d);
const obj = <T extends object>(v: unknown): Partial<T> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Partial<T>) : {});

function normSettings(v: unknown): Settings {
  const d = defaultSettings();
  const x = obj<Settings>(v);
  const lang = obj<Settings["lang"]>(x.lang);
  return {
    lang: Object.fromEntries(LANGS.map((l) => [l, { ...d.lang[l], ...obj<LangSettings>(lang[l]) }])) as Settings["lang"],
    updatedAt: x.updatedAt || 0,
  };
}

/** Starter items shipped after this copy was made are added (removed ones stay removed: they're still there, soft-deleted). */
function withSeeds<T extends { id: string }>(have: T[], seeds: T[]): T[] {
  const ids = new Set(have.map((x) => x.id));
  const missing = seeds.filter((x) => !ids.has(x.id));
  return missing.length ? [...have, ...missing] : have;
}

export function normalize(s: unknown): AppState {
  const d = defaults();
  if (!s || typeof s !== "object") return d;
  const x = s as Partial<AppState>;
  return {
    v: 1,
    words: withSeeds(arr(x.words, d.words), d.words),
    cards: arr(x.cards, d.cards).map((c) => ({ ...c, log: Array.isArray(c.log) ? c.log : [] })),
    texts: withSeeds(arr(x.texts, d.texts), d.texts),
    chats: arr(x.chats, d.chats),
    days: arr(x.days, d.days),
    settings: normSettings(x.settings),
    updatedAt: x.updatedAt || 0,
  };
}

let db: Promise<IDBPDatabase> | null = null;
const getDb = () => (db ??= openDB(DB, 1, { upgrade(d) { d.createObjectStore(STORE); } }));

let state: AppState = defaults();
const listeners = new Set<() => void>();
const localListeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Load the saved copy (call once before the first render). */
export async function initStore() {
  try {
    const saved = await (await getDb()).get(STORE, KEY);
    if (saved) state = normalize(saved);
  } catch (e) { console.warn("[store] load failed", e); }
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
let saving: Promise<void> = Promise.resolve();
const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("languagePath") : null;

function saveSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 250);
}

/** Write to IndexedDB now (also when the app goes to the background). */
export function flush(): Promise<void> {
  clearTimeout(saveTimer);
  const snapshot = state;
  saving = saving.then(async () => {
    try {
      await (await getDb()).put(STORE, snapshot, KEY);
      channel?.postMessage("saved");
    } catch (e) { console.warn("[store] save failed", e); }
  });
  return saving;
}

export const getState = () => state;

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

/** Apply a local change: copy, mutate, stamp, save, notify. */
export function update(fn: (draft: AppState) => void) {
  const next = structuredClone(state);
  fn(next);
  next.updatedAt = Date.now();
  state = next;
  saveSoon();
  emit();
  localListeners.forEach((l) => l());
}

/** Called after changes made on this device (not after sync replaces state). */
export function onLocalChange(l: () => void) {
  localListeners.add(l);
  return () => { localListeners.delete(l); };
}

/** Replace state wholesale (sync brought a newer copy, or a backup was merged in: `local` makes it sync out). */
export function replaceState(s: unknown, opts: { local?: boolean } = {}) {
  state = normalize(s);
  saveSoon();
  emit();
  if (opts.local) localListeners.forEach((l) => l());
}

export function useAppState() {
  return useSyncExternalStore(subscribe, getState);
}

/* Keep two open tabs on the same device in step. */
channel?.addEventListener("message", async () => {
  try {
    const saved = await (await getDb()).get(STORE, KEY);
    if (saved && (saved as AppState).updatedAt > state.updatedAt) { state = normalize(saved); emit(); }
  } catch { /* ignore */ }
});

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") void flush(); });
}
