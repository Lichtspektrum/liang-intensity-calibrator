# 滑动变祖器

一个「梁系强度校准器」网页小玩具。拖动滑杆，人物会在 31 个等级间连续变化；也可以根据近 3 天的 AI 新闻自动校准，或输入文字获得基于梁文锋公开表达框架的回答。

> 本仓库是 [Lichtspektrum/liang-intensity-calibrator](https://github.com/Lichtspektrum/liang-intensity-calibrator)（原项目：手动模式滑杆）的魔改分支。分支新增了 AI 新闻校准、梁式对话、对话历史与本地 Node + SQLite 服务，架构与原项目已有大量不同，不保证兼容。

## 功能

- 六个状态：小难梁、牢梁、梁子、梁圣、梁神、梁祖
- 滑杆范围为 -15 到 +15，支持鼠标、触摸和键盘
- 本机记忆上一次手动校准位置
- 新闻模式：采集近 3 天（含当日）的 AI 新闻，再按原创、开放、效率、智能与克制五个维度校准；搜索提示词会专门覆盖 DeepSeek 主要竞争对手（千问/智谱/Kimi/豆包/MiniMax/文心/混元/OpenAI/Anthropic/Google/Meta/xAI/Mistral 等）的动态，并优先核验已确认可用的官方来源（Qwen/智谱/Kimi/DeepSeek/MiniMax/阶跃星辰官网与 ModelScope）
- 新闻采集显示真实分阶段进度、来源计数、耗时和详细事件；完成后在校准结论旁以安全 Markdown 展示新闻
- 对话模式：连续保留上下文，校准输入，并以梁文锋第一人称角色和公开材料提炼出的思考框架回答；遇到最新事实类问题可联网核实（websearch/webfetch）后自然带出，仍保持角色不泄露工具身份
- 对话历史：每个对话保留在侧边栏，可查看、继续或删除；每次回答都会记录当时的强度分值与阶段，重新打开对话时变阻器回到最后一次回答的分值
- 对话面板提供模型选择器：自动执行 `opencode models` 发现可用模型，选中后随对话请求生效并保存在本机；也可用 `npm run opencode:models` 在命令行查看可用模型列表

所有需要 LLM 的搜索、分析和回答均通过本地 OpenCode CLI，默认使用 `opencode/deepseek-v4-flash-free`，可用环境变量 `OPENCODE_MODEL` 自定义（如免费额度用尽时切到 `opencode-go/deepseek-v4-flash`）。

## 本地启动

需要 Node.js 24 或更高版本。

```bash
git clone https://github.com/Pawnnwap/liang-intensity-calibrator.git
cd liang-intensity-calibrator
npm install
cp .env.example .env.local   # 可选：按需修改配置
npm start
```

然后打开 `http://127.0.0.1:5173/`。一个命令会同时启动网页和本地 API。SQLite 数据保存在 `.data/liang.sqlite`，首次启动时自动应用 `migrations/` 中的迁移。

### 环境变量

见 [`.env.example`](.env.example)。关键项：

| 变量 | 说明 | 默认 |
|---|---|---|
| `VOTER_HASH_SECRET` | 社区投票指纹哈希密钥，生产环境必须改 | 本地占位值 |
| `ALLOWED_ORIGINS` | 允许跨域访问 API 的页面来源 | `http://127.0.0.1:5173,http://localhost:5173` |
| `API_HOST` / `API_PORT` | API 监听地址与端口 | `127.0.0.1` / `8787` |
| `DATA_DIRECTORY` | SQLite 数据目录 | `.data` |
| `OPENCODE_MODEL` | 覆盖默认 opencode 模型 | `opencode/deepseek-v4-flash-free` |
| `VITE_API_BASE_URL` | 前端构建时指向 API 的绝对地址（静态部署需要） | 无 |

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
- `src/opencode-runner.ts` 按需调用项目本地安装的 OpenCode CLI；`OPENCODE_MODEL` 与前端模型选择器可切换模型。
- `server/opencode-runtime/` 只允许梁文锋 skill、`websearch` 与 `webfetch`；文件编辑、shell 和其他工具均被禁用。

新闻采集参考 `wanshi-tong` 科技新闻模块的思路，但只保留 AI 范围：Hacker News、arXiv、官方 GitHub releases，以及 OpenCode 中英双路 `websearch → webfetch`。采集结果会校验发布日期（3 天窗口）、合并去重，再交给已加载梁文锋 skill 的专用分析模块。模型只输出五维证据，最终 -15 到 +15 分数由固定权重计算。

## 发布

静态页面仍可发布到 GitHub Pages，但新闻和对话需要一台能运行 Node.js、SQLite 与 OpenCode CLI 的主机。Node API 可通过反向代理提供 HTTPS；它会在收到 AI 请求时直接启动本机 CLI，不需要单独部署模型网关。

## 材料与致谢

人像素材用于趣味演示；复用或二次发布前，请确认相关肖像与素材的使用权（素材不属于本仓库）。

- 原项目（手动模式）作者：Lichtspektrum [liang-intensity-calibrator](https://github.com/Lichtspektrum/liang-intensity-calibrator)
- 人物框架提炼方法参考 [nuwa-skill](https://github.com/alchaincyf/nuwa-skill)
- AI 新闻采集结构参考 [wanshi-tong](https://github.com/Pawnnwap/wanshi-tong)

## 许可证

见 [LICENSE](LICENSE)：继承自原仓库的代码未声明许可（保留所有权利，归原作者）；本分支新增代码采用 MIT；人像/视频素材不属于本仓库，不予授权。
