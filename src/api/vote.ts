import { IP_DAILY_VOTE_LIMIT, clampScore, normalizeVotePosition } from "../score-engine";
import {
  type Env,
  type VoteRequest,
  type VoteResponse,
  getStage,
  hashIp,
  jsonResponse,
  todayInBeijing,
} from "./shared";
import {
  applyVotePointsToScore,
  getScoreState,
  getTodayVoteCounts,
  getTodayVoteSummary,
} from "./score";

function isValidPosition(position: unknown): position is number {
  return typeof position === "number" && Number.isInteger(position) && position >= 0 && position <= 30;
}

function isValidFingerprint(f: unknown): f is string {
  return typeof f === "string" && f.length >= 8 && f.length <= 128;
}

async function getClientIp(request: Request): Promise<string | null> {
  return request.headers.get("CF-Connecting-IP");
}

async function checkIpRateLimit(env: Env, ipHash: string, today: string): Promise<boolean> {
  const key = `vote:ip:${today}:${ipHash}`;
  const count = await env.KV.get(key);
  const countNum = count ? Number.parseInt(count, 10) : 0;
  return countNum < IP_DAILY_VOTE_LIMIT;
}

async function incrementIpCount(env: Env, ipHash: string, today: string): Promise<void> {
  const key = `vote:ip:${today}:${ipHash}`;
  const existing = await env.KV.get(key);
  const newCount = existing ? Number.parseInt(existing, 10) + 1 : 1;
  await env.KV.put(key, String(newCount), { expirationTtl: 48 * 60 * 60 });
}

async function getExistingVote(
  env: Env,
  fingerprint: string,
  today: string,
): Promise<number | null> {
  const row = await env.DB
    .prepare("SELECT position FROM votes WHERE fingerprint = ? AND date = ?")
    .bind(fingerprint, today)
    .first<{ position: number | null }>();
  return row?.position ?? null;
}

async function recordVote(
  env: Env,
  fingerprint: string,
  ipHash: string,
  position: number,
  today: string,
): Promise<void> {
  const now = Date.now();
  const direction = position >= 15 ? "up" : "down";
  await env.DB
    .prepare(
      `INSERT INTO votes (fingerprint, ip_hash, date, direction, position, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(fingerprint, date) DO UPDATE SET direction = ?, position = ?, updated_at = ?`,
    )
    .bind(fingerprint, ipHash, today, direction, position, now, now, direction, position, now)
    .run();
}

export async function handlePostVote(request: Request, env: Env): Promise<Response> {
  let body: VoteRequest;
  try {
    body = (await request.json()) as VoteRequest;
  } catch {
    return jsonResponse({ accepted: false, reason: "invalid_body" }, { status: 400 });
  }

  if (!isValidPosition(body.position)) {
    return jsonResponse({ accepted: false, reason: "invalid_position" }, { status: 400 });
  }

  if (!isValidFingerprint(body.fingerprint)) {
    return jsonResponse({ accepted: false, reason: "invalid_fingerprint" }, { status: 400 });
  }

  const origin = request.headers.get("Origin");
  const referer = request.headers.get("Referer");
  const requestUrl = new URL(request.url);
  const isValidOrigin =
    (origin && new URL(origin).origin === requestUrl.origin) ||
    (referer && new URL(referer).origin === requestUrl.origin);
  if (!isValidOrigin) {
    return jsonResponse({ accepted: false, reason: "csrf" }, { status: 403 });
  }

  const today = todayInBeijing();
  const ip = await getClientIp(request);
  const isLocalDev = requestUrl.hostname === "localhost" || requestUrl.hostname === "127.0.0.1";
  const ipHash = ip ? await hashIp(ip) : `no-ip-${body.fingerprint}`;
  const existingPosition = await getExistingVote(env, body.fingerprint, today);

  if (ip && !isLocalDev && existingPosition === null && !(await checkIpRateLimit(env, ipHash, today))) {
    const state = await getScoreState(env);
    const agg = await getTodayVoteCounts(env);
    return jsonResponse({
      accepted: false,
      reason: "rate_limited",
      userPosition: (await getExistingVote(env, body.fingerprint, today)) ?? clampScore(state.score),
      score: Math.round(state.score * 100) / 100,
      level: Math.round(state.score * 100) / 100,
      stage: getStage(state.score),
      upCount: agg.upCount,
      downCount: agg.downCount,
      upVotePoints: agg.upVotePoints,
      downVotePoints: agg.downVotePoints,
    } satisfies VoteResponse, { status: 429 });
  }

  const position = normalizeVotePosition(body.position);
  await recordVote(env, body.fingerprint, ipHash, position, today);

  const summary = await getTodayVoteSummary(env);
  const newState = await applyVotePointsToScore(
    env,
    summary.totalVotePoints,
    summary.uniqueVoters,
    existingPosition === null,
  );

  if (ip && !isLocalDev && existingPosition === null) {
    await incrementIpCount(env, ipHash, today);
  }

  const agg = summary;
  const level = Math.round(newState.score * 100) / 100;

  return jsonResponse({
    accepted: true,
    userPosition: position,
    score: Math.round(newState.score * 100) / 100,
    level,
    stage: getStage(newState.score),
    upCount: agg.upCount,
    downCount: agg.downCount,
    upVotePoints: agg.upVotePoints,
    downVotePoints: agg.downVotePoints,
  } satisfies VoteResponse);
}
