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

本项目源代码以 [MIT 协议](LICENSE) 发布。

`media` 与 `public/frames` 里的人像素材用于趣味演示，**素材不随 MIT 协议共享**。复用或二次发布前，请确认你拥有相关肖像与素材的使用权。

社区投票功能的最初思路来自 [PR #7](https://github.com/Lichtspektrum/liang-intensity-calibrator/pull/7) 的 [@loggerhead](https://github.com/loggerhead)。

---

## Awesome Sliders

这里收集社区基于「滑动变祖器」的二创作品。把滑杆玩出花样的朋友们，欢迎通过 [Pull Request](https://github.com/Lichtspektrum/liang-intensity-calibrator/pulls) 提交你的项目：

- [Liang-Saint-Slider](https://github.com/BruzWJ/Liang-Saint-Slider) — by [@BruzWJ](https://github.com/BruzWJ)：把滑杆做成 DeepSeek Harness 的模型与思考强度选择器。
- [liang-intensity-calibrator-ascii](https://github.com/Lichtspektrum/liang-intensity-calibrator-ascii) — by [@Lichtspektrum](https://github.com/Lichtspektrum)：ASCII 版，由原项目 31 张关键帧逐帧转出的纯 ASCII 动画。
- [dsh-liang-skin](https://github.com/kingOfSoySauce/dsh-liang-skin) — by [@kingOfSoySauce](https://github.com/kingOfSoySauce)：DeepSeek Harness 滑动变阻器皮肤。
- [dsh-liang-watch](https://github.com/huangmouren2023/deepseek-harness-toolkit/tree/main/tools/dsh-liang-watch) — by [@huangmouren2023](https://github.com/huangmouren2023)：DeepSeek Harness 梁强度雷达——把社区投票与每日时间线变成模型工具和侧边栏面板，可在对话里直接查分、投票、看趋势。
