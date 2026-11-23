/* Progress from the day logs (summed over devices) and card reviews. */
import type { AppState, Lang } from "../types";
import { addDays, DAY, endOfToday, today } from "./dates";

export interface DayTotal { date: string; reviews: number; newWords: number; readSec: number; talkSec: number; turns: number }

export function dayTotals(s: AppState, lang: Lang | null, days = 7): DayTotal[] {
  const t = today();
  const dates = Array.from({ length: days }, (_, i) => addDays(t, i - days + 1));
  const by = new Map(dates.map((d) => [d, { date: d, reviews: 0, newWords: 0, readSec: 0, talkSec: 0, turns: 0 }]));
  for (const l of s.days) {
    if (l.deletedAt || (lang && l.lang !== lang)) continue;
    const x = by.get(l.date);
    if (!x) continue;
    x.reviews += l.reviews; x.newWords += l.newWords; x.readSec += l.readSec; x.talkSec += l.talkSec; x.turns += l.turns;
  }
  return dates.map((d) => by.get(d)!);
}

const active = (d: DayTotal) => d.reviews > 0 || d.readSec >= 60 || d.turns > 0;

/** Days in a row with some practice, ending today (or yesterday, if today hasn't started yet). */
export function streak(s: AppState, lang: Lang | null): number {
  const days = dayTotals(s, lang, 400);
  let i = days.length - 1;
  if (!active(days[i])) i--;
  let n = 0;
  while (i >= 0 && active(days[i])) { n++; i--; }
  return n;
}

/** Share of reviews (not first sightings) answered Hard or better in the last 30 days. */
export function recallRate(s: AppState, lang: Lang): { rate: number; n: number } {
  const since = endOfToday() - 30 * DAY;
  let ok = 0, n = 0;
  for (const c of s.cards) {
    if (c.lang !== lang || c.deletedAt) continue;
    c.log.forEach(([t, g], i) => { if (i > 0 && t >= since) { n++; if (g > 1) ok++; } });
  }
  return { rate: n ? ok / n : 0, n };
}

export const minutes = (d: DayTotal) => Math.round((d.readSec + d.talkSec) / 60);
