/* Grammar: lessons (written by Claude, kept and synced), my progress on their drills, a word's forms, and what
   the rest of the app knows about a topic (my mistakes in Talk). Drills are practised only when I start a grammar
   practice: they never join the daily reviews (src/lib/queue.ts doesn't see them). */
import { lessonId, topicsFor, type Topic } from "../data/grammar";
import { today } from "../lib/dates";
import { newSrs, review, type Grade } from "../lib/srs";
import type { AppState, Drill, GCard, Lang, Lesson } from "../types";
import { live } from "./actions";
import { getState, update } from "./store";

export type LessonBody = Pick<Lesson, "intro" | "tables" | "examples" | "compare" | "mistakes" | "drills">;

export const lessonOf = (s: AppState, topic: string): Lesson | undefined => s.lessons.find((l) => l.id === lessonId(topic) && !l.deletedAt);

/** Save a (re)written lesson. A rewrite brings new drills; the old drills' progress stays behind, unused. */
export function saveLesson(lang: Lang, topic: string, body: LessonBody, model: string) {
  update((s) => {
    const id = lessonId(topic);
    const now = Date.now();
    const l: Lesson = { id, updatedAt: now, lang, topic, ...body, model, writtenOn: today() };
    const i = s.lessons.findIndex((x) => x.id === id);
    if (i >= 0) s.lessons[i] = l; else s.lessons.push(l);
  });
}

export function addDrills(topic: string, drills: Drill[]) {
  update((s) => {
    const l = s.lessons.find((x) => x.id === lessonId(topic));
    if (!l) return;
    l.drills = [...l.drills, ...drills];
    l.updatedAt = Date.now();
  });
}

export const gcardId = (topic: string, drill: string) => `gc_${topic}_${drill}`;

/** Answer a drill. Returns the drill's progress as it was (undefined if it was new), so a grade can be changed. */
export function answerDrill(lang: Lang, topic: string, drill: string, g: Grade): GCard | undefined {
  const id = gcardId(topic, drill);
  const before = getState().gcards.find((c) => c.id === id);
  update((s) => {
    const now = Date.now();
    let c = s.gcards.find((x) => x.id === id);
    if (!c) { c = { id, updatedAt: now, lang, topic, drill, srs: newSrs(now), log: [] }; s.gcards.push(c); }
    c.srs = review(c.srs, g, s.settings.lang[lang].retention, now);
    c.log = [...c.log, [now, g]];
    c.updatedAt = now;
    delete c.deletedAt;
  });
  return before;
}

/** Change the last answer to a drill ("Count it as right"): back to how it was, then answered again with `g`. */
export function regradeDrill(lang: Lang, topic: string, drill: string, before: GCard | undefined, g: Grade) {
  const id = gcardId(topic, drill);
  update((s) => {
    const i = s.gcards.findIndex((x) => x.id === id);
    if (i < 0) return;
    if (before) s.gcards[i] = { ...before, updatedAt: Date.now() };
    else s.gcards.splice(i, 1);
  });
  answerDrill(lang, topic, drill, g);
}

export function setWordForms(wordId: string, forms: NonNullable<import("../types").Word["forms"]>) {
  update((s) => {
    const w = s.words.find((x) => x.id === wordId);
    if (w) { w.forms = forms; w.updatedAt = Date.now(); }
  });
}

// ── progress ──────────────────────────────────────────────────

/** A drill counts as solid once it's stable for two weeks. */
const SOLID_DAYS = 14;

export type TopicStatus = "new" | "ready" | "learning" | "solid";
export const STATUS_TEXT: Record<TopicStatus, string> = { new: "Not started", ready: "Lesson ready", learning: "Practising", solid: "Solid" };

export interface TopicProgress {
  status: TopicStatus;
  drills: number;
  /** drills answered at least once */
  practised: number;
  solid: number;
  /** drills due again now */
  due: number;
}

export function topicProgress(s: AppState, topic: string, now = Date.now()): TopicProgress {
  const l = lessonOf(s, topic);
  if (!l) return { status: "new", drills: 0, practised: 0, solid: 0, due: 0 };
  const cards = new Map(live(s.gcards).filter((c) => c.topic === topic).map((c) => [c.drill, c]));
  let practised = 0, solid = 0, due = 0;
  for (const d of l.drills) {
    const c = cards.get(d.id);
    if (!c || !c.log.length) continue;
    practised++;
    if (c.srs.stability >= SOLID_DAYS) solid++;
    if (c.srs.due <= now) due++;
  }
  const status: TopicStatus = !practised ? "ready" : l.drills.length && solid >= Math.ceil(l.drills.length * 0.8) ? "solid" : "learning";
  return { status, drills: l.drills.length, practised, solid, due };
}

/** A practice round for one topic: drills due again first, then ones never done, then the least stable. */
export function practiceRound(s: AppState, topic: string, size = 10, now = Date.now()): Drill[] {
  const l = lessonOf(s, topic);
  if (!l) return [];
  const cards = new Map(live(s.gcards).filter((c) => c.topic === topic).map((c) => [c.drill, c]));
  const rank = (d: Drill) => {
    const c = cards.get(d.id);
    if (!c || !c.log.length) return 1e6; // never done: after the due ones
    if (c.srs.due <= now) return c.srs.due - now; // due: most overdue first (negative)
    return 2e6 + c.srs.stability; // not due: least stable first
  };
  return [...l.drills].sort((a, b) => rank(a) - rank(b)).slice(0, size);
}

/** A mixed round: drills due again across every topic I've practised. */
export function mixedRound(s: AppState, lang: Lang, size = 12, now = Date.now()): { topic: string; drill: Drill }[] {
  const out: { topic: string; drill: Drill; due: number }[] = [];
  for (const c of live(s.gcards)) {
    if (c.lang !== lang || !c.log.length || c.srs.due > now) continue;
    const d = lessonOf(s, c.topic)?.drills.find((x) => x.id === c.drill);
    if (d) out.push({ topic: c.topic, drill: d, due: c.srs.due });
  }
  return out.sort((a, b) => a.due - b.due).slice(0, size).map(({ topic, drill }) => ({ topic, drill }));
}

export function dueDrills(s: AppState, lang: Lang, now = Date.now()): number {
  return live(s.gcards).filter((c) => c.lang === lang && c.log.length && c.srs.due <= now && lessonOf(s, c.topic)?.drills.some((d) => d.id === c.drill)).length;
}

// ── mistakes from Talk ────────────────────────────────────────

export interface Mistake { said: string; better: string; why: string; chatId: string; at: number }

/** My corrected lines in conversations, by topic (both the corrections during a chat and the end-of-chat review). */
export function mistakesByTopic(s: AppState, lang: Lang): Map<string, Mistake[]> {
  const out = new Map<string, Mistake[]>();
  const add = (topic: string | undefined, m: Mistake) => {
    if (!topic) return;
    const list = out.get(topic) ?? [];
    if (!list.some((x) => x.better === m.better)) list.push(m);
    out.set(topic, list);
  };
  for (const c of live(s.chats)) {
    if (c.lang !== lang) continue;
    for (const t of c.turns) if (t.who === "me" && t.fix) add(t.fix.topic, { said: t.text, better: t.fix.better, why: t.fix.why, chatId: c.id, at: t.at });
    for (const p of c.review?.points ?? []) add(p.topic, { said: p.said, better: p.better, why: p.why, chatId: c.id, at: c.updatedAt });
  }
  for (const list of out.values()) list.sort((a, b) => b.at - a.at);
  return out;
}

/** The topic with the most recent mistakes (last 30 days) that isn't solid yet: what Today suggests. */
export function suggestTopic(s: AppState, lang: Lang, now = Date.now()): { topic: Topic; count: number } | undefined {
  const by = mistakesByTopic(s, lang);
  const since = now - 30 * 86400_000;
  let best: { topic: Topic; count: number } | undefined;
  for (const t of topicsFor(lang)) {
    const n = (by.get(t.id) ?? []).filter((m) => m.at >= since).length;
    if (n && topicProgress(s, t.id, now).status !== "solid" && (!best || n > best.count)) best = { topic: t, count: n };
  }
  return best;
}
