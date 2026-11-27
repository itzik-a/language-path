/* "All forms" on a word page: the word's declension or conjugation, written by Claude Opus on request and kept on
   the word. Only in the languages with a Grammar section for now. */
import { useState } from "react";
import { hasGrammar } from "../data/grammar";
import { hasClaude } from "../lib/prefs";
import { setWordForms } from "../state/grammar";
import { getState } from "../state/store";
import type { Word } from "../types";
import { FormTable, Rich } from "./FormTable";
import { IconSparkle } from "./Icons";

export function WordForms({ w }: { w: Word }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (!hasGrammar(w.lang) || (!w.forms && !hasClaude())) return null;

  const run = async () => {
    setBusy(true); setErr("");
    try {
      const r = await (await import("../lib/claude")).wordForms(w.lang, w, getState().settings.lang[w.lang].level);
      setWordForms(w.id, { ...r, at: Date.now() });
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  if (!w.forms) {
    return (
      <section className="card">
        <h2>All forms</h2>
        <p className="muted small">Every case or every person and tense of this word, as tables.</p>
        {err && <p className="form-error small" role="alert">{err}</p>}
        <button type="button" className="btn sm" disabled={busy} onClick={() => void run()}><IconSparkle /> {busy ? "Asking Claude… (about half a minute)" : "Show all forms"}</button>
      </section>
    );
  }
  return (
    <section className="card lesson-tables">
      <h2>All forms</h2>
      {w.forms.note && <p className="small"><Rich text={w.forms.note} /></p>}
      {w.forms.tables.length ? w.forms.tables.map((t, i) => <FormTable key={i} lang={w.lang} t={t} />) : <p className="muted small">This word doesn't change.</p>}
      {err && <p className="form-error small" role="alert">{err}</p>}
      <div className="row-between">
        <span className="muted small">Tap a form to hear it.</span>
        {hasClaude() && <button type="button" className="text-btn" disabled={busy} onClick={() => void run()}>{busy ? "Asking…" : "Ask again"}</button>}
      </div>
    </section>
  );
}
