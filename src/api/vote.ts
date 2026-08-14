import { scoreToStage } from "../score-engine";
import { MAX_SCORE, MIN_SCORE } from "../score-domain";
import { getCommunityScore, type CommunityScore } from "./score";
import {
  NEW_IDENTITIES_PER_IP_PER_DAY,
  VOTE_COOLDOWN_MS,
  allowedOrigin,
  getCooldownState,
  hmacIdentifier,
  jsonResponse,
  type Env,
  type VoteRequest,
  type VoteResponse,
} from "./shared";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

interface VoterRow {
  voter_hash: string;
  ip_hash: string;
  position: number;
  created_at: number;
  updated_at: number;
}

function isValidPosition(position: unknown): position is number {
  return typeof position === "number"
    && Number.isInteger(position)
    && position >= MIN_SCORE
    && position <= MAX_SCORE;
}

function isValidFingerprint(fingerprint: unknown): fingerprint is string {
  return typeof fingerprint === "string"
    && fingerprint.length >= 8
    && fingerprint.length <= 128;
}

function scoreFields(aggregate: CommunityScore) {
  return {
    ...aggregate,
    stage: scoreToStage(aggregate.score),
  };
}

async function getExistingVoter(env: Env, voterHash: string): Promise<VoterRow | null> {
  return env.DB
    .prepare(
      `SELECT voter_hash, ip_hash, position, created_at, updated_at
       FROM voters
       WHERE voter_hash = ?`,
    )
    .bind(voterHash)
    .first<VoterRow>();
}

async function insertVoter(
  env: Env,
  voterHash: string,
  ipHash: string,
  position: number,
  now: number,
): Promise<boolean> {
  const result = await env.DB
    .prepare(
      `INSERT INTO voters (voter_hash, ip_hash, position, created_at, updated_at)
       SELECT ?, ?, ?, ?, ?
       WHERE (
         SELECT COUNT(*)
         FROM voters
         WHERE ip_hash = ? AND created_at >= ?
       ) < ?
       ON CONFLICT(voter_hash) DO NOTHING`,
    )
    .bind(
      voterHash,
      ipHash,
      position,
      now,
      now,
      ipHash,
      now - ONE_DAY_MS,
      NEW_IDENTITIES_PER_IP_PER_DAY,
    )
    .run();
  return result.meta?.changes === 1;
}

async function updateVoter(
  env: Env,
  voterHash: string,
  position: number,
  now: number,
): Promise<boolean> {
  const result = await env.DB
    .prepare(
      `UPDATE voters
       SET position = ?, updated_at = ?
       WHERE voter_hash = ? AND updated_at <= ?`,
    )
    .bind(position, now, voterHash, now - VOTE_COOLDOWN_MS)
    .run();
  return result.meta?.changes === 1;
}

async function cooldownResponse(env: Env, voter: VoterRow): Promise<Response> {
  const aggregate = await getCommunityScore(env);
  return jsonResponse({
    accepted: false,
    reason: "cooldown",
    userPosition: voter.position,
    nextVoteAt: voter.updated_at + VOTE_COOLDOWN_MS,
    ...scoreFields(aggregate),
  } satisfies VoteResponse, { status: 429 });
}

export async function handlePostVote(request: Request, env: Env): Promise<Response> {
  let body: VoteRequest;
  try {
    body = await request.json() as VoteRequest;
  } catch {
    return jsonResponse(
      { accepted: false, reason: "invalid_body" } satisfies VoteResponse,
      { status: 400 },
    );
  }

  if (!isValidPosition(body?.position)) {
    return jsonResponse(
      { accepted: false, reason: "invalid_position" } satisfies VoteResponse,
      { status: 400 },
    );
  }
  if (!isValidFingerprint(body?.fingerprint)) {
    return jsonResponse(
      { accepted: false, reason: "invalid_fingerprint" } satisfies VoteResponse,
      { status: 400 },
    );
  }

  const origin = request.headers.get("Origin") ?? "";
  if (!allowedOrigin(origin, env)) {
    return jsonResponse(
      { accepted: false, reason: "csrf" } satisfies VoteResponse,
      { status: 403 },
    );
  }

  if (
    typeof env.VOTER_HASH_SECRET !== "string"
    || new TextEncoder().encode(env.VOTER_HASH_SECRET).byteLength < 32
  ) {
    return jsonResponse(
      { accepted: false, reason: "service_unavailable" } satisfies VoteResponse,
      { status: 503 },
    );
  }

  const now = Date.now();
  const rawIp = request.headers.get("CF-Connecting-IP");
  if (!rawIp) {
    return jsonResponse(
      { accepted: false, reason: "invalid_request" } satisfies VoteResponse,
      { status: 400 },
    );
  }
  const [voterHash, ipHash] = await Promise.all([
    hmacIdentifier(env.VOTER_HASH_SECRET, `voter:${body.fingerprint}`),
    hmacIdentifier(env.VOTER_HASH_SECRET, `ip:${rawIp}`),
  ]);
  const existing = await getExistingVoter(env, voterHash);

  if (existing) {
    const cooldown = getCooldownState(existing.updated_at, now);
    if (!cooldown.allowed) {
      return cooldownResponse(env, existing);
    }

    const updated = await updateVoter(env, voterHash, body.position, now);
    if (!updated) {
      const current = await getExistingVoter(env, voterHash);
      if (!current) throw new Error("Voter disappeared during conditional update");
      return cooldownResponse(env, current);
    }
  } else {
    const inserted = await insertVoter(env, voterHash, ipHash, body.position, now);
    if (!inserted) {
      const concurrentVoter = await getExistingVoter(env, voterHash);
      if (concurrentVoter) {
        return cooldownResponse(env, concurrentVoter);
      }

      const aggregate = await getCommunityScore(env);
      return jsonResponse({
        accepted: false,
        reason: "rate_limited",
        userPosition: body.position,
        nextVoteAt: null,
        ...scoreFields(aggregate),
      } satisfies VoteResponse, { status: 429 });
    }
  }

  const aggregate = await getCommunityScore(env);
  return jsonResponse({
    accepted: true,
    userPosition: body.position,
    nextVoteAt: now + VOTE_COOLDOWN_MS,
    ...scoreFields(aggregate),
  } satisfies VoteResponse);
}
