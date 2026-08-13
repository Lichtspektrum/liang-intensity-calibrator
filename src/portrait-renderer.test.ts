import { describe, expect, it } from "vitest";

import { getFrameIndex, PORTRAIT_PATHS } from "./portrait-renderer";

describe("portrait renderer state", () => {
  it("为 31 个等级提供同编号图片路径", () => {
    expect(PORTRAIT_PATHS).toHaveLength(31);
    expect(PORTRAIT_PATHS[0]).toBe("/frames/frame-00.png");
    expect(PORTRAIT_PATHS[18]).toBe("/frames/frame-18.png");
    expect(PORTRAIT_PATHS[30]).toBe("/frames/frame-30.png");
  });

  it("按页面语义等级选择唯一对应帧", () => {
    expect(getFrameIndex(-15)).toBe(0);
    expect(getFrameIndex(0)).toBe(15);
    expect(getFrameIndex(2.5)).toBe(18);
    expect(getFrameIndex(15)).toBe(30);
  });

  it("越界位置收束到首尾帧", () => {
    expect(getFrameIndex(-20)).toBe(0);
    expect(getFrameIndex(99)).toBe(30);
  });
});
