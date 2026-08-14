import type { Page, Request, Route } from "@playwright/test";

export const APP_PATH = "/liang-intensity-calibrator/";
export const API_ORIGIN = "http://127.0.0.1:8787";
export const PAGE_ORIGIN = "http://127.0.0.1:5173";
export const VOTE_STORAGE_KEY = "liang-slider:vote:v3";

export const INITIAL_SCORE = {
  score: 2.5,
  stage: "梁圣",
  voterCount: 4,
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
}

export interface ApiRouteLog {
  scoreRequests: Request[];
  timelineRequests: Request[];
  voteRequests: Request[];
  preflightRequests: Request[];
}

const corsHeaders = {
  "Access-Control-Allow-Origin": PAGE_ORIGIN,
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  Vary: "Origin",
};

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
    positiveCount: position > 0 ? 1 : 0,
    negativeCount: position < 0 ? 1 : 0,
    neutralCount: position === 0 ? 1 : 0,
    positivePoints: position > 0 ? position : 0,
    negativePoints: position < 0 ? position : 0,
  };
}

async function failRoute(route: Route, failure: EndpointFailure): Promise<void> {
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
  };

  await page.route(`${API_ORIGIN}/api/**`, async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") {
      log.preflightRequests.push(request);
      await route.fulfill({ status: 204, headers: corsHeaders, body: "" });
      return;
    }

    const pathname = new URL(request.url()).pathname;
    if (pathname === "/api/score") {
      log.scoreRequests.push(request);
      if (options.scoreFailure) {
        await failRoute(route, options.scoreFailure);
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
        await failRoute(route, options.voteFailure);
        return;
      }
      const body = request.postDataJSON() as { position: number };
      await route.fulfill({
        headers: corsHeaders,
        contentType: "application/json",
        body: JSON.stringify({
          accepted: true,
          userPosition: body.position,
          nextVoteAt: Date.now() + 3 * 60 * 60 * 1000,
          ...voteScore(body.position),
        }),
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
