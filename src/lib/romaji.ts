/* Romaji → hiragana, for typing Japanese answers without a Japanese keyboard.
   Hepburn and common alternatives (si, ti, tu, hu, zi); "kk" → っk; "n'" / "nn" / n before a consonant → ん; "-" → ー.
   toKana(text, { final: true }) also turns a trailing "n" into ん (when the answer is submitted). */
const V = ["a", "i", "u", "e", "o"];
const BASE: Record<string, string[]> = {
  "": ["あ", "い", "う", "え", "お"], k: ["か", "き", "く", "け", "こ"], s: ["さ", "し", "す", "せ", "そ"], t: ["た", "ち", "つ", "て", "と"],
  n: ["な", "に", "ぬ", "ね", "の"], h: ["は", "ひ", "ふ", "へ", "ほ"], m: ["ま", "み", "む", "め", "も"], y: ["や", "い", "ゆ", "いぇ", "よ"],
  r: ["ら", "り", "る", "れ", "ろ"], w: ["わ", "うぃ", "う", "うぇ", "を"], g: ["が", "ぎ", "ぐ", "げ", "ご"], z: ["ざ", "じ", "ず", "ぜ", "ぞ"],
  d: ["だ", "ぢ", "づ", "で", "ど"], b: ["ば", "び", "ぶ", "べ", "ぼ"], p: ["ぱ", "ぴ", "ぷ", "ぺ", "ぽ"], f: ["ふぁ", "ふぃ", "ふ", "ふぇ", "ふぉ"],
  j: ["じゃ", "じ", "じゅ", "じぇ", "じょ"], l: ["ら", "り", "る", "れ", "ろ"], v: ["ゔぁ", "ゔぃ", "ゔ", "ゔぇ", "ゔぉ"],
};
const TABLE: Record<string, string> = {};
for (const [c, row] of Object.entries(BASE)) V.forEach((v, i) => { TABLE[c + v] = row[i]; });
Object.assign(TABLE, { shi: "し", chi: "ち", tsu: "つ", fu: "ふ", si: "し", ti: "ち", tu: "つ", hu: "ふ", zi: "じ", ji: "じ", di: "ぢ", du: "づ", wo: "を" });
const YOON: Record<string, string> = { ky: "き", gy: "ぎ", sy: "し", zy: "じ", ty: "ち", dy: "ぢ", ny: "に", hy: "ひ", by: "び", py: "ぴ", my: "み", ry: "り" };
for (const [c, k] of Object.entries(YOON)) Object.assign(TABLE, { [c + "a"]: k + "ゃ", [c + "u"]: k + "ゅ", [c + "o"]: k + "ょ" });
Object.assign(TABLE, { sha: "しゃ", shu: "しゅ", sho: "しょ", she: "しぇ", cha: "ちゃ", chu: "ちゅ", cho: "ちょ", che: "ちぇ", ja: "じゃ", ju: "じゅ", jo: "じょ" });

export function toKana(input: string, opts: { final?: boolean } = {}): string {
  const s = input.toLowerCase();
  let out = "";
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === "-") { out += "ー"; i++; continue; }
    if (c === "n") {
      const nx = s[i + 1];
      if (nx === "n") {
        // "nni" = ん + に (as IMEs do); "nn" before a consonant or at the end = ん
        const after = s[i + 2];
        if (after !== undefined && (V.includes(after) || after === "y")) { out += "ん"; i++; continue; }
        out += "ん"; i += 2; continue;
      }
      if (nx === "'") { out += "ん"; i += 2; continue; }
      if (nx !== undefined && !V.includes(nx) && nx !== "y") { out += "ん"; i++; continue; }
      if (nx === undefined) { out += opts.final ? "ん" : "n"; i++; continue; }
    }
    // double consonant → っ
    if (c === s[i + 1] && /[bcdfghjkmpqrstvwxz]/.test(c)) { out += "っ"; i++; continue; }
    if (c === "t" && s[i + 1] === "c" && s[i + 2] === "h") { out += "っ"; i++; continue; }
    let hit = false;
    for (const len of [3, 2, 1]) {
      const k = s.slice(i, i + len);
      if (TABLE[k]) { out += TABLE[k]; i += len; hit = true; break; }
    }
    if (!hit) { out += c; i++; }
  }
  return out;
}

/** Does the text look like romaji (Latin letters) rather than kana? */
export const isRomaji = (s: string) => /^[a-zA-Z' -]+$/.test(s.trim());
