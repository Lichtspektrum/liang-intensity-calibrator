# T6: 滑杆回弹/历史模式交互

**类型**: partially-implemented
**状态**: partial
**阻塞**: 无

## Current Implementation

当前主 UI 中，滑杆同时承担浏览和投票提交：

- `input` 时进入 `previewing-vote`，显示用户正在选择的投票位置。
- `change` 时提交当前整数位置作为当天投票。
- 社区共识分值通过阴影圆点显示，而不是每次松手自动把主滑杆回弹过去。
- 点击时间线节点进入 `viewing-history`，显示历史 level。
- 点击“回到实时”退出历史模式，并回到社区共识分值。

## Existing Pure State Helper

`src/community-state.ts` 仍保留了更通用的状态机和 600ms ease-out snapback 纯函数：

- `idle`
- `browsing`
- `snapping-back`
- `viewing-history`

但当前 `src/app.ts` 主 UI 没有完整采用这套 snapback 动画作为交互主路径。

## Follow-Up

如果后续要恢复“浏览后自动回弹到社区值”的体验，需要重新决定它和“滑杆即投票”的关系，避免用户拖动浏览时误提交投票。
