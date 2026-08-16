import type { Env } from "./api/shared";

/**
 * 独立规则性信号源：读取 https://artificialanalysis.ai/ 上 DeepSeek 最强模型的排名。
 *
 * 页面内嵌 JSON-LD 数据集（LLM benchmarks dataset）按 Model Intelligence Index 从强到弱排列，
 * 定位 label 含 DeepSeek 的最强模型（排名数字最小者）：
 * - 与上一个小时记录相比，排名每上升/下降 1 位，独立分 +5/-5（数量 × 5）。
 *
 * 该分与新闻分、定价信号独立核算，由新闻模块在最末相加并 clamp 到 [-15, 15]。
 */

const ARTIFICIAL_ANALYSIS_URL = "https://artificialanalysis.ai/";
const DEEPSEEK_LABEL_PATTERN = /deepseek/iu;

export interface LeaderboardModel {
  label: string;
  index: number;
}

export interface ModelRankingSignalResult {
  /** 独立分（排名变化数量 × 5，可与新闻分、定价分相加后 clamp 到 [-15, 15]） */
  score: number;
  /** 排名变化（正 = 排名上升；previousRank - currentRank） */
  rankDelta: number;
  /** 当前 DeepSeek 最强模型的排名（1 起，越小越强） */
  rank: number;
  /** 上一小时记录的排名 */
  previousRank: number | null;
  /** 命中 DeepSeek 最强模型的榜单名称 */
  bestModelLabel: string | null;
  /** UTC 小时桶，如 2026-08-16T03 */
  hourBucket: string;
  /** 源不可用或榜单无 DeepSeek 时为 true，此时 score 恒为 0 */
  unavailable: boolean;
}

interface RankingRecordRow {
  hour_bucket: string;
  best_rank: number;
  best_label: string;
}

/**
 * 从页面 JSON-LD 数据集提取按智能指数降序排列的模型榜（如榜单缺失返回空数组）。
 */
export function parseIntelligenceLeaderboard(html: string): LeaderboardModel[] {
  const citation = html.indexOf("LLM benchmarks dataset");
  if (citation === -1) return [];
  const dataStart = html.indexOf('"data":[', citation);
  if (dataStart === -1) return [];
  // 平衡括号扫描到数组收尾（对象内部无括号，直接找首个闭合即可）。
  let depth = 0;
  let end = -1;
  for (let i = dataStart + 7; i < html.length; i += 1) {
    const ch = html[i];
    if (ch === "[") depth += 1;
    else if (ch === "]") {
      depth -= 1;
      if (depth <= 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) return [];
  const body = html.slice(dataStart + 7, end);
  const models: LeaderboardModel[] = [];
  for (const raw of body.matchAll(/\{[\s\S]*?\}/gu)) {
    const normalized = raw[0].replace(/([A-Za-z_]\w*)(?=\s*:)/gu, '"$1"');
    try {
      const entry = JSON.parse(normalized) as {
        label?: unknown;
        artificialAnalysisIntelligenceIndex?: unknown;
      };
      if (typeof entry.label === "string" && typeof entry.artificialAnalysisIntelligenceIndex === "number") {
        models.push({ label: entry.label, index: entry.artificialAnalysisIntelligenceIndex });
      }
    } catch {
      // 跳过无法解析的条目
    }
  }
  return models;
}

/** 取榜单中 DeepSeek 最强（排名数字最小）的模型；榜单为空或没有 DeepSeek 时返回 null。 */
export function deepseekBestRank(models: LeaderboardModel[]): { rank: number; label: string } | null {
  let best: { rank: number; label: string } | null = null;
  models.forEach((model, index) => {
    if (DEEPSEEK_LABEL_PATTERN.test(model.label) && (!best || index < best.rank - 1)) {
      best = { rank: index + 1, label: model.label };
    }
  });
  return best;
}

const UNAVAILABLE = (hourBucket: string): ModelRankingSignalResult => ({
  score: 0,
  rankDelta: 0,
  rank: 0,
  previousRank: null,
  bestModelLabel: null,
  hourBucket,
  unavailable: true,
});

/**
 * 采集一次排名信号：抓取页面 → 解析榜单 → 定位 DeepSeek 最强模型 → 对比上一小时记录 → 落库。
 * 任何失败（网络、解析、榜单无 DeepSeek、数据库错误）都降级为 unavailable（0 分）。
 */
export async function computeModelRankingSignal(
  env: Env,
  now = Date.now(),
  fetchImpl: typeof fetch = fetch,
): Promise<ModelRankingSignalResult> {
  const hourBucket = new Date(now).toISOString().slice(0, 13);
  let html: string;
  try {
    const response = await fetchImpl(ARTIFICIAL_ANALYSIS_URL, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; liang-intensity-calibrator)" },
    });
    if (!response.ok) return UNAVAILABLE(hourBucket);
    html = await response.text();
  } catch {
    return UNAVAILABLE(hourBucket);
  }

  const best = deepseekBestRank(parseIntelligenceLeaderboard(html));
  if (!best) return UNAVAILABLE(hourBucket);

  const previousHour = new Date(Date.parse(`${hourBucket}:00:00.000Z`) - 60 * 60 * 1_000)
    .toISOString()
    .slice(0, 13);

  try {
    const previous = await env.DB
      .prepare("SELECT hour_bucket, best_rank, best_label FROM model_ranking_records WHERE hour_bucket = ?")
      .bind(previousHour)
      .first<RankingRecordRow>();

    const previousRank = previous?.best_rank ?? null;
    const rankDelta = previousRank === null ? 0 : previousRank - best.rank;
    const score = rankDelta * 5;

    await env.DB
      .prepare(
        `INSERT INTO model_ranking_records (hour_bucket, best_rank, best_label, recorded_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(hour_bucket) DO UPDATE SET
           best_rank = excluded.best_rank,
           best_label = excluded.best_label,
           recorded_at = excluded.recorded_at`,
      )
      .bind(hourBucket, best.rank, best.label, now)
      .run();

    return {
      score,
      rankDelta,
      rank: best.rank,
      previousRank,
      bestModelLabel: best.label,
      hourBucket,
      unavailable: false,
    };
  } catch {
    return UNAVAILABLE(hourBucket);
  }
}