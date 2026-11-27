/* A table of forms (a lesson's endings, a word's declension or conjugation): scrolls sideways on a phone; tap a
   cell to hear it. Cells go through Term, so stress marks, harakat and transliteration follow the settings. */
import { speak } from "../lib/speech";
import type { GTable, Lang } from "../types";
import { Term, useDisplay } from "./Lx";

/** Hebrew runs in an English sentence (אני רואה את הבית), isolated so they keep their order. */
const HEBREW = /([\u0590-\u05FF](?:[\u0590-\u05FF\s"'׳״-]*[\u0590-\u05FF])?)/g;
const withHebrew = (s: string, key: string) =>
  s.split(HEBREW).map((x, i) => (i % 2 ? <bdi key={`${key}h${i}`} lang="he" dir="rtl">{x}</bdi> : x));

/** Claude's plain-English text: **bold** and *italic*, Hebrew kept in order. */
export function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*.+?\*\*|\*[^*\s][^*]*?\*)/g);
  return <>{parts.map((p, i) => {
    if (i % 2 === 0) return withHebrew(p, String(i));
    return p.startsWith("**") ? <b key={i}>{withHebrew(p.slice(2, -2), String(i))}</b> : <i key={i}>{withHebrew(p.slice(1, -1), String(i))}</i>;
  })}</>;
}

/** A heading in the target script (я, ты…) goes through Term like the cells; English ones ("accusative", "feminine -а") don't. */
const NON_LATIN = /[\p{Script=Cyrillic}\p{Script=Greek}\p{Script=Arabic}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;
const targetScript = (s: string) => NON_LATIN.test(s) && !/[a-z]/i.test(s);

export function FormTable({ lang, t }: { lang: Lang; t: GTable }) {
  const d = useDisplay(lang);
  const cell = (c: string, key: number) => {
    const say = c.replace(/[–—-]+$/, "").trim();
    return (
      <td key={key}>
        {say && c !== "–" ? (
          <button type="button" className="cell-say" onClick={() => void speak(say, lang)}><Term lang={lang} text={c} d={d} /></button>
        ) : <span className="muted">–</span>}
      </td>
    );
  };
  return (
    <figure className="gtable">
      {t.title && <figcaption><Rich text={t.title} /></figcaption>}
      <div className="gtable-scroll">
        <table>
          <thead><tr>{t.cols.map((c, i) => <th key={i} scope="col">{c}</th>)}</tr></thead>
          <tbody>
            {t.rows.map((r, i) => (
              <tr key={i}>
                <th scope="row">{targetScript(r.head) ? <Term lang={lang} text={r.head} d={d} /> : r.head}</th>
                {r.cells.map(cell)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {t.note && <p className="muted small"><Rich text={t.note} /></p>}
    </figure>
  );
}
