# T1: 新闻源可访问性调研

**类型**: research（AFK）
**状态**: open
**阻塞**: T8（新闻聚类去重规则）, T10（AI prompt 设计）

## Question

从 Cloudflare Workers 运行环境出发（无浏览器、无认证、fetch API 可用），哪些目标新闻源可以直接抓取？哪些需要 API key 或特殊处理？

目标源（来自 Q11=A, Q9=A+C）：
- 微博热搜/话题
- 知乎热榜/相关话题
- B站相关视频/动态
- V2EX
- DeepSeek 官方博客
- GitHub releases（DeepSeek 相关开源项目）
- RSS 源（36氪、机器之心等科技媒体）
- ArXiv

### 需要调研的内容

1. 每个源：是否有公开无认证的 API/RSS 端点可直接 fetch？
2. 每个源：返回数据格式（JSON/RSS/HTML）、是否有反爬（User-Agent检测、频率限制、Cloudflare 防护）？
3. 每个源：从 Cloudflare Workers IP 段访问是否会被拦截？
4. 哪些源无法无认证访问，是否有可替代的聚合源（如百度热搜聚合、RSSHub 等）？
5. 社区讨论热度的量化指标可从哪些源获取（微博话题阅读量？知乎问题关注数？B站播放量？）？

### 输出

每个源一个小节，标注：可直接访问/需要特殊处理/不可行，附访问示例代码和字段示例。
