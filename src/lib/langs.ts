/* What differs between the three languages: names, codes, direction, script helpers. */
import type { Lang } from "../types";

export interface LangInfo {
  id: Lang;
  name: string;
  native: string;
  /** one glyph for the switcher */
  mark: string;
  /** BCP 47 for speech and lang="" */
  bcp: string;
  dir: "ltr" | "rtl";
  /** words are separated by spaces */
  spaces: boolean;
}

export const LANG: Record<Lang, LangInfo> = {
  ja: { id: "ja", name: "Japanese", native: "日本語", mark: "あ", bcp: "ja-JP", dir: "ltr", spaces: false },
  pl: { id: "pl", name: "Polish", native: "polski", mark: "Pl", bcp: "pl-PL", dir: "ltr", spaces: true },
  ar: { id: "ar", name: "Arabic", native: "العربية", mark: "ع", bcp: "ar-SA", dir: "rtl", spaces: true },
};

/** Arabic harakat, tanwin, shadda, sukun, superscript alef, tatweel. */
const HARAKAT = /[ً-ٰٟـ]/g;
export const stripHarakat = (s: string) => s.replace(HARAKAT, "");

/** Arabic letters folded the way a learner types them: hamza seats → ا, ى → ي, ة → ه. */
export const foldArabic = (s: string) =>
  stripHarakat(s).replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/ؤ/g, "و").replace(/ئ/g, "ي");

/** Latin diacritics removed (ł → l too), for "almost right" in Polish. */
export const foldLatin = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l").replace(/Ł/g, "L");

const KATA_START = 0x30a1, KATA_END = 0x30f6;
export const kataToHira = (s: string) =>
  [...s].map((c) => { const n = c.codePointAt(0)!; return n >= KATA_START && n <= KATA_END ? String.fromCodePoint(n - 0x60) : c; }).join("");

export const isKanji = (c: string) => /\p{Script=Han}/u.test(c);
export const hasKanji = (s: string) => /\p{Script=Han}/u.test(s);
export const kanjiIn = (s: string) => [...new Set([...s].filter(isKanji))];

/** The key a word is stored under: same word on two devices → same id. */
export function wordKey(lang: Lang, lemma: string): string {
  const base = lang === "ar" ? stripHarakat(lemma) : lang === "pl" ? lemma.toLowerCase() : lemma;
  return `w_${lang}_${base.normalize("NFC").trim()}`;
}

/** Text compared for "is this the same word": case, harakat and kana kind folded. */
export function fold(lang: Lang, s: string): string {
  const t = s.normalize("NFC").trim().toLowerCase().replace(/[\s.,!?;:。、！？「」…"'«»„”-]+/g, "");
  return lang === "ar" ? foldArabic(t) : lang === "ja" ? kataToHira(t) : t;
}
