import { describe, expect, it } from "vitest";

import {
  NEW_IDENTITIES_PER_IP_PER_DAY,
  VOTE_COOLDOWN_MS,
  allowedOrigin,
  corsHeaders,
  getCooldownState,
  hmacIdentifier,
  jsonResponse,
  previousBeijingDate,
  type Env,
} from "./shared";

const env = {
  ALLOWED_ORIGINS: " https://lichtspektrum.github.io , http://127.0.0.1:5173 ",
} as Env;

describe("voting limits", () => {
  it("enforces a three-hour cooldown", () => {
    expect(VOTE_COOLDOWN_MS).toBe(3 * 60 * 60 * 1000);
    expect(getCooldownState(1_000, 1_000 + VOTE_COOLDOWN_MS - 1)).toEqual({
      allowed: false,
      nextVoteAt: 1_000 + VOTE_COOLDOWN_MS,
    });
    expect(getCooldownState(1_000, 1_000 + VOTE_COOLDOWN_MS)).toEqual({
      allowed: true,
      nextVoteAt: 1_000 + VOTE_COOLDOWN_MS,
    });
  });

  it("limits new identities per IP to five each day", () => {
    expect(NEW_IDENTITIES_PER_IP_PER_DAY).toBe(5);
  });
});

describe("Beijing dates", () => {
  it("returns the previous Beijing calendar date", () => {
    expect(previousBeijingDate(Date.UTC(2026, 7, 14, 16, 5))).toBe("2026-08-14");
  });
});

describe("CORS", () => {
  it("matches trimmed comma-separated origins exactly", () => {
    expect(allowedOrigin("https://lichtspektrum.github.io", env)).toBe(true);
    expect(allowedOrigin("http://127.0.0.1:5173", env)).toBe(true);
    expect(allowedOrigin("https://example.com", env)).toBe(false);
    expect(allowedOrigin("https://lichtspektrum.github.io.evil.example", env)).toBe(false);
  });

  it("rejects empty origins and empty allowlist entries", () => {
    const emptyEnv = { ALLOWED_ORIGINS: "" } as Env;
    const trailingCommaEnv = {
      ALLOWED_ORIGINS: "https://lichtspektrum.github.io, ",
    } as Env;

    expect(allowedOrigin("", emptyEnv)).toBe(false);
    expect(allowedOrigin("", trailingCommaEnv)).toBe(false);
    expect(allowedOrigin("https://example.com", trailingCommaEnv)).toBe(false);
  });

  it("returns CORS headers for an allowed origin", () => {
    const headers = new Headers(corsHeaders("https://lichtspektrum.github.io", env));

    expect(headers.get("Access-Control-Allow-Origin")).toBe(
      "https://lichtspektrum.github.io",
    );
    expect(headers.get("Vary")).toBe("Origin");
    expect(headers.get("Access-Control-Allow-Methods")).toBe("GET, POST, OPTIONS");
    expect(headers.get("Access-Control-Allow-Headers")).toBe("Content-Type");
  });

  it("does not return Access-Control-Allow-Origin for a rejected origin", () => {
    const headers = new Headers(corsHeaders("https://example.com", env));

    expect(headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(headers.get("Vary")).toBe("Origin");
  });
});

describe("hmacIdentifier", () => {
  it("matches a published HMAC-SHA256 test vector", async () => {
    expect(
      await hmacIdentifier("key", "The quick brown fox jumps over the lazy dog"),
    ).toBe("f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8");
  });

  it("produces stable lowercase SHA-256 hex identifiers", async () => {
    const identifier = await hmacIdentifier("secret", "same");

    expect(identifier).toBe(await hmacIdentifier("secret", "same"));
    expect(identifier).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes when the secret or value changes", async () => {
    const identifier = await hmacIdentifier("secret", "same");

    expect(identifier).not.toBe(await hmacIdentifier("other", "same"));
    expect(identifier).not.toBe(await hmacIdentifier("secret", "different"));
  });
});

describe("jsonResponse", () => {
  it("merges Headers instances with the default JSON content type", () => {
    const response = jsonResponse(
      { ok: true },
      {
        headers: new Headers({
          "Access-Control-Allow-Origin": "https://lichtspektrum.github.io",
          "Cache-Control": "no-store",
        }),
      },
    );

    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://lichtspektrum.github.io",
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Content-Type")).toBe("application/json; charset=utf-8");
  });

  it("preserves a content type supplied through a HeadersInit record", () => {
    const response = jsonResponse(
      { message: "invalid" },
      {
        headers: {
          "Content-Type": "application/problem+json",
          "X-Response-Kind": "error",
        },
      },
    );

    expect(response.headers.get("Content-Type")).toBe("application/problem+json");
    expect(response.headers.get("X-Response-Kind")).toBe("error");
  });
});
