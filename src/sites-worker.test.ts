import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { describe, expect, it, vi } from "vitest";
import worker from "./worker";
import type { Env } from "./api/shared";

const ALLOWED_ORIGIN = "http://127.0.0.1:5174";
const execFileAsync = promisify(execFile);

function createEnv(overrides: Partial<Env> = {}): Env {
  const statement = {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue({
      voters: 0,
      score: null,
      today_voters: 0,
      positive_count: null,
      negative_count: null,
      neutral_count: null,
      positive_points: null,
      negative_points: null,
    }),
    all: vi.fn().mockResolvedValue({ results: [] }),
    run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
  };

  return {
    DB: {
      prepare: vi.fn().mockReturnValue(statement),
      batch: vi.fn(),
    } as unknown as D1Database,
    VOTER_HASH_SECRET: "a".repeat(32),
    ALLOWED_ORIGINS:
      "https://lichtspektrum.github.io,http://127.0.0.1:5173,http://127.0.0.1:5174",
    ...overrides,
  };
}

function apiRequest(path: string, init: RequestInit = {}): Request {
  const headers = new Headers(init.headers);
  headers.set("Origin", ALLOWED_ORIGIN);
  return new Request(`https://api.example.com${path}`, { ...init, headers });
}

function createSuccessfulVoteEnv(): Env {
  const aggregate = {
    voters: 1,
    score: 5,
    today_voters: 1,
    positive_count: 1,
    negative_count: 0,
    neutral_count: 0,
    positive_points: 5,
    negative_points: 0,
  };

  return createEnv({
    DB: {
      prepare: vi.fn((query: string) => ({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(
          query.includes("WHERE voter_hash = ?") ? null : aggregate,
        ),
        all: vi.fn().mockResolvedValue({ results: [] }),
        run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
      })),
    } as unknown as D1Database,
  });
}

describe("API-only worker", () => {
  it("answers an allowed API preflight with exact CORS headers", async () => {
    const response = await worker.fetch(
      apiRequest("/api/vote", { method: "OPTIONS" }),
      createEnv(),
      {} as ExecutionContext,
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(ALLOWED_ORIGIN);
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET, POST, OPTIONS");
    expect(response.headers.get("Access-Control-Allow-Headers")).toBe("Content-Type");
    expect(response.headers.get("Vary")).toBe("Origin");
  });

  it("adds CORS to allowed GET responses", async () => {
    const response = await worker.fetch(
      apiRequest("/api/score"),
      createEnv(),
      {} as ExecutionContext,
    );

    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(ALLOWED_ORIGIN);
    expect(response.headers.get("Vary")).toContain("Origin");
  });

  it("preserves an invalid POST body response while adding CORS", async () => {
    const response = await worker.fetch(
      apiRequest("/api/vote", { method: "POST" }),
      createEnv(),
      {} as ExecutionContext,
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("Content-Type")).toBe("application/json; charset=utf-8");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(ALLOWED_ORIGIN);
    await expect(response.json()).resolves.toMatchObject({
      accepted: false,
      reason: "invalid_body",
    });
  });

  it("adds CORS to a successful vote response", async () => {
    const response = await worker.fetch(
      apiRequest("/api/vote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CF-Connecting-IP": "203.0.113.7",
        },
        body: JSON.stringify({ position: 5, fingerprint: "browser-fingerprint" }),
      }),
      createSuccessfulVoteEnv(),
      {} as ExecutionContext,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(ALLOWED_ORIGIN);
    await expect(response.json()).resolves.toMatchObject({
      accepted: true,
      userPosition: 5,
      score: 5,
    });
  });

  it("preserves handler status and response headers while adding CORS", async () => {
    const response = await worker.fetch(
      apiRequest("/api/timeline"),
      createEnv(),
      {} as ExecutionContext,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/json; charset=utf-8");
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=3600");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(ALLOWED_ORIGIN);
  });

  it("returns a CORS JSON 404 for an unknown allowed API route", async () => {
    const response = await worker.fetch(
      apiRequest("/api/missing"),
      createEnv(),
      {} as ExecutionContext,
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("Content-Type")).toBe("application/json; charset=utf-8");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(ALLOWED_ORIGIN);
  });

  it("rejects disallowed API origins without ACAO", async () => {
    const response = await worker.fetch(
      new Request("https://api.example.com/api/score", {
        headers: { Origin: "https://evil.example" },
      }),
      createEnv(),
      {} as ExecutionContext,
    );

    expect(response.status).toBe(403);
    expect(response.headers.get("Content-Type")).toBe("application/json; charset=utf-8");
    expect(response.headers.has("Access-Control-Allow-Origin")).toBe(false);
  });

  it("returns JSON 404 for non-API routes without needing an assets binding", async () => {
    const response = await worker.fetch(
      new Request("https://api.example.com/"),
      createEnv(),
      {} as ExecutionContext,
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("Content-Type")).toBe("application/json; charset=utf-8");
  });

  it("passes scheduledTime to the daily snapshot path", async () => {
    const env = createEnv();
    const scheduledTime = Date.UTC(2026, 7, 14, 16, 5);

    await worker.scheduled(
      { scheduledTime } as ScheduledController,
      env,
      {} as ExecutionContext,
    );

    const prepare = vi.mocked(env.DB.prepare);
    expect(prepare).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO daily_snapshots"));
    const insertStatement = prepare.mock.results.at(-1)?.value as { bind: ReturnType<typeof vi.fn> };
    expect(insertStatement.bind).toHaveBeenCalledWith("2026-08-14", 0, 0, scheduledTime);
  });
});

describe("worker deployment config", () => {
  it("configures a workers.dev D1 API with the daily cron and exact origins", async () => {
    const config = JSON.parse(
      await readFile(new URL("../wrangler.json", import.meta.url), "utf8"),
    );

    expect(config).toMatchObject({
      name: "liang-intensity-api",
      main: "./src/worker.ts",
      compatibility_date: "2026-08-08",
      workers_dev: true,
      vars: {
        ALLOWED_ORIGINS:
          "https://lichtspektrum.github.io,http://127.0.0.1:5173,http://127.0.0.1:5174",
      },
      d1_databases: [{
        binding: "DB",
        database_name: "liang-intensity-db",
        migrations_dir: "./migrations",
      }],
      triggers: { crons: ["5 16 * * *"] },
    });
    expect(config.d1_databases[0].database_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(config.d1_databases[0].database_id).not.toBe("local-preview");
    expect(config).not.toHaveProperty("assets");
    expect(config).not.toHaveProperty("routes");
    expect(config).not.toHaveProperty("kv_namespaces");
    expect(config).not.toHaveProperty("r2_buckets");
    expect(config).not.toHaveProperty("ai");
  });

  it("keeps local Worker secrets out of git", async () => {
    const ignore = await readFile(new URL("../.gitignore", import.meta.url), "utf8");
    expect(ignore.split(/\r?\n/)).toContain(".dev.vars");
  });

  it("separates frontend Vite scripts from explicit Wrangler worker scripts", async () => {
    const packageJson = JSON.parse(
      await readFile(new URL("../package.json", import.meta.url), "utf8"),
    );
    const viteConfig = await readFile(new URL("../vite.config.ts", import.meta.url), "utf8");

    expect(packageJson.scripts.build).toBe("npm run build:worker");
    expect(packageJson.scripts["build:worker"]).toContain(
      "wrangler deploy --dry-run --config wrangler.json",
    );
    expect(packageJson.scripts["dev:worker"]).toBe("wrangler dev --config wrangler.json");
    expect(packageJson.devDependencies).not.toHaveProperty("@cloudflare/vite-plugin");
    expect(viteConfig).not.toContain("@cloudflare/vite-plugin");
    expect(viteConfig).not.toContain("cloudflare(");
  });

  it("dry-runs a worker-only bundle without static assets", async () => {
    const outputDirectory = await mkdtemp(`${tmpdir()}/liang-worker-build-`);
    try {
      const { stdout, stderr } = await execFileAsync(
        fileURLToPath(new URL("../node_modules/.bin/wrangler", import.meta.url)),
        [
          "deploy",
          "--dry-run",
          "--config",
          "wrangler.json",
          "--outdir",
          outputDirectory,
        ],
        { cwd: fileURLToPath(new URL("..", import.meta.url)) },
      );
      const output = `${stdout}\n${stderr}`;
      const files = await readdir(outputDirectory, { recursive: true });

      expect(output).not.toMatch(/Read .* files from assets/i);
      expect(files).toContain("worker.js");
      expect(files.some((file) => /assets|client/i.test(file))).toBe(false);
    } finally {
      await rm(outputDirectory, { recursive: true, force: true });
    }
  });
});
