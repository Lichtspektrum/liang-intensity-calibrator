import type { Env } from "../api/shared";

const TARGET_KEYWORDS = ["梁文峰", "DeepSeek", "深度求索", "deepseek", "梁文锋"];

interface NewsItem {
  title: string;
  url: string;
  source: string;
  snippet?: string;
  publishedAt?: string;
}

interface AnalyzedNews extends NewsItem {
  relevant: boolean;
  polarity: number;
  impact: number;
  summary: string;
  tags: string[];
}

async function fetchGitHubReleases(): Promise<NewsItem[]> {
  try {
    const repos = ["deepseek-ai/DeepSeek-V3", "deepseek-ai/DeepSeek-R1", "deepseek-ai/DeepSeek-Coder"];
    const items: NewsItem[] = [];
    for (const repo of repos) {
      try {
        const resp = await fetch(`https://api.github.com/repos/${repo}/releases?per_page=5`, {
          headers: { "User-Agent": "liang-slider" },
        });
        if (!resp.ok) continue;
        const releases = (await resp.json()) as Array<{
          name: string;
          html_url: string;
          published_at: string;
          body?: string;
        }>;
        for (const r of releases) {
          items.push({
            title: `[GitHub Release] ${repo}: ${r.name || "New release"}`,
            url: r.html_url,
            source: "github",
            snippet: r.body?.slice(0, 500),
            publishedAt: r.published_at,
          });
        }
      } catch {
        // Skip failed sources
      }
    }
    return items;
  } catch {
    return [];
  }
}

async function fetchRSSFeeds(): Promise<NewsItem[]> {
  const feeds = [
    { url: "https://www.36kr.com/feed", source: "36kr" },
    { url: "https://www.jiqizhixin.com/rss", source: "jiqizhixin" },
  ];
  const items: NewsItem[] = [];
  for (const feed of feeds) {
    try {
      const resp = await fetch(feed.url, { headers: { "User-Agent": "liang-slider/1.0" } });
      if (!resp.ok) continue;
      const text = await resp.text();
      const itemMatches = text.matchAll(/<item>[\s\S]*?<\/item>/g);
      for (const match of itemMatches) {
        const titleMatch = match[0].match(/<title><!\[CDATA\[([^\]]+)\]\]><\/title>|<title>([^<]+)<\/title>/);
        const linkMatch = match[0].match(/<link>([^<]+)<\/link>/);
        const descMatch = match[0].match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>|<description>([^<]+)<\/description>/);
        const dateMatch = match[0].match(/<pubDate>([^<]+)<\/pubDate>/);
        if (titleMatch && linkMatch) {
          const title = titleMatch[1] || titleMatch[2] || "";
          const isRelevant = TARGET_KEYWORDS.some((kw) => title.toLowerCase().includes(kw.toLowerCase()));
          if (isRelevant) {
            items.push({
              title: `[${feed.source}] ${title.trim()}`,
              url: linkMatch[1],
              source: feed.source,
              snippet: (descMatch ? (descMatch[1] || descMatch[2] || "").replace(/<[^>]+>/g, "").slice(0, 500) : ""),
              publishedAt: dateMatch?.[1],
            });
          }
        }
      }
    } catch {
      // Skip failed feeds
    }
  }
  return items;
}

async function collectNews(): Promise<NewsItem[]> {
  const results = await Promise.allSettled([fetchGitHubReleases(), fetchRSSFeeds()]);
  const items: NewsItem[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      items.push(...result.value);
    }
  }
  return items;
}

async function isUrlProcessed(env: Env, url: string): Promise<boolean> {
  const key = `news:url:${await hashUrl(url)}`;
  return (await env.KV.get(key)) !== null;
}

async function markUrlProcessed(env: Env, url: string): Promise<void> {
  const key = `news:url:${await hashUrl(url)}`;
  await env.KV.put(key, "1", { expirationTtl: 7 * 24 * 60 * 60 });
}

async function hashUrl(url: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(url);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function analyzeWithAI(env: Env, items: NewsItem[]): Promise<AnalyzedNews[]> {
  if (!env.AI || items.length === 0) return items.map((i) => ({ ...i, relevant: false, polarity: 0, impact: 0, summary: "", tags: [] }));

  const newsText = items
    .map((item, i) => `${i}. [${item.source}] ${item.title}\n${item.snippet || ""}`)
    .join("\n\n");

  const systemPrompt = `你是一个中文科技新闻分析助手。给定一组新闻标题和摘要，判断每条新闻是否与梁文峰（DeepSeek 创始人）或 DeepSeek 公司直接相关。
对于相关新闻，评估：
1. polarity: 情感极性，-1（极强负面）到 +1（极强正面）。
   - 极强正面(>0.7)：突破性模型发布、性能超越 SOTA、重大开源
   - 正面(0.3~0.7)：正常版本更新、正面媒体报道、用户好评
   - 中性(-0.3~0.3)：常规公告、行业评论，不直接影响梁形象
   - 负面(-0.7~-0.3)：产品事故、服务宕机、跳票、争议
   - 极强负面(<-0.7)：重大安全事故、严重舆论危机
2. impact: 影响力 0~1，越大表示影响越广。重大产品发布=0.8+, 常规更新=0.3-0.5, 小新闻<0.3
3. summary: 15字以内的简短中文摘要，用于时间线标记
4. tags: 标签数组，如["版本发布","技术突破","产品事故"]

以 JSON 数组格式返回，每个元素对应输入的一条新闻：[{"index":0,"relevant":true,"polarity":0.8,"impact":0.7,"summary":"...","tags":["..."]}]`;

  try {
    const response = await (env.AI as any).run("@cf/qwen/qwen1.5-7b-chat-awq", {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: newsText },
      ],
      stream: false,
    });

    const result = response as { response?: string };
    const text = result.response || "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return items.map((i) => ({ ...i, relevant: false, polarity: 0, impact: 0, summary: "", tags: [] }));
    }
    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      index: number;
      relevant: boolean;
      polarity: number;
      impact: number;
      summary: string;
      tags: string[];
    }>;
    return items.map((item, i) => {
      const analysis = parsed.find((p) => p.index === i);
      if (!analysis) {
        return { ...item, relevant: false, polarity: 0, impact: 0, summary: "", tags: [] };
      }
      return {
        ...item,
        relevant: analysis.relevant,
        polarity: Math.max(-1, Math.min(1, analysis.polarity)),
        impact: Math.max(0, Math.min(1, analysis.impact)),
        summary: analysis.summary || item.title.slice(0, 20),
        tags: analysis.tags || [],
      };
    });
  } catch {
    return items.map((i) => ({ ...i, relevant: keywordRelevant(i.title + (i.snippet || "")), polarity: 0, impact: 0.3, summary: i.title.slice(0, 20), tags: [] }));
  }
}

function keywordRelevant(text: string): boolean {
  return TARGET_KEYWORDS.some((kw) => text.toLowerCase().includes(kw.toLowerCase()));
}

function todayInBeijing(): string {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const beijing = new Date(utc + 8 * 3600000);
  return beijing.toISOString().slice(0, 10);
}

function clusterNews(news: AnalyzedNews[]): AnalyzedNews[][] {
  const clusters: AnalyzedNews[][] = [];
  const used = new Set<number>();
  for (let i = 0; i < news.length; i++) {
    if (used.has(i)) continue;
    const cluster = [news[i]];
    used.add(i);
    const words = new Set(news[i].title.replace(/[\[\]()（）【】:：,，.。!！?？\s]/g, "").slice(0, 10).split(""));
    for (let j = i + 1; j < news.length; j++) {
      if (used.has(j)) continue;
      const jWords = news[j].title.replace(/[\[\]()（）【】:：,，.。!！?？\s]/g, "").slice(0, 10).split("");
      const overlap = jWords.filter((w) => words.has(w)).length;
      if (overlap >= 4) {
        cluster.push(news[j]);
        used.add(j);
      }
    }
    clusters.push(cluster);
  }
  return clusters;
}

export async function runNewsCollection(env: Env): Promise<void> {
  const rawItems = await collectNews();

  const newItems: NewsItem[] = [];
  for (const item of rawItems) {
    if (!(await isUrlProcessed(env, item.url))) {
      newItems.push(item);
      await markUrlProcessed(env, item.url);
    }
  }

  if (newItems.length === 0) return;

  const analyzed = await analyzeWithAI(env, newItems);
  const relevant = analyzed.filter((a) => a.relevant);
  const clusters = clusterNews(relevant);
  const today = todayInBeijing();
  const now = Date.now();

  for (const cluster of clusters) {
    const avgPolarity = cluster.reduce((s, c) => s + c.polarity, 0) / cluster.length;
    const maxImpact = Math.min(1, Math.max(...cluster.map((c) => c.impact)) * (1 + (cluster.length - 1) * 0.2));
    const primary = cluster[0];
    const urls = JSON.stringify(cluster.map((c) => c.url));
    const sources = JSON.stringify(cluster.map((c) => c.source));
    const heat = Math.min(1, cluster.length * 0.3);
    const isMajor = maxImpact > 0.5;

    await env.DB
      .prepare(
        `INSERT INTO news_events (date, title, summary, polarity, impact, source_urls, sources, heat, is_major, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        today,
        primary.title,
        primary.summary,
        avgPolarity,
        maxImpact,
        urls,
        sources,
        heat,
        isMajor ? 1 : 0,
        now,
      )
      .run();
  }

}
