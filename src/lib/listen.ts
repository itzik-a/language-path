/* Speech recognition (the browser's own: Safari uses Siri's, Chrome Google's). Not every browser or Home Screen
   app has it; the keyboard's dictation key works everywhere as a fallback. */
import type { Lang } from "../types";
import { LANG } from "./langs";

interface Rec {
  lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
}
type RecCtor = new () => Rec;

const Ctor = (): RecCtor | undefined => {
  const w = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};

export const canListen = () => typeof window !== "undefined" && !!Ctor();

export interface Listening { stop: () => void; done: Promise<string> }

/** Listen once; onText gets the words so far. `done` resolves with the final text ("" if nothing was heard). */
export function listen(lang: Lang, onText: (t: string) => void): Listening {
  const C = Ctor();
  if (!C) throw new Error("Speech recognition isn't available here. Use the microphone on the keyboard instead.");
  const r = new C();
  r.lang = LANG[lang].bcp;
  r.interimResults = true;
  r.continuous = false;
  r.maxAlternatives = 1;
  let text = "";
  const done = new Promise<string>((resolve, reject) => {
    r.onresult = (e) => {
      text = Array.from(e.results).map((x) => x[0].transcript).join("");
      onText(text);
    };
    r.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") resolve(text);
      else reject(new Error(e.error === "not-allowed" ? "The microphone isn't allowed for this app." : `Speech recognition stopped (${e.error}).`));
    };
    r.onend = () => resolve(text);
  });
  r.start();
  return { stop: () => r.stop(), done };
}
