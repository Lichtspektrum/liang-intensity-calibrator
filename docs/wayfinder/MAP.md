# [Wayfinder] 新闻校准与连续梁式对话

## Destination

保留 -15 到 +15 的本机手动校准，并增加今日 AI 新闻自动校准和公开材料框架下的连续梁式对话。

## Current architecture

- GitHub Pages 可提供 HTML、CSS、JavaScript、首帧图和视频。
- 普通 Node 服务提供新闻、对话和历史数据接口。
- Node API 仅在收到 AI 请求时启动本地 `opencode/deepseek-v4-flash-free` CLI，任务结束后进程退出，不需要模型 key。
- 新闻采集并行执行 Hacker News、arXiv、官方 GitHub releases，以及中英双路 `websearch → webfetch`。
- OpenCode 运行目录只允许 Liang skill、网页搜索和抓取。
- SQLite 保存每日快照、新闻缓存和按哈希 IP 计数的聊天限流桶。
- 本地调度器定期更新新闻并记录每日快照。

## Decisions

- 页面与 API 可以分开发布；API 只允许配置中列出的精确 Origin。
- 新闻与聊天只使用 OpenCode CLI 免费模型。
- CLI 调用失败时，手动校准仍可用，AI 模式显示明确错误。
- 新闻最终分数由固定公式计算，不直接采用模型给出的总分。

## Out of scope

- 用户账号和登录系统。
- 服务端长期归档聊天记录。
