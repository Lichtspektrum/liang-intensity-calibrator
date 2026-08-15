import { readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  NEW_IDENTITIES_PER_IP_PER_DAY,
  VOTE_COOLDOWN_MS,
  hmacIdentifier,
  type Env,
  type VoteResponse,
} from "./shared";
import { handlePostVote } from "./vote";

const NOW = Date.UTC(2026, 7, 14, 12);
const ORIGIN = "https://lichtspektrum.github.io";
const SECRET = "s".repeat(32);

interface VoterRow {
  voter_hash: string;
  ip_hash: string;
  position: number;
  created_at: number;
  updated_at: number;
}

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, " ").trim();
}

interface VoteEnvOptions {
  beforeUpdate?: (rows: Map<string, VoterRow>, values: unknown[]) => void;
  beforeInsert?: (rows: Map<string, VoterRow>, values: unknown[]) => void;
}

function createVoteEnv(initialRows: VoterRow[] = [], options: VoteEnvOptions = {}) {
  const rows = new Map(initialRows.map((row) => [row.voter_hash, { ...row }]));
  const prepared: string[] = [];
  const writes: Array<{ sql: string; values: unknown[] }> = [];

  const DB = {
    prepare(sql: string) {
      const normalized = normalizeSql(sql);
      prepared.push(normalized);
      let values: unknown[] = [];
      const statement = {
        bind(...nextValues: unknown[]) {
          values = nextValues;
          return statement;
        },
        async first<T>() {
          if (normalized.includes("FROM voters WHERE voter_hash = ?")) {
            return (rows.get(values[0] as string) ?? null) as T | null;
          }
          if (normalized.startsWith("SELECT COUNT(*) AS identity_count")) {
            const [ipHash, createdAfter] = values as [string, number];
            return {
              identity_count: [...rows.values()].filter(
                (row) => row.ip_hash === ipHash && row.created_at >= createdAfter,
              ).length,
            } as T;
          }
          if (normalized.includes("AVG(position) AS score")) {
            const active = [...rows.values()];
            return {
              voters: active.length,
              score: active.length
                ? active.reduce((total, row) => total + row.position, 0) / active.length
                : null,
              positive_count: active.filter((row) => row.position > 0).length,
              negative_count: active.filter((row) => row.position < 0).length,
              neutral_count: active.filter((row) => row.position === 0).length,
              positive_points: active.reduce(
                (total, row) => total + Math.max(0, row.position),
                0,
              ),
              negative_points: active.reduce(
                (total, row) => total + Math.min(0, row.position),
                0,
              ),
            } as T;
          }
          throw new Error(`Unexpected first(): ${normalized}`);
        },
        async run() {
          writes.push({ sql: normalized, values: [...values] });
          if (normalized.startsWith("INSERT INTO voters")) {
            options.beforeInsert?.(rows, values);
            const [voterHash, ipHash, position, createdAt, updatedAt] = values as [
              string,
              string,
              number,
              number,
              number,
            ];
            const isConditional = normalized.includes("SELECT ?, ?, ?, ?, ?");
            const createdAfter = values[6] as number | undefined;
            const limit = values[7] as number | undefined;
            const recentIdentityCount = [...rows.values()].filter(
              (row) => row.ip_hash === ipHash && row.created_at >= (createdAfter ?? -Infinity),
            ).length;
            const canInsert = !isConditional
              || (!rows.has(voterHash) && recentIdentityCount < (limit ?? Infinity));
            if (canInsert) {
              rows.set(voterHash, {
                voter_hash: voterHash,
                ip_hash: ipHash,
                position,
                created_at: createdAt,
                updated_at: updatedAt,
              });
            }
            return { success: true, meta: { changes: canInsert ? 1 : 0 } };
          } else if (normalized.startsWith("UPDATE voters")) {
            options.beforeUpdate?.(rows, values);
            const [position, updatedAt, voterHash] = values as [number, number, string];
            const previous = rows.get(voterHash);
            const isConditional = normalized.includes("updated_at <= ?");
            const cutoff = values[3] as number | undefined;
            const canUpdate = Boolean(previous)
              && (!isConditional || previous!.updated_at <= (cutoff ?? -Infinity));
            if (canUpdate) {
              rows.set(voterHash, {
                ...previous!,
                position,
                updated_at: updatedAt,
              });
            }
            return { success: true, meta: { changes: canUpdate ? 1 : 0 } };
          } else {
            throw new Error(`Unexpected run(): ${normalized}`);
          }
        },
      };
      return statement;
    },
  };

  const env = {
    DB,
    VOTER_HASH_SECRET: SECRET,
    ALLOWED_ORIGINS: `${ORIGIN},http://127.0.0.1:5174`,
  } as unknown as Env;

  return { env, rows, prepared, writes };
}

function voteRequest(
  body: unknown,
  headers: Record<string, string> = {},
): Request {
  return new Request("https://liang-votes.example.com/api/vote", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: ORIGIN,
      "X-Client-IP": "203.0.113.8",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function responseJson(response: Response): Promise<VoteResponse> {
  return await response.json() as VoteResponse;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("persistent ballots", () => {
  it("HMACs the fingerprint and IP, inserts one voter, and returns the new aggregate", async () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    const { env, rows, writes } = createVoteEnv();

    const response = await handlePostVote(
      voteRequest({ position: 6, fingerprint: "browser-fingerprint" }),
      env,
    );

    const voterHash = await hmacIdentifier(SECRET, "voter:browser-fingerprint");
    const ipHash = await hmacIdentifier(SECRET, "ip:203.0.113.8");
    expect(response.status).toBe(200);
    await expect(responseJson(response)).resolves.toEqual({
      accepted: true,
      userPosition: 6,
      nextVoteAt: 0,
      score: 6,
      stage: "梁圣",
      voterCount: 1,
      todayVoterCount: 0,
      positiveCount: 1,
      negativeCount: 0,
      neutralCount: 0,
      positivePoints: 6,
      negativePoints: 0,
    });
    expect([...rows.values()]).toEqual([{
      voter_hash: voterHash,
      ip_hash: ipHash,
      position: 6,
      created_at: NOW,
      updated_at: NOW,
    }]);
    expect(writes).toHaveLength(1);
    expect(JSON.stringify([...rows.values()])).not.toContain("browser-fingerprint");
    expect(JSON.stringify([...rows.values()])).not.toContain("203.0.113.8");
  });

  it("updates a saved ballot immediately without a cooldown", async () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    const voterHash = await hmacIdentifier(SECRET, "voter:browser-fingerprint");
    const ipHash = await hmacIdentifier(SECRET, "ip:203.0.113.8");
    const updatedAt = NOW - VOTE_COOLDOWN_MS + 1;
    const { env, writes } = createVoteEnv([{
      voter_hash: voterHash,
      ip_hash: ipHash,
      position: -4,
      created_at: NOW - 86_400_000,
      updated_at: updatedAt,
    }]);

    const response = await handlePostVote(
      voteRequest({ position: 12, fingerprint: "browser-fingerprint" }),
      env,
    );

    expect(response.status).toBe(200);
    await expect(responseJson(response)).resolves.toEqual({
      accepted: true,
      userPosition: 12,
      nextVoteAt: 0,
      score: 12,
      stage: "梁神",
      voterCount: 1,
      todayVoterCount: 0,
      positiveCount: 1,
      negativeCount: 0,
      neutralCount: 0,
      positivePoints: 12,
      negativePoints: 0,
    });
    expect(writes).toHaveLength(1);
  });

  it("updates the same voter freely while preserving created_at", async () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    const voterHash = await hmacIdentifier(SECRET, "voter:browser-fingerprint");
    const oldIpHash = await hmacIdentifier(SECRET, "ip:198.51.100.1");
    const createdAt = NOW - 10 * 86_400_000;
    const { env, rows, writes } = createVoteEnv([{
      voter_hash: voterHash,
      ip_hash: oldIpHash,
      position: -7,
      created_at: createdAt,
      updated_at: NOW - VOTE_COOLDOWN_MS,
    }]);

    const response = await handlePostVote(
      voteRequest({ position: 9, fingerprint: "browser-fingerprint" }),
      env,
    );

    expect(response.status).toBe(200);
    expect(rows.size).toBe(1);
    expect(rows.get(voterHash)).toEqual({
      voter_hash: voterHash,
      ip_hash: oldIpHash,
      position: 9,
      created_at: createdAt,
      updated_at: NOW,
    });
    expect(writes).toHaveLength(1);
    expect(writes[0]?.sql).toContain("UPDATE voters");
    expect(writes[0]?.sql).not.toContain("updated_at <= ?");
    expect(writes[0]?.values).toEqual([
      9,
      NOW,
      voterHash,
    ]);
    await expect(responseJson(response)).resolves.toMatchObject({
      accepted: true,
      userPosition: 9,
      nextVoteAt: 0,
      voterCount: 1,
      score: 9,
    });
  });

  it("keeps the creation IP assigned to its rolling identity quota after an update", async () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    const creationIp = "198.51.100.1";
    const creationIpHash = await hmacIdentifier(SECRET, `ip:${creationIp}`);
    const voterHash = await hmacIdentifier(SECRET, "voter:browser-fingerprint");
    const existing = await Promise.all(
      Array.from({ length: NEW_IDENTITIES_PER_IP_PER_DAY }, async (_, index) => ({
        voter_hash: index === 0
          ? voterHash
          : await hmacIdentifier(SECRET, `voter:creation-ip-${index}`),
        ip_hash: creationIpHash,
        position: index,
        created_at: NOW - 1_000,
        updated_at: NOW - VOTE_COOLDOWN_MS,
      })),
    );
    const { env, rows } = createVoteEnv(existing);

    const updateResponse = await handlePostVote(
      voteRequest({ position: 9, fingerprint: "browser-fingerprint" }),
      env,
    );
    const newIdentityResponse = await handlePostVote(
      voteRequest(
        { position: 3, fingerprint: "another-fingerprint" },
        { "X-Client-IP": creationIp },
      ),
      env,
    );

    expect(updateResponse.status).toBe(200);
    expect(rows.get(voterHash)?.ip_hash).toBe(creationIpHash);
    expect(newIdentityResponse.status).toBe(429);
    await expect(responseJson(newIdentityResponse)).resolves.toMatchObject({
      accepted: false,
      reason: "rate_limited",
    });
  });

  it("lets the latest submission win a competing update", async () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    const voterHash = await hmacIdentifier(SECRET, "voter:browser-fingerprint");
    const ipHash = await hmacIdentifier(SECRET, "ip:203.0.113.8");
    const createdAt = NOW - 10 * 86_400_000;
    let raced = false;
    const { env, rows, writes } = createVoteEnv([{
      voter_hash: voterHash,
      ip_hash: ipHash,
      position: -7,
      created_at: createdAt,
      updated_at: NOW - VOTE_COOLDOWN_MS,
    }], {
      beforeUpdate(currentRows) {
        if (raced) return;
        raced = true;
        currentRows.set(voterHash, {
          voter_hash: voterHash,
          ip_hash: ipHash,
          position: 11,
          created_at: createdAt,
          updated_at: NOW,
        });
      },
    });

    const response = await handlePostVote(
      voteRequest({ position: -12, fingerprint: "browser-fingerprint" }),
      env,
    );

    expect(response.status).toBe(200);
    expect(writes).toHaveLength(1);
    expect(rows.get(voterHash)?.position).toBe(-12);
    await expect(responseJson(response)).resolves.toMatchObject({
      accepted: true,
      userPosition: -12,
      nextVoteAt: 0,
    });
  });
});

describe("new-identity rate limiting", () => {
  it("rejects the sixth new identity created by one IP within 24 hours", async () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    const ipHash = await hmacIdentifier(SECRET, "ip:203.0.113.8");
    const existing = await Promise.all(
      Array.from({ length: NEW_IDENTITIES_PER_IP_PER_DAY }, async (_, index) => ({
        voter_hash: await hmacIdentifier(SECRET, `voter:existing-${index}`),
        ip_hash: ipHash,
        position: index - 2,
        created_at: NOW - index * 1_000,
        updated_at: NOW - index * 1_000,
      })),
    );
    const { env, rows, writes } = createVoteEnv(existing);

    const response = await handlePostVote(
      voteRequest({ position: 15, fingerprint: "sixth-fingerprint" }),
      env,
    );

    expect(response.status).toBe(429);
    expect(rows.size).toBe(NEW_IDENTITIES_PER_IP_PER_DAY);
    expect(writes).toHaveLength(1);
    expect(writes[0]?.sql).toContain("INSERT INTO voters");
    await expect(responseJson(response)).resolves.toMatchObject({
      accepted: false,
      reason: "rate_limited",
      userPosition: 15,
      nextVoteAt: null,
      voterCount: 5,
    });
  });

  it("does not count identities older than 24 hours", async () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    const ipHash = await hmacIdentifier(SECRET, "ip:203.0.113.8");
    const existing = await Promise.all(
      Array.from({ length: NEW_IDENTITIES_PER_IP_PER_DAY }, async (_, index) => ({
        voter_hash: await hmacIdentifier(SECRET, `voter:expired-${index}`),
        ip_hash: ipHash,
        position: 1,
        created_at: NOW - 86_400_000 - 1 - index,
        updated_at: NOW - 86_400_000 - 1 - index,
      })),
    );
    const { env, rows } = createVoteEnv(existing);

    const response = await handlePostVote(
      voteRequest({ position: 3, fingerprint: "new-fingerprint" }),
      env,
    );

    expect(response.status).toBe(200);
    expect(rows.size).toBe(NEW_IDENTITIES_PER_IP_PER_DAY + 1);
  });

  it("counts an identity created exactly 24 hours ago", async () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    const ipHash = await hmacIdentifier(SECRET, "ip:203.0.113.8");
    const existing = await Promise.all(
      Array.from({ length: NEW_IDENTITIES_PER_IP_PER_DAY }, async (_, index) => ({
        voter_hash: await hmacIdentifier(SECRET, `voter:boundary-${index}`),
        ip_hash: ipHash,
        position: 1,
        created_at: index === 0 ? NOW - 86_400_000 : NOW - index,
        updated_at: NOW - index,
      })),
    );
    const { env, rows, writes } = createVoteEnv(existing);

    const response = await handlePostVote(
      voteRequest({ position: 3, fingerprint: "new-fingerprint" }),
      env,
    );

    expect(response.status).toBe(429);
    expect(rows.size).toBe(NEW_IDENTITIES_PER_IP_PER_DAY);
    expect(writes).toHaveLength(1);
    expect(writes[0]?.sql).toContain("INSERT INTO voters");
    expect(writes[0]?.sql).toContain("created_at >= ?");
    expect(writes[0]?.values.slice(-2)).toEqual([
      NOW - 86_400_000,
      NEW_IDENTITIES_PER_IP_PER_DAY,
    ]);
  });

  it("updates the same fingerprint when a competing insert wins", async () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    const voterHash = await hmacIdentifier(SECRET, "voter:browser-fingerprint");
    const ipHash = await hmacIdentifier(SECRET, "ip:203.0.113.8");
    let raced = false;
    const { env, rows } = createVoteEnv([], {
      beforeInsert(currentRows) {
        if (raced) return;
        raced = true;
        currentRows.set(voterHash, {
          voter_hash: voterHash,
          ip_hash: ipHash,
          position: 4,
          created_at: NOW,
          updated_at: NOW,
        });
      },
    });

    const response = await handlePostVote(
      voteRequest({ position: 12, fingerprint: "browser-fingerprint" }),
      env,
    );

    expect(response.status).toBe(200);
    expect(rows.size).toBe(1);
    expect(rows.get(voterHash)?.position).toBe(12);
    await expect(responseJson(response)).resolves.toMatchObject({
      accepted: true,
      userPosition: 12,
      nextVoteAt: 0,
    });
  });

  it("returns rate_limited when competing inserts fill the IP quota", async () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    const ipHash = await hmacIdentifier(SECRET, "ip:203.0.113.8");
    let raced = false;
    const { env, rows } = createVoteEnv([], {
      beforeInsert(currentRows) {
        if (raced) return;
        raced = true;
        for (let index = 0; index < NEW_IDENTITIES_PER_IP_PER_DAY; index += 1) {
          currentRows.set(`concurrent-${index}`, {
            voter_hash: `concurrent-${index}`,
            ip_hash: ipHash,
            position: 0,
            created_at: NOW,
            updated_at: NOW,
          });
        }
      },
    });

    const response = await handlePostVote(
      voteRequest({ position: 12, fingerprint: "browser-fingerprint" }),
      env,
    );

    expect(response.status).toBe(429);
    expect(rows.size).toBe(NEW_IDENTITIES_PER_IP_PER_DAY);
    await expect(responseJson(response)).resolves.toMatchObject({
      accepted: false,
      reason: "rate_limited",
      userPosition: 12,
      nextVoteAt: null,
    });
  });

  it("allows an existing identity to update even when the IP has five new identities", async () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    const ipHash = await hmacIdentifier(SECRET, "ip:203.0.113.8");
    const voterHash = await hmacIdentifier(SECRET, "voter:browser-fingerprint");
    const existing = await Promise.all(
      Array.from({ length: NEW_IDENTITIES_PER_IP_PER_DAY }, async (_, index) => ({
        voter_hash: index === 0
          ? voterHash
          : await hmacIdentifier(SECRET, `voter:existing-${index}`),
        ip_hash: ipHash,
        position: index,
        created_at: NOW - 1_000,
        updated_at: NOW - VOTE_COOLDOWN_MS,
      })),
    );
    const { env, rows } = createVoteEnv(existing);

    const response = await handlePostVote(
      voteRequest({ position: -12, fingerprint: "browser-fingerprint" }),
      env,
    );

    expect(response.status).toBe(200);
    expect(rows.size).toBe(NEW_IDENTITIES_PER_IP_PER_DAY);
    expect(rows.get(voterHash)?.position).toBe(-12);
  });
});

describe("vote validation", () => {
  it.each([
    ["malformed JSON", "{", "invalid_body"],
    ["fractional position", { position: 1.5, fingerprint: "valid-fingerprint" }, "invalid_position"],
    ["out-of-range position", { position: 16, fingerprint: "valid-fingerprint" }, "invalid_position"],
    ["short fingerprint", { position: 1, fingerprint: "short" }, "invalid_fingerprint"],
  ])("rejects %s before touching the database", async (_label, body, reason) => {
    const { env, prepared, writes } = createVoteEnv();

    const response = await handlePostVote(voteRequest(body), env);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ accepted: false, reason });
    expect(prepared).toEqual([]);
    expect(writes).toEqual([]);
  });

  it.each([
    ["missing Origin", { Origin: "" }],
    ["unlisted Origin", { Origin: "https://evil.example" }],
    ["Referer without Origin", { Origin: "", Referer: ORIGIN }],
    ["lookalike Origin", { Origin: `${ORIGIN}.evil.example` }],
  ])("rejects %s before touching the database", async (_label, headers) => {
    const { env, prepared, writes } = createVoteEnv();

    const response = await handlePostVote(
      voteRequest({ position: 1, fingerprint: "valid-fingerprint" }, headers),
      env,
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ accepted: false, reason: "csrf" });
    expect(prepared).toEqual([]);
    expect(writes).toEqual([]);
  });

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["31 ASCII bytes", "s".repeat(31)],
    ["31 UTF-8 bytes", `${"界".repeat(10)}a`],
  ])("rejects a %s HMAC secret before touching the database", async (_label, secret) => {
    const { env, prepared, writes } = createVoteEnv();
    (env as { VOTER_HASH_SECRET?: string }).VOTER_HASH_SECRET = secret;

    const response = await handlePostVote(
      voteRequest({ position: 1, fingerprint: "valid-fingerprint" }),
      env,
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      accepted: false,
      reason: "service_unavailable",
    });
    expect(prepared).toEqual([]);
    expect(writes).toEqual([]);
  });

  it("accepts a HMAC secret with exactly 32 UTF-8 bytes", async () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    const { env } = createVoteEnv();
    env.VOTER_HASH_SECRET = `${"界".repeat(10)}ab`;

    const response = await handlePostVote(
      voteRequest({ position: 1, fingerprint: "valid-fingerprint" }),
      env,
    );

    expect(response.status).toBe(200);
  });

  it("rejects a missing client IP before touching the database", async () => {
    const { env, prepared, writes } = createVoteEnv();

    const response = await handlePostVote(
      voteRequest(
        { position: 1, fingerprint: "valid-fingerprint" },
        { "X-Client-IP": "" },
      ),
      env,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      accepted: false,
      reason: "invalid_request",
    });
    expect(prepared).toEqual([]);
    expect(writes).toEqual([]);
  });
});

function createSqliteEnv(database: DatabaseSync): Env {
  return {
    DB: {
      prepare(sql: string) {
        let values: unknown[] = [];
        const statement = {
          bind(...nextValues: unknown[]) {
            values = nextValues;
            return statement;
          },
          async first<T>() {
            return (
              database.prepare(sql).get(...values as SQLInputValue[]) ?? null
            ) as T | null;
          },
          async run() {
            const result = database.prepare(sql).run(...values as SQLInputValue[]);
            return {
              success: true,
              meta: { changes: Number(result.changes) },
            };
          },
        };
        return statement;
      },
    },
    VOTER_HASH_SECRET: SECRET,
    ALLOWED_ORIGINS: ORIGIN,
  } as unknown as Env;
}

describe("SQLite integration", () => {
  it("executes the migration and atomic insert/update conditions", async () => {
    const database = new DatabaseSync(":memory:");
    database.exec(readFileSync(new URL("../../migrations/0001_init.sql", import.meta.url), "utf8"));
    const now = vi.spyOn(Date, "now").mockReturnValue(NOW);
    const env = createSqliteEnv(database);

    try {
      const first = await handlePostVote(
        voteRequest({ position: -5, fingerprint: "sqlite-fingerprint" }),
        env,
      );
      const immediateUpdate = await handlePostVote(
        voteRequest({ position: 8, fingerprint: "sqlite-fingerprint" }),
        env,
      );
      now.mockReturnValue(NOW + VOTE_COOLDOWN_MS);
      const update = await handlePostVote(
        voteRequest(
          { position: 8, fingerprint: "sqlite-fingerprint" },
          { "X-Client-IP": "198.51.100.44" },
        ),
        env,
      );

      expect(first.status).toBe(200);
      expect(immediateUpdate.status).toBe(200);
      expect(update.status).toBe(200);
      const stored = database.prepare(
        "SELECT ip_hash, position, created_at, updated_at FROM voters",
      ).get() as { ip_hash: string; position: number; created_at: number; updated_at: number };
      expect(stored).toEqual({
        ip_hash: await hmacIdentifier(SECRET, "ip:203.0.113.8"),
        position: 8,
        created_at: NOW,
        updated_at: NOW + VOTE_COOLDOWN_MS,
      });

      now.mockReturnValue(NOW + VOTE_COOLDOWN_MS + 1);
      const sharedIp = "192.0.2.20";
      for (let index = 0; index < NEW_IDENTITIES_PER_IP_PER_DAY; index += 1) {
        const response = await handlePostVote(
          voteRequest(
            { position: index, fingerprint: `sqlite-new-${index}` },
            { "X-Client-IP": sharedIp },
          ),
          env,
        );
        expect(response.status).toBe(200);
      }
      const limited = await handlePostVote(
        voteRequest(
          { position: 10, fingerprint: "sqlite-new-sixth" },
          { "X-Client-IP": sharedIp },
        ),
        env,
      );
      expect(limited.status).toBe(429);
      await expect(responseJson(limited)).resolves.toMatchObject({
        accepted: false,
        reason: "rate_limited",
      });
    } finally {
      database.close();
    }
  });
});
