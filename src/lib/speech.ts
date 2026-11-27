/* Speech out: the device's own voices (Web Speech API: free, offline), or a Google Cloud voice where one is chosen
   and a Google key is on this device (src/lib/cloudTts.ts; falls back to the device voice when Google can't be reached).
   - One utterance at a time; speak() cancels whatever was playing.
   - Texts are spoken sentence by sentence (long utterances get cut off in some browsers), so the reader can
     highlight the line being read.
   - iOS only allows speech after a tap, so every call here starts from a user action; Google clips play through one
     <audio> element that the first tap unlocks, so they may start after the clip has been fetched. */
import { useEffect, useState } from "react";
import type { Lang } from "../types";
import { LANG, stripStress } from "./langs";
import { CLOUD_FIRST, listVoices, synth } from "./cloudTts";
import { getPrefs, setPrefs } from "./prefs";

export const canSpeak = () => typeof speechSynthesis !== "undefined";

function allVoices(): SpeechSynthesisVoice[] {
  return canSpeak() ? speechSynthesis.getVoices() : [];
}

/** Voices for a language, best first (enhanced / premium, then on-device). */
export function voicesFor(lang: Lang): SpeechSynthesisVoice[] {
  const code = LANG[lang].bcp.slice(0, 2);
  const score = (v: SpeechSynthesisVoice) =>
    (/premium/i.test(v.name) ? 4 : 0) + (/enhanced|siri/i.test(v.name + v.voiceURI) ? 2 : 0) + (v.localService ? 1 : 0) + (v.lang.replace("_", "-") === LANG[lang].bcp ? (LANG[lang].strictRegion ? 10 : 1) : 0);
  return allVoices().filter((v) => v.lang.toLowerCase().startsWith(code)).sort((a, b) => score(b) - score(a));
}

export function voiceFor(lang: Lang): SpeechSynthesisVoice | undefined {
  const list = voicesFor(lang);
  const chosen = getPrefs().voice[lang];
  return list.find((v) => v.voiceURI === chosen) ?? list[0];
}

/** Re-renders when the voice list arrives (it loads late on some browsers). */
export function useVoices(lang: Lang) {
  const [voices, setVoices] = useState(() => voicesFor(lang));
  useEffect(() => {
    if (!canSpeak()) return;
    const on = () => setVoices(voicesFor(lang));
    on();
    speechSynthesis.addEventListener("voiceschanged", on);
    return () => speechSynthesis.removeEventListener("voiceschanged", on);
  }, [lang]);
  return voices;
}

let session = 0;

// ── Google voices ─────────────────────────────────────────────

/** The Google voice to use for a language, if any. */
export function cloudVoiceFor(lang: Lang): string | undefined {
  const p = getPrefs();
  return p.googleKey && p.cloudVoice[lang] ? p.cloudVoice[lang] : undefined;
}

/** After a key is added: the languages without a natural device voice get Google's best one, unless I chose already. */
export async function pickCloudDefaults(key: string) {
  for (const lang of CLOUD_FIRST) {
    if (getPrefs().cloudVoice[lang] !== undefined) continue;
    const best = (await listVoices(lang, key).catch(() => []))[0];
    if (best) setPrefs({ cloudVoice: { ...getPrefs().cloudVoice, [lang]: best.name } });
  }
}

const SILENT = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=";
let audio: HTMLAudioElement | undefined;
const getAudio = () => (audio ??= new Audio());
/** iOS lets an <audio> element play later on its own once it has played inside a tap. */
if (typeof document !== "undefined" && typeof Audio !== "undefined") {
  const unlock = () => { const a = getAudio(); if (!a.src) { a.src = SILENT; void a.play().catch(() => {}); } };
  document.addEventListener("touchend", unlock, { once: true, capture: true });
  document.addEventListener("click", unlock, { once: true, capture: true });
}

const spoken = (text: string, lang: Lang) => (lang === "ru" ? stripStress(text) : text);

function sayCloud(text: string, lang: Lang, voice: string, mine: number, rate: number): Promise<boolean> {
  return synth(spoken(text, lang), lang, voice, getPrefs().googleKey!).then((mp3) => new Promise<boolean>((resolve) => {
    if (mine !== session) return resolve(false);
    const a = getAudio();
    const url = URL.createObjectURL(new Blob([mp3], { type: "audio/mpeg" }));
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true; a.onended = a.onerror = a.onpause = null; URL.revokeObjectURL(url); resolve(ok && mine === session);
    };
    a.onended = () => finish(true);
    a.onerror = () => finish(false);
    a.onpause = () => { if (mine !== session) finish(false); };
    a.src = url;
    a.playbackRate = rate;
    a.preservesPitch = true;
    a.play().catch(() => {
      // refused (no tap yet on iOS) or unplayable: the device voice instead
      if (done) return;
      done = true; a.onended = a.onerror = a.onpause = null; URL.revokeObjectURL(url);
      resolve(mine === session ? sayDevice(text, lang, mine, rate) : false);
    });
  }), () => (mine === session ? sayDevice(text, lang, mine, rate) : false));
}

// ── speaking ──────────────────────────────────────────────────

export function stopSpeaking() {
  session++;
  if (canSpeak()) speechSynthesis.cancel();
  audio?.pause();
}

/** Speak one text. Resolves when it ends (or is stopped: then `false`). */
export function speak(text: string, lang: Lang, opts: { rate?: number } = {}): Promise<boolean> {
  if (!text.trim() || (!canSpeak() && !cloudVoiceFor(lang))) return Promise.resolve(false);
  stopSpeaking();
  return say(text, lang, session, opts.rate);
}

function say(text: string, lang: Lang, mine: number, rate?: number): Promise<boolean> {
  const r = rate ?? getPrefs().rate[lang] ?? 1;
  const voice = cloudVoiceFor(lang);
  return voice ? sayCloud(text, lang, voice, mine, r) : sayDevice(text, lang, mine, r);
}

function sayDevice(text: string, lang: Lang, mine: number, rate: number): Promise<boolean> {
  if (!canSpeak()) return Promise.resolve(false);
  return new Promise((resolve) => {
    // Russian stress marks are for the eye; some voices pause on them
    const u = new SpeechSynthesisUtterance(spoken(text, lang));
    u.lang = LANG[lang].bcp;
    const v = voiceFor(lang);
    if (v) u.voice = v;
    u.rate = rate;
    let done = false;
    const finish = (ok: boolean) => { if (!done) { done = true; resolve(ok && mine === session); } };
    u.onend = () => finish(true);
    u.onerror = () => finish(false);
    speechSynthesis.speak(u);
    // Safari sometimes never fires onend: give up after a generous estimate.
    setTimeout(() => finish(true), 4000 + text.length * 260 / (u.rate || 1));
  });
}

/** Speak several lines in order; onLine(i) before each, onLine(-1) at the end. Returns a stop function.
    onBreak(i) when something else cuts in (any other speech, e.g. a tapped word) or line i can't be spoken:
    i is the line to go on from. Not called after the returned stop function.
    With a Google voice the next line is fetched while this one plays. */
export function speakLines(lines: string[], lang: Lang, onLine: (i: number) => void, opts: { from?: number; rate?: number; gapMs?: number; onBreak?: (i: number) => void } = {}): () => void {
  stopSpeaking();
  const mine = session;
  let stopped = false;
  const broke = (i: number) => { if (!stopped) opts.onBreak?.(i); };
  void (async () => {
    for (let i = opts.from ?? 0; i < lines.length; i++) {
      if (mine !== session) return broke(i);
      onLine(i);
      const voice = cloudVoiceFor(lang);
      if (voice && lines[i + 1]) void synth(spoken(lines[i + 1], lang), lang, voice, getPrefs().googleKey!).catch(() => {});
      const ok = await say(lines[i], lang, mine, opts.rate);
      if (!ok || mine !== session) return broke(i);
      if (opts.gapMs) await new Promise((r) => setTimeout(r, opts.gapMs));
    }
    if (!stopped) onLine(-1);
  })();
  return () => { stopped = true; if (mine === session) stopSpeaking(); };
}
