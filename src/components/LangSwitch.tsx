/* The active language (per device): あ · Pl · ع */
import { LANG } from "../lib/langs";
import { setPrefs, useLang } from "../lib/prefs";
import { LANGS } from "../types";

export function LangSwitch({ compact }: { compact?: boolean }) {
  const lang = useLang();
  return (
    <div className={`lang-switch${compact ? " compact" : ""}`} role="group" aria-label="Language">
      {LANGS.map((l) => (
        <button key={l} type="button" aria-pressed={lang === l} onClick={() => setPrefs({ lang: l })} aria-label={LANG[l].name} title={LANG[l].name}>
          <span className={`mark mark-${l}`} lang={LANG[l].bcp}>{LANG[l].mark}</span>
          {!compact && <span className="lang-name">{LANG[l].name}</span>}
        </button>
      ))}
    </div>
  );
}
