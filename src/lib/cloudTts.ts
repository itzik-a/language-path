/* Google Cloud Text-to-Speech: Google's most natural voices (Chirp 3 HD where a language has them, else Studio /
   Neural2 / WaveNet), with my own Google Cloud API key on this device. It covers what the device lacks: iPhone has
   no Google voices at all, and Chrome's built-in ones leave out Arabic, Greek and European Portuguese.
   - Clips are cached in IndexedDB (db "languagePath-tts", not synced), so each sentence is synthesised once.
   - Only the text being spoken leaves the device. */
import { openDB, type IDBPDatabase } from "idb";
import type { Lang } from "../types";
import { LANG } from "./langs";

const API = "https://texttospeech.googleapis.com/v1";

/** Languages whose device / Chrome voices have no natural option: Google voices are switched on for them
    as soon as a key is added. */
export const CLOUD_FIRST: Lang[] = ["ar", "el", "pt"];

/** Google's language code: Arabic is "ar-XA" (Modern Standard Arabic); the rest match the app's. */
export const cloudLang = (lang: Lang) => (lang === "ar" ? "ar-XA" : LANG[lang].bcp);

export interface CloudVoice { name: string; label: string; kind: string; rank: number; gender: string }
interface RawVoice { name: string; languageCodes: string[]; ssmlGender?: string }

const KINDS: [RegExp, string, number][] = [
  [/Chirp3-HD/, "Chirp 3 HD", 5], [/Chirp-HD/, "Chirp HD", 4], [/Studio/, "Studio", 3], [/Neural2/, "Neural2", 3],
  [/Wavenet/, "WaveNet", 2], [/Polyglot|News/, "News", 1],
];

/** The voices of one language, most natural first: Chirp 3 HD › Studio / Neural2 › WaveNet › Standard. */
export function rankVoices(raw: RawVoice[], code: string): CloudVoice[] {
  return raw.filter((v) => v.languageCodes.includes(code)).map((v) => {
    const [, kind, rank] = KINDS.find(([re]) => re.test(v.name)) ?? [null, "Standard", 0];
    const short = rank === 5 ? v.name.split("-").pop()! : v.name.split("-").slice(2).join(" ");
    const gender = (v.ssmlGender ?? "").toLowerCase().replace("neutral", "");
    return { name: v.name, kind, rank, gender, label: `${short} · ${kind}${gender ? `, ${gender}` : ""}` };
  }).sort((a, b) => b.rank - a.rank || (a.gender === "female" ? -1 : 0) - (b.gender === "female" ? -1 : 0) || a.name.localeCompare(b.name));
}

let fetchImpl: typeof fetch = (...a) => fetch(...a);
export const setFetchForTests = (f: typeof fetch) => { fetchImpl = f; };

async function call(path: string, key: string, body?: unknown) {
  const res = await fetchImpl(`${API}/${path}${path.includes("?") ? "&" : "?"}key=${encodeURIComponent(key)}`, body
    ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    : undefined);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `Google answered ${res.status}`);
  return data;
}

const listed = new Map<string, Promise<CloudVoice[]>>();
export function listVoices(lang: Lang, key: string): Promise<CloudVoice[]> {
  const code = cloudLang(lang);
  const k = `${key}|${code}`;
  if (!listed.has(k)) {
    const p = call(`voices?languageCode=${code}`, key).then((d) => rankVoices(d.voices ?? [], code));
    p.catch(() => listed.delete(k));
    listed.set(k, p);
  }
  return listed.get(k)!;
}

// ── clip cache ────────────────────────────────────────────────

const MAX_CLIPS = 3000;
let db: Promise<IDBPDatabase> | undefined;
const getDb = () => (db ??= openDB("languagePath-tts", 1, {
  upgrade(d) { d.createObjectStore("clips", { keyPath: "k" }).createIndex("at", "at"); },
}));

async function prune(d: IDBPDatabase) {
  if ((await d.count("clips")) <= MAX_CLIPS) return;
  const tx = d.transaction("clips", "readwrite");
  let cur = await tx.store.index("at").openCursor();
  for (let n = 0; cur && n < 500; n++) { await cur.delete(); cur = await cur.continue(); }
  await tx.done;
}

const inflight = new Map<string, Promise<ArrayBuffer>>();

/** MP3 of one text in one voice, from the cache or from Google. */
export function synth(text: string, lang: Lang, voice: string, key: string): Promise<ArrayBuffer> {
  const k = `${voice}|${text}`;
  if (inflight.has(k)) return inflight.get(k)!;
  const p = (async () => {
    const d = await getDb().catch(() => undefined);
    const hit = await d?.get("clips", k).catch(() => undefined);
    if (hit) return hit.mp3 as ArrayBuffer;
    const r = await call("text:synthesize", key, {
      input: { text }, voice: { languageCode: cloudLang(lang), name: voice }, audioConfig: { audioEncoding: "MP3" },
    });
    const bin = atob(r.audioContent ?? "");
    const mp3 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) mp3[i] = bin.charCodeAt(i);
    if (d) { await d.put("clips", { k, mp3: mp3.buffer, at: Date.now() }).catch(() => {}); void prune(d).catch(() => {}); }
    return mp3.buffer;
  })();
  inflight.set(k, p);
  void p.finally(() => inflight.delete(k)).catch(() => {});
  return p;
}
