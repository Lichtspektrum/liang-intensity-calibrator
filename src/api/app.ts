import { handlePostChat } from "./chat";
import {
  handleDeleteConversation,
  handleGetConversation,
  handleListConversations,
} from "./conversations";
import { handleGetModePositions, handlePutModePositions } from "./mode-position";
import { handleGetNews } from "./news";
import { handleGetNewsJob, handlePostNewsJob } from "./news-jobs";
import { handleGetScore } from "./score";
import {
  allowedOrigin,
  corsHeaders,
  jsonResponse,
  type Env,
} from "./shared";
import { handleGetTimeline } from "./timeline";
import { handlePostVote } from "./vote";

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
  if (url.pathname === "/api/score" && request.method === "GET") return handleGetScore(env);
  if (url.pathname === "/api/vote" && request.method === "POST") return handlePostVote(request, env);
  if (url.pathname === "/api/timeline" && request.method === "GET") return handleGetTimeline(request, env);
  if (url.pathname === "/api/news" && request.method === "GET") return handleGetNews(env);
  if (url.pathname === "/api/news/jobs" && request.method === "POST") {
    return handlePostNewsJob(request, env);
  }
  const newsJobMatch = url.pathname.match(/^\/api\/news\/jobs\/([0-9a-f-]+)$/iu);
  if (newsJobMatch && request.method === "GET") return handleGetNewsJob(newsJobMatch[1]);
  if (url.pathname === "/api/chat" && request.method === "POST") return handlePostChat(request, env);
  if (url.pathname === "/api/conversations" && request.method === "GET") {
    return handleListConversations(env);
  }
  const conversationMatch = url.pathname.match(/^\/api\/conversations\/([0-9a-f-]+)$/iu);
  if (conversationMatch && request.method === "GET") {
    return handleGetConversation(conversationMatch[1], env);
  }
  if (conversationMatch && request.method === "DELETE") {
    return handleDeleteConversation(conversationMatch[1], env);
  }
  if (url.pathname === "/api/mode-positions" && request.method === "GET") {
    return handleGetModePositions(env);
  }
  if (url.pathname === "/api/mode-positions" && request.method === "PUT") {
    return handlePutModePositions(request, env);
  }
  return jsonResponse({ error: "not found" }, { status: 404 });
}

export async function handleApiRequest(request: Request, env: Env): Promise<Response> {
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
  } catch (error) {
    console.error(error);
    return withCors(
      jsonResponse({ error: "internal server error" }, { status: 500 }),
      origin,
      env,
    );
  }
}
