/* A word tapped in a text or a chat: meaning, reading, and what to do with it. */
import { useState } from "react";
import { Line, Term, useDisplay } from "./Lx";
import type { Explanation } from "../lib/claude";
import { lemmaReading } from "../lib/furigana";
import { wordKey } from "../lib/langs";
import { href } from "../lib/route";
import { speak } from "../lib/speech";
import { sentenceText } from "../lib/tokens";
import { STATUS_LABEL } from "../lib/words";
import { wordFromToken } from "../state/actions";
import { useAppState } from "../state/store";
import type { Lang, Sentence, Token } from "../types";
import { IconSpeaker } from "./Icons";
import { Explain } from "./Explain";
import { Sheet } from "./ui";
import { topicForHint } from "../data/grammar";

export function WordPop({ lang, tok, sentence, onClose, source = "text" }: { lang: Lang; tok: Token; sentence: Sentence; onClose: () => void; source?: "text" | "chat" }) {
  const s = useAppState();
  const d = useDisplay(lang);
  const lemma = tok.l!;
  const w = s.words.find((x) => x.id === wordKey(lang, lemma) && !x.deletedAt);
  const reading = lang === "ja" ? (w?.reading ?? lemmaReading(tok.t, tok.r, lemma)) : undefined;
  const [ex, setEx] = useState<Explanation | null>(null);
  const gram = topicForHint(lang, tok.g);
  const extra = ex ? {
    gloss: ex.gloss || tok.g || "", ...(ex.pos ? { pos: ex.pos } : {}), ...(ex.translit ? { translit: ex.translit } : {}),
    ...(ex.reading && lang === "ja" ? { reading: ex.reading } : {}), ...(ex.root ? { root: ex.root } : {}), ...(ex.hebrew ? { hebrew: ex.hebrew } : {}),
  } : {};
  const act = (how: "learn" | "queue" | "known") => { wordFromToken(lang, tok, sentence, how, source, extra); onClose(); };

  return (
    <Sheet title="Word" onClose={onClose}>
      <div className="row-head">
        <div>
          <Term lang={lang} text={lemma} reading={reading} d={{ ...d, harakat: true }} forceReading className="word-big" />
          {tok.t !== lemma && <span className="muted small">here: <span lang={lang}>{tok.t}</span></span>}
          {(tok.x || w?.translit) && <span className="muted">{w?.translit ?? tok.x}</span>}
        </div>
        <button type="button" className="icon-btn" aria-label="Say it" onClick={() => void speak(lang === "ja" ? (reading ?? lemma) : lemma, lang)}><IconSpeaker /></button>
      </div>
      <p className="word-gloss">{w?.gloss || tok.g || "—"}</p>
      {w && tok.g && w.gloss !== tok.g && <p className="muted small">Here: {tok.g}</p>}
      {gram && <a className="link small" href={href("grammar", gram.id)} onClick={onClose}>Grammar: {gram.title}</a>}
      {w?.note && <p className="note small">{w.note}</p>}
      <div className="pop-sentence">
        <button type="button" className="icon-btn subtle" aria-label="Hear the sentence" onClick={() => void speak(sentenceText(sentence), lang)}><IconSpeaker width={18} height={18} /></button>
        <div><Line lang={lang} s={sentence} d={d} mark={(t) => (t === tok ? "hit" : undefined)} />{sentence.tr && <span className="muted small">{sentence.tr}</span>}</div>
      </div>
      <Explain lang={lang} tok={tok} sentence={sentence} onResult={setEx} />
      {w ? (
        <div className="pop-status">
          <span className="tag">{STATUS_LABEL[w.status]}</span>
          <div className="btn-row">
            {w.status !== "learning" && <button type="button" className="btn primary sm" onClick={() => act("learn")}>Learn it now</button>}
            {w.status !== "known" && <button type="button" className="btn sm" onClick={() => act("known")}>I know it</button>}
            <a className="btn ghost sm" href={href("words", w.id)} onClick={onClose}>Word page</a>
          </div>
        </div>
      ) : (
        <div className="dlg-actions">
          <button type="button" className="btn primary" onClick={() => act("learn")}>Learn it now</button>
          <div className="dlg-actions row">
            <button type="button" className="btn" onClick={() => act("queue")}>Next in my queue</button>
            <button type="button" className="btn ghost" onClick={() => act("known")}>I know it</button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
