/* The active language (per device). The sidebar lists every language; the phone's top bar has a picker
   (a native select over a pill showing the current one), since seven buttons don't fit in 390 px. */
import { LANG } from "../lib/langs";
import { setPrefs, useLang } from "../lib/prefs";
import { LANGS, type Lang } from "../types";
import { IconChevronDown } from "./Icons";

export function LangSwitch({ compact }: { compact?: boolean }) {
  const lang = useLang();
  if (compact) {
    return (
      <label className="lang-pick">
        <span className={`mark mark-${lang}`} lang={LANG[lang].bcp}>{LANG[lang].mark}</span>
        <span className="lang-name">{LANG[lang].name}</span>
        <IconChevronDown />
        <select aria-label="Language" value={lang} onChange={(e) => setPrefs({ lang: e.target.value as Lang })}>
          {LANGS.map((l) => <option key={l} value={l}>{LANG[l].name} · {LANG[l].native}</option>)}
        </select>
      </label>
    );
  }
  return (
    <div className="lang-switch" role="group" aria-label="Language">
      {LANGS.map((l) => (
        <button key={l} type="button" aria-pressed={lang === l} onClick={() => setPrefs({ lang: l })} aria-label={LANG[l].name} title={LANG[l].name}>
          <span className={`mark mark-${l}`} lang={LANG[l].bcp}>{LANG[l].mark}</span>
          <span className="lang-name">{LANG[l].name}</span>
        </button>
      ))}
    </div>
  );
}
