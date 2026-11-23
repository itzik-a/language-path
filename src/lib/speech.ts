/* The device's own voices (Web Speech API): free, offline, good on iPhone and Mac.
   - One utterance at a time; speak() cancels whatever was playing.
   - Texts are spoken sentence by sentence (long utterances get cut off in some browsers), so the reader can
     highlight the line being read.
   - iOS only allows speech after a tap, so every call here starts from a user action. */
import { useEffect, useState } from "react";
import type { Lang } from "../types";
import { LANG } from "./langs";
import { getPrefs } from "./prefs";

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

export function stopSpeaking() {
  session++;
  if (canSpeak()) speechSynthesis.cancel();
}

/** Speak one text. Resolves when it ends (or is stopped: then `false`). */
export function speak(text: string, lang: Lang, opts: { rate?: number } = {}): Promise<boolean> {
  if (!canSpeak() || !text.trim()) return Promise.resolve(false);
  stopSpeaking();
  return say(text, lang, session, opts.rate);
}

function say(text: string, lang: Lang, mine: number, rate?: number): Promise<boolean> {
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = LANG[lang].bcp;
    const v = voiceFor(lang);
    if (v) u.voice = v;
    u.rate = rate ?? getPrefs().rate[lang] ?? 1;
    let done = false;
    const finish = (ok: boolean) => { if (!done) { done = true; resolve(ok && mine === session); } };
    u.onend = () => finish(true);
    u.onerror = () => finish(false);
    speechSynthesis.speak(u);
    // Safari sometimes never fires onend: give up after a generous estimate.
    setTimeout(() => finish(true), 4000 + text.length * 260 / (u.rate || 1));
  });
}

/** Speak several lines in order; onLine(i) before each, onLine(-1) at the end. Returns a stop function. */
export function speakLines(lines: string[], lang: Lang, onLine: (i: number) => void, opts: { from?: number; rate?: number; gapMs?: number } = {}): () => void {
  stopSpeaking();
  const mine = session;
  void (async () => {
    for (let i = opts.from ?? 0; i < lines.length; i++) {
      if (mine !== session) return;
      onLine(i);
      const ok = await say(lines[i], lang, mine, opts.rate);
      if (!ok || mine !== session) return;
      if (opts.gapMs) await new Promise((r) => setTimeout(r, opts.gapMs));
    }
    if (mine === session) onLine(-1);
  })();
  return () => { if (mine === session) stopSpeaking(); };
}
