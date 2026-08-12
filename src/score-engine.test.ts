import { describe, expect, it } from "vitest";

import {
  DEFAULT_SCORE,
  HALF_LIFE_DAYS,
  VOTE_DELTA,
  applyNewsDelta,
  applyVote,
  clampScore,
  createInitialScoreState,
  decayScore,
  decayToNow,
  normalizeVotePosition,
  scoreFromVotePoints,
  scoreToLevel,
  scoreToStage,
} from "./score-engine";

describe("score engine", () => {
  describe("clampScore", () => {
    it("clamps below minimum", () => {
      expect(clampScore(-1)).toBe(0);
    });

    it("clamps above maximum", () => {
      expect(clampScore(31)).toBe(30);
    });

    it("passes through valid scores", () => {
      expect(clampScore(15)).toBe(15);
      expect(clampScore(0)).toBe(0);
      expect(clampScore(30)).toBe(30);
    });
  });

  describe("applyVote", () => {
    it("up vote increases score by VOTE_DELTA", () => {
      expect(applyVote(15, "up")).toBeCloseTo(15 + VOTE_DELTA);
    });

    it("down vote decreases score by VOTE_DELTA", () => {
      expect(applyVote(15, "down")).toBeCloseTo(15 - VOTE_DELTA);
    });

    it("does not go below 0", () => {
      expect(applyVote(0, "down")).toBe(0);
    });

    it("does not go above 30", () => {
      expect(applyVote(30, "up")).toBe(30);
    });
  });

  describe("slider vote positions", () => {
    it("normalizes votes to integer positions from 0 to 30", () => {
      expect(normalizeVotePosition(-2)).toBe(0);
      expect(normalizeVotePosition(7.6)).toBe(8);
      expect(normalizeVotePosition(32)).toBe(30);
    });

    it("uses the arithmetic mean of raw vote points as the normalized score", () => {
      expect(scoreFromVotePoints(0, 1)).toBe(0);
      expect(scoreFromVotePoints(15, 1)).toBe(15);
      expect(scoreFromVotePoints(30, 1)).toBe(30);
      expect(scoreFromVotePoints(45, 2)).toBe(22.5);
    });

    it("returns the neutral score before any vote points exist", () => {
      expect(scoreFromVotePoints(0, 0)).toBe(DEFAULT_SCORE);
    });
  });

  describe("decayScore", () => {
    it("decays high score toward default over time", () => {
      const decayed = decayScore(30, HALF_LIFE_DAYS * 86400000);
      expect(decayed).toBeLessThan(30);
      expect(decayed).toBeGreaterThan(DEFAULT_SCORE);
    });

    it("decays low score upward toward default", () => {
      const decayed = decayScore(0, HALF_LIFE_DAYS * 86400000);
      expect(decayed).toBeGreaterThan(0);
      expect(decayed).toBeLessThan(DEFAULT_SCORE);
    });

    it("reaches half-life after one half-life period", () => {
      const start = 30;
      const decayed = decayScore(start, HALF_LIFE_DAYS * 86400000);
      const expected = DEFAULT_SCORE + (start - DEFAULT_SCORE) * 0.5;
      expect(decayed).toBeCloseTo(expected);
    });

    it("default score stays at default", () => {
      expect(decayScore(DEFAULT_SCORE, 1000 * 86400000)).toBeCloseTo(DEFAULT_SCORE);
    });

    it("zero time does not change score", () => {
      expect(decayScore(25, 0)).toBe(25);
    });
  });

  describe("decayToNow", () => {
    it("decays state to current time", () => {
      const now = Date.now();
      const state = createInitialScoreState(now - HALF_LIFE_DAYS * 86400000);
      state.score = 30;
      const decayed = decayToNow(state, now);
      expect(decayed.lastUpdateTs).toBe(now);
      expect(decayed.score).toBeCloseTo(DEFAULT_SCORE + (30 - DEFAULT_SCORE) * 0.5);
    });
  });

  describe("applyNewsDelta", () => {
    it("adds positive delta", () => {
      expect(applyNewsDelta(15, 3)).toBe(18);
    });

    it("adds negative delta", () => {
      expect(applyNewsDelta(15, -3)).toBe(12);
    });

    it("clamps at boundaries", () => {
      expect(applyNewsDelta(28, 5)).toBe(30);
      expect(applyNewsDelta(2, -5)).toBe(0);
    });
  });

  describe("scoreToLevel", () => {
    it("is identity (score 0-30 = level 0-30)", () => {
      expect(scoreToLevel(0)).toBe(0);
      expect(scoreToLevel(15)).toBe(15);
      expect(scoreToLevel(30)).toBeCloseTo(30);
    });
  });

  describe("scoreToStage", () => {
    it("maps 0-5 to 小难梁", () => {
      expect(scoreToStage(0)).toBe("小难梁");
      expect(scoreToStage(3)).toBe("小难梁");
      expect(scoreToStage(5)).toBe("小难梁");
    });

    it("maps 6-11 to 牢梁", () => {
      expect(scoreToStage(6)).toBe("牢梁");
      expect(scoreToStage(10)).toBe("牢梁");
    });

    it("maps 12-17 to 梁子", () => {
      expect(scoreToStage(12)).toBe("梁子");
      expect(scoreToStage(15)).toBe("梁子");
    });

    it("maps 18-23 to 梁圣", () => {
      expect(scoreToStage(18)).toBe("梁圣");
      expect(scoreToStage(22)).toBe("梁圣");
    });

    it("maps 24-29 to 梁神", () => {
      expect(scoreToStage(24)).toBe("梁神");
    });

    it("maps 30 to 梁祖", () => {
      expect(scoreToStage(30)).toBe("梁祖");
    });
  });

  describe("createInitialScoreState", () => {
    it("starts at default score", () => {
      const state = createInitialScoreState();
      expect(state.score).toBe(DEFAULT_SCORE);
    });
  });
});
