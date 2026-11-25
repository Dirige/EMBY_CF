# 部署总指南 · 个人版与多人版

更新：2026-11-25。本文适用于个人版 `v6.4.9-refactor.8`、多人版 `v6.8.11-multi-refactor.3`。**本次 GitHub 更新不等于更新所有线上域名；每个入口都要用 `/health` 核对版本。**

## 1. 选版本与部署方式

- 个人自用：[个人版图文教程](docs/个人版部署教程.md)，复制 [personal/worker.js](personal/worker.js)。
- 多用户、邀请码、配额和独立推流：[多人版图文教程](docs/多人版部署教程.md)，复制根目录 [worker.js](worker.js)。
- 已有部署：[升级／备份／回滚](docs/UPGRADE.md)，不要重建 D1。
- 无网络阅读：下载 [个人版 HTML](docs/offline/personal.html) 或 [多人版 HTML](docs/offline/multi.html)。图片和样式已内嵌；截图只是参考，以文字与当前控制台为准。

最简单方式是 Cloudflare 网页创建模块 Worker、粘贴对应单文件、绑定独立 D1，再添加域名。源码由 `src/` / `web/` 生成，不要把源码入口中的 `import` 几行直接粘贴到网页。

## 2. 域名规划

假设你控制 `example.com`：

| 用途 | 示例 | 配置 |
| --- | --- | --- |
| 个人版主入口 | `proxy.example.com` | `BASE_DOMAIN=example.com`，`DNS_RECORD_NAME=proxy` |
| 多人版主入口 | `fd.example.com` | `BASE_DOMAIN=fd.example.com`，`DNS_RECORD_NAME=fd` |
| 多人版用户入口 | `alice.example.com` | 显式 `USER_DOMAIN=example.com`，用户名／子域名 `alice` |
| 可选 VPS | `relay.example.com:2087` | 独立 DNS / 证书 / 密钥，不当作 Worker 主入口 |

个人版和多人版不能指向同一 D1，也不要使用相同管理员根密钥。多人版用户子域名不要占用 `proxy`、`fd` 或已有其他业务域名。

### 域名接入不要混淆

**本项目添加的优选 IP／优选域名记录必须保持灰云（DNS only）**。优选接入与普通橙云接入是不同方案，不能把其中一种的代理状态套到另一种。

1. **优选 IP／优选域名接入（作者教程采用）**：A／AAAA／CNAME 指向选定 IP／域名，记录名与实际入口 Host 一致，**灰云**。保留既有 Worker 的域名／Route 与可承接该 Host 的接入条件，再用该入口 `/health` 验证。灰云本身不自动建立 Worker 绑定或证书；若没命中 Worker，排查接入链路，而不是把优选记录改橙云。
2. **普通 Workers Route**：如 `fd.example.com/*`、`*.example.com/*`，需要域名已托管在 Cloudflare，且对应 DNS 记录为**橙云代理**。通配 Route 不会自动产生 DNS。多人版可使用通配 DNS／逐个用户记录，但必须留意更具体 Route 与证书覆盖。
3. **Worker 自定义域（不使用优选的另一选择）**：在 Worker → 设置 → 域和路由 → 添加 → 自定义域，绑定完整主入口，由 Cloudflare 管理 DNS 与证书。不要把它的自动 DNS 与第 1 种的灰云优选记录混为一谈。

先用主入口 `/health` 验证，再验证一个用户子域名 `/health`。不要给整个根域随意绑定通配 Route，避免接管其他业务。官方说明：[Routes](https://developers.cloudflare.com/workers/configuration/routing/routes/) 与 [Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)。

## 3. 必需绑定与变量

所有敏感值用 Cloudflare **Secret**，不要写进 GitHub、截图或教程。示例域名和占位值不是可直接使用的账号配置。

| 名称 | 类型／是否必需 | 作用 |
| --- | --- | --- |
| `DB` | D1 绑定，两版必需 | 数据库变量名必须完全一致；每个发行版独立数据库 |
| `ADMIN_TOKEN` | Secret，必需 | 初始管理员密码；改密后仍用于认证派生，不能随便删除／轮换 |
| `BASE_DOMAIN` | 文本，使用自定义域时必需 | 个人版建议根域；多人版建议完整主入口，见上表示例 |
| `DNS_RECORD_NAME` | 文本，建议明确填写 | 主入口记录名，如 `proxy` 或 `fd` |
| `SESSION_SECRET` | Secret，多人版强烈建议 | 至少 32 随机字节；会话根，可分用途派生多人版 TG 加密密钥；个人版不靠它替代 `ADMIN_TOKEN` |
| `USER_DOMAIN` | 文本，多人版建议 | 用户入口后缀，如 `example.com`，避免自动推导歧义 |
| `SETTINGS_ENCRYPTION_KEY` | Secret，个人版网页 TG 必需 | **32 随机字节的 Base64**；多人版可选，未配时需要足够强的 `SESSION_SECRET` |
| `CF_API_TOKEN` | Secret，DNS／CF 统计可选 | 仅运行期 DNS 与统计，不需要赋予 Worker 脚本写权限 |
| `CF_ZONE_ID` / `CF_ACCOUNT_ID` | 文本，可选 | 手工指定可减少自动识别问题；ID 不能代替 API 权限 |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | Secret，可选 | 尚未保存网页配置时的兼容通知配置；推荐网页设置 |
| `NOTIFY_WEBHOOK` | Secret，可选 | 通用通知出口；不是 Telegram 入站管理 webhook |
| `DISABLE_DIRECT_PROXY` | 文本，默认 `1` | 保持默认：任意 `/https://...` 原始 URL 转发关闭 |
| `DIRECT_PROXY_ALLOW` | 文本，仅显式开放时 | `DISABLE_DIRECT_PROXY=0` 还必须有逗号分隔的目标域名白名单；不开放公共代理 |

生成随机值：在可信终端运行 `openssl rand -hex 32` 生成认证根，`openssl rand -base64 32` 生成通知加密主密钥。不同用途分别生成。不要用示例弱密码或把真实值粘贴到 issue。

## 4. API Token 最小权限

### Worker 运行 Token（`CF_API_TOKEN`）

| 权限 | 用途 |
| --- | --- |
| Zone → Zone → Read | 识别所属 Zone 与账户 |
| Zone → DNS → Edit | 创建／修改 DNS 记录 |
| Zone → Analytics → Read | Zone 范围统计 |
| Account → Account Analytics → Read | 需要账户／Worker 统计时再添加 |

Zone 资源只选你自己的目标区域。多人版对明确 Host 范围缺失或统计查询截断会显示不可用，不以账户总流量冒充单用户数据。仅运行代理、不用 DNS／CF 统计时可不配置这个 Token。

### 本地 CLI 部署身份

部署身份与运行 Token 分开。可用 `wrangler login`；或只在本机保存有 Account → Workers Scripts → Edit、所需 D1／Route／DNS 权限的专用 Token。手工在 Cloudflare 网页部署时无需给 Worker 保存部署 Token。不要把登录 OAuth 或 GitHub Token 当作 Worker 运行变量。

## 5. 首次运行

1. 创建两个不同 D1（只部署一个版本时创建一个即可）。绑定名为 `DB`，首次请求自动增量初始化，不执行“重置数据”。
2. 粘贴对应生成文件、设置变量／Secrets，保存部署。
3. 按所选接入方案添加主域名；优选 IP／优选域名记录保持灰云。访问 `https://你的入口/health`：必须看到所选版本。
4. 打开 `/admin`：个人版输入初始 `ADMIN_TOKEN`；多人版用户名 `admin`（或留空）及初始管理密码。
5. 在网页设置新的 12–128 字符密码，旧会话撤销。初始根仍需保留，不是改密后可删除的临时口令。
6. 添加一条有访问授权的线路，例如前缀 `demo`、目标 `https://media.example.net`。客户端服务器地址填 `https://你的入口/demo`，不要填 `/System/Info/Public` 这类具体接口。
7. 多人版额外创建邀请码／用户，验证用户 Host 和权限。独立推流地址只填写需匹配的媒体基址，不把它当作同路径备用源站。

## 6. 通知、定时任务与中继

- 设置 → 通知：保存 Bot Token 和数字 Chat ID，再测试；Token 留空保持。明确停用或密文损坏时不回退旧机器人。只有管理员可配置通知；Bot 不接受管理命令。
- 设置健康检查、日报、线路告警开关；在 Cloudflare 单独创建 Cron，例如 `*/10 * * * *`（UTC）。日报逻辑在北京时间 23 点判断，因此 Cron 必须覆盖 **UTC 15 点**。升级现有服务应保留原 Cron，不无故改成示例。
- VPS 可选，见 [中继源码与安装](relay/README.md)。个人版每条线路选自动／开／关；多人版只有原全局开关。中继地址／密钥缺失或关闭时不会使用 VPS。
- 中继测试必须 HTTP 成功且 JSON `ok: true`，但“健康成功”仍不代表特定影片签名、来源 IP 与 Range 可用。不会因下载慢而中途重复视频流。

## 7. 用源码与 Wrangler（进阶）

```bash
npm ci
npm run check
npm run package:workers
# 选择一个模板，复制到被忽略的本地文件并替换占位 Worker / DB / 域名。
cp wrangler.personal.example.toml wrangler.local.personal.toml
# 或 cp wrangler.multi.example.toml wrangler.local.multi.toml
```

**首次部署**确认 `main` 指向对应 `dist/*.mjs`、D1 ID 非占位、完整运行日期／flags／智能放置／域名均已核对，再显式执行 `npx wrangler deploy --config wrangler.local.personal.toml`。模板不含真实 Secrets，需在本地授权通道或 Cloudflare 页面设置。

**已有 Worker**不要直接用默认模板 `deploy`，它可能改变绑定、Cron、路由、flags 或智能放置。优先网页仅替换代码，或在完整同步本地配置后使用版本上传＋独立切流量；核对所有绑定，而不仅是 `keep_vars`。详见 [升级指南](docs/UPGRADE.md)。

## 8. 常见问题与日志

| 现象 | 先检查 |
| --- | --- |
| `/health` 显示旧版 | 域名实际绑定了哪个账户／Worker／Route；仓库更新不自动改变线上 |
| 原始 URL 路径返回 403 | 新版默认关闭，改用登记线路；不要为排障开放公共转发 |
| 登录／列表正常，播放转圈 | 收集同次播放的 PlaybackInfo、媒体 GET／Range 与 302；公共信息接口 200 不证明能播放 |
| 206 后 canceled／断开 | 可能是客户端取消、拖动、上游断流或网络问题，不能只凭状态认定原因 |
| 统计 `—`／不可用 | Token 权限、Host 范围、数据延迟；不要强退账户总量冒充用户统计 |
| TG 无法保存 | 个人版独立主密钥；多人版专用主密钥或至少 32 字节 SESSION_SECRET；密钥轮换需迁移／重存 |
| 用户创建成功但子域不通 | DNS 及代理状态、通配 Route、TLS 覆盖；不要只检查主入口 |
| VPS 429／配额拒绝 | 全站／来源 IP 限额、并发、真实出口；不要绕过配额或直接公开密钥 |

Cloudflare → Worker → Observability 查看请求、状态和异常。反馈时注明入口、`/health` 版本、时区、播放器和复现时间，提供前后 1–2 分钟日志；删除 Token、Cookie、用户名、影片签名和源站秘密。不要直接上传完整生产日志或 D1 到公开 GitHub。

## 9. 数据与回滚

后台配置导出不是完整备份，不含密码、私有 TG 和完整用户数据库。升级前通过可信 Cloudflare 通道备份完整 D1、原版本、绑定、Secrets、域名、Cron、智能放置与中继配置。代码回滚不等于数据回滚；旧版本可能忽略新密码／会话 epoch／加密通知，须先评估安全影响。具体检查见 [UPGRADE.md](docs/UPGRADE.md)。
