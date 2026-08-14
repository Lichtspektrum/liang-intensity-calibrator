# 滑动变祖器

一个「梁系强度校准器」网页小玩具。拖动滑杆，人物会在 31 个等级间连续变化，从「小难梁」一路到戴上帝冕的「梁祖」。

[在线体验](https://lichtspektrum.github.io/liang-intensity-calibrator/)

## 现在能做什么

- 六个状态：小难梁、牢梁、梁子、梁圣、梁神、梁祖
- 滑杆对应 -15 到 +15，视频帧让中间状态平滑过渡
- 每个浏览器保留一张投票，每 3 小时可修改一次
- 阴影圆点显示当前有效投票的平均值
- 每天记录一个社区平均值快照，用于时间线
- 支持鼠标、触摸和键盘，适配桌面和手机浏览器

## 项目结构

前端与视频文件放在 GitHub Pages。Cloudflare Worker 只提供 `/api/score`、`/api/vote` 和 `/api/timeline`，投票与每日快照存在 D1。项目不使用 SSR、R2 或新闻采集。

## 本地运行

需要 Node.js 22 或更高版本。

```bash
git clone https://github.com/Lichtspektrum/liang-intensity-calibrator.git
cd liang-intensity-calibrator
npm install
```

先生成 32 字节的本地随机密钥：

```bash
openssl rand -hex 32
```

复制输出结果，在项目根目录新建 `.dev.vars`：

```dotenv
VOTER_HASH_SECRET=粘贴刚才生成的结果
```

`.dev.vars` 已被 Git 忽略，不要提交它。打开两个终端：

```bash
# 首次运行时先创建本地 D1 表
npx wrangler d1 migrations apply DB --local

# 终端 1：API，默认 http://127.0.0.1:8787
npm run dev:worker

# 终端 2：页面
VITE_API_BASE_URL=http://127.0.0.1:8787 npm run dev
```

终端显示的地址就是本地页面。常用检查命令：

```bash
npm test -- --run       # 单元测试
npm run test:e2e        # 桌面与手机浏览器测试
npm run build           # 检查 Worker 构建
npm run build:pages     # 构建 GitHub Pages
npm run media:posters   # 从源 PNG 生成 WebP 首帧
```

## 准备云端配置

下面操作只需在首次发布前做一次。这个仓库已准备好工作流，不会因为提交代码自动发布 Worker。

1. 登录 Cloudflare，在本地运行 `npx wrangler login`。
2. 运行 `npx wrangler d1 create liang-intensity-db`。如果你部署自己的副本，把返回的 `database_id` 写入 `wrangler.json`，替换仓库中现有项目的数据库 ID。
3. 再运行一次 `openssl rand -hex 32`，复制新结果。运行 `npx wrangler secret put VOTER_HASH_SECRET`，按提示粘贴。它只保存在 Cloudflare，不要写进 GitHub。
4. 在 Cloudflare 的 `Manage Account → Account API Tokens` 从「Edit Cloudflare Workers」模板创建 Token。保留 `Workers Scripts: Edit` 和 `D1: Edit` 权限，Account Resources 只选这个项目使用的 Cloudflare 账户。在 GitHub 仓库的 `Settings → Secrets and variables → Actions` 添加两个 Repository secret：`CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID`。
5. 在同一页的 Variables 添加 `VITE_API_BASE_URL`，值填 Worker 的完整 HTTPS 地址，例如 `https://liang-intensity-api.<你的子域名>.workers.dev`。不要在末尾加 `/`。

运行发布工作流前，确认 `wrangler.json` 里的 `database_id` 指向你刚创建的 D1 数据库。直接复用仓库里的 ID 会因账户不匹配而失败。

缺少 secret 或 repository variable 时，对应工作流会在 migration 或 Pages 构建前失败，不会用空地址发布。

Pages 在 `main` 分支更新后自动发布。Worker 需要在 GitHub Actions 中手动运行「Deploy API Worker」；工作流会先跑测试和构建，再应用 D1 migration 并发布 Worker。

## 回滚

页面出现问题时，在 GitHub Actions 里找到上一次正常的「Deploy GitHub Pages」记录并重新运行。Worker 可在 Cloudflare 控制台的部署记录中选择上一个版本回滚。已成功应用的 D1 migration 会保留，即使后续 Worker 发布失败也不会自动撤销。所以新 migration 必须与上一个 Worker 版本兼容；改表结构前先备份，出问题时再用一个新 migration 修正。

## 素材与致谢

`media` 与 `public/frames` 里的人像素材用于趣味演示。复用或二次发布前，请确认你拥有相关肖像与素材的使用权。

社区投票功能的最初思路来自 [PR #7](https://github.com/Lichtspektrum/liang-intensity-calibrator/pull/7) 的 [@loggerhead](https://github.com/loggerhead)。
