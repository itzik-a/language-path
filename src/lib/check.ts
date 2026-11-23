/* Checking a typed answer: right, almost (accents / harakat / one letter off), or wrong. */
import type { Lang } from "../types";
import { fold, foldArabic, foldLatin, kataToHira } from "./langs";
import { toKana } from "./romaji";

export type Verdict = "right" | "almost" | "wrong";

function lev(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m || !n) return m || n;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}

export function check(lang: Lang, typed: string, answers: string[]): Verdict {
  let t = typed.trim();
  if (!t) return "wrong";
  if (lang === "ja" && /[a-z]/i.test(t)) t = toKana(t, { final: true });
  const ft = fold(lang, t);
  const keys = answers.filter(Boolean).map((a) => fold(lang, a));
  if (keys.includes(ft)) return "right";
  if (lang === "pl" && keys.some((k) => foldLatin(k) === foldLatin(ft))) return "almost";
  if (lang === "ar" && keys.some((k) => foldArabic(k) === foldArabic(ft))) return "right";
  if (lang === "ja" && keys.some((k) => kataToHira(k) === kataToHira(ft))) return "right";
  if (keys.some((k) => k.length >= 4 && lev(k, ft) <= 1)) return "almost";
  return "wrong";
}
