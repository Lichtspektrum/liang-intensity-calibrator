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

const GITHUB_REPOSITORIES = [
  "deepseek-ai/DeepSeek-V3",
  "deepseek-ai/DeepSeek-R1",
  "huggingface/transformers",
  "openai/openai-python",
  "anthropics/anthropic-sdk-python",
] as const;

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
    .filter((item) => item.title && item.url && dateInSingapore(item.publishedAt) === date);
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
    .filter((hit) => hit.title && hit.created_at && dateInSingapore(hit.created_at) === date)
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

interface GithubRelease {
  id?: number;
  name?: string | null;
  tag_name?: string;
  body?: string | null;
  html_url?: string;
  published_at?: string | null;
}

export function parseGithubReleases(
  releases: GithubRelease[],
  repository: string,
  date: string,
): AiNewsItem[] {
  return releases
    .filter((release) => release.published_at && dateInSingapore(release.published_at) === date)
    .map((release) => ({
      id: `github:${repository}:${release.id ?? release.tag_name}`,
      title: `${repository}: ${release.name || release.tag_name || "new release"}`,
      summary: (release.body ?? "Official repository release").replace(/\s+/gu, " ").slice(0, 500),
      url: release.html_url ?? `https://github.com/${repository}/releases`,
      source: `GitHub · ${repository}`,
      sourceKind: "github" as const,
      publishedAt: release.published_at!,
    }));
}

async function fetchHackerNews(date: string, now: number): Promise<AiNewsItem[]> {
  const start = Math.floor((now - 30 * 60 * 60 * 1_000) / 1_000);
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

async function fetchGithub(repository: string, date: string): Promise<AiNewsItem[]> {
  const response = await fetch(`https://api.github.com/repos/${repository}/releases?per_page=5`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "liang-intensity-calibrator",
    },
  });
  if (!response.ok) throw new Error(`GitHub ${repository} ${response.status}`);
  return parseGithubReleases(await response.json() as GithubRelease[], repository, date);
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
    ...GITHUB_REPOSITORIES.map((repository) => ({
      source: `GitHub · ${repository}`,
      run: () => fetchGithub(repository, date),
    })),
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
