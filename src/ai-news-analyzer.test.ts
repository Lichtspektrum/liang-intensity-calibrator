import { describe, expect, it } from "vitest";
import { aggregateCalibration, type AnalyzedNewsItem } from "./ai-news-analyzer";

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
});
