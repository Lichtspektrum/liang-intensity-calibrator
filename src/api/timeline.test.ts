// @vitest-environment node

import { readFile } from "node:fs/promises";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { handleScheduled } from "./scheduled";
import type { Env } from "./shared";
import {
  handleGetTimeline,
  recordDailySnapshot,
} from "./timeline";

const schema = await readFile(
  new URL("../../migrations/0001_init.sql", import.meta.url),
  "utf8",
);

interface QueryLog {
  sql: string;
  bindings: SQLInputValue[];
}

function createEnv(database: DatabaseSync, queries: QueryLog[]): Env {
  return {
    DB: {
      prepare(sql: string) {
        const log: QueryLog = { sql, bindings: [] };
        queries.push(log);

        const statement = {
          bind(...bindings: SQLInputValue[]) {
            log.bindings = bindings;
            return statement;
          },
          async all<T>() {
            return {
              results: database.prepare(sql).all(...log.bindings) as T[],
              success: true,
              meta: {},
            };
          },
          async first<T>() {
            return (database.prepare(sql).get(...log.bindings) as T | undefined) ?? null;
          },
          async run() {
            database.prepare(sql).run(...log.bindings);
            return { success: true, meta: {} };
          },
        };

        return statement;
      },
    },
  } as unknown as Env;
}

let database: DatabaseSync;
let queries: QueryLog[];
let env: Env;

beforeEach(() => {
  database = new DatabaseSync(":memory:");
  database.exec(schema);
  queries = [];
  env = createEnv(database, queries);
});

afterEach(() => {
  database.close();
});

function insertSnapshot(date: string, score: number, voterCount: number, createdAt = 1) {
  database.prepare(
    `INSERT INTO daily_snapshots (date, score, voter_count, created_at)
     VALUES (?, ?, ?, ?)`,
  ).run(date, score, voterCount, createdAt);
}

function insertVoter(hash: string, position: number) {
  database.prepare(
    `INSERT INTO voters (voter_hash, ip_hash, position, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(hash, `ip-${hash}`, position, 1, 1);
}

describe("timeline API", () => {
  it("returns the newest 90 snapshots in ascending date order", async () => {
    for (let day = 1; day <= 95; day += 1) {
      const date = new Date(Date.UTC(2026, 0, day)).toISOString().slice(0, 10);
      insertSnapshot(date, day % 15, day);
    }

    const response = await handleGetTimeline(
      new Request("https://api.example.com/api/timeline"),
      env,
    );
    const body = await response.json() as Array<Record<string, unknown>>;

    expect(response.headers.get("Cache-Control")).toBe("public, max-age=3600");
    expect(body).toHaveLength(90);
    expect(body[0]).toEqual({
      date: "2026-01-06",
      score: 6,
      stage: "梁圣",
      voterCount: 6,
    });
    expect(body.at(-1)).toEqual({
      date: "2026-04-05",
      score: 5,
      stage: "梁圣",
      voterCount: 95,
    });
    expect(queries).toHaveLength(1);
    const normalizedSql = queries[0].sql.replace(/\s+/g, " ").trim();
    expect(normalizedSql).toContain("FROM daily_snapshots");
    expect(normalizedSql).toContain("ORDER BY date DESC");
    expect(normalizedSql).toContain("LIMIT 90");
    expect(body.every((item) => !("events" in item))).toBe(true);
  });

  it("returns an empty list when no snapshots exist", async () => {
    const response = await handleGetTimeline(
      new Request("https://api.example.com/api/timeline"),
      env,
    );

    await expect(response.json()).resolves.toEqual([]);
  });

  it("filters snapshots by from/to date parameters", async () => {
    for (let day = 1; day <= 10; day += 1) {
      const date = new Date(Date.UTC(2026, 0, day)).toISOString().slice(0, 10);
      insertSnapshot(date, day, day);
    }

    const response = await handleGetTimeline(
      new Request("https://api.example.com/api/timeline?from=2026-01-03&to=2026-01-05"),
      env,
    );
    const body = await response.json() as Array<Record<string, unknown>>;

    expect(body.map((item) => item.date)).toEqual([
      "2026-01-03",
      "2026-01-04",
      "2026-01-05",
    ]);
  });

  it("ignores malformed from/to filters", async () => {
    insertSnapshot("2026-01-01", 1, 1);
    insertSnapshot("2026-01-02", 2, 2);

    const response = await handleGetTimeline(
      new Request("https://api.example.com/api/timeline?from=not-a-date&to=bad"),
      env,
    );
    const body = await response.json() as Array<Record<string, unknown>>;

    expect(body).toHaveLength(2);
  });
});

describe("daily snapshot recording", () => {
  it("upserts the current community aggregate with its creation time", async () => {
    insertVoter("positive", 10);
    insertVoter("negative", -5);

    await recordDailySnapshot(env, "2026-08-14", 1_723_600_000_000);

    expect(database.prepare(
      "SELECT date, score, voter_count, created_at FROM daily_snapshots",
    ).get()).toEqual({
      date: "2026-08-14",
      score: 2.5,
      voter_count: 2,
      created_at: 1_723_600_000_000,
    });
    const upsert = queries.find(({ sql }) => sql.includes("INSERT INTO daily_snapshots"));
    expect(upsert?.sql).toContain("ON CONFLICT(date) DO UPDATE");
    expect(upsert?.bindings).toEqual([
      "2026-08-14",
      2.5,
      2,
      1_723_600_000_000,
    ]);
    expect(queries).toHaveLength(2);
    expect(queries.map(({ sql }) => sql).join("\n")).not.toMatch(
      /news_events|score_snapshots|\bFROM votes\b/i,
    );
  });

  it("updates the same row when the snapshot is retried", async () => {
    insertVoter("voter", 4);
    await recordDailySnapshot(env, "2026-08-14", 100);

    database.prepare("UPDATE voters SET position = 8 WHERE voter_hash = ?").run("voter");
    await recordDailySnapshot(env, "2026-08-14", 200);

    expect(database.prepare("SELECT COUNT(*) AS count FROM daily_snapshots").get())
      .toEqual({ count: 1 });
    expect(database.prepare(
      "SELECT score, voter_count, created_at FROM daily_snapshots WHERE date = ?",
    ).get("2026-08-14")).toEqual({ score: 8, voter_count: 1, created_at: 100 });
  });

  it("scheduled runs archive the previous Beijing date", async () => {
    insertVoter("voter", -3);
    const shortlyAfterBeijingMidnight = Date.parse("2026-08-14T16:30:00.000Z");

    await handleScheduled(env, shortlyAfterBeijingMidnight);

    expect(database.prepare(
      "SELECT date, score, voter_count, created_at FROM daily_snapshots",
    ).get()).toEqual({
      date: "2026-08-14",
      score: -3,
      voter_count: 1,
      created_at: shortlyAfterBeijingMidnight,
    });
  });

  it("the scheduler anchors the archive date to its supplied timestamp", async () => {
    insertVoter("voter", 7);
    const scheduledTime = Date.parse("2026-08-14T16:30:00.000Z");
    const dateNow = vi.spyOn(Date, "now").mockReturnValue(
      Date.parse("2026-09-20T16:30:00.000Z"),
    );

    try {
      await handleScheduled(env, scheduledTime);
    } finally {
      dateNow.mockRestore();
    }

    expect(database.prepare(
      "SELECT date, score, voter_count, created_at FROM daily_snapshots",
    ).get()).toEqual({
      date: "2026-08-14",
      score: 7,
      voter_count: 1,
      created_at: scheduledTime,
    });
  });
});
