/* How much of a text I know: the share of word tokens whose lemma is a word I know or am learning,
   counting grammar words (particles, prepositions…) as known. Reading on your own needs ~95–98%. */
import type { AppState, Lang, Sentence, Token } from "../types";
import { fold } from "./langs";

const GRAMMAR: Record<Lang, string[]> = {
  ja: ["は", "が", "を", "に", "で", "と", "も", "か", "ね", "よ", "の", "へ", "から", "まで", "です", "ます", "だ", "や", "ございます", "この", "その", "あの", "これ", "それ", "あれ", "ない", "た", "て", "こと", "もの", "さん"],
  pl: ["i", "a", "w", "we", "do", "z", "ze", "na", "o", "po", "że", "to", "ten", "ta", "się", "nie", "jak", "od", "dla", "przy", "ale", "czy", "też", "tak", "u"],
  el: ["ο", "η", "το", "οι", "τα", "τον", "την", "τη", "του", "της", "των", "τους", "τις", "και", "να", "θα", "δεν", "μη", "μην", "σε", "στο", "στη", "στην", "στον", "στα", "στους", "στις", "με", "για", "από", "που", "ότι", "αλλά", "ή", "μου", "σου", "μας", "σας"],
  pt: ["o", "a", "os", "as", "um", "uma", "de", "do", "da", "dos", "das", "em", "no", "na", "nos", "nas", "ao", "à", "aos", "às", "por", "pelo", "pela", "para", "com", "e", "ou", "mas", "que", "se", "não", "me", "te", "lhe"],
  ru: ["и", "а", "но", "в", "во", "на", "с", "со", "к", "ко", "по", "о", "об", "у", "за", "из", "от", "до", "для", "не", "ни", "что", "как", "это", "да", "нет", "же", "ли", "бы", "вот", "тоже", "или"],
  es: ["el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del", "a", "al", "en", "por", "para", "con", "sin", "y", "e", "o", "u", "pero", "que", "se", "no", "me", "te", "le", "lo", "les", "nos", "su", "sus", "mi", "tu", "es", "muy"],
  fr: ["le", "la", "les", "l", "un", "une", "des", "de", "d", "du", "au", "aux", "à", "en", "dans", "sur", "pour", "par", "avec", "sans", "et", "ou", "mais", "que", "qu", "qui", "ne", "n", "pas", "se", "s", "me", "m", "te", "t", "ce", "c", "je", "j", "il", "elle", "on", "y"],
  it: ["il", "lo", "la", "i", "gli", "le", "l", "un", "uno", "una", "di", "del", "della", "a", "al", "alla", "da", "in", "nel", "nella", "con", "su", "per", "tra", "fra", "e", "o", "ma", "che", "non", "si", "mi", "ti", "ci", "vi", "ne"],
  de: ["der", "die", "das", "den", "dem", "des", "ein", "eine", "einen", "einem", "einer", "eines", "und", "oder", "aber", "in", "im", "ins", "an", "am", "auf", "zu", "zum", "zur", "mit", "von", "vom", "bei", "beim", "für", "aus", "nach", "nicht", "sich", "es", "dass", "wie", "auch", "so"],
  nl: ["de", "het", "een", "en", "of", "maar", "in", "op", "aan", "met", "van", "voor", "naar", "bij", "uit", "om", "te", "dat", "die", "dit", "niet", "geen", "er", "zich", "ook", "als", "dan", "nog", "al", "zo"],
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
