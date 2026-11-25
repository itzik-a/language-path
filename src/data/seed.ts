/* The first state on a new device: settings and the starter words (examples: `updatedAt: 0`, `source: "seed"`).
   Never rename or reuse an id here: devices match items by id. */
import { autoTranslit, wordKey } from "../lib/langs";
import { sentence } from "../lib/tokens";
import { LANGS, type AppState, type Lang, type LangSettings, type Settings, type Word } from "../types";
import { STARTER } from "./starter";
import { starterTexts } from "./stories";

const base: Omit<LangSettings, "level"> = {
  newPerDay: 8, retention: 0.9, furigana: "unknown", harakat: true, translit: true, sayAfterDays: 7, knownKanji: "", knownChars: [],
};

export const defaultSettings = (): Settings => ({
  lang: {
    ja: { ...base, level: "Beginner. I can read some hiragana and katakana and know about 300 kanji (their meanings and some readings), but very little grammar yet." },
    pl: { ...base, level: "Beginner. I know about 40 words (kobieta, chłopcy, jabłka…) and almost no grammar yet." },
    ar: { ...base, translit: true, level: "Complete beginner in Modern Standard Arabic, still learning the alphabet. I read Hebrew fluently, so Hebrew cognates help." },
    el: { ...base, translit: true, level: "Complete beginner in Modern Greek, still learning the alphabet. I read Hebrew and English." },
    pt: { ...base, translit: false, level: "Beginner-intermediate in European Portuguese (as spoken in Portugal, not Brazil). I speak Spanish, so similarities with Spanish and false friends help." },
    es: { ...base, translit: false, newPerDay: 5, level: "Advanced. I read whole books in Spanish and understand well what I hear. What I need is conversation: speaking fluently and naturally, colloquial Spanish and idioms, and having the small mistakes I still make corrected. No particular variety (I'll name one here if I want one)." },
    ru: { ...base, translit: true, level: "Beginner in Russian. I know a few words but can barely read Cyrillic yet, so I'm still practising the alphabet. I read Hebrew, English and some Greek." },
  },
  updatedAt: 0,
});

export function starterWords(lang: Lang): Word[] {
  return STARTER[lang].map((w, i) => ({
    id: wordKey(lang, w.lemma), updatedAt: 0, lang, lemma: w.lemma,
    ...(w.reading && w.reading !== w.lemma ? { reading: w.reading } : {}),
    translit: w.translit ?? autoTranslit(lang, w.lemma) ?? w.lemma, gloss: w.gloss, pos: w.pos, status: "new", rank: i, source: "seed",
    ...(w.note ? { note: w.note } : {}), ...(w.root ? { root: w.root } : {}), ...(w.hebrew ? { hebrew: w.hebrew } : {}),
    ...(w.ex ? { example: sentence(lang, w.ex[0], w.ex[1]) } : {}),
  }));
}

export const seedState = (): AppState => ({
  v: 1,
  words: LANGS.flatMap(starterWords),
  cards: [],
  texts: starterTexts(),
  chats: [],
  days: [],
  settings: defaultSettings(),
  updatedAt: 0,
});
