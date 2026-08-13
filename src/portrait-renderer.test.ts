import { describe, expect, it } from "vitest";

import { getPosterPath } from "./initial-state";
import { describeScore } from "./score-domain";

describe("SSR poster state", () => {
  it("为等级提供同编号 WebP 首帧路径", () => {
    expect(getPosterPath(-15)).toBe("/frames/frame-00.webp");
    expect(getPosterPath(3)).toBe("/frames/frame-18.webp");
    expect(getPosterPath(15)).toBe("/frames/frame-30.webp");
  });

  it("按页面语义等级选择唯一对应帧", () => {
    expect(describeScore(-15).frameIndex).toBe(0);
    expect(describeScore(0).frameIndex).toBe(15);
    expect(describeScore(2.5).frameIndex).toBe(18);
    expect(describeScore(15).frameIndex).toBe(30);
  });

  it("越界位置收束到首尾帧", () => {
    expect(describeScore(-20).frameIndex).toBe(0);
    expect(describeScore(99).frameIndex).toBe(30);
  });
});
