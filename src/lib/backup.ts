/* Backup to a file and back. Import merges (src/lib/merge.ts): nothing on this device is removed.
   The file is always encrypted: it's the same Envelope as the gist file (src/lib/crypto.ts), sealed either with this
   device's sync key (so it opens with the sync passphrase in use when it was made) or, on a device that doesn't sync,
   with a passphrase chosen for the backup. Plain-JSON backups import too. */
import { getState, normalize, replaceState, type AppState } from "../state/store";
import { decrypt, deriveKey, encrypt, ITERATIONS, newSalt, readEnvelope, WrongKey, type Envelope } from "./crypto";
import { today } from "./dates";
import { merge, serialize } from "./merge";

export const backupName = () => `language-path-backup-${today()}.json`;

/** A key to seal a backup with, and the salt + rounds that let its passphrase make the key again. */
export interface BackupKey { key: CryptoKey; salt: string; iter: number }

/** A key for a passphrase chosen just for backups (new random salt). */
export async function keyForPassphrase(passphrase: string): Promise<BackupKey> {
  const salt = newSalt();
  const { key } = await deriveKey(passphrase, salt, ITERATIONS);
  return { key, salt, iter: ITERATIONS };
}

/** The encrypted backup file. */
export async function buildBackup(k: BackupKey): Promise<File> {
  const text = serialize({ app: "language-path", exportedAt: new Date().toISOString(), ...getState() });
  const env = await encrypt(k.key, k.salt, k.iter, text);
  return new File([JSON.stringify(env)], backupName(), { type: "application/json" });
}

/** Save the file: the share sheet on a touch device (Save to Files), a download elsewhere. */
export async function saveBackup(file: File): Promise<"shared" | "downloaded" | "cancelled"> {
  const touch = window.matchMedia("(pointer: coarse)").matches;
  if (touch && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return "shared"; }
    catch (e) { if ((e as Error).name === "AbortError") return "cancelled"; }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return "downloaded";
}

export interface BackupInfo { state: AppState; exportedAt?: string; words: number; cards: number; texts: number; encrypted: boolean }

const NOT_OURS = "That file isn't a Language Path backup.";

function toInfo(text: string, encrypted: boolean): BackupInfo {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new Error(NOT_OURS); }
  const x = raw as Record<string, unknown> | null;
  if (!x || typeof x !== "object" || !Array.isArray(x.words) || !Array.isArray(x.cards)) throw new Error(NOT_OURS);
  const state = normalize(x);
  return {
    state,
    exportedAt: typeof x.exportedAt === "string" ? x.exportedAt : undefined,
    words: state.words.filter((w) => !w.deletedAt).length,
    cards: state.cards.filter((c) => !c.deletedAt).length,
    texts: state.texts.filter((t) => !t.deletedAt).length,
    encrypted,
  };
}

/** Read a backup file. An encrypted one opens with `device` (this device's sync key) when it was sealed with it;
    otherwise the result is `{ locked }` and `openLocked()` needs its passphrase. */
export async function readBackup(file: File, device: BackupKey | null): Promise<BackupInfo | { locked: Envelope }> {
  const text = await file.text();
  const env = readEnvelope(text);
  if (env) {
    if (device && env.salt === device.salt) {
      try { return toInfo(await decrypt(device.key, env), true); } catch (e) { if (!(e instanceof WrongKey)) throw e; }
    }
    return { locked: env };
  }
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new Error("That file isn't a Language Path backup (it isn't JSON)."); }
  if ((raw as { app?: unknown } | null)?.app !== "language-path") throw new Error(NOT_OURS);
  return toInfo(text, false);
}

/** Open an encrypted backup with its passphrase. Throws WrongKey if it doesn't fit. */
export async function openLocked(env: Envelope, passphrase: string): Promise<BackupInfo> {
  const { key } = await deriveKey(passphrase, env.salt, env.iter);
  return toInfo(await decrypt(key, env), true);
}

/** Merge a backup into this device; it syncs out like any local change. */
export function importBackup(b: BackupInfo) {
  replaceState(merge(getState(), b.state), { local: true });
}
