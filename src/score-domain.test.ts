import { describe, expect, it } from "vitest";

import {
  clampScore,
  describeScore,
  formatSignedScore,
  normalizeVotePosition,
} from "./score-domain";

describe("signed score domain", () => {
  it("限制分值到 -15 到 15", () => {
    expect(clampScore(-16)).toBe(-15);
    expect(clampScore(0)).toBe(0);
    expect(clampScore(16)).toBe(15);
  });

  it("把投票标准化为范围内整数", () => {
    expect(normalizeVotePosition(-20)).toBe(-15);
    expect(normalizeVotePosition(7.6)).toBe(8);
    expect(normalizeVotePosition(20)).toBe(15);
  });

  it.each([
    [-15, 0, "小难梁"],
    [-9, 6, "牢梁"],
    [-3, 12, "梁子"],
    [3, 18, "梁圣"],
    [9, 24, "梁神"],
    [15, 30, "梁祖"],
  ] as const)("将分值 %s 映射到帧 %s 和阶段 %s", (score, frameIndex, stage) => {
    expect(describeScore(score)).toMatchObject({
      displayScore: score,
      frameIndex,
      stage,
    });
  });

  it("让文字、阶段和图片共享同一个四舍五入结果", () => {
    expect(describeScore(2.5)).toMatchObject({
      displayScore: 3,
      frameIndex: 18,
      stage: "梁圣",
    });
  });

  it("计算相对于完整轨道的百分比", () => {
    expect(describeScore(-15).trackProgress).toBe(0);
    expect(describeScore(0).trackProgress).toBe(0.5);
    expect(describeScore(15).trackProgress).toBe(1);
  });

  it("格式化带符号的展示值", () => {
    expect(formatSignedScore(-3)).toBe("-03");
    expect(formatSignedScore(0)).toBe("00");
    expect(formatSignedScore(3)).toBe("+03");
  });
});
