import {
  COLD_START_DAY_THRESHOLD,
  COLD_START_VOTER_THRESHOLD,
  DEFAULT_SCORE,
  MAX_SCORE,
  applyNewsDelta,
  applyVote,
  applyVoteChange,
  clampScore,
  createInitialScoreState,
  decayToNow,
  scoreFromVotePoints,
  scoreToStage,
  type ScoreState,
} from "../score-engine";
import { type Env, type ScoreResponse, jsonResponse, todayInBeijing } from "./shared";

const CURRENT_SCORE_KEY = "score_state";

export async function getScoreState(env: Env): Promise<ScoreState> {
  const now = Date.now();
  const today = todayInBeijing();

  const cached = await env.KV.get(CURRENT_SCORE_KEY, "json") as ScoreState | null;
  if (!cached) {
    const initial = createInitialScoreState(now);
    await env.KV.put(
      CURRENT_SCORE_KEY,
      JSON.stringify({ ...initial, launchDate: today }),
    );
    return initial;
  }

  const decayed = decayToNow(cached, now);
  if (Math.abs(decayed.score - cached.score) > 0.01 || decayed.lastUpdateTs !== cached.lastUpdateTs) {
    await env.KV.put(CURRENT_SCORE_KEY, JSON.stringify(decayed));
  }
  return decayed;
}

export async function applyVoteToScore(
  env: Env,
  direction: "up" | "down",
): Promise<ScoreState> {
  const now = Date.now();
  const state = await getScoreState(env);
  const decayed = decayToNow(state, now);
  const newScore = applyVote(decayed.score, direction);
  const newState: ScoreState = {
    ...decayed,
    score: newScore,
    lastUpdateTs: now,
    cumulativeVoters: decayed.cumulativeVoters + 1,
  };
  await env.KV.put(CURRENT_SCORE_KEY, JSON.stringify(newState));
  return newState;
}

export async function applyVoteChangeToScore(
  env: Env,
  oldDirection: "up" | "down",
  newDirection: "up" | "down",
): Promise<ScoreState> {
  const now = Date.now();
  const state = await getScoreState(env);
  const decayed = decayToNow(state, now);
  const newScore = applyVoteChange(decayed.score, oldDirection, newDirection);
  const newState: ScoreState = {
    ...decayed,
    score: newScore,
    lastUpdateTs: now,
  };
  await env.KV.put(CURRENT_SCORE_KEY, JSON.stringify(newState));
  return newState;
}

export async function applyVotePointsToScore(
  env: Env,
  totalVotePoints: number,
  voterCount: number,
  isNewVoter: boolean,
): Promise<ScoreState> {
  const now = Date.now();
  const state = await getScoreState(env);
  const newState: ScoreState = {
    ...state,
    score: scoreFromVotePoints(totalVotePoints, voterCount),
    lastUpdateTs: now,
    cumulativeVoters: state.cumulativeVoters + (isNewVoter ? 1 : 0),
  };
  await env.KV.put(CURRENT_SCORE_KEY, JSON.stringify(newState));
  return newState;
}

export async function applyNewsDeltaToScore(env: Env, delta: number): Promise<ScoreState> {
  const now = Date.now();
  const state = await getScoreState(env);
  const decayed = decayToNow(state, now);
  const newScore = clampScore(decayed.score + delta);
  const newState: ScoreState = {
    ...decayed,
    score: newScore,
    lastUpdateTs: now,
  };
  await env.KV.put(CURRENT_SCORE_KEY, JSON.stringify(newState));
  return newState;
}

export interface TodayVoteSummary {
  upCount: number;
  downCount: number;
  uniqueVoters: number;
  totalVotePoints: number;
  upVotePoints: number;
  downVotePoints: number;
}

export async function getTodayVoteSummary(env: Env): Promise<TodayVoteSummary> {
  const today = todayInBeijing();
  const row = await env.DB
    .prepare(
      `SELECT
        SUM(CASE WHEN direction = 'up' THEN 1 ELSE 0 END) as up,
        SUM(CASE WHEN direction = 'down' THEN 1 ELSE 0 END) as down,
        COUNT(DISTINCT fingerprint) as voters,
        SUM(COALESCE(position, CASE WHEN direction = 'up' THEN 30 ELSE 0 END)) as vote_points,
        SUM(CASE WHEN direction = 'up' THEN COALESCE(position, 30) ELSE 0 END) as up_vote_points,
        SUM(CASE WHEN direction = 'down' THEN COALESCE(position, 0) ELSE 0 END) as down_vote_points
       FROM votes
       WHERE date = ?`,
    )
    .bind(today)
    .first<{
      up: number | null;
      down: number | null;
      voters: number | null;
      vote_points: number | null;
      up_vote_points: number | null;
      down_vote_points: number | null;
    }>();
  return {
    upCount: row?.up ?? 0,
    downCount: row?.down ?? 0,
    uniqueVoters: row?.voters ?? 0,
    totalVotePoints: row?.vote_points ?? 0,
    upVotePoints: row?.up_vote_points ?? 0,
    downVotePoints: row?.down_vote_points ?? 0,
  };
}

export async function getTodayVoteCounts(env: Env): Promise<Pick<TodayVoteSummary, "upCount" | "downCount" | "uniqueVoters" | "upVotePoints" | "downVotePoints">> {
  const { upCount, downCount, uniqueVoters, upVotePoints, downVotePoints } = await getTodayVoteSummary(env);
  return { upCount, downCount, uniqueVoters, upVotePoints, downVotePoints };
}

export async function getRecentEvents(env: Env, limit = 15) {
  const events = await env.DB
    .prepare("SELECT id, date, title, summary, is_major FROM news_events ORDER BY date DESC, id DESC LIMIT ?")
    .bind(limit)
    .all<{ id: number; date: string; title: string; summary: string | null; is_major: number }>();
  return (events.results ?? []).map((e) => ({
    id: e.id,
    date: e.date,
    title: e.title,
    summary: e.summary,
    isMajor: e.is_major === 1,
  }));
}

export async function handleGetScore(env: Env): Promise<Response> {
  const state = await getScoreState(env);
  const level = Math.round(state.score * 100) / 100;
  const stage = scoreToStage(state.score);
  const { upCount, downCount, upVotePoints, downVotePoints } = await getTodayVoteCounts(env);
  const isColdStart =
    state.cumulativeVoters < COLD_START_VOTER_THRESHOLD &&
    state.daysSinceLaunch < COLD_START_DAY_THRESHOLD;
  const recentEvents = await getRecentEvents(env, 15);

  const response: ScoreResponse = {
    score: Math.round(state.score * 100) / 100,
    level,
    stage,
    upCount,
    downCount,
    upVotePoints,
    downVotePoints,
    isColdStart,
    recentEvents,
  };

  return jsonResponse(response, {
    headers: { "Cache-Control": "no-store" },
  });
}
