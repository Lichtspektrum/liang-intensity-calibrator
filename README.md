# 滑动变祖器

一个「梁系强度校准器」网页小玩具。拖动滑杆，人物会在 31 个等级间连续变化；也可以根据当天 AI 新闻自动校准，或输入文字获得基于梁文锋公开表达框架的回答。

## 功能

- 六个状态：小难梁、牢梁、梁子、梁圣、梁神、梁祖
- 滑杆范围为 -15 到 +15，支持鼠标、触摸和键盘
- 本机记忆上一次手动校准位置
- 新闻模式：采集当天 AI 新闻，再按原创、开放、效率、智能与克制五个维度校准；搜索提示词会专门覆盖 DeepSeek 主要竞争对手（千问/智谱/Kimi/豆包/MiniMax/文心/混元/OpenAI/Anthropic/Google/Meta/xAI/Mistral 等）的当日动态
- 新闻采集显示真实分阶段进度、来源计数、耗时和详细事件；完成后在校准结论旁以安全 Markdown 展示新闻
- 对话模式：连续保留上下文，校准输入，并以梁文锋第一人称角色和公开材料提炼出的思考框架回答
- 对话历史：每个对话保留在侧边栏，可查看、继续或删除；每次回答都会记录当时的强度分值与阶段，重新打开对话时变阻器回到最后一次回答的分值
- 所有需要 LLM 的搜索、分析和回答均通过本地 OpenCode CLI，默认使用 `opencode/deepseek-v4-flash-free`；可用环境变量 `OPENCODE_MODEL` 自定义模型（如免费额度用尽时切到 `opencode-go/deepseek-v4-flash`，可在 `.env.local` 中设置）
- 对话面板提供模型选择器：自动执行 `opencode models` 发现可用模型（参考 super-opencode 的做法），选中后随对话请求生效并保存在本机；也可用 `npm run opencode:models` 在命令行查看可用模型列表

模型不需要 API key。新闻搜索可调用 OpenCode 的 `websearch` 与 `webfetch`，分析和对话可读取项目内提炼的梁文锋 skill。

## 本地启动

需要 Node.js 24 或更高版本。

```bash
git clone https://github.com/Lichtspektrum/liang-intensity-calibrator.git
cd liang-intensity-calibrator
npm install
```

启动：

```bash
npm start
```

然后打开 `http://127.0.0.1:5173/`。一个命令会同时启动网页和本地 API。SQLite 数据保存在 `.data/liang.sqlite`，首次启动时自动应用 `migrations/` 中的迁移。

OpenCode 不是常驻服务：只有进入新闻模式或提交聊天时，API 才启动一次 `opencode run`；任务完成后 CLI 进程立即退出。空闲时没有模型进程。

梁式对话固定使用 OpenCode `--variant low`。若草稿泄露 OpenCode、模型或助手身份，服务会自动严格改写一次；仍然跳出角色则不会把该答案展示给用户。

常用检查：

```bash
npm test -- --run
npm run test:e2e
npm run build
```

## 架构

- Vite 提供前端页面。
- `src/server.ts` 是普通 Node HTTP API。
- `node:sqlite` 保存每日快照、新闻缓存、聊天限流计数和对话历史（每个回答附带分值）。
- `src/opencode-runner.ts` 按需调用项目本地安装的 OpenCode CLI。
- `server/opencode-runtime/` 只允许梁文锋 skill、`websearch` 与 `webfetch`；文件编辑、shell 和其他工具均被禁用。

新闻采集参考 `wanshi-tong` 科技新闻模块的思路，但只保留 AI 范围：Hacker News、arXiv、官方 GitHub releases，以及 OpenCode 中英双路 `websearch → webfetch`。采集结果会校验发布日期、合并去重，再交给已加载梁文锋 skill 的专用分析模块。模型只输出五维证据，最终 -15 到 +15 分数由固定权重计算。

## 发布

静态页面仍可发布到 GitHub Pages，但新闻和对话需要一台能运行 Node.js、SQLite 与 OpenCode CLI 的主机。Node API 可通过反向代理提供 HTTPS；它会在收到 AI 请求时直接启动本机 CLI，不需要单独部署模型网关。

## 材料与致谢

人像素材用于趣味演示；复用或二次发布前，请确认相关肖像与素材的使用权。

- AI 新闻采集结构参考 [wanshi-tong](https://github.com/Pawnnwap/wanshi-tong)
- 人物框架提炼方法参考 [nuwa-skill](https://github.com/alchaincyf/nuwa-skill)
- 主要公开材料使用 [36氪·暗涌 2024 年专访](https://www.36kr.com/p/2872793466982535)
