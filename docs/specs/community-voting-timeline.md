# Spec: 社区投票梁氏浓度 + 自动新闻时间线

## Problem Statement

滑动变祖器目前是一个纯前端玩具：滑杆初始值为 0（小难梁），用户只能自己拖动浏览各形态，缺乏社交互动和时间维度。用户希望打开页面就能看到"当前大家公认的梁氏浓度"，参与投票影响这个分值，并通过时间线回看梁系强度随新闻事件的演变过程。

## Solution

为滑动变祖器增加后端能力（Cloudflare Workers + D1 + KV + Cron Triggers + Workers AI）：
- 页面加载时滑杆定位到当前社区共识分值（初始 50，对应梁子/梁圣之间），用户可自由拖动浏览，松手回弹到共识分值
- 左侧加入 Up/Down 投票面板，每人（指纹+IP）每天一票，可改投
- 右侧加入纵向时间线，展示自动采集的新闻事件节点，点击回看历史分值
- 分值由贝叶斯平均 + 月半衰期 EMA 计算，投票是主驱动，新闻在冷启动期辅助打分，之后仅做时间线标记
- Cron 每小时自动采集中文科技圈+官方渠道新闻，Workers AI 分析极性/影响力/摘要

## User Stories

1. 作为首次访问的用户，我打开页面时看到滑杆定位在当前社区共识分值（而非 0），这样我能第一时间感知"大家觉得现在梁是多少级"。
2. 作为用户，我可以自由拖动滑杆浏览从"小难梁"到"梁祖"的所有形态，这样我能继续享受这个玩具的核心乐趣。
3. 作为用户，我拖动滑杆松手后，滑杆会平滑回弹到社区共识分值，这样我不会混淆"我自己拖到的位置"和"大家公认的位置"。
4. 作为用户，我看到左侧有 Up/Down 两个投票按钮，这样我可以表达"我认为梁氏浓度应该更高"或"应该更低"。
5. 作为用户，投票按钮中间有一个竖向比例条显示 Up 和 Down 的分布，这样我能直观看到民意倾向。
6. 作为用户，我每天只能投一票（Up 或 Down），这样每人的意见权重公平。
7. 作为用户，我在同一天内可以改投（投了 Up 后又想投 Down），这样我可以在看到新信息后修正自己的判断。
8. 作为用户，我投完票后我的投票按钮高亮，比例条更新，这样我能看到我的投票已被计入。
9. 作为用户，我看到右侧有一条纵向时间线，上面标记着历史上的关键事件节点，这样我能直观感受梁系强度随时间的变化。
10. 作为用户，我点击时间线上的事件节点，滑杆跳到该日期的分值，人像显示对应形态，这样我能"穿越"回看历史。
11. 作为用户，回看历史时我能看到该事件的简短摘要（如"DeepSeek-V3 发布"），这样我知道当时发生了什么。
12. 作为用户，回看历史后我能方便地回到"当前实时"状态（再次点击当前节点或有明确返回方式），这样不会迷失在历史中。
13. 作为用户，时间线上大事件有更大更显眼的标记，小事件有小标记，这样我能一眼看出哪些是重要节点。
14. 作为用户，页面不需要实时推送更新，我刷新页面就能看到最新分值，这样实现简单且不影响体验（分值变化慢，月半衰期）。
15. 作为使用指纹保护浏览器或隐私扩展的用户，如果 fingerprintjs 无法生成指纹，我仍然可以投票（降级为纯 IP 限流），这样不会被反指纹技术挡在门外。
16. 作为移动端用户，投票面板和时间线在窄屏上合理布局（不破坏现有竖排布局），这样手机上也能正常使用。
17. 作为用户，我在首次加载时看到滑杆有一个从 0 平滑动画到共识分值的入场效果，这样有仪式感。
18. 作为用户，投票时如果我今天已经投过票，按钮显示我之前的投票方向，这样我不需要回忆自己投了什么。

### 管理员/系统视角

19. 作为系统，冷启动期（投票量不足）新闻情感分析结果可以驱动初始分值偏移，这样上线第一天就有非 50 的分值可看。
20. 作为系统，投票量足够后新闻不再直接加减分，只在时间线上展示事件标记，这样分值完全由民意决定。
21. 作为系统，每小时自动从微博热搜、知乎热榜、B站、V2EX、DeepSeek 官方博客、GitHub releases、科技媒体 RSS 采集相关新闻，这样不需要手动维护事件。
22. 作为系统，同一天内同一事件在不同来源被报道时，会合并为一个事件节点，这样时间线上不会出现重复标记。
23. 作为系统，合并后的事件影响力因多源报道而提高（社区热度加权），这样被广泛讨论的事件在分值上有更大影响（冷启动期）。
24. 作为系统，AI 分析每条新闻的极性（正面/负面）、影响力（大小）和简短摘要，这样不需要人工阅读每条新闻。
25. 作为系统，旧投票权重按月半衰期衰减，分值慢慢回归 50（中性），这样大新闻的影响会随时间消退，不会永久锁定分值。
26. 作为系统，同一 IP 每天最多 5 票（指纹为主、IP 辅助限流），这样防止简单脚本刷票但不误伤同一办公室/家庭的多人。
27. 作为系统，IP 地址以 hash 形式存储（加盐），不存明文，这样保护用户隐私。
28. 作为系统，分值计算使用 EMA（指数移动平均），D1 只需存当前分值和每日聚合，不需要存每张投票明细，这样存储和计算都简单高效。
29. 作为系统，每天结束时记录当日分值快照，这样时间线可以展示历史数据。
30. 作为系统，不做 WebSocket 实时推送，前端页面加载时取一次分值即可，这样架构简单。

## Implementation Decisions

### 技术栈与架构

- **后端**：扩展现有 `worker.ts`，新增 `/api/*` 路由。部署到 Cloudflare Workers，使用 D1（SQLite）存储投票和事件数据，KV 存储限流计数器和去重缓存，Cron Triggers（每小时）驱动新闻采集任务，Workers AI 做中文新闻情感分析和摘要。不引入外部 LLM API key。
- **前端**：纯前端无框架，延续现有 vanilla TypeScript 模式。新增 API client 模块和社区状态管理模块，通过扩展 `AppController` 接口集成投票面板和时间线面板。
- **部署**：通过现有 GitHub Actions workflow 自动部署到 Cloudflare Pages（Pages 模式集成 Workers）。

### 模块划分

1. **`src/worker.ts`（扩展）**：现有静态资源转发 + 新增 API 路由处理器。新增路由：
   - `GET /api/score`：返回当前分值、level、stage、今日 Up/Down 计数、是否冷启动、时间线最近 N 个事件。Cache-Control: max-age=300（5 分钟缓存）。
   - `POST /api/vote`：提交投票。请求体 `{ direction: "up"|"down", fingerprint: string }`，服务端从 `CF-Connecting-IP` 获取 IP。返回投票结果（accepted/already_voted/rate_limited）+ 最新分值。
   - `GET /api/timeline?from=YYYY-MM-DD&to=YYYY-MM-DD`：返回日期范围内的分值快照和事件列表。
   - `GET /api/timeline/:date`：返回某天的详细信息（分值、事件列表、投票统计）。
   - `Scheduled Cron`：每小时触发新闻采集任务。

2. **`src/app.ts`（扩展 AppController）**：在现有 `.experience` grid 布局中加入左侧投票面板和右侧时间线面板的 DOM。AppController 新增方法：
   - `setCommunityScore(score: number, level: number, stage: StageName)`：设置社区共识分值，回弹动画到此位置。
   - `setVotingState(state: { upCount: number, downCount: number, userVote: "up"|"down"|null, canVote: boolean })`：更新投票面板状态。
   - `setTimelineEvents(events: TimelineEvent[])`：填充时间线节点。
   - `enterHistoryMode(date: string, score: number)`：进入历史回看模式，滑杆锁定在历史分值。
   - `exitHistoryMode()`：退出历史回看，回弹到社区共识分。

3. **`src/community-state.ts`（新文件）**：管理"用户浏览位置 vs 社区共识分值"的状态机。状态：`idle`（显示共识分）、`browsing`（用户拖动中）、`snapping-back`（回弹动画中）、`viewing-history`（锁定历史分值）。管理回弹动画逻辑（ease-out，持续约 600ms）。

4. **`src/api.ts`（新文件）**：封装后端 API 调用。提供 `fetchScore()`、`submitVote(fingerprint, direction)`、`fetchTimeline(from, to)`、`fetchTimelineDate(date)` 等方法。处理错误和 loading 状态。

5. **`src/cron/collect-news.ts`（新文件，Worker 端）**：Cron 触发的新闻采集逻辑：
   - 从各源拉取最新内容（微博热搜、知乎热榜、B站搜索、V2EX、RSS、GitHub releases API、官方博客）。
   - URL 去重（KV 存储已处理 URL hash）。
   - 同日同类新闻聚类合并（关键词相似度 + 来源判断）。
   - 调用 Workers AI 做相关性过滤、极性分类、影响力评估、摘要生成。
   - 合并事件的影响力按报道源数量加权（社区热度）。
   - 冷启动期将 polarity × impact × max_delta 注入分值；投票主导期仅存入事件表。
   - 每日 UTC+0 结算时记录日分值快照。

6. **`src/styles.css`（扩展）**：新增投票面板（左侧竖长区域）和时间线面板（右侧竖长区域）的样式，延续现有"控制台/仪表盘"美学（衬线字、细线框、扫描线效果、单色配色）。移动端响应式：窄屏时面板收缩为底部/顶部工具条或浮动按钮。

### 分值算法（贝叶斯 + EMA 月半衰期）

核心公式使用指数移动平均（EMA），最简单且不需要存储每张投票明细：

```
// 每日结算（UTC+0 北京时间午夜）
lambda = ln(2) / 30  // 月半衰期，每天权重衰减约 2.3%
dailyDelta = (upVotes - downVotes) / (upVotes + downVotes + priorStrength) * maxDailyShift
score = 50 + (score - 50) * exp(-lambda) + dailyDelta
score = clamp(score, 0, 100)
```

- `priorStrength`：先验强度（等效 100 票，冷启动期分值不会被少量票带偏）。
- `maxDailyShift`：每天最多移动 ±5 分（防止某天异常流量导致分值跳变）。
- 冷启动判断：累计投票人数 < 500 或上线未满 7 天时为冷启动期，新闻事件的 polarity × impact × 10 作为额外 dailyDelta 注入。
- score 0-100 线性映射到 level 0-30。

### D1 Schema

```sql
-- 每日投票聚合（核心表，EMA 基于此计算）
CREATE TABLE daily_votes (
  date TEXT PRIMARY KEY,        -- YYYY-MM-DD (北京时间)
  up_count INTEGER NOT NULL DEFAULT 0,
  down_count INTEGER NOT NULL DEFAULT 0,
  unique_voters INTEGER NOT NULL DEFAULT 0,
  news_delta REAL NOT NULL DEFAULT 0,  -- 冷启动期新闻贡献的分值偏移
  final_score REAL               -- 当日结算后的最终分值（0-100）
);

-- 投票记录（用于每日一票去重和改票，保留 60 天后可清理）
CREATE TABLE votes (
  fingerprint TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  date TEXT NOT NULL,           -- YYYY-MM-DD
  direction TEXT NOT NULL CHECK(direction IN ('up', 'down')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (fingerprint, date)
);
CREATE INDEX idx_votes_ip_date ON votes(ip_hash, date);

-- 新闻事件
CREATE TABLE news_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  polarity REAL NOT NULL,       -- -1 ~ +1
  impact REAL NOT NULL,        -- 0 ~ 1
  source_urls TEXT NOT NULL,    -- JSON array of URLs
  sources TEXT NOT NULL,        -- JSON array of source names
  heat REAL DEFAULT 0,          -- 社区热度指标（讨论量归一化）
  is_major INTEGER DEFAULT 0,   -- 是否为大事件（impact > 0.5）
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_events_date ON news_events(date);

-- 每日分值快照（时间线数据源）
CREATE TABLE score_snapshots (
  date TEXT PRIMARY KEY,
  score REAL NOT NULL,
  level REAL NOT NULL,
  stage TEXT NOT NULL,
  up_count INTEGER NOT NULL,
  down_count INTEGER NOT NULL,
  major_event_id INTEGER,
  FOREIGN KEY (major_event_id) REFERENCES news_events(id)
);
```

### KV 用途

- `vote:ip:<date>:<ip_hash>`：IP 当日投票计数（原子 increment，TTL 48 小时）。
- `news:url:<hash>`：已处理 URL 标记（TTL 7 天，防止重复处理）。
- `score:current`：当前分值缓存（减少每次读取都查 D1，投票后更新）。

### 前端集成细节

- **fingerprintjs**：使用 `@fingerprintjs/fingerprintjs` 开源版，npm 打包进 bundle。页面加载时尽早初始化获取 fingerprint，投票时发送。失败时降级为空 fingerprint，仅靠 IP 限流。
- **回弹动画**：用户 `pointerup`/`blur` 事件后启动 `requestAnimationFrame` 动画，从当前位置 ease-out 到社区共识分，约 600ms。回弹中用户再次拖动则打断动画。
- **入场动画**：页面加载后视频 ready + score 拿到后，滑杆从 0 平滑移动到共识分（约 800ms），而不是直接跳。
- **历史模式**：点击时间线节点进入，滑杆锁定不可拖动（或拖动退出历史模式），显示"回到实时"按钮或再次点击节点退出。
- **CSRF 防护**：投票接口检查 Origin/Referer 头，只接受同源请求。

### 新闻采集细节

- **源列表**（待 T1 调研确认可访问性）：微博热搜 API、知乎热榜 API、B站搜索 API（关键词"梁文峰"、"DeepSeek"）、V2EX 最热、GitHub releases API（deepseek-ai 组织）、DeepSeek 官方博客、科技媒体 RSS（36氪、机器之心等）。
- **去重**：URL hash 存储在 KV 标记已处理。同日新闻按标题关键词相似度（简单 Jaccard 或 AI 判断）+ 来源类别聚类。
- **AI 分析**：Workers AI 模型（T2 调研后确定具体模型）输入标题+摘要片段，输出 JSON `{ relevant: boolean, polarity: number, impact: number, summary: string, tags: string[] }`。
- **AI rubric**：
  - 极强正面(>0.7)：突破性模型发布、性能超越 SOTA、重大开源
  - 正面(0.3~0.7)：版本更新、正面报道、用户好评
  - 中性(-0.3~0.3)：常规公告、行业评论
  - 负面(-0.7~-0.3)：产品事故、宕机、跳票、争议
  - 极强负面(<-0.7)：重大安全事故、严重危机

## Testing Decisions

- **原则**：只测外部行为，不测实现细节。
- **前端单元测试**（扩展现有 vitest + jsdom 模式）：
  - `progression.ts`：扩展 score→level 映射测试，验证 EMA 计算逻辑（可抽取为纯函数测试）。
  - `community-state.ts`：状态机转换测试（idle→browsing→snapping-back→idle、历史模式进入退出）。
  - `app.test.ts`：扩展测试投票面板和时间线面板的渲染和交互。
  - 回弹动画在单元测试中用 `vi.useFakeTimers()` 验证最终状态，不测动画帧。
- **Worker 测试**（使用现有 `@cloudflare/vite-plugin` 测试模式或 vitest）：
  - API 端点单元测试：投票限流、每日一票、改票、分值计算正确性。
  - EMA 衰减公式测试：给定一系列投票数据，验证分值按预期衰减。
  - 冷启动切换测试：累计投票达阈值后新闻不再影响分值。
- **E2E 测试**（扩展现有 Playwright）：
  - 页面加载→展示社区分值→拖动浏览→松手回弹。
  - 投票流程（投 Up→按钮高亮→比例条更新→尝试再投被拒）。
  - 时间线点击→回看历史→返回实时。
- **Cron/AI 测试**：新闻采集和 AI 分析逻辑做集成测试，使用 mock fetch 和 mock AI 响应验证流程正确性。

## Out of Scope

- **历史数据回溯**：时间线从上线日开始自然积累，不回溯上线前的 DeepSeek 历史事件。
- **WebSocket 实时推送**：v1 不做实时分值推送，用户刷新页面获取最新值。
- **外部 LLM API**：v1 只用 Cloudflare Workers AI，不接 DeepSeek/OpenAI 等外部 API（不需要额外管理 API key）。
- **用户账号系统**：不做登录注册，指纹+IP 作为身份标识。
- **管理员后台**：v1 不提供管理界面，事件管理通过直接操作 D1（或后续迭代加）。
- **多语言支持**：仅中文。
- **分享功能**：URL 参数直接跳转到特定分值/时间点（issue 评论中提到的分享功能），v1 不做但 API 设计时预留 score 参数支持。

## Further Notes

- **时间重置**："每天一票"按北京时间（UTC+8）0 点重置。
- **存储清理**：votes 表 60 天前的记录可定期清理（Cron 任务），因为 EMA 只需要 daily_votes 聚合数据，明细仅用于当日去重。
- **GitHub Actions 部署**：需要在部署 workflow 中增加 D1 数据库创建/migration、KV namespace 创建、Cron Trigger 配置、环境变量（KV/D1 binding）等 wrangler 配置步骤。
- **wrangler.json 需扩展**：添加 D1 binding、KV binding、AI binding、Cron trigger 配置。
- **本地开发**：通过 `@cloudflare/vite-plugin`（已在项目中）可以本地模拟 D1/KV/Cron/AI，使用 `wrangler dev` 或现有 `npm run dev` 即可全栈本地开发。需要本地 `.dev.vars` 文件配置必要的 binding。
