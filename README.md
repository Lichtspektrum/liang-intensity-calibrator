我根本不懂我在做什么，下面这些也不是我写的……

# 滑动变祖器

一个把鼠标滑杆做成「梁系强度校准器」的网页小玩具。拖动滑杆，人物会在 31 个等级图片中变化，从「小难梁」一路进化到佩戴帝冕的「梁祖」。

[在线体验](https://ds.uu0uu.com/)

## 有什么

- 31 个整数等级与 31 张 WebP 首帧一一对应，连续变化由视频帧驱动
- 六个状态：小难梁、牢梁、梁子、梁圣、梁神、梁祖
- 社区共识分值使用 -15 到 +15 区间，默认 0；主滑块提交当天投票位置，阴影圆点显示社区结果
- Worker SSR 读取当前分值并输出对应 WebP 首帧与初始状态，浏览器不再重复请求初始 `/api/score`
- WebM/MP4 存储在 Cloudflare R2，由 Worker 按 HTTP Range 返回视频片段
- `/api/score`、`/api/vote`、`/api/timeline` 与页面同域部署
- Cloudflare D1 存储投票、新闻事件和时间线快照，KV 存储当前分值、IP 限流和新闻 URL 去重
- Cloudflare Cron 每小时记录当天快照并采集相关新闻
- 支持鼠标、触摸和键盘操作
- 适配桌面与手机浏览器

## 本地运行

需要 Node.js 22 或更高版本。

```bash
git clone https://github.com/Lichtspektrum/liang-intensity-calibrator.git
cd liang-intensity-calibrator
npm install
npm run dev
```

终端会显示本地访问地址，通常是 `http://localhost:5173`。

## 常用命令

```bash
npm test             # 单元测试
npm run test:e2e     # 浏览器交互测试
npm run build        # 构建 Cloudflare Worker + Assets 发布文件
npm run media:posters # 从源 PNG 生成 WebP 首帧
npm run media:upload  # 上传 WebM/MP4 到生产 R2
npx wrangler deploy  # 部署到 Cloudflare
```

## 重新生成等级图片

项目使用免费的 [RIFE ncnn Vulkan](https://github.com/nihui/rife-ncnn-vulkan) 生成中间帧，FFmpeg 负责缩放和抽帧。需要准备 RIFE v4.6 模型，并安装 `ffmpeg`、`ffprobe`。

```bash
# 生成两段 800×800、49 帧画质原型
RIFE_BIN=/绝对路径/rife-ncnn-vulkan \
  bash scripts/video/build-prototype.sh

# 生成完整插帧素材
RIFE_BIN=/绝对路径/rife-ncnn-vulkan \
  bash scripts/video/build-full-video.sh
```

源 PNG 位于 `media/source-frames`。运行 `npm run media:posters` 后生成
`public/frames/frame-00.webp` 到 `frame-30.webp`，图片编号由四舍五入后的
`score + 15` 得到。Worker SSR 只输出当前分值对应的一张 WebP；客户端随后加载
`media/liang-evolution.webm`，不再按等级请求图片。MP4 是不支持 VP9 WebM
浏览器的后备视频格式。

## 发布

项目部署到 Cloudflare Workers，项目名为 `ds-liang`，自定义域为 `ds.uu0uu.com`。前端静态资源与 `/api/*` 路由由同一个 Worker 提供，配置位于 `wrangler.json`。

首次部署或新建数据库后需要先执行 D1 migration：

```bash
npx wrangler d1 migrations apply ds-liang-db --remote
npx wrangler r2 bucket create ds-liang-media
npm run media:upload
npm run build
npx wrangler deploy
```

R2 bucket 已存在时无需重复创建。`MEDIA` binding 与
`assets.run_worker_first` 配置在 `wrangler.json`：后者确保首页和视频请求先进入
Worker，从而执行 SSR 与规范的 `206 Partial Content` Range 响应。

## 素材说明

`media` 与 `public/frames` 内的人像素材用于本项目的趣味化演示。复用或二次发布前，请确认你拥有相关肖像与素材的使用权。
