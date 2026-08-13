import { handleGetScore } from "./api/score";
import { handlePostVote } from "./api/vote";
import { handleGetTimeline, handleGetTimelineDay } from "./api/timeline";
import { handleScheduled } from "./api/scheduled";
import type { Env } from "./api/shared";

function isLocalDevelopment(url: URL): boolean {
  return url.hostname === "localhost" || url.hostname === "127.0.0.1";
}

async function deleteKvKeysWithPrefix(env: Env, prefix: string): Promise<void> {
  let cursor: string | undefined;
  do {
    const page = await env.KV.list({ prefix, cursor });
    await Promise.all(page.keys.map(({ name }) => env.KV.delete(name)));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
}

async function resetLocalVoteData(env: Env): Promise<void> {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM votes"),
    env.DB.prepare("DELETE FROM daily_votes"),
    env.DB.prepare("DELETE FROM score_snapshots"),
  ]);
  await env.KV.delete("signed_score_state");
  await deleteKvKeysWithPrefix(env, "vote:ip:");
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (
      request.method === "GET" &&
      url.searchParams.get("reset") === "1" &&
      isLocalDevelopment(url)
    ) {
      await resetLocalVoteData(env);
      url.searchParams.delete("reset");
      return Response.redirect(url.toString(), 302);
    }

    if (url.pathname === "/api/score" && request.method === "GET") {
      return handleGetScore(env);
    }

    if (url.pathname === "/api/vote" && request.method === "POST") {
      return handlePostVote(request, env);
    }

    if (url.pathname === "/api/timeline" && request.method === "GET") {
      return handleGetTimeline(request, env);
    }

    if (url.pathname.startsWith("/api/timeline/") && request.method === "GET") {
      const date = url.pathname.slice("/api/timeline/".length);
      return handleGetTimelineDay(request, env, date);
    }

    return env.ASSETS.fetch(request);
  },

  async scheduled(_controller: ScheduledController, env: Env, _ctx: ExecutionContext): Promise<void> {
    await handleScheduled(env);
  },
};
