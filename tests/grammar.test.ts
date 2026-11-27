import { describe, expect, it } from "vitest";
import { topicForHint, topicsFor, GRAMMAR } from "../src/data/grammar";
import { checkForm } from "../src/lib/check";
import { merge } from "../src/lib/merge";
import { seedState } from "../src/data/seed";
import { mistakesByTopic, practiceRound, topicProgress } from "../src/state/grammar";
import { newSrs } from "../src/lib/srs";
import { LANGS, type AppState, type GCard, type Lesson } from "../src/types";

const drill = (id: string) => ({ id, sentence: "Mam ___.", base: "kawa", hint: "accusative", answer: "kawę", alts: [], tr: "I have coffee.", why: "-a → -ę" });
const lesson = (drills = ["a", "b", "c"]): Lesson => ({
  id: "g_pl-acc", updatedAt: 1, lang: "pl", topic: "pl-acc", intro: ["x"], tables: [], examples: [], compare: "", mistakes: [],
  drills: drills.map(drill), model: "claude-opus-5-5", writtenOn: "2026-11-27",
});
const gcard = (d: string, over: Partial<GCard> = {}): GCard => ({ id: `gc_pl-acc_${d}`, updatedAt: 1, lang: "pl", topic: "pl-acc", drill: d, srs: newSrs(0), log: [[1, 3]], ...over });

describe("grammar topics", () => {
  it("have unique ids and hints that point at them", () => {
    for (const [lang, list] of Object.entries(GRAMMAR)) {
      const ids = list!.map((t) => t.id);
      expect(new Set(ids).size, lang).toBe(ids.length);
      for (const t of list!) expect(t.id.startsWith(lang + "-"), t.id).toBe(true);
    }
    expect(topicForHint("pl", "coffee (acc.)")?.id).toBe("pl-acc");
    expect(topicForHint("ru", "of the book (gen.)")?.id).toBe("ru-gen");
    expect(topicForHint("de", "with the dog (dat.)")?.id).toBe("de-dat");
    expect(topicForHint("pl", "I was (past)")?.id).toBe("pl-past");
    expect(topicForHint("pl", "coffee")).toBeUndefined();
    for (const l of LANGS) expect(topicsFor(l).length, l).toBeGreaterThan(10);
    expect(topicForHint("ja", "eat (te-form)")?.id).toBe("ja-te");
    expect(topicForHint("es", "you'd come (subj. impf.)")?.id).toBe("es-subj-past");
    expect(topicForHint("ar", "the book (gen.)")?.id).toBe("ar-cases");
  });
});

describe("drill answers", () => {
  it("count a missing accent as almost where it's the ending", () => {
    expect(checkForm("pl", "kawę", ["kawę"])).toBe("right");
    expect(checkForm("pl", "kawe", ["kawę"])).toBe("almost");
    expect(checkForm("pl", "kawa", ["kawę"])).toBe("wrong");
    expect(checkForm("de", "Muetter", ["Mütter"])).toBe("right");
    expect(checkForm("de", "Mutter", ["Mütter"])).toBe("almost");
    expect(checkForm("de", "den Hund", ["den Hund"])).toBe("right");
  });
  it("take kana / romaji for Japanese and keep Arabic case endings in Latin letters", () => {
    expect(checkForm("ja", "たべて", ["食べて", "たべて"])).toBe("right");
    expect(checkForm("ja", "tabete", ["食べて", "たべて"])).toBe("right");
    expect(checkForm("ar", "كتابا", ["كِتَابًا", "kitāban"])).toBe("right");
    expect(checkForm("ar", "kitaban", ["كِتَابًا", "kitāban"])).toBe("right");
    expect(checkForm("ar", "kitabun", ["كِتَابًا", "kitāban"])).toBe("wrong");
    expect(checkForm("el", "grafo", ["γράφω"])).toBe("right");
  });
  it("ignore Russian stress marks and take transliteration", () => {
    expect(checkForm("ru", "книгу", ["кни́гу"])).toBe("right");
    expect(checkForm("ru", "knigu", ["кни́гу"])).toBe("right");
    expect(checkForm("ru", "книга", ["кни́гу"])).toBe("wrong");
  });
});

describe("grammar progress", () => {
  it("goes from ready to learning to solid", () => {
    const s: AppState = { ...seedState(), lessons: [lesson()] };
    expect(topicProgress(s, "pl-acc").status).toBe("ready");
    s.gcards = [gcard("a")];
    expect(topicProgress(s, "pl-acc")).toMatchObject({ status: "learning", practised: 1, drills: 3 });
    s.gcards = ["a", "b", "c"].map((d) => gcard(d, { srs: { ...newSrs(0), stability: 30, due: Date.now() + 1e9 } }));
    expect(topicProgress(s, "pl-acc").status).toBe("solid");
    expect(topicProgress({ ...s, lessons: [] }, "pl-acc").status).toBe("new");
  });
  it("puts due drills first, then new ones", () => {
    const s: AppState = { ...seedState(), lessons: [lesson()], gcards: [gcard("a", { srs: { ...newSrs(0), stability: 5, due: Date.now() + 1e9 } }), gcard("c", { srs: { ...newSrs(0), due: 0 } })] };
    expect(practiceRound(s, "pl-acc").map((d) => d.id)).toEqual(["c", "b", "a"]);
  });
  it("keeps every answer when two devices practise", () => {
    const a: AppState = { ...seedState(), gcards: [gcard("a", { updatedAt: 5, log: [[1, 3], [5, 3]] })] };
    const b: AppState = { ...seedState(), gcards: [gcard("a", { updatedAt: 4, log: [[1, 3], [4, 1]] })] };
    expect(merge(a, b).gcards[0].log.map(([t]) => t)).toEqual([1, 4, 5]);
  });
  it("collects my Talk mistakes by topic", () => {
    const s: AppState = { ...seedState(), chats: [{ id: "ch", updatedAt: 9, lang: "pl", scenario: "café", createdOn: "2026-11-27",
      turns: [{ who: "me", text: "Poproszę kawa.", at: 3, fix: { better: "Poproszę kawę.", why: "acc.", topic: "pl-acc" } }],
      review: { summary: "", points: [{ said: "Poproszę kawa.", better: "Poproszę kawę.", why: "acc.", topic: "pl-acc" }, { said: "x", better: "y", why: "z" }] } }] };
    const m = mistakesByTopic(s, "pl");
    expect(m.get("pl-acc")?.length).toBe(1);
    expect([...m.keys()]).toEqual(["pl-acc"]);
  });
});
