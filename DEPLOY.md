# EMBY_CF 部署教程

这是一份中文为主的部署教程。遇到 GitHub 或 Cloudflare 控制台按钮时，会使用 `英文（中文）` 的写法，例如 `Settings（设置）`、`Create Token（创建令牌）`，方便你按页面文字找到对应位置。

## 一、功能说明

EMBY_CF 是一个部署在 Cloudflare Workers 上的 Emby 反向代理和多用户路由面板，主要功能包括：

- Emby/Jellyfin 类服务反向代理
- WebSocket 代理
- 管理员全局路由
- 用户独立路由
- 邀请码注册
- 注册用户自动创建三级子域名
- 用户可修改自己的优选域名或优选 IP
- 自动识别 DNS 目标类型并创建 `CNAME`、`A` 或 `AAAA` 记录
- 优选域名测速
- 路由线路测速
- D1 数据库存储用户、邀请码、路由、DNS、统计和测速缓存
- 管理员后台重置数据库

## 二、准备工作

部署前需要准备：

| 项目 | 说明 |
|---|---|
| Cloudflare 账号 | 用于运行 Worker、D1 和 DNS |
| 已托管到 Cloudflare 的域名 | 用于用户子域名和 Worker 路由 |
| GitHub 账号 | 用于 Fork 仓库和运行 GitHub Actions |
| Cloudflare API Token | 用于自动部署、创建 D1、配置 Worker 路由 |
| DNS 编辑权限 | 用于注册用户时自动创建或修改 DNS |

如果还没有域名，可以先注册域名并把 DNS 托管到 Cloudflare。原教程提到的 DNSHE 地址：

```text
https://my.dnshe.com/index.php?m=domain_hub
```

邀请码：

```text
ZPB06CED7F
```

## 三、Cloudflare API Token

### 1. 创建部署 Token

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

如果你只想先简单部署，可以让一个 Token 同时负责部署和 DNS。更稳妥的方式是部署 Token 和 DNS Token 分开。

### 2. 创建 DNS Token

DNS Token 用于 Worker 运行时自动给注册用户创建 DNS 记录。

1. 仍然在 `API Tokens（API 令牌）` 页面。
2. 点击 `Create Token（创建令牌）`。
3. 选择自定义 Token。
4. 给目标 Zone 添加 `DNS:Edit` 权限。
5. Zone 范围选择你的根域名所在 Zone。

这个 Token 后面填到 `CF_DNS_API_TOKEN`。

## 四、GitHub Actions 自动部署

### 1. Fork 仓库

打开项目仓库：

```text
https://github.com/Dirige/EMBY_CF
```

点击右上角 `Fork（复刻）`，把仓库复制到自己的 GitHub 账号。

### 2. 添加 GitHub Secrets

进入你 Fork 后的仓库：

1. 点击 `Settings（设置）`。
2. 点击左侧 `Secrets and variables（秘密和变量）`。
3. 点击 `Actions（操作）`。
4. 点击 `New repository secret（新建仓库密钥）`。
5. 按下表逐个添加。

| Secret 名称 | 必需 | 示例 | 说明 |
|---|---:|---|---|
| `CF_API_TOKEN` | 是 | `你的 Cloudflare API Token` | 用于部署 Worker、创建 D1、配置 Worker 路由 |
| `CF_ACCOUNT_ID` | 是 | `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` | Cloudflare 账户 ID |
| `BASE_DOMAIN` | 是 | `dirige.de5.net` | 用户子域名所在根域名 |
| `CF_ZONE_ID` | 是 | `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` | `BASE_DOMAIN` 所在 Zone ID |
| `CF_DNS_API_TOKEN` | 推荐 | `你的 DNS Token` | Worker 运行时自动创建和修改用户 DNS |
| `CF_WORKER_NAME` | 否 | `emby-proxy` | Worker 名称，不填默认 `emby-proxy` |
| `DNS_RECORD_NAME` | 否 | `emby` | 主入口 DNS 记录名，不填默认 `emby` |

注意：

- 不要创建空白 Secret。
- 没用到的可选项可以不建。
- `ADMIN_PASSWORD` 不建议放在仓库配置里，建议部署后到 Cloudflare Worker 控制台手动填。

### 3. 运行 Actions

1. 点击仓库顶部 `Actions（操作）`。
2. 左侧选择 `Deploy to Cloudflare Workers`。
3. 点击右侧 `Run workflow（运行工作流）`。
4. 再点绿色的 `Run workflow（运行工作流）` 确认。
5. 等待任务完成，状态显示绿色对勾即部署成功。

工作流会自动完成：

| 步骤 | 说明 |
|---|---|
| 安装 Wrangler | 使用 Cloudflare Wrangler CLI 部署 |
| 创建或复用 D1 | 默认数据库名 `emby-proxy-db` |
| 更新 `wrangler.toml` | 写入 Worker 名称、根域名、Zone ID、D1 ID |
| 写入 DNS Token | 把 `CF_DNS_API_TOKEN` 写入 Worker Secret |
| 部署 Worker | 发布 `worker.js` |
| 配置 Worker 路由 | 创建主入口路由和 `*.BASE_DOMAIN/*` 通配符路由 |

## 五、Cloudflare Worker 变量和机密

自动部署完成后，建议手动检查 Worker 变量。

进入 Cloudflare：

1. 打开 `Workers & Pages（Workers 和 Pages）`。
2. 点击你的 Worker，例如 `emby-proxy`。
3. 点击 `Settings（设置）`。
4. 点击 `Variables and Secrets（变量和机密）`。
5. 点击 `Add variable（添加变量）` 或 `Add secret（添加机密）`。

建议按下表填写：

| 名称 | 类型 | 必需 | 示例 | 说明 |
|---|---|---:|---|---|
| `ADMIN_USERNAME` | Variable（变量） | 是 | `admin` | 管理员用户名 |
| `ADMIN_PASSWORD` | Secret（机密） | 是 | 自己设置 | 管理员密码 |
| `BASE_DOMAIN` | Variable（变量） | 是 | `dirige.de5.net` | 用户子域名根域名 |
| `CF_ZONE_ID` | Variable（变量）或 Secret（机密） | 是 | `xxxxxxxx...` | Cloudflare Zone ID |
| `CF_DNS_API_TOKEN` | Secret（机密） | 是 | DNS Token | 自动创建/修改 DNS |
| `SESSION_SECRET` | Secret（机密） | 推荐 | 随机长字符串 | 用户登录会话签名 |
| `DNS_RECORD_NAME` | Variable（变量） | 否 | `emby` | 主入口记录名 |

`wrangler.toml` 里不要写：

```toml
ADMIN_PASSWORD = ""
```

否则部署后可能把控制台里的管理员密码覆盖成空值。当前仓库已经移除了这行。

## 六、D1 数据库

### 自动创建和初始化

GitHub Actions 会自动创建或复用 D1 数据库。Worker 第一次收到请求时，会自动创建业务表，不需要你手动执行 SQL。

业务表包括：

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

如果你手动部署 Worker：

1. 在 Cloudflare 控制台进入 `Storage & databases（存储和数据库）`。
2. 点击 `D1 SQL Database（D1 SQL 数据库）`。
3. 点击 `Create database（创建数据库）`。
4. 输入数据库名称，例如 `emby-proxy-db`。
5. 回到 Worker 页面。
6. 点击 `Settings（设置）`。
7. 点击 `Bindings（绑定）`。
8. 点击 `Add binding（添加绑定）`。
9. 类型选择 `D1 database（D1 数据库）`。
10. 变量名填写 `DB`。
11. 选择刚创建的 D1 数据库。
12. 点击 `Save（保存）`。

## 七、DNS 和 Worker 路由

用户注册后会自动生成三级子域名，例如：

```text
111.dirige.de5.net
```

因此必须配置通配符 Worker 路由：

```text
*.BASE_DOMAIN/*
```

例如：

```text
*.dirige.de5.net/*
```

手动添加路线：

1. 进入 Cloudflare 的 Worker 页面。
2. 点击 `Settings（设置）`。
3. 点击 `Triggers（触发器）`。
4. 找到 `Routes（路由）`。
5. 点击 `Add route（添加路由）`。
6. 填写 `*.你的根域名/*`。
7. 选择当前 Worker。
8. 点击 `Save（保存）`。

建议同时添加主入口路由：

```text
emby.dirige.de5.net/*
```

如果你在 GitHub Secrets 里设置了 `DNS_RECORD_NAME`，这里的 `emby` 换成你的记录名。

## 八、首次使用

### 1. 管理员登录

打开：

```text
https://你的入口域名/admin
```

输入你在 Worker 变量里设置的：

```text
ADMIN_USERNAME
ADMIN_PASSWORD
```

### 2. 生成邀请码

进入管理员后台后，找到“邀请码管理”：

1. 选择生成数量。
2. 点击“生成邀请码”。
3. 可以点击“复制未使用”发给用户。

### 3. 用户注册

用户打开：

```text
https://你的入口域名/register
```

填写：

| 字段 | 说明 |
|---|---|
| 用户名 | 会成为 DNS 子域名，例如 `111` -> `111.dirige.de5.net` |
| 密码 | 用户登录密码 |
| 邀请码 | 管理员发放的邀请码 |

注册成功后，系统会自动：

1. 创建用户账号。
2. 标记邀请码为已使用。
3. 创建 `用户名.BASE_DOMAIN` 的 DNS 记录。
4. 默认指向 `youxuan.cf.090227.xyz`。

如果后续某一步失败，系统会回滚用户和邀请码，避免注册失败还占用邀请码。

## 九、用户后台

用户注册或登录后进入 `/admin`，如果不是管理员，会显示用户控制台。

### 我的访问域名

这里管理用户自己的三级子域名，例如：

```text
111.dirige.de5.net
```

点击“修改目标”后，可以填写“优选域名 / IP”。

系统会自动判断输入内容：

| 输入类型 | 自动 DNS 记录 | 示例 |
|---|---|---|
| 域名 | `CNAME` | `youxuan.example.com` |
| IPv4 | `A` | `1.2.3.4` |
| IPv6 | `AAAA` | `2606:4700:4700::1111` |

保存时会先删除旧的 `A/AAAA/CNAME` 记录，再创建新记录。所以用户不用手动选择 A 记录还是 CNAME 记录。

注意：这里建议只填写纯域名或 IP，不要填写路径、端口、账号密码。例如：

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

## 十、管理员后台

管理员后台包含：

| 区域 | 功能 |
|---|---|
| 路由管理 | 创建管理员全局路由 |
| 优选域名测速 | 从 Worker 边缘测试内置优选入口 |
| 邀请码管理 | 生成、复制、释放邀请码 |
| 数据库维护 | 删除并重建业务表 |

### 释放邀请码

点击“释放”后，如果该邀请码绑定了普通用户，会同步删除：

- 该普通用户
- 该用户的访问域名记录
- 该用户创建的路由
- 该用户子域名的 DNS 记录

管理员账号不会被释放邀请码删除。

### 重置数据库

点击“重置数据库”后，需要输入确认文本：

```text
RESET DATABASE
```

确认后会：

- 删除本 Worker 管理的 9 张业务表
- 重新创建最新表结构
- 尝试清理已记录用户子域名的 DNS
- 保留 D1 数据库实例
- 保留 Worker 环境变量和机密

## 十一、手动部署 worker.js

如果不用 GitHub Actions，也可以手动部署：

1. 登录 Cloudflare 控制台。
2. 点击左侧 `Workers & Pages（Workers 和 Pages）`。
3. 点击 `Create application（创建应用程序）`。
4. 选择 `Create Worker（创建 Worker）`。
5. 输入 Worker 名称，例如 `emby-proxy`。
6. 点击 `Deploy（部署）`。
7. 部署完成后点击 `Edit code（编辑代码）`。
8. 删除默认代码。
9. 粘贴 `worker.js` 全部内容。
10. 点击 `Save and deploy（保存并部署）`。
11. 按上文添加 D1 Binding、变量、机密和 Worker 路由。

## 十二、本地检查

如果本地安装了 Wrangler，可以在项目目录运行：

```bash
node --check worker.js
wrangler deploy --dry-run
```

查看登录状态：

```bash
wrangler whoami
```

查看线上实时日志：

```bash
wrangler tail
```

## 十三、故障排查

| 问题 | 常见原因 | 处理方式 |
|---|---|---|
| `/admin` 登录失败 | `ADMIN_PASSWORD` 未填或被空值覆盖 | 到 `Settings（设置） -> Variables and Secrets（变量和机密）` 手动添加 `ADMIN_PASSWORD` Secret |
| 注册失败：DNS 自动配置未完成 | 缺少 `CF_ZONE_ID` 或 `CF_DNS_API_TOKEN` | 检查 Worker 变量和机密 |
| 注册失败：优选目标必须是合法域名或 IP | 目标带了路径、端口或非法字符 | 只填纯域名、IPv4 或 IPv6 |
| 注册失败但邀请码被占用 | 线上不是最新版本 | 重新运行 `Actions（操作） -> Deploy to Cloudflare Workers` |
| 用户子域名 404 | 没有通配符路由 | 添加 `*.BASE_DOMAIN/*` Worker 路由 |
| 用户路由访问到管理员全局路由 | 用户没有创建同名路径 | 到用户后台“我的路由”添加对应 prefix |
| D1 表为空或结构异常 | 初始化中断或旧结构残留 | 管理员后台执行“重置数据库” |
| 优选域名测速结果重复 | 浏览器或 D1 缓存仍在 | 点击重新测速，必要时重置测速缓存或等待缓存过期 |

## 十四、安全建议

- `ADMIN_PASSWORD`、`CF_DNS_API_TOKEN`、`SESSION_SECRET` 建议使用 Secret（机密）。
- 不要把管理员密码写入仓库。
- DNS Token 建议只授予目标 Zone 的 `DNS:Edit` 权限。
- 定期备份 D1 数据。
- 不要代理无权访问的服务。

## 声明

本工具仅用于学习、研究和自有服务代理测试。请勿用于违法用途。使用本工具产生的一切后果由使用者自行承担。
