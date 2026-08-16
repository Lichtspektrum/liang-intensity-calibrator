import type { Env } from "./api/shared";

/**
 * 独立规则性信号源：读取 https://opencode.ai/data 上的 DeepSeek 定价与缓存数据。
 *
 * - tokenCost：Price per 1M tokens（total 为每百万 token 的综合价；另有 input/output/cached）
 * - cacheRatio：Share of input tokens served from cache（%）
 *
 * 只跟踪 deepseek-v4-flash 与 deepseek-v4-pro 两个模型：
 * - 成本分：两个模型 total 价的合计与上一个小时比较，连续上涨第 n 小时扣 3n 分；
 *   打平或下降即破掉连续记录，恢复 0 分。
 * - 缓存分：两个模型 cache ratio 合计的变化（百分点），变化几个百分点就计几分（升为 +，降为 -）。
 *
 * 该分与新闻分数独立核算，由新闻模块在最末相加并 clamp 到 [-15, 15]。
 */

const OPENCODE_DATA_URL = "https://opencode.ai/data";
const FLASH_MODEL = "deepseek-v4-flash";
const PRO_MODEL = "deepseek-v4-pro";

interface TokenCostEntry {
  total: number;
  input: number;
  output: number;
  cached: number;
}

interface CacheRatioEntry {
  ratio: number;
  cached: number;
  uncached: number;
  total: number;
}

export interface PricingSignalResult {
  /** 独立分（可与新闻分相加后 clamp 到 [-15, 15]） */
  score: number;
  /** token 成本连续上涨的扣分（<= 0），连续第 streak 小时扣 -3 * streak */
  tokenCostPenalty: number;
  /** 缓存命中率合计较上一小时的变化（百分点 → 分数，可为正负） */
  cacheRatioDelta: number;
  /** 成本连续上涨的小时数（含当前小时） */
  streak: number;
  /** UTC 小时桶，如 2026-08-16T02 */
  hourBucket: string;
  /** flash + pro 的 total 价合计（USD / 1M tokens） */
  combinedCost: number;
  /** flash + pro 的 cache ratio 合计（%） */
  combinedRatio: number;
  /** 源不可用或数据缺失时为 true，此时 score 恒为 0 */
  unavailable: boolean;
}

interface PricingRecordRow {
  hour_bucket: string;
  flash_cost: number;
  pro_cost: number;
  flash_ratio: number;
  pro_ratio: number;
  cost_streak: number;
}

/**
 * 从 opencode.ai/data 的 SolidJS 内联序列化数据中提取 tokenCost 与 cacheRatio 两个数组。
 */
export function parseOpenCodeDataPage(html: string): {
  tokenCost: Map<string, TokenCostEntry>;
  cacheRatio: Map<string, CacheRatioEntry>;
} {
  const tokenCost = new Map<string, TokenCostEntry>();
  const cacheRatio = new Map<string, CacheRatioEntry>();

  for (const entry of parseEmbeddedArray(html, "tokenCost")) {
    const model = entry.model;
    if (typeof model !== "string") continue;
    tokenCost.set(model, {
      total: numberOr(entry.total),
      input: numberOr(entry.input),
      output: numberOr(entry.output),
      cached: numberOr(entry.cached),
    });
  }
  for (const entry of parseEmbeddedArray(html, "cacheRatio")) {
    const model = entry.model;
    if (typeof model !== "string") continue;
    cacheRatio.set(model, {
      ratio: numberOr(entry.ratio),
      cached: numberOr(entry.cached),
      uncached: numberOr(entry.uncached),
      total: numberOr(entry.total),
    });
  }
  return { tokenCost, cacheRatio };
}

function parseEmbeddedArray(html: string, marker: string): Array<Record<string, string | number>> {
  // 数组形如 tokenCost:$R[1]=[$R[2]={...},$R[3]={...}],cacheRatio:...
  // 内部 $R[n] 的 "]" 后总是跟着 "="，只有数组收尾的 "]" 后面不是 "="，据此定位。
  const match = html.match(new RegExp(`${marker}:\\$R\\[\\d+\\]=\\[([\\s\\S]*?)\\]\\s*(?!=)`, "u"));
  if (!match) return [];
  const body = match[1].replace(/\$R\[\d+\]=/gu, "");
  const entries: Array<Record<string, string | number>> = [];
  for (const raw of body.matchAll(/\{[\s\S]*?\}/gu)) {
    const normalized = raw[0].replace(/([A-Za-z_]\w*)(?=\s*:)/gu, '"$1"');
    try {
      entries.push(JSON.parse(normalized) as Record<string, string | number>);
    } catch {
      // 跳过无法解析的条目
    }
  }
  return entries;
}

function numberOr(value: string | number | undefined): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function hourBucketOf(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 13);
}

export function previousHourBucket(bucket: string): string {
  const value = Date.parse(`${bucket}:00:00.000Z`) - 60 * 60 * 1_000;
  return new Date(value).toISOString().slice(0, 13);
}

const UNAVAILABLE = (hourBucket: string): PricingSignalResult => ({
  score: 0,
  tokenCostPenalty: 0,
  cacheRatioDelta: 0,
  streak: 0,
  hourBucket,
  combinedCost: 0,
  combinedRatio: 0,
  unavailable: true,
});

/**
 * 采集一次定价信号：抓取数据页 → 定位 flash/pro → 对比上一小时记录 → 计算独立分 → 落库。
 * 任何失败（网络、解析、缺模型、数据库错误）都降级为 unavailable（0 分），不阻塞新闻管道。
 */
export async function computePricingSignal(
  env: Env,
  now = Date.now(),
  fetchImpl: typeof fetch = fetch,
): Promise<PricingSignalResult> {
  const hourBucket = hourBucketOf(now);
  let html: string;
  try {
    const response = await fetchImpl(OPENCODE_DATA_URL, {
      headers: { "User-Agent": "liang-intensity-calibrator" },
    });
    if (!response.ok) return UNAVAILABLE(hourBucket);
    html = await response.text();
  } catch {
    return UNAVAILABLE(hourBucket);
  }

  const { tokenCost, cacheRatio } = parseOpenCodeDataPage(html);
  const flashCost = tokenCost.get(FLASH_MODEL)?.total;
  const proCost = tokenCost.get(PRO_MODEL)?.total;
  const flashRatio = cacheRatio.get(FLASH_MODEL)?.ratio;
  const proRatio = cacheRatio.get(PRO_MODEL)?.ratio;
  if (
    flashCost === undefined || proCost === undefined
    || flashRatio === undefined || proRatio === undefined
  ) return UNAVAILABLE(hourBucket);

  const combinedCost = Math.round((flashCost + proCost) * 1_000) / 1_000;
  const combinedRatio = Math.round((flashRatio + proRatio) * 10) / 10;

  try {
    const previous = await env.DB
      .prepare(
        `SELECT hour_bucket, flash_cost, pro_cost, flash_ratio, pro_ratio, cost_streak
           FROM pricing_signal_records WHERE hour_bucket = ?`,
      )
      .bind(previousHourBucket(hourBucket))
      .first<PricingRecordRow>();

    let streak = 0;
    let cacheRatioDelta = 0;
    if (previous) {
      const rose = combinedCost > previous.flash_cost + previous.pro_cost;
      streak = rose ? previous.cost_streak + 1 : 0;
      const prevCombinedRatio = Math.round((previous.flash_ratio + previous.pro_ratio) * 10) / 10;
      cacheRatioDelta = Math.round((combinedRatio - prevCombinedRatio) * 10) / 10;
    }
    const tokenCostPenalty = streak === 0 ? 0 : -3 * streak;

    await env.DB
      .prepare(
        `INSERT INTO pricing_signal_records
           (hour_bucket, flash_cost, pro_cost, flash_ratio, pro_ratio, cost_streak, recorded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(hour_bucket) DO UPDATE SET
           flash_cost = excluded.flash_cost,
           pro_cost = excluded.pro_cost,
           flash_ratio = excluded.flash_ratio,
           pro_ratio = excluded.pro_ratio,
           cost_streak = excluded.cost_streak,
           recorded_at = excluded.recorded_at`,
      )
      .bind(hourBucket, flashCost, proCost, flashRatio, proRatio, streak, now)
      .run();

    const score = Math.round((cacheRatioDelta + tokenCostPenalty) * 10) / 10;
    return {
      score: score === 0 ? 0 : score,
      tokenCostPenalty,
      cacheRatioDelta,
      streak,
      hourBucket,
      combinedCost,
      combinedRatio,
      unavailable: false,
    };
  } catch {
    return UNAVAILABLE(hourBucket);
  }
}