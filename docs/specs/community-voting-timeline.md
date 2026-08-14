# Spec: 社区投票梁氏浓度 + 自动新闻时间线

## Current State

滑动变祖器已经从纯前端玩具扩展为 Cloudflare Worker + Assets 应用。页面、静态资源和 `/api/*` 由同一个 Worker 提供，线上项目名为 `ds-liang`，自定义域为 `ds.uu0uu.com`。

当前实现的核心能力：

- 滑杆语义区间为 `-15..15`，默认社区分值为 `0`。
- 页面加载后从 `/api/score` 获取社区共识分值、阶段、当天投票统计和最近新闻事件。
- 用户通过主滑块提交当天投票位置，投票值必须是 `-15..15` 的整数；当天再次滑动会更新自己的投票。
- 后端按 `position > 0`、`position = 0`、`position < 0` 派生正向、中立和负向统计；`position` 是唯一投票事实。
- 时间线数据来自 D1 中的 `score_snapshots` 和 `news_events`。
- Cron 每小时记录当天快照并采集相关新闻。

## User Stories

1. 作为首次访问的用户，我打开页面时看到滑杆定位在当前社区共识分值，而不是固定从 0 开始。
2. 作为用户，我可以自由拖动滑杆浏览从「小难梁」到「梁祖」的所有形态。
3. 作为用户，我通过主滑块选择 `-15..15` 的整数位置来提交当天投票。
4. 作为用户，我当天再次滑动并提交时，可以修改自己的投票位置。
5. 作为用户，我能看到低强度和高强度两侧累计票值，从而感知当前社区倾向。
6. 作为用户，我点击时间线事件后，可以回看该日期的历史分值和对应形态。
7. 作为用户，我可以从历史回看状态回到实时社区分值。
8. 作为系统，同一 fingerprint 每天只有一条投票记录，通过 upsert 支持改投。
9. 作为系统，同一 IP 每天最多新增 5 个投票者，用 KV 计数并以 hash 形式存储 IP。
10. 作为系统，每小时采集相关新闻并写入时间线，但新闻不影响社区分值。
11. 作为系统，每小时记录北京时间当天的分值快照，供时间线查询。
12. 作为系统，不做 WebSocket 实时推送；页面加载或用户操作时通过 HTTP API 获取最新状态。

## Implementation Decisions

### 技术栈与部署

- **后端**：`src/worker.ts` 是 Worker 入口，处理 `/api/*` 并回退到 Worker Assets。
- **前端**：Vite + TypeScript + 原生 DOM/Canvas。`src/api.ts` 封装同源 API 调用。
- **存储**：D1 存储投票、新闻事件和分值快照；KV 存储当前分值状态、IP 限流计数和新闻 URL 去重标记。
- **定时任务**：Cloudflare Cron Triggers，每小时执行一次 `handleScheduled()`。
- **AI**：新闻分析优先使用 Workers AI；没有 AI binding 或调用失败时降级为关键词相关性判断。
- **部署**：Cloudflare Workers + Assets，项目名 `ds-liang`，自定义域 `ds.uu0uu.com`。API 与页面同域，不需要 CORS。

### 路由与 API

1. **`GET /api/score`**
   - 返回当前 `score`、`stage`、当天正向/负向/中立统计、`isColdStart` 和最近 15 个事件。
   - `score` 是 `-15..15` 区间，保留两位小数；接口不再返回重复的 `level`。
   - 响应头为 `Cache-Control: no-store`。

2. **`POST /api/vote`**
   - 请求体：`{ fingerprint: string, position: number }`。
   - `position` 必须是 `-15..15` 的整数。
   - 服务端检查同源 `Origin` 或 `Referer`，并从 `CF-Connecting-IP` 获取 IP 做新增投票者限流。
   - 同一 `fingerprint + date` 使用 upsert；当天重复提交会覆盖旧 `position`。
   - 返回 `accepted`、`userPosition`、最新 `score/stage` 和当天投票统计。
   - 主要错误：`invalid_body`、`invalid_position`、`invalid_fingerprint`、`csrf`、`rate_limited`。

3. **`GET /api/timeline?from=YYYY-MM-DD&to=YYYY-MM-DD`**
   - 返回日期范围内的 `score_snapshots`，并附带每一天的新闻事件。
   - `from/to` 格式无效时忽略对应过滤条件。
   - 响应头为 `Cache-Control: public, max-age=3600`。

4. **`GET /api/timeline/:date`**
   - 返回单日快照和事件列表。
   - `date` 必须为 `YYYY-MM-DD`。

5. **Scheduled Cron**
   - 当前 cron：`0 * * * *`。
   - 每小时执行 `recordDailySnapshot(env, todayInBeijing())` 和 `runNewsCollection(env)`。

### 分值算法

`score` 本身就是 UI、API、KV 和 D1 使用的 `-15..15` 梁氏浓度。`0..30` 只存在于图片文件编号中，映射公式为 `frameIndex = round(score) + 15`。

```ts
MIN_SCORE = -15
MAX_SCORE = 15
DEFAULT_SCORE = 0
HALF_LIFE_DAYS = 30
COLD_START_VOTER_THRESHOLD = 500
COLD_START_DAY_THRESHOLD = 7
IP_DAILY_VOTE_LIMIT = 5
```

规则：

- 当前分值存储在 KV 的 `signed_score_state`。
- 读取分值时按月半衰期向默认值 0 衰减：`score * exp(-ln(2) * ageDays / 30)`。
- 投票提交后，分值由当天所有独立投票者的平均 `position` 计算：`score = totalVotePoints / uniqueVoters`。
- 没有投票者时，默认分值为 `0`。
- 新闻仅用于时间线事件，不参与分值计算。
- 阶段和图片共同使用四舍五入后的分值：`-15..-10 小难梁`、`-9..-4 牢梁`、`-3..2 梁子`、`3..8 梁圣`、`9..14 梁神`、`15 梁祖`。

### D1 Schema

当前 migrations：`0001_init.sql`、`0002_add_vote_position.sql`、`0003_signed_score.sql`。`0003` 是不兼容迁移，会删除并重建 `votes` 与 `score_snapshots`，不转换旧坐标数据。

```sql
CREATE TABLE IF NOT EXISTS daily_votes (
  date TEXT PRIMARY KEY,
  up_count INTEGER NOT NULL DEFAULT 0,
  down_count INTEGER NOT NULL DEFAULT 0,
  unique_voters INTEGER NOT NULL DEFAULT 0,
  news_delta REAL NOT NULL DEFAULT 0,
  final_score REAL
);

CREATE TABLE votes (
  fingerprint TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  date TEXT NOT NULL,
  position INTEGER NOT NULL CHECK(position BETWEEN -15 AND 15),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (fingerprint, date)
);
CREATE INDEX IF NOT EXISTS idx_votes_ip_date ON votes(ip_hash, date);

CREATE TABLE IF NOT EXISTS news_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  polarity REAL NOT NULL,
  impact REAL NOT NULL,
  source_urls TEXT NOT NULL,
  sources TEXT NOT NULL,
  heat REAL DEFAULT 0,
  is_major INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_date ON news_events(date);

CREATE TABLE score_snapshots (
  date TEXT PRIMARY KEY,
  score REAL NOT NULL CHECK(score BETWEEN -15 AND 15),
  stage TEXT NOT NULL,
  positive_count INTEGER NOT NULL,
  negative_count INTEGER NOT NULL,
  neutral_count INTEGER NOT NULL,
  major_event_id INTEGER,
  FOREIGN KEY (major_event_id) REFERENCES news_events(id)
);

CREATE TABLE IF NOT EXISTS app_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

### KV 用途

- `signed_score_state`：当前分值状态，包含 `score`、`lastUpdateTs`、`cumulativeVoters`、`daysSinceLaunch`。
- `vote:ip:<date>:<ip_hash>`：同一 IP 当天新增投票者计数，TTL 48 小时。
- `news:url:<hash>`：已处理新闻 URL 标记，TTL 7 天。

### 新闻采集

当前实现的源：

- GitHub releases：`deepseek-ai/DeepSeek-V3`、`deepseek-ai/DeepSeek-R1`、`deepseek-ai/DeepSeek-Coder`。
- RSS：36kr、机器之心。

流程：

1. 拉取新闻候选。
2. 用 KV 按 URL hash 去重。
3. Workers AI 分析相关性、极性、影响力、摘要和标签。
4. 如果 AI 不可用或失败，降级为关键词相关性判断。
5. 相关事件按标题前缀字符重叠做简单聚类。
6. 写入 `news_events`。

当前实现没有接入微博、知乎、B站、V2EX 或 DeepSeek 官方博客。

## Testing Decisions

当前测试覆盖：

- `src/score-domain.test.ts`：`-15..15` clamp、阶段、图片编号、轨道百分比和有符号格式。
- `src/score-engine.test.ts`：投票平均值、分值衰减和阶段映射。
- `src/app.test.ts`：`-15..15` 投票滑杆、社区分值、票值展示、历史模式等 DOM 行为。
- `src/api` 相关测试：Worker Assets 和 API 行为。
- `tests/slider.spec.ts`：浏览器交互。

发布前建议运行：

```bash
npm test -- --run
npm run build
```

## Out of Scope

- WebSocket 实时推送。
- 用户账号系统。
- 管理员后台。
- 多语言支持。
- 上线前历史事件回溯。
- 微博/知乎/B站/V2EX 等需要额外访问策略的新闻源。

## Further Notes

- “每天一票”和快照日期按北京时间计算。
- 投票身份使用 fingerprintjs，服务端以 `fingerprint + date` 作为每日投票唯一键。
- IP hash 使用 `liang-slider-ip:<ip>` 作为 SHA-256 输入；当前 salt 是代码常量，不是独立 secret。
- `daily_votes` 目前存在于 schema 中，但当前分值读取和投票更新主要依赖 `votes` 聚合与 KV `signed_score_state`。
