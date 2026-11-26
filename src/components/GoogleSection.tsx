/* Settings → Google voices: the Google Cloud API key (this device only). Each language's Google voice is chosen in
   "Voice" above; Arabic, Greek and Portuguese switch to Google's best voice as soon as a key is saved. */
import { useState } from "react";
import { listVoices } from "../lib/cloudTts";
import { LANG } from "../lib/langs";
import { setPrefs, usePrefs } from "../lib/prefs";
import { pickCloudDefaults } from "../lib/speech";
import { IconExternal, IconLock } from "./Icons";

export function GoogleSection() {
  const p = usePrefs();
  const [key, setKey] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const test = async (k: string) => {
    setBusy(true); setNote("");
    try {
      const n = (await listVoices(p.lang, k)).length;
      await pickCloudDefaults(k);
      setNote(`Connected: ${n} Google voices for ${LANG[p.lang].name}.`);
    } catch (e) { setNote((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <section className="dlg-section" aria-labelledby="google-title">
      <h3 id="google-title">Google voices</h3>
      <p className="muted small">
        Google's most natural voices (Chirp 3 HD) for every language, including Arabic and Greek, which the iPhone and
        Chrome don't have good voices for. It uses your own Google Cloud API key, billed to your account after Google's
        monthly free allowance. The sentence being read is sent to Google; each clip is kept on this device, so a
        sentence is only paid for once.
      </p>
      {p.googleKey ? (
        <>
          <div className="sync-state"><IconLock width={18} height={18} /><div><b>Key saved on this device</b><span className="muted small">…{p.googleKey.slice(-4)} · choose each language's voice under Voice</span></div></div>
          <div className="dlg-actions row">
            <button type="button" className="btn" disabled={busy} onClick={() => void test(p.googleKey!)}>{busy ? "Testing…" : "Test"}</button>
            <button type="button" className="btn ghost danger" onClick={() => { setPrefs({ googleKey: undefined }); setNote(""); }}>Remove key</button>
          </div>
        </>
      ) : (
        <>
          <form className="token-form" onSubmit={(e) => { e.preventDefault(); const k = key.trim(); if (k) { setPrefs({ googleKey: k }); setKey(""); void test(k); } }}>
            <input type="password" autoComplete="off" autoCapitalize="off" spellCheck={false} placeholder="AIza…" aria-label="Google Cloud API key" value={key} onChange={(e) => setKey(e.target.value)} />
            <button className="btn primary" type="submit" disabled={!key.trim()}>Save</button>
          </form>
          <p className="muted small">
            In the Google Cloud console: turn on the Cloud Text-to-Speech API, then create an API key under Credentials
            and restrict it to that API and to the website itzik-a.github.io. The key stays on this device (not in the
            synced data).
          </p>
          <a className="link" href="https://console.cloud.google.com/apis/library/texttospeech.googleapis.com" target="_blank" rel="noopener">Cloud Text-to-Speech API <IconExternal /></a>
          <a className="link" href="https://cloud.google.com/text-to-speech/pricing" target="_blank" rel="noopener">Pricing and free allowance <IconExternal /></a>
        </>
      )}
      {note && <p className="small" role="status">{note}</p>}
    </section>
  );
}
