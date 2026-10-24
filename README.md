<div align="center">

# EMBY_CF

**Emby 反向代理 · 多用户路由面板**

`HTTP/HTTPS` · `WebSocket` · `D1` · `自动 DNS` · `邀请制` · `测速` · `日报推送`

![Platform](https://img.shields.io/badge/Cloudflare-Workers-F38020?style=flat-square&logo=cloudflare&logoColor=white)
![Database](https://img.shields.io/badge/D1-Database-00E5FF?style=flat-square)
[![License](https://img.shields.io/badge/License-MIT-00FF9D?style=flat-square)](LICENSE)

[![优选域名监控](https://img.shields.io/badge/%E4%BC%98%E9%80%89%E5%9F%9F%E5%90%8D%E7%9B%91%E6%8E%A7-yx.255432.xyz-00E5FF?style=for-the-badge)](https://yx.255432.xyz/)
[![Telegram 群组](https://img.shields.io/badge/Telegram-%E5%8A%A0%E5%85%A5%E7%BE%A4%E7%BB%84-26A5E4?style=for-the-badge&logo=telegram&logoColor=white)](https://t.me/+7cbXthaBajszNjI1)

[部署教程](DEPLOY.md) · [环境变量](#环境变量) · [API Token 权限](#api-token-权限配置) · [常见问题](#常见问题)

</div>

---

## 功能特性

| 功能 | 说明 |
|---|---|
| 反向代理 | 支持 HTTP、HTTPS、WebSocket，适用于 Emby / Jellyfin 类服务 |
| 管理员全局路由 | 后台创建公共路由，例如 `/emby`，作为统一入口 |
| 用户独立路由 | 每个用户在自己的子域名下创建路由，不同用户可使用同名路径 |
| 邀请码注册 | 管理员生成邀请码，用户凭邀请码注册 |
| 用户子域名 | 注册后自动创建 `用户名.根域名` 独立子域名 |
| 自动 DNS | 自动识别域名、IPv4、IPv6，对应创建 `CNAME` / `A` / `AAAA` 记录 |
| 优选入口 | 用户可将子域名指向优选域名或优选 IP，支持浏览器本地延迟测速 |
| 每日日报 | 北京时间 23:00 统计域名、请求数、流量（配置 `CF_API_TOKEN` 时含访问量），推送到 Telegram，后台也可手动发送 |
| 数据库维护 | 后台可重置业务表，重新初始化 D1 表结构 |

## 路由模型

本仓库是多用户版，入口为根目录的 `worker.js`。

### 三种访问方式

| 方式 | 地址示例 | 配置位置 |
|---|---|---|
| 通用反代 | `https://你的反代域名/https://emby.example.com:8096` | 目标直接写在 URL 中，适合临时访问 |
| 管理员全局路由 | `https://你的反代域名/emby` | 管理员后台「路由管理」 |
| 用户独立路由 | `https://用户名.根域名/emby` | 用户后台「我的路由」 |

- 通用反代的目标支持 `http://`、`https://`、端口、路径；播放直链会自动改写回反代入口
- 用户路由按子域名隔离，同一路径只需在同一用户内不重复
- 用户子域名下无对应路由时，自动回落到管理员全局路由
- `CF_DOMAIN` 填完整反代入口域名，例如 `fd.example.com`，程序会自动确定用户子域名根域名：注册 `111` 后地址为 `111.example.com`

## 快速开始

1. Fork 本仓库
2. 在 `Settings → Secrets and variables → Actions` 添加部署用 Secrets（见 [DEPLOY.md](DEPLOY.md)）
3. 在 `Actions → Deploy to Cloudflare Workers → Run workflow` 运行部署
4. 部署完成后，到 Cloudflare 控制台给 Worker 添加运行变量，至少填写 `ADMIN_TOKEN`
5. 打开 `https://你的反代域名/admin` 登录管理员后台

> [!TIP]
> 工作流绑定了 push 触发，每次 push 到 `main` / `master` 都会自动重新部署。只想手动部署时，在 Actions 页面禁用该工作流。

## 环境变量

在 Cloudflare 控制台进入 Worker → `Settings（设置）` → `Variables and Secrets（变量和机密）` 配置。

| 变量名 | 必填 | 说明 |
|---|---|---|
| `ADMIN_TOKEN` | ✅ 必填 | 管理员登录密码（最高权限，永远有效） |
| `CF_API_TOKEN` | 选填 | CF API Token（流量统计 / DNS 管理用），按下面「API Token 权限配置」创建 |
| `CF_ZONE_ID` | 选填 | 你域名的 Zone ID |
| `CF_DOMAIN` | 选填 | 你的反代域名 |
| `TG_BOT_TOKEN` | 选填 | Telegram Bot Token（每日日报推送；BotFather 创建机器人获取） |
| `TG_CHAT_ID` | 选填 | 管理员 Chat ID（每日日报推送目标；userinfobot 获取） |

**填写建议**

- `ADMIN_TOKEN`、`CF_API_TOKEN`、`TG_BOT_TOKEN` 建议使用 **Secret（机密）** 类型
- `CF_DOMAIN`、`CF_ZONE_ID`、`TG_CHAT_ID` 可以使用 **Variable（变量）** 类型
- 管理员用户名默认是 `admin`；如需修改，可额外设置 `ADMIN_USERNAME`
- 建议额外设置随机的 `SESSION_SECRET` 用于会话签名；未设置时自动回退到 `ADMIN_TOKEN`
- 不配置 `TG_*` 时，日报不会推送，但其他功能不受影响

### 旧变量名兼容

已有部署不需要改变量名，代码会自动兼容：

| 变量名 | 兼容旧变量名 |
|---|---|
| `CF_DOMAIN` | `BASE_DOMAIN` |
| `TG_BOT_TOKEN` | `TELEGRAM_BOT_TOKEN` |
| `TG_CHAT_ID` | `TELEGRAM_CHAT_ID` |

其他可选 / 旧版变量：

- `STATS_HOSTS`：统计域名白名单（逗号分隔），建议继续保留
- `ADMIN_HOST`：管理员默认入口；未设置时回退 `CF_DOMAIN`
- `CF_DNS_API_TOKEN`：DNS 专用 Token；未设置时回退 `CF_API_TOKEN`
- `ADMIN_USERS`：逗号分隔的用户名列表，列表内已注册用户登录后会自动提升为管理员

旧版别名 `ADMIN_PASSWORD`、`AdminPassword`、`AdminUsername`、`ADMIN_DOMAIN` 仍然兼容，但新部署建议使用新名称。

> [!IMPORTANT]
> 不要在 `wrangler.toml` 中写 `ADMIN_TOKEN = ""` 或任何真实密钥，否则部署时可能覆盖控制台中的值。仓库中的 `wrangler.toml` 只保留结构和占位符。

## API Token 权限配置

在 Cloudflare 控制台 → 右上角头像 → `My Profile（我的个人资料）` → `API Tokens（API 令牌）` → `Create Token（创建令牌）` → `Custom token（自定义令牌）`。

### 1. 权限（Permissions）

| 权限类型 | 资源 | 权限 |
|---|---|---|
| 账户 Account | Workers 脚本 Worker Scripts | 编辑 Edit |
| 账户 Account | D1 | 编辑 Edit |
| 区域 Zone | Workers 路由 Workers Routes | 编辑 Edit |
| 区域 Zone | DNS | 编辑 Edit |
| 区域 Zone | Analytics | 读取 Read |

### 2. 账户资源（Account Resources）

选择 `包括 Include` → 勾选你的账号（你的邮箱@gmail.com）。

### 3. 区域资源（Zone Resources）

选择 `包括 Include` → `特定区域 Specific zone` → 勾选你的反代域名所在区域。

### 4. 客户端 IP 地址筛选

默认不设置（留空即可）。

> [!NOTE]
> 上表已包含 GitHub Actions 自动创建 D1 和 Worker 路由所需权限。如果 Token 没有 D1 权限，可在 GitHub Secrets 添加 `CF_D1_ID`（现有 D1 数据库 ID），工作流会跳过自动查询。

## 后台入口

| 入口 | 用途 |
|---|---|
| `/admin` | 登录后：管理员为管理后台，普通用户为个人控制台 |
| `/register` | 用户注册（需要邀请码） |
| `/stats` | 基础统计 JSON |
| `/health` | Worker 健康状态 |

> [!WARNING]
> `/stats` 为公开接口，无鉴权，任何人可查看流量统计，请勿对外泄露地址。

## D1 数据表

Worker 首次收到请求时自动创建或迁移表结构，**无需手动执行 SQL**。

| 表名 | 存储内容 |
|---|---|
| `users` / `invite_codes` | 用户账号、密码哈希；邀请码及使用状态 |
| `user_domains` | 用户子域名、优选目标、DNS 记录 ID |
| `routes` | 管理员全局路由和用户独立路由 |
| `visitor_logs` / `request_stats` | 访问日志；按路由和日期统计请求量 |
| `proxy_stats_hourly` | 按小时统计请求数与实际转发流量（日报数据源） |
| `auto_emby_daily_stats` | 旧版播放统计（已停用，仅保留用于重置） |
| `domain_speed_cache` / `domain_best_cache` | 优选测速缓存；最佳优选入口缓存 |

「重置数据库」会删除并重建以上业务表，不影响 D1 实例和 Worker 环境变量。

## 日报推送

- 每天北京时间 **23:00** 自动发送（Cron：`0 15 * * *`）
- 推送渠道：Telegram，配置 `TG_BOT_TOKEN` + `TG_CHAT_ID`
- 日报中的域名直接读取 Worker 环境变量 `CF_DOMAIN`（兼容 `BASE_DOMAIN`）
- 管理员后台「路由管理」可以手动点击「发送日报」

## 本地检查

```bash
node --check worker.js        # 需要 Node.js ≥ 22.7（ESM 语法检测）
wrangler deploy --dry-run     # 无需 Node 版本要求
```

## 常见问题

| 问题 | 处理方式 |
|---|---|
| `/admin` 登录失败 | 到 Worker 的 `Variables and Secrets` 手动填写 `ADMIN_TOKEN`，用户名默认 `admin` |
| 登录/注册返回 503 | 未配置 `ADMIN_TOKEN`，且 `SESSION_SECRET` 也为空，无法签发会话 |
| 注册失败：DNS 自动配置未完成 | 检查 `CF_ZONE_ID` 与 `CF_API_TOKEN`（或 `CF_DNS_API_TOKEN`） |
| 注册失败：优选目标非法 | 只填纯域名、IPv4 或 IPv6，不带路径、端口、账号密码 |
| 用户子域名访问 404 | 确认存在 `*.用户域名根/*` Worker 路由（Actions 部署自动创建） |
| 用户路由访问到全局路由 | 用户未创建同名路径，系统回落到管理员全局路由 |
| 邀请码释放后用户名仍占用 | 确认已部署最新版本；释放邀请码会同步删除关联普通用户 |
| 日报没有收到 | 检查 `TG_BOT_TOKEN` / `TG_CHAT_ID` 是否填写正确 |
| D1 表结构异常 | 管理员后台执行「重置数据库」重新初始化 |

---

## 声明 · 许可

本项目仅用于学习、研究和自有服务代理测试。请遵守当地法律法规、Cloudflare 服务条款和上游服务条款，使用产生的一切后果由使用者自行承担。

Telegram 交流群：<https://t.me/+7cbXthaBajszNjI1> · License：MIT
