import { scoreToStage } from "../score-engine";
import type { Env, TimelineDayResponse } from "./shared";
import { getCommunityScore } from "./score";
import { jsonResponse } from "./shared";

export async function handleGetTimeline(_request: Request, env: Env): Promise<Response> {
  const snapshots = await env.DB
    .prepare("SELECT date, score, voter_count FROM daily_snapshots ORDER BY date DESC LIMIT 90")
    .all<{
      date: string;
      score: number;
      voter_count: number;
    }>();

  const results: TimelineDayResponse[] = (snapshots.results ?? [])
    .reverse()
    .map((snap) => ({
      date: snap.date,
      score: snap.score,
      stage: scoreToStage(snap.score),
      voterCount: snap.voter_count,
    }));

  return jsonResponse(results, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}

export async function handleGetTimelineDay(request: Request, env: Env, date: string): Promise<Response> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return jsonResponse({ error: "invalid date format" }, { status: 400 });
  }

  const snap = await env.DB
    .prepare("SELECT date, score, voter_count FROM daily_snapshots WHERE date = ?")
    .bind(date)
    .first<{
      date: string;
      score: number;
      voter_count: number;
    }>();

  if (!snap) {
    return jsonResponse({ error: "not found" }, { status: 404 });
  }

  return jsonResponse({
    date: snap.date,
    score: snap.score,
    stage: scoreToStage(snap.score),
    voterCount: snap.voter_count,
  } satisfies TimelineDayResponse, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}

export async function recordDailySnapshot(
  env: Env,
  date: string,
  now = Date.now(),
): Promise<void> {
  const community = await getCommunityScore(env);
  await env.DB
    .prepare(
      `INSERT INTO daily_snapshots (date, score, voter_count, created_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(date) DO UPDATE SET
         score = excluded.score,
         voter_count = excluded.voter_count`,
    )
    .bind(
      date,
      community.score,
      community.voterCount,
      now,
    )
    .run();
}
