/* Settings → Claude: the API key (this device only) and the model. */
import { useState } from "react";
import { MODELS } from "../lib/prefs";
import { setPrefs, usePrefs } from "../lib/prefs";
import type { Model } from "../lib/prefs";
import { IconExternal, IconLock } from "./Icons";
import { Select } from "./ui";

export function ClaudeSection() {
  const p = usePrefs();
  const [key, setKey] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const test = async () => {
    setBusy(true); setNote("");
    try { await (await import("../lib/claude")).testKey(); setNote("Connected: Claude answered."); } catch (e) { setNote((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <section className="dlg-section" aria-labelledby="claude-title">
      <h3 id="claude-title">Claude</h3>
      <p className="muted small">Claude writes stories at your level, annotates texts you paste, explains words and is your conversation partner. It uses your own Anthropic API key, billed to your account.</p>
      {p.claudeKey ? (
        <>
          <div className="sync-state"><IconLock width={18} height={18} /><div><b>Key saved on this device</b><span className="muted small">…{p.claudeKey.slice(-4)} · requests go straight to Anthropic</span></div></div>
          <label className="field"><span className="field-label">Model</span>
            <Select<Model> label="Model" value={p.model} onChange={(m) => setPrefs({ model: m })} options={MODELS.map((m) => ({ id: m.id, label: `${m.label}: ${m.note}` }))} />
          </label>
          <div className="dlg-actions row">
            <button type="button" className="btn" disabled={busy} onClick={() => void test()}>{busy ? "Testing…" : "Test"}</button>
            <button type="button" className="btn ghost danger" onClick={() => { setPrefs({ claudeKey: undefined }); setNote(""); }}>Remove key</button>
          </div>
        </>
      ) : (
        <>
          <form className="token-form" onSubmit={(e) => { e.preventDefault(); if (key.trim()) { setPrefs({ claudeKey: key.trim() }); setKey(""); void test(); } }}>
            <input type="password" autoComplete="off" autoCapitalize="off" spellCheck={false} placeholder="sk-ant-…" aria-label="Anthropic API key" value={key} onChange={(e) => setKey(e.target.value)} />
            <button className="btn primary" type="submit" disabled={!key.trim()}>Save</button>
          </form>
          <a className="link" href="https://platform.claude.com/settings/keys" target="_blank" rel="noopener">Get a key in the Claude Console <IconExternal /></a>
          <p className="muted small">The key stays on this device (not in the synced data). Add it on each device you use.</p>
        </>
      )}
      {note && <p className="small" role="status">{note}</p>}
    </section>
  );
}
