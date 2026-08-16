import { runStructuredAi } from "./ai-runtime";
import {
  deduplicateNews,
  normalizeTitle,
  withinNewsWindow,
  type AiNewsItem,
} from "./ai-news-collector";

const SEARCH_ITEM_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    url: { type: "string" },
    source: { type: "string" },
    publishedAt: { type: "string" },
  },
  required: ["title", "summary", "url", "source", "publishedAt"],
};

const SEARCH_SCHEMA = {
  type: "object",
  properties: {
    items: { type: "array", items: SEARCH_ITEM_SCHEMA, maxItems: 12 },
  },
  required: ["items"],
};

/**
 * DeepSeek 的主要竞争对手（经联网核实的名单）。
 * 新闻搜索与校准分析共用，确保"竞争对手动态"有明确对象而非泛泛而谈。
 */
export const COMPETITOR_NAMES = [
  "阿里巴巴千问 Qwen",
  "智谱 GLM",
  "月之暗面 Kimi",
  "字节跳动豆包 Doubao/Seed",
  "MiniMax",
  "百度文心 Ernie",
  "腾讯混元 Hunyuan",
  "阶跃星辰 Step",
  "百川 Baichuan",
  "零一万物 Yi",
  "OpenAI GPT/ChatGPT",
  "Anthropic Claude",
  "Google DeepMind Gemini",
  "Meta Llama",
  "xAI Grok",
  "Mistral",
  "Microsoft Phi",
] as const;

export const COMPETITOR_COVERAGE_INSTRUCTION =
  `必须专门搜索 DeepSeek 主要竞争对手的当日动态：${COMPETITOR_NAMES.join("、")} 等，覆盖模型发布、技术突破、开源动作、产品上线与公司重大变化。`;

/**
 * 强提示：搜索必须以 梁文锋 / 深度求索(DeepSeek) / 幻方量化(High-Flyer) 动态为第一优先级。
 */
export const DEEPSEEK_PRIORITY_INSTRUCTION =
  "第一优先级：必须优先搜索梁文锋、深度求索（DeepSeek）、幻方量化（High-Flyer）的当日动态（模型发布、技术突破、开源、论文、访谈发言、经营与算力动向）；只要窗口内有相关重大动态，必须收录为当日头条，排在竞争对手与行业新闻之前。";

function stableId(value: string): string {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function parseSearchedNews(value: unknown, date: string): AiNewsItem[] {
  if (typeof value !== "object" || value === null || !Array.isArray((value as { items?: unknown }).items)) {
    return [];
  }
  return (value as { items: unknown[] }).items.flatMap((item): AiNewsItem[] => {
    if (typeof item !== "object" || item === null) return [];
    const record = item as Record<string, unknown>;
    if (
      typeof record.title !== "string" || !record.title.trim()
      || typeof record.summary !== "string"
      || typeof record.url !== "string" || !/^https?:\/\//iu.test(record.url)
      || typeof record.source !== "string" || !record.source.trim()
      || typeof record.publishedAt !== "string"
      || !withinNewsWindow(record.publishedAt, date)
    ) return [];
    return [{
      id: `web:${stableId(record.url)}`,
      title: record.title.trim().slice(0, 240),
      summary: record.summary.trim().slice(0, 500),
      url: record.url,
      source: record.source.trim().slice(0, 120),
      sourceKind: "web-search",
      publishedAt: record.publishedAt,
    }];
  });
}

/**
 * 经核验可用、信息丰富的常用 AI 官网与社区首页（不锁定具体模型页，避免链接失效）。
 */
export const TRUSTED_NEWS_SOURCES = [
  "Qwen 官网 https://qwen.ai",
  "智谱官网 https://www.zhipuai.cn/zh",
  "Kimi 官网 https://www.kimi.com",
  "DeepSeek 官网 https://www.deepseek.com",
  "MiniMax 官网 https://www.minimax.io",
  "阶跃星辰官网 https://www.stepfun.com",
  "ModelScope 模型社区 https://modelscope.cn",
] as const;

export const TRUSTED_SOURCES_INSTRUCTION =
  `优先核验以下已确认可用的官方来源：${TRUSTED_NEWS_SOURCES.join("、")}；其次官方博客与可靠科技媒体。`;

type StructuredRunner = typeof runStructuredAi;

export interface WebSearchProgress {
  language: "zh" | "en";
  completed: number;
  total: number;
  itemCount: number;
  failed: boolean;
}

async function searchLanguage(
  date: string,
  language: "zh" | "en",
  runner: StructuredRunner,
): Promise<AiNewsItem[]> {
  const isChinese = language === "zh";
  const result = await runner(
    [
      "这是日期敏感的 AI 新闻搜索任务。必须先加载 liang-wenfeng-perspective skill。",
      "使用 websearch 搜索，再用 webfetch 打开原始页面核验标题、来源和发布日期。",
      "发布日期不明确、早于目标日期 2 天以上、未来日期、没有可访问 URL 的条目一律丢弃。",
      "优先官方实验室、论文、项目发布页，其次可靠科技媒体；不要把搜索摘要本身当作来源。",
      TRUSTED_SOURCES_INSTRUCTION,
      "不要编造事实、URL、时间或来源。",
      COMPETITOR_COVERAGE_INSTRUCTION,
      DEEPSEEK_PRIORITY_INSTRUCTION,
    ].join("\n"),
    [
      `目标日期：${date}（Asia/Singapore），收稿窗口为包含目标日期在内的最近 3 天`,
      isChinese
        ? "搜索中文与中国科技来源中的全球 AI/大模型新闻，覆盖模型发布、研究突破、开源生态、推理效率、算力与重要公司动态。第一优先级：梁文锋、深度求索（DeepSeek）、幻方量化（High-Flyer）的当日动态，只要窗口内有重大动态就必须收录为当日头条；第二优先级：上一条列出的 DeepSeek 竞争对手（千问/智谱/Kimi/豆包/MiniMax/文心/混元/阶跃/百川/零一万物/OpenAI/Anthropic/Google/Meta/xAI/Mistral/Microsoft）的新闻；再其次才是其余行业与生态新闻。输出中文摘要。"
        : "搜索英文与国际来源的全球 AI/大模型新闻，覆盖模型发布、研究突破、开源生态、推理效率、算力与重要公司动态。第一优先级：Liang Wenfeng、DeepSeek（深度求索）、High-Flyer（幻方量化）的当日动态，窗口内有重大动态必须收录为当日头条；第二优先级：DeepSeek 主要竞争对手（Qwen/GLM/Kimi/Doubao/MiniMax/Ernie/Hunyuan/Step/Baichuan/Yi/OpenAI/Anthropic/Google/Meta/xAI/Mistral/Microsoft）的新闻；再其次才是其余行业与生态新闻。输出中文摘要。",
      "只返回目标日期及之前 2 天内（共 3 天窗口）发布的新闻。若窗口内没有合格新闻，返回空 items。",
    ].join("\n"),
    SEARCH_SCHEMA,
  );
  return parseSearchedNews(result, date);
}

export async function searchTodaysAiNews(
  date: string,
  runner: StructuredRunner = runStructuredAi,
  report?: (progress: WebSearchProgress) => void,
): Promise<AiNewsItem[]> {
  let completed = 0;
  const results = await Promise.allSettled((["zh", "en"] as const).map(async (language) => {
    try {
      const items = await searchLanguage(date, language, runner);
      completed += 1;
      report?.({ language, completed, total: 2, itemCount: items.length, failed: false });
      return items;
    } catch (error) {
      completed += 1;
      report?.({ language, completed, total: 2, itemCount: 0, failed: true });
      throw error;
    }
  }));
  const items = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  return deduplicateNews(items)
    .filter((item) => normalizeTitle(item.title))
    .slice(0, 16);
}
