# EMBY_CF · Emby / Jellyfin 反向代理

Cloudflare Workers + D1，个人版与多人版独立部署，共享播放代理内核。保留原生媒体流、Range、签名 URL 和取消行为，不预取整部视频，也不承诺公网加速。

| 发行版 | 当前版本 | 可直接复制部署的文件 | 图文教程 |
| --- | --- | --- | --- |
| 个人版 | `v6.4.9-refactor.8` | [personal/worker.js](personal/worker.js) | [个人版部署教程](docs/个人版部署教程.md) |
| 多人版 | `v6.8.11-multi-refactor.3` | [worker.js](worker.js) | [多人版部署教程](docs/多人版部署教程.md) |

**新手先看 [部署总指南](DEPLOY.md)**。已有站点先看 [升级与回滚](docs/UPGRADE.md)，不要重新建库、覆盖域名或混用两版数据库。

## 离线教程

- 两篇 Markdown 的插图都存放在 [docs/assets/deploy/](docs/assets/deploy/)，无金山文档／图床外链；下载整个仓库后仍能看图。
- [个人版单文件 HTML](docs/offline/personal.html) · [多人版单文件 HTML](docs/offline/multi.html)：在 GitHub 文件页点 **Raw / Download raw file** 保存，双击即可离线阅读；图片、样式全部内嵌，不需要本地服务。
- 注册、控制台操作和下载软件本身仍需联网。“离线”仅指阅读教程不需要联网。
- 教程依据作者提供的图文稿更新；截图中的账号、凭据和验证命令已遮盖，操作文字按当前版本修订。

## 两版如何选

| 能力 | 个人版 | 多人版 |
| --- | --- | --- |
| 后台路由、诊断、复制、筛选、导入预检 | 支持 | 支持，按角色／归属限制 |
| 网页改密、加密 TG 保存／测试／停用、保密告警 | 支持 | 支持，按账号撤销会话 |
| VPS 中继 | 全局配置 + 每条线路「自动／开／关」 | 保留全局开关，不提供逐线路三模式 |
| 用户／邀请／配额／子域名 | 无 | 支持 |
| 独立推流地址及 PlaybackInfo 映射 | 不使用多人版映射模型 | 支持 |

中继可选，不配 VPS 也能使用登记线路。不能把个人版认证、密钥、证书或 D1 复制到多人版。

## 代理与安全边界

- GET/HEAD 有界故障切换；最多 3 个主目标、5 次重定向、9 次出站。响应头单次 10 秒／总计 20 秒预算，拿到响应头后不按此计时器截断长视频。
- 登录／PlaybackInfo 白名单 POST 仅在明确 401/403/451、完整可重放请求体时尝试一次 VPS；最多 256 KiB／5 秒。不因超时、连接故障或 5xx 重放写请求，不中途重发成功视频流。
- 回退成功后实例内优先 VPS 2 分钟，由并发受限只读请求探测恢复；多人版按用户隔离。详见 [自动回退说明](docs/AUTO-RELAY-FAILOVER.md)。
- Range / If-Range / HEAD / 206 / 416 保真；跳转逐跳检查，跨域剥离凭据，保留签名编码和重复查询参数。
- 私有资源不进共享缓存；后台 Cookie 不转给源站；任意原始 URL 转发默认关闭，日常请用登记线路。
- Bot **只做通知**，不加入入站管理，也不接管现有 webhook。实际起播、拖动、长播、字幕和通知送达需自行验收。

## 本地构建与测试

需要 Node.js **>=22.14**：

```bash
npm ci
npx playwright install --with-deps chromium
npm run check
npm run package:workers
npm run docs:build
```

- 可维护源码：`src/`、`web/`；构建到 `dist/personal.mjs` / `dist/multi.mjs`。
- `npm run package:workers` 同步根目录 `worker.js` 和 `personal/worker.js`，方便网页粘贴部署。**不要直接编辑生成的单文件。**
- 历史回归基线单独保存在 `tests/baselines/`，不再占用最新代码下载路径。
- `npm run docs:build` 只读取本地 Markdown 和图片，生成内嵌图片 HTML，不下载网络内容。
- `npm run preview` 仅绑定 `127.0.0.1`：个人版 `4273/__preview`、多人版 `4274/__preview`。合成上游与独立 D1，不可直接暴露公网。
- GitHub Actions 只做检查和打包，**不会自动部署 Cloudflare**。Wrangler 占位模板必须复制成本地配置并核对后再用。

## VPS 中继源码

最新加固源码和测试见 [relay/](relay/README.md)，支持 TLS、HMAC、Range、WebSocket 和既有 HLS 路径。

`personal/relay.go`、`personal/bin/` 和旧 `personal/deploy_vps.sh` 是历史 0.3.0 方案，不是加固版交付；不要用旧一键脚本覆盖已有服务。升级中继前先备份配置和二进制，并安排维护窗口。

## 验收与文档

两版发布基准：339 项自动测试、20 项浏览器测试、130 项多人版全库隔离检查通过，依赖审计零漏洞。文档／打包调整后的复验结果见 [GitHub 发布说明](docs/GITHUB-PUBLISH.md)。这些结果不是实际媒体播放速度或长期可用性的保证。

- [通知加密与密码安全](docs/WEB-NOTIFICATIONS-SECURITY.md)
- [多轮修复同步清单](docs/MULTI-SYNC-CHECKLIST.md)
- [个人版验收记录](docs/PERSONAL-PUBLIC-ACCEPTANCE.md) · [多人版验收／回滚记录](docs/MULTI-PUBLIC-ACCEPTANCE.md)
- [构建 manifest](docs/BUILD-MANIFEST.json) · [版本发布 manifest](docs/RELEASE-MANIFEST-20261124.json)
- [开发交接](HANDOFF.md) · [历史线下验收与性能边界](docs/OFFLINE-ACCEPTANCE.md)

## 使用须知

仅代理你有权访问的服务；遵守 Cloudflare、域名商和上游条款，留意 Workers / D1 / VPS 的配额与计费。Cloudflare 免费套餐不等于无限视频带宽。请勿提交 Token、Cookie、密码、证书私钥、生产数据库或用户日志。

MIT License；教程截图由作者提供，仅用于本项目部署说明。优选域名监控：<https://yx.255432.xyz/>。
