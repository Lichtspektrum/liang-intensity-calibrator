import { MAX_SCORE, MIN_SCORE, STAGES, describeScore } from "./score-domain";
import { scoreFromBallots } from "./score-engine";
import type { CalibrationDimensions, TranscriptQuote } from "./liang-profile";

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

export interface NewsItemData {
  id: string;
  title: string;
  summaryZh: string;
  url: string;
  source: string;
  publishedAt: string;
  tags: string[];
}

export interface NewsCalibrationData {
  date: string;
  score: number;
  stage: string;
  headline: string;
  rationale: string;
  dimensions: CalibrationDimensions;
  quote: TranscriptQuote;
  quoteSource: string;
  transcriptSource: string;
  sourceCaveat: string;
  items: NewsItemData[];
  collectedAt: number;
}

export type NewsJobStatus = "running" | "completed" | "failed";

export interface NewsProgressEventData {
  id: number;
  progress: number;
  stage: string;
  label: string;
  detail: string;
  at: number;
}

export interface NewsJobData {
  id: string;
  status: NewsJobStatus;
  progress: number;
  stage: string;
  label: string;
  detail: string;
  startedAt: number;
  updatedAt: number;
  elapsedMs: number;
  stats: {
    directItems?: number;
    webItems?: number;
    uniqueItems?: number;
    sourcesCompleted?: number;
    sourcesTotal?: number;
  };
  events: NewsProgressEventData[];
  result?: NewsCalibrationData;
}

export interface ChatData {
  score: number;
  stage: string;
  answer: string;
  calibrationSummary: string;
  dimensions: CalibrationDimensions;
  disclaimer: string;
}

export interface ChatTurnData {
  role: "user" | "assistant";
  content: string;
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
  fetchNews(): Promise<NewsCalibrationData>;
  startNewsCollection(force?: boolean): Promise<NewsJobData>;
  fetchNewsProgress(jobId: string): Promise<NewsJobData>;
  chat(message: string, history?: readonly ChatTurnData[]): Promise<ChatData>;
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

const dimensionKeys: (keyof CalibrationDimensions)[] = [
  "originality", "openness", "efficiency", "intelligence", "restraint",
];

function isDimensions(value: unknown): value is CalibrationDimensions {
  return isRecord(value) && dimensionKeys.every((key) =>
    typeof value[key] === "number"
    && Number.isFinite(value[key])
    && value[key] >= -1
    && value[key] <= 1,
  );
}

function isNewsCalibration(value: unknown): value is NewsCalibrationData {
  return isRecord(value)
    && isCalendarDate(value.date)
    && isValidScoreAndStage(value)
    && typeof value.headline === "string"
    && typeof value.rationale === "string"
    && isDimensions(value.dimensions)
    && isRecord(value.quote)
    && typeof value.quote.text === "string"
    && typeof value.quote.timestamp === "string"
    && typeof value.quoteSource === "string"
    && typeof value.transcriptSource === "string"
    && typeof value.sourceCaveat === "string"
    && Array.isArray(value.items)
    && typeof value.collectedAt === "number";
}

function isNewsJob(value: unknown): value is NewsJobData {
  if (!isRecord(value)) return false;
  const statusValid = value.status === "running"
    || value.status === "completed"
    || value.status === "failed";
  const eventsValid = Array.isArray(value.events) && value.events.every((event) =>
    isRecord(event)
    && isNonNegativeSafeInteger(event.id)
    && typeof event.progress === "number"
    && event.progress >= 0
    && event.progress <= 100
    && typeof event.stage === "string"
    && typeof event.label === "string"
    && typeof event.detail === "string"
    && isNonNegativeSafeInteger(event.at),
  );
  return typeof value.id === "string"
    && statusValid
    && typeof value.progress === "number"
    && value.progress >= 0
    && value.progress <= 100
    && typeof value.stage === "string"
    && typeof value.label === "string"
    && typeof value.detail === "string"
    && isNonNegativeSafeInteger(value.startedAt)
    && isNonNegativeSafeInteger(value.updatedAt)
    && isNonNegativeSafeInteger(value.elapsedMs)
    && isRecord(value.stats)
    && eventsValid
    && (value.result === undefined || isNewsCalibration(value.result));
}

function isChatData(value: unknown): value is ChatData {
  return isRecord(value)
    && isValidScoreAndStage(value)
    && typeof value.answer === "string"
    && typeof value.calibrationSummary === "string"
    && typeof value.disclaimer === "string"
    && isDimensions(value.dimensions);
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
      fetchNews: unavailable,
      startNewsCollection: unavailable,
      fetchNewsProgress: unavailable,
      chat: unavailable,
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
    async fetchNews() {
      const result = await fetchJson<unknown>("/api/news");
      if (!isNewsCalibration(result)) throw new Error("Invalid news response");
      return result;
    },
    async startNewsCollection(force = false) {
      const result = await fetchJson<unknown>("/api/news/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      if (!isNewsJob(result)) throw new Error("Invalid news job response");
      return result;
    },
    async fetchNewsProgress(jobId) {
      if (!/^[0-9a-f-]{36}$/iu.test(jobId)) throw new Error("Invalid news job id");
      const result = await fetchJson<unknown>(`/api/news/jobs/${jobId}`);
      if (!isNewsJob(result)) throw new Error("Invalid news job response");
      return result;
    },
    async chat(message, history = []) {
      const result = await fetchJson<unknown>("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history }),
      });
      if (!isChatData(result)) throw new Error("Invalid chat response");
      return result;
    },
  };
}
