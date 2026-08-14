import { SCORES_PER_STAGE } from "./score-domain";

export const STAGE_TRANSITION_MS = 1_000;

export function scoreTransitionDurationMs(from: number, to: number): number {
  return Math.abs(to - from) / SCORES_PER_STAGE * STAGE_TRANSITION_MS;
}

export function easeInOutCubic(progress: number): number {
  const clamped = Math.min(1, Math.max(0, progress));
  return clamped < 0.5
    ? 4 * clamped ** 3
    : 1 - ((-2 * clamped + 2) ** 3) / 2;
}
