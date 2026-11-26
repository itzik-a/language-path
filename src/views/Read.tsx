/* Read: my texts (library) and the reader (tap a word, sentence-by-sentence audio, listen first, shadow, dictation). */
import { useEffect, useMemo, useRef, useState } from "react";
import { IconBack, IconEye, IconMic, IconNext, IconPlay, IconPlus, IconSparkle, IconStop, IconTranslate } from "../components/Icons";
import { Line, useDisplay } from "../components/Lx";
import { PasteSheet } from "../components/PasteSheet";
import { StorySheet } from "../components/StorySheet";
import { Seg, useLocalState } from "../components/ui";
import { WordPop } from "../components/WordPop";
import { check, foldAccents } from "../lib/check";
import { coverage, isKnown, knownSet } from "../lib/coverage";
import { fold, LANG } from "../lib/langs";
import { setPrefs, usePrefs } from "../lib/prefs";
import { canRecord, playUrl, record, releaseMic } from "../lib/recorder";
import { href } from "../lib/route";
import { speak, speakLines, stopSpeaking } from "../lib/speech";
import { sentenceText, speakText } from "../lib/tokens";
import { toKana } from "../lib/romaji";
import { countListen, live, logTime, markRead, removeText } from "../state/actions";
import { useAppState } from "../state/store";
import type { Lang, Sentence, Text, Token } from "../types";

export function Read({ lang, sub }: { lang: Lang; sub?: string }) {
  if (sub) return <Reader id={sub} lang={lang} />;
  return <Library lang={lang} />;
}

// ── library ───────────────────────────────────────────────────

function Library({ lang }: { lang: Lang }) {
  const s = useAppState();
  const [paste, setPaste] = useState(false);
  const [story, setStory] = useState(false);
  const known = useMemo(() => knownSet(s, lang), [s, lang]);
  const texts = live(s.texts).filter((t) => t.lang === lang).sort((a, b) => Number(!!a.readAt) - Number(!!b.readAt) || b.updatedAt - a.updatedAt);
  const fresh = texts.filter((t) => !t.readAt), read = texts.filter((t) => t.readAt);

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">{LANG[lang].name}</span>
        <h1 className="display">Read & listen</h1>
      </div>
      <div className="btn-row">
        <button type="button" className="btn primary" onClick={() => setStory(true)}><IconSparkle /> Write me a story</button>
        <button type="button" className="btn" onClick={() => setPaste(true)}><IconPlus /> Paste a text</button>
      </div>
      {fresh.length > 0 && <TextList title="To read" texts={fresh} known={known} lang={lang} />}
      {read.length > 0 && <TextList title="Read" texts={read} known={known} lang={lang} />}
      {!texts.length && <div className="card"><p className="muted">No texts yet. Ask for a story at your level, or paste one.</p></div>}
      {paste && <PasteSheet lang={lang} onClose={() => setPaste(false)} />}
      {story && <StorySheet lang={lang} onClose={() => setStory(false)} />}
    </>
  );
}

function TextList({ title, texts, known, lang }: { title: string; texts: Text[]; known: Set<string>; lang: Lang }) {
  return (
    <section className="text-group">
      <h2 className="group-h">{title}</h2>
      <ul className="tile-list">
        {texts.map((t) => {
          const c = coverage(lang, known, t.sentences);
          return (
            <li key={t.id}>
              <a className="card link-card" href={href("read", t.id)}>
                <span className="link-card-main">
                  <b className={`lx-${lang}`} lang={LANG[lang].bcp} dir={LANG[lang].dir}>{t.title}</b>
                  <span className="muted small">
                    {t.titleTr ? `${t.titleTr} · ` : ""}{t.sentences.length} lines · {Math.round(c.pct * 100)}% known{c.unknown.length ? ` · ${c.unknown.length} new` : ""}{t.listens ? ` · heard ${t.listens}×` : ""}
                  </span>
                  <span className="meter"><span style={{ width: `${Math.round(c.pct * 100)}%` }} /></span>
                </span>
                <IconNext className="chev" />
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ── reader ────────────────────────────────────────────────────

type Tool = null | "shadow" | "dictate";

function Reader({ id, lang }: { id: string; lang: Lang }) {
  const s = useAppState();
  const prefs = usePrefs();
  const d = useDisplay(lang);
  const t = s.texts.find((x) => x.id === id && !x.deletedAt);
  const known = useMemo(() => knownSet(s, lang), [s, lang]);
  const [playing, setPlaying] = useState(-1);
  const [focus, setFocus] = useState<number | null>(null);
  const [tool, setTool] = useState<Tool>(null);
  const [hide, setHide] = useLocalState(`reader.hide`, false);
  const [shownLines, setShownLines] = useState<Set<number>>(new Set());
  const [rate, setRate] = useLocalState<number>(`reader.rate.${lang}`, prefs.rate[lang]);
  const [pop, setPop] = useState<{ tok: Token; s: Sentence } | null>(null);
  const stopRef = useRef<() => void>(() => {});
  useReadingTime(lang);
  useEffect(() => () => { stopSpeaking(); releaseMic(); }, []);

  if (!t) return (<><a className="back" href={href("read")}><IconBack /> Read</a><div className="card"><p className="muted">This text was removed.</p></div></>);
  const c = coverage(lang, known, t.sentences);
  const newSet = new Set((t.newWords ?? []).map((w) => fold(lang, w)));
  const mark = (tok: Token) => !tok.l ? undefined
    : pop?.tok === tok ? "sel"
    : isKnown(lang, known, tok) ? undefined
    : newSet.has(fold(lang, tok.l)) ? "new" : "unknown";

  const lines = t.sentences.map((x) => sentenceText(x));
  const playAll = (from = 0) => {
    if (playing >= 0) { stopRef.current(); setPlaying(-1); return; }
    if (from === 0) countListen(t.id);
    stopRef.current = speakLines(lines, lang, (i) => setPlaying(i), { from, rate, gapMs: 350 });
  };
  const playOne = (i: number) => { stopRef.current(); setPlaying(-1); setFocus(i); void speak(lines[i], lang, { rate }); };

  return (
    <>
      <a className="back" href={href("read")}><IconBack /> Read</a>
      <div className="page-head">
        <h1 className={`display lx-${lang}`} lang={LANG[lang].bcp} dir={LANG[lang].dir}>{t.title}</h1>
        <span className="muted">{t.titleTr ? `${t.titleTr} · ` : ""}{Math.round(c.pct * 100)}% of the words known</span>
      </div>

      {(t.newWords?.length ?? 0) > 0 && <NewWords t={t} lang={lang} known={known} onPick={(tok, sn) => setPop({ tok, s: sn })} />}

      <section className="card reader" dir={LANG[lang].dir}>
        {t.sentences.map((sn, i) => {
          const hidden = hide && !shownLines.has(i);
          return (
            <div key={i} className={`r-line${playing === i ? " playing" : ""}${focus === i ? " focus" : ""}`} dir={LANG[lang].dir}>
              <button type="button" className="r-play" aria-label={`Play line ${i + 1}`} onClick={() => playOne(i)}><IconPlay width={14} height={14} /></button>
              <div className="r-body">
                {hidden ? (
                  <button type="button" className="r-hidden" onClick={() => setShownLines((x) => new Set(x).add(i))}>Listen, then tap to show</button>
                ) : (
                  <Line lang={lang} s={sn} d={d} className="big-line" mark={mark} onWord={(tok) => { setPop({ tok, s: sn }); void speak(tok.r && lang === "ja" ? tok.r : tok.t, lang); }} />
                )}
                {(prefs.showTr || focus === i) && !hidden && <p className="r-tr" dir="ltr">{sn.tr}</p>}
                {focus === i && (
                  <div className="r-tools" dir="ltr">
                    {canRecord() && <button type="button" className={`chip${tool === "shadow" ? " on" : ""}`} onClick={() => setTool(tool === "shadow" ? null : "shadow")}><IconMic width={16} height={16} /> Shadow</button>}
                    <button type="button" className={`chip${tool === "dictate" ? " on" : ""}`} onClick={() => setTool(tool === "dictate" ? null : "dictate")}>Dictation</button>
                    <button type="button" className="chip" onClick={() => void speak(lines[i], lang, { rate: Math.max(0.5, rate - 0.25) })}>Slower</button>
                  </div>
                )}
                {focus === i && tool === "shadow" && <Shadow key={i} text={lines[i]} lang={lang} rate={rate} />}
                {focus === i && tool === "dictate" && <Dictation key={i} text={lines[i]} alt={speakText(sn, { reading: true })} lang={lang} rate={rate} />}
              </div>
            </div>
          );
        })}
      </section>

      <div className="card end-row">
        {t.readAt ? <span className="muted small">Read · you can come back to it any time</span> : <button type="button" className="btn primary" onClick={() => markRead(t.id)}>I've read it</button>}
        <button type="button" className="btn ghost sm danger" onClick={() => { removeText(t.id); location.hash = "read"; }}>Remove</button>
      </div>

      <div className="player">
        <button type="button" className="play-btn" aria-label={playing >= 0 ? "Stop" : "Play all"} onClick={() => playAll(0)}>{playing >= 0 ? <IconStop /> : <IconPlay />}</button>
        <Seg label="Speed" value={rate} onChange={(v) => setRate(v)} options={[{ id: 0.65, label: "0.65×" }, { id: 0.8, label: "0.8×" }, { id: 1, label: "1×" }]} />
        <button type="button" className={`icon-btn${hide ? " on" : " subtle"}`} aria-pressed={hide} aria-label="Listen first: hide the text" title="Listen first" onClick={() => { setHide(!hide); setShownLines(new Set()); }}><IconEye /></button>
        <button type="button" className={`icon-btn${prefs.showTr ? " on" : " subtle"}`} aria-pressed={prefs.showTr} aria-label="Show translations" title="Translations" onClick={() => setPrefs({ showTr: !prefs.showTr })}><IconTranslate /></button>
      </div>

      {pop && <WordPop lang={lang} tok={pop.tok} sentence={pop.s} onClose={() => setPop(null)} />}
    </>
  );
}

function NewWords({ t, lang, known, onPick }: { t: Text; lang: Lang; known: Set<string>; onPick: (tok: Token, s: Sentence) => void }) {
  const items = (t.newWords ?? []).map((lemma) => {
    for (const s of t.sentences) for (const tok of s.tokens) if (tok.l && fold(lang, tok.l) === fold(lang, lemma)) return { tok, s };
    return null;
  }).filter((x): x is { tok: Token; s: Sentence } => !!x && !isKnown(lang, known, x.tok));
  if (!items.length) return null;
  return (
    <section className="card new-words">
      <span className="eyebrow">New in this text</span>
      <div className="chips">
        {items.map(({ tok, s }) => (
          <button key={tok.l} type="button" className="chip new-chip" onClick={() => onPick(tok, s)}>
            <span className={`lx-${lang}`} lang={LANG[lang].bcp}>{tok.l}</span><span className="muted">{tok.g}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

/** Counts the seconds the reader is open and visible; logged when leaving. */
function useReadingTime(lang: Lang) {
  useEffect(() => {
    let sec = 0;
    const iv = setInterval(() => { if (document.visibilityState === "visible") sec++; }, 1000);
    return () => { clearInterval(iv); logTime(lang, "readSec", Math.min(sec, 3600)); };
  }, [lang]);
}

// ── shadowing ─────────────────────────────────────────────────

function Shadow({ text, lang, rate }: { text: string; lang: Lang; rate: number }) {
  const [phase, setPhase] = useState<"idle" | "listen" | "rec" | "play">("idle");
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const recRef = useRef<Awaited<ReturnType<typeof record>> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const stopRec = async () => {
    clearTimeout(timer.current);
    const u = await recRef.current?.stop();
    recRef.current = null;
    if (u) { setUrl(u); setPhase("play"); await both(u); }
    setPhase("idle");
  };
  const both = async (u: string) => { setPhase("play"); await speak(text, lang, { rate }); await playUrl(u); setPhase("idle"); };
  const go = async () => {
    setErr("");
    try {
      setPhase("listen");
      await speak(text, lang, { rate });
      recRef.current = await record();
      setPhase("rec");
      timer.current = setTimeout(() => void stopRec(), Math.min(15000, 2500 + text.length * 220));
    } catch {
      setPhase("idle");
      setErr("The microphone isn't available. Allow it for this app in the browser's settings.");
    }
  };
  return (
    <div className="tool-panel" dir="ltr">
      <p className="small muted">Hear the line, then say it the same way: same speed, same melody. Then hear both.</p>
      <div className="btn-row">
        {phase === "rec" ? (
          <button type="button" className="btn primary sm rec" onClick={() => void stopRec()}><span className="rec-dot" /> Recording… tap when done</button>
        ) : (
          <button type="button" className="btn primary sm" disabled={phase !== "idle"} onClick={() => void go()}>{phase === "listen" ? "Listen…" : phase === "play" ? "Playing both…" : url ? "Try again" : "Start"}</button>
        )}
        {url && phase === "idle" && <button type="button" className="btn sm" onClick={() => void both(url)}>Hear both</button>}
        {url && phase === "idle" && <button type="button" className="btn ghost sm" onClick={() => void playUrl(url)}>Just mine</button>}
      </div>
      {err && <p className="form-error">{err}</p>}
    </div>
  );
}

// ── dictation ─────────────────────────────────────────────────

function Dictation({ text, alt, lang, rate }: { text: string; alt: string; lang: Lang; rate: number }) {
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState<null | { verdict: string; score: number }>(null);
  const score = () => {
    const input = lang === "ja" && /[a-z]/i.test(typed) ? toKana(typed, { final: true }) : typed;
    const f = (x: string) => foldAccents(lang, fold(lang, x)); // accents don't count
    const a = f(input);
    const v = check(lang, input, [text, alt]);
    // share of the expected characters that appear in order (best of the written and the kana form)
    const share = (b: string) => { let i = 0, hit = 0; for (const ch of a) { const j = b.indexOf(ch, i); if (j >= 0) { hit++; i = j + 1; } } return b.length ? hit / b.length : 0; };
    setResult({ verdict: v, score: Math.max(share(f(text)), share(f(alt))) });
  };
  return (
    <div className="tool-panel" dir="ltr">
      <p className="small muted">Listen and type what you hear{lang === "ja" ? " (romaji turns into kana)" : ""}. Play it as often as you like.</p>
      <div className="row-between">
        <button type="button" className="icon-btn" aria-label="Play" onClick={() => void speak(text, lang, { rate })}><IconPlay /></button>
        <input className="text-input grow" lang={LANG[lang].bcp} dir="auto" autoCapitalize="off" autoCorrect="off" spellCheck={false} value={typed} onChange={(e) => { setTyped(e.target.value); setResult(null); }} />
        <button type="button" className="btn sm" disabled={!typed.trim()} onClick={score}>Check</button>
      </div>
      {result && (
        <p className={`verdict ${result.verdict}`}>
          {result.verdict === "right" ? "Exactly right." : `${Math.round(result.score * 100)}% of it.`} <span className="muted">The line: </span>
          <span className={`lx-${lang}`} lang={LANG[lang].bcp} dir={LANG[lang].dir}>{text}</span>
        </p>
      )}
    </div>
  );
}
