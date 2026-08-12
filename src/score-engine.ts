export const MIN_SCORE = 0;
export const MAX_SCORE = 30;
export const DEFAULT_SCORE = 15;
export const HALF_LIFE_DAYS = 30;
export const VOTE_DELTA = 0.2;
export const COLD_START_VOTER_THRESHOLD = 500;
export const COLD_START_DAY_THRESHOLD = 7;
export const MAX_NEWS_EVENT_DELTA = 5;
export const IP_DAILY_VOTE_LIMIT = 5;

const LAMBDA = Math.log(2) / HALF_LIFE_DAYS;
const MS_PER_DAY = 86400000;

export interface ScoreState {
  score: number;
  lastUpdateTs: number;
  cumulativeVoters: number;
  daysSinceLaunch: number;
}

export function clampScore(score: number): number {
  return Math.min(MAX_SCORE, Math.max(MIN_SCORE, score));
}

export function normalizeVotePosition(position: number): number {
  return Math.round(clampScore(position));
}

export function decayScore(score: number, ageMs: number): number {
  const ageDays = ageMs / MS_PER_DAY;
  return DEFAULT_SCORE + (score - DEFAULT_SCORE) * Math.exp(-LAMBDA * ageDays);
}

export function applyVote(score: number, direction: "up" | "down"): number {
  const delta = direction === "up" ? VOTE_DELTA : -VOTE_DELTA;
  return clampScore(score + delta);
}

export function applyVoteChange(
  score: number,
  oldDirection: "up" | "down",
  newDirection: "up" | "down",
): number {
  const revert = oldDirection === "up" ? -VOTE_DELTA : VOTE_DELTA;
  const apply = newDirection === "up" ? VOTE_DELTA : -VOTE_DELTA;
  return clampScore(score + revert + apply);
}

export function scoreFromVotePoints(totalVotePoints: number, voterCount: number): number {
  if (voterCount <= 0) return DEFAULT_SCORE;
  return clampScore(totalVotePoints / voterCount);
}

export function applyNewsDelta(score: number, delta: number): number {
  return clampScore(score + delta);
}

export function scoreToLevel(score: number): number {
  return Math.round(score * 100) / 100;
}

export function scoreToStage(score: number): string {
  const stages = ["小难梁", "牢梁", "梁子", "梁圣", "梁神", "梁祖"];
  const idx = Math.min(stages.length - 1, Math.floor(score / 6));
  return stages[idx];
}

export function createInitialScoreState(now: number = Date.now()): ScoreState {
  return {
    score: DEFAULT_SCORE,
    lastUpdateTs: now,
    cumulativeVoters: 0,
    daysSinceLaunch: 0,
  };
}

export function decayToNow(state: ScoreState, now: number): ScoreState {
  const ageMs = now - state.lastUpdateTs;
  if (ageMs <= 0) return state;
  return {
    ...state,
    score: decayScore(state.score, ageMs),
    lastUpdateTs: now,
  };
}
