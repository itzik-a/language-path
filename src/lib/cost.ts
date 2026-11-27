/* What a Claude request cost, from the token counts its response reports (an estimate: the Claude Console has the bill).
   Prices are US dollars per million tokens, first-party API rates as of 2026-11; cache reads are 0.1× and cache
   writes 1.25× the input price. A model not listed (a fallback the server picked) is priced like Opus 5. Pure, tested. */
import type { AppState } from "../types";

const PRICE: Record<string, [input: number, output: number]> = {
  "claude-opus-5-5": [4, 20],
  "claude-sonnet-5-5": [2, 10],
  "claude-haiku-5-5": [0.1, 0.5],
  "claude-opus-5": [5, 25],
  "claude-opus-4-8": [5, 25],
  "claude-sonnet-5": [2, 10],
};
const OTHER: [number, number] = [5, 25];
/** Haiku 5.5 costs more past 100K prompt tokens */
const HAIKU_LONG: [number, number] = [0.5, 2.5];

export interface TokenCounts {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

export function costUsd(model: string, u: TokenCounts): number {
  const input = u.input_tokens ?? 0, out = u.output_tokens ?? 0;
  const read = u.cache_read_input_tokens ?? 0, write = u.cache_creation_input_tokens ?? 0;
  let [inP, outP] = PRICE[model] ?? OTHER;
  if (model === "claude-haiku-5-5" && input + read + write > 100_000) [inP, outP] = HAIKU_LONG;
  return (input * inP + read * inP * 0.1 + write * inP * 1.25 + out * outP) / 1e6;
}

/** "2026-11": the month a usage record counts toward (local time). */
export const monthOf = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };

/** Every device's records for this month, added up; `last` is the newest call on any device (ms, 0 = never). */
export function usageSummary(s: Pick<AppState, "usage">, now = Date.now()) {
  const month = monthOf(now);
  let usd = 0, calls = 0, last = 0;
  for (const u of s.usage) {
    last = Math.max(last, u.last);
    if (u.month === month && !u.deletedAt) { usd += u.usd; calls += u.calls; }
  }
  return { usd, calls, last };
}

/** "$0.09"; under a cent shows as "under $0.01", nothing as "$0.00". */
export function money(usd: number): string {
  if (usd > 0 && usd < 0.005) return "under $0.01";
  return `$${usd.toFixed(2)}`;
}
