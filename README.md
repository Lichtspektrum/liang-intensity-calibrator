我根本不懂我在做什么，下面这些也不是我写的……

# 滑动变祖器

一个把鼠标滑杆做成「梁系强度校准器」的网页小玩具。拖动滑杆，人物会在 31 张独立帧图之间切换，从「小难梁」一路进化到佩戴帝冕的「梁祖」。

[在线体验](https://lichtspektrum.github.io/liang-intensity-calibrator/)

## 有什么

- 31 级滑动颗粒度，每一级对应一张单独的人像帧图
- 六个状态：小难梁、牢梁、梁子、梁圣、梁神、梁祖
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
npm run build:pages  # 构建 GitHub Pages 发布文件
```

## 发布

项目使用 GitHub Actions 自动发布。向 `main` 分支推送提交后，工作流会构建 `dist-pages` 并更新 GitHub Pages。

## 素材说明

`public/frames` 内的人像帧图用于本项目的趣味化演示。复用或二次发布前，请确认你拥有相关肖像与素材的使用权。
