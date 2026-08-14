export const MIN_SCORE = -15;
export const MAX_SCORE = 15;
export const DEFAULT_SCORE = 0;
export const SCORE_SPAN = MAX_SCORE - MIN_SCORE;
export const SCORE_COUNT = SCORE_SPAN + 1;
export const SCORES_PER_STAGE = 6;

export const STAGES = ["小难梁", "牢梁", "梁子", "梁圣", "梁神", "梁祖"] as const;

export type StageName = (typeof STAGES)[number];

export interface ScoreDescription {
  score: number;
  displayScore: number;
  frameIndex: number;
  stage: StageName;
  stageIndex: number;
  stageProgress: number;
  trackProgress: number;
}

export function clampScore(score: number): number {
  return Math.min(MAX_SCORE, Math.max(MIN_SCORE, score));
}

export function normalizeVotePosition(position: number): number {
  return Math.round(clampScore(position));
}

export function describeScore(rawScore: number): ScoreDescription {
  const score = clampScore(rawScore);
  const displayScore = Math.round(score);
  const frameIndex = displayScore - MIN_SCORE;
  const stageIndex = Math.min(
    STAGES.length - 1,
    Math.floor(frameIndex / SCORES_PER_STAGE),
  );
  const isFinalStage = stageIndex === STAGES.length - 1;
  const stageProgress = isFinalStage
    ? 0
    : (frameIndex - stageIndex * SCORES_PER_STAGE) / SCORES_PER_STAGE;

  return {
    score,
    displayScore,
    frameIndex,
    stage: STAGES[stageIndex],
    stageIndex,
    stageProgress,
    trackProgress: (score - MIN_SCORE) / SCORE_SPAN,
  };
}

export function formatSignedScore(score: number): string {
  const rounded = Math.round(score);
  if (rounded === 0) return "00";
  const magnitude = String(Math.abs(rounded)).padStart(2, "0");
  return rounded > 0 ? `+${magnitude}` : `-${magnitude}`;
}
