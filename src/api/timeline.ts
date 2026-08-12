import { scoreToStage } from "../score-engine";
import type { Env, TimelineDayResponse, TimelineEventResponse } from "./shared";
import { getScoreState } from "./score";
import { jsonResponse } from "./shared";

function parseDateParam(url: URL, name: string): string | null {
  const val = url.searchParams.get(name);
  if (!val) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) return null;
  return val;
}

export async function handleGetTimeline(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const from = parseDateParam(url, "from");
  const to = parseDateParam(url, "to");

  let query = "SELECT date, score, level, stage, up_count, down_count, major_event_id FROM score_snapshots";
  const binds: string[] = [];
  const conditions: string[] = [];

  if (from) {
    conditions.push("date >= ?");
    binds.push(from);
  }
  if (to) {
    conditions.push("date <= ?");
    binds.push(to);
  }
  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }
  query += " ORDER BY date ASC";

  const snapshots = await env.DB
    .prepare(query)
    .bind(...binds)
    .all<{ date: string; score: number; level: number; stage: string; up_count: number; down_count: number; major_event_id: number | null }>();

  const results: TimelineDayResponse[] = [];
  for (const snap of snapshots.results ?? []) {
    const events = await getEventsForDate(env, snap.date);
    results.push({
      date: snap.date,
      score: snap.score,
      level: snap.level,
      stage: snap.stage,
      upCount: snap.up_count,
      downCount: snap.down_count,
      events,
    });
  }

  return jsonResponse(results, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}

export async function handleGetTimelineDay(request: Request, env: Env, date: string): Promise<Response> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return jsonResponse({ error: "invalid date format" }, { status: 400 });
  }

  const snap = await env.DB
    .prepare("SELECT date, score, level, stage, up_count, down_count FROM score_snapshots WHERE date = ?")
    .bind(date)
    .first<{ date: string; score: number; level: number; stage: string; up_count: number; down_count: number }>();

  if (!snap) {
    return jsonResponse({ error: "not found" }, { status: 404 });
  }

  const events = await getEventsForDate(env, date);

  return jsonResponse({
    date: snap.date,
    score: snap.score,
    level: snap.level,
    stage: snap.stage,
    upCount: snap.up_count,
    downCount: snap.down_count,
    events,
  } satisfies TimelineDayResponse, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}

async function getEventsForDate(env: Env, date: string): Promise<TimelineEventResponse[]> {
  const events = await env.DB
    .prepare("SELECT id, date, title, summary, is_major FROM news_events WHERE date = ? ORDER BY impact DESC")
    .bind(date)
    .all<{ id: number; date: string; title: string; summary: string | null; is_major: number }>();
  return (events.results ?? []).map((e) => ({
    id: e.id,
    date: e.date,
    title: e.title,
    summary: e.summary,
    isMajor: e.is_major === 1,
  }));
}

export async function recordDailySnapshot(env: Env, date: string): Promise<void> {
  const state = await getScoreState(env);
  const level = Math.round(state.score * 100) / 100;
  const stage = scoreToStage(state.score);

  const voteCounts = await env.DB
    .prepare("SELECT SUM(CASE WHEN direction='up' THEN 1 ELSE 0 END) as up, SUM(CASE WHEN direction='down' THEN 1 ELSE 0 END) as down FROM votes WHERE date = ?")
    .bind(date)
    .first<{ up: number | null; down: number | null }>();

  const majorEvent = await env.DB
    .prepare("SELECT id FROM news_events WHERE date = ? AND is_major = 1 ORDER BY impact DESC LIMIT 1")
    .bind(date)
    .first<{ id: number }>();

  await env.DB
    .prepare(
      `INSERT OR REPLACE INTO score_snapshots (date, score, level, stage, up_count, down_count, major_event_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      date,
      state.score,
      level,
      stage,
      voteCounts?.up ?? 0,
      voteCounts?.down ?? 0,
      majorEvent?.id ?? null,
    )
    .run();

  const newState = { ...state, daysSinceLaunch: state.daysSinceLaunch + 1 };
  await env.KV.put("score_state", JSON.stringify(newState));
}
