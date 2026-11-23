import { afterEach, describe, expect, it } from "vitest";
import { annotate, ClaudeError, setFetchForTests, writeStory } from "../src/lib/claude";
import { setPrefs } from "../src/lib/prefs";
import { sentenceText } from "../src/lib/tokens";

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

  it("annotates in chunks and keeps Japanese readings", async () => {
    setPrefs({ claudeKey: "sk-ant-test", model: "claude-haiku-5-5" });
    const sent = fake({ title_tr: "Water", sentences: [{ tokens: [tok("水", "水", "water", "みず"), tok("を", "を", "(object)"), tok("飲む", "飲む", "drink", "のむ"), tok("。")], tr: "I drink water." }] });
    const r = await annotate("ja", ["水を飲む。"]);
    expect(r.sentences[0].tokens[0]).toEqual({ t: "水", l: "水", g: "water", r: "みず" });
    expect(sent[0].body.fallbacks).toBeUndefined(); // Haiku has no server-side fallback
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
      fix: { needed: true, better: "Poproszę kawę.", why: "kawa → kawę: the object takes the accusative." },
      reply: { tokens: [tok("Proszę", "proszę", "here you are"), tok(" "), tok("bardzo", "bardzo", "very"), tok("!")], tr: "Here you are!" },
    });
    const r = await chatTurn("pl", { level: "beginner", known: "kawa", scenario: "café", lines: [{ who: "them", text: "Dzień dobry!" }, { who: "me", text: "Poproszę kawa." }] });
    expect(r.fix).toEqual({ better: "Poproszę kawę.", why: "kawa → kawę: the object takes the accusative." });
    expect(sentenceText(r.reply)).toBe("Proszę bardzo!");
    expect(JSON.stringify(sent[0].body.messages)).toContain("Learner: Poproszę kawa.");
  });
  it("leaves out a correction that isn't needed", async () => {
    setPrefs({ claudeKey: "sk-ant-test" });
    fake({ fix: { needed: false, better: "", why: "" }, reply: { tokens: [tok("Tak", "tak", "yes"), tok(".")], tr: "Yes." } });
    const r = await chatTurn("pl", { level: "", known: "", scenario: "x", lines: [] });
    expect(r.fix).toBeUndefined();
  });
});
