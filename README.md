# EMBY_CF | Cloudflare Worker Emby Proxy

> 中文：运行在 Cloudflare Workers 上的 Emby 反向代理、优选入口、多用户子域名和路由管理面板。
> English: An Emby reverse proxy on Cloudflare Workers with optimized DNS entry, per-user subdomains, invite registration, and route management.

## CONTROL SURFACE | 功能概览

| 模块 | 中文说明 | English |
|---|---|---|
| Emby Proxy | 通过 Worker 代理 Emby 服务，支持 HTTP、HTTPS 和 WebSocket | Proxy Emby traffic through Cloudflare Workers with HTTP, HTTPS, and WebSocket support |
| Route Console | 管理员维护全局路由，用户维护自己子域名下的路由 | Admins manage global routes; users manage routes under their own subdomains |
| User Subdomain | 注册用户自动获得 `username.BASE_DOMAIN` 访问域名 | Registered users automatically get `username.BASE_DOMAIN` |
| Auto DNS | 域名目标自动创建 `CNAME`，IPv4 自动创建 `A`，IPv6 自动创建 `AAAA` | Domain targets create `CNAME`; IPv4 creates `A`; IPv6 creates `AAAA` |
| Invite Codes | 管理员生成、释放邀请码；释放时同步清理普通用户、域名、DNS 和用户路由 | Admins generate/release invite codes; release also removes normal user, domain, DNS, and user routes |
| D1 Storage | 用户、邀请码、路由、测速缓存和统计都存储在 D1 | Users, invites, routes, speed cache, and stats are stored in D1 |
| Latency Scan | 支持优选域名测速和路由线路测速 | Optimized domain scan and route target latency scan |
| Database Reset | 管理后台可删除并重建业务表，不删除 D1 实例 | Admin panel can drop and recreate app tables without deleting the D1 instance |

## ROUTING MODEL | 路由模型

### Admin Global Route | 管理员全局路由

管理员在后台创建的是全局路由，适合默认入口或公共服务。

```text
https://your-worker-domain.example.com/emby
https://BASE_DOMAIN/emby
```

English: Routes created by admins are global routes. They are used when the request is not under a registered user subdomain, or when a user subdomain does not have its own matching route.

### User Scoped Route | 用户独立路由

用户路由按子域名隔离。同一个 `prefix` 可以被不同用户重复使用。

| 用户 | 路由 prefix | 访问地址 | 使用的目标 |
|---|---|---|---|
| `111` | `emby` | `https://111.dirige.de5.net/emby` | `111` 用户自己的 Emby |
| `222` | `emby` | `https://222.dirige.de5.net/emby` | `222` 用户自己的 Emby |

English: User routes are scoped by subdomain. Different users can use the same route prefix because the Worker resolves the target by `subdomain + prefix`.

## DNS TARGET MODE | 优选域名 / IP

用户注册后会自动创建：

```text
username.BASE_DOMAIN -> youxuan.cf.090227.xyz
```

用户后台可以修改“优选域名 / IP”。系统会自动识别目标类型：

| 输入内容 | DNS 记录类型 | 示例 |
|---|---|---|
| 域名 | `CNAME` | `youxuan.example.com` |
| IPv4 | `A` | `1.2.3.4` |
| IPv6 | `AAAA` | `2606:4700:4700::1111` |

更新时会先删除该子域名下旧的 `A/AAAA/CNAME` 记录，再创建新的记录。

English: The panel automatically detects whether the target is a domain, IPv4, or IPv6, then writes the correct DNS record type. Updating a target replaces existing A/AAAA/CNAME records for that user subdomain.

## ACCESS FLOW | 使用流程

1. 管理员使用 `ADMIN_USERNAME` / `ADMIN_PASSWORD` 登录 `/admin`。
   Admin signs in at `/admin` with `ADMIN_USERNAME` and `ADMIN_PASSWORD`.

2. 管理员生成邀请码。
   Admin generates invite codes.

3. 用户访问 `/register`，使用邀请码注册。
   User visits `/register` and signs up with an invite code.

4. 注册成功后系统自动创建用户子域名 DNS，默认指向 `youxuan.cf.090227.xyz`。
   After registration, the Worker creates a user subdomain DNS record pointing to `youxuan.cf.090227.xyz` by default.

5. 用户在后台修改优选域名/IP，并创建自己的路由。
   User updates optimized DNS target and creates personal routes.

6. 用户访问 `https://username.BASE_DOMAIN/prefix` 使用自己的路由。
   User accesses `https://username.BASE_DOMAIN/prefix` to use personal routes.

## REQUIRED CONFIG | 必要配置

这些值建议在 Cloudflare 控制台或 GitHub Actions Secrets 中填写，不建议把密码写进 `wrangler.toml`。

| 名称 | 必需 | 中文说明 | English |
|---|---:|---|---|
| `CF_API_TOKEN` | GitHub Actions 必需 | 部署 Worker、创建 D1、管理 Worker 路由 | Deploy Worker, create D1, manage Worker routes |
| `CF_ACCOUNT_ID` | GitHub Actions 必需 | Cloudflare 账户 ID | Cloudflare account ID |
| `BASE_DOMAIN` | 必需 | 用户子域名所在根域名，如 `dirige.de5.net` | Base domain for user subdomains |
| `CF_ZONE_ID` | 必需 | 根域名所在 Zone ID | Zone ID for the base domain |
| `CF_DNS_API_TOKEN` | 推荐 | 自动创建/修改用户 DNS；不填时 GitHub Actions 会尝试复用 `CF_API_TOKEN` | Token for automatic DNS changes |
| `ADMIN_USERNAME` | 必需 | 管理员用户名 | Admin username |
| `ADMIN_PASSWORD` | 必需 | 管理员密码，建议手动在 Cloudflare 控制台配置 | Admin password, preferably configured manually in Cloudflare dashboard |
| `SESSION_SECRET` | 推荐 | 用户登录会话签名密钥 | Secret for user session signing |
| `CF_WORKER_NAME` | 可选 | Worker 名称，默认 `emby-proxy` | Worker name, default `emby-proxy` |
| `DNS_RECORD_NAME` | 可选 | 传统主入口记录名，默认 `emby` | Legacy/main entry record name, default `emby` |

## DATABASE TABLES | D1 数据表

Worker 首次请求会自动初始化 D1 表结构；旧表也会自动补字段和迁移路由主键。

| 表名 | 用途 |
|---|---|
| `users` | 用户账号、密码哈希、角色、状态 |
| `invite_codes` | 邀请码、使用状态、使用人、使用时间 |
| `user_domains` | 用户子域名、优选目标、DNS 记录 ID 和记录类型 |
| `routes` | 管理员全局路由和用户独立路由 |
| `visitor_logs` | 播放信息请求访问日志 |
| `request_stats` | 按路由和日期统计请求量 |
| `auto_emby_daily_stats` | Emby 播放和 PlaybackInfo 日统计 |
| `domain_speed_cache` | 优选域名测速缓存 |
| `domain_best_cache` | 当前网络的最佳优选入口缓存 |

English: D1 schema is initialized automatically on the first request. Existing route tables are migrated automatically to support per-user route isolation.

## QUICK DEPLOY | 快速部署

推荐使用 GitHub Actions：

1. Fork 本仓库。
   Fork this repository.

2. 在 GitHub 仓库设置中添加 Actions Secrets。
   Add Actions Secrets in your GitHub repository settings.

3. 运行 `Deploy to Cloudflare Workers` 工作流。
   Run the `Deploy to Cloudflare Workers` workflow.

4. 到 Cloudflare Worker 控制台手动确认/填写 `ADMIN_PASSWORD`、`ADMIN_USERNAME`、`CF_ZONE_ID`、`CF_DNS_API_TOKEN` 等变量或 Secret。
   Confirm or set `ADMIN_PASSWORD`, `ADMIN_USERNAME`, `CF_ZONE_ID`, `CF_DNS_API_TOKEN`, and related values in the Cloudflare Worker dashboard.

完整步骤见 [DEPLOY.md](DEPLOY.md)。

## LOCAL CHECKS | 本地检查

```bash
node --check worker.js
wrangler deploy --dry-run
```

English: Use these commands to validate JavaScript syntax and Cloudflare Worker packaging before deployment.

## TROUBLESHOOTING | 常见问题

| 问题 | 处理方式 |
|---|---|
| 注册失败：DNS 自动配置未完成 | 检查 `CF_ZONE_ID` 和 `CF_DNS_API_TOKEN` |
| 注册失败：用户名已存在 | 释放对应邀请码会同步删除普通用户和用户域名；也可使用数据库重置 |
| 注册失败但邀请码被占用 | 当前版本会在失败时回滚邀请码；请确认部署到最新提交 |
| 用户路由访问 404 | 检查用户是否有该 `prefix`，以及 `*.BASE_DOMAIN/*` Worker 路由是否存在 |
| 管理员密码部署后变空 | 不要在 `wrangler.toml` 写 `ADMIN_PASSWORD = ""`；在 Cloudflare 控制台手动填 |
| 优选目标保存失败 | 只填写纯域名或 IP；不要带路径、端口、账号密码 |

## DISCLAIMER | 声明

中文：本项目仅用于学习、研究和自有服务代理测试。请遵守当地法律法规以及 Cloudflare 和上游服务条款，使用产生的一切后果由使用者自行承担。

English: This project is intended for learning, research, and proxying services you are authorized to operate. Follow local laws and the terms of Cloudflare and upstream services. You are responsible for your own usage.

## COMMUNITY | 交流反馈

- Telegram: [https://t.me/Dirige_Proxy](https://t.me/Dirige_Proxy)

## LICENSE | 许可证

MIT License
