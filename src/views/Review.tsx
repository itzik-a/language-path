import type { Lang } from "../types";
import { LANG } from "../lib/langs";

export function Review({ lang }: { lang: Lang; sub?: string }) {
  return (
    <div className="page-head">
      <span className="eyebrow">{LANG[lang].name}</span>
      <h1 className="display">Review</h1>
    </div>
  );
}
