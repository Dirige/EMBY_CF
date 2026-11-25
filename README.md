# EMBY_CF

**Emby / Jellyfin 反向代理 · Cloudflare Workers + D1**

个人版与多人版独立部署，共享播放代理内核。保留原生媒体流、Range、签名 URL 和客户端取消行为，不预取整部视频，也不承诺公网加速。

![Platform](https://img.shields.io/badge/Cloudflare-Workers-F38020?style=flat-square&logo=cloudflare&logoColor=white)
![Database](https://img.shields.io/badge/D1-Database-00E5FF?style=flat-square)
![Personal](https://img.shields.io/badge/个人版-v6.4.9--refactor.8-41d9ff?style=flat-square)
![Multi](https://img.shields.io/badge/多人版-v6.8.11--multi--refactor.3-41d9ff?style=flat-square)
[![License](https://img.shields.io/badge/License-MIT-00FF9D?style=flat-square)](LICENSE)

[![优选域名监控](https://img.shields.io/badge/Youxuan-yx.255432.xyz-00E5FF?style=flat-square)](https://yx.255432.xyz/)
[![Telegram 群组](https://img.shields.io/badge/Telegram-Join-26A5E4?style=flat-square&logo=telegram&logoColor=white)](https://t.me/+7cbXthaBajszNjI1)

- 优选域名监控：<https://yx.255432.xyz/>
- Telegram 群组：<https://t.me/+7cbXthaBajszNjI1>

[部署总指南](DEPLOY.md) · [更新日志](docs/CHANGELOG.md) · [升级与回滚](docs/UPGRADE.md) · [常见问题](#常见问题)

---

## 可直接使用的域名

多人版现有入口，按自己的运营商选择；**同一账号在任一入口都能登录**，实际版本以该入口的 `/health` 为准。

| 线路 | 入口 | 适用 |
| --- | --- | --- |
| 移动 | <https://fd.255432.cc.cd> | 中国移动 |
| 联通 | <https://fd.255432.de5.net> | 中国联通 |
| 全网 | <https://fd.dirige.de5.net> | 通用 |

> 这些是作者已部署的公开入口，不是本项目对可用性、速度或长期在线的保证。自建请按下方教程使用自己的域名。

## 版本与文件

| 发行版 | 当前版本 | 可直接复制部署 | 图文教程 | 离线阅读 |
| --- | --- | --- | --- | --- |
| 个人版 | `v6.4.9-refactor.8` | [personal/worker.js](personal/worker.js) | [个人版部署教程](docs/个人版部署教程.md) | [单文件 HTML](docs/offline/personal.html) |
| 多人版 | `v6.8.11-multi-refactor.3` | [worker.js](worker.js) | [多人版部署教程](docs/多人版部署教程.md) | [单文件 HTML](docs/offline/multi.html) |

新手先看 [部署总指南](DEPLOY.md)。已有站点先看 [升级与回滚](docs/UPGRADE.md)，**不要重新建库、覆盖域名或混用两版数据库**。

---

## 更新日志

最新两版（2026-11-24）摘要，完整记录见 **[docs/CHANGELOG.md](docs/CHANGELOG.md)**。

### 个人版 `v6.4.9-refactor.8`
- 新增安全自动 VPS 回退：GET/HEAD 对连接故障、`401/403/451` 与指定网关错误尝试一次中继。
- 登录／PlaybackInfo POST 仅在明确拒绝且请求体完整、可重放时重试；成功媒体流不在中途重发。
- 回退成功后实例内短期优先中继，只用只读请求探测恢复。

### 多人版 `v6.8.11-multi-refactor.3`
- 同步个人版 `.3`–`.8` 的界面、网页通知、改密、备注保密与自动回退修复。
- 保留多人版独立推流映射、用户／邀请码／配额、子域名与全局中继开关。
- 旧 D1 增量兼容：保留原表、用户、邀请码、DNS、历史字段与索引。

---

## 功能

| 功能 | 说明 |
| --- | --- |
| Emby 反向代理 | HTTP、HTTPS、WebSocket、Range、流媒体，保真 `206/416` 与客户端取消 |
| 多目标线路 | 同一路由可填多个同路径上游，按顺序尝试并熔断 |
| 前后端分离反代 | 可选「推流地址」匹配源站 302／PlaybackInfo 播放地址并改写回本路由 |
| 智能缓存 | 图片和静态资源走边缘缓存；字幕与带凭据的图片不缓存 |
| 多用户系统 | 邀请码注册，用户名即子域名，自动维护 DNS（多人版） |
| 用户配额 | 默认 20 条私有线路，管理员可调整为 1–200 |
| 管理后台 | 路由、DNS、用户、邀请码、优选域名、统计、审计、设置、导入导出 |
| 访问统计 | D1 按小时聚合请求与流量，Cloudflare Analytics 作为补充 |
| 通知 | Telegram 日报、线路异常告警、通用 Webhook；Bot 只做通知 |
| 访问控制 | IP 透传、IP 白名单／黑名单、自定义请求头 |
| VPS 中继 | 直连失败时安全回退；个人版逐线路自动／开／关，多人版全局开关 |

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
- 登录／PlaybackInfo 白名单 POST 仅在明确 `401/403/451`、完整可重放请求体时尝试一次 VPS；最多 256 KiB／5 秒。不因超时、连接故障或 5xx 重放写请求，不中途重发成功视频流。
- 回退成功后实例内优先 VPS 2 分钟，由并发受限只读请求探测恢复；多人版按用户隔离。详见 [自动回退说明](docs/AUTO-RELAY-FAILOVER.md)。
- Range / If-Range / HEAD / 206 / 416 保真；跳转逐跳检查，跨域剥离凭据，保留签名编码和重复查询参数。
- 私有资源不进共享缓存；后台 Cookie 不转给源站；任意原始 URL 转发默认关闭，日常请用登记线路。
- Bot **只做通知**，不加入入站管理，也不接管现有 webhook。实际起播、拖动、长播、字幕和通知送达需自行验收。

---

## 快速开始

1. 选择发行版，复制上表中的单文件代码。
2. 在 Cloudflare 新建 D1，Worker 绑定变量名必须为 **`DB`**。
3. 设置 `ADMIN_TOKEN` 等 Secret，不要写进仓库或截图。
4. 按教程接入域名；**优选 IP／优选域名记录保持灰云（DNS only）**。
5. 访问 `https://你的入口/health` 确认版本，再进入 `/admin` 初始化。

完整步骤：[个人版教程](docs/个人版部署教程.md) · [多人版教程](docs/多人版部署教程.md) · [变量与权限](DEPLOY.md)

## 环境变量

| 变量 | 必需 | 说明 |
| --- | --- | --- |
| `DB` | 是 | D1 绑定，两版独立，名称必须完全一致 |
| `ADMIN_TOKEN` | 是 | 管理员认证根，改密后仍须保留 |
| `BASE_DOMAIN` | 是 | 个人版建议根域；多人版为完整主入口 |
| `DNS_RECORD_NAME` | 建议 | 主入口记录名，如 `proxy`／`fd` |
| `SESSION_SECRET` | 多人版建议 | 至少 32 随机字节，会话根 |
| `USER_DOMAIN` | 多人版建议 | 用户入口后缀 |
| `SETTINGS_ENCRYPTION_KEY` | 个人版必备 | 32 随机字节的 Base64，用于网页 TG |
| `CF_API_TOKEN` | 可选 | DNS／统计，最小权限见下 |
| `DISABLE_DIRECT_PROXY` | 默认 `1` | 关闭任意原始 URL 转发 |

完整兼容别名与规则见 [DEPLOY.md](DEPLOY.md#3-必需绑定与变量)。

## API Token 权限

| 权限 | 用途 |
| --- | --- |
| Zone → Zone → Read | 识别 Zone 与账户 |
| Zone → DNS → Edit | 创建／修改 DNS |
| Zone → Analytics → Read | Zone 范围统计 |
| Account → Account Analytics → Read | 账户／Worker 统计（按需） |

运行 Token 不需要 Workers Scripts → Edit；部署身份另行授权。

## 常用入口

| 路径 | 说明 | 权限 |
| --- | --- | --- |
| `/` | 首页／用户控制台 | 公开 |
| `/admin` | 管理后台 | 管理员 |
| `/register` | 邀请码注册（多人版） | 公开 |
| `/stats` | JSON 统计接口 | 公开 |
| `/health` | 健康检查与版本 | 公开 |
| `/<前缀>/...` | 路由反向代理 | 按线路 |
| `/https://...` | 原始 URL 直连代理（默认关闭） | 按配置 |

---

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
- 历史回归基线保存在 `tests/baselines/`，不占用最新代码下载路径。
- `npm run docs:build` 只读取本地 Markdown 和图片，生成内嵌图片 HTML，不下载网络内容。
- `npm run preview` 仅绑定 `127.0.0.1`：个人版 `4273/__preview`、多人版 `4274/__preview`。
- GitHub Actions 只做检查和打包，**不会自动部署 Cloudflare**。

## VPS 中继

最新加固源码与测试见 [relay/](relay/README.md)，支持 TLS、HMAC、Range、WebSocket 和既有 HLS 路径。

`personal/relay.go`、`personal/bin/` 和旧 `personal/deploy_vps.sh` 是历史 0.3.0 方案，不是加固版交付；不要用旧一键脚本覆盖已有服务。升级中继前先备份配置和二进制，并安排维护窗口。

## 常见问题

| 现象 | 先检查 |
| --- | --- |
| `/health` 显示旧版 | 域名实际绑定了哪个 Worker／Route；仓库更新不自动改变线上 |
| 原始 URL 路径返回 403 | 新版默认关闭，改用登记线路 |
| 登录、列表正常但播放转圈 | 抓同次播放的 PlaybackInfo、媒体 GET／Range 与 302 |
| 206 后 canceled／断开 | 客户端取消、拖动、上游断流或网络问题，不能只看状态判定 |
| 统计显示 `—` | Token 权限、Host 范围、数据延迟 |
| 用户子域不通 | DNS 代理状态、通配 Route、TLS 覆盖 |

排障经验：

- **起播慢、播几秒卡缓冲，登录和海报正常**：多为 Range 与压缩协商被破坏，可给该线路「自定义请求头」加 `Accept-Encoding: identity`。
- **中继提示并发过多**：单 IP 并发按 TCP 来源计数，Cloudflare 回源共享出口 IP；按需调大 `per_ip_max_conns`，不要公开密钥。

## 文档

| 文档 | 内容 |
| --- | --- |
| [DEPLOY.md](DEPLOY.md) | 部署总指南：变量、DNS、权限、Cron、回滚 |
| [个人版教程](docs/个人版部署教程.md) | 从注册域名到线路验证的图文步骤 |
| [多人版教程](docs/多人版部署教程.md) | 用户、邀请码、子域名与独立推流 |
| [离线个人版](docs/offline/personal.html) / [离线多人版](docs/offline/multi.html) | 图片与样式内嵌，保存后双击阅读 |
| [更新日志](docs/CHANGELOG.md) | 两版版本历史与发布记录 |
| [升级与回滚](docs/UPGRADE.md) | 升级前备份、数据兼容、回滚边界 |
| [通知与密码安全](docs/WEB-NOTIFICATIONS-SECURITY.md) | TG 加密、改密、密钥轮换 |
| [自动回退](docs/AUTO-RELAY-FAILOVER.md) | VPS 回退条件与探测恢复 |
| [个人版验收](docs/PERSONAL-PUBLIC-ACCEPTANCE.md) / [多人版验收](docs/MULTI-PUBLIC-ACCEPTANCE.md) | 发布、核对与回滚记录 |
| [构建 manifest](docs/BUILD-MANIFEST.json) / [发布 manifest](docs/RELEASE-MANIFEST-20261124.json) | 构建哈希与线上版本 |
| [开发交接](HANDOFF.md) | 内部状态与历史说明 |

## 使用须知

仅代理你有权访问的服务；遵守 Cloudflare、域名商和上游条款，留意 Workers / D1 / VPS 的配额与计费。Cloudflare 免费套餐不等于无限视频带宽。请勿提交 Token、Cookie、密码、证书私钥、生产数据库或用户日志。

MIT License；教程截图由作者提供，仅用于本项目部署说明。优选域名监控：<https://yx.255432.xyz/> · Telegram 群组：<https://t.me/+7cbXthaBajszNjI1>
