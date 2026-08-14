# T5: 右侧时间线 UI 原型

**类型**: implemented
**状态**: done
**阻塞**: 无

## Current Implementation

当前实现包含右侧时间线面板：

- `.timeline-panel` 作为右侧时间线区域。
- `.timeline-track` 渲染最近事件。
- 点击事件会调用 `/api/timeline/:date`，然后进入历史回看模式。
- 历史回看会把显示 level 切到该日期快照。
- `.timeline-return-btn` 用于回到当前校准位置。
- `isMajor` 事件会在 DOM class 上标记为大事件。

## Data Source

- `GET /api/score` 返回最近 15 个事件，供初始时间线展示。
- `GET /api/timeline/:date` 返回某天详细快照和事件。
- 后端数据来自 `score_snapshots` 和 `news_events`。

## Known Limits

- 时间线目前展示最近事件，没有复杂分页或折叠策略。
- 事件大小主要依赖 AI/新闻处理阶段写入的 `is_major`。
