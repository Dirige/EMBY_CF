#!/usr/bin/env bash
# Emby Relay (VPS 中继) 一键部署 —— 配合 Cloudflare Worker 个人版
# 最简用法（新装 Ubuntu/Debian 云服务器，root 执行一行）：
#   curl -fsSL https://raw.githubusercontent.com/Dirige/EMBY_CF/master/personal/deploy_vps.sh | bash
# 脚本会自动：装 Go → 下载 relay.go → 编译 → 生成随机引导密钥 → 配置/systemd/防火墙/校时
# 结束时打印「引导密钥」和「中继地址」，照着提示去 Worker 后台填一次即完成接入。

set -euo pipefail

RELAY_PORT="${RELAY_PORT:-2087}"
BIN=/usr/local/bin/emby-relay
CFG=/etc/emby-relay/config.json
UNIT=/etc/systemd/system/emby-relay.service
WORKDIR=/opt/emby-relay
SRC_URL="https://raw.githubusercontent.com/Dirige/EMBY_CF/master/personal/relay.go"

[ "$(id -u)" -eq 0 ] || { echo "请用 root 运行（sudo bash deploy_vps.sh）"; exit 1; }

echo "==> 1/6 安装依赖（Go 编译器、curl、ufw）"
command -v go    >/dev/null 2>&1 || apt-get update -y && apt-get install -y golang-go curl ufw
command -v go    >/dev/null 2>&1 || { echo "golang-go 安装失败，请手动安装 Go 1.21+"; exit 1; }
command -v curl  >/dev/null 2>&1 || apt-get install -y curl

echo "==> 2/6 获取源码 relay.go"
mkdir -p "$WORKDIR"
[ -f "$WORKDIR/relay.go" ] || curl -fsSL "$SRC_URL" -o "$WORKDIR/relay.go"
[ -s "$WORKDIR/relay.go" ] || { echo "relay.go 下载失败，请手动放置到 $WORKDIR"; exit 1; }

echo "==> 3/6 编译 -> $BIN"
CGO_ENABLED=0 go build -o "$BIN" "$WORKDIR/relay.go"

echo "==> 4/6 生成引导密钥并写入初始配置"
# 幂等：重复运行不会覆盖已推送过的正式配置（若已有配置则跳过重置密钥）
if [ -s "$CFG" ] && grep -q '"secret"' "$CFG" 2>/dev/null; then
  echo "    检测到已有配置 $CFG，保留不动（避免覆盖已推送的正式密钥）"
else
  BOOT_SECRET="$(openssl rand -hex 16 2>/dev/null || head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n' | cut -c1-32)"
  mkdir -p /etc/emby-relay
  cat > "$CFG" <<EOF
{"port": $RELAY_PORT, "secret": "$BOOT_SECRET", "verify_upstream_tls": true}
EOF
  chmod 600 "$CFG"
fi

echo "==> 5/6 systemd 服务 + 防火墙 + 校时"
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
systemctl enable --now emby-relay >/dev/null 2>&1 || systemctl restart emby-relay
ufw allow "$RELAY_PORT"/tcp >/dev/null 2>&1 || true
ufw status 2>/dev/null | grep -q "Status: active" || ufw --force enable >/dev/null 2>&1 || true
timedatectl set-ntp true 2>/dev/null || true

echo "==> 6/6 汇总"
PUBLIC_IP="$(curl -4 -s --max-time 8 https://api.ipify.org || hostname -I | awk '{print $1}')"
SECRET_NOW="$(python3 -c "import json;print(json.load(open('$CFG'))['secret'])" 2>/dev/null || grep -o '"secret": *"[^"]*"' "$CFG" | cut -d'"' -f4)"

systemctl is-active --quiet emby-relay && SVC=运行中 || SVC=未运行
echo
echo "=========================== 部署完成 ==========================="
echo "  服务状态 : $SVC   端口 : $RELAY_PORT"
echo "  中继地址 : http://$PUBLIC_IP:$RELAY_PORT"
echo "  引导密钥 : $SECRET_NOW"
echo "----------------------------------------------------------------"
echo "  接下来只需在 Worker 后台完成（之后无需再登这台服务器）："
echo "   1) DNS 加一条 A 记录：relay.<你的域名> -> $PUBLIC_IP（灰云 DNS only）"
echo "   2) 后台「VPS 反代中继」填上面【中继地址】+【引导密钥】"
echo "   3) 点「测试」→ 保存并启用（自动推送正式密钥/证书并热重启）"
echo "================================================================"
