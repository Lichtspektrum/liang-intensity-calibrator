# [Wayfinder] 社区投票与每日趋势

## Destination

滑动变祖器允许访客在 -15 到 +15 之间投票。每个浏览器保留一张有效票，间隔 3 小时后可更新。社区分数是当前有效票的平均值，阴影圆点在主滑杆上显示它的位置。

## Current architecture

- GitHub Pages 提供 HTML、CSS、JavaScript、首帧图和 WebM/MP4 视频。
- Cloudflare Worker 只提供 `/api/score`、`/api/vote` 和 `/api/timeline`。
- D1 保存投票人的 HMAC 标识、当前票和每日快照，不保存原始浏览器指纹或 IP。
- Cron 每天记录一次社区分数，时间线最多返回最近 90 天。
- 页面和 API 分开发布。Worker 仅允许配置中列出的精确 Origin 跨域访问。

## Voting rules

- 同一浏览器在 3 小时冷却期内仍可拖动预览，松手后回到已保存的投票。
- 同一 IP 在滚动 24 小时内最多创建 5 个新投票身份。
- API 不可用时，人像和滑杆仍可浏览；社区圆点隐藏，页面显示简短状态。
- 页面加载时读取一次最新社区分数，没有 WebSocket 实时推送。

## Decisions

- 无 SSR：GitHub Pages 直接输出静态首页。
- 无对象存储：媒体文件随 Pages artifact 发布。
- 无新闻数据或 AI 分析：时间线只显示 D1 中的每日分数快照。
- Worker 由手动 GitHub Actions 工作流发布，Pages 在 `main` 更新后发布。

## Out of scope

- 用户账号和登录系统。
- 上线前历史分数回溯。
- 外部 LLM 和第三方内容源。
