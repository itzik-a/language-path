import { describe, expect, it } from "vitest";
import { furiganaParts, needsFurigana } from "../src/lib/furigana";
import { fold, foldArabic, stripHarakat, wordKey } from "../src/lib/langs";
import { sentence, sentenceText } from "../src/lib/tokens";
import { STARTER } from "../src/data/starter";
import { LANGS } from "../src/types";

describe("starter markup", () => {
  it("keeps glosses with spaces in one token", () => {
    const s = sentence("ar", "الْكِتَابُ|كِتَاب|the book جَدِيدٌ|جَدِيد|new .", "The book is new.");
    expect(sentenceText(s)).toBe("الْكِتَابُ جَدِيدٌ.");
    expect(s.tokens[0]).toMatchObject({ t: "الْكِتَابُ", l: "كِتَاب", g: "the book" });
  });
  it("handles Japanese readings after a spaced gloss", () => {
    const s = sentence("ja", "本|=|book|ほん が|=|(subject)|が あります|ある|there is|あります 。", "There is a book.");
    expect(sentenceText(s)).toBe("本があります。");
    expect(s.tokens[2]).toMatchObject({ t: "あります", l: "ある", g: "there is" });
    expect(s.tokens[0].r).toBe("ほん");
  });
  it("lowercases Polish '=' lemmas and spaces words", () => {
    const s = sentence("pl", "Tak|=|yes , rozumiem|rozumieć|I understand .", "Yes, I understand.");
    expect(sentenceText(s)).toBe("Tak, rozumiem.");
    expect(s.tokens[0].l).toBe("tak");
  });
  it("every starter example joins back to plain text without stray glosses", () => {
    for (const lang of LANGS) for (const w of STARTER[lang]) {
      if (!w.ex) continue;
      const s = sentence(lang, w.ex[0], w.ex[1]);
      const text = sentenceText(s);
      expect(text, `${lang} ${w.lemma}`).not.toMatch(/\|/);
      if (lang !== "pl") expect(text, `${lang} ${w.lemma}: ${text}`).not.toMatch(/[a-z]{2,}/);
    }
  });
  it("starter lemmas are unique per language", () => {
    for (const lang of LANGS) {
      const ids = STARTER[lang].map((w) => wordKey(lang, w.lemma));
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe("furigana", () => {
  it("puts the reading over the kanji only", () => {
    expect(furiganaParts("食べます", "たべます")).toEqual([{ text: "食", rt: "た" }, { text: "べます" }]);
    expect(furiganaParts("お茶", "おちゃ")).toEqual([{ text: "お" }, { text: "茶", rt: "ちゃ" }]);
    expect(furiganaParts("今日", "きょう")).toEqual([{ text: "今日", rt: "きょう" }]);
    expect(furiganaParts("パン", "ぱん")).toEqual([{ text: "パン" }]);
  });
  it("shows furigana only for kanji I don't know", () => {
    const known = new Set(["食", "今", "日"]);
    expect(needsFurigana("食べる", "unknown", known)).toBe(false);
    expect(needsFurigana("飲む", "unknown", known)).toBe(true);
    expect(needsFurigana("飲む", "none", known)).toBe(false);
    expect(needsFurigana("今日", "all", known)).toBe(true);
  });
});

describe("folding", () => {
  it("strips harakat and folds hamza seats", () => {
    expect(stripHarakat("كِتَابٌ")).toBe("كتاب");
    expect(foldArabic("أُمّ")).toBe("ام");
    expect(fold("ja", "タベル")).toBe("たべる");
    expect(wordKey("ar", "كِتَاب")).toBe(wordKey("ar", "كتاب"));
  });
});
