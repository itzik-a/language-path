/* Today: what to do in the active language. (Fills out with the four strands in the "Today & progress" milestone.) */
import { useMemo } from "react";
import { IconNext } from "../components/Icons";
import { LANG } from "../lib/langs";
import { forecast, newWordsLeft, queue } from "../lib/queue";
import { go, href } from "../lib/route";
import { live, startNewWords } from "../state/actions";
import { useAppState } from "../state/store";
import type { Lang } from "../types";

export function Today({ lang }: { lang: Lang }) {
  const s = useAppState();
  const q = useMemo(() => queue(s, lang), [s, lang]);
  const due = q.learningNow.length + q.due.length;
  const queued = live(s.words).filter((w) => w.lang === lang && w.status === "new").length;
  const newToday = Math.min(newWordsLeft(s, lang), queued);
  const fc = useMemo(() => forecast(s, lang, 7), [s, lang]);
  const learning = live(s.words).filter((w) => w.lang === lang && w.status === "learning").length;
  const known = live(s.words).filter((w) => w.lang === lang && w.status === "known").length;

  const start = () => { startNewWords(lang); go("review"); };
  const total = due + q.fresh.length + newToday * 2;

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">{LANG[lang].name} · <span lang={LANG[lang].bcp}>{LANG[lang].native}</span></span>
        <h1 className="display">Today</h1>
      </div>

      <section className="card strand">
        <div className="card-head"><h2>Cards</h2><span className="tag">focused study</span></div>
        <div className="stat-row">
          <div><b>{due}</b><span>to review</span></div>
          <div><b>{newToday}</b><span>new words</span></div>
          <div><b>{learning}</b><span>learning</span></div>
          <div><b>{known}</b><span>known</span></div>
        </div>
        {total > 0 ? (
          <button type="button" className="btn primary" onClick={start}>Start{due ? ` · ${due} review${due === 1 ? "" : "s"}` : ""}{newToday ? ` + ${newToday} new` : ""}</button>
        ) : (
          <p className="muted">All done for today. {fc[1] ? `${fc[1]} card${fc[1] === 1 ? "" : "s"} tomorrow.` : ""}</p>
        )}
        {queued === 0 && <p className="muted small">The queue is empty: add words from texts, or (with Claude connected) ask for the next most useful ones.</p>}
      </section>

      <a className="card link-card" href={href("script")}>
        <span className={`set-mark lx-${lang}`}>{lang === "ja" ? "あ" : lang === "ar" ? "ب" : "ł"}</span>
        <span className="link-card-main"><b>Scripts & sounds</b><span className="muted small">{lang === "ja" ? "Kana, your kanji, long vowels" : lang === "ar" ? "The alphabet, vowel marks, throat letters" : "ą ę ł, cz sz rz, and minimal pairs"}</span></span>
        <IconNext className="chev" />
      </a>
    </>
  );
}
