import { describe, expect, it } from "vitest";
import {
  deduplicateNews,
  parseArxivFeed,
  parseGithubReleases,
  parseHackerNewsHits,
  type AiNewsItem,
} from "./ai-news-collector";

describe("AI news collector", () => {
  it("keeps only today's AI-related Hacker News stories", () => {
    const items = parseHackerNewsHits([
      { objectID: "1", title: "A new open source LLM", created_at: "2026-08-14T08:00:00Z", url: "https://a.test" },
      { objectID: "2", title: "A database release", created_at: "2026-08-14T08:00:00Z", url: "https://b.test" },
      { objectID: "3", title: "Old AI agent", created_at: "2026-08-12T08:00:00Z", url: "https://c.test" },
    ], "2026-08-14");
    expect(items.map((item) => item.id)).toEqual(["hn:1"]);
  });

  it("parses same-day arXiv entries and strips XML markup", () => {
    const xml = `<feed><entry><id>https://arxiv.org/abs/2608.12345</id><title> Efficient &amp; Open AI </title><summary><![CDATA[<b>Result</b> here]]></summary><published>2026-08-14T02:00:00Z</published></entry></feed>`;
    expect(parseArxivFeed(xml, "2026-08-14")).toMatchObject([{
      title: "Efficient & Open AI",
      summary: "Result here",
      source: "arXiv",
    }]);
  });

  it("uses official release metadata and deduplicates normalized titles", () => {
    const releases = parseGithubReleases([{
      id: 7,
      name: "V4",
      tag_name: "v4",
      body: "model release",
      html_url: "https://github.com/lab/model/releases/7",
      published_at: "2026-08-14T03:00:00Z",
    }], "lab/model", "2026-08-14");
    const duplicate: AiNewsItem = { ...releases[0], id: "copy", title: "lab/model — V4" };
    expect(deduplicateNews([...releases, duplicate])).toHaveLength(1);
  });
});
