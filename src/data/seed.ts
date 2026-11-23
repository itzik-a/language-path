/* The first state on a new device: settings and the starter words (examples: `updatedAt: 0`, `source: "seed"`).
   Never rename or reuse an id here: devices match items by id. */
import { wordKey } from "../lib/langs";
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
  },
  updatedAt: 0,
});

export function starterWords(lang: Lang): Word[] {
  return STARTER[lang].map((w, i) => ({
    id: wordKey(lang, w.lemma), updatedAt: 0, lang, lemma: w.lemma,
    ...(w.reading && w.reading !== w.lemma ? { reading: w.reading } : {}),
    translit: w.translit, gloss: w.gloss, pos: w.pos, status: "new", rank: i, source: "seed",
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
