/* Cross-device sync through one private GitHub Gist (same pattern as piano-path, workout-path and feed-path),
   with the file encrypted (src/lib/crypto.ts): the gist only ever holds ciphertext.

   - The token (classic, `gist` scope only) is pasted once per device; the passphrase is typed once per device
     and turned into a key. Both stay in localStorage key `languagePath.gist` (the token and the derived key,
     never the passphrase). Neither is ever in the code or the repo.
   - Connecting is two steps: probe(token) finds the gist by filename (or not); then unlock(passphrase) opens
     it (or creates it, encrypted with a new random salt).
   - Each sync: read the gist, decrypt, merge with local (src/lib/merge.ts), encrypt and write back if anything changed.
   - Runs on start, after a local change (2 s after the first, then at most once a minute while editing), when the app
     comes back into view, when the network returns, and every 2 minutes while visible. Reads send the last ETag,
     so an unchanged gist answers 304, which doesn't count toward GitHub's hourly limit. */
import { useSyncExternalStore } from "react";
import { cryptoReady, decrypt, deriveKey, encrypt, importKey, ITERATIONS, newSalt, readEnvelope, WrongKey } from "../lib/crypto";
import { merge, serialize } from "../lib/merge";
import { getState, normalize, onLocalChange, replaceState, type AppState } from "./store";

const CFG_KEY = "languagePath.gist";
const FILE = "language-path.json";
const DESC = "Language Path data (encrypted)";
const API = "https://api.github.com";

export const TOKEN_URL =
  "https://github.com/settings/tokens/new?scopes=gist&description=" + encodeURIComponent("Language Path");

interface Cfg { token: string; gistId?: string; key?: string; salt?: string; iter?: number }

export interface SyncStatus {
  kind: "off" | "busy" | "pending" | "ok" | "error" | "offline" | "locked";
  /** short, for the pill */
  text: string;
  /** what went wrong, in full (shown in the Data & settings sheet) */
  detail?: string;
  /** automatic syncs wait until then (GitHub asked us to back off) */
  retryAt?: number;
  last?: number;
  gistId?: string;
  quota?: { remaining: number; limit: number; reset: number };
}

// ── status store ──────────────────────────────────────────────

let cfg: Cfg | null = loadCfg();
let key: CryptoKey | null = null;
let status: SyncStatus = !cfg ? { kind: "off", text: "On this device" }
  : !cfg.key ? { kind: "locked", text: "Passphrase needed" }
  : { kind: "busy", text: "Connecting…" };
const listeners = new Set<() => void>();

function setStatus(s: Partial<SyncStatus>) {
  status = { ...status, ...s, gistId: cfg?.gistId };
  listeners.forEach((l) => l());
}

export function useSyncStatus() {
  return useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => status);
}

function loadCfg(): Cfg | null {
  try {
    const c = JSON.parse(localStorage.getItem(CFG_KEY) || "null");
    return c && typeof c.token === "string" ? c : null;
  } catch { return null; }
}

function saveCfg() {
  if (cfg) localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
  else localStorage.removeItem(CFG_KEY);
}

async function getKey(): Promise<CryptoKey> {
  if (!key) key = await importKey(cfg!.key!);
  return key;
}

// ── GitHub API ────────────────────────────────────────────────

class HttpError extends Error {
  status: number;
  ghMessage: string;
  headers: Headers;
  constructor(status: number, ghMessage: string, headers: Headers) {
    super(`GitHub ${status}: ${ghMessage}`);
    this.status = status; this.ghMessage = ghMessage; this.headers = headers;
  }
}

/** The gist's file isn't what we expect (not encrypted by this app, or encrypted with another passphrase). */
class Locked extends Error {}

const num = (h: Headers, name: string) => { const v = h.get(name); return v == null || v === "" ? null : Number(v); };

function noteQuota(h: Headers) {
  const remaining = num(h, "x-ratelimit-remaining"), limit = num(h, "x-ratelimit-limit"), reset = num(h, "x-ratelimit-reset");
  if (remaining != null && limit != null && reset != null) status = { ...status, quota: { remaining, limit, reset: reset * 1000 } };
}

async function ghFetch(path: string, init: RequestInit = {}, extra: Record<string, string> = {}, token = cfg!.token): Promise<Response> {
  const res = await fetch(API + path, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...extra,
    },
  });
  noteQuota(res.headers);
  if (!res.ok && res.status !== 304) {
    let msg = res.statusText;
    try { msg = (await res.json()).message || msg; } catch { /* not JSON */ }
    throw new HttpError(res.status, msg, res.headers);
  }
  return res;
}

const gh = async <T,>(path: string, init: RequestInit = {}, token?: string): Promise<T> => (await ghFetch(path, init, {}, token)).json() as Promise<T>;

interface GistFile { content?: string; truncated?: boolean; raw_url?: string }
interface Gist { id: string; files: Record<string, GistFile | undefined> }

/** The gist holding FILE, found by filename (so every device finds the same one). */
async function findGist(token: string): Promise<string | undefined> {
  for (let page = 1; page <= 10; page++) {
    const list = await gh<Gist[]>(`/gists?per_page=100&page=${page}`, {}, token);
    const hit = list.find((g) => g.files[FILE]);
    if (hit) return hit.id;
    if (list.length < 100) break;
  }
  return undefined;
}

async function fileText(f: GistFile): Promise<string> {
  if (f.truncated && f.raw_url) return (await fetch(f.raw_url, { cache: "no-store" })).text();
  return f.content ?? "";
}

/** The gist as last read or written: its ETag and our file's *plain* text (after decrypting). */
let lastRead: { gistId: string; etag: string; text: string } | null = null;

async function readRemote(): Promise<AppState | null> {
  const gistId = cfg!.gistId!;
  const known = lastRead?.gistId === gistId ? lastRead : null;
  const res = await ghFetch(`/gists/${gistId}`, {}, known ? { "If-None-Match": known.etag } : {});
  let text: string;
  if (res.status === 304 && known) {
    text = known.text;
  } else {
    const g = (await res.json()) as Gist;
    const f = g.files[FILE];
    if (!f) { lastRead = null; return null; }
    const env = readEnvelope(await fileText(f));
    if (!env) throw new Locked("The file in the gist isn't Language Path's encrypted data.");
    if (env.salt !== cfg!.salt) throw new Locked("The data in the gist was encrypted with another passphrase (it was changed on another device). Enter the passphrase again.");
    text = await decrypt(await getKey(), env);
    const etag = res.headers.get("etag");
    lastRead = etag ? { gistId, etag, text } : null;
  }
  try { return normalize(JSON.parse(text)); } catch { return null; }
}

async function writeRemote(s: AppState) {
  const gistId = cfg!.gistId!;
  const text = serialize(s);
  const env = await encrypt(await getKey(), cfg!.salt!, cfg!.iter ?? ITERATIONS, text);
  const res = await ghFetch(`/gists/${gistId}`, { method: "PATCH", body: JSON.stringify({ files: { [FILE]: { content: JSON.stringify(env) } } }) });
  const etag = res.headers.get("etag");
  lastRead = etag ? { gistId, etag, text } : null;
}

// ── sync loop ─────────────────────────────────────────────────

let chain: Promise<void> = Promise.resolve();
let dirty = false;
let debounce: ReturnType<typeof setTimeout> | undefined;
const PUSH_GAP_MS = 60_000;
let lastPush = 0;
let slowDowns = 0;

const hhmm = (t: number) => new Date(t).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

export function syncNow(manual = false): Promise<void> {
  const run = () => doSync(manual);
  chain = chain.then(run, run);
  return chain;
}

function explain(e: HttpError): Pick<SyncStatus, "text" | "detail" | "retryAt"> {
  const said = `GitHub says: "${e.ghMessage}".`;
  const h = e.headers;
  const remaining = num(h, "x-ratelimit-remaining");
  const reset = num(h, "x-ratelimit-reset");
  const retryAfter = num(h, "retry-after");
  const scopes = h.get("x-oauth-scopes");
  if (e.status === 401) {
    return { text: "Sync token rejected", detail: `${said} The token may have expired or been revoked. Disconnect, then connect again with a new token.` };
  }
  if ((e.status === 403 || e.status === 429) && remaining === 0 && reset) {
    const at = reset * 1000;
    return {
      text: `GitHub limit hit · back at ${hhmm(at)}`,
      detail: `${said} This hour's GitHub requests are used up. They're shared by every app using your GitHub account (your other apps too). Sync starts again by itself at ${hhmm(at)}; everything is saved on this device meanwhile.`,
      retryAt: at,
    };
  }
  if (e.status === 429 || (e.status === 403 && (retryAfter != null || /rate limit|abuse/i.test(e.ghMessage)))) {
    const wait = retryAfter != null ? retryAfter * 1000 : Math.min(15, 2 ** slowDowns) * 60_000;
    if (retryAfter == null) slowDowns++;
    const at = Date.now() + wait;
    return {
      text: `GitHub asked to slow down · retry at ${hhmm(at)}`,
      detail: `${said} This is GitHub's short-term limit on how often an account can write, not the hourly one. Sync tries again at ${hhmm(at)}; everything is saved on this device meanwhile.`,
      retryAt: at,
    };
  }
  if (e.status === 403 && scopes != null && !scopes.split(",").map((x) => x.trim()).includes("gist")) {
    return { text: "Token can't use gists", detail: `${said} This token's permissions are: ${scopes || "none"}. Make a classic token with the gist scope, then disconnect and connect again with it.` };
  }
  if (e.status >= 500) return { text: `GitHub is having trouble (${e.status})`, detail: `${said} Sync tries again in a couple of minutes.` };
  return { text: `Sync failed (${e.status})`, detail: said };
}

async function doSync(manual = false) {
  if (!cfg?.key || !cfg.gistId) return;
  if (!manual && status.retryAt && Date.now() < status.retryAt) { schedule(status.retryAt - Date.now() + 1000); return; }
  if (!navigator.onLine) { setStatus({ kind: "offline", text: "Offline · saved here" }); return; }
  setStatus({ kind: "busy", text: "Syncing…" });
  const wasDirty = dirty;
  dirty = false;
  try {
    let remote: AppState | null;
    try {
      remote = await readRemote();
    } catch (e) {
      if (e instanceof HttpError && e.status === 404) { // the gist was deleted: start a new one with this device's data
        cfg.gistId = await createGist(); saveCfg();
        remote = await readRemote();
      } else throw e;
    }
    const local = getState();
    const merged = remote ? merge(local, remote) : local;
    if (serialize(merged) !== serialize(local)) replaceState(merged);
    const now = getState();
    if (!remote || serialize(now) !== serialize(remote)) { await writeRemote(now); lastPush = Date.now(); }
    slowDowns = 0;
    setStatus({ kind: "ok", text: "Synced", detail: undefined, retryAt: undefined, last: Date.now() });
  } catch (e) {
    if (wasDirty) dirty = true;
    if (e instanceof Locked || e instanceof WrongKey) {
      if (cfg) { delete cfg.key; key = null; saveCfg(); }
      setStatus({ kind: "locked", text: "Passphrase needed", detail: e instanceof WrongKey ? "The saved key no longer opens the data in the gist. Enter the passphrase again." : e.message, retryAt: undefined });
    } else if (e instanceof HttpError) {
      console.warn("[sync]", e.message);
      const x = explain(e);
      setStatus({ kind: "error", detail: undefined, retryAt: undefined, ...x });
      if (x.retryAt) schedule(x.retryAt - Date.now() + 1000);
    } else {
      console.warn("[sync]", e);
      setStatus({ kind: "offline", text: "Can't reach GitHub · saved here", retryAt: undefined, detail: "Couldn't reach api.github.com (offline, or the connection dropped). Changes are saved on this device and sync when it's reachable again." });
    }
  }
}

function schedule(ms: number) {
  clearTimeout(debounce);
  debounce = setTimeout(() => { void syncNow(); }, ms);
}

let started = false;
export function startSync() {
  if (started) return;
  started = true;

  onLocalChange(() => {
    if (!cfg?.key) return;
    dirty = true;
    if (status.retryAt && Date.now() < status.retryAt) { schedule(status.retryAt - Date.now() + 1000); return; }
    setStatus({ kind: "pending", text: "Saved here · syncing soon" });
    schedule(Math.max(2000, lastPush + PUSH_GAP_MS - Date.now()));
  });

  document.addEventListener("visibilitychange", () => {
    if (!cfg?.key) return;
    if (document.visibilityState === "hidden") {
      if (dirty) { clearTimeout(debounce); void syncNow(); }
    } else if (dirty || !status.last || Date.now() - status.last > 10_000) {
      void syncNow();
    }
  });
  window.addEventListener("online", () => { if (cfg?.key) void syncNow(); });
  setInterval(() => {
    if (cfg?.key && document.visibilityState === "visible" && status.kind !== "busy") void syncNow();
  }, 120_000);

  if (cfg?.key) void syncNow();
}

// ── connecting ────────────────────────────────────────────────

async function createGist(): Promise<string> {
  const env = await encrypt(await getKey(), cfg!.salt!, cfg!.iter ?? ITERATIONS, serialize(getState()));
  const g = await gh<Gist>("/gists", { method: "POST", body: JSON.stringify({ description: DESC, public: false, files: { [FILE]: { content: JSON.stringify(env) } } }) });
  return g.id;
}

const tokenError = (e: unknown) =>
  e instanceof HttpError && e.status === 401 ? new Error("GitHub didn't accept that token. Check it was copied in full and has the gist scope.")
  : e instanceof HttpError ? new Error(explain(e).detail ?? e.message)
  : new Error("Couldn't reach GitHub. Check the connection and try again.");

/** Step 1: check the token and look for the gist. `found`: there is encrypted data already (another device). */
export async function probe(token: string): Promise<{ found: boolean }> {
  if (!cryptoReady()) throw new Error("Encryption isn't available on this page. Open the app from its https address (not the local network one).");
  const t = token.trim();
  let gistId: string | undefined;
  try { gistId = await findGist(t); } catch (e) { throw tokenError(e); }
  cfg = { token: t, gistId };
  saveCfg();
  setStatus({ kind: "locked", text: "Passphrase needed", detail: undefined });
  return { found: !!gistId };
}

/** Step 2: open the gist with the passphrase (or create it, encrypted with it). Resolves after the first sync. */
export async function unlock(passphrase: string) {
  if (!cfg) throw new Error("Connect with a token first.");
  // Status stays "locked" until the key works, so the passphrase form (and its error) stays on screen.
  try {
    if (cfg.gistId) {
      const g = await gh<Gist>(`/gists/${cfg.gistId}`);
      const f = g.files[FILE];
      const env = f ? readEnvelope(await fileText(f)) : null;
      if (!env) throw new Error("The gist's file isn't Language Path's encrypted data.");
      const d = await deriveKey(passphrase, env.salt, env.iter);
      await decrypt(d.key, env); // throws WrongKey
      cfg.key = d.raw; cfg.salt = env.salt; cfg.iter = env.iter; key = d.key;
      saveCfg();
    } else {
      const salt = newSalt();
      const d = await deriveKey(passphrase, salt);
      cfg.key = d.raw; cfg.salt = salt; cfg.iter = ITERATIONS; key = d.key;
      cfg.gistId = await createGist();
      saveCfg();
    }
  } catch (e) {
    if (e instanceof WrongKey) throw new Error("That passphrase doesn't open your data. Check it and try again.");
    if (e instanceof HttpError) throw tokenError(e);
    throw e;
  }
  lastRead = null;
  await syncNow(true);
}

/** Encrypt everything again with a new passphrase (new salt). Other devices will ask for it on their next sync. */
export async function changePassphrase(passphrase: string) {
  if (!cfg?.key || !cfg.gistId) throw new Error("Not connected.");
  await syncNow(true); // bring in what the gist has first
  const salt = newSalt();
  const d = await deriveKey(passphrase, salt);
  cfg.key = d.raw; cfg.salt = salt; cfg.iter = ITERATIONS; key = d.key;
  saveCfg();
  await writeRemote(getState());
  setStatus({ kind: "ok", text: "Synced", last: Date.now(), detail: undefined });
}

export function disconnect() {
  cfg = null;
  key = null;
  lastRead = null;
  saveCfg();
  clearTimeout(debounce);
  dirty = false;
  setStatus({ kind: "off", text: "On this device", last: undefined, detail: undefined, retryAt: undefined, quota: undefined });
}

/** This device's sync key, salt and rounds (for sealing backups), or null when it isn't unlocked. */
export async function deviceKey(): Promise<{ key: CryptoKey; salt: string; iter: number } | null> {
  if (!cfg?.key || !cfg.salt) return null;
  return { key: await getKey(), salt: cfg.salt, iter: cfg.iter ?? ITERATIONS };
}

export const hasToken = () => !!cfg;
export const hasGist = () => !!cfg?.gistId;
