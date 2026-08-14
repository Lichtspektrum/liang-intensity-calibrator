import { describe, expect, it } from "vitest";

import { getCommunityScore, handleGetScore } from "./score";
import { startOfTodayBeijingMs, type Env } from "./shared";

const EXPECTED_AGGREGATE_SQL = `SELECT
  COUNT(*) AS voters,
  AVG(position) AS score,
  SUM(CASE WHEN updated_at >= ? THEN 1 ELSE 0 END) AS today_voters,
  SUM(CASE WHEN position > 0 THEN 1 ELSE 0 END) AS positive_count,
  SUM(CASE WHEN position < 0 THEN 1 ELSE 0 END) AS negative_count,
  SUM(CASE WHEN position = 0 THEN 1 ELSE 0 END) AS neutral_count,
  SUM(CASE WHEN position > 0 THEN position ELSE 0 END) AS positive_points,
  SUM(CASE WHEN position < 0 THEN position ELSE 0 END) AS negative_points
FROM voters`;

interface AggregateRow {
  voters: number | null;
  score: number | null;
  today_voters: number | null;
  positive_count: number | null;
  negative_count: number | null;
  neutral_count: number | null;
  positive_points: number | null;
  negative_points: number | null;
}

function createAggregateEnv(row: AggregateRow) {
  const queries: string[] = [];
  const env = {
    DB: {
      prepare(sql: string) {
        queries.push(sql);
        return {
          bind() {
            return this;
          },
          async first<T>() {
            return row as T;
          },
        };
      },
    },
  } as unknown as Env;
  return { env, queries };
}

describe("community score aggregate", () => {
  it("derives the score, today count and vote totals from one active-voter query", async () => {
    const { env, queries } = createAggregateEnv({
      voters: 4,
      score: 13.37,
      today_voters: 2,
      positive_count: 2,
      negative_count: 1,
      neutral_count: 1,
      positive_points: 14,
      negative_points: -4,
    });

    await expect(getCommunityScore(env)).resolves.toEqual({
      score: 2.5,
      voterCount: 4,
      todayVoterCount: 2,
      positiveCount: 2,
      negativeCount: 1,
      neutralCount: 1,
      positivePoints: 14,
      negativePoints: -4,
    });
    expect(queries).toEqual([EXPECTED_AGGREGATE_SQL]);
  });

  it("binds the start of the current Beijing day to the today-voter count", async () => {
    const bound: unknown[][] = [];
    const env = {
      DB: {
        prepare() {
          return {
            bind(...values: unknown[]) {
              bound.push(values);
              return this;
            },
            async first() {
              return {
                voters: 1,
                score: 1,
                today_voters: 1,
                positive_count: 1,
                negative_count: 0,
                neutral_count: 0,
                positive_points: 1,
                negative_points: 0,
              };
            },
          };
        },
      },
    } as unknown as Env;

    await expect(getCommunityScore(env)).resolves.toMatchObject({ todayVoterCount: 1 });
    expect(bound).toEqual([[startOfTodayBeijingMs()]]);
  });

  it.each([
    { voters: 200, total: 201, expected: 1.01 },
    { voters: 200, total: -201, expected: -1.01 },
    { voters: 200, total: 501, expected: 2.51 },
    { voters: 200, total: -501, expected: -2.51 },
    { voters: 40, total: 403, expected: 10.08 },
    { voters: 40, total: -403, expected: -10.08 },
  ])("rounds the $total / $voters midpoint symmetrically to $expected", async ({
    voters,
    total,
    expected,
  }) => {
    const { env } = createAggregateEnv({
      voters,
      score: total / voters,
      today_voters: 0,
      positive_count: total > 0 ? voters : 0,
      negative_count: total < 0 ? voters : 0,
      neutral_count: 0,
      positive_points: Math.max(0, total),
      negative_points: Math.min(0, total),
    });

    await expect(getCommunityScore(env)).resolves.toMatchObject({ score: expected });
  });

  it("returns neutral zero totals before the first ballot", async () => {
    const { env } = createAggregateEnv({
      voters: 0,
      score: null,
      today_voters: null,
      positive_count: null,
      negative_count: null,
      neutral_count: null,
      positive_points: null,
      negative_points: null,
    });

    await expect(getCommunityScore(env)).resolves.toEqual({
      score: 0,
      voterCount: 0,
      todayVoterCount: 0,
      positiveCount: 0,
      negativeCount: 0,
      neutralCount: 0,
      positivePoints: 0,
      negativePoints: 0,
    });
  });

  it("serves the aggregate directly without cold-start or news lookups", async () => {
    const { env, queries } = createAggregateEnv({
      voters: 4,
      score: 2.5,
      today_voters: 1,
      positive_count: 2,
      negative_count: 1,
      neutral_count: 1,
      positive_points: 14,
      negative_points: -4,
    });

    const response = await handleGetScore(env);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      score: 2.5,
      stage: "梁圣",
      voterCount: 4,
      todayVoterCount: 1,
      positiveCount: 2,
      negativeCount: 1,
      neutralCount: 1,
      positivePoints: 14,
      negativePoints: -4,
    });
    expect(queries).toEqual([EXPECTED_AGGREGATE_SQL]);
  });
});
