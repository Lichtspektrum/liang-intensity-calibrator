import { describeScore } from "./score-domain";
import {
  LIANG_PROFILE,
  ORIGINAL_MEETING_ARTICLE,
  TIMESTAMPED_TRANSCRIPT,
  dimensionSignal,
  selectTranscriptQuote,
  type CalibrationDimensions,
  type TranscriptQuote,
} from "./liang-profile";
import type { AiNewsItem } from "./ai-news-collector";
import { COMPETITOR_NAMES } from "./ai-news-search";
import type { PricingSignalResult } from "./pricing-signal";
import type { ModelRankingSignalResult } from "./model-ranking-signal";
import { runStructuredAi } from "./ai-runtime";

export interface AnalyzedNewsItem extends AiNewsItem {
  summaryZh: string;
  relevance: number;
  impact: number;
  credibility: number;
  dimensions: CalibrationDimensions;
  tags: string[];
}

export interface NewsCalibration {
  date: string;
  /** 版本：quick 只含规则信号，deep 为全量管道 */
  variant?: "quick" | "deep";
  score: number;
  stage: string;
  headline: string;
  rationale: string;
  dimensions: CalibrationDimensions;
  quote: TranscriptQuote;
  quoteSource: string;
  transcriptSource: string;
  sourceCaveat: string;
  items: AnalyzedNewsItem[];
  collectedAt: number;
  /** 定价与缓存独立信号（opencode.ai/data 规则源），与新闻分相加后 clamp 到 ±15 */
  pricing?: PricingSignalResult;
  /** DeepSeek 最强模型排名独立信号（artificialanalysis.ai 规则源） */
  ranking?: ModelRankingSignalResult;
}

const DIMENSION_KEYS: (keyof CalibrationDimensions)[] = [
  "originality", "openness", "efficiency", "intelligence", "restraint",
];

const ITEM_SCHEMA = {
  type: "object",
  properties: {
    id: { type: "string" },
    summaryZh: { type: "string" },
    relevance: { type: "number", minimum: 0, maximum: 1 },
    impact: { type: "number", minimum: 0, maximum: 1 },
    credibility: { type: "number", minimum: 0, maximum: 1 },
    dimensions: {
      type: "object",
      properties: Object.fromEntries(DIMENSION_KEYS.map((key) => [key, {
        type: "number", minimum: -1, maximum: 1,
      }])),
      required: DIMENSION_KEYS,
    },
    tags: { type: "array", items: { type: "string" }, maxItems: 4 },
  },
  required: ["id", "summaryZh", "relevance", "impact", "credibility", "dimensions", "tags"],
};

const NEWS_SCHEMA = {
  type: "object",
  properties: {
    headline: { type: "string" },
    rationale: { type: "string" },
    items: { type: "array", items: ITEM_SCHEMA },
  },
  required: ["headline", "rationale", "items"],
};

function finiteUnit(value: unknown, min = -1): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= 1
    ? value
    : null;
}

function parseDimensions(value: unknown): CalibrationDimensions | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const dimensions = {} as CalibrationDimensions;
  for (const key of DIMENSION_KEYS) {
    const parsed = finiteUnit(record[key]);
    if (parsed === null) return null;
    dimensions[key] = parsed;
  }
  return dimensions;
}

interface ModelNewsItem {
  id: string;
  summaryZh: string;
  relevance: number;
  impact: number;
  credibility: number;
  dimensions: CalibrationDimensions;
  tags: string[];
}

function parseModelItems(value: unknown, source: AiNewsItem[]): ModelNewsItem[] {
  if (!Array.isArray(value)) return [];
  const validIds = new Set(source.map((item) => item.id));
  return value.flatMap((item): ModelNewsItem[] => {
    if (typeof item !== "object" || item === null) return [];
    const record = item as Record<string, unknown>;
    const dimensions = parseDimensions(record.dimensions);
    const relevance = finiteUnit(record.relevance, 0);
    const impact = finiteUnit(record.impact, 0);
    const credibility = finiteUnit(record.credibility, 0);
    if (
      typeof record.id !== "string" || !validIds.has(record.id)
      || typeof record.summaryZh !== "string" || !record.summaryZh.trim()
      || relevance === null || impact === null || credibility === null || !dimensions
    ) return [];
    return [{
      id: record.id,
      summaryZh: record.summaryZh.slice(0, 180),
      relevance,
      impact,
      credibility,
      dimensions,
      tags: Array.isArray(record.tags)
        ? record.tags.filter((tag): tag is string => typeof tag === "string").slice(0, 4)
        : [],
    }];
  });
}

export function aggregateCalibration(items: AnalyzedNewsItem[]): {
  score: number;
  dimensions: CalibrationDimensions;
} {
  const dimensions = Object.fromEntries(DIMENSION_KEYS.map((key) => [key, 0])) as unknown as CalibrationDimensions;
  let totalWeight = 0;
  let signal = 0;
  for (const item of items) {
    const weight = item.relevance * item.credibility * (0.25 + 0.75 * item.impact);
    if (weight <= 0) continue;
    totalWeight += weight;
    signal += dimensionSignal(item.dimensions) * weight;
    for (const key of DIMENSION_KEYS) dimensions[key] += item.dimensions[key] * weight;
  }
  if (totalWeight === 0) return { score: 0, dimensions };
  for (const key of DIMENSION_KEYS) dimensions[key] /= totalWeight;
  const volumeConfidence = 0.65 + 0.35 * Math.min(1, Math.log2(items.length + 1) / Math.log2(6));
  const score = Math.max(-15, Math.min(15, Math.round(signal / totalWeight * 15 * volumeConfidence * 10) / 10));
  return { score, dimensions };
}

export async function analyzeTodaysNews(
  date: string,
  sourceItems: AiNewsItem[],
  collectedAt = Date.now(),
  runner = runStructuredAi,
  onActivity?: (detail: string) => void,
): Promise<NewsCalibration> {
  if (sourceItems.length === 0) {
    const dimensions: CalibrationDimensions = {
      originality: 0, openness: 0, efficiency: 0, intelligence: 0, restraint: 0,
    };
    return {
      date,
      score: 0,
      stage: describeScore(0).stage,
      headline: "今天还没有足够的 AI 新闻信号",
      rationale: "严格限定今天发布的来源后，没有收集到足以校准的条目。分数保持中性，不用旧闻填空。",
      dimensions,
      quote: selectTranscriptQuote(dimensions),
      quoteSource: ORIGINAL_MEETING_ARTICLE,
      transcriptSource: TIMESTAMPED_TRANSCRIPT,
      sourceCaveat: "语录文字由录音转写并经 AI 整理，非官方来源。",
      items: [],
      collectedAt,
    };
  }

  const compactItems = sourceItems.slice(0, 14).map(({ id, title, summary, source, publishedAt }) => ({
    id, title, summary, source, publishedAt,
  }));
  const result = await runner(
    `${LIANG_PROFILE}\n\n你现在只做新闻证据分析，不模仿人物口吻。不得补充输入中没有的事实。`,
    `分析 ${date}（含此前 2 天窗口，共 3 天）的 AI 新闻。对每条评估：与梁文锋/DeepSeek 处境的相关性、行业影响、来源可信度，以及五个方向的信号（-1 强烈负面，0 无信号，1 强烈正面）：原创贡献、开放生态、成本效率、智能主线、战略克制。信号打分锚点：DeepSeek 自己做出大成绩（新模型发布、技术突破、取得成就）→ 强烈正面，推动总分飙升；有利于 AI 整体发展但既非 DeepSeek 也非其竞争对手的成就（行业性进展、开源生态、通用技术）→ 中肯的轻度正面；DeepSeek 自己拉了（失误、倒退、出问题）→ 负面；被主要竞争对手（${COMPETITOR_NAMES.join("、")}）明显 KO，或竞争对手发布更强模型/重大突破直接挤压 DeepSeek 处境 → 负面；与 DeepSeek 处境无关 → 0。\n\n新闻：${JSON.stringify(compactItems)}`,
    NEWS_SCHEMA,
    { onActivity },
  );
  if (typeof result !== "object" || result === null) throw new Error("invalid AI news response");
  const record = result as Record<string, unknown>;
  const modeled = parseModelItems(record.items, sourceItems);
  const byId = new Map(sourceItems.map((item) => [item.id, item]));
  const items = modeled.map((item) => ({ ...byId.get(item.id)!, ...item }));
  if (items.length === 0) throw new Error("AI news response contained no valid items");
  const aggregate = aggregateCalibration(items);
  return {
    date,
    score: aggregate.score,
    stage: describeScore(aggregate.score).stage,
    headline: typeof record.headline === "string" ? record.headline.slice(0, 120) : "今日 AI 新闻校准",
    rationale: typeof record.rationale === "string" ? record.rationale.slice(0, 500) : "根据今日新闻的五项信号综合计算。",
    dimensions: aggregate.dimensions,
    quote: selectTranscriptQuote(aggregate.dimensions),
    quoteSource: ORIGINAL_MEETING_ARTICLE,
    transcriptSource: TIMESTAMPED_TRANSCRIPT,
    sourceCaveat: "时间戳版由录音 ASR/AI 整理，非官方来源。",
    items,
    collectedAt,
  };
}
