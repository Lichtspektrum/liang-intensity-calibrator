import { scoreToStage } from "../score-engine";
import type { Env, TimelineDayResponse } from "./shared";
import { getCommunityScore } from "./score";
import { jsonResponse } from "./shared";

function isCalendarDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export async function handleGetTimeline(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const conditions: string[] = [];
  const bindings: string[] = [];
  if (isCalendarDate(from)) {
    conditions.push("date >= ?");
    bindings.push(from);
  }
  if (isCalendarDate(to)) {
    conditions.push("date <= ?");
    bindings.push(to);
  }

  let sql = "SELECT date, score, voter_count FROM daily_snapshots";
  if (conditions.length > 0) sql += ` WHERE ${conditions.join(" AND ")}`;
  sql += " ORDER BY date DESC LIMIT 90";

  const statement = env.DB.prepare(sql);
  const snapshots = await (bindings.length > 0 ? statement.bind(...bindings) : statement)
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
