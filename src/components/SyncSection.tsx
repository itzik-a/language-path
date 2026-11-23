/* Sync between devices (encrypted gist) and the encrypted backup file, as in finance-path. */
import { useRef, useState, type FormEvent } from "react";
import { buildBackup, importBackup, keyForPassphrase, openLocked, readBackup, saveBackup, type BackupInfo } from "../lib/backup";
import { WrongKey, type Envelope } from "../lib/crypto";
import { ago } from "../lib/dates";
import { getState } from "../state/store";
import { TOKEN_URL, changePassphrase, deviceKey, disconnect, hasGist, probe, syncNow, unlock, useSyncStatus, type SyncStatus } from "../state/sync";
import { IconExternal, IconLock } from "./Icons";

export const dotClass = (s: SyncStatus) => (s.kind === "ok" ? "ok" : s.kind === "busy" ? "busy" : s.kind === "pending" ? "pending" : s.kind === "error" || s.kind === "locked" ? "err" : "");

export function DataPill({ onOpen }: { onOpen: () => void }) {
  const s = useSyncStatus();
  return (
    <button type="button" className="sync" onClick={onOpen} aria-label={`Sync: ${s.text}. Open data and settings`}>
      <span className={`dot ${dotClass(s)}`} />
      <span role="status">{s.text}</span>
    </button>
  );
}

export function SyncSection() {
  const s = useSyncStatus();
  return (
    <section className="dlg-section" aria-labelledby="sync-title">
      <h3 id="sync-title">Sync between devices</h3>
      {s.kind === "off" ? <Connect /> : s.kind === "locked" ? <Unlock detail={s.detail} /> : <Connected />}
    </section>
  );
}

function Connect() {
  const [token, setToken] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!token.trim()) return;
    setBusy(true); setErr("");
    try { await probe(token); setToken(""); }
    catch (x) { setErr((x as Error).message); }
    finally { setBusy(false); }
  }
  return (
    <>
      <p className="muted small">
        Everything is saved on this device. To have it on your other devices too, connect each one to a private gist on your
        GitHub account. The data is encrypted with a passphrase before it leaves the device, so the gist only holds ciphertext.
      </p>
      <ol className="steps">
        <li>
          <b>Create a token on GitHub</b>
          <span className="muted small">
            The link opens the form with only the <code>gist</code> permission ticked. Choose an expiration, press <i>Generate token</i>,
            and copy it. The token you use for your other apps (Finance Path, Feed Path…) works too.
          </span>
          <a className="link" href={TOKEN_URL} target="_blank" rel="noopener">Open GitHub token page <IconExternal /></a>
        </li>
        <li>
          <b>Paste it here</b>
          <form className="token-form" onSubmit={submit}>
            <input type="password" autoComplete="off" autoCapitalize="off" spellCheck={false} placeholder="ghp_…" aria-label="GitHub token"
              value={token} onChange={(e) => setToken(e.target.value)} />
            <button className="btn primary" type="submit" disabled={busy || !token.trim()}>{busy ? "Checking…" : "Next"}</button>
          </form>
          {err && <p className="form-error" role="alert">{err}</p>}
        </li>
      </ol>
      <p className="muted small">The token stays on this device and can do nothing except read and write your gists.</p>
    </>
  );
}

function Unlock({ detail }: { detail?: string }) {
  const found = hasGist();
  const [pass, setPass] = useState("");
  const [again, setAgain] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const tooShort = pass.length > 0 && pass.length < 10;
  const mismatch = !found && again.length > 0 && again !== pass;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!pass || (!found && (pass.length < 10 || pass !== again))) return;
    setBusy(true); setErr("");
    try { await unlock(pass); setPass(""); setAgain(""); }
    catch (x) { setErr((x as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      <div className="sync-state">
        <IconLock width={18} height={18} />
        <div>
          <b>{found ? "Found your encrypted data" : "Choose a passphrase"}</b>
          <span className="muted small">
            {found ? "Enter the passphrase you chose on your first device." : "It encrypts your data before it goes to GitHub. Use the same one on every device."}
          </span>
        </div>
      </div>
      {detail && <p className="small">{detail}</p>}
      <input type="password" className="text-input" autoComplete={found ? "current-password" : "new-password"} placeholder="Passphrase" aria-label="Passphrase"
        value={pass} onChange={(e) => setPass(e.target.value)} />
      {!found && (
        <>
          <input type="password" className="text-input" autoComplete="new-password" placeholder="Same passphrase again" aria-label="Passphrase again"
            value={again} onChange={(e) => setAgain(e.target.value)} aria-invalid={mismatch || undefined} />
          <p className={`small ${tooShort || mismatch ? "form-error" : "muted"}`}>
            {mismatch ? "The two don't match." : "At least 10 characters; a few unrelated words is easiest to remember. Write it down: if it's lost, the gist can't be read (your devices keep their own copy)."}
          </p>
        </>
      )}
      {err && <p className="form-error" role="alert">{err}</p>}
      <button className="btn primary" type="submit" disabled={busy || !pass || (!found && (pass.length < 10 || pass !== again))}>
        {busy ? (found ? "Unlocking…" : "Encrypting…") : found ? "Unlock" : "Encrypt and sync"}
      </button>
      <button type="button" className="btn ghost" onClick={() => disconnect()}>Cancel</button>
    </form>
  );
}

function Connected() {
  const s = useSyncStatus();
  const [changing, setChanging] = useState(false);
  return (
    <>
      <div className="sync-state">
        <span className={`dot ${dotClass(s)}`} />
        <div>
          <b>{s.text}</b>
          <span className="muted small">Last synced {s.last ? ago(s.last) : "not yet"} · <IconLock /> encrypted</span>
        </div>
      </div>
      {s.detail && (s.kind === "error" || s.kind === "offline") && <p className="small">{s.detail}</p>}
      <div className="dlg-actions">
        <button type="button" className="btn primary" disabled={s.kind === "busy"} onClick={() => void syncNow(true)}>Sync now</button>
        <button type="button" className="btn ghost" onClick={() => setChanging((x) => !x)}>Change passphrase</button>
        {changing && <ChangePass onDone={() => setChanging(false)} />}
        <button type="button" className="btn ghost danger" onClick={() => { if (window.confirm("Stop syncing on this device? Everything stays here and in the gist.")) disconnect(); }}>
          Disconnect this device
        </button>
      </div>
    </>
  );
}

function ChangePass({ onDone }: { onDone: () => void }) {
  const [pass, setPass] = useState("");
  const [again, setAgain] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const ok = pass.length >= 10 && pass === again;
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!ok) return;
    setBusy(true); setErr("");
    try { await changePassphrase(pass); onDone(); }
    catch (x) { setErr((x as Error).message); }
    finally { setBusy(false); }
  }
  return (
    <form className="form-grid sub-form" onSubmit={submit}>
      <input type="password" className="text-input" autoComplete="new-password" placeholder="New passphrase (10+ characters)" aria-label="New passphrase" value={pass} onChange={(e) => setPass(e.target.value)} />
      <input type="password" className="text-input" autoComplete="new-password" placeholder="Again" aria-label="New passphrase again" value={again} onChange={(e) => setAgain(e.target.value)} />
      <p className="muted small">Your other devices will ask for the new one on their next sync.</p>
      {err && <p className="form-error" role="alert">{err}</p>}
      <button type="submit" className="btn primary" disabled={!ok || busy}>{busy ? "Encrypting…" : "Change passphrase"}</button>
    </form>
  );
}

export function BackupSection() {
  const s = useSyncStatus();
  const synced = s.kind !== "off" && s.kind !== "locked"; // this device holds the sync key
  const [note, setNote] = useState("");
  const [choosing, setChoosing] = useState(false); // export on a device without sync: choose a passphrase
  const [ready, setReady] = useState<File | null>(null); // sealed with that passphrase, waiting for a tap to save
  const [locked, setLocked] = useState<Envelope | null>(null); // import that needs its passphrase
  const file = useRef<HTMLInputElement>(null);

  const saved = (r: "shared" | "downloaded" | "cancelled", how: string) =>
    setNote(r === "cancelled" ? "" : `Encrypted backup ${r === "shared" ? "shared" : "downloaded"}. ${how}`);

  async function onExport() {
    setNote(""); setLocked(null);
    try {
      const k = await deviceKey();
      if (!k) { setChoosing(true); setReady(null); return; }
      saved(await saveBackup(await buildBackup(k)), "It opens with your sync passphrase (the one in use today).");
    } catch (x) { setNote((x as Error).message); }
  }

  function merge(b: BackupInfo) {
    const when = b.exportedAt ? new Date(b.exportedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "an unknown date";
    const old = b.encrypted ? "" : "\n\nThis backup isn't encrypted. Once it's merged, you can delete that file and export an encrypted one.";
    if (!window.confirm(`Merge the backup from ${when} into this device?\n\n${b.words} words, ${b.cards} cards, ${b.texts} texts.\nNothing here is removed; for anything in both, the newer edit is kept.${old}`)) return;
    const before = getState().words.filter((w) => !w.deletedAt).length;
    importBackup(b);
    const after = getState().words.filter((w) => !w.deletedAt).length;
    setNote(after > before ? `Backup merged: ${after - before} words added.` : "Backup merged.");
  }

  async function onFile(f?: File) {
    if (!f) return;
    setNote(""); setChoosing(false); setReady(null); setLocked(null);
    try {
      const r = await readBackup(f, await deviceKey());
      if ("locked" in r) setLocked(r.locked);
      else merge(r);
    } catch (x) {
      setNote((x as Error).message);
    } finally {
      if (file.current) file.current.value = "";
    }
  }

  return (
    <section className="dlg-section" aria-labelledby="bk-title">
      <h3 id="bk-title">Backup</h3>
      <p className="muted small">
        <IconLock /> An encrypted file with everything, to keep in Files or iCloud Drive.{" "}
        {synced ? "It opens with your sync passphrase." : "You choose a passphrase for it when you export."}
        {" "}Lose the passphrase and the file can't be opened.
      </p>
      <div className="dlg-actions row">
        <button type="button" className="btn" onClick={() => void onExport()}>Export backup</button>
        <button type="button" className="btn ghost" onClick={() => file.current?.click()}>Import backup</button>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
      </div>
      {choosing && !ready && <BackupPassphrase onSealed={(f) => setReady(f)} onCancel={() => setChoosing(false)} />}
      {ready && (
        <div className="form-grid sub-form">
          <p className="small"><IconLock /> Encrypted. Save the file somewhere private; it opens with the passphrase you just chose.</p>
          <button type="button" className="btn primary" onClick={() => void saveBackup(ready).then((r) => {
            if (r !== "cancelled") { setReady(null); setChoosing(false); }
            saved(r, "It opens with the passphrase you chose for it.");
          })}>Save backup file</button>
        </div>
      )}
      {locked && <OpenBackup env={locked} onOpened={(b) => { setLocked(null); merge(b); }} onCancel={() => setLocked(null)} />}
      {note && <p className="small" role="status">{note}</p>}
    </section>
  );
}

/** Choose a passphrase for a backup made on a device that doesn't sync. */
function BackupPassphrase({ onSealed, onCancel }: { onSealed: (f: File) => void; onCancel: () => void }) {
  const [pass, setPass] = useState("");
  const [again, setAgain] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const ok = pass.length >= 10 && pass === again;
  const mismatch = again.length > 0 && again !== pass;
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!ok) return;
    setBusy(true); setErr("");
    try { onSealed(await buildBackup(await keyForPassphrase(pass))); }
    catch (x) { setErr((x as Error).message); }
    finally { setBusy(false); }
  }
  return (
    <form className="form-grid sub-form" onSubmit={submit}>
      <b className="small">Choose a passphrase for this backup</b>
      <input type="password" className="text-input" autoComplete="new-password" placeholder="Passphrase (10+ characters)" aria-label="Backup passphrase" value={pass} onChange={(e) => setPass(e.target.value)} data-autofocus />
      <input type="password" className="text-input" autoComplete="new-password" placeholder="Same passphrase again" aria-label="Backup passphrase again" value={again} onChange={(e) => setAgain(e.target.value)} aria-invalid={mismatch || undefined} />
      <p className={`small ${mismatch ? "form-error" : "muted"}`}>{mismatch ? "The two don't match." : "Write it down: without it the backup can't be opened."}</p>
      {err && <p className="form-error" role="alert">{err}</p>}
      <button type="submit" className="btn primary" disabled={!ok || busy}>{busy ? "Encrypting…" : "Encrypt backup"}</button>
      <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
    </form>
  );
}

/** The passphrase for a backup this device's key doesn't open (made elsewhere, or before a passphrase change). */
function OpenBackup({ env, onOpened, onCancel }: { env: Envelope; onOpened: (b: BackupInfo) => void; onCancel: () => void }) {
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!pass) return;
    setBusy(true); setErr("");
    try { onOpened(await openLocked(env, pass)); }
    catch (x) { setErr(x instanceof WrongKey ? "That passphrase doesn't open this backup. Check it and try again." : (x as Error).message); }
    finally { setBusy(false); }
  }
  return (
    <form className="form-grid sub-form" onSubmit={submit}>
      <b className="small"><IconLock /> This backup is encrypted</b>
      <span className="muted small">Enter the passphrase it was made with: the sync passphrase at the time, or the one chosen for the backup.</span>
      <input type="password" className="text-input" autoComplete="current-password" placeholder="Passphrase" aria-label="Backup passphrase" value={pass} onChange={(e) => setPass(e.target.value)} />
      {err && <p className="form-error" role="alert">{err}</p>}
      <button type="submit" className="btn primary" disabled={!pass || busy}>{busy ? "Opening…" : "Open backup"}</button>
      <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
    </form>
  );
}
