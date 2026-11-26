/* Checking a typed answer: right, almost (accents / one letter off), or wrong. Harakat and kana kind are ignored. */
import type { Lang } from "../types";
import { autoTranslit, fold, foldArabic, foldGerman, foldLatin, kataToHira } from "./langs";
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
  // Greek and Russian typed in Latin letters: compared by transliteration (kalimera = καλημέρα, privet = привет)
  if ((lang === "el" || lang === "ru") && /[a-z]/i.test(ft) && !/[\p{Script=Greek}\p{Script=Cyrillic}]/u.test(ft)) {
    const lat = keys.map((k) => foldLatin(autoTranslit(lang, k)!).replace(/'/g, ""));
    if (lat.includes(foldLatin(ft))) return "right";
    if (lat.some((k) => k.length >= 4 && lev(k, foldLatin(ft)) <= 1)) return "almost";
    return "wrong";
  }
  // German typed without umlauts or ß, written out (Strasse, Muell, schoen): right
  if (lang === "de" && keys.some((k) => foldGerman(k) === foldGerman(ft))) return "right";
  // missing accents (Polish ł ś, Portuguese ã ç é, Spanish á ñ, French é ç, Italian è, German ä ö ü, Dutch é ë, Greek τόνος): almost
  if ((lang === "pl" || lang === "pt" || lang === "es" || lang === "fr" || lang === "it" || lang === "de" || lang === "nl" || lang === "el") && keys.some((k) => foldLatin(k) === foldLatin(ft))) return "almost";
  if (lang === "ar" && keys.some((k) => foldArabic(k) === foldArabic(ft))) return "right";
  if (lang === "ja" && keys.some((k) => kataToHira(k) === kataToHira(ft))) return "right";
  if (keys.some((k) => k.length >= 4 && lev(k, ft) <= 1)) return "almost";
  return "wrong";
}
