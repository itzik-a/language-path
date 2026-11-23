/* Words: every word of the active language, by status; a word's page. */
import { useMemo, useState } from "react";
import { IconBack, IconCheck, IconClose, IconNext, IconSearch, IconSpeaker } from "../components/Icons";
import { Line, Term, useDisplay } from "../components/Lx";
import { Seg, useSessionState } from "../components/ui";
import { fold, LANG } from "../lib/langs";
import { href } from "../lib/route";
import { speak } from "../lib/speech";
import { sayWord, STATUS_LABEL } from "../lib/words";
import { editWord, live, removeWord, setStatus } from "../state/actions";
import { useAppState } from "../state/store";
import type { Lang, Word, WordStatus } from "../types";
import { WordCards } from "./WordCards";
import { SuggestWords } from "../components/SuggestWords";

type Filter = WordStatus | "all";

export function Words({ lang, sub }: { lang: Lang; sub?: string }) {
  if (sub) return <WordPage id={sub} lang={lang} />;
  return <WordList lang={lang} />;
}

function WordList({ lang }: { lang: Lang }) {
  const s = useAppState();
  const d = useDisplay(lang);
  const [filter, setFilter] = useSessionState<Filter>(`words.filter.${lang}`, "new");
  const [q, setQ] = useState("");
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const words = useMemo(() => live(s.words).filter((w) => w.lang === lang), [s.words, lang]);
  const count = (f: Filter) => (f === "all" ? words.length : words.filter((w) => w.status === f).length);
  const shown = useMemo(() => {
    const fq = fold(lang, q);
    const list = words.filter((w) => (filter === "all" || w.status === filter) &&
      (!fq || fold(lang, w.lemma).includes(fq) || (w.reading && fold(lang, w.reading).includes(fq)) || w.gloss.toLowerCase().includes(q.trim().toLowerCase()) || (w.translit ?? "").toLowerCase().includes(q.trim().toLowerCase())));
    return filter === "new" ? list.sort((a, b) => a.rank - b.rank) : list.sort((a, b) => b.updatedAt - a.updatedAt || a.rank - b.rank);
  }, [words, filter, q, lang]);

  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const apply = (st: WordStatus) => { setStatus([...picked], st); setPicked(new Set()); setPicking(false); };

  return (
    <>
      <div className="page-head row-head">
        <div>
          <span className="eyebrow">{LANG[lang].name}</span>
          <h1 className="display">Words</h1>
        </div>
        <a className="btn ghost sm" href={href("script")}>Scripts & sounds</a>
      </div>

      <Seg className="full" label="Show" value={filter} onChange={(f) => { setFilter(f); setPicked(new Set()); }}
        options={(["new", "learning", "known", "all"] as Filter[]).map((f) => ({ id: f, label: <>{f === "all" ? "All" : STATUS_LABEL[f as WordStatus]} <span className="count">{count(f)}</span></> }))} />

      <div className="row-between">
        <label className="search grow">
          <IconSearch />
          <input type="search" placeholder="Search words or meanings" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search words" />
          {q && <button type="button" className="search-clear" aria-label="Clear" onClick={() => setQ("")}><IconClose /></button>}
        </label>
        <button type="button" className={`btn sm${picking ? " primary" : " ghost"}`} onClick={() => { setPicking(!picking); setPicked(new Set()); }}>{picking ? "Cancel" : "Select"}</button>
      </div>
      {filter === "new" && !picking && words.some((w) => w.status === "new") && (
        <p className="muted small">The queue: new words start, a few a day, in this order. Already know some? Tap <b>Select</b> and mark them known.</p>
      )}
      {filter === "new" && !picking && <SuggestWords lang={lang} />}

      {shown.length === 0 ? (
        <div className="card empty"><p className="muted">{q ? "No word matches." : filter === "learning" ? "No words being learned yet. They start from the queue, a few each day." : "Nothing here yet."}</p></div>
      ) : (
        <ul className="card word-list">
          {shown.map((w) => (
            <li key={w.id}>
              {picking ? (
                <button type="button" className="word-row" aria-pressed={picked.has(w.id)} onClick={() => toggle(w.id)}>
                  <span className={`check${picked.has(w.id) ? " on" : ""}`} aria-hidden="true">{picked.has(w.id) && <IconCheck />}</span>
                  <WordRowBody w={w} d={d} />
                </button>
              ) : (
                <a className="word-row" href={href("words", w.id)}>
                  <WordRowBody w={w} d={d} />
                  {filter === "all" && <span className="tag">{STATUS_LABEL[w.status]}</span>}
                  <IconNext className="chev" />
                </a>
              )}
            </li>
          ))}
        </ul>
      )}

      {picking && (
        <div className="pick-bar">
          <span><b>{picked.size}</b> selected</span>
          <button type="button" className="text-btn" onClick={() => setPicked(new Set(shown.map((w) => w.id)))}>All {shown.length}</button>
          <div className="btn-row">
            <button type="button" className="btn primary sm" disabled={!picked.size} onClick={() => apply("known")}>I know these</button>
            {filter !== "new" && <button type="button" className="btn sm" disabled={!picked.size} onClick={() => apply("new")}>To queue</button>}
            <button type="button" className="btn ghost sm" disabled={!picked.size} onClick={() => apply("ignored")}>Ignore</button>
          </div>
        </div>
      )}
    </>
  );
}

function WordRowBody({ w, d }: { w: Word; d: ReturnType<typeof useDisplay> }) {
  return (
    <span className="word-row-main">
      <span className="word-row-term"><Term lang={w.lang} text={w.lemma} d={d} />
        {w.lang === "ja" && w.reading && <span className="muted reading" lang="ja">{w.reading}</span>}
        {(w.lang === "ar" || w.lang === "el") && w.translit && <span className="muted reading">{w.translit}</span>}
      </span>
      <span className="muted small word-row-gloss">{w.gloss}</span>
    </span>
  );
}

function NoteEdit({ w }: { w: Word }) {
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" className="text-btn" onClick={() => setOpen(true)}>{w.note ? "Edit note" : "Add a note"}</button>;
  return (
    <label className="field">
      <span className="field-label">Note</span>
      <textarea className="text-input" rows={2} autoFocus value={w.note ?? ""} placeholder="A mnemonic, a grammar point…" onChange={(e) => editWord(w.id, { note: e.target.value })} />
    </label>
  );
}

function WordPage({ id, lang }: { id: string; lang: Lang }) {
  const s = useAppState();
  const d = useDisplay(lang);
  const w = s.words.find((x) => x.id === id && !x.deletedAt);
  if (!w) return (<><a className="back" href={href("words")}><IconBack /> Words</a><div className="card"><p className="muted">This word was removed.</p></div></>);
  return (
    <>
      <a className="back" href={href("words")}><IconBack /> Words</a>
      <section className="card word-head">
        <div className="row-head">
          <div>
            <Term lang={w.lang} text={w.lemma} reading={w.reading} d={{ ...d, harakat: true }} forceReading className="word-big" />
            {(w.translit || (w.lang === "ja" && w.reading)) && <span className="muted">{[w.lang === "ja" ? w.reading : "", w.translit].filter(Boolean).join(" · ")}</span>}
          </div>
          <button type="button" className="icon-btn" aria-label="Say it" onClick={() => void speak(sayWord(w), w.lang)}><IconSpeaker /></button>
        </div>
        <p className="word-gloss">{w.gloss}</p>
        <dl className="facts">
          {w.pos && <div><dt>Kind</dt><dd>{w.pos}</dd></div>}
          {w.root && <div><dt>Root</dt><dd><bdi lang="ar" dir="rtl" className="lx-ar">{w.root}</bdi></dd></div>}
          {w.hebrew && <div><dt>Hebrew</dt><dd lang="he" dir="ltr">{w.hebrew}</dd></div>}
          <div><dt>Status</dt><dd>{STATUS_LABEL[w.status]}</dd></div>
        </dl>
        {w.note && <p className="note">{w.note}</p>}
      </section>

      {w.example && (
        <section className="card">
          <div className="card-head"><h2>Example</h2><button type="button" className="icon-btn subtle" aria-label="Play the example" onClick={() => void speak(w.example!.tokens.map((t) => t.t).join(""), w.lang)}><IconSpeaker /></button></div>
          <Line lang={w.lang} s={w.example} d={d} className="big-line" />
          <p className="muted">{w.example.tr}</p>
        </section>
      )}

      <WordCards w={w} />

      <section className="card">
        <h2>Status</h2>
        <Seg className="full" label="Status" value={w.status} onChange={(st) => setStatus([w.id], st)}
          options={(["new", "learning", "known", "ignored"] as WordStatus[]).map((st) => ({ id: st, label: STATUS_LABEL[st] }))} />
        <NoteEdit w={w} />
        <button type="button" className="btn ghost danger sm" onClick={() => { removeWord(w.id); location.hash = "words"; }}>Remove word</button>
      </section>
    </>
  );
}
