/* Grammar: the topics of the active language in learning order (#grammar), a topic's lesson (#grammar/<topic>),
   and practice I start myself (#grammar/<topic>/practice, or #grammar/practice for the drills due across topics).
   Lessons are written by Claude Opus the first time and kept; drills have their own FSRS progress (src/state/grammar.ts)
   and never join the daily reviews. */
import { useEffect, useMemo, useRef, useState } from "react";
import { FormTable, Rich } from "../components/FormTable";
import { IconBack, IconNext, IconSparkle, IconSpeaker } from "../components/Icons";
import { Line, Term, useDisplay } from "../components/Lx";
import { StorySheet } from "../components/StorySheet";
import { WordPop } from "../components/WordPop";
import { LEVEL_LABEL, topicById, topicsFor, type Level, type Topic } from "../data/grammar";
import { checkForm, type Verdict } from "../lib/check";
import { LANG } from "../lib/langs";
import { hasClaude } from "../lib/prefs";
import { href } from "../lib/route";
import { speak, stopSpeaking } from "../lib/speech";
import { Rating } from "../lib/srs";
import { sentenceText } from "../lib/tokens";
import { showToast } from "../lib/toast";
import {
  addDrills, answerDrill, dueDrills, lessonOf, mistakesByTopic, mixedRound, practiceRound, regradeDrill, saveLesson, STATUS_TEXT,
  suggestTopic, topicProgress,
} from "../state/grammar";
import { getState, useAppState } from "../state/store";
import type { Drill, GCard, Lang, Sentence, Token } from "../types";

export function Grammar({ lang, sub }: { lang: Lang; sub?: string }) {
  const [id, mode] = (sub ?? "").split("/");
  if (id === "practice") return <Practice lang={lang} />;
  const topic = topicById(lang, id);
  if (topic && mode === "practice") return <Practice lang={lang} topic={topic} />;
  if (topic) return <TopicPage lang={lang} topic={topic} />;
  return <Overview lang={lang} />;
}

const Back = ({ to }: { to?: Topic }) => (
  <a className="back" href={to ? href("grammar", to.id) : href("grammar")}><IconBack /> {to ? to.title : "Grammar"}</a>
);

// ── the topic list ────────────────────────────────────────────

function Overview({ lang }: { lang: Lang }) {
  const s = useAppState();
  const topics = topicsFor(lang);
  const due = dueDrills(s, lang);
  const mistakes = useMemo(() => mistakesByTopic(s, lang), [s, lang]);
  const hint = useMemo(() => suggestTopic(s, lang), [s, lang]);
  const levels = [...new Set(topics.map((t) => t.level))] as Level[];

  return (
    <>
      <a className="back" href={href("words")}><IconBack /> Words</a>
      <div className="page-head">
        <span className="eyebrow">{LANG[lang].name}</span>
        <h1 className="display">Grammar</h1>
        <p className="muted">Short lessons with tables and examples, written for your level the first time you open one, and exercises to practise when you choose.</p>
      </div>

      {(due > 0 || hint) && (
        <section className="card note-card grammar-next">
          {due > 0 && (
            <div className="row-between">
              <span><b>{due}</b> exercise{due === 1 ? "" : "s"} due again</span>
              <a className="btn primary sm" href={href("grammar", "practice")}>Practise them</a>
            </div>
          )}
          {hint && (
            <a className="strand-link" href={href("grammar", hint.topic.id)}>
              <span className="link-card-main"><b>{hint.topic.title}</b><span className="muted small">{hint.count} correction{hint.count === 1 ? "" : "s"} in your conversations this month</span></span>
              <IconNext className="chev" />
            </a>
          )}
        </section>
      )}

      {levels.map((lv) => (
        <section key={lv} className="grammar-level">
          <h2 className="eyebrow">{LEVEL_LABEL[lv]}</h2>
          <ul className="tile-list">
            {topics.filter((t) => t.level === lv).map((t) => {
              const p = topicProgress(s, t.id);
              const m = mistakes.get(t.id)?.length ?? 0;
              return (
                <li key={t.id}>
                  <a className="card link-card" href={href("grammar", t.id)}>
                    <span className="link-card-main">
                      <b>{t.title}</b>
                      <span className="muted small" dir="auto">{t.blurb}</span>
                      <span className="small grammar-meta">
                        {p.status !== "new" && <span className={`tag${p.status === "solid" ? " accent" : ""}`}>{STATUS_TEXT[p.status]}</span>}
                        {p.drills > 0 && <span className="muted">{p.practised} of {p.drills} practised{p.due ? ` · ${p.due} due` : ""}</span>}
                        {m > 0 && <span className="muted">{m} correction{m === 1 ? "" : "s"}</span>}
                      </span>
                      {p.practised > 0 && <span className="meter"><span style={{ width: `${(100 * p.solid) / Math.max(1, p.drills)}%` }} /></span>}
                    </span>
                    <IconNext className="chev" />
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}

// ── a topic ───────────────────────────────────────────────────

/** Lessons being written right now, by topic: writing goes on if I leave the page, and the page shows it when I'm back. */
const writing = new Map<string, Promise<void>>();

function useWriting(topic: string) {
  const [busy, setBusy] = useState(writing.has(topic));
  useEffect(() => {
    const p = writing.get(topic);
    if (p) void p.finally(() => setBusy(false));
  }, [topic]);
  return [busy, setBusy] as const;
}

function TopicPage({ lang, topic }: { lang: Lang; topic: Topic }) {
  const s = useAppState();
  const d = useDisplay(lang);
  const lesson = lessonOf(s, topic.id);
  const p = topicProgress(s, topic.id);
  const mistakes = mistakesByTopic(s, lang).get(topic.id) ?? [];
  const [busy, setBusy] = useWriting(topic.id);
  const [more, setMore] = useState(false);
  const [err, setErr] = useState("");
  const [pop, setPop] = useState<{ tok: Token; s: Sentence } | null>(null);
  const [story, setStory] = useState(false);
  useEffect(() => () => stopSpeaking(), []);

  const write = () => {
    setBusy(true); setErr("");
    const job = (async () => {
      try {
        const claude = await import("../lib/claude");
        const st = getState();
        const r = await claude.writeLesson(lang, topic, { level: st.settings.lang[lang].level, known: claude.knownList(st, lang, 300) });
        saveLesson(lang, topic.id, r, "claude-opus-5-5");
      } catch (e) { setErr((e as Error).message); }
      finally { writing.delete(topic.id); setBusy(false); }
    })();
    writing.set(topic.id, job);
  };
  const rewrite = () => {
    if (window.confirm(`Write the "${topic.title}" lesson again?\n\nIt gets new tables, examples and exercises; your practice on the old exercises starts over.`)) write();
  };
  const addMore = async () => {
    if (!lesson) return;
    setMore(true); setErr("");
    try {
      const claude = await import("../lib/claude");
      const st = getState();
      const r = await claude.moreDrills(lang, topic, { level: st.settings.lang[lang].level, known: claude.knownList(st, lang, 300), have: lesson.drills });
      addDrills(topic.id, r);
      showToast(`${r.length} new exercises`);
    } catch (e) { setErr((e as Error).message); }
    finally { setMore(false); }
  };

  const head = (
    <div className="page-head">
      <span className="eyebrow">{LANG[lang].name} · {topic.level}</span>
      <h1 className="display">{topic.title}</h1>
      <p className="muted" dir="auto">{topic.blurb}</p>
    </div>
  );

  if (!lesson) {
    return (
      <>
        <Back />
        {head}
        <section className="card">
          {hasClaude() ? (
            <>
              <p>Claude Opus writes this lesson for your level: an explanation, tables of the forms, examples with words you know, common mistakes and about a dozen exercises. It's written once and kept on all your devices.</p>
              {err && <p className="form-error" role="alert">{err}</p>}
              <button type="button" className="btn primary" disabled={busy} onClick={write}><IconSparkle /> {busy ? "Writing the lesson… (a minute or two)" : "Write the lesson"}</button>
              {busy && <p className="muted small">You can leave this page; the lesson is saved when it's ready.</p>}
            </>
          ) : (
            <p className="muted">Lessons are written by Claude. Add your Claude API key in Settings → Claude to turn this on.</p>
          )}
        </section>
        <MistakeList lang={lang} list={mistakes} />
      </>
    );
  }

  const practise = (
    <div className="row-between">
      <span className="muted small">{p.drills} exercise{p.drills === 1 ? "" : "s"} · {p.practised} practised{p.solid ? ` · ${p.solid} solid` : ""}{p.due ? ` · ${p.due} due` : ""}</span>
      <a className="btn primary sm" href={href("grammar", `${topic.id}/practice`)}>Practise</a>
    </div>
  );

  return (
    <>
      <Back />
      {head}
      <section className="card">{practise}</section>

      <section className="card lesson-intro">
        {lesson.intro.map((para, i) => <p key={i}><Rich text={para} /></p>)}
      </section>

      {lesson.tables.length > 0 && (
        <section className="card lesson-tables">
          {lesson.tables.map((t, i) => <FormTable key={i} lang={lang} t={t} />)}
          <p className="muted small">Tap a form to hear it.</p>
        </section>
      )}

      {lesson.examples.length > 0 && (
        <section className="card">
          <h2>Examples</h2>
          <ul className="examples">
            {lesson.examples.map((e, i) => (
              <li key={i}>
                <button type="button" className="icon-btn subtle" aria-label="Hear it" onClick={() => void speak(sentenceText(e.s), lang)}><IconSpeaker width={18} height={18} /></button>
                <div>
                  <Line lang={lang} s={e.s} d={d} className="big-line" mark={(t) => (e.focus.includes(e.s.tokens.indexOf(t)) ? "hit" : undefined)} onWord={(tok) => setPop({ tok, s: e.s })} />
                  <span className="muted small">{e.s.tr}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {lesson.compare && (
        <section className="card note-card">
          <h2>Compared with Hebrew and English</h2>
          <p><Rich text={lesson.compare} /></p>
        </section>
      )}

      {lesson.mistakes.length > 0 && (
        <section className="card">
          <h2>Common mistakes</h2>
          <ul className="points">
            {lesson.mistakes.map((m, i) => (
              <li key={i}>
                <span className="muted small"><s><Term lang={lang} text={m.wrong} d={d} /></s></span>
                <button type="button" className="fix-better" onClick={() => void speak(m.right, lang)}><Term lang={lang} text={m.right} d={d} /></button>
                <span className="small"><Rich text={m.why} /></span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <MistakeList lang={lang} list={mistakes} />

      <section className="card">
        {practise}
        {err && <p className="form-error" role="alert">{err}</p>}
        <div className="btn-row">
          <button type="button" className="btn sm" disabled={more || busy} onClick={() => void addMore()}><IconSparkle /> {more ? "Writing exercises…" : "More exercises"}</button>
          <button type="button" className="btn ghost sm" onClick={() => setStory(true)}>A story that uses it</button>
        </div>
        <div className="row-between">
          <span className="muted small">Written by Claude Opus 5.5, {lesson.writtenOn}</span>
          <button type="button" className="text-btn" disabled={busy} onClick={rewrite}>{busy ? "Rewriting…" : "Rewrite"}</button>
        </div>
      </section>

      {pop && <WordPop lang={lang} tok={pop.tok} sentence={pop.s} onClose={() => setPop(null)} />}
      {story && <StorySheet lang={lang} grammar={topic} onClose={() => setStory(false)} />}
    </>
  );
}

function MistakeList({ lang, list }: { lang: Lang; list: ReturnType<typeof mistakesByTopic> extends Map<string, infer M> ? M : never }) {
  if (!list.length) return null;
  return (
    <section className="card">
      <h2>Your corrections</h2>
      <p className="muted small">From your conversations in Talk.</p>
      <ul className="points">
        {list.slice(0, 8).map((m, i) => (
          <li key={i}>
            <span className="muted small" lang={LANG[lang].bcp} dir="auto"><s>{m.said}</s></span>
            <button type="button" className="fix-better" lang={LANG[lang].bcp} dir="auto" onClick={() => void speak(m.better, lang)}>{m.better}</button>
            <span className="small">{m.why}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── practice ──────────────────────────────────────────────────

interface Item { topic: string; drill: Drill }

/** How else an answer can be typed, where it's not obvious. */
const TYPE_TIP: Partial<Record<Lang, string>> = {
  ru: "Latin letters work too (knigu for кни́гу).",
  el: "Latin letters work too (grafo for γράφω).",
  ja: "Kana or romaji both work.",
  ar: "Arabic or Latin letters. Case endings only count in Latin letters (kitāba), as Arabic is usually typed without vowel marks.",
};

/** The drill's sentence with the answer in the gap. */
const filled = (d: Drill, answer = d.answer) => d.sentence.replace("___", answer);

function Practice({ lang, topic }: { lang: Lang; topic?: Topic }) {
  const [round, setRound] = useState<Item[]>(() => {
    const s = getState();
    return topic ? practiceRound(s, topic.id).map((drill) => ({ topic: topic.id, drill })) : mixedRound(s, lang);
  });
  const [i, setI] = useState(0);
  const [right, setRight] = useState(0);
  const again = () => {
    const s = getState();
    setRound(topic ? practiceRound(s, topic.id).map((drill) => ({ topic: topic.id, drill })) : mixedRound(s, lang));
    setI(0); setRight(0);
  };
  useEffect(() => () => stopSpeaking(), []);
  const item = round[i];

  return (
    <>
      <Back to={topic} />
      <div className="page-head">
        <span className="eyebrow">{LANG[lang].name} · grammar practice</span>
        <h1 className="display">{topic ? topic.title : "Due again"}</h1>
      </div>
      {item ? (
        <DrillCard key={`${item.topic}/${item.drill.id}/${i}`} lang={lang} item={item} n={i + 1} of={round.length} showTopic={!topic}
          onNext={(ok) => { if (ok) setRight((r) => r + 1); setI((x) => x + 1); }} />
      ) : (
        <section className="card review-done">
          <h2>{round.length ? "Round done" : "Nothing due"}</h2>
          <p className="muted">{round.length ? `${right} of ${round.length} right.` : topic ? "This lesson has no exercises yet." : "No exercises are due again. Open a topic to practise it."}</p>
          <div className="btn-row">
            {round.length > 0 && <button type="button" className="btn primary" onClick={again}>Another round</button>}
            <a className="btn ghost" href={topic ? href("grammar", topic.id) : href("grammar")}>{topic ? "Back to the lesson" : "All topics"}</a>
          </div>
        </section>
      )}
    </>
  );
}

function DrillCard({ lang, item, n, of, showTopic, onNext }: { lang: Lang; item: Item; n: number; of: number; showTopic: boolean; onNext: (right: boolean) => void }) {
  const d = useDisplay(lang);
  const { drill } = item;
  const [typed, setTyped] = useState("");
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [counted, setCounted] = useState(false);
  const before = useRef<GCard | undefined>(undefined);
  const input = useRef<HTMLInputElement>(null);
  const topic = topicById(lang, item.topic);
  const [pre, post] = drill.sentence.split("___");

  useEffect(() => { input.current?.focus({ preventScroll: true }); }, []);

  const check = () => {
    if (verdict) return;
    const v = typed.trim() ? checkForm(lang, typed, [drill.answer, ...drill.alts, drill.answerReading ?? ""]) : "wrong";
    setVerdict(v);
    before.current = answerDrill(lang, item.topic, drill.id, v === "right" ? Rating.Good : v === "almost" ? Rating.Hard : Rating.Again);
    void speak(filled(drill), lang);
  };
  const countRight = () => {
    regradeDrill(lang, item.topic, drill.id, before.current, Rating.Good);
    setCounted(true);
  };
  const next = () => onNext(verdict === "right" || counted);

  return (
    <section className="card drill">
      <div className="row-between">
        <span className="eyebrow">{n} of {of}{showTopic && topic ? ` · ${topic.title}` : ""}</span>
        <span className="tag">{drill.hint}</span>
      </div>

      <p className={`drill-sentence lx lx-${lang}`} lang={LANG[lang].bcp} dir={LANG[lang].dir}>
        {pre && <Term lang={lang} text={pre} d={d} />}
        {verdict ? <span className={`drill-answer ${verdict === "right" || counted ? "ok" : "no"}`}><Term lang={lang} text={drill.answer} d={d} /></span> : <span className="cloze-gap" aria-label="gap">{"  "}</span>}
        {post && <Term lang={lang} text={post} d={d} />}
      </p>
      {drill.reading && <p className="muted drill-reading" dir="ltr">{verdict ? drill.reading.replace("___", drill.answerReading ?? "___") : drill.reading}</p>}
      {drill.base && <p className="drill-base">(<Term lang={lang} text={drill.base} d={d} />)</p>}
      <p className="muted small">{drill.tr}</p>

      {!verdict ? (
        <form className="type-box" onSubmit={(e) => { e.preventDefault(); check(); }}>
          <input ref={input} className="text-input" lang={LANG[lang].bcp} autoCapitalize="off" autoCorrect="off" spellCheck={false} value={typed} onChange={(e) => setTyped(e.target.value)}
            placeholder="Type the missing form" aria-label="Your answer" />
          <button type="submit" className="btn primary">{typed.trim() ? "Check" : "Show me"}</button>
          {TYPE_TIP[lang] && <span className="muted small">{TYPE_TIP[lang]}</span>}
        </form>
      ) : (
        <div className="drill-back">
          <p className={`verdict ${counted ? "right" : verdict}`}>
            {counted ? "Counted as right" : verdict === "right" ? "Right" : verdict === "almost" ? `Almost: check the accents (you typed ${typed})` : typed.trim() ? `You typed: ${typed}` : "The answer"}
          </p>
          <p className="small"><Rich text={drill.why} /></p>
          {drill.alts.length > 0 && <p className="muted small">Also right: {drill.alts.join(", ")}</p>}
          <div className="btn-row">
            <button type="button" className="btn primary" autoFocus onClick={next}>Next</button>
            <button type="button" className="icon-btn subtle" aria-label="Hear it again" onClick={() => void speak(filled(drill), lang)}><IconSpeaker /></button>
            {verdict !== "right" && typed.trim() && !counted && <button type="button" className="text-btn" onClick={countRight}>Count it as right</button>}
          </div>
        </div>
      )}
    </section>
  );
}
