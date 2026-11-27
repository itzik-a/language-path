import { afterEach, describe, expect, it } from "vitest";
import { annotate, ClaudeError, setFetchForTests, writeStory } from "../src/lib/claude";
import { setPrefs } from "../src/lib/prefs";
import { sentenceText } from "../src/lib/tokens";
import { getState } from "../src/state/store";

type Sent = { url: string; headers: Headers; body: Record<string, unknown> };

function fake(payload: unknown, opts: { status?: number; stop?: string } = {}) {
  const sent: Sent[] = [];
  setFetchForTests((async (url: string | URL | Request, init?: RequestInit) => {
    sent.push({ url: String(url), headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) });
    if (opts.status && opts.status !== 200) {
      return new Response(JSON.stringify({ type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }), { status: opts.status, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({
      id: "msg_1", type: "message", role: "assistant", model: "claude-opus-5-5",
      content: [{ type: "text", text: JSON.stringify(payload) }],
      stop_reason: opts.stop ?? "end_turn", stop_sequence: null, usage: { input_tokens: 10, output_tokens: 10 },
    }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch);
  return sent;
}

const tok = (t: string, l = "", g = "", r = "", x = "") => ({ t, l, g, r, x });

afterEach(() => setFetchForTests(undefined));

describe("Claude jobs", () => {
  it("writes a story: structured output, Opus 5.5 with fallback, cleaned tokens", async () => {
    setPrefs({ claudeKey: "sk-ant-test", model: "claude-opus-5-5" });
    const sent = fake({
      title: "Kot", title_tr: "The cat", new_words: ["spać"],
      sentences: [{ tokens: [tok("Kot", "kot", "cat"), tok("śpi", "spać", "sleeps"), tok(".")], tr: "The cat sleeps." }],
    });
    const r = await writeStory("pl", { level: "beginner", known: "kot", topic: "cats", lines: 3, newWords: 1 });
    expect(sentenceText(r.sentences[0])).toBe("Kot śpi.");
    expect(r.sentences[0].tokens[2]).toEqual({ t: "śpi", l: "spać", g: "sleeps" });
    expect(r.sentences[0].tokens[3]).toEqual({ t: "." });
    const req = sent[0];
    expect(req.url).toContain("/v1/messages");
    expect(req.body.model).toBe("claude-opus-5-5");
    expect(req.body.fallbacks).toBe("default");
    expect(req.headers.get("anthropic-beta")).toContain("server-side-fallback-2026-07-01");
    expect(req.headers.get("authorization")).toBe("Bearer sk-ant-test");
    expect((req.body.output_config as { format: { type: string } }).format.type).toBe("json_schema");
    expect((req.body.output_config as { effort: string }).effort).toBe("medium");
  });

  it("counts each answer's calls and cost toward this month", async () => {
    setPrefs({ claudeKey: "sk-ant-test", model: "claude-opus-5-5" });
    const before = getState().usage.reduce((n, x) => n + x.calls, 0);
    const usdBefore = getState().usage.reduce((n, x) => n + x.usd, 0);
    fake({ title_tr: "Yes", sentences: [{ tokens: [tok("Tak", "tak", "yes"), tok(".")], tr: "Yes." }] });
    await annotate("pl", ["Tak."]);
    const usage = getState().usage;
    expect(usage.reduce((n, x) => n + x.calls, 0)).toBe(before + 1);
    expect(usage.reduce((n, x) => n + x.usd, 0) - usdBefore).toBeCloseTo((10 * 4 + 10 * 20) / 1e6, 8); // 10 in, 10 out on Opus 5.5
    expect(usage[0].id).toMatch(/^u_\d{4}-\d{2}_/);
  });

  it("annotates in chunks and keeps Japanese readings", async () => {
    setPrefs({ claudeKey: "sk-ant-test", model: "claude-haiku-5-5" });
    const sent = fake({ title_tr: "Water", sentences: [{ tokens: [tok("水", "水", "water", "みず"), tok("を", "を", "(object)"), tok("飲む", "飲む", "drink", "のむ"), tok("。")], tr: "I drink water." }] });
    const r = await annotate("ja", ["水を飲む。"]);
    expect(r.sentences[0].tokens[0]).toEqual({ t: "水", l: "水", g: "water", r: "みず" });
    expect(sent[0].body.fallbacks).toBeUndefined(); // Haiku has no server-side fallback
  });

  it("passes on what the API said about a server error", async () => {
    setPrefs({ claudeKey: "sk-ant-test", model: "claude-opus-5-5" });
    setFetchForTests((async () => new Response(JSON.stringify({ type: "error", error: { type: "overloaded_error", message: "Overloaded" } }),
      { status: 529, headers: { "content-type": "application/json", "x-should-retry": "false" } })) as typeof fetch);
    await expect(annotate("pl", ["Tak."])).rejects.toThrow("Claude had a problem (529: Overloaded). Try again.");
  });

  it("explains errors in plain words", async () => {
    setPrefs({ claudeKey: "sk-ant-bad" });
    fake({}, { status: 401 });
    await expect(annotate("pl", ["Tak."])).rejects.toThrow(ClaudeError);
    await expect(annotate("pl", ["Tak."])).rejects.toThrow(/API key/);
  });

  it("reports a refusal", async () => {
    setPrefs({ claudeKey: "sk-ant-test", model: "claude-opus-5-5" });
    fake({ title_tr: "", sentences: [] }, { stop: "refusal" });
    await expect(annotate("pl", ["Tak."])).rejects.toThrow(/declined/);
  });
});

import { chatTurn } from "../src/lib/claude";
describe("conversation", () => {
  it("returns the reply and a correction of my line", async () => {
    setPrefs({ claudeKey: "sk-ant-test", model: "claude-opus-5-5" });
    const sent = fake({
      fix: { needed: true, better: "Poproszę kawę.", why: "kawa → kawę: the object takes the accusative.", topic: "pl-acc" },
      reply: { tokens: [tok("Proszę", "proszę", "here you are"), tok(" "), tok("bardzo", "bardzo", "very"), tok("!")], tr: "Here you are!" },
    });
    const r = await chatTurn("pl", { level: "beginner", known: "kawa", scenario: "café", lines: [{ who: "them", text: "Dzień dobry!" }, { who: "me", text: "Poproszę kawa." }] });
    expect(r.fix).toEqual({ better: "Poproszę kawę.", why: "kawa → kawę: the object takes the accusative." }); // no topic list given: no topic
    expect(sentenceText(r.reply)).toBe("Proszę bardzo!");
    expect(JSON.stringify(sent[0].body.messages)).toContain("Learner: Poproszę kawa.");
  });
  it("leaves out a correction that isn't needed", async () => {
    setPrefs({ claudeKey: "sk-ant-test" });
    fake({ fix: { needed: false, better: "", why: "", topic: "" }, reply: { tokens: [tok("Tak", "tak", "yes"), tok(".")], tr: "Yes." } });
    const r = await chatTurn("pl", { level: "", known: "", scenario: "x", lines: [] });
    expect(r.fix).toBeUndefined();
  });
});

import { checkLesson, moreDrills, reviewChat, startLesson } from "../src/lib/claude";
import { topicById, topicsFor } from "../src/data/grammar";

/** Claude's batch endpoints: create, retrieve (with the status asked for) and the results file (JSONL). */
function fakeBatch(o: { status: "in_progress" | "ended"; result?: unknown }) {
  const sent: Sent[] = [];
  const batch = {
    id: "msgbatch_1", type: "message_batch", processing_status: o.status, created_at: "2026-11-27T12:00:00Z", expires_at: "2026-11-28T12:00:00Z",
    ended_at: o.status === "ended" ? "2026-11-27T12:05:00Z" : null, archived_at: null, cancel_initiated_at: null,
    request_counts: { processing: o.status === "ended" ? 0 : 1, succeeded: 1, errored: 0, canceled: 0, expired: 0 },
    results_url: o.status === "ended" ? "https://api.anthropic.com/v1/messages/batches/msgbatch_1/results" : null,
  };
  setFetchForTests((async (url: string | URL | Request, init?: RequestInit) => {
    sent.push({ url: String(url), headers: new Headers(init?.headers), body: init?.body ? JSON.parse(String(init.body)) : {} });
    if (String(url).includes("/results")) {
      return new Response(JSON.stringify({ custom_id: "lesson-pl-acc", result: o.result }) + "\n", { status: 200, headers: { "content-type": "application/binary" } });
    }
    return new Response(JSON.stringify(batch), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch);
  return { sent };
}
const batchMessage = (payload: unknown) => ({
  id: "msg_1", type: "message", role: "assistant", model: "claude-opus-5-5",
  content: [{ type: "thinking", thinking: "", signature: "sig" }, { type: "text", text: JSON.stringify(payload) }],
  stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 1000, output_tokens: 1000 },
});

const drillRaw = (sentence: string, answer: string, reading = "", answer_reading = "") => ({ sentence, base: "kawa", hint: "accusative", answer, alts: [], tr: "I'd like a coffee.", why: "-a → -ę", reading, answer_reading });

describe("grammar", () => {
  it("hands a lesson to Claude's batch queue: Opus, effort high, no fallback, whatever the model setting", async () => {
    setPrefs({ claudeKey: "sk-ant-test", model: "claude-haiku-5-5" });
    const f = fakeBatch({ status: "in_progress" });
    const id = await startLesson("pl", topicById("pl", "pl-acc")!, { level: "beginner", known: "kawa" });
    expect(id).toBe("msgbatch_1");
    expect(f.sent[0].url).toMatch(/\/v1\/messages\/batches(\?|$)/);
    const req = (f.sent[0].body.requests as { custom_id: string; params: Record<string, unknown> }[])[0];
    expect(req.custom_id).toBe("lesson-pl-acc");
    expect(req.params.model).toBe("claude-opus-5-5");
    expect(req.params.max_tokens).toBe(64000); // thinking at effort high counts toward it
    expect(req.params.stream).toBeUndefined();
    expect(req.params.fallbacks).toBeUndefined(); // a batch request can't have one
    expect((req.params.output_config as { effort: string; format: { type: string } }).effort).toBe("high");
    expect((req.params.output_config as { format: { type: string } }).format.type).toBe("json_schema");
    expect(await checkLesson("pl", "msgbatch_1")).toEqual({ state: "waiting" });
  });

  it("collects a finished lesson, cleaned, and counts it at half price", async () => {
    setPrefs({ claudeKey: "sk-ant-test" });
    const usdBefore = getState().usage.reduce((n, x) => n + x.usd, 0);
    fakeBatch({ status: "ended", result: { type: "succeeded", message: batchMessage({
      intro: ["The **accusative** is for objects.", ""],
      tables: [{ title: "Endings", cols: ["gender", "nominative", "accusative"], rows: [{ head: "feminine", cells: ["kawa", "kawę"] }], note: "" }],
      examples: [{ sentence: { tokens: [tok("Poproszę", "prosić", "I'd like"), tok(" "), tok("kawę", "kawa", "coffee (acc.)"), tok(".")], tr: "A coffee, please." }, focus: ["kawę"] }],
      compare: "",
      mistakes: [{ wrong: "Poproszę kawa.", right: "Poproszę kawę.", why: "object → accusative" }],
      drills: [drillRaw("Poproszę ___.", "kawę"), drillRaw("No gap here.", "x")],
    }) } });
    const r = await checkLesson("pl", "msgbatch_1");
    if (r.state !== "done") throw new Error(`not done: ${JSON.stringify(r)}`);
    expect(r.lesson.intro).toEqual(["The **accusative** is for objects."]);
    expect(r.lesson.examples[0].focus).toEqual([2]);
    expect(r.lesson.tables[0].note).toBeUndefined();
    expect(r.lesson.drills).toHaveLength(1); // the one without ___ is dropped
    expect(r.lesson.drills[0]).toMatchObject({ sentence: "Poproszę ___.", answer: "kawę", base: "kawa" });
    expect(getState().usage.reduce((n, x) => n + x.usd, 0) - usdBefore).toBeCloseTo(((1000 * 4 + 1000 * 20) / 1e6) / 2, 8);
  });

  it("says why a lesson didn't come", async () => {
    setPrefs({ claudeKey: "sk-ant-test" });
    fakeBatch({ status: "ended", result: { type: "succeeded", message: { ...batchMessage({}), stop_reason: "refusal" } } });
    expect(await checkLesson("pl", "msgbatch_1")).toEqual({ state: "failed", error: "Claude declined to write this one." });
    fakeBatch({ status: "ended", result: { type: "succeeded", message: { ...batchMessage({}), stop_reason: "max_tokens" } } });
    expect((await checkLesson("pl", "msgbatch_1")).state).toBe("failed");
    fakeBatch({ status: "ended", result: { type: "succeeded", message: batchMessage({ intro: "not a list" }) } });
    expect(await checkLesson("pl", "msgbatch_1")).toMatchObject({ error: expect.stringContaining("expected shape") });
    fakeBatch({ status: "ended", result: { type: "errored", error: { type: "error", error: { type: "invalid_request_error", message: "schema too complex" } } } });
    expect(await checkLesson("pl", "msgbatch_1")).toEqual({ state: "failed", error: "Claude couldn't write it: schema too complex. Try again." });
    fakeBatch({ status: "ended", result: { type: "expired" } });
    expect(await checkLesson("pl", "msgbatch_1")).toMatchObject({ state: "failed" });
  });

  it("asks for more drills without repeating the ones I have", async () => {
    setPrefs({ claudeKey: "sk-ant-test" });
    const sent = fake({ drills: [drillRaw("Mam ___.", "kawę")] });
    const have = [{ id: "a-1", sentence: "Poproszę ___.", base: "kawa", hint: "acc", answer: "kawę", alts: [], tr: "", why: "" }];
    const r = await moreDrills("pl", topicById("pl", "pl-acc")!, { level: "", known: "", have });
    expect(JSON.stringify(sent[0].body.messages)).toContain("Poproszę ___. → kawę");
    expect(r[0].id).not.toBe("a-1");
    expect(r[0].reading).toBeUndefined();
  });

  it("keeps a Japanese drill's readings", async () => {
    setPrefs({ claudeKey: "sk-ant-test" });
    fake({ drills: [drillRaw("水を ___。", "飲みます", "みずを ___。", "のみます")] });
    const r = await moreDrills("ja", topicById("ja", "ja-masu")!, { level: "", known: "", have: [] });
    expect(r[0]).toMatchObject({ reading: "みずを ___。", answerReading: "のみます" });
  });

  it("tags a chat review's points with a known topic only", async () => {
    setPrefs({ claudeKey: "sk-ant-test" });
    const sent = fake({ summary: "Good.", points: [
      { said: "Poproszę kawa.", better: "Poproszę kawę.", tr: "", why: "acc.", topic: "pl-acc" },
      { said: "a", better: "b", tr: "", why: "", topic: "made-up" },
    ], words: [] });
    const r = await reviewChat("pl", { level: "", known: "", scenario: "café", lines: [], topics: topicsFor("pl") });
    expect(r.points.map((p) => p.topic)).toEqual(["pl-acc", ""]);
    expect(sent[0].body.system).toContain("pl-acc = Accusative");
  });
});
