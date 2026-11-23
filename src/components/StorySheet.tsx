/* "Write me a story": Claude writes a story from the words I know, with a few new ones. */
import { useState } from "react";
import { hasClaude } from "../lib/prefs";
import { today } from "../lib/dates";
import { LANG } from "../lib/langs";
import { go } from "../lib/route";
import { addText } from "../state/actions";
import { getState } from "../state/store";
import type { Lang } from "../types";
import { closeSheet, Field, Seg, Sheet } from "./ui";

const TOPICS = ["daily life", "food and cafés", "travel", "family", "a small mystery", "work", "shopping", "the weather", "a funny moment"];

export function StorySheet({ lang, onClose }: { lang: Lang; onClose: () => void }) {
  const [topic, setTopic] = useState("");
  const [lines, setLines] = useState(8);
  const [fresh, setFresh] = useState(4);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  if (!hasClaude()) {
    return (
      <Sheet title="Write me a story" onClose={onClose}>
        <p className="muted">Stories at your level are written by Claude. Add your Claude API key in Settings → Claude to turn this on.</p>
      </Sheet>
    );
  }

  const go_ = async (el: HTMLElement) => {
    setBusy(true); setErr("");
    try {
      const s = getState();
      const claude = await import("../lib/claude");
      const r = await claude.writeStory(lang, { level: s.settings.lang[lang].level, known: claude.knownList(s, lang), topic, lines, newWords: fresh });
      const id = `t_${Date.now().toString(36)}`;
      addText({ id, updatedAt: Date.now(), lang, title: r.title, titleTr: r.titleTr, sentences: r.sentences, source: "claude", prompt: topic, createdOn: today(), newWords: r.newWords });
      closeSheet(el);
      go("read", id);
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  };

  return (
    <Sheet title="Write me a story" onClose={onClose}>
      <p className="muted small">Claude writes it from the {LANG[lang].name} words you know or are learning, with a few new ones, each used at least twice.</p>
      <Field label="About">
        <input className="text-input" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Anything, or leave it to Claude" />
      </Field>
      <div className="chips">{TOPICS.map((t) => <button key={t} type="button" className="chip" aria-pressed={topic === t} onClick={() => setTopic(topic === t ? "" : t)}>{t}</button>)}</div>
      <div className="field"><span className="field-label">Length</span>
        <Seg label="Length" value={lines} onChange={setLines} options={[{ id: 5, label: "Short" }, { id: 8, label: "Medium" }, { id: 14, label: "Long" }]} />
      </div>
      <div className="field"><span className="field-label">New words</span>
        <Seg label="New words" value={fresh} onChange={setFresh} options={[{ id: 2, label: "2" }, { id: 4, label: "4" }, { id: 7, label: "7" }]} />
      </div>
      {err && <p className="form-error" role="alert">{err}</p>}
      <button type="button" className="btn primary" disabled={busy} onClick={(e) => void go_(e.currentTarget)}>{busy ? "Writing… (about half a minute)" : "Write it"}</button>
    </Sheet>
  );
}
