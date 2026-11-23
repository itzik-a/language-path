import { describe, expect, it } from "vitest";
import { allChars, letterForms, PAIRS, SCRIPT_SETS } from "../src/data/scripts";
import { toKana } from "../src/lib/romaji";

describe("romaji", () => {
  it("converts common words", () => {
    expect(toKana("taberu")).toBe("たべる");
    expect(toKana("kitte")).toBe("きって");
    expect(toKana("shinbun", { final: true })).toBe("しんぶん");
    expect(toKana("konnichiha")).toBe("こんにちは");
    expect(toKana("kyou")).toBe("きょう");
    expect(toKana("matcha")).toBe("まっちゃ");
    expect(toKana("ko-hi-")).toBe("こーひー");
    expect(toKana("hon")).toBe("ほn");
    expect(toKana("hon", { final: true })).toBe("ほん");
    expect(toKana("kan'i")).toBe("かんい");
    expect(toKana("benkyou")).toBe("べんきょう");
  });
});

describe("script data", () => {
  it("has unique, stable ids", () => {
    const ids = allChars().map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("hira:ka");
    expect(ids).toContain("kata:n");
    expect(ids).toContain("abc:ayn");
    expect(ids).toContain("har:shadda");
  });
  it("has the full kana and alphabet", () => {
    const n = (id: string) => SCRIPT_SETS.find((s) => s.id === id)!.rows.reduce((a, r) => a + r.chars.length, 0);
    expect(n("hira")).toBe(104);
    expect(n("kata")).toBe(104);
    expect(n("abc")).toBe(31);
  });
  it("joins Arabic letters with ZWJ", () => {
    expect(letterForms("ب", true).mid).toBe("‍ب‍");
    expect(letterForms("د", false).init).toBe("د");
  });
  it("has pairs for every language", () => {
    expect(Object.values(PAIRS).every((p) => p.length >= 5)).toBe(true);
  });
});
