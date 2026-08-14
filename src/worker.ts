import { handleGetScore } from "./api/score";
import { handlePostVote } from "./api/vote";
import { handleGetTimeline } from "./api/timeline";
import { handleScheduled } from "./api/scheduled";
import {
  allowedOrigin,
  corsHeaders,
  jsonResponse,
  type Env,
} from "./api/shared";

function withCors(response: Response, origin: string, env: Env): Response {
  const headers = new Headers(response.headers);
  new Headers(corsHeaders(origin, env)).forEach((value, key) => headers.set(key, value));

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function dispatchApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname === "/api/score" && request.method === "GET") {
    return handleGetScore(env);
  }
  if (url.pathname === "/api/vote" && request.method === "POST") {
    return handlePostVote(request, env);
  }
  if (url.pathname === "/api/timeline" && request.method === "GET") {
    return handleGetTimeline(request, env);
  }

  return jsonResponse({ error: "not found" }, { status: 404 });
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) {
      return jsonResponse({ error: "not found" }, { status: 404 });
    }

    const origin = request.headers.get("Origin") ?? "";
    if (!allowedOrigin(origin, env)) {
      return jsonResponse(
        { error: "origin not allowed" },
        { status: 403, headers: corsHeaders(origin, env) },
      );
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin, env) });
    }

    try {
      return withCors(await dispatchApi(request, env), origin, env);
    } catch {
      return withCors(
        jsonResponse({ error: "internal server error" }, { status: 500 }),
        origin,
        env,
      );
    }
  },

  async scheduled(
    controller: ScheduledController,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<void> {
    await handleScheduled(env, controller.scheduledTime);
  },
};
