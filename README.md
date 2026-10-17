<div align="center">

# EMBY_CF

**Emby 反向代理 · 多用户路由面板**

`HTTP/HTTPS` · `WebSocket` · `D1` · `Auto DNS` · `邀请制` · `测速`

![Platform](https://img.shields.io/badge/Cloudflare-Workers-F38020?style=flat-square&logo=cloudflare&logoColor=white)
![Database](https://img.shields.io/badge/D1-Database-00E5FF?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-00FF9D?style=flat-square)

[部署教程](DEPLOY.md) · [必要配置](#必要配置-config) · [常见问题](#常见问题-faq)

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
| 优选入口 | 用户可将子域名指向优选域名或优选 IP，支持延迟测速并缓存结果 |
| 数据库维护 | 后台可重置业务表，重新初始化 D1 表结构 |

## 路由模型 <sub>ROUTING</sub>

| 版本 | 文件 | 适用场景 |
|---|---|---|
| 多用户版 | `worker.js` | 多用户注册、邀请码、独立子域名和独立路由 |
| 单用户版 | `single-user/worker.js` | 个人自用，不需要邀请码 |

### 三种访问方式

| 方式 | 地址示例 | 配置位置 |
|---|---|---|
| 通用反代 | `https://入口域名/https://emby.example.com:8096` | 目标直接写在 URL 中，适合临时访问 |
| 管理员全局路由 | `https://入口域名/emby` | 管理员后台「路由管理」 |
| 用户独立路由 | `https://用户名.根域名/emby` | 用户后台「我的路由」 |

- 通用反代的目标支持 `http://`、`https://`、端口、路径；播放直链会自动改写回反代入口
- 用户路由按子域名隔离，同一路径只需在同一用户内不重复
- 用户子域名下无对应路由时，自动回落到管理员全局路由

`BASE_DOMAIN` 填完整公共入口，例如 `fd.dirige.de5.net`，程序自动取其上一级作为用户子域名根域名：注册 `111` 后地址为 `111.dirige.de5.net`。

## 后台入口 <sub>ENDPOINTS</sub>

| 入口 | 用途 |
|---|---|
| `/admin` | 登录后：管理员为管理后台，普通用户为个人控制台 |
| `/register` | 用户注册（需要邀请码） |
| `/stats` | 基础统计 JSON |
| `/health` | Worker 健康状态 |

> [!WARNING]
> `/stats` 为公开接口，无鉴权，任何人可查看播放统计，请勿对外泄露地址。

## 必要配置 <sub>CONFIG</sub>

以下值填写在 GitHub Secrets 或 Worker 的 `Variables and Secrets` 中，**不要写入 `wrangler.toml`**。

| 名称 | 必需 | 位置 | 说明 |
|---|:---:|---|---|
| `CF_API_TOKEN` | ✅ | GitHub Secrets | 部署 Worker、创建 D1、配置 Worker 路由 |
| `CF_ACCOUNT_ID` | ✅ | GitHub Secrets | Cloudflare 账户 ID |
| `BASE_DOMAIN` | ✅ | GitHub Secrets | 完整公共入口，如 `fd.dirige.de5.net` |
| `CF_ZONE_ID` | ✅ | GitHub Secrets | `BASE_DOMAIN` 所在 Zone ID |
| `CF_DNS_API_TOKEN` | ✅ | GitHub Secrets | Worker 运行时自动创建和修改 DNS |
| `ADMIN_USERNAME` | ✅ | Worker 变量 | 管理员用户名，默认 `admin` |
| `ADMIN_PASSWORD` | ✅ | Worker Secret | 管理员密码，部署后手动填写 |
| `SESSION_SECRET` | ⚠️ | Worker Secret | 会话签名密钥，部署后手动填写 |
| `CF_WORKER_NAME` | ⚪ | GitHub Secrets | Worker 名称，默认 `emby-proxy` |

> [!IMPORTANT]
> 不设置 `SESSION_SECRET` 时，会话签名回退到源码公开的固定密钥，**任何人可伪造管理员登录态**，务必设置为随机长字符串。
> 不要在 `wrangler.toml` 中写 `ADMIN_PASSWORD = ""`，否则部署会覆盖控制台中已填密码。

## D1 数据表 <sub>DATABASE</sub>

Worker 首次收到请求时自动创建或迁移表结构，**无需手动执行 SQL**。

| 表名 | 存储内容 |
|---|---|
| `users` / `invite_codes` | 用户账号、密码哈希；邀请码及使用状态 |
| `user_domains` | 用户子域名、优选目标、DNS 记录 ID |
| `routes` | 管理员全局路由和用户独立路由 |
| `visitor_logs` / `request_stats` | 访问日志；按路由和日期统计请求量 |
| `auto_emby_daily_stats` | Emby 播放与 PlaybackInfo 日统计 |
| `domain_speed_cache` / `domain_best_cache` | 优选测速缓存；最佳优选入口缓存 |

「重置数据库」会删除并重建以上业务表，不影响 D1 实例和 Worker 环境变量。

## 快速部署 <sub>DEPLOY</sub>

1. Fork 本仓库
2. `Settings` → `Secrets and variables` → `Actions` 添加必要 Secrets（见「必要配置」）
3. `Actions` → `Deploy to Cloudflare Workers` → `Run workflow`
4. 部署完成后在 Cloudflare 控制台手动补填 `ADMIN_PASSWORD`、`SESSION_SECRET`

> [!TIP]
> 工作流绑定了 push 触发，每次 push 到 `master` / `main` 会自动重新部署；只想手动部署可在 Actions 页面禁用。详细步骤见 [DEPLOY.md](DEPLOY.md)。

## 本地检查 <sub>LINT</sub>

```bash
node --check worker.js        # 需要 Node.js ≥ 22.7（ESM 语法检测）
wrangler deploy --dry-run     # 无需 Node 版本要求
```

## 常见问题 <sub>FAQ</sub>

| 问题 | 处理方式 |
|---|---|
| `/admin` 登录失败 | 到 Worker 的 `Variables and Secrets` 手动填写 `ADMIN_PASSWORD` |
| 会话签名使用公开密钥 | 立即设置 `SESSION_SECRET` 机密 |
| 注册失败：DNS 自动配置未完成 | 检查 `CF_ZONE_ID` 与 `CF_DNS_API_TOKEN` |
| 注册失败：优选目标非法 | 只填纯域名、IPv4 或 IPv6，不带路径、端口、账号密码 |
| 用户子域名访问 404 | 确认存在 `*.用户域名根/*` Worker 路由（Actions 部署自动创建） |
| 用户路由访问到全局路由 | 用户未创建同名路径，系统回落到管理员全局路由 |
| 邀请码释放后用户名仍占用 | 确认已部署最新版本；释放邀请码会同步删除关联普通用户 |
| D1 表结构异常 | 管理员后台执行「重置数据库」重新初始化 |

---

## 声明 · 许可 <sub>DISCLAIMER</sub>

本项目仅用于学习、研究和自有服务代理测试。请遵守当地法律法规、Cloudflare 服务条款和上游服务条款，使用产生的一切后果由使用者自行承担。

Telegram：<https://t.me/+7cbXthaBajszNjI1> · License：MIT
