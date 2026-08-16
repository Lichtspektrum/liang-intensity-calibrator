import { analyzeTodaysNews, type NewsCalibration } from "../ai-news-analyzer";
import { collectTodaysAiNews, deduplicateNews } from "../ai-news-collector";
import { searchTodaysAiNews } from "../ai-news-search";
import { describeScore } from "../score-domain";
import { computePricingSignal, type PricingSignalResult } from "../pricing-signal";
import { computeModelRankingSignal, type ModelRankingSignalResult } from "../model-ranking-signal";
import { type Env, jsonResponse, todayInBeijing } from "./shared";

export const NEWS_CACHE_TTL_MS = 90 * 60 * 1_000;
export const SCORE_FLOOR = -15;
export const SCORE_CEIL = 15;

export type NewsVariant = "quick" | "deep";

/** 新闻分与各独立信号分（定价、模型排名等）相加，并 clamp 到 [-15, 15]。 */
export function combineNewsAndSignalScores(newsScore: number, ...signalScores: number[]): number {
  const total = signalScores.reduce((sum, score) => sum + score, newsScore);
  return Math.max(SCORE_FLOOR, Math.min(SCORE_CEIL, Math.round(total * 10) / 10));
}

/** 兼容旧签名：仅含定价信号的组合。 */
export const combineNewsAndPricingScore = combineNewsAndSignalScores;

/** 快速版的规则信号摘要文案。 */
export function buildQuickRationale(
  pricing: PricingSignalResult,
  ranking: ModelRankingSignalResult,
): string {
  const parts: string[] = [];
  if (!pricing.unavailable) {
    parts.push(
      `定价与缓存信号 ${pricing.score >= 0 ? "+" : ""}${pricing.score}`
      + `（token 成本连续 ${pricing.streak} 小时上涨扣 ${pricing.tokenCostPenalty} 分；`
      + `缓存命中率变动 ${pricing.cacheRatioDelta >= 0 ? "+" : ""}${pricing.cacheRatioDelta} 分）`,
    );
  }
  if (!ranking.unavailable) {
    parts.push(
      `DeepSeek 最强模型 ${ranking.bestModelLabel} 排名第 ${ranking.rank}，`
      + `较上一小时 ${ranking.rankDelta === 0 ? "持平" : `${ranking.rankDelta > 0 ? "上升" : "下降"} ${Math.abs(ranking.rankDelta)} 位`}，`
      + `信号 ${ranking.score >= 0 ? "+" : ""}${ranking.score}`,
    );
  }
  if (parts.length === 0) parts.push("两个规则源均暂不可用，分数保持中性。");
  parts.push("快速版仅运行规则性来源，不抓取新闻。");
  return parts.join("；");
}

export interface NewsPipelineProgress {
  progress: number;
  stage: string;
  label: string;
  detail: string;
  stats?: {
    directItems?: number;
    webItems?: number;
    uniqueItems?: number;
    sourcesCompleted?: number;
    sourcesTotal?: number;
  };
}

export type NewsProgressReporter = (update: NewsPipelineProgress) => void;

interface CachedNewsRow {
  payload: string;
  collected_at: number;
}

function parseCached(row: CachedNewsRow | null): NewsCalibration | null {
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.payload) as Partial<NewsCalibration>;
    return typeof parsed.date === "string"
      && typeof parsed.score === "number"
      && Array.isArray(parsed.items)
      ? parsed as NewsCalibration
      : null;
  } catch {
    return null;
  }
}

export async function getCachedNewsCalibration(
  env: Env,
  date = todayInBeijing(),
): Promise<NewsCalibration | null> {
  const row = await env.DB
    .prepare("SELECT payload, collected_at FROM news_calibrations WHERE date = ?")
    .bind(date)
    .first<CachedNewsRow>();
  return parseCached(row);
}

export async function refreshNewsCalibration(
  env: Env,
  now = Date.now(),
  report: NewsProgressReporter = () => undefined,
  variant: NewsVariant = "deep",
): Promise<NewsCalibration> {
  const date = todayInBeijing(now);
  const runner = env.AI_RUNNER;
  // 独立规则信号模块：始终在新闻模块首位运行（独立计分，最后与新闻分相加）。
  report({
    progress: 2,
    stage: "pricing",
    label: "定价与缓存信号",
    detail: "查询 opencode.ai/data 的 DeepSeek token 成本与缓存命中率",
  });
  const pricing = await computePricingSignal(env, now);
  report({
    progress: 3,
    stage: "pricing",
    label: "定价与缓存信号",
    detail: pricing.unavailable
      ? "该源暂不可用，此项按 0 分计入"
      : `token 成本合计 ${pricing.combinedCost.toFixed(2)}，连续 ${pricing.streak} 小时上涨扣 ${pricing.tokenCostPenalty} 分；缓存命中率变动 ${pricing.cacheRatioDelta >= 0 ? "+" : ""}${pricing.cacheRatioDelta} 分；独立信号 ${pricing.score >= 0 ? "+" : ""}${pricing.score}`,
    stats: { uniqueItems: 0 },
  });
  report({
    progress: 5,
    stage: "ranking",
    label: "模型排名信号",
    detail: "查询 artificialanalysis.ai 上 DeepSeek 最强模型的智能指数排名",
  });
  const ranking = await computeModelRankingSignal(env, now);
  report({
    progress: 6,
    stage: "ranking",
    label: "模型排名信号",
    detail: ranking.unavailable
      ? "该源暂不可用，此项按 0 分计入"
      : `DeepSeek 最强模型 ${ranking.bestModelLabel} 当前第 ${ranking.rank} 名，较上一小时 ${ranking.rankDelta === 0 ? "持平" : `${ranking.rankDelta > 0 ? "上升" : "下降"} ${Math.abs(ranking.rankDelta)} 位`}，独立信号 ${ranking.score >= 0 ? "+" : ""}${ranking.score}`,
    stats: { uniqueItems: 0 },
  });

  // 快速版：仅使用规则性源评分，不抓取新闻、不调用模型。
  if (variant === "quick") {
    const totalScore = combineNewsAndSignalScores(0, pricing.score, ranking.score);
    report({
      progress: 90,
      stage: "score",
      label: "规则信号计分",
      detail: `定价独立分 ${pricing.score >= 0 ? "+" : ""}${pricing.score}，排名独立分 ${ranking.score >= 0 ? "+" : ""}${ranking.score}，合计 clamp 到 ±15 得 ${totalScore >= 0 ? "+" : ""}${totalScore}`,
      stats: { uniqueItems: 0 },
    });
    const quickResult: NewsCalibration = {
      date,
      variant: "quick",
      score: totalScore,
      stage: describeScore(totalScore).stage,
      headline: "快速版：规则信号校准",
      rationale: buildQuickRationale(pricing, ranking),
      dimensions: { originality: 0, openness: 0, efficiency: 0, intelligence: 0, restraint: 0 },
      quote: { id: "neutral", dimension: "neutral", text: "", timestamp: "" },
      quoteSource: "",
      transcriptSource: "",
      sourceCaveat: "快速版仅依据 opencode.ai/data 与 artificialanalysis.ai 的规则信号，未抓取新闻。",
      items: [],
      collectedAt: now,
      pricing,
      ranking,
    };
    report({
      progress: 100,
      stage: "complete",
      label: "快速校准完成",
      detail: `规则信号已合并，总分 ${totalScore >= 0 ? "+" : ""}${totalScore}`,
      stats: { uniqueItems: 0 },
    });
    return quickResult;
  }
  report({
    progress: 8,
    stage: "initialize",
    label: "确定今日窗口",
    detail: `按 Asia/Singapore 校验 ${date} 的发布日期`,
  });
  report({
    progress: 10,
    stage: "direct",
    label: "直连可信源",
    detail: "并行读取 Hacker News、arXiv 与 GitHub 搜索（当天新建的 DeepSeek/AI 仓库）",
  });
  const directItems = await collectTodaysAiNews(date, now, (source) => {
    report({
      progress: 10 + Math.round(source.completed / source.total * 28),
      stage: "direct",
      label: "直连可信源",
      detail: `${source.failed ? "跳过" : "完成"} ${source.source} · ${source.itemCount} 条当日信号`,
      stats: {
        sourcesCompleted: source.completed,
        sourcesTotal: source.total,
      },
    });
  });
  report({
    progress: 42,
    stage: "web-search",
    label: "中英双路检索",
    detail: `直连源得到 ${directItems.length} 条；开始 websearch → webfetch 原文核验`,
    stats: { directItems: directItems.length },
  });
  let webItemCount = 0;
  const searchedItems = await searchTodaysAiNews(date, runner, (search) => {
    webItemCount += search.itemCount;
    report({
      progress: 42 + Math.round(search.completed / search.total * 20),
      stage: "web-search",
      label: "中英双路检索",
      detail: `${search.language === "zh" ? "中文" : "英文"}检索${search.failed ? "未返回有效结果" : `完成 · ${search.itemCount} 条`}`,
      stats: {
        directItems: directItems.length,
        webItems: webItemCount,
      },
    });
  });
  const items = deduplicateNews([...directItems, ...searchedItems]).slice(0, 24);
  report({
    progress: 68,
    stage: "verify",
    label: "日期校验与去重",
    detail: `${directItems.length + searchedItems.length} 条候选合并为 ${items.length} 条唯一当日新闻`,
    stats: {
      directItems: directItems.length,
      webItems: searchedItems.length,
      uniqueItems: items.length,
    },
  });
  report({
    progress: 74,
    stage: "liang-analysis",
    label: "梁式五维分析",
    detail: "加载梁文锋 skill，逐条判断原创、开放、效率、智能主线与克制",
    stats: { uniqueItems: items.length },
  });
  let activity = 0;
  const calibration = await analyzeTodaysNews(
    date,
    items,
    now,
    runner,
    (detail) => {
      activity += 1;
      report({
        progress: Math.min(92, 76 + activity * 2),
        stage: "liang-analysis",
        label: "梁式五维分析",
        detail,
        stats: { uniqueItems: items.length },
      });
    },
  );
  const totalScore = combineNewsAndSignalScores(calibration.score, pricing.score, ranking.score);
  report({
    progress: 94,
    stage: "score",
    label: "固定权重计分",
    detail: pricing.unavailable && ranking.unavailable
      ? `五维证据已聚合，得 ${calibration.score > 0 ? "+" : ""}${calibration.score}；独立信号均不可用，保持该分`
      : `新闻五维分 ${calibration.score > 0 ? "+" : ""}${calibration.score}，定价独立分 ${pricing.score > 0 ? "+" : ""}${pricing.score}，排名独立分 ${ranking.score > 0 ? "+" : ""}${ranking.score}，合计 clamp 到 ±15 得 ${totalScore > 0 ? "+" : ""}${totalScore}`,
    stats: { uniqueItems: items.length },
  });
  const result: NewsCalibration = {
    ...calibration,
    variant: "deep",
    score: totalScore,
    stage: describeScore(totalScore).stage,
    pricing,
    ranking,
  };
  await env.DB
    .prepare(
      `INSERT INTO news_calibrations (date, payload, collected_at)
VALUES (?, ?, ?)
ON CONFLICT(date) DO UPDATE SET
  payload = excluded.payload,
  collected_at = excluded.collected_at`,
    )
    .bind(date, JSON.stringify(result), now)
    .run();
  report({
    progress: 100,
    stage: "complete",
    label: "今日校准完成",
    detail: `已保存 ${items.length} 条新闻与匹配句子`,
    stats: { uniqueItems: items.length },
  });
  return result;
}

export async function handleGetNews(env: Env, now = Date.now()): Promise<Response> {
  const date = todayInBeijing(now);
  const cached = await getCachedNewsCalibration(env, date);
  if (cached && now - cached.collectedAt < NEWS_CACHE_TTL_MS) {
    return jsonResponse(cached, {
      headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" },
    });
  }
  try {
    return jsonResponse(await refreshNewsCalibration(env, now), {
      headers: { "Cache-Control": "public, max-age=300" },
    });
  } catch {
    if (cached) return jsonResponse(cached, { headers: { "Cache-Control": "no-cache" } });
    return jsonResponse({ error: "AI news calibration is temporarily unavailable" }, { status: 503 });
  }
}
