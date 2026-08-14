# 滑动变祖器

一个「梁系强度校准器」网页小玩具。拖动滑杆，人物会在 31 个等级间连续变化，从「小难梁」一路到戴上帝冕的「梁祖」。

[在线体验](https://lichtspektrum.github.io/liang-intensity-calibrator/)

## 现在能做什么

- 六个状态：小难梁、牢梁、梁子、梁圣、梁神、梁祖
- 滑杆对应 -15 到 +15，视频帧让中间状态平滑过渡
- 每个浏览器保留一张投票，每 3 小时可修改一次；投票后短暂显示剩余冷却时间，随后自动淡出
- 灰色圆点显示社区平均分，滑杆两端显示正向 / 负向投票人数
- 状态行实时显示你的投票、社区平均，以及今日与累计的投票人数
- 每天记录一个社区平均值快照，用于时间线
- 支持鼠标、触摸和键盘，适配桌面和手机浏览器

## 项目结构

前端与视频文件放在 GitHub Pages。Cloudflare Worker 提供 `/api/score`、`/api/vote` 和 `/api/timeline`，投票与每日快照存在 D1。项目不使用 SSR、R2 或新闻采集。

如需本地部署或安装，请使用 coding agent 来了解项目架构等细节。

## 素材与致谢

`media` 与 `public/frames` 里的人像素材用于趣味演示。复用或二次发布前，请确认你拥有相关肖像与素材的使用权。

社区投票功能的最初思路来自 [PR #7](https://github.com/Lichtspektrum/liang-intensity-calibrator/pull/7) 的 [@loggerhead](https://github.com/loggerhead)。
