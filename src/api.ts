import { MAX_SCORE, MIN_SCORE, STAGES, describeScore } from "./score-domain";
import { scoreFromBallots } from "./score-engine";

export interface ScoreData {
  score: number;
  stage: string;
  voterCount: number;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  positivePoints: number;
  negativePoints: number;
}

export interface TimelineEventData {
  id: number;
  date: string;
  title: string;
  summary: string | null;
  isMajor: boolean;
}

export interface TimelineDayData {
  date: string;
  score: number;
  stage: string;
  voterCount: number;
}

interface VoteCommunityData extends ScoreData {
  userPosition: number;
}

export type VoteResult =
  | (VoteCommunityData & {
      accepted: true;
      nextVoteAt: number;
    })
  | (VoteCommunityData & {
      accepted: false;
      reason: "cooldown";
      nextVoteAt: number;
    })
  | (VoteCommunityData & {
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
        | "invalid_request";
    };

export interface ApiClient {
  configured: boolean;
  fetchScore(): Promise<ScoreData>;
  submitVote(fingerprint: string, position: number): Promise<VoteResult>;
  fetchTimeline(from?: string, to?: string): Promise<TimelineDayData[]>;
}

export class CommunityUnavailableError extends Error {
  constructor() {
    super("Community API is not configured");
    this.name = "CommunityUnavailableError";
  }
}

function normalizeBaseUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password || url.search || url.hash) return null;
    if (!/^\/+$/u.test(url.pathname)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new Error(`API error: ${response.status}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return isSafeInteger(value) && value >= 0;
}

function isValidScoreAndStage(value: Record<string, unknown>): boolean {
  return typeof value.score === "number"
    && Number.isFinite(value.score)
    && value.score >= MIN_SCORE
    && value.score <= MAX_SCORE
    && typeof value.stage === "string"
    && STAGES.includes(value.stage as (typeof STAGES)[number])
    && describeScore(value.score).stage === value.stage;
}

function isScoreData(value: unknown): value is ScoreData {
  if (!isRecord(value) || !isValidScoreAndStage(value)) return false;
  const {
    voterCount,
    positiveCount,
    negativeCount,
    neutralCount,
    positivePoints,
    negativePoints,
  } = value;
  if (
    !isNonNegativeSafeInteger(voterCount)
    || !isNonNegativeSafeInteger(positiveCount)
    || !isNonNegativeSafeInteger(negativeCount)
    || !isNonNegativeSafeInteger(neutralCount)
    || positiveCount + negativeCount + neutralCount !== voterCount
    || !isSafeInteger(positivePoints)
    || !isSafeInteger(negativePoints)
  ) {
    return false;
  }
  const positiveMagnitudeValid = positiveCount === 0
    ? positivePoints === 0
    : positivePoints >= positiveCount && positivePoints <= positiveCount * MAX_SCORE;
  const negativeMagnitude = Math.abs(negativePoints);
  const negativeMagnitudeValid = negativeCount === 0
    ? negativePoints === 0
    : negativePoints <= -negativeCount && negativeMagnitude <= negativeCount * MAX_SCORE;
  if (!positiveMagnitudeValid || !negativeMagnitudeValid) return false;

  const total = positivePoints + negativePoints;
  if (!Number.isSafeInteger(total)) return false;
  try {
    return scoreFromBallots({ voters: voterCount, total }) === value.score;
  } catch {
    return false;
  }
}

function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isTimelineDayData(value: unknown): value is TimelineDayData {
  return isRecord(value)
    && isCalendarDate(value.date)
    && isValidScoreAndStage(value)
    && isNonNegativeSafeInteger(value.voterCount);
}

function isVotePosition(value: unknown): value is number {
  return isSafeInteger(value)
    && value >= MIN_SCORE
    && value <= MAX_SCORE;
}

function isNextVoteAt(value: unknown): value is number {
  return isNonNegativeSafeInteger(value);
}

const validationReasons = new Set([
  "invalid_body",
  "invalid_position",
  "invalid_fingerprint",
  "invalid_request",
]);

function isAcceptedVote(value: unknown): boolean {
  return isRecord(value)
    && value.accepted === true
    && isScoreData(value)
    && isVotePosition(value.userPosition)
    && isNextVoteAt(value.nextVoteAt);
}

function isCooldownVote(value: unknown): boolean {
  return isRecord(value)
    && value.accepted === false
    && value.reason === "cooldown"
    && isScoreData(value)
    && isVotePosition(value.userPosition)
    && isNextVoteAt(value.nextVoteAt);
}

function isRateLimitedVote(value: unknown): boolean {
  return isRecord(value)
    && value.accepted === false
    && value.reason === "rate_limited"
    && isScoreData(value)
    && isVotePosition(value.userPosition)
    && value.nextVoteAt === null;
}

function isValidationFailure(value: unknown): boolean {
  return isRecord(value)
    && value.accepted === false
    && typeof value.reason === "string"
    && validationReasons.has(value.reason);
}

function isCsrfFailure(value: unknown): boolean {
  return isRecord(value) && value.accepted === false && value.reason === "csrf";
}

export function createApiClient(baseUrl: string | undefined): ApiClient {
  const base = normalizeBaseUrl(baseUrl);
  const unavailable = async (): Promise<never> => {
    throw new CommunityUnavailableError();
  };

  if (!base) {
    return {
      configured: false,
      fetchScore: unavailable,
      submitVote: unavailable,
      fetchTimeline: unavailable,
    };
  }

  const fetchJson = async <T>(path: string, options?: RequestInit): Promise<T> => {
    const response = await fetch(`${base}${path}`, options);
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return await readJson(response) as T;
  };

  return {
    configured: true,
    async fetchScore() {
      const result = await fetchJson<unknown>("/api/score");
      if (!isScoreData(result)) throw new Error("Invalid score response");
      return result;
    },
    async submitVote(fingerprint, position) {
      const response = await fetch(`${base}/api/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fingerprint, position }),
      });
      const body = await readJson(response);
      let matchesStatus = false;
      if (response.status >= 200 && response.status < 300) {
        matchesStatus = isAcceptedVote(body);
      } else if (response.status === 400) {
        matchesStatus = isValidationFailure(body);
      } else if (response.status === 403) {
        matchesStatus = isCsrfFailure(body);
      } else if (response.status === 429) {
        matchesStatus = isCooldownVote(body) || isRateLimitedVote(body);
      }

      if (matchesStatus) return body as VoteResult;
      if (![400, 403, 429].includes(response.status) && !response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      throw new Error("Invalid vote response");
    },
    async fetchTimeline(from, to) {
      const url = new URL("/api/timeline", base);
      if (from) url.searchParams.set("from", from);
      if (to) url.searchParams.set("to", to);
      const result = await fetchJson<unknown>(`${url.pathname}${url.search}`);
      if (!Array.isArray(result) || !result.every(isTimelineDayData)) {
        throw new Error("Invalid timeline response");
      }
      return result;
    },
  };
}
