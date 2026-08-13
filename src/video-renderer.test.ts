import { describe, expect, it } from "vitest";

import { scoreToVideoTime } from "./video-renderer";

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
