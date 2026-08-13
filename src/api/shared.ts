export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  DB: D1Database;
  KV: KVNamespace;
  AI?: Fetcher;
}

export interface ScoreResponse {
  score: number;
  stage: string;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  positivePoints: number;
  negativePoints: number;
  isColdStart: boolean;
  recentEvents: TimelineEventResponse[];
}

export interface TimelineEventResponse {
  id: number;
  date: string;
  title: string;
  summary: string | null;
  isMajor: boolean;
}

export interface TimelineDayResponse {
  date: string;
  score: number;
  stage: string;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  events: TimelineEventResponse[];
}

export interface VoteRequest {
  position: number;
  fingerprint: string;
}

export interface VoteResponse {
  accepted: boolean;
  reason?: "rate_limited" | "invalid_position" | "invalid_fingerprint";
  userPosition: number;
  score: number;
  stage: string;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  positivePoints: number;
  negativePoints: number;
}

export function todayInBeijing(): string {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const beijing = new Date(utc + 8 * 3600000);
  return beijing.toISOString().slice(0, 10);
}

export function jsonResponse(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json; charset=utf-8", ...init?.headers },
    ...init,
  });
}

export async function hashIp(ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`liang-slider-ip:${ip}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
