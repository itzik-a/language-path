/* Merging two copies of the state (this device and the gist). Type-only imports, so it can be tested alone.
   - every list: per item, the newer `updatedAt` wins (soft deletes win the same way)
   - cards: the winner also gets every review either copy has (logs unioned by time), so two devices reviewing
     offline lose no history
   - settings: the copy with the newer `settings.updatedAt` */
import type { AppState, Card } from "../types";

function byId<T extends { id: string; updatedAt: number }>(a: T[], b: T[], join?: (win: T, lose: T) => T): T[] {
  const out = new Map<string, T>();
  for (const x of a) out.set(x.id, x);
  for (const y of b) {
    const x = out.get(y.id);
    if (!x) { out.set(y.id, y); continue; }
    const [win, lose] = (y.updatedAt || 0) > (x.updatedAt || 0) ? [y, x] : [x, y];
    out.set(y.id, join ? join(win, lose) : win);
  }
  return [...out.values()];
}

function joinCards(win: Card, lose: Card): Card {
  if (!lose.log.length) return win;
  const seen = new Set(win.log.map(([t]) => t));
  const extra = lose.log.filter(([t]) => !seen.has(t));
  return extra.length ? { ...win, log: [...win.log, ...extra].sort((p, q) => p[0] - q[0]) } : win;
}

export function merge(local: AppState, remote: AppState): AppState {
  return {
    v: 1,
    words: byId(local.words, remote.words),
    cards: byId(local.cards, remote.cards, joinCards),
    texts: byId(local.texts, remote.texts),
    chats: byId(local.chats, remote.chats),
    days: byId(local.days, remote.days),
    settings: (remote.settings.updatedAt || 0) > (local.settings.updatedAt || 0) ? remote.settings : local.settings,
    updatedAt: Math.max(local.updatedAt || 0, remote.updatedAt || 0),
  };
}

/** JSON with object keys sorted and lists in id order, so two copies with the same content compare equal. */
export function serialize(v: unknown): string {
  return JSON.stringify(v, (_k, x: unknown) => {
    if (Array.isArray(x) && x.length && x.every((i) => i && typeof i === "object" && typeof (i as { id?: unknown }).id === "string")) {
      return [...x].sort((a, b) => ((a as { id: string }).id < (b as { id: string }).id ? -1 : 1));
    }
    return x && typeof x === "object" && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : x;
  });
}
