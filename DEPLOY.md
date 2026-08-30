# DEPLOY | Cloudflare Worker Emby Proxy

> 中文：这份文档按“准备 Cloudflare 资源 -> 配置 GitHub Secrets -> 自动部署 -> 手动补充 Worker 变量 -> 注册和路由验证”的顺序走。
> English: This guide follows the flow: prepare Cloudflare resources, configure GitHub Secrets, deploy with GitHub Actions, fill Worker variables manually, then verify registration and routing.

## SYSTEM MAP | 系统结构

```text
User Browser
  |
  |  https://username.BASE_DOMAIN/prefix
  v
Cloudflare DNS
  |
  |  A / AAAA / CNAME, proxied
  v
Cloudflare Worker
  |
  |  D1: users, invites, routes, domains, stats, speed cache
  v
Your Emby Server
```

English: DNS sends user traffic into the Worker. The Worker reads D1 to decide which route target to use, then proxies the request to your Emby server.

## BEFORE YOU START | 准备工作

| 项目 | 中文说明 | English |
|---|---|---|
| Cloudflare Account | 需要一个可用的 Cloudflare 账号 | A Cloudflare account is required |
| Domain Zone | 需要一个已经托管到 Cloudflare 的域名 Zone | A domain zone managed by Cloudflare is required |
| GitHub Account | GitHub Actions 自动部署需要 | Required for GitHub Actions deployment |
| API Token | 用于部署 Worker、创建 D1、配置 Worker 路由和 DNS | Used to deploy Worker, create D1, configure routes and DNS |
| D1 Database | 可由 Actions 自动创建，也可以手动创建 | Can be created by Actions or manually |

如果你还没有域名，可以先把域名 DNS 托管到 Cloudflare。原文档提到的 DNSHE 地址为 `https://my.dnshe.com/index.php?m=domain_hub`，邀请码 `ZPB06CED7F`。

English: If you do not have a domain yet, add one to Cloudflare first. Any domain managed by Cloudflare works as long as you can edit its DNS and Worker routes.

## TOKEN PERMISSIONS | API 令牌权限

建议创建两个令牌：

| 令牌 | 用途 | 建议权限 |
|---|---|---|
| `CF_API_TOKEN` | GitHub Actions 部署 Worker、创建/查询 D1、创建 Worker 路由 | Workers Scripts Edit, D1 Edit, Zone Workers Routes Edit, Zone DNS Edit |
| `CF_DNS_API_TOKEN` | Worker 运行时自动创建/更新用户子域名 DNS | Zone DNS Edit |

如果只想先用一个令牌，也可以让 `CF_DNS_API_TOKEN` 留空，GitHub Actions 会尝试把 `CF_API_TOKEN` 写入 Worker Secret `CF_DNS_API_TOKEN`。更稳的做法是单独创建 DNS 编辑令牌。

English: A separate DNS token is safer. It limits runtime DNS operations to only the permission needed by user registration and user domain edits.

## GITHUB ACTIONS DEPLOY | GitHub 自动部署

### 1. Fork 仓库 | Fork Repository

打开仓库：

```text
https://github.com/Dirige/EMBY_CF
```

点击 `Fork`，创建到你自己的 GitHub 账号下。

English: Fork the repository to your own GitHub account so GitHub Actions can run in your repo.

### 2. 填写 GitHub Secrets | Add GitHub Actions Secrets

进入你的仓库：

```text
Settings -> Secrets and variables -> Actions -> New repository secret
```

添加下面这些 Secrets：

| Secret 名称 | 必需 | 示例 | 中文说明 | English |
|---|---:|---|---|---|
| `CF_API_TOKEN` | 是 | `...` | Cloudflare API 令牌，用于部署 Worker、管理路由和 D1 | Cloudflare token for Worker deployment, routes, and D1 |
| `CF_ACCOUNT_ID` | 是 | `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` | Cloudflare 账户 ID | Cloudflare account ID |
| `BASE_DOMAIN` | 是 | `dirige.de5.net` | 用户子域名所在根域名 | Base domain for user subdomains |
| `CF_ZONE_ID` | 是 | `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` | `BASE_DOMAIN` 所在 Zone ID | Zone ID for `BASE_DOMAIN` |
| `CF_DNS_API_TOKEN` | 推荐 | `...` | Worker 运行时自动改 DNS 的令牌 | Runtime token for DNS updates |
| `CF_WORKER_NAME` | 否 | `emby-proxy` | Worker 名称，不填则默认 `emby-proxy` | Worker name, default `emby-proxy` |
| `DNS_RECORD_NAME` | 否 | `emby` | 传统主入口 DNS 记录名 | Legacy/main entry record name |

注意：不要在 GitHub Secrets 里填写空字符串；没用到的可选项可以不建。

English: Do not create empty GitHub secrets. Optional secrets can be omitted.

### 3. 运行工作流 | Run Workflow

进入：

```text
Actions -> Deploy to Cloudflare Workers -> Run workflow
```

部署完成后，Actions 会做这些事：

| 动作 | 中文说明 | English |
|---|---|---|
| 安装 Wrangler | 使用 Cloudflare Wrangler CLI | Install Wrangler CLI |
| 创建/确认 D1 | 自动创建或复用 `emby-proxy-db` | Create or reuse `emby-proxy-db` |
| 写入 wrangler 配置 | 替换 Worker 名称、域名、Zone ID、D1 ID | Update Worker config |
| 写入 DNS Secret | 把 DNS API Token 写入 Worker Secret | Store DNS token as Worker Secret |
| 部署 Worker | 发布 `worker.js` | Deploy `worker.js` |
| 配置路由 | 添加主入口和 `*.BASE_DOMAIN/*` 通配符路由 | Add main and wildcard Worker routes |

English: The workflow deploys the Worker and configures routing. D1 tables are initialized by the Worker on the first request.

## CLOUDFLARE WORKER VARIABLES | Worker 变量和机密

自动部署后，建议进入 Cloudflare 控制台核对变量：

```text
Workers & Pages -> emby-proxy -> Settings -> Variables and Secrets
```

手动挨个确认或填写：

| 名称 | 类型 | 必需 | 示例 | 中文说明 |
|---|---|---:|---|---|
| `ADMIN_USERNAME` | Variable | 是 | `admin` | 管理员用户名 |
| `ADMIN_PASSWORD` | Secret | 是 | 自己设置 | 管理员密码 |
| `BASE_DOMAIN` | Variable | 是 | `dirige.de5.net` | 用户子域名根域名 |
| `CF_ZONE_ID` | Variable 或 Secret | 是 | `xxxxxxxx...` | Cloudflare Zone ID |
| `CF_DNS_API_TOKEN` | Secret | 是 | `...` | 自动创建/修改 DNS |
| `SESSION_SECRET` | Secret | 推荐 | 随机长字符串 | 用户登录会话签名 |
| `DNS_RECORD_NAME` | Variable | 否 | `emby` | 主入口记录名 |

English:

| Name | Type | Required | Example | Description |
|---|---|---:|---|---|
| `ADMIN_USERNAME` | Variable | Yes | `admin` | Admin username |
| `ADMIN_PASSWORD` | Secret | Yes | your password | Admin password |
| `BASE_DOMAIN` | Variable | Yes | `dirige.de5.net` | Base domain for user subdomains |
| `CF_ZONE_ID` | Variable or Secret | Yes | `xxxxxxxx...` | Cloudflare Zone ID |
| `CF_DNS_API_TOKEN` | Secret | Yes | `...` | DNS token for automatic updates |
| `SESSION_SECRET` | Secret | Recommended | long random string | Session signing secret |
| `DNS_RECORD_NAME` | Variable | Optional | `emby` | Main entry record name |

`wrangler.toml` 不再包含 `ADMIN_PASSWORD = ""`。这样部署时不会把管理员密码覆盖成空白。

English: `wrangler.toml` intentionally does not contain `ADMIN_PASSWORD = ""`, so deployment will not overwrite the admin password with an empty value.

## DNS AND ROUTES | DNS 与 Worker 路由

必须存在通配符 Worker 路由：

```text
*.BASE_DOMAIN/*
```

例如：

```text
*.dirige.de5.net/*
```

建议也保留主入口：

```text
DNS_RECORD_NAME.BASE_DOMAIN/*
```

例如：

```text
emby.dirige.de5.net/*
```

English: The wildcard Worker route is required for user subdomains such as `alice.dirige.de5.net`. The main route is useful for admin/global routes.

## D1 DATABASE | D1 数据库

### 自动初始化 | Automatic Initialization

Worker 首次收到请求时会自动创建业务表：

| 表名 | 存储内容 |
|---|---|
| `users` | 用户、密码哈希、角色、状态 |
| `invite_codes` | 邀请码、使用状态、使用人、使用时间 |
| `user_domains` | 用户子域名、优选目标、DNS 记录信息 |
| `routes` | 管理员全局路由和用户独立路由 |
| `visitor_logs` | 访问日志 |
| `request_stats` | 按日期统计的路由请求 |
| `auto_emby_daily_stats` | 播放和 PlaybackInfo 日统计 |
| `domain_speed_cache` | 优选域名测速缓存 |
| `domain_best_cache` | 当前网络最佳优选入口缓存 |

English: Tables are created automatically. Existing route tables are migrated automatically to support per-user route isolation.

### 重置数据库 | Reset Database

管理员后台的“重置数据库”会：

1. 删除本 Worker 管理的 9 张业务表。
   Drop the 9 application tables managed by this Worker.

2. 重新创建最新结构。
   Recreate the latest schema.

3. 尝试删除已记录用户子域名的 DNS 记录。
   Try to remove DNS records for recorded user subdomains.

4. 保留 D1 数据库实例和 Worker 环境变量。
   Keep the D1 instance and Worker variables/secrets.

## MANUAL DEPLOY | 手动部署

### 1. 创建 Worker | Create Worker

1. 打开 Cloudflare 控制台。
   Open Cloudflare Dashboard.

2. 进入 `Workers & Pages`。
   Go to `Workers & Pages`.

3. 创建一个 Worker，例如 `emby-proxy`。
   Create a Worker, for example `emby-proxy`.

4. 删除默认代码，粘贴 `worker.js`。
   Remove default code and paste `worker.js`.

5. 保存并部署。
   Save and deploy.

### 2. 创建并绑定 D1 | Create and Bind D1

1. 进入 `Storage & databases -> D1`。
   Go to `Storage & databases -> D1`.

2. 创建数据库，例如 `emby-proxy-db`。
   Create a database, for example `emby-proxy-db`.

3. 回到 Worker 设置，添加 D1 binding。
   Go back to Worker settings and add a D1 binding.

4. 变量名填写 `DB`。
   Binding name must be `DB`.

5. 选择刚创建的数据库并保存。
   Select the D1 database and save.

不需要手动执行 SQL，Worker 会在第一次请求时自动建表。

English: You do not need to run SQL manually. The Worker initializes the schema on first request.

### 3. 添加变量 | Add Variables

按照上面的 `Worker 变量和机密` 表格添加变量。至少需要：

```text
ADMIN_USERNAME
ADMIN_PASSWORD
BASE_DOMAIN
CF_ZONE_ID
CF_DNS_API_TOKEN
```

English: Add the required variables/secrets listed above.

### 4. 添加 Worker 路由 | Add Worker Routes

进入：

```text
Worker -> Settings -> Triggers -> Routes
```

添加：

```text
*.BASE_DOMAIN/*
DNS_RECORD_NAME.BASE_DOMAIN/*
```

例如：

```text
*.dirige.de5.net/*
emby.dirige.de5.net/*
```

English: The wildcard route is required for automatic user subdomains.

## FIRST RUN | 首次使用

### 1. 管理员登录 | Admin Login

打开：

```text
https://你的入口域名/admin
```

输入 `ADMIN_USERNAME` 和 `ADMIN_PASSWORD`。

English: Visit `/admin` and sign in with your admin credentials.

### 2. 生成邀请码 | Generate Invite Codes

进入“邀请码管理”，生成邀请码给用户注册。

English: Use the invite code panel to generate invite codes for users.

### 3. 用户注册 | User Registration

用户访问：

```text
https://你的入口域名/register
```

注册成功后会自动创建：

```text
username.BASE_DOMAIN
```

默认 DNS 目标为：

```text
youxuan.cf.090227.xyz
```

English: A successful registration automatically creates a user subdomain pointing to the default optimized target.

## USER PANEL | 用户后台

用户登录后可以管理两块内容：

| 区域 | 中文说明 | English |
|---|---|---|
| 我的访问域名 | 修改 `username.BASE_DOMAIN` 的优选目标 | Update optimized target for `username.BASE_DOMAIN` |
| 我的路由 | 创建、编辑、删除、测速自己的路由 | Create, edit, delete, and speed-test personal routes |

### 优选域名 / IP 自动识别

用户填写目标时只需要输入域名或 IP：

| 输入 | 自动记录类型 | 说明 |
|---|---|---|
| `youxuan.example.com` | `CNAME` | 指向优选域名 |
| `1.2.3.4` | `A` | 指向 IPv4 |
| `2606:4700:4700::1111` | `AAAA` | 指向 IPv6 |

系统会先删除该子域名下旧的 `A/AAAA/CNAME`，再创建新的记录。

English: The Worker detects the target type and creates CNAME, A, or AAAA automatically. It replaces old A/AAAA/CNAME records during updates.

### 用户路由示例 | User Route Example

用户 `111` 创建：

```text
prefix: emby
target: https://emby-a.example.com:8096
```

访问：

```text
https://111.dirige.de5.net/emby
```

用户 `222` 也可以创建自己的 `/emby`：

```text
https://222.dirige.de5.net/emby
```

English: The same prefix can be reused by different users because route lookup is scoped by user subdomain.

## ADMIN PANEL | 管理后台

| 功能 | 中文说明 | English |
|---|---|---|
| 路由管理 | 创建全局路由，用于主入口或公共代理 | Manage global routes |
| 优选域名测速 | 从 Worker 边缘测试内置优选入口延迟 | Test optimized domain latency from Worker edge |
| 邀请码管理 | 生成、复制、释放邀请码 | Generate, copy, and release invite codes |
| 数据库维护 | 重置业务表并重新初始化 | Reset and recreate app tables |

释放邀请码时，如果邀请码已绑定普通用户，会同步删除：

```text
users
user_domains
routes owned by that user
DNS records for username.BASE_DOMAIN
```

English: Releasing an invite also releases the normal user and their related data.

## LOCAL DEVELOPMENT | 本地检查

推荐检查：

```bash
node --check worker.js
wrangler deploy --dry-run
```

查看 Wrangler 登录状态：

```bash
wrangler whoami
```

查看线上日志：

```bash
wrangler tail
```

English: Run syntax and dry-run checks before deploying. Use `wrangler tail` to inspect live logs.

## TROUBLESHOOTING | 故障排查

| 问题 | 可能原因 | 处理方式 |
|---|---|---|
| `/admin` 登录失败 | `ADMIN_PASSWORD` 未配置或被空值覆盖 | 在 Cloudflare Worker 控制台手动设置 `ADMIN_PASSWORD` Secret |
| 注册失败：DNS 自动配置未完成 | 缺少 `CF_ZONE_ID` 或 `CF_DNS_API_TOKEN` | 检查 Worker 变量和 Secret |
| 注册失败：优选目标必须是合法域名或 IP | DNS 目标带了路径、端口或非法字符 | 只填域名、IPv4 或 IPv6 |
| 用户注册成功但子域名访问 404 | 缺少 `*.BASE_DOMAIN/*` Worker 路由 | 在 Worker Triggers 添加通配符路由 |
| 用户路由访问到全局路由 | 用户没有创建同名 `prefix` | 在用户后台添加对应路由 |
| 管理员路由看不到用户路由 | 这是设计行为 | 用户路由归用户面板管理，管理员路由是全局路由 |
| D1 表结构异常 | 旧表结构残留或初始化中断 | 管理后台执行“重置数据库” |
| 注册失败但邀请码被占用 | 运行的不是最新版本 | 确认 GitHub Actions 部署到最新提交 |

English:

| Issue | Likely Cause | Fix |
|---|---|---|
| `/admin` login fails | `ADMIN_PASSWORD` is missing or overwritten with empty value | Set `ADMIN_PASSWORD` manually as a Worker Secret |
| Registration says DNS not configured | Missing `CF_ZONE_ID` or `CF_DNS_API_TOKEN` | Check Worker variables and secrets |
| Invalid optimized target | Target includes path, port, or invalid characters | Enter only a domain, IPv4, or IPv6 |
| User subdomain returns 404 | Missing wildcard Worker route | Add `*.BASE_DOMAIN/*` route |
| User route falls back to global route | User does not have that prefix | Add the route in user panel |
| Admin panel does not show user routes | By design | User routes are managed in user panels |
| D1 schema error | Old schema or interrupted initialization | Use admin database reset |
| Invite consumed after failed registration | Deployment is outdated | Deploy latest commit |

## SECURITY NOTES | 安全提示

1. 不要把 `ADMIN_PASSWORD` 写入 `wrangler.toml`。
   Do not write `ADMIN_PASSWORD` into `wrangler.toml`.

2. 建议把 `ADMIN_PASSWORD`、`CF_DNS_API_TOKEN`、`SESSION_SECRET` 配置为 Secret。
   Configure `ADMIN_PASSWORD`, `CF_DNS_API_TOKEN`, and `SESSION_SECRET` as Secrets.

3. DNS Token 建议只给目标 Zone 的 DNS 编辑权限。
   Limit DNS token permissions to DNS edit for the target Zone.

4. 定期备份 D1 中的重要数据。
   Back up important D1 data regularly.

5. 合理使用 Worker 请求量，避免过度请求。
   Use Worker requests responsibly.

## DISCLAIMER | 声明

中文：本工具仅用于学习、研究和自有服务代理测试。请勿用于违法用途。使用本工具产生的一切后果由使用者自行承担。

English: This tool is for learning, research, and proxying services you are authorized to operate. Do not use it for illegal purposes. You are responsible for your own usage.
