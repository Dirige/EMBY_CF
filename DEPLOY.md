<div align="center">

# EMBY_CF 部署教程

**DEPLOYMENT GUIDE**

`Cloudflare Workers` · `D1` · `GitHub Actions` · `Auto DNS`

![Deploy](https://img.shields.io/badge/Deploy-GitHub_Actions-2088FF?style=flat-square&logo=githubactions&logoColor=white)
![Manual](https://img.shields.io/badge/Manual-Wrangler-00E5FF?style=flat-square&logo=cloudflare&logoColor=white)

</div>

---

> [!TIP]
> 遇到 GitHub 或 Cloudflare 控制台按钮时，本文使用 `英文（中文）` 的写法，例如 `Settings（设置）`、`Create Token（创建令牌）`，方便按页面文字找到对应位置。

## 01 · 准备工作 <sub>PREREQUISITES</sub>

| 项目 | 说明 |
|---|---|
| Cloudflare 账号 | 用于运行 Worker、D1 和 DNS |
| 已托管到 Cloudflare 的域名 | 用于用户子域名和 Worker 路由 |
| GitHub 账号 | 用于 Fork 仓库和运行 GitHub Actions |
| Cloudflare API Token | 用于自动部署、创建 D1、配置 Worker 路由 |
| DNS 编辑权限 | 用于注册用户时自动创建或修改 DNS |

<details>
<summary>还没有域名？（域名注册商 DNSHE 推广信息，完全可选）</summary>

如果还没有域名，可以先在任意域名注册商购买，并将 DNS 托管到 Cloudflare。以下是域名注册商 DNSHE 的推广入口，**与本项目的部署和使用无关**，通过与否都不影响任何功能：

```text
https://my.dnshe.com/index.php?m=domain_hub
推广码：ZPB06CED7F
```

> [!WARNING]
> 上面的推广码是 DNSHE 的注册推荐码，**不是**本项目的注册邀请码。本项目的邀请码需要管理员部署后在后台生成。

</details>

## 02 · Cloudflare API Token <sub>TOKENS</sub>

### 创建部署 Token

1. 登录 [Cloudflare 控制台](https://dash.cloudflare.com/)。
2. 点击右上角头像。
3. 进入 `My Profile（我的个人资料）`。
4. 点击 `API Tokens（API 令牌）`。
5. 点击 `Create Token（创建令牌）`。
6. 可以选择 `Edit Cloudflare Workers（编辑 Cloudflare Workers）` 模板，也可以自定义权限。

建议部署 Token 至少包含：

| 权限范围 | 权限 |
|---|---|
| Account | `Workers Scripts:Edit` |
| Account | `D1:Edit` |
| Zone | `Workers Routes:Edit` |
| Zone | `DNS:Edit` |

> [!NOTE]
> 如果只想先简单部署，可以让一个 Token 同时负责部署和 DNS。更稳妥的方式是部署 Token 和 DNS Token 分开。

### 创建 DNS Token

DNS Token 用于 Worker 运行时自动为注册用户创建 DNS 记录：

1. 仍在 `API Tokens（API 令牌）` 页面。
2. 点击 `Create Token（创建令牌）`。
3. 选择自定义 Token。
4. 给目标 Zone 添加 `DNS:Edit` 权限。
5. Zone 范围选择你的根域名所在 Zone。

这个 Token 后面填到 `CF_DNS_API_TOKEN`。

## 03 · GitHub Actions 自动部署 <sub>ACTIONS</sub>

### Fork 仓库

打开项目仓库并点击右上角 `Fork（复刻）`：

```text
https://github.com/Dirige/EMBY_CF
```

### 添加 GitHub Secrets

进入你 Fork 后的仓库：

1. 点击 `Settings（设置）`。
2. 点击左侧 `Secrets and variables（秘密和变量）`。
3. 点击 `Actions（操作）`。
4. 点击 `New repository secret（新建仓库密钥）`。
5. 按下表逐个添加。

| Secret 名称 | 必需 | 示例 | 说明 |
|---|:---:|---|---|
| `CF_API_TOKEN` | ✅ | `你的 Cloudflare API Token` | 用于部署 Worker、创建 D1、配置 Worker 路由 |
| `CF_ACCOUNT_ID` | ✅ | `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` | Cloudflare 账户 ID |
| `BASE_DOMAIN` | ✅ | `fd.dirige.de5.net` | 完整公共入口；程序自动取其上一级作为用户子域名根域名 |
| `CF_ZONE_ID` | ✅ | `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` | `BASE_DOMAIN` 所在 Zone ID |
| `CF_DNS_API_TOKEN` | ✅ | `你的 DNS Token` | Worker 运行时自动创建和修改用户 DNS；不填则复用 `CF_API_TOKEN` |
| `CF_WORKER_NAME` | ⚪ | `emby-proxy` | Worker 名称，不填默认 `emby-proxy` |

> [!WARNING]
> 不要创建空白 Secret；没用到的可选项可以不建。
> `ADMIN_PASSWORD` 不建议放在仓库配置里，部署后到 Cloudflare Worker 控制台手动填。

`BASE_DOMAIN` 本身就是公共试用入口，无需注册即可使用通用反代格式。例如填写 `fd.dirige.de5.net`，访问入口就是 `fd.dirige.de5.net`；系统不会再拼接第二个 `fd`。

### 运行 Actions

1. 点击仓库顶部 `Actions（操作）`。
2. 左侧选择 `Deploy to Cloudflare Workers`。
3. 点击右侧 `Run workflow（运行工作流）`。
4. 再点绿色的 `Run workflow（运行工作流）` 确认。
5. 等待任务完成，状态显示绿色对勾即部署成功。

> [!IMPORTANT]
> 本工作流同时绑定了 **push 触发**：Fork 之后每次 push 到 `master` / `main` 都会**自动重新部署**（包括只改文档的提交）。如果只想手动部署，在 `Actions（操作）` 页面左侧选择该工作流，点击 `···` 菜单选择 `Disable workflow（禁用工作流）`。

### 工作流自动完成的步骤

| 步骤 | 说明 |
|---|---|
| 安装 Wrangler | 使用 Cloudflare Wrangler CLI 部署 |
| 创建或复用 D1 | 默认数据库名 `emby-proxy-db` |
| 更新 `wrangler.toml` | 写入 Worker 名称、完整公共入口、Zone ID、D1 ID |
| 写入 DNS Token | 把 `CF_DNS_API_TOKEN` 写入 Worker Secret（未单独配置时复用部署 Token） |
| 部署 Worker | 发布 `worker.js` |
| 配置 Worker 路由 | 创建 `BASE_DOMAIN/*` 主入口路由和 `*.用户域名根/*` 通配符路由 |
| 创建 DNS 记录 | 为 `BASE_DOMAIN` 创建或复用 DNS 记录 |

## 04 · Worker 变量与机密 <sub>VARIABLES</sub>

自动部署完成后，建议到 Cloudflare 控制台手动检查一遍变量。

进入 Cloudflare：

1. 打开 `Workers & Pages（Workers 和 Pages）`。
2. 点击你的 Worker，例如 `emby-proxy`。
3. 点击 `Settings（设置）`。
4. 点击 `Variables and Secrets（变量和机密）`。
5. 点击 `Add variable（添加变量）` 或 `Add secret（添加机密）`。

各变量的来源与建议：

| 名称 | 类型 | 必需 | Actions 部署是否已自动配置 | 说明 |
|---|---|:---:|:---:|---|
| `ADMIN_USERNAME` | Variable（变量） | ✅ | ✅ 默认 `admin`（`wrangler.toml` 已内置） | 管理员用户名，可自行修改 |
| `ADMIN_PASSWORD` | Secret（机密） | ✅ | ❌ 需手动填写 | 管理员密码 |
| `BASE_DOMAIN` | Variable（变量） | ✅ | ✅ 由 workflow 写入 | 完整公共入口，例如 `fd.dirige.de5.net` |
| `CF_ZONE_ID` | Variable（变量） | ✅ | ✅ 由 workflow 写入 | Cloudflare Zone ID |
| `CF_DNS_API_TOKEN` | Secret（机密） | ✅ | ✅ 由 workflow 写入 | 自动创建/修改 DNS |
| `SESSION_SECRET` | Secret（机密） | ⚠️ 强烈建议 | ❌ 需手动填写 | 用户登录会话签名 |

> [!IMPORTANT]
> 不设置 `SESSION_SECRET` 时，会话签名会回退到源码中公开的固定密钥，**任何人都可以伪造管理员登录态**。请务必设置一个随机长字符串，例如 `openssl rand -hex 32` 的输出。

`wrangler.toml` 里不要写：

```toml
ADMIN_PASSWORD = ""
```

否则部署后可能把控制台里的管理员密码覆盖成空值。当前仓库已经移除了这行。

## 05 · D1 数据库 <sub>DATABASE</sub>

### 自动创建和初始化

GitHub Actions 会自动创建或复用 D1 数据库。Worker 第一次收到请求时，会自动创建业务表，不需要手动执行 SQL。

| 表名 | 用途 |
|---|---|
| `users` | 用户账号、密码哈希、角色、状态 |
| `invite_codes` | 邀请码、使用状态、使用人、使用时间 |
| `user_domains` | 用户子域名、优选目标、DNS 记录 ID、记录类型 |
| `routes` | 管理员全局路由和用户独立路由 |
| `visitor_logs` | 访问日志 |
| `request_stats` | 路由请求统计 |
| `auto_emby_daily_stats` | 播放和 PlaybackInfo 日统计 |
| `domain_speed_cache` | 优选域名测速缓存 |
| `domain_best_cache` | 当前网络最佳优选入口缓存 |

### 手动绑定 D1

如果你选择手动部署 Worker：

1. 在 Cloudflare 控制台进入 `Storage & databases（存储和数据库）`。
2. 点击 `D1 SQL Database（D1 SQL 数据库）`。
3. 点击 `Create database（创建数据库）`。
4. 输入数据库名称，例如 `emby-proxy-db`。
5. 回到 Worker 页面，点击 `Settings（设置）` → `Bindings（绑定）`。
6. 点击 `Add binding（添加绑定）`。
7. 类型选择 `D1 database（D1 数据库）`。
8. 变量名填写 `DB`。
9. 选择刚创建的 D1 数据库，点击 `Save（保存）`。

### 备份

```bash
wrangler d1 export emby-proxy-db --remote --output backup.sql
```

## 06 · DNS 与 Worker 路由 <sub>ROUTES</sub>

假设 `BASE_DOMAIN` 填写为 `fd.dirige.de5.net`，用户注册后会自动生成三级子域名，例如：

```text
111.dirige.de5.net
```

因此必须配置通配符 Worker 路由：

```text
fd.dirige.de5.net/*
*.dirige.de5.net/*
```

例如：

```text
*.dirige.de5.net/*
```

手动添加路由：

1. 进入 Cloudflare 的 Worker 页面。
2. 点击 `Settings（设置）`。
3. 点击 `Triggers（触发器）`。
4. 找到 `Routes（路由）`。
5. 点击 `Add route（添加路由）`。
6. 填写 `BASE_DOMAIN/*` 和 `*.用户域名根/*`。
7. 选择当前 Worker，点击 `Save（保存）`。

使用 Actions 部署时，主入口路由和通配符路由都会自动创建，无需手动重复添加。

## 07 · 首次使用 <sub>FIRST RUN</sub>

### 管理员登录

打开：

```text
https://你的入口域名/admin
```

输入你在 Worker 变量里设置的 `ADMIN_USERNAME` / `ADMIN_PASSWORD`。

### 生成邀请码

进入管理员后台，找到「邀请码管理」：

1. 选择生成数量。
2. 点击「生成邀请码」。
3. 点击「复制未使用」发给用户。

### 用户注册

用户打开：

```text
https://你的入口域名/register
```

| 字段 | 说明 |
|---|---|
| 用户名 | 会成为 DNS 子域名，例如 `111` → `111.dirige.de5.net` |
| 密码 | 用户登录密码 |
| 邀请码 | 管理员发放的邀请码 |

注册成功后，系统会自动：

1. 创建用户账号。
2. 标记邀请码为已使用。
3. 创建 `用户名.用户域名根` 的 DNS 记录，默认指向 `youxuan.cf.090227.xyz`。

> [!NOTE]
> 如果后续某一步失败，系统会回滚用户和邀请码，避免注册失败还占用邀请码。

## 08 · 用户后台 <sub>USER CONSOLE</sub>

用户注册或登录后进入 `/admin`，如果不是管理员，会显示用户控制台。

### 我的访问域名

这里管理用户自己的三级子域名，例如 `111.dirige.de5.net`。其中 `dirige.de5.net` 来自 `BASE_DOMAIN=fd.dirige.de5.net` 的上一级域名。

点击「修改目标」后，可以填写「优选域名 / IP」。系统会自动判断输入内容：

| 输入类型 | 自动 DNS 记录 | 示例 |
|---|---|---|
| 域名 | `CNAME` | `youxuan.example.com` |
| IPv4 | `A` | `1.2.3.4` |
| IPv6 | `AAAA` | `2606:4700:4700::1111` |

保存时会先删除旧的 `A/AAAA/CNAME` 记录，再创建新记录，所以用户不用手动选择记录类型。

> [!WARNING]
> 这里只填写纯域名或 IP，不要填写路径、端口、账号密码。

| 推荐 | 不推荐 |
|---|---|
| `youxuan.example.com` | `https://youxuan.example.com/path` |
| `1.2.3.4` | `1.2.3.4:443` |

### 我的路由

用户可以创建自己的路由，例如：

```text
路径 prefix: emby
目标 target: https://emby.example.com:8096
```

访问地址：

```text
https://111.dirige.de5.net/emby
```

不同用户可以使用同一个路径：

| 用户 | 访问地址 | 实际走向 |
|---|---|---|
| `111` | `https://111.dirige.de5.net/emby` | 用户 `111` 的目标 |
| `222` | `https://222.dirige.de5.net/emby` | 用户 `222` 的目标 |

同一个用户自己的路径不能重复。

## 09 · 管理员后台 <sub>ADMIN CONSOLE</sub>

| 区域 | 功能 |
|---|---|
| 路由管理 | 创建管理员全局路由 |
| 优选域名测速 | 从 Worker 边缘测试内置优选入口 |
| 邀请码管理 | 生成、复制、释放邀请码 |
| 数据库维护 | 删除并重建业务表 |

### 释放邀请码

点击「释放」后，如果该邀请码绑定了普通用户，会同步删除：

- 该普通用户
- 该用户的访问域名记录
- 该用户创建的路由
- 该用户子域名的 DNS 记录

管理员账号不会被释放邀请码删除。

### 重置数据库

点击「重置数据库」后，需要输入确认文本：

```text
RESET DATABASE
```

确认后会：

- 删除本 Worker 管理的 9 张业务表
- 重新创建最新表结构
- 尝试清理已记录用户子域名的 DNS
- 保留 D1 数据库实例
- 保留 Worker 环境变量和机密

## 10 · 版本选择与手动部署 <sub>VERSIONS</sub>

### 多用户版

使用仓库根目录的 `worker.js`。该版本支持用户注册、邀请码、用户子域名和用户独立路由。

### 自用部署单用户版

使用 `single-user/worker.js`。该版本用于个人自用部署，不需要向他人发放邀请码。部署步骤与多用户版相同，但将控制台中的代码替换为 `single-user/worker.js`。

`single-user/worker.js` 中没有提交同步密钥。只有启用主从同步时，才需要在 Worker Secret 中添加 `SYNC_SECRET`。

### 手动部署 Worker

如果不用 GitHub Actions，也可以手动部署：

1. 登录 Cloudflare 控制台。
2. 点击左侧 `Workers & Pages（Workers 和 Pages）`。
3. 点击 `Create application（创建应用程序）`。
4. 选择 `Create Worker（创建 Worker）`。
5. 输入 Worker 名称，例如 `emby-proxy`。
6. 点击 `Deploy（部署）`。
7. 部署完成后点击 `Edit code（编辑代码）`。
8. 删除默认代码，粘贴 `worker.js` 全部内容。
9. 点击 `Save and deploy（保存并部署）`。
10. 按上文添加 D1 Binding、变量、机密和 Worker 路由。

> [!NOTE]
> 本地部署方式（`wrangler deploy`）会读取 `wrangler.toml`，`nodejs_compat` 等兼容性配置会自动生效；控制台粘贴方式部署的 Worker 无需额外配置兼容性选项。

## 11 · 本地检查 <sub>LINT</sub>

如果本地安装了 Wrangler，可以在项目目录运行：

```bash
node --check worker.js        # 需要 Node.js ≥ 22.7（ESM 语法检测）
wrangler deploy --dry-run     # 无需 Node 版本要求
```

查看登录状态：

```bash
wrangler whoami
```

查看线上实时日志：

```bash
wrangler tail
```

## 12 · 故障排查 <sub>TROUBLESHOOTING</sub>

| 问题 | 常见原因 | 处理方式 |
|---|---|---|
| `/admin` 登录失败 | `ADMIN_PASSWORD` 未填或被空值覆盖 | 到 `Settings（设置）` → `Variables and Secrets（变量和机密）` 手动添加 `ADMIN_PASSWORD` Secret |
| 注册失败：DNS 自动配置未完成 | 缺少 `CF_ZONE_ID` 或 `CF_DNS_API_TOKEN` | 检查 Worker 变量和机密 |
| 注册失败：优选目标必须是合法域名或 IP | 目标带了路径、端口或非法字符 | 只填纯域名、IPv4 或 IPv6 |
| 注册失败但邀请码被占用 | 线上不是最新版本 | 重新运行 `Actions（操作）` → `Deploy to Cloudflare Workers` |
| 用户子域名 404 | 没有通配符路由或 DNS 记录 | 添加 `*.用户域名根/*` Worker 路由，并确认用户 DNS 已创建 |
| 用户路由访问到管理员全局路由 | 用户没有创建同名路径 | 到用户后台「我的路由」添加对应 prefix |
| D1 表为空或结构异常 | 初始化中断或旧结构残留 | 管理员后台执行「重置数据库」 |
| 优选域名测速结果重复 | 浏览器或 D1 缓存仍在 | 点击重新测速，必要时重置测速缓存或等待缓存过期 |
| push 代码后意外触发部署 | 工作流绑定了 push 触发 | 在 `Actions（操作）` 页面禁用工作流，或只保留 `workflow_dispatch` |

## 13 · 安全建议 <sub>SECURITY</sub>

- `ADMIN_PASSWORD`、`CF_DNS_API_TOKEN`、`SESSION_SECRET` 使用 Secret（机密），不要使用明文变量。
- 不要把管理员密码写入仓库。
- DNS Token 只授予目标 Zone 的 `DNS:Edit` 权限。
- 定期备份 D1 数据（见「05 · D1 数据库」）。
- 不要代理无权访问的服务。

---

## 声明 <sub>DISCLAIMER</sub>

本工具仅用于学习、研究和自有服务代理测试。请勿用于违法用途。使用本工具产生的一切后果由使用者自行承担。
