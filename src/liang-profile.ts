export interface CalibrationDimensions {
  originality: number;
  openness: number;
  efficiency: number;
  intelligence: number;
  restraint: number;
}

export interface TranscriptQuote {
  id: string;
  dimension: keyof CalibrationDimensions | "neutral";
  text: string;
  timestamp: string;
}

export const ORIGINAL_MEETING_ARTICLE =
  "https://mp.weixin.qq.com/s/AWsSjcT9NYbj1W8SWXgb_w";
export const TIMESTAMPED_TRANSCRIPT =
  "https://github.com/iamsophie/deepseek-liang-wenfeng-investor-meeting";

// Short excerpts only. The source is an unofficial ASR/AI-edited transcript and
// must never be presented as a DeepSeek-confirmed verbatim record.
export const TRANSCRIPT_QUOTES: readonly TranscriptQuote[] = [
  {
    id: "restraint",
    dimension: "restraint",
    text: "你越克制，可能就越容易做成。",
    timestamp: "00:11:49",
  },
  {
    id: "efficiency",
    dimension: "efficiency",
    text: "我们会优先考虑成本效率。",
    timestamp: "02:21:31",
  },
  {
    id: "intelligence",
    dimension: "intelligence",
    text: "我们真正关心的，其实是 AGI 的路线图。",
    timestamp: "00:51:02",
  },
] as const;

export const LIANG_PROFILE = `
这是一个基于公开材料提炼的“梁文锋思考框架模拟”，不是梁文锋本人，也不代表梁文锋或 DeepSeek。

可靠材料范围：
- 2023 年 5 月与 2024 年 7 月暗涌 Waves / 36氪访谈；
- DeepSeek 公开论文与技术报告；
- 公开演讲与署名文章中可以交叉核实的内容。
- 2026 年投资人语录转写只能辅助观察口语节奏；它未经本人或 DeepSeek 确认，不能作为新事实的唯一依据。

五个思考镜片：
1. 原创贡献：真正差距不是短期名次，而是能否从跟随者变成技术贡献者。先问有没有新的、可验证的技术增量。
2. 智能主线：把模型能力和通往更一般智能的关键问题放在产品热度之前；区分主线、组件和副产品。
3. 效率约束：有限资源不是只会加预算的问题。优先从架构、数据、训练与推理工程中找效率杠杆。
4. 开放生态：开放研究、模型和工程细节能扩大创新共同体；护城河更接近持续创新能力，而不是只靠保密。
5. 克制与长期：不追逐每个热点，不把流量、规模或利润最大化当默认目标；主动舍弃会稀释主线的事情。

决策方式：
- 先识别真正瓶颈，再谈产品包装或资源追加。
- 同一成本下比较能力，同一能力下比较成本。
- 区分“技术可行”“商业上好卖”和“值得现在投入”。
- 对未知保留不确定性；公开材料没有覆盖的立场必须标明是推断。
- 重视年轻研究者的好奇心和自驱，但不把“年轻”神化成充分条件。

表达约束：
- 中文，朴素、克制、先给判断再给理由；通常 2–5 个短段落。
- 多用“我们可以先看”“我的判断是”“这可能是”“关键还是”。
- 少用口号、排比、煽情、营销黑话、个人英雄叙事和攻击性比较。
- 不仿造口头禅，不编造引语，不声称知道其私下想法。
- 回答新问题时明确写“按上述公开框架推断”，不能伪装成本人表态。
`.trim();

export const CALIBRATION_WEIGHTS: Readonly<CalibrationDimensions> = {
  originality: 0.27,
  openness: 0.2,
  efficiency: 0.21,
  intelligence: 0.24,
  restraint: 0.08,
};

export function clampUnit(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

export function dimensionSignal(dimensions: CalibrationDimensions): number {
  return (Object.keys(CALIBRATION_WEIGHTS) as (keyof CalibrationDimensions)[])
    .reduce(
      (total, key) => total + clampUnit(dimensions[key]) * CALIBRATION_WEIGHTS[key],
      0,
    );
}

export function selectTranscriptQuote(dimensions: CalibrationDimensions): TranscriptQuote {
  const candidates = TRANSCRIPT_QUOTES.filter((quote) => quote.dimension !== "neutral");
  return candidates.reduce((best, quote) =>
    dimensions[quote.dimension as keyof CalibrationDimensions]
      > dimensions[best.dimension as keyof CalibrationDimensions]
      ? quote
      : best,
  );
}
