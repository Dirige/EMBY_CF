var IS_ADMIN = window.__EMBY_PAGE__.isAdmin;
var USERNAME = window.__EMBY_PAGE__.username;
var ROUTE_API = IS_ADMIN ? '/admin/api/routes' : '/api/user/routes';
var allRoutes = [];
var allDomains = [];
var allUsers = [];
var allInvites = [];
var bestDomain = null;
var quickDns = null;

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

async function logout() {
  try { await fetch('/api/logout', { method: 'POST' }); } catch (e) {}
  location.href = '/admin';
}

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

// ===== 路由（管理员=全局路由；普通用户=自己的路由）=====
async function loadRoutes() {
  try {
    const r = await fetch(ROUTE_API);
    if (r.status === 401) { location.href = '/admin'; return; }
    const d = await r.json();
    allRoutes = Array.isArray(d) ? d : [];
    renderRoutes(allRoutes);
  } catch (e) {
    document.getElementById('routeList').innerHTML = '<p class="muted">加载失败: ' + esc(e.message) + '</p>';
  }
}

function renderRoutes(list) {
  const el = document.getElementById('routeList');
  var countChip = document.getElementById('routeCount');
  if (countChip) countChip.textContent = list.length + ' 条';
  if (!list.length) {
    el.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><span class="empty-state-icon">📦</span><p class="empty-state-text">暂无路由，点击上方按钮添加</p></div>';
    return;
  }
  el.innerHTML = list.map(function(r, ri) {
    const targets = String(r.target || '').split(',').map(function(s) { return s.trim(); }).filter(Boolean);
    const remarkName = r.remark || '未命名';
    const cacheStatus = r.cache_img !== 'off';
    const compatStatus = r.compat_mode === 'on';
    let targetsHtml = '';
    targets.forEach(function(t, idx) {
      const tag = idx === 0 ? '<span style="color:var(--ok);font-weight:700">[主]</span>' : '<span style="color:var(--warn);font-weight:700">[备' + idx + ']</span>';
      targetsHtml += '<div class="target-row">' + tag + ' <span class="target-url"><code>' + esc(t) + '</code></span></div>';
    });
    const disabled = r.enabled === 0;
    const isLegacy = r.source === 'legacy';
    const srcAttr = isLegacy ? ' data-source="legacy"' : '';
    return '<div class="route-item" style="' + (disabled ? 'opacity:.55' : '') + '" data-search="' + esc((remarkName + ' ' + r.prefix).toLowerCase()) + '">' +
      '<div class="route-header"><div class="route-title">' +
        '<h3 class="route-name">' + esc(remarkName) + '</h3>' +
        '<span class="route-path">/' + esc(r.prefix) + '</span>' +
      '</div></div>' +
      '<div class="target-list">' + targetsHtml + '</div>' +
      '<div class="route-meta">' +
        (disabled ? '<span class="meta-tag" style="color:var(--warn);border-color:var(--warn-dim)">⏸ 已停用</span>' : '') +
        (isLegacy ? '<span class="meta-tag" style="color:var(--info);border-color:var(--info-dim)">📜 历史路由</span>' : '') +
        (r.down_count ? '<span class="meta-tag" style="color:var(--warn);border-color:var(--warn-dim)">🔴 ' + r.down_count + ' 条线路异常</span>' : '') +
        (cacheStatus ? '<span class="meta-tag">🖼️ 缓存开启</span>' : '<span class="meta-tag">缓存关闭</span>') +
        (compatStatus ? '<span class="meta-tag" style="color:var(--warn);border-color:var(--warn-dim)">🔧 兼容模式</span>' : '') +
        (r.ip_mode === 'strip' ? '<span class="meta-tag" style="color:var(--info);border-color:var(--info-dim)">🛡️ IP不透传</span>' : '') +
        (r.ip_mode === 'disable' ? '<span class="meta-tag" style="color:var(--ok);border-color:var(--ok-dim)">🛡️ IP彻底隐藏</span>' : '') +
        (r.today_req ? '<span class="meta-tag">📊 今日 ' + r.today_req + ' 次 / ' + fmtB(r.today_bytes) + '（历史）</span>' : '') +
        (r.last_play ? '<span class="meta-tag">📺 最近播放 ' + esc(String(r.last_play).slice(5, 16)) + '</span>' : '') +
      '</div>' +
      '<div class="route-actions">' +
        '<button class="btn btn-sm" data-act="up" data-prefix="' + esc(r.prefix) + '"' + srcAttr + (ri === 0 ? ' disabled' : '') + '>↑</button>' +
        '<button class="btn btn-sm" data-act="down" data-prefix="' + esc(r.prefix) + '"' + srcAttr + (ri === list.length - 1 ? ' disabled' : '') + '>↓</button>' +
        '<button class="btn btn-sm" data-act="test" data-prefix="' + esc(r.prefix) + '"' + srcAttr + '>测试</button>' +
        '<button class="btn btn-sm" data-act="toggle" data-prefix="' + esc(r.prefix) + '"' + srcAttr + ' data-enabled="' + (disabled ? '1' : '0') + '">' + (disabled ? '启用' : '停用') + '</button>' +
        '<button class="btn btn-sm" data-act="edit" data-prefix="' + esc(r.prefix) + '"' + srcAttr + ' data-id="' + esc(r.id || '') + '">编辑</button>' +
        '<button class="btn btn-sm btn-danger" data-act="del" data-prefix="' + esc(r.prefix) + '"' + srcAttr + '>删除</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

document.getElementById('routeList').addEventListener('click', function(ev) {
  var btn = ev.target.closest('button[data-act]');
  if (!btn) return;
  var a = btn.dataset.act, pf = btn.dataset.prefix, src = btn.dataset.source || '';
  if (a === 'edit') editRoute(pf);
  else if (a === 'del') delRoute(pf, src);
  else if (a === 'toggle') toggleRoute(pf, btn.dataset.enabled === '1', src);
  else if (a === 'test') testRoute(pf, btn, src);
  else if (a === 'up') moveRoute(pf, -1);
  else if (a === 'down') moveRoute(pf, 1);
});

async function toggleRoute(prefix, enable, source) {
  const x = await postJson(ROUTE_API + '/toggle', { prefix: prefix, enabled: enable, source: source || '' });
  showToast(x.ok ? (enable ? '已启用' : '已停用') : (x.data.error || '操作失败'));
  loadRoutes();
}

async function moveRoute(prefix, dir) {
  const order = allRoutes.map(function(r) { return r.prefix; });
  const i = order.indexOf(prefix), j = i + dir;
  if (i < 0 || j < 0 || j >= order.length) return;
  order.splice(j, 0, order.splice(i, 1)[0]);
  await postJson(ROUTE_API + '/reorder', { order: order });
  loadRoutes();
}

async function testRoute(prefix, btn, source) {
  btn.disabled = true; btn.textContent = '测试中';
  const x = await postJson(ROUTE_API + '/test', { prefix: prefix, source: source || '' });
  btn.disabled = false; btn.textContent = '测试';
  if (!x.ok) { showToast(x.data.error || '测试失败'); return; }
  showToast(x.data.results.map(function(r, i) {
    return (i === 0 ? '主' : '备' + i) + ' ' + (r.ok ? r.ms + 'ms' : '失败');
  }).join('  |  '));
}

function filterRoutes() {
  const q = document.getElementById('routeSearch').value.toLowerCase();
  document.querySelectorAll('.route-item').forEach(function(c) {
    c.style.display = (!q || c.dataset.search.indexOf(q) >= 0) ? 'block' : 'none';
  });
}

function openRouteModal() {
  document.getElementById('oldPrefix').value = '';
  document.getElementById('routeSource').value = '';
  document.getElementById('routeId').value = '';
  document.getElementById('routeRemark').value = '';
  document.getElementById('routePrefix').value = '';
  document.getElementById('routeTarget').value = '';
  document.getElementById('routeStreamTarget').value = '';
  document.getElementById('routeCache').checked = true;
  document.getElementById('routeCompat').checked = false;
  document.getElementById('routeIpMode').value = 'forward';
  document.getElementById('routeHeaders').value = '';
  document.getElementById('routeIpAllow').value = '';
  document.getElementById('routeIpBlock').value = '';
  document.getElementById('prefixPreview').textContent = 'myemby';
  document.getElementById('routeModalTitle').textContent = '添加路由';
  openModal('modalRoute');
}

function editRoute(prefix) {
  const r = allRoutes.find(function(x) { return x.prefix === prefix; });
  if (!r) return;
  document.getElementById('oldPrefix').value = r.prefix;
  document.getElementById('routeSource').value = r.source === 'legacy' ? 'legacy' : '';
  document.getElementById('routeId').value = r.id || '';
  document.getElementById('routeRemark').value = r.remark || '';
  document.getElementById('routePrefix').value = r.prefix;
  document.getElementById('routeTarget').value = String(r.target || '').split(',').map(function(x) { return x.trim(); }).filter(Boolean).join('\n');
  document.getElementById('routeCache').checked = r.cache_img !== 'off';
  document.getElementById('routeStreamTarget').value = String(r.stream_target || '').split(',').map(function(x) { return x.trim(); }).filter(Boolean).join('\n');
  document.getElementById('routeCompat').checked = r.compat_mode === 'on';
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
  let prefix = document.getElementById('routePrefix').value.trim();
  while (prefix.startsWith('/')) prefix = prefix.slice(1);
  while (prefix.endsWith('/')) prefix = prefix.slice(0, -1);
  const target = document.getElementById('routeTarget').value.split(/[\r\n,]+/).map(function(s) { return s.trim(); }).filter(Boolean).join(',');
  if (!prefix) { showToast('请输入路径'); return; }
  if (!target) { showToast('请至少填写一个目标地址'); return; }

  const r = await fetch(ROUTE_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      oldPrefix: oldPrefix, prefix: prefix, target: target, remark: remark,
      source: document.getElementById('routeSource').value || '',
      routeId: document.getElementById('routeId').value || '',
      stream_target: document.getElementById('routeStreamTarget').value.split(/[\r\n,]+/).map(function(s) { return s.trim(); }).filter(Boolean).join(','),
      cache_img: document.getElementById('routeCache').checked ? 'on' : 'off',
      compat_mode: document.getElementById('routeCompat').checked ? 'on' : 'off',
      ip_mode: document.getElementById('routeIpMode').value || 'forward',
      custom_headers: document.getElementById('routeHeaders').value,
      ip_allow: document.getElementById('routeIpAllow').value,
      ip_block: document.getElementById('routeIpBlock').value
    })
  });
  const d = await r.json();
  if (!r.ok) { showToast(d.error || '保存失败'); return; }
  closeModal('modalRoute');
  showToast('保存成功');
  loadRoutes();
  if (!IS_ADMIN) loadUserEntry();
}

async function delRoute(prefix, source) {
  if (!confirm('确定删除路由 /' + prefix + ' ？')) return;
  await fetch(ROUTE_API + '?prefix=' + encodeURIComponent(prefix) + (source ? '&source=' + encodeURIComponent(source) : ''), { method: 'DELETE' });
  showToast('已删除');
  loadRoutes();
  if (!IS_ADMIN) loadUserEntry();
}

// ===== 统计 =====
async function loadStats() {
  try {
    const r = await fetch(IS_ADMIN ? '/admin/api/stats' : '/api/user/stats');
    if (r.status === 401) { location.href = '/admin'; return; }
    const d = await r.json();
    if (d.error) { document.getElementById('stats-loading').textContent = d.error; return; }
    document.getElementById('stats-loading').style.display = 'none';
    document.getElementById('stats-body').style.display = 'block';
    const data = d.data || {};
    const isUserScope = data.scope === 'user';
    const src = data.statsSource || 'unavailable';
    const srcLabel = src === 'account' ? 'CF 账号分析（整个域名）' : (src === 'zone' ? 'CF Zone Analytics（仅主域名）' : 'CF 数据不可用');
    document.getElementById('st-req').textContent = data.todayRequests == null ? '—' : data.todayRequests;
    document.getElementById('st-req-sub').textContent = '来源: ' + (isUserScope ? (src === 'account' ? 'CF 账号分析（我的域名）' : srcLabel) : srcLabel);
    document.getElementById('st-traffic').textContent = data.todayTraffic || '—';
    document.getElementById('st-traffic-sub').textContent = '来源: ' + (isUserScope ? (src === 'account' ? '真实出站流量（CF 账号分析·我的域名）' : 'CF 数据不可用') : (src === 'account' ? '真实出站流量（CF 账号分析·整个域名）' : (src === 'zone' ? 'CF edgeResponseBytes（仅主域名）' : 'CF 数据不可用')));
    document.getElementById('st-uv').textContent = data.todayVisits == null ? '—' : data.todayVisits;
    document.getElementById('st-uv-sub').textContent = isUserScope ? '用户维度不统计独立访问' : '来源: CF 独立访问（全站）';
    var chip = document.getElementById('statsChip');
    if (chip) chip.textContent = data.cfStatus || (isUserScope ? 'CF' : 'STATS');
    const envInfo = data.envInfo || {};
    document.getElementById('st-updated').textContent = '更新时间 ' + (data.lastUpdated || '')
      + ' · ' + (data.cfStatus || '')
      + (envInfo.statsHost ? ' · 统计域名 ' + envInfo.statsHost : '')
      + (data.cfError ? ' (' + data.cfError + ')' : '');
    const hourly = data.hourlySeries || [];
    if (hourly.length) {
      const max = Math.max(1, Math.max.apply(null, hourly.map(function(h) { return h.total; })));
      let hhtml = '<div class="chart">';
      hourly.forEach(function(h) {
        const ht = Math.max(2, Math.round((h.total / max) * 68));
        const label = h.label || '';
        hhtml += '<div class="chart-col" title="' + label + ' · ' + h.total + ' 次"><i style="height:' + ht + 'px"></i><b>' + label.slice(0, 2) + '</b></div>';
      });
      hhtml += '</div><p class="muted" style="font-size:11px;margin-top:6px">今日 24 小时请求分布（上海时区）</p>';
      document.getElementById('hourly-chart').innerHTML = hhtml;
    }
  } catch (e) {
    const el = document.getElementById('stats-loading');
    if (el) el.textContent = '统计加载失败';
  }
}

// ===== 用户中心 =====
async function loadUserEntry() {
  if (IS_ADMIN) return;
  try {
    const results = await Promise.all([fetch('/api/user/me'), fetch('/api/user/dns')]);
    const me = await results[0].json();
    let dns = {};
    try { dns = await results[1].json(); } catch (e) {}
    document.getElementById('entryUser').textContent = me.user ? me.user.username : USERNAME;
    document.getElementById('entryHost').textContent = me.entryHost || '未配置';
    document.getElementById('entryRoutes').textContent = (me.routeCount || 0) + ' / ' + (me.routeLimit || 0) + ' 条';
    const entryUrl = document.getElementById('entryUrl');
    if (me.entryUrl) {
      entryUrl.href = me.entryUrl;
      entryUrl.textContent = '打开 ' + me.entryHost;
    } else {
      entryUrl.href = '#';
      entryUrl.textContent = '打开入口';
    }
    const hint = document.getElementById('entryHint');
    if (hint) hint.textContent = me.workerRouteHint || '';
    const limitHint = document.getElementById('routeLimitHint');
    if (limitHint) limitHint.textContent = '已用 ' + (me.routeCount || 0) + ' / ' + (me.routeLimit || 0) + ' 条路由';
    const dnsEl = document.getElementById('entryDns');
    if (dns.record) {
      dnsEl.textContent = '[' + dns.record.type + '] ' + dns.record.content + (dns.record.proxied ? '（已代理）' : '（小黄云关闭）');
    } else if (dns.zoneError) {
      dnsEl.textContent = '⚠️ ' + dns.zoneError;
    } else {
      dnsEl.textContent = '尚未创建';
    }
    const dnsInput = document.getElementById('entryDnsValue');
    if (dnsInput) dnsInput.value = dns.record ? dns.record.content : (dns.defaultTarget || 'youxuan.cf.090227.xyz');
  } catch (e) {
    const el = document.getElementById('entryHost');
    if (el) el.textContent = '加载失败';
  }
}

async function saveUserDNS(btn) {
  const input = document.getElementById('entryDnsValue');
  const target = input ? input.value.trim() : '';
  if (!target) { showToast('请输入 IP 或域名'); return; }
  if (btn) { btn.disabled = true; btn.textContent = '保存中...'; }
  try {
    const r = await fetch('/api/user/dns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target }) });
    const d = await r.json().catch(function() { return {}; });
    if (r.ok && d.ok) {
      showToast('✅ ' + (d.type || 'CNAME') + ' ' + d.entryHost + ' → ' + d.target + '（小黄云关闭）', 5000);
      loadUserEntry();
    } else {
      showToast('❌ ' + (d.error || '保存失败'), 7000);
    }
  } catch (e) {
    showToast('❌ 请求失败: ' + e.message);
  }
  if (btn) { btn.disabled = false; btn.textContent = '保存 DNS 值'; }
}

async function ensureUserDNS(btn) {
  if (btn) { btn.disabled = true; btn.textContent = '创建中...'; }
  try {
    const r = await fetch('/api/user/dns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const d = await r.json();
    if (d.ok) {
      showToast('✅ ' + (d.type || 'CNAME') + ' ' + d.entryHost + ' → ' + d.target + '（小黄云关闭）', 5000);
      loadUserEntry();
    } else {
      showToast('❌ ' + (d.error || '创建失败'), 7000);
    }
  } catch (e) {
    showToast('❌ 请求失败: ' + e.message);
  }
  if (btn) { btn.disabled = false; btn.textContent = '重新创建 DNS'; }
}

async function changePassword() {
  ['currentPassword', 'newPassword', 'confirmPassword'].forEach(id => { document.getElementById(id).value = ''; });
  openModal('modalPassword');
}

// ===== 管理员：用户 / 邀请码 =====
async function loadUsers() {
  if (!IS_ADMIN) return;
  try {
    const r = await fetch('/admin/api/users');
    const d = await r.json();
    allUsers = d.users || [];
    renderUsers(allUsers);
  } catch (e) {
    document.getElementById('userList').textContent = '加载失败: ' + e.message;
  }
}

function renderUsers(list) {
  const el = document.getElementById('userList');
  const chip = document.getElementById('userCount');
  if (chip) chip.textContent = list.length + ' 人';
  if (!list.length) { el.innerHTML = '<p class="muted">暂无用户，点上方按钮创建</p>'; return; }
  let html = '<div style="overflow-x:auto"><table><thead><tr><th>用户名</th><th>子域名</th><th>角色</th><th>状态</th><th>路由</th><th>最近登录</th><th>操作</th></tr></thead><tbody>';
  list.forEach(function(u) {
    const disabled = u.status === 'disabled';
    html += '<tr' + (disabled ? ' style="opacity:.55"' : '') + '>' +
      '<td><code>' + esc(u.username) + '</code></td>' +
      '<td><code>' + esc(u.subdomain || '—') + '</code></td>' +
      '<td>' + (u.role === 'admin' ? '管理员' : '普通用户') + '</td>' +
      '<td>' + (disabled ? '<span style="color:var(--warn)">禁用</span>' : '<span style="color:var(--ok)">正常</span>') + '</td>' +
      '<td>' + (u.routeCount || 0) + ' / ' + (u.routeLimit || 0) + '</td>' +
      '<td style="white-space:nowrap">' + (u.lastLogin ? esc(String(u.lastLogin).replace('T', ' ').slice(0, 16)) + ' UTC' : '<span class="muted">从未登录</span>') + '</td>' +
      '<td style="white-space:nowrap">' +
        '<button class="btn btn-sm" onclick="editUser(' + u.id + ')">编辑</button> ' +
        '<button class="btn btn-sm" onclick="toggleUser(' + u.id + ',' + (disabled ? 'true' : 'false') + ')">' + (disabled ? '启用' : '禁用') + '</button> ' +
        '<button class="btn btn-sm btn-danger" onclick="delUser(' + u.id + ')">删除</button>' +
      '</td></tr>';
  });
  html += '</tbody></table></div>';
  el.innerHTML = html;
}

function openUserModal(id) {
  const u = id ? allUsers.find(function(x) { return x.id === id; }) : null;
  document.getElementById('userId').value = u ? u.id : '';
  document.getElementById('userUsername').value = u ? u.username : '';
  document.getElementById('userUsername').disabled = Boolean(u);
  document.getElementById('userPassword').value = '';
  document.getElementById('userPassword').placeholder = u ? '留空表示不修改密码' : '至少 6 位';
  document.getElementById('userSubdomain').value = u ? (u.subdomain || '') : '';
  document.getElementById('userRole').value = u ? (u.role || 'user') : 'user';
  document.getElementById('userStatus').value = u ? (u.status || 'active') : 'active';
  document.getElementById('userRouteLimit').value = u ? (u.routeLimit || 20) : 20;
  document.getElementById('userModalTitle').textContent = u ? '编辑用户' : '添加用户';
  openModal('modalUser');
}

function editUser(id) { openUserModal(id); }

async function saveUser() {
  const id = document.getElementById('userId').value;
  const data = {
    username: document.getElementById('userUsername').value.trim(),
    password: document.getElementById('userPassword').value,
    subdomain: document.getElementById('userSubdomain').value.trim(),
    role: document.getElementById('userRole').value,
    status: document.getElementById('userStatus').value,
    route_limit: document.getElementById('userRouteLimit').value
  };
  if (!data.username) { showToast('请输入用户名'); return; }
  if (!id && !data.password) { showToast('请输入密码'); return; }
  const r = await fetch(id ? '/admin/api/users/' + id : '/admin/api/users', {
    method: id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  const d = await r.json();
  if (!r.ok) { showToast(d.error || '保存失败'); return; }
  closeModal('modalUser');
  if (d.dnsWarning) showToast('已保存，但自动创建 DNS 失败：' + d.dnsWarning, 8000);
  else if (d.dns) showToast('已保存，已自动创建 DNS：' + d.dns.entryHost + ' → ' + d.dns.target, 5000);
  else showToast('保存成功');
  loadUsers();
}

async function toggleUser(id, enable) {
  const r = await fetch('/admin/api/users/' + id, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: enable ? 'active' : 'disabled' })
  });
  const d = await r.json();
  showToast(r.ok ? (enable ? '已启用' : '已禁用') : (d.error || '操作失败'));
  loadUsers();
}

async function delUser(id) {
  const u = allUsers.find(function(x) { return x.id === id; });
  if (!confirm('确定删除用户 ' + (u ? u.username : id) + ' ？其路由和统计也会被删除。')) return;
  const r = await fetch('/admin/api/users/' + id, { method: 'DELETE' });
  const d = await r.json();
  showToast(r.ok ? '已删除' : (d.error || '删除失败'));
  loadUsers();
}

async function loadInvites() {
  if (!IS_ADMIN) return;
  try {
    const r = await fetch('/admin/api/invites');
    const d = await r.json();
    allInvites = d.invites || [];
    renderInvites(allInvites);
  } catch (e) {
    document.getElementById('inviteList').textContent = '加载失败: ' + e.message;
  }
}

function renderInvites(list) {
  const el = document.getElementById('inviteList');
  if (!list.length) { el.innerHTML = '<p class="muted">暂无邀请码，点上方按钮生成</p>'; return; }
  let html = '<div style="overflow-x:auto"><table><thead><tr><th>邀请码</th><th>使用</th><th>过期</th><th>备注</th><th>操作</th></tr></thead><tbody>';
  list.forEach(function(v) {
    const used = Number(v.usedCount) || 0;
    const max = Number(v.maxUses) || 0;
    html += '<tr>' +
      '<td><code>' + esc(v.code) + '</code></td>' +
      '<td>' + used + ' / ' + (max === 0 ? '∞' : max) + '</td>' +
      '<td>' + esc(v.expiresAt ? String(v.expiresAt).slice(0, 10) : '—') + '</td>' +
      '<td>' + esc(v.note || '—') + '</td>' +
      '<td style="white-space:nowrap">' +
        '<button class="btn btn-sm" onclick="copyInvite(\'' + esc(v.code) + '\')">复制</button> ' +
        '<button class="btn btn-sm btn-danger" onclick="delInvite(\'' + esc(v.code) + '\')">删除</button>' +
      '</td></tr>';
  });
  html += '</tbody></table></div>';
  el.innerHTML = html;
}

function openInviteModal() {
  document.getElementById('inviteCode').value = '';
  document.getElementById('inviteMaxUses').value = '1';
  document.getElementById('inviteExpires').value = '';
  document.getElementById('inviteNote').value = '';
  openModal('modalInvite');
}

async function saveInvite() {
  const data = {
    code: document.getElementById('inviteCode').value.trim(),
    max_uses: document.getElementById('inviteMaxUses').value,
    expires_at: document.getElementById('inviteExpires').value,
    note: document.getElementById('inviteNote').value.trim()
  };
  const x = await postJson('/admin/api/invites', data);
  if (!x.ok) { showToast(x.data.error || '生成失败'); return; }
  closeModal('modalInvite');
  showToast('邀请码：' + (x.data.invite ? x.data.invite.code : '已生成'));
  loadInvites();
}

async function delInvite(code) {
  if (!confirm('确定删除邀请码 ' + code + ' ？')) return;
  try {
    const r = await fetch('/admin/api/invites/' + encodeURIComponent(code), { method: 'DELETE' });
    const d = await r.json().catch(function() { return {}; });
    if (r.ok) showToast(d.alreadyDeleted ? '邀请码已不存在，列表已刷新' : '✅ 邀请码已删除');
    else showToast('❌ ' + (d.error || '删除失败'), 5000);
  } catch (e) {
    showToast('❌ 删除失败: ' + e.message, 5000);
  }
  loadInvites();
}

async function clearInvites() {
  if (!confirm('确定删除全部邀请码吗？\n\n所有未使用和已使用的邀请码都会被删除，此操作不可恢复。')) return;
  showToast('正在删除全部邀请码...', 3000);
  const x = await postJson('/admin/api/invites/clear', { confirm: 'CLEAR' });
  if (x.ok) showToast('✅ 已删除全部邀请码（' + ((x.data && x.data.deleted) || 0) + ' 个）', 4000);
  else showToast('❌ ' + ((x.data && x.data.error) || '操作失败'), 5000);
  loadInvites();
}

function copyInvite(code) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(code).then(function() { showToast('已复制：' + code); }).catch(function() { prompt('复制邀请码', code); });
  } else {
    prompt('复制邀请码', code);
  }
}

async function resetStats() {
  if (!confirm('确定清空所有统计数据吗？\n\n路由、用户、域名配置会保留，此操作不可恢复。')) return;
  showToast('正在清空统计...', 4000);
  const x = await postJson('/admin/api/db/reset', { scope: 'stats', confirm: 'RESET' });
  showToast(x.ok ? '✅ 统计已清空' : ('❌ ' + (x.data.error || '操作失败')), x.ok ? 2600 : 6000);
  loadStats(); loadUsers(); loadAudit();
}

// ===== 管理员：设置 / 导出导入 / 域名 / DNS / 日志 =====
async function importConfig(input) {
  const f = input.files && input.files[0];
  input.value = '';
  if (!f) return;
  if (f.size > 2 * 1024 * 1024) { showToast('配置文件不能超过 2 MiB，请分批导入'); return; }
  let data;
  try { data = JSON.parse(await f.text()); } catch (e) { showToast('不是合法的 JSON 文件'); return; }
  const preview = await postJson('/admin/api/import/preview', data);
  if (!preview.ok || !preview.data.canImport) { showToast(preview.data.error || '预检发现无效或重复线路，请修正配置后重试'); return; }
  if (!confirm('只读预检完成：新增 ' + preview.data.added.length + ' 条，覆盖 ' + preview.data.overwritten.length + ' 条；设置项 ' + preview.data.settings.length + ' 个。导入后将修改本地配置，确定继续？')) return;
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
  document.getElementById('setDailyReport').checked = String(s.tg_daily_report == null ? '1' : s.tg_daily_report) !== '0';
  document.getElementById('setRouteAlerts').checked = String(s.tg_route_alerts ?? '1') !== '0';
  document.getElementById('setRate').value = s.rate_limit_per_min || '0';
  document.getElementById('setXfo').value = s.x_frame_options || '';
  document.getElementById('setManual').value = s.manual_redirect_domains || '';
  document.getElementById('setRules').value = s.domain_proxy_rules || '';
  const n = d.notify || {};
  document.getElementById('notifyHint').textContent = (n.telegram || n.webhook)
    ? '通知渠道：' + [n.telegram ? 'Telegram' : '', n.webhook ? 'Webhook' : ''].filter(Boolean).join(' + ')
    : '尚未配置通知，请在下方填写 Telegram 配置';
  renderTelegramStatus(n);
  ['tgBotToken', 'currentPassword', 'newPassword', 'confirmPassword'].forEach(id => { document.getElementById(id).value = ''; });
  loadRelayCard();
  openModal('modalSettings');
}

function renderTelegramStatus(n) {
  document.getElementById('tgChatId').value = n.chatId || '';
  document.getElementById('tgBotToken').placeholder = n.tokenConfigured ? 'Token 已配置（留空保持不变）' : '填写 Bot Token';
  document.getElementById('tgConfigStatus').textContent = n.error || ('来源：' + ({ web: '网页加密配置', environment: 'Worker 环境变量', disabled: '已停用' }[n.source] || '未知') + (n.encryptionReady ? ' · 加密密钥已就绪' : ' · 请先配置独立加密主密钥或强 SESSION_SECRET'));
  document.getElementById('tgLastStatus').textContent = n.last ? '最近通知：' + n.last.at + ' · ' + (n.last.ok ? '成功' : '失败') + '（' + n.last.kind + '）' : '暂无发送记录';
}

async function saveTelegram(btn) {
  btn.disabled = true;
  try {
    const x = await postJson('/admin/api/notifications', { token: document.getElementById('tgBotToken').value, chatId: document.getElementById('tgChatId').value });
    if (!x.ok) { showToast(x.data.error || '保存失败'); return; }
    document.getElementById('tgBotToken').value = '';
    renderTelegramStatus(x.data);
    showToast('TG 配置已加密保存');
  } catch { showToast('请求失败，请检查连接'); } finally { btn.disabled = false; }
}

async function testTelegramConfig(btn) {
  if (document.getElementById('tgBotToken').value) { showToast('请先保存 TG 配置再测试'); return; }
  btn.disabled = true;
  try {
    const x = await postJson('/admin/api/notifications/test', {});
    showToast(x.ok ? '测试通知已发送' : x.data.error || '发送失败');
    const response = await fetch('/admin/api/notifications');
    if (response.ok) renderTelegramStatus(await response.json());
  } catch { showToast('请求失败，请检查连接'); } finally { btn.disabled = false; }
}

async function clearTelegram(btn) {
  if (!confirm('确定清除并停用 Telegram？不会回退使用 Worker 环境变量。Webhook 不受影响。')) return;
  btn.disabled = true;
  try {
    const x = await postJson('/admin/api/notifications', { clear: true });
    if (!x.ok) { showToast(x.data.error || '清除失败'); return; }
    document.getElementById('tgBotToken').value = '';
    renderTelegramStatus(x.data);
    showToast('Telegram 已停用');
  } catch { showToast('请求失败，请检查连接'); } finally { btn.disabled = false; }
}

async function updatePassword(btn) {
  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  if (newPassword.length < 12 || newPassword.length > 128 || newPassword !== confirmPassword) { showToast('新密码须为 12–128 个字符且两次一致'); return; }
  if (!confirm('修改后当前账号的所有旧会话都会失效，确定继续？')) return;
  btn.disabled = true;
  try {
    const x = await postJson(IS_ADMIN ? '/admin/api/security/password' : '/api/user/password', { currentPassword, newPassword, confirmPassword });
    if (!x.ok) { showToast(x.data.error || '修改失败'); return; }
    location.href = '/';
  } catch { showToast('请求失败，请检查连接'); } finally {
    ['currentPassword', 'newPassword', 'confirmPassword'].forEach(id => { document.getElementById(id).value = ''; });
    btn.disabled = false;
  }
}

// ===== VPS 中继配置卡（v6.8.0；v6.8.3 增加用量统计展示）=====
async function loadRelayCard() {
  try {
    const r = await fetch('/admin/api/relay');
    const d = await r.json();
    document.getElementById('setRelayUrl').value = d.relay_url || '';
    document.getElementById('setRelaySecret').value = '';
    document.getElementById('setRelaySecret').placeholder = d.has_secret ? '已配置（' + d.secret_hint + '），留空表示不修改' : '留空表示不修改密钥';
    document.getElementById('setRelayEnabled').checked = d.relay_enabled === '1';
    document.getElementById('relayTestResult').textContent = d.active ? '当前状态：已启用' : '当前状态：未启用';
  } catch (e) { /* 忽略 */ }
  loadRelayUsage();
}

// 通用值渲染：数字加千分位，对象递归，字符串原样
function relayVal(v) {
  if (v == null) return '';
  if (typeof v === 'number') return v.toLocaleString();
  if (typeof v === 'object') {
    return Object.keys(v).map(function(k) { return k + ': ' + relayVal(v[k]); }).join(' · ');
  }
  return String(v);
}

async function loadRelayUsage() {
  const el = document.getElementById('relayUsage');
  if (!el) return;
  try {
    const r = await fetch('/admin/api/relay/usage');
    const d = await r.json();
    if (!d.ok) {
      el.innerHTML = '<span style="color:var(--warn)">⚠️ VPS 统计' + (d.error ? '：' + esc(d.error) : '：中继不可达') + '</span>';
      return;
    }
    const usageHtml = d.usage ? esc(relayVal(d.usage)) : 'VPS 未提供';
    const limitsHtml = d.limits ? esc(relayVal(d.limits)) : '';
    el.innerHTML =
      '📊 中继用量：<b>' + usageHtml + '</b><br>' +
      (limitsHtml ? '限额：' + limitsHtml + '<br>' : '') +
      '版本：' + esc(d.version || '—') + '<br>' +
      '近 24h 中绔回退：<b>' + (d.fallback24 || 0) + '</b> 次' + (d.fallbackErr24 ? '（直连失败 ' + d.fallbackErr24 + '）' : '');
  } catch (e) {
    el.textContent = 'VPS 统计加载失败';
  }
}

async function saveRelay() {
  const body = {
    relay_url: document.getElementById('setRelayUrl').value.trim(),
    relay_enabled: document.getElementById('setRelayEnabled').checked ? '1' : '0'
  };
  const secret = document.getElementById('setRelaySecret').value.trim();
  if (secret) body.relay_secret = secret;
  const x = await postJson('/admin/api/relay', body);
  if (!x.ok) { showToast(x.data.error || '保存失败'); return false; }
  return true;
}

async function testRelay() {
  const el = document.getElementById('relayTestResult');
  el.textContent = '测试中...';
  const saved = await saveRelay();
  if (!saved) { el.textContent = '请先填写地址/密钥'; return; }
  const x = await postJson('/admin/api/relay/test', {});
  if (!x.ok) { showToast(x.data.error || '请求失败'); el.textContent = '测试失败'; return; }
  const d = x.data;
  if (d.ok) {
    el.textContent = '联通 ' + d.ms + 'ms' + (d.version ? ' · ' + d.version : '') + (d.auto_enabled ? ' · 已自动启用中继' : '');
    document.getElementById('setRelayEnabled').checked = true;
    showToast('中继健康测试通过；真实登录与播放仍需验证');
    loadRelayUsage();
  } else {
    el.textContent = '失败' + (d.error ? '：' + d.error : '（HTTP ' + d.status + '）');
  }
}

async function saveSettings() {
  const x = await postJson('/admin/api/settings', {
    health_check: document.getElementById('setHealth').checked ? '1' : '0',
    tg_daily_report: document.getElementById('setDailyReport').checked ? '1' : '0',
    tg_route_alerts: document.getElementById('setRouteAlerts').checked ? '1' : '0',
    rate_limit_per_min: document.getElementById('setRate').value || '0',
    x_frame_options: document.getElementById('setXfo').value || '',
    manual_redirect_domains: document.getElementById('setManual').value.trim(),
    domain_proxy_rules: document.getElementById('setRules').value.trim()
  });
  if (!x.ok) { showToast(x.data.error || '保存失败'); return; }
  if (!await saveRelay()) return;
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
  'route.claim': '认领历史路由',
  'domain.add': '添加优选域名',
  'domain.update': '更新优选域名',
  'domain.delete': '删除优选域名',
  'dns.replace': '替换 DNS 记录',
  'user.register': '用户注册',
  'user.create': '创建用户',
  'user.update': '更新用户',
  'user.delete': '删除用户',
  'user.password': '修改密码',
  'security.password': '修改管理员密码',
  'notification.save': '保存通知配置',
  'notification.test': '测试通知',
  'user.dns': '绑定用户 DNS',
  'user.route.save': '保存用户路由',
  'user.route.delete': '删除用户路由',
  'invite.create': '生成邀请码',
  'invite.delete': '删除邀请码',
  'invite.clear': '清空邀请码',
  'db.reset': '重置数据库'
};
var AUDIT_SETTINGS = {
  health_check: '线路健康检查',
  tg_daily_report: '每日日报',
  tg_route_alerts: '线路异常和恢复通知',
  x_frame_options: '代理页面嵌入策略',
  rate_limit_per_min: '每分钟请求限制',
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
  if (!IS_ADMIN) return;
  const el = document.getElementById('auditList');
  const r = await fetch('/admin/api/audit');
  const d = await r.json();
  if (!d.logs || !d.logs.length) { el.textContent = '暂无记录'; return; }
  el.innerHTML = '<table><thead><tr><th>时间</th><th>操作</th><th>详情</th></tr></thead><tbody>' + d.logs.map(function(l) {
    return '<tr><td>' + esc(new Date(l.ts).toLocaleString('zh-CN')) + '</td>'
      + '<td title="' + esc(l.action) + '">' + esc(auditActionLabel(l.action)) + '</td>'
      + '<td>' + esc(auditDetailText(l)) + '</td></tr>';
  }).join('') + '</tbody></table>';
}

async function loadDomains() {
  if (!IS_ADMIN) return;
  try {
    const r = await fetch('/admin/api/optimized-domains');
    if (r.status === 401) { location.href = '/admin'; return; }
    const d = await r.json();
    if (d.success) { allDomains = d.domains; renderDomains(allDomains); }
    else { document.getElementById('domainList').innerHTML = '<p class="muted">加载失败</p>'; }
  } catch (e) {
    document.getElementById('domainList').innerHTML = '<p class="muted">加载失败: ' + esc(e.message) + '</p>';
  }
}

function renderDomains(list, speedResults, best) {
  const el = document.getElementById('domainList');
  if (!list.length) { el.innerHTML = '<div class="empty-state"><span class="empty-state-icon">🌐</span><p class="empty-state-text">暂无优选域名</p></div>'; return; }
  const speedMap = {};
  if (speedResults) speedResults.forEach(function(r) { speedMap[r.domain] = r; });
  const sorted = list.slice().sort(function(a, b) {
    const sa = speedMap[a.domain], sb = speedMap[b.domain];
    const la = sa && sa.latency >= 0 ? sa.latency : Infinity;
    const lb = sb && sb.latency >= 0 ? sb.latency : Infinity;
    return la - lb;
  });
  let html = '<table><thead><tr><th>名称</th><th>域名</th><th>延迟</th><th>状态</th><th>操作</th></tr></thead><tbody>';
  sorted.forEach(function(d) {
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
  const d = allDomains.find(function(x) { return x.id === id; });
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
  const domain = url.replace('https://', '').replace('http://', '').split('/')[0];
  const r = await fetch(id ? '/admin/api/optimized-domains/' + id : '/admin/api/optimized-domains', {
    method: id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domain: domain, name: name })
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
  showToast(d.success ? '已删除' : (d.error || '删除失败'));
  if (d.success) loadDomains();
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

async function loadQuickDNS() {
  if (!IS_ADMIN) return;
  var meta = document.getElementById('dnsQuickMeta');
  if (meta) meta.textContent = 'DNS 记录加载中...';
  try {
    const r = await fetch('/admin/api/dns-config');
    if (r.status === 401) { location.href = '/admin'; return; }
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
  if (!IS_ADMIN) return;
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
    if (d.success) showToast('✅ 日报已发送' + (d.webhook && d.webhook.ok ? '（Telegram + Webhook）' : '（Telegram）'));
    else { showToast('❌ ' + (d.hint || (d.telegram && d.telegram.error) || '发送失败'), 9000); loadAudit(); }
  } catch (e) {
    showToast('❌ 发送失败: ' + e.message);
  }
  if (btn) { btn.disabled = false; btn.textContent = '发送日报'; }
}

document.getElementById('routePrefix').addEventListener('input', function() {
  document.getElementById('prefixPreview').textContent = this.value.trim() || 'myemby';
});

loadRoutes();
loadStats();
if (IS_ADMIN) {
  loadQuickDNS();
  loadDomains();
  loadUsers();
  loadInvites();
} else {
  loadUserEntry();
}
