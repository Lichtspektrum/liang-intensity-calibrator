# T1: 新闻源可访问性调研

**类型**: implemented-basic
**状态**: partial
**阻塞**: T8（新闻聚类去重规则）, T10（AI prompt 设计）

## Current Sources

当前代码只接入无认证、可由普通 Node 服务直接 `fetch` 的轻量来源：

- GitHub releases:
  - `deepseek-ai/DeepSeek-V3`
  - `deepseek-ai/DeepSeek-R1`
  - `deepseek-ai/DeepSeek-Coder`
- RSS:
  - `https://www.36kr.com/feed`
  - `https://www.jiqizhixin.com/rss`

## Current Filtering

- 目标关键词：`梁文峰`、`DeepSeek`、`深度求索`、`deepseek`、`梁文锋`。
- RSS 只在标题命中关键词时进入候选。
- GitHub releases 直接进入候选，再交给 AI 或 fallback 逻辑判断。

## Not Implemented

以下来源仍未接入：

- 微博热搜/话题
- 知乎热榜/相关话题
- B站相关视频/动态
- V2EX
- DeepSeek 官方博客
- ArXiv

## Follow-Up Questions

1. 是否值得为微博/知乎/B站等需要更复杂访问策略的来源增加适配器。
2. 是否需要引入 RSSHub 或其他聚合源。
3. 是否需要把来源配置化，而不是写死在 `src/cron/collect-news.ts`。
