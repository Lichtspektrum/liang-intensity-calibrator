# T11: API 契约定义

**类型**: grilling（HITL）
**状态**: open
**依赖**: T3（算法）, T7（schema）, T8（去重）, T9（冷启动）
**阻塞**: T12（前端集成）, 所有实现类 tickets

## Question

定义前后端之间的 HTTP API 契约。Worker 扩展现有 worker.ts，新增以下端点：

### 需要定义的端点

1. **GET /api/score** — 获取当前梁氏浓度
   - 响应：当前 score（0-100）、level（0-30）、stage（当前阶段名）、今日/累计 Up/Down 数、是否为冷启动期
   - 是否返回时间线最近 N 个事件？（减少请求数）
2. **POST /api/vote** — 提交投票
   - 请求体：方向（up/down）、fingerprint（fingerprintjs hash）
   - 服务端获取客户端 IP 做频率限制
   - 响应：投票结果（接受/已投票/限流）、当前最新分数、当前 Up/Down 数
   - 错误：今天已投过（返回已投方向）、IP 限流
3. **GET /api/timeline?from=2026-08-01&to=2026-08-13** — 获取时间线数据
   - 响应：日期→分值快照 + 重大事件列表
   - 是否分页？全量？考虑到上线时间越长数据越多
4. **GET /api/timeline/{date}** — 获取某一天的详细信息（点击时间线节点时用）
   - 响应：当天分值、当天发生的事件列表、当天投票统计

### 需要决策的

- 认证方式：投票端点如何防 CSRF？（简单的 Origin/Referer 检查？自定义 header？）
- CORS 策略：如果前端和 Worker 同源（Cloudflare Pages 部署），不需要 CORS。
- 分值精度：返回整数还是小数（0.01 精度）？
- 缓存策略：GET /api/score 的 Cache-Control 设置（不实时更新，可以缓存 5 分钟？）
- 错误响应格式
