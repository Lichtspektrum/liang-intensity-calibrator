import { describe, expect, it, vi } from "vitest";
import {
  computePricingSignal,
  hourBucketOf,
  parseOpenCodeDataPage,
  previousHourBucket,
} from "./pricing-signal";
import type { Env } from "./api/shared";

/**
 * 构造与 opencode.ai/data 同构的 SolidJS 内联序列化片段（tokenCost / cacheRatio 数组）。
 */
function samplePage(overrides: {
  flashTotal?: number;
  proTotal?: number;
  flashRatio?: number;
  proRatio?: number;
} = {}): string {
  const flashTotal = overrides.flashTotal ?? 0.28;
  const proTotal = overrides.proTotal ?? 3.2;
  const flashRatio = overrides.flashRatio ?? 96.6;
  const proRatio = overrides.proRatio ?? 97.6;
  return `<!DOCTYPE html><html><body>usage:$R[0]=[x]`
    + `tokenCost:$R[1]=[$R[2]={model:"deepseek-v4-flash",total:${flashTotal},input:0.14,output:${flashTotal},cached:0.028},`
    + `$R[3]={model:"deepseek-v4-pro",total:${proTotal},input:1.6,output:${proTotal},cached:0.135}]`
    + `,cacheRatio:$R[4]=[$R[5]={model:"deepseek-v4-pro",ratio:${proRatio},cached:6648.7,uncached:164.4,total:6813.1},`
    + `$R[6]={model:"deepseek-v4-flash",ratio:${flashRatio},cached:68596.5,uncached:2405.9,total:71002.3}]`
    + `</body></html>`;
}

interface PrevRow {
  hour_bucket: string;
  flash_cost: number;
  pro_cost: number;
  flash_ratio: number;
  pro_ratio: number;
  cost_streak: number;
}

function envWithPricingDb(firstValue: PrevRow | null): {
  env: Env;
  first: ReturnType<typeof vi.fn>;
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
    first: statement.first,
    bind: statement.bind,
    run: statement.run,
  };
}

function fetchWith(html: string): typeof fetch {
  return vi.fn().mockResolvedValue(new Response(html)) as unknown as typeof fetch;
}

const NOW = Date.UTC(2026, 7, 14, 8); // 2026-08-14T08Z

describe("opencode.ai/data 解析", () => {
  it("按模型提取 tokenCost 与 cacheRatio", () => {
    const { tokenCost, cacheRatio } = parseOpenCodeDataPage(samplePage());
    expect(tokenCost.get("deepseek-v4-flash")?.total).toBe(0.28);
    expect(tokenCost.get("deepseek-v4-pro")?.total).toBe(3.2);
    expect(cacheRatio.get("deepseek-v4-flash")?.ratio).toBe(96.6);
    expect(cacheRatio.get("deepseek-v4-pro")?.ratio).toBe(97.6);
  });

  it("小时桶与上一小时桶正确", () => {
    expect(hourBucketOf(NOW)).toBe("2026-08-14T08");
    expect(previousHourBucket("2026-08-14T08")).toBe("2026-08-14T07");
  });
});

describe("定价信号计分规则", () => {
  it("首次观测（无上一小时记录）计 0 分并落库", async () => {
    const { env, bind, run } = envWithPricingDb(null);
    const result = await computePricingSignal(env, NOW, fetchWith(samplePage()));
    expect(result.unavailable).toBe(false);
    expect(result.score).toBe(0);
    expect(result.streak).toBe(0);
    expect(result.tokenCostPenalty).toBe(0);
    expect(run).toHaveBeenCalledTimes(1);
    // 第一次 bind 是查询上一小时（SELECT），第二次才是写入当前小时记录（INSERT）。
    expect(bind.mock.calls[0]).toEqual(["2026-08-14T07"]);
    expect(bind.mock.calls[1]).toEqual(["2026-08-14T08", 0.28, 3.2, 96.6, 97.6, 0, NOW]);
  });

  it("token 成本上升第 1 小时扣 3 分，缓存 +1pp 加 1 分", async () => {
    const { env } = envWithPricingDb({
      hour_bucket: "2026-08-14T07",
      flash_cost: 0.28,
      pro_cost: 3.2,
      flash_ratio: 96.6,
      pro_ratio: 97.6,
      cost_streak: 0,
    });
    const result = await computePricingSignal(
      env,
      NOW,
      fetchWith(samplePage({ flashTotal: 0.3, proTotal: 3.3, flashRatio: 97.6, proRatio: 98.6 })),
    );
    expect(result.streak).toBe(1);
    expect(result.tokenCostPenalty).toBe(-3);
    expect(result.cacheRatioDelta).toBe(2);
    expect(result.score).toBe(-1);
  });

  it("连续 2 小时上升扣 6 分（streak 累加）", async () => {
    const { env } = envWithPricingDb({
      hour_bucket: "2026-08-14T07",
      flash_cost: 0.29,
      pro_cost: 3.25,
      flash_ratio: 96.6,
      pro_ratio: 97.6,
      cost_streak: 1,
    });
    const result = await computePricingSignal(
      env,
      NOW,
      fetchWith(samplePage({ flashTotal: 0.3, proTotal: 3.3, flashRatio: 96.6, proRatio: 97.6 })),
    );
    expect(result.streak).toBe(2);
    expect(result.tokenCostPenalty).toBe(-6);
    expect(result.cacheRatioDelta).toBe(0);
    expect(result.score).toBe(-6);
  });

  it("打平或下降破掉连续记录，恢复 0 扣分", async () => {
    const { env } = envWithPricingDb({
      hour_bucket: "2026-08-14T07",
      flash_cost: 0.28,
      pro_cost: 3.2,
      flash_ratio: 96.6,
      pro_ratio: 97.6,
      cost_streak: 3,
    });
    const result = await computePricingSignal(env, NOW, fetchWith(samplePage()));
    expect(result.streak).toBe(0);
    expect(result.tokenCostPenalty).toBe(0);
    expect(result.score).toBe(0);
  });

  it("抓取失败时降级为不可用（0 分）", async () => {
    const { env, run } = envWithPricingDb(null);
    const failingFetch = vi.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;
    const result = await computePricingSignal(env, NOW, failingFetch);
    expect(result.unavailable).toBe(true);
    expect(result.score).toBe(0);
    expect(run).not.toHaveBeenCalled();
  });

  it("页面缺少 flash/pro 数据时降级为不可用", async () => {
    const { env } = envWithPricingDb(null);
    const html = samplePage().replace(/deepseek-v4-flash/g, "other-model");
    const result = await computePricingSignal(env, NOW, fetchWith(html));
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
    const result = await computePricingSignal(env, NOW, fetchWith(samplePage()));
    expect(result.unavailable).toBe(true);
    expect(result.score).toBe(0);
  });
});