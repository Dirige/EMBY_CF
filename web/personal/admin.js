let allRoutes = [];
let allDomains = [];
let bestDomain = null;
let dnsConfig = null;
let currentBaseDomain = '';

function showToast(msg, ms) {
  var t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(function() { t.classList.remove('show'); }, ms || 2600);
}

function closeModal(id) { document.getElementById(id).classList.remove('show'); }
function openModal(id) { document.getElementById(id).classList.add('show'); }

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function copyRoute(btn) {
  var v = btn.getAttribute('data-copy') || '';
  var done = function() { showToast('已复制 ' + v); };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(v).then(done, function() { fallbackCopy(v); done(); });
  } else { fallbackCopy(v); done(); }
}
function fallbackCopy(v) {
  var ta = document.createElement('textarea');
  ta.value = v;
  ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); } catch (e) {}
  document.body.removeChild(ta);
}

async function logout() {
  try { await fetch('/admin/api/logout', { method: 'POST' }); } catch (e) {}
  location.href = '/';
}

async function loadRoutes() {
  try {
    const r = await fetch('/admin/api/routes');
    if (r.status === 401) { location.reload(); return; }
    allRoutes = await r.json();
    renderRoutes(allRoutes);
  } catch (e) {
    document.getElementById('routeList').innerHTML = '<p class="muted">加载失败: ' + esc(e.message) + '</p>';
  }
}

function renderRoutes(list) {
  const el = document.getElementById('routeList');
  var countChip = document.getElementById('routeCount');
  if (countChip) countChip.textContent = list.length + ' 条';
  var tabBadge = document.getElementById('tabRouteCount');
  if (tabBadge) tabBadge.textContent = list.length;
  if (!list.length) {
    el.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><span class="empty-state-icon">📦</span><p class="empty-state-text">暂无路由，点击上方按钮添加</p></div>';
    return;
  }
  el.innerHTML = list.map((r, ri) => {
    const targets = r.target.split(',').map(s => s.trim()).filter(Boolean);
    const remarkName = r.remark || '未命名';
    const cacheStatus = r.cache_img !== 'off';
    const compatStatus = r.compat_mode === 'on';

    let targetsHtml = '';
    targets.forEach((t, idx) => {
      const tag = idx === 0 ? '<span style="color:var(--ok);font-weight:700">[主]</span>' : '<span style="color:var(--warn);font-weight:700">[备' + idx + ']</span>';
      targetsHtml += '<div class="target-row">' + tag + ' <span class="target-url"><code>' + esc(t) + '</code></span></div>';
    });

    const fullUrl = location.origin + '/' + r.prefix;
    const disabled = r.enabled === 0;
    return '<div class="route-item" style="' + (disabled ? 'opacity:.55' : '') + '" data-search="' + esc((remarkName + ' ' + r.prefix).toLowerCase()) + '">' +
      '<div class="route-header">' +
        '<div class="route-title">' +
          '<h3 class="route-name">' + esc(remarkName) + '</h3>' +
          '<span class="route-path route-link" title="点击复制">' + esc(fullUrl) + '</span>' +
          '<button class="btn btn-sm btn-copy" onclick="copyRoute(this)" data-copy="' + esc(fullUrl) + '" title="复制完整链接">⧉</button>' +
        '</div>' +
      '</div>' +
      '<div class="target-list">' + targetsHtml + '</div>' +
      '<div class="route-meta">' +
        (disabled ? '<span class="meta-tag" style="color:var(--warn);border-color:var(--warn-dim)">⏸ 已停用</span>' : '') +
        (r.down_count ? '<span class="meta-tag" style="color:var(--warn);border-color:var(--warn-dim)">🔴 ' + r.down_count + ' 条线路异常</span>' : '') +
        (cacheStatus ? '<span class="meta-tag">🖼️ 缓存开启</span>' : '<span class="meta-tag">缓存关闭</span>') +
        (compatStatus ? '<span class="meta-tag" style="color:var(--warn);border-color:var(--warn-dim)">🔧 兼容模式</span>' : '') +
        (r.ip_mode === 'strip' ? '<span class="meta-tag" style="color:var(--info);border-color:var(--info-dim)">🛡️ IP不透传</span>' : '') +
        (r.ip_mode === 'disable' ? '<span class="meta-tag" style="color:var(--ok);border-color:var(--ok-dim)">🛡️ IP彻底隐藏</span>' : '') +
        (r.use_relay === 'on' ? '<span class="meta-tag" style="color:var(--info);border-color:var(--info-dim)">🖥️ VPS中继</span>' : '') +
        (r.use_relay === 'image' ? '<span class="meta-tag" style="color:var(--info);border-color:var(--info-dim)">🖼️ 视频直连·其余走VPS</span>' : '') +
        (r.last_play ? '<span class="meta-tag">📺 ' + esc(r.last_play) + '</span>' : '') +
      '</div>' +
      '<div class="route-actions">' +
        '<button class="btn btn-sm" data-act="up" data-prefix="' + esc(r.prefix) + '"' + (ri === 0 ? ' disabled' : '') + '>↑</button>' +
        '<button class="btn btn-sm" data-act="down" data-prefix="' + esc(r.prefix) + '"' + (ri === list.length - 1 ? ' disabled' : '') + '>↓</button>' +
        '<button class="btn btn-sm" data-act="test" data-prefix="' + esc(r.prefix) + '">测试</button>' +
        '<button class="btn btn-sm" data-act="toggle" data-prefix="' + esc(r.prefix) + '" data-enabled="' + (disabled ? '1' : '0') + '">' + (disabled ? '启用' : '停用') + '</button>' +
        '<button class="btn btn-sm" data-act="edit" data-prefix="' + esc(r.prefix) + '">编辑</button>' +
        '<button class="btn btn-sm btn-danger" data-act="del" data-prefix="' + esc(r.prefix) + '">删除</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

document.getElementById('routeList').addEventListener('click', function(ev) {
  var btn = ev.target.closest('button[data-act]');
  if (!btn) return;
  var a = btn.dataset.act, pf = btn.dataset.prefix;
  if (a === 'edit') editRoute(pf);
  else if (a === 'del') delRoute(pf);
  else if (a === 'toggle') toggleRoute(pf, btn.dataset.enabled === '1');
  else if (a === 'test') testRoute(pf, btn);
  else if (a === 'up') moveRoute(pf, -1);
  else if (a === 'down') moveRoute(pf, 1);
});

function fmtB(n) {
  n = Number(n) || 0;
  if (n < 1024) return n + ' B';
  var u = ['KB', 'MB', 'GB', 'TB'], i = -1;
  do { n /= 1024; i++; } while (n >= 1024 && i < u.length - 1);
  return n.toFixed(2) + ' ' + u[i];
}

async function postJson(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  let d = {};
  try { d = await r.json(); } catch (e) {}
  return { ok: r.ok, data: d };
}

async function toggleRoute(prefix, enable) {
  const x = await postJson('/admin/api/routes/toggle', { prefix: prefix, enabled: enable });
  showToast(x.ok ? (enable ? '已启用' : '已停用') : (x.data.error || '操作失败'));
  loadRoutes();
}

async function moveRoute(prefix, dir) {
  const order = allRoutes.map(function(r) { return r.prefix; });
  const i = order.indexOf(prefix), j = i + dir;
  if (i < 0 || j < 0 || j >= order.length) return;
  order.splice(j, 0, order.splice(i, 1)[0]);
  await postJson('/admin/api/routes/reorder', { order: order });
  loadRoutes();
}

async function testRoute(prefix, btn) {
  btn.disabled = true; btn.textContent = '测试中';
  const x = await postJson('/admin/api/routes/test', { prefix: prefix });
  btn.disabled = false; btn.textContent = '测试';
  if (!x.ok) { showToast(x.data.error || '测试失败'); return; }
  showToast(x.data.results.map(function(r, i) {
    return (i === 0 ? '主' : '备' + i) + ' ' + (r.ok ? r.ms + 'ms' : '失败');
  }).join('  |  '));
}

async function importConfig(input) {
  const f = input.files && input.files[0];
  input.value = '';
  if (!f) return;
  let data;
  try { data = JSON.parse(await f.text()); } catch (e) { showToast('不是合法的 JSON 文件'); return; }
  if (!confirm('导入将按路径覆盖同名路由，并追加不存在的优选域名，确定继续？')) return;
  const x = await postJson('/admin/api/import', data);
  if (!x.ok) { showToast(x.data.error || '导入失败'); return; }
  showToast('导入完成：路由 ' + x.data.routes + '，域名 ' + x.data.domains + (x.data.skipped.length ? '，跳过 ' + x.data.skipped.length : ''));
  loadRoutes(); loadDomains();
}

async function openSettings() {
  const r = await fetch('/admin/api/settings');
  const d = await r.json();
  const s = d.settings || {};
  document.getElementById('setHealth').checked = s.health_check === '1';
  document.getElementById('setDailyReport').checked = String(s.tg_daily_report ?? '1') !== '0';
  document.getElementById('setRate').value = s.rate_limit_per_min || '0';
  document.getElementById('setXfo').value = s.x_frame_options || '';
  document.getElementById('setManual').value = s.manual_redirect_domains || '';
  document.getElementById('setRules').value = s.domain_proxy_rules || '';
  const n = d.notify || {};
  document.getElementById('notifyHint').textContent = (n.telegram || n.webhook)
    ? '通知渠道：' + [n.telegram ? 'Telegram' : '', n.webhook ? 'Webhook' : ''].filter(Boolean).join(' + ')
      + '（Token: ' + (n.tokenVar || '—') + '，Chat: ' + (n.chatVar || '—') + '）'
    : '尚未配置通知：请设置 TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID（兼容 TG_*），或 NOTIFY_WEBHOOK';
  openModal('modalSettings');
}

async function saveSettings() {
  const x = await postJson('/admin/api/settings', {
    health_check: document.getElementById('setHealth').checked ? '1' : '0',
    tg_daily_report: document.getElementById('setDailyReport').checked ? '1' : '0',
    rate_limit_per_min: document.getElementById('setRate').value || '0',
    x_frame_options: document.getElementById('setXfo').value || '',
    manual_redirect_domains: document.getElementById('setManual').value.trim(),
    domain_proxy_rules: document.getElementById('setRules').value.trim()
  });
  if (!x.ok) { showToast(x.data.error || '保存失败'); return; }
  closeModal('modalSettings');
  showToast('设置已保存');
}

async function runNow() {
  showToast('执行中...');
  const x = await postJson('/admin/api/health/run', {});
  if (!x.ok) { showToast('执行失败'); return; }
  showToast('已检查 ' + x.data.checked + ' 条线路，状态变化 ' + x.data.alerts.length + ' 条');
  loadRoutes();
}

var AUDIT_ACTIONS = {
  settings: '修改设置',
  'report.send': '发送日报',
  import: '导入配置',
  'route.save': '保存路由',
  'route.rename': '重命名路由',
  'route.delete': '删除路由',
  'route.enable': '启用路由',
  'route.disable': '禁用路由',
  'domain.add': '添加优选域名',
  'domain.update': '更新优选域名',
  'domain.delete': '删除优选域名',
  'dns.replace': '替换 DNS 记录',
  'user.register': '用户注册',
  'user.create': '创建用户',
  'user.update': '更新用户',
  'user.delete': '删除用户',
  'user.password': '修改密码',
  'user.dns': '绑定用户 DNS',
  'user.route.save': '保存用户路由',
  'user.route.delete': '删除用户路由',
  'invite.create': '生成邀请码',
  'invite.delete': '删除邀请码',
  'db.reset': '重置数据库'
};
var AUDIT_SETTINGS = {
  health_check: '线路健康检查',
  tg_daily_report: '每日日报',
  rate_limit_per_min: '每分钟请求限制',
  x_frame_options: 'X-Frame-Options',
  manual_redirect_domains: '手动跳转域名',
  domain_proxy_rules: '域名代理规则'
};
function auditActionLabel(a) { return AUDIT_ACTIONS[a] || a || '—'; }
function auditTgError(raw) {
  var s = String(raw || '');
  var l = s.toLowerCase();
  if (l.indexOf('chat not found') >= 0) return '机器人找不到该会话（请先给机器人发送 /start，并核对 Chat ID）';
  if (l.indexOf('bot was blocked') >= 0) return '机器人已被该账号屏蔽';
  if (l.indexOf('unauthorized') >= 0) return 'Bot Token 无效';
  if (l.indexOf('not enough rights') >= 0) return '机器人没有发言权限';
  if (l.indexOf('not configured') >= 0) return '未配置 Telegram 变量';
  return s;
}
function auditDetailText(l) {
  var a = l.action || '';
  var d = String(l.detail == null ? '' : l.detail);
  if (a === 'settings') {
    if (!d) return '—';
    return d.split(',').filter(Boolean).map(function(k) { return AUDIT_SETTINGS[k] || k; }).join('、');
  }
  if (a === 'report.send') {
    if (d === 'ok') return '发送成功';
    if (d.indexOf('fail:') === 0) return '发送失败：' + auditTgError(d.slice(5).trim());
    return d || '—';
  }
  if (a === 'import') {
    var names = { routes: '路由', domains: '域名', skipped: '跳过' };
    return d.split(' ').filter(Boolean).map(function(p) {
      var i = p.indexOf('=');
      if (i < 0) return p;
      var k = p.slice(0, i), v = p.slice(i + 1);
      return (names[k] || k) + ' ' + v;
    }).join('、') || '—';
  }
  if (a === 'domain.delete') return d.replace('id=', 'ID ');
  if (a === 'user.update' || a === 'user.delete' || a === 'user.password') return d.replace('->', '→');
  return d || '—';
}
async function loadAudit() {
  var el = document.getElementById('auditList');
  var r = await fetch('/admin/api/audit');
  var d = await r.json();
  if (!d.logs || !d.logs.length) { el.textContent = '暂无记录'; return; }
  el.innerHTML = '<table><thead><tr><th>时间</th><th>操作</th><th>详情</th></tr></thead><tbody>' + d.logs.map(function(l) {
    return '<tr><td>' + esc(new Date(l.ts).toLocaleString('zh-CN')) + '</td>'
      + '<td title="' + esc(l.action) + '">' + esc(auditActionLabel(l.action)) + '</td>'
      + '<td>' + esc(auditDetailText(l)) + '</td></tr>';
  }).join('') + '</tbody></table>';
}

function filterRoutes() {
  const q = document.getElementById('routeSearch').value.toLowerCase();
  document.querySelectorAll('.route-item').forEach(c => {
    c.style.display = (!q || c.dataset.search.includes(q)) ? 'block' : 'none';
  });
}

function openRouteModal() {
  document.getElementById('oldPrefix').value = '';
  document.getElementById('routeRemark').value = '';
  document.getElementById('routePrefix').value = '';
  document.getElementById('routeTarget').value = '';
  document.getElementById('routeCache').checked = true;
  document.getElementById('routeCompat').checked = false;
  document.getElementById('routeRelayMode').value = 'off';
  document.getElementById('routeIpMode').value = 'forward';
  document.getElementById('routeHeaders').value = '';
  document.getElementById('routeIpAllow').value = '';
  document.getElementById('routeIpBlock').value = '';
  document.getElementById('prefixPreview').textContent = 'myemby';
  document.getElementById('routeModalTitle').textContent = '添加路由';
  openModal('modalRoute');
}

function editRoute(prefix) {
  const r = allRoutes.find(x => x.prefix === prefix);
  if (!r) return;
  document.getElementById('oldPrefix').value = r.prefix;
  document.getElementById('routeRemark').value = r.remark || '';
  document.getElementById('routePrefix').value = r.prefix;
  document.getElementById('routeTarget').value = String(r.target || '').split(',').map(function(x) { return x.trim(); }).filter(Boolean).join('\n');
  document.getElementById('routeCache').checked = r.cache_img !== 'off';
  document.getElementById('routeCompat').checked = r.compat_mode === 'on';
  document.getElementById('routeRelayMode').value = (r.use_relay === 'on' || r.use_relay === 'image') ? r.use_relay : 'off';
  document.getElementById('routeIpMode').value = (r.ip_mode === 'strip' || r.ip_mode === 'disable') ? r.ip_mode : 'forward';
  document.getElementById('routeHeaders').value = r.custom_headers || '';
  document.getElementById('routeIpAllow').value = r.ip_allow || '';
  document.getElementById('routeIpBlock').value = r.ip_block || '';
  document.getElementById('prefixPreview').textContent = r.prefix;
  document.getElementById('routeModalTitle').textContent = '编辑路由';
  openModal('modalRoute');
}

async function saveRoute() {
  const oldPrefix = document.getElementById('oldPrefix').value;
  const remark = document.getElementById('routeRemark').value.trim();
  let prefix = document.getElementById('routePrefix').value.trim(); while(prefix.startsWith('/')) prefix = prefix.slice(1); while(prefix.endsWith('/')) prefix = prefix.slice(0,-1);
  const cache_img = document.getElementById('routeCache').checked ? 'on' : 'off';
  const compat_mode = document.getElementById('routeCompat').checked ? 'on' : 'off';
  const use_relay = document.getElementById('routeRelayMode').value || 'off';
  const ip_mode = document.getElementById('routeIpMode').value || 'forward';
  const target = document.getElementById('routeTarget').value.split(/[\r\n,]+/).map(function(s) { return s.trim(); }).filter(Boolean).join(',');

  if (!prefix) { showToast('请输入路径'); return; }
  if (!target) { showToast('请至少填写一个目标地址'); return; }

  document.getElementById('prefixPreview').textContent = prefix || 'myemby';

  const r = await fetch('/admin/api/routes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ oldPrefix, prefix, target, remark, cache_img, compat_mode, ip_mode, use_relay, custom_headers: document.getElementById('routeHeaders').value, ip_allow: document.getElementById('routeIpAllow').value, ip_block: document.getElementById('routeIpBlock').value })
  });
  const d = await r.json();
  if (!r.ok) { showToast(d.error || '保存失败'); return; }
  closeModal('modalRoute');
  showToast('保存成功');
  loadRoutes();
}

async function delRoute(prefix) {
  if (!confirm('确定删除路由 /' + prefix + ' ？')) return;
  await fetch('/admin/api/routes?prefix=' + encodeURIComponent(prefix), { method: 'DELETE' });
  showToast('已删除');
  loadRoutes();
}

async function loadDomains() {
  try {
    const r = await fetch('/admin/api/optimized-domains');
    if (r.status === 401) { location.reload(); return; }
    const d = await r.json();
    if (d.success) {
      allDomains = d.domains;
      renderDomains(allDomains);
    } else {
      document.getElementById('domainList').innerHTML = '<p class="muted">加载失败</p>';
    }
  } catch (e) {
    document.getElementById('domainList').innerHTML = '<p class="muted">加载失败: ' + esc(e.message) + '</p>';
  }
}

function renderDomains(list, speedResults, best) {
  const el = document.getElementById('domainList');
  if (!list.length) {
    el.innerHTML = '<div class="empty-state"><span class="empty-state-icon">🌐</span><p class="empty-state-text">暂无优选域名</p></div>';
    return;
  }
  const speedMap = {};
  if (speedResults) speedResults.forEach(r => { speedMap[r.domain] = r; });
  const sorted = list.slice().sort((a, b) => {
    const sa = speedMap[a.domain], sb = speedMap[b.domain];
    const la = sa && sa.latency >= 0 ? sa.latency : Infinity;
    const lb = sb && sb.latency >= 0 ? sb.latency : Infinity;
    return la - lb;
  });
  let html = '<table><thead><tr><th>名称</th><th>域名</th><th>延迟</th><th>状态</th><th>操作</th></tr></thead><tbody>';
  sorted.forEach(d => {
    const sr = speedMap[d.domain];
    const latency = sr && sr.latency >= 0 ? sr.latency + 'ms' : (sr ? '超时' : '—');
    const pct = sr && sr.latency >= 0 ? Math.max(5, Math.min(100, Math.round(sr.latency / 3))) : 0;
    const statusClass = sr ? (sr.latency >= 0 ? (sr.latency < 100 ? 'tag-fast' : sr.latency < 300 ? 'tag-good' : 'tag-slow') : 'tag-timeout') : '';
    const statusText = sr ? (sr.latency >= 0 ? (sr.latency < 100 ? '极快' : sr.latency < 300 ? '良好' : '较慢') : '超时') : '';
    const isBest = best && best.domain === d.domain;
    html += '<tr' + (isBest ? ' class="best"' : '') + '>' +
      '<td>' + esc(d.name) + (d.isBuiltin ? ' <span class="tag tag-builtin">内置</span>' : '') + (isBest ? ' <span class="tag tag-best">BEST</span>' : '') + '</td>' +
      '<td><code>' + esc(d.domain) + '</code></td>' +
      '<td><div class="lat"><div class="lat-bar"><i style="width:' + pct + '%"></i></div><span>' + latency + '</span></div></td>' +
      '<td>' + (statusText ? '<span class="tag ' + statusClass + '">' + statusText + '</span>' : '—') + '</td>' +
      '<td>' + (!d.isBuiltin ? '<button class="btn btn-sm" onclick="editDomain(' + d.id + ')">编辑</button> <button class="btn btn-sm btn-danger" onclick="delDomain(' + d.id + ')">删除</button>' : '') + '</td>' +
    '</tr>';
  });
  html += '</tbody></table>';
  el.innerHTML = html;
}

function openDomainModal() {
  document.getElementById('domainId').value = '';
  document.getElementById('domainName').value = '';
  document.getElementById('domainUrl').value = '';
  document.getElementById('domainModalTitle').textContent = '添加优选域名';
  openModal('modalDomain');
}

function editDomain(id) {
  const d = allDomains.find(x => x.id === id);
  if (!d) return;
  document.getElementById('domainId').value = d.id;
  document.getElementById('domainName').value = d.name;
  document.getElementById('domainUrl').value = 'https://' + d.domain;
  document.getElementById('domainModalTitle').textContent = '编辑优选域名';
  openModal('modalDomain');
}

async function saveDomain() {
  const id = document.getElementById('domainId').value;
  const name = document.getElementById('domainName').value.trim();
  const url = document.getElementById('domainUrl').value.trim();

  if (!name) { showToast('请输入名称'); return; }
  if (!url) { showToast('请输入域名'); return; }

  let domain = url.replace('https://', '').replace('http://', '').split('/')[0];

  let method = 'POST';
  let endpoint = '/admin/api/optimized-domains';
  if (id) {
    method = 'PUT';
    endpoint = '/admin/api/optimized-domains/' + id;
  }

  const r = await fetch(endpoint, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domain, name })
  });
  const d = await r.json();
  if (!d.success) { showToast(d.error || '保存失败'); return; }
  closeModal('modalDomain');
  showToast('保存成功');
  loadDomains();
}

async function delDomain(id) {
  if (!confirm('确定删除此优选域名？')) return;
  const r = await fetch('/admin/api/optimized-domains/' + id, { method: 'DELETE' });
  const d = await r.json();
  if (d.success) {
    showToast('已删除');
    loadDomains();
  } else {
    showToast('删除失败');
  }
}



async function testDomains() {
  var st = document.getElementById('domain-status');
  if (st) st.textContent = '在本机浏览器测速中...';
  const rows = await speedTestDomains(allDomains, function(d, n) { if (st) st.textContent = '测速中 ' + d + '/' + n; });
  const best = rows.find(function(r) { return r.latency >= 0; }) || null;
  bestDomain = best;
  if (st) st.textContent = best ? '最优: ' + best.domain + '（' + best.latency + 'ms，本机测得）' : '无可用域名';
  renderDomains(allDomains, rows, best);
}

var quickDns = null;

async function loadQuickDNS() {
  var meta = document.getElementById('dnsQuickMeta');
  if (meta) meta.textContent = 'DNS 记录加载中...';
  try {
    const r = await fetch('/admin/api/dns-config');
    if (r.status === 401) { location.reload(); return; }
    const d = await r.json();
    if (!d.success) throw new Error('加载失败');
    quickDns = d;
    const rec = d.liveRecord;
    const nameEl = document.getElementById('dnsQuickName');
    const targetEl = document.getElementById('dnsQuickTarget');
    if (rec) {
      var full = rec.name || '';
      var root = d.baseDomain || '';
      var short = (root && full.endsWith('.' + root)) ? full.slice(0, full.length - root.length - 1) : full;
      nameEl.value = short;
      targetEl.value = rec.content || '';
      meta.textContent = '✅ [' + rec.type + '] ' + rec.name + ' → ' + rec.content + (rec.proxied ? '（已代理）' : '（仅 DNS）') + (rec.modifiedOn ? ' · ' + rec.modifiedOn : '');
    } else {
      nameEl.value = d.resolvedName || '';
      targetEl.value = (d.config && d.config.currentDomain) || '';
      meta.textContent = (d.zonesError ? '⚠️ ' + d.zonesError : '未在 Cloudflare 找到该记录，填写目标后点保存即可创建');
    }
  } catch (e) {
    if (meta) meta.textContent = 'DNS 加载失败: ' + (e.message || e);
  }
}

async function quickSaveDNS(btn) {
  const dnsName = document.getElementById('dnsQuickName').value.trim();
  const targetDomain = document.getElementById('dnsQuickTarget').value.trim();
  if (!targetDomain) { showToast('请输入目标域名或 IP'); return; }
  btn.disabled = true; btn.textContent = '保存中...';
  try {
    const r = await fetch('/admin/api/dns/replace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zoneId: (quickDns && quickDns.zoneId) || '', dnsName: dnsName, targetDomain: targetDomain })
    });
    const d = await r.json();
    if (d.success) {
      const rec = d.result || {};
      showToast('✅ [' + (rec.type || 'CNAME') + '] ' + (rec.name || dnsName) + ' → ' + (rec.content || targetDomain));
      loadQuickDNS();
    } else {
      showToast('❌ ' + (d.error || d.errors?.[0]?.message || '保存失败'));
    }
  } catch (e) {
    showToast('❌ 请求失败: ' + e.message);
  }
  btn.disabled = false; btn.textContent = '保存';
}

async function sendReport(btn) {
  if (btn) { btn.disabled = true; btn.textContent = '发送中...'; }
  try {
    const r = await fetch('/admin/api/report/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const d = await r.json().catch(function() { return {}; });
    if (d.success) {
      showToast('✅ 日报已发送' + (d.webhook && d.webhook.ok ? '（Telegram + Webhook）' : '（Telegram）'));
    } else {
      showToast('❌ ' + (d.hint || (d.telegram && d.telegram.error) || '发送失败'), 9000);
      loadAudit();
    }
  } catch (e) {
    showToast('❌ 发送失败: ' + e.message);
  }
  if (btn) { btn.disabled = false; btn.textContent = '发送日报'; }
}

async function loadRelay() {
  try {
    const r = await fetch('/admin/api/relay');
    if (r.status === 401) { location.reload(); return; }
    const d = await r.json();
    const c = (d && d.config) || {};
    document.getElementById('relayUrl').value = c.relayUrl || '';
    document.getElementById('relaySecret').placeholder = c.hasSecret ? '已设置（留空保持不变）' : '首次填 VPS 引导密钥';
    document.getElementById('relayPortHint').textContent = c.port || 2087;
    document.getElementById('relayEnabled').checked = !!c.enabled;
    const chip = document.getElementById('relayChip');
    chip.textContent = c.enabled ? 'ON' : 'OFF';
    chip.style.background = c.enabled ? 'var(--ok-dim)' : 'var(--surface-2)';
    chip.style.color = c.enabled ? 'var(--ok)' : 'var(--text-faint)';
  } catch (e) {}
}

async function saveRelay(btn) {
  const url = document.getElementById('relayUrl').value.trim();
  const secret = document.getElementById('relaySecret').value.trim();
  const enabled = document.getElementById('relayEnabled').checked ? 'on' : 'off';
  const certPem = document.getElementById('relayCert').value.trim();
  const keyPem = document.getElementById('relayKey').value.trim();
  if (!url) { showToast('请填写中继地址（含端口）'); return; }
  if (btn) { btn.disabled = true; btn.textContent = '下发中...'; }
  try {
    const r = await fetch('/admin/api/relay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ relayUrl: url, secret, enabled, certPem, keyPem, pushToVps: true })
    });
    const d = await r.json();
    if (!r.ok || d.error) { showToast(d.error || '保存失败'); return; }
    if (d.vpsStatus > 0 && d.vpsStatus < 300) {
      showToast('✅ 已保存并下发到 VPS');
    } else if (d.vpsStatus >= 300 || d.vpsError) {
      showToast('⚠️ 已保存，但 VPS 下发失败: ' + (d.vpsStatus || d.vpsError), 9000);
    } else {
      showToast('✅ 已保存（未推送 VPS）');
    }
    document.getElementById('relaySecret').value = '';
    document.getElementById('relayCert').value = '';
    document.getElementById('relayKey').value = '';
    loadRelay();
  } catch (e) {
    showToast('请求失败: ' + e.message);
  }
  if (btn) { btn.disabled = false; btn.textContent = '保存并下发到 VPS'; }
}

async function testRelay(btn) {
  const st = document.getElementById('relayStatus');
  if (btn) { btn.disabled = true; }
  if (st) st.textContent = '测试中...';
  try {
    const r = await fetch('/admin/api/relay/test', { method: 'POST' });
    const d = await r.json();
    if (d.ok) {
      st.textContent = '✅ 连通 ' + d.ms + 'ms · ' + (d.version || '') + (d.tls ? ' (HTTPS)' : ' (HTTP 无证书)');
    } else {
      st.textContent = '❌ ' + (d.error || ('HTTP ' + d.status));
    }
  } catch (e) {
    if (st) st.textContent = '❌ ' + e.message;
  }
  if (btn) { btn.disabled = false; }
}

function fmtBytes(n) {
  n = Number(n) || 0;
  if (n >= 1073741824) return (n / 1073741824).toFixed(2) + ' GB';
  if (n >= 1048576) return (n / 1048576).toFixed(1) + ' MB';
  if (n >= 1024) return (n / 1024).toFixed(1) + ' KB';
  return n + ' B';
}

async function loadRelayStats() {
  const el = document.getElementById('relayStats');
  if (!el) return;
  try {
    const r = await fetch('/admin/api/relay/stats');
    const d = await r.json();
    if (!d.ok) { el.innerHTML = '<div class="rs-meta">📊 中继流量：暂不可读（' + esc(d.error || '未配置') + '）· 点击重试</div>'; return; }
    const t = d.today || {}, tot = d.total || {};
    const tile = function(label, val) { return '<div class="rs-tile"><span>' + label + '</span><b>' + val + '</b></div>'; };
    let s = '<div class="rs-row">'
      + tile('今日请求', t.req || 0)
      + tile('今日流量', '↑' + fmtBytes(t.up_bytes) + ' ↓' + fmtBytes(t.down_bytes))
      + tile('累计请求', tot.req || 0)
      + tile('累计流量', '↑' + fmtBytes(tot.up_bytes) + ' ↓' + fmtBytes(tot.down_bytes))
      + '</div>'
      + '<div class="rs-meta">运行 ' + Math.round((d.uptime_s || 0) / 360) / 10 + 'h · 上海时区 ' + (d.date || '') + ' · 点击刷新</div>';
    el.innerHTML = s;
  } catch (e) { el.innerHTML = '<div class="rs-meta">📊 中继流量：读取失败 ' + esc(e.message) + '</div>'; }
}
document.getElementById('relayStats').addEventListener('click', loadRelayStats);
setInterval(loadRelayStats, 60000);

document.getElementById('routePrefix').addEventListener('input', function() {
  document.getElementById('prefixPreview').textContent = this.value.trim() || 'myemby';
});

// ---- Tab 引擎：切换 / 懒加载 / 记忆 / hash 同步 ----
var TAB_NAMES = ['overview', 'routes', 'domains', 'logs'];
var TAB_LOADED = {};
function switchTab(name) {
  if (TAB_NAMES.indexOf(name) < 0) name = 'overview';
  for (var i = 0; i < TAB_NAMES.length; i++) {
    var p = document.getElementById('tab-' + TAB_NAMES[i]);
    if (p) p.style.display = TAB_NAMES[i] === name ? 'block' : 'none';
  }
  var btns = document.querySelectorAll('.tab-btn');
  for (var j = 0; j < btns.length; j++) {
    var on = btns[j].getAttribute('data-tab') === name;
    if (on) btns[j].classList.add('active'); else btns[j].classList.remove('active');
  }
  try { localStorage.setItem('adminTab', name); } catch (e) {}
  if (location.hash !== '#' + name) {
    try { history.replaceState(null, '', '#' + name); } catch (e) {}
  }
  if (!TAB_LOADED[name]) { TAB_LOADED[name] = true; loadTabData(name); }
}
function loadTabData(name) {
  if (name === 'overview') { loadStats(); loadEdge(); loadRelayStatsCard(); }
  else if (name === 'routes') { loadRoutes(); loadQuickDNS(); loadRelay(); loadRelayStats(); }
  else if (name === 'domains') { loadDomains(); }
  else if (name === 'logs') { loadAudit(); }
}
window.addEventListener('hashchange', function() {
  var h = (location.hash || '').replace('#', '');
  if (TAB_NAMES.indexOf(h) >= 0) switchTab(h);
});

// ---- 数据加载（概览页：统计 / 边缘节点 / 中继汇总卡）----
async function loadEdge() {
  try {
    const r = await fetch('/api/edge-info');
    const d = await r.json();
    document.getElementById('edge-loading').style.display = 'none';
    const box = document.getElementById('edge-info');
    box.style.display = 'grid';
    box.innerHTML = [
      ['客户端 IP', d.clientIp],
      ['接入 POP', d.entryColo],
      ['国家/地区', d.entryCountry + (d.entryCity ? ' / '+d.entryCity : '')],
      ['边缘出口 IP', d.edgeIp],
      ['落地 COLO', d.egressColo]
    ].map(function(kv){ return '<div class="edge-item"><strong>'+kv[0]+'</strong><span>'+(kv[1]||'—')+'</span></div>'; }).join('');
  } catch(e) { document.getElementById('edge-loading').textContent = '加载失败'; }
}

async function loadRelayStatsCard() {
  const reqEl = document.getElementById('st-relay-req');
  const txEl = document.getElementById('st-relay-traffic');
  if (!reqEl || !txEl) return;
  try {
    const r = await fetch('/admin/api/relay/stats');
    const d = await r.json();
    if (!d.ok) {
      reqEl.textContent = '—';
      document.getElementById('st-relay-req-sub').textContent = '来源: VPS 中继（' + (d.error || '不可读') + '）';
      return;
    }
    const t = d.today || {};
    reqEl.textContent = t.req || 0;
    document.getElementById('st-relay-req-sub').textContent = '来源: VPS 中继 · 上海时区 ' + (d.date || '');
    txEl.textContent = '↑' + fmtBytes(t.up_bytes) + ' ↓' + fmtBytes(t.down_bytes);
    document.getElementById('st-relay-traffic-sub').textContent = '↑源站拉取 ↓发回客户端 · 上海时区 ' + (d.date || '');
  } catch (e) {
    reqEl.textContent = '—';
    document.getElementById('st-relay-req-sub').textContent = '来源: VPS 中继（读取失败）';
  }
}

async function loadStats() {
  try {
    const r = await fetch('/stats');
    const d = await r.json();
    if (d.error) { document.getElementById('stats-loading').textContent = d.error; return; }
    document.getElementById('stats-loading').style.display = 'none';
    document.getElementById('stats-body').style.display = 'block';
    document.getElementById('st-req').textContent = d.data.todayRequests ?? 0;
    // v6.4.8：D1 统计已停写，请求数/流量统一来自 CF Zone 分析
    document.getElementById('st-req-sub').textContent = '来源: CF Zone 分析' + (d.data.cfError ? '（不可用）' : '');
    document.getElementById('st-traffic').textContent = d.data.todayTraffic || '0 B';
    document.getElementById('st-traffic-sub').textContent = '来源: CF edgeResponseBytes' + (d.data.cfError ? '（不可用）' : '');
    document.getElementById('st-uv').textContent = d.data.todayVisits ?? 0;
    document.getElementById('st-uv-sub').textContent = '来源: CF 独立访问';
    const cfInfo = d.data.cfStatus || '';
    const envInfo = d.data.envInfo || {};
    document.getElementById('st-updated').textContent = '更新时间 ' + (d.data.lastUpdated||'') + ' · ' + cfInfo
      + (envInfo.statsHost ? ' · 统计域名 ' + envInfo.statsHost : '')
      + (envInfo.zoneId ? ' · Zone ' + envInfo.zoneId.slice(0, 8) + '…' : '')
      + (d.data.cfError ? ' (' + d.data.cfError + ')' : '');
    const hourly = d.data.hourlySeries || [];
    if (hourly.length) {
      const max = Math.max(1, ...hourly.map(h=>h.total));
      let hhtml = '<div class="chart">';
      hourly.forEach(h=>{
        const ht = Math.max(2, Math.round((h.total/max)*68));
        const label = h.label || '';
        hhtml += '<div class="chart-col" title="'+label+' · '+h.total+' 次"><i style="height:'+ht+'px"></i><b>'+label.slice(0,2)+'</b></div>';
      });
      hhtml += '</div><p class="muted" style="font-size:11px;margin-top:6px">今日 24 小时请求分布（上海时区）</p>';
      document.getElementById('hourly-chart').innerHTML = hhtml;
    }
  } catch(e) { document.getElementById('stats-loading').textContent = '统计加载失败'; }
}

(function initTabs() {
  var h = (location.hash || '').replace('#', '');
  if (TAB_NAMES.indexOf(h) < 0) { try { h = localStorage.getItem('adminTab') || ''; } catch (e) {} }
  if (TAB_NAMES.indexOf(h) < 0) h = 'overview';
  switchTab(h);
})();
setInterval(loadRelayStatsCard, 60000);
