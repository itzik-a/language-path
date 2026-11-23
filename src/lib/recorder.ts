/* Record my voice for shadowing (MediaRecorder). Nothing is kept: the recording lives in memory until the next one. */
export const canRecord = () => typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";

export interface Recording { stop: () => Promise<string | null> }

let stream: MediaStream | null = null;
let lastUrl: string | null = null;

export async function record(): Promise<Recording> {
  stream ??= await navigator.mediaDevices.getUserMedia({ audio: true });
  const rec = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  rec.start();
  return {
    stop: () => new Promise((resolve) => {
      rec.onstop = () => {
        if (lastUrl) URL.revokeObjectURL(lastUrl);
        lastUrl = chunks.length ? URL.createObjectURL(new Blob(chunks, { type: rec.mimeType })) : null;
        resolve(lastUrl);
      };
      rec.stop();
    }),
  };
}

/** Let go of the microphone (the iPhone shows it in use otherwise). */
export function releaseMic() {
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
}

export function playUrl(url: string): Promise<void> {
  return new Promise((resolve) => {
    const a = new Audio(url);
    a.onended = () => resolve();
    a.onerror = () => resolve();
    void a.play().catch(() => resolve());
  });
}
