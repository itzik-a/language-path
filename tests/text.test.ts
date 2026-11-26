import { describe, expect, it } from "vitest";
import { furiganaParts, needsFurigana } from "../src/lib/furigana";
import { fold, foldArabic, greekTranslit, russianTranslit, stripHarakat, stripStress, wordKey } from "../src/lib/langs";
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
      if (lang === "ja" || lang === "ar" || lang === "el" || lang === "ru") expect(text, `${lang} ${w.lemma}: ${text}`).not.toMatch(/[a-z]{2,}/);
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

import { lemmaReading } from "../src/lib/furigana";
describe("lemma readings", () => {
  it("rebuilds the dictionary form's reading", () => {
    expect(lemmaReading("飲みます", "のみます", "飲む")).toBe("のむ");
    expect(lemmaReading("見ました", "みました", "見る")).toBe("みる");
    expect(lemmaReading("勉強します", "べんきょうします", "勉強する")).toBe("べんきょうする");
    expect(lemmaReading("会いたい", "あいたい", "会う")).toBe("あう");
    expect(lemmaReading("かわいい", undefined, "かわいい")).toBe("かわいい");
    expect(lemmaReading("猫", "ねこ", "猫")).toBe("ねこ");
  });
});

describe("quotes", () => {
  it("keeps Japanese brackets as tokens", () => {
    const s = sentence("ja", "友達|=|friend|ともだち は|=|(topic)|は 「 かわいい|=|cute|かわいい ！ 」 と|=|(quote)|と 。", "");
    expect(sentenceText(s)).toBe("友達は「かわいい！」と。");
    expect(s.tokens[1].r).toBeUndefined();
  });
});

describe("Greek", () => {
  it("transliterates the way it sounds, with the stress", () => {
    expect(greekTranslit("καλημέρα")).toBe("kaliméra");
    expect(greekTranslit("ευχαριστώ")).toBe("efkharistó");
    expect(greekTranslit("αύριο")).toBe("ávrio");
    expect(greekTranslit("αυτό")).toBe("aftó");
    expect(greekTranslit("είμαι")).toBe("íme");
    expect(greekTranslit("μπύρα")).toBe("bíra");
    expect(greekTranslit("ντομάτα")).toBe("domáta");
    expect(greekTranslit("Αγγλία")).toBe("Anglía");
    expect(greekTranslit("τσάι")).toBe("tsái");
    expect(greekTranslit("κόσμος")).toBe("kózmos");
    expect(greekTranslit("παιδί")).toBe("pedhí");
    expect(greekTranslit("γάτα")).toBe("gháta");
    expect(greekTranslit("οικογένεια")).toBe("ikoyénia");
    expect(greekTranslit("Γεια σου!")).toBe("Yia sou!");
    expect(greekTranslit("Τι κάνεις;")).toBe("Ti kánis;");
  });
  it("folds case and final sigma", () => {
    expect(fold("el", "Σκύλος")).toBe(fold("el", "σκύλοσ"));
    expect(wordKey("el", "Γάτα")).toBe(wordKey("el", "γάτα"));
  });
  it("lowercases '=' lemmas in Greek and Portuguese", () => {
    expect(sentence("el", "Ναι|=|yes .", "").tokens[0].l).toBe("ναι");
    expect(sentence("pt", "Obrigado|=|thanks !", "").tokens[0].l).toBe("obrigado");
    expect(sentenceText(sentence("el", "Τι|=|what είναι|είμαι|is αυτό|αυτός|this ;", ""))).toBe("Τι είναι αυτό;");
  });
});

describe("Russian", () => {
  it("transliterates letter by letter with the stress marked", () => {
    expect(russianTranslit("приве́т")).toBe("privét");
    expect(russianTranslit("молоко́")).toBe("molokó");
    expect(russianTranslit("здра́вствуйте")).toBe("zdrávstvuyte");
    expect(russianTranslit("ёж")).toBe("yózh");
    expect(russianTranslit("мать")).toBe("mat'");
    expect(russianTranslit("е́сли")).toBe("yésli");
    expect(russianTranslit("моё")).toBe("moyó");
    expect(russianTranslit("щи")).toBe("shchi");
    expect(russianTranslit("мы")).toBe("my");
    expect(russianTranslit("Как дела́?")).toBe("Kak delá?");
    expect(russianTranslit("Я")).toBe("Ya");
    expect(russianTranslit("подъе́зд")).toBe("podyézd");
  });
  it("ids and folding ignore stress marks, case and ё", () => {
    expect(wordKey("ru", "Молоко́")).toBe(wordKey("ru", "молоко"));
    expect(wordKey("ru", "ещё")).toBe(wordKey("ru", "еще"));
    expect(fold("ru", "Приве́т!")).toBe(fold("ru", "привет"));
    expect(stripStress("вода́")).toBe("вода");
  });
  it("starter examples keep their stress marks in tokens and lemmas", () => {
    const s = sentence("ru", "Я|=|I пью|пить|drink во́ду|вода́|water (acc.) .", "I drink water.");
    expect(sentenceText(s)).toBe("Я пью во́ду.");
    expect(s.tokens[0].l).toBe("я");
    expect(s.tokens[4]).toMatchObject({ t: "во́ду", l: "вода́" });
  });
});

describe("Spanish", () => {
  it("keeps ¿ and ¡ against the next word", () => {
    expect(sentenceText(sentence("es", "Bueno|=|anyway , ¿ qué|=|what tal|=|how el|=|the viaje|=|trip ?", ""))).toBe("Bueno, ¿qué tal el viaje?");
    expect(sentenceText(sentence("es", "Me|=|me preguntó|preguntar|asked : « ¿ Y|=|and tú|=|you ? »", ""))).toBe("Me preguntó: «¿Y tú?»");
  });
  it("folds case and ¿ ¡ away", () => {
    expect(fold("es", "¡Vaya!")).toBe(fold("es", "vaya"));
    expect(wordKey("es", "Lío")).toBe(wordKey("es", "lío"));
  });
});

describe("French and Italian elision", () => {
  it("puts no space after an elided word", () => {
    expect(sentenceText(sentence("fr", "J'|je|I ai|avoir|have pas|=|not pigé|piger|got it .", ""))).toBe("J'ai pas pigé.");
    expect(sentenceText(sentence("fr", "C'|ce|it est|être|is marrant|=|funny .", ""))).toBe("C'est marrant.");
    expect(sentenceText(sentence("it", "ho|avere|I have perso|perdere|missed l'|il|the ultimo|=|last treno|=|train .", ""))).toBe("ho perso l'ultimo treno.");
    expect(sentence("fr", "J'|je|I ai|avoir|have", "").tokens[0].l).toBe("je");
  });
});

describe("German", () => {
  it("keeps noun capitals in lemmas, but ids ignore case", () => {
    const s = sentence("de", "Der|der|the Zug|=|train hatte|haben|had Verspätung|=|a delay .", "");
    expect(s.tokens[2].l).toBe("Zug");
    expect(wordKey("de", "Zug")).toBe(wordKey("de", "zug"));
    expect(sentenceText(s)).toBe("Der Zug hatte Verspätung.");
  });
});
