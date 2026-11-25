# 个人版 · 单用户与可选 VPS 中继

当前：`v6.4.9-refactor.8`。可直接部署 [worker.js](worker.js)，可维护源码在 `../src/editions/personal/` 和 `../web/personal/`。

- **新手图文**：[个人版部署教程](../docs/个人版部署教程.md)，依据作者图文稿更新，图片全部本地化并脱敏。
- **离线阅读**：[单文件 HTML](../docs/offline/personal.html)，下载后双击打开，图片无需网络。
- **完整变量／DNS／权限／Cron**：[部署总指南](../DEPLOY.md)。
- **已有服务升级**：[备份与回滚](../docs/UPGRADE.md)。

## 路由中继模式

| 模式 | 行为 |
| --- | --- |
| 自动（`auto`） | 优先 Worker 直连，符合安全条件时尝试一次 VPS；成功后实例内短期优先 VPS，并以只读请求探测恢复 |
| 开（`on`） | 强制 VPS；配置不完整明确报错 |
| 关（`off`） | 不使用 VPS |

旧 `image` 按「自动」解释，不再表示“API 经 VPS、视频强制直连”。已有 `on/off` 保留，新建线路默认自动。

GET/HEAD 支持指定拒绝／网关错误和连接故障回退；登录／PlaybackInfo POST 仅对明确 401/403/451 和完整有界请求体重试。不重放模糊写故障，不中途重发已开始的媒体流。详见 [自动回退](../docs/AUTO-RELAY-FAILOVER.md)。

## 通知与登录

网页支持 TG 加密保存、测试、停用，以及验证当前密码后改密。个人版网页 TG 需要独立 `SETTINGS_ENCRYPTION_KEY`（32 随机字节的 Base64，作为 Secret），不能用多人版 SESSION_SECRET 派生方案替代。网页设置密码后仍必须保留原 `ADMIN_TOKEN` 认证根；它不再是第二个登录密码。

## 中继与生成文件

最新中继源码／测试在 [../relay/](../relay/README.md)。本目录旧 `relay.go`／`bin/`／`deploy_vps.sh` 是 0.3.0 历史版本，不能当作当前加固版安装方式或覆盖线上服务。

```bash
# 在仓库根目录运行，不在 personal/ 运行
npm ci
npm run package:workers
```

生成的本目录 `worker.js` 与 `dist/personal.mjs` 逐字节相同。历史 Worker 基线已移到 `../tests/baselines/personal-worker.js`，不再从本目录运行回归基线。
