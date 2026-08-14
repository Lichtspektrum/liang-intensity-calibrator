import { describe, expect, it } from "vitest";
import { aggregateCalibration, analyzeTodaysNews, type AnalyzedNewsItem } from "./ai-news-analyzer";
import type { AiNewsItem } from "./ai-news-collector";

function item(overrides: Partial<AnalyzedNewsItem> = {}): AnalyzedNewsItem {
  return {
    id: "1",
    title: "news",
    summary: "summary",
    summaryZh: "摘要",
    url: "https://example.com",
    source: "source",
    sourceKind: "github",
    publishedAt: "2026-08-14T00:00:00Z",
    relevance: 1,
    impact: 1,
    credibility: 1,
    dimensions: { originality: 1, openness: 1, efficiency: 1, intelligence: 1, restraint: 1 },
    tags: [],
    ...overrides,
  };
}

describe("news calibration analyzer", () => {
  it("maps unanimous high-confidence Liang signals to the positive end", () => {
    const result = aggregateCalibration(Array.from({ length: 5 }, (_, index) => item({ id: String(index) })));
    expect(result.score).toBe(15);
    expect(result.dimensions.originality).toBe(1);
  });

  it("weights relevance, impact, and credibility without turning them into sentiment", () => {
    const result = aggregateCalibration([
      item({ dimensions: { originality: 1, openness: 1, efficiency: 1, intelligence: 1, restraint: 1 } }),
      item({
        id: "weak",
        relevance: 0.1,
        impact: 0.1,
        credibility: 0.1,
        dimensions: { originality: -1, openness: -1, efficiency: -1, intelligence: -1, restraint: -1 },
      }),
    ]);
    expect(result.score).toBeGreaterThan(9);
  });

  it("returns a neutral calibration when there is no weighted evidence", () => {
    expect(aggregateCalibration([item({ relevance: 0 })]).score).toBe(0);
  });

  it("anchors item signals to DeepSeek's standing instead of generic lens fit", async () => {
    const sourceItem: AiNewsItem = {
      id: "1",
      title: "DeepSeek releases a new model",
      summary: "summary",
      url: "https://example.com",
      source: "source",
      sourceKind: "github",
      publishedAt: "2026-08-14T00:00:00Z",
    };
    const calls: Array<[string, string]> = [];
    const runner = async (system: string, user: string): Promise<unknown> => {
      calls.push([system, user]);
      return {
        headline: "今日校准",
        rationale: "综合",
        items: [{
          id: "1",
          summaryZh: "DeepSeek 发布新模型。",
          relevance: 1,
          impact: 1,
          credibility: 1,
          dimensions: { originality: 1, openness: 1, efficiency: 1, intelligence: 1, restraint: 1 },
          tags: [],
        }],
      };
    };
    await analyzeTodaysNews("2026-08-14", [sourceItem], Date.now(), runner as never);
    expect(calls[0][1]).toContain("DeepSeek 自己做出大成绩");
    expect(calls[0][1]).toContain("中肯的轻度正面");
    expect(calls[0][1]).toContain("主要竞争对手");
    expect(calls[0][1]).toContain("千问");
    expect(calls[0][1]).toContain("Anthropic");
    expect(calls[0][1]).toContain("明显 KO");
    expect(calls[0][1]).not.toContain("与梁文锋公开思考框架的相关性");
  });
});
