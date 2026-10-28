# 个人版（单用户 + VPS 中继分流）

在多人版（仓库根目录，v6.7.5-multi）基础上裁剪出的**个人自用版**，核心新增：**VPS 反代中继**与**三态分流**。

> 目录：`worker.js`（Cloudflare Worker 单文件）· `relay.go`（VPS 中继 Go 源码）· `deploy_vps.sh`（VPS 一键部署）
> 当前版本：**v6.3.4-image**（`worker.js` 首行 `CURRENT_VERSION` 为准）

## 架构

```
客户端 ──只连 Worker 域名──▶ CF Worker ──┬─▶ VPS 中继(relay.go) ─▶ Emby 源站
                                        └─▶ 直连源站（按路由模式/请求类别分流）
```

- 所有配置（VPS 地址/密钥/证书/路由分流模式）存 Worker 的 D1，后台网页管理，**保存即推送到 VPS 热更新**，VPS 无需环境变量
- VPS 与 Worker 之间用 HMAC 签名头鉴权（`X-Relay-Ts + ':' + X-Relay-Target`，±300s 时间窗）

## 路由三态分流（`use_relay`）

| 值 | 行为 | 适用 |
|---|---|---|
| `off` | 全部 Worker 直连源站 | 无限制站点 |
| `on` | 全部流量走 VPS 中继 | 直连不可达 / 想全程走 VPS |
| `image` | **API/图片/WS/PlaybackInfo 走 VPS；视频流(streaming/segment) Worker 直连** | 源站禁 CN/JP 但 CF 出口可达；省 VPS 带宽 |

`image` 模式内置**自动回退**：视频直连若被源站拒绝（401/403/451 或网络错误/超时），同一请求自动改走 VPS 重发，响应头带 `X-Relay-Fallback: 1`，触发原因写入后台审计日志（`direct.fallback`）。

实测案例：
- 某站禁中日 IP，国内手机落在 NRT（东京）colo → 直连 403（CF 拦截页）→ 自动回退 VPS 正常播放；SIN colo 直连正常
- 前后端分离站（302 跳媒体域）：`compat_mode=on` 时 Worker 原生跟跳，媒体字节直接从 CF 拉取，VPS 零负担

## Worker 部署

单文件 `worker.js`，无需构建。绑定：

| 绑定 | 类型 | 说明 |
|---|---|---|
| `DB` | D1 | 唯一必需，配置与统计存储 |
| `ADMIN_TOKEN` | plain text | 后台登录密钥 |
| `BASE_DOMAIN` | plain text | 访问域名，如 `255432.xyz` |
| `DNS_RECORD_NAME` | plain text | 子域前缀，如 `proxy` → `proxy.255432.xyz` |
| `CF_API_TOKEN` | secret | 用于自动建 DNS 记录（可选） |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | secret | 通知（可选） |

- `compatibility_date = 2025-05-15`，flag `nodejs_compat`，placement `smart`（含义见下方「部署参数说明」）
- 每条路由可独立设置：目标地址（多行=多线路故障转移）、`use_relay` 三态、IP 透传模式（forward/strip/disable）、兼容模式、缓存开关、IP 黑白名单、自定义请求头

## CF_API_TOKEN 需要的权限

Worker 用它做两件事：**自动创建/替换路由的 DNS 记录**、**拉取 Cloudflare 流量统计（GraphQL）**。创建 Token（`dash.cloudflare.com/profile/api-tokens` → Create Token → Custom token）时勾选：

| 权限 | 级别 | 用途 |
|---|---|---|
| **Zone → DNS → Edit** | 仅指定 Zone（如 255432.xyz） | 创建/替换路由的 DNS 记录 |
| **Zone → Zone → Read** | 仅指定 Zone | 识别 Zone ID |
| **Zone → Analytics → Read** | 仅指定 Zone | 流量统计/日报（GraphQL `httpRequestsAdaptiveGroups`） |

- Zone Resources 选 **Include → Specific zone**，只授权你自己的域名，最小权限
- 不需要任何 Account 级权限；不用统计/日报功能时可省略 Analytics 权限
- 建议开启 Client IP 过滤或设置较短有效期，泄漏后可随时 Roll（轮换）

## 部署参数说明

| 参数 | 是什么 | 为什么这么填 |
|---|---|---|
| `compatibility_date = 2025-05-15` | 把 Worker 运行时的**行为版本**固定到这个日期 | Cloudflare 会不定期改变 JS 运行时的默认行为（如 fetch、缓存语义）。固定日期 = 平台以后怎么升级，你的 Worker 行为都不变，避免「没改代码却出 bug」。该日期之前发布的能力全部可用 |
| `nodejs_compat` | 兼容标志：在 Workers 里启用 **Node.js API 兼容层**（`node:crypto`、`node:buffer` 等） | 代码里用到 Node 风格 API 时必须开；不开会报模块找不到 |
| `placement = smart` | **Smart Placement**：让 Cloudflare 自动把 Worker 跑在**离源站最近**的数据中心，而不是死板地跑在离用户最近的边缘 | 反代场景 Worker→源站的流量是大头，智能放置可显著降低 Worker↔源站往返延迟；用户↔Worker 那一跳本来就近 |

## VPS 中继部署（一键，免编译）

新装 Ubuntu/Debian 云服务器（amd64/arm64 均可），root 执行**一行命令**：

```bash
curl -fsSL https://raw.githubusercontent.com/Dirige/EMBY_CF/master/personal/deploy_vps.sh | bash
```

脚本自动完成：按架构下载 `personal/bin/` 里的**预编译二进制**（无需安装 Go）→ **生成随机引导密钥**写入 `/etc/emby-relay/config.json` → systemd（开机自启+崩溃自动重启）→ ufw 放行 2087 → NTP 校时。结束时**打印中继地址和引导密钥**，照提示去后台填一次即接入。重复运行安全（已有配置不会覆盖）。

之后在 Worker 后台「VPS 反代中继」卡片：填中继地址 + 引导密钥 → 测试 → 保存启用（自动推送正式密钥/证书并热重启）。更换密钥时后台会先用旧密钥推送失败再自动用新密钥重试，无死循环。**此后所有配置变更都在后台完成，无需再登 VPS。**

注意事项：
- DNS 的 `relay.` 记录必须**灰云 DNS only**（Worker 明文 HTTP 直连 2087）
- 2087 只接受带 HMAC 签名的请求，无签名一律 401，不可当公开代理
- 时间必须校准（签名时间窗 ±300s），脚本已自动开启 NTP

## 后台入口

`https://<你的域名>/admin`，用 `ADMIN_TOKEN` 登录。功能：路由管理（含三态下拉）、VPS 中继配置/测试/推送、优选域名、访问统计、审计日志、导入导出。

## VPS 流量统计

中继内置流量计数（`relay.go` v0.2.0+）：请求数、**↑从源站拉取字节 / ↓发回客户端字节**，按源站域名分组、按天（上海时区）滚动，每分钟落盘 `/etc/emby-relay/stats.json`（重启不丢）。Worker 后台「VPS 反代中继」卡片自动展示（60 秒自动刷新，点击立即刷新），接口：`/_relay/stats`（X-Relay-Key 鉴权）→ 后台 `/admin/api/relay/stats`。

## 与多人版的关系

本目录独立演进，不依赖根目录多人版代码；多人版的多用户/邀请码/配额体系本版不包含。
