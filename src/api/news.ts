import { analyzeTodaysNews, type NewsCalibration } from "../ai-news-analyzer";
import { collectTodaysAiNews, deduplicateNews } from "../ai-news-collector";
import { searchTodaysAiNews } from "../ai-news-search";
import { type Env, jsonResponse, todayInBeijing } from "./shared";

export const NEWS_CACHE_TTL_MS = 90 * 60 * 1_000;

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
): Promise<NewsCalibration> {
  const date = todayInBeijing(now);
  const runner = env.AI_RUNNER;
  report({
    progress: 4,
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
  report({
    progress: 94,
    stage: "score",
    label: "固定权重计分",
    detail: `五维证据已聚合，确定性公式得到 ${calibration.score > 0 ? "+" : ""}${calibration.score}`,
    stats: { uniqueItems: items.length },
  });
  await env.DB
    .prepare(
      `INSERT INTO news_calibrations (date, payload, collected_at)
VALUES (?, ?, ?)
ON CONFLICT(date) DO UPDATE SET
  payload = excluded.payload,
  collected_at = excluded.collected_at`,
    )
    .bind(date, JSON.stringify(calibration), now)
    .run();
  report({
    progress: 100,
    stage: "complete",
    label: "今日校准完成",
    detail: `已保存 ${items.length} 条新闻与匹配句子`,
    stats: { uniqueItems: items.length },
  });
  return calibration;
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
