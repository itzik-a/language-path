import { describe, expect, it } from "vitest";
import { costUsd, money, monthOf, usageSummary } from "../src/lib/cost";
import { merge } from "../src/lib/merge";
import { normalize } from "../src/state/store";
import type { Usage } from "../src/types";

const u = (id: string, month: string, usd: number, calls: number, last: number, updatedAt = last): Usage =>
  ({ id, updatedAt, month, device: id.split("_")[2] ?? "d", calls, usd, last });

describe("Claude cost", () => {
  it("prices tokens per model, cache reads and writes included", () => {
    expect(costUsd("claude-opus-5-5", { input_tokens: 1_000_000, output_tokens: 1_000_000 })).toBeCloseTo(24);
    expect(costUsd("claude-sonnet-5-5", { input_tokens: 1_000_000, output_tokens: 100_000 })).toBeCloseTo(3);
    expect(costUsd("claude-haiku-5-5", { input_tokens: 10_000, output_tokens: 2_000 })).toBeCloseTo(0.002);
    expect(costUsd("claude-opus-5-5", { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 1_000_000, cache_creation_input_tokens: 1_000_000 })).toBeCloseTo(0.4 + 5);
    expect(costUsd("claude-haiku-5-5", { input_tokens: 200_000, output_tokens: 0 })).toBeCloseTo(0.1); // the long-prompt rate
    expect(costUsd("claude-some-new-model", { input_tokens: 1_000_000, output_tokens: 0 })).toBeCloseTo(5);
    expect(costUsd("claude-opus-5-5", { input_tokens: null, output_tokens: null })).toBe(0);
  });

  it("adds up this month across devices, and shows money plainly", () => {
    const now = new Date(2026, 10, 27, 12).getTime();
    const s = { usage: [u("u_2026-11_mac", "2026-11", 0.05, 10, now - 60_000), u("u_2026-11_phone", "2026-11", 0.04, 4, now - 3_600_000), u("u_2026-10_mac", "2026-10", 1, 50, now - 40 * 86_400_000)] };
    expect(monthOf(now)).toBe("2026-11");
    const sum = usageSummary(s, now);
    expect(sum.usd).toBeCloseTo(0.09);
    expect(sum.calls).toBe(14);
    expect(sum.last).toBe(now - 60_000);
    expect(money(sum.usd)).toBe("$0.09");
    expect(money(0.001)).toBe("under $0.01");
    expect(money(0)).toBe("$0.00");
    expect(usageSummary({ usage: [] }, now)).toEqual({ usd: 0, calls: 0, last: 0 });
  });

  it("syncs: each device's record merges by updatedAt, older copies load without it", () => {
    const a = normalize({ usage: [u("u_2026-11_mac", "2026-11", 0.05, 10, 2)] });
    const b = normalize({ usage: [u("u_2026-11_mac", "2026-11", 0.03, 6, 1), u("u_2026-11_phone", "2026-11", 0.04, 4, 3)] });
    const m = merge(a, b);
    expect(m.usage.find((x) => x.id === "u_2026-11_mac")?.calls).toBe(10);
    expect(m.usage).toHaveLength(2);
    expect(normalize({ words: [] }).usage).toEqual([]);
  });
});
