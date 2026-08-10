import { describe, expect, it } from "vitest";

import { getProgression } from "./progression";

describe("getProgression", () => {
  it("把 0 级映射到小难梁与第一段起点", () => {
    expect(getProgression(0)).toMatchObject({
      level: 0,
      stage: "小难梁",
      fromIndex: 0,
      toIndex: 1,
      localProgress: 0,
    });
  });

  it("让每个命名节点之间保留五个中间等级", () => {
    expect(getProgression(5)).toMatchObject({
      stage: "小难梁",
      fromIndex: 0,
      toIndex: 1,
    });
    expect(getProgression(6)).toMatchObject({
      stage: "牢梁",
      fromIndex: 1,
      toIndex: 2,
      localProgress: 0,
    });
  });

  it("把 30 级固定到梁祖终点", () => {
    expect(getProgression(30)).toMatchObject({
      level: 30,
      stage: "梁祖",
      fromIndex: 5,
      toIndex: 5,
      localProgress: 0,
    });
  });

  it("限制超出范围的输入", () => {
    expect(getProgression(-3).level).toBe(0);
    expect(getProgression(40).level).toBe(30);
  });
});
