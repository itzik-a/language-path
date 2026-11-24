/* Settings: sync, the active language's settings, this device's voice, Claude, backup. */
import { LANG } from "../lib/langs";
import { setPrefs, usePrefs } from "../lib/prefs";
import { canSpeak, speak, useVoices } from "../lib/speech";
import { setLangSettings } from "../state/actions";
import { useAppState } from "../state/store";
import type { Lang } from "../types";
import { IconSpeaker } from "./Icons";
import { ThemePicker } from "./ThemePicker";
import { BackupSection, SyncSection } from "./SyncSection";
import { ClaudeSection } from "./ClaudeSection";
import { Field, Seg, Select, Sheet, Stepper, Switch } from "./ui";

const SAMPLE: Record<Lang, string> = {
  ja: "こんにちは。今日はいい天気ですね。",
  pl: "Dzień dobry! Jak się masz?",
  ar: "مَرْحَبًا، كَيْفَ حَالُكَ؟",
  el: "Καλημέρα! Τι κάνεις;",
  pt: "Bom dia! Tudo bem contigo?",
};

/** "pt-PT" → "Portugal", "pt-BR" → "Brazil". */
function regionName(tag: string): string {
  const r = tag.replace("_", "-").split("-")[1];
  if (!r) return tag;
  try { return new Intl.DisplayNames(["en"], { type: "region" }).of(r.toUpperCase()) ?? r; } catch { return r; }
}

export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const { lang } = usePrefs();
  return (
    <Sheet title="Settings" onClose={onClose}>
      <SyncSection />
      <LangSection lang={lang} />
      <VoiceSection lang={lang} />
      <ClaudeSection />
      <section className="dlg-section" aria-labelledby="theme-title">
        <h3 id="theme-title">Appearance</h3>
        <ThemePicker />
        <p className="muted small">System follows this device's light or dark setting. Each device keeps its own choice.</p>
      </section>
      <BackupSection />
    </Sheet>
  );
}

function LangSection({ lang }: { lang: Lang }) {
  const s = useAppState().settings.lang[lang];
  return (
    <section className="dlg-section" aria-labelledby="lang-title">
      <h3 id="lang-title">{LANG[lang].name}</h3>
      <Stepper label="New words a day" value={s.newPerDay} min={0} max={40} step={1} onChange={(v) => setLangSettings(lang, { newPerDay: v })} />
      <Field label="My level, in my words" hint="Claude reads this when it writes stories and talks with you.">
        <textarea className="text-input" rows={3} value={s.level} onChange={(e) => setLangSettings(lang, { level: e.target.value })} />
      </Field>
      {lang === "ja" && (
        <div className="field">
          <span className="field-label">Furigana</span>
          <Seg label="Furigana" value={s.furigana} onChange={(v) => setLangSettings(lang, { furigana: v })}
            options={[{ id: "unknown", label: "New kanji" }, { id: "all", label: "All" }, { id: "none", label: "None" }]} />
          <span className="muted small">"New kanji": readings only over kanji you haven't marked as known (Words → Scripts → Kanji).</span>
        </div>
      )}
      {lang === "ar" && (
        <label className="switch-row"><Switch on={s.harakat} onChange={(v) => setLangSettings(lang, { harakat: v })} label="Vowel marks" /> Vowel marks (harakat)</label>
      )}
      {(lang === "ja" || lang === "ar" || lang === "el") && (
        <label className="switch-row"><Switch on={s.translit} onChange={(v) => setLangSettings(lang, { translit: v })} label="Transliteration" /> {lang === "ja" ? "Romaji on cards" : "Transliteration under words"}</label>
      )}
      <Stepper label="Practise saying a word after" value={s.sayAfterDays} min={0} max={30} step={1} unit=" days" onChange={(v) => setLangSettings(lang, { sayAfterDays: v })} />
      <span className="muted small">Once you recognise a word reliably for this long, a card asking you to say it is added. 0: right away.</span>
    </section>
  );
}

function VoiceSection({ lang }: { lang: Lang }) {
  const prefs = usePrefs();
  const voices = useVoices(lang);
  const chosen = prefs.voice[lang] ?? voices[0]?.voiceURI ?? "";
  return (
    <section className="dlg-section" aria-labelledby="voice-title">
      <h3 id="voice-title">Voice on this device</h3>
      {!canSpeak() ? <p className="muted small">This browser can't speak.</p>
        : voices.length === 0 ? (
          <p className="small">No {LANG[lang].name} voice on this device yet. On iPhone: Settings → Accessibility → Spoken Content → Voices → {LANG[lang].name}, and download one (the "Enhanced" or "Premium" ones sound best). On Mac: System Settings → Accessibility → Spoken Content → System voice → Manage Voices.</p>
        ) : (
          <>
            <div className="voice-row">
              <Select label="Voice" value={chosen} onChange={(v) => setPrefs({ voice: { ...prefs.voice, [lang]: v } })}
                options={voices.map((v) => ({ id: v.voiceURI, label: `${v.name}${LANG[lang].strictRegion ? ` (${regionName(v.lang)})` : ""}${v.localService ? "" : " (online)"}` }))} />
              <button type="button" className="icon-btn" aria-label="Play a sample" onClick={() => void speak(SAMPLE[lang], lang)}><IconSpeaker /></button>
            </div>
            {LANG[lang].strictRegion && !voices.some((v) => v.lang.replace("_", "-") === LANG[lang].bcp) && (
              <p className="small">These voices are from {regionName(voices[0].lang)}, not Portugal. Download a Portugal voice (Joana or Catarina): on iPhone, Settings → Accessibility → Spoken Content → Voices → Portuguese (Portugal).</p>
            )}
            <Stepper label="Speed" value={prefs.rate[lang]} min={0.5} max={1.3} step={0.05} format={(v) => `${Math.round(v * 100)}%`}
              onChange={(v) => setPrefs({ rate: { ...prefs.rate, [lang]: v } })} />
            <p className="muted small">Better voices: on iPhone, Settings → Accessibility → Spoken Content → Voices; on Mac, System Settings → Accessibility → Spoken Content.</p>
          </>
        )}
    </section>
  );
}
