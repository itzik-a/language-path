/* Checking a typed answer: right, almost (one letter off), or wrong. Accents, harakat and kana kind are ignored. */
import type { Lang } from "../types";
import { autoTranslit, fold, foldArabic, foldGerman, foldLatin, foldLatinOnly, greekLetters, kataToHira, looseGreekLatin } from "./langs";
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

const ACCENTED: Lang[] = ["pl", "pt", "es", "fr", "it", "de", "nl", "el"];

/** The answer with accents taken off (alargó → alargo, jabłko → jablko, cœur → coeur, καλημέρα → καλημερα); in the other
 *  languages only on Latin letters, for answers typed as a transliteration (kitāb → kitab). */
export const foldAccents = (lang: Lang, s: string): string => (ACCENTED.includes(lang) ? foldLatin(s) : foldLatinOnly(s));

/** How close a typed line is to the real one, 0–1: letters the two share in order at the best alignment
 *  (longest common subsequence), against the length of both, so missing and extra letters both cost. */
export function likeness(typed: string, line: string): number {
  const a = [...typed], b = [...line];
  if (!a.length || !b.length) return 0;
  let prev = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    const cur = [0];
    for (let j = 1; j <= b.length; j++) cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    prev = cur;
  }
  return (2 * prev[b.length]) / (a.length + b.length);
}

export function check(lang: Lang, typed: string, answers: string[]): Verdict {
  let t = typed.trim();
  if (!t) return "wrong";
  const answersIn = answers.filter(Boolean);
  // Japanese in romaji: also against the word's own romaji (konnichiwa, not only konnichiha), before it turns into kana
  if (lang === "ja" && /[a-z]/i.test(t)) {
    const rt = foldLatinOnly(fold(lang, t));
    if (answersIn.some((a) => /[a-z]/i.test(a) && foldLatinOnly(fold(lang, a)) === rt)) return "right";
    t = toKana(t, { final: true });
  }
  const ft = fold(lang, t);
  const keys = answersIn.map((a) => fold(lang, a));
  if (keys.includes(ft)) return "right";
  // Greek and Russian typed in Latin letters: compared by transliteration (kalimera = καλημέρα, privet = привет).
  // Worked out from the answer as written too, so ё counts as yo (yozh = ёж), as the transliteration shows it.
  if ((lang === "el" || lang === "ru") && /[a-z]/i.test(ft) && !/[\p{Script=Greek}\p{Script=Cyrillic}]/u.test(ft)) {
    const raw = answersIn.map((a) => a.normalize("NFC").toLowerCase().replace(/[\s\p{P}]+/gu, ""));
    let lat = [...keys, ...raw].map((k) => foldLatin(autoTranslit(lang, k)!).replace(/'/g, ""));
    let typedLat = foldLatin(ft);
    // Greek: also the way Greeks spell it in Latin letters (geia, efharisto, kalhmera: η as h too), letter for letter or by sound
    if (lang === "el") { lat = [...lat, ...keys.map(greekLetters), ...keys.map((k) => greekLetters(k.replace(/η/g, "h")))].map(looseGreekLatin); typedLat = looseGreekLatin(typedLat); }
    if (lat.includes(typedLat)) return "right";
    if (lat.some((k) => k.length >= 4 && lev(k, typedLat) <= 1)) return "almost";
    return "wrong";
  }
  // German typed without umlauts or ß, written out (Strasse, Muell, schoen): right
  if (lang === "de" && keys.some((k) => foldGerman(k) === foldGerman(ft))) return "right";
  // missing accents are not a mistake (Polish ł ś, Portuguese ã ç é, Spanish á ñ, French é ç, Italian è, German ä ö ü, Dutch é ë, Greek τόνος): right
  const at = foldAccents(lang, ft), akeys = keys.map((k) => foldAccents(lang, k));
  if (akeys.includes(at)) return "right";
  if (lang === "ar" && keys.some((k) => foldArabic(k) === foldArabic(ft))) return "right";
  if (lang === "ja" && keys.some((k) => kataToHira(k) === kataToHira(ft))) return "right";
  if (akeys.some((k) => k.length >= 4 && lev(k, at) <= 1)) return "almost";
  return "wrong";
}
