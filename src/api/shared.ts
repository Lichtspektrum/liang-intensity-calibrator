export interface Env {
  DB: D1Database;
  VOTER_HASH_SECRET: string;
  ALLOWED_ORIGINS: string;
}

export const VOTE_COOLDOWN_MS = 3 * 60 * 60 * 1000;
export const NEW_IDENTITIES_PER_IP_PER_DAY = 5;

const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;

export function getCooldownState(updatedAt: number, now = Date.now()) {
  const nextVoteAt = updatedAt + VOTE_COOLDOWN_MS;
  return { allowed: now >= nextVoteAt, nextVoteAt };
}

export async function hmacIdentifier(secret: string, value: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return Array.from(new Uint8Array(signature), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function allowedOrigin(origin: string, env: Env): boolean {
  if (!origin) return false;

  return env.ALLOWED_ORIGINS.split(",")
    .map((allowed) => allowed.trim())
    .filter(Boolean)
    .includes(origin);
}

export function corsHeaders(origin: string, env: Env): HeadersInit {
  const headers: Record<string, string> = {
    Vary: "Origin",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (allowedOrigin(origin, env)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

export interface ScoreResponse {
  score: number;
  stage: string;
  voterCount: number;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  positivePoints: number;
  negativePoints: number;
}

export interface TimelineDayResponse {
  date: string;
  score: number;
  stage: string;
  voterCount: number;
}

export interface VoteRequest {
  position: number;
  fingerprint: string;
}

interface VoteCommunityFields {
  userPosition: number;
  score: number;
  stage: string;
  voterCount: number;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  positivePoints: number;
  negativePoints: number;
}

export type VoteResponse =
  | (VoteCommunityFields & {
    accepted: true;
    reason?: never;
    nextVoteAt: number;
  })
  | (VoteCommunityFields & {
    accepted: false;
    reason: "cooldown";
    nextVoteAt: number;
  })
  | (VoteCommunityFields & {
    accepted: false;
    reason: "rate_limited";
    nextVoteAt: null;
  })
  | {
    accepted: false;
    reason:
      | "invalid_body"
      | "invalid_position"
      | "invalid_fingerprint"
      | "csrf"
      | "service_unavailable"
      | "invalid_request";
  };

export function todayInBeijing(): string {
  return beijingDate(Date.now());
}

export function previousBeijingDate(now = Date.now()): string {
  return beijingDate(now - 24 * 60 * 60 * 1000);
}

function beijingDate(timestamp: number): string {
  return new Date(timestamp + BEIJING_OFFSET_MS).toISOString().slice(0, 10);
}

export function jsonResponse(data: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json; charset=utf-8");
  }

  return new Response(JSON.stringify(data), { ...init, headers });
}
