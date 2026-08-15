import { describe, expect, it, vi } from "vitest";
import { parseSearchedNews, searchTodaysAiNews, TRUSTED_NEWS_SOURCES } from "./ai-news-search";

describe("OpenCode AI news search", () => {
  it("keeps verified HTTP results within the 3-day window and drops older ones", () => {
    const result = parseSearchedNews({ items: [
      { title: "New model", summary: "Released", url: "https://lab.example/release", source: "Lab", publishedAt: "2026-08-14T02:00:00Z" },
      { title: "Two-day-old model", summary: "Still fresh", url: "https://lab.example/fresh", source: "Lab", publishedAt: "2026-08-12T02:00:00Z" },
      { title: "Old model", summary: "Too old", url: "https://lab.example/old", source: "Lab", publishedAt: "2026-08-10T02:00:00Z" },
      { title: "Invented", summary: "Bad URL", url: "javascript:alert(1)", source: "Unknown", publishedAt: "2026-08-14T02:00:00Z" },
    ] }, "2026-08-14");
    expect(result).toHaveLength(2);
    expect(result.map((item) => item.sourceKind)).toEqual(["web-search", "web-search"]);
    expect(result[0]).toMatchObject({ sourceKind: "web-search", title: "New model" });
  });

  it("fans out bilingual searches and deterministically deduplicates", async () => {
    const runner = vi.fn()
      .mockResolvedValueOnce({ items: [{ title: "AI Release", summary: "中文", url: "https://a.example", source: "A", publishedAt: "2026-08-14T01:00:00Z" }] })
      .mockResolvedValueOnce({ items: [{ title: "AI—Release", summary: "English", url: "https://b.example", source: "B", publishedAt: "2026-08-14T02:00:00Z" }] });
    const items = await searchTodaysAiNews("2026-08-14", runner);
    expect(runner).toHaveBeenCalledTimes(2);
    expect(items).toHaveLength(1);
    expect(runner.mock.calls.map((call) => call[0]).join(" ")).toContain("websearch");
  });

  it("instructs both languages to search DeepSeek competitor news explicitly", async () => {
    const runner = vi.fn()
      .mockResolvedValue({ items: [] });
    await searchTodaysAiNews("2026-08-14", runner);
    const prompts = runner.mock.calls.map((call) => `${call[0]}\n${call[1]}`).join("\n");
    expect(prompts).toContain("专门搜索 DeepSeek 主要竞争对手");
    expect(prompts).toContain("千问");
    expect(prompts).toContain("智谱");
    expect(prompts).toContain("Anthropic");
    expect(prompts).toContain("OpenAI");
  });

  it("instructs a 3-day window and lists the verified official sources", async () => {
    const runner = vi.fn().mockResolvedValue({ items: [] });
    await searchTodaysAiNews("2026-08-14", runner);
    const prompts = runner.mock.calls.map((call) => `${call[0]}\n${call[1]}`).join("\n");
    expect(prompts).toContain("共 3 天窗口");
    expect(prompts).toContain("最近 3 天");
    for (const source of TRUSTED_NEWS_SOURCES) {
      expect(prompts).toContain(source.split(" ")[0]);
    }
    expect(prompts).toContain("qwen.ai");
    expect(prompts).toContain("zhipuai.cn");
    expect(prompts).toContain("kimi.com");
    expect(prompts).toContain("deepseek.com");
    expect(prompts).toContain("minimax.io");
    expect(prompts).toContain("stepfun.com");
    expect(prompts).toContain("modelscope.cn");
  });
});
