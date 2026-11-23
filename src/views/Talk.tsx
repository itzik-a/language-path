/* Talk: role-play conversations with Claude, with quiet corrections, voice in and out, and a review at the end. */
import { useEffect, useRef, useState } from "react";
import { IconBack, IconMic, IconNext, IconPlus, IconSpeaker, IconStop, IconTalk } from "../components/Icons";
import { Line, useDisplay } from "../components/Lx";
import { useLocalState } from "../components/ui";
import { WordPop } from "../components/WordPop";
import { ago } from "../lib/dates";
import { LANG } from "../lib/langs";
import { canListen, listen, type Listening } from "../lib/listen";
import { hasClaude } from "../lib/prefs";
import { toKana } from "../lib/romaji";
import { go, href } from "../lib/route";
import { speak, stopSpeaking } from "../lib/speech";
import { showToast } from "../lib/toast";
import { sentenceText } from "../lib/tokens";
import { addSuggested, addTurn, live, logTime, newChat, removeChat, setChatReview } from "../state/actions";
import { getState, useAppState } from "../state/store";
import type { Chat, Lang, Sentence, Token, Turn } from "../types";

const COMMON = [
  "You're my new neighbour. We meet on the stairs and introduce ourselves.",
  "I'm ordering at a café; you're the waiter.",
  "I'm lost and ask you, a passer-by, the way to the train station.",
  "We're friends talking about what we did today.",
  "We're planning the weekend together.",
  "I'm buying fruit and vegetables at your market stall.",
  "I'm checking in at your hotel.",
  "I'm at the doctor's: I have a headache and a cough.",
];
const SPECIAL: Record<Lang, string[]> = {
  ja: ["I'm paying at a konbini (convenience store); you're the clerk.", "You're a Japanese friend asking about my hobbies."],
  pl: ["I'm buying a train ticket from Warsaw to Kraków at the station.", "You're my Polish friend's grandmother, offering me food."],
  ar: ["I'm haggling over a scarf at your stall in the souq.", "You're a taxi driver; I tell you where to go."],
};

export function Talk({ lang, sub }: { lang: Lang; sub?: string }) {
  if (sub) return <ChatView id={sub} lang={lang} />;
  return <Scenes lang={lang} />;
}

function Scenes({ lang }: { lang: Lang }) {
  const s = useAppState();
  const [custom, setCustom] = useState("");
  const chats = live(s.chats).filter((c) => c.lang === lang).sort((a, b) => b.updatedAt - a.updatedAt);
  const start = (scenario: string) => go("talk", newChat(lang, scenario));
  return (
    <>
      <div className="page-head">
        <span className="eyebrow">{LANG[lang].name}</span>
        <h1 className="display">Talk</h1>
        <p className="muted">A short conversation at your level. Claude plays the other person, keeps it simple, and quietly corrects your lines.</p>
      </div>
      {!hasClaude() && <div className="card note-card"><p>Conversations need Claude. Add your API key in Settings → Claude.</p></div>}
      {chats.length > 0 && (
        <section className="text-group">
          <h2 className="group-h">Recent</h2>
          <ul className="tile-list">
            {chats.slice(0, 6).map((c) => (
              <li key={c.id}>
                <a className="card link-card" href={href("talk", c.id)}>
                  <span className="link-card-main"><b>{c.scenario}</b><span className="muted small">{c.turns.filter((t) => t.who === "me").length} of your lines · {ago(c.updatedAt)}{c.review ? " · reviewed" : ""}</span></span>
                  <IconNext className="chev" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="text-group">
        <h2 className="group-h">Start a conversation</h2>
        <ul className="tile-list">
          {[...SPECIAL[lang], ...COMMON].map((sc) => (
            <li key={sc}><button type="button" className="card link-card scene" disabled={!hasClaude()} onClick={() => start(sc)}><IconTalk className="chev" /><span className="link-card-main">{sc}</span></button></li>
          ))}
        </ul>
        <form className="card scene-own" onSubmit={(e) => { e.preventDefault(); if (custom.trim()) start(custom.trim()); }}>
          <label className="field"><span className="field-label">Or your own scene</span>
            <input className="text-input" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="e.g. You're a colleague; we chat at lunch about food" />
          </label>
          <button type="submit" className="btn primary sm" disabled={!custom.trim() || !hasClaude()}><IconPlus /> Start</button>
        </form>
      </section>
    </>
  );
}

const linesOf = (c: Chat) => c.turns.map((t) => ({ who: t.who, text: t.text }));

function ChatView({ id, lang }: { id: string; lang: Lang }) {
  const s = useAppState();
  const d = useDisplay(lang);
  const chat = s.chats.find((c) => c.id === id && !c.deletedAt);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [voice, setVoice] = useLocalState("talk.voice", true);
  const [hearing, setHearing] = useState<Listening | null>(null);
  const [pop, setPop] = useState<{ tok: Token; s: Sentence } | null>(null);
  const [shownTr, setShownTr] = useState<Set<number>>(new Set());
  const [reviewing, setReviewing] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const opened = useRef(false);
  useTalkTime(lang);
  useEffect(() => () => { stopSpeaking(); hearing?.stop(); }, [hearing]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [chat?.turns.length, busy]);

  const partner = async (c: Chat) => {
    setBusy(true); setErr("");
    try {
      const st = getState();
      const claude = await import("../lib/claude");
      const r = await claude.chatTurn(lang, { level: st.settings.lang[lang].level, known: claude.knownList(st, lang, 400), scenario: c.scenario, lines: linesOf(c) });
      const t: Turn = { who: "them", text: sentenceText(r.reply), tokens: r.reply.tokens, tr: r.reply.tr, at: Date.now() };
      addTurn(c.id, t, r.fix);
      if (voice) void speak(t.text, lang);
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  // Claude opens the conversation.
  useEffect(() => {
    if (chat && !chat.turns.length && !opened.current && hasClaude()) { opened.current = true; void partner(chat); }
  }, [chat?.id]);

  if (!chat) return (<><a className="back" href={href("talk")}><IconBack /> Talk</a><div className="card"><p className="muted">This conversation was removed.</p></div></>);

  const send = async (raw = text) => {
    const msg = (lang === "ja" && /^[a-z' -]+$/i.test(raw.trim()) && /[aiueo]/i.test(raw) ? toKana(raw.trim(), { final: true }) : raw).trim();
    if (!msg || busy) return;
    stopSpeaking();
    setText("");
    addTurn(chat.id, { who: "me", text: msg, at: Date.now() });
    await partner(getState().chats.find((c) => c.id === chat.id)!);
  };

  const mic = async () => {
    if (hearing) { hearing.stop(); return; }
    setErr("");
    stopSpeaking();
    try {
      const h = listen(lang, (t) => setText(t));
      setHearing(h);
      const said = await h.done;
      setHearing(null);
      if (said.trim()) await send(said);
    } catch (e) { setHearing(null); setErr((e as Error).message); }
  };

  const finish = async () => {
    setReviewing(true); setErr("");
    try {
      const st = getState();
      const claude = await import("../lib/claude");
      const r = await claude.reviewChat(lang, { level: st.settings.lang[lang].level, known: claude.knownList(st, lang, 400), scenario: chat.scenario, lines: linesOf(chat) });
      setChatReview(chat.id, { summary: r.summary, points: r.points.map((p) => ({ said: p.said, better: p.better, why: p.why })) });
      const added = addSuggested(lang, [
        ...r.points.filter((p) => p.better.trim()).map((p) => ({ lemma: p.better.trim(), gloss: p.tr, note: p.why, pos: "phrase" })),
        ...r.words.map((w) => ({ lemma: w.lemma, gloss: w.gloss, pos: w.pos, ...(w.reading && lang === "ja" && w.reading !== w.lemma ? { reading: w.reading } : {}), ...(w.translit ? { translit: w.translit } : {}) })),
      ], true);
      if (added) showToast(`${added} phrases and words added to the front of your queue`);
    } catch (e) { setErr((e as Error).message); }
    finally { setReviewing(false); }
  };

  const mine = chat.turns.filter((t) => t.who === "me").length;

  return (
    <div className="chat">
      <div className="row-between">
        <a className="back" href={href("talk")}><IconBack /> Talk</a>
        <div className="btn-row">
          <button type="button" className={`icon-btn${voice ? " on" : " subtle"}`} aria-pressed={voice} aria-label="Read replies aloud" title="Read replies aloud" onClick={() => setVoice(!voice)}><IconSpeaker /></button>
          {mine >= 2 && !chat.review && <button type="button" className="btn sm" disabled={reviewing || busy} onClick={() => void finish()}>{reviewing ? "Reviewing…" : "Finish"}</button>}
        </div>
      </div>
      <p className="muted small scene-line">{chat.scenario}</p>

      <div className="turns">
        {chat.turns.map((t, i) => t.who === "them" ? (
          <div key={i} className="turn them">
            <div className="bubble" dir={LANG[lang].dir}>
              {t.tokens ? <Line lang={lang} s={{ tokens: t.tokens, tr: t.tr ?? "" }} d={d} className="chat-line" onWord={(tok) => { setPop({ tok, s: { tokens: t.tokens!, tr: t.tr ?? "" } }); void speak(tok.r && lang === "ja" ? tok.r : tok.t, lang); }} /> : <span className={`lx-${lang}`}>{t.text}</span>}
              {shownTr.has(i) && t.tr && <p className="bubble-tr" dir="ltr">{t.tr}</p>}
            </div>
            <div className="turn-tools">
              <button type="button" className="text-btn" onClick={() => void speak(t.text, lang)}>Play</button>
              {t.tr && <button type="button" className="text-btn" onClick={() => setShownTr((x) => { const n = new Set(x); if (n.has(i)) n.delete(i); else n.add(i); return n; })}>{shownTr.has(i) ? "Hide" : "Translate"}</button>}
            </div>
          </div>
        ) : (
          <div key={i} className="turn me">
            <div className="bubble" dir="auto" lang={LANG[lang].bcp}>{t.text}</div>
            {t.fix && (
              <div className="fix">
                <button type="button" className="fix-better" lang={LANG[lang].bcp} dir="auto" onClick={() => void speak(t.fix!.better, lang)}>{t.fix.better}</button>
                <span className="muted small">{t.fix.why}</span>
              </div>
            )}
          </div>
        ))}
        {busy && <div className="turn them"><div className="bubble typing" aria-label="Typing"><span /><span /><span /></div></div>}
        <div ref={endRef} />
      </div>

      {chat.review && (
        <section className="card review-card">
          <h2>How it went</h2>
          <p>{chat.review.summary}</p>
          {chat.review.points.length > 0 && (
            <ul className="points">
              {chat.review.points.map((p, i) => (
                <li key={i}>
                  <span className="muted small" lang={LANG[lang].bcp} dir="auto"><s>{p.said}</s></span>
                  <button type="button" className="fix-better" lang={LANG[lang].bcp} dir="auto" onClick={() => void speak(p.better, lang)}>{p.better}</button>
                  <span className="small">{p.why}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="muted small">The corrected phrases are at the front of your word queue, so they come up as cards.</p>
          <div className="btn-row">
            <a className="btn primary sm" href={href("talk")}>Another conversation</a>
            <button type="button" className="btn ghost sm danger" onClick={() => { removeChat(chat.id); go("talk"); }}>Remove</button>
          </div>
        </section>
      )}

      {err && <p className="form-error" role="alert">{err} <button type="button" className="text-btn" onClick={() => void partner(getState().chats.find((c) => c.id === chat.id)!)}>Try again</button></p>}

      {!chat.review && (
        <form className="composer" onSubmit={(e) => { e.preventDefault(); void send(); }}>
          {canListen() && (
            <button type="button" className={`icon-btn mic${hearing ? " live" : ""}`} aria-label={hearing ? "Stop listening" : "Speak"} onClick={() => void mic()} disabled={busy}>
              {hearing ? <IconStop /> : <IconMic />}
            </button>
          )}
          <input className="text-input grow" lang={LANG[lang].bcp} dir="auto" value={text} onChange={(e) => setText(e.target.value)} disabled={busy && !text}
            placeholder={hearing ? "Listening…" : lang === "ja" ? "Say it or type (romaji works)" : `Answer in ${LANG[lang].name}`} autoCapitalize="sentences" />
          <button type="submit" className="btn primary" disabled={!text.trim() || busy}>Send</button>
        </form>
      )}
      {pop && <WordPop lang={lang} tok={pop.tok} sentence={pop.s} source="chat" onClose={() => setPop(null)} />}
    </div>
  );
}

function useTalkTime(lang: Lang) {
  useEffect(() => {
    let sec = 0;
    const iv = setInterval(() => { if (document.visibilityState === "visible") sec++; }, 1000);
    return () => { clearInterval(iv); logTime(lang, "talkSec", Math.min(sec, 3600)); };
  }, [lang]);
}
