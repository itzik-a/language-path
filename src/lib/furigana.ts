/* Furigana for a Japanese token: the reading goes over the kanji only, kana around them stays plain.
   食べます + たべます → [食|た] べます ; お茶 + おちゃ → お [茶|ちゃ] */
import { hasKanji, kataToHira } from "./langs";

export type Part = { text: string; rt?: string };

export function furiganaParts(surface: string, reading?: string): Part[] {
  if (!reading || !hasKanji(surface)) return [{ text: surface }];
  const s = [...surface], r = [...reading];
  const same = (a: string, b: string) => kataToHira(a) === kataToHira(b);
  let pre = 0;
  while (pre < s.length && pre < r.length && !hasKanji(s[pre]) && same(s[pre], r[pre])) pre++;
  let suf = 0;
  while (suf < s.length - pre && suf < r.length - pre && !hasKanji(s[s.length - 1 - suf]) && same(s[s.length - 1 - suf], r[r.length - 1 - suf])) suf++;
  const mid = s.slice(pre, s.length - suf).join("");
  const midR = r.slice(pre, r.length - suf).join("");
  const parts: Part[] = [];
  if (pre) parts.push({ text: s.slice(0, pre).join("") });
  parts.push(midR ? { text: mid, rt: midR } : { text: mid });
  if (suf) parts.push({ text: s.slice(s.length - suf).join("") });
  return parts;
}

/** Does this token need furigana, given the setting and the kanji I know? */
export function needsFurigana(surface: string, mode: "unknown" | "all" | "none", known: Set<string>): boolean {
  if (mode === "none" || !hasKanji(surface)) return false;
  if (mode === "all") return true;
  return [...surface].some((c) => hasKanji(c) && !known.has(c));
}
