<div align="center">

# EMBY_CF 部署教程

**DEPLOYMENT GUIDE**

`Cloudflare Workers` · `D1` · `GitHub Actions` · `手动部署`

![Deploy](https://img.shields.io/badge/Deploy-GitHub_Actions-2088FF?style=flat-square&logo=githubactions&logoColor=white)
![Manual](https://img.shields.io/badge/Manual-Wrangler-00E5FF?style=flat-square&logo=cloudflare&logoColor=white)

</div>

---

> [!TIP]
> 遇到 GitHub 或 Cloudflare 控制台按钮时，本文使用 `英文（中文）` 写法，例如 `Settings（设置）`、`Create Token（创建令牌）`，便于按页面文字找到对应位置。

## 01 · 准备工作

| 项目 | 说明 |
|---|---|
| Cloudflare 账号 | 用于运行 Worker、D1 和 DNS |
| 已托管到 Cloudflare 的域名 | 用于反代入口、用户子域名和 Worker 路由 |
| GitHub 账号 | 用于 Fork 仓库和运行 GitHub Actions |
| Cloudflare API Token | 按「02 · API Token 权限配置」创建 |

本文用下面的占位符举例，请替换成你自己的域名：

| 占位符 | 示例 | 说明 |
|---|---|---|
| `你的反代域名` | `fd.example.com` | 管理员入口，也是通用反代入口 |
| `你的根域名` | `example.com` | 用户子域名挂在它下面 |
| `用户名` | `111` | 注册后得到 `111.example.com` |

## 02 · API Token 权限配置

### 2.1 创建 Token

1. Cloudflare 控制台 → 右上角头像 → `My Profile（我的个人资料）`
2. 左侧 `API Tokens（API 令牌）` → `Create Token（创建令牌）`
3. 选择 `Custom token（自定义令牌）` → `Get started（开始使用）`

### 2.2 权限（Permissions）

按下表添加权限：

| 权限类型 | 资源 | 权限 |
|---|---|---|
| 账户 Account | Workers 脚本 Worker Scripts | 编辑 Edit |
| 账户 Account | D1 | 编辑 Edit |
| 区域 Zone | Workers 路由 Workers Routes | 编辑 Edit |
| 区域 Zone | DNS | 编辑 Edit |
| 区域 Zone | Analytics | 读取 Read |

### 2.3 账户资源（Account Resources）

选择 `包括 Include` → 勾选你的账号（你的邮箱@gmail.com）。

### 2.4 区域资源（Zone Resources）

选择 `包括 Include` → `特定区域 Specific zone` → 勾选你的反代域名所在区域。

### 2.5 客户端 IP 地址筛选

默认不设置（留空即可）。

### 2.6 保存 Token

点击 `Continue to summary（继续查看摘要）` → `Create Token（创建令牌）`，复制并保存 Token。Token 只显示一次。

> [!NOTE]
> 上表已经包含 GitHub Actions 自动创建 D1、Worker 路由和 DNS 记录所需权限。
>
> 如果部署 Token 没有 D1 权限，工作流会尝试读取现有 Worker 的 D1 绑定；读取不到时，在 GitHub Secrets 添加 `CF_D1_ID` 即可。

### 2.7 获取 Zone ID

Cloudflare 控制台 → 你的根域名管理页 → 右侧边栏 `Zone ID`，复制备用。

## 03 · GitHub Actions 自动部署

### 3.1 Fork 仓库

打开 `https://github.com/Dirige/EMBY_CF`，点击右上角 `Fork（复刻）`。

### 3.2 添加 GitHub Secrets

进入 Fork 后的仓库：

`Settings（设置）` → `Secrets and variables（秘密和变量）` → `Actions（操作）` → `New repository secret（新建仓库密钥）`

| Secret 名称 | 必需 | 示例 | 说明 |
|---|:---:|---|---|
| `CF_API_TOKEN` | ✅ | Token | Cloudflare API Token，见 02 |
| `CF_ACCOUNT_ID` | ✅ | 32 位十六进制 | Cloudflare 账户 ID |
| `CF_DOMAIN` | ✅ | `fd.example.com` | 你的反代域名；旧仓库也可继续用 `BASE_DOMAIN` |
| `CF_ZONE_ID` | ✅ | 32 位十六进制 | 根域名所在 Zone ID |
| `CF_DNS_API_TOKEN` | ⚪ | Token | DNS 专用 Token；不填则复用 `CF_API_TOKEN` |
| `CF_D1_ID` | ⚪ | UUID | 已有 D1 数据库 ID；填写后跳过自动查询。Token 没有 D1 权限时建议填写 |
| `CF_WORKER_NAME` | ⚪ | `fd` | Worker 名称，不填默认 `fd` |

> [!IMPORTANT]
> GitHub Secrets 只用于**部署**（创建 D1、配置路由、发布 Worker）。Worker **运行时**读取的变量需要在 Cloudflare 控制台单独配置，见「05 · 运行时环境变量」。
>
> `ADMIN_TOKEN` 不要放进 GitHub Secrets，部署完成后到 Cloudflare 控制台手动填写。

### 3.3 运行工作流

1. 仓库顶部 `Actions（操作）` → 左侧 `Deploy to Cloudflare Workers`
2. `Run workflow（运行工作流）` → 再次点击绿色按钮确认
3. 等待任务完成，出现绿色对勾即部署成功

工作流会自动完成：

| 步骤 | 说明 |
|---|---|
| 安装 Wrangler | Cloudflare 官方部署 CLI |
| 创建或复用 D1 | 数据库名 `fd`，并写入绑定 `DB` |
| 更新 `wrangler.toml` | 写入 Worker 名称和 D1 ID；真实域名和密钥不写入仓库 |
| 写入 DNS Token | `CF_DNS_API_TOKEN` 写入 Worker Secret，未配置时复用 `CF_API_TOKEN` |
| 部署 Worker | 发布根目录 `worker.js` |
| 配置 Worker 路由 | `CF_DOMAIN/*` 主入口 + `*.根域名/*` 通配符 |
| 创建 DNS 记录 | 为三段式 `CF_DOMAIN` 创建或复用 CNAME |

> [!NOTE]
> 路由和 DNS 创建失败不会影响 Worker 发布，也不会让工作流失败。如果日志中出现相关错误，按「4.3」和「4.4」手动补齐即可。
>
> 该工作流绑定了 **push 触发**：每次 push 到 `main` / `master` 都会自动重新部署。只想手动部署时，在 Actions 页面选中该工作流 → `···` → `Disable workflow（禁用工作流）`。

## 04 · 手动部署

不使用 GitHub Actions 时，按本节在 Cloudflare 控制台手动完成。

### 4.1 创建 Worker

1. Cloudflare 控制台 → `Workers & Pages（Workers 和 Pages）`
2. `Create application（创建应用程序）` → `Create Worker（创建 Worker）`
3. 输入名称，例如 `emby-proxy`，点击 `Deploy（部署）`
4. `Edit code（编辑代码）` → 删除默认代码 → 粘贴 `worker.js` 全部内容 → `Save and deploy（保存并部署）`

### 4.2 创建并绑定 D1

1. `Storage & databases（存储和数据库）` → `D1 SQL Database` → `Create database`
2. 数据库名填 `fd`（也可以自定义）
3. 回到 Worker → `Settings（设置）` → `Bindings（绑定）` → `Add binding`
4. 类型选 `D1 database`，**变量名填 `DB`**，选择刚创建的数据库 → `Save`

> 变量名必须是 `DB`，Worker 按 `env.DB` 读取。业务表无需手动建，首次请求自动初始化。

### 4.3 配置 Worker 路由

进入 Worker → `Settings` → `Triggers（触发器）` → `Routes（路由）` → `Add route（添加路由）`。

假设反代域名是 `fd.example.com`，根域名是 `example.com`，添加两条：

```text
fd.example.com/*    管理员默认入口 / 通用反代入口
*.example.com/*     用户子域名通配符
```

- Zone 选择 `example.com` 所在 Zone
- Worker 选择本 Worker
- 保存后等待路由生效

> 如果你的反代域名就是根域名 `example.com`，只需添加 `example.com/*` 和 `*.example.com/*` 两条。

### 4.4 配置 DNS

为反代域名创建 DNS 记录：

| 场景 | 记录类型 | 名称 | 内容 |
|---|---|---|---|
| `fd.example.com` | `CNAME` | `fd` | `example.com` 或你的优选域名 |
| `example.com` | `A` / `AAAA` / `CNAME` | `@` | 你的服务器 IP 或优选域名 |

必须开启橙色云朵（代理），否则 Worker 路由不生效。

### 4.5 使用 Wrangler 部署（可选）

```bash
# 1. 修改 wrangler.toml 中的 database_id 为你的 D1 ID
# 2. 登录 Cloudflare
wrangler login

# 3. 部署
wrangler deploy
```

## 05 · 运行时环境变量

进入 Worker → `Settings（设置）` → `Variables and Secrets（变量和机密）` → `Add variable / Add secret`。

| 变量名 | 必填 | 说明 |
|---|---|---|
| `ADMIN_TOKEN` | ✅ 必填 | 管理员登录密码（最高权限，永远有效） |
| `CF_API_TOKEN` | 选填 | CF API Token（流量统计 / DNS 管理 / 区域调度用），按「02 · API Token 权限配置」创建 |
| `CF_ZONE_ID` | 选填 | 你域名的 Zone ID |
| `CF_DOMAIN` | 选填 | 你的反代域名 |
| `TG_BOT_TOKEN` | 选填 | Telegram Bot Token（保号提醒推送；BotFather 创建机器人获取） |
| `TG_CHAT_ID` | 选填 | 管理员 Chat ID（保号提醒推送目标；userinfobot 获取） |

**类型建议**

| 变量 | 建议类型 |
|---|---|
| `ADMIN_TOKEN` | Secret（机密） |
| `CF_API_TOKEN` | Secret（机密） |
| `TG_BOT_TOKEN` | Secret（机密） |
| `CF_DOMAIN` / `CF_ZONE_ID` / `TG_CHAT_ID` | Variable（变量） |

**补充说明**

- 管理员用户名默认是 `admin`；需要修改时额外设置 `ADMIN_USERNAME`
- 建议额外设置随机的 `SESSION_SECRET`，用于会话签名；未设置时自动回退到 `ADMIN_TOKEN`
- `STATS_HOSTS`、`ADMIN_HOST` 为旧版兼容变量，已有部署可以继续保留
- 可选 `ADMIN_USERS`：逗号分隔的用户名列表，列表内已注册用户登录后自动提升为管理员
- 旧版别名 `ADMIN_PASSWORD`、`AdminPassword`、`AdminUsername`、`ADMIN_DOMAIN` 仍然兼容
- 不配置 `TG_*` 时，日报不会推送，其他功能正常

> [!IMPORTANT]
> 只配置 `ADMIN_TOKEN` 也能登录：用户名填 `admin`，密码填 `ADMIN_TOKEN`。如果设置了 `ADMIN_USERNAME`，则用该用户名登录。
>
> 不要在 `wrangler.toml` 中写入 `ADMIN_TOKEN = ""`，否则部署后可能把控制台里的密码覆盖为空值。

### 5.1 Telegram 推送配置

1. Telegram 搜索 `@BotFather` → `/newbot` → 按提示创建机器人
2. 复制 Bot Token，填入 `TG_BOT_TOKEN`
3. Telegram 搜索 `@userinfobot` → 发送任意消息 → 复制你的 Chat ID，填入 `TG_CHAT_ID`
4. 先给机器人发一条消息（例如 `/start`），否则机器人无法主动推送给你

## 06 · 部署后检查

- [ ] D1 绑定名为 `DB`，数据库已创建
- [ ] Worker 变量中至少填写了 `ADMIN_TOKEN`
- [ ] `CF_DOMAIN` 与 Worker 路由中的域名一致
- [ ] 存在 `反代域名/*` 和 `*.根域名/*` 两条 Worker 路由
- [ ] 反代域名的 DNS 记录已创建并开启代理
- [ ] 打开 `https://你的反代域名/admin` 能进入登录页
- [ ] 打开 `https://你的反代域名/health` 返回 `status: ok`
- [ ] 打开 `https://你的反代域名/stats` 能看到流量统计

## 07 · 首次使用

### 7.1 管理员登录

打开 `https://你的反代域名/admin`：

| 字段 | 填写 |
|---|---|
| 用户名 | `admin`（或你设置的 `ADMIN_USERNAME`） |
| 密码 | `ADMIN_TOKEN` |

### 7.2 创建全局路由

管理员后台 → 「路由管理」→ 新增路由：

```text
路径 prefix: emby
目标 target: https://emby.example.com:8096
```

保存后访问 `https://你的反代域名/emby` 即可。

### 7.3 生成邀请码

管理员后台 → 「邀请码管理」：

1. 选择生成数量 → 「生成邀请码」
2. 「复制未使用」发给用户

释放邀请码时，若其绑定了普通用户，将同步删除：该用户、其访问域名记录、其路由、其子域名的 DNS 记录。管理员账号不受影响。

### 7.4 用户注册

用户打开 `https://你的反代域名/register`：

| 字段 | 说明 |
|---|---|
| 用户名 | 成为 DNS 子域名，如 `111` → `111.example.com` |
| 密码 | 用户登录密码 |
| 邀请码 | 管理员发放 |

注册成功后系统自动：创建账号 → 标记邀请码已使用 → 创建 `用户名.根域名` DNS 记录（默认指向内置优选域名）。

> 后续步骤失败时会回滚用户和邀请码，避免占用。

## 08 · 用户后台

用户登录 `/admin` 后进入个人控制台。

### 8.1 我的访问域名

管理自己的独立子域名。「修改目标」中填写优选域名 / IP，系统自动判断记录类型：

| 输入类型 | 记录 | 示例 |
|---|---|---|
| 域名 | `CNAME` | `youxuan.example.com` |
| IPv4 | `A` | `1.2.3.4` |
| IPv6 | `AAAA` | `2606:4700:4700::1111` |

保存时先删除旧 `A/AAAA/CNAME` 再创建，无需手动选择类型。

> [!WARNING]
> 只填纯域名或 IP，不带路径、端口、账号密码。

### 8.2 我的路由

```text
路径 prefix: emby
目标 target: https://emby.example.com:8096
```

访问地址：`https://111.example.com/emby`。不同用户可使用同名路径，同一用户内路径不可重复。

## 09 · 管理员后台

| 区域 | 功能 |
|---|---|
| 路由管理 | 创建管理员全局路由，支持「发送日报」手动推送 |
| 优选域名测速 | 用当前浏览器网络测试内置优选入口延迟（本机测速，非边缘） |
| 邀请码管理 | 生成、复制、释放邀请码 |
| 数据库维护 | 重置业务表 |

「重置数据库」需输入确认文本 `RESET DATABASE`，执行后：删除并重建业务表；尝试清理已记录子域名的 DNS；保留 D1 实例与 Worker 环境变量。

## 10 · 日报推送

| 项目 | 说明 |
|---|---|
| 发送时间 | 每天北京时间 23:00（UTC 15:00，Cron `0 15 * * *`） |
| 统计内容 | 域名、请求数、流量；配置 `CF_API_TOKEN` 时额外包含访问量 |
| 域名来源 | Worker 环境变量 `CF_DOMAIN`（兼容 `BASE_DOMAIN`） |
| Telegram | 配置 `TG_BOT_TOKEN` + `TG_CHAT_ID` |
| 手动发送 | 管理员后台「路由管理」→「发送日报」 |

日报统计的是**实际转发流量**，不是播放次数。

## 11 · D1 数据库维护

| 操作 | 命令 |
|---|---|
| 备份导出 | `wrangler d1 export fd --remote --output backup.sql`（`fd` 换成你的数据库名） |
| 登录状态 | `wrangler whoami` |
| 实时日志 | `wrangler tail` |

> 导出的 SQL 可能包含用户数据，不要提交到 Git 仓库。

## 12 · 故障排查

| 问题 | 常见原因 | 处理方式 |
|---|---|---|
| `/admin` 登录失败 | `ADMIN_TOKEN` 未填或被空值覆盖 | `Variables and Secrets` 手动添加 |
| 管理员密码部署后变空 | `wrangler.toml` 写了空值 | 不在配置文件写该字段 |
| 注册失败：DNS 未完成 | 缺 `CF_ZONE_ID` 或可用 Token | 补填 `CF_ZONE_ID` 和 `CF_API_TOKEN`（或 `CF_DNS_API_TOKEN`） |
| 注册失败：优选目标非法 | 目标含路径、端口 | 只填纯域名 / IPv4 / IPv6 |
| 注册失败但邀请码被占用 | 线上不是最新版本 | 重新运行部署 |
| 用户子域名 404 | 无通配符路由或 DNS 记录 | 补 `*.根域名/*` 路由 |
| 用户路由命中全局路由 | 用户未创建同名路径 | 用户后台补一条 prefix |
| 日报没有收到 | 推送变量未填或机器人未启动 | 检查 `TG_*`，先给机器人发 `/start` |
| D1 表为空或结构异常 | 初始化中断 | 管理员后台「重置数据库」 |
| Actions 在「获取或创建 D1 数据库」失败 | Token 没有 D1 权限 | 添加 `CF_D1_ID` Secret，或给 Token 增加 `Account → D1 → Edit` |
| push 后意外触发部署 | 工作流绑定 push 触发 | Actions 页禁用工作流 |

## 13 · 安全建议

- `ADMIN_TOKEN`、`CF_API_TOKEN`、`TG_BOT_TOKEN` 一律使用 Secret，不写入仓库
- DNS Token 仅授予目标 Zone 的 `DNS: Edit` 权限
- 不要把 `.dev.vars`、`.env`、`.wrangler/`、D1 导出文件提交到 Git
- 定期备份 D1 数据
- 只代理有权限访问的服务，遵守当地法律法规与 Cloudflare 服务条款

---

本工具仅用于学习、研究和自有服务代理测试，使用产生的一切后果由使用者自行承担。
