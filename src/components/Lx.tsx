/* Text in the target language: lang/dir attributes, furigana (Japanese), harakat on/off (Arabic) and transliteration
   under the words (Arabic: from the word or token; Greek: worked out on the device). */
import { useMemo, type ReactNode } from "react";
import { furiganaParts, needsFurigana } from "../lib/furigana";
import { greekTranslit, LANG, stripHarakat } from "../lib/langs";
import { useAppState } from "../state/store";
import type { Lang, Sentence, Token } from "../types";

export function useKnownKanji() {
  const s = useAppState();
  const k = s.settings.lang.ja.knownKanji;
  return useMemo(() => new Set([...k]), [k]);
}

export function useDisplay(lang: Lang) {
  const s = useAppState().settings.lang[lang];
  const known = useKnownKanji();
  return { furigana: s.furigana, harakat: s.harakat, translit: s.translit, known };
}

type Display = ReturnType<typeof useDisplay>;

function Ruby({ text, rt, under }: { text: string; rt?: string; under?: boolean }) {
  if (!rt) return <>{text}</>;
  return <ruby className={under ? "under" : undefined}>{text}<rp>(</rp><rt>{rt}</rt><rp>)</rp></ruby>;
}

/** One word or phrase, e.g. a card's front. */
export function Term({ lang, text, reading, translit, d, forceReading, className }: {
  lang: Lang; text: string; reading?: string; translit?: string; d: Display; forceReading?: boolean; className?: string;
}) {
  let body: ReactNode = text;
  if (lang === "ja" && reading && (forceReading || needsFurigana(text, d.furigana, d.known))) {
    body = furiganaParts(text, reading).map((p, i) => <Ruby key={i} text={p.text} rt={p.rt} />);
  } else if (lang === "ar" && !d.harakat) {
    body = stripHarakat(text);
  }
  const under = lang === "ar" ? translit : lang === "el" ? greekTranslit(text) : undefined;
  return (
    <span className={`lx lx-${lang} ${className ?? ""}`} lang={LANG[lang].bcp} dir={LANG[lang].dir}>
      {d.translit && under ? <Ruby text={typeof body === "string" ? body : text} rt={under} under /> : body}
    </span>
  );
}

/** Render one token (no wrapper). */
export function TokenText({ lang, tok, d }: { lang: Lang; tok: Token; d: Display }) {
  if (lang === "ja" && tok.r && needsFurigana(tok.t, d.furigana, d.known)) {
    return <>{furiganaParts(tok.t, tok.r).map((p, i) => <Ruby key={i} text={p.text} rt={p.rt} />)}</>;
  }
  if (lang === "ar") {
    const t = d.harakat ? tok.t : stripHarakat(tok.t);
    return d.translit && tok.x ? <Ruby text={t} rt={tok.x} under /> : <>{t}</>;
  }
  if (lang === "el" && d.translit && /\p{Script=Greek}/u.test(tok.t)) return <Ruby text={tok.t} rt={greekTranslit(tok.t)} under />;
  return <>{tok.t}</>;
}

const CLOSING = /^[\p{Pe}\p{Pf}\p{Po}]+$/u;
const OPENING = /^[\p{Ps}\p{Pi}]+$/u;

/** Tokens grouped so punctuation never starts a line: "見ました" + "。" stay together, "「" sticks to the next word. */
function groups(tokens: Token[]): number[][] {
  const out: number[][] = [];
  let pendingOpen: number[] = [];
  tokens.forEach((tok, i) => {
    if (!tok.l && CLOSING.test(tok.t) && out.length && !pendingOpen.length) { out[out.length - 1].push(i); return; }
    if (!tok.l && OPENING.test(tok.t)) { pendingOpen.push(i); return; }
    out.push([...pendingOpen, i]);
    pendingOpen = [];
  });
  if (pendingOpen.length) out.push(pendingOpen);
  return out;
}

/** A sentence; word tokens are buttons when onWord is given. `hide` blanks one token (cloze). */
export function Line({ lang, s, d, onWord, hide, mark, className }: {
  lang: Lang; s: Sentence; d: Display; onWord?: (tok: Token, i: number) => void; hide?: number; mark?: (tok: Token) => string | undefined; className?: string;
}) {
  const one = (tok: Token, i: number) => {
    if (i === hide) return <span key={i} className="cloze-gap" aria-label="missing word">{"\u2003\u2003"}</span>;
    if (!tok.l || !onWord) return <span key={i} className={tok.l ? mark?.(tok) : undefined}><TokenText lang={lang} tok={tok} d={d} /></span>;
    return (
      <button key={i} type="button" className={`tok ${mark?.(tok) ?? ""}`} onClick={() => onWord(tok, i)}>
        <TokenText lang={lang} tok={tok} d={d} />
      </button>
    );
  };
  return (
    <span className={`lx lx-${lang} line ${className ?? ""}`} lang={LANG[lang].bcp} dir={LANG[lang].dir}>
      {groups(s.tokens).map((g) => (g.length === 1 ? one(s.tokens[g[0]], g[0]) : <span key={g[0]} className="nowrap">{g.map((i) => one(s.tokens[i], i))}</span>))}
    </span>
  );
}
