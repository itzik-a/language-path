/* Ask Claude for the next most useful words I don't have; they join the queue. */
import { useState } from "react";
import { hasClaude } from "../lib/prefs";
import { stripHarakat } from "../lib/langs";
import { showToast } from "../lib/toast";
import { addSuggested } from "../state/actions";
import { getState } from "../state/store";
import type { Lang } from "../types";
import { IconSparkle } from "./Icons";

export function SuggestWords({ lang, className = "btn ghost sm" }: { lang: Lang; className?: string }) {
  const [busy, setBusy] = useState(false);
  if (!hasClaude()) return null;
  const run = async () => {
    setBusy(true);
    try {
      const s = getState();
      const have = s.words.filter((w) => w.lang === lang && !w.deletedAt).map((w) => (lang === "ar" ? stripHarakat(w.lemma) : w.lemma)).join(", ");
      const words = await (await import("../lib/claude")).suggestWords(lang, { level: s.settings.lang[lang].level, have, count: 12 });
      const n = addSuggested(lang, words.map((w) => ({
        lemma: w.lemma, gloss: w.gloss, pos: w.pos, example: w.example,
        ...(w.reading && w.reading !== w.lemma && lang === "ja" ? { reading: w.reading } : {}),
        ...(w.translit ? { translit: w.translit } : {}), ...(w.note ? { note: w.note } : {}),
        ...(w.root ? { root: w.root } : {}), ...(w.hebrew ? { hebrew: w.hebrew } : {}),
      })));
      showToast(n ? `${n} new words in your queue` : "Claude only suggested words you have");
    } catch (e) { showToast((e as Error).message); }
    finally { setBusy(false); }
  };
  return <button type="button" className={className} disabled={busy} onClick={() => void run()}><IconSparkle /> {busy ? "Picking words…" : "Suggest more words"}</button>;
}
