/* Every change to the saved state goes through here: stamps `updatedAt`, soft-deletes with Undo. */
import { today } from "../lib/dates";
import { getPrefs } from "../lib/prefs";
import { newWordsLeft } from "../lib/queue";
import { newSrs, review, type Grade } from "../lib/srs";
import { showToast } from "../lib/toast";
import { lemmaReading } from "../lib/furigana";
import { wordKey } from "../lib/langs";
import type { AppState, Card, CardKind, Chat, DayLog, Lang, LangSettings, Sentence, Text, Token, Turn, Word, WordStatus } from "../types";
import { getState, update } from "./store";

export const live = <T extends { deletedAt?: number }>(xs: T[]) => xs.filter((x) => !x.deletedAt);

export function setLangSettings(lang: Lang, patch: Partial<LangSettings>) {
  update((s) => {
    s.settings.lang[lang] = { ...s.settings.lang[lang], ...patch };
    s.settings.updatedAt = Date.now();
  });
}

export function editWord(id: string, patch: Partial<Word>) {
  update((s) => {
    const w = s.words.find((x) => x.id === id);
    if (w) Object.assign(w, patch, { updatedAt: Date.now() });
  });
}

/** Set the status of several words (e.g. "I know these"), with Undo. */
export function setStatus(ids: string[], status: WordStatus) {
  const before = new Map(getState().words.filter((w) => ids.includes(w.id)).map((w) => [w.id, w.status]));
  update((s) => {
    const now = Date.now();
    for (const w of s.words) if (before.has(w.id)) { w.status = status; w.updatedAt = now; syncWordCards(s, w, now); }
  });
  const n = before.size;
  const label = status === "known" ? "known" : status === "ignored" ? "ignored" : status === "new" ? "back in the queue" : "learning";
  showToast(`${n === 1 ? "1 word" : `${n} words`} ${label}`, {
    label: "Undo",
    run: () => update((s) => { const now = Date.now(); for (const w of s.words) { const b = before.get(w.id); if (b) { w.status = b; w.updatedAt = now; syncWordCards(s, w, now); } } }),
  });
}

export function removeWord(id: string) {
  const w = getState().words.find((x) => x.id === id);
  if (!w) return;
  const at = Date.now();
  update((s) => {
    for (const x of s.words) if (x.id === id) { x.deletedAt = at; x.updatedAt = at; }
    for (const c of s.cards) if (c.wordId === id && !c.deletedAt) { c.deletedAt = at; c.updatedAt = at; }
  });
  showToast(`Removed ${w.lemma}`, {
    label: "Undo",
    run: () => update((s) => {
      const now = Date.now();
      for (const x of s.words) if (x.id === id) { delete x.deletedAt; x.updatedAt = now; }
      for (const c of s.cards) if (c.wordId === id && c.deletedAt === at) { delete c.deletedAt; c.updatedAt = now; }
    }),
  });
}

/** Script cards (kana, letters) for these characters; returns how many were new. */
export function addScriptCards(lang: Lang, charIds: string[]): number {
  const have = new Set(getState().cards.filter((c) => c.kind === "script" && !c.deletedAt).map((c) => c.charId));
  const add = charIds.filter((id) => !have.has(id));
  if (!add.length) return 0;
  update((s) => {
    const now = Date.now();
    for (const charId of add) {
      const id = `c_script_${charId}`;
      const old = s.cards.find((c) => c.id === id);
      if (old) { delete old.deletedAt; old.updatedAt = now; continue; }
      s.cards.push({ id, updatedAt: now, lang, kind: "script", charId, srs: newSrs(now), log: [], addedOn: today() });
    }
  });
  return add.length;
}

// ── cards ─────────────────────────────────────────────────────

const cardId = (wordId: string, kind: CardKind) => `c_${wordId}_${kind}`;

function addCard(s: AppState, w: Word, kind: CardKind, now: number) {
  const id = cardId(w.id, kind);
  const old = s.cards.find((c) => c.id === id);
  if (old) {
    if (old.deletedAt || old.suspended) { delete old.deletedAt; delete old.suspended; old.updatedAt = now; }
    return;
  }
  const at = kind === "cloze" && w.example ? w.example.tokens.findIndex((t) => t.l && sameWord(w, t.l)) : -1;
  if (kind === "cloze" && at < 0) return;
  s.cards.push({
    id, updatedAt: now, lang: w.lang, kind, wordId: w.id, srs: newSrs(now), log: [], addedOn: today(),
    ...(kind === "cloze" ? { cloze: { sentence: w.example!, at } } : {}),
  });
}

const sameWord = (w: Word, lemma: string) => lemma === w.lemma || lemma.replace(/[\u064B-\u065F\u0670]/g, "") === w.lemma.replace(/[\u064B-\u065F\u0670]/g, "") || lemma.toLowerCase() === w.lemma.toLowerCase();

/** A learning word has its cards (recognise, listen, cloze if it has an example; say if due); other words' cards are suspended. */
function syncWordCards(s: AppState, w: Word, now: number) {
  if (w.status === "learning") {
    if (!w.startedOn) w.startedOn = today();
    addCard(s, w, "recog", now);
    addCard(s, w, "listen", now);
    if (w.example) addCard(s, w, "cloze", now);
    if (s.settings.lang[w.lang].sayAfterDays === 0) addCard(s, w, "say", now);
  } else {
    for (const c of s.cards) if (c.wordId === w.id && !c.deletedAt && !c.suspended) { c.suspended = true; c.updatedAt = now; }
  }
}

/** Start today's new words (up to the daily number); returns how many started. */
export function startNewWords(lang: Lang, max?: number): number {
  const s0 = getState();
  const n = Math.min(max ?? Infinity, newWordsLeft(s0, lang));
  if (n <= 0) return 0;
  const next = s0.words.filter((w) => w.lang === lang && !w.deletedAt && w.status === "new").sort((a, b) => a.rank - b.rank).slice(0, n);
  if (!next.length) return 0;
  const ids = new Set(next.map((w) => w.id));
  update((s) => {
    const now = Date.now();
    for (const w of s.words) if (ids.has(w.id)) { w.status = "learning"; w.startedOn = today(); w.updatedAt = now; syncWordCards(s, w, now); }
    bumpDay(s, lang, { newWords: next.length });
  });
  return next.length;
}

/** Start one word now (from its page or a text), outside the daily number. */
export function learnWord(id: string) {
  update((s) => {
    const w = s.words.find((x) => x.id === id);
    if (!w) return;
    const now = Date.now();
    w.status = "learning"; w.startedOn = today(); w.updatedAt = now;
    syncWordCards(s, w, now);
  });
}

/** Answer a card. Returns the card as it was (for Undo). */
export function grade(id: string, g: Grade): Card | undefined {
  const before = getState().cards.find((c) => c.id === id);
  if (!before) return;
  update((s) => {
    const c = s.cards.find((x) => x.id === id)!;
    const now = Date.now();
    c.srs = review(c.srs, g, s.settings.lang[c.lang].retention, now);
    c.log = [...c.log, [now, g]];
    c.updatedAt = now;
    bumpDay(s, c.lang, { reviews: 1 });
    // Recognition is solid: practise saying it.
    if (c.kind === "recog" && c.wordId && c.srs.stability >= s.settings.lang[c.lang].sayAfterDays) {
      const w = s.words.find((x) => x.id === c.wordId);
      if (w && w.status === "learning") addCard(s, w, "say", now);
    }
  });
  return before;
}

export function undoGrade(prev: Card) {
  update((s) => {
    const i = s.cards.findIndex((x) => x.id === prev.id);
    if (i >= 0) s.cards[i] = { ...prev, updatedAt: Date.now() };
    bumpDay(s, prev.lang, { reviews: -1 });
  });
}

export function suspendCard(id: string, on: boolean) {
  update((s) => {
    const c = s.cards.find((x) => x.id === id);
    if (!c) return;
    if (on) c.suspended = true; else delete c.suspended;
    c.updatedAt = Date.now();
  });
}

/** Forget a card's progress (start it again as new). */
export function resetCard(id: string) {
  update((s) => { const c = s.cards.find((x) => x.id === id); if (c) { c.srs = newSrs(); c.updatedAt = Date.now(); } });
}

// ── day logs ──────────────────────────────────────────────────

export function bumpDay(s: AppState, lang: Lang, d: Partial<Pick<DayLog, "reviews" | "newWords" | "readSec" | "talkSec" | "turns">>) {
  const date = today();
  const device = getPrefs().device;
  const id = `d_${date}_${lang}_${device}`;
  let log = s.days.find((x) => x.id === id);
  if (!log) { log = { id, updatedAt: 0, date, lang, device, reviews: 0, newWords: 0, readSec: 0, talkSec: 0, turns: 0 }; s.days.push(log); }
  for (const [k, v] of Object.entries(d) as [keyof typeof d, number][]) log[k] = Math.max(0, (log[k] ?? 0) + v);
  log.updatedAt = Date.now();
}

export function logTime(lang: Lang, field: "readSec" | "talkSec", sec: number) {
  if (sec < 3) return;
  update((s) => bumpDay(s, lang, { [field]: Math.round(sec) }));
}

// ── texts ─────────────────────────────────────────────────────

/** A word met in a text: learn it now, put it next in the queue, or mark it known. Returns its id. */
export function wordFromToken(lang: Lang, tok: Token, sentence: Sentence, how: "learn" | "queue" | "known", source: Word["source"] = "text", extra: Partial<Word> = {}): string {
  const lemma = tok.l!;
  const id = wordKey(lang, lemma);
  update((s) => {
    const now = Date.now();
    let w = s.words.find((x) => x.id === id);
    if (!w) {
      const minRank = Math.min(0, ...s.words.filter((x) => x.lang === lang).map((x) => x.rank));
      const reading = lang === "ja" ? lemmaReading(tok.t, tok.r, lemma) : undefined;
      w = {
        id, updatedAt: now, lang, lemma, gloss: tok.g ?? "", status: "new", rank: minRank - 1, source,
        ...(reading && reading !== lemma ? { reading } : {}), ...(tok.x && tok.t === lemma ? { translit: tok.x } : {}),
        example: sentence, ...extra,
      };
      s.words.push(w);
    } else {
      if (w.deletedAt) delete w.deletedAt;
      if (!w.example) w.example = sentence;
      if (!w.gloss && tok.g) w.gloss = tok.g;
      if (how === "queue" && w.status === "new") w.rank = Math.min(0, ...s.words.filter((x) => x.lang === lang).map((x) => x.rank)) - 1;
    }
    w.status = how === "learn" ? "learning" : how === "known" ? "known" : w.status === "learning" ? "learning" : "new";
    w.updatedAt = now;
    syncWordCards(s, w, now);
  });
  return id;
}

export function addText(t: Text) {
  update((s) => { s.texts.push(t); });
}

export function markRead(id: string, on = true) {
  update((s) => { const t = s.texts.find((x) => x.id === id); if (t) { if (on) t.readAt = Date.now(); else delete t.readAt; t.updatedAt = Date.now(); } });
}

export function countListen(id: string) {
  update((s) => { const t = s.texts.find((x) => x.id === id); if (t) { t.listens = (t.listens ?? 0) + 1; t.updatedAt = Date.now(); } });
}

export function removeText(id: string) {
  const t = getState().texts.find((x) => x.id === id);
  if (!t) return;
  update((s) => { const x = s.texts.find((y) => y.id === id)!; x.deletedAt = Date.now(); x.updatedAt = Date.now(); });
  showToast(`Removed "${t.title}"`, { label: "Undo", run: () => update((s) => { const x = s.texts.find((y) => y.id === id)!; delete x.deletedAt; x.updatedAt = Date.now(); }) });
}

/** Words suggested by Claude go to the end of the queue (or the front with `first`). Returns how many were new. */
export function addSuggested(lang: Lang, words: Omit<Word, "id" | "updatedAt" | "lang" | "status" | "rank" | "source">[], first = false): number {
  let n = 0;
  update((s) => {
    const now = Date.now();
    const ranks = s.words.filter((w) => w.lang === lang).map((w) => w.rank);
    let rank = first ? Math.min(0, ...ranks) - words.length : Math.max(0, ...ranks) + 1;
    for (const x of words) {
      const id = wordKey(lang, x.lemma);
      const old = s.words.find((w) => w.id === id);
      if (old && !old.deletedAt) continue;
      if (old) s.words.splice(s.words.indexOf(old), 1);
      s.words.push({ ...x, id, updatedAt: now, lang, status: "new", rank: rank++, source: "claude" });
      n++;
    }
  });
  return n;
}

// ── chats ─────────────────────────────────────────────────────

export function newChat(lang: Lang, scenario: string): string {
  const id = `ch_${Date.now().toString(36)}`;
  update((s) => { s.chats.push({ id, updatedAt: Date.now(), lang, scenario, turns: [], createdOn: today() }); });
  return id;
}

export function addTurn(chatId: string, turn: Turn, fixForLast?: Turn["fix"]) {
  update((s) => {
    const c = s.chats.find((x) => x.id === chatId);
    if (!c) return;
    if (fixForLast) for (let i = c.turns.length - 1; i >= 0; i--) if (c.turns[i].who === "me") { c.turns[i].fix = fixForLast; break; }
    c.turns.push(turn);
    c.updatedAt = Date.now();
    if (turn.who === "me") bumpDay(s, c.lang, { turns: 1 });
  });
}

export function setChatReview(chatId: string, review: NonNullable<Chat["review"]>) {
  update((s) => { const c = s.chats.find((x) => x.id === chatId); if (c) { c.review = review; c.updatedAt = Date.now(); } });
}

export function removeChat(id: string) {
  update((s) => { const c = s.chats.find((x) => x.id === id); if (c) { c.deletedAt = Date.now(); c.updatedAt = Date.now(); } });
  showToast("Conversation removed", { label: "Undo", run: () => update((s) => { const c = s.chats.find((x) => x.id === id); if (c) { delete c.deletedAt; c.updatedAt = Date.now(); } }) });
}
