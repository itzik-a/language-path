/* The review session: one card at a time, answer first, then grade (Again / Hard / Good / Easy). */
import { useEffect, useMemo, useRef, useState } from "react";
import { IconClose, IconSpeaker } from "../components/Icons";
import { Line, Term, useDisplay } from "../components/Lx";
import { charById } from "../data/scripts";
import { check, type Verdict } from "../lib/check";
import { interval } from "../lib/dates";
import { LANG } from "../lib/langs";
import { nextCard, queue, remaining } from "../lib/queue";
import { toKana } from "../lib/romaji";
import { href } from "../lib/route";
import { speak, stopSpeaking } from "../lib/speech";
import { preview, Rating, type Grade } from "../lib/srs";
import { sentenceText } from "../lib/tokens";
import { sayWord } from "../lib/words";
import { grade, startNewWords, undoGrade } from "../state/actions";
import { getState, useAppState } from "../state/store";
import type { Card, Lang, Word } from "../types";

const GRADES: { g: Grade; label: string; key: string }[] = [
  { g: Rating.Again, label: "Again", key: "1" },
  { g: Rating.Hard, label: "Hard", key: "2" },
  { g: Rating.Good, label: "Good", key: "3" },
  { g: Rating.Easy, label: "Easy", key: "4" },
];

export function Review({ lang }: { lang: Lang; sub?: string }) {
  const s = useAppState();
  const [started, setStarted] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [currentId, setCurrentId] = useState<string | null>(() => nextCard(getState(), lang, 0)?.id ?? null);
  const began = useRef(false);
  useEffect(() => {
    if (began.current) return;
    began.current = true;
    const n = startNewWords(lang);
    if (n) { setStarted(n); setCurrentId((id) => id ?? nextCard(getState(), lang, 0)?.id ?? null); }
  }, [lang]);
  const [shown, setShown] = useState(false);
  const [last, setLast] = useState<Card | null>(null);
  const card = s.cards.find((c) => c.id === currentId) ?? null;
  const q = useMemo(() => queue(s, lang), [s, lang]);
  const left = remaining(q);

  useEffect(() => () => stopSpeaking(), []);

  const answer = (g: Grade) => {
    if (!card) return;
    const prev = grade(card.id, g);
    setLast(prev ?? null);
    setAnswered((n) => n + 1);
    setShown(false);
    setCurrentId(nextCard(getState(), lang, answered + 1)?.id ?? null);
  };
  const undo = () => {
    if (!last) return;
    undoGrade(last);
    setCurrentId(last.id);
    setShown(true);
    setAnswered((n) => Math.max(0, n - 1));
    setLast(null);
  };

  return (
    <div className="review">
      <div className="review-top">
        <a className="icon-btn subtle" href={href("today")} aria-label="Close"><IconClose width={20} height={20} /></a>
        <span className="review-count" aria-live="polite">{card ? <><b>{left}</b> left{answered ? ` · ${answered} done` : ""}</> : ""}</span>
        {last ? <button type="button" className="btn ghost sm" onClick={undo}>Undo</button> : <span style={{ width: 44 }} />}
      </div>
      {card ? (
        <CardView key={card.id + ":" + card.log.length} card={card} lang={lang} shown={shown} onShow={() => setShown(true)} onGrade={answer} />
      ) : (
        <Done lang={lang} answered={answered} started={started} />
      )}
    </div>
  );
}

function Done({ lang, answered, started }: { lang: Lang; answered: number; started: number }) {
  const s = useAppState();
  const ahead = queue(s, lang).ahead.length;
  return (
    <section className="card review-done">
      <span className="eyebrow">{LANG[lang].name}</span>
      <h1 className="display">{answered ? "Done for now" : "Nothing to review"}</h1>
      <p className="muted">
        {answered ? `${answered} answered${started ? `, ${started} new word${started === 1 ? "" : "s"} started` : ""}. ` : ""}
        {ahead ? `${ahead} card${ahead === 1 ? " comes" : "s come"} back in a few minutes.` : "Come back tomorrow for the next ones."}
      </p>
      <div className="btn-row">
        <a className="btn primary" href={href("today")}>Back to today</a>
        <a className="btn ghost" href={href("read")}>Read something</a>
      </div>
    </section>
  );
}

function CardView({ card, lang, shown, onShow, onGrade }: { card: Card; lang: Lang; shown: boolean; onShow: () => void; onGrade: (g: Grade) => void }) {
  const s = useAppState();
  const d = useDisplay(lang);
  const word = card.wordId ? s.words.find((w) => w.id === card.wordId) : undefined;
  const ch = card.charId ? charById(card.charId) : undefined;
  const [typed, setTyped] = useState("");
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const retention = s.settings.lang[lang].retention;
  const times = useMemo(() => preview(card.srs, retention), [card.srs, retention]);
  const typeRef = useRef<HTMLInputElement>(null);

  const audio = () => {
    if (card.kind === "script" && ch) return void speak(ch.say, lang);
    if (card.kind === "cloze" && card.cloze) return void speak(sentenceText(card.cloze.sentence), lang);
    if (word) void speak(sayWord(word), lang);
  };

  // Listening cards play on the front; the rest on the back.
  useEffect(() => { if (card.kind === "listen") audio(); }, []);
  useEffect(() => { if (shown && card.kind !== "listen") audio(); }, [shown]);

  const reveal = () => {
    if (card.kind === "say" && typed.trim() && word) setVerdict(check(lang, typed, [word.lemma, word.reading ?? "", word.translit ?? ""]));
    if (card.kind === "cloze" && typed.trim() && card.cloze) {
      const tok = card.cloze.sentence.tokens[card.cloze.at];
      setVerdict(check(lang, typed, [tok.t, tok.r ?? "", tok.l ?? ""]));
    }
    onShow();
  };

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement && !shown) { if (e.key === "Enter") { e.preventDefault(); reveal(); } return; }
      if (!shown && (e.key === " " || e.key === "Enter")) { e.preventDefault(); reveal(); return; }
      const g = GRADES.find((x) => x.key === e.key);
      if (shown && g) { e.preventDefault(); onGrade(g.g); }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  });

  if (!word && !ch) return <section className="card"><p className="muted">This card's word was removed.</p><button type="button" className="btn" onClick={() => onGrade(Rating.Good)}>Skip</button></section>;

  const suggested: Grade | null = verdict === "right" ? Rating.Good : verdict === "almost" ? Rating.Hard : verdict === "wrong" ? Rating.Again : null;
  const kindLabel = { recog: "What does it mean?", listen: "What do you hear?", say: "How do you say it?", cloze: "Which word is missing?", script: "How is it read?" }[card.kind];
  const typing = card.kind === "say" || card.kind === "cloze";
  const kana = lang === "ja" && /[a-z]/i.test(typed) ? toKana(typed) : "";

  return (
    <section className={`card flash kind-${card.kind}`}>
      <span className="eyebrow">{kindLabel}{card.srs.state === 0 ? " · new" : ""}</span>

      <div className="flash-front">
        {card.kind === "recog" && word && <Term lang={lang} text={word.lemma} reading={word.reading} d={d} className="flash-term" />}
        {card.kind === "listen" && (
          <button type="button" className="play-big" aria-label="Play again" onClick={audio}><IconSpeaker width={40} height={40} /></button>
        )}
        {card.kind === "say" && word && (
          <div className="flash-prompt"><span className="flash-gloss">{word.gloss}</span>{word.pos && <span className="muted small">{word.pos}</span>}</div>
        )}
        {card.kind === "cloze" && card.cloze && (
          <div className="flash-prompt">
            <Line lang={lang} s={card.cloze.sentence} d={d} hide={shown ? undefined : card.cloze.at} mark={(t) => (shown && t === card.cloze!.sentence.tokens[card.cloze!.at] ? "hit" : undefined)} className="big-line" />
            <span className="muted">{card.cloze.sentence.tr}</span>
            {!shown && card.cloze.sentence.tokens[card.cloze.at].g && <span className="small">({card.cloze.sentence.tokens[card.cloze.at].g})</span>}
          </div>
        )}
        {card.kind === "script" && ch && <span className={`flash-term char-big lx-${lang}`} lang={LANG[lang].bcp}>{ch.char}</span>}
      </div>

      {typing && !shown && (
        <div className="type-box">
          <input ref={typeRef} className="text-input" lang={LANG[lang].bcp} dir={LANG[lang].dir === "rtl" ? "auto" : undefined} autoCapitalize="off" autoCorrect="off" spellCheck={false}
            placeholder={lang === "ja" ? "Type it (romaji works), or just say it" : "Type it, or just say it out loud"} value={typed} onChange={(e) => setTyped(e.target.value)} />
          {kana && <span className="muted small" lang="ja">→ {kana}</span>}
        </div>
      )}

      {shown && (
        <div className="flash-back">
          {verdict && <p className={`verdict ${verdict}`}>{verdict === "right" ? "Right" : verdict === "almost" ? "Almost: check the spelling" : `You typed: ${typed}`}</p>}
          {card.kind === "script" && ch ? <ScriptBack ch={ch} /> : word && <WordBack word={word} lang={lang} d={d} kind={card.kind} onPlay={audio} />}
        </div>
      )}

      <div className="flash-actions">
        {!shown ? (
          <button type="button" className="btn primary big" onClick={reveal}>Show answer</button>
        ) : (
          <div className="grades">
            {GRADES.map(({ g, label }) => (
              <button key={g} type="button" className={`grade g${g}${suggested === g ? " hint" : ""}`} onClick={() => onGrade(g)}>
                <b>{label}</b><span>{interval(times[g])}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function WordBack({ word, lang, d, kind, onPlay }: { word: Word; lang: Lang; d: ReturnType<typeof useDisplay>; kind: Card["kind"]; onPlay: () => void }) {
  return (
    <>
      <div className="row-head">
        <div>
          {kind !== "recog" && <Term lang={lang} text={word.lemma} reading={word.reading} d={{ ...d, harakat: true }} forceReading className="flash-term small-term" />}
          {kind === "recog" && lang === "ja" && word.reading && <span className="flash-reading" lang="ja">{word.reading}</span>}
          {(lang !== "ja" || d.translit) && word.translit && word.translit !== word.lemma && <span className="muted">{word.translit}</span>}
          <span className="flash-gloss">{word.gloss}</span>
        </div>
        <button type="button" className="icon-btn" aria-label="Hear it" onClick={onPlay}><IconSpeaker /></button>
      </div>
      {(word.root || word.hebrew) && (
        <p className="small muted">{word.root && <>Root <bdi lang="ar" className="lx-ar">{word.root}</bdi></>}{word.root && word.hebrew && " · "}{word.hebrew && <>Hebrew <span lang="he">{word.hebrew}</span></>}</p>
      )}
      {word.note && <p className="small note">{word.note}</p>}
      {kind !== "cloze" && word.example && (
        <div className="flash-example">
          <button type="button" className="icon-btn subtle" aria-label="Hear the example" onClick={() => void speak(sentenceText(word.example!), lang)}><IconSpeaker width={18} height={18} /></button>
          <div><Line lang={lang} s={word.example} d={d} /><span className="muted small">{word.example.tr}</span></div>
        </div>
      )}
      <a className="link small" href={href("words", word.id)}>Word page</a>
    </>
  );
}

function ScriptBack({ ch }: { ch: NonNullable<ReturnType<typeof charById>> }) {
  return (
    <div className="flash-prompt">
      <span className="flash-gloss">{ch.sound}</span>
      {ch.name && <span className="muted">{ch.name}</span>}
      {ch.info && <span className="small">{ch.info}</span>}
      {ch.hebrew && <span className="small muted">Hebrew <span lang="he">{ch.hebrew}</span></span>}
    </div>
  );
}

