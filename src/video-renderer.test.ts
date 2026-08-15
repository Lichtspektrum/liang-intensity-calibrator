// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { describeScore } from "./score-domain";
import {
  createVideoRenderer,
  getPosterPath,
  scoreToVideoFrame,
  scoreToVideoTime,
} from "./video-renderer";

describe("SSR poster state", () => {
  it("为等级提供同编号 WebP 首帧路径", () => {
    expect(getPosterPath(-15, "/")).toBe("/frames/frame-00.webp");
    expect(getPosterPath(3, "/")).toBe("/frames/frame-18.webp");
    expect(getPosterPath(15, "/")).toBe("/frames/frame-30.webp");
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

describe("Pages media paths", () => {
  it("把海报和视频解析到仓库子路径", () => {
    expect(getPosterPath(0, "/liang-intensity-calibrator/")).toBe(
      "/liang-intensity-calibrator/frames/frame-15.webp",
    );

    const canvas = document.createElement("canvas");
    document.body.append(canvas);
    createVideoRenderer(canvas, "/liang-intensity-calibrator/");

    const sources = Array.from(document.querySelectorAll<HTMLSourceElement>("video source"));
    expect(sources.map((source) => source.getAttribute("src"))).toEqual([
      "/liang-intensity-calibrator/video/liang-evolution.webm",
      "/liang-intensity-calibrator/video/liang-evolution.mp4",
    ]);
  });
});

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
