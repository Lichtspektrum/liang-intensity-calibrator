import { describe, expect, it } from "vitest";

import type { ScoreResponse } from "./api/shared";
import { renderPage } from "./server-render";

const scoreData: ScoreResponse = {
  score: 7.5,
  stage: "梁圣",
  positiveCount: 2,
  negativeCount: 1,
  neutralCount: 0,
  positivePoints: 15,
  negativePoints: -3,
  isColdStart: true,
  recentEvents: [],
};

describe("renderPage", () => {
  it("注入对应分值首帧和客户端初始状态", () => {
    const result = renderPage(
      "<html><head></head><body><main id=\"app\"></main></body></html>",
      scoreData,
    );

    expect(result).toContain('href="/frames/frame-23.webp"');
    expect(result).toContain('src="/frames/frame-23.webp"');
    expect(result).toContain('id="liang-initial-state"');
    expect(result).toContain('"score":7.5');
  });

  it("转义状态中的 HTML 起始字符", () => {
    const result = renderPage(
      "<html><head></head><body><main id=\"app\"></main></body></html>",
      {
        ...scoreData,
        recentEvents: [{
          id: 1,
          date: "2026-08-14",
          title: "</script><script>alert(1)</script>",
          summary: null,
          isMajor: false,
        }],
      },
    );

    expect(result).not.toContain("</script><script>alert");
    expect(result).toContain("\\u003c/script>");
  });
});
