/* FSRS scheduling (ts-fsrs, FSRS-6) over our plain-number card state. */
import { createEmptyCard, fsrs, Rating, type Card as FCard, type FSRS, type Grade } from "ts-fsrs";
import type { Srs } from "../types";

export { Rating };
export type { Grade };

const schedulers = new Map<number, FSRS>();
function scheduler(retention: number): FSRS {
  const r = Math.round(retention * 100) / 100;
  let f = schedulers.get(r);
  if (!f) { f = fsrs({ request_retention: r, enable_fuzz: true, enable_short_term: true, maximum_interval: 3650 }); schedulers.set(r, f); }
  return f;
}

const toF = (s: Srs): FCard => ({
  due: new Date(s.due), stability: s.stability, difficulty: s.difficulty, elapsed_days: s.elapsed_days, scheduled_days: s.scheduled_days,
  learning_steps: s.learning_steps, reps: s.reps, lapses: s.lapses, state: s.state, ...(s.last_review ? { last_review: new Date(s.last_review) } : {}),
});
const fromF = (c: FCard): Srs => ({
  due: c.due.getTime(), stability: c.stability, difficulty: c.difficulty, elapsed_days: c.elapsed_days, scheduled_days: c.scheduled_days,
  learning_steps: c.learning_steps, reps: c.reps, lapses: c.lapses, state: c.state as Srs["state"], ...(c.last_review ? { last_review: c.last_review.getTime() } : {}),
});

export const newSrs = (now = Date.now()): Srs => fromF(createEmptyCard(new Date(now)));

/** The card after answering with `grade`. */
export function review(s: Srs, grade: Grade, retention: number, now = Date.now()): Srs {
  return fromF(scheduler(retention).next(toF(s), new Date(now), grade).card);
}

/** When each answer would bring the card back (ms from now). */
export function preview(s: Srs, retention: number, now = Date.now()): Record<Grade, number> {
  const p = scheduler(retention).repeat(toF(s), new Date(now));
  return {
    [Rating.Again]: p[Rating.Again].card.due.getTime() - now,
    [Rating.Hard]: p[Rating.Hard].card.due.getTime() - now,
    [Rating.Good]: p[Rating.Good].card.due.getTime() - now,
    [Rating.Easy]: p[Rating.Easy].card.due.getTime() - now,
  } as Record<Grade, number>;
}

/** Probability of recalling the card now. */
export function recall(s: Srs, retention: number, now = Date.now()): number {
  if (s.state === 0) return 0;
  return scheduler(retention).get_retrievability(toF(s), new Date(now), false) as number;
}
