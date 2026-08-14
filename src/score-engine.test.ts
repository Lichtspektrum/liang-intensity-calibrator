import { describe, expect, it } from "vitest";

import {
  DEFAULT_SCORE,
  HALF_LIFE_DAYS,
  clampScore,
  createInitialScoreState,
  decayScore,
  decayToNow,
  normalizeVotePosition,
  scoreFromBallots,
  scoreFromVotePoints,
  scoreToStage,
} from "./score-engine";

describe("score engine", () => {
  describe("clampScore", () => {
    it("clamps below minimum", () => {
      expect(clampScore(-16)).toBe(-15);
    });

    it("clamps above maximum", () => {
      expect(clampScore(16)).toBe(15);
    });

    it("passes through valid scores", () => {
      expect(clampScore(-15)).toBe(-15);
      expect(clampScore(0)).toBe(0);
      expect(clampScore(15)).toBe(15);
    });
  });

  describe("slider vote positions", () => {
    it("returns neutral when there are no active ballots", () => {
      expect(scoreFromBallots({ voters: 0, total: 0 })).toBe(0);
      expect(scoreFromBallots({ voters: -1, total: 10 })).toBe(0);
    });

    it("uses the arithmetic mean of active ballots", () => {
      expect(scoreFromBallots({ voters: 4, total: 10 })).toBe(2.5);
      expect(scoreToStage(scoreFromBallots({ voters: 4, total: 10 }))).toBe("梁圣");
    });

    it("rounds rational midpoints symmetrically without floating-point drift", () => {
      expect(scoreFromBallots({ voters: 40, total: 403 })).toBe(10.08);
      expect(scoreFromBallots({ voters: 40, total: -403 })).toBe(-10.08);
    });

    it("clamps the rounded ballot average to the score range", () => {
      expect(scoreFromBallots({ voters: 10, total: 160 })).toBe(15);
      expect(scoreFromBallots({ voters: 10, total: -160 })).toBe(-15);
    });

    it("normalizes votes to integer positions from -15 to 15", () => {
      expect(normalizeVotePosition(-20)).toBe(-15);
      expect(normalizeVotePosition(7.6)).toBe(8);
      expect(normalizeVotePosition(20)).toBe(15);
    });

    it("uses the arithmetic mean of raw vote points as the normalized score", () => {
      expect(scoreFromVotePoints(0, 1)).toBe(0);
      expect(scoreFromVotePoints(-15, 1)).toBe(-15);
      expect(scoreFromVotePoints(15, 1)).toBe(15);
      expect(scoreFromVotePoints(-5, 2)).toBe(-2.5);
    });

    it("returns the neutral score before any vote points exist", () => {
      expect(scoreFromVotePoints(0, 0)).toBe(DEFAULT_SCORE);
    });
  });

  describe("decayScore", () => {
    it("decays high score toward default over time", () => {
      const decayed = decayScore(15, HALF_LIFE_DAYS * 86400000);
      expect(decayed).toBeLessThan(15);
      expect(decayed).toBeGreaterThan(DEFAULT_SCORE);
    });

    it("decays low score upward toward default", () => {
      const decayed = decayScore(-15, HALF_LIFE_DAYS * 86400000);
      expect(decayed).toBeGreaterThan(-15);
      expect(decayed).toBeLessThan(DEFAULT_SCORE);
    });

    it("reaches half-life after one half-life period", () => {
      const start = 15;
      const decayed = decayScore(start, HALF_LIFE_DAYS * 86400000);
      const expected = DEFAULT_SCORE + (start - DEFAULT_SCORE) * 0.5;
      expect(decayed).toBeCloseTo(expected);
    });

    it("default score stays at default", () => {
      expect(decayScore(DEFAULT_SCORE, 1000 * 86400000)).toBeCloseTo(DEFAULT_SCORE);
    });

    it("zero time does not change score", () => {
      expect(decayScore(10, 0)).toBe(10);
    });
  });

  describe("decayToNow", () => {
    it("decays state to current time", () => {
      const now = Date.now();
      const state = createInitialScoreState(now - HALF_LIFE_DAYS * 86400000);
      state.score = 15;
      const decayed = decayToNow(state, now);
      expect(decayed.lastUpdateTs).toBe(now);
      expect(decayed.score).toBeCloseTo(7.5);
    });
  });

  describe("scoreToStage", () => {
    it("maps -15 to -10 to 小难梁", () => {
      expect(scoreToStage(-15)).toBe("小难梁");
      expect(scoreToStage(-10)).toBe("小难梁");
    });

    it("maps -9 to -4 to 牢梁", () => {
      expect(scoreToStage(-9)).toBe("牢梁");
      expect(scoreToStage(-4)).toBe("牢梁");
    });

    it("maps -3 to 2 to 梁子", () => {
      expect(scoreToStage(-3)).toBe("梁子");
      expect(scoreToStage(2)).toBe("梁子");
    });

    it("maps 3 to 8 to 梁圣", () => {
      expect(scoreToStage(3)).toBe("梁圣");
      expect(scoreToStage(8)).toBe("梁圣");
    });

    it("maps 9 to 14 to 梁神", () => {
      expect(scoreToStage(9)).toBe("梁神");
    });

    it("maps 15 to 梁祖", () => {
      expect(scoreToStage(15)).toBe("梁祖");
    });
  });

  describe("createInitialScoreState", () => {
    it("starts at default score", () => {
      const state = createInitialScoreState();
      expect(state.score).toBe(DEFAULT_SCORE);
    });
  });
});
