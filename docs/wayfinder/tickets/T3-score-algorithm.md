# T3: 打分算法精确公式

**类型**: implemented
**状态**: done
**阻塞**: T7（D1 schema）, T9（冷启动切换条件）, T11（API 契约）

## Decision

当前实现采用 0-30 作为唯一分值区间，不再使用 0-100 到 UI level 0-30 的映射。

```ts
MIN_SCORE = 0
MAX_SCORE = 30
DEFAULT_SCORE = 15
HALF_LIFE_DAYS = 30
COLD_START_VOTER_THRESHOLD = 500
COLD_START_DAY_THRESHOLD = 7
MAX_NEWS_EVENT_DELTA = 5
IP_DAILY_VOTE_LIMIT = 5
```

## Current Formula

- 当前状态存储在 KV `score_state`。
- 读取当前状态时按月半衰期向默认值 15 衰减：

```ts
score = 15 + (score - 15) * exp(-ln(2) * ageDays / 30)
```

- 投票提交的是整数 `position`，范围 `0-30`。
- 当天社区分值由当天所有独立投票者的平均投票位置产生：

```ts
score = clamp(totalVotePoints / uniqueVoters, 0, 30)
```

- 没有投票时返回默认值 15。
- `position >= 15` 归为 `up`，`position < 15` 归为 `down`，用于统计两侧票数和票值。
- 新闻冷启动增量直接加到当前分值，并 clamp 到 `0-30`。
- `level` 等于保留两位小数的 `score`。

## Stage Mapping

- `0-5`：小难梁
- `6-11`：牢梁
- `12-17`：梁子
- `18-23`：梁圣
- `24-29`：梁神
- `30`：梁祖

## Notes

- 代码中仍保留 `applyVote` / `applyVoteChange` 的方向投票辅助函数，但当前投票 API 使用 `applyVotePointsToScore()`，以当天平均 `position` 作为权威计算路径。
- 旧的“贝叶斯平均 + 0-100 分值 + 先验 50”方案已经不是当前实现。
- 每日重置按北京时间日期计算。
