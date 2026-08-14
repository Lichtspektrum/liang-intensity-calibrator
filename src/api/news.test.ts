import { afterEach, describe, expect, it, vi } from "vitest";
import { handleGetNews } from "./news";
import type { Env } from "./shared";

describe("news API", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns a fresh cached calibration without invoking AI", async () => {
    const now = Date.UTC(2026, 7, 14, 8);
    const payload = {
      date: "2026-08-14",
      score: 3,
      stage: "梁圣",
      headline: "today",
      rationale: "reason",
      dimensions: { originality: 0, openness: 0, efficiency: 0, intelligence: 0, restraint: 0 },
      quote: { id: "restraint", dimension: "restraint", text: "quote", timestamp: "00:00:00" },
      quoteSource: "https://example.com/original",
      transcriptSource: "https://example.com/transcript",
      sourceCaveat: "caveat",
      items: [],
      collectedAt: now - 1_000,
    };
    const first = vi.fn().mockResolvedValue({ payload: JSON.stringify(payload), collected_at: payload.collectedAt });
    const openCodeFetch = vi.fn();
    vi.stubGlobal("fetch", openCodeFetch);
    const env: Env = {
      DB: { prepare: vi.fn().mockReturnValue({ bind: vi.fn().mockReturnThis(), first }) } as unknown as AppDatabase,
      VOTER_HASH_SECRET: "a".repeat(32),
      ALLOWED_ORIGINS: "https://app.example",
    };
    const response = await handleGetNews(env, now);
    expect(response.status).toBe(200);
    expect(openCodeFetch).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({ score: 3, headline: "today" });
  });

  it("reports unavailable when the on-demand CLI call fails and no cache exists", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network unavailable")));
    const env: Env = {
      DB: { prepare: vi.fn().mockReturnValue({ bind: vi.fn().mockReturnThis(), first: vi.fn().mockResolvedValue(null) }) } as unknown as AppDatabase,
      AI_RUNNER: vi.fn().mockRejectedValue(new Error("CLI unavailable")),
      VOTER_HASH_SECRET: "a".repeat(32),
      ALLOWED_ORIGINS: "https://app.example",
    };
    expect((await handleGetNews(env)).status).toBe(503);
  });
});
