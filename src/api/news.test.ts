import { afterEach, describe, expect, it, vi } from "vitest";
import {
  combineNewsAndPricingScore,
  combineNewsAndSignalScores,
  handleGetNews,
  refreshNewsCalibration,
} from "./news";
import type { Env } from "./shared";

describe("news API", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("把新闻分与各独立信号分（定价、模型排名）相加并 clamp 到 [-15, 15]", () => {
    expect(combineNewsAndSignalScores(3, 0)).toBe(3);
    expect(combineNewsAndSignalScores(8, 5)).toBe(13);
    expect(combineNewsAndSignalScores(10, 6)).toBe(15);
    expect(combineNewsAndSignalScores(-10, -6)).toBe(-15);
    expect(combineNewsAndSignalScores(7, 2.5)).toBe(9.5);
    expect(combineNewsAndSignalScores(7, 2.55)).toBe(9.6);
    expect(combineNewsAndSignalScores(-7, -2.54)).toBe(-9.5);
    // 新闻 + 定价 + 模型排名 三路相加，仍 clamp 到 ±15
    expect(combineNewsAndSignalScores(6, -2, 4)).toBe(8);
    expect(combineNewsAndSignalScores(10, 4, 5)).toBe(15);
    expect(combineNewsAndSignalScores(-10, -2, -5)).toBe(-15);
    // 兼容旧签名
    expect(combineNewsAndPricingScore(8, 5)).toBe(13);
  });

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

  it("快速版只跑规则信号：不调用模型、不抓新闻，分数为定价+排名信号之和", async () => {
    const now = Date.UTC(2026, 7, 14, 8);
    const statement = {
      bind: vi.fn().mockReturnThis(),
      // 第一次 first() = 定价上一小时记录；第二次 = 排名上一小时记录
      first: vi.fn()
        .mockResolvedValueOnce({
          hour_bucket: "2026-08-14T07",
          flash_cost: 0.28, pro_cost: 3.2,
          flash_ratio: 96.6, pro_ratio: 97.6,
          cost_streak: 0,
        })
        .mockResolvedValueOnce({
          hour_bucket: "2026-08-14T07",
          best_rank: 10,
          best_label: "DeepSeek V4 Pro 0813 (max)",
        }),
      run: vi.fn().mockResolvedValue({ success: true }),
    };
    const openCodePage = "tokenCost:$R[1]=[$R[2]={model:\"deepseek-v4-flash\",total:0.3,input:0.14,output:0.3,cached:0.028},$R[3]={model:\"deepseek-v4-pro\",total:3.3,input:1.6,output:3.3,cached:0.135}],cacheRatio:$R[4]=[$R[5]={model:\"deepseek-v4-pro\",ratio:98.6,cached:6648.7,uncached:164.4,total:6813.1},$R[6]={model:\"deepseek-v4-flash\",ratio:97.6,cached:68596.5,uncached:2405.9,total:71002.3}]";
    const rankingPage = "\"citation\":\"Artificial Analysis (2025). LLM benchmarks dataset. https://artificialanalysis.ai\",\"data\":[{\"label\":\"Claude Opus 5 (max)\",\"artificialAnalysisIntelligenceIndex\":63.05,\"detailsUrl\":\"/models/a\"},{\"label\":\"GPT-5.6 Sol (max)\",\"artificialAnalysisIntelligenceIndex\":60.9,\"detailsUrl\":\"/models/b\"},{\"label\":\"Kimi K3 (max)\",\"artificialAnalysisIntelligenceIndex\":59.7,\"detailsUrl\":\"/models/c\"},{\"label\":\"Gemini 3.7 Flash (high)\",\"artificialAnalysisIntelligenceIndex\":56.0,\"detailsUrl\":\"/models/d\"},{\"label\":\"Muse Spark 1.2 (xhigh)\",\"artificialAnalysisIntelligenceIndex\":55.1,\"detailsUrl\":\"/models/e\"},{\"label\":\"Qwen3.8 Max\",\"artificialAnalysisIntelligenceIndex\":54.2,\"detailsUrl\":\"/models/f\"},{\"label\":\"GLM-5.2 (max)\",\"artificialAnalysisIntelligenceIndex\":53.1,\"detailsUrl\":\"/models/g\"},{\"label\":\"DeepSeek V4 Pro 0813 (max)\",\"artificialAnalysisIntelligenceIndex\":53.2,\"detailsUrl\":\"/models/deepseek-v4-pro\"}]";
    const openCodeFetch = vi.fn()
      .mockResolvedValueOnce(new Response(openCodePage))
      .mockResolvedValueOnce(new Response(rankingPage));
    vi.stubGlobal("fetch", openCodeFetch);
    const aiRunner = vi.fn().mockRejectedValue(new Error("must not be called"));
    const env: Env = {
      DB: { prepare: vi.fn().mockReturnValue(statement) } as unknown as AppDatabase,
      AI_RUNNER: aiRunner as never,
      VOTER_HASH_SECRET: "a".repeat(32),
      ALLOWED_ORIGINS: "https://app.example",
    };

    const result = await refreshNewsCalibration(env, now, () => undefined, "quick");

    expect(aiRunner).not.toHaveBeenCalled();
    expect(result.variant).toBe("quick");
    expect(result.headline).toBe("快速版：规则信号校准");
    expect(result.items).toEqual([]);
    // 定价：成本上升 streak=1 → -3，缓存 +2 → 小计 -1；排名：10 → 8 上升 2 位 → +10；新闻 0
    expect(result.pricing?.score).toBe(-1);
    expect(result.ranking?.score).toBe(10);
    expect(result.score).toBe(9);
    expect(openCodeFetch).toHaveBeenCalledTimes(2);
  });
});
