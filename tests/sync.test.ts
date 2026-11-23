import { describe, expect, it } from "vitest";
import { decrypt, deriveKey, encrypt, newSalt, readEnvelope } from "../src/lib/crypto";
import { merge, serialize } from "../src/lib/merge";
import { defaults } from "../src/state/store";

describe("encryption", () => {
  it("round-trips gzip-compressed text and rejects a wrong passphrase", async () => {
    const salt = newSalt();
    const { key } = await deriveKey("correct horse battery", salt, 1000);
    const text = JSON.stringify(defaults());
    const env = await encrypt(key, salt, 1000, text);
    expect(env.z).toBe("gzip");
    expect(env.data.length).toBeLessThan(text.length / 2);
    expect(readEnvelope(JSON.stringify(env))).not.toBeNull();
    expect(await decrypt(key, env)).toBe(text);
    const wrong = await deriveKey("wrong passphrase!", salt, 1000);
    await expect(decrypt(wrong.key, env)).rejects.toThrow();
  });
});

describe("merge", () => {
  it("keeps the newer item and unions card review logs", () => {
    const base = defaults();
    const card = { id: "c1", updatedAt: 1, lang: "ja" as const, kind: "recog" as const, wordId: "w_ja_水", srs: { due: 0, stability: 0, difficulty: 0, elapsed_days: 0, scheduled_days: 0, learning_steps: 0, reps: 0, lapses: 0, state: 0 as const }, log: [] as [number, number][], addedOn: "2026-11-23" };
    const a = { ...base, cards: [{ ...card, updatedAt: 10, log: [[100, 3]] as [number, number][] }] };
    const b = { ...base, cards: [{ ...card, updatedAt: 20, log: [[200, 1]] as [number, number][] }] };
    const m = merge(a, b);
    expect(m.cards[0].updatedAt).toBe(20);
    expect(m.cards[0].log).toEqual([[100, 3], [200, 1]]);
    expect(serialize(merge(m, m))).toBe(serialize(m));
  });
  it("lets a newer removal win", () => {
    const a = defaults(), b = defaults();
    b.words[0] = { ...b.words[0], deletedAt: 5, updatedAt: 5 };
    expect(merge(a, b).words.find((w) => w.id === b.words[0].id)!.deletedAt).toBe(5);
  });
});
