# 可选 VPS 中继 · 加固源码

版本标记：`emby-relay-0.3.2-private`，保留实际使用的 HLS 扩展；`private` 是既有版本字符串，不表示本目录含私有配置。本目录只有源码／依赖锁／合成测试，没有真实地址、密钥、证书或数据库。

**Worker 不配 VPS 也能使用登记线路。** 个人版支持逐线路自动／开／关；多人版只有原全局中继开关。不应直接共用个人版与多人版的中继密钥。

## 与旧安装包的区别

`personal/relay.go`、`personal/bin/`、`personal/deploy_vps.sh` 是历史 0.3.0 方案，不能当作当前加固版安装方法。不要执行旧 `curl | bash` 命令覆盖运行中的服务；本轮发布 GitHub 不会更新或重启任何 VPS。

本版修复日志泄露、拨号时 DNS 私网检查、上游 TLS 校验、跳转凭据隔离、签名编码、HLS 超限截断、WebSocket 101 包装、并发统计与热更新问题。原生媒体仍流式转发，不整片预取。

## 构建与测试

需要 Go >=1.24；`-race` 另需当前平台支持的 C 编译器：

```bash
cd relay
go test -race -count=1 ./...
CGO_ENABLED=0 go build -trimpath -o emby-relay .
```

**不要把构建产物当作配置备份。** 新安装应先准备可信证书、独立密钥与配置。已有安装先备份旧二进制、`/etc/emby-relay/config.json`、统计文件、证书与 systemd 定义；维护窗口中替换审核过的二进制并保留回滚，不运行旧一键脚本“补全配置”。

## 新服务配置参考

程序读取 `/etc/emby-relay/config.json`（部署前核对 `relay.go` 的路径常量），可使用如下**占位结构**，不能直接把占位密码上线：

```json
{
  "port": 2087,
  "secret": "REPLACE_WITH_A_NEW_RANDOM_SECRET",
  "cert_pem": "REPLACE_WITH_CERTIFICATE_PEM",
  "key_pem": "REPLACE_WITH_PRIVATE_KEY_PEM",
  "verify_upstream_tls": true,
  "allow_private_targets": false,
  "allow_cf_ips_only": true,
  "monthly_limit_bytes": 0,
  "per_ip_daily_limit_bytes": 0,
  "per_ip_max_conns": 8
}
```

- 限额 `0` 表示不设该项限制，**不是免费额度**；按自己的 VPS 套餐配置，不能照抄他人的配额。
- 服务域名通常是独立的 `relay.example.com`，DNS 直接到 VPS 并用匹配证书。优先使用可信 HTTPS；明文 HTTP 会暴露转发目标／令牌和控制通道数据。
- 配置与私钥设置严格权限，不能上传 GitHub；密钥通过安全方式传入，不以进程命令行、日志或截图展示。
- systemd 运行二进制时使用非特权高端口、合理权限、自动恢复与日志限制；首次安装先在隔离端口验证，再开放所需入站端口。不要自动启用防火墙并封掉现有 SSH。
- CF 来源限制与 Cloudflare 出口共享会影响并发计数，不应把单 IP 限额当作用户限额。

## 连接 Worker

先在已登录 Worker 后台保存自己的中继地址／密钥并测试，要求 HTTP 成功且 JSON `ok: true`；再按需启用。个人版可通过其既有后台推送配置／证书，多人版仅保存全局中继配置，不把个人版控制功能照抄进去。

健康正常不代表每个影片的媒体签名与 Range 都正常，仍需实际起播、拖动与长播。不要绕过配额，也不要把签名媒体 URL、源站或真实错误公开到日志。

升级现有服务不应改地址、密钥、证书、配额或重启共享服务，除非另行授权和安排维护窗口。可参考 [Worker 升级指南](../docs/UPGRADE.md)。
