/* Settings that belong to this device only (not synced): the active language, voices and speed (voices differ
   per device), the Claude key and model, and a random device id (for per-device day logs). */
import { useSyncExternalStore } from "react";
import type { Lang } from "../types";

export type Model = "claude-opus-5-5" | "claude-sonnet-5-5" | "claude-haiku-5-5";

export interface Prefs {
  lang: Lang;
  /** voiceURI per language */
  voice: Partial<Record<Lang, string>>;
  /** speech rate per language (1 = normal) */
  rate: Record<Lang, number>;
  device: string;
  claudeKey?: string;
  model: Model;
  /** reader: show the translation under each line */
  showTr: boolean;
}

const LS = "languagePath.device";

function load(): Prefs {
  let x: Partial<Prefs> = {};
  try { x = JSON.parse(localStorage.getItem(LS) || "{}"); } catch { /* fresh */ }
  return {
    lang: x.lang === "pl" || x.lang === "ar" ? x.lang : "ja",
    voice: x.voice ?? {},
    rate: { ja: 0.9, pl: 0.9, ar: 0.85, ...x.rate },
    device: x.device || Math.random().toString(36).slice(2, 10),
    claudeKey: x.claudeKey,
    model: x.model ?? "claude-opus-5-5",
    showTr: x.showTr ?? false,
  };
}

let prefs = load();
const listeners = new Set<() => void>();
localStorage.setItem(LS, JSON.stringify(prefs));

export const getPrefs = () => prefs;
export function setPrefs(p: Partial<Prefs>) {
  prefs = { ...prefs, ...p };
  localStorage.setItem(LS, JSON.stringify(prefs));
  listeners.forEach((l) => l());
}
export const usePrefs = () => useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => prefs);
export const useLang = () => usePrefs().lang;

window.addEventListener("storage", (e) => { if (e.key === LS) { prefs = load(); listeners.forEach((l) => l()); } });

export const hasClaude = () => !!prefs.claudeKey;

export const MODELS: { id: Model; label: string; note: string }[] = [
  { id: "claude-opus-5-5", label: "Claude Opus 5.5", note: "best quality (default)" },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5", note: "faster, cheaper" },
  { id: "claude-haiku-5-5", label: "Claude Haiku 5.5", note: "fastest, cheapest" },
];
