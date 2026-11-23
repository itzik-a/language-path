/* Scripts & sounds: kana tables, the Arabic alphabet and vowel marks, known kanji, Polish sounds, minimal pairs. */
import { useMemo, useState } from "react";
import { IconBack, IconCheck, IconNext, IconSpeaker } from "../components/Icons";
import { Term, useDisplay } from "../components/Lx";
import { letterForms, PAIRS, POLISH_SOUNDS, setsFor, SCRIPT_SETS, type ScriptChar, type ScriptSet } from "../data/scripts";
import { hasKanji, kanjiIn, LANG } from "../lib/langs";
import { href } from "../lib/route";
import { speak } from "../lib/speech";
import { showToast } from "../lib/toast";
import { addScriptCards, live, setLangSettings } from "../state/actions";
import { useAppState } from "../state/store";
import type { Lang } from "../types";

export function Script({ lang, sub }: { lang: Lang; sub?: string }) {
  const set = SCRIPT_SETS.find((s) => s.id === sub && s.lang === lang);
  if (set) return <SetPage set={set} />;
  if (sub === "kanji" && lang === "ja") return <KanjiPage />;
  if (sub === "sounds" && lang === "pl") return <SoundsPage />;
  if (sub === "pairs") return <PairsPage lang={lang} />;
  return <Overview lang={lang} />;
}

const Back = ({ to = "script" as const, label = "Scripts & sounds" }) => (
  <a className="back" href={to === "script" ? href("script") : href(to)}><IconBack /> {label}</a>
);

function Overview({ lang }: { lang: Lang }) {
  const s = useAppState();
  const known = new Set(s.settings.lang[lang].knownChars);
  const scriptCards = live(s.cards).filter((c) => c.kind === "script" && c.lang === lang);
  return (
    <>
      <a className="back" href={href("words")}><IconBack /> Words</a>
      <div className="page-head">
        <span className="eyebrow">{LANG[lang].name}</span>
        <h1 className="display">Scripts & sounds</h1>
      </div>
      <ul className="tile-list">
        {setsFor(lang).map((set) => {
          const all = set.rows.flatMap((r) => r.chars);
          const k = all.filter((c) => known.has(c.id)).length;
          const inReview = scriptCards.filter((c) => all.some((x) => x.id === c.charId)).length;
          return (
            <li key={set.id}>
              <a className="card link-card" href={href("script", set.id)}>
                <span className={`set-mark lx-${lang}`} lang={LANG[lang].bcp}>{all[set.id === "har" ? 0 : 1].char}</span>
                <span className="link-card-main">
                  <b>{set.title}</b>
                  <span className="muted small">{k} of {all.length} known{inReview ? ` · ${inReview} in reviews` : ""}</span>
                  <span className="meter"><span style={{ width: `${(100 * k) / all.length}%` }} /></span>
                </span>
                <IconNext className="chev" />
              </a>
            </li>
          );
        })}
        {lang === "ja" && (
          <li>
            <a className="card link-card" href={href("script", "kanji")}>
              <span className="set-mark lx-ja" lang="ja">漢</span>
              <span className="link-card-main"><b>Kanji I know</b><span className="muted small">{[...s.settings.lang.ja.knownKanji].length} kanji · furigana skips these</span></span>
              <IconNext className="chev" />
            </a>
          </li>
        )}
        {lang === "pl" && (
          <li>
            <a className="card link-card" href={href("script", "sounds")}>
              <span className="set-mark">ł</span>
              <span className="link-card-main"><b>Polish sounds</b><span className="muted small">ą ę ł, cz sz rz, ć ś ź, and the stress rule</span></span>
              <IconNext className="chev" />
            </a>
          </li>
        )}
        <li>
          <a className="card link-card" href={href("script", "pairs")}>
            <span className="set-mark"><IconSpeaker /></span>
            <span className="link-card-main"><b>Hear the difference</b><span className="muted small">Minimal pairs: {PAIRS[lang].map((p) => p.what).slice(0, 2).join(", ")}…</span></span>
            <IconNext className="chev" />
          </a>
        </li>
      </ul>
    </>
  );
}

// ── a script set ──────────────────────────────────────────────

function SetPage({ set }: { set: ScriptSet }) {
  const s = useAppState();
  const lang = set.lang;
  const known = new Set(s.settings.lang[lang].knownChars);
  const [sel, setSel] = useState<ScriptChar | null>(null);
  const [quiz, setQuiz] = useState<ScriptChar[] | null>(null);
  const all = set.rows.flatMap((r) => r.chars);
  const unknown = all.filter((c) => !known.has(c.id));
  const inReview = new Set(live(s.cards).filter((c) => c.kind === "script").map((c) => c.charId));

  const toggleRow = (ids: string[], on: boolean) => {
    const next = new Set(known);
    for (const id of ids) { if (on) next.add(id); else next.delete(id); }
    setLangSettings(lang, { knownChars: [...next] });
  };
  const tap = (c: ScriptChar) => { setSel(c); void speak(c.say, lang); };

  if (quiz) return <Quiz lang={lang} pool={quiz} all={all} onDone={() => setQuiz(null)} />;

  return (
    <>
      <Back />
      <div className="page-head">
        <span className="eyebrow">{LANG[lang].name}</span>
        <h1 className="display">{set.title}</h1>
        <p className="muted">{set.blurb}</p>
      </div>

      <div className="btn-row">
        <button type="button" className="btn primary" onClick={() => setQuiz(unknown.length >= 4 ? unknown : all)}>Quiz me{unknown.length >= 4 && unknown.length < all.length ? ` on ${unknown.length} I don't know` : ""}</button>
        {unknown.some((c) => !inReview.has(c.id)) && (
          <button type="button" className="btn" onClick={() => { const n = addScriptCards(lang, unknown.map((c) => c.id)); showToast(n ? `${n} added to your reviews` : "Already in your reviews"); }}>
            Add the {unknown.filter((c) => !inReview.has(c.id)).length} I don't know to reviews
          </button>
        )}
      </div>
      <p className="muted small">Tap a character to hear it. Mark the rows you already know: they're left out of quizzes and reviews.</p>

      {sel && <CharDetail c={sel} lang={lang} onClose={() => setSel(null)} />}

      {set.rows.map((row) => {
        const ids = row.chars.map((c) => c.id);
        const allKnown = ids.every((id) => known.has(id));
        return (
          <section key={row.id} className="card script-row">
            <div className="card-head">
              <h2 className={lang === "ar" ? "lx-ar" : undefined}>{row.label}</h2>
              <button type="button" className={`chip${allKnown ? " on" : ""}`} aria-pressed={allKnown} onClick={() => toggleRow(ids, !allKnown)}>
                {allKnown ? <><IconCheck /> Known</> : "I know these"}
              </button>
            </div>
            <div className={`char-grid${lang === "ar" ? " rtl" : ""}`} dir={lang === "ar" ? "rtl" : undefined}>
              {row.chars.map((c) => (
                <button key={c.id} type="button" className={`char-cell${known.has(c.id) ? " known" : ""}${sel?.id === c.id ? " sel" : ""}`} onClick={() => tap(c)}>
                  <span className={`char lx-${lang}`} lang={LANG[lang].bcp}>{c.char}</span>
                  <span className="char-sound" dir="ltr">{c.sound}</span>
                  {c.hebrew && <span className="char-he" lang="he">{c.hebrew}</span>}
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}

function CharDetail({ c, lang, onClose }: { c: ScriptChar; lang: Lang; onClose: () => void }) {
  const forms = lang === "ar" && c.id.startsWith("abc:") && c.joins !== undefined ? letterForms(c.char, c.joins) : null;
  return (
    <section className="card char-detail" aria-live="polite">
      <div className="row-head">
        <div>
          <span className={`char-big lx-${lang}`} lang={LANG[lang].bcp}>{c.char}</span>
          <b>{c.sound}</b>
          {c.name && <span className="muted small">{c.name}</span>}
        </div>
        <div className="btn-row">
          <button type="button" className="icon-btn" aria-label="Hear it" onClick={() => void speak(c.say, lang)}><IconSpeaker /></button>
          <button type="button" className="btn ghost sm" onClick={onClose}>Close</button>
        </div>
      </div>
      {c.info && <p>{c.info}</p>}
      {c.hebrew && <p className="muted small">Hebrew: <span lang="he">{c.hebrew}</span></p>}
      {forms && (
        <dl className="forms" dir="rtl">
          {(["iso", "init", "mid", "fin"] as const).map((k) => (
            <div key={k}><dd className="lx-ar" lang="ar">{forms[k]}</dd><dt dir="ltr">{{ iso: "alone", init: "start", mid: "middle", fin: "end" }[k]}</dt></div>
          ))}
        </dl>
      )}
    </section>
  );
}

// ── quiz ──────────────────────────────────────────────────────

const shuffle = <T,>(xs: T[]) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const ROUNDS = 12;

interface Q { c: ScriptChar; mode: "see" | "hear"; options: ScriptChar[]; shown: string }

function makeQ(pool: ScriptChar[], all: ScriptChar[], lang: Lang): Q {
  const c = pool[Math.floor(Math.random() * pool.length)];
  const others = shuffle(all.filter((x) => x.id !== c.id && x.sound !== c.sound)).slice(0, 3);
  const mode = Math.random() < 0.5 ? "see" : "hear";
  let shown = c.char;
  if (lang === "ar" && c.joins !== undefined && c.id.startsWith("abc:") && Math.random() < 0.5) {
    const f = letterForms(c.char, c.joins);
    shown = [f.init, f.mid, f.fin][Math.floor(Math.random() * 3)];
  }
  return { c, mode, options: shuffle([c, ...others]), shown };
}

function Quiz({ lang, pool, all, onDone }: { lang: Lang; pool: ScriptChar[]; all: ScriptChar[]; onDone: () => void }) {
  const [n, setN] = useState(0);
  const [q, setQ] = useState(() => makeQ(pool, all, lang));
  const [picked, setPicked] = useState<string | null>(null);
  const [right, setRight] = useState(0);
  const [missed, setMissed] = useState<ScriptChar[]>([]);

  const answer = (o: ScriptChar) => {
    if (picked) return;
    setPicked(o.id);
    const ok = o.id === q.c.id;
    if (ok) setRight((r) => r + 1); else setMissed((m) => (m.some((x) => x.id === q.c.id) ? m : [...m, q.c]));
    void speak(q.c.say, lang);
  };
  const next = () => {
    if (n + 1 >= ROUNDS) { setN(ROUNDS); return; }
    const nq = makeQ(missed.length && Math.random() < 0.35 ? missed : pool, all, lang);
    setN(n + 1); setQ(nq); setPicked(null);
    if (nq.mode === "hear") void speak(nq.c.say, lang);
  };

  if (n >= ROUNDS) {
    return (
      <>
        <button type="button" className="back" onClick={onDone}><IconBack /> Back</button>
        <section className="card quiz-end">
          <span className="hero">{right} / {ROUNDS}</span>
          {missed.length ? (
            <>
              <p>Worth another look:</p>
              <div className="char-grid">{missed.map((c) => (
                <button key={c.id} type="button" className="char-cell" onClick={() => void speak(c.say, lang)}><span className={`char lx-${lang}`}>{c.char}</span><span className="char-sound">{c.sound}</span></button>
              ))}</div>
            </>
          ) : <p>All right. Mark these rows as known when they feel easy.</p>}
          <div className="btn-row">
            <button type="button" className="btn primary" onClick={() => { setN(0); setRight(0); setMissed([]); setPicked(null); setQ(makeQ(pool, all, lang)); }}>Again</button>
            <button type="button" className="btn ghost" onClick={onDone}>Done</button>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <div className="row-between">
        <button type="button" className="back" onClick={onDone}><IconBack /> Stop</button>
        <span className="muted small">{n + 1} / {ROUNDS} · {right} right</span>
      </div>
      <section className="card quiz">
        {q.mode === "see" ? (
          <>
            <span className="muted small">What does this say?</span>
            <span className={`char-big lx-${lang}`} lang={LANG[lang].bcp}>{q.shown}</span>
          </>
        ) : (
          <>
            <span className="muted small">Which one do you hear?</span>
            <button type="button" className="play-big" aria-label="Play again" onClick={() => void speak(q.c.say, lang)}><IconSpeaker width={40} height={40} /></button>
          </>
        )}
        <div className="options">
          {q.options.map((o) => {
            const st = picked ? (o.id === q.c.id ? "right" : o.id === picked ? "wrong" : "") : "";
            return (
              <button key={o.id} type="button" className={`option ${st}`} onClick={() => answer(o)} disabled={!!picked && !st}>
                {q.mode === "see" ? <span>{o.sound}</span> : <span className={`lx-${lang}`} lang={LANG[lang].bcp}>{o.char}</span>}
              </button>
            );
          })}
        </div>
        {picked && (
          <div className="quiz-after">
            <span>{q.c.char} = <b>{q.c.sound}</b>{q.c.info ? ` · ${q.c.info}` : ""}</span>
            <button type="button" className="btn primary" autoFocus onClick={next}>{n + 1 >= ROUNDS ? "Finish" : "Next"}</button>
          </div>
        )}
      </section>
    </>
  );
}

// ── kanji ─────────────────────────────────────────────────────

function KanjiPage() {
  const s = useAppState();
  const known = s.settings.lang.ja.knownKanji;
  const knownSet = useMemo(() => new Set([...known]), [known]);
  const [text, setText] = useState("");
  const [removing, setRemoving] = useState(false);
  const inWords = useMemo(() => {
    const ks = new Set<string>();
    for (const w of live(s.words)) if (w.lang === "ja") for (const k of kanjiIn(w.lemma)) if (!knownSet.has(k)) ks.add(k);
    return [...ks];
  }, [s.words, knownSet]);

  const add = (ks: string[]) => {
    const next = [...new Set([...known, ...ks])].join("");
    const n = [...next].length - [...known].length;
    setLangSettings("ja", { knownKanji: next });
    return n;
  };
  const remove = (k: string) => setLangSettings("ja", { knownKanji: [...known].filter((x) => x !== k).join("") });

  return (
    <>
      <Back />
      <div className="page-head">
        <span className="eyebrow">Japanese</span>
        <h1 className="display">Kanji I know</h1>
        <p className="muted">Furigana (the small kana readings) appear only over kanji that aren't on this list, so text stays clean where you can read it.</p>
      </div>
      <section className="card">
        <h2>Add kanji</h2>
        <textarea className="text-input" rows={4} lang="ja" placeholder="Paste any text: a list of the kanji you know, a page from your textbook… Only the kanji are kept."
          value={text} onChange={(e) => setText(e.target.value)} />
        <div className="btn-row">
          <button type="button" className="btn primary" disabled={!hasKanji(text)} onClick={() => { const n = add(kanjiIn(text)); setText(""); showToast(n ? `${n} kanji added` : "You had all of these already"); }}>
            Add {kanjiIn(text).length || ""} kanji
          </button>
        </div>
      </section>
      {inWords.length > 0 && (
        <section className="card">
          <h2>In your words, not marked yet</h2>
          <p className="muted small">Tap the ones you know.</p>
          <div className="kanji-grid" lang="ja">
            {inWords.map((k) => <button key={k} type="button" className="kanji-cell" onClick={() => add([k])}>{k}</button>)}
          </div>
        </section>
      )}
      <section className="card">
        <div className="card-head">
          <h2>Known · {[...known].length}</h2>
          {known && <button type="button" className="btn ghost sm" onClick={() => setRemoving(!removing)}>{removing ? "Done" : "Remove some"}</button>}
        </div>
        {known ? (
          <div className="kanji-grid" lang="ja">
            {[...known].map((k) => removing
              ? <button key={k} type="button" className="kanji-cell removing" aria-label={`Remove ${k}`} onClick={() => remove(k)}>{k}</button>
              : <span key={k} className="kanji-cell">{k}</span>)}
          </div>
        ) : <p className="muted">None yet. Paste the kanji you know above (about 300, you said).</p>}
      </section>
    </>
  );
}

// ── Polish sounds ─────────────────────────────────────────────

function SoundsPage() {
  return (
    <>
      <Back />
      <div className="page-head">
        <span className="eyebrow">Polish</span>
        <h1 className="display">Polish sounds</h1>
        <p className="muted">Polish is spelled the way it sounds once you know these. Stress is almost always on the second-to-last syllable: <i>dzię-KU-ję</i>, <i>prze-PRA-szam</i>.</p>
      </div>
      <ul className="card sound-list">
        {POLISH_SOUNDS.map((x) => (
          <li key={x.g}>
            <button type="button" className="sound-row" onClick={() => void speak(x.ex, "pl")}>
              <span className="sound-g" lang="pl">{x.g}</span>
              <span className="sound-main"><span>{x.how}</span><span className="muted small"><b lang="pl">{x.ex}</b> · {x.gloss}</span></span>
              <IconSpeaker className="chev" />
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

// ── minimal pairs ─────────────────────────────────────────────

function PairsPage({ lang }: { lang: Lang }) {
  const d = useDisplay(lang);
  const pairs = PAIRS[lang];
  const [i, setI] = useState(() => Math.floor(Math.random() * pairs.length));
  const [which, setWhich] = useState<"a" | "b">(() => (Math.random() < 0.5 ? "a" : "b"));
  const [picked, setPicked] = useState<"a" | "b" | null>(null);
  const [score, setScore] = useState({ right: 0, total: 0 });
  const p = pairs[i];
  const play = (k: "a" | "b" = which) => void speak(p[k][0], lang, { rate: 0.85 });
  const pick = (k: "a" | "b") => {
    if (picked) return;
    setPicked(k);
    setScore((s) => ({ right: s.right + (k === which ? 1 : 0), total: s.total + 1 }));
  };
  const next = () => {
    const ni = Math.floor(Math.random() * pairs.length);
    const nw = Math.random() < 0.5 ? "a" : "b";
    setI(ni); setWhich(nw); setPicked(null);
    void speak(pairs[ni][nw][0], lang, { rate: 0.85 });
  };
  return (
    <>
      <Back />
      <div className="page-head">
        <span className="eyebrow">{LANG[lang].name}</span>
        <h1 className="display">Hear the difference</h1>
        <p className="muted">Two words that differ by one sound. Listen, then pick the one you heard. Training your ear on these makes listening (and your accent) better.</p>
      </div>
      <section className="card quiz">
        <span className="muted small">{p.what}{score.total ? ` · ${score.right} / ${score.total}` : ""}</span>
        <button type="button" className="play-big" aria-label="Play" onClick={() => play()}><IconSpeaker width={40} height={40} /></button>
        <div className="options two">
          {(["a", "b"] as const).map((k) => {
            const st = picked ? (k === which ? "right" : k === picked ? "wrong" : "") : "";
            return (
              <button key={k} type="button" className={`option ${st}`} onClick={() => pick(k)}>
                <Term lang={lang} text={p[k][0]} d={{ ...d, harakat: true }} className="option-term" />
                <span className="muted small">{p[k][1]}</span>
              </button>
            );
          })}
        </div>
        {picked && (
          <div className="quiz-after">
            <span>{picked === which ? "Right." : "Not quite."} Compare: <button type="button" className="text-btn" onClick={() => play("a")}>{p.a[1]}</button> · <button type="button" className="text-btn" onClick={() => play("b")}>{p.b[1]}</button></span>
            <button type="button" className="btn primary" onClick={next}>Next</button>
          </div>
        )}
      </section>
    </>
  );
}

