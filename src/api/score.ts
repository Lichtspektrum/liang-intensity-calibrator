import {
  COLD_START_DAY_THRESHOLD,
  COLD_START_VOTER_THRESHOLD,
  DEFAULT_SCORE,
  clampScore,
  createInitialScoreState,
  decayToNow,
  scoreFromVotePoints,
  scoreToStage,
  type ScoreState,
} from "../score-engine";
import { type Env, type ScoreResponse, jsonResponse, todayInBeijing } from "./shared";

const CURRENT_SCORE_KEY = "signed_score_state";

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

export interface TodayVoteSummary {
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  uniqueVoters: number;
  totalVotePoints: number;
  positivePoints: number;
  negativePoints: number;
}

export async function getTodayVoteSummary(env: Env): Promise<TodayVoteSummary> {
  const today = todayInBeijing();
  const row = await env.DB
    .prepare(
      `SELECT
        SUM(CASE WHEN position > 0 THEN 1 ELSE 0 END) as positive_count,
        SUM(CASE WHEN position < 0 THEN 1 ELSE 0 END) as negative_count,
        SUM(CASE WHEN position = 0 THEN 1 ELSE 0 END) as neutral_count,
        COUNT(DISTINCT fingerprint) as voters,
        SUM(position) as vote_points,
        SUM(CASE WHEN position > 0 THEN position ELSE 0 END) as positive_points,
        SUM(CASE WHEN position < 0 THEN position ELSE 0 END) as negative_points
       FROM votes
       WHERE date = ?`,
    )
    .bind(today)
    .first<{
      positive_count: number | null;
      negative_count: number | null;
      neutral_count: number | null;
      voters: number | null;
      vote_points: number | null;
      positive_points: number | null;
      negative_points: number | null;
    }>();
  return {
    positiveCount: row?.positive_count ?? 0,
    negativeCount: row?.negative_count ?? 0,
    neutralCount: row?.neutral_count ?? 0,
    uniqueVoters: row?.voters ?? 0,
    totalVotePoints: row?.vote_points ?? 0,
    positivePoints: row?.positive_points ?? 0,
    negativePoints: row?.negative_points ?? 0,
  };
}

export async function getTodayVoteCounts(env: Env): Promise<Omit<TodayVoteSummary, "totalVotePoints">> {
  const {
    positiveCount,
    negativeCount,
    neutralCount,
    uniqueVoters,
    positivePoints,
    negativePoints,
  } = await getTodayVoteSummary(env);
  return {
    positiveCount,
    negativeCount,
    neutralCount,
    uniqueVoters,
    positivePoints,
    negativePoints,
  };
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

export async function getScoreData(env: Env): Promise<ScoreResponse> {
  const state = await getScoreState(env);
  const stage = scoreToStage(state.score);
  const [voteCounts, recentEvents] = await Promise.all([
    getTodayVoteCounts(env),
    getRecentEvents(env, 15),
  ]);
  const isColdStart =
    state.cumulativeVoters < COLD_START_VOTER_THRESHOLD &&
    state.daysSinceLaunch < COLD_START_DAY_THRESHOLD;

  return {
    score: Math.round(state.score * 100) / 100,
    stage,
    positiveCount: voteCounts.positiveCount,
    negativeCount: voteCounts.negativeCount,
    neutralCount: voteCounts.neutralCount,
    positivePoints: voteCounts.positivePoints,
    negativePoints: voteCounts.negativePoints,
    isColdStart,
    recentEvents,
  };
}

export async function handleGetScore(env: Env): Promise<Response> {
  return jsonResponse(await getScoreData(env), {
    headers: { "Cache-Control": "no-store" },
  });
}
