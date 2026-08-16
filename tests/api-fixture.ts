import type { Page, Request, Route } from "@playwright/test";

export const APP_PATH = "/liang-intensity-calibrator/";
export const API_ORIGIN = "http://127.0.0.1:8787";
export const PAGE_ORIGIN = "http://127.0.0.1:5173";
export const MANUAL_STORAGE_KEY = "liang-slider:manual-position:v1";

export const INITIAL_SCORE = {
  score: 2.5,
  stage: "梁圣",
  voterCount: 4,
  todayVoterCount: 1,
  positiveCount: 2,
  negativeCount: 1,
  neutralCount: 1,
  positivePoints: 12,
  negativePoints: -2,
} as const;

type EndpointFailure = "abort" | 503;

interface ApiRouteOptions {
  scoreFailure?: EndpointFailure;
  voteFailure?: EndpointFailure;
  newsFailure?: EndpointFailure;
  chatFailure?: EndpointFailure;
}

export interface ApiRouteLog {
  scoreRequests: Request[];
  timelineRequests: Request[];
  voteRequests: Request[];
  preflightRequests: Request[];
  newsRequests: Request[];
  chatRequests: Request[];
  conversationRequests: Request[];
  modePositionRequests: Request[];
}

// 镜像真实服务器的回显行为：允许来源跟随页面实际端口，
// 便于在任意预览端口（如 5173 被占用时的临时端口）运行 e2e。
function corsHeadersFor(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

const NEWS_JOB_ID = "00000000-0000-4000-8000-000000000014";
const NEWS_RESULT = {
  date: "2026-08-14",
  variant: "deep",
  score: 9,
  stage: "梁神",
  headline: "开放与效率成为今天的主信号",
  rationale: "两条高可信新闻同时指向开放模型和更低推理成本。",
  dimensions: { originality: 0.7, openness: 0.9, efficiency: 0.8, intelligence: 0.4, restraint: 0.2 },
  quote: { id: "efficiency", dimension: "efficiency", text: "我们会优先考虑成本效率。", timestamp: "02:21:31" },
  quoteSource: "https://example.com/original",
  transcriptSource: "https://example.com/transcript",
  sourceCaveat: "未经本人确认。",
  items: [{
    id: "news-1", title: "Open model release", summaryZh: "一个开放模型降低了推理成本。",
    url: "https://example.com/news", source: "Official release", publishedAt: "2026-08-14T02:00:00Z", tags: ["开源", "效率"],
  }],
  collectedAt: Date.now(),
};

const QUICK_NEWS_RESULT = {
  date: "2026-08-14",
  variant: "quick",
  score: 3,
  stage: "梁圣",
  headline: "快速版：规则信号校准",
  rationale: "定价与缓存信号 -1（token 成本连续 1 小时上涨扣 3 分；缓存命中率变动 +2 分）；DeepSeek 最强模型 DeepSeek V4 Pro 0813 (max) 排名第 8，较上一小时上升 2 位，信号 +10；快速版仅运行规则性来源，不抓取新闻。",
  dimensions: { originality: 0, openness: 0, efficiency: 0, intelligence: 0, restraint: 0 },
  quote: { id: "neutral", dimension: "neutral", text: "", timestamp: "" },
  quoteSource: "",
  transcriptSource: "",
  sourceCaveat: "快速版仅依据规则信号。",
  items: [],
  collectedAt: Date.now(),
};

function newsJob(status: "running" | "completed", variant: "quick" | "deep") {
  const completed = status === "completed";
  const result = variant === "quick" ? QUICK_NEWS_RESULT : NEWS_RESULT;
  return {
    id: NEWS_JOB_ID,
    status,
    variant,
    progress: completed ? 100 : 42,
    stage: completed ? "complete" : "web-search",
    label: completed ? "今日校准完成" : "中英双路检索",
    detail: completed ? "已保存 1 条新闻与匹配句子" : "中文检索完成 · 1 条",
    startedAt: Date.now() - 1_000,
    updatedAt: Date.now(),
    elapsedMs: completed ? 1_000 : 250,
    stats: { directItems: 1, webItems: completed ? 1 : 0, uniqueItems: completed ? 1 : undefined },
    events: [{
      id: 1,
      progress: completed ? 100 : 42,
      stage: completed ? "complete" : "web-search",
      label: completed ? "今日校准完成" : "中英双路检索",
      detail: completed ? "已保存 1 条新闻与匹配句子" : "中文检索完成 · 1 条",
      at: Date.now(),
    }],
    ...(completed ? { result } : {}),
  };
}

function voteScore(position: number) {
  return {
    score: position,
    stage: position >= 15
      ? "梁祖"
      : position >= 9
        ? "梁神"
        : position >= 3
          ? "梁圣"
          : position >= -3
            ? "梁子"
            : position >= -9
              ? "牢梁"
              : "小难梁",
    voterCount: 1,
    todayVoterCount: 1,
    positiveCount: position > 0 ? 1 : 0,
    negativeCount: position < 0 ? 1 : 0,
    neutralCount: position === 0 ? 1 : 0,
    positivePoints: position > 0 ? position : 0,
    negativePoints: position < 0 ? position : 0,
  };
}

async function failRoute(
  route: Route,
  failure: EndpointFailure,
  corsHeaders: Record<string, string>,
): Promise<void> {
  if (failure === "abort") {
    await route.abort("failed");
    return;
  }
  await route.fulfill({
    status: failure,
    headers: corsHeaders,
    contentType: "application/json",
    body: JSON.stringify({ error: "fixture failure" }),
  });
}

export async function installApiRoutes(
  page: Page,
  options: ApiRouteOptions = {},
): Promise<ApiRouteLog> {
  const log: ApiRouteLog = {
    scoreRequests: [],
    timelineRequests: [],
    voteRequests: [],
    preflightRequests: [],
    newsRequests: [],
    chatRequests: [],
    conversationRequests: [],
    modePositionRequests: [],
  };
  let storedModePositions = { news: null as number | null, chat: null as number | null };
  let lastNewsVariant: "quick" | "deep" = "quick";

  await page.route(`${API_ORIGIN}/api/**`, async (route) => {
    const request = route.request();
    const corsHeaders = corsHeadersFor(new URL(page.url()).origin || PAGE_ORIGIN);
    if (request.method() === "OPTIONS") {
      log.preflightRequests.push(request);
      await route.fulfill({ status: 204, headers: corsHeaders, body: "" });
      return;
    }

    const pathname = new URL(request.url()).pathname;
    if (pathname === "/api/score") {
      log.scoreRequests.push(request);
      if (options.scoreFailure) {
        await failRoute(route, options.scoreFailure, corsHeaders);
        return;
      }
      await route.fulfill({
        headers: corsHeaders,
        contentType: "application/json",
        body: JSON.stringify(INITIAL_SCORE),
      });
      return;
    }

    if (pathname === "/api/timeline") {
      log.timelineRequests.push(request);
      await route.fulfill({
        headers: corsHeaders,
        contentType: "application/json",
        body: "[]",
      });
      return;
    }

    if (pathname === "/api/vote") {
      log.voteRequests.push(request);
      if (options.voteFailure) {
        await failRoute(route, options.voteFailure, corsHeaders);
        return;
      }
      const body = request.postDataJSON() as { position: number };
      await route.fulfill({
        headers: corsHeaders,
        contentType: "application/json",
        body: JSON.stringify({
          accepted: true,
          userPosition: body.position,
          nextVoteAt: 0,
          ...voteScore(body.position),
        }),
      });
      return;
    }

    if (pathname === "/api/news/jobs" && request.method() === "POST") {
      log.newsRequests.push(request);
      if (options.newsFailure) {
        await failRoute(route, options.newsFailure, corsHeaders);
        return;
      }
      const body = request.postDataJSON() as { variant?: "quick" | "deep" };
      if (body.variant === "quick" || body.variant === "deep") lastNewsVariant = body.variant;
      await route.fulfill({
        headers: corsHeaders,
        contentType: "application/json",
        body: JSON.stringify(newsJob("running", lastNewsVariant)),
      });
      return;
    }

    if (pathname === `/api/news/jobs/${NEWS_JOB_ID}`) {
      await route.fulfill({
        headers: corsHeaders,
        contentType: "application/json",
        body: JSON.stringify(newsJob("completed", lastNewsVariant)),
      });
      return;
    }

    if (pathname === "/api/chat") {
      log.chatRequests.push(request);
      if (options.chatFailure) {
        await failRoute(route, options.chatFailure, corsHeaders);
        return;
      }
      const body = request.postDataJSON() as { message: string; conversationId?: string };
      const conversationId = body.conversationId ?? "00000000-0000-4000-8000-000000000099";
      await route.fulfill({
        headers: corsHeaders,
        contentType: "application/json",
        body: JSON.stringify({
          score: 6,
          stage: "梁圣",
          answer: "我们可以先看真正的技术瓶颈，再决定要不要扩大产品线。",
          calibrationSummary: "这段输入偏向主线意识，但还缺少成本约束。",
          dimensions: { originality: 0.4, openness: 0.2, efficiency: 0.2, intelligence: 0.7, restraint: 0.5 },
          disclaimer: "基于公开材料的模拟，不代表本人。",
          conversation: { id: conversationId, title: body.message.slice(0, 24) },
        }),
      });
      return;
    }

    if (pathname === "/api/conversations" && request.method() === "GET") {
      log.conversationRequests.push(request);
      await route.fulfill({
        headers: corsHeaders,
        contentType: "application/json",
        body: "[]",
      });
      return;
    }

    if (/^\/api\/conversations\/[0-9a-f-]{36}$/.test(pathname) && request.method() === "DELETE") {
      log.conversationRequests.push(request);
      await route.fulfill({ status: 204, headers: corsHeaders, body: "" });
      return;
    }

    if (pathname === "/api/opencode-models" && request.method() === "GET") {
      await route.fulfill({
        headers: corsHeaders,
        contentType: "application/json",
        body: JSON.stringify({
          models: ["opencode/deepseek-v4-flash-free", "opencode-go/deepseek-v4-flash"],
          active: "opencode/deepseek-v4-flash-free",
          activeInList: true,
        }),
      });
      return;
    }

    if (pathname === "/api/mode-positions" && request.method() === "GET") {
      log.modePositionRequests.push(request);
      await route.fulfill({
        headers: corsHeaders,
        contentType: "application/json",
        body: JSON.stringify(storedModePositions),
      });
      return;
    }

    if (pathname === "/api/mode-positions" && request.method() === "PUT") {
      log.modePositionRequests.push(request);
      const body = request.postDataJSON() as { news?: number | null; chat?: number | null };
      storedModePositions = {
        news: body.news === undefined ? storedModePositions.news : body.news,
        chat: body.chat === undefined ? storedModePositions.chat : body.chat,
      };
      await route.fulfill({
        headers: corsHeaders,
        contentType: "application/json",
        body: JSON.stringify(storedModePositions),
      });
      return;
    }

    await route.fulfill({ status: 404, headers: corsHeaders, body: "" });
  });

  return log;
}

export async function setSliderScore(page: Page, score: number): Promise<void> {
  await page.locator("#strength-slider").evaluate((element, value) => {
    const slider = element as HTMLInputElement;
    slider.value = String(value);
    slider.dispatchEvent(new Event("input", { bubbles: true }));
  }, score);
}

export async function submitSliderScore(page: Page, score: number): Promise<void> {
  await page.locator("#strength-slider").evaluate((element, value) => {
    const slider = element as HTMLInputElement;
    slider.value = String(value);
    slider.dispatchEvent(new Event("input", { bubbles: true }));
    slider.dispatchEvent(new Event("change", { bubbles: true }));
  }, score);
}
