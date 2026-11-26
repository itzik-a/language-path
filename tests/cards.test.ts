import { beforeEach, describe, expect, it } from "vitest";
import { check, foldAccents, likeness } from "../src/lib/check";
import { fold } from "../src/lib/langs";
import { DAY } from "../src/lib/dates";
import { nextCard, queue } from "../src/lib/queue";
import { Rating } from "../src/lib/srs";
import { addScriptCards, grade, setStatus, startNewWords } from "../src/state/actions";
import { defaults, getState, replaceState } from "../src/state/store";

beforeEach(() => replaceState(defaults()));

describe("starting words", () => {
  it("starts the daily number of words, first in the queue, with their cards", () => {
    const n = startNewWords("ja");
    expect(n).toBe(8);
    const s = getState();
    const started = s.words.filter((w) => w.lang === "ja" && w.status === "learning");
    expect(started.map((w) => w.lemma).slice(0, 3)).toEqual(["私", "水", "食べる"]);
    const cards = s.cards.filter((c) => c.wordId === started[0].id);
    expect(cards.map((c) => c.kind).sort()).toEqual(["cloze", "listen", "recog"]);
    expect(startNewWords("ja")).toBe(0); // the day's number is used up
  });

  it("puts a cloze gap on the word in its example", () => {
    setStatus(["w_pl_chłopiec"], "learning");
    const c = getState().cards.find((x) => x.kind === "cloze" && x.wordId === "w_pl_chłopiec")!;
    expect(c.cloze!.sentence.tokens[c.cloze!.at].t).toBe("Chłopcy");
  });

  it("pauses cards when a word is marked known", () => {
    startNewWords("pl", 1);
    setStatus(["w_pl_tak"], "known");
    expect(getState().cards.filter((c) => c.wordId === "w_pl_tak").every((c) => c.suspended)).toBe(true);
    expect(queue(getState(), "pl").fresh.length).toBe(0);
  });
});

describe("queue", () => {
  it("shows one new card per word on its first day", () => {
    startNewWords("ja", 3);
    const q = queue(getState(), "ja");
    expect(q.fresh.length).toBe(3);
    expect(new Set(q.fresh.map((c) => c.wordId)).size).toBe(3);
    expect(q.fresh.every((c) => c.kind === "recog")).toBe(true);
  });

  it("keeps a failed card coming back today, and holds back its siblings", () => {
    startNewWords("ja", 1);
    const first = nextCard(getState(), "ja", 0)!;
    grade(first.id, Rating.Again);
    const q = queue(getState(), "ja", Date.now() + 2 * 60_000);
    expect(q.learningNow.map((c) => c.id)).toContain(first.id);
    expect(q.fresh.some((c) => c.wordId === first.wordId)).toBe(false);
  });

  it("schedules a good answer for another day", () => {
    startNewWords("ar", 1);
    const c = nextCard(getState(), "ar", 0)!;
    grade(c.id, Rating.Good);
    grade(c.id, Rating.Good);
    const after = getState().cards.find((x) => x.id === c.id)!;
    expect(after.srs.due - Date.now()).toBeGreaterThan(DAY / 2);
    expect(after.log.length).toBe(2);
  });

  it("limits new script cards a day", () => {
    addScriptCards("ja", Array.from({ length: 30 }, (_, i) => `hira:x${i}`));
    expect(queue(getState(), "ja").fresh.length).toBe(12);
  });
});

describe("dictation score", () => {
  it("is not thrown off by one wrong word", () => {
    const f = (x: string) => foldAccents("es", fold("es", x));
    const got = likeness(f("mi tio que es con contilla se empeno en enterarse de toda mi vida"), f("Mi tío, que es un cotilla, se empeñó en enterarse de toda mi vida."));
    expect(got).toBeGreaterThan(0.93);
    expect(likeness(f("mi tio"), f("Mi tío, que es un cotilla"))).toBeLessThan(0.5);
    expect(likeness("abc", "abc")).toBe(1);
  });
});

describe("checking answers", () => {
  it("accepts romaji for Japanese", () => {
    expect(check("ja", "taberu", ["食べる", "たべる"])).toBe("right");
    expect(check("ja", "たべる", ["食べる", "たべる"])).toBe("right");
    expect(check("ja", "nomu", ["食べる", "たべる"])).toBe("wrong");
  });
  it("does not count missing accents as a mistake", () => {
    expect(check("pl", "jablko", ["jabłko"])).toBe("right");
    expect(check("pl", "Jabłko", ["jabłko"])).toBe("right");
    expect(check("pl", "dziekuje", ["dziękuję"])).toBe("right");
  });
  it("ignores harakat in Arabic", () => {
    expect(check("ar", "كتاب", ["كِتَاب"])).toBe("right");
    expect(check("pt", "pao", ["pão"])).toBe("right");
    expect(check("pt", "Pão", ["pão"])).toBe("right");
    expect(check("el", "καλημερα", ["καλημέρα"])).toBe("right");
    expect(check("el", "kalimera", ["καλημέρα"])).toBe("right");
    expect(check("el", "kalimeri", ["καλημέρα"])).toBe("almost");
    expect(check("el", "nero", ["καλημέρα"])).toBe("wrong");
    expect(check("ru", "привет", ["приве́т"])).toBe("right");
    expect(check("ru", "Еще", ["ещё"])).toBe("right");
    expect(check("ru", "privet", ["приве́т"])).toBe("right");
    expect(check("ru", "mat", ["мать"])).toBe("right");
    expect(check("ru", "privit", ["приве́т"])).toBe("almost");
    expect(check("ru", "spasibo", ["приве́т"])).toBe("wrong");
    expect(check("es", "lio", ["lío"])).toBe("right");
    expect(check("es", "¿Lío?", ["lío"])).toBe("right");
    expect(check("es", "alargo", ["alargó"])).toBe("right");
    expect(check("es", "si claro que si", ["—¡Sí, claro (que sí)!"])).toBe("right");
    expect(check("fr", "cest leau", ["« C’est l’eau. »"])).toBe("right");
    expect(check("ar", "هل انت بخير", ["هل أنت بخير؟"])).toBe("right");
    expect(check("es", "alargp", ["alargó"])).toBe("almost");
    expect(check("fr", "creve", ["crevé"])).toBe("right");
    expect(check("it", "cioe", ["cioè"])).toBe("right");
    expect(check("de", "Strasse", ["Straße"])).toBe("right");
    expect(check("de", "schoen", ["schön"])).toBe("right");
    expect(check("de", "schon", ["schön"])).toBe("right");
    expect(check("de", "zug", ["Zug"])).toBe("right");
    expect(check("nl", "een", ["één"])).toBe("right");
    expect(check("nl", "Gezellig", ["gezellig"])).toBe("right");
    expect(check("ar", "ام", ["أُمّ"])).toBe("right");
  });
  it("takes what a learner types without special keys", () => {
    expect(check("ru", "yozh", ["ёж"])).toBe("right");
    expect(check("ru", "yezh", ["ёж"])).toBe("right");
    expect(check("ru", "chornyy", ["чёрный"])).toBe("right");
    expect(check("ja", "konnichiwa", ["今日は", "こんにちは", "konnichiwa"])).toBe("right");
    expect(check("ja", "konnichiha", ["今日は", "こんにちは", "konnichiwa"])).toBe("right");
    expect(check("ja", "tokyo", ["東京", "とうきょう", "Tōkyō"])).toBe("right");
    expect(check("fr", "coeur", ["cœur"])).toBe("right");
    expect(check("ar", "kitab", ["كِتَاب", "", "kitāb"])).toBe("right");
    expect(check("ar", "كتاب", ["كِتَاب", "", "kitāb"])).toBe("right");
    expect(check("ru", "мой", ["мои"])).not.toBe("right");
    expect(check("el", "efharisto", ["ευχαριστώ"])).toBe("right");
    expect(check("el", "eycharisto", ["ευχαριστώ"])).toBe("right");
    expect(check("el", "geia", ["γεια"])).toBe("right");
    expect(check("el", "yia", ["γεια"])).toBe("right");
    expect(check("el", "kalhmera", ["καλημέρα"])).toBe("right");
    expect(check("el", "kalimera", ["καλημέρα"])).toBe("right");
    expect(check("el", "pedia", ["παιδιά"])).toBe("right");
    expect(check("el", "paidia", ["παιδιά"])).toBe("right");
    expect(check("el", "nero", ["καλημέρα"])).toBe("wrong");
  });
});

import { dayTotals, streak } from "../src/lib/progress";
import { addDays, today } from "../src/lib/dates";
describe("progress", () => {
  it("sums day logs over devices and counts the streak", () => {
    const s = getState();
    const mk = (date: string, device: string, reviews: number) => ({ id: `d_${date}_ja_${device}`, updatedAt: 1, date, lang: "ja" as const, device, reviews, newWords: 0, readSec: 0, talkSec: 0, turns: 0 });
    const t = today();
    replaceState({ ...s, days: [mk(t, "a", 3), mk(t, "b", 2), mk(addDays(t, -1), "a", 1), mk(addDays(t, -3), "a", 5)] });
    expect(dayTotals(getState(), "ja", 2)[1].reviews).toBe(5);
    expect(streak(getState(), "ja")).toBe(2);
    expect(streak(getState(), "pl")).toBe(0);
  });
});
