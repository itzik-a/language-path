/* What differs between the languages: names, codes, direction, script helpers. */
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
  /** the script has upper and lower case (lemmas are stored lower-cased) */
  cased: boolean;
  /** nouns are capitalised (German): lemmas keep their case; ids still ignore it */
  nounCaps?: boolean;
  /** only voices of this exact region will do (European, not Brazilian, Portuguese) */
  strictRegion?: boolean;
}

export const LANG: Record<Lang, LangInfo> = {
  ja: { id: "ja", name: "Japanese", native: "日本語", mark: "あ", bcp: "ja-JP", dir: "ltr", spaces: false, cased: false },
  pl: { id: "pl", name: "Polish", native: "polski", mark: "Pl", bcp: "pl-PL", dir: "ltr", spaces: true, cased: true },
  ar: { id: "ar", name: "Arabic", native: "العربية", mark: "ع", bcp: "ar-SA", dir: "rtl", spaces: true, cased: false },
  el: { id: "el", name: "Greek", native: "ελληνικά", mark: "Ελ", bcp: "el-GR", dir: "ltr", spaces: true, cased: true },
  pt: { id: "pt", name: "Portuguese", native: "português", mark: "Pt", bcp: "pt-PT", dir: "ltr", spaces: true, cased: true, strictRegion: true },
  ru: { id: "ru", name: "Russian", native: "русский", mark: "Ру", bcp: "ru-RU", dir: "ltr", spaces: true, cased: true },
  es: { id: "es", name: "Spanish", native: "español", mark: "Es", bcp: "es-ES", dir: "ltr", spaces: true, cased: true },
  fr: { id: "fr", name: "French", native: "français", mark: "Fr", bcp: "fr-FR", dir: "ltr", spaces: true, cased: true },
  it: { id: "it", name: "Italian", native: "italiano", mark: "It", bcp: "it-IT", dir: "ltr", spaces: true, cased: true },
  de: { id: "de", name: "German", native: "Deutsch", mark: "De", bcp: "de-DE", dir: "ltr", spaces: true, cased: true, nounCaps: true },
  nl: { id: "nl", name: "Dutch", native: "Nederlands", mark: "Nl", bcp: "nl-NL", dir: "ltr", spaces: true, cased: true },
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

/** An elided word (French j', l', qu'; Italian l', un', dell'): the next word follows with no space. */
export const isElided = (t: string) => /\p{L}['’]$/u.test(t);

/** Lemmas of cased languages are stored lower-cased ("Kot" → "kot"), except where nouns are capitalised (German "Hund"). */
export const lowerIfCased = (lang: Lang, s: string) => (LANG[lang].cased && !LANG[lang].nounCaps ? s.toLowerCase() : s);

/** German folded the way a learner may type it without a German keyboard: ß → ss, ä → ae, ö → oe, ü → ue. */
export const foldGerman = (s: string) =>
  s.toLowerCase().replace(/ß/g, "ss").replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue");

/** Russian stress marks (a combining acute on the stressed vowel: молоко́), as learner texts write them. */
export const stripStress = (s: string) => s.normalize("NFC").replace(/\u0301/g, "");
/** Russian folded the way a learner types it: no stress marks, ё → е. */
export const foldRussian = (s: string) => stripStress(s).replace(/ё/g, "е").replace(/Ё/g, "Е");

/** The key a word is stored under: same word on two devices → same id. */
export function wordKey(lang: Lang, lemma: string): string {
  const base = lang === "ar" ? stripHarakat(lemma) : lang === "ru" ? foldRussian(lemma.toLowerCase()) : LANG[lang].cased ? lemma.toLowerCase() : lemma;
  return `w_${lang}_${base.normalize("NFC").trim()}`;
}

/** Text compared for "is this the same word": case, harakat and kana kind folded. */
export function fold(lang: Lang, s: string): string {
  const t = s.normalize("NFC").trim().toLowerCase().replace(/[\s\p{P}]+/gu, "") // spaces and all punctuation never count;
  return lang === "ar" ? foldArabic(t) : lang === "ja" ? kataToHira(t) : lang === "el" ? t.replace(/ς/g, "σ") : lang === "ru" ? foldRussian(t) : t;
}

/** Transliteration worked out on the device (Greek, Russian); undefined for the others. */
export const autoTranslit = (lang: Lang, s: string): string | undefined =>
  lang === "el" ? greekTranslit(s) : lang === "ru" ? russianTranslit(s) : undefined;

// ── Russian → Latin letters ───────────────────────────────────

const RU_ONE: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o",
  п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "'",
  э: "e", е: "e", ё: "yo", ю: "yu", я: "ya",
};
const RU_VOWEL_OR_SIGN = new Set([..."аеёиоуыэюяъь"]);
const RU_HUSHING = new Set([..."жшчщц"]);

/** Russian in Latin letters, letter by letter, with the stress marked: молоко́ → molokó, ёж → yózh, здра́вствуйте →
    zdrávstvuyte, мать → mat'. е is ye at the start of a word and after a vowel or a sign. Unstressed о sounds like a
    (see the sounds page); the spelling is kept so it teaches the letters. */
export function russianTranslit(text: string): string {
  return text.normalize("NFC").replace(/[\u0400-\u04ff\u0301]+/g, (word) => {
    const cs = [...word];
    let out = "", prev = "";
    for (let i = 0; i < cs.length; i++) {
      const raw = cs[i];
      if (raw === "\u0301") continue;
      const c = raw.toLowerCase();
      let lat = RU_ONE[c];
      if (lat === undefined) { out += raw; prev = c; continue; }
      if (c === "е" && (!prev || RU_VOWEL_OR_SIGN.has(prev))) lat = "ye";
      if (c === "ё" && RU_HUSHING.has(prev)) lat = "o";
      if (cs[i + 1] === "\u0301" || c === "ё") lat = lat.replace(/[aeiouy](?!.*[aeiouy])/, (v) => ({ a: "á", e: "é", i: "í", o: "ó", u: "ú", y: "ý" })[v]!);
      out += raw !== c && lat ? lat.charAt(0).toUpperCase() + lat.slice(1) : lat;
      prev = c;
    }
    return out;
  });
}

// ── Greek → Latin letters ─────────────────────────────────────

const GR_ONE: Record<string, string> = {
  α: "a", β: "v", γ: "gh", δ: "dh", ε: "e", ζ: "z", η: "i", θ: "th", ι: "i", κ: "k", λ: "l", μ: "m", ν: "n", ξ: "x",
  ο: "o", π: "p", ρ: "r", σ: "s", ς: "s", τ: "t", υ: "i", φ: "f", χ: "kh", ψ: "ps", ω: "o",
};
const ACUTE: Record<string, string> = { a: "á", e: "é", i: "í", o: "ó", u: "ú" };
const GR_VOICELESS = new Set([..."θκξπστφχψ"]);
const GR_VOICED_CONS = new Set([..."βγδζλμνρ"]);
const GR_FRONT = new Set([..."ειηυ"]);

/** Modern Greek in Latin letters, the way it sounds, with the stress marked: καλημέρα → kaliméra, ευχαριστώ → efkharistó,
    μπύρα → bíra, τσάι → tsái. Same letters as the Arabic transliteration where the sound is the same (gh, dh, th, kh). */
export function greekTranslit(text: string): string {
  return text.normalize("NFC").replace(/[\u0370-\u03ff\u1f00-\u1fff]+/g, (word) => {
    const chars = [...word.toLowerCase()].map((c) => { const d = c.normalize("NFD"); return { b: d[0], acc: /[\u0301\u0341]/.test(d), dia: d.includes("\u0308") }; });
    const b = (k: number) => chars[k]?.b ?? "";
    const accent = (lat: string, on: boolean) => (on ? lat.replace(/[aeiou]/, (v) => ACUTE[v]) : lat);
    let out = "";
    for (let i = 0; i < chars.length; i++) {
      const c = chars[i], n = chars[i + 1], pair = c.b + b(i + 1);
      // vowel pairs, unless the first vowel carries the accent or the second a diaeresis (τσάι, ρολόι, αϊτός)
      if (n && !c.acc && !n.dia) {
        if (pair === "ου") { out += n.acc ? "oú" : "ou"; i++; continue; }
        if (pair === "αι") { out += n.acc ? "é" : "e"; i++; continue; }
        if (pair === "ει" || pair === "οι" || pair === "υι") { out += n.acc ? "í" : "i"; i++; continue; }
        if (pair === "αυ" || pair === "ευ" || pair === "ηυ") {
          const after = b(i + 2);
          out += accent(GR_ONE[c.b], n.acc) + (!after || GR_VOICELESS.has(after) ? "f" : "v"); i++; continue;
        }
      }
      if (pair === "μπ") { out += i === 0 ? "b" : "mb"; i++; continue; }
      if (pair === "ντ") { out += i === 0 ? "d" : "nd"; i++; continue; }
      if (pair === "γκ") { out += i === 0 ? "g" : "ng"; i++; continue; }
      if (pair === "γγ") { out += "ng"; i++; continue; }
      if (pair === "γχ") { out += "nkh"; i++; continue; }
      if (pair === "γξ") { out += "nx"; i++; continue; }
      if (pair === "τσ") { out += "ts"; i++; continue; }
      if (pair === "τζ") { out += "tz"; i++; continue; }
      if (c.b === "γ") { out += GR_FRONT.has(b(i + 1)) || ((b(i + 1) === "α" || b(i + 1) === "ο") && b(i + 2) === "ι") ? "y" : "gh"; continue; }
      if (c.b === "σ" && GR_VOICED_CONS.has(b(i + 1))) { out += "z"; continue; }
      const lat = GR_ONE[c.b];
      out += lat === undefined ? c.b : accent(lat, c.acc);
    }
    return word[0] !== word[0].toLowerCase() ? out.charAt(0).toUpperCase() + out.slice(1) : out;
  });
}
