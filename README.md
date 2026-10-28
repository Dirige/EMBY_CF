# EMBY_CF

**Emby 反向代理 · 多用户路由面板**

单文件 Cloudflare Worker，无需服务器、无需构建。集成反代、优选域名 DNS、访问统计、Telegram 日报和多用户子域名，仓库当前版本 **v6.7.5-multi**，入口文件 [worker.js](worker.js)。

![Platform](https://img.shields.io/badge/Cloudflare-Workers-F38020?style=flat-square&logo=cloudflare&logoColor=white)
![Database](https://img.shields.io/badge/D1-Database-00E5FF?style=flat-square)
![Version](https://img.shields.io/badge/version-v6.7.5--multi-41d9ff?style=flat-square)
[![License](https://img.shields.io/badge/License-MIT-00FF9D?style=flat-square)](LICENSE)

[![优选域名监控](https://img.shields.io/badge/Youxuan-yx.255432.xyz-00E5FF?style=flat-square)](https://yx.255432.xyz/)
[![Telegram 群组](https://img.shields.io/badge/Telegram-Join-26A5E4?style=flat-square&logo=telegram&logoColor=white)](https://t.me/+7cbXthaBajszNjI1)

- 优选域名监控：<https://yx.255432.xyz/>
- Telegram 群组：<https://t.me/+7cbXthaBajszNjI1>

[部署教程](DEPLOY.md) · [环境变量](#环境变量) · [API Token 权限](#api-token-权限) · [常见问题](DEPLOY.md#18-故障排查)

## 个人版

单用户 + VPS 中继分流版（三态分流 `off/on/image`、视频直连失败自动回退 VPS、一键部署脚本）：见 **[personal/README.md](personal/README.md)**。

---

## 功能

| 功能 | 说明 |
| --- | --- |
| Emby 反向代理 | 支持 HTTP、HTTPS、WebSocket、Range 和流媒体 |
| 多目标线路 | 同一路由可填多个上游，按顺序尝试并熔断 |
| 智能缓存 | 图片和静态资源走边缘缓存，字幕与带凭据的图片不缓存 |
| 多用户系统 | 邀请码注册，用户名即子域名，自动创建 CNAME |
| 用户配额 | 默认 20 条私有路由，管理员可按用户调整为 1–200 |
| 管理后台 | 路由、DNS、用户、邀请码、优选域名、统计、审计、设置、导入导出 |
| DNS 管理 | 自动识别 Zone，一键创建/替换记录，支持优选域名 |
| 访问统计 | D1 按小时聚合请求与流量，Cloudflare Analytics 作为补充 |
| 通知 | Telegram 日报、线路异常告警、通用 Webhook |
| 访问控制 | IP 透传模式、IP 白名单/黑名单、自定义请求头 |

## 快速开始

### 方式一：GitHub Actions（推荐）

1. Fork 本仓库。
2. 在 **Settings（设置） → Secrets and variables（机密和变量） → Actions** 添加下表的 Secrets。
3. 打开 **Actions（操作） → Deploy to Cloudflare Workers → Run workflow（运行工作流）**。
4. 工作流会自动创建 D1、部署 Worker、创建 `BASE_DOMAIN/*` 与 `*.用户域名/*` 路由和 DNS 记录。
5. 到 Cloudflare 控制台给 Worker 添加运行变量 `ADMIN_TOKEN`、`BASE_DOMAIN`、`CF_API_TOKEN`。
6. 打开 `https://BASE_DOMAIN/admin`，用户名 `admin`，密码为 `ADMIN_TOKEN`。

| GitHub Secret | 必填 | 用途 | 示例 |
| --- | --- | --- | --- |
| `CF_API_TOKEN` | 是 | 部署与 DNS 操作，权限见下表 | `cf_xxx` |
| `CF_ACCOUNT_ID` | 是 | Cloudflare 账户 ID | `a1b2c3...` |
| `CF_ZONE_ID` | 是 | 域名所在 Zone ID | `023e...` |
| `BASE_DOMAIN` | 是 | 主入口完整域名；也兼容 `CF_DOMAIN` | `fd.example.com` |
| `CF_WORKER_NAME` | 否 | Worker 名称，默认 `fd` | `emby-proxy` |
| `CF_DNS_API_TOKEN` | 否 | 单独的 DNS 令牌；不填复用 `CF_API_TOKEN` | `cf_xxx` |
| `CF_D1_ID` | 否 | 已有 D1 数据库 ID；不填自动查询或创建 | `xxxx-...` |

### 方式二：Cloudflare 控制台手动部署

1. 在 Cloudflare 创建 D1 数据库。
2. 新建 Worker，粘贴 [worker.js](worker.js) 并部署。
3. 绑定 D1，变量名必须是 **`DB`**。
4. 添加运行变量 `ADMIN_TOKEN`、`BASE_DOMAIN`、`CF_API_TOKEN`。
5. 为 Worker 绑定自定义域，或添加 `BASE_DOMAIN/*`、`*.用户域名/*` 路由。
6. 打开 `https://BASE_DOMAIN/admin` 登录。

## 环境变量

在 Cloudflare 控制台进入 Worker → **Settings（设置） → Variables and Secrets（变量和机密）** 配置。

| 变量 | 必填 | 说明 | 示例 |
| --- | --- | --- | --- |
| `ADMIN_TOKEN` | 是 | 管理员登录密钥，同时作为后台密码 | 32 位以上随机字符串 |
| `BASE_DOMAIN` | 是 | 主入口完整域名，用于 Zone 解析、DNS、统计和用户域名推导 | `fd.example.com` |
| `CF_API_TOKEN` | 是 | Cloudflare API 令牌，用于 DNS 与统计 | `cf_xxx` |
| `SESSION_SECRET` | 否 | 会话签名密钥；不填回退到 `ADMIN_TOKEN` | 独立随机字符串 |
| `DNS_RECORD_NAME` | 否 | 主入口 DNS 记录名，仅当与 `BASE_DOMAIN` 不同时填写 | `fd` / `proxy` |
| `USER_DOMAIN` | 否 | 用户入口域名后缀；不填自动推导 | `example.com` |
| `CF_ZONE_ID` | 否 | 手动指定 Zone ID；不填自动查询 | `023e...` |
| `CF_ACCOUNT_ID` | 否 | 手动指定 Account ID；不填自动查询 | `a1b2...` |
| `TELEGRAM_BOT_TOKEN` | 否 | Telegram 机器人 Token | `123456:ABC...` |
| `TELEGRAM_CHAT_ID` | 否 | Telegram 会话 ID，群组为负数 | `123456789` |
| `NOTIFY_WEBHOOK` | 否 | 通用通知 Webhook | `https://...` |

完整变量、兼容别名和回退规则见 [DEPLOY.md 的环境变量表](DEPLOY.md#7-环境变量表)。

## 绑定

| 类型 | 变量名 | 用途 | 必填 |
| --- | --- | --- | --- |
| D1 database（D1 数据库） | `DB` | 路由、用户、邀请码、统计、设置、审计 | 是 |

> 首次请求会自动建表并升级旧表，无需手动执行 SQL。绑定名必须是 `DB`，不能改。

## API Token 权限

入口：**My Profile（我的个人资料） → API Tokens（API 令牌） → Create Custom Token（创建自定义令牌）**。

| 权限（Cloudflare 显示名） | 用途 | GitHub Actions 部署 | Worker 运行 |
| --- | --- | --- | --- |
| Account · Workers Scripts · Edit（账户 · Workers 脚本 · 编辑） | 部署 Worker | 必需 | 否 |
| Account · D1 · Edit（账户 · D1 · 编辑） | 创建/查询 D1 | 必需 | 否 |
| Zone · Workers Routes · Edit（区域 · Workers 路由 · 编辑） | 创建主入口和通配路由 | 必需 | 否 |
| Zone · Zone · Read（区域 · 区域 · 读取） | 查询 Zone ID 与区域列表 | 必需 | 必需 |
| Zone · DNS · Edit（区域 · DNS · 编辑） | 创建、修改、删除 DNS 记录 | 必需 | 必需 |
| Zone · Analytics · Read（区域 · 分析 · 读取） | 读取 Zone 级统计 | 建议 | 建议 |
| Account · Account Analytics · Read（账户 · 账户分析 · 读取） | 读取全站/Worker 统计 | 建议 | 建议 |

> 一个令牌同时勾选以上权限最省事；不想给部署权限时，可另建一个只含后三项的令牌给 Worker 的 `CF_API_TOKEN`。

## 常用入口

| 路径 | 说明 | 权限 |
| --- | --- | --- |
| `/` | 首页 / 用户控制台 | 公开 |
| `/admin` | 管理后台 | 管理员 |
| `/register` | 邀请码注册 | 公开 |
| `/stats` | JSON 统计接口 | 公开 |
| `/health` | 健康检查，返回版本与节点 | 公开 |
| `/<前缀>/...` | 路由反向代理 | 按路由 |
| `/https://...` | 直连反向代理（可关闭） | 公开 |

## 安全提示

- `ADMIN_TOKEN` 就是管理员密码，请使用强随机值，不要写进仓库。
- `CF_API_TOKEN` 按最小权限创建，泄露后立即吊销重建。
- 直连代理 `/https://...` 默认开放，存在被滥用的风险；可用 `DISABLE_DIRECT_PROXY=1` 关闭，或用 `DIRECT_PROXY_ALLOW` 限制目标。
- 公网部署前建议导出一次 D1 备份，并定期备份配置。

## 文档

- [DEPLOY.md](DEPLOY.md)：从零部署、GitHub Actions、变量、权限、Cron、Telegram、用户系统、备份与排错。

## 声明 · 许可

本项目仅用于学习、研究和自有服务代理测试。请遵守当地法律法规、Cloudflare 服务条款和上游服务条款，使用产生的一切后果由使用者自行承担。

License：MIT