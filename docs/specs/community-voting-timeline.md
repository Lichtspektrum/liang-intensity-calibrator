# Spec: 社区投票与每日时间线

## 项目概述

滑动变祖器是托管在 GitHub Pages 的网页小玩具：访客在 -15 到 +15 之间投票，人物形态随社区共识分变化。社区分数是所有有效投票的平均值，阴影圆点显示其在滑杆上的位置。

## 当前架构

- **GitHub Pages** 提供 HTML、CSS、JavaScript、首帧图与 WebM/MP4 视频。
- **Cloudflare Worker** 只提供 `/api/score`、`/api/vote` 和 `/api/timeline`，并做精确 Origin 校验（`ALLOWED_ORIGINS`）。
- **D1** 保存投票人 HMAC 标识、当前票与每日快照，不保存原始浏览器指纹或 IP。
- 页面与 API 分开发布：Pages 在 `main` 更新后自动部署，Worker 由手动 GitHub Actions 工作流部署。

## 数据模型（migrations/0001_init.sql）

```sql
CREATE TABLE voters (
  voter_hash TEXT NOT NULL PRIMARY KEY,
  ip_hash TEXT NOT NULL,
  position INTEGER NOT NULL CHECK(position BETWEEN -15 AND 15),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_voters_ip_created_at ON voters(ip_hash, created_at);

CREATE TABLE daily_snapshots (
  date TEXT NOT NULL PRIMARY KEY,
  score REAL NOT NULL CHECK(score BETWEEN -15 AND 15),
  voter_count INTEGER NOT NULL CHECK(voter_count >= 0),
  created_at INTEGER NOT NULL
);
```

- `voters`：每个浏览器一条有效票，`position` 是唯一投票事实；`updated_at` 驱动 3 小时冷却与「今日投票人数」统计。
- `daily_snapshots`：每个北京时间日期一条社区快照，是时间线的唯一数据源。`voter_count` 为截至快照时刻的累计投票人数。

## API 契约

### GET /api/score

返回当前社区状态（无缓存，`Cache-Control: no-store`）：

```json
{
  "score": -1.21,
  "stage": "梁子",
  "voterCount": 247,
  "todayVoterCount": 247,
  "positiveCount": 107,
  "negativeCount": 133,
  "neutralCount": 7,
  "positivePoints": 1156,
  "negativePoints": -1456
}
```

- `score` 为 `-15..15` 的百分位保留值，由 `scoreFromBallots` 从票值总和与投票人数计算。
- `todayVoterCount` 为「今日（北京时间）投过票或改过票」的去重人数，统计口径为 `updated_at >= 北京时间当日零点`，与快照日期一致。

### POST /api/vote

请求体 `{ fingerprint, position }`，`position` 必须是 `-15..15` 的整数。服务端校验 Origin、HMAC 指纹/IP、3 小时冷却与单 IP 每日新增上限（5 个）。响应携带最新社区状态与 `userPosition`、`nextVoteAt`。主要错误：`invalid_body`、`invalid_position`、`invalid_fingerprint`、`csrf`、`cooldown`、`rate_limited`。

### GET /api/timeline?from=YYYY-MM-DD&to=YYYY-MM-DD

返回升序的最近 90 天快照（`Cache-Control: public, max-age=3600`）：

```json
[
  { "date": "2026-08-14", "score": -1.09, "stage": "梁子", "voterCount": 337 }
]
```

- `from` / `to` 为可选过滤参数；格式无效时忽略对应条件（用于前端的增量刷新）。
- 不提供单日接口：历史回看直接使用前端已拉取的数据。

### 定时任务（Cron）

`wrangler.json` 配置 `5 16 * * *`（每天 16:05 UTC = 北京时间 0:05）。`handleScheduled` 记录**昨天**（北京时间）的快照：`recordDailySnapshot(env, previousBeijingDate(now))`，用当前社区聚合 upsert `daily_snapshots`。

## 时间线设计

### 数据流

1. 页面加载时 `loadCommunity` 拉取 `/api/timeline` 全量（最多 90 天），存入 `timelineDays`。
2. 前端把**今日节点**本地合成为时间线最新一项：`{ date: 北京时间今天, score: 实时社区分, stage, voterCount: 实时累计人数 }`。
   - 今日节点来自 `/api/score` 与投票响应，不产生额外后端请求；
   - 投票成功后社区数据更新会立即刷新今日节点（人数、分数实时变化）。
3. 窗口重新聚焦 / 页面重新可见时，用 `from = 已加载的最新日期` 做**增量拉取**（800ms 去抖），只取可能新增的快照合并；历史快照每天最多新增一条，增量请求被 CDN 缓存兜底。

### 节点展示

右侧面板每个节点（hover 显示）包含两行：

- 第一行：日期 `MM-DD`；
- 第二行：当日统计分数 + 总投票人数，如 `-1.1 · 337 人`。

`aria-label` 提供完整信息：`2026-08-14: 梁子 · -1.1 · 337 人`。

### 历史回看交互

- 点击节点进入历史模式：滑杆切到该日期快照的分值（画面、阶段、刻度同步），滑杆禁用，显示「回到实时」按钮，面板标题变为日期；状态行保持实时数据不变。
- 点击「回到实时」退出：滑杆恢复为你的投票位置（无投票时为社区平均分）。
- 历史模式下忽略滑杆输入与异步投票响应，防止打断回看。

## 前端状态

滑杆交互状态机：`idle`（常态）→ `previewing-vote`（拖动预览，松手提交）→ `viewing-history`（历史回看）。冷却提示在投票提交后显示 2 秒，随后淡出并淡入常态统计。

## 测试与发布

- 单元 / 集成测试：`pnpm test -- --run`（`src/api/*.test.ts`、`src/app.test.ts`、`src/main.test.ts`、`src/sites-worker.test.ts` 等）。
- 浏览器 e2e：`pnpm run test:e2e`（Playwright，桌面与手机）。
- 发布：先手动运行「Deploy API Worker」workflow（跑测试、构建、迁移、`wrangler deploy`），再推送 `main` 触发 Pages 自动部署；新前端要求 API 返回 `todayVoterCount`，因此必须保证 Worker 先于或与前端同时上线。

## Out of Scope

- WebSocket 实时推送（页面加载与操作时通过 HTTP 获取最新状态）。
- 用户账号、管理员后台、多语言。
- 新闻采集、AI 分析、KV 状态存储（此前迭代已移除）。
- 上线前历史分数回溯。
