/* Claude, called straight from the browser with my own key (kept on this device only, src/lib/prefs.ts).
   Every job asks for structured output (a Zod schema → JSON schema) and gets it back parsed.
   Model: Claude Opus 5.5 by default (Settings can switch to Sonnet 5.5 or Haiku 5.5); server-side refusal
   fallback is on for the models that have it. Nothing is sent except the text the job needs. Each answer's token
   counts go to recordUsage() (calls and estimated cost per month and device, shown in Settings → Claude).
   Loaded on demand (import("./claude")): the SDK is most of the bundle. */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod";
import type { AppState, Drill, GTable, Lang, Sentence, Token } from "../types";
import type { Topic } from "../data/grammar";
import { isElided, LANG, stripHarakat } from "./langs";
import { getPrefs, type Model } from "./prefs";
import { recordUsage } from "../state/actions";

export { hasClaude, MODELS } from "./prefs";

let cached: { key: string; client: Anthropic } | null = null;
let fetchImpl: typeof fetch | undefined;
/** Tests: answer requests with a fake fetch. */
export function setFetchForTests(f: typeof fetch | undefined) { fetchImpl = f; cached = null; }

function client(): Anthropic {
  const key = getPrefs().claudeKey;
  if (!key) throw new ClaudeError("Add your Claude API key in Settings first.");
  if (cached?.key !== key) cached = { key, client: new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true, maxRetries: 2, ...(fetchImpl ? { fetch: fetchImpl } : {}) }) };
  return cached.client;
}

export class ClaudeError extends Error {}

function explain(e: unknown): ClaudeError {
  if (e instanceof ClaudeError) return e;
  if (e instanceof Anthropic.AuthenticationError) return new ClaudeError("Claude didn't accept the API key. Check it in Settings.");
  if (e instanceof Anthropic.PermissionDeniedError) return new ClaudeError("This API key isn't allowed to use that model.");
  if (e instanceof Anthropic.RateLimitError) return new ClaudeError("Claude is busy right now (rate limit). Try again in a minute.");
  if (e instanceof Anthropic.BadRequestError) return new ClaudeError(`Claude couldn't do this request: ${e.message}`);
  if (e instanceof Anthropic.APIConnectionError) return new ClaudeError("Couldn't reach Claude. Check the connection.");
  if (e instanceof Anthropic.APIError) {
    // the API's own words help more than a bare number (overloaded, a server error, a stream that broke off)
    const said = (e.error as { error?: { message?: string } } | undefined)?.error?.message;
    return new ClaudeError(`Claude had a problem (${e.status ?? "?"}${said ? `: ${said}` : ""}). Try again.`);
  }
  return new ClaudeError((e as Error)?.message || "Something went wrong.");
}

/** One structured request. `model` overrides the one in Settings (grammar always uses Opus: a wrong ending in a
    table teaches the wrong thing). Lessons don't come through here: they go through the batch queue (startLesson). */
export async function ask<S extends z.ZodType>(schema: S, opts: {
  system: string; user: string; effort?: "low" | "medium" | "high"; maxTokens?: number; history?: Anthropic.Beta.BetaMessageParam[];
  model?: Model;
}): Promise<z.infer<S>> {
  const model = opts.model ?? getPrefs().model;
  const withFallback = model !== "claude-haiku-5-5";
  try {
    const params = {
      model,
      max_tokens: opts.maxTokens ?? 16000,
      ...(withFallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
      system: opts.system,
      messages: [...(opts.history ?? []), { role: "user" as const, content: opts.user }],
      output_config: { format: betaZodOutputFormat(schema), effort: opts.effort ?? "low" },
    };
    const res = await client().beta.messages.parse(params);
    // every answer is billed, refused or cut off too; counting must never break the job
    try { recordUsage(res.model || model, res.usage); } catch (e) { console.warn("[claude] usage not recorded", e); }
    if (res.stop_reason === "refusal") throw new ClaudeError("Claude declined this one. Try different wording.");
    if (res.stop_reason === "max_tokens") throw new ClaudeError("The answer was too long and got cut off. Try something shorter.");
    if (res.parsed_output == null) throw new ClaudeError("Claude's answer didn't come back in the expected shape. Try again.");
    return res.parsed_output as z.infer<S>;
  } catch (e) {
    throw explain(e);
  }
}

// ── shared pieces ─────────────────────────────────────────────

/** Tokens: every field a string ("" when it doesn't apply), so the schema stays strict. */
const TokenZ = z.object({
  t: z.string().describe("the surface text exactly as written (Arabic: fully vowelled)"),
  l: z.string().describe("dictionary form; \"\" for spaces, punctuation, numbers and names"),
  r: z.string().describe("Japanese: hiragana reading of t when t contains kanji, else \"\". Other languages: \"\""),
  g: z.string().describe("short English meaning of this word in this sentence, with a grammar hint in brackets when useful; \"\" for spaces and punctuation"),
  x: z.string().describe("Arabic: transliteration of t (e.g. al-kitābu); others: \"\""),
});
const SentenceZ = z.object({ tokens: z.array(TokenZ), tr: z.string().describe("natural English translation of the sentence") });

type RawSentence = z.infer<typeof SentenceZ>;

export function cleanSentence(lang: Lang, s: RawSentence): Sentence {
  const tokens: Token[] = s.tokens.filter((t) => t.t !== "").map((t) => ({
    t: t.t,
    ...(t.l.trim() ? { l: t.l.trim() } : {}),
    ...(lang === "ja" && t.r && t.r !== t.t ? { r: t.r } : {}),
    ...(t.g.trim() && t.l.trim() ? { g: t.g.trim() } : {}),
    ...(lang === "ar" && t.x.trim() ? { x: t.x.trim() } : {}),
  }));
  // Space-separated languages: make sure words are separated even if Claude left the spaces out.
  if (LANG[lang].spaces) {
    for (let i = tokens.length - 1; i > 0; i--) {
      const a = tokens[i - 1], b = tokens[i];
      if (a.l && b.l && !/\s$/.test(a.t) && !/^\s/.test(b.t) && !isElided(a.t)) tokens.splice(i, 0, { t: " " });
    }
  }
  return { tokens, tr: s.tr };
}

const LANG_RULES: Record<Lang, string> = {
  ja: "Japanese. Split into words the way a learner's dictionary would (particles, verbs with their endings as one token, e.g. 食べました). Lemma = dictionary form (食べる). Give hiragana readings in r for every token containing kanji. Use common kanji normally.",
  pl: "Polish. Lemma = dictionary form: infinitive for verbs, nominative singular for nouns, masculine nominative singular for adjectives. In g, mention the case or form when it isn't the dictionary form, e.g. \"coffee (acc.)\".",
  el: "Modern Greek as spoken in Greece today, in standard monotonic spelling with the accent mark (τόνος) on every word of two or more syllables. Lemma = dictionary form: 1st person singular present for verbs (τρώω, μιλάω, κοιμάμαι), nominative singular for nouns, masculine nominative singular for adjectives (καλός). Articles are their own tokens (lemma ο). Contractions like στο, στη, στην are one token with lemma σε. Weak pronouns (μου, σου, τον) are their own tokens, lemma the strong form (εγώ, εσύ, αυτός). In g, mention the case or form when it isn't the dictionary form, e.g. \"coffee (acc.)\". The Greek question mark is ;.",
  pt: "European Portuguese as spoken in Portugal (pt-PT), never Brazilian Portuguese: tu for an informal you (with its verb forms) and o senhor / a senhora for a formal one, estar a + infinitive for what is happening now (estou a ler), object pronouns after the verb where Portugal puts them (dá-me, chamo-me), and the words used in Portugal (autocarro, comboio, pequeno-almoço, telemóvel, casa de banho, sumo, rapariga, fixe). Spelling of the 1990 agreement (ação, ótimo, facto). Lemma = dictionary form: infinitive for verbs, singular for nouns, masculine singular for adjectives. Contractions (do, na, ao, à, pela, num) are one token whose lemma is the preposition (de, em, a, por). A verb with a hyphenated pronoun (dá-me) is one token whose lemma is the infinitive. In g, mention the tense or form when it isn't the dictionary form, e.g. \"I went (past)\".",
  ru: "Russian (standard, as spoken in Russia today). Mark the stress with a combining acute accent (U+0301) right after the stressed vowel of every word of two or more syllables, in both t and l, as learner texts do (молоко́, говори́ть); ё is always written as ё and takes no mark. Lemma = dictionary form: infinitive for verbs (говори́ть, of the aspect used), nominative singular for nouns, masculine nominative singular for adjectives (хоро́ший). Prepositions are their own tokens. In g, mention the case or form when it isn't the dictionary form, e.g. \"coffee (acc.)\", \"I went (past)\".",
  es: "Spanish. Use the variety the learner names in their level description (Spain, Mexico, Argentina…: vosotros or ustedes, vos, and that region's words and expressions); if none is named, standard Spanish understood everywhere. The learner is advanced: write and speak the way native speakers really do, colloquial expressions and idioms included, at natural speed and length. Lemma = dictionary form: infinitive for verbs (with -se when the verb is used pronominally: enterarse), singular for nouns, masculine singular for adjectives. Contractions (al, del) are one token whose lemma is the preposition (a, de). Opening ¿ and ¡ are their own punctuation tokens. In g, mention the tense or mood when it isn't the dictionary form, e.g. \"you'd come (subj. impf.)\".",
  fr: "French as spoken in France today, unless the learner's level description names another variety (Québec, Belgium, Switzerland). The learner is advanced: write and speak the way native speakers really do (spoken French drops ne, uses on for nous, colloquial words and verlan where natural), at natural speed and length. Lemma = dictionary form: infinitive for verbs (pronominal verbs without se: se débrouiller → débrouiller), masculine singular for nouns and adjectives. An elided word (j', l', qu', c', d', n', s', m', t') is its own token ending in the apostrophe, lemma the full word (je, le, que, ce, de, ne, se, me, te); the next word follows with no space. Contractions (au, aux, du, des) are one token whose lemma is the preposition (à, de). A verb with a hyphenated pronoun (passe-moi, dis-lui) is one token whose lemma is the infinitive. In g, mention the tense or mood when it isn't the dictionary form, e.g. \"he'd come (cond.)\".",
  it: "Standard Italian as spoken in Italy today. The learner is advanced: write and speak the way native speakers really do, colloquial expressions and idioms included, at natural speed and length. Lemma = dictionary form: infinitive for verbs (with -si or -sene when used pronominally: arrangiarsi, fregarsene), singular for nouns, masculine singular for adjectives. An elided word (l', un', dell', all', c', m', t', s') is its own token ending in the apostrophe, lemma the full word (il, uno, di, a, ci, mi, ti, si); the next word follows with no space. Articulated prepositions (del, nella, al, sul, dalla) are one token whose lemma is the preposition (di, in, a, su, da). A verb with attached pronouns (dimmi, sbrigati, prenderlo) is one token whose lemma is the infinitive. In g, mention the tense or mood when it isn't the dictionary form, e.g. \"that he come (subj.)\".",
  de: "German as spoken in Germany (Standarddeutsch), unless the learner's level description names Austria or Switzerland. Nouns are capitalised: a noun's lemma is its nominative singular with its capital (Hund); every other lemma is lower-case, even at the start of a sentence (Ich → ich). Lemma = infinitive for verbs, base form for adjectives. A separable verb split in the sentence (ruft … an) has both parts' lemma = the whole infinitive (anrufen). Reflexive verbs are stored without sich (sich freuen → freuen). Contractions (im, ins, am, zum, zur, beim, vom) are one token whose lemma is the preposition (in, an, zu, bei, von). In g, give a noun's article when it helps (\"the train, der\") and mention the case or form when it isn't the dictionary form, e.g. \"you (acc.)\", \"I went (past)\".",
  nl: "Dutch as spoken in the Netherlands, unless the learner's level description names Flanders (Belgium). Lemma = infinitive for verbs, singular for nouns (a diminutive keeps -je: biertje), base form for adjectives; every lemma is lower-case except names. A separable verb split in the sentence (bel … op) has both parts' lemma = the whole infinitive (opbellen). Reflexive verbs are stored without zich (zich vergissen → vergissen). In g, give a noun's article when it helps (\"the house, het\") and mention the tense or form when it isn't the dictionary form, e.g. \"I went (past)\".",
  ar: "Modern Standard Arabic (فصحى), not a dialect. Write every word fully vowelled with harakat (including case endings where natural). Lemma = vowelled dictionary form: past tense 3rd person masculine singular for verbs (كَتَبَ), singular indefinite without case ending for nouns (كِتَاب). Prefixes like وَ، الْ، بِ stay attached to their word as one token. Give a transliteration in x.",
};

const TOKEN_RULES = "Tokens: concatenating every t in order must give back the sentence exactly. Spaces and punctuation are their own tokens with l, g, r, x empty. Names get l = \"\".";

/** The words I know or am learning, as a compact list (most recent first, capped). */
export function knownList(s: AppState, lang: Lang, max = 700): string {
  const ws = s.words.filter((w) => w.lang === lang && !w.deletedAt && (w.status === "known" || w.status === "learning"))
    .sort((a, b) => b.updatedAt - a.updatedAt).slice(0, max);
  return ws.map((w) => (lang === "ar" ? stripHarakat(w.lemma) : w.lemma)).join(", ");
}

// ── jobs ──────────────────────────────────────────────────────

const StoryZ = z.object({
  title: z.string(),
  title_tr: z.string(),
  new_words: z.array(z.string()).describe("lemmas of the words in the story that are not on the known list"),
  sentences: z.array(SentenceZ),
});

export async function writeStory(lang: Lang, o: { level: string; known: string; topic: string; lines: number; newWords: number; grammar?: Topic }) {
  const r = await ask(StoryZ, {
    effort: "medium",
    system: `You write graded reading for a language learner, in ${LANG_RULES[lang]}\n${TOKEN_RULES}\nThe learner says about their level: "${o.level}"`,
    user: [
      `Write a short, coherent story of about ${o.lines} sentences${o.topic.trim() ? ` about: ${o.topic.trim()}` : ""}.`,
      `Words the learner knows (dictionary forms): ${o.known || "(almost none yet)"}`,
      `Rules: at least 95% of the words must be from that list or basic grammar words. Use exactly ${o.newWords} new words, each one useful and common, and repeat each new word at least twice. Keep sentences short and natural; a little humour or a small twist is welcome. List the new words' lemmas in new_words.`,
      o.grammar ? `Grammar practice: the learner is studying "${o.grammar.title}" (${o.grammar.covers}). Use it naturally and often, in as many different forms as the story allows, and mark it in g (e.g. "coffee (acc.)").` : "",
    ].filter(Boolean).join("\n"),
  });
  return { title: r.title, titleTr: r.title_tr, newWords: r.new_words, sentences: r.sentences.map((x) => cleanSentence(lang, x)) };
}

const AnnotZ = z.object({ title_tr: z.string(), sentences: z.array(SentenceZ) });

/** Annotate a pasted text, a chunk of sentences at a time. */
export async function annotate(lang: Lang, lines: string[], onProgress?: (done: number) => void) {
  const out: Sentence[] = [];
  let titleTr = "";
  for (let i = 0; i < lines.length; i += 12) {
    const chunk = lines.slice(i, i + 12);
    const r = await ask(AnnotZ, {
      system: `You annotate texts for a language learner. Language: ${LANG_RULES[lang]}\n${TOKEN_RULES}`,
      user: `Annotate each of these ${chunk.length} sentences, in order, one entry per line. title_tr: a short English title for the text.\n\n${chunk.map((l, j) => `${j + 1}. ${l}`).join("\n")}`,
    });
    if (!titleTr) titleTr = r.title_tr;
    out.push(...r.sentences.map((x) => cleanSentence(lang, x)));
    onProgress?.(Math.min(lines.length, i + chunk.length));
  }
  return { titleTr, sentences: out };
}

const ExplainZ = z.object({
  lemma: z.string(),
  reading: z.string().describe("Japanese: hiragana reading of the lemma; others \"\""),
  translit: z.string().describe("romaji (Japanese) or transliteration (Arabic) of the lemma; Polish, Greek, Portuguese: \"\""),
  gloss: z.string().describe("English meaning(s), short"),
  pos: z.string().describe("part of speech, with gender for nouns or verb group for verbs"),
  explanation: z.string().describe("2–4 short sentences: what the word does in this sentence and the form it's in, in plain English for a beginner. Portuguese: say how it compares with the Spanish word when that helps, especially false friends"),
  root: z.string().describe("Arabic: the root letters separated by spaces (ك ت ب); others \"\""),
  hebrew: z.string().describe("Arabic: a real Hebrew cognate with its meaning if there is one, e.g. כָּתַב (write); otherwise \"\""),
});
export type Explanation = z.infer<typeof ExplainZ>;

export function explainWord(lang: Lang, tok: Token, s: Sentence, level: string) {
  return ask(ExplainZ, {
    system: `You explain words to a language learner. Language: ${LANG_RULES[lang]}\nThe learner says about their level: "${level}". The learner reads Hebrew and English.`,
    user: `Sentence: ${s.tokens.map((t) => t.t).join("")}\nTranslation: ${s.tr}\nExplain the word: ${tok.t}`,
  });
}

const NextWordsZ = z.object({
  words: z.array(z.object({
    lemma: z.string(), reading: z.string(), translit: z.string(), gloss: z.string(), pos: z.string(),
    note: z.string().describe("a short grammar note or mnemonic; \"\" if none"),
    root: z.string(), hebrew: z.string(),
    example: SentenceZ.describe("one short example sentence that uses mostly known words"),
  })),
});

/** The next most useful words I don't have yet. */
export async function suggestWords(lang: Lang, o: { level: string; have: string; count: number; topic?: string }) {
  const r = await ask(NextWordsZ, {
    system: `You pick vocabulary for a language learner. Language: ${LANG_RULES[lang]}\n${TOKEN_RULES} (for the example sentences)\nThe learner says about their level: "${o.level}". The learner reads Hebrew; for Arabic give a real Hebrew cognate when one exists (else ""), and the root.`,
    user: `Words the learner already has: ${o.have || "(none)"}\nSuggest the ${o.count} most frequent, useful words they don't have yet${o.topic ? `, around the topic: ${o.topic}` : ""}, roughly in order of frequency. Japanese: reading in hiragana, translit in romaji. Arabic: lemma fully vowelled, translit in Latin letters. Polish, Greek and Portuguese: translit "". Portuguese: words as used in Portugal; in note, flag a Spanish false friend or a word that differs from Brazil, else "".`,
  });
  return r.words.map((w) => ({ ...w, example: cleanSentence(lang, w.example) }));
}

/** A tiny request to check the key and model. */
export async function testKey() {
  const r = await ask(z.object({ ok: z.string() }), { system: "Reply with ok = \"yes\".", user: "Test." , maxTokens: 2000 });
  return r.ok;
}

// ── conversation ──────────────────────────────────────────────

const TurnZ = z.object({
  fix: z.object({
    needed: z.boolean().describe("true if the learner's last message had a mistake or sounded unnatural"),
    better: z.string().describe("the corrected, natural version of the learner's last message in the target language; \"\" if not needed"),
    why: z.string().describe("one short sentence in English on what was wrong; \"\" if not needed"),
    topic: z.string().describe("the id of the grammar topic the mistake is about, from the list given; \"\" if none fits or no fix"),
  }),
  reply: SentenceZ.describe("your next line in the conversation, as one sentence entry (it may contain two short sentences)"),
});

export interface ChatLine { who: "me" | "them"; text: string }

/** The grammar topics as "id: title" lines, for Claude to tag a correction with ("" when the language has none). */
function topicLines(topics: Topic[] | undefined): string {
  return topics?.length ? `Grammar topics (for the topic field): ${topics.map((t) => `${t.id} = ${t.title}`).join("; ")}` : "There are no grammar topics: leave topic \"\".";
}

export async function chatTurn(lang: Lang, o: { level: string; known: string; scenario: string; lines: ChatLine[]; topics?: Topic[] }) {
  const transcript = o.lines.map((l) => `${l.who === "me" ? "Learner" : "You"}: ${l.text}`).join("\n");
  const r = await ask(TurnZ, {
    system: [
      `You are a friendly conversation partner for a language learner, speaking ${LANG_RULES[lang]}`,
      TOKEN_RULES,
      `Role-play this scene, staying in character: ${o.scenario}`,
      `The learner says about their level: "${o.level}". Words they know: ${o.known || "(very few)"}`,
      "Speak at their level: one or two short sentences, mostly words they know, and end with a question or a prompt so they have something to answer. Never switch to English in your reply.",
      "If the learner writes in English or Hebrew, they're stuck: reply in the target language with the phrase they need, simply.",
      "Correct the learner's last message only for real mistakes or clearly unnatural phrasing; ignore missing accents or vowel marks.",
      topicLines(o.topics),
    ].join("\n"),
    user: transcript ? `Conversation so far:\n${transcript}\n\nYour turn.` : "Start the conversation with your first line.",
  });
  return {
    reply: cleanSentence(lang, r.reply),
    fix: r.fix.needed && r.fix.better.trim() ? { better: r.fix.better.trim(), why: r.fix.why.trim(), ...(validTopic(o.topics, r.fix.topic) ? { topic: r.fix.topic } : {}) } : undefined,
  };
}

const ReviewZ = z.object({
  summary: z.string().describe("2–3 encouraging sentences in English: what went well, one thing to work on"),
  points: z.array(z.object({
    said: z.string().describe("what the learner wrote"),
    better: z.string().describe("the natural version in the target language"),
    tr: z.string().describe("English meaning of the better version"),
    why: z.string().describe("short English explanation"),
    topic: z.string().describe("the id of the grammar topic the mistake is about, from the list given; \"\" if none fits"),
  })).describe("the learner's most useful mistakes, at most 5"),
  words: z.array(z.object({ lemma: z.string(), reading: z.string(), translit: z.string(), gloss: z.string(), pos: z.string() }))
    .describe("up to 5 words from the conversation worth learning that aren't on the known list"),
});

export async function reviewChat(lang: Lang, o: { level: string; known: string; scenario: string; lines: ChatLine[]; topics?: Topic[] }) {
  const r = await ask(ReviewZ, {
    system: `You coach a language learner after a practice conversation in ${LANG_RULES[lang]}\nThe learner says about their level: "${o.level}". Words they know: ${o.known || "(very few)"}\n${topicLines(o.topics)}`,
    user: `Scene: ${o.scenario}\n\n${o.lines.map((l) => `${l.who === "me" ? "Learner" : "Partner"}: ${l.text}`).join("\n")}\n\nReview it.`,
  });
  return { ...r, points: r.points.map((p) => ({ ...p, topic: validTopic(o.topics, p.topic) ? p.topic : "" })) };
}

const validTopic = (topics: Topic[] | undefined, id: string) => !!id && !!topics?.some((t) => t.id === id);

// ── grammar ───────────────────────────────────────────────────

const TableZ = z.object({
  title: z.string().describe("what the table shows, in English"),
  cols: z.array(z.string()).describe("column headings; the first one heads the row-heading column (e.g. \"case\" or \"person\")"),
  rows: z.array(z.object({
    head: z.string().describe("row heading (e.g. \"accusative\", \"ja\", \"ich\")"),
    cells: z.array(z.string()).describe("one cell per column after the first, in the target language; \"–\" where there is no form"),
  })),
  note: z.string().describe("one short line under the table, or \"\""),
});

const DrillZ = z.object({
  sentence: z.string().describe("a short, natural sentence in the target language with exactly one gap written ___ where the answer goes"),
  base: z.string().describe("the dictionary form of the word(s) to put into the right form, shown in brackets after the sentence; \"\" if the gap isn't a form of a given word"),
  hint: z.string().describe("what's asked, in 1–3 English words (\"accusative\", \"we, past\", \"after mit\")"),
  answer: z.string().describe("exactly what fills the gap"),
  alts: z.array(z.string()).describe("other fillings that are just as right; [] if none"),
  tr: z.string().describe("English translation of the whole sentence"),
  why: z.string().describe("one short English sentence: why this form"),
  reading: z.string().describe("Japanese: the whole sentence in hiragana, with ___ for the gap; Arabic: the whole sentence in Latin transliteration with ___ for the gap; other languages: \"\""),
  answer_reading: z.string().describe("Japanese: the answer in hiragana; Arabic: the answer in Latin transliteration, case ending included (kitāba); other languages: \"\""),
});

function grammarSystem(lang: Lang, level: string) {
  return [
    `You are an expert teacher of ${LANG[lang].name} grammar, writing for one learner. Language: ${LANG_RULES[lang]}`,
    TOKEN_RULES,
    `The learner says about their level: "${level}". They read Hebrew and English; compare with Hebrew or English only where it really helps.`,
    "Accuracy comes first: every form in every table, example and answer must be correct standard usage. Check each one before you write it.",
    lang === "ru" ? "Russian: put the stress mark (U+0301) on every word of two or more syllables everywhere: table cells, examples, drill sentences, answers, mistakes." : "",
    lang === "ja" ? "Japanese: in table cells and mistakes, follow every form that has kanji with its hiragana reading in brackets: 食べます (たべます). Use kanji only for common words." : "",
    lang === "ar" ? "Arabic: write every form fully vowelled. In table cells follow each form with its transliteration in brackets: كَتَبْتُ (katabtu). Exercises on case endings must show the ending in answer_reading." : "",
    "Write in plain, friendly English for a learner, short sentences, no jargon without explaining it.",
  ].filter(Boolean).join("\n");
}

const LessonZ = z.object({
  intro: z.array(z.string()).describe("3–6 short paragraphs explaining the point: what it is, when it's used, how the forms are made. May use **bold** for key terms; target-language words written as they are"),
  tables: z.array(TableZ).describe("1–4 tables of the forms (endings, or a word in every person / case), small enough for a phone: at most 5 columns"),
  examples: z.array(z.object({
    sentence: SentenceZ,
    focus: z.array(z.string()).describe("the t of each token in the sentence that shows the point, exactly as written there"),
  })).describe("6–8 short example sentences that show the point, using mostly words the learner knows"),
  compare: z.string().describe("one short paragraph on how Hebrew or English does this, if that genuinely helps; else \"\""),
  mistakes: z.array(z.object({ wrong: z.string(), right: z.string(), why: z.string() })).describe("2–4 typical mistakes of English or Hebrew speakers, wrong and right in the target language"),
  drills: z.array(DrillZ).describe("12 exercises from easy to harder, covering every form in the tables; mostly known words"),
});

/** Drills get ids unique to the batch (time + index), so a rewritten lesson's drills never take over the progress
    of the old ones. */
function cleanDrills(raw: z.infer<typeof DrillZ>[]): Drill[] {
  const stamp = Date.now().toString(36);
  const ok = raw.filter((d) => d.sentence.includes("___") && d.answer.trim());
  return ok.map((d, i) => ({
    id: `${stamp}-${i + 1}`, sentence: d.sentence.trim(), base: d.base.trim(), hint: d.hint.trim(), answer: d.answer.trim(),
    alts: d.alts.map((a) => a.trim()).filter(Boolean), tr: d.tr.trim(), why: d.why.trim(),
    ...(d.reading.trim() ? { reading: d.reading.trim() } : {}), ...(d.answer_reading.trim() ? { answerReading: d.answer_reading.trim() } : {}),
  }));
}

const cleanTable = (t: z.infer<typeof TableZ>): GTable => ({
  title: t.title.trim(), cols: t.cols, rows: t.rows.filter((r) => r.head.trim() || r.cells.some((c) => c.trim())), ...(t.note.trim() ? { note: t.note.trim() } : {}),
});

/* A grammar lesson for one topic (always Claude Opus 5.5, effort high). Writing one takes Claude minutes, longer than
   a page reliably lives on a phone, so it goes through the Message Batches API: startLesson() hands the request over
   and returns the batch id, checkLesson() asks later (from any page, after the app was closed). Half price; a batch
   request can't use the server-side fallback, so a refusal is shown as one. Results are kept 29 days. */

const LESSON_MAX = 64000; // thinking at effort high counts toward it

function lessonRequest(lang: Lang, topic: Topic, o: { level: string; known: string }) {
  return {
    model: "claude-opus-5-5" as const,
    max_tokens: LESSON_MAX,
    system: grammarSystem(lang, o.level),
    messages: [{ role: "user" as const, content: [
      `Write a lesson on: ${topic.title} (${topic.level}).`,
      `It has to cover: ${topic.covers}`,
      `Words the learner knows (use them in examples and exercises where you can): ${o.known || "(very few yet)"}`,
      "Exercises: each tests one form from the lesson; vary persons, genders, numbers and verbs; never two with the same answer.",
    ].join("\n") }],
    output_config: { format: betaZodOutputFormat(LessonZ), effort: "high" as const },
  };
}

function lessonFrom(lang: Lang, r: z.infer<typeof LessonZ>) {
  return {
    intro: r.intro.map((p) => p.trim()).filter(Boolean),
    tables: r.tables.map(cleanTable),
    examples: r.examples.map((e) => {
      const sn = cleanSentence(lang, e.sentence);
      const want = new Set(e.focus.map((f) => f.trim()));
      return { s: sn, focus: sn.tokens.flatMap((t, i) => (t.l && want.has(t.t) ? [i] : [])) };
    }),
    compare: r.compare.trim(),
    mistakes: r.mistakes.filter((m) => m.right.trim()),
    drills: cleanDrills(r.drills),
  };
}

export type LessonResult = ReturnType<typeof lessonFrom>;

/** Hand a lesson to Claude's batch queue; the id is what checkLesson() needs. */
export async function startLesson(lang: Lang, topic: Topic, o: { level: string; known: string }): Promise<string> {
  try {
    const b = await client().beta.messages.batches.create({ requests: [{ custom_id: `lesson-${topic.id}`, params: lessonRequest(lang, topic, o) }] });
    return b.id;
  } catch (e) { throw explain(e); }
}

export type LessonCheck = { state: "waiting" } | { state: "done"; lesson: LessonResult } | { state: "failed"; error: string };

/** Is the lesson written yet? Network trouble throws (try again later); anything that ended the batch is "failed". */
export async function checkLesson(lang: Lang, batchId: string): Promise<LessonCheck> {
  try {
    const b = await client().beta.messages.batches.retrieve(batchId);
    if (b.processing_status !== "ended") return { state: "waiting" };
    for await (const item of await client().beta.messages.batches.results(batchId)) {
      const r = item.result;
      if (r.type === "expired") return { state: "failed", error: "Claude's queue didn't get to it within 24 hours. Try again." };
      if (r.type === "canceled") return { state: "failed", error: "The lesson was canceled." };
      if (r.type === "errored") {
        const said = (r.error as { error?: { message?: string } } | undefined)?.error?.message;
        return { state: "failed", error: `Claude couldn't write it${said ? `: ${said}` : ""}. Try again.` };
      }
      const m = r.message;
      try { recordUsage(m.model || "claude-opus-5-5", m.usage, { batch: true }); } catch (e) { console.warn("[claude] usage not recorded", e); }
      if (m.stop_reason === "refusal") return { state: "failed", error: "Claude declined to write this one." };
      if (m.stop_reason === "max_tokens") return { state: "failed", error: "The lesson was too long and got cut off. Try again." };
      const text = m.content.flatMap((c) => (c.type === "text" ? [c.text] : [])).join("");
      const parsed = LessonZ.safeParse((() => { try { return JSON.parse(text); } catch { return null; } })());
      if (!parsed.success) return { state: "failed", error: "Claude's lesson didn't come back in the expected shape. Try again." };
      return { state: "done", lesson: lessonFrom(lang, parsed.data) };
    }
    return { state: "failed", error: "The batch ended without a lesson. Try again." };
  } catch (e) {
    if (e instanceof Anthropic.NotFoundError) return { state: "failed", error: "Claude no longer has this lesson (results are kept 29 days). Try again." };
    throw explain(e);
  }
}

/** Stop waiting for a lesson (best effort: it may already be done). */
export async function cancelLesson(batchId: string) {
  try { await client().beta.messages.batches.cancel(batchId); } catch { /* ended already, or offline: the job is dropped anyway */ }
}

const MoreDrillsZ = z.object({ drills: z.array(DrillZ).describe("new exercises, none repeating one the learner already has") });

/** More exercises for a lesson, unlike the ones it has. */
export async function moreDrills(lang: Lang, topic: Topic, o: { level: string; known: string; have: Drill[]; count?: number }) {
  const r = await ask(MoreDrillsZ, {
    model: "claude-opus-5-5", effort: "medium", maxTokens: 20000,
    system: grammarSystem(lang, o.level),
    user: [
      `Topic: ${topic.title}. It covers: ${topic.covers}`,
      `Words the learner knows: ${o.known || "(very few yet)"}`,
      `Exercises the learner already has (don't repeat these sentences or answers):\n${o.have.map((d) => `- ${d.sentence} → ${d.answer}`).join("\n")}`,
      `Write ${o.count ?? 10} new exercises, from easy to harder.`,
    ].join("\n"),
  });
  return cleanDrills(r.drills);
}

const FormsZ = z.object({
  tables: z.array(TableZ).describe("the word's full paradigm, as tables small enough for a phone (at most 5 columns): nouns by case × number, adjectives by case × gender/number, verbs by person × tense (present, past, future; also the imperative and for Polish/Russian the aspect partner). [] if the word doesn't change"),
  note: z.string().describe("one or two lines: gender, aspect partner, stem changes or irregularities worth knowing; \"\" if none"),
});

/** Every form of one word (always Claude Opus 5.5). */
export async function wordForms(lang: Lang, w: { lemma: string; gloss: string; pos?: string }, level: string) {
  const r = await ask(FormsZ, {
    model: "claude-opus-5-5", effort: "medium", maxTokens: 20000,
    system: grammarSystem(lang, level),
    user: `Give every form of: ${w.lemma} (${w.gloss}${w.pos ? `, ${w.pos}` : ""}).`,
  });
  return { tables: r.tables.map(cleanTable), note: r.note.trim() };
}
