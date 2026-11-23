import type { Lang } from "../types";
import { LANG } from "../lib/langs";

export function Read({ lang }: { lang: Lang; sub?: string }) {
  return (
    <div className="page-head">
      <span className="eyebrow">{LANG[lang].name}</span>
      <h1 className="display">Read</h1>
    </div>
  );
}
