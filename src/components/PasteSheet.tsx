/* Paste a text to read. Without Claude it's split into sentences and words on the device (no translations or
   meanings); with Claude it's annotated in full (the Claude milestone). */
import { useState } from "react";
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
  const save = (el: HTMLElement) => {
    const lines = splitSentences(lang, body);
    if (!lines.length) return;
    const t: Text = {
      id: `t_${Date.now().toString(36)}`, updatedAt: Date.now(), lang, title: title.trim() || lines[0].slice(0, 40), source: "paste", createdOn: today(),
      sentences: lines.map((l) => ({ tokens: roughTokens(lang, l), tr: "" })),
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
      <p className="muted small">Split into sentences and words on this device. With Claude connected, texts also get translations, readings and meanings.</p>
      <button type="button" className="btn primary" disabled={!body.trim()} onClick={(e) => save(e.currentTarget)}>Add to my texts</button>
    </Sheet>
  );
}
