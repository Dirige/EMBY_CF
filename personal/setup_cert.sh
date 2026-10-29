#!/bin/bash
# =============================================================
# emby-relay 一键 TLS 证书脚本（Let's Encrypt · DNS 验证 · 自动续期）
#
# 用法（在 VPS 上以普通用户运行）:
#   CF_TOKEN=你的CF令牌 CF_ZONE_ID=你的ZoneID bash setup_cert.sh relay.255432.xyz
#
# 前提:
#   1. CF_TOKEN 需要 Zone.DNS Edit + Zone Read 权限（与 Worker 部署用的同一枚即可）
#   2. relay.<域名> 已有灰云(DNS only) A 记录指向本 VPS 公网 IP
#   3. emby-relay 已安装（/usr/local/bin/emby-relay + /etc/emby-relay/config.json）
#
# 效果:
#   - 签发证书 → 注入 /etc/emby-relay/config.json（cert_pem/key_pem）→ 重启服务
#   - acme.sh 自动装 cron，到期前自动续期并重注入，全程无需人工
#   - 完成后 Worker 后台的中继地址改为 https://<域名>:2087
# =============================================================
set -e
DOMAIN="${1:-relay.255432.xyz}"
: "${CF_TOKEN:?缺少 CF_TOKEN}"
: "${CF_ZONE_ID:?缺少 CF_ZONE_ID}"
RELAY_DIR=/etc/emby-relay
STAGE_CRT="$HOME/${DOMAIN}_staging.crt"
STAGE_KEY="$HOME/${DOMAIN}_staging.key"

echo "==> 1/5 安装 acme.sh"
if [ ! -s "$HOME/.acme.sh/acme.sh" ]; then
  curl -s https://get.acme.sh | sh -s email=acme@${DOMAIN#*.} >/dev/null
fi
"$HOME/.acme.sh/acme.sh" --set-default-ca --server letsencrypt >/dev/null

echo "==> 2/5 DNS 验证签发证书（$DOMAIN）"
export CF_Token="$CF_TOKEN" CF_Zone_ID="$CF_ZONE_ID"
"$HOME/.acme.sh/acme.sh" --issue --dns dns_cf -d "$DOMAIN" --log 2>&1 | tail -4

echo "==> 3/5 写入证书注入脚本（需 sudo）"
sudo tee $RELAY_DIR/apply_cert.sh > /dev/null <<'EOS'
#!/bin/bash
set -e
CERT_FILE="${1:?}"; KEY_FILE="${2:?}"
[ -s "$CERT_FILE" ] && [ -s "$KEY_FILE" ] || { echo "cert/key missing"; exit 1; }
python3 - "$CERT_FILE" "$KEY_FILE" <<'PY'
import json, sys
cfg_path = '/etc/emby-relay/config.json'
cfg = json.load(open(cfg_path))
cfg['cert_pem'] = open(sys.argv[1]).read().strip()
cfg['key_pem'] = open(sys.argv[2]).read().strip()
json.dump(cfg, open(cfg_path, 'w'), indent=1)
print('config.json updated, tls cert embedded')
PY
systemctl restart emby-relay
sleep 1
systemctl is-active emby-relay
EOS
sudo chmod 700 $RELAY_DIR/apply_cert.sh

echo "==> 4/5 安装证书 + 挂自动续期钩子"
"$HOME/.acme.sh/acme.sh" --install-cert -d "$DOMAIN" --ecc \
  --fullchain-file "$STAGE_CRT" --key-file "$STAGE_KEY" \
  --reloadcmd "sudo $RELAY_DIR/apply_cert.sh $STAGE_CRT $STAGE_KEY" 2>&1 | tail -2

echo "==> 5/5 验证"
sleep 2
SECRET=$(sudo cat $RELAY_DIR/config.json | python3 -c 'import sys,json;print(json.load(sys.stdin)["secret"])')
curl -s -m 10 --resolve "$DOMAIN:2087:127.0.0.1" "https://$DOMAIN:2087/_relay/health" -H "X-Relay-Key: $SECRET" && echo
echo "✅ 完成。回 Worker 后台把中继地址改成 https://$DOMAIN:2087 即可"
echo "   注意: 续期依赖 CF_TOKEN（已存于 ~/.acme.sh/account.conf），请勿撤销该令牌对应权限"
