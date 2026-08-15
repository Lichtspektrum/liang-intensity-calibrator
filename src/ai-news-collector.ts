export type NewsSourceKind = "hacker-news" | "arxiv" | "github" | "web-search";

export interface AiNewsItem {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  sourceKind: NewsSourceKind;
  publishedAt: string;
}

export interface DirectSourceProgress {
  source: string;
  completed: number;
  total: number;
  itemCount: number;
  failed: boolean;
}

export type DirectSourceReporter = (progress: DirectSourceProgress) => void;

const AI_KEYWORDS = [
  " ai ", "artificial intelligence", "llm", "language model", "foundation model",
  "agent", "reasoning model", "machine learning", "deep learning", "transformer",
  "openai", "anthropic", "deepseek", "gemini", "qwen", "claude", "chatgpt",
  "mistral", "hugging face", "inference", "multimodal", "reinforcement learning",
];

export function dateInSingapore(timestamp: string | number): string {
  const value = typeof timestamp === "number" ? timestamp : Date.parse(timestamp);
  if (!Number.isFinite(value)) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

/** 目标日期往前数 days 天的日期（ISO yyyy-mm-dd）。 */
export function dateBefore(date: string, days: number): string {
  const millis = Date.parse(`${date}T00:00:00Z`) - days * 86_400_000;
  return new Date(millis).toISOString().slice(0, 10);
}

/**
 * 判断条目的发布日期是否落在目标日期（含）往前 days-1 天（默认共 3 天窗口）内。
 * 用于把"只收当天"放宽为"近 3 天"。
 */
export function withinNewsWindow(
  publishedAt: string | number,
  targetDate: string,
  days = 3,
): boolean {
  const itemDate = dateInSingapore(publishedAt);
  if (!itemDate) return false;
  return itemDate >= dateBefore(targetDate, days - 1) && itemDate <= targetDate;
}

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function looksLikeAiNews(title: string): boolean {
  const normalized = ` ${normalizeTitle(title)} `;
  return AI_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gu, "$1")
    .replace(/<[^>]+>/gu, " ")
    .replace(/&amp;/gu, "&")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&quot;/gu, '"')
    .replace(/&#39;/gu, "'")
    .replace(/\s+/gu, " ")
    .trim();
}

function tag(entry: string, name: string): string {
  return decodeXml(entry.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "iu"))?.[1] ?? "");
}

export function parseArxivFeed(xml: string, date: string): AiNewsItem[] {
  return Array.from(xml.matchAll(/<entry>([\s\S]*?)<\/entry>/giu), (match) => match[1])
    .map((entry) => {
      const url = entry.match(/<id>([^<]+)<\/id>/iu)?.[1]?.trim() ?? "";
      const publishedAt = tag(entry, "published");
      return {
        id: `arxiv:${url.split("/").at(-1) ?? url}`,
        title: tag(entry, "title"),
        summary: tag(entry, "summary").slice(0, 500),
        url,
        source: "arXiv",
        sourceKind: "arxiv" as const,
        publishedAt,
      };
    })
    .filter((item) => item.title && item.url && withinNewsWindow(item.publishedAt, date));
}

interface HackerNewsHit {
  objectID?: string;
  title?: string;
  story_text?: string | null;
  url?: string | null;
  created_at?: string;
}

export function parseHackerNewsHits(hits: HackerNewsHit[], date: string): AiNewsItem[] {
  return hits
    .filter((hit) => hit.title && hit.created_at && withinNewsWindow(hit.created_at, date))
    .filter((hit) => looksLikeAiNews(hit.title!))
    .map((hit) => ({
      id: `hn:${hit.objectID ?? normalizeTitle(hit.title!)}`,
      title: hit.title!,
      summary: (hit.story_text ?? "Hacker News discussion").replace(/<[^>]+>/gu, " ").slice(0, 500),
      url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
      source: "Hacker News",
      sourceKind: "hacker-news" as const,
      publishedAt: hit.created_at!,
    }));
}

interface GithubRepoSearchHit {
  full_name?: string;
  html_url?: string;
  description?: string | null;
  created_at?: string;
}

export function parseGithubSearchHits(hits: GithubRepoSearchHit[], date: string): AiNewsItem[] {
  return hits
    .filter((hit) => hit.full_name && hit.created_at && withinNewsWindow(hit.created_at, date))
    .map((hit) => {
      const name = hit.full_name!;
      const description = (hit.description ?? "").replace(/\s+/gu, " ").trim().slice(0, 140);
      return {
        id: `github:${name}`,
        title: description ? `${name}：${description}` : `${name} · new repository`,
        summary: description || "New AI repository on GitHub",
        url: hit.html_url ?? `https://github.com/${name}`,
        source: `GitHub · ${name}`,
        sourceKind: "github" as const,
        publishedAt: hit.created_at!,
      };
    });
}

async function fetchHackerNews(date: string, now: number): Promise<AiNewsItem[]> {
  // 3 天窗口：多取几天，再由 withinNewsWindow 精确过滤。
  const start = Math.floor((now - 3 * 24 * 60 * 60 * 1_000) / 1_000);
  const url = new URL("https://hn.algolia.com/api/v1/search_by_date");
  url.searchParams.set("tags", "story");
  url.searchParams.set("numericFilters", `created_at_i>${start}`);
  url.searchParams.set("hitsPerPage", "100");
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Hacker News ${response.status}`);
  const body = await response.json() as { hits?: HackerNewsHit[] };
  return parseHackerNewsHits(body.hits ?? [], date);
}

async function fetchArxiv(date: string): Promise<AiNewsItem[]> {
  const query = encodeURIComponent("cat:cs.AI OR cat:cs.CL OR cat:cs.LG");
  const response = await fetch(
    `https://export.arxiv.org/api/query?search_query=${query}&start=0&max_results=30&sortBy=submittedDate&sortOrder=descending`,
    { headers: { Accept: "application/atom+xml" } },
  );
  if (!response.ok) throw new Error(`arXiv ${response.status}`);
  return parseArxivFeed(await response.text(), date);
}

const GITHUB_SEARCH_QUERIES: ReadonlyArray<(from: string) => string> = [
  (from) => `org:deepseek-ai created:>=${from}`,
  (from) => `topic:llm stars:>=20 created:>=${from}`,
  (from) => `topic:deepseek stars:>=20 created:>=${from}`,
];

async function searchGithub(date: string): Promise<AiNewsItem[]> {
  const from = dateBefore(date, 2);
  const results = await Promise.allSettled(GITHUB_SEARCH_QUERIES.map(async (buildQuery) => {
    const url = new URL("https://api.github.com/search/repositories");
    url.searchParams.set("q", buildQuery(from));
    url.searchParams.set("sort", "updated");
    url.searchParams.set("order", "desc");
    url.searchParams.set("per_page", "10");
    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "liang-intensity-calibrator",
      },
    });
    if (response.status === 403 || response.status === 429) return [];
    if (!response.ok) throw new Error(`GitHub search ${response.status}`);
    const body = await response.json() as { items?: GithubRepoSearchHit[] };
    return parseGithubSearchHits(body.items ?? [], date);
  }));
  return results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
}

export function deduplicateNews(items: AiNewsItem[]): AiNewsItem[] {
  const seen = new Set<string>();
  return items
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .filter((item) => {
      const key = normalizeTitle(item.title);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export async function collectTodaysAiNews(
  date: string,
  now = Date.now(),
  report?: DirectSourceReporter,
): Promise<AiNewsItem[]> {
  const sources = [
    { source: "Hacker News", run: () => fetchHackerNews(date, now) },
    { source: "arXiv", run: () => fetchArxiv(date) },
    { source: "GitHub 搜索", run: () => searchGithub(date) },
  ];
  let completed = 0;
  const results = await Promise.allSettled(sources.map(async ({ source, run }) => {
    try {
      const items = await run();
      completed += 1;
      report?.({ source, completed, total: sources.length, itemCount: items.length, failed: false });
      return items;
    } catch (error) {
      completed += 1;
      report?.({ source, completed, total: sources.length, itemCount: 0, failed: true });
      throw error;
    }
  }));
  const items = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  return deduplicateNews(items).slice(0, 24);
}
