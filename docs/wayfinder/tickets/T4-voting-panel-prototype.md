# T4: 投票滑杆 UI 原型

**类型**: implemented
**状态**: done
**阻塞**: 无（但 T11 API 契约依赖投票交互细节）

## Current Implementation

当前实现没有独立的 Up/Down 双按钮面板。投票交互合并进主滑杆：

- 主滑杆范围为 `0-30`，`step=1`，表示用户当天要提交的投票位置。
- 阴影圆点 `.community-ghost-thumb` 表示当前社区共识分值。
- 左右两侧显示低强度和高强度累计票值：`downVotePoints` / `upVotePoints`。
- 用户改变滑杆并触发 `change` 后提交投票。
- 当天再次滑动会修改自己的投票位置。
- 投票位置 `<15` 归为低强度/Down，`>=15` 归为高强度/Up。

## UI Elements

- `.slider-vote-layout`
- `.vote-total--down`
- `.vote-total--up`
- `.community-ghost-thumb`
- `.strength-slider`
- `.vote-status`

## Mobile Behavior

移动端沿用主控制面板布局，不再需要单独处理左右投票侧栏。
