/* Every change to the saved state goes through here: stamps `updatedAt`, soft-deletes with Undo. */
import { today } from "../lib/dates";
import { newSrs } from "../lib/srs";
import { showToast } from "../lib/toast";
import type { Lang, LangSettings, Word, WordStatus } from "../types";
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
    for (const w of s.words) if (before.has(w.id)) { w.status = status; w.updatedAt = now; }
  });
  const n = before.size;
  const label = status === "known" ? "known" : status === "ignored" ? "ignored" : status === "new" ? "back in the queue" : "learning";
  showToast(`${n === 1 ? "1 word" : `${n} words`} ${label}`, {
    label: "Undo",
    run: () => update((s) => { const now = Date.now(); for (const w of s.words) { const b = before.get(w.id); if (b) { w.status = b; w.updatedAt = now; } } }),
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
