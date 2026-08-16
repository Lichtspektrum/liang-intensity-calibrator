import { describe, expect, it, vi } from "vitest";
import { getNewsJob, startNewsJob } from "./news-jobs";
import type { Env } from "./shared";

describe("news collection jobs", () => {
  it("reports a cache-aware job through the same detailed progress contract", async () => {
    const now = Date.UTC(2026, 7, 14, 8);
    const calibration = {
      date: "2026-08-14",
      score: 0,
      stage: "梁子",
      headline: "今日缓存",
      rationale: "仍在有效期内",
      dimensions: { originality: 0, openness: 0, efficiency: 0, intelligence: 0, restraint: 0 },
      quote: { id: "q", dimension: "restraint", text: "quote", timestamp: "00:00:01" },
      quoteSource: "https://example.com/original",
      transcriptSource: "https://example.com/transcript",
      sourceCaveat: "caveat",
      items: [],
      collectedAt: now - 1_000,
    };
    const statement = {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue({
        payload: JSON.stringify(calibration),
        collected_at: calibration.collectedAt,
      }),
    };
    const env: Env = {
      DB: { prepare: vi.fn().mockReturnValue(statement) } as unknown as AppDatabase,
      VOTER_HASH_SECRET: "a".repeat(32),
      ALLOWED_ORIGINS: "https://app.example",
    };

    const started = startNewsJob(env, false, now, "deep");
    expect(started).toMatchObject({ status: "running", progress: 1, stage: "queued" });
    await vi.waitFor(() => {
      expect(getNewsJob(started.id, now + 10)).toMatchObject({
        status: "completed",
        progress: 100,
        stage: "cached",
        result: { headline: "今日缓存" },
      });
    });
    expect(getNewsJob(started.id, now + 10)?.events.at(-1)?.detail).toContain("无需重复调用模型");
  });
});
