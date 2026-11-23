/* How much of a text I know: the share of word tokens whose lemma is a word I know or am learning,
   counting grammar words (particles, prepositions…) as known. Reading on your own needs ~95–98%. */
import type { AppState, Lang, Sentence, Token } from "../types";
import { fold } from "./langs";

const GRAMMAR: Record<Lang, string[]> = {
  ja: ["は", "が", "を", "に", "で", "と", "も", "か", "ね", "よ", "の", "へ", "から", "まで", "です", "ます", "だ", "や", "ございます", "この", "その", "あの", "これ", "それ", "あれ", "ない", "た", "て", "こと", "もの", "さん"],
  pl: ["i", "a", "w", "we", "do", "z", "ze", "na", "o", "po", "że", "to", "ten", "ta", "się", "nie", "jak", "od", "dla", "przy", "ale", "czy", "też", "tak", "u"],
  ar: ["فِي", "فى", "وَ", "و", "مِنْ", "من", "إِلَى", "الى", "عَلَى", "على", "مَعَ", "مع", "هٰذَا", "هذا", "هٰذِهِ", "هذه", "أَنْ", "ان", "لَا", "لا", "مَا", "ما"],
};

export function knownSet(s: AppState, lang: Lang): Set<string> {
  const out = new Set(GRAMMAR[lang].map((x) => fold(lang, x)));
  for (const w of s.words) if (w.lang === lang && !w.deletedAt && (w.status === "known" || w.status === "learning")) out.add(fold(lang, w.lemma));
  return out;
}

export const isKnown = (lang: Lang, known: Set<string>, t: Token) => !t.l || known.has(fold(lang, t.l)) || known.has(fold(lang, t.t));

export function coverage(lang: Lang, known: Set<string>, sentences: Sentence[]): { known: number; total: number; pct: number; unknown: string[] } {
  let k = 0, n = 0;
  const unknown = new Set<string>();
  for (const s of sentences) for (const t of s.tokens) {
    if (!t.l) continue;
    n++;
    if (isKnown(lang, known, t)) k++; else unknown.add(t.l);
  }
  return { known: k, total: n, pct: n ? k / n : 1, unknown: [...unknown] };
}
