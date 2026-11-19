# 重构前调研 · 2026-11-19

## 基线与范围

- 原项目 `Dirige/EMBY_CF`，提交 `4e0357e`：个人版 v6.4.9、多用户版 v6.8.11-multi。
- 在独立目录开发，不覆盖 `/home/ubuntu/emby反代` 中已有的 7.0.0 实现。
- 本地验收阶段不上传 GitHub、不触碰 Cloudflare 生产配置、不连接真实媒体服务器。
- 保留个人版毛玻璃设计、两版现有代理行为与旧中继协议；行为调整必须单独注明和测试。

## 已查阅来源

| 来源 | 固定提交 | 借鉴与边界 |
| --- | --- | --- |
| [CF-EMBY-PROXY-UI](https://github.com/axuitomo/CF-EMBY-PROXY-UI) | `5a310b75fb5b5a713b050658639434ddc94d7d57` | 阅读 architecture、proxy-internals、http-body 与代理实现。借鉴控制面/数据面分层、有界读写、明确的构建输入。不照搬跨用户忽略鉴权查询的缓存建议，也不沿用编译产物字符串补丁链。MIT。 |
| [玛卡巴卡 EmbyProxy-VPS](https://github.com/MakkaPakka518/EmbyProxy-VPS) | `ea44bcff493b78f45346799849c8b9f494781e42` | 阅读 server.js 的 proxyOnce、handleProxy、取消与背压实现。借鉴媒体 URL 保真和下游关闭后释放上游。不复制源码：仓库未声明许可证。 |
| [玛卡巴卡 ProxyHub_Emby](https://github.com/MakkaPakka518/ProxyHub_Emby) | `0adc422189b39f5c9e14148d2f61915dd100dac6` | 结合先前已读明文 Worker，核对目标域根路径 Referer、不同头模式。只参考设计，不复制未授权源码。 |
| [HR emby---worker](https://github.com/chenhr454/emby---worker) | `26f7c33cd5eceec7f75a88a99b60765c413dadb1` | 阅读鉴权、路由、403 重试和 __raw__ 分支。借鉴功能边界，不引入四次重试、HTTPS 自动降级或任意主机 raw 代理。MIT。 |
| [CF-Emby-Proxy](https://github.com/fast63362/CF-Emby-Proxy) | `e840cd1eee698cf1267703d4439b2154f291012b` | 阅读完整短 Worker。保留简洁透传思路，不引入固定强制 Referer、私密 API 共享缓存、Connection: close 等缺少验证的策略。未声明许可证，不复制源码。 |
| [Emby-Mate](https://github.com/irm123gard/Emby-Mate) | `1ac1dc7928ba46a4888dc1c550df9da616c2cd5c` | 只阅读 README：学习已知长度/206 兼容、重定向缓存隔离等关注点；未把文档中的性能描述当作已验证事实。 |
| [Cloudflare Streams 官方文档](https://developers.cloudflare.com/workers/runtime-apis/streams/) | 2026-11-19 在线查阅 | 不读取响应 body 时，原生流转发已经是合适路径；不为了“计速”无条件加 tee、drain、全量缓冲。 |

## 取舍

1. 先锁定旧行为再拆模块；重构不等于换 Referer、修改中继模式或强制改变网盘策略。
2. 公共规则、HTTP 工具、主题共享；不同的登录/权限、数据库与代理编排仍按版本隔离。
3. 两版共享个人版原有 CSS、主题与背景层；多人版保留用户/邀请等专属控件。
4. 源码是构建输入，单文件 Worker 是产物。固定依赖、输出哈希，不对线上 bundle 打文本补丁。
5. 本地采用 Workers 模拟器与两套独立 SQLite/D1；只使用合成数据，统计未接入显示不可用，不伪造速度与流量。
6. 使用模拟响应验证 Range/HEAD/206/重定向、用户隔离、页面交互；不从模拟测试推断真实起播速度。

## 备份

重构前备份位于 `/home/ubuntu/emby-backups/20261119T095945Z/`：完整原仓库压缩包、可验证 Git bundle、已有个人版线上脚本快照及 SHA-256 清单。不包含生产数据库或凭据。
