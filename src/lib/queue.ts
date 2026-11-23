/* What to review next. Pure functions over the state, so they can be tested.
   - Cards in a learning step that are due now come first (the short "again in 1 minute" steps).
   - Then cards due today, most overdue first, at most one per word a day ("siblings" wait for tomorrow).
   - New cards (from words started today) are mixed in: one after every few reviews.
   - When nothing else is left, a learning step due within 20 minutes is shown early. */
import type { AppState, Card, Lang } from "../types";
import { DAY, endOfToday, today, ymd } from "./dates";

export const SCRIPT_NEW_PER_DAY = 12;
const AHEAD_MS = 20 * 60_000;

const startOfToday = () => endOfToday() - DAY + 1;
const reviewedToday = (c: Card, since: number) => c.log.some(([t]) => t >= since);

export function activeCards(s: AppState, lang: Lang): Card[] {
  const words = new Map(s.words.map((w) => [w.id, w]));
  return s.cards.filter((c) => {
    if (c.lang !== lang || c.deletedAt || c.suspended) return false;
    if (!c.wordId) return true;
    const w = words.get(c.wordId);
    return !!w && !w.deletedAt && w.status === "learning";
  });
}

export interface QueueInfo { learningNow: Card[]; due: Card[]; fresh: Card[]; ahead: Card[] }

export function queue(s: AppState, lang: Lang, now = Date.now()): QueueInfo {
  const since = startOfToday();
  const eod = endOfToday();
  const cards = activeCards(s, lang);
  const touched = new Set<string>(); // words with a card answered today
  for (const c of cards) if (c.wordId && reviewedToday(c, since)) touched.add(c.wordId);

  const learningNow: Card[] = [], due: Card[] = [], fresh: Card[] = [], ahead: Card[] = [];
  const dueWords = new Set<string>();
  const sorted = [...cards].sort((a, b) => a.srs.due - b.srs.due);
  let scriptFreshToday = cards.filter((c) => c.kind === "script" && c.log.length && c.log[0][0] >= since).length;

  for (const c of sorted) {
    const st = c.srs.state;
    if (st === 1 || st === 3) {
      if (c.srs.due <= now) learningNow.push(c);
      else if (c.srs.due <= now + AHEAD_MS) ahead.push(c);
      continue;
    }
    if (st === 2) {
      if (c.srs.due > eod) continue;
      if (c.wordId) {
        if (dueWords.has(c.wordId) || touched.has(c.wordId)) continue;
        dueWords.add(c.wordId);
      }
      due.push(c);
      continue;
    }
    // new
    if (c.kind === "script") {
      if (scriptFreshToday >= SCRIPT_NEW_PER_DAY) continue;
      scriptFreshToday++;
      fresh.push(c);
      continue;
    }
    if (c.wordId && (touched.has(c.wordId) || dueWords.has(c.wordId))) continue;
    if (c.wordId) dueWords.add(c.wordId);
    fresh.push(c);
  }
  fresh.sort((a, b) => order(a) - order(b));
  return { learningNow, due, fresh, ahead };
}

/** New cards: recognise before listen before cloze before say. */
const order = (c: Card) => ({ script: 0, recog: 1, listen: 2, cloze: 3, say: 4 })[c.kind] * 1e13 + c.updatedAt;

/** The next card to show, given how many were answered in this session. */
export function nextCard(s: AppState, lang: Lang, answered: number, now = Date.now()): Card | null {
  const q = queue(s, lang, now);
  if (q.learningNow.length) return q.learningNow[0];
  const mixNew = q.fresh.length && (!q.due.length || answered % 4 === 3);
  if (mixNew) return q.fresh[0];
  if (q.due.length) return q.due[0];
  if (q.fresh.length) return q.fresh[0];
  if (q.ahead.length) return q.ahead[0];
  return null;
}

export const remaining = (q: QueueInfo) => q.learningNow.length + q.due.length + q.fresh.length;

/** How many new words may still start today. */
export function newWordsLeft(s: AppState, lang: Lang): number {
  const t = today();
  const started = s.words.filter((w) => w.lang === lang && !w.deletedAt && w.startedOn === t && w.source !== "chat").length;
  return Math.max(0, s.settings.lang[lang].newPerDay - started);
}

/** Reviews due on each of the next `days` days (index 0 = today, including overdue). */
export function forecast(s: AppState, lang: Lang, days = 14): number[] {
  const out = Array(days).fill(0);
  const t0 = startOfToday();
  for (const c of activeCards(s, lang)) {
    if (c.srs.state === 0) continue;
    const i = Math.max(0, Math.floor((c.srs.due - t0) / DAY));
    if (i < days) out[i]++;
  }
  return out;
}

export const dayOf = (t: number) => ymd(new Date(t));
