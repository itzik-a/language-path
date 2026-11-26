/* Today: the four strands (Nation) for the active language: cards (focused study), read & listen (input),
   talk (output), fluency (easy material, faster); the other languages' reviews; progress. */
import { useMemo } from "react";
import { IconFlame, IconNext } from "../components/Icons";
import { MiniBars } from "../components/MiniBars";
import { SuggestWords } from "../components/SuggestWords";
import { coverage, knownSet } from "../lib/coverage";
import { addDays, today } from "../lib/dates";
import { LANG } from "../lib/langs";
import { hasClaude, setPrefs } from "../lib/prefs";
import { dayTotals, minutes, recallRate, streak } from "../lib/progress";
import { forecast, newWordsLeft, queue } from "../lib/queue";
import { go, href } from "../lib/route";
import { live, startNewWords } from "../state/actions";
import { useAppState } from "../state/store";
import { LANGS, type Lang } from "../types";

/** The Scripts & sounds link: a mark and what's there. */
const SCRIPT_LINK: Record<Lang, [string, string]> = {
  ja: ["あ", "Kana, your kanji, long vowels"],
  pl: ["ł", "ą ę ł, cz sz rz, and minimal pairs"],
  ar: ["ب", "The alphabet, vowel marks, throat letters"],
  el: ["α", "The alphabet, letter pairs, stress"],
  pt: ["ã", "European sounds: ão, lh, nh, the swallowed vowels"],
  es: ["ñ", "Stress and r / rr: minimal pairs"],
  fr: ["é", "Vowels and nasals: minimal pairs"],
  it: ["è", "Double consonants and stress: minimal pairs"],
  de: ["ü", "Umlauts, long and short vowels, ch / sch: minimal pairs"],
  nl: ["ij", "Long and short vowels, ij / ui: minimal pairs"],
  ru: ["Я", "Cyrillic, step by step; stress, soft and hard"],
};

const WEEKDAY = (date: string) => new Date(date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "narrow" });
const LONGDAY = (date: string) => new Date(date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });

export function Today({ lang }: { lang: Lang }) {
  const s = useAppState();
  const q = useMemo(() => queue(s, lang), [s, lang]);
  const due = q.learningNow.length + q.due.length;
  const queued = live(s.words).filter((w) => w.lang === lang && w.status === "new").length;
  const newToday = Math.min(newWordsLeft(s, lang), queued);
  const learning = live(s.words).filter((w) => w.lang === lang && w.status === "learning").length;
  const known = live(s.words).filter((w) => w.lang === lang && w.status === "known").length;
  const week = useMemo(() => dayTotals(s, lang, 7), [s, lang]);
  const todayT = week[6];
  const fc = useMemo(() => forecast(s, lang, 7), [s, lang]);
  const days = streak(s, lang);
  const recall = recallRate(s, lang);
  const ks = useMemo(() => knownSet(s, lang), [s, lang]);
  const texts = live(s.texts).filter((t) => t.lang === lang);
  const nextText = texts.filter((t) => !t.readAt).map((t) => ({ t, c: coverage(lang, ks, t.sentences).pct })).sort((a, b) => b.c - a.c)[0];
  const easy = texts.filter((t) => t.readAt).map((t) => ({ t, c: coverage(lang, ks, t.sentences).pct })).sort((a, b) => b.c - a.c || (a.t.listens ?? 0) - (b.t.listens ?? 0))[0];
  const lastChat = live(s.chats).filter((c) => c.lang === lang).sort((a, b) => b.updatedAt - a.updatedAt)[0];
  const others = LANGS.filter((l) => l !== lang).map((l) => { const x = queue(s, l); return { l, n: x.learningNow.length + x.due.length }; });

  const start = () => { startNewWords(lang); go("review"); };
  const total = due + q.fresh.length + newToday;
  const fluency = (id: string) => {
    localStorage.setItem(`reader.rate.${lang}`, "1");
    localStorage.setItem("reader.hide", "true");
    setPrefs({ showTr: false });
    go("read", id);
  };

  return (
    <>
      <div className="page-head row-head">
        <div>
          <span className="eyebrow">{LANG[lang].name} · <span lang={LANG[lang].bcp}>{LANG[lang].native}</span></span>
          <h1 className="display">Today</h1>
        </div>
        {days > 0 && <span className="streak" title={`${days} days in a row`}><IconFlame /> {days} day{days === 1 ? "" : "s"}</span>}
      </div>

      <section className="card strand">
        <div className="card-head"><h2>1 · Cards</h2><span className="tag">focused study</span></div>
        <div className="stat-row">
          <div><b>{due}</b><span>to review</span></div>
          <div><b>{newToday}</b><span>new words</span></div>
          <div><b>{todayT.reviews}</b><span>done today</span></div>
        </div>
        {total > 0 ? (
          <button type="button" className="btn primary" onClick={start}>Start{due ? ` · ${due} review${due === 1 ? "" : "s"}` : ""}{newToday ? ` + ${newToday} new` : ""}</button>
        ) : (
          <p className="muted">Cards are done for today. {fc[1] ? `${fc[1]} tomorrow.` : ""}</p>
        )}
        {queued < 5 && <p className="muted small">{queued ? `Only ${queued} words left in the queue.` : "The word queue is empty."} Add words from texts{hasClaude() ? ", or let Claude pick the next most useful ones" : ""}.</p>}
        {queued < 5 && <SuggestWords lang={lang} />}
      </section>

      <section className="card strand">
        <div className="card-head"><h2>2 · Read & listen</h2><span className="tag">input</span></div>
        {nextText ? (
          <a className="strand-link" href={href("read", nextText.t.id)}>
            <span className="link-card-main"><b className={`lx-${lang}`} lang={LANG[lang].bcp} dir={LANG[lang].dir}>{nextText.t.title}</b>
              <span className="muted small">{nextText.t.titleTr ? `${nextText.t.titleTr} · ` : ""}{Math.round(nextText.c * 100)}% known · listen first, then read</span></span>
            <IconNext className="chev" />
          </a>
        ) : <p className="muted">Everything's read. {hasClaude() ? "Ask for a new story at your level." : "Paste a new text."}</p>}
        <div className="row-between">
          <span className="muted small">{Math.round(todayT.readSec / 60)} min today</span>
          <a className="text-btn" href={href("read")}>{hasClaude() ? "Write me a story" : "All texts"}</a>
        </div>
      </section>

      <section className="card strand">
        <div className="card-head"><h2>3 · Talk</h2><span className="tag">output</span></div>
        <p className="muted small">A few minutes of conversation: say what you can, Claude helps with the rest.</p>
        <div className="btn-row">
          <a className="btn" href={href("talk")}>Start a conversation</a>
          {lastChat && !lastChat.review && <a className="btn ghost" href={href("talk", lastChat.id)}>Continue the last one</a>}
        </div>
        <span className="muted small">{todayT.turns} line{todayT.turns === 1 ? "" : "s"} said today · {Math.round(todayT.talkSec / 60)} min</span>
      </section>

      <section className="card strand">
        <div className="card-head"><h2>4 · Fluency</h2><span className="tag">easy, faster</span></div>
        {easy ? (
          <>
            <p className="muted small">Listen to something you already know, at full speed and without the text, so understanding becomes automatic.</p>
            <button type="button" className="strand-link" onClick={() => fluency(easy.t.id)}>
              <span className="link-card-main"><b className={`lx-${lang}`} lang={LANG[lang].bcp} dir={LANG[lang].dir}>{easy.t.title}</b><span className="muted small">{Math.round(easy.c * 100)}% known · heard {easy.t.listens ?? 0}×</span></span>
              <IconNext className="chev" />
            </button>
          </>
        ) : <p className="muted small">Once you've read a text, re-listening to it at full speed goes here.</p>}
      </section>

      {others.some((o) => o.n > 0) && (
        <div className="others">
          {others.map(({ l, n }) => (
            <button key={l} type="button" className="chip" onClick={() => setPrefs({ lang: l })}>
              <span className={`mark mark-${l}`} lang={LANG[l].bcp}>{LANG[l].mark}</span> {n ? `${n} due` : "done"}
            </button>
          ))}
        </div>
      )}

      <section className="card">
        <h2>Progress</h2>
        <div className="stat-row">
          <div><b>{known}</b><span>known</span></div>
          <div><b>{learning}</b><span>learning</span></div>
          <div><b>{recall.n >= 20 ? `${Math.round(recall.rate * 100)}%` : "–"}</b><span>recall, 30 days</span></div>
          <div><b>{week.reduce((a, d) => a + minutes(d), 0)}</b><span>min this week</span></div>
        </div>
        <div className="charts">
          <div>
            <h3 className="chart-title">Minutes a day, reading, listening and talking</h3>
            <MiniBars label="Minutes a day" unit="min" strong={6} data={week.map((d) => ({ label: WEEKDAY(d.date), value: minutes(d), title: LONGDAY(d.date) }))} />
          </div>
          <div>
            <h3 className="chart-title">Reviews due, next 7 days</h3>
            <MiniBars label="Reviews due" unit="reviews" strong={0} data={fc.map((n, i) => { const d = addDays(today(), i); return { label: i === 0 ? "Tod" : WEEKDAY(d), value: n, title: i === 0 ? "Today" : i === 1 ? "Tomorrow" : LONGDAY(d) }; })} />
          </div>
        </div>
      </section>

      <a className="card link-card" href={href("script")}>
        <span className={`set-mark lx-${lang}`} lang={LANG[lang].bcp}>{SCRIPT_LINK[lang][0]}</span>
        <span className="link-card-main"><b>Scripts & sounds</b><span className="muted small">{SCRIPT_LINK[lang][1]}</span></span>
        <IconNext className="chev" />
      </a>
    </>
  );
}
