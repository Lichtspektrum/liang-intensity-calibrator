# 阶段背景字字体（子集 WOFF2）

每个文件是用对应字体**按阶段词子集化**后的 WOFF2（每个仅含该阶段词所需字形），
由 Vite 打包进构建产物。源字体位于仓库外的 `E:\pyprojects\选中字体`（manifest.json 标注）。

## 映射

| 文件 | data-stage | 阶段词 | 源字体 | 许可 |
|---|---|---|---|---|
| `stage-00.woff2` | 0 | 小难梁 | 大宝桃桃体（设计：時光羊） | SIL OFL 1.1 |
| `stage-01.woff2` | 1 | 牢梁 | 丁烈傩言 dinglienuoyanfont（© MiaoKeming） | 版权保留，无内嵌许可 |
| `stage-02.woff2` | 2 | 梁子 | 思源宋体 Noto Serif SC（© 2017-2023 Adobe；取 wght=900 实例） | SIL OFL 1.1 |
| `stage-03.woff2` | 3 | 梁圣 | 龙藏体 Long Cang（© 2018 The LongCang Project Authors） | SIL OFL 1.1 |
| `stage-04.woff2` | 4 | 梁神 | 马善政毛笔楷书 Ma Shan Zheng（© 2018 The MaShanZheng Project Authors） | SIL OFL 1.1 |
| `stage-05.woff2` | 5 | 梁祖 | 全字库说文解字（CMEX，台湾教育部全字库） | 教育部全字库（免费使用） |

- `stage-02.woff2` 为可变字体思源宋体按 `wght=900` 实例化后子集（保持背景大字原有的粗重观感）。
- `stage-05.woff2` 源字体含位图字模（bdat/bloc），子集化时自动丢弃，仅保留矢量轮廓，已校验字形齐全。

## 许可

5 个 OFL 字体的再分发须附带 `OFL.txt`（SIL OFL 1.1）及上方版权声明；已随本目录提供。
全字库说文解字不在 OFL 之下，按「台湾教育部全字库（免费使用）」条款使用，免费可再分发。
**丁烈傩言（stage-01）**：字体元数据仅声明 `All rights reserved by MiaoKeming`，无内嵌开源许可，
再分发范围请自行与版权方确认；本仓库仅嵌入其子集，未改动原始设计。

## 重新生成

需要 Python 3 + fontTools（含 brotli）：

```powershell
python scripts/fonts/build-webfonts.py
```

默认读取 `E:\pyprojects\选中字体`；可用参数覆盖源目录。生成后请人工核对字形。
