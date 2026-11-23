/* Claude, called straight from the browser with my own key (kept on this device only, src/lib/prefs.ts).
   Every job asks for structured output (a Zod schema → JSON schema) and gets it back parsed.
   Model: Claude Opus 5.5 by default (Settings can switch to Sonnet 5.5 or Haiku 5.5); server-side refusal
   fallback is on for the models that have it. Nothing is sent except the text the job needs.
   Loaded on demand (import("./claude")): the SDK is most of the bundle. */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod";
import type { AppState, Lang, Sentence, Token } from "../types";
import { LANG, stripHarakat } from "./langs";
import { getPrefs } from "./prefs";

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
  if (e instanceof Anthropic.APIError) return new ClaudeError(`Claude had a problem (${e.status ?? "?"}). Try again.`);
  return new ClaudeError((e as Error)?.message || "Something went wrong.");
}

/** One structured request. */
export async function ask<S extends z.ZodType>(schema: S, opts: {
  system: string; user: string; effort?: "low" | "medium" | "high"; maxTokens?: number; history?: Anthropic.Beta.BetaMessageParam[];
}): Promise<z.infer<S>> {
  const model = getPrefs().model;
  const withFallback = model !== "claude-haiku-5-5";
  try {
    const res = await client().beta.messages.parse({
      model,
      max_tokens: opts.maxTokens ?? 16000,
      ...(withFallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
      system: opts.system,
      messages: [...(opts.history ?? []), { role: "user", content: opts.user }],
      output_config: { format: betaZodOutputFormat(schema), effort: opts.effort ?? "low" },
    });
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
      if (a.l && b.l && !/\s$/.test(a.t) && !/^\s/.test(b.t)) tokens.splice(i, 0, { t: " " });
    }
  }
  return { tokens, tr: s.tr };
}

const LANG_RULES: Record<Lang, string> = {
  ja: "Japanese. Split into words the way a learner's dictionary would (particles, verbs with their endings as one token, e.g. 食べました). Lemma = dictionary form (食べる). Give hiragana readings in r for every token containing kanji. Use common kanji normally.",
  pl: "Polish. Lemma = dictionary form: infinitive for verbs, nominative singular for nouns, masculine nominative singular for adjectives. In g, mention the case or form when it isn't the dictionary form, e.g. \"coffee (acc.)\".",
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

export async function writeStory(lang: Lang, o: { level: string; known: string; topic: string; lines: number; newWords: number }) {
  const r = await ask(StoryZ, {
    effort: "medium",
    system: `You write graded reading for a language learner, in ${LANG_RULES[lang]}\n${TOKEN_RULES}\nThe learner says about their level: "${o.level}"`,
    user: [
      `Write a short, coherent story of about ${o.lines} sentences${o.topic.trim() ? ` about: ${o.topic.trim()}` : ""}.`,
      `Words the learner knows (dictionary forms): ${o.known || "(almost none yet)"}`,
      `Rules: at least 95% of the words must be from that list or basic grammar words. Use exactly ${o.newWords} new words, each one useful and common, and repeat each new word at least twice. Keep sentences short and natural; a little humour or a small twist is welcome. List the new words' lemmas in new_words.`,
    ].join("\n"),
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
  translit: z.string().describe("romaji (Japanese) or transliteration (Arabic) of the lemma; Polish: \"\""),
  gloss: z.string().describe("English meaning(s), short"),
  pos: z.string().describe("part of speech, with gender for nouns or verb group for verbs"),
  explanation: z.string().describe("2–4 short sentences: what the word does in this sentence and the form it's in, in plain English for a beginner"),
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
    user: `Words the learner already has: ${o.have || "(none)"}\nSuggest the ${o.count} most frequent, useful words they don't have yet${o.topic ? `, around the topic: ${o.topic}` : ""}, roughly in order of frequency. Japanese: reading in hiragana, translit in romaji. Arabic: lemma fully vowelled, translit in Latin letters. Polish: translit "".`,
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
  }),
  reply: SentenceZ.describe("your next line in the conversation, as one sentence entry (it may contain two short sentences)"),
});

export interface ChatLine { who: "me" | "them"; text: string }

export async function chatTurn(lang: Lang, o: { level: string; known: string; scenario: string; lines: ChatLine[] }) {
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
    ].join("\n"),
    user: transcript ? `Conversation so far:\n${transcript}\n\nYour turn.` : "Start the conversation with your first line.",
  });
  return {
    reply: cleanSentence(lang, r.reply),
    fix: r.fix.needed && r.fix.better.trim() ? { better: r.fix.better.trim(), why: r.fix.why.trim() } : undefined,
  };
}

const ReviewZ = z.object({
  summary: z.string().describe("2–3 encouraging sentences in English: what went well, one thing to work on"),
  points: z.array(z.object({
    said: z.string().describe("what the learner wrote"),
    better: z.string().describe("the natural version in the target language"),
    tr: z.string().describe("English meaning of the better version"),
    why: z.string().describe("short English explanation"),
  })).describe("the learner's most useful mistakes, at most 5"),
  words: z.array(z.object({ lemma: z.string(), reading: z.string(), translit: z.string(), gloss: z.string(), pos: z.string() }))
    .describe("up to 5 words from the conversation worth learning that aren't on the known list"),
});

export function reviewChat(lang: Lang, o: { level: string; known: string; scenario: string; lines: ChatLine[] }) {
  return ask(ReviewZ, {
    system: `You coach a language learner after a practice conversation in ${LANG_RULES[lang]}\nThe learner says about their level: "${o.level}". Words they know: ${o.known || "(very few)"}`,
    user: `Scene: ${o.scenario}\n\n${o.lines.map((l) => `${l.who === "me" ? "Learner" : "Partner"}: ${l.text}`).join("\n")}\n\nReview it.`,
  });
}
