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

## Score Behavior

- 冷启动状态不改变分值算法。
- 分值仅由投票结果和时间衰减决定。
- Cron 采集与分析的新闻不会写入当前分值状态。

## Timeline Behavior

- 相关新闻事件会写入 `news_events`，仅用于时间线展示。
- 每小时 cron 都会对北京时间当天写入/覆盖 `score_snapshots`。
