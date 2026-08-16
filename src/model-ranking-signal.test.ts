import { describe, expect, it, vi } from "vitest";
import {
  computeModelRankingSignal,
  deepseekBestRank,
  parseIntelligenceLeaderboard,
} from "./model-ranking-signal";
import type { Env } from "./api/shared";

/**
 * 构造与 artificialanalysis.ai 同构的 JSON-LD 智能指数榜片段，
 * DeepSeek 最强模型插入到指定 1 起排名位置。
 */
function samplePage(deepseekRank = 8): string {
  const others = [
    "Claude Opus 5 (max)",
    "Claude Fable 5 (with fallback)",
    "GPT-5.6 Sol (max)",
    "Grok 4.6 (high)",
    "Kimi K3 (max)",
    "Muse Spark 1.2 (xhigh)",
    "Gemini 3.7 Flash (high)",
    "GLM-5.2 (max)",
    "GPT-5.6 Luna (max)",
    "Nemotron 3 Ultra",
  ];
  const models = [...others];
  models.splice(deepseekRank - 1, 0, "DeepSeek V4 Pro 0813 (max)");
  const data = models.map((label, index) =>
    `{"label":"${label}","artificialAnalysisIntelligenceIndex":${100 - index * 3},"detailsUrl":"/models/m${index}"}`,
  ).join(",");
  return `<!DOCTYPE html><script type="application/ld+json">{"citation":"Artificial Analysis (2025). LLM benchmarks dataset. https://artificialanalysis.ai","data":[${data}]}</script></html>`;
}

interface PrevRow {
  hour_bucket: string;
  best_rank: number;
  best_label: string;
}

function envWithRankingDb(firstValue: PrevRow | null): {
  env: Env;
  bind: ReturnType<typeof vi.fn>;
  run: ReturnType<typeof vi.fn>;
} {
  const statement = {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(firstValue),
    run: vi.fn().mockResolvedValue({ success: true }),
  };
  return {
    env: {
      DB: { prepare: vi.fn().mockReturnValue(statement) } as unknown as AppDatabase,
      VOTER_HASH_SECRET: "a".repeat(32),
      ALLOWED_ORIGINS: "https://app.example",
    },
    bind: statement.bind,
    run: statement.run,
  };
}

function fetchWith(html: string): typeof fetch {
  return vi.fn().mockResolvedValue(new Response(html)) as unknown as typeof fetch;
}

const NOW = Date.UTC(2026, 7, 14, 8); // 2026-08-14T08Z

describe("artificialanalysis.ai 榜单解析", () => {
  it("解析 JSON-LD 智能指数榜并保持顺序", () => {
    const models = parseIntelligenceLeaderboard(samplePage());
    expect(models).toHaveLength(11);
    expect(models[0].label).toBe("Claude Opus 5 (max)");
    expect(models[10].label).toBe("Nemotron 3 Ultra");
  });

  it("定位 DeepSeek 最强模型为第 8 名", () => {
    const best = deepseekBestRank(parseIntelligenceLeaderboard(samplePage(8)));
    expect(best).toEqual({ rank: 8, label: "DeepSeek V4 Pro 0813 (max)" });
  });

  it("多模型共存时取排名最强者", () => {
    const models = parseIntelligenceLeaderboard(samplePage(3));
    // 再出现一个更弱的 DeepSeek 模型（排名更靠后），应仍取第 3 名的最强者
    models.push({ label: "DeepSeek V2 (max)", index: 1 });
    expect(deepseekBestRank(models)).toEqual({ rank: 3, label: "DeepSeek V4 Pro 0813 (max)" });
  });
});

describe("模型排名信号计分规则", () => {
  it("首次观测（无上一小时记录）计 0 分并落库", async () => {
    const { env, bind, run } = envWithRankingDb(null);
    const result = await computeModelRankingSignal(env, NOW, fetchWith(samplePage(8)));
    expect(result.unavailable).toBe(false);
    expect(result.rank).toBe(8);
    expect(result.previousRank).toBeNull();
    expect(result.rankDelta).toBe(0);
    expect(result.score).toBe(0);
    expect(run).toHaveBeenCalledTimes(1);
    expect(bind.mock.calls[0]).toEqual(["2026-08-14T07"]);
    expect(bind.mock.calls[1]).toEqual(["2026-08-14T08", 8, "DeepSeek V4 Pro 0813 (max)", NOW]);
  });

  it("排名上升 2 位 → +10 分", async () => {
    const { env } = envWithRankingDb({
      hour_bucket: "2026-08-14T07",
      best_rank: 10,
      best_label: "DeepSeek V4 Pro 0813 (max)",
    });
    const result = await computeModelRankingSignal(env, NOW, fetchWith(samplePage(8)));
    expect(result.rankDelta).toBe(2);
    expect(result.score).toBe(10);
  });

  it("排名下降 3 位 → -15 分", async () => {
    const { env } = envWithRankingDb({
      hour_bucket: "2026-08-14T07",
      best_rank: 5,
      best_label: "DeepSeek V4 Pro 0813 (max)",
    });
    const result = await computeModelRankingSignal(env, NOW, fetchWith(samplePage(8)));
    expect(result.rankDelta).toBe(-3);
    expect(result.score).toBe(-15);
  });

  it("抓取失败时降级为不可用（0 分）", async () => {
    const { env, run } = envWithRankingDb(null);
    const failingFetch = vi.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;
    const result = await computeModelRankingSignal(env, NOW, failingFetch);
    expect(result.unavailable).toBe(true);
    expect(result.score).toBe(0);
    expect(run).not.toHaveBeenCalled();
  });

  it("榜单没有 DeepSeek 模型时降级为不可用", async () => {
    const { env } = envWithRankingDb(null);
    const html = samplePage(8).replace(/DeepSeek V4 Pro 0813 \(max\)/u, "Some Other Lab Model");
    const result = await computeModelRankingSignal(env, NOW, fetchWith(html));
    expect(result.unavailable).toBe(true);
    expect(result.score).toBe(0);
  });

  it("数据库写入失败时降级为不可用，不阻塞新闻管道", async () => {
    const statement = {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
      run: vi.fn().mockRejectedValue(new Error("table missing")),
    };
    const env: Env = {
      DB: { prepare: vi.fn().mockReturnValue(statement) } as unknown as AppDatabase,
      VOTER_HASH_SECRET: "a".repeat(32),
      ALLOWED_ORIGINS: "https://app.example",
    };
    const result = await computeModelRankingSignal(env, NOW, fetchWith(samplePage(8)));
    expect(result.unavailable).toBe(true);
    expect(result.score).toBe(0);
  });
});