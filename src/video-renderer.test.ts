// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import {
  createVideoRenderer,
  getPosterPath,
  scoreToVideoFrame,
  scoreToVideoTime,
} from "./video-renderer";

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
