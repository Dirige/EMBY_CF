<div align="center">

# EMBY_CF

**Emby 反向代理 · 多用户路由面板**

`HTTP/HTTPS` · `WebSocket` · `D1` · `Auto DNS` · `邀请制` · `测速`

![Platform](https://img.shields.io/badge/Cloudflare-Workers-F38020?style=flat-square&logo=cloudflare&logoColor=white)
![Database](https://img.shields.io/badge/D1-Database-00E5FF?style=flat-square&logo=cloudflare&logoColor=white)
![Runtime](https://img.shields.io/badge/Proxy-Emby/Jellyfin-00FF9D?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-00FF9D?style=flat-square)

[快速部署](#快速部署-deploy) · [必要配置](#必要配置-config) · [部署教程](DEPLOY.md) · [常见问题](#常见问题-faq)

</div>

---

## 功能特性 <sub>FEATURES</sub>

| 功能 | 说明 |
|---|---|
| 反向代理 | 支持 HTTP、HTTPS、WebSocket，适用于 Emby / Jellyfin 类服务 |
| 管理员全局路由 | 后台创建公共路由，例如 `/emby`，作为统一入口 |
| 用户独立路由 | 每个用户在自己的子域名下创建路由，不同用户可使用同名路径 |
| 邀请码注册 | 管理员生成邀请码，用户凭邀请码注册 |
| 用户子域名 | 注册后自动创建 `用户名.根域名` 三级子域名 |
| 自动 DNS | 自动识别域名、IPv4、IPv6，对应创建 `CNAME` / `A` / `AAAA` 记录 |
| 优选入口 | 用户可将自己的子域名指向优选域名或优选 IP |
| 延迟测速 | 优选域名测速、路由目标线路测速，并缓存测速结果 |
| 数据库维护 | 后台可重置业务表，重新初始化 D1 表结构 |
| 统计记录 | 记录播放与 PlaybackInfo 请求，便于观察使用情况 |

## 路由模型 <sub>ROUTING</sub>

### 版本选择 <sub>VERSIONS</sub>

| 版本 | 文件 | 适用场景 |
|---|---|---|
| 多用户版 | `worker.js` | 多个用户注册、邀请码、独立子域名和独立路由 |
| 自用部署单用户版 | `single-user/worker.js` | 个人自用部署，不需要公开发放邀请码 |

`single-user/worker.js` 是独立的自用部署版本。公开仓库中的同步密钥为空；如使用主从同步，请在 Worker Secret 中配置 `SYNC_SECRET`。

### 管理员全局路由

管理员后台创建的路由属于全局路由，适合放置公共入口或默认代理：

```text
https://你的主入口域名/emby
https://你的 workers.dev 域名/emby
```

### 通用反代格式

不创建数据库路由时，也可以直接把目标地址放在入口域名后面：

```text
https://你的入口域名/https://emby.example.com:8096
https://你的入口域名/https://emby.example.com:8096/emby/Items
```

目标地址支持 `http://`、`https://`、域名、端口和目标路径；该方式适合临时访问或测试。使用 Emby 播放时，系统会自动处理上游返回的跳转地址和播放直链，使其继续经过通用反代入口。
部署时将完整的公共入口填写到 `BASE_DOMAIN`，例如 `fd.dirige.de5.net`。该值会直接作为公共试用入口读取，不再额外拼接固定的 `fd`。程序会自动使用它的上一级域名作为用户子域名根域名，因此注册 `111` 后地址为 `111.dirige.de5.net`。

### 用户独立路由

用户路由按子域名隔离。同一个路径只要求在**同一个用户账号内**不重复，不要求全站唯一：

| 用户 | 用户路由 | 访问地址 | 实际目标 |
|---|---|---|---|
| `111` | `/emby` | `https://111.example.com/emby` | 用户 `111` 配置的 Emby |
| `222` | `/emby` | `https://222.example.com/emby` | 用户 `222` 配置的 Emby |

> [!NOTE]
> 如果用户子域名下没有对应路径，Worker 会自动回落到管理员全局路由。

## 用户子域名与 DNS <sub>SUBDOMAIN</sub>

用户注册成功后，系统自动创建 `用户名.公共入口的上一级域名`，默认指向 `youxuan.cf.090227.xyz`。

用户可在后台「我的访问域名」中修改「优选域名 / IP」。无需手动选择 DNS 记录类型，系统自动识别：

| 用户输入 | 自动创建的记录 | 示例 |
|---|---|---|
| 域名 | `CNAME` | `youxuan.example.com` |
| IPv4 | `A` | `1.2.3.4` |
| IPv6 | `AAAA` | `2606:4700:4700::1111` |

修改时会先删除该子域名下已有的 `A/AAAA/CNAME` 记录，再创建新记录，避免同名冲突。

## 后台入口 <sub>ENDPOINTS</sub>

| 入口 | 用途 |
|---|---|
| `/admin` | 管理员登录 · 路由管理 · 邀请码管理 · 数据库维护 |
| `/register` | 用户注册 |
| `/admin`（登录后） | 普通用户控制台 · 管理访问域名与路由 |
| `/stats` | 基础统计 JSON |
| `/health` | Worker 健康状态 |

> [!WARNING]
> `/stats` 端点为**公开接口**，无鉴权，任何知道域名的人都可查看播放统计。如需隐藏，请勿对外泄露该地址。

## 必要配置 <sub>CONFIG</sub>

这些值建议填写在 GitHub Secrets 或 Worker 的 `Variables and Secrets（变量和机密）` 中。**不要在 `wrangler.toml` 里写空白密码。**

| 名称 | 必需 | 建议位置 | 说明 |
|---|:---:|---|---|
| `CF_API_TOKEN` | ✅ | GitHub Secrets | 部署 Worker、创建 D1、配置 Worker 路由 |
| `CF_ACCOUNT_ID` | ✅ | GitHub Secrets | Cloudflare 账户 ID |
| `BASE_DOMAIN` | ✅ | GitHub Secrets / Worker Variable | 完整公共入口，例如 `fd.dirige.de5.net` |
| `CF_ZONE_ID` | ✅ | GitHub Secrets / Worker Variable | `BASE_DOMAIN` 所在 Zone ID |
| `CF_DNS_API_TOKEN` | ✅ | GitHub Secrets / Worker Secret | Worker 运行时自动创建和修改 DNS |
| `ADMIN_USERNAME` | ✅ | Worker Variable | 管理员用户名，默认 `admin` |
| `ADMIN_PASSWORD` | ✅ | Worker Secret | 管理员密码，部署后手动填写 |
| `SESSION_SECRET` | ⚠️ 强烈建议 | Worker Secret | 用户登录会话签名密钥 |
| `CF_WORKER_NAME` | ⚪ | GitHub Secrets | Worker 名称，默认 `emby-proxy` |

> [!IMPORTANT]
> 不设置 `SESSION_SECRET` 时，会话签名会回退到源码中公开的固定密钥，**任何人都可以伪造管理员登录态**。请务必设置一个随机长字符串，例如 `openssl rand -hex 32` 的输出。

## D1 数据表 <sub>DATABASE</sub>

Worker 首次收到请求时会自动创建或迁移 D1 表结构，正常情况下**不需要手动执行 SQL**。

| 表名 | 存储内容 |
|---|---|
| `users` | 用户账号、密码哈希、角色、状态 |
| `invite_codes` | 邀请码、使用状态、使用人、使用时间 |
| `user_domains` | 用户子域名、优选目标、DNS 记录 ID、记录类型 |
| `routes` | 管理员全局路由和用户独立路由 |
| `visitor_logs` | 播放信息请求访问日志 |
| `request_stats` | 按路由和日期统计请求量 |
| `auto_emby_daily_stats` | Emby 播放和 PlaybackInfo 日统计 |
| `domain_speed_cache` | 优选域名测速缓存 |
| `domain_best_cache` | 当前网络下的最佳优选入口缓存 |

> [!NOTE]
> 管理员后台的「重置数据库」会删除并重建以上业务表，但不会删除 D1 数据库实例，也不会修改 Worker 环境变量。

## 快速部署 <sub>DEPLOY</sub>

推荐使用 GitHub Actions：

1. Fork 本仓库。
2. 进入 `Settings（设置）` → `Secrets and variables（秘密和变量）` → `Actions（操作）`。
3. 添加必需的 GitHub Secrets（见上文「必要配置」）。
4. 进入 `Actions（操作）` → `Deploy to Cloudflare Workers`，点击 `Run workflow（运行工作流）`。
5. 部署成功后，到 Cloudflare 控制台进入 Worker，打开 `Settings（设置）` → `Variables and Secrets（变量和机密）`，手动确认 `ADMIN_PASSWORD`、`SESSION_SECRET` 等变量。

> [!TIP]
> 该工作流同时绑定了 push 触发：Fork 后**每次 push 到 `master` / `main` 都会自动重新部署**。如果只想手动部署，可在 `Actions（操作）` 页面中禁用该工作流。

详细步骤见 [DEPLOY.md](DEPLOY.md)。

## 本地检查 <sub>LINT</sub>

```bash
node --check worker.js        # 需要 Node.js ≥ 22.7（ESM 语法检测）
wrangler deploy --dry-run     # 无需 Node 版本要求
```

## 常见问题 <sub>FAQ</sub>

| 问题 | 处理方式 |
|---|---|
| 管理员密码部署后变空 | 不要在 `wrangler.toml` 写 `ADMIN_PASSWORD = ""`，在 Cloudflare 控制台手动填 Secret |
| 注册失败：DNS 自动配置未完成 | 检查 `CF_ZONE_ID` 和 `CF_DNS_API_TOKEN` |
| 注册失败：优选目标必须是合法域名或 IP | 只填写纯域名、IPv4 或 IPv6，不要带路径、端口、账号密码 |
| 用户注册成功但子域名访问 404 | 检查是否添加了 `*.用户域名根/*` Worker 路由 |
| 用户路由访问到全局路由 | 用户后台没有创建同名路径，系统回落到了管理员全局路由 |
| 邀请码释放后用户名仍占用 | 确认已部署最新版本；释放邀请码会同步删除关联普通用户 |
| D1 表结构异常 | 在管理员后台执行「重置数据库」重新初始化 |

---

## 声明 <sub>DISCLAIMER</sub>

本项目仅用于学习、研究和自有服务代理测试。请遵守当地法律法规、Cloudflare 服务条款和上游服务条款。使用本项目产生的一切后果由使用者自行承担。

## 交流反馈 <sub>CONTACT</sub>

- Telegram：<https://t.me/Dirige_Proxy>

## 许可证 <sub>LICENSE</sub>

MIT License
