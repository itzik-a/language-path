/* Grammar lessons being written in Claude's batch queue (src/lib/claude.ts startLesson / checkLesson), on this device.
   A job is { batch id, language, started, error? } per topic in localStorage (the key that started it is this
   device's, so only this device collects it; the lesson itself is then saved and synced like any change).
   Checked when the app starts, when it comes back to the front, and every 30 s while a job waits and the app is
   visible. A finished lesson is saved with a toast; a failed one keeps its error for the topic page until the next try
   or Dismiss. */
import { topicById } from "../data/grammar";
import { getPrefs } from "../lib/prefs";
import { showToast } from "../lib/toast";
import type { Lang } from "../types";
import { saveLesson } from "./grammar";
import { getState } from "./store";

export interface LessonJob { batch: string; lang: Lang; at: number; error?: string }

const LS = "languagePath.lessonJobs";
const EVERY_MS = 30_000;

function load(): Record<string, LessonJob> {
  try { const x = JSON.parse(localStorage.getItem(LS) || "{}"); return x && typeof x === "object" ? x : {}; } catch { return {}; }
}
let jobs = load();
const listeners = new Set<() => void>();
function save(next: Record<string, LessonJob>) {
  jobs = next;
  localStorage.setItem(LS, JSON.stringify(jobs));
  listeners.forEach((l) => l());
  schedule();
}

export const lessonJob = (topic: string): LessonJob | undefined => jobs[topic];
export function subscribeJobs(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }
function without(topic: string) { const next = { ...jobs }; delete next[topic]; return next; }
const waiting = () => Object.values(jobs).some((j) => !j.error);

/** Hand the lesson to Claude (a rewrite too: the old lesson stays until the new one arrives). */
export async function startLesson(lang: Lang, topicId: string) {
  const topic = topicById(lang, topicId);
  if (!topic || (jobs[topicId] && !jobs[topicId].error)) return;
  const claude = await import("../lib/claude");
  const st = getState();
  const batch = await claude.startLesson(lang, topic, { level: st.settings.lang[lang].level, known: claude.knownList(st, lang, 300) });
  save({ ...jobs, [topicId]: { batch, lang, at: Date.now() } });
}

export async function cancelLesson(topicId: string) {
  const j = jobs[topicId];
  if (!j) return;
  save(without(topicId));
  if (!j.error) await (await import("../lib/claude")).cancelLesson(j.batch);
}

let checking = false;
/** Ask Claude about every waiting job; save what's done. */
export async function checkLessons() {
  if (checking || !waiting() || !getPrefs().claudeKey) return;
  checking = true;
  try {
    const claude = await import("../lib/claude");
    for (const [topicId, j] of Object.entries(jobs)) {
      if (j.error) continue;
      let r: Awaited<ReturnType<typeof claude.checkLesson>>;
      try { r = await claude.checkLesson(j.lang, j.batch); } catch { continue; } // offline or a hiccup: next time
      if (jobs[topicId]?.batch !== j.batch) continue; // canceled or restarted meanwhile
      const title = topicById(j.lang, topicId)?.title ?? "The lesson";
      if (r.state === "done") {
        saveLesson(j.lang, topicId, r.lesson, "claude-opus-5-5");
        save(without(topicId));
        showToast(`The lesson "${title}" is ready`);
      } else if (r.state === "failed") {
        save({ ...jobs, [topicId]: { ...j, error: r.error } });
        showToast(`The lesson "${title}" wasn't written: ${r.error}`);
      }
    }
  } finally { checking = false; }
}

let timer: ReturnType<typeof setTimeout> | undefined;
function schedule() {
  clearTimeout(timer);
  if (waiting() && typeof document !== "undefined" && document.visibilityState === "visible") timer = setTimeout(() => { void checkLessons().finally(schedule); }, EVERY_MS);
}

let started = false;
/** From main.tsx: check now, when the app comes back, and every 30 s while a lesson waits. */
export function startLessonJobs() {
  if (started) return;
  started = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void checkLessons().finally(schedule);
    else clearTimeout(timer);
  });
  void checkLessons().finally(schedule);
}
