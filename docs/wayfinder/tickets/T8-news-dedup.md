# T8: 新闻聚类去重规则设计

**类型**: implemented-basic
**状态**: partial
**依赖**: T1（新闻源可访问性调研）
**阻塞**: T11（API 契约）

## Current Implementation

当前去重和聚类规则位于 `src/cron/collect-news.ts`。

### URL 去重

- 每条候选新闻 URL 先计算 SHA-256 hash。
- KV key: `news:url:<hash>`。
- TTL: 7 天。
- 已处理 URL 不再进入本轮分析。

### 聚类

当前聚类非常轻量：

- 对标题移除常见标点和空白。
- 取前 10 个字符构建字符集合。
- 后续标题前 10 个字符与该集合重叠字符数 >= 4 时，归为同一 cluster。

### 合并后字段

- `polarity`: cluster 内平均值。
- `impact`: cluster 内最大值，并按 cluster 数量加权，最多 clamp 到 1。
- `heat`: `cluster.length * 0.3`，最多 clamp 到 1。
- `is_major`: `impact > 0.5`。
- `source_urls` 和 `sources`: JSON array。

## Known Limits

- 只按标题字符重叠，不能可靠识别同义标题或长尾重复报道。
- 没有按来源可信度加权。
- 没有 AI 二次判断“是否同一事件”。
- 没有跨日滑动窗口聚类。
