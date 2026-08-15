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
  conversation: {
    id: string;
    title: string;
  };
}

export interface ChatTurnData {
  role: "user" | "assistant";
  content: string;
}

export interface ConversationSummaryData {
  id: string;
  title: string;
  messageCount: number;
  lastScore: number | null;
  lastStage: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface ConversationMessageData {
  role: "user" | "assistant";
  content: string;
  score: number | null;
  stage: string | null;
  createdAt: number;
}

export interface ConversationData {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ConversationMessageData[];
}

export interface OpenCodeModelsData {
  models: string[];
  active: string;
  activeInList: boolean;
}

export interface ModePositionsData {
  news: number | null;
  chat: number | null;
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
  chat(
    message: string,
    history?: readonly ChatTurnData[],
    conversationId?: string,
    model?: string,
  ): Promise<ChatData>;
  fetchConversations(): Promise<ConversationSummaryData[]>;
  fetchConversation(id: string): Promise<ConversationData>;
  deleteConversation(id: string): Promise<void>;
  fetchOpenCodeModels(): Promise<OpenCodeModelsData>;
  fetchModePositions(): Promise<ModePositionsData>;
  saveModePositions(positions: ModePositionsData): Promise<void>;
}

export class CommunityUnavailableError extends Error {
  constructor() {
    super("Community API is not configured");
    this.name = "CommunityUnavailableError";
  }
}

export class ChatRateLimitError extends Error {
  constructor() {
    super("Chat hourly rate limit reached");
    this.name = "ChatRateLimitError";
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

function isModePosition(value: unknown): value is number | null {
  return value === null
    || (typeof value === "number" && Number.isFinite(value) && value >= MIN_SCORE && value <= MAX_SCORE);
}

function isModePositionsData(value: unknown): value is ModePositionsData {
  return isRecord(value)
    && isModePosition(value.news)
    && isModePosition(value.chat);
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

const CONVERSATION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

function isConversationId(value: unknown): value is string {
  return typeof value === "string" && CONVERSATION_ID_PATTERN.test(value);
}

function isScoreOrNull(value: unknown): value is number | null {
  return value === null
    || (typeof value === "number" && Number.isFinite(value) && value >= MIN_SCORE && value <= MAX_SCORE);
}

function isConversationSummaryData(value: unknown): value is ConversationSummaryData {
  if (
    !isRecord(value)
    || !isConversationId(value.id)
    || typeof value.title !== "string"
    || !isNonNegativeSafeInteger(value.messageCount)
    || !isScoreOrNull(value.lastScore)
    || !isNonNegativeSafeInteger(value.createdAt)
    || !isNonNegativeSafeInteger(value.updatedAt)
  ) {
    return false;
  }
  const lastScore = value.lastScore;
  if (lastScore === null) return value.lastStage === null;
  return typeof value.lastStage === "string"
    && STAGES.includes(value.lastStage as (typeof STAGES)[number])
    && describeScore(lastScore).stage === value.lastStage;
}

function isConversationMessageData(value: unknown): value is ConversationMessageData {
  if (
    !isRecord(value)
    || (value.role !== "user" && value.role !== "assistant")
    || typeof value.content !== "string"
    || !isNonNegativeSafeInteger(value.createdAt)
  ) {
    return false;
  }
  if (value.role === "user") {
    return value.score === null && value.stage === null;
  }
  if (!isScoreOrNull(value.score) || value.score === null) return false;
  if (value.stage === null) return false;
  return STAGES.includes(value.stage as (typeof STAGES)[number])
    && describeScore(value.score).stage === value.stage;
}

function isConversationData(value: unknown): value is ConversationData {
  return isRecord(value)
    && isConversationId(value.id)
    && typeof value.title === "string"
    && isNonNegativeSafeInteger(value.createdAt)
    && isNonNegativeSafeInteger(value.updatedAt)
    && Array.isArray(value.messages)
    && value.messages.every(isConversationMessageData);
}

function isOpenCodeModelsData(value: unknown): value is OpenCodeModelsData {
  return isRecord(value)
    && Array.isArray(value.models)
    && value.models.every((model): model is string => typeof model === "string" && model.length > 0)
    && typeof value.active === "string"
    && typeof value.activeInList === "boolean";
}

function isChatData(value: unknown): value is ChatData {
  return isRecord(value)
    && isValidScoreAndStage(value)
    && typeof value.answer === "string"
    && typeof value.calibrationSummary === "string"
    && typeof value.disclaimer === "string"
    && isDimensions(value.dimensions)
    && isRecord(value.conversation)
    && isConversationId(value.conversation.id)
    && typeof value.conversation.title === "string";
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
      fetchConversations: unavailable,
      fetchConversation: unavailable,
      deleteConversation: unavailable,
      fetchOpenCodeModels: unavailable,
      fetchModePositions: unavailable,
      saveModePositions: unavailable,
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
    async chat(message, history = [], conversationId, model) {
      const payload: Record<string, unknown> = { message };
      if (conversationId !== undefined) {
        if (!isConversationId(conversationId)) throw new Error("Invalid conversation id");
        payload.conversationId = conversationId;
      } else if (history.length > 0) {
        payload.history = history;
      }
      if (model !== undefined) {
        const normalizedModel = model.trim();
        if (!normalizedModel || normalizedModel.length > 120) {
          throw new Error("Invalid model");
        }
        payload.model = normalizedModel;
      }
      const response = await fetch(`${base}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (response.status === 429) throw new ChatRateLimitError();
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const result = await readJson(response);
      if (!isChatData(result)) throw new Error("Invalid chat response");
      return result;
    },
    async fetchConversations() {
      const result = await fetchJson<unknown>("/api/conversations");
      if (!Array.isArray(result) || !result.every(isConversationSummaryData)) {
        throw new Error("Invalid conversations response");
      }
      return result;
    },
    async fetchConversation(id) {
      if (!isConversationId(id)) throw new Error("Invalid conversation id");
      const result = await fetchJson<unknown>(`/api/conversations/${id}`);
      if (!isConversationData(result)) throw new Error("Invalid conversation response");
      return result;
    },
    async deleteConversation(id) {
      if (!isConversationId(id)) throw new Error("Invalid conversation id");
      const response = await fetch(`${base}/api/conversations/${id}`, { method: "DELETE" });
      // 重复删除视为成功，便于客户端直接刷新列表。
      if (!response.ok && response.status !== 404) {
        throw new Error(`API error: ${response.status}`);
      }
    },
    async fetchOpenCodeModels() {
      const result = await fetchJson<unknown>("/api/opencode-models");
      if (!isOpenCodeModelsData(result)) throw new Error("Invalid opencode models response");
      return result;
    },
    async fetchModePositions() {
      const result = await fetchJson<unknown>("/api/mode-positions");
      if (!isModePositionsData(result)) throw new Error("Invalid mode positions response");
      return result;
    },
    async saveModePositions(positions) {
      const response = await fetch(`${base}/api/mode-positions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(positions),
      });
      if (!response.ok) throw new Error(`API error: ${response.status}`);
    },
  };
}
