/* Script data: kana, the Arabic alphabet and harakat, the Greek alphabet and letter pairs, Polish and Portuguese sounds,
   minimal pairs. A character's id ("hira:ka", "kata:ka", "abc:b", "har:fatha", "grk:alpha", "grx:ou") is used for script cards and "known" marks:
   never change one once shipped. */
import type { Lang } from "../types";

export interface ScriptChar {
  id: string;
  /** what is shown */
  char: string;
  /** what the voice reads */
  say: string;
  /** romaji / transliteration (the answer) */
  sound: string;
  /** extra lines shown on the back */
  info?: string;
  hebrew?: string;
  name?: string;
  /** Arabic: joins to the next letter */
  joins?: boolean;
  /** Greek: the capital letter */
  upper?: string;
}

export interface ScriptRow { id: string; label: string; chars: ScriptChar[] }
export interface ScriptSet { id: string; lang: Lang; title: string; blurb: string; rows: ScriptRow[] }

// ── kana ──────────────────────────────────────────────────────

const GOJUON: [string, [string, string][]][] = [
  ["a", [["あ", "a"], ["い", "i"], ["う", "u"], ["え", "e"], ["お", "o"]]],
  ["ka", [["か", "ka"], ["き", "ki"], ["く", "ku"], ["け", "ke"], ["こ", "ko"]]],
  ["sa", [["さ", "sa"], ["し", "shi"], ["す", "su"], ["せ", "se"], ["そ", "so"]]],
  ["ta", [["た", "ta"], ["ち", "chi"], ["つ", "tsu"], ["て", "te"], ["と", "to"]]],
  ["na", [["な", "na"], ["に", "ni"], ["ぬ", "nu"], ["ね", "ne"], ["の", "no"]]],
  ["ha", [["は", "ha"], ["ひ", "hi"], ["ふ", "fu"], ["へ", "he"], ["ほ", "ho"]]],
  ["ma", [["ま", "ma"], ["み", "mi"], ["む", "mu"], ["め", "me"], ["も", "mo"]]],
  ["ya", [["や", "ya"], ["ゆ", "yu"], ["よ", "yo"]]],
  ["ra", [["ら", "ra"], ["り", "ri"], ["る", "ru"], ["れ", "re"], ["ろ", "ro"]]],
  ["wa", [["わ", "wa"], ["を", "o"], ["ん", "n"]]],
  ["ga", [["が", "ga"], ["ぎ", "gi"], ["ぐ", "gu"], ["げ", "ge"], ["ご", "go"]]],
  ["za", [["ざ", "za"], ["じ", "ji"], ["ず", "zu"], ["ぜ", "ze"], ["ぞ", "zo"]]],
  ["da", [["だ", "da"], ["ぢ", "ji"], ["づ", "zu"], ["で", "de"], ["ど", "do"]]],
  ["ba", [["ば", "ba"], ["び", "bi"], ["ぶ", "bu"], ["べ", "be"], ["ぼ", "bo"]]],
  ["pa", [["ぱ", "pa"], ["ぴ", "pi"], ["ぷ", "pu"], ["ぺ", "pe"], ["ぽ", "po"]]],
  ["kya", [["きゃ", "kya"], ["きゅ", "kyu"], ["きょ", "kyo"], ["しゃ", "sha"], ["しゅ", "shu"], ["しょ", "sho"], ["ちゃ", "cha"], ["ちゅ", "chu"], ["ちょ", "cho"]]],
  ["nya", [["にゃ", "nya"], ["にゅ", "nyu"], ["にょ", "nyo"], ["ひゃ", "hya"], ["ひゅ", "hyu"], ["ひょ", "hyo"], ["みゃ", "mya"], ["みゅ", "myu"], ["みょ", "myo"], ["りゃ", "rya"], ["りゅ", "ryu"], ["りょ", "ryo"]]],
  ["gya", [["ぎゃ", "gya"], ["ぎゅ", "gyu"], ["ぎょ", "gyo"], ["じゃ", "ja"], ["じゅ", "ju"], ["じょ", "jo"], ["びゃ", "bya"], ["びゅ", "byu"], ["びょ", "byo"], ["ぴゃ", "pya"], ["ぴゅ", "pyu"], ["ぴょ", "pyo"]]],
];

const ROW_LABEL: Record<string, string> = {
  a: "Vowels", ka: "K", sa: "S", ta: "T", na: "N", ha: "H", ma: "M", ya: "Y", ra: "R", wa: "W · N",
  ga: "G (゛)", za: "Z (゛)", da: "D (゛)", ba: "B (゛)", pa: "P (゜)", kya: "Combined: ky sh ch", nya: "Combined: ny hy my ry", gya: "Combined: gy j by py",
};

export const toKatakana = (s: string) =>
  [...s].map((c) => { const n = c.codePointAt(0)!; return n >= 0x3041 && n <= 0x3096 ? String.fromCodePoint(n + 0x60) : c; }).join("");

function kanaSet(kind: "hira" | "kata"): ScriptSet {
  return {
    id: kind, lang: "ja",
    title: kind === "hira" ? "Hiragana" : "Katakana",
    blurb: kind === "hira" ? "The basic syllables: grammar endings, particles, native words." : "The same sounds, for foreign words and names (コーヒー, テレビ). ー makes a vowel long.",
    rows: GOJUON.map(([row, cells]) => ({
      id: `${kind}:${row}`, label: ROW_LABEL[row],
      chars: cells.map(([h, r]) => {
        const char = kind === "hira" ? h : toKatakana(h);
        return { id: `${kind}:${r}${r === "ji" || r === "zu" ? (["ぢ", "づ"].includes(h) ? "-d" : "") : ""}${h === "を" ? "-wo" : ""}`, char, say: h, sound: r,
          ...(h === "を" ? { info: "the object particle, said \"o\"" } : h === "ん" ? { info: "n on its own; m before b, p, m" } : h === "は" ? { info: "as the topic particle は it's said \"wa\"" } : h === "へ" ? { info: "as a particle (to) it's said \"e\"" } : h === "ぢ" || h === "づ" ? { info: "rare; sounds like じ / ず" } : h === "ふ" ? { info: "between f and h, lips not touching" } : h === "ら" || r.startsWith("r") ? { info: "a light tap, between r, l and d" } : {}) };
      }),
    })),
  };
}

// ── Arabic ────────────────────────────────────────────────────

/** [letter, translit, name (Arabic), name (Latin), Hebrew counterpart, sound, joins to the next letter] */
const ABC: [string, string, string, string, string, string, boolean][] = [
  ["ا", "ā / ʾ", "أَلِف", "alif", "א", "long a (ā); also a seat for hamza ء", false],
  ["ب", "b", "بَاء", "bāʾ", "ב", "b", true],
  ["ت", "t", "تَاء", "tāʾ", "ת", "t", true],
  ["ث", "th", "ثَاء", "thāʾ", "ת׳", "th as in \"think\"", true],
  ["ج", "j", "جِيم", "jīm", "ג׳", "j as in \"jam\"", true],
  ["ح", "ḥ", "حَاء", "ḥāʾ", "ח", "a breathy h from deep in the throat (Mizrahi ח)", true],
  ["خ", "kh", "خَاء", "khāʾ", "כ / ח", "like Hebrew כ in לָכֵן, or Ashkenazi ח", true],
  ["د", "d", "دَال", "dāl", "ד", "d", false],
  ["ذ", "dh", "ذَال", "dhāl", "ד׳", "th as in \"this\"", false],
  ["ر", "r", "رَاء", "rāʾ", "ר", "a rolled r", false],
  ["ز", "z", "زَاي", "zāy", "ז", "z", false],
  ["س", "s", "سِين", "sīn", "ס", "s", true],
  ["ش", "sh", "شِين", "shīn", "ש", "sh", true],
  ["ص", "ṣ", "صَاد", "ṣād", "צ", "a heavy s: back of the tongue raised, it darkens the vowel next to it", true],
  ["ض", "ḍ", "ضَاد", "ḍād", "צ׳", "a heavy d", true],
  ["ط", "ṭ", "طَاء", "ṭāʾ", "ט", "a heavy t", true],
  ["ظ", "ẓ", "ظَاء", "ẓāʾ", "ט׳", "a heavy dh", true],
  ["ع", "ʿ", "عَيْن", "ʿayn", "ע", "a voiced squeeze in the throat (Mizrahi ע)", true],
  ["غ", "gh", "غَيْن", "ghayn", "ע׳ / ר", "like a French r", true],
  ["ف", "f", "فَاء", "fāʾ", "פ", "f", true],
  ["ق", "q", "قَاف", "qāf", "ק", "a k from far back in the throat", true],
  ["ك", "k", "كَاف", "kāf", "כ", "k", true],
  ["ل", "l", "لَام", "lām", "ל", "l (with ا it's written لا)", true],
  ["م", "m", "مِيم", "mīm", "מ", "m", true],
  ["ن", "n", "نُون", "nūn", "נ", "n", true],
  ["ه", "h", "هَاء", "hāʾ", "ה", "h", true],
  ["و", "w / ū", "وَاو", "wāw", "ו", "w, or long u (ū)", false],
  ["ي", "y / ī", "يَاء", "yāʾ", "י", "y, or long i (ī)", true],
];

const EXTRA: [string, string, string, string, string, string, boolean][] = [
  ["ء", "ʾ", "هَمْزَة", "hamza", "א", "a glottal stop, like the catch in \"uh-oh\"; sits on ا و ي or alone", false],
  ["ة", "a / at", "تَاء مَرْبُوطَة", "tāʾ marbūṭa", "ה", "the feminine ending: -a, or -at before another word", false],
  ["ى", "ā", "أَلِف مَقْصُورَة", "alif maqṣūra", "", "a long ā at the end of a word, written like ي without dots", false],
];

const ZWJ = "‍";
/** The four shapes of a letter: isolated, initial, medial, final (initial / medial only for joining letters). */
export function letterForms(c: string, joins: boolean) {
  return { iso: c, init: joins ? c + ZWJ : c, mid: joins ? ZWJ + c + ZWJ : ZWJ + c, fin: ZWJ + c };
}

const abcChar = ([c, tr, nameAr, name, he, sound, joins]: (typeof ABC)[number], key: string): ScriptChar => ({
  id: `abc:${key}`, char: c, say: c === "ا" ? "ا" : c === "ء" ? "أ" : c === "ة" ? "ة" : c === "ى" ? "ى" : c + "َ", sound: tr, name: `${nameAr} · ${name}`, hebrew: he, info: sound, joins,
});

/** Stable keys for the letters, in ABC order. */
const ABC_KEYS = ["alif", "b", "t", "th", "j", "h-h", "kh", "d", "dh", "r", "z", "s", "sh", "s-h", "d-h", "t-h", "z-h", "ayn", "gh", "f", "q", "k", "l", "m", "n", "h", "w", "y"];
const abcRow = (id: string, from: number, to: number) => ({
  id, label: ABC.slice(from, to).map((x) => x[0]).join(" "), chars: ABC.slice(from, to).map((x, i) => abcChar(x, ABC_KEYS[from + i])),
});

const ABC_SET: ScriptSet = {
  id: "abc", lang: "ar", title: "Alphabet",
  blurb: "28 letters, written right to left. Most join to the next letter and change shape with their place in the word. The Hebrew column is the letter's counterpart.",
  rows: [
    abcRow("abc:1", 0, 4), abcRow("abc:2", 4, 7), abcRow("abc:3", 7, 11), abcRow("abc:4", 11, 15),
    abcRow("abc:5", 15, 19), abcRow("abc:6", 19, 23), abcRow("abc:7", 23, 28),
    { id: "abc:x", label: "ء ة ى", chars: EXTRA.map((x, i) => abcChar(x, ["hamza", "tamarbuta", "alifmaqsura"][i])) },
  ],
};

/** [id, mark on ب, translit, name, what it does] */
const HARAKAT: [string, string, string, string, string][] = [
  ["fatha", "بَ", "ba", "فَتْحَة · fatḥa", "a short a"],
  ["kasra", "بِ", "bi", "كَسْرَة · kasra", "a short i"],
  ["damma", "بُ", "bu", "ضَمَّة · ḍamma", "a short u"],
  ["sukun", "بْ", "b", "سُكُون · sukūn", "no vowel after the letter"],
  ["shadda", "بّ", "bb", "شَدَّة · shadda", "the letter is doubled (like a דגש חזק)"],
  ["alif", "بَا", "bā", "fatḥa + ا", "a long ā"],
  ["ya", "بِي", "bī", "kasra + ي", "a long ī"],
  ["waw", "بُو", "bū", "ḍamma + و", "a long ū"],
  ["tanwin-a", "بًا", "ban", "تَنْوِين · tanwīn", "-an at the end of a word (indefinite)"],
  ["tanwin-i", "بٍ", "bin", "tanwīn", "-in at the end of a word"],
  ["tanwin-u", "بٌ", "bun", "tanwīn", "-un at the end of a word (indefinite)"],
];

const HARAKAT_SET: ScriptSet = {
  id: "har", lang: "ar", title: "Vowel marks",
  blurb: "Short vowels are small marks above or below a letter, like Hebrew nikkud. Everyday texts leave them out; learner texts keep them.",
  rows: [
    { id: "har:short", label: "Short vowels", chars: HARAKAT.slice(0, 5).map(([id, c, tr, name, what]) => ({ id: `har:${id}`, char: c, say: c, sound: tr, name, info: what })) },
    { id: "har:long", label: "Long vowels and tanwin", chars: HARAKAT.slice(5).map(([id, c, tr, name, what]) => ({ id: `har:${id}`, char: c, say: c, sound: tr, name, info: what })) },
  ],
};

// ── Greek ─────────────────────────────────────────────────────

/** [key, lower, upper, name (Greek), name (Latin), sound, Hebrew counterpart (the same Phoenician letter), how it sounds] */
const GREEK: [string, string, string, string, string, string, string, string][] = [
  ["alpha", "α", "Α", "άλφα", "alfa", "a", "א", "a as in \"father\""],
  ["beta", "β", "Β", "βήτα", "víta", "v", "ב", "v (like ב without a dagesh)"],
  ["gamma", "γ", "Γ", "γάμμα", "gháma", "gh / y", "ג", "before a, o, u and consonants: a soft gh from the throat, like a French r (Arabic غ); before e, i: y"],
  ["delta", "δ", "Δ", "δέλτα", "dhélta", "dh", "ד", "th as in \"this\" (Arabic ذ), never a hard d"],
  ["epsilon", "ε", "Ε", "έψιλον", "épsilon", "e", "ה", "e as in \"bed\""],
  ["zeta", "ζ", "Ζ", "ζήτα", "zíta", "z", "ז", "z"],
  ["eta", "η", "Η", "ήτα", "íta", "i", "ח", "i as in \"machine\": the same sound as ι and υ"],
  ["theta", "θ", "Θ", "θήτα", "thíta", "th", "ט", "th as in \"think\" (Arabic ث)"],
  ["iota", "ι", "Ι", "γιώτα", "yióta", "i", "י", "i; before a vowel often a y (παιδιά: pedhyá)"],
  ["kappa", "κ", "Κ", "κάπα", "kápa", "k", "כ", "k (a little softer before e, i)"],
  ["lambda", "λ", "Λ", "λάμδα", "lámdha", "l", "ל", "l"],
  ["mu", "μ", "Μ", "μι", "mi", "m", "מ", "m"],
  ["nu", "ν", "Ν", "νι", "ni", "n", "נ", "n"],
  ["xi", "ξ", "Ξ", "ξι", "xi", "x", "ס", "ks"],
  ["omicron", "ο", "Ο", "όμικρον", "ómikron", "o", "ע", "o, between \"hot\" and \"go\""],
  ["pi", "π", "Π", "πι", "pi", "p", "פ", "p, without a puff of air"],
  ["rho", "ρ", "Ρ", "ρο", "ro", "r", "ר", "a tapped r, like Spanish \"pero\""],
  ["sigma", "σ", "Σ", "σίγμα", "sígma", "s", "ש", "s (z before β γ δ μ ν λ ρ: κόσμος = kózmos). At the end of a word it's written ς"],
  ["tau", "τ", "Τ", "ταυ", "taf", "t", "ת", "t, without a puff of air"],
  ["upsilon", "υ", "Υ", "ύψιλον", "ípsilon", "i", "ו", "i, the same as ι and η (it came from ו)"],
  ["phi", "φ", "Φ", "φι", "fi", "f", "", "f, like פ without a dagesh"],
  ["chi", "χ", "Χ", "χι", "khi", "kh", "", "like ח or כ in לָכֵן; before e, i softer, like German \"ich\""],
  ["psi", "ψ", "Ψ", "ψι", "psi", "ps", "", "ps, even at the start of a word (ψωμί = psomí)"],
  ["omega", "ω", "Ω", "ωμέγα", "oméga", "o", "", "o: the same sound as ο"],
];

const grkChar = ([key, lo, up, nameGr, name, sound, he, how]: (typeof GREEK)[number]): ScriptChar => ({
  id: `grk:${key}`, char: lo, upper: up, say: nameGr, sound, name: `${up} ${lo} · ${nameGr} · ${name}`, info: how, ...(he ? { hebrew: he } : {}),
});
const grkRow = (from: number, to: number): ScriptRow => ({
  id: `grk:${from / 4 + 1}`, label: GREEK.slice(from, to).map((x) => `${x[2]} ${x[1]}`).join("  "), chars: GREEK.slice(from, to).map(grkChar),
});

const GREEK_SET: ScriptSet = {
  id: "grk", lang: "el", title: "Alphabet",
  blurb: "24 letters, most of them cousins of the Hebrew ones (α–א, β–ב, γ–ג, δ–ד…): both come from the Phoenician alphabet. Every word of two syllables or more carries an accent mark (ά) on the stressed syllable, and stress changes meaning: πότε (when) / ποτέ (never).",
  rows: [grkRow(0, 4), grkRow(4, 8), grkRow(8, 12), grkRow(12, 16), grkRow(16, 20), grkRow(20, 24)],
};

/** [key, letters, sound, an example word the voice reads, what it is] */
const GREEK_PAIRS: [string, string, string, string, string][] = [
  ["ou", "ου", "ou", "πού", "u as in \"food\": πού (poú) = where"],
  ["ai", "αι", "e", "και", "e, the same as ε: και (ke) = and"],
  ["ei", "ει", "i", "είναι", "i: είναι (íne) = is"],
  ["oi", "οι", "i", "οι", "i: οι (i) = the (plural)"],
  ["av", "αυ", "av / af", "αύριο", "av before a vowel or β γ δ ζ λ μ ν ρ, af before the others: αύριο (ávrio) = tomorrow, αυτό (aftó) = this"],
  ["ev", "ευ", "ev / ef", "ευχαριστώ", "ev or ef, like αυ: ευχαριστώ (efkharistó) = thank you"],
  ["mp", "μπ", "b / mb", "μπύρα", "b at the start of a word, mb inside: μπύρα (bíra) = beer"],
  ["nt", "ντ", "d / nd", "ντομάτα", "d at the start of a word, nd inside: ντομάτα (domáta) = tomato"],
  ["gk", "γκ", "g / ng", "γκρι", "g at the start of a word, ng inside: γκρι (gri) = grey"],
  ["gg", "γγ", "ng", "Αγγλία", "ng: Αγγλία (Anglía) = England"],
  ["ts", "τσ", "ts", "τσάι", "ts: τσάι (tsái) = tea"],
  ["tz", "τζ", "dz", "τζάμι", "dz: τζάμι (dzámi) = window pane"],
];

const GREEK_PAIRS_SET: ScriptSet = {
  id: "grx", lang: "el", title: "Letter pairs",
  blurb: "Two letters that make one sound. An accent on the first letter, or two dots on the second (ϊ, ϋ), splits a pair: τσάι is ts-á-i.",
  rows: [
    { id: "grx:vowels", label: "Vowel pairs", chars: GREEK_PAIRS.slice(0, 6).map(([k, c, sound, say, info]) => ({ id: `grx:${k}`, char: c, say, sound, info })) },
    { id: "grx:consonants", label: "Consonant pairs", chars: GREEK_PAIRS.slice(6).map(([k, c, sound, say, info]) => ({ id: `grx:${k}`, char: c, say, sound, info })) },
  ],
};

export const SCRIPT_SETS: ScriptSet[] = [kanaSet("hira"), kanaSet("kata"), ABC_SET, HARAKAT_SET, GREEK_SET, GREEK_PAIRS_SET];
export const setsFor = (lang: Lang) => SCRIPT_SETS.filter((s) => s.lang === lang);
export const allChars = () => SCRIPT_SETS.flatMap((s) => s.rows.flatMap((r) => r.chars));
const CHAR_INDEX = new Map(allChars().map((c) => [c.id, c]));
export const charById = (id: string) => CHAR_INDEX.get(id);
export const setOfChar = (id: string) => SCRIPT_SETS.find((s) => s.rows.some((r) => r.chars.some((c) => c.id === id)));

// ── sounds pages (Polish, Portuguese) ─────────────────────────

export interface Sound { g: string; how: string; ex: string; gloss: string }

const POLISH_SOUNDS: Sound[] = [
  { g: "ą", how: "a nasal o, like French \"on\"", ex: "są", gloss: "they are" },
  { g: "ę", how: "a nasal e; at the end of a word often a plain e", ex: "ręka", gloss: "hand" },
  { g: "ó", how: "the same as u", ex: "góra", gloss: "mountain" },
  { g: "ł", how: "like English w", ex: "łóżko", gloss: "bed" },
  { g: "w", how: "v", ex: "woda", gloss: "water" },
  { g: "j", how: "y as in \"yes\"", ex: "jajko", gloss: "egg" },
  { g: "y", how: "a short i said further back, like the i in \"bit\"", ex: "my", gloss: "we" },
  { g: "c", how: "ts", ex: "noc", gloss: "night" },
  { g: "ch · h", how: "like Hebrew ח or German \"ach\"", ex: "chleb", gloss: "bread" },
  { g: "cz", how: "a hard ch, as in \"church\"", ex: "czas", gloss: "time" },
  { g: "ć · ci", how: "a soft ch, tongue flat against the palate", ex: "ciocia", gloss: "aunt" },
  { g: "sz", how: "a hard sh", ex: "szkoła", gloss: "school" },
  { g: "ś · si", how: "a soft sh (smile a little)", ex: "środa", gloss: "Wednesday" },
  { g: "rz · ż", how: "a hard zh, like the s in \"measure\"", ex: "rzeka", gloss: "river" },
  { g: "ź · zi", how: "a soft zh", ex: "źle", gloss: "badly" },
  { g: "dz", how: "dz", ex: "dzwon", gloss: "bell" },
  { g: "dż", how: "j as in \"jam\"", ex: "dżem", gloss: "jam" },
  { g: "dź · dzi", how: "a soft j", ex: "dzień", gloss: "day" },
  { g: "ń · ni", how: "ny as in \"canyon\"", ex: "koń", gloss: "horse" },
  { g: "szcz", how: "sh + ch together", ex: "szczęście", gloss: "happiness, luck" },
];

/** European Portuguese, for someone who speaks Spanish: what sounds different. */
const PORTUGUESE_SOUNDS: Sound[] = [
  { g: "e", how: "unstressed: almost swallowed, often silent: pequeno sounds like \"pkenu\"", ex: "pequeno", gloss: "small" },
  { g: "o", how: "unstressed it's a u: obrigado sounds like \"ubrigadu\"", ex: "obrigado", gloss: "thank you" },
  { g: "a", how: "unstressed: a short, weak \"uh\", as in \"about\"", ex: "casa", gloss: "house" },
  { g: "-s", how: "sh at the end of a word or before a consonant; zh before a voiced one", ex: "dois", gloss: "two" },
  { g: "ão", how: "a nasal \"ow\", through the nose", ex: "pão", gloss: "bread" },
  { g: "ãe · em", how: "a nasal \"ay\"", ex: "mãe", gloss: "mother" },
  { g: "õe", how: "a nasal \"oy\"", ex: "limões", gloss: "lemons" },
  { g: "lh", how: "like Spanish ll said as l + y (lli)", ex: "filho", gloss: "son" },
  { g: "nh", how: "like Spanish ñ", ex: "vinho", gloss: "wine" },
  { g: "ch", how: "sh, never the Spanish ch", ex: "chave", gloss: "key" },
  { g: "j · gi", how: "j, and g before e or i: zh, as the s in \"measure\" (not the Spanish jota)", ex: "gente", gloss: "people" },
  { g: "r- · rr", how: "at the start of a word, and rr: from the throat, like a French r or Hebrew ר", ex: "rua", gloss: "street" },
  { g: "-r-", how: "between vowels: a single tap, like Spanish \"pero\"", ex: "caro", gloss: "expensive" },
  { g: "v", how: "a real v (lips on teeth): vaca and baca are different words", ex: "vinho", gloss: "wine" },
  { g: "x", how: "usually sh; sometimes ks (táxi), z (exame) or s (próximo)", ex: "peixe", gloss: "fish" },
  { g: "ç", how: "s", ex: "coração", gloss: "heart" },
  { g: "ei", how: "in Lisbon closer to \"ay\"", ex: "leite", gloss: "milk" },
  { g: "ou", how: "a closed o", ex: "sou", gloss: "I am" },
];

export const SOUNDS: Partial<Record<Lang, { title: string; mark: string; blurb: string; intro: string; list: Sound[] }>> = {
  pl: {
    title: "Polish sounds", mark: "ł", blurb: "ą ę ł, cz sz rz, ć ś ź, and the stress rule", list: POLISH_SOUNDS,
    intro: "Polish is spelled the way it sounds once you know these. Stress is almost always on the second-to-last syllable: dzię-KU-ję, prze-PRA-szam.",
  },
  pt: {
    title: "European Portuguese sounds", mark: "ã", blurb: "the swallowed vowels, ão õe ãe, lh nh, sh for s", list: PORTUGUESE_SOUNDS,
    intro: "Written Portuguese is close to Spanish; spoken Portuguese from Portugal is not: unstressed vowels shrink or vanish, so words run together. These are the differences that matter most for listening. Stress falls on the second-to-last syllable, or the last when the word ends in r, l, z, i, u, im or um, unless an accent says otherwise.",
  },
};

// ── minimal pairs ─────────────────────────────────────────────

export interface Pair { a: [string, string]; b: [string, string]; what: string }

export const PAIRS: Record<Lang, Pair[]> = {
  ja: [
    { a: ["おばさん", "aunt"], b: ["おばあさん", "grandmother"], what: "short vs long a" },
    { a: ["おじさん", "uncle"], b: ["おじいさん", "grandfather"], what: "short vs long i" },
    { a: ["きて", "come (te-form)"], b: ["きって", "stamp"], what: "single vs double t" },
    { a: ["ここ", "here"], b: ["こうこう", "high school"], what: "short vs long o" },
    { a: ["びよういん", "beauty salon"], b: ["びょういん", "hospital"], what: "bi-yo vs byo" },
    { a: ["しゅじん", "husband"], b: ["しゅうじん", "prisoner"], what: "short vs long u" },
    { a: ["さか", "slope"], b: ["さっか", "author"], what: "single vs double k" },
  ],
  pl: [
    { a: ["kasza", "groats"], b: ["Kasia", "Kasia (a name)"], what: "sz vs ś" },
    { a: ["proszę", "please"], b: ["prosię", "piglet"], what: "sz vs ś" },
    { a: ["los", "fate"], b: ["łoś", "moose"], what: "l vs ł, s vs ś" },
    { a: ["koza", "goat"], b: ["kosa", "scythe"], what: "z vs s" },
    { a: ["czy", "whether"], b: ["ci", "to you"], what: "cz + y vs ć + i" },
    { a: ["bal", "a ball (dance)"], b: ["bał", "he was afraid"], what: "l vs ł" },
  ],
  el: [
    { a: ["πότε", "when?"], b: ["ποτέ", "never"], what: "stress: first or last syllable" },
    { a: ["νόμος", "law"], b: ["νομός", "prefecture"], what: "stress: first or last syllable" },
    { a: ["γέρος", "old man"], b: ["γερός", "strong"], what: "stress: first or last syllable" },
    { a: ["θέμα", "subject"], b: ["δέμα", "parcel"], what: "th vs dh" },
    { a: ["θήκη", "case"], b: ["δίκη", "trial"], what: "th vs dh" },
    { a: ["χαλί", "carpet"], b: ["καλή", "good (f.)"], what: "kh vs k" },
    { a: ["μπάρα", "barrier"], b: ["πάρα", "very (πάρα πολύ)"], what: "b vs p" },
  ],
  pt: [
    { a: ["avó", "grandmother"], b: ["avô", "grandfather"], what: "open ó vs closed ô" },
    { a: ["vela", "candle"], b: ["bela", "beautiful"], what: "v vs b" },
    { a: ["caro", "expensive"], b: ["carro", "car"], what: "tapped r vs throat rr" },
    { a: ["mau", "bad"], b: ["mão", "hand"], what: "plain vs nasal" },
    { a: ["pais", "parents"], b: ["país", "country"], what: "one syllable vs two" },
    { a: ["sono", "sleep"], b: ["sonho", "dream"], what: "n vs nh" },
    { a: ["mala", "suitcase"], b: ["malha", "knitwear"], what: "l vs lh" },
  ],
  ar: [
    { a: ["سَيْف", "sword"], b: ["صَيْف", "summer"], what: "s vs heavy ṣ" },
    { a: ["تِين", "figs"], b: ["طِين", "mud"], what: "t vs heavy ṭ" },
    { a: ["كَلْب", "dog"], b: ["قَلْب", "heart"], what: "k vs deep q" },
    { a: ["هَرَم", "pyramid"], b: ["حَرَم", "sanctuary"], what: "h vs throat ḥ" },
    { a: ["أَلَم", "pain"], b: ["عَلَم", "flag"], what: "hamza vs ʿayn" },
    { a: ["دَلَّ", "he pointed the way"], b: ["ضَلَّ", "he went astray"], what: "d vs heavy ḍ" },
    { a: ["ذَلَّ", "he was humbled"], b: ["ظَلَّ", "he remained"], what: "dh vs heavy ẓ" },
  ],
};
