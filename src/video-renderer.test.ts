// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import {
  scoreToVideoFrame,
  scoreToVideoTime,
} from "./video-renderer";

describe("scoreToVideoTime", () => {
  it("把首、中、末分值映射到完整视频时间", () => {
    expect(scoreToVideoTime(-15, 8)).toBe(0);
    expect(scoreToVideoTime(0, 8)).toBe(4);
    expect(scoreToVideoTime(15, 8)).toBe(8);
  });

  it("限制越界分值", () => {
    expect(scoreToVideoTime(-20, 8)).toBe(0);
    expect(scoreToVideoTime(20, 8)).toBe(8);
  });
});

describe("video scrubbing", () => {
  it("为连续分值保留 241 个插值帧的位置", () => {
    expect(scoreToVideoFrame(-15)).toBe(0);
    expect(scoreToVideoFrame(0)).toBe(120);
    expect(scoreToVideoFrame(4.5)).toBe(156);
    expect(scoreToVideoFrame(15)).toBe(240);
  });
});
