#!/usr/bin/env bash
# Emby Relay (VPS 中继) 一键部署 —— 配合 Cloudflare Worker 个人版
# 新装 Ubuntu/Debian 云服务器，root 执行一行即可（无需安装 Go、无需上传文件）：
#   curl -fsSL https://raw.githubusercontent.com/Dirige/EMBY_CF/master/personal/deploy_vps.sh | bash
# 脚本自动：下载对应架构的预编译二进制 → 生成随机引导密钥 → systemd/防火墙/校时
# 结束时打印「中继地址」和「引导密钥」，照提示去 Worker 后台填一次即完成接入。

set -euo pipefail

RELAY_PORT="${RELAY_PORT:-2087}"
BIN=/usr/local/bin/emby-relay
CFG=/etc/emby-relay/config.json
UNIT=/etc/systemd/system/emby-relay.service
BASE_URL="https://raw.githubusercontent.com/Dirige/EMBY_CF/master/personal"

[ "$(id -u)" -eq 0 ] || { echo "请用 root 运行（sudo bash deploy_vps.sh）"; exit 1; }

echo "==> 1/4 下载预编译二进制（按架构自动选择，无需 Go）"
case "$(uname -m)" in
  x86_64)  ARCH=amd64 ;;
  aarch64|arm64) ARCH=arm64 ;;
  *) echo "不支持的架构: $(uname -m)（可自行用 relay.go 编译）"; exit 1 ;;
esac
curl -fsSL "$BASE_URL/bin/emby-relay-linux-$ARCH" -o /tmp/emby-relay.dl
chmod 755 /tmp/emby-relay.dl

echo "==> 2/4 生成引导密钥并写入初始配置"
# 幂等：已有配置则保留密钥/证书，仅补充缺失的限额字段（v0.3.0）
LIMITS='"monthly_limit_bytes": 9895604649984, "per_ip_daily_limit_bytes": 32212254720, "per_ip_max_conns": 8, "allow_cf_ips_only": true'
if [ -s "$CFG" ] && grep -q '"secret"' "$CFG" 2>/dev/null; then
  echo "    检测到已有配置 $CFG，保留密钥/证书"
  mkdir -p /etc/emby-relay
  if command -v python3 >/dev/null 2>&1; then
    python3 - "$CFG" <<PYEOF
import json, sys
p = sys.argv[1]
c = json.load(open(p))
changed = False
defaults = {
    'monthly_limit_bytes': 9895604649984,      # 9TB/月出站上限（0=不限）
    'per_ip_daily_limit_bytes': 32212254720,   # 单 IP 30GB/天
    'per_ip_max_conns': 8,                     # 单 IP 并发连接
    'allow_cf_ips_only': True,                 # 只接受 Cloudflare 回源 IP + 本机
}
for k, v in defaults.items():
    if k not in c:
        c[k] = v
        changed = True
if changed:
    json.dump(c, open(p, 'w'), indent=2)
    print('    已补充限额字段（月 9TB / 单IP日 30GB / 并发 8 / CF 白名单）')
else:
    print('    限额字段已存在，不改动')
PYEOF
  else
    echo "    （无 python3，跳过限额字段补充——如需限额请手动编辑 $CFG）"
  fi
else
  BOOT_SECRET="$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n' | cut -c1-32)"
  mkdir -p /etc/emby-relay
  cat > "$CFG" <<EOF
{"port": $RELAY_PORT, "secret": "$BOOT_SECRET", "verify_upstream_tls": true, $LIMITS}
EOF
  chmod 600 "$CFG"
fi

echo "==> 3/4 安装 systemd 服务 + 防火墙 + 校时"
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
systemctl stop emby-relay >/dev/null 2>&1 || true
mv /tmp/emby-relay.dl "$BIN"
systemctl enable --now emby-relay >/dev/null 2>&1 || systemctl restart emby-relay
command -v ufw >/dev/null 2>&1 || apt-get install -y ufw >/dev/null 2>&1 || true
ufw allow "$RELAY_PORT"/tcp >/dev/null 2>&1 || true
ufw status 2>/dev/null | grep -q "Status: active" || ufw --force enable >/dev/null 2>&1 || true
command -v timedatectl >/dev/null 2>&1 && timedatectl set-ntp true 2>/dev/null || true

echo "==> 4/4 汇总"
PUBLIC_IP="$(curl -4 -s --max-time 8 https://api.ipify.org || hostname -I | awk '{print $1}')"
SECRET_NOW="$(grep -o '"secret": *"[^"]*"' "$CFG" | cut -d'"' -f4)"
systemctl is-active --quiet emby-relay && SVC=运行中 || SVC=未运行

echo
echo "=========================== 部署完成 ==========================="
echo "  架构     : linux/$ARCH"
echo "  服务状态 : $SVC   端口 : $RELAY_PORT"
echo "  中继地址 : http://$PUBLIC_IP:$RELAY_PORT"
echo "  引导密钥 : $SECRET_NOW"
echo "----------------------------------------------------------------"
echo "  接下来只需在 Worker 后台完成（之后无需再登这台服务器）："
echo "   1) DNS 加一条 A 记录：relay.<你的域名> -> $PUBLIC_IP（灰云 DNS only）"
echo "   2) 后台「VPS 反代中继」填上面【中继地址】+【引导密钥】"
echo "   3) 点「测试」→ 保存并启用（自动推送正式密钥/证书并热重启）"
echo "   4) 后台中继卡片会自动显示 VPS 流量统计（今日/累计/按源站）"
echo "================================================================"
