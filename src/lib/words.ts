/* Helpers about words. */
import type { Word } from "../types";

/** What the voice should read for a word: Japanese from its kana (kanji alone get misread), others as written. */
export const sayWord = (w: Pick<Word, "lang" | "lemma" | "reading">) => (w.lang === "ja" && w.reading ? w.reading : w.lemma);

export const STATUS_LABEL = { new: "In queue", learning: "Learning", known: "Known", ignored: "Ignored" } as const;
