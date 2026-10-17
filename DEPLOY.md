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

## 01 · 准备工作 <sub>PREREQUISITES</sub>

| 项目 | 说明 |
|---|---|
| Cloudflare 账号 | 用于运行 Worker、D1 和 DNS |
| 已托管到 Cloudflare 的域名 | 用于用户子域名和 Worker 路由 |
| GitHub 账号 | 用于 Fork 仓库和运行 GitHub Actions |
| Cloudflare API 信息 | 见「02 · API Token 与账户信息」 |

## 02 · API Token 与账户信息 <sub>TOKENS</sub>

部署共需要 **2 个 Token + 2 个 ID**，先在这里一次性获取。

### 获取 Account ID 与 Zone ID

| 名称 | 位置 |
|---|---|
| `CF_ACCOUNT_ID` | Cloudflare 控制台 → 任意域名管理页 → 右侧边栏 `Account ID` |
| `CF_ZONE_ID` | `BASE_DOMAIN` 根域名所在管理页 → 右侧边栏 `Zone ID` |

> 两者都在域名管理页右下角，为一串十六进制字符串。

### 部署 Token（`CF_API_TOKEN`）

1. Cloudflare 控制台 → 右上角头像 → `My Profile（我的个人资料）` → `API Tokens（API 令牌）`
2. `Create Token（创建令牌）`，可使用 `Edit Cloudflare Workers` 模板或自定义权限
3. 权限要求：

| 类型 | 权限 | 用途 |
|---|---|---|
| Account | `Workers Scripts: Edit` | 发布和更新 Worker |
| Account | `D1: Edit` | 创建、查询和导出 D1 数据库 |
| Zone | `Workers Routes: Edit` | 创建主入口和通配符 Worker 路由 |
| Zone | `DNS: Edit` | 创建 `BASE_DOMAIN` 的 DNS 记录 |

4. Zone Resources 选择目标 Zone；TTL 与 IP 过滤可按需设置
5. 创建后立即复制保存（Token 仅显示一次）

### DNS Token（`CF_DNS_API_TOKEN`）

Worker 运行时为注册用户自动创建和修改 DNS 记录，建议与部署 Token 分开：

1. 仍在 `API Tokens` 页面 → `Create Token` → 自定义 Token
2. 权限：`Zone` → `DNS: Edit`
3. Zone Resources 选择 `BASE_DOMAIN` 所在 Zone

> [!NOTE]
> 若不单独配置 DNS Token，部署时 `CF_DNS_API_TOKEN` 会自动复用部署 Token；分两个 Token 权限更小、更安全。

## 03 · GitHub Actions 自动部署 <sub>ACTIONS</sub>

### Fork 仓库并添加 Secrets

打开 `https://github.com/Dirige/EMBY_CF`，点击右上角 `Fork（复刻）`。进入 Fork 后的仓库：

`Settings（设置）` → `Secrets and variables（秘密和变量）` → `Actions（操作）` → `New repository secret（新建仓库密钥）`

| Secret 名称 | 必需 | 示例 | 说明 |
|---|:---:|---|---|
| `CF_API_TOKEN` | ✅ | Token | 部署 Token，见 02 |
| `CF_ACCOUNT_ID` | ✅ | 32 位十六进制 | Cloudflare 账户 ID |
| `BASE_DOMAIN` | ✅ | `fd.dirige.de5.net` | 完整公共入口；系统取其上一级作为用户子域名根 |
| `CF_ZONE_ID` | ✅ | 32 位十六进制 | `BASE_DOMAIN` 所在 Zone ID |
| `CF_DNS_API_TOKEN` | ✅ | Token | DNS Token，不填则复用部署 Token |
| `CF_WORKER_NAME` | ⚪ | `emby-proxy` | Worker 名称，不填默认 `emby-proxy` |

> [!WARNING]
> 不要创建空白 Secret；没用到的可选项可以不建。`ADMIN_PASSWORD` 不放入仓库配置，部署后到 Cloudflare 控制台手动填写。

### 运行工作流

1. 仓库顶部 `Actions（操作）` → 左侧 `Deploy to Cloudflare Workers`
2. `Run workflow（运行工作流）` → 再次点击绿色按钮确认
3. 等待任务完成，出现绿色对勾即部署成功

工作流自动完成的内容：

| 步骤 | 说明 |
|---|---|
| 安装 Wrangler | Cloudflare 官方部署 CLI |
| 创建或复用 D1 | 数据库名 `emby-proxy-db`，并写入绑定 `DB` |
| 更新 `wrangler.toml` | 写入 Worker 名称、`BASE_DOMAIN`、Zone ID、D1 ID |
| 写入 DNS Token | `CF_DNS_API_TOKEN` 写入 Worker Secret，未配置时复用部署 Token |
| 部署 Worker | 发布根目录 `worker.js` |
| 配置 Worker 路由 | `BASE_DOMAIN/*` 主入口 + `*.用户域名根/*` 通配符 |
| 创建 DNS 记录 | 为 `BASE_DOMAIN` 创建或复用记录 |

> [!IMPORTANT]
> 该工作流同时绑定了 **push 触发**：Fork 后每次 push 到 `master` / `main` 都会自动重新部署（包括只改文档的提交）。只想手动部署时，在 Actions 页面选中该工作流 → `···` → `Disable workflow（禁用工作流）`。

## 04 · 手动部署 <sub>MANUAL</sub>

不使用 GitHub Actions 时，按本节在 Cloudflare 控制台手动完成全部步骤。

### 4.1 创建 Worker 并粘贴代码

1. Cloudflare 控制台 → `Workers & Pages（Workers 和 Pages）`
2. `Create application（创建应用程序）` → `Create Worker（创建 Worker）`
3. 输入名称，例如 `emby-proxy`，点击 `Deploy（部署）`
4. `Edit code（编辑代码）` → 删除默认代码 → 粘贴 `worker.js` 全部内容 → `Save and deploy（保存并部署）`

> 版本选择：多用户用根目录 `worker.js`，自用部署用 `single-user/worker.js`（发邀请码那套功能不存在）。

### 4.2 创建并绑定 D1 数据库

1. `Storage & databases（存储和数据库）` → `D1 SQL Database` → `Create database`
2. 数据库名填 `emby-proxy-db`
3. 回到 Worker → `Settings（设置）` → `Bindings（绑定）` → `Add binding`
4. 类型选 `D1 database`，**变量名填 `DB`**，选择刚创建的数据库 → `Save`

> 变量名必须是 `DB`，Worker 按 `env.DB` 读取。业务表无需手动建，首次请求自动初始化。

### 4.3 配置变量与机密

Worker → `Settings` → `Variables and Secrets` → `Add variable / Add secret`：

| 名称 | 类型 | 必需 | 说明 |
|---|---|:---:|---|
| `ADMIN_USERNAME` | Variable | ✅ | 管理员用户名，默认 `admin` |
| `ADMIN_PASSWORD` | Secret | ✅ | 管理员密码 |
| `BASE_DOMAIN` | Variable | ✅ | 完整公共入口，如 `fd.dirige.de5.net` |
| `CF_ZONE_ID` | Variable | ✅ | `BASE_DOMAIN` 所在 Zone ID |
| `CF_DNS_API_TOKEN` | Secret | ✅ | 用户注册时自动改 DNS |
| `SESSION_SECRET` | Secret | ⚠️ 强烈建议 | 会话签名密钥，随机长字符串 |
| `SYNC_SECRET` | Secret | ⚪ | 仅主从同步需要 |

> [!IMPORTANT]
> 不设置 `SESSION_SECRET` 时会回退到源码公开的固定密钥，任何人可伪造管理员登录态。
> 不要在 `wrangler.toml` 中写入 `ADMIN_PASSWORD = ""`，否则部署后密码被覆盖为空值。

### 4.4 配置 DNS 记录与 Worker 路由

假设 `BASE_DOMAIN = fd.dirige.de5.net`，需要两条 Worker 路由：

```text
fd.dirige.de5.net/*      主入口路由
*.dirige.de5.net/*       用户子域名通配符路由
```

添加方法：

1. 进入 Worker → `Settings` → `Triggers（触发器）` → `Routes（路由）` → `Add route（添加路由）`
2. 分别填写上述两条模式，Zone 选择 `BASE_DOMAIN` 所在 Zone，Worker 选择本 Worker → `Save`

DNS 记录：为 `BASE_DOMAIN` 创建 CNAME / A / AAAA 指向优选目标，并确保开启橙色云朵（代理），否则路由不生效。

### 4.5 使用 Wrangler 部署（可选）

```bash
wrangler deploy        # 自动读取 wrangler.toml，兼容性配置随之生效
```

## 05 · 部署后检查 <sub>AFTER DEPLOY</sub>

无论 Actions 还是手动部署，建议全部核对以下内容：

- [ ] D1 绑定名为 `DB`，数据库 `emby-proxy-db` 存在
- [ ] `Variables and Secrets` 中 6 个必需变量齐全，无空值
- [ ] 存在 `BASE_DOMAIN/*` 和 `*.用户域名根/*` 两条路由
- [ ] `BASE_DOMAIN` 的 DNS 记录已创建且开启代理
- [ ] 打开 `https://BASE_DOMAIN/admin` 能进入登录页

## 06 · 首次使用 <sub>FIRST RUN</sub>

### 管理员登录

打开 `https://BASE_DOMAIN/admin`，使用 `ADMIN_USERNAME` / `ADMIN_PASSWORD` 登录。

### 邀请码管理

管理员后台「邀请码管理」：

1. 选择生成数量 → 「生成邀请码」
2. 「复制未使用」发给用户

释放邀请码时，若其绑定了普通用户，将同步删除：该用户、其访问域名记录、其路由、其子域名的 DNS 记录。管理员账号不受影响。

### 用户注册

用户打开 `https://BASE_DOMAIN/register`：

| 字段 | 说明 |
|---|---|
| 用户名 | 成为 DNS 子域名，如 `111` → `111.dirige.de5.net` |
| 密码 | 用户登录密码 |
| 邀请码 | 管理员发放 |

注册成功后系统自动：创建账号 → 标记邀请码已使用 → 创建 `用户名.用户域名根` DNS 记录（默认指向 `youxuan.cf.090227.xyz`）。

> [!NOTE]
> 后续步骤失败时会回滚用户和邀请码，避免占用。

## 07 · 用户后台 <sub>USER CONSOLE</sub>

用户登录 `/admin` 后进入个人控制台。

### 我的访问域名

管理自己的三级子域名。「修改目标」中填写优选域名 / IP，系统自动判断记录类型：

| 输入类型 | 记录 | 示例 |
|---|---|---|
| 域名 | `CNAME` | `youxuan.example.com` |
| IPv4 | `A` | `1.2.3.4` |
| IPv6 | `AAAA` | `2606:4700:4700::1111` |

保存时先删除旧 `A/AAAA/CNAME` 再创建，无需手动选择类型。

> [!WARNING]
> 只填纯域名或 IP，不带路径、端口、账号密码。

### 我的路由

```text
路径 prefix: emby
目标 target: https://emby.example.com:8096
```

访问地址：`https://111.dirige.de5.net/emby`。不同用户可使用同名路径，同一用户内路径不可重复。

## 08 · 管理员后台 <sub>ADMIN CONSOLE</sub>

| 区域 | 功能 |
|---|---|
| 路由管理 | 创建管理员全局路由 |
| 优选域名测速 | 从 Worker 边缘测试内置优选入口，结果缓存 |
| 邀请码管理 | 生成、复制、释放邀请码 |
| 数据库维护 | 重置业务表 |

「重置数据库」需输入确认文本 `RESET DATABASE`，执行后：删除并重建 9 张业务表；尝试清理已记录子域名的 DNS；保留 D1 实例与 Worker 环境变量。

## 09 · D1 数据库维护 <sub>DATABASE</sub>

| 操作 | 命令 |
|---|---|
| 备份导出 | `wrangler d1 export emby-proxy-db --remote --output backup.sql` |
| 登录状态 | `wrangler whoami` |
| 实时日志 | `wrangler tail` |

## 10 · 故障排查 <sub>TROUBLESHOOTING</sub>

| 问题 | 常见原因 | 处理方式 |
|---|---|---|
| `/admin` 登录失败 | `ADMIN_PASSWORD` 未填或被空值覆盖 | `Variables and Secrets` 手动添加 |
| 管理员密码部署后变空 | `wrangler.toml` 写了空值 | 不在配置文件写该字段 |
| 注册失败：DNS 未完成 | 缺 `CF_ZONE_ID` 或 `CF_DNS_API_TOKEN` | 补填机密 |
| 注册失败：优选目标非法 | 目标含路径、端口 | 只填纯域名 / IPv4 / IPv6 |
| 注册失败但邀请码被占用 | 线上非最新版本 | 重新运行部署 |
| 用户子域名 404 | 无通配符路由或 DNS 记录 | 补 `*.用户域名根/*` 路由 |
| 用户路由命中全局路由 | 用户未创建同名路径 | 用户后台补一条 prefix |
| D1 表为空或结构异常 | 初始化中断 | 管理员后台「重置数据库」 |
| push 后意外触发部署 | 工作流绑定 push 触发 | Actions 页禁用工作流 |

## 11 · 安全建议 <sub>SECURITY</sub>

- `ADMIN_PASSWORD`、`CF_DNS_API_TOKEN`、`SESSION_SECRET` 一律使用 Secret，不写入仓库
- DNS Token 仅授予目标 Zone 的 `DNS: Edit` 权限
- 定期备份 D1 数据
- 只代理有权限访问的服务，遵守当地法律法规与 Cloudflare 服务条款

---

本工具仅用于学习、研究和自有服务代理测试，使用产生的一切后果由使用者自行承担。
