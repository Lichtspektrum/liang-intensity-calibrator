# T12: 前端 fingerprintjs 集成方案

**类型**: implemented
**状态**: done
**依赖**: T11（API 契约）
**阻塞**: 无

## Current Implementation

- 使用 `@fingerprintjs/fingerprintjs` 开源版。
- 前端在 `src/main.ts` 初始化 fingerprint，并在投票时随请求发送。
- 本地存储 key：`liang-slider:vote-position:<date>`，用于记住当天用户投票位置。
- 请求体为 `{ fingerprint, position }`。

## Server-Side Contract

- `fingerprint` 必须是字符串，长度 `8-128`。
- 每日唯一键是 `fingerprint + date`。
- 同一天重复提交会更新旧投票位置。
- Worker 从 `CF-Connecting-IP` 读取客户端 IP，并用 hash 后的 IP 做每日新增投票者限流。
- 本地开发环境跳过 IP 限流。

## Notes

- 当前没有 Fingerprint Pro。
- 当前没有独立隐私声明页面。
- 如果 fingerprint 初始化失败，前端使用 fallback 字符串，以保证投票流程可继续。
