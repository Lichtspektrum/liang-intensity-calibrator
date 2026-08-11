import { describe, expect, it } from "vitest";

import { positionToVideoTime } from "./video-renderer";

describe("positionToVideoTime", () => {
  it("把滑杆首、中、末位置映射到完整视频时间", () => {
    expect(positionToVideoTime(0, 8)).toBe(0);
    expect(positionToVideoTime(15, 8)).toBe(4);
    expect(positionToVideoTime(30, 8)).toBe(8);
  });

  it("限制超出滑杆范围的位置", () => {
    expect(positionToVideoTime(-5, 8)).toBe(0);
    expect(positionToVideoTime(35, 8)).toBe(8);
  });
});
