# T12: 前端 fingerprintjs 集成方案

**类型**: task（AFK）
**状态**: open
**依赖**: T11（API 契约）
**阻塞**: 无（前端实现的前置准备）

## Question

确定 fingerprintjs 的集成方式。

### 需要决策的

1. **包选择**：`@fingerprintjs/fingerprintjs`（开源免费版）vs Fingerprint Pro（付费，更准确）？玩票性质默认开源版足够。
2. **加载策略**：
   - npm 包打包进 bundle？（增加包体积但零额外请求）
   - CDN 动态加载？（不增加初始包体积，投票时才加载）
   - 考虑到页面需要在加载时就知道 fingerprint（用于"今天是否已投过票"的状态显示），可能需要尽早加载。
3. **隐私考量**：fingerprintjs 的 hash 不上传任何个人信息，只在投票时发送 hash 值。是否需要隐私声明？
4. **容错**：fingerprintjs 加载失败时（隐私浏览器、反指纹扩展），是否允许投票？降级到纯 IP 限流？
5. **IP 获取**：Worker 端如何获取客户端 IP（`request.headers.get('CF-Connecting-IP')`），需要在 Cloudflare 部署时验证可用。
