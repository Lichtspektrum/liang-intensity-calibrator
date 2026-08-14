import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";

import { handleApiRequest } from "./app";
import type { Env } from "./shared";

const ALLOWED_ORIGIN = "http://127.0.0.1:5174";

function createEnv(overrides: Partial<Env> = {}): Env {
  const statement = {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue({
      voters: 0,
      score: null,
      positive_count: null,
      negative_count: null,
      neutral_count: null,
      positive_points: null,
      negative_points: null,
    }),
    all: vi.fn().mockResolvedValue({ success: true, results: [] }),
    run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } }),
  };
  return {
    DB: { prepare: vi.fn().mockReturnValue(statement) } as unknown as AppDatabase,
    VOTER_HASH_SECRET: "a".repeat(32),
    ALLOWED_ORIGINS: ALLOWED_ORIGIN,
    ...overrides,
  };
}

function apiRequest(path: string, init: RequestInit = {}): Request {
  const headers = new Headers(init.headers);
  headers.set("Origin", ALLOWED_ORIGIN);
  return new Request(`http://127.0.0.1:8787${path}`, { ...init, headers });
}

describe("local API application", () => {
  it("answers an allowed preflight with CORS headers", async () => {
    const response = await handleApiRequest(
      apiRequest("/api/vote", { method: "OPTIONS" }),
      createEnv(),
    );
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(ALLOWED_ORIGIN);
  });

  it("adds CORS to API responses", async () => {
    const response = await handleApiRequest(apiRequest("/api/score"), createEnv());
    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(ALLOWED_ORIGIN);
  });

  it("rejects an untrusted origin", async () => {
    const response = await handleApiRequest(
      new Request("http://127.0.0.1:8787/api/score", {
        headers: { Origin: "https://evil.example" },
      }),
      createEnv(),
    );
    expect(response.status).toBe(403);
    expect(response.headers.has("Access-Control-Allow-Origin")).toBe(false);
  });

  it("uses a local Node/SQLite development script", async () => {
    const packageJson = JSON.parse(
      await readFile(new URL("../../package.json", import.meta.url), "utf8"),
    );
    expect(packageJson.scripts["dev:api"]).toBe("tsx src/server.ts");
    expect(packageJson.scripts.build).toBe("tsc --noEmit && vite build");
  });
});
