const CURRENT_VERSION = '3.2-multiuser';

const OPTIMIZED_DOMAINS = [
  { subdomain: '', domain: 'cf.090227.xyz', name: 'CF优选-090227' },
  { subdomain: '', domain: 'cf.877774.xyz', name: 'CF优选-877774' },
  { subdomain: '', domain: 'cloudflare-dl.byoip.top', name: '鱼皮优选' },
  { subdomain: '', domain: 'saas.sin.fan', name: 'MIYU优选' },
  { subdomain: '', domain: 'bestcf.030101.xyz', name: 'Mingyu优选' },
  { subdomain: '', domain: 'cf.cloudflare.182682.xyz', name: 'WeTest优选' },
  { subdomain: '', domain: 'cf.tencentapp.cn', name: '无名氏维护' },
  { subdomain: '', domain: 'www.visa.cn', name: 'Visa官方' },
  { subdomain: '', domain: 'mfa.gov.ua', name: '乌克兰外交部' },
  { subdomain: '', domain: 'www.shopify.com', name: 'Shopify官方' },
  { subdomain: '', domain: 'store.ubi.com', name: '育碧商店' },
  { subdomain: '', domain: 'staticdelivery.nexusmods.com', name: 'NexusMods' },
];

const RESERVED_ALIASES = new Set([
  'admin', 'stats', 'health', 'api', 'favicon.ico', 'cdn-cgi',
  '__client_rtt__', 'web', 'emby', 'sessions', 'playbackinfo',
]);

const MANUAL_REDIRECT_DOMAINS = [
  'emby.bangumi.ca', 'aliyundrive.com', 'aliyundrive.net', 'aliyuncs.com', 'alicdn.com', 'aliyun.com',
  'cdn.aliyundrive.com', 'xunlei.com', 'xlusercdn.com', 'xycdn.com', 'sandai.net', 'thundercdn.com',
  '115.com', '115cdn.com', '115cdn.net', 'anxia.com', '189.cn', 'mini189.cn', 'ctyunxs.cn',
  'cloud.189.cn', 'tianyiyun.com', 'telecomjs.com', 'quark.cn', 'quarkdrive.cn', 'uc.cn', 'ucdrive.cn',
  'xiaoya.pro', 'myqcloud.com', 'cloudfront.net', 'akamaized.net', 'fastly.net', 'hwcdn.net', 'bytecdn.cn', 'bdcdn.net',
];

const DOMAIN_PROXY_RULES = { 'biliblili.uk': 'example.com' };
const JP_COLOS = ['NRT', 'KIX', 'FUK', 'OKA'];

const blocker = {
  keys: ['.m3u8', '.ts', '.acc', '.m4s', 'photocall.tv', 'googlevideo.com'],
  check(url) {
    url = url.toLowerCase();
    return blocker.keys.some((x) => url.includes(x));
  },
};

const CONFIG = {
  pikpakProxyUrl: 'https://pp.255432.xyz',
  enableStats: true,
  cacheEnabled: true,
  domainCacheTtlMs: 3600000,
};

const PIKPAK_DOMAINS = [
  'pikpak.com', 'pikpak.net', 'pikpak-cn.com', 'pikpakcdn.com', 'pikpakapi.com', 'pikpakdrive.com',
];

const CORS_JSON = { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' };

let dbReady = false;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS_JSON });
}

function html(body, status = 200) {
  return new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

function getCookie(req, name) {
  const s = req.headers.get('Cookie');
  if (!s) return null;
  const m = s.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return m ? decodeURIComponent(m[2]) : null;
}

// 管理员账号环境变量：在 CF 控制台添加 ADMIN_USERNAME / ADMIN_PASSWORD，
// 登录页输入这组用户名密码即为管理员（无需注册、无需邀请码）
function getAdminCredUser(env) {
  const u = String(env.ADMIN_USERNAME ?? env.AdminUsername ?? '').trim().toLowerCase();
  return u || null;
}
function getAdminCredPass(env) {
  const p = String(env.ADMIN_PASSWORD ?? env.AdminPassword ?? '').trim();
  return p || null;
}

// 校验 admin_token cookie：匹配 ADMIN_PASSWORD
function isAdminCookie(request, env) {
  const provided = getCookie(request, 'admin_token');
  if (!provided) return false;
  const adminPass = getAdminCredPass(env);
  if (adminPass && provided === adminPass) return true;
  return false;
}

// 判断是否属于管理员（admin_token cookie 或用户表中 role === 'admin'）
async function hasAdminAccess(request, env) {
  if (isAdminCookie(request, env)) return true;
  // 用户账号角色为 admin
  if (env.DB) {
    const u = await getUser(request, env);
    if (u && u.role === 'admin') return true;
  }
  return false;
}

// 同步版（仅检查 admin_token cookie，用于需要同步返回的场景）
function isAdmin(request, env) {
  return isAdminCookie(request, env);
}

function adminLoginResponse(request, env, username, password) {
  const adminUser = getAdminCredUser(env);
  const adminPass = getAdminCredPass(env);
  if (!adminUser || !adminPass) {
    return json({
      ok: false,
      error: 'Worker 未配置 ADMIN_USERNAME / ADMIN_PASSWORD。请在 Cloudflare 控制台 → Worker → 设置 → 变量和机密 中添加。',
    }, 503);
  }
  if (username !== adminUser || password !== adminPass) {
    return json({ ok: false, error: '用户名或密码错误' }, 401);
  }
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  const cookie = `admin_token=${encodeURIComponent(adminPass)}; Path=/; Max-Age=2592000; SameSite=Lax${secure}`;
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Set-Cookie': cookie,
      'Cache-Control': 'no-store',
    },
  });
}

// ==================== 多用户鉴权 ====================
const SESSION_TTL = 30 * 24 * 3600;
const RESERVED_SUBDOMAINS = ['admin', 'api', 'www', 'user', 'login', 'register', 'static', 'cdn', 'mail', 'stats', 'health', 'cdn-cgi', 'assets'];

function getSessionSecret(env) {
  return String(env.SESSION_SECRET || env.ADMIN_TOKEN || 'changeme-session-secret');
}
function bufToHex(buf) {
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
function hexToBuf(hex) {
  const a = new Uint8Array(hex.length / 2);
  for (let i = 0; i < a.length; i++) a[i] = parseInt(hex.substr(i * 2, 2), 16);
  return a.buffer;
}
const TE = new TextEncoder();
async function hashPassword(pw, salt) {
  const key = await crypto.subtle.importKey('raw', TE.encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: hexToBuf(salt), iterations: 100000, hash: 'SHA-256' }, key, 256);
  return bufToHex(bits);
}
function genSalt() { return bufToHex(crypto.getRandomValues(new Uint8Array(16))); }
function genInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const rnd = crypto.getRandomValues(new Uint8Array(32));
  let s = '';
  for (let i = 0; i < 32; i++) s += chars[rnd[i] % chars.length];
  return s;
}
async function signHmac(payload, env) {
  const key = await crypto.subtle.importKey('raw', TE.encode(getSessionSecret(env)), 'HMAC', false, ['sign']);
  return bufToHex(await crypto.subtle.sign('HMAC', key, TE.encode(payload)));
}
async function signSession(userId, env) {
  const exp = Date.now() + SESSION_TTL * 1000;
  const payload = userId + ':' + exp;
  return payload + '.' + (await signHmac(payload, env));
}
function setSessionCookie(value) {
  return `user_token=${value}; Path=/; Max-Age=${SESSION_TTL}; SameSite=Lax; Secure`;
}
async function getUser(request, env) {
  const token = getCookie(request, 'user_token');
  if (!token || !token.includes('.')) return null;
  const idx = token.lastIndexOf('.');
  const payload = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const parts = payload.split(':');
  if (!parts[0] || !parts[1] || Date.now() > Number(parts[1])) return null;
  if ((await signHmac(payload, env)) !== sig) return null;
  if (!env.DB) return null;
  const u = await env.DB.prepare('SELECT id, username, role, status FROM users WHERE id = ?').bind(Number(parts[0])).first();
  return (u && u.status === 'active') ? u : null;
}

function buildRegisterHtml() {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>注册账号</title>${HEAD_LINK}<style>${PAGE_STYLE}
body{display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px;}
.login-box{position:relative;background:linear-gradient(170deg,rgba(13,20,40,.95),rgba(7,11,22,.97));padding:38px 34px 30px;border-radius:4px;max-width:400px;width:100%;border:1px solid var(--line);box-shadow:0 30px 80px rgba(0,0,0,.6),0 0 80px rgba(0,229,255,.06);animation:riseIn .5s ease backwards;}
.login-box::before,.login-box::after{content:'';position:absolute;width:26px;height:26px;border:1px solid var(--cyan);}
.login-box::before{top:-1px;left:-1px;border-right:none;border-bottom:none;}
.login-box::after{bottom:-1px;right:-1px;border-left:none;border-top:none;}
.login-box input{display:block;width:100%;box-sizing:border-box;margin-bottom:14px;}
.hint{color:var(--dim);font-size:12px;margin:0 0 12px;padding:8px 12px;background:rgba(0,229,255,.06);border:1px solid rgba(0,229,255,.15);border-radius:3px;font-family:var(--fm);}
@media(max-width:480px){.login-box{padding:30px 22px 24px;}}
</style></head><body><div class="scanline"></div><div class="login-box">
<div class="brand-mark" style="margin:0 auto 20px"></div>
<h1 class="login-title">注册账号</h1>
<p class="login-sub">New Account Registration</p>
<input type="text" id="regUser" placeholder="用户名（3-32位字母数字下划线）" autocomplete="username" onkeydown="if(event.key==='Enter')doReg()">
<input type="password" id="regPass" placeholder="密码（至少6位）" autocomplete="new-password" onkeydown="if(event.key==='Enter')doReg()">
<input type="text" id="regCode" placeholder="邀请码（向管理员获取）" onkeydown="if(event.key==='Enter')doReg()">
<p id="regErr" class="login-err"></p>
<button class="btn" style="width:100%" id="regBtn" onclick="doReg()">注册并登录</button>
<p class="login-link"><a href="/admin">管理员登录</a></p>
<script>
async function doReg(){
  var u=document.getElementById('regUser').value.trim();
  var p=document.getElementById('regPass').value;
  var c=document.getElementById('regCode').value.trim();
  var err=document.getElementById('regErr');
  err.textContent='';
  if(!u||!p||!c){err.textContent='请填写完整';return;}
  document.getElementById('regBtn').disabled=true;
  try{var r=await fetch('/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u,password:p,invite_code:c})});var d=await r.json();if(d.ok){location.href='/admin';return;}err.textContent=d.error||'注册失败';}catch(e){err.textContent='请求失败:'+e.message;}
  document.getElementById('regBtn').disabled=false;
}
</script></div></body></html>`;
}

function buildUserHtml(u) {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>我的后台</title>${HEAD_LINK}<style>${PAGE_STYLE}</style></head><body>
<div class="scanline"></div>
<div id="toast"></div>
<div class="container">
  <div class="card">
    <div class="page-hero">
      <div class="brand">
        <div class="brand-mark"></div>
        <div>
          <div class="brand-name">用户控制台<span class="badge">${u.role==='admin'?'ADMIN':'USER'}</span></div>
          <div class="brand-sub">${u.username} · Edge Subdomain Manager</div>
        </div>
      </div>
      <div style="display:flex;gap:10px"><a href="/" class="btn btn-outline btn-sm">首页</a><button class="btn btn-del btn-sm" onclick="doLogout()">退出</button></div>
    </div>
  </div>
  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:12px">
      <h2 style="border:none;margin:0;padding:0;flex:1">我的子域名<span class="h2-en" style="float:none;margin-left:12px">SUBDOMAINS</span></h2>
      <button class="btn" onclick="openModal('modalDomain')">添加</button>
    </div>
    <p class="muted" style="margin:0 0 14px">子域名形如 <code>xxx.dirige.de5.net</code>，访问时通过你绑定的优选IP入口提速（仅边缘路由优化，不改变来源身份）。</p>
    <div id="domainList" class="route-grid"><p class="muted">LOADING...</p></div>
  </div>
</div>
<div id="modalDomain" class="modal"><div class="modal-inner">
  <div class="modal-header"><h2 class="modal-title">添加子域名</h2><p class="modal-desc">绑定三级子域名到你的优选域名/IP</p></div>
  <div class="form-group"><label>子域名前缀</label><input id="subInput" placeholder="例如 alice"></div>
  <div class="form-group"><label>优选域名 / IP</label><input id="hostInput" placeholder="例如 csgo.com 或 1.2.3.4"><p class="form-hint">填优选域名或具体 IP，用于边缘路由提速</p></div>
  <div class="form-group"><label>备注</label><input id="remarkInput" placeholder="可选"></div>
  <div class="modal-actions"><button class="btn btn-outline" onclick="closeModal('modalDomain')">取消</button><button class="btn" onclick="saveDomain()">保存</button></div>
</div></div>
<script>
function closeModal(id){document.getElementById(id).classList.remove('show');}
function openModal(id){document.getElementById(id).classList.add('show');}
function doLogout(){document.cookie='user_token=;path=/;max-age=0';location.reload();}
function showToast(msg){var t=document.getElementById('toast');if(!t){t=document.createElement('div');t.id='toast';document.body.appendChild(t);}t.textContent=msg;t.classList.add('show');setTimeout(function(){t.classList.remove('show');},2500);}
async function loadDomains(){
  var r=await fetch('/api/user/domains');var d=await r.json();var box=document.getElementById('domainList');
  if(!d.domains||!d.domains.length){box.innerHTML='<div class="empty-state" style="grid-column:1/-1"><span class="empty-state-icon"></span><p class="empty-state-text">还没有子域名，点上方按钮添加</p></div>';return;}
  box.innerHTML=d.domains.map(function(x){return '<div class="route-item"><div class="route-header"><div class="route-title"><h3 class="route-name">'+x.subdomain+'.dirige.de5.net</h3><span class="route-path">'+x.preferred_host+'</span></div><button class="btn-remove" onclick="delDomain(\\''+x.subdomain+'\\')" title="删除">✕</button></div><div class="route-meta">'+(x.remark?'<span class="meta-tag">'+x.remark+'</span>':'')+'<span class="meta-tag '+(x.status==='active'?'meta-tag-on':'meta-tag-warn')+'">'+(x.status==='active'?'ACTIVE':'DISABLED')+'</span></div></div>';}).join('');
}
async function saveDomain(){
  var sub=document.getElementById('subInput').value.trim().toLowerCase();
  var host=document.getElementById('hostInput').value.trim();
  var remark=document.getElementById('remarkInput').value.trim();
  if(!sub||!host){showToast('请填写完整');return;}
  var r=await fetch('/api/user/domains',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({subdomain:sub,preferred_host:host,remark:remark})});
  var d=await r.json();
  if(d.ok){closeModal('modalDomain');document.getElementById('subInput').value='';document.getElementById('hostInput').value='';document.getElementById('remarkInput').value='';loadDomains();showToast('已添加');}else{showToast(d.error||'失败');}
}
async function delDomain(sub){
  if(!confirm('确定删除 '+sub+'.dirige.de5.net ?'))return;
  var r=await fetch('/api/user/domains?subdomain='+encodeURIComponent(sub),{method:'DELETE'});var d=await r.json();
  if(d.ok){loadDomains();showToast('已删除');}else{showToast(d.error||'失败');}
}
loadDomains();
</script></div></body></html>`;
}

function getClientCacheKey(request) {
  const ip = request.headers.get('cf-connecting-ip') || '0.0.0.0';
  const cf = request.cf || {};
  let ipKey = ip;
  if (ip.includes('.')) ipKey = ip.split('.').slice(0, 3).join('.');
  else if (ip.includes(':')) ipKey = ip.split(':').slice(0, 4).join(':');
  return `${cf.country || 'XX'}|${cf.city || ''}|${cf.asn || ''}|${ipKey}`;
}

function optimizedHost(item) {
  return item.subdomain ? `${item.subdomain}.${item.domain}` : item.domain;
}

function latencyStatus(ms) {
  if (ms < 0) return 'timeout';
  if (ms < 100) return 'fast';
  if (ms < 300) return 'good';
  return 'slow';
}

async function initDatabase(env) {
  if (!env.DB || dbReady) return;
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS routes (
      prefix TEXT PRIMARY KEY, target TEXT NOT NULL,
      remark TEXT DEFAULT '', last_play TEXT DEFAULT '',
      cache_img TEXT DEFAULT 'on', compat_mode TEXT DEFAULT 'off',
      sort_order INTEGER DEFAULT 0, target_latencies TEXT DEFAULT '')`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS visitor_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT, prefix TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, ip TEXT, country TEXT, ua TEXT)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS request_stats (
      prefix TEXT, date TEXT, count INTEGER DEFAULT 0, PRIMARY KEY(prefix, date))`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS auto_emby_daily_stats (
      date TEXT PRIMARY KEY, playing_count INTEGER DEFAULT 0, playback_info_count INTEGER DEFAULT 0)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS domain_speed_cache (
      cache_key TEXT NOT NULL, subdomain TEXT NOT NULL, domain TEXT NOT NULL,
      display_name TEXT, latency_ms INTEGER DEFAULT -1, status TEXT DEFAULT 'unknown',
      tested_at INTEGER NOT NULL, PRIMARY KEY (cache_key, subdomain, domain))`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS domain_best_cache (
      cache_key TEXT PRIMARY KEY, best_host TEXT, best_name TEXT, best_latency INTEGER,
      tested_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS user_domains (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      subdomain TEXT UNIQUE NOT NULL,
      preferred_host TEXT NOT NULL,
      remark TEXT DEFAULT '',
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS invite_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      status TEXT DEFAULT 'unused',
      used_by INTEGER DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`),
  ]);
  try { await env.DB.exec(`ALTER TABLE routes ADD COLUMN target_latencies TEXT DEFAULT ''`); } catch(e) {}
  try { await env.DB.exec(`ALTER TABLE routes ADD COLUMN compat_mode TEXT DEFAULT 'off'`); } catch(e) {}
  dbReady = true;
}

async function getEdgeInfo(request) {
  const cf = request.cf || {};
  let traceIp = '';
  let traceColo = cf.colo || '未知';
  try {
    const tr = await fetch('https://1.1.1.1/cdn-cgi/trace', { headers: { 'User-Agent': 'CF-Worker-Trace' } });
    const text = await tr.text();
    const coloM = text.match(/colo=([A-Z0-9]+)/);
    const ipM = text.match(/ip=([^\n]+)/);
    if (coloM) traceColo = coloM[1];
    if (ipM) traceIp = ipM[1].trim();
  } catch (_) {}
  return {
    clientIp: request.headers.get('cf-connecting-ip') || '未知',
    entryColo: cf.colo || '未知',
    entryCountry: cf.country || '未知',
    entryCity: cf.city || '',
    edgeIp: traceIp || '—',
    egressColo: traceColo,
    cacheKey: getClientCacheKey(request),
  };
}

async function speedtestUrl(urlStr, timeoutMs = 5000) {
  const start = Date.now();
  try {
    const u = new URL(urlStr.startsWith('http') ? urlStr : 'https://' + urlStr);
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(u.origin + '/', { method: 'HEAD', signal: ctrl.signal, redirect: 'manual' });
    clearTimeout(tid);
    if (res.status === 502 || res.status === 503 || res.status === 504) return -1;
    return Date.now() - start;
  } catch {
    return -1;
  }
}

async function speedtestOptimizedFromEdge() {
  const results = [];
  for (const item of OPTIMIZED_DOMAINS) {
    const host = optimizedHost(item);
    const ms = await speedtestUrl(`https://${host}/cdn-cgi/trace`, 4000);
    results.push({
      subdomain: item.subdomain, domain: item.domain, name: item.name, host,
      latency: ms, status: latencyStatus(ms),
    });
  }
  results.sort((a, b) => {
    if (a.latency < 0 && b.latency < 0) return 0;
    if (a.latency < 0) return 1;
    if (b.latency < 0) return -1;
    return a.latency - b.latency;
  });
  const best = results.find((r) => r.latency >= 0);
  return { results, best: best ? best.host : null };
}

async function speedtestRouteTargets(env, prefix) {
  const route = await env.DB.prepare('SELECT * FROM routes WHERE prefix = ?').bind(prefix).first();
  if (!route) return [];
  const targets = route.target.split(',').map(s => s.trim()).filter(Boolean);
  const latencies = {};
  const out = [];
  for (const t of targets) {
    const ms = await speedtestUrl(t);
    latencies[t] = ms;
    out.push({ url: t, latency: ms, status: latencyStatus(ms) });
  }
  await env.DB.prepare('UPDATE routes SET target_latencies = ? WHERE prefix = ?')
    .bind(JSON.stringify(latencies), prefix).run();
  out.sort((a, b) => {
    if (a.latency < 0 && b.latency < 0) return 0;
    if (a.latency < 0) return 1;
    if (b.latency < 0) return -1;
    return a.latency - b.latency;
  });
  return out;
}

async function speedtestAllRoutes(env) {
  const { results: routes } = await env.DB.prepare('SELECT prefix, target FROM routes ORDER BY sort_order, prefix').all();
  const allResults = {};
  for (const route of routes || []) {
    const targets = route.target.split(',').map(s => s.trim()).filter(Boolean);
    const latencies = {};
    for (const t of targets) {
      const ms = await speedtestUrl(t);
      latencies[t] = ms;
    }
    await env.DB.prepare('UPDATE routes SET target_latencies = ? WHERE prefix = ?')
      .bind(JSON.stringify(latencies), route.prefix).run();
    allResults[route.prefix] = Object.entries(latencies).map(([url, latency]) => ({
      url, latency, status: latencyStatus(latency),
    }));
  }
  return allResults;
}

async function saveDomainSpeedCache(env, cacheKey, rows) {
  const now = Date.now();
  const expires = now + CONFIG.domainCacheTtlMs;
  const stmts = [];
  for (const r of rows) {
    stmts.push(env.DB.prepare(
      `INSERT INTO domain_speed_cache (cache_key, subdomain, domain, display_name, latency_ms, status, tested_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(cache_key, subdomain, domain) DO UPDATE SET
       latency_ms=excluded.latency_ms, status=excluded.status, tested_at=excluded.tested_at`
    ).bind(cacheKey, r.subdomain, r.domain, r.name || r.display_name, r.latency, r.status, now));
  }
  const sorted = [...rows].filter((r) => r.latency >= 0).sort((a, b) => a.latency - b.latency);
  const best = sorted[0];
  if (best) {
    const host = `${best.subdomain}.${best.domain}`;
    stmts.push(env.DB.prepare(
      `INSERT INTO domain_best_cache (cache_key, best_host, best_name, best_latency, tested_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(cache_key) DO UPDATE SET
       best_host=excluded.best_host, best_name=excluded.best_name, best_latency=excluded.best_latency,
       tested_at=excluded.tested_at, expires_at=excluded.expires_at`
    ).bind(cacheKey, host, best.name || best.display_name, best.latency, now, expires));
  }
  await env.DB.batch(stmts);
}

async function loadDomainSpeedCache(env, cacheKey) {
  const now = Date.now();
  const best = await env.DB.prepare(
    'SELECT * FROM domain_best_cache WHERE cache_key = ? AND expires_at > ?'
  ).bind(cacheKey, now).first();
  if (!best) return null;
  const { results } = await env.DB.prepare(
    'SELECT subdomain, domain, display_name, latency_ms, status, tested_at FROM domain_speed_cache WHERE cache_key = ? ORDER BY latency_ms ASC'
  ).bind(cacheKey).all();
  if (!results?.length) return null;
  return {
    cached: true,
    cacheKey,
    best: best.best_host,
    bestName: best.best_name,
    results: results.map((r) => ({
      subdomain: r.subdomain, domain: r.domain, name: r.display_name, host: `${r.subdomain}.${r.domain}`,
      latency: r.latency_ms, status: r.status,
    })),
    expiresAt: best.expires_at,
  };
}

async function recordStats(env, type) {
  if (!env.DB || !CONFIG.enableStats) return;
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });
  const q = type === 'playing'
    ? `INSERT INTO auto_emby_daily_stats (date, playing_count, playback_info_count) VALUES (?, 1, 0)
       ON CONFLICT(date) DO UPDATE SET playing_count = playing_count + 1`
    : `INSERT INTO auto_emby_daily_stats (date, playing_count, playback_info_count) VALUES (?, 0, 1)
       ON CONFLICT(date) DO UPDATE SET playback_info_count = playback_info_count + 1`;
  await env.DB.prepare(q).bind(today).run();
}

async function handleStatsRequest(env) {
  if (!env.DB) return json({ error: "D1 数据库未绑定", data: null });
  const statsResult = await env.DB.prepare(
    `SELECT date, playing_count, playback_info_count FROM auto_emby_daily_stats
     WHERE date >= date('now', '-30 days') ORDER BY date DESC`
  ).all();
  const totalResult = await env.DB.prepare(
    `SELECT SUM(playing_count) as total_playing, SUM(playback_info_count) as total_playback_info
     FROM auto_emby_daily_stats WHERE date >= date('now', '-30 days')`
  ).first();
  return json({
    error: null,
    data: {
      total: { playing: totalResult?.total_playing || 0, playbackInfo: totalResult?.total_playback_info || 0 },
      dailyStats: statsResult?.results || [],
      lastUpdated: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
    },
  });
}

function normalizePrefix(p) {
  return String(p || '').trim().toLowerCase().replace(/^\/+|\/+$/g, '');
}

function validatePrefix(prefix) {
  const a = normalizePrefix(prefix);
  if (!a || !/^[a-z0-9][a-z0-9_-]{0,62}$/i.test(a)) return '路径仅允许字母数字、下划线和连字符';
  if (RESERVED_ALIASES.has(a.toLowerCase())) return '该路径为系统保留，不可使用';
  return null;
}

async function handleAdminApi(request, env, url) {
  if (!(await hasAdminAccess(request, env))) return new Response('Unauthorized', { status: 401 });

  if (url.pathname === '/admin/api/routes') {
    if (request.method === 'GET') {
      const { results } = await env.DB.prepare('SELECT * FROM routes ORDER BY sort_order, prefix').all();
      return json(results || []);
    }
    if (request.method === 'POST') {
      const data = await request.json();
      const err = validatePrefix(data.prefix);
      if (err) return json({ error: err }, 400);
      const prefix = normalizePrefix(data.prefix);
      let currentSortOrder = 0;
      if (data.oldPrefix && data.oldPrefix !== data.prefix) {
        const oldRow = await env.DB.prepare('SELECT sort_order FROM routes WHERE prefix = ?').bind(normalizePrefix(data.oldPrefix)).first();
        if (oldRow) currentSortOrder = oldRow.sort_order;
        await env.DB.prepare('DELETE FROM routes WHERE prefix = ?').bind(normalizePrefix(data.oldPrefix)).run();
      } else {
        const oldRow = await env.DB.prepare('SELECT sort_order FROM routes WHERE prefix = ?').bind(prefix).first();
        if (oldRow) currentSortOrder = oldRow.sort_order;
      }
      await env.DB.prepare(
        'INSERT OR REPLACE INTO routes (prefix, target, remark, cache_img, compat_mode, sort_order, target_latencies) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(
        prefix, data.target, data.remark || '', data.cache_img || 'on', data.compat_mode || 'off', currentSortOrder, ''
      ).run();
      return json({ success: true });
    }
    if (request.method === 'DELETE') {
      const prefix = url.searchParams.get('prefix');
      if (!prefix) return json({ error: '缺少 prefix 参数' }, 400);
      await env.DB.prepare('DELETE FROM routes WHERE prefix = ?').bind(normalizePrefix(prefix)).run();
      return json({ success: true });
    }
  }

  if (url.pathname === '/admin/api/speedtest/routes' && request.method === 'POST') {
    const prefix = url.searchParams.get('prefix');
    if (prefix) {
      const results = await speedtestRouteTargets(env, normalizePrefix(prefix));
      return json({ results });
    }
    const allResults = await speedtestAllRoutes(env);
    return json({ results: allResults });
  }

  if (url.pathname === '/admin/api/speedtest/domains' && request.method === 'POST') {
    const data = await speedtestOptimizedFromEdge();
    return json(data);
  }

  if (url.pathname === '/admin/api/invites' && request.method === 'GET') {
    const codes = await env.DB.prepare("SELECT code, status, used_by, created_at FROM invite_codes ORDER BY id").all();
    const total = codes.results ? codes.results.length : 0;
    const used = codes.results ? codes.results.filter(c => c.status === 'used').length : 0;
    return json({ ok: true, total, used, remaining: total - used, codes: codes.results || [] });
  }

  if (url.pathname === '/admin/api/invites/generate' && request.method === 'POST') {
    const total = await env.DB.prepare("SELECT COUNT(*) as c FROM invite_codes").first();
    if (total && total.c >= 50) return json({ error: '已达最大邀请码数量(50)' }, 409);
    const body = await request.json().catch(() => ({}));
    const count = Math.min(Math.max(parseInt(body.count) || 10, 1), 50 - (total ? total.c : 0));
    const codes = [];
    for (let i = 0; i < count; i++) { codes.push(genInviteCode()); }
    const stmt = env.DB.prepare("INSERT INTO invite_codes (code) VALUES (?)");
    await env.DB.batch([...codes.map(c => stmt.bind(c))]);
    return json({ ok: true, generated: count, codes });
  }

  return json({ error: 'Not found' }, 404);
}

async function resolveProxyTarget(request, env, url) {
  const decodedPath = decodeURIComponent(url.pathname);
  let upstreamUrls = [];
  let enableCache = true;
  let compatMode = false;
  let matchedPrefix = null;
  let needsSpeedTest = false;

  const pathParts = decodedPath.split('/').filter(Boolean);
  const prefix = normalizeAlias(pathParts[0]);
  if (!prefix) return { error: new Response('Not Found', { status: 404 }) };

  const route = await env.DB.prepare('SELECT * FROM routes WHERE prefix = ?').bind(prefix).first();
  if (!route) return { error: new Response('404: 节点不存在', { status: 404 }) };

  matchedPrefix = route.prefix;
  enableCache = route.cache_img !== 'off';
  compatMode = route.compat_mode === 'on';
  const remainingPath = '/' + pathParts.slice(1).join('/');
  let targetUrls = route.target.split(',').map(s => s.trim()).filter(Boolean);

  if (remainingPath.startsWith('/http://') || remainingPath.startsWith('/https://')) {
    upstreamUrls = [remainingPath.substring(1) + url.search];
    enableCache = true;
  } else {
    if (targetUrls.length > 1 && route.target_latencies) {
      try {
        const latencies = JSON.parse(route.target_latencies);
        const hasAnyLatency = Object.values(latencies).some(v => typeof v === 'number' && v >= 0);
        if (hasAnyLatency) {
          targetUrls.sort((a, b) => {
            const la = latencies[a];
            const lb = latencies[b];
            if (typeof la !== 'number' || la < 0) return 1;
            if (typeof lb !== 'number' || lb < 0) return -1;
            return la - lb;
          });
        }
      } catch (_) {}
    }
    if (targetUrls.length > 1 && !route.target_latencies) {
      needsSpeedTest = true;
    }
    upstreamUrls = targetUrls.map(t => t.replace(/\/+$/, '') + remainingPath + url.search);
  }

  return { upstreamUrls, enableCache, compatMode, matchedPrefix, needsSpeedTest };
}

function normalizeAlias(a) {
  return String(a || '').trim().toLowerCase().replace(/^\/+|\/+$/g, '');
}

async function proxyDirectUrl(request, env, ctx, upstreamUrls, opts = {}) {
  const { enableCache = true, compatMode = false, matchedPrefix = null, needsSpeedTest = false, preferredHost = null } = opts;
  const proxyOrigin = new URL(request.url).origin;

  if (!upstreamUrls.length) return new Response('404: Target empty', { status: 404 });

  if (needsSpeedTest && matchedPrefix && env.DB && ctx?.waitUntil) {
    ctx.waitUntil(speedtestRouteTargets(env, matchedPrefix));
  }

  let firstUpstreamUrl;
  try {
    firstUpstreamUrl = new URL(upstreamUrls[0]);
  } catch {
    return new Response('Invalid upstream URL', { status: 500 });
  }

  const isPlaybackInfo = /\/PlaybackInfo/i.test(firstUpstreamUrl.pathname);
  const isPlaying = firstUpstreamUrl.pathname.endsWith('/Sessions/Playing');

  if (isPlaying && CONFIG.enableStats) {
    ctx.waitUntil(recordStats(env, 'playing'));
  }
  if (isPlaybackInfo) {
    ctx.waitUntil(recordStats(env, 'playback_info'));
  }

  if (matchedPrefix && env.DB && ctx?.waitUntil && isPlaybackInfo) {
    const todayStr = new Date(Date.now() + 8 * 3600000).toISOString().split('T')[0];
    const nowTime = new Date(Date.now() + 8 * 3600000).toISOString().replace('T', ' ').split('.')[0];
    const clientIp = request.headers.get('cf-connecting-ip') || 'Unknown';
    const clientCountry = request.headers.get('cf-ipcountry') || 'Unknown';
    const clientUa = request.headers.get('User-Agent') || 'Unknown';
    try {
      ctx.waitUntil(env.DB.batch([
        env.DB.prepare(`INSERT INTO request_stats (prefix, date, count) VALUES (?, ?, 1) ON CONFLICT(prefix, date) DO UPDATE SET count = count + 1`).bind(matchedPrefix, todayStr),
        env.DB.prepare(`UPDATE routes SET last_play = ? WHERE prefix = ?`).bind(nowTime, matchedPrefix),
        env.DB.prepare(`INSERT INTO visitor_logs (prefix, ip, country, ua) VALUES (?, ?, ?, ?)`).bind(matchedPrefix, clientIp, clientCountry, clientUa),
      ]));
    } catch(_) {}
  }

  const upgradeHeader = request.headers.get('Upgrade');
  if (upgradeHeader?.toLowerCase() === 'websocket') {
    const wsHeaders = new Headers(request.headers);
    try { wsHeaders.set('Host', new URL(upstreamUrls[0]).host); } catch (_) {}
    wsHeaders.delete('Referer');
    const wsInit = { method: request.method, headers: wsHeaders, redirect: 'follow' };
    if (preferredHost) wsInit.cf = { resolveOverride: preferredHost };
    return fetch(new Request(upstreamUrls[0], wsInit));
  }

  let requestBody = null;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    requestBody = await request.arrayBuffer();
  }

  let finalResponse = null;
  let lastError = null;
  let lastUpstreamUrl = null;

  for (let i = 0; i < upstreamUrls.length; i++) {
    let upstreamUrl;
    try {
      upstreamUrl = new URL(upstreamUrls[i]);
    } catch {
      lastError = new Error('Invalid target URL');
      continue;
    }

    if (PIKPAK_DOMAINS.some((d) => upstreamUrl.hostname.endsWith(d))) {
      return Response.redirect(new URL(upstreamUrl.pathname + upstreamUrl.search, CONFIG.pikpakProxyUrl).toString(), 301);
    }
    if (blocker.check(upstreamUrl.toString())) return Response.redirect('https://baidu.com', 301);

    const colo = request.cf?.colo;
    if (colo && JP_COLOS.includes(colo)) {
      for (const suffix in DOMAIN_PROXY_RULES) {
        if (upstreamUrl.host.endsWith(suffix)) {
          upstreamUrl.hostname = DOMAIN_PROXY_RULES[suffix];
          break;
        }
      }
    }

    const headers = new Headers(request.headers);
    headers.set('Host', upstreamUrl.host);
    headers.delete('Referer');
    const clientIp = request.headers.get('cf-connecting-ip');
    if (clientIp) {
      headers.set('x-forwarded-for', clientIp);
      headers.set('x-real-ip', clientIp);
    }
    if (compatMode) {
      headers.set('Origin', upstreamUrl.origin);
      headers.set('X-Forwarded-Proto', upstreamUrl.protocol.replace(':', ''));
      headers.set('X-Forwarded-Host', upstreamUrl.host);
    }

    const isStaticOrImage = /\.(jpg|jpeg|gif|png|svg|ico|webp|js|css|woff2?|ttf|otf|map|webmanifest|srt|ass|vtt|sub)$/i.test(upstreamUrl.pathname) ||
      /(\/Images\/|\/Icons\/|\/Branding\/|\/emby\/covers\/)/i.test(upstreamUrl.pathname);

    const fetchInit = { method: request.method, headers, redirect: compatMode ? 'follow' : 'manual' };
    const cfOpts = {};
    if (isStaticOrImage && enableCache) { cfOpts.cacheEverything = true; cfOpts.cacheTtl = 86400; }
    if (preferredHost) cfOpts.resolveOverride = preferredHost;
    if (Object.keys(cfOpts).length) fetchInit.cf = cfOpts;
    if (requestBody) fetchInit.body = requestBody;

    try {
      const response = await fetch(new Request(upstreamUrl.toString(), fetchInit));
      if (!compatMode && [502, 503, 504].includes(response.status)) {
        lastError = new Error(`HTTP ${response.status}`);
        continue;
      }
      finalResponse = response;
      lastUpstreamUrl = upstreamUrl;
      break;
    } catch (err) {
      lastError = err;
      continue;
    }
  }

  if (!finalResponse) {
    return new Response('所有线路不可用: ' + (lastError?.message || 'Unknown'), { status: 502 });
  }

  const safePrefix = matchedPrefix ? `/${matchedPrefix}` : '';

  if (!compatMode) {
    const location = finalResponse.headers.get('Location');
    if (location && finalResponse.status >= 300 && finalResponse.status < 400) {
      try {
        const redirectUrl = new URL(location, lastUpstreamUrl);
        if (redirectUrl.hostname === lastUpstreamUrl.hostname) {
          return fetch(redirectUrl.toString(), new Request(redirectUrl, { method: request.method, headers: finalResponse.headers, redirect: 'follow' }));
        }
        if (MANUAL_REDIRECT_DOMAINS.some((d) => redirectUrl.hostname.endsWith(d))) {
          const rh = new Headers(finalResponse.headers);
          rh.set('Location', redirectUrl.toString());
          return new Response(finalResponse.body, { status: finalResponse.status, headers: rh });
        }
        if (matchedPrefix) {
          const rh = new Headers(finalResponse.headers);
          rh.set('Location', `${safePrefix}/${encodeURIComponent(redirectUrl.toString())}`);
          return new Response(finalResponse.body, { status: finalResponse.status, headers: rh });
        }
        const fh = new Headers(request.headers);
        fh.set('Host', redirectUrl.host);
        fh.delete('Referer');
        const cIp = request.headers.get('cf-connecting-ip');
        if (cIp) {
          fh.set('x-forwarded-for', cIp);
          fh.set('x-real-ip', cIp);
        }
        return fetch(redirectUrl.toString(), { method: request.method, headers: fh, body: requestBody || undefined, redirect: 'follow' });
      } catch (_) {}
    }
  }

  const responseHeaders = new Headers(finalResponse.headers);
  const contentType = finalResponse.headers.get('content-type') || '';

  if (!compatMode && finalResponse.status === 200 && contentType.includes('json') && matchedPrefix) {
    const urlPath = lastUpstreamUrl.pathname.toLowerCase();
    if (urlPath.includes('playbackinfo')) {
      try {
        const data = await finalResponse.clone().json();
        let modified = false;
        if (data?.MediaSources) {
          data.MediaSources.forEach((source) => {
            ['DirectStreamUrl', 'TranscodingUrl'].forEach((key) => {
              if (source[key]?.startsWith('http')) {
                try {
                  const mediaUrl = new URL(source[key]);
                  const isDirectDomain = MANUAL_REDIRECT_DOMAINS.some(d => mediaUrl.hostname.endsWith(d));
                  if (!isDirectDomain) {
                    source[key] = proxyOrigin + safePrefix + '/' + source[key];
                    modified = true;
                  }
                } catch (_) {
                  source[key] = proxyOrigin + safePrefix + '/' + source[key];
                  modified = true;
                }
              }
            });
          });
        }
        if (modified) {
          responseHeaders.delete('Content-Length');
          return new Response(JSON.stringify(data), { status: finalResponse.status, headers: responseHeaders });
        }
      } catch (_) {}
    }
  }

  if (!compatMode && finalResponse.status === 200 && matchedPrefix) {
    const urlPath = lastUpstreamUrl.pathname.toLowerCase();
    if (urlPath.endsWith('.m3u8')) {
      try {
        const text = await finalResponse.clone().text();
        if (text.includes('http://') || text.includes('https://')) {
          const modifiedText = text.replace(/(https?:\/\/[^\s]+)/g, (match) => {
            try {
              const mUrl = new URL(match);
              const isDirectDomain = MANUAL_REDIRECT_DOMAINS.some(d => mUrl.hostname.endsWith(d));
              return isDirectDomain ? match : proxyOrigin + safePrefix + '/' + match;
            } catch (_) {
              return proxyOrigin + safePrefix + '/' + match;
            }
          });
          responseHeaders.delete('Content-Length');
          return new Response(modifiedText, { status: finalResponse.status, headers: responseHeaders });
        }
      } catch (_) {}
    }
  }

  if (CONFIG.cacheEnabled) {
    if (contentType.includes('image/') || contentType.includes('text/css') || contentType.includes('application/javascript')) {
      responseHeaders.set('Cache-Control', 'public, max-age=86400');
    } else if (contentType.includes('video/') || contentType.includes('audio/')) {
      responseHeaders.set('Cache-Control', 'public, max-age=3600');
    } else {
      responseHeaders.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }

  responseHeaders.set('Access-Control-Allow-Origin', '*');
  responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  responseHeaders.set('Access-Control-Allow-Headers', '*');
  responseHeaders.set('X-Content-Type-Options', 'nosniff');

  return new Response(finalResponse.body, {
    status: finalResponse.status,
    statusText: finalResponse.statusText,
    headers: responseHeaders,
  });
}

// 公共 head 资源：favicon + 科技感字体（Chakra Petch 展示 / Share Tech Mono 数据）
const HEAD_LINK = `<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='12' fill='%2305070d'/><rect x='20' y='20' width='24' height='24' fill='none' stroke='%2300e5ff' stroke-width='3' transform='rotate(45 32 32)'/><circle cx='32' cy='32' r='4' fill='%2300ff9d'/></svg>"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;500;600;700&family=Share+Tech+Mono&display=swap" rel="stylesheet">`;

// HUD 科技感主题：深空底 + 电光青/荧光绿、网格背景、切角按钮、角标卡片
const PAGE_STYLE = `
  :root{--bg-0:#05070d;--cyan:#00e5ff;--green:#00ff9d;--amber:#ffb454;--red:#ff5c7a;--text:#cfdfee;--dim:#5d7290;--bright:#eef6ff;--line:rgba(0,229,255,.18);--line-dim:rgba(120,150,190,.13);--fd:'Chakra Petch','Microsoft YaHei','PingFang SC',sans-serif;--fm:'Share Tech Mono','Consolas','Courier New',monospace;}
  *{box-sizing:border-box}
  html{-webkit-text-size-adjust:100%}
  body{font-family:var(--fd);line-height:1.65;color:var(--text);margin:0;min-height:100vh;overflow-x:hidden;background:radial-gradient(ellipse 90% 55% at 50% -12%,rgba(0,229,255,.09),transparent 70%),radial-gradient(ellipse 55% 40% at 95% 108%,rgba(0,255,157,.05),transparent 70%),var(--bg-0);}
  body::before{content:'';position:fixed;inset:0;z-index:-1;pointer-events:none;background-image:linear-gradient(rgba(0,229,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(0,229,255,.035) 1px,transparent 1px);background-size:44px 44px;-webkit-mask-image:radial-gradient(ellipse 75% 65% at 50% 30%,#000,transparent);mask-image:radial-gradient(ellipse 75% 65% at 50% 30%,#000,transparent);}
  .scanline{position:fixed;left:0;right:0;top:0;height:1px;z-index:9998;pointer-events:none;background:linear-gradient(90deg,transparent 2%,rgba(0,229,255,.35) 50%,transparent 98%);animation:scanMove 9s linear infinite;opacity:.5;}
  @keyframes scanMove{0%{transform:translateY(0)}100%{transform:translateY(100vh)}}
  @media(prefers-reduced-motion:reduce){.scanline{display:none}.card,.login-box{animation:none!important}}

  .container{max-width:1180px;margin:auto;padding:28px 20px;display:flex;flex-direction:column;gap:22px;}
  .card{position:relative;background:linear-gradient(160deg,rgba(13,20,40,.86),rgba(8,12,24,.92));backdrop-filter:blur(12px);padding:26px 28px;border-radius:4px;border:1px solid var(--line-dim);box-shadow:0 24px 60px rgba(0,0,0,.45);animation:riseIn .55s cubic-bezier(.2,.7,.3,1) backwards;}
  .container>.card:nth-child(2){animation-delay:.08s}
  .container>.card:nth-child(3){animation-delay:.16s}
  .container>.card:nth-child(4){animation-delay:.24s}
  .container>.card:nth-child(5){animation-delay:.32s}
  @keyframes riseIn{from{opacity:0;transform:translateY(16px)}}
  .card::before,.card::after{content:'';position:absolute;width:22px;height:22px;border:1px solid rgba(0,229,255,.5);pointer-events:none;transition:width .25s,height .25s,border-color .25s;}
  .card::before{top:-1px;left:-1px;border-right:none;border-bottom:none;}
  .card::after{bottom:-1px;right:-1px;border-left:none;border-top:none;}
  .card:hover::before,.card:hover::after{width:32px;height:32px;border-color:var(--cyan);}

  h1{margin:0;color:var(--bright);font-size:clamp(1.5em,4vw,2em);font-weight:700;letter-spacing:.06em;line-height:1.3;}
  h2{color:var(--bright);font-size:1.05em;font-weight:600;letter-spacing:.1em;margin:0 0 14px;padding-bottom:12px;border-bottom:1px solid var(--line-dim);position:relative;}
  h2::after{content:'';position:absolute;left:0;bottom:-1px;width:44px;height:1px;background:var(--cyan);box-shadow:0 0 8px var(--cyan);}
  .h2-en{float:right;color:#3a4d6b;font-family:var(--fm);font-size:11px;letter-spacing:.22em;font-weight:400;line-height:inherit;}
  code{font-family:var(--fm);background:rgba(0,229,255,.08);padding:3px 9px;border-radius:3px;color:var(--cyan);word-break:break-all;font-size:.88em;border:1px solid rgba(0,229,255,.14);}
  .muted{color:var(--dim);font-size:13.5px;}

  .stat-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:14px;margin:18px 0;}
  .stat-card{background:linear-gradient(170deg,rgba(0,229,255,.07),rgba(0,229,255,.02));border:1px solid rgba(0,229,255,.16);border-radius:4px;padding:18px 14px;text-align:center;position:relative;overflow:hidden;transition:transform .2s,box-shadow .2s;}
  .stat-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,var(--cyan),transparent);opacity:.7;}
  .stat-card:hover{transform:translateY(-3px);box-shadow:0 14px 34px rgba(0,229,255,.13);}
  .stat-card>div:first-child{color:var(--dim);font-size:12px;letter-spacing:.15em;}
  .stat-val{font-family:var(--fm);font-size:clamp(1.8em,6vw,2.2em);color:var(--cyan);text-shadow:0 0 18px rgba(0,229,255,.45);margin-top:4px;}

  #domain-table-wrap,#daily-table,#adminDomainResult,#inviteList{overflow-x:auto;-webkit-overflow-scrolling:touch;}
  table{width:100%;border-collapse:collapse;font-size:13.5px;min-width:500px;}
  th,td{padding:11px 14px;text-align:left;border-bottom:1px solid rgba(120,150,190,.1);white-space:nowrap;}
  th{color:var(--cyan);font-family:var(--fm);font-weight:400;font-size:11.5px;letter-spacing:.14em;text-transform:uppercase;background:rgba(0,229,255,.05);}
  td{font-family:var(--fm);}
  tbody tr:hover td{background:rgba(0,229,255,.03);}
  tr.best td{background:rgba(0,255,157,.07);}
  tr.best td:first-child{box-shadow:inset 3px 0 0 var(--green);}

  .tag{display:inline-flex;align-items:center;padding:2px 10px;border-radius:2px;font-size:11.5px;font-weight:600;letter-spacing:.08em;font-family:var(--fm);}
  .tag::before{content:'';width:5px;height:5px;border-radius:50%;margin-right:6px;background:currentColor;box-shadow:0 0 6px currentColor;}
  .tag-fast{background:rgba(0,255,157,.1);color:var(--green);border:1px solid rgba(0,255,157,.3);}
  .tag-good{background:rgba(0,229,255,.1);color:var(--cyan);border:1px solid rgba(0,229,255,.3);}
  .tag-slow{background:rgba(255,180,84,.1);color:var(--amber);border:1px solid rgba(255,180,84,.3);}
  .tag-timeout{background:rgba(255,92,122,.1);color:var(--red);border:1px solid rgba(255,92,122,.3);}

  .edge-box{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px;}
  .edge-item{background:rgba(5,8,16,.55);padding:14px 16px;border-radius:3px;font-size:13.5px;font-family:var(--fm);border:1px solid rgba(120,150,190,.1);border-left:2px solid rgba(0,229,255,.4);}
  .edge-item strong{color:var(--dim);display:block;margin-bottom:5px;font-size:10.5px;text-transform:uppercase;letter-spacing:.18em;font-weight:400;}

  .btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:11px 22px;color:#02141a;border-radius:2px;text-decoration:none;font-weight:600;border:none;cursor:pointer;font-size:13.5px;letter-spacing:.06em;font-family:var(--fd);position:relative;transition:all .18s;background:linear-gradient(135deg,#2eeaff 0%,#00b8d9 100%);clip-path:polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px);filter:drop-shadow(0 4px 14px rgba(0,229,255,.22));}
  .btn:hover{background:linear-gradient(135deg,#7df3ff 0%,#00e5ff 100%);filter:drop-shadow(0 8px 22px rgba(0,229,255,.35));transform:translateY(-1px);}
  .btn:active{transform:translateY(0);}
  .btn:disabled{opacity:.5;cursor:not-allowed;filter:none;transform:none;}
  .btn-outline{background:rgba(0,229,255,.06);border:1px solid var(--line);color:var(--cyan);clip-path:none;filter:none;box-shadow:none;}
  .btn-outline:hover{background:rgba(0,229,255,.14);border-color:var(--cyan);filter:none;transform:translateY(-1px);}
  .btn-del{background:rgba(255,92,122,.08);border:1px solid rgba(255,92,122,.35);color:var(--red);clip-path:none;filter:none;box-shadow:none;}
  .btn-del:hover{background:rgba(255,92,122,.18);border-color:var(--red);filter:none;transform:translateY(-1px);}
  .btn-sm{padding:8px 15px;font-size:12.5px;}

  .warn{border:1px solid rgba(255,92,122,.4);border-left:3px solid var(--red);padding:16px 20px;border-radius:3px;color:#f2a5b5;background:rgba(255,92,122,.07);}

  input[type=password],input[type=text],input[type=url],select{width:100%;padding:13px 15px;border:1px solid var(--line-dim);border-radius:3px;background:rgba(5,9,18,.65);color:var(--bright);margin-bottom:15px;font-size:14px;font-family:var(--fd);transition:border-color .18s,box-shadow .18s;caret-color:var(--cyan);}
  input::placeholder{color:#44587a;}
  input:focus,select:focus{outline:none;border-color:var(--cyan);box-shadow:0 0 0 3px rgba(0,229,255,.1);}
  label{display:block;font-weight:600;margin-bottom:8px;font-size:12px;color:var(--dim);text-transform:uppercase;letter-spacing:.16em;}

  .toolbar{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px;align-items:center;}

  .route-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(360px,100%),1fr));gap:16px;}
  .route-item{background:linear-gradient(165deg,rgba(13,20,40,.9),rgba(7,11,22,.95));border:1px solid var(--line-dim);border-radius:3px;padding:20px 22px;transition:all .25s;position:relative;overflow:hidden;}
  .route-item::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,var(--cyan),transparent 70%);opacity:.5;transition:opacity .25s;}
  .route-item:hover{transform:translateY(-3px);border-color:rgba(0,229,255,.35);box-shadow:0 18px 44px rgba(0,0,0,.5);}
  .route-item:hover::before{opacity:1;}
  .route-header{display:flex;align-items:center;gap:12px;margin-bottom:14px;}
  .route-title{flex:1;}
  .route-name{font-size:1.14em;font-weight:600;color:var(--bright);margin:0 0 3px;letter-spacing:.02em;}
  .route-path{color:var(--cyan);font-family:var(--fm);font-size:.88em;}
  .route-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px;padding-top:14px;border-top:1px solid rgba(120,150,190,.1);}
  .target-list{margin-top:10px;}
  .target-row{background:rgba(4,7,15,.6);border:1px solid rgba(120,150,190,.1);border-radius:3px;padding:10px 14px;margin-bottom:7px;display:flex;justify-content:space-between;align-items:center;gap:10px;transition:border-color .18s;font-size:12.5px;}
  .target-row:hover{border-color:rgba(0,229,255,.25);}
  .target-url{color:var(--dim);word-break:break-all;flex:1;}
  .target-latency{font-family:var(--fm);white-space:nowrap;}
  .route-meta{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px;}
  .meta-tag{font-size:10.5px;padding:3px 9px;background:rgba(120,150,190,.08);border:1px solid rgba(120,150,190,.15);border-radius:2px;color:var(--dim);font-family:var(--fm);letter-spacing:.05em;}
  .meta-tag-on{background:rgba(0,255,157,.08);border-color:rgba(0,255,157,.25);color:var(--green);}
  .meta-tag-warn{background:rgba(255,180,84,.1);border-color:rgba(255,180,84,.3);color:var(--amber);}

  .modal{display:none;position:fixed;inset:0;background:rgba(3,5,10,.82);backdrop-filter:blur(10px);z-index:1000;padding:20px;overflow:auto;animation:fadeIn .2s ease;}
  @keyframes fadeIn{from{opacity:0}}
  .modal.show{display:flex;align-items:center;justify-content:center;}
  .modal-inner{background:linear-gradient(170deg,rgba(13,20,40,.97),rgba(7,11,22,.98));padding:30px 32px;border-radius:4px;max-width:560px;width:100%;border:1px solid var(--line);box-shadow:0 30px 80px rgba(0,0,0,.6);animation:slideUp .3s cubic-bezier(.2,.7,.3,1);position:relative;}
  .modal-inner::before{content:'';position:absolute;top:-1px;left:-1px;width:26px;height:26px;border-top:1px solid var(--cyan);border-left:1px solid var(--cyan);}
  .modal-inner::after{content:'';position:absolute;bottom:-1px;right:-1px;width:26px;height:26px;border-bottom:1px solid var(--cyan);border-right:1px solid var(--cyan);}
  @keyframes slideUp{from{opacity:0;transform:translateY(24px)}}
  .modal-header{margin-bottom:22px;}
  .modal-title{font-size:1.25em;font-weight:600;color:var(--bright);margin:0;letter-spacing:.05em;}
  .modal-title::before{content:'//';color:var(--cyan);margin-right:.4em;font-family:var(--fm);}
  .modal-desc{color:var(--dim);font-size:13px;margin:8px 0 0;}
  .modal-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:26px;padding-top:18px;border-top:1px solid rgba(120,150,190,.12);}

  .search-box{position:relative;flex:1;min-width:200px;}
  .search-box input{margin-bottom:0;padding-left:40px;}
  .search-icon{position:absolute;left:14px;top:50%;transform:translateY(-50%);color:var(--dim);pointer-events:none;font-size:14px;}

  .empty-state{text-align:center;padding:44px 20px;color:var(--dim);grid-column:1/-1;}
  .empty-state-icon{display:block;width:44px;height:44px;margin:0 auto 16px;border:1.5px dashed rgba(0,229,255,.4);transform:rotate(45deg);opacity:.7;}
  .empty-state-text{font-size:1em;margin:0;}

  .form-group{margin-bottom:18px;}
  .form-group label{display:block;color:var(--dim);margin-bottom:8px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.16em;}
  .form-group input,.form-group select{width:100%;padding:13px 15px;border:1px solid var(--line-dim);border-radius:3px;background:rgba(5,9,18,.65);color:var(--bright);font-size:14px;transition:border-color .18s,box-shadow .18s;margin-bottom:0;font-family:var(--fd);}
  .form-group input:focus,.form-group select:focus{outline:none;border-color:var(--cyan);box-shadow:0 0 0 3px rgba(0,229,255,.1);}
  .form-hint{color:#46587a;font-size:12px;margin:8px 0 0;}
  .form-hint span{color:var(--cyan);font-family:var(--fm);}

  .checkbox-label{display:flex!important;align-items:center;gap:10px!important;text-transform:none!important;letter-spacing:normal!important;cursor:pointer;font-size:14px;color:var(--text);font-weight:400;}
  .checkbox-label input[type="checkbox"]{width:17px!important;height:17px;accent-color:var(--cyan);cursor:pointer;flex-shrink:0;}

  #toast{position:fixed;top:-70px;left:50%;transform:translateX(-50%);background:rgba(8,13,26,.95);backdrop-filter:blur(12px);color:var(--bright);padding:12px 26px;border-radius:3px;font-size:13.5px;letter-spacing:.04em;transition:top .4s cubic-bezier(.175,.885,.32,1.275);z-index:9999;border:1px solid var(--line);border-left:3px solid var(--cyan);box-shadow:0 14px 40px rgba(0,0,0,.5);}
  #toast.show{top:18px;}

  .target-inputs{display:flex;flex-direction:column;gap:10px;}
  .target-input-row{display:flex;gap:8px;align-items:center;}
  .target-input-row input{flex:1;margin-bottom:0;}
  .btn-remove{background:rgba(255,92,122,.08);border:1px solid rgba(255,92,122,.3);color:var(--red);padding:10px 14px;border-radius:3px;cursor:pointer;font-size:15px;flex-shrink:0;transition:background .18s;}
  .btn-remove:hover{background:rgba(255,92,122,.2);}

  .page-hero{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;}
  .brand{display:flex;align-items:center;gap:15px;min-width:0;}
  .brand-mark{width:44px;height:44px;position:relative;flex-shrink:0;}
  .brand-mark::before{content:'';position:absolute;inset:7px;border:1.5px solid var(--cyan);transform:rotate(45deg);box-shadow:0 0 16px rgba(0,229,255,.35),inset 0 0 8px rgba(0,229,255,.15);}
  .brand-mark::after{content:'';position:absolute;top:50%;left:50%;width:8px;height:8px;background:var(--green);transform:translate(-50%,-50%) rotate(45deg);box-shadow:0 0 12px var(--green);animation:pulseMark 2.4s ease-in-out infinite;}
  @keyframes pulseMark{50%{opacity:.3}}
  .brand-name{color:var(--bright);font-size:clamp(1.15em,3.5vw,1.4em);font-weight:600;letter-spacing:.08em;line-height:1.25;}
  .brand-sub{color:var(--dim);font-size:11px;font-family:var(--fm);letter-spacing:.16em;text-transform:uppercase;margin-top:2px;}
  .badge{display:inline-block;vertical-align:middle;font-family:var(--fm);font-size:11px;color:var(--cyan);border:1px solid rgba(0,229,255,.3);padding:1px 8px;border-radius:2px;letter-spacing:.1em;background:rgba(0,229,255,.06);margin-left:8px;}

  .login-title{text-align:center;font-size:1.4em;font-weight:700;color:var(--bright);letter-spacing:.32em;text-indent:.32em;margin:0 0 6px;}
  .login-sub{text-align:center;color:var(--dim);font-family:var(--fm);font-size:11px;letter-spacing:.26em;text-transform:uppercase;margin:0 0 26px;}
  .login-err{color:var(--red);font-size:13px;min-height:1.3em;margin:0 0 12px;font-family:var(--fm);}
  .login-link{text-align:center;margin:16px 0 0;font-size:13.5px;}
  .login-link a{color:var(--cyan);text-decoration:none;border-bottom:1px dashed rgba(0,229,255,.4);padding-bottom:1px;transition:all .18s;}
  .login-link a:hover{color:#7df3ff;border-bottom-style:solid;}

  @media(max-width:640px){
    .container{padding:16px 12px;gap:16px;}
    .card{padding:18px 16px;}
    .modal{padding:12px;}
    .modal-inner{padding:22px 18px;}
    table{font-size:12.5px;}
    th,td{padding:9px 10px;}
    .route-item{padding:16px;}
    .stat-card{padding:14px 10px;}
    .page-hero{align-items:flex-start;}
  }
`;

function buildFrontendHtml() {
  const domainListJson = JSON.stringify(OPTIMIZED_DOMAINS);
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Emby 反代 | 智能优选</title>${HEAD_LINK}<style>${PAGE_STYLE}</style></head><body>
<div class="scanline"></div>
<div class="container">
  <div class="card">
    <div class="page-hero">
      <div class="brand">
        <div class="brand-mark"></div>
        <div>
          <div class="brand-name">EMBY PROXY<span class="badge">v${CURRENT_VERSION}</span></div>
          <div class="brand-sub">Cloudflare Edge · Intelligent Routing</div>
        </div>
      </div>
      <a href="/admin" class="btn btn-outline">控制台</a>
    </div>
  </div>
  <div class="card">
    <h2>当前边缘节点<span class="h2-en">EDGE NODE</span></h2>
    <div id="edge-loading" class="muted">INITIALIZING...</div>
    <div id="edge-info" class="edge-box" style="display:none"></div>
  </div>
  <div class="card">
    <h2>优选域名测速<span class="h2-en">LATENCY SCAN</span></h2>
    <p class="muted" style="margin:0 0 14px">用户网络 → 优选入口延迟，按延迟排序；同网段 IP 一小时内复用缓存结果</p>
    <div class="toolbar" style="margin-bottom:14px"><button class="btn" id="btn-retest">重新测速</button><span id="speed-status" class="muted"></span></div>
    <div id="domain-table-wrap"><p class="muted" id="domain-loading">SCANNING...</p></div>
  </div>
  <div class="card">
    <h2>使用格式<span class="h2-en">QUICK START</span></h2>
    <p style="margin:0 0 12px"><code>https://你的域名/别名</code></p>
    <p style="margin:0 0 16px"><code>https://你的域名/https://emby.example.com:8096</code></p>
    <div class="warn">添加服务后请务必手动测试。恶意刷接口将封禁 IP。</div>
  </div>
  <div class="card">
    <h2>使用统计（近30天）<span class="h2-en">STATISTICS</span></h2>
    <div id="stats-loading" class="muted">LOADING...</div>
    <div id="stats-body" style="display:none">
      <div class="stat-row">
        <div class="stat-card"><div>播放次数</div><div class="stat-val" id="st-play">0</div></div>
        <div class="stat-card"><div>获取链接</div><div class="stat-val" id="st-pb">0</div></div>
      </div>
      <div id="daily-table"></div>
    </div>
  </div>
</div>
<script>
const OPT_DOMAINS = ${domainListJson};
const TAG = { fast:'极快', good:'良好', slow:'较慢', timeout:'超时' };
const CLS = { fast:'tag-fast', good:'tag-good', slow:'tag-slow', timeout:'tag-timeout' };

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
      ['落地 COLO', d.egressColo],
    ].map(([k,v]) => '<div class="edge-item"><strong>'+k+'</strong>'+ (v||'—') +'</div>').join('');
  } catch(e) { document.getElementById('edge-loading').textContent = '加载失败'; }
}

function renderDomainTable(results, best) {
  const wrap = document.getElementById('domain-table-wrap');
  if (!results.length) { wrap.innerHTML = '<p class="muted">无数据</p>'; return; }
  let html = '<table><thead><tr><th>#</th><th>名称</th><th>域名</th><th>延迟</th><th>状态</th></tr></thead><tbody>';
  results.forEach((r, i) => {
    const host = r.host || (r.subdomain+'.'+r.domain);
    const isBest = best && best === host;
    html += '<tr class="'+(isBest?'best':'')+'"><td>'+(i+1)+'</td><td>'+ (r.name||r.display_name||'') +'</td><td><code>'+host+'</code></td><td>'+(r.latency>=0?r.latency+' ms':'—')+'</td><td><span class="tag '+CLS[r.status||'timeout']+'">'+(TAG[r.status]||'—')+'</span></td></tr>';
  });
  wrap.innerHTML = html + '</tbody></table>';
}

function pingMs(url, timeout) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const timer = setTimeout(() => resolve(-1), timeout || 7000);
    const done = (ms) => { clearTimeout(timer); resolve(ms >= 0 && ms < (timeout || 7000) ? ms : -1); };
    fetch(url, { mode: 'no-cors', cache: 'no-store', credentials: 'omit' })
      .then(() => done(Math.round(performance.now() - t0)))
      .catch(() => {
        const img = new Image();
        const t1 = performance.now();
        const t2 = setTimeout(() => done(-1), 5000);
        const end = () => { clearTimeout(t2); done(Math.round(performance.now() - t1)); };
        img.onload = end;
        img.onerror = end;
        img.src = url + (url.indexOf('?') >= 0 ? '&' : '?') + '_=' + Date.now();
      });
  });
}

async function probeDomain(item) {
  const host = item.subdomain ? item.subdomain + '.' + item.domain : item.domain;
  const paths = ['/cdn-cgi/trace', '/favicon.ico', '/'];
  for (const p of paths) {
    const ms = await pingMs('https://' + host + p, 7000);
    if (ms >= 0) {
      const status = ms < 100 ? 'fast' : ms < 300 ? 'good' : 'slow';
      return { subdomain: item.subdomain, domain: item.domain, name: item.name, host, latency: ms, status, source: 'client' };
    }
  }
  try {
    const r = await fetch('/api/ping-host?host=' + encodeURIComponent(host));
    const d = await r.json();
    if (d.ms >= 0) {
      const status = d.ms < 100 ? 'fast' : d.ms < 300 ? 'good' : 'slow';
      return { subdomain: item.subdomain, domain: item.domain, name: item.name, host, latency: d.ms, status, source: 'edge' };
    }
  } catch (_) {}
  return { subdomain: item.subdomain, domain: item.domain, name: item.name, host, latency: -1, status: 'timeout', source: 'none' };
}

function finalizeResults(rows) {
  rows.forEach(r => { if (r.latency >= 0) r.status = r.latency < 100 ? 'fast' : r.latency < 300 ? 'good' : 'slow'; else r.status = 'timeout'; });
  rows.sort((a,b) => { if (a.latency<0) return 1; if (b.latency<0) return -1; return a.latency-b.latency; });
  return rows;
}

async function runDomainSpeed(force) {
  const st = document.getElementById('speed-status');
  const wrap = document.getElementById('domain-table-wrap');
  if (!force) {
    try {
      const cached = await fetch('/api/domains/speed');
      const data = await cached.json();
      if (data.cached && data.results?.length) {
        st.textContent = '已使用缓存（约1小时有效）';
        renderDomainTable(data.results, data.best);
        return;
      }
    } catch(e) {}
  }
  st.textContent = '加载边缘测速...';
  wrap.innerHTML = '<p class="muted">测速中...</p>';
  let results = [];
  try {
    const er = await fetch('/api/domains/speed?edge=1');
    const ed = await er.json();
    if (ed.results?.length) {
      results = ed.results;
      finalizeResults(results);
      renderDomainTable(results, ed.best);
      st.textContent = '边缘测速完成，正在用您的网络复测...';
    }
  } catch (_) {}
  const clientResults = await Promise.all(OPT_DOMAINS.map(probeDomain));
  finalizeResults(clientResults);
  const clientOk = clientResults.filter(r => r.latency >= 0).length;
  if (clientOk > 0) {
    results = clientResults;
    st.textContent = '浏览器测速完成（' + clientOk + '/12 可用）';
    try {
      await fetch('/api/domains/speed', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ results }) });
    } catch(e) {}
  } else if (!results.length) {
    st.textContent = '测速失败，请检查网络或稍后重试';
  }
  const best = results.find(r => r.latency >= 0);
  renderDomainTable(results, best ? best.host : null);
  if (best && clientOk > 0) st.textContent += ' · 推荐: ' + best.host;
}

async function loadStats() {
  try {
    const r = await fetch('/stats');
    const data = await r.json();
    if (data.error) { document.getElementById('stats-loading').textContent = data.error; return; }
    document.getElementById('stats-loading').style.display = 'none';
    document.getElementById('stats-body').style.display = 'block';
    document.getElementById('st-play').textContent = data.data.total.playing;
    document.getElementById('st-pb').textContent = data.data.total.playbackInfo;
    const daily = (data.data.dailyStats||[]).slice(0,10);
    let t = '<table><tr><th>日期</th><th>播放</th><th>链接</th></tr>';
    daily.forEach(s => { t += '<tr><td>'+s.date+'</td><td>'+s.playing_count+'</td><td>'+s.playback_info_count+'</td></tr>'; });
    document.getElementById('daily-table').innerHTML = t + '</table>';
  } catch(e) { document.getElementById('stats-loading').textContent = '统计加载失败'; }
}

document.getElementById('btn-retest').onclick = () => runDomainSpeed(true);
loadEdge(); runDomainSpeed(false); loadStats();
</script></body></html>`;
}

function buildLoginHtml() {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>登录</title>${HEAD_LINK}<style>${PAGE_STYLE}
body{display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px;}
.login-box{position:relative;background:linear-gradient(170deg,rgba(13,20,40,.95),rgba(7,11,22,.97));padding:38px 34px 30px;border-radius:4px;max-width:400px;width:100%;border:1px solid var(--line);box-shadow:0 30px 80px rgba(0,0,0,.6),0 0 80px rgba(0,229,255,.06);animation:riseIn .5s ease backwards;}
.login-box::before,.login-box::after{content:'';position:absolute;width:26px;height:26px;border:1px solid var(--cyan);}
.login-box::before{top:-1px;left:-1px;border-right:none;border-bottom:none;}
.login-box::after{bottom:-1px;right:-1px;border-left:none;border-top:none;}
.login-box input{display:block;width:100%;box-sizing:border-box;margin-bottom:14px;}
@media(max-width:480px){.login-box{padding:30px 22px 24px;}}
</style></head><body><div class="scanline"></div><div class="login-box">
<div class="brand-mark" style="margin:0 auto 20px"></div>
<h1 class="login-title">管理员登录</h1>
<p class="login-sub">Admin Login</p>
<input type="text" id="loginUser" placeholder="用户名 (ADMIN_USERNAME)" autocomplete="username" onkeydown="if(event.key==='Enter')doLogin()">
<input type="password" id="loginPass" placeholder="密码 (ADMIN_PASSWORD)" autocomplete="current-password" onkeydown="if(event.key==='Enter')doLogin()">
<p id="loginErr" class="login-err"></p>
<button class="btn" style="width:100%" id="loginBtn" onclick="doLogin()">登录</button>
<p class="login-link"><a href="/register">用户注册</a></p>
<script>
async function doLogin(){
  var u=document.getElementById('loginUser').value.trim();
  var p=document.getElementById('loginPass').value;
  var err=document.getElementById('loginErr');
  err.textContent='';
  if(!u||!p){err.textContent='请填写用户名和密码';return;}
  document.getElementById('loginBtn').disabled=true;
  try{var r=await fetch('/admin/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u,password:p})});var d=await r.json();if(d.ok){location.href='/admin';return;}err.textContent=d.error||'登录失败';}catch(e){err.textContent='请求失败:'+e.message;}
  document.getElementById('loginBtn').disabled=false;
}
</script></div></body></html>`;
}

function buildAdminHtml() {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>管理后台</title>${HEAD_LINK}<style>${PAGE_STYLE}</style></head><body>
<div class="scanline"></div>
<div id="toast"></div>
<div class="container">
  <div class="card">
    <div class="page-hero">
      <div class="brand">
        <div class="brand-mark"></div>
        <div>
          <div class="brand-name">ADMIN CONSOLE</div>
          <div class="brand-sub">Route · Latency · Invite Management</div>
        </div>
      </div>
      <div style="display:flex;gap:10px">
        <a href="/" class="btn btn-outline btn-sm">首页</a>
        <button class="btn btn-del btn-sm" onclick="logout()">退出</button>
      </div>
    </div>
  </div>

  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;flex-wrap:wrap;gap:16px">
      <h2 style="border:none;margin:0;padding:0;flex:1">路由管理<span class="h2-en" style="float:none;margin-left:12px">ROUTES</span></h2>
      <div class="toolbar" style="margin:0">
        <button class="btn" onclick="openRouteModal()">添加路由</button>
        <button class="btn btn-outline" onclick="speedtestAll()">全局测速</button>
        <div class="search-box">
          <span class="search-icon">⌕</span>
          <input type="text" id="routeSearch" placeholder="搜索备注或路径..." oninput="filterRoutes()">
        </div>
      </div>
    </div>
    <div id="routeList" class="route-grid"><p class="muted">LOADING...</p></div>
  </div>

  <div class="card">
    <h2>优选域名测速<span class="h2-en">LATENCY SCAN</span></h2>
    <p class="muted" style="margin:0 0 14px">测试边缘节点到优选入口的延迟</p>
    <button class="btn" onclick="testDomains()">开始测速</button>
    <div id="adminDomainResult" style="margin-top:18px"></div>
  </div>

  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:12px">
      <h2 style="border:none;margin:0;padding:0;flex:1">邀请码管理<span class="h2-en" style="float:none;margin-left:12px">INVITE CODES</span></h2>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <select id="inviteCount" style="width:auto;margin-bottom:0;padding:10px 12px">
          <option value="1">生成 1 个</option>
          <option value="5">生成 5 个</option>
          <option value="10" selected>生成 10 个</option>
          <option value="20">生成 20 个</option>
        </select>
        <button class="btn" onclick="genInvites()">生成邀请码</button>
        <button class="btn btn-outline" onclick="copyUnusedInvites()">复制未使用</button>
      </div>
    </div>
    <p class="muted" id="inviteSummary" style="margin:0 0 12px">LOADING...</p>
    <div id="inviteList" style="max-height:320px;overflow:auto"><p class="muted">LOADING...</p></div>
  </div>
</div>

<div id="modalRoute" class="modal">
  <div class="modal-inner">
    <div class="modal-header">
      <h2 class="modal-title" id="routeModalTitle">添加路由</h2>
      <p class="modal-desc">创建路由后可通过 /路径 快捷访问目标服务</p>
    </div>
    <input type="hidden" id="oldPrefix">
    <div class="form-group">
      <label>备注名</label>
      <input id="routeRemark" placeholder="例如：我的 Emby 服务器">
    </div>
    <div class="form-group">
      <label>路径 (prefix)</label>
      <input id="routePrefix" placeholder="myemby">
      <p class="form-hint">访问路径: https://你的域名/<span id="prefixPreview">myemby</span></p>
    </div>
    <div class="form-group">
      <label>目标线路 (target)</label>
      <div id="targetInputs" class="target-inputs">
        <div class="target-input-row">
          <input type="url" class="target-url-input" placeholder="主线路地址 (如: https://emby.example.com:8096)">
          <button class="btn-remove" onclick="removeTargetInput(this)" title="移除">✕</button>
        </div>
      </div>
      <button class="btn btn-outline btn-sm" style="margin-top:8px" onclick="addTargetInput()">添加备用线路</button>
      <p class="form-hint">多个线路按顺序 failover，测速后按延迟排序优选</p>
    </div>
    <div class="form-group">
      <label class="checkbox-label">
        <input type="checkbox" id="routeCache" checked> 启用图片/静态资源缓存
      </label>
      <label class="checkbox-label" style="margin-top:12px">
        <input type="checkbox" id="routeCompat"> 兼容模式
      </label>
      <p class="form-hint">兼容模式适用于部分无法正常播放的 Emby 服务器，开启后不重写媒体流地址，由客户端直连源站播放</p>
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeModal('modalRoute')">取消</button>
      <button class="btn" onclick="saveRoute()">保存</button>
    </div>
  </div>
</div>

<script>
let allRoutes=[];

function closeModal(id){document.getElementById(id).classList.remove('show');}
function openModal(id){document.getElementById(id).classList.add('show');}

function logout(){document.cookie='admin_token=;path=/;max-age=0';location.reload();}

function showToast(msg){
  var t=document.getElementById('toast');
  if(!t){t=document.createElement('div');t.id='toast';document.body.appendChild(t);}
  t.textContent=msg;t.classList.add('show');
  setTimeout(function(){t.classList.remove('show');},2500);
}

function getLatencyInfo(ms){
  if(ms<0)return {text:'超时',cls:'tag-timeout',color:'#ff5c7a'};
  if(ms<100)return {text:'极快',cls:'tag-fast',color:'#00ff9d'};
  if(ms<300)return {text:'良好',cls:'tag-good',color:'#00e5ff'};
  return {text:'较慢',cls:'tag-slow',color:'#ffb454'};
}

function addTargetInput(){
  var container=document.getElementById('targetInputs');
  var row=document.createElement('div');
  row.className='target-input-row';
  row.innerHTML='<input type="url" class="target-url-input" placeholder="备用线路地址"><button class="btn-remove" onclick="removeTargetInput(this)" title="移除">✕</button>';
  container.appendChild(row);
}

function removeTargetInput(btn){
  var container=document.getElementById('targetInputs');
  if(container.querySelectorAll('.target-input-row').length>1){
    btn.parentElement.remove();
  }
}

async function loadRoutes(){
  const r=await fetch('/admin/api/routes');
  if(r.status===401){location.reload();return;}
  allRoutes=await r.json();
  renderRoutes(allRoutes);
}

function parseLatencies(latStr){
  if(!latStr)return {};
  try{return JSON.parse(latStr);}catch(e){return {};}
}

function renderRoutes(list){
  const el=document.getElementById('routeList');
  if(!list.length){
    el.innerHTML='<div class="empty-state" style="grid-column:1/-1"><span class="empty-state-icon"></span><p class="empty-state-text">暂无路由，点击上方按钮添加</p></div>';
    return;
  }
  el.innerHTML=list.map(r=>{
    const targets=r.target.split(',').map(s=>s.trim()).filter(Boolean);
    const latencies=parseLatencies(r.target_latencies);
    const remarkName=r.remark||'未命名';
    const cacheStatus=r.cache_img!=='off';
    const compatStatus=r.compat_mode==='on';

    let targetsHtml='';
    targets.forEach((t,idx)=>{
      const lat=latencies[t];
      const latInfo=getLatencyInfo(lat);
      const tag=idx===0?'<span class="tag tag-fast">主</span>':'<span class="tag tag-slow">备'+idx+'</span>';
      const latDisplay=typeof lat==='number'&&lat>=0?'<span class="target-latency" style="color:'+latInfo.color+'">'+lat+'ms <span class="tag '+latInfo.cls+'">'+latInfo.text+'</span></span>':'<span class="target-latency" style="color:#5d7290">未测速</span>';
      targetsHtml+='<div class="target-row">'+tag+' <span class="target-url"><code>'+t+'</code></span>'+latDisplay+'</div>';
    });

    return '<div class="route-item" data-search="'+(remarkName+' '+r.prefix).toLowerCase()+'">'+
      '<div class="route-header">'+
        '<div class="route-title">'+
          '<h3 class="route-name">'+remarkName+'</h3>'+
          '<span class="route-path">/'+r.prefix+'</span>'+
        '</div>'+
      '</div>'+
      '<div class="target-list">'+targetsHtml+'</div>'+
      '<div class="route-meta">'+
        (cacheStatus?'<span class="meta-tag meta-tag-on">缓存 ON</span>':'<span class="meta-tag">缓存 OFF</span>')+
        (compatStatus?'<span class="meta-tag meta-tag-warn">兼容模式</span>':'')+
        (r.last_play?'<span class="meta-tag">'+r.last_play+'</span>':'')+
      '</div>'+
      '<div class="route-actions">'+
        '<button class="btn btn-sm btn-outline" onclick="speedtestRoute(\\''+r.prefix+'\\')">测速</button>'+
        '<button class="btn btn-sm btn-outline" onclick="editRoute(\\''+r.prefix+'\\')">编辑</button>'+
        '<button class="btn btn-sm btn-del" onclick="delRoute(\\''+r.prefix+'\\')">删除</button>'+
      '</div>'+
    '</div>';
  }).join('');
}

function filterRoutes(){
  const q=document.getElementById('routeSearch').value.toLowerCase();
  document.querySelectorAll('.route-item').forEach(c=>{
    c.style.display=(!q||c.dataset.search.includes(q))?'block':'none';
  });
}

function openRouteModal(){
  document.getElementById('oldPrefix').value='';
  document.getElementById('routeRemark').value='';
  document.getElementById('routePrefix').value='';
  document.getElementById('routeCache').checked=true;
  document.getElementById('routeCompat').checked=false;
  document.getElementById('prefixPreview').textContent='myemby';
  document.getElementById('routeModalTitle').textContent='添加路由';
  var container=document.getElementById('targetInputs');
  container.innerHTML='<div class="target-input-row"><input type="url" class="target-url-input" placeholder="主线路地址 (如: https://emby.example.com:8096)"><button class="btn-remove" onclick="removeTargetInput(this)" title="移除">✕</button></div>';
  openModal('modalRoute');
}

function editRoute(prefix){
  const r=allRoutes.find(x=>x.prefix===prefix);
  if(!r)return;
  document.getElementById('oldPrefix').value=r.prefix;
  document.getElementById('routeRemark').value=r.remark||'';
  document.getElementById('routePrefix').value=r.prefix;
  document.getElementById('routeCache').checked=r.cache_img!=='off';
  document.getElementById('routeCompat').checked=r.compat_mode==='on';
  document.getElementById('prefixPreview').textContent=r.prefix;
  document.getElementById('routeModalTitle').textContent='编辑路由';

  var container=document.getElementById('targetInputs');
  container.innerHTML='';
  var targets=r.target.split(',').map(s=>s.trim()).filter(Boolean);
  targets.forEach(function(t){
    var row=document.createElement('div');
    row.className='target-input-row';
    row.innerHTML='<input type="url" class="target-url-input" value="'+t+'"><button class="btn-remove" onclick="removeTargetInput(this)" title="移除">✕</button>';
    container.appendChild(row);
  });
  if(!targets.length){
    var row=document.createElement('div');
    row.className='target-input-row';
    row.innerHTML='<input type="url" class="target-url-input" placeholder="主线路地址"><button class="btn-remove" onclick="removeTargetInput(this)" title="移除">✕</button>';
    container.appendChild(row);
  }
  openModal('modalRoute');
}

async function saveRoute(){
  const oldPrefix=document.getElementById('oldPrefix').value;
  const remark=document.getElementById('routeRemark').value.trim();
  const prefix=document.getElementById('routePrefix').value.trim().replace(/^\\/+|\\/+$/g,'');
  const cache_img=document.getElementById('routeCache').checked?'on':'off';
  const compat_mode=document.getElementById('routeCompat').checked?'on':'off';

  var targetInputs=document.querySelectorAll('.target-url-input');
  var targets=[];
  targetInputs.forEach(function(inp){
    var val=inp.value.trim().replace(/\\/$/g,'');
    if(val)targets.push(val);
  });
  const target=targets.join(',');

  if(!prefix){showToast('请输入路径');return;}
  if(!target){showToast('请至少填写一个主线路地址');return;}

  document.getElementById('prefixPreview').textContent=prefix||'myemby';

  const r=await fetch('/admin/api/routes',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({oldPrefix:oldPrefix,prefix:prefix,target:target,remark:remark,cache_img:cache_img,compat_mode:compat_mode})
  });
  const j=await r.json();
  if(!r.ok){showToast(j.error||'保存失败');return;}
  closeModal('modalRoute');
  showToast('保存成功');
  loadRoutes();
}

async function delRoute(prefix){
  if(!confirm('确定删除路由 /'+prefix+' ？'))return;
  await fetch('/admin/api/routes?prefix='+encodeURIComponent(prefix),{method:'DELETE'});
  showToast('已删除');
  loadRoutes();
}

async function speedtestRoute(prefix){
  showToast('测速中...');
  const r=await fetch('/admin/api/speedtest/routes?prefix='+encodeURIComponent(prefix),{method:'POST'});
  const d=await r.json();
  const ok=(d.results||[]).filter(x=>x.latency>=0).length;
  showToast('测速完成，'+ok+'条线路可用');
  loadRoutes();
}

async function speedtestAll(){
  showToast('全局测速中，请耐心等待...');
  const r=await fetch('/admin/api/speedtest/routes',{method:'POST'});
  const d=await r.json();
  showToast('全局测速完成');
  loadRoutes();
}

async function testDomains(){
  document.getElementById('adminDomainResult').innerHTML='<p class="muted">测速中...</p>';
  const r=await fetch('/admin/api/speedtest/domains',{method:'POST'});
  const d=await r.json();
  let h='<table><thead><tr><th>名称</th><th>域名</th><th>延迟</th><th>状态</th></tr></thead><tbody>';
  (d.results||[]).forEach(x=>{
    const status=getLatencyInfo(x.latency);
    h+='<tr'+(d.best===x.host?' class="best"':'')+'>'+
      '<td>'+(x.name||'—')+'</td>'+
      '<td><code>'+x.host+'</code></td>'+
      '<td>'+(x.latency>=0?x.latency+'ms':'超时')+'</td>'+
      '<td><span class="tag '+status.cls+'">'+status.text+'</span></td>'+
    '</tr>';
  });
  document.getElementById('adminDomainResult').innerHTML=h+'</tbody></table>';
}

document.getElementById('routePrefix').addEventListener('input',function(){
  document.getElementById('prefixPreview').textContent=this.value.trim()||'myemby';
});

let inviteData=[];
async function loadInvites(){
  try{
    const r=await fetch('/admin/api/invites');
    const d=await r.json();
    if(!d.ok){document.getElementById('inviteList').innerHTML='<p class="muted">'+(d.error||'加载失败')+'</p>';return;}
    inviteData=d.codes||[];
    document.getElementById('inviteSummary').textContent='共 '+d.total+' 个 · 已使用 '+d.used+' 个 · 剩余 '+d.remaining+' 个（上限 50）';
    if(!inviteData.length){document.getElementById('inviteList').innerHTML='<p class="muted">还没有邀请码，点上方按钮生成。</p>';return;}
    let h='<table><thead><tr><th>邀请码</th><th>状态</th><th>使用者ID</th><th>创建时间</th></tr></thead><tbody>';
    inviteData.forEach(c=>{
      h+='<tr><td><code>'+c.code+'</code></td><td>'+(c.status==='used'?'<span class="tag tag-slow">已使用</span>':'<span class="tag tag-fast">未使用</span>')+'</td><td>'+(c.used_by||'—')+'</td><td>'+(c.created_at||'—')+'</td></tr>';
    });
    document.getElementById('inviteList').innerHTML=h+'</tbody></table>';
  }catch(e){document.getElementById('inviteList').innerHTML='<p class="muted">加载失败: '+e.message+'</p>';}
}
async function genInvites(){
  const count=parseInt(document.getElementById('inviteCount').value)||10;
  const r=await fetch('/admin/api/invites/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({count})});
  const d=await r.json();
  if(d.ok){showToast('已生成 '+d.generated+' 个');loadInvites();}
  else{showToast(d.error||'生成失败');}
}
function copyUnusedInvites(){
  const unused=inviteData.filter(c=>c.status==='unused').map(c=>c.code);
  if(!unused.length){showToast('没有未使用的邀请码');return;}
  navigator.clipboard.writeText(unused.join('\\n')).then(()=>showToast('已复制 '+unused.length+' 个邀请码')).catch(()=>showToast('复制失败，请手动选择'));
}

loadRoutes();
loadInvites();
</script>
</body></html>`;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': '*',
        },
      });
    }

    if (env.DB) await initDatabase(env);

    if (url.pathname === '/__client_rtt__') {
      return new Response(null, {
        status: 204,
        headers: { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' },
      });
    }

    if (url.pathname === '/') return html(buildFrontendHtml());
    if (url.pathname === '/favicon.ico') return new Response('', { headers: { 'Content-Type': 'image/x-icon' } });
    if (url.pathname.startsWith('/cdn-cgi/')) return new Response('Not Found', { status: 404 });

    if (url.pathname === '/health') {
      return json({ status: 'ok', version: CURRENT_VERSION, colo: request.cf?.colo, timestamp: new Date().toISOString() });
    }

    if (url.pathname === '/stats') return handleStatsRequest(env);

    if (url.pathname === '/api/edge-info') return json(await getEdgeInfo(request));

    if (url.pathname === '/api/ping-host') {
      const host = (url.searchParams.get('host') || '').replace(/^https?:\/\//, '').split('/')[0];
      if (!host) return json({ ms: -1, error: 'missing host' });
      const ms = await speedtestUrl(`https://${host}/cdn-cgi/trace`, 5000);
      return json({ ms, host });
    }

    if (url.pathname === '/api/domains/speed') {
      const cacheKey = getClientCacheKey(request);
      if (request.method === 'GET') {
        if (url.searchParams.get('edge') === '1') {
          const data = await speedtestOptimizedFromEdge();
          const results = data.results.map((r) => ({
            subdomain: r.subdomain, domain: r.domain, name: r.name, host: r.host,
            latency: r.latency, status: r.status, source: 'edge',
          }));
          return json({ cached: false, edge: true, best: data.best, results });
        }
        if (!env.DB) return json({ cached: false, cacheKey, results: [] });
        const cached = await loadDomainSpeedCache(env, cacheKey);
        if (cached) return json(cached);
        return json({ cached: false, cacheKey, results: [], domains: OPTIMIZED_DOMAINS });
      }
      if (request.method === 'POST') {
        if (!env.DB) return json({ success: false, error: 'DB not bound' }, 500);
        const body = await request.json();
        const rows = (body.results || []).map((r) => ({
          subdomain: r.subdomain,
          domain: r.domain,
          name: r.name || r.display_name,
          latency: r.latency,
          status: r.status || latencyStatus(r.latency),
        }));
        await saveDomainSpeedCache(env, cacheKey, rows);
        const best = rows.filter((r) => r.latency >= 0).sort((a, b) => a.latency - b.latency)[0];
        return json({ success: true, best: best ? `${best.subdomain}.${best.domain}` : null });
      }
    }

    if (url.pathname === '/admin/api/login' && request.method === 'POST') {
      try {
        const body = await request.json();
        const username = (body.username || '').trim().toLowerCase();
        const password = body.password || '';
        return adminLoginResponse(request, env, username, password);
      } catch (e) {
        return json({ ok: false, error: e.message }, 400);
      }
    }

    if (url.pathname === '/register' || url.pathname === '/register/') {
      return html(buildRegisterHtml());
    }

    if (url.pathname === '/api/register' && request.method === 'POST') {
      if (!env.DB) return json({ error: 'DB 未绑定' }, 500);
      const body = await request.json().catch(() => ({}));
      const username = (body.username || '').trim().toLowerCase();
      const password = body.password || '';
      const invite_code = (body.invite_code || '').trim();
      if (!username || username.length < 3 || username.length > 32 || !/^[a-z0-9_]+$/.test(username)) return json({ error: '用户名需3-32位小写字母数字下划线' }, 400);
      if (!password || password.length < 6) return json({ error: '密码至少6位' }, 400);
      if (!invite_code) return json({ error: '请填写邀请码' }, 400);
      const existing = await env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
      if (existing) return json({ error: '用户名已存在' }, 409);
      const totalUsers = await env.DB.prepare('SELECT COUNT(*) as c FROM users').first();
      if (totalUsers && totalUsers.c >= 50) return json({ error: '已达最大用户数(50)' }, 409);
      const codeRow = await env.DB.prepare("SELECT id FROM invite_codes WHERE code = ? AND status = 'unused'").bind(invite_code).first();
      if (!codeRow) return json({ error: '邀请码无效或已使用' }, 400);
      const salt = genSalt();
      const hash = await hashPassword(password, salt);
      const initialRole = 'user';
      const res = await env.DB.prepare('INSERT INTO users (username, password_hash, salt, role) VALUES (?, ?, ?, ?)').bind(username, hash, salt, initialRole).run();
      const userId = res.meta.last_row_id;
      await env.DB.prepare("UPDATE invite_codes SET status = 'used', used_by = ? WHERE code = ?").bind(userId, invite_code).run();
      const token = await signSession(userId, env);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Set-Cookie': setSessionCookie(token) },
      });
    }

    if (url.pathname === '/api/login' && request.method === 'POST') {
      if (!env.DB) return json({ error: 'DB 未绑定' }, 500);
      const body = await request.json().catch(() => ({}));
      const username = (body.username || '').trim().toLowerCase();
      const password = body.password || '';
      if (!username || !password) return json({ error: '请填写完整' }, 400);

      // 管理员账号：环境变量 ADMIN_USERNAME / ADMIN_PASSWORD 匹配则直接登录为管理员
      const adminUser = getAdminCredUser(env);
      const adminPass = getAdminCredPass(env);
      if (adminUser && adminPass && username === adminUser && password === adminPass) {
        const secure = url.protocol === 'https:' ? '; Secure' : '';
        const cookie = `admin_token=${encodeURIComponent(adminPass)}; Path=/; Max-Age=2592000; SameSite=Lax${secure}`;
        return new Response(JSON.stringify({ ok: true, role: 'admin' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Set-Cookie': cookie, 'Cache-Control': 'no-store' },
        });
      }

      const u = await env.DB.prepare("SELECT id, username, password_hash, salt, role, status FROM users WHERE username = ?").bind(username).first();
      if (u && u.status === 'active') {
        const hash = await hashPassword(password, u.salt);
        if (hash === u.password_hash) {
          // ADMIN_USERS 列表中的用户名登录时自动提升为管理员（无论注册早晚）
          let role = u.role;
          if (role !== 'admin' && getAdminUsers(env).includes(username)) {
            role = 'admin';
            await env.DB.prepare("UPDATE users SET role = 'admin' WHERE id = ?").bind(u.id).run();
          }
          const token = await signSession(u.id, env);
          return new Response(JSON.stringify({ ok: true, role }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Set-Cookie': setSessionCookie(token) },
          });
        }
      }
      return json({ error: '用户名或密码错误' }, 401);
    }

    if (url.pathname === '/api/logout') {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json', 'Set-Cookie': 'user_token=; Path=/; Max-Age=0' },
      });
    }

    if (url.pathname === '/api/me') {
      if (!env.DB) return json({ error: 'DB 未绑定' }, 500);
      const u = await getUser(request, env);
      if (!u) return json({ error: '未登录' }, 401);
      return json({ ok: true, username: u.username, role: u.role });
    }

    if (url.pathname === '/api/user/domains' && request.method === 'GET') {
      if (!env.DB) return json({ error: 'DB 未绑定' }, 500);
      const u = await getUser(request, env);
      if (!u) return json({ error: '未登录' }, 401);
      const rows = await env.DB.prepare("SELECT subdomain, preferred_host, remark, status FROM user_domains WHERE user_id = ?").bind(u.id).all();
      return json({ ok: true, domains: rows.results || [] });
    }

    if (url.pathname === '/api/user/domains' && request.method === 'POST') {
      if (!env.DB) return json({ error: 'DB 未绑定' }, 500);
      const u = await getUser(request, env);
      if (!u) return json({ error: '未登录' }, 401);
      const body = await request.json().catch(() => ({}));
      const subdomain = (body.subdomain || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
      const preferred_host = (body.preferred_host || '').trim();
      const remark = (body.remark || '').trim().slice(0, 200);
      if (!subdomain || subdomain.length < 3 || subdomain.length > 32) return json({ error: '子域名需3-32位小写字母数字' }, 400);
      if (!preferred_host) return json({ error: '请填写优选域名/IP' }, 400);
      if (RESERVED_SUBDOMAINS.includes(subdomain)) return json({ error: '该子域名保留不可用' }, 409);
      const dup = await env.DB.prepare("SELECT id FROM user_domains WHERE subdomain = ?").bind(subdomain).first();
      if (dup) return json({ error: '子域名已被占用' }, 409);
      const userCount = await env.DB.prepare("SELECT COUNT(*) as c FROM user_domains WHERE user_id = ?").bind(u.id).first();
      if (userCount && userCount.c >= 5) return json({ error: '每人最多5个子域名' }, 409);
      await env.DB.prepare("INSERT INTO user_domains (user_id, subdomain, preferred_host, remark) VALUES (?, ?, ?, ?)").bind(u.id, subdomain, preferred_host, remark).run();
      return json({ ok: true });
    }

    if (url.pathname === '/api/user/domains' && request.method === 'DELETE') {
      if (!env.DB) return json({ error: 'DB 未绑定' }, 500);
      const u = await getUser(request, env);
      if (!u) return json({ error: '未登录' }, 401);
      const subdomain = url.searchParams.get('subdomain');
      if (!subdomain) return json({ error: '缺少 subdomain 参数' }, 400);
      const row = await env.DB.prepare("SELECT id FROM user_domains WHERE subdomain = ? AND user_id = ?").bind(subdomain, u.id).first();
      if (!row) return json({ error: '子域名不存在' }, 404);
      await env.DB.prepare("DELETE FROM user_domains WHERE id = ?").bind(row.id).run();
      return json({ ok: true });
    }

    if (url.pathname === '/admin' || url.pathname === '/admin/') {
      if (await hasAdminAccess(request, env)) return html(buildAdminHtml());
      const u = env.DB ? await getUser(request, env) : null;
      if (u && u.role === 'admin') return html(buildAdminHtml());
      if (u) return html(buildUserHtml(u));
      return html(buildLoginHtml());
    }

    if (url.pathname.startsWith('/admin/api/')) {
      if (!(await hasAdminAccess(request, env))) return new Response('Unauthorized', { status: 401 });
      if (!env.DB) return json({ error: 'DB 未绑定' }, 500);
      return handleAdminApi(request, env, url);
    }

    const pathFirst = url.pathname.split('/').filter(Boolean)[0]?.toLowerCase();

    // ==================== 子域名路由 ====================
    const hostname = url.hostname;
    const baseDomain = String(env.BASE_DOMAIN || '');
    if (baseDomain && hostname.endsWith('.' + baseDomain) && hostname !== baseDomain) {
      const subdomain = hostname.slice(0, hostname.length - ('.' + baseDomain).length);
      if (subdomain && subdomain.length >= 1 && subdomain.length <= 32 && /^[a-z0-9-]+$/.test(subdomain) && env.DB) {
        const row = await env.DB.prepare("SELECT subdomain, preferred_host, remark, status FROM user_domains WHERE subdomain = ?").bind(subdomain).first();
        if (row && row.status === 'active') {
          const resolved = await resolveProxyTarget(request, env, url);
          if (resolved.error) return resolved.error;
          return proxyDirectUrl(request, env, ctx, resolved.upstreamUrls, {
            enableCache: resolved.enableCache,
            compatMode: resolved.compatMode,
            matchedPrefix: resolved.matchedPrefix,
            needsSpeedTest: resolved.needsSpeedTest,
            preferredHost: row.preferred_host,
          });
        }
        return new Response('子域名不存在或未启用', { status: 404 });
      }
    }

    const looksLikeDirectUrl = url.pathname.startsWith('/http://') || url.pathname.startsWith('/https://') ||
      (pathFirst && (pathFirst.includes('.') || pathFirst.includes(':')));

    if (looksLikeDirectUrl) {
      let path = url.pathname.substring(1);
      if (path.startsWith('/')) return new Response('Invalid proxy format', { status: 400 });
      path = path.replace(/^(https?)\/(?!\/)/, '$1://');
      if (!path.startsWith('http')) path = 'https://' + path;
      try {
        const upstreamUrl = new URL(path);
        upstreamUrl.search = url.search;
        return proxyDirectUrl(request, env, ctx, [upstreamUrl.toString()], { enableCache: true });
      } catch {
        return new Response('Invalid URL format', { status: 400 });
      }
    }

    if (!env.DB) {
      return new Response('D1 数据库未绑定，路由反代不可用。仍可使用 /https://... 格式。', { status: 500 });
    }

    const resolved = await resolveProxyTarget(request, env, url);
    if (resolved.error) return resolved.error;

    return proxyDirectUrl(request, env, ctx, resolved.upstreamUrls, {
      enableCache: resolved.enableCache,
      compatMode: resolved.compatMode,
      matchedPrefix: resolved.matchedPrefix,
      needsSpeedTest: resolved.needsSpeedTest,
    });
  },
};
