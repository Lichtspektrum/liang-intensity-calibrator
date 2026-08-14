import { describe, expect, it } from "vitest";

import {
  STAGE_TRANSITION_MS,
  easeInOutCubic,
  scoreTransitionDurationMs,
} from "./score-transition";

describe("chat score transition", () => {
  it("takes exactly one second between adjacent named stages", () => {
    expect(scoreTransitionDurationMs(-3, 3)).toBe(STAGE_TRANSITION_MS);
    expect(scoreTransitionDurationMs(3, 9)).toBe(STAGE_TRANSITION_MS);
  });

  it("scales duration with distance and eases without overshoot", () => {
    expect(scoreTransitionDurationMs(-15, 15)).toBe(5_000);
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(0.5)).toBe(0.5);
    expect(easeInOutCubic(1)).toBe(1);
  });
});
