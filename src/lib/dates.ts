/* Local dates as YYYY-MM-DD. */
const pad = (n: number) => String(n).padStart(2, "0");
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => ymd(new Date());
export const addDays = (date: string, n: number) => { const d = new Date(date + "T12:00:00"); d.setDate(d.getDate() + n); return ymd(d); };
/** End of the local day (ms): cards due before it count as due today. */
export const endOfToday = () => { const d = new Date(); d.setHours(23, 59, 59, 999); return d.getTime(); };
export const DAY = 86_400_000;

export function ago(t: number): string {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

/** "in 3 days", "in 2 mo" for a future time. */
export function interval(ms: number): string {
  const m = Math.max(1, Math.round(ms / 60_000));
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 31) return `${d}d`;
  const mo = d / 30.4;
  if (mo < 12) return `${Math.round(mo)}mo`;
  return `${(d / 365).toFixed(1).replace(/\.0$/, "")}y`;
}
