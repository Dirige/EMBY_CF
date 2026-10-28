#!/usr/bin/env bash
# Emby Relay (VPS 中继) 一键部署脚本 —— 配合 Cloudflare Worker 个人版使用
# 适用：Ubuntu / Debian 新装云服务器（root 或 sudo 用户执行）
# 用法：
#   1. 把本目录的 relay.go 与本脚本上传到服务器同一目录
#   2. 修改下方 BOOT_SECRET 为你自己的随机引导密钥
#   3. bash deploy_vps.sh
#   4. 到 Worker 后台「VPS 反代中继」卡片填入 http://<本机域名或IP>:2087 + 引导密钥 → 测试 → 保存推送

set -euo pipefail

BOOT_SECRET="请改成你的随机引导密钥"   # ← 必改：worker 后台第一次连接用的引导密钥
RELAY_PORT=2087
BIN=/usr/local/bin/emby-relay
CFG=/etc/emby-relay/config.json
UNIT=/etc/systemd/system/emby-relay.service
SRC_DIR="$(cd "$(dirname "$0")" && pwd)"

[ "$(id -u)" -eq 0 ] || { echo "请用 root 运行"; exit 1; }
[ -f "$SRC_DIR/relay.go" ] || { echo "缺少 relay.go"; exit 1; }

echo "==> 1/6 安装 Go 编译器（若已装跳过）"
if ! command -v go >/dev/null 2>&1; then
  apt-get update -y
  apt-get install -y golang-go ufw
fi

echo "==> 2/6 编译 relay.go -> $BIN"
CGO_ENABLED=0 go build -o "$BIN" "$SRC_DIR/relay.go"

echo "==> 3/6 写入初始配置 $CFG（真实密钥/证书随后由 Worker 后台推送覆盖）"
mkdir -p /etc/emby-relay
cat > "$CFG" <<EOF
{"port": $RELAY_PORT, "secret": "$BOOT_SECRET", "verify_upstream_tls": true}
EOF
chmod 600 "$CFG"

echo "==> 4/6 安装 systemd 服务"
cat > "$UNIT" <<'EOF'
[Unit]
Description=Emby Relay HTTPS forwarder for CF Worker
After=network.target
[Service]
ExecStart=/usr/local/bin/emby-relay
Restart=always
RestartSec=3
User=root
NoNewPrivileges=true
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now emby-relay

echo "==> 5/6 防火墙放行 $RELAY_PORT/tcp"
ufw allow "$RELAY_PORT"/tcp >/dev/null 2>&1 || true
ufw status | grep -q "Status: active" || ufw --force enable

echo "==> 6/6 校时（HMAC 签名要求时间误差 <300s）"
timedatectl set-ntp true 2>/dev/null || true
timedatectl | grep -E 'System clock|NTP service' || true

echo
echo "✅ 部署完成。服务状态："
systemctl --no-pager status emby-relay | head -5
echo
echo "下一步（在 Cloudflare Worker 后台完成，不再需要登这台服务器）："
echo "  1. DNS 添加 A 记录 relay.<你的域名> -> 本机IP（务必灰云 DNS only）"
echo "  2. 后台「VPS 反代中继」填 http://relay.<你的域名>:$RELAY_PORT + 引导密钥"
echo "  3. 点「测试」→ 保存并启用（会自动推送真实密钥/证书并重启本服务）"
