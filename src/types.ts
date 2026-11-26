/* The whole saved state. Every list item has an id and `updatedAt` (sync merges per item by it); removals are
   soft (`deletedAt`). New fields must be optional and filled in by normalize() in src/state/store.ts. */

export type Lang = "ja" | "pl" | "ar" | "el" | "pt" | "ru" | "es" | "fr" | "it" | "de" | "nl";
export const LANGS: Lang[] = ["ja", "pl", "ar", "el", "pt", "ru", "es", "fr", "it", "de", "nl"];

export interface Item { id: string; updatedAt: number; deletedAt?: number }

/** One token of a sentence. Whitespace and punctuation are tokens too (no `l`), so joining every `t` gives the sentence back. */
export interface Token {
  /** surface text as written */
  t: string;
  /** dictionary form (lemma); absent for spaces, punctuation and numbers */
  l?: string;
  /** reading: kana for Japanese (of the surface) */
  r?: string;
  /** meaning in this context, short English */
  g?: string;
  /** transliteration (romaji / Arabic in Latin letters; Greek and Russian are transliterated on the device) */
  x?: string;
}

export interface Sentence { tokens: Token[]; tr: string }

export type WordStatus = "new" | "learning" | "known" | "ignored";

export interface Word extends Item {
  lang: Lang;
  /** dictionary form in the target script (Arabic with harakat) */
  lemma: string;
  /** Japanese: kana reading; Arabic: unused (lemma is vowelled) */
  reading?: string;
  /** romaji / transliteration */
  translit?: string;
  /** English meaning(s) */
  gloss: string;
  pos?: string;
  status: WordStatus;
  /** free note: mnemonic, grammar (Polish cases, Japanese verb group), Spanish false friends (Portuguese) */
  note?: string;
  /** Arabic root letters, e.g. "ك ت ب" */
  root?: string;
  /** Arabic: a Hebrew cognate, e.g. "כתב (write)" */
  hebrew?: string;
  example?: Sentence;
  /** order in the new-word queue (lower first) */
  rank: number;
  source: "seed" | "text" | "chat" | "manual" | "claude";
  /** when it moved to learning (YYYY-MM-DD) */
  startedOn?: string;
}

export type CardKind = "recog" | "listen" | "say" | "cloze" | "script";

/** FSRS card state, stored as plain numbers (ms) so it survives JSON. */
export interface Srs {
  due: number;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: 0 | 1 | 2 | 3;
  last_review?: number;
}

export interface Card extends Item {
  lang: Lang;
  kind: CardKind;
  /** the word this card practises (all kinds but script) */
  wordId?: string;
  /** script cards: the character's id in src/data/scripts.ts, e.g. "hira:ka" */
  charId?: string;
  /** cloze cards: the sentence and the token index to hide */
  cloze?: { sentence: Sentence; at: number };
  srs: Srs;
  /** reviews: [time in ms, rating 1–4] */
  log: [number, number][];
  suspended?: boolean;
  /** YYYY-MM-DD the card was created */
  addedOn: string;
}

export interface Text extends Item {
  lang: Lang;
  title: string;
  /** English title */
  titleTr?: string;
  sentences: Sentence[];
  source: "seed" | "claude" | "paste";
  /** what I asked for (topic) */
  prompt?: string;
  createdOn: string;
  /** words new to me when it was written (lemmas) */
  newWords?: string[];
  readAt?: number;
  listens?: number;
}

export interface Turn {
  who: "me" | "them";
  text: string;
  tokens?: Token[];
  tr?: string;
  /** a correction of my line */
  fix?: { better: string; why: string };
  at: number;
}

export interface Chat extends Item {
  lang: Lang;
  scenario: string;
  turns: Turn[];
  createdOn: string;
  review?: { summary: string; points: { said: string; better: string; why: string }[] };
}

/** Counters for one day, language and device (each device writes its own, so sync never loses counts). */
export interface DayLog extends Item {
  date: string;
  lang: Lang;
  device: string;
  reviews: number;
  newWords: number;
  /** seconds of reading / listening, talking */
  readSec: number;
  talkSec: number;
  turns: number;
}

export interface LangSettings {
  /** new words a day */
  newPerDay: number;
  retention: number;
  /** how I describe my level to Claude */
  level: string;
  /** Japanese: furigana over "unknown" kanji only, all, or none */
  furigana: "unknown" | "all" | "none";
  /** Arabic: show harakat; Russian: show stress marks */
  harakat: boolean;
  /** show transliteration under words */
  translit: boolean;
  /** add a "say" card once a word's recognition is this stable (days); 0 = right away */
  sayAfterDays: number;
  /** Japanese: kanji I know, as one string */
  knownKanji: string;
  /** script characters / rows marked known (charIds) */
  knownChars: string[];
}

export interface Settings {
  lang: Record<Lang, LangSettings>;
  updatedAt: number;
}

export interface AppState {
  v: 1;
  words: Word[];
  cards: Card[];
  texts: Text[];
  chats: Chat[];
  days: DayLog[];
  settings: Settings;
  updatedAt: number;
}
