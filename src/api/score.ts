import {
  scoreFromBallots,
  scoreToStage,
} from "../score-engine";
import { type Env, type ScoreResponse, jsonResponse } from "./shared";

export interface CommunityScore {
  score: number;
  voterCount: number;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  positivePoints: number;
  negativePoints: number;
}

interface CommunityAggregateRow {
  voters: number | null;
  score: number | null;
  positive_count: number | null;
  negative_count: number | null;
  neutral_count: number | null;
  positive_points: number | null;
  negative_points: number | null;
}

export async function getCommunityScore(env: Env): Promise<CommunityScore> {
  const row = await env.DB
    .prepare(
      `SELECT
  COUNT(*) AS voters,
  AVG(position) AS score,
  SUM(CASE WHEN position > 0 THEN 1 ELSE 0 END) AS positive_count,
  SUM(CASE WHEN position < 0 THEN 1 ELSE 0 END) AS negative_count,
  SUM(CASE WHEN position = 0 THEN 1 ELSE 0 END) AS neutral_count,
  SUM(CASE WHEN position > 0 THEN position ELSE 0 END) AS positive_points,
  SUM(CASE WHEN position < 0 THEN position ELSE 0 END) AS negative_points
FROM voters`,
    )
    .first<CommunityAggregateRow>();

  const voterCount = row?.voters ?? 0;
  const positivePoints = row?.positive_points ?? 0;
  const negativePoints = row?.negative_points ?? 0;
  const score = scoreFromBallots({
    voters: voterCount,
    total: positivePoints + negativePoints,
  });

  return {
    score,
    voterCount,
    positiveCount: row?.positive_count ?? 0,
    negativeCount: row?.negative_count ?? 0,
    neutralCount: row?.neutral_count ?? 0,
    positivePoints,
    negativePoints,
  };
}

export async function getScoreData(env: Env): Promise<ScoreResponse> {
  const aggregate = await getCommunityScore(env);

  return {
    ...aggregate,
    stage: scoreToStage(aggregate.score),
  };
}

export async function handleGetScore(env: Env): Promise<Response> {
  return jsonResponse(await getScoreData(env), {
    headers: { "Cache-Control": "no-store" },
  });
}
