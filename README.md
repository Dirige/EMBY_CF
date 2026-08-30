# EMBY_CF

一个运行在 Cloudflare Workers 上的 Emby 反向代理与多用户路由面板。项目集成了 D1 数据库、邀请码注册、用户子域名、自动 DNS、优选域名测速、路由线路测速和基础播放统计。

界面风格偏向深色控制台，文档也按“先部署、再配置、再使用、最后排错”的顺序组织。涉及 GitHub 或 Cloudflare 控制台操作的地方，会保留英文按钮名并加中文对照，例如 `Settings（设置）`、`Actions（操作）`、`Variables and Secrets（变量和机密）`，方便按页面查找。

## 功能特性

| 功能 | 说明 |
|---|---|
| Emby 反向代理 | 支持 HTTP、HTTPS、WebSocket，适用于 Emby/Jellyfin 类服务代理 |
| 管理员全局路由 | 管理员可在后台创建公共路由，例如 `/emby` |
| 用户独立路由 | 每个用户可在自己的子域名下创建路由，不同用户可以使用同名路径 |
| 邀请码注册 | 管理员生成邀请码，用户凭邀请码注册 |
| 用户子域名 | 注册后自动创建 `用户名.根域名` |
| 自动 DNS | 自动识别域名、IPv4、IPv6，并创建 `CNAME`、`A`、`AAAA` 记录 |
| 优选入口 | 用户可把自己的子域名指向优选域名或优选 IP |
| 延迟测速 | 支持优选域名测速、路由目标线路测速，并缓存测速结果 |
| 数据库维护 | 后台可重置业务表，重新初始化 D1 表结构 |
| 统计记录 | 记录播放与 PlaybackInfo 请求，便于观察使用情况 |

## 路由模型

### 管理员全局路由

管理员后台创建的路由属于全局路由，适合放公共入口或默认代理。

```text
https://你的主入口域名/emby
https://你的 workers.dev 域名/emby
```

### 用户独立路由

用户路由按用户子域名隔离。也就是说，同一个路径只要求在同一个用户账号内不重复，不要求全站唯一。

| 用户 | 用户路由 | 访问地址 | 实际目标 |
|---|---|---|---|
| `111` | `/emby` | `https://111.dirige.de5.net/emby` | 用户 `111` 自己配置的 Emby |
| `222` | `/emby` | `https://222.dirige.de5.net/emby` | 用户 `222` 自己配置的 Emby |

如果用户子域名下没有对应路径，Worker 会尝试回落到管理员全局路由。

## 用户子域名和 DNS

用户注册成功后，系统会自动创建：

```text
用户名.BASE_DOMAIN
```

默认指向：

```text
youxuan.cf.090227.xyz
```

用户可在后台的“我的访问域名”里修改“优选域名 / IP”。这里不需要手动选择 DNS 类型，系统会自动识别：

| 用户输入 | 自动创建的 DNS 记录 | 示例 |
|---|---|---|
| 域名 | `CNAME` | `youxuan.example.com` |
| IPv4 | `A` | `1.2.3.4` |
| IPv6 | `AAAA` | `2606:4700:4700::1111` |

修改时会先删除该子域名下已有的 `A/AAAA/CNAME` 记录，再创建新的记录，避免同名记录冲突。

## 后台入口

| 入口 | 用途 |
|---|---|
| `/admin` | 管理员登录、路由管理、邀请码管理、数据库维护 |
| `/register` | 用户注册 |
| 用户登录后的 `/admin` | 普通用户控制台，管理自己的访问域名和路由 |
| `/stats` | 查看基础统计 JSON |
| `/health` | 查看 Worker 健康状态 |

## 必要配置

这些值建议在 GitHub Secrets 或 Cloudflare Worker 的 `Variables and Secrets（变量和机密）` 中填写。不要在 `wrangler.toml` 里写空白密码。

| 名称 | 必需 | 建议位置 | 说明 |
|---|---:|---|---|
| `CF_API_TOKEN` | 是 | GitHub Secrets | 部署 Worker、创建 D1、配置 Worker 路由 |
| `CF_ACCOUNT_ID` | 是 | GitHub Secrets | Cloudflare 账户 ID |
| `BASE_DOMAIN` | 是 | GitHub Secrets / Worker Variable | 用户子域名根域名，例如 `dirige.de5.net` |
| `CF_ZONE_ID` | 是 | GitHub Secrets / Worker Variable | `BASE_DOMAIN` 所在 Zone ID |
| `CF_DNS_API_TOKEN` | 推荐 | GitHub Secrets / Worker Secret | Worker 运行时自动创建和修改 DNS |
| `ADMIN_USERNAME` | 是 | Worker Variable | 管理员用户名 |
| `ADMIN_PASSWORD` | 是 | Worker Secret | 管理员密码，建议部署后手动填写 |
| `SESSION_SECRET` | 推荐 | Worker Secret | 用户登录会话签名密钥 |
| `CF_WORKER_NAME` | 否 | GitHub Secrets | Worker 名称，默认 `emby-proxy` |
| `DNS_RECORD_NAME` | 否 | GitHub Secrets / Worker Variable | 主入口 DNS 记录名，默认 `emby` |

## D1 数据表

Worker 首次请求会自动创建或迁移 D1 表结构。正常情况下不需要手动执行 SQL。

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

管理员后台的“重置数据库”会删除并重建这些业务表，但不会删除 D1 数据库实例，也不会修改 Worker 环境变量。

## 快速部署

推荐使用 GitHub Actions：

1. Fork 本仓库。
2. 在仓库进入 `Settings（设置） -> Secrets and variables（秘密和变量） -> Actions（操作）`。
3. 添加必需的 GitHub Secrets。
4. 进入 `Actions（操作） -> Deploy to Cloudflare Workers`，点击 `Run workflow（运行工作流）`。
5. 部署成功后，到 Cloudflare 控制台进入 Worker，打开 `Settings（设置） -> Variables and Secrets（变量和机密）`，手动确认 `ADMIN_PASSWORD`、`ADMIN_USERNAME`、`CF_ZONE_ID`、`CF_DNS_API_TOKEN` 等变量。

详细步骤见 [DEPLOY.md](DEPLOY.md)。

## 本地检查

```bash
node --check worker.js
wrangler deploy --dry-run
```

## 常见问题

| 问题 | 处理方式 |
|---|---|
| 管理员密码部署后变空 | 不要在 `wrangler.toml` 写 `ADMIN_PASSWORD = ""`，在 Cloudflare 控制台手动填 Secret |
| 注册失败：DNS 自动配置未完成 | 检查 `CF_ZONE_ID` 和 `CF_DNS_API_TOKEN` |
| 注册失败：优选目标必须是合法域名或 IP | 只填写纯域名、IPv4 或 IPv6，不要带路径、端口、账号密码 |
| 用户注册成功但子域名访问 404 | 检查是否添加了 `*.BASE_DOMAIN/*` Worker 路由 |
| 用户路由访问到全局路由 | 用户后台没有创建同名路径，系统回落到了管理员全局路由 |
| 邀请码释放后用户名仍占用 | 确认已部署最新版本；释放邀请码会同步删除关联普通用户 |
| D1 表结构异常 | 在管理员后台执行“重置数据库”重新初始化 |

## 声明

本项目仅用于学习、研究和自有服务代理测试。请遵守当地法律法规、Cloudflare 服务条款和上游服务条款。使用本项目产生的一切后果由使用者自行承担。

## 交流反馈

- Telegram: [https://t.me/Dirige_Proxy](https://t.me/Dirige_Proxy)

## 许可证

MIT License
