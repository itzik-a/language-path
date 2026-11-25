/* Sentences as tokens. */
import type { Lang, Sentence, Token } from "../types";
import { isElided, LANG, lowerIfCased } from "./langs";

const PUNCT_BEFORE_NO_SPACE = /^[.,!?;:;·…)\]»”、。！？」』）،؟؛]+$/;
const OPEN_NO_SPACE_AFTER = /^[(\[«„“「『（¿¡]+$/;
const ONLY_PUNCT = /^[\p{P}\p{S}]+$/u;

/** Parse the starter markup: "surface|lemma|gloss|reading …", "=" lemma = surface, "-" = a name, bare tokens are punctuation.
    Glosses may contain spaces: a chunk with fewer than two "|" continues the previous token. */
export function sentence(lang: Lang, spec: string, tr: string): Sentence {
  const raw: string[] = [];
  for (const chunk of spec.trim().split(/\s+/)) {
    const pipes = chunk.split("|").length - 1;
    if (pipes >= 2 || !raw.length || ONLY_PUNCT.test(chunk) || !raw[raw.length - 1].includes("|")) raw.push(chunk);
    else raw[raw.length - 1] += " " + chunk;
  }
  const tokens: Token[] = [];
  raw.forEach((p, i) => {
    if (i > 0 && LANG[lang].spaces && !PUNCT_BEFORE_NO_SPACE.test(p) && !OPEN_NO_SPACE_AFTER.test(raw[i - 1]) && !isElided(raw[i - 1].split("|")[0])) tokens.push({ t: " " });
    if (!p.includes("|")) { tokens.push({ t: p }); return; }
    const [t, l, g, r] = p.split("|");
    // "-" as lemma: a name (has a gloss, isn't a word to learn)
    const lemma = l === "-" ? undefined : l === "=" ? lowerIfCased(lang, t) : l;
    tokens.push({ t, ...(lemma ? { l: lemma } : {}), ...(g ? { g } : {}), ...(r && r !== t ? { r } : {}) });
  });
  return { tokens, tr };
}

export const isWord = (t: Token) => !!t.l;
export const sentenceText = (s: Sentence) => s.tokens.map((t) => t.t).join("");

/** Plain text for a voice: Japanese words in their kana reading when asked (so kanji aren't misread). */
export function speakText(s: Sentence, opts: { reading?: boolean } = {}) {
  return s.tokens.map((t) => (opts.reading && t.r ? t.r : t.t)).join("");
}

/** Split plain text into rough tokens (no lemmas) when nothing better is available. */
export function roughTokens(lang: Lang, text: string): Token[] {
  const seg = new Intl.Segmenter(LANG[lang].bcp, { granularity: "word" });
  return [...seg.segment(text)].map((s) => (s.isWordLike ? { t: s.segment, l: lowerIfCased(lang, s.segment) } : { t: s.segment }));
}

/** Split plain text into sentences. */
export function splitSentences(lang: Lang, text: string): string[] {
  const seg = new Intl.Segmenter(LANG[lang].bcp, { granularity: "sentence" });
  return [...seg.segment(text.replace(/\s+/g, " ").trim())].map((s) => s.segment.trim()).filter(Boolean);
}
