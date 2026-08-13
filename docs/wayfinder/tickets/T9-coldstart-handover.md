# T9: 冷启动与投票主导的切换条件

**类型**: implemented
**状态**: done
**依赖**: T3（打分算法精确公式）
**阻塞**: T11（API 契约）

## Current Decision

当前冷启动判断：

```ts
isColdStart = cumulativeVoters < 500 && daysSinceLaunch < 7
```

注意：文档早期讨论过“累计投票不足或上线未满 7 天”。当前代码使用的是 AND 条件，两者都满足时才算冷启动。

## News Delta Behavior

- Cron 采集并分析新闻后，只在冷启动阶段对分值应用新闻增量。
- 每个 cluster 的贡献：`avgPolarity * maxImpact * MAX_NEWS_EVENT_DELTA`。
- `MAX_NEWS_EVENT_DELTA = 5`。
- 本轮新闻总增量最终 clamp 到 `[-5, 5]`。
- 应用后分值 clamp 到 `0-30`。

## Timeline Behavior

- 无论是否冷启动，相关新闻事件都会写入 `news_events`。
- 每小时 cron 都会对北京时间当天写入/覆盖 `score_snapshots`。
