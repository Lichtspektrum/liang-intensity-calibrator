# [Wayfinder] 社区投票梁氏浓度 + 自动新闻时间线

## Destination

为滑动变祖器增加后端能力：网友每日提交 -15 到 +15 的梁氏浓度投票位置，社区共识分值直接使用同一区间，默认值 0，并按月半衰期向 0 衰减；自动采集 DeepSeek 相关 GitHub releases 和科技媒体 RSS，经 Workers AI 分析后用于冷启动打分和时间线事件标记。当前 UI 使用主滑块提交投票位置，阴影圆点显示社区结果，右侧纵向时间线可回看历史分值。

## Notes

- **技术栈**：Cloudflare Workers + Assets、D1（投票/事件/快照存储）、KV（当前分值/限流/去重）、Cron Triggers（每小时快照和新闻采集）、Workers AI（中文情感分析+事件摘要）。不引入外部 LLM API key。
- **领域语言**：
  - **Voter**：由 fingerprintjs 浏览器指纹标识，同 IP 每天最多 5 票（宽松频率限制，防简单刷票）。
  - **Vote**：每天每人一票，提交 `position` 整数值 `-15..15`，当天内可改投；后端按 `<0 / =0 / >0` 派生负向、中立、正向统计。
  - **Score**：梁氏浓度 `-15..15`，默认 0，由当天独立投票者的平均 `position` 产生，并按月半衰期向 0 衰减。
  - **NewsEvent**：每小时 Cron 采集的新闻，AI 输出极性（-1~+1）+ 影响力（0~1）+ 摘要；同日同类新闻按标题字符重叠做简单聚类。
  - **TimelineMarker**：时间线上的节点，含日期、当时分值、关联事件。从上线第一天开始积累，不回溯历史。
  - **ColdStart**：上线初期投票不足时由新闻情感驱动初始分偏移；投票量足够后投票成为唯一分值驱动，新闻仅用于时间线标记。
- **滑杆行为**：主滑杆既用于浏览也用于提交当天投票位置；阴影圆点显示社区共识分值。
- **实时性**：页面加载取一次分值，不做 WebSocket 实时推送，用户刷新获取最新值。
- **v1 范围**：投票系统 + 自动新闻采集 + 时间线已经进入当前实现；部署目标是 Cloudflare Worker `ds-liang`，域名 `ds.uu0uu.com`。
- **关联**：本 map 是 issue #2（功能建议）的设计分解。

## Decisions so far

（暂无，决策随 tickets 关闭逐步填充）

## Ticket Index

### Frontier（可立即推进）
| # | 标题 | 类型 | 依赖 |
|---|------|------|------|
| T1 | 新闻源可访问性调研 | research | 无 |
| T2 | Workers AI 中文模型能力调研 | research | 无 |
| T3 | 打分算法精确公式 | implemented | 无 |
| T4 | 左侧投票面板 UI 原型 | prototype | 无 |
| T5 | 右侧时间线 UI 原型 | prototype | 无 |
| T6 | 滑杆回弹交互原型 | prototype | 无 |

### Blocked（依赖前置 ticket）
| # | 标题 | 类型 | 依赖 |
|---|------|------|------|
| T7 | D1 数据库 schema 设计 | implemented | T3 |
| T8 | 新闻聚类去重规则设计 | implemented-basic | T1 |
| T9 | 冷启动与投票主导的切换条件 | implemented | T3 |
| T10 | Workers AI prompt 设计 | grilling | T2 |
| T11 | API 契约定义 | implemented | T3, T7, T8, T9 |
| T12 | 前端 fingerprintjs 集成方案 | implemented | T11 |

## Not yet specified

- 是否继续接入微博、知乎、B站、V2EX、DeepSeek 官方博客等更复杂新闻源。
- `daily_votes` 是否继续保留，或在后续 migration 中移除/补齐真实用途。
- 当前新闻聚类是轻量标题字符重叠，后续是否升级为更稳健的内容聚类。

## Out of scope

- **历史数据回溯**（Q17=B）：时间线从上线日开始，不回溯上线前的历史事件。
- **WebSocket 实时推送**（Q14=C）：v1 不做实时更新。
- **外部 LLM API**（Q13=A）：v1 只用 Cloudflare Workers AI。
- **用户账号系统**：不做登录注册，指纹+IP 即身份。
- **历史事件手工录入**（Q17=B）：不手工录入 DeepSeek 过往事件，时间线自然积累。
