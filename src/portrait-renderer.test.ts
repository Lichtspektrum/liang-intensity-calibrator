import { describe, expect, it } from "vitest";

import {
  getFrameIndex,
  getPortraitPath,
  PORTRAIT_PATHS,
} from "./portrait-renderer";

describe("portrait renderer state", () => {
  it("为 31 个颗粒状态提供独立图片路径", () => {
    expect(PORTRAIT_PATHS).toHaveLength(31);
    expect(PORTRAIT_PATHS[0]).toBe("/frames/frame-00.png");
    expect(PORTRAIT_PATHS[9]).toBe("/frames/frame-09.png");
    expect(PORTRAIT_PATHS[30]).toBe("/frames/frame-30.png");
  });

  it("能在 GitHub Pages 的仓库子路径下定位图片", () => {
    expect(getPortraitPath("/liang-intensity-calibrator/", 9)).toBe(
      "/liang-intensity-calibrator/frames/frame-09.png",
    );
  });

  it("每一级直接映射到同编号图片", () => {
    expect(getFrameIndex(0)).toBe(0);
    expect(getFrameIndex(9)).toBe(9);
    expect(getFrameIndex(30)).toBe(30);
  });

  it("越界等级会收束到首尾帧", () => {
    expect(getFrameIndex(-10)).toBe(0);
    expect(getFrameIndex(99)).toBe(30);
  });
});
