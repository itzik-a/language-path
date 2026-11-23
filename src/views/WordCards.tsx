/* A word's cards on its page: when each is next due, how stable it is; start learning now. */
import { interval } from "../lib/dates";
import { recall } from "../lib/srs";
import { learnWord, resetCard, suspendCard } from "../state/actions";
import { useAppState } from "../state/store";
import type { CardKind, Word } from "../types";

export const KIND_LABEL: Record<CardKind, string> = { recog: "Recognise", listen: "Listen", say: "Say", cloze: "In a sentence", script: "Script" };

export function WordCards({ w }: { w: Word }) {
  const s = useAppState();
  const cards = s.cards.filter((c) => c.wordId === w.id && !c.deletedAt);
  const retention = s.settings.lang[w.lang].retention;
  if (w.status === "new" && !cards.length) {
    return (
      <section className="card">
        <h2>Cards</h2>
        <p className="muted small">This word is in the queue and will start on its own. Want it now?</p>
        <button type="button" className="btn primary sm" onClick={() => learnWord(w.id)}>Start learning it now</button>
      </section>
    );
  }
  if (!cards.length) return null;
  const now = Date.now();
  return (
    <section className="card">
      <h2>Cards</h2>
      {w.status !== "learning" && <p className="muted small">Paused while the word is "{w.status === "new" ? "in queue" : w.status}". Set it to Learning to bring them back.</p>}
      <ul className="card-rows">
        {cards.sort((a, b) => "recog listen cloze say".indexOf(a.kind) - "recog listen cloze say".indexOf(b.kind)).map((c) => (
          <li key={c.id} className="card-row">
            <div>
              <b>{KIND_LABEL[c.kind]}</b>
              <span className="muted small">
                {c.suspended ? "paused" : c.srs.state === 0 ? "new" : c.srs.due <= now ? "due now" : `next in ${interval(c.srs.due - now)}`}
                {c.log.length ? ` · ${c.log.length} review${c.log.length === 1 ? "" : "s"}` : ""}
                {c.srs.state === 2 ? ` · ${Math.round(recall(c.srs, retention) * 100)}% recall` : ""}
              </span>
            </div>
            <div className="btn-row">
              {c.log.length > 0 && <button type="button" className="text-btn" onClick={() => resetCard(c.id)}>Reset</button>}
              {w.status === "learning" && <button type="button" className="text-btn" onClick={() => suspendCard(c.id, !c.suspended)}>{c.suspended ? "Resume" : "Pause"}</button>}
            </div>
          </li>
        ))}
      </ul>
      {!cards.some((c) => c.kind === "say") && w.status === "learning" && (
        <p className="muted small">A "Say" card is added once you recognise the word reliably for {s.settings.lang[w.lang].sayAfterDays} days.</p>
      )}
    </section>
  );
}
