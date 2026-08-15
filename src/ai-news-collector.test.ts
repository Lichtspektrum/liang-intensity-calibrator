import { describe, expect, it } from "vitest";
import {
  deduplicateNews,
  parseArxivFeed,
  parseGithubSearchHits,
  parseHackerNewsHits,
  type AiNewsItem,
} from "./ai-news-collector";

describe("AI news collector", () => {
  it("keeps AI stories within the 3-day window and drops older ones", () => {
    const items = parseHackerNewsHits([
      { objectID: "1", title: "A new open source LLM", created_at: "2026-08-14T08:00:00Z", url: "https://a.test" },
      { objectID: "2", title: "A database release", created_at: "2026-08-14T08:00:00Z", url: "https://b.test" },
      { objectID: "3", title: "AI agent from two days ago", created_at: "2026-08-12T08:00:00Z", url: "https://c.test" },
      { objectID: "4", title: "AI agent from four days ago", created_at: "2026-08-10T08:00:00Z", url: "https://d.test" },
    ], "2026-08-14");
    expect(items.map((item) => item.id)).toEqual(["hn:1", "hn:3"]);
  });

  it("parses arXiv entries within the 3-day window and strips XML markup", () => {
    const xml = `<feed><entry><id>https://arxiv.org/abs/2608.12345</id><title> Efficient &amp; Open AI </title><summary><![CDATA[<b>Result</b> here]]></summary><published>2026-08-14T02:00:00Z</published></entry>
    <entry><id>https://arxiv.org/abs/2608.11111</id><title> Two-day-old paper </title><summary>Still in window</summary><published>2026-08-12T02:00:00Z</published></entry></feed>`;
    const items = parseArxivFeed(xml, "2026-08-14");
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ title: "Efficient & Open AI", summary: "Result here", source: "arXiv" });
    expect(items[1]).toMatchObject({ title: "Two-day-old paper" });
  });

  it("keeps GitHub search hits within 3 days and deduplicates normalized titles", () => {
    const hits = parseGithubSearchHits([
      {
        full_name: "deepseek-ai/DeepSeek-V3.2-Exp",
        html_url: "https://github.com/deepseek-ai/DeepSeek-V3.2-Exp",
        description: "New experimental model release",
        created_at: "2026-08-14T03:00:00Z",
      },
      {
        full_name: "lab/repo-from-2-days-ago",
        html_url: "https://github.com/lab/repo-from-2-days-ago",
        description: "AI tool",
        created_at: "2026-08-12T03:00:00Z",
      },
      {
        full_name: "lab/old-tool",
        html_url: "https://github.com/lab/old-tool",
        description: "some tool",
        created_at: "2026-08-10T03:00:00Z",
      },
    ], "2026-08-14");
    expect(hits.map((item) => item.id)).toEqual([
      "github:deepseek-ai/DeepSeek-V3.2-Exp",
      "github:lab/repo-from-2-days-ago",
    ]);
    expect(hits[0].title).toContain("DeepSeek-V3.2-Exp");
    expect(hits[0].sourceKind).toBe("github");
    const duplicate: AiNewsItem = { ...hits[0], id: "copy", title: `${hits[0].title} ` };
    expect(deduplicateNews([...hits, duplicate])).toHaveLength(2);
  });
});
