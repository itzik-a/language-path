/* "Explain" a word with Claude: what it does in this sentence, its form, root and Hebrew cognate. */
import { useState } from "react";
import { hasClaude } from "../lib/prefs";
import type { Explanation } from "../lib/claude";
import { getState } from "../state/store";
import type { Lang, Sentence, Token } from "../types";
import { IconSparkle } from "./Icons";

export function Explain({ lang, tok, sentence, onResult }: { lang: Lang; tok: Token; sentence: Sentence; onResult?: (e: Explanation) => void }) {
  const [ex, setEx] = useState<Explanation | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (!hasClaude()) return null;
  const run = async () => {
    setBusy(true); setErr("");
    try { const r = await (await import("../lib/claude")).explainWord(lang, tok, sentence, getState().settings.lang[lang].level); setEx(r); onResult?.(r); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };
  if (!ex) return (
    <div>
      <button type="button" className="btn ghost sm" disabled={busy} onClick={() => void run()}><IconSparkle /> {busy ? "Asking Claude…" : "Explain"}</button>
      {err && <p className="form-error small">{err}</p>}
    </div>
  );
  return (
    <div className="explain">
      <p>{ex.explanation}</p>
      <p className="muted small">{[ex.pos, ex.translit, ex.root && `root ${ex.root}`, ex.hebrew && `Hebrew ${ex.hebrew}`].filter(Boolean).join(" · ")}</p>
    </div>
  );
}
