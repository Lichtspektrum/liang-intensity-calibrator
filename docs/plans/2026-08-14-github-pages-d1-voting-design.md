# GitHub Pages 与 D1 投票后端拆分设计

## 目标

保留现有 `github.io` 公开页面，把社区投票和每日历史时间线放到一个免费、低运维的后端。第一版不包含自动新闻采集、AI 分析或自定义域名。

## 产品范围

第一版包含：

- 连续滑动预览人物变化。
- 每位访客保留一张长期有效的投票。
- 投票成功 3 小时后才能覆盖修改。
- 页面显示用户当前投票和社区平均分。
- 每天记录一次社区平均分和有效投票人数。
- 页面展示每日历史时间线。

第一版不包含：

- 自动新闻采集和新闻事件时间线。
- Cloudflare Workers AI。
- Cloudflare KV 和 R2。
- 自定义域名和服务端渲染。

## 总体架构

```text
GitHub Pages
  ├─ HTML、CSS、JavaScript
  ├─ 人物图片和视频
  └─ 请求投票 API
          ↓
Cloudflare Worker（workers.dev）
  ├─ GET /api/score
  ├─ POST /api/vote
  ├─ GET /api/timeline
  └─ 每日快照 Cron
          ↓
Cloudflare D1
  ├─ voters
  └─ daily_snapshots
```

GitHub Pages 继续由现有 GitHub Actions 发布。Worker 独立部署，页面通过构建变量获得 API 地址。

## 数据模型

### `voters`

每位访客只保留一行当前选择：

```sql
CREATE TABLE voters (
  voter_hash TEXT PRIMARY KEY,
  ip_hash TEXT NOT NULL,
  position INTEGER NOT NULL CHECK(position BETWEEN -15 AND 15),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_voters_ip_created_at
  ON voters(ip_hash, created_at);
```

- `voter_hash` 由 Worker 对浏览器指纹做带密钥的 HMAC 后生成。
- `ip_hash` 由 Worker 对 Cloudflare 提供的客户端 IP 做带密钥的 HMAC 后生成。
- 数据库不保存原始浏览器指纹或 IP。
- 同一 `voter_hash` 的新选择使用 upsert 覆盖旧值，不增加其统计权重。

### `daily_snapshots`

```sql
CREATE TABLE daily_snapshots (
  date TEXT PRIMARY KEY,
  score REAL NOT NULL CHECK(score BETWEEN -15 AND 15),
  voter_count INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
```

每天北京时间零点后，Cron 把前一天结束时的社区平均分和有效投票人数写入一行。没有新增投票的日期也保留快照，时间线不会出现断层。

## 分数和冷却规则

- 社区平均分等于 `AVG(voters.position)`。
- 没有有效投票时，平均分为 `0`。
- 投票档位是 `-15..15` 的整数。
- 同一访客提交成功后，`updated_at + 3 小时` 之前不能再次修改。
- 冷却中的请求返回 `429`、已保存的位置和 `nextVoteAt`。
- 新选择覆盖旧选择，不会把同一访客重复计算。
- 为限制批量伪造浏览器身份，同一 IP 在滚动 24 小时内最多创建 5 个新 `voter_hash`；已有身份的正常覆盖不占用这个名额。

## API

### `GET /api/score`

返回：

```json
{
  "score": 2.4,
  "stage": "梁圣",
  "voterCount": 128,
  "positiveCount": 80,
  "negativeCount": 41,
  "neutralCount": 7,
  "positivePoints": 620,
  "negativePoints": -315
}
```

### `POST /api/vote`

请求：

```json
{
  "fingerprint": "browser-generated-id",
  "position": 6
}
```

成功响应包含用户保存的位置、最新社区结果和 `nextVoteAt`。冷却响应使用 `429`，并返回相同结构以及 `reason: "cooldown"`。

### `GET /api/timeline`

返回最近 90 天快照，按日期升序排列。第一版不返回新闻事件。

## 跨域和隐私

- Worker 只允许正式 GitHub Pages origin 和本地开发 origin。
- 预检请求返回明确的 CORS headers，不使用通配符 origin。
- HMAC 密钥保存为 Worker secret，不进入仓库、聊天记录或前端构建产物。
- API 不返回浏览器指纹、IP 或其哈希。
- 日志不记录请求体中的原始 fingerprint。

## 页面交互

### 初次访问

- 页面从 GitHub Pages 静态加载，滑杆和人物不依赖后端。
- 社区数据加载成功后显示灰色圆点。
- 尚未投票时显示「红色圆点是你的选择，灰色圆点是社区平均分」。

### 投票成功

- 保存用户位置和 `nextVoteAt` 到 localStorage。
- 上方显示「你的投票：+6　社区平均：+2.4」。
- 下方提示改为「每 3 小时可修改一次」。

### 冷却期间

- 滑杆仍可自由拖动，人物继续实时预览。
- 松开时不提交，恢复到已保存的投票位置。
- 上方显示「还需 2 小时 18 分才能修改投票」。

### 后端异常

- `GET /api/score` 失败：隐藏社区圆点，显示「社区数据暂时无法加载」，滑动预览保持可用。
- `POST /api/vote` 失败：不修改本地成功记录，恢复上一次成功位置，显示「提交失败，请稍后重试」。
- 首次访问且后端不可用：保留完整本地体验，不伪造社区数据。
- 错误直接显示在滑杆上方，不使用弹窗。

## 构建和部署

- GitHub Pages 构建通过 `VITE_API_BASE_URL` 注入 Worker 地址。
- 本地开发可把页面和 Worker 分别运行在两个端口，验证真实 CORS。
- Worker 使用独立 GitHub Actions 工作流部署，凭证保存在 GitHub Secrets。
- 正式部署前先创建临时 Worker 和临时 D1，供维护者验证真实投票与时间线。
- 维护者确认后先部署正式 Worker，再更新 GitHub Pages API 地址。
- 当前线上页面在最终确认前保持不变。

## 用户需要完成的操作

- 登录或注册 Cloudflare 账户。
- 在本地浏览器完成一次 Wrangler OAuth 授权。
- 把 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID` 直接保存到 GitHub Secrets，不在聊天中发送。
- 验收临时后端和最终集成 PR。

其余数据库迁移、Worker 配置、GitHub Actions、测试、部署命令和故障排查由开发流程处理。

## 测试与验收

- 单元测试覆盖平均分、整数档位、覆盖旧票、3 小时冷却和 IP 新身份限制。
- API 集成测试覆盖 D1 查询、成功投票、冷却响应、CORS 和每日快照。
- 浏览器测试覆盖投票成功、冷却恢复、后端离线和提交失败。
- 继续运行桌面端、移动端布局和视频滑动回归测试。
- GitHub Pages 构建验证所有静态资源使用正确的仓库子路径。
- 临时 Worker 验收通过后才能改正式 GitHub Pages 配置。

## PR 整合和贡献归属

- 从最新 `main` 创建干净集成分支。
- 可直接复用的 PR #7 提交使用 `git cherry-pick -x`，保留作者信息。
- 大幅重写但实质来自 PR #7 的提交添加准确的 `Co-authored-by`。
- 新集成 PR 明确写明 `Based on #7 by @loggerhead`，并邀请原贡献者 review。
- 新集成 PR 合并后再感谢并关闭原 PR #7。
