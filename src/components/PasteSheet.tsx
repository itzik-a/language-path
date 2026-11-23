/* Paste a text to read. With Claude it's annotated in full (readings, meanings, translations); without, it's split
   into sentences and words on the device. */
import { useState } from "react";
import { hasClaude } from "../lib/prefs";
import { today } from "../lib/dates";
import { LANG } from "../lib/langs";
import { go } from "../lib/route";
import { roughTokens, splitSentences } from "../lib/tokens";
import { addText } from "../state/actions";
import type { Lang, Text } from "../types";
import { closeSheet, Field, Sheet } from "./ui";

export function PasteSheet({ lang, onClose }: { lang: Lang; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const claude = hasClaude();

  const save = async (el: HTMLElement) => {
    const lines = splitSentences(lang, body);
    if (!lines.length) return;
    setErr("");
    let sentences: Text["sentences"], titleTr: string | undefined;
    if (claude) {
      setBusy(`Annotating… 0 of ${lines.length}`);
      try {
        const r = await (await import("../lib/claude")).annotate(lang, lines, (n) => setBusy(`Annotating… ${n} of ${lines.length}`));
        sentences = r.sentences; titleTr = r.titleTr;
      } catch (e) { setErr((e as Error).message); setBusy(null); return; }
    } else {
      sentences = lines.map((l) => ({ tokens: roughTokens(lang, l), tr: "" }));
    }
    const t: Text = {
      id: `t_${Date.now().toString(36)}`, updatedAt: Date.now(), lang, title: title.trim() || lines[0].slice(0, 40), source: "paste", createdOn: today(),
      sentences, ...(titleTr ? { titleTr } : {}),
    };
    addText(t);
    closeSheet(el);
    go("read", t.id);
  };
  return (
    <Sheet title="Paste a text" onClose={onClose}>
      <Field label="Title">
        <input className="text-input" lang={LANG[lang].bcp} dir="auto" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Optional" />
      </Field>
      <Field label={`Text in ${LANG[lang].name}`}>
        <textarea className="text-input" rows={8} lang={LANG[lang].bcp} dir={LANG[lang].dir} value={body} onChange={(e) => setBody(e.target.value)} data-autofocus />
      </Field>
      <p className="muted small">{claude ? `Claude adds readings, meanings and a translation for each line${lang === "ar" ? ", and the vowel marks" : ""}.` : "Split into sentences and words on this device. With Claude connected (Settings), texts also get translations, readings and meanings."}</p>
      {err && <p className="form-error" role="alert">{err}</p>}
      <button type="button" className="btn primary" disabled={!body.trim() || !!busy} onClick={(e) => void save(e.currentTarget)}>{busy ?? "Add to my texts"}</button>
    </Sheet>
  );
}
