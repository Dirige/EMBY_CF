# Emby 反向代理部署教程（Cloudflare Workers 多人版）

适用版本：**v6.7.5-multi**
部署文件：[worker.js](worker.js)
仓库：<https://github.com/Dirige/EMBY_CF>

本教程从零开始，覆盖 D1、API Token、Worker 部署、环境变量、域名、路由、用户系统、Telegram、Cron、统计、备份和排错。

---

## 目录

1. [前置条件](#1-前置条件)
2. [域名规划](#2-域名规划)
3. [创建 D1 数据库（可选）](#3-创建-d1-数据库可选)
4. [创建 Cloudflare API Token](#4-创建-cloudflare-api-token)
5. [部署 Worker](#5-部署-worker)
6. [绑定 D1 数据库](#6-绑定-d1-数据库)
7. [环境变量表](#7-环境变量表)
8. [绑定访问域名](#8-绑定访问域名)
9. [首次登录后台](#9-首次登录后台)
10. [添加 Emby 路由](#10-添加-emby-路由)
11. [DNS 与优选域名](#11-dns-与优选域名)
12. [用户与邀请码](#12-用户与邀请码)
13. [Telegram 与 Webhook 通知](#13-telegram-与-webhook-通知)
14. [Cron 定时任务](#14-cron-定时任务)
15. [系统设置](#15-系统设置)
16. [统计与数据表](#16-统计与数据表)
17. [备份、升级与迁移](#17-备份升级与迁移)
18. [故障排查](#18-故障排查)
19. [安全清单](#19-安全清单)
20. [常见问题](#20-常见问题)
21. [附录：后台接口速查](#21-附录后台接口速查)

---

## 1. 前置条件

| 项目 | 要求 | 说明 |
| --- | --- | --- |
| Cloudflare 账号 | 已注册 | Workers、D1 免费套餐即可起步 |
| 域名 | 已接入 Cloudflare，状态为 Active（已激活） | DNS 与 Zone 功能依赖它 |
| Emby 上游 | 可从公网访问 | 推荐 HTTPS，支持 HTTP |
| D1 数据库 | 已启用 | Worker 的路由、用户和统计都存这里 |
| Telegram（可选） | 一个机器人 | 用于日报和线路告警 |
| 浏览器 | 支持现代 JavaScript | 后台是单页控制台 |

> Worker、D1 都有免费额度，流量较大时请留意 Cloudflare 控制台的用量与限制。

## 2. 域名规划

先确定三个域名概念，后面所有步骤都围绕它们：

| 名称 | 变量 | 示例 | 作用 |
| --- | --- | --- | --- |
| 主入口 | `BASE_DOMAIN` | `fd.example.com` | 管理后台、统计、全局路由 |
| 主记录名 | `DNS_RECORD_NAME` | `fd` | 仅当 DNS 记录名与主入口不同时填写 |
| 用户域名 | `USER_DOMAIN` | `example.com` | 用户入口 `用户名.example.com` |

常见组合：

| BASE_DOMAIN | DNS_RECORD_NAME | USER_DOMAIN | 主入口 | 用户入口 |
| --- | --- | --- | --- | --- |
| `fd.example.com` | `fd` | 自动 | `fd.example.com` | `alice.example.com` |
| `fd.example.com` | 留空 | `example.com` | `fd.example.com` | `alice.example.com` |
| `example.com` | 留空 | 自动 | `example.com` | `alice.example.com` |

自动推导规则：如果 `BASE_DOMAIN` 形如 `子域名.example.com`，且 `DNS_RECORD_NAME` 与这一级相同，会自动去掉它，得到 `example.com` 作为用户域名。拿不准时直接显式设置 `USER_DOMAIN`。

> 用户名同时是子域名，只能是 3–32 位小写字母、数字或短横线，且首尾不能是短横线。

## 3. 创建 D1 数据库（可选）

> 使用 GitHub Actions 部署时可以直接跳过本节：工作流会查询已有 D1，没有则自动创建 `fd`。只有控制台或命令行手动部署时才需要手动创建。

1. 打开 Cloudflare 控制台。
2. 进入 **Storage & Databases（存储和数据库） → D1 SQL Database（D1 SQL 数据库）**。
3. 点击 **Create（创建）**。
4. 数据库名称填 `emby-proxy`（名称可自定义，后面绑定时要用）。
5. 点击 **Create（创建）** 完成。

不需要手动建表。Worker 第一次收到请求时会自动创建并升级所有表。

## 4. 创建 Cloudflare API Token

### 4.1 创建入口

1. 点击右上角头像 → **My Profile（我的个人资料）**。
2. 左侧选择 **API Tokens（API 令牌）**。
3. 点击 **Create Token（创建令牌）**。
4. 选择 **Create Custom Token（创建自定义令牌）**。
5. 名称填 `emby-proxy`，方便以后识别。

### 4.2 权限配置

在 **Permissions（权限）** 区域逐项添加：

| 权限（Cloudflare 显示名） | 中文含义 | 用途 | GitHub Actions 部署 | Worker 运行 |
| --- | --- | --- | --- | --- |
| Account · Workers Scripts · Edit（账户 · Workers 脚本 · 编辑） | 编辑 Workers 脚本 | 部署和更新 Worker | 必需 | 否 |
| Account · D1 · Edit（账户 · D1 · 编辑） | 编辑 D1 | 创建、查询 D1 数据库 | 必需 | 否 |
| Zone · Workers Routes · Edit（区域 · Workers 路由 · 编辑） | 编辑 Workers 路由 | 创建主入口和通配路由 | 必需 | 否 |
| Zone · Zone · Read（区域 · 区域 · 读取） | 读取区域 | 查询 Zone ID、列出域名 | 必需 | 必需 |
| Zone · DNS · Edit（区域 · DNS · 编辑） | 编辑 DNS | 创建、修改、删除 DNS 记录 | 必需 | 必需 |
| Zone · Analytics · Read（区域 · 分析 · 读取） | 读取区域分析 | 读取 Zone 级访问统计 | 建议 | 建议 |
| Account · Account Analytics · Read（账户 · 账户分析 · 读取） | 读取账户分析 | 全站、用户子域名、Worker 统计 | 建议 | 建议 |

> 最省事的做法是一个令牌勾选全部权限：既能给 GitHub Actions 部署，也能填到 Worker 的 `CF_API_TOKEN`。如果不想把部署权限交给运行时，可另建一个只含 `Zone · Zone · Read`、`Zone · DNS · Edit`、`Zone · Analytics · Read`、`Account · Account Analytics · Read` 的令牌。

### 4.3 资源范围

| 配置项 | 建议值 | 说明 |
| --- | --- | --- |
| Zone Resources（区域资源） | Include（包括）→ All zones（所有区域） | 只用一个域名时也可选 Specific zone（特定区域） |
| Account Resources（账户资源） | Include（包括）→ 你的账号 | Account Analytics 需要账户级权限 |

点击 **Continue to summary（继续以查看摘要）**，确认无误后点击 **Create Token（创建令牌）**。

> Token 只显示一次。立刻复制并保存到安全位置，后面填到 Worker 的 `CF_API_TOKEN`。

## 5. 部署 Worker

### 5.1 GitHub Actions 部署（推荐）

仓库自带 [deploy.yml](.github/workflows/deploy.yml)，推送到 `master` / `main` 或手动运行都会自动部署。

1. Fork 本仓库。
2. 进入 **Settings（设置） → Secrets and variables（机密和变量） → Actions → New repository secret（新建仓库机密）**。
3. 按下表添加 Secrets。
4. 进入 **Actions（操作） → Deploy to Cloudflare Workers → Run workflow（运行工作流）**。
5. 工作流会依次检查 Secrets、获取或创建 D1、部署 Worker、创建主入口与通配路由、创建 DNS 记录。
6. 部署完成后，到 Cloudflare 控制台给 Worker 补充运行变量（尤其是 `ADMIN_TOKEN`）。

| GitHub Secret | 必填 | 用途 | 示例 |
| --- | --- | --- | --- |
| `CF_API_TOKEN` | 是 | 部署与 DNS 操作，权限见第 4 节 | `cf_xxx` |
| `CF_ACCOUNT_ID` | 是 | Cloudflare 账户 ID | `a1b2c3...` |
| `CF_ZONE_ID` | 是 | 域名所在 Zone ID | `023e...` |
| `BASE_DOMAIN` | 是 | 主入口完整域名；工作流也兼容 `CF_DOMAIN` | `fd.example.com` |
| `CF_WORKER_NAME` | 否 | Worker 名称，默认 `fd` | `emby-proxy` |
| `CF_DNS_API_TOKEN` | 否 | 单独的 DNS 令牌；不填复用 `CF_API_TOKEN` | `cf_xxx` |
| `CF_D1_ID` | 否 | 已有 D1 数据库 ID；不填自动查询或创建 | `xxxx-...` |

> `ADMIN_TOKEN` 不要放进 GitHub Secrets，也不要写进 `wrangler.toml`。工作流使用 `keep_vars = true`，运行变量统一在 Cloudflare 控制台维护，这样不会覆盖你已修正的值。

工作流创建的资源：

| 资源 | 内容 |
| --- | --- |
| D1 | 数据库 `fd`，绑定名 `DB` |
| Worker | 名称默认 `fd`，入口 [worker.js](worker.js) |
| 路由 | `BASE_DOMAIN/*` 与 `*.用户域名/*` |
| DNS | 主入口 CNAME，已代理（橙云） |

### 5.2 控制台部署（手动）

1. 进入 **Workers & Pages（Workers 和 Pages）**。
2. 点击 **Create application（创建应用程序） → Create Worker（创建 Worker）**。
3. 名称填 `emby-proxy`，点击 **Deploy（部署）**。
4. 点击 **Edit code（编辑代码）**。
5. 删除模板代码，粘贴仓库里的 [worker.js](worker.js) 全文。
6. 点击右上角 **Deploy（部署）**。

### 5.3 命令行部署（可选）

如果习惯本地开发，可以用 Wrangler：

```bash
npm install -g wrangler
wrangler login
wrangler d1 create emby-proxy
```

在项目根目录创建 `wrangler.toml`：

```toml
name = "emby-proxy"
main = "worker.js"
compatibility_date = "2025-01-01"

[[d1_databases]]
binding = "DB"
database_name = "emby-proxy"
database_id = "在此填写 wrangler d1 create 返回的 ID"

[triggers]
crons = ["0 * * * *"]
```

敏感变量用命令写入，不写进 `wrangler.toml`：

```bash
wrangler secret put ADMIN_TOKEN
wrangler secret put CF_API_TOKEN
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler deploy
```

普通变量可以写在 `wrangler.toml` 的 `[vars]` 里：

```toml
[vars]
BASE_DOMAIN = "fd.example.com"
DNS_RECORD_NAME = "fd"
USER_DOMAIN = "example.com"
```

## 6. 绑定 D1 数据库

1. 打开 Worker → **Settings（设置） → Bindings（绑定）**。
2. 点击 **Add（添加） → D1 database（D1 数据库）**。
3. **Variable name（变量名）** 必须填 `DB`（大小写敏感）。
4. 选择第 3 步创建的 `emby-proxy` 数据库。
5. 点击 **Save（保存）**，然后重新部署一次。

| 绑定类型 | 变量名 | 用途 | 必填 |
| --- | --- | --- | --- |
| D1 database（D1 数据库） | `DB` | 路由、用户、邀请码、统计、设置、审计 | 是 |

> 绑定名写成 `DB` 以外的任何名字，Worker 都会提示「D1 数据库未绑定」。

## 7. 环境变量表

路径：Worker → **Settings（设置） → Variables and Secrets（变量和机密） → Add（添加）**。

### 7.1 完整变量

| 变量 | 必填 | 说明 | 示例 / 默认 | 兼容别名 |
| --- | --- | --- | --- | --- |
| `ADMIN_TOKEN` | 是 | 管理员登录密钥，用户名 `admin`，密码即此值 | 32 位以上随机字符串 | `ADMIN_PASSWORD`、`admin_token`、`AdminToken` |
| `SESSION_SECRET` | 否 | 登录会话签名密钥；不填则回退到 `ADMIN_TOKEN` | 独立随机字符串 | 无 |
| `BASE_DOMAIN` | 是 | 主入口完整域名，用于 Zone 解析、DNS、统计和用户域名推导 | `fd.example.com` | `CF_DOMAIN` |
| `DNS_RECORD_NAME` | 否 | 主入口 DNS 记录名；留空表示记录名就是 `BASE_DOMAIN` | `fd` / `proxy` | 无 |
| `USER_DOMAIN` | 否 | 用户入口域名后缀；不填则自动推导 | `example.com` | `ENTRY_DOMAIN`、`USER_BASE_DOMAIN` |
| `CF_API_TOKEN` | 是 | Cloudflare API 令牌，权限见第 4 节 | `cf_xxx` | `CF_DNS_API_TOKEN`、`CF_ANALYTICS_TOKEN` |
| `CF_ZONE_ID` | 否 | 手动指定 Zone ID；不填自动查询 | `023e...` | 无 |
| `CF_ACCOUNT_ID` | 否 | 手动指定 Account ID；不填自动查询 | `a1b2...` | 无 |
| `TELEGRAM_BOT_TOKEN` | 否 | Telegram 机器人 Token | `123456:ABC...` | `TG_BOT_TOKEN` |
| `TELEGRAM_CHAT_ID` | 否 | Telegram 会话 ID，群组为负数 | `123456789` / `-100...` | `TG_CHAT_ID` |
| `NOTIFY_WEBHOOK` | 否 | 通用通知 Webhook，POST JSON `{ text, content }` | `https://...` | 无 |
| `STATS_HOSTS` | 否 | 统计域名覆盖，逗号或空格分隔 | 不填自动使用主入口 | 无 |
| `MONITOR_URL` | 否 | 后台「优选域名监控」链接 | `https://yx.255432.xyz/` | 无 |
| `TG_GROUP_URL` | 否 | 后台「Telegram 群组」链接 | 代码内置邀请链接 | 无 |
| `GITHUB_URL` | 否 | 后台 GitHub 链接 | `https://github.com/Dirige/EMBY_CF` | `GITHUB_REPO` |
| `DISABLE_DIRECT_PROXY` | 否 | 设为 `1` 关闭 `/https://...` 直连代理 | 不填 = 开启 | 无 |
| `DIRECT_PROXY_ALLOW` | 否 | 直连代理允许的域名/主机，逗号分隔；留空 = 不限制 | `example.com,emby.test` | 无 |

### 7.2 建议的变量类型

| 变量 | 类型建议 | 原因 |
| --- | --- | --- |
| `ADMIN_TOKEN` | Secret（机密） | 就是管理员密码 |
| `SESSION_SECRET` | Secret（机密） | 会话签名密钥 |
| `CF_API_TOKEN` | Secret（机密） | 可操作 DNS |
| `TELEGRAM_BOT_TOKEN` | Secret（机密） | 可控制机器人 |
| `NOTIFY_WEBHOOK` | Secret（机密） | 地址本身可能含密钥 |
| 其余变量 | Text（文本） | 非敏感配置 |

### 7.3 兼容与回退规则

- `CF_API_TOKEN` 留空时，会依次尝试 `CF_DNS_API_TOKEN`、`CF_ANALYTICS_TOKEN`。
- Telegram 变量优先读 `TELEGRAM_*`，没有再读 `TG_*`。
- `CF_ZONE_ID`、`CF_ACCOUNT_ID` 都可以不配，Worker 会用 `BASE_DOMAIN + CF_API_TOKEN` 自动查询，并按最长后缀匹配 Zone。
- 修改变量后建议重新部署一次，确保所有 isolate 都读到新值。

## 8. 绑定访问域名

1. 打开 Worker → **Settings（设置） → Domains & Routes（域和路由）**。
2. 点击 **Add（添加） → Custom domain（自定义域）**。
3. 输入 `BASE_DOMAIN`，例如 `fd.example.com`。
4. 点击 **Add domain（添加域名）**，等待证书签发。

绑定成功后：

| 地址 | 结果 |
| --- | --- |
| `https://fd.example.com/` | 首页 / 用户控制台 |
| `https://fd.example.com/admin` | 管理后台 |
| `https://fd.example.com/health` | 健康检查 JSON |

> 如果你改用 **Route（路由）** 方式接入，请保证对应 DNS 记录是**已代理（橙云 / Proxied）**，否则请求不会进入 Worker。后台的 DNS 快捷替换默认创建的是「仅 DNS（灰云）」记录，适合指向优选域名或独立入口；需要 Worker 接管时请保持橙云或使用 Custom domain。

## 9. 首次登录后台

1. 打开 `https://BASE_DOMAIN/admin`。
2. 用户名填 `admin`。
3. 密码填 `ADMIN_TOKEN`。
4. 登录成功后会写入 HttpOnly 会话 Cookie。

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 提示未读到 `ADMIN_TOKEN` | 变量没保存或名字写错 | 在变量和机密中重新添加，保存后重新部署 |
| 提示管理密钥错误 | 密码不是 `ADMIN_TOKEN` | 核对变量值，注意首尾空格 |
| 提示尝试次数过多 | 同一 IP 10 分钟内连续失败 5 次 | 等待 10 分钟再试 |

> 管理员密码不能单独修改，改 `ADMIN_TOKEN` 就是改密码；未单独设置 `SESSION_SECRET` 时，修改后旧会话会失效。

后台功能一览：

| 区块 | 功能 |
| --- | --- |
| 路由管理 | 添加、编辑、排序、测试、启用/停用、删除 |
| DNS | 查看与一键替换主入口记录 |
| 用户管理 | 新建、编辑、启用/禁用、删除、调整配额 |
| 邀请码 | 生成、复制、删除、清空 |
| 优选域名 | 内置域名、手动测速、添加/删除自定义域名 |
| 使用统计 | 今日请求、流量、访问量、24 小时曲线、7 天趋势 |
| 审计日志 | 最近 500 条操作记录 |
| 系统设置 | 健康检查、日报开关、限速、跳转域名、回源映射 |
| 配置管理 | 导出/导入配置 |
| 通知 | 发送日报、立即健康检查 |

## 10. 添加 Emby 路由

登录后台，在「路由管理」点击 **Add route（添加路由）**。

### 10.1 字段说明

| 字段 | 说明 | 示例 |
| --- | --- | --- |
| 路径前缀 `prefix` | 访问路径的第一段，1–63 位字母、数字、下划线或连字符 | `emby` |
| 上游地址 `target` | 一个或多个 `http(s)` 地址，用逗号或换行分隔 | `https://emby.example.com` |
| 备注 `remark` | 便于识别的名称 | `主服务器` |
| 图片缓存 `cache_img` | `on` 缓存图片和静态资源；`off` 全部回源 | `on` |
| 兼容模式 `compat_mode` | `on` 时把 `Origin`、`X-Forwarded-*` 改写为上游地址 | `off` |
| IP 模式 `ip_mode` | `forward` 透传客户端 IP；`strip` 删除伪造头；`disable` 彻底隐藏 | `forward` |
| 自定义请求头 | 每行一个 `Name: Value` | `X-Custom: 1` |
| IP 白名单 `ip_allow` | 允许访问的 IP/CIDR，留空不限制 | `1.2.3.4,10.0.0.0/8` |
| IP 黑名单 `ip_block` | 拒绝访问的 IP/CIDR，优先于白名单 | `5.6.7.8` |
| 启用 | 关闭后返回 `503` | 开 |

### 10.2 路径映射规则

请求：

```text
https://fd.example.com/emby/web/index.html
```

路由前缀 `emby`，上游 `https://emby.example.com`，实际转发：

```text
https://emby.example.com/web/index.html
```

即：**去掉第一段前缀，其余路径和查询参数原样保留**。

### 10.3 多目标与熔断

同一路由可填写多个上游：

```text
https://emby-a.example.com
https://emby-b.example.com
```

Worker 会按顺序尝试；某条线路近期失败会被短暂跳过（约 30 秒），最后一条线路始终会尝试。

### 10.4 保留前缀

管理员的全局路由不能使用以下前缀（含系统路径和 Emby 常用路径别名）：

```text
admin, stats, health, api, favicon.ico, cdn-cgi, __client_rtt__,
web, emby, sessions, playbackinfo
```

用户私有路由只屏蔽系统接口路径，`emby`、`web`、`sessions` 等名字可以使用：

```text
admin, api, stats, health, register, login, logout, favicon.ico,
robots.txt, cdn-cgi, .well-known, assets, static
```

## 11. DNS 与优选域名

### 11.1 Zone 自动识别

Worker 使用 `BASE_DOMAIN` 和 `CF_API_TOKEN` 自动查询 Zone：

1. 先精确匹配 `BASE_DOMAIN`。
2. 失败后列出账号下的 Zone，按最长后缀匹配。
3. `CF_ZONE_ID`、`CF_ACCOUNT_ID` 可手动指定，减少 API 调用。

如果提示「未解析到 Zone」，通常是 Token 缺少 **Zone · Zone · Read（区域 · 区域 · 读取）**，或 `BASE_DOMAIN` 写错。

### 11.2 后台 DNS 快捷替换

后台 DNS 区域提供「记录名 → 目标」的快速保存：

| 字段 | 说明 |
| --- | --- |
| 记录名 | 前缀（`fd`）、完整域名，或留空使用 `DNS_RECORD_NAME`；未配置 `DNS_RECORD_NAME` 时请显式填写 |
| 目标 | 域名、IPv4 或 IPv6，例如 `youxuan.cf.090227.xyz` |
| 记录类型 | 自动判断：域名 → CNAME，IPv4 → A，IPv6 → AAAA |
| 代理状态 | 默认关闭小黄云（仅 DNS） |

保存逻辑：同类型记录原地更新，避免解析空窗；类型不同则先删除同名 A/AAAA/CNAME，再创建新记录，失败会自动回滚。TXT、MX 等其他记录不会被动。

### 11.3 用户子域名 DNS

用户注册或管理员新建用户时，会自动创建：

```text
用户名.USER_DOMAIN  CNAME  youxuan.cf.090227.xyz（默认，仅 DNS）
```

- 默认目标是代码内置的优选域名，可在用户中心修改为任意 IP 或域名。
- 用户中心保存 DNS 值时会先删除同名 A/AAAA/CNAME，再按新值创建，避免类型冲突；因此会有极短的解析空窗。
- 如果同名记录已存在且不是本程序创建的 CNAME，不会覆盖，会提示手动处理。
- 自动创建失败不会阻止建号，用户可在「我的入口」点击「重新创建 DNS」重试。

### 11.4 内置优选域名

| 名称 | 域名 |
| --- | --- |
| CF优选-090227 | `youxuan.cf.090227.xyz` |
| 秋名山优选 | `cf.877774.xyz` |
| NB优选 | `cf.cf.cnae.top` |
| MIYU优选 | `saas.sin.fan` |
| Mingyu优选 | `bestcf.030101.xyz` |
| WeTest优选 | `cf.cloudflare.182682.xyz` |
| 无名氏维护域名 | `cf.tencentapp.cn` |
| 乌克兰外交部 | `mfa.gov.ua` |
| Shopify官方 | `www.shopify.com` |
| 育碧商店 | `store.ubi.com` |
| NexusMods | `staticdelivery.nexusmods.com` |

后台可以手动测速（浏览器侧延迟测试），也可以添加或删除自定义优选域名。内置域名不可删除。

## 12. 用户与邀请码

### 12.1 生成邀请码

后台「邀请码」→ **Generate invite（生成邀请码）**：

| 字段 | 说明 | 默认 |
| --- | --- | --- |
| 邀请码 | 留空自动生成 10 位大写字母数字 | 自动 |
| 最大使用次数 | `0` 表示不限次数 | `1` |
| 过期日期 | 可选，到期后不可用 | 不过期 |
| 备注 | 例如「给朋友」 | 空 |

支持复制单个邀请码、删除单个、删除全部。

### 12.2 用户注册

访问 `https://BASE_DOMAIN/register`，填写：

| 字段 | 规则 |
| --- | --- |
| 邀请码 | 必须有效、未过期、未用完 |
| 用户名 | 3–32 位小写字母、数字或短横线，首尾不能是短横线 |
| 密码 | 至少 6 位 |

注册成功后：

1. 自动创建用户记录，默认配额 20 条路由。
2. 自动创建 `用户名.USER_DOMAIN` 的 CNAME。
3. 自动登录并进入用户控制台。
4. 写入审计日志 `user.register`。

> 自动创建的记录默认是**仅 DNS（灰云）**。如果要让 `用户名.USER_DOMAIN` 的请求真正进入本 Worker，还需要为 Worker 添加通配路由 `*.USER_DOMAIN/*`（把 `USER_DOMAIN` 换成你的用户域名），并把该记录改为**已代理（橙云）**。只用主入口时可以不做。

保留子域名（不能注册）：

```text
admin, api, www, mail, smtp, ftp, ns, ns1, ns2, dns, proxy, stats,
health, register, login, logout, cdn, static, test, dev, staging,
root, support, help, status
```

### 12.3 管理员建用户

后台「用户管理」→ **Add user（添加用户）**：

| 字段 | 说明 |
| --- | --- |
| 用户名 | 同时作为子域名 |
| 密码 | 至少 6 位 |
| 子域名 | 默认等于用户名，可修改 |
| 角色 | `user` 或 `admin` |
| 状态 | `active` 或 `disabled` |
| 路由配额 | 1–200，默认 20 |

新建后同样会自动创建 CNAME。禁用用户后无法登录；删除用户会同时删除其私有路由、统计和相关记录，操作不可恢复。

### 12.4 用户中心

普通用户登录 `/` 后可以：

| 功能 | 说明 |
| --- | --- |
| 我的入口 | 查看用户名、入口域名、路由数量、DNS 状态 |
| DNS 记录值 | 修改 CNAME 目标为 IP 或域名，或重新创建 DNS |
| 我的路由 | 添加、编辑、排序、测试、启停、删除私有路由 |
| 使用统计 | 仅查看自己的 D1 统计数据 |
| 修改密码 | 修改自己的登录密码 |
| 退出 | 清除会话 |

用户路由只在 `用户名.USER_DOMAIN` 下生效；如果用户没有同名前缀，会回退到管理员的全局路由。

## 13. Telegram 与 Webhook 通知

### 13.1 创建机器人

1. 在 Telegram 搜索 **@BotFather**。
2. 发送 `/newbot`，按提示设置名称和用户名。
3. 复制返回的 Token，填入 `TELEGRAM_BOT_TOKEN`。
4. 打开你的机器人，点击 **Start（开始）** 或发送 `/start`。

### 13.2 获取 Chat ID

| 场景 | 方法 |
| --- | --- |
| 私聊 | 给 **@userinfobot** 发消息，返回的数字 ID 即 `chat_id` |
| 群组 | 把机器人拉进群，在群里发一条消息，访问 `https://api.telegram.org/bot<TOKEN>/getUpdates` 查看 `chat.id`（通常为负数） |

### 13.3 配置与测试

1. 在 Worker 变量中添加 `TELEGRAM_BOT_TOKEN`、`TELEGRAM_CHAT_ID`。
2. 保存并重新部署。
3. 后台点击 **Send report（发送日报）** 测试。
4. 收到消息即配置成功。

通知内容包括：每日 23:00 日报、线路异常与恢复告警。

### 13.4 Webhook（可选）

不想要 Telegram 时，可以只配 `NOTIFY_WEBHOOK`。Worker 会向该地址 POST：

```json
{
  "text": "通知内容",
  "content": "通知内容"
}
```

Telegram 和 Webhook 可以同时配置，两者互不影响。

## 14. Cron 定时任务

路径：Worker → **Settings（设置） → Trigger Events（触发器事件） → Cron Triggers（Cron 触发器） → Add（添加）**。

Cron 使用 **UTC 时间**。北京时间 = UTC + 8。

| Cron | 北京时间 | 作用 | 建议 |
| --- | --- | --- | --- |
| `0 * * * *` | 每小时整点 | 刷新统计、健康检查（如开启）、23:00 发日报 | 推荐 |
| `0 15 * * *` | 每天 23:00 | 只发日报并刷新统计 | 最简 |
| `0 */6 * * *` | 每 6 小时 | 统计与健康检查 | 可选 |

每次触发会：

1. 初始化/升级数据库。
2. 把内存中的小时统计刷入 D1。
3. 如果开启「线路健康检查」，最多探测 40 条上游；连续 2 次失败标记异常并告警。
4. 如果北京时间是 23 点且开启日报，用 D1 抢占锁后发送一次日报，避免重复发送。

> 多人版不会在 Cron 中自动测速替换 DNS；DNS 替换由后台手动触发。请勿照搬单用户版的自动优选说明。

## 15. 系统设置

后台「设置」可修改以下项目（保存在 D1 `settings` 表）：

| 设置项 | 默认 | 说明 |
| --- | --- | --- |
| 线路健康检查 | 关闭 | 开启后 Cron 探测上游，异常/恢复时推送通知 |
| 每日日报 | 开启 | 北京时间 23:00 发送；需配置 Telegram 或 Webhook |
| 每分钟请求限制 | `0` | 每个 IP 每分钟的上限；`0` = 不限；对非流媒体/静态资源请求生效 |
| 手动跳转域名 | 内置列表 | 命中这些域名的 3xx 跳转直接返回客户端，不自动跟随 |
| 域名回源映射 | `{}` | JSON 对象，按后缀改写上游 Host；仅日本节点生效 |

域名回源映射示例：

```json
{
  "example.com": "1.2.3.4",
  "media.example.net": "media-backup.example.net"
}
```

含义：当请求落在 `NRT`、`KIX`、`FUK`、`OKA` 节点，且上游域名匹配某个后缀时，把上游 Host 改写为对应值。

设置页还提供 **Run health check（立即健康检查）** 和 **Send report（发送日报）** 两个手动按钮。

## 16. 统计与数据表

### 16.1 统计口径

| 场景 | 主数据源 | 回退顺序 |
| --- | --- | --- |
| 管理员全局 | Cloudflare Account Analytics | Zone Analytics → D1 |
| 单个用户 | D1 | 无（不查询账号级数据，避免越权） |
| 路由排行 | D1 `route_stats_daily` | 无 |
| 流量 | 按实际发送字节统计 | 小响应用 `content-length` 快速路径 |

视频、分段等大响应用计数流统计，客户端中途断开时按实际已发送字节结算，不会把整个文件长度算成流量。

### 16.2 数据表

首次请求自动创建，后续版本自动补列/补索引：

| 表名 | 用途 |
| --- | --- |
| `routes` | 管理员全局路由 |
| `user_routes` | 用户私有路由 |
| `users` | 用户账号 |
| `invite_codes` | 邀请码 |
| `settings` | 系统设置 |
| `dns_config` | DNS 记录配置 |
| `optimized_domains` | 优选域名 |
| `proxy_stats_hourly` | 全局小时统计 |
| `user_stats_hourly` | 用户小时统计 |
| `route_stats_daily` | 路由日统计 |
| `route_health` | 线路健康状态 |
| `audit_log` | 审计日志（保留最近 500 条） |

### 16.3 访问方式

| 路径 | 说明 | 权限 |
| --- | --- | --- |
| `/stats` | 返回 JSON 统计，可带 `?date=YYYY-MM-DD` | 公开 |
| `/admin/api/stats` | 管理员统计接口 | 管理员会话 |
| `/api/user/stats` | 用户自己的统计 | 用户会话 |

后台「清空统计」会删除小时统计、路由日统计、线路健康状态和审计日志，不影响路由与用户，操作前请确认。

## 17. 备份、升级与迁移

### 17.1 导出/导入配置

后台「导出配置」会下载 JSON，包含：

| 内容 | 是否包含 |
| --- | --- |
| 当前管理员创建的全局路由 | 是 |
| 自定义优选域名 | 是 |
| 系统设置 | 是 |
| 用户、邀请码、统计、审计 | 否 |

导入时会跳过他人路由和非法条目，返回成功数量与被跳过的前缀。导入不会创建用户，也不会覆盖用户数据。

### 17.2 完整备份

需要迁移全部用户和统计时，使用 D1 自带的导出：

1. **Storage & Databases（存储和数据库） → D1 SQL Database（D1 SQL 数据库）**。
2. 选择数据库 → **Export（导出）**。
3. 下载控制台提供的备份文件（通常为 SQL）。

### 17.3 升级步骤

1. 先导出 D1 备份和后台配置。
2. 用新版本 `worker.js` 全文替换旧代码。
3. 点击 **Deploy（部署）**。
4. 访问 `/health` 确认版本号。
5. 打开后台检查路由、用户、统计是否正常。

数据库结构会在首次请求时自动迁移，不需要手动执行 SQL。

### 17.4 迁移到新账号/新域名

1. 在新账号创建 D1 并导入数据。
2. 重新创建 API Token。
3. 部署 Worker，绑定 `DB`。
4. 配置新的 `BASE_DOMAIN`、`USER_DOMAIN`、`CF_API_TOKEN`。
5. 绑定新的自定义域。
6. 在后台更新 DNS 记录，通知用户新的入口域名。

## 18. 故障排查

| 现象 | 可能原因 | 处理 |
| --- | --- | --- |
| 打开 `/admin` 提示未读到 `ADMIN_TOKEN` | 变量未保存、名字写错、未重新部署 | 重新添加变量并部署 |
| 提示「D1 数据库未绑定」 | 绑定变量名不是 `DB` | 在 Bindings 中改为 `DB` |
| 提示「未解析到 Zone」 | Token 缺 Zone Read 或 `BASE_DOMAIN` 错误 | 补权限、核对域名 |
| 提示「读取区域列表失败」 | Token 无效或没有 Zone 权限 | 重新创建 Token |
| DNS 创建失败 | 缺 DNS Edit、记录冲突、Zone 不匹配 | 检查权限；先删除冲突记录 |
| DNS 提示记录已存在未覆盖 | 同名 A/AAAA/CNAME 不是本程序创建 | 手动处理或换记录名 |
| 用户子域名打不开 | CNAME 未创建、记录是灰云、没有通配路由 | 用户中心点「重新创建 DNS」；添加 `*.USER_DOMAIN/*` 路由并改为橙云 |
| 注册提示邀请码无效/用完 | 邀请码不存在、过期、次数用完 | 后台重新生成 |
| 注册提示用户名不可用 | 用户名/子域名被占用或是保留词 | 换一个用户名 |
| 登录提示尝试次数过多 | 同一 IP 10 分钟内连续失败 5 次 | 等 10 分钟 |
| 上报 404「节点不存在」 | 前缀不匹配、大小写错误、路由未创建 | 核对前缀与路由 |
| 上报 503「该路由已停用」 | 路由被停用 | 后台启用 |
| 返回 403 Forbidden | 命中 IP 黑名单或不在白名单 | 调整 IP 规则 |
| 返回 429 Too Many Requests | 触发每分钟限速 | 调高或设为 `0` |
| 统计一直是 0 | D1 未绑定、没有 Cron、还没有流量 | 检查绑定与 Cron，访问几次后再看 |
| Telegram 收不到消息 | 没点 Start、Chat ID 错、机器人不在群里 | 发送 `/start`；重新获取 ID |
| 日报重复发送 | 多个 Cron 同时触发 | 代码已用 D1 抢占；保留一个 23 点触发的 Cron 即可 |
| `/health` 正常但视频卡 | 上游慢、优选域名差、节点绕路 | 换上游、测速优选域名、开启多目标 |
| Worker 报 CPU/请求超限 | 免费额度或套餐限制 | 查看 Cloudflare 用量，降低频率或升级套餐 |

## 19. 安全清单

| 项目 | 建议 |
| --- | --- |
| `ADMIN_TOKEN` | 32 位以上随机字符串，定期更换 |
| `SESSION_SECRET` | 与 `ADMIN_TOKEN` 分开设置，避免共用 |
| `CF_API_TOKEN` | 最小权限，泄露后立即吊销 |
| 直连代理 | 不需要时设 `DISABLE_DIRECT_PROXY=1`，或用 `DIRECT_PROXY_ALLOW` 限制 |
| IP 规则 | 对敏感路由配置白名单 |
| 备份 | 升级前导出 D1 和配置 |
| 仓库 | 不提交任何 Token、密钥、D1 导出文件 |
| 用户 | 定期清理长期不用的账号和邀请码 |

> `/https://...` 是开放代理，默认只拦截 `localhost` 和私网/保留地址，公网目标仍可被任意使用。公网部署时请评估滥用风险，最稳妥的做法是直接关闭或使用允许列表。

## 20. 常见问题

| 问题 | 解答 |
| --- | --- |
| 可以用顶级域名吗？ | 可以，`BASE_DOMAIN` 支持任意层级，Zone 按最长后缀自动匹配 |
| 没有 Cloudflare 域名能用吗？ | Worker 可以运行，但 DNS、统计、用户子域名会自动失效 |
| 忘记管理员密码怎么办？ | 无法找回；修改 `ADMIN_TOKEN` 为新值即可 |
| 管理员用户名能改吗？ | 不能，固定为 `admin`（或用户名留空） |
| 支持 Emby WebSocket 吗？ | 支持，`Upgrade: websocket` 会转发 |
| 一个路由能填多个上游吗？ | 可以，逗号或换行分隔，按顺序尝试并熔断 |
| 用户能自己添加路由吗？ | 可以，在自己的子域名下添加，受配额限制 |
| 用户能看到别人的统计吗？ | 不能，用户只查自己的 D1 数据 |
| 图片缓存会串用户吗？ | 带凭据的图片不缓存，字幕不缓存，降低串数据风险 |
| 支持 HTTP 上游吗？ | 支持，但建议 HTTPS |
| 免费套餐够用吗？ | 小型自用通常够；流量大时注意 Workers、D1 的每日额度 |
| 如何恢复误删用户？ | 默认不可恢复，请从 D1 备份恢复或重新创建 |
| 如何只发日报不跑健康检查？ | 设置里关闭健康检查，保留日报开关和 23 点 Cron |
| 修改变量后必须重新部署吗？ | 建议重新部署，确保所有实例读取新值 |

## 21. 附录：后台接口速查

| 路径 | 方法 | 说明 | 权限 |
| --- | --- | --- | --- |
| `/admin/api/login` | POST | 登录 | 公开 |
| `/admin/api/logout` | POST | 退出 | 管理员 |
| `/admin/api/routes` | GET/POST/PUT/DELETE | 全局路由管理 | 管理员 |
| `/admin/api/routes/toggle` | POST | 启用/停用路由 | 管理员 |
| `/admin/api/routes/reorder` | POST | 路由排序 | 管理员 |
| `/admin/api/routes/test` | POST | 测试上游连通性 | 管理员 |
| `/admin/api/dns-config` | GET | 读取 DNS 配置 | 管理员 |
| `/admin/api/dns/replace` | POST | 创建/替换 DNS 记录 | 管理员 |
| `/admin/api/users` | GET/POST | 用户列表/新建 | 管理员 |
| `/admin/api/users/:id` | PUT/DELETE | 修改/删除用户 | 管理员 |
| `/admin/api/invites` | GET/POST | 邀请码列表/生成 | 管理员 |
| `/admin/api/invites/:code` | DELETE | 删除邀请码 | 管理员 |
| `/admin/api/invites/clear` | POST | 删除全部邀请码 | 管理员 |
| `/admin/api/optimized-domains` | GET/POST | 优选域名列表/添加 | 管理员 |
| `/admin/api/optimized-domains/:id` | PUT/DELETE | 编辑/删除优选域名 | 管理员 |
| `/admin/api/db/reset` | POST | 重置数据（需 `confirm: "RESET"`） | 管理员 |
| `/admin/api/stats` | GET | 全局统计 | 管理员 |
| `/admin/api/settings` | GET/POST | 读取/保存设置 | 管理员 |
| `/admin/api/audit` | GET | 审计日志 | 管理员 |
| `/admin/api/health/run` | POST | 立即健康检查 | 管理员 |
| `/admin/api/report/send` | POST | 发送日报 | 管理员 |
| `/admin/api/export` | GET | 导出配置 | 管理员 |
| `/admin/api/import` | POST | 导入配置 | 管理员 |
| `/api/register` | POST | 邀请码注册 | 公开 |
| `/api/user/me` | GET | 当前用户信息 | 用户 |
| `/api/user/routes` | GET/POST/PUT/DELETE | 用户路由管理 | 用户 |
| `/api/user/dns` | GET/POST | 用户 DNS 查询/修改 | 用户 |
| `/api/user/stats` | GET | 用户统计 | 用户 |
| `/api/user/password` | POST | 修改密码 | 用户 |
| `/health` | GET | 健康检查 | 公开 |
| `/stats` | GET | JSON 统计 | 公开 |

---

## 相关文档

- [README.md](README.md)：项目简介、核心变量与权限速查。

## 免责声明

本项目仅供学习与技术交流，请遵守所在地法律法规以及 Emby 与相关服务的使用条款。部署和使用风险由使用者自行承担。