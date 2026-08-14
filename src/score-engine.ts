import {
  DEFAULT_SCORE,
  MAX_SCORE,
  MIN_SCORE,
  clampScore,
  describeScore,
  normalizeVotePosition,
} from "./score-domain";

export { DEFAULT_SCORE, MAX_SCORE, MIN_SCORE, clampScore, normalizeVotePosition };
export const HALF_LIFE_DAYS = 30;
export const COLD_START_VOTER_THRESHOLD = 500;
export const COLD_START_DAY_THRESHOLD = 7;
export const IP_DAILY_VOTE_LIMIT = 5;

const LAMBDA = Math.log(2) / HALF_LIFE_DAYS;
const MS_PER_DAY = 86400000;

export interface ScoreState {
  score: number;
  lastUpdateTs: number;
  cumulativeVoters: number;
  daysSinceLaunch: number;
}

export function decayScore(score: number, ageMs: number): number {
  const ageDays = ageMs / MS_PER_DAY;
  return DEFAULT_SCORE + (score - DEFAULT_SCORE) * Math.exp(-LAMBDA * ageDays);
}

export function scoreFromVotePoints(totalVotePoints: number, voterCount: number): number {
  if (voterCount <= 0) return DEFAULT_SCORE;
  return clampScore(totalVotePoints / voterCount);
}

export function scoreFromBallots({
  voters,
  total,
}: {
  voters: number;
  total: number;
}): number {
  if (voters <= 0) return DEFAULT_SCORE;
  if (!Number.isSafeInteger(voters) || !Number.isSafeInteger(total)) {
    throw new TypeError("Ballot voters and total must be safe integers");
  }

  const denominator = BigInt(voters);
  const scaledTotal = BigInt(Math.abs(total)) * 100n;
  let roundedHundredths = scaledTotal / denominator;
  const remainder = scaledTotal % denominator;
  if (remainder * 2n >= denominator) {
    roundedHundredths += 1n;
  }

  const sign = total < 0 ? -1 : 1;
  return clampScore(sign * Number(roundedHundredths) / 100);
}

export function scoreToStage(score: number): string {
  return describeScore(score).stage;
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
