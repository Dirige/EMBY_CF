/**
 * Emby 反向代理 Worker  v6.0
 * ------------------------------------------------------------------
 * 单文件 Cloudflare Worker，无需构建。
 *
 * 必需绑定：
 *   D1 数据库 -> 变量名 DB
 *
 * 环境变量（只有 5 个必填 + 1 个可选，其余全部自动推导）：
 *   ADMIN_TOKEN            管理密钥（必填）
 *   BASE_DOMAIN            完整访问域名（必填）。支持任意层级：
 *                          255432.xyz / proxy.255432.xyz / dirige.de5.net / fd.dirige.de5.net
 *                          区域（Zone）会自动按最长后缀匹配，二级/三级域名都不用拆
 *   CF_API_TOKEN           Cloudflare API 令牌（必填，一次授权就够了）
 *                          Zone.DNS:Edit + Zone.Zone:Read + Zone.Analytics:Read
 *                          + Account Analytics:Read + Account.Workers Scripts:Read
 *   TELEGRAM_BOT_TOKEN     Telegram Bot Token（必填，发日报/告警）
 *   TELEGRAM_CHAT_ID       Telegram Chat ID（必填）
 *   DNS_RECORD_NAME        可选。仅当「DNS 记录名 ≠ 访问域名」时才需要设置，
 *                          例如 BASE_DOMAIN=255432.xyz 且想用 proxy.255432.xyz 就填 proxy。
 *                          不填 = DNS 记录就是 BASE_DOMAIN 本身。
 *
 * 自动推导（不用再配）：
 *   CF_ZONE_ID / CF_ACCOUNT_ID  -> 用 BASE_DOMAIN + CF_API_TOKEN 自动查询（最长后缀匹配）
 *   统计域名 / 日报域名          -> BASE_DOMAIN 本身
 *   DNS 根域名                  -> 自动解析出的 Zone（如 dirige.de5.net）
 *
 * 兼容别名（老配置可直接沿用，不冲突）：
 *   TG_BOT_TOKEN / TG_CHAT_ID / CF_DNS_API_TOKEN / CF_ANALYTICS_TOKEN
 *   ADMIN_PASSWORD / STATS_HOSTS（STATS_HOSTS 仅作为统计域名覆盖）
 *
 * 可选 Cron（wrangler.toml 或后台「触发器」）：
 *   crons = ["0 15 * * *", "0 *\/6 * * *"]
 *   0 15 * * *  = 每天 23:00（北京时间）发送 TG 日报
 *   0 *\/6 * * * = 每 6 小时自动测速并替换 DNS（默认已开启，可在后台关闭）
 *
 * 说明：
 *   - /https://任意地址 的开放代理是刻意保留的功能，未做内网/保留地址拦截。
 *   - 统计优先写入 D1（按小时 + 路由聚合），Cloudflare GraphQL 仅作补充。
 *   - 图片/静态资源缓存按“凭据指纹”分区，字幕不缓存，避免跨用户串数据。
 */

const CURRENT_VERSION = 'v6.0';

// ==================== 常量 ====================

// 内置优选域名
const DEFAULT_OPTIMIZED_DOMAINS = [
  { domain: 'youxuan.cf.090227.xyz', name: 'CF优选-090227', isBuiltin: true },
  { domain: 'cf.877774.xyz', name: '秋名山优选', isBuiltin: true },
  { domain: 'cf.cf.cnae.top', name: 'NB优选', isBuiltin: true },
  { domain: 'saas.sin.fan', name: 'MIYU优选', isBuiltin: true },
  { domain: 'bestcf.030101.xyz', name: 'Mingyu优选', isBuiltin: true },
  { domain: 'cf.cloudflare.182682.xyz', name: 'WeTest优选', isBuiltin: true },
  { domain: 'cf.tencentapp.cn', name: '无名氏维护域名', isBuiltin: true },
  { domain: 'mfa.gov.ua', name: '乌克兰外交部', isBuiltin: true },
  { domain: 'www.shopify.com', name: 'Shopify官方', isBuiltin: true },
  { domain: 'store.ubi.com', name: '育碧商店', isBuiltin: true },
  { domain: 'staticdelivery.nexusmods.com', name: 'NexusMods', isBuiltin: true },
];

const RESERVED_ALIASES = new Set([
  'admin', 'stats', 'health', 'api', 'favicon.ico', 'cdn-cgi',
  '__client_rtt__', 'web', 'emby', 'sessions', 'playbackinfo',
  'robots.txt', 'sitemap.xml', 'ads.txt', 'security.txt',
]);

// 这些域名遇到 3xx 时直接把跳转返回给客户端，不跟随
const DEFAULT_MANUAL_REDIRECT_DOMAINS = [
  'emby.bangumi.ca', 'aliyundrive.com', 'aliyundrive.net', 'aliyuncs.com', 'alicdn.com', 'aliyun.com',
  'cdn.aliyundrive.com', 'xunlei.com', 'xlusercdn.com', 'xycdn.com', 'sandai.net', 'thundercdn.com',
  '115.com', '115cdn.com', '115cdn.net', 'anxia.com', '189.cn', 'mini189.cn', 'ctyunxs.cn',
  'cloud.189.cn', 'tianyiyun.com', 'telecomjs.com', 'quark.cn', 'quarkdrive.cn', 'uc.cn', 'ucdrive.cn',
  'xiaoya.pro', 'myqcloud.com', 'cloudfront.net', 'akamaized.net', 'fastly.net', 'hwcdn.net', 'bytecdn.cn', 'bdcdn.net',
];

const JP_COLOS = ['NRT', 'KIX', 'FUK', 'OKA'];

const CONFIG = {
  enableStats: true,
  progressThrottleMs: 30000,
  progressMapMax: 10000,
  lastPlayThrottleMs: 60000,
  statsFlushThreshold: 20,
  statsFlushMaxAgeMs: 60000,
  routeCacheTtlMs: 45000,
  breakerThreshold: 3,
  breakerCooldownMs: 30000,
};

// ==================== 安全 Headers ====================

const SECURITY_HEADERS = Object.freeze({
  'Referrer-Policy': 'origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=15552000; preload',
  'X-Frame-Options': 'SAMEORIGIN',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
});

const HTML_CSP = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'self'";

const DROP_REQUEST_HEADERS = Object.freeze(new Set([
  'host', 'x-real-ip', 'x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto', 'forwarded',
  'connection', 'upgrade', 'transfer-encoding', 'te', 'keep-alive',
  'proxy-authorization', 'proxy-authenticate', 'trailer', 'expect',
]));

const CLIENT_IDENTITY_HEADERS = Object.freeze(new Set([
  'cf-connecting-ip', 'cf-ipcountry', 'cf-worker', 'true-client-ip',
  'x-real-ip', 'x-forwarded-for', 'forwarded', 'x-cluster-client-ip', 'client-ip',
]));

const IP_MODES = Object.freeze(['forward', 'strip', 'disable']);

const DROP_RESPONSE_HEADERS = Object.freeze(new Set([
  'access-control-allow-origin', 'access-control-allow-methods',
  'access-control-allow-headers', 'access-control-allow-credentials',
  'x-frame-options', 'strict-transport-security', 'x-content-type-options',
  'x-xss-protection', 'referrer-policy', 'x-powered-by', 'server',
]));

const REQUEST_PATTERNS = Object.freeze({
  progress: /\/Sessions\/Playing\/Progress\/?$/i,
  playingStopped: /\/Sessions\/Playing\/Stopped\/?$/i,
  playing: /\/Sessions\/Playing\/?$/i,
  imageExt: /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
  staticExt: /\.(?:js|css|woff2?|ttf|otf|map|webmanifest)$/i,
  subtitleExt: /\.(?:srt|ass|vtt|sub)$/i,
  embyImages: /(?:\/Images\/|\/Icons\/|\/Branding\/|\/emby\/covers\/)/i,
  manifestExt: /\.(?:m3u8|mpd)$/i,
  segmentExt: /\.(?:ts|m4s)$/i,
  streaming: /\.(?:mp4|m4v|m4a|ogv|webm|mkv|mov|avi|wmv|flv)$/i,
});

const NON_PROXY_PATHS = new Set([
  '/robots.txt', '/sitemap.xml', '/sitemap_index.xml', '/favicon.ico', '/humans.txt',
  '/ads.txt', '/security.txt', '/manifest.json', '/manifest.webmanifest',
  '/apple-touch-icon.png', '/browserconfig.xml', '/crossdomain.xml',
]);

// ==================== 环境变量统一入口 ====================
// 目标：只配 ADMIN_TOKEN / BASE_DOMAIN / CF_API_TOKEN / TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID
// 其余（区域 ID、账号 ID、统计域名、DNS 根域名）全部自动推导。

function envStr(env, ...keys) {
  if (!env) return '';
  for (const key of keys) {
    const v = env[key];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

function getBaseDomain(env) {
  return envStr(env, 'BASE_DOMAIN').toLowerCase().replace(/^\.+|\.+$/g, '').replace(/:\d+$/, '');
}

// 把「前缀 / @ / 完整域名」统一拼成 FQDN。
// 例：toFqdn('fd','dirige.de5.net') -> fd.dirige.de5.net
//     toFqdn('fd.dirige.de5.net','dirige.de5.net') -> fd.dirige.de5.net
//     toFqdn('@','dirige.de5.net') -> dirige.de5.net
function toFqdn(name, root) {
  const n = String(name || '').trim().toLowerCase().replace(/^\.+|\.+$/g, '');
  const r = String(root || '').trim().toLowerCase().replace(/^\.+|\.+$/g, '');
  if (!n || n === '@') return r;
  if (!r) return n;
  if (n === r || n.endsWith('.' + r)) return n;
  return n + '.' + r;
}

function getDnsRecordName(env) {
  // 可选。留空时表示「DNS 记录就是 BASE_DOMAIN 本身」，
  // 这样 BASE_DOMAIN 直接写完整域名（如 fd.dirige.de5.net）即可，不用再拆前缀。
  return envStr(env, 'DNS_RECORD_NAME').replace(/^\.+|\.+$/g, '');
}

// 统计/日报里展示的访问域名 = 完整域名
function getStatsHost(env) {
  const override = envStr(env, 'STATS_HOSTS').split(/[\s,]+/).filter(Boolean)[0] || '';
  if (override) return override;
  return toFqdn(getDnsRecordName(env), getBaseDomain(env));
}

function getCFApiToken(env) {
  return envStr(env, 'CF_API_TOKEN', 'CF_DNS_API_TOKEN', 'CF_ANALYTICS_TOKEN');
}

function getTelegramToken(env) {
  return envStr(env, 'TELEGRAM_BOT_TOKEN', 'TG_BOT_TOKEN');
}

function getTelegramChatId(env) {
  return envStr(env, 'TELEGRAM_CHAT_ID', 'TG_CHAT_ID');
}

// 区域 / 账号自动解析（CF_ZONE_ID、CF_ACCOUNT_ID 不再是必填）
let zoneInfoCache = null;

// 找到 host 所属的 Cloudflare 区域：
// 1) 先按完整名称精确查
// 2) 再列出可见区域，取「最长后缀匹配」，这样 2 级 / 3 级 / N 级域名都能正确识别
//    （例如 host=fd.dirige.de5.net 时优先匹配 dirige.de5.net，其次才是 de5.net）
async function findZoneForHost(env, host) {
  const h = String(host || '').toLowerCase().replace(/^\.+|\.+$/g, '');
  if (!h) return { zone: null, error: '域名为空' };

  const exact = await cloudflareAPICall(env, 'GET', '/zones?name=' + encodeURIComponent(h) + '&per_page=1');
  if (exact && exact.success && Array.isArray(exact.result) && exact.result[0]) {
    return { zone: exact.result[0], error: '' };
  }
  let lastError = (exact && ((exact.errors && exact.errors[0] && exact.errors[0].message) || exact.error)) || '';

  const list = await cloudflareAPICall(env, 'GET', '/zones?per_page=50');
  if (!list || !list.success || !Array.isArray(list.result)) {
    return { zone: null, error: (list && ((list.errors && list.errors[0] && list.errors[0].message) || list.error)) || lastError || '读取区域列表失败' };
  }

  let best = null;
  for (const z of list.result) {
    const name = String((z && z.name) || '').toLowerCase();
    if (!name) continue;
    if (h === name || h.endsWith('.' + name)) {
      if (!best || name.length > String(best.name).length) best = z;
    }
  }
  return { zone: best, error: best ? '' : (lastError || '未找到该域名所属区域') };
}

async function resolveZoneInfo(env, force = false) {
  const envZone = envStr(env, 'CF_ZONE_ID');
  const envAccount = envStr(env, 'CF_ACCOUNT_ID');
  const base = getBaseDomain(env);
  if (envZone && envAccount) return { zoneId: envZone, accountId: envAccount, zoneName: base };

  if (!force && zoneInfoCache && zoneInfoCache.base === base && Date.now() - zoneInfoCache.at < 600000) {
    return zoneInfoCache;
  }

  const token = getCFApiToken(env);
  if (!base) return { zoneId: envZone, accountId: envAccount, zoneName: '', base, error: '未配置 BASE_DOMAIN' };
  if (!token) return { zoneId: envZone, accountId: envAccount, zoneName: base, base, error: '未配置 CF_API_TOKEN' };

  try {
    const { zone, error } = await findZoneForHost(env, base);

    const info = {
      at: Date.now(),
      base,
      zoneId: envZone || (zone && zone.id) || '',
      accountId: envAccount || (zone && zone.account && zone.account.id) || '',
      zoneName: (zone && zone.name) || base,
      error: zone ? '' : (error || '未找到该域名所属区域'),
    };
    zoneInfoCache = info;
    return info;
  } catch (e) {
    return { zoneId: envZone, accountId: envAccount, zoneName: base, base, error: String(e?.message || e) };
  }
}

function invalidateZoneInfoCache() { zoneInfoCache = null; }

// ==================== 内存状态 ====================

const progressMap = new Map();     // 进度请求节流
const lastPlayMap = new Map();     // last_play 写入节流
const breakerMap = new Map();      // 上游熔断
const routeCache = new Map();      // 路由缓存
const STATS_BUFFER = new Map();    // D1 统计聚合缓冲
let statsPending = 0;
let statsOldestAt = 0;
let statsFlushing = null;
let dbReady = false;
let settingsCache = null;          // { at, data }
let edgeSpeedPromise = null;
let loginFailMemory = new Map();

// ==================== 基础工具 ====================

function normalizeIpMode(v) {
  const m = String(v || '').trim().toLowerCase();
  return IP_MODES.includes(m) ? m : 'forward';
}

function stripClientIdentityHeaders(headers) {
  for (const h of CLIENT_IDENTITY_HEADERS) headers.delete(h);
}

function formatBytes(bytes) {
  const b = Math.max(0, Number(bytes) || 0);
  if (!b) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(b) / Math.log(k)));
  return parseFloat((b / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatNumber(n) {
  return (Number(n) || 0).toLocaleString('zh-CN');
}

function getShanghaiParts(ts = Date.now()) {
  const d = new Date(ts + 8 * 3600000);
  const iso = d.toISOString();
  return { dateKey: iso.slice(0, 10), hour: d.getUTCHours(), ts };
}

function isValidDateKey(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
}

function addDaysToKey(dateKey, delta) {
  const d = new Date(dateKey + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function escapeHtml(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function escapeAttr(v) { return escapeHtml(v); }

function parseJsonSafe(str, fallback) {
  try { return JSON.parse(str); } catch (_) { return fallback; }
}

function getClientIp(request) {
  return request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip') || '0.0.0.0';
}

function getResponseBytes(response) {
  if (!response) return 0;
  const cl = response.headers.get('content-length');
  if (cl) {
    const n = parseInt(cl, 10);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return 0;
}

// 同站判断：只认「完全相同的主机名」或「同一可信域名边界内的主机」。
// 不按「后两段」猜根域名 —— 对 dirige.de5.net 这类共享后缀，
// 猜测会把 a.de5.net 与 b.de5.net 误判为同站，从而把 Token 转发给第三方。
function isSameSite(a, b, trustedRoot) {
  const ha = String(a || '').trim().toLowerCase().replace(/\.$/, '');
  const hb = String(b || '').trim().toLowerCase().replace(/\.$/, '');
  if (!ha || !hb) return false;
  if (ha === hb) return true;
  const root = String(trustedRoot || '').trim().toLowerCase().replace(/^\.+|\.+$/g, '');
  if (!root) return false;
  const under = (h) => h === root || h.endsWith('.' + root);
  return under(ha) && under(hb);
}

function normalizeDomain(v) {
  let s = String(v || '').trim().toLowerCase();
  s = s.replace(/^https?:\/\//, '').split('/')[0].split('?')[0];
  if (!s || s.length > 253 || s.includes('..')) return '';
  if (!/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::\d{1,5})?$/i.test(s)) return '';
  return s;
}

function normalizePrefix(p) {
  return String(p || '').trim().toLowerCase().replace(/^\/+|\/+$/g, '');
}

function validatePrefix(prefix) {
  const a = normalizePrefix(prefix);
  if (!a || !/^[a-z0-9][a-z0-9_-]{0,62}$/i.test(a)) return '路径仅允许字母数字、下划线和连字符，长度 1-63';
  if (RESERVED_ALIASES.has(a.toLowerCase())) return '该路径为系统保留，不可使用';
  return null;
}

function parseTargets(raw) {
  const list = String(raw || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!list.length) return { error: '至少填写一个目标地址' };
  if (list.length > 8) return { error: '最多支持 8 个目标地址' };
  const out = [];
  for (const t of list) {
    try {
      const u = new URL(t);
      if (!/^https?:$/.test(u.protocol)) return { error: '目标只支持 http/https：' + t };
      if (!u.hostname) return { error: '目标地址缺少主机名：' + t };
      out.push(u.toString());
    } catch (_) {
      return { error: '目标地址格式错误：' + t };
    }
  }
  return { targets: out };
}

function parseCustomHeaders(raw) {
  if (!raw) return { headers: {} };
  let obj;
  try {
    obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (_) {
    return { error: '自定义请求头必须是 JSON 对象' };
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { error: '自定义请求头必须是 JSON 对象' };
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = String(k).trim();
    if (!/^[a-z0-9-]+$/i.test(key)) return { error: '非法请求头名：' + key };
    if (DROP_REQUEST_HEADERS.has(key.toLowerCase()) || key.toLowerCase() === 'host') continue;
    out[key] = String(v).slice(0, 2000);
  }
  return { headers: out };
}

function looksLikeDirectProxy(pathname) {
  // 同时兼容 /https://host 与 /https:/host（部分客户端会合并斜杠）
  if (/^\/https?:\/\/?/i.test(pathname)) return true;
  const first = pathname.split('/').filter(Boolean)[0] || '';
  if (!first) return false;
  if (NON_PROXY_PATHS.has('/' + first.toLowerCase())) return false;
  if (first.startsWith('.')) return false;
  if (/\.(?:txt|xml|html?|json|ico|png|jpe?g|gif|svg|webp|css|js|map|woff2?|ttf|otf|php|asp|aspx)$/i.test(first)) return false;
  if (/^\d{1,3}(?:\.\d{1,3}){3}(?::\d{1,5})?$/.test(first)) return true;
  if (!first.includes('.') && !first.includes(':')) return false;
  const hostPart = first.replace(/:\d+$/, '');
  if (!/^[a-z0-9-]+(?:\.[a-z0-9-]+)+(?::\d{1,5})?$/i.test(first)) return false;
  return /[a-z]{2,}$/i.test(hostPart);
}

// ==================== 加密 / 常量时间比较 ====================

function b64urlEncode(bytes) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str) {
  let s = String(str || '').replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function sha256Hex(input) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(input)));
  const arr = new Uint8Array(buf);
  let out = '';
  for (let i = 0; i < arr.length; i++) out += arr[i].toString(16).padStart(2, '0');
  return out;
}

function timingSafeEqualStr(a, b) {
  const sa = String(a || '');
  const sb = String(b || '');
  if (sa.length !== sb.length) return false;
  let r = 0;
  for (let i = 0; i < sa.length; i++) r |= sa.charCodeAt(i) ^ sb.charCodeAt(i);
  return r === 0;
}

async function safeEqualSecret(a, b) {
  const [ha, hb] = await Promise.all([sha256Hex(a), sha256Hex(b)]);
  return timingSafeEqualStr(ha, hb);
}

// ==================== 响应工具 ====================

function applySecurityHeaders(headers) {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) headers.set(k, v);
  return headers;
}

function sanitizeResponseHeaders(upstreamHeaders) {
  const headers = new Headers();
  for (const [key, value] of upstreamHeaders.entries()) {
    if (!DROP_RESPONSE_HEADERS.has(key.toLowerCase())) headers.set(key, value);
  }
  return headers;
}

function json(data, status = 200, opts = {}) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  };
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) headers[k] = v;
  if (opts.admin) {
    headers['X-Robots-Tag'] = 'noindex, nofollow';
  } else {
    headers['Access-Control-Allow-Origin'] = '*';
    headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
    headers['Access-Control-Allow-Headers'] = '*';
  }
  return new Response(JSON.stringify(data), { status, headers });
}

function adminJson(data, status = 200) {
  return json(data, status, { admin: true });
}

function html(body, status = 200, opts = {}) {
  const headers = {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Security-Policy': HTML_CSP,
    ...SECURITY_HEADERS,
  };
  if (opts.admin) headers['X-Robots-Tag'] = 'noindex, nofollow';
  return new Response(body, { status, headers });
}

function textResponse(body, status = 200, extra = {}) {
  const headers = { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', ...SECURITY_HEADERS, ...extra };
  return new Response(body, { status, headers });
}

function getCookie(req, name) {
  const s = req.headers.get('Cookie');
  if (!s) return null;
  const m = s.match(new RegExp('(^|;\\s*)' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)'));
  if (!m) return null;
  try { return decodeURIComponent(m[2]); } catch (_) { return m[2]; }
}

function getAdminToken(env) {
  const raw = env.ADMIN_TOKEN ?? env.ADMIN_PASSWORD ?? env.admin_token ?? env.AdminToken;
  if (raw == null) return null;
  const t = String(raw).trim();
  return t.length ? t : null;
}

async function hmacKey(env) {
  const secret = getAdminToken(env) || '';
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function createAdminSession(env) {
  const payload = b64urlEncode(new TextEncoder().encode(JSON.stringify({
    exp: Date.now() + 7200 * 1000,
    nonce: crypto.randomUUID ? crypto.randomUUID() : String(Math.random()),
  })));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(env), new TextEncoder().encode(payload));
  return payload + '.' + b64urlEncode(new Uint8Array(sig));
}

async function verifyAdminSession(request, env) {
  const expected = getAdminToken(env);
  if (!expected) return false;

  // 便于脚本调用：Authorization: Bearer <ADMIN_TOKEN>
  const auth = request.headers.get('Authorization') || '';
  if (auth.toLowerCase().startsWith('bearer ')) {
    if (await safeEqualSecret(auth.slice(7).trim(), expected)) return true;
  }

  const token = getCookie(request, 'admin_session');
  if (token) {
    const parts = token.split('.');
    if (parts.length === 2) {
      try {
        const ok = await crypto.subtle.verify('HMAC', await hmacKey(env), b64urlDecode(parts[1]), new TextEncoder().encode(parts[0]));
        if (!ok) return false;
        const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[0])));
        return Number(payload.exp) > Date.now();
      } catch (_) {
        return false;
      }
    }
  }

  // 兼容旧版明文 Cookie，登录一次后会自动换成签名会话
  const legacy = getCookie(request, 'admin_token');
  if (legacy) return safeEqualSecret(legacy, expected);
  return false;
}

async function isAdmin(request, env) {
  return verifyAdminSession(request, env);
}

// ==================== 登录限流 ====================

const LOGIN_MAX_FAILS = 8;
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_BLOCK_MS = 15 * 60 * 1000;

function loginRateKey(ip) {
  return 'https://login-rate.internal/' + encodeURIComponent(String(ip || 'unknown'));
}

async function getLoginRecord(ip) {
  const key = loginRateKey(ip);
  let rec = loginFailMemory.get(key);
  if (rec && rec.until < Date.now() && rec.first < Date.now() - LOGIN_WINDOW_MS) {
    loginFailMemory.delete(key);
    rec = null;
  }
  if (rec) return rec;
  try {
    const hit = await caches.default.match(new Request(key));
    if (hit) {
      rec = await hit.json();
      if (rec) loginFailMemory.set(key, rec);
    }
  } catch (_) {}
  return rec || { count: 0, first: 0, until: 0 };
}

async function putLoginRecord(ip, rec) {
  const key = loginRateKey(ip);
  loginFailMemory.set(key, rec);
  if (loginFailMemory.size > 5000) loginFailMemory.clear();
  try {
    await caches.default.put(new Request(key), new Response(JSON.stringify(rec), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=1800' },
    }));
  } catch (_) {}
}

async function clearLoginRecord(ip) {
  const key = loginRateKey(ip);
  loginFailMemory.delete(key);
  try { await caches.default.delete(new Request(key)); } catch (_) {}
}

async function checkLoginRate(ip) {
  const now = Date.now();
  const rec = await getLoginRecord(ip);
  if (rec.until && rec.until > now) {
    return { blocked: true, retryAfter: Math.ceil((rec.until - now) / 1000) };
  }
  if (rec.first && now - rec.first > LOGIN_WINDOW_MS) {
    return { blocked: false, record: { count: 0, first: 0, until: 0 } };
  }
  return { blocked: false, record: rec };
}

async function recordLoginFailure(ip, rec) {
  const now = Date.now();
  const first = rec && rec.first && now - rec.first < LOGIN_WINDOW_MS ? rec.first : now;
  const count = (rec && rec.count ? rec.count : 0) + 1;
  const until = count >= LOGIN_MAX_FAILS ? now + LOGIN_BLOCK_MS : 0;
  await putLoginRecord(ip, { count, first, until });
  return { count, until };
}

async function adminLoginResponse(request, env, tokenFromUser) {
  const expected = getAdminToken(env);
  if (!expected) {
    return adminJson({
      ok: false,
      error: 'Worker 未读到 ADMIN_TOKEN。请在 Cloudflare 控制台 → Worker → 设置 → 变量和机密 中添加 ADMIN_TOKEN。',
    }, 503);
  }

  const ip = getClientIp(request);
  const rate = await checkLoginRate(ip);
  if (rate.blocked) {
    return adminJson({ ok: false, error: `尝试次数过多，请 ${rate.retryAfter} 秒后再试` }, 429);
  }

  const ok = await safeEqualSecret(tokenFromUser, expected);
  if (!ok) {
    const r = await recordLoginFailure(ip, rate.record);
    const left = Math.max(0, LOGIN_MAX_FAILS - r.count);
    return adminJson({ ok: false, error: left > 0 ? `密钥错误，还可尝试 ${left} 次` : '尝试次数过多，已临时封禁 15 分钟' }, 401);
  }

  await clearLoginRecord(ip);
  const session = await createAdminSession(env);
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Set-Cookie': `admin_session=${encodeURIComponent(session)}; Path=/; Max-Age=7200; HttpOnly; SameSite=Strict${secure}`,
    'X-Robots-Tag': 'noindex, nofollow',
    ...SECURITY_HEADERS,
  };
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}

function clearAdminCookies() {
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Robots-Tag': 'noindex, nofollow',
  });
  const expired = 'Path=/; Max-Age=0; HttpOnly; SameSite=Strict';
  headers.append('Set-Cookie', `admin_session=; ${expired}`);
  headers.append('Set-Cookie', `admin_token=; Path=/; Max-Age=0; SameSite=Strict`);
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}

// ==================== 运行时配置 / 数据库设置 ====================

const DEFAULT_SETTINGS = Object.freeze({
  manual_redirect_domains: DEFAULT_MANUAL_REDIRECT_DOMAINS.join(','),
  domain_proxy_rules: '{}',
  tg_bot_token: '',
  tg_chat_id: '',
  tg_daily_report: '1',
  auto_dns: '1',
  dns_record_count: '1',
  dns_root_domain: '',
  health_alerts: '1',
});

async function getAllSettings(env) {
  const now = Date.now();
  if (settingsCache && now - settingsCache.at < 30000) return settingsCache.data;
  const data = { ...DEFAULT_SETTINGS };
  if (env.DB) {
    try {
      const { results } = await env.DB.prepare('SELECT key, value FROM app_settings').all();
      for (const row of results || []) {
        if (row && row.key) data[row.key] = row.value;
      }
    } catch (_) {}
  }
  settingsCache = { at: now, data };
  return data;
}

function invalidateSettingsCache() { settingsCache = null; }

async function saveSettings(env, updates) {
  if (!env.DB) return false;
  const now = new Date().toISOString();
  const stmts = [];
  for (const [k, v] of Object.entries(updates)) {
    stmts.push(env.DB.prepare(
      `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    ).bind(k, String(v ?? ''), now));
  }
  if (stmts.length) await env.DB.batch(stmts);
  invalidateSettingsCache();
  return true;
}

async function getRuntimeConfig(env) {
  const s = await getAllSettings(env);
  const rawRedirect = (s.manual_redirect_domains || env.MANUAL_REDIRECT_DOMAINS || '')
    .split(/[\s,]+/).map(x => x.trim().toLowerCase()).filter(Boolean);
  const rulesRaw = s.domain_proxy_rules || env.DOMAIN_PROXY_RULES || '{}';
  let domainProxyRules = {};
  try { domainProxyRules = JSON.parse(rulesRaw); } catch (_) {}
  if (!domainProxyRules || typeof domainProxyRules !== 'object' || Array.isArray(domainProxyRules)) domainProxyRules = {};

  const count = Math.max(1, Math.min(5, parseInt(s.dns_record_count || '1', 10) || 1));
  const baseDomain = getBaseDomain(env);
  return {
    manualRedirectDomains: rawRedirect,
    domainProxyRules,
    tgBotToken: getTelegramToken(env) || String(s.tg_bot_token || '').trim(),
    tgChatId: getTelegramChatId(env) || String(s.tg_chat_id || '').trim(),
    tgDailyReport: String(s.tg_daily_report || '1') === '1',
    autoDns: String(s.auto_dns ?? '1') === '1',
    dnsRecordCount: count,
    dnsRootDomain: String(s.dns_root_domain || '').trim(),
    healthAlerts: String(s.health_alerts ?? '1') === '1',
    baseDomain,
    statsHost: getStatsHost(env),
    dnsRecordName: getDnsRecordName(env),
  };
}

// ==================== 数据库初始化 / 迁移 ====================

const SCHEMA_VERSION = 5;

async function initDatabase(env) {
  if (!env.DB || dbReady) return;
  try {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS schema_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`).run();
    let version = 0;
    try {
      const row = await env.DB.prepare(`SELECT value FROM schema_meta WHERE key = 'version'`).first();
      version = row ? (parseInt(row.value, 10) || 0) : 0;
    } catch (_) {}

    if (version < 1) {
      await env.DB.batch([
        env.DB.prepare(`CREATE TABLE IF NOT EXISTS routes (
          prefix TEXT PRIMARY KEY, target TEXT NOT NULL,
          remark TEXT DEFAULT '', last_play TEXT DEFAULT '',
          cache_img TEXT DEFAULT 'on', compat_mode TEXT DEFAULT 'off',
          ip_mode TEXT DEFAULT 'forward', enabled INTEGER DEFAULT 1,
          custom_headers TEXT DEFAULT '', sort_order INTEGER DEFAULT 0
        )`),
        env.DB.prepare(`CREATE TABLE IF NOT EXISTS optimized_domains (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          domain TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          is_builtin INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`),
        env.DB.prepare(`CREATE TABLE IF NOT EXISTS dns_config (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          dns_name TEXT NOT NULL,
          current_domain TEXT,
          zone_id TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`),
      ]);
      version = 1;
    }

    if (version < 2) {
      for (const col of [
        ['ip_mode', `TEXT DEFAULT 'forward'`],
        ['enabled', 'INTEGER DEFAULT 1'],
        ['custom_headers', `TEXT DEFAULT ''`],
        ['sort_order', 'INTEGER DEFAULT 0'],
      ]) {
        try { await env.DB.prepare(`ALTER TABLE routes ADD COLUMN ${col[0]} ${col[1]}`).run(); } catch (_) {}
      }
      version = 2;
    }

    if (version < 3) {
      await env.DB.batch([
        env.DB.prepare(`CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )`),
        env.DB.prepare(`CREATE TABLE IF NOT EXISTS audit_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          ts TEXT NOT NULL,
          ip TEXT NOT NULL DEFAULT '',
          action TEXT NOT NULL,
          detail TEXT NOT NULL DEFAULT ''
        )`),
      ]);
      version = 3;
    }

    if (version < 4) {
      await env.DB.prepare(`CREATE TABLE IF NOT EXISTS proxy_stats_v2 (
        bucket_date TEXT NOT NULL,
        bucket_hour INTEGER NOT NULL,
        prefix TEXT NOT NULL DEFAULT '',
        request_count INTEGER NOT NULL DEFAULT 0,
        play_count INTEGER NOT NULL DEFAULT 0,
        playback_info_count INTEGER NOT NULL DEFAULT 0,
        request_bytes INTEGER NOT NULL DEFAULT 0,
        traffic_bytes INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (bucket_date, bucket_hour, prefix)
      )`).run();
      await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_stats_prefix_date ON proxy_stats_v2(prefix, bucket_date)`).run();

      // 兼容早期创建过的不完整新表
      try {
        const v2info = await env.DB.prepare(`PRAGMA table_info(proxy_stats_v2)`).all();
        const v2cols = new Set((v2info.results || []).map(c => c.name));
        for (const [col, decl] of [
          ['play_count', 'INTEGER NOT NULL DEFAULT 0'],
          ['playback_info_count', 'INTEGER NOT NULL DEFAULT 0'],
          ['request_bytes', 'INTEGER NOT NULL DEFAULT 0'],
          ['traffic_bytes', 'INTEGER NOT NULL DEFAULT 0'],
          ['prefix', "TEXT NOT NULL DEFAULT ''"],
        ]) {
          if (!v2cols.has(col)) {
            await env.DB.prepare(`ALTER TABLE proxy_stats_v2 ADD COLUMN ${col} ${decl}`).run();
          }
        }
      } catch (e) {
        console.error('stats schema check skipped:', e && e.message);
      }

      // 把旧版 proxy_stats_hourly 的数据迁移到新表（带 prefix）
      try {
        const old = await env.DB.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='proxy_stats_hourly'`).first();
        if (old) {
          const info = await env.DB.prepare(`PRAGMA table_info(proxy_stats_hourly)`).all();
          const cols = new Set((info.results || []).map(c => c.name));
          if (cols.has('request_count') && cols.has('traffic_bytes')) {
            const reqBytesExpr = cols.has('request_bytes') ? 'request_bytes' : '0';
            const playExpr = cols.has('play_count') ? 'play_count' : '0';
            const playbackExpr = cols.has('playback_info_count') ? 'playback_info_count' : '0';
            await env.DB.prepare(
              `INSERT OR IGNORE INTO proxy_stats_v2
               (bucket_date, bucket_hour, prefix, request_count, play_count, playback_info_count, request_bytes, traffic_bytes, updated_at)
               SELECT bucket_date, bucket_hour, '', request_count, ${playExpr}, ${playbackExpr}, ${reqBytesExpr}, traffic_bytes, updated_at
               FROM proxy_stats_hourly`
            ).run();
            await env.DB.prepare(`DROP TABLE proxy_stats_hourly`).run();
          }
        }
      } catch (e) {
        console.error('stats migration skipped:', e && e.message);
      }
      version = 4;
    }

    // v5：默认开启全部功能（自动优选 DNS / 日报 / 健康告警）
    if (version < 5) {
      try {
        const now = new Date().toISOString();
        await env.DB.batch([
          env.DB.prepare(
            `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
          ).bind('auto_dns', '1', now),
          env.DB.prepare(
            `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
          ).bind('tg_daily_report', '1', now),
          env.DB.prepare(
            `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
          ).bind('health_alerts', '1', now),
        ]);
      } catch (e) {
        console.error('settings defaults skipped:', e && e.message);
      }
      invalidateSettingsCache();
      version = 5;
    }

    await env.DB.prepare(
      `INSERT INTO schema_meta (key, value) VALUES ('version', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    ).bind(String(SCHEMA_VERSION)).run();

    // 首次部署写入内置优选域名
    try {
      const { results } = await env.DB.prepare('SELECT COUNT(*) AS count FROM optimized_domains').all();
      if (results && results[0] && Number(results[0].count) === 0) {
        const stmts = DEFAULT_OPTIMIZED_DOMAINS.map(d => env.DB.prepare(
          'INSERT OR IGNORE INTO optimized_domains (domain, name, is_builtin) VALUES (?, ?, 1)'
        ).bind(d.domain, d.name));
        await env.DB.batch(stmts);
      }
      await env.DB.prepare(`DELETE FROM optimized_domains WHERE domain = 'www.visa.cn' AND is_builtin = 1`).run();
    } catch (_) {}

    dbReady = true;
  } catch (e) {
    console.error('initDatabase failed:', e && e.message);
  }
}

// ==================== 路由缓存 ====================

function clearRouteCache() { routeCache.clear(); }

async function getRouteCached(env, prefix) {
  const now = Date.now();
  const hit = routeCache.get(prefix);
  if (hit && hit.exp > now) return hit.route;
  let route = null;
  try {
    route = await env.DB.prepare('SELECT * FROM routes WHERE prefix = ?').bind(prefix).first();
  } catch (_) {}
  routeCache.set(prefix, { route: route || null, exp: now + CONFIG.routeCacheTtlMs });
  if (routeCache.size > 1000) {
    for (const [k, v] of routeCache) if (v.exp <= now) routeCache.delete(k);
    if (routeCache.size > 1000) routeCache.clear();
  }
  return route || null;
}

// ==================== D1 统计聚合 ====================

function queueStats(env, ctx, opts) {
  if (!CONFIG.enableStats || !env.DB || !ctx) return;
  const { prefix = '', category = 'other', outBytes = 0, inBytes = 0, ts = Date.now() } = opts || {};
  const { dateKey, hour } = getShanghaiParts(ts);
  const key = dateKey + '|' + hour + '|' + (prefix || '');
  let e = STATS_BUFFER.get(key);
  if (!e) {
    if (STATS_BUFFER.size > 500) {
      // 极端情况下丢弃最旧数据，避免内存无限增长
      const first = STATS_BUFFER.keys().next().value;
      if (first) STATS_BUFFER.delete(first);
    }
    e = { dateKey, hour, prefix: prefix || '', requests: 0, plays: 0, pb: 0, in: 0, out: 0 };
    STATS_BUFFER.set(key, e);
    if (!statsOldestAt) statsOldestAt = Date.now();
  }
  e.requests += 1;
  if (category === 'playing') e.plays += 1;
  if (category === 'playback_info') e.pb += 1;
  e.in += Math.max(0, Number(inBytes) || 0);
  e.out += Math.max(0, Number(outBytes) || 0);
  statsPending += 1;

  if (statsPending >= CONFIG.statsFlushThreshold || (statsOldestAt && Date.now() - statsOldestAt > CONFIG.statsFlushMaxAgeMs)) {
    ctx.waitUntil(flushStats(env));
  }
}

async function flushStats(env) {
  if (!env.DB) return;
  if (statsFlushing) return statsFlushing;
  if (!STATS_BUFFER.size) return;
  const snapshot = Array.from(STATS_BUFFER.entries());
  STATS_BUFFER.clear();
  statsPending = 0;
  statsOldestAt = 0;
  const updatedAt = new Date().toISOString();
  const stmts = snapshot.map(([, e]) => env.DB.prepare(
    `INSERT INTO proxy_stats_v2
       (bucket_date, bucket_hour, prefix, request_count, play_count, playback_info_count, request_bytes, traffic_bytes, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(bucket_date, bucket_hour, prefix) DO UPDATE SET
       request_count = request_count + excluded.request_count,
       play_count = play_count + excluded.play_count,
       playback_info_count = playback_info_count + excluded.playback_info_count,
       request_bytes = request_bytes + excluded.request_bytes,
       traffic_bytes = traffic_bytes + excluded.traffic_bytes,
       updated_at = excluded.updated_at`
  ).bind(e.dateKey, e.hour, e.prefix, e.requests, e.plays, e.pb, e.in, e.out, updatedAt));

  statsFlushing = env.DB.batch(stmts).catch(err => {
    console.error('stats flush failed:', err && err.message);
    // 失败的数据放回缓冲，下一次再写
    for (const [k, e] of snapshot) {
      const cur = STATS_BUFFER.get(k);
      if (cur) {
        cur.requests += e.requests;
        cur.plays += e.plays;
        cur.pb += e.pb;
        cur.in += e.in;
        cur.out += e.out;
      } else {
        STATS_BUFFER.set(k, e);
      }
      statsPending += e.requests;
    }
    if (!statsOldestAt) statsOldestAt = Date.now();
  }).finally(() => { statsFlushing = null; });
  return statsFlushing;
}

function touchLastPlay(env, ctx, prefix, ts) {
  if (!env.DB || !ctx || !prefix) return;
  const now = Date.now();
  const last = lastPlayMap.get(prefix) || 0;
  if (now - last < CONFIG.lastPlayThrottleMs) return;
  lastPlayMap.set(prefix, now);
  if (lastPlayMap.size > 2000) {
    for (const [k, v] of lastPlayMap) if (now - v > 10 * 60000) lastPlayMap.delete(k);
  }
  const value = new Date(ts + 8 * 3600000).toISOString().replace('T', ' ').slice(0, 19);
  ctx.waitUntil(env.DB.prepare('UPDATE routes SET last_play = ? WHERE prefix = ?').bind(value, prefix).run().catch(() => {}));
}

function classifyRequest(pathname, method) {
  if (REQUEST_PATTERNS.progress.test(pathname)) return 'progress';
  if (REQUEST_PATTERNS.playingStopped.test(pathname)) return 'playing_stop';
  if (REQUEST_PATTERNS.playing.test(pathname)) return 'playing';
  if (REQUEST_PATTERNS.embyImages.test(pathname)) return 'image';
  if (REQUEST_PATTERNS.manifestExt.test(pathname)) return 'manifest';
  if (REQUEST_PATTERNS.segmentExt.test(pathname)) return 'segment';
  if (REQUEST_PATTERNS.streaming.test(pathname)) return 'streaming';
  if (REQUEST_PATTERNS.subtitleExt.test(pathname)) return 'subtitle';
  if (REQUEST_PATTERNS.imageExt.test(pathname)) return 'image';
  if (REQUEST_PATTERNS.staticExt.test(pathname)) return 'static';
  if (/\/PlaybackInfo/i.test(pathname)) return 'playback_info';
  if (/\/emby\/(Sessions|Items|Users|System)/i.test(pathname)) return 'api';
  return 'other';
}

function isCacheableCategory(category) {
  // 字幕可能包含私人内容，明确不缓存
  return category === 'image' || category === 'static';
}

// ==================== Cloudflare GraphQL ====================

function toGraphQLStr(v) { return JSON.stringify(String(v ?? '')); }

function getAnalyticsToken(env) {
  return getCFApiToken(env);
}

async function cfFetchGraphql(apiToken, query) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`cf_http_${res.status}`);
    const data = await res.json();
    if (Array.isArray(data?.errors) && data.errors.length) {
      throw new Error(data.errors.map(e => e?.message).filter(Boolean).join('; ') || 'cf_graphql_error');
    }
    return data;
  } finally {
    clearTimeout(tid);
  }
}

async function cfGetZoneAnalytics(cfZoneId, cfApiToken, startIso, endIso) {
  const query = `query { viewer { zones(filter: { zoneTag: ${toGraphQLStr(cfZoneId)} }) { series: httpRequestsAdaptiveGroups(limit: 10000, filter: { datetime_geq: ${toGraphQLStr(startIso)}, datetime_leq: ${toGraphQLStr(endIso)} }) { count dimensions { datetimeHour } sum { edgeResponseBytes visits } } } } }`;
  const data = await cfFetchGraphql(cfApiToken, query);
  return data?.data?.viewer?.zones?.[0] || null;
}

async function cfGetWorkerRequests(cfAccountId, cfApiToken, startIso, endIso) {
  const query = `query { viewer { accounts(filter: { accountTag: ${toGraphQLStr(cfAccountId)} }) { workersInvocationsAdaptive(limit: 10000, filter: { datetime_geq: ${toGraphQLStr(startIso)}, datetime_leq: ${toGraphQLStr(endIso)} }) { dimensions { datetime scriptName status } sum { requests } } } } }`;
  const data = await cfFetchGraphql(cfApiToken, query);
  return data?.data?.viewer?.accounts?.[0] || null;
}

// ==================== D1 统计查询 ====================

async function getD1Stats(env, dateKey) {
  const empty = {
    requests: 0, plays: 0, playbackInfo: 0, requestBytes: 0, traffic: 0,
    hourly: [], topRoutes: [],
  };
  if (!env.DB) return empty;
  try {
    const totals = await env.DB.prepare(
      `SELECT COALESCE(SUM(request_count),0) requests,
              COALESCE(SUM(play_count),0) plays,
              COALESCE(SUM(playback_info_count),0) playback_info,
              COALESCE(SUM(request_bytes),0) request_bytes,
              COALESCE(SUM(traffic_bytes),0) traffic
       FROM proxy_stats_v2 WHERE bucket_date = ?`
    ).bind(dateKey).first();
    const hourly = await env.DB.prepare(
      `SELECT bucket_hour AS hour,
              COALESCE(SUM(request_count),0) requests,
              COALESCE(SUM(traffic_bytes),0) traffic
       FROM proxy_stats_v2 WHERE bucket_date = ?
       GROUP BY bucket_hour ORDER BY bucket_hour`
    ).bind(dateKey).all();
    const routes = await env.DB.prepare(
      `SELECT prefix,
              COALESCE(SUM(request_count),0) requests,
              COALESCE(SUM(play_count),0) plays,
              COALESCE(SUM(traffic_bytes),0) traffic
       FROM proxy_stats_v2 WHERE bucket_date = ?
       GROUP BY prefix ORDER BY requests DESC LIMIT 12`
    ).bind(dateKey).all();
    return {
      requests: Number(totals?.requests) || 0,
      plays: Number(totals?.plays) || 0,
      playbackInfo: Number(totals?.playback_info) || 0,
      requestBytes: Number(totals?.request_bytes) || 0,
      traffic: Number(totals?.traffic) || 0,
      hourly: (hourly.results || []).map(r => ({ hour: Number(r.hour) || 0, requests: Number(r.requests) || 0, traffic: Number(r.traffic) || 0 })),
      topRoutes: (routes.results || []).map(r => ({ prefix: r.prefix || '', requests: Number(r.requests) || 0, plays: Number(r.plays) || 0, traffic: Number(r.traffic) || 0 })),
    };
  } catch (e) {
    console.error('getD1Stats failed:', e && e.message);
    return empty;
  }
}

async function getD1DailySeries(env, days = 7) {
  if (!env.DB) return [];
  const today = getShanghaiParts().dateKey;
  const start = addDaysToKey(today, -(days - 1));
  try {
    const { results } = await env.DB.prepare(
      `SELECT bucket_date AS date,
              COALESCE(SUM(request_count),0) requests,
              COALESCE(SUM(play_count),0) plays,
              COALESCE(SUM(request_bytes),0) request_bytes,
              COALESCE(SUM(traffic_bytes),0) traffic
       FROM proxy_stats_v2 WHERE bucket_date >= ? AND bucket_date <= ?
       GROUP BY bucket_date ORDER BY bucket_date`
    ).bind(start, today).all();
    const map = new Map((results || []).map(r => [r.date, r]));
    const out = [];
    for (let i = 0; i < days; i++) {
      const key = addDaysToKey(start, i);
      const r = map.get(key);
      out.push({
        date: key,
        requests: Number(r?.requests) || 0,
        plays: Number(r?.plays) || 0,
        requestBytes: Number(r?.request_bytes) || 0,
        traffic: Number(r?.traffic) || 0,
      });
    }
    return out;
  } catch (_) {
    return [];
  }
}

async function getCFZoneSummary(env, dateKey) {
  const token = getAnalyticsToken(env);
  if (!token) return null;
  const zoneInfo = await resolveZoneInfo(env);
  const zoneId = zoneInfo.zoneId;
  if (!zoneId) return null;
  const startIso = new Date(dateKey + 'T00:00:00+08:00').toISOString();
  const endIso = new Date(new Date(dateKey + 'T00:00:00+08:00').getTime() + 86400000 - 1).toISOString();
  try {
    const zone = await cfGetZoneAnalytics(zoneId, token, startIso, endIso);
    if (!zone?.series) return null;
    let requests = 0, visits = 0, bytes = 0;
    const hourly = Array.from({ length: 24 }, () => 0);
    for (const item of zone.series) {
      const n = Number(item?.count) || 0;
      requests += n;
      visits += Number(item?.sum?.visits) || 0;
      bytes += Number(item?.sum?.edgeResponseBytes) || 0;
      const raw = item?.dimensions?.datetimeHour;
      if (raw) {
        const h = (new Date(raw).getUTCHours() + 8) % 24;
        if (h >= 0 && h < 24) hourly[h] += n;
      }
    }
    return { requests, visits, bytes, hourly };
  } catch (e) {
    return { error: String(e?.message || e).slice(0, 200) };
  }
}

async function getCFWorkerSummary(env, dateKey) {
  const token = getAnalyticsToken(env);
  if (!token) return null;
  const zoneInfo = await resolveZoneInfo(env);
  const accountId = zoneInfo.accountId;
  if (!accountId) return null;
  const startIso = new Date(dateKey + 'T00:00:00+08:00').toISOString();
  const endIso = new Date(new Date(dateKey + 'T00:00:00+08:00').getTime() + 86400000 - 1).toISOString();
  try {
    const account = await cfGetWorkerRequests(accountId, token, startIso, endIso);
    if (!account?.workersInvocationsAdaptive) return null;
    let requests = 0;
    const byScript = {};
    for (const item of account.workersInvocationsAdaptive) {
      const n = Number(item?.sum?.requests) || 0;
      requests += n;
      const name = item?.dimensions?.scriptName || 'unknown';
      byScript[name] = (byScript[name] || 0) + n;
    }
    return { requests, byScript };
  } catch (_) {
    return null;
  }
}

// ==================== Telegram ====================

function telegramTextEscape(v) {
  return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function sendTelegram(env, text, cfg) {
  const conf = cfg || await getRuntimeConfig(env);
  const token = String(conf.tgBotToken || getTelegramToken(env) || '').trim();
  const chatId = String(conf.tgChatId || getTelegramChatId(env) || '').trim();
  if (!token || !chatId) return { ok: false, error: '未配置 TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID' };
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: String(text).slice(0, 4096),
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) return { ok: false, error: data.description || ('HTTP ' + res.status) };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  } finally {
    clearTimeout(tid);
  }
}

async function buildDailyReport(env, dateKey) {
  const stats = await getD1Stats(env, dateKey);
  const cf = await getCFZoneSummary(env, dateKey);
  const worker = await getCFWorkerSummary(env, dateKey);

  const totalRequests = stats.requests || Number(cf?.requests) || 0;
  const totalTraffic = stats.traffic || Number(cf?.bytes) || 0;
  const visits = Number(cf?.visits) || 0;

  const lines = [];
  lines.push(`📊 <b>Emby Proxy 日报</b>`);
  const host = getStatsHost(env);
  if (host) lines.push(`<code>${telegramTextEscape(host)}</code>`);
  lines.push(`<code>${telegramTextEscape(dateKey)}</code>`);
  lines.push('');
  lines.push(`请求数：<b>${formatNumber(totalRequests)}</b>`);
  lines.push(`出站流量：<b>${formatBytes(totalTraffic)}</b>`);
  lines.push(`入站流量：<b>${formatBytes(stats.requestBytes)}</b>`);
  lines.push(`播放次数：<b>${formatNumber(stats.plays)}</b>`);
  lines.push(`PlaybackInfo：<b>${formatNumber(stats.playbackInfo)}</b>`);
  if (visits) lines.push(`CF 访问量：<b>${formatNumber(visits)}</b>`);
  if (worker?.requests) lines.push(`Worker 调用：<b>${formatNumber(worker.requests)}</b>`);

  if (stats.topRoutes.length) {
    lines.push('');
    lines.push(`<b>热门路由</b>`);
    for (const r of stats.topRoutes.slice(0, 8)) {
      const name = r.prefix ? '/' + r.prefix : '直连';
      lines.push(`${telegramTextEscape(name)} — ${formatNumber(r.requests)} 次 / ${formatBytes(r.traffic)}`);
    }
  }

  const daily = await getD1DailySeries(env, 7);
  if (daily.length) {
    lines.push('');
    lines.push(`<b>近 7 日</b>`);
    for (const d of daily) {
      lines.push(`${d.date}  ${formatNumber(d.requests)} 次 / ${formatBytes(d.traffic)}`);
    }
  }

  lines.push('');
  lines.push(`<i>${telegramTextEscape(new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }))}</i>`);
  return lines.join('\n');
}

async function sendDailyReport(env, dateKey) {
  // 23:00 的日报统计当天数据；显式传日期时按传入日期
  const key = dateKey || getShanghaiParts().dateKey;
  const text = await buildDailyReport(env, key);
  return sendTelegram(env, text);
}

// ==================== 上游 URL / 缓存 key ====================

function getRequestCredential(request) {
  const h = request.headers;
  const u = new URL(request.url);
  return h.get('x-emby-token') ||
    h.get('x-mediabrowser-token') ||
    h.get('authorization') ||
    u.searchParams.get('api_key') ||
    u.searchParams.get('apikey') ||
    u.searchParams.get('ApiKey') ||
    u.searchParams.get('token') ||
    u.searchParams.get('Token') ||
    u.searchParams.get('X-Emby-Token') ||
    '';
}

async function buildImageCacheKey(request) {
  const cred = getRequestCredential(request);
  if (!cred) return null;
  const u = new URL(request.url);
  for (const k of Array.from(u.searchParams.keys())) {
    if (/^(api_?key|token|x-emby-token|play_?session_?id|device_?id|session_?id)$/i.test(k)) {
      u.searchParams.delete(k);
    }
  }
  const fp = (await sha256Hex(cred)).slice(0, 16);
  u.searchParams.set('__ck', fp);
  u.hash = '';
  return new Request(u.toString(), { method: 'GET' });
}

function buildUpstreamHeaders(request, upstreamUrl, ipMode, compatMode, customHeaders) {
  const headers = new Headers(request.headers);

  // 先删除所有需要丢弃的头，再设置，避免 x-forwarded-* 刚设置就被删掉
  for (const h of DROP_REQUEST_HEADERS) headers.delete(h);
  headers.set('Host', upstreamUrl.host);
  headers.delete('Referer');

  if (ipMode === 'forward') {
    const clientIp = request.headers.get('cf-connecting-ip');
    if (clientIp) {
      headers.set('x-forwarded-for', clientIp);
      headers.set('x-real-ip', clientIp);
    }
  } else if (ipMode === 'strip') {
    headers.delete('x-real-ip');
    headers.delete('x-forwarded-for');
    headers.delete('forwarded');
  } else {
    stripClientIdentityHeaders(headers);
  }

  if (compatMode) {
    headers.set('Origin', upstreamUrl.origin);
    headers.set('X-Forwarded-Proto', upstreamUrl.protocol.replace(':', ''));
    headers.set('X-Forwarded-Host', upstreamUrl.host);
  }

  // 路由级自定义请求头（可用于固定 UA / Origin / Referer）
  if (customHeaders && typeof customHeaders === 'object') {
    for (const [k, v] of Object.entries(customHeaders)) {
      const key = String(k);
      const lower = key.toLowerCase();
      if (DROP_REQUEST_HEADERS.has(lower) || lower === 'host') continue;
      headers.set(key, String(v));
    }
  }
  return headers;
}

async function fetchWithTimeout(url, init, timeoutMs) {
  if (!timeoutMs || timeoutMs <= 0) return fetch(url, init);
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(tid);
  }
}

function breakerKey(prefix, host) { return (prefix || 'direct') + '|' + host; }

function breakerIsOpen(key) {
  const b = breakerMap.get(key);
  if (!b) return false;
  if (b.until <= Date.now()) {
    breakerMap.delete(key);
    return false;
  }
  return true;
}

function breakerFail(key) {
  const now = Date.now();
  const b = breakerMap.get(key) || { failures: 0, until: 0 };
  b.failures += 1;
  if (b.failures >= CONFIG.breakerThreshold) b.until = now + CONFIG.breakerCooldownMs;
  breakerMap.set(key, b);
  if (breakerMap.size > 5000) breakerMap.clear();
}

function breakerSuccess(key) { breakerMap.delete(key); }

function countingBody(body, onDone) {
  let bytes = 0;
  const ts = new TransformStream({
    transform(chunk, controller) {
      bytes += chunk && chunk.byteLength ? chunk.byteLength : 0;
      controller.enqueue(chunk);
    },
    flush() {
      try { onDone(bytes); } catch (_) {}
    },
  });
  return body.pipeThrough(ts);
}

// ==================== 代理目标解析 ====================

async function resolveProxyTarget(request, env, url) {
  const rawSegments = url.pathname.split('/').filter(Boolean);
  if (!rawSegments.length) return { error: textResponse('Not Found', 404) };

  let firstSegment;
  try {
    firstSegment = decodeURIComponent(rawSegments[0]);
  } catch (_) {
    return { error: textResponse('400: 路径编码错误', 400) };
  }

  const prefix = normalizePrefix(firstSegment);
  if (!prefix) return { error: textResponse('Not Found', 404) };

  const route = await getRouteCached(env, prefix);
  if (!route) return { error: textResponse('404: 节点不存在', 404) };
  if (route.enabled === 0 || route.enabled === '0') {
    return { error: textResponse('503: 节点已停用', 503) };
  }

  // 保留原始编码，不整条 decodeURIComponent，避免 %2F / %3F / %23 被改写
  let rest = rawSegments.slice(1).map(s => '/' + s).join('');
  if (url.pathname.endsWith('/') && !rest.endsWith('/')) rest += '/';

  const targetList = String(route.target || '').split(',').map(s => s.trim()).filter(Boolean);
  const upstreamUrls = [];
  for (const target of targetList) {
    try {
      const t = new URL(target);
      if (!/^https?:$/.test(t.protocol)) continue;
      // 保留目标自带的子路径，如 https://host/emby
      const basePath = t.pathname.replace(/\/+$/, '');
      t.pathname = (basePath + rest) || '/';
      t.search = url.search || t.search;
      t.hash = '';
      upstreamUrls.push(t.toString());
    } catch (_) {
      // 忽略非法目标，继续尝试下一个
    }
  }

  if (!upstreamUrls.length) return { error: textResponse('502: 没有可用的目标地址', 502) };

  const custom = parseCustomHeaders(route.custom_headers || '');
  return {
    upstreamUrls,
    enableCache: route.cache_img !== 'off',
    compatMode: route.compat_mode === 'on',
    clientIpMode: normalizeIpMode(route.ip_mode),
    matchedPrefix: route.prefix,
    customHeaders: custom.error ? {} : custom.headers,
  };
}

// ==================== 核心代理 ====================

async function proxyDirectUrl(request, env, ctx, upstreamUrls, opts = {}) {
  const {
    enableCache = true,
    compatMode = false,
    clientIpMode = 'forward',
    matchedPrefix = null,
    customHeaders = {},
  } = opts;
  const ipMode = normalizeIpMode(clientIpMode);

  if (!upstreamUrls || !upstreamUrls.length) return textResponse('404: Target empty', 404);

  let firstUpstreamUrl;
  try {
    firstUpstreamUrl = new URL(upstreamUrls[0]);
  } catch (_) {
    return textResponse('Invalid upstream URL', 500);
  }

  const reqCategory = classifyRequest(firstUpstreamUrl.pathname, request.method);
  const isProgress = reqCategory === 'progress';
  const isPlaying = reqCategory === 'playing';
  const isPlaybackInfo = reqCategory === 'playback_info';
  const isMedia = ['streaming', 'segment', 'manifest', 'subtitle'].includes(reqCategory);
  const nonGet = request.method !== 'GET' && request.method !== 'HEAD';

  // 需要在多上游重试 / 进度心跳解析时缓冲请求体，其余单上游直接流式转发
  const mustBuffer = nonGet && (upstreamUrls.length > 1 || isProgress);
  let requestBody = null;
  if (mustBuffer) {
    try { requestBody = await request.arrayBuffer(); } catch (_) { requestBody = null; }
  }
  const reqInBytes = requestBody
    ? requestBody.byteLength
    : (parseInt(request.headers.get('content-length') || '0', 10) || 0);

  // 进度心跳节流：同一 IP + 会话 + 设备，30 秒内直接 204
  if (isProgress) {
    const q = new URL(request.url).searchParams;
    let sid = q.get('PlaySessionId') || q.get('SessionId') || '';
    let did = q.get('DeviceId') || '';
    if (!sid && requestBody) {
      try {
        const bodyJson = JSON.parse(new TextDecoder().decode(requestBody));
        sid = bodyJson.PlaySessionId || bodyJson.SessionId || '';
        did = bodyJson.DeviceId || '';
      } catch (_) {}
    }
    const progressKey = `p:${getClientIp(request)}:${sid}:${did}`;
    const now = Date.now();
    const last = progressMap.get(progressKey) || 0;
    if (now - last < CONFIG.progressThrottleMs) {
      queueStats(env, ctx, { prefix: matchedPrefix || '', category: reqCategory, inBytes: reqInBytes, outBytes: 0 });
      return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store', 'X-Proxy-Throttled': 'progress' } });
    }
    progressMap.set(progressKey, now);
    if (progressMap.size > CONFIG.progressMapMax) {
      const cutoff = now - 120000;
      for (const [k, v] of progressMap) {
        if (v < cutoff) progressMap.delete(k);
        if (progressMap.size <= CONFIG.progressMapMax / 2) break;
      }
    }
  }

  // WebSocket 直接透传：必须保留 Upgrade / Connection / Sec-WebSocket-* 握手头
  const upgradeHeader = request.headers.get('Upgrade');
  if (upgradeHeader && upgradeHeader.toLowerCase() === 'websocket') {
    const wsHeaders = new Headers(request.headers);
    for (const h of DROP_REQUEST_HEADERS) {
      if (h === 'connection' || h === 'upgrade') continue;
      wsHeaders.delete(h);
    }
    wsHeaders.set('Host', firstUpstreamUrl.host);
    try {
      return await fetch(upstreamUrls[0], {
        method: 'GET',
        headers: wsHeaders,
        redirect: 'manual',
      });
    } catch (e) {
      return textResponse('WebSocket upstream error: ' + (e?.message || 'unknown'), 502);
    }
  }

  // 图片/静态资源缓存（字幕不缓存，且必须带凭据）
  let cacheKey = null;
  if (enableCache && isCacheableCategory(reqCategory) && request.method === 'GET') {
    cacheKey = await buildImageCacheKey(request);
    if (cacheKey) {
      try {
        const cached = await caches.default.match(cacheKey);
        if (cached) {
          const headers = new Headers(cached.headers);
          headers.set('X-Cache', 'HIT');
          applySecurityHeaders(headers);
          const bytes = getResponseBytes(cached);
          queueStats(env, ctx, { prefix: matchedPrefix || '', category: reqCategory, outBytes: bytes, inBytes: 0 });
          return new Response(cached.body, { status: cached.status, statusText: cached.statusText, headers });
        }
      } catch (_) {}
    }
  }

  const runtime = await getRuntimeConfig(env);
  const timeoutMs = Math.max(3000, parseInt(env.UPSTREAM_TIMEOUT_MS || '15000', 10) || 15000);
  const fetchTimeout = isMedia ? Math.max(timeoutMs, 30000) : timeoutMs;

  let finalResponse = null;
  let lastError = null;
  let lastUpstreamUrl = null;

  // 熔断：优先跳过最近失败的上游；如果全部熔断，则强制再试一轮
  const indexed = upstreamUrls.map((urlStr, index) => ({ urlStr, index }));
  const available = indexed.filter(x => {
    try { return !breakerIsOpen(breakerKey(matchedPrefix, new URL(x.urlStr).host)); } catch (_) { return true; }
  });
  const attempts = available.length ? available : indexed;

  for (const item of attempts) {
    let upstreamUrl;
    try {
      upstreamUrl = new URL(item.urlStr);
    } catch (_) {
      lastError = new Error('Invalid target URL');
      continue;
    }

    // JP 机房域名替换规则（后台可配置）
    const colo = request.cf?.colo;
    if (colo && JP_COLOS.includes(colo) && runtime.domainProxyRules) {
      for (const suffix in runtime.domainProxyRules) {
        if (upstreamUrl.host.endsWith(suffix)) {
          const replacement = String(runtime.domainProxyRules[suffix] || '').trim();
          if (replacement) upstreamUrl.hostname = replacement;
          break;
        }
      }
    }

    const headers = buildUpstreamHeaders(request, upstreamUrl, ipMode, compatMode, customHeaders);

    const rangeHeader = request.headers.get('Range');
    if (rangeHeader && ['streaming', 'segment', 'other'].includes(reqCategory)) {
      if (!headers.has('Range')) headers.set('Range', rangeHeader);
      const ifRange = request.headers.get('If-Range');
      if (ifRange && !headers.has('If-Range')) headers.set('If-Range', ifRange);
    }

    const fetchInit = {
      method: request.method,
      headers,
      redirect: 'manual',
    };
    if (requestBody) {
      fetchInit.body = requestBody;
    } else if (nonGet) {
      fetchInit.body = request.body;
      fetchInit.duplex = 'half';
    }

    const bKey = breakerKey(matchedPrefix, upstreamUrl.host);
    try {
      const response = await fetchWithTimeout(upstreamUrl.toString(), fetchInit, fetchTimeout);
      if (!compatMode && [502, 503, 504].includes(response.status) && attempts.length > 1) {
        breakerFail(bKey);
        lastError = new Error('HTTP ' + response.status);
        continue;
      }
      breakerSuccess(bKey);
      finalResponse = response;
      lastUpstreamUrl = upstreamUrl;
      break;
    } catch (err) {
      breakerFail(bKey);
      lastError = err;
      continue;
    }
  }

  if (!finalResponse) {
    return textResponse('所有线路不可用: ' + (lastError?.message || 'Unknown'), 502);
  }

  // 记录最近播放时间（仅成功命中上游后写入，带节流）
  if (matchedPrefix && (isPlaying || isPlaybackInfo || isMedia)) {
    touchLastPlay(env, ctx, matchedPrefix, Date.now());
  }

  // 处理 3xx：同站跳转在 Worker 内跟随；跨站/手动域名把跳转返回给客户端，避免把 Token 发给第三方
  let finalUrl = lastUpstreamUrl;
  for (let hop = 0; hop < 4; hop++) {
    if (!(finalResponse.status >= 300 && finalResponse.status < 400)) break;
    const location = finalResponse.headers.get('Location');
    if (!location) break;

    let redirectUrl;
    try { redirectUrl = new URL(location, finalUrl); } catch (_) { break; }

    const manual = runtime.manualRedirectDomains.some(d => redirectUrl.hostname === d || redirectUrl.hostname.endsWith('.' + d));
    const sameSite = isSameSite(redirectUrl.hostname, finalUrl.hostname, runtime.dnsRootDomain || getBaseDomain(env));

    if (manual || !sameSite) {
      // 不跟随，也不转发任何凭据
      const newHeaders = sanitizeResponseHeaders(finalResponse.headers);
      newHeaders.set('Location', redirectUrl.toString());
      newHeaders.set('Access-Control-Allow-Origin', '*');
      newHeaders.set('Cache-Control', 'no-store');
      applySecurityHeaders(newHeaders);
      queueStats(env, ctx, { prefix: matchedPrefix || '', category: reqCategory, outBytes: getResponseBytes(finalResponse), inBytes: reqInBytes });
      return new Response(finalResponse.body, { status: finalResponse.status, statusText: finalResponse.statusText, headers: newHeaders });
    }

    // 同站跳转：保留必要的凭据；301/302 对非 GET 降级为 GET
    const method = (request.method === 'GET' || request.method === 'HEAD')
      ? request.method
      : ((finalResponse.status === 307 || finalResponse.status === 308) ? request.method : 'GET');
    const hopHeaders = buildUpstreamHeaders(request, redirectUrl, ipMode, compatMode, customHeaders);
    let hopBody = null;
    if (method !== 'GET' && method !== 'HEAD') {
      hopBody = requestBody;
      if (!hopBody && nonGet) hopBody = request.body;
    }
    try {
      finalResponse = await fetchWithTimeout(redirectUrl.toString(), {
        method,
        headers: hopHeaders,
        redirect: 'manual',
        body: hopBody || undefined,
        duplex: hopBody === request.body ? 'half' : undefined,
      }, fetchTimeout);
      finalUrl = redirectUrl;
    } catch (e) {
      lastError = e;
      break;
    }
  }

  // 最终响应
  const responseHeaders = sanitizeResponseHeaders(finalResponse.headers);
  responseHeaders.set('Access-Control-Allow-Origin', '*');
  responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  responseHeaders.set('Access-Control-Allow-Headers', '*');
  applySecurityHeaders(responseHeaders);

  if (isPlaying || isPlaybackInfo) responseHeaders.set('X-Served-By', request.cf?.colo || 'Unknown');
  if (isProgress || reqCategory === 'playing_stop') responseHeaders.set('Cache-Control', 'no-store');
  if (reqCategory === 'subtitle') responseHeaders.set('Cache-Control', 'private, no-store');

  const knownBytes = getResponseBytes(finalResponse);

  if (enableCache && cacheKey && finalResponse.status === 200 && isCacheableCategory(reqCategory)) {
    const maxAge = reqCategory === 'image' ? 2592000 : 86400;
    responseHeaders.set('Cache-Control', `private, max-age=${maxAge}`);
    responseHeaders.set('X-Cache', 'MISS');
    const counted = new Response(finalResponse.body, {
      status: finalResponse.status,
      statusText: finalResponse.statusText,
      headers: responseHeaders,
    });
    if (knownBytes) {
      queueStats(env, ctx, { prefix: matchedPrefix || '', category: reqCategory, outBytes: knownBytes, inBytes: reqInBytes });
    } else if (finalResponse.body) {
      const wrapped = new Response(countingBody(finalResponse.body, n => {
        queueStats(env, ctx, { prefix: matchedPrefix || '', category: reqCategory, outBytes: n, inBytes: reqInBytes });
      }), { status: finalResponse.status, statusText: finalResponse.statusText, headers: responseHeaders });
      ctx.waitUntil(caches.default.put(cacheKey, wrapped.clone()).catch(() => {}));
      return wrapped;
    }
    ctx.waitUntil(caches.default.put(cacheKey, counted.clone()).catch(() => {}));
    return counted;
  }

  if (knownBytes || !finalResponse.body) {
    queueStats(env, ctx, { prefix: matchedPrefix || '', category: reqCategory, outBytes: knownBytes, inBytes: reqInBytes });
    return new Response(finalResponse.body, {
      status: finalResponse.status,
      statusText: finalResponse.statusText,
      headers: responseHeaders,
    });
  }

  const counted = new Response(countingBody(finalResponse.body, n => {
    queueStats(env, ctx, { prefix: matchedPrefix || '', category: reqCategory, outBytes: n, inBytes: reqInBytes });
  }), {
    status: finalResponse.status,
    statusText: finalResponse.statusText,
    headers: responseHeaders,
  });
  return counted;
}

// ==================== 优选域名 ====================

async function listOptimizedDomains(env) {
  if (!env.DB) {
    return DEFAULT_OPTIMIZED_DOMAINS.map((d, i) => ({
      id: i + 1, domain: d.domain, name: d.name, isBuiltin: true,
    }));
  }
  try {
    const { results } = await env.DB.prepare(
      'SELECT * FROM optimized_domains ORDER BY is_builtin DESC, name ASC'
    ).all();
    return (results || []).map(r => ({
      id: r.id,
      domain: r.domain,
      name: r.name,
      isBuiltin: Boolean(r.is_builtin),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  } catch (_) {
    return [];
  }
}

async function addOptimizedDomain(env, domain, name) {
  try {
    const r = await env.DB.prepare(
      'INSERT INTO optimized_domains (domain, name, is_builtin) VALUES (?, ?, 0)'
    ).bind(domain, name).run();
    if (r && r.meta && r.meta.changes === 0) return { success: false, error: '域名已存在' };
    return { success: true };
  } catch (e) {
    if (/unique/i.test(String(e?.message || ''))) return { success: false, error: '域名已存在' };
    return { success: false, error: String(e?.message || e) };
  }
}

async function updateOptimizedDomain(env, id, domain, name) {
  try {
    const row = await env.DB.prepare('SELECT is_builtin FROM optimized_domains WHERE id = ?').bind(id).first();
    if (!row) return { success: false, error: '记录不存在', status: 404 };
    if (row.is_builtin) return { success: false, error: '内置域名不可修改', status: 403 };
    await env.DB.prepare(
      'UPDATE optimized_domains SET domain = ?, name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(domain, name, id).run();
    return { success: true };
  } catch (e) {
    if (/unique/i.test(String(e?.message || ''))) return { success: false, error: '域名已存在' };
    return { success: false, error: String(e?.message || e) };
  }
}

async function deleteOptimizedDomain(env, id) {
  try {
    const row = await env.DB.prepare('SELECT is_builtin FROM optimized_domains WHERE id = ?').bind(id).first();
    if (!row) return { success: false, error: '记录不存在', status: 404 };
    if (row.is_builtin) return { success: false, error: '内置域名不可删除', status: 403 };
    await env.DB.prepare('DELETE FROM optimized_domains WHERE id = ?').bind(id).run();
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e?.message || e) };
  }
}

// ==================== DNS 配置 / Cloudflare API ====================

async function getDNSConfig(env) {
  if (!env.DB) return null;
  try {
    const { results } = await env.DB.prepare('SELECT * FROM dns_config ORDER BY id DESC LIMIT 1').all();
    if (!results || !results.length) return null;
    const r = results[0];
    return {
      id: r.id,
      dnsName: r.dns_name,
      currentDomain: r.current_domain,
      zoneId: r.zone_id,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  } catch (_) {
    return null;
  }
}

async function saveDNSConfig(env, dnsName, currentDomain, zoneId) {
  if (!env.DB) return false;
  const existing = await getDNSConfig(env);
  try {
    if (existing) {
      await env.DB.prepare(
        'UPDATE dns_config SET dns_name = ?, current_domain = ?, zone_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).bind(dnsName, currentDomain || '', zoneId || '', existing.id).run();
    } else {
      await env.DB.prepare(
        'INSERT INTO dns_config (dns_name, current_domain, zone_id) VALUES (?, ?, ?)'
      ).bind(dnsName, currentDomain || '', zoneId || '').run();
    }
    return true;
  } catch (_) {
    return false;
  }
}

async function cloudflareAPICall(env, method, endpoint, body = null) {
  const apiToken = getCFApiToken(env);
  if (!apiToken) return { success: false, error: 'CF_API_TOKEN 未配置' };
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch('https://api.cloudflare.com/client/v4' + endpoint, {
      method,
      headers: {
        'Authorization': 'Bearer ' + apiToken,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => ({}));
    return data;
  } catch (e) {
    return { success: false, error: String(e?.message || e) };
  } finally {
    clearTimeout(tid);
  }
}

async function getZones(env) {
  const info = await resolveZoneInfo(env);
  const accountId = info.accountId;
  return cloudflareAPICall(env, 'GET', accountId ? '/zones?account.id=' + encodeURIComponent(accountId) : '/zones');
}

async function getDNSRecords(env, zoneId) {
  return cloudflareAPICall(env, 'GET', `/zones/${encodeURIComponent(zoneId)}/dns_records?per_page=100`);
}

function detectRecordType(content) {
  const v = String(content || '').trim();
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(v)) return 'A';
  if (v.includes(':') && /^[0-9a-fA-F:]+$/.test(v)) return 'AAAA';
  return 'CNAME';
}

async function replaceDNSRecords(env, zoneId, dnsName, targetsInput, rootDomain, recordCount) {
  if (!zoneId) zoneId = (await resolveZoneInfo(env)).zoneId;
  if (!zoneId) return { success: false, error: '无法确定区域 ID，请检查 BASE_DOMAIN 与 CF_API_TOKEN 权限' };

  const accessHost = getBaseDomain(env);
  const baseDomain = rootDomain || accessHost || '';
  // dnsName 为空 = 这条记录就是 BASE_DOMAIN 本身（完整域名模式）
  const rawName = String(dnsName || '').trim() || (accessHost && accessHost !== baseDomain ? accessHost : '');
  const fullName = toFqdn(rawName, baseDomain);
  if (!fullName) return { success: false, error: 'DNS 记录名称为空' };

  const targets = (Array.isArray(targetsInput) ? targetsInput : String(targetsInput || '').split(','))
    .map(s => String(s).trim()).filter(Boolean);
  if (!targets.length) return { success: false, error: '目标不能为空' };
  if (targets.length > 5) return { success: false, error: '最多支持 5 条记录' };

  const max = Math.max(1, Math.min(5, parseInt(recordCount || '1', 10) || 1));
  const desired = targets.slice(0, max).map(t => ({ content: t, type: detectRecordType(t) }));

  const cnameCount = desired.filter(d => d.type === 'CNAME').length;
  if (cnameCount > 1) return { success: false, error: 'CNAME 只能保留一条，请使用 IP 做多记录轮询' };
  if (cnameCount && desired.length > 1) return { success: false, error: 'CNAME 不能和其他记录同时存在' };

  const list = await getDNSRecords(env, zoneId);
  if (!list.success) return { success: false, error: list.error || list.errors?.[0]?.message || '读取 DNS 记录失败' };

  const relevant = (list.result || []).filter(r => r.name === fullName && ['A', 'AAAA', 'CNAME'].includes(r.type));
  const used = new Set();
  const created = [];
  const patched = [];
  const deleted = [];
  const results = [];

  const removeRecord = async (rec, reason) => {
    const r = await cloudflareAPICall(env, 'DELETE', `/zones/${encodeURIComponent(zoneId)}/dns_records/${rec.id}`);
    if (!r.success) throw new Error('删除旧记录失败: ' + (r.errors?.[0]?.message || reason));
    deleted.push(rec);
  };

  // 保持原有代理开关（Worker 后面必须是橙云），新记录默认开启代理
  const proxiedOf = (rec) => (rec && typeof rec.proxied === 'boolean' ? rec.proxied : true);

  try {
    for (const want of desired) {
      let rec = relevant.find(r => !used.has(r.id) && r.type === want.type);
      if (rec) {
        const r = await cloudflareAPICall(env, 'PATCH', `/zones/${encodeURIComponent(zoneId)}/dns_records/${rec.id}`, {
          type: want.type, name: fullName, content: want.content, ttl: 1, proxied: proxiedOf(rec),
        });
        if (!r.success) throw new Error('更新记录失败: ' + (r.errors?.[0]?.message || '未知错误'));
        patched.push({ id: rec.id, old: { ...rec } });
        used.add(rec.id);
        results.push(r.result);
        continue;
      }

      // 类型冲突（CNAME ↔ A/AAAA）：先尝试原地改类型，避免解析空窗
      const conflict = relevant.find(r => !used.has(r.id) && ((r.type === 'CNAME') !== (want.type === 'CNAME')));
      if (conflict) {
        const pr = await cloudflareAPICall(env, 'PATCH', `/zones/${encodeURIComponent(zoneId)}/dns_records/${conflict.id}`, {
          type: want.type, name: fullName, content: want.content, ttl: 1, proxied: proxiedOf(conflict),
        });
        if (pr.success) {
          patched.push({ id: conflict.id, old: { ...conflict } });
          used.add(conflict.id);
          results.push(pr.result);
          continue;
        }
        await removeRecord(conflict, '类型冲突');
      }

      const cr = await cloudflareAPICall(env, 'POST', `/zones/${encodeURIComponent(zoneId)}/dns_records`, {
        type: want.type, name: fullName, content: want.content, ttl: 1, proxied: true,
      });
      if (!cr.success) throw new Error('创建记录失败: ' + (cr.errors?.[0]?.message || '未知错误'));
      created.push(cr.result);
      results.push(cr.result);
    }

    // 只清理同名 A/AAAA/CNAME，不碰 TXT/MX/CAA 等记录
    for (const rec of relevant) {
      if (!used.has(rec.id)) await removeRecord(rec, '多余记录');
    }
  } catch (e) {
    // 回滚
    for (const c of created) {
      if (c?.id) await cloudflareAPICall(env, 'DELETE', `/zones/${encodeURIComponent(zoneId)}/dns_records/${c.id}`);
    }
    for (const p of patched) {
      await cloudflareAPICall(env, 'PATCH', `/zones/${encodeURIComponent(zoneId)}/dns_records/${p.id}`, {
        type: p.old.type, name: p.old.name, content: p.old.content, ttl: p.old.ttl || 1, proxied: Boolean(p.old.proxied),
      });
    }
    for (const d of deleted) {
      await cloudflareAPICall(env, 'POST', `/zones/${encodeURIComponent(zoneId)}/dns_records`, {
        type: d.type, name: d.name, content: d.content, ttl: d.ttl || 1, proxied: Boolean(d.proxied),
      });
    }
    return { success: false, error: String(e?.message || e) };
  }

  await saveDNSConfig(env, dnsName, desired.map(d => d.content).join(', '), zoneId);
  return { success: true, result: results[0] || null, results };
}

// ==================== 测速 / Edge 信息 ====================

async function speedtestUrl(urlStr, timeoutMs = 5000) {
  const start = Date.now();
  try {
    const u = new URL(/^https?:\/\//i.test(urlStr) ? urlStr : 'https://' + urlStr);
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(u.origin + '/', {
        method: 'HEAD',
        signal: ctrl.signal,
        redirect: 'manual',
        headers: { 'User-Agent': 'Emby-Proxy-Speedtest/1.0' },
      });
      if ([502, 503, 504].includes(res.status)) return -1;
      return Date.now() - start;
    } finally {
      clearTimeout(tid);
    }
  } catch (_) {
    return -1;
  }
}

async function mapLimit(items, limit, fn) {
  const arr = Array.isArray(items) ? items : [];
  const out = new Array(arr.length);
  let index = 0;
  const workers = Array.from({ length: Math.min(Math.max(1, limit), arr.length) }, async () => {
    while (true) {
      const i = index++;
      if (i >= arr.length) return;
      try { out[i] = await fn(arr[i], i); } catch (_) { out[i] = null; }
    }
  });
  await Promise.all(workers);
  return out;
}

function latencyStatus(ms) {
  if (ms < 0) return 'timeout';
  if (ms < 100) return 'fast';
  if (ms < 300) return 'good';
  return 'slow';
}

async function speedtestOptimizedFromEdge(env) {
  const domains = await listOptimizedDomains(env);
  const results = await mapLimit(domains, 5, async (item) => {
    const samples = [];
    for (let i = 0; i < 2; i++) {
      const ms = await speedtestUrl(`https://${item.domain}/cdn-cgi/trace`, 4000);
      if (ms >= 0) samples.push(ms);
    }
    samples.sort((a, b) => a - b);
    const latency = samples.length ? samples[Math.floor(samples.length / 2)] : -1;
    return {
      id: item.id,
      domain: item.domain,
      name: item.name,
      host: item.domain,
      latency,
      status: latencyStatus(latency),
      isBuiltin: item.isBuiltin,
    };
  });

  const clean = results.filter(Boolean);
  clean.sort((a, b) => {
    if (a.latency < 0 && b.latency < 0) return 0;
    if (a.latency < 0) return 1;
    if (b.latency < 0) return -1;
    return a.latency - b.latency;
  });
  return { results: clean, best: clean.find(r => r.latency >= 0) || null };
}

async function speedtestDeduped(env) {
  if (!edgeSpeedPromise) {
    edgeSpeedPromise = speedtestOptimizedFromEdge(env).finally(() => { edgeSpeedPromise = null; });
  }
  return edgeSpeedPromise;
}

async function getEdgeInfo(request) {
  const cf = request.cf || {};
  let traceIp = '';
  let traceColo = cf.colo || '未知';
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 5000);
    try {
      const tr = await fetch('https://1.1.1.1/cdn-cgi/trace', {
        headers: { 'User-Agent': 'CF-Worker-Trace' },
        signal: ctrl.signal,
      });
      const text = await tr.text();
      const coloM = text.match(/colo=([A-Z0-9]+)/);
      const ipM = text.match(/ip=([^\n]+)/);
      if (coloM) traceColo = coloM[1];
      if (ipM) traceIp = ipM[1].trim();
    } finally {
      clearTimeout(tid);
    }
  } catch (_) {}

  return {
    clientIp: getClientIp(request),
    entryColo: cf.colo || '未知',
    entryCountry: cf.country || '未知',
    entryCity: cf.city || '',
    edgeIp: traceIp || '—',
    egressColo: traceColo,
    asn: cf.asn || '',
    cacheKey: `${cf.country || 'XX'}|${cf.city || ''}|${cf.asn || ''}`,
  };
}

// ==================== 公共接口缓存 ====================

async function withEdgeCache(ctx, keyUrl, ttlSeconds, producer) {
  if (!ctx) return producer();
  const key = new Request(keyUrl, { method: 'GET' });
  try {
    const hit = await caches.default.match(key);
    if (hit) {
      const h = new Headers(hit.headers);
      h.set('X-Cache', 'HIT');
      return new Response(hit.body, { status: hit.status, headers: h });
    }
  } catch (_) {}

  const res = await producer();
  if (res && res.status === 200) {
    try {
      const bodyText = await res.clone().text();
      const h = new Headers(res.headers);
      h.set('Cache-Control', `public, max-age=${ttlSeconds}`);
      h.set('X-Cache', 'MISS');
      const cached = new Response(bodyText, { status: res.status, headers: h });
      ctx.waitUntil(caches.default.put(key, cached.clone()).catch(() => {}));
      return cached;
    } catch (_) {}
  }
  return res;
}

function purgeCacheUrls(ctx, urls) {
  if (!ctx) return;
  for (const u of urls) {
    ctx.waitUntil(caches.default.delete(new Request(u)).catch(() => {}));
  }
}

const CACHE_URLS = {
  domainsList: (origin) => origin + '/__cache/api/domains/list',
  domainsSpeed: (origin) => origin + '/__cache/api/domains/speed',
  pingHost: (origin, host) => origin + '/__cache/api/ping/' + encodeURIComponent(host),
  stats: (origin, dateKey) => origin + '/__cache/stats/' + dateKey,
  edge: (origin, fp) => origin + '/__cache/edge/' + fp,
  baseDomain: (origin) => origin + '/__cache/api/config/base-domain',
  dnsName: (origin) => origin + '/__cache/api/config/dns-record-name',
};

function purgeDomainCaches(ctx, origin) {
  if (!origin) return;
  purgeCacheUrls(ctx, [CACHE_URLS.domainsList(origin), CACHE_URLS.domainsSpeed(origin)]);
}

// ==================== 审计日志 ====================

async function addAudit(env, request, action, detail) {
  if (!env.DB) return;
  try {
    await env.DB.prepare(
      'INSERT INTO audit_log (ts, ip, action, detail) VALUES (?, ?, ?, ?)'
    ).bind(
      new Date().toISOString(),
      getClientIp(request),
      String(action || '').slice(0, 80),
      String(detail || '').slice(0, 800)
    ).run();
  } catch (_) {}
}

// ==================== 统计接口 ====================

async function handleStatsRequest(request, env, url, ctx) {
  const dateKey = isValidDateKey(url.searchParams.get('date'))
    ? url.searchParams.get('date')
    : getShanghaiParts().dateKey;

  return withEdgeCache(ctx, CACHE_URLS.stats(url.origin, dateKey), 60, async () => {
    const stats = await getD1Stats(env, dateKey);
    const cf = await getCFZoneSummary(env, dateKey);
    const worker = await getCFWorkerSummary(env, dateKey);
    const dailySeries = await getD1DailySeries(env, 7);

    const hourlyMap = new Map(stats.hourly.map(h => [h.hour, h.requests]));
    const hourlySeries = Array.from({ length: 24 }, (_, h) => ({
      label: String(h).padStart(2, '0') + ':00',
      total: hourlyMap.get(h) || (cf && !cf.error && cf.hourly ? cf.hourly[h] : 0) || 0,
    }));

    const requests = stats.requests || Number(cf?.requests) || 0;
    const trafficBytes = stats.traffic || Number(cf?.bytes) || 0;

    return json({
      error: null,
      data: {
        date: dateKey,
        todayRequests: requests,
        todayTraffic: formatBytes(trafficBytes),
        todayTrafficBytes: trafficBytes,
        todayVisits: cf && !cf.error ? Number(cf.visits) || 0 : null,
        requestBytes: stats.requestBytes,
        requestTraffic: formatBytes(stats.requestBytes),
        plays: stats.plays,
        playbackInfo: stats.playbackInfo,
        workerRequests: worker?.requests || 0,
        hourlySeries,
        dailySeries,
        cfStatus: cf?.error ? 'CF 查询失败' : (cf ? 'CF 统计正常' : '仅 D1 统计'),
        cfError: cf?.error || '',
        source: stats.requests ? 'D1 + CF' : (cf ? 'CF' : 'D1'),
        lastUpdated: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
      },
    });
  });
}

// ==================== 管理 API ====================

async function handleAdminStats(env, url) {
  const dateKey = isValidDateKey(url.searchParams.get('date'))
    ? url.searchParams.get('date')
    : getShanghaiParts().dateKey;
  const stats = await getD1Stats(env, dateKey);
  const cf = await getCFZoneSummary(env, dateKey);
  const worker = await getCFWorkerSummary(env, dateKey);
  const daily = await getD1DailySeries(env, 14);
  return adminJson({
    success: true,
    date: dateKey,
    stats,
    cf,
    worker,
    daily,
    formatted: {
      requests: formatNumber(stats.requests),
      traffic: formatBytes(stats.traffic),
      requestTraffic: formatBytes(stats.requestBytes),
      plays: formatNumber(stats.plays),
      playbackInfo: formatNumber(stats.playbackInfo),
      visits: cf && !cf.error ? formatNumber(cf.visits) : '—',
      workerRequests: formatNumber(worker?.requests || 0),
    },
  });
}

async function probeUpstream(target, timeoutMs = 6000) {
  const started = Date.now();
  let u;
  try { u = new URL(target); } catch (_) { return { target, ok: false, ms: 0, error: '非法 URL' }; }
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    let res = await fetch(u.toString(), {
      method: 'HEAD',
      redirect: 'manual',
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Emby-Proxy-Health/1.0' },
    });
    if (res.status === 405 || res.status === 501) {
      res = await fetch(u.toString(), {
        method: 'GET',
        redirect: 'manual',
        signal: ctrl.signal,
        headers: { 'User-Agent': 'Emby-Proxy-Health/1.0', 'Range': 'bytes=0-0' },
      });
    }
    const ms = Date.now() - started;
    const reachable = res.status > 0 && res.status < 500 || res.status === 401 || res.status === 403;
    return { target, ok: reachable, status: res.status, ms };
  } catch (e) {
    return { target, ok: false, ms: Date.now() - started, error: String(e?.message || e) };
  } finally {
    clearTimeout(tid);
  }
}

async function adminTestRoutes(env, prefix) {
  let rows = [];
  if (prefix) {
    const row = await env.DB.prepare('SELECT * FROM routes WHERE prefix = ?').bind(prefix).first();
    if (row) rows = [row];
  } else {
    const { results } = await env.DB.prepare('SELECT * FROM routes ORDER BY sort_order, prefix LIMIT 50').all();
    rows = results || [];
  }
  const out = await mapLimit(rows, 4, async (row) => {
    const targets = String(row.target || '').split(',').map(s => s.trim()).filter(Boolean);
    const probes = await mapLimit(targets, 3, async (t) => probeUpstream(t, 6000));
    return { prefix: row.prefix, targets: probes.filter(Boolean) };
  });
  return out.filter(Boolean);
}

async function handleAdminApiInner(request, env, url, ctx) {
  const method = request.method;

  // ---------- 路由 ----------
  if (url.pathname === '/admin/api/routes') {
    if (method === 'GET') {
      const { results } = await env.DB.prepare('SELECT * FROM routes ORDER BY sort_order, prefix').all();
      return adminJson((results || []).map(r => ({ ...r, enabled: r.enabled === 0 ? 0 : 1 })));
    }

    if (method === 'POST') {
      const body = await request.json().catch(() => null);
      if (!body) return adminJson({ error: '请求体不是合法 JSON' }, 400);

      const prefix = normalizePrefix(body.prefix);
      const prefixErr = validatePrefix(prefix);
      if (prefixErr) return adminJson({ error: prefixErr }, 400);

      const parsedTargets = parseTargets(body.target);
      if (parsedTargets.error) return adminJson({ error: parsedTargets.error }, 400);

      const parsedHeaders = parseCustomHeaders(body.custom_headers || '');
      if (parsedHeaders.error) return adminJson({ error: parsedHeaders.error }, 400);

      const oldPrefix = body.oldPrefix ? normalizePrefix(body.oldPrefix) : '';
      const isRename = Boolean(oldPrefix && oldPrefix !== prefix);
      const existing = await env.DB.prepare('SELECT * FROM routes WHERE prefix = ?').bind(prefix).first();
      if (isRename && existing) return adminJson({ error: '新路径已存在，请换一个' }, 409);
      if (!oldPrefix && existing) return adminJson({ error: '该路径已存在，请直接编辑或换一个' }, 409);

      const enabled = (body.enabled === false || body.enabled === 0 || body.enabled === '0') ? 0 : 1;
      const remark = String(body.remark || '').slice(0, 120);
      const cacheImg = body.cache_img === 'off' ? 'off' : 'on';
      const compat = body.compat_mode === 'on' ? 'on' : 'off';
      const ipMode = normalizeIpMode(body.ip_mode);
      const targetStr = parsedTargets.targets.join(', ');
      const headersStr = Object.keys(parsedHeaders.headers).length ? JSON.stringify(parsedHeaders.headers) : '';

      if (isRename) {
        const oldRow = await env.DB.prepare('SELECT * FROM routes WHERE prefix = ?').bind(oldPrefix).first();
        if (!oldRow) return adminJson({ error: '原路由不存在' }, 404);
        await env.DB.batch([
          env.DB.prepare('DELETE FROM routes WHERE prefix = ?').bind(oldPrefix),
          env.DB.prepare(
            `INSERT INTO routes (prefix, target, remark, cache_img, compat_mode, ip_mode, enabled, custom_headers, last_play, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(prefix, targetStr, remark, cacheImg, compat, ipMode, enabled, headersStr, oldRow.last_play || '', oldRow.sort_order || 0),
        ]);
      } else if (existing) {
        await env.DB.prepare(
          `UPDATE routes SET target = ?, remark = ?, cache_img = ?, compat_mode = ?, ip_mode = ?, enabled = ?, custom_headers = ?
           WHERE prefix = ?`
        ).bind(targetStr, remark, cacheImg, compat, ipMode, enabled, headersStr, prefix).run();
      } else {
        const maxRow = await env.DB.prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM routes').first();
        const sortOrder = (Number(maxRow?.m) || 0) + 1;
        await env.DB.prepare(
          `INSERT INTO routes (prefix, target, remark, cache_img, compat_mode, ip_mode, enabled, custom_headers, last_play, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', ?)`
        ).bind(prefix, targetStr, remark, cacheImg, compat, ipMode, enabled, headersStr, sortOrder).run();
      }

      clearRouteCache();
      await addAudit(env, request, isRename ? 'route.rename' : (existing ? 'route.update' : 'route.create'), `/${prefix} -> ${targetStr}`);
      return adminJson({ success: true, prefix });
    }

    if (method === 'DELETE') {
      const prefix = normalizePrefix(url.searchParams.get('prefix') || '');
      if (!prefix) return adminJson({ error: '缺少 prefix 参数' }, 400);
      await env.DB.prepare('DELETE FROM routes WHERE prefix = ?').bind(prefix).run();
      clearRouteCache();
      await addAudit(env, request, 'route.delete', '/' + prefix);
      return adminJson({ success: true });
    }
  }

  if (url.pathname === '/admin/api/routes/toggle' && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const prefix = normalizePrefix(body.prefix);
    if (!prefix) return adminJson({ error: '缺少 prefix' }, 400);
    const enabled = (body.enabled === false || body.enabled === 0 || body.enabled === '0') ? 0 : 1;
    await env.DB.prepare('UPDATE routes SET enabled = ? WHERE prefix = ?').bind(enabled, prefix).run();
    clearRouteCache();
    await addAudit(env, request, 'route.toggle', `/${prefix} enabled=${enabled}`);
    return adminJson({ success: true, enabled });
  }

  if (url.pathname === '/admin/api/routes/reorder' && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const prefixes = Array.isArray(body.prefixes) ? body.prefixes.slice(0, 500) : [];
    if (!prefixes.length) return adminJson({ error: 'prefixes 不能为空' }, 400);
    const stmts = prefixes.map((p, i) => env.DB.prepare('UPDATE routes SET sort_order = ? WHERE prefix = ?')
      .bind(i + 1, normalizePrefix(p)));
    await env.DB.batch(stmts);
    clearRouteCache();
    await addAudit(env, request, 'route.reorder', prefixes.join(','));
    return adminJson({ success: true, count: prefixes.length });
  }

  if (url.pathname === '/admin/api/routes/test' && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const prefix = body.prefix ? normalizePrefix(body.prefix) : '';
    const results = await adminTestRoutes(env, prefix);
    return adminJson({ success: true, results });
  }

  // ---------- 优选域名 ----------
  if (url.pathname === '/admin/api/speedtest/domains' && method === 'POST') {
    const data = await speedtestDeduped(env);
    return adminJson(data);
  }

  if (url.pathname === '/admin/api/optimized-domains') {
    if (method === 'GET') {
      return adminJson({ success: true, domains: await listOptimizedDomains(env) });
    }
    if (method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const domain = normalizeDomain(body.domain);
      const name = String(body.name || '').trim().slice(0, 60);
      if (!domain) return adminJson({ success: false, error: '域名格式不正确' }, 400);
      if (!name) return adminJson({ success: false, error: '名称不能为空' }, 400);
      const r = await addOptimizedDomain(env, domain, name);
      if (r.success) {
        purgeDomainCaches(ctx, url.origin);
        await addAudit(env, request, 'domain.create', domain);
      }
      return adminJson(r, r.success ? 200 : 409);
    }
  }

  if (url.pathname.startsWith('/admin/api/optimized-domains/')) {
    const id = parseInt(url.pathname.split('/').pop(), 10);
    if (!Number.isFinite(id)) return adminJson({ success: false, error: '非法 ID' }, 400);

    if (method === 'PUT') {
      const body = await request.json().catch(() => ({}));
      const domain = normalizeDomain(body.domain);
      const name = String(body.name || '').trim().slice(0, 60);
      if (!domain) return adminJson({ success: false, error: '域名格式不正确' }, 400);
      if (!name) return adminJson({ success: false, error: '名称不能为空' }, 400);
      const r = await updateOptimizedDomain(env, id, domain, name);
      if (r.success) {
        purgeDomainCaches(ctx, url.origin);
        await addAudit(env, request, 'domain.update', `${id}:${domain}`);
      }
      return adminJson(r, r.status || (r.success ? 200 : 409));
    }

    if (method === 'DELETE') {
      const r = await deleteOptimizedDomain(env, id);
      if (r.success) {
        purgeDomainCaches(ctx, url.origin);
        await addAudit(env, request, 'domain.delete', String(id));
      }
      return adminJson(r, r.status || (r.success ? 200 : 400));
    }
  }

  // ---------- DNS ----------
  if (url.pathname === '/admin/api/dns-config') {
    if (method === 'GET') {
      const config = await getDNSConfig(env);
      let zones = [];
      let zonesError = null;
      try {
        const zonesResult = await getZones(env);
        if (zonesResult.success && zonesResult.result) zones = zonesResult.result;
        else zonesError = zonesResult.error || zonesResult.errors?.[0]?.message || '获取区域列表失败';
      } catch (e) {
        zonesError = e.message;
      }

      const runtime = await getRuntimeConfig(env);
      const zoneInfo = await resolveZoneInfo(env);
      const dnsRoot = runtime.dnsRootDomain || zoneInfo.zoneName || getBaseDomain(env) || '';
      let liveRecord = null;
      {
        const accessHost = (url.hostname || '').toLowerCase();
        const candidates = [];
        if (accessHost) candidates.push(accessHost);
        const recordHost = toFqdn(getDnsRecordName(env), dnsRoot);
        if (recordHost && !candidates.includes(recordHost)) candidates.push(recordHost);
        if (config && config.dnsName) {
          const full = toFqdn(config.dnsName, dnsRoot);
          if (full && !candidates.includes(full)) candidates.push(full);
        }
        const zoneIds = [];
        const envZoneId = zoneInfo.zoneId;
        if (envZoneId) zoneIds.push(envZoneId);
        if (config && config.zoneId && !zoneIds.includes(config.zoneId)) zoneIds.push(config.zoneId);
        for (const z of zones) if (!zoneIds.includes(z.id)) zoneIds.push(z.id);

        outer: for (const zid of zoneIds) {
          try {
            const rr = await getDNSRecords(env, zid);
            if (rr.success && rr.result) {
              for (const name of candidates) {
                const rec = rr.result.find(r => ['A', 'AAAA', 'CNAME'].includes(r.type) && r.name === name);
                if (rec) {
                  liveRecord = {
                    type: rec.type, name: rec.name, content: rec.content,
                    proxied: rec.proxied, modifiedOn: rec.modified_on, zoneId: zid,
                  };
                  break outer;
                }
              }
            }
          } catch (_) {}
        }
      }
      return adminJson({ success: true, config, zones, zonesError, liveRecord, rootDomain: dnsRoot, zoneName: zoneInfo.zoneName || '', zoneId: zoneInfo.zoneId || '', baseDomain: getBaseDomain(env), dnsRecordName: getDnsRecordName(env), statsHost: getStatsHost(env) });
    }

    if (method === 'POST') {
      const body = await request.json().catch(() => ({}));
      let dnsName = String(body.dnsName || '').trim();
      if (!dnsName) dnsName = getBaseDomain(env);
      if (!dnsName) return adminJson({ success: false, error: 'DNS 名称不能为空（或先设置 BASE_DOMAIN）' }, 400);
      const success = await saveDNSConfig(env, dnsName, String(body.currentDomain || ''), String(body.zoneId || ''));
      await addAudit(env, request, 'dns.config', dnsName);
      return adminJson({ success });
    }
  }

  if (url.pathname === '/admin/api/dns/replace' && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const { dnsName, targetDomain } = body;
    if (!targetDomain) return adminJson({ success: false, error: '缺少 targetDomain' }, 400);

    const runtime = await getRuntimeConfig(env);
    const zoneInfo = await resolveZoneInfo(env);
    const rootDomain = body.rootDomain
      || runtime.dnsRootDomain
      || zoneInfo.zoneName
      || getBaseDomain(env)
      || '';
    const recordCount = body.recordCount || runtime.dnsRecordCount;
    const result = await replaceDNSRecords(env, body.zoneId || zoneInfo.zoneId, String(dnsName), targetDomain, rootDomain, recordCount);
    await addAudit(env, request, 'dns.replace',
      `${dnsName} -> ${targetDomain} (${result.success ? 'ok' : 'fail: ' + result.error})`);
    return adminJson(result, result.success ? 200 : 400);
  }

  // ---------- 设置 ----------
  if (url.pathname === '/admin/api/settings') {
    if (method === 'GET') {
      const s = await getAllSettings(env);
      return adminJson({
        success: true,
        settings: {
          manualRedirectDomains: s.manual_redirect_domains || '',
          domainProxyRules: s.domain_proxy_rules || '{}',
          tgChatId: s.tg_chat_id || '',
          tgBotTokenSet: Boolean(getTelegramToken(env) || s.tg_bot_token),
          tgDailyReport: String(s.tg_daily_report || '1') === '1',
          autoDns: String(s.auto_dns ?? '1') === '1',
          dnsRecordCount: Math.max(1, Math.min(5, parseInt(s.dns_record_count || '1', 10) || 1)),
          dnsRootDomain: s.dns_root_domain || '',
          healthAlerts: String(s.health_alerts ?? '1') === '1',
        },
        baseDomain: getBaseDomain(env),
        statsHost: getStatsHost(env),
        dnsRecordName: getDnsRecordName(env),
        tgEnvConfigured: Boolean(getTelegramToken(env) && getTelegramChatId(env)),
      });
    }

    if (method === 'POST') {
      const body = await request.json().catch(() => null);
      if (!body) return adminJson({ success: false, error: '请求体不是合法 JSON' }, 400);
      const updates = {};

      if ('manualRedirectDomains' in body) {
        const list = String(body.manualRedirectDomains || '').split(/[\s,]+/).map(normalizeDomain).filter(Boolean);
        updates.manual_redirect_domains = list.join(',');
      }
      if ('domainProxyRules' in body) {
        let rules;
        try { rules = JSON.parse(String(body.domainProxyRules || '{}')); } catch (_) {
          return adminJson({ success: false, error: '域名替换规则必须是 JSON 对象' }, 400);
        }
        if (!rules || typeof rules !== 'object' || Array.isArray(rules)) {
          return adminJson({ success: false, error: '域名替换规则必须是 JSON 对象' }, 400);
        }
        updates.domain_proxy_rules = JSON.stringify(rules);
      }
      if ('tgChatId' in body) updates.tg_chat_id = String(body.tgChatId || '').trim().slice(0, 100);
      if ('tgBotToken' in body && String(body.tgBotToken || '').trim()) {
        updates.tg_bot_token = String(body.tgBotToken).trim();
      }
      if (body.clearTgToken) updates.tg_bot_token = '';
      if ('tgDailyReport' in body) updates.tg_daily_report = body.tgDailyReport ? '1' : '0';
      if ('autoDns' in body) updates.auto_dns = body.autoDns ? '1' : '0';
      if ('healthAlerts' in body) updates.health_alerts = body.healthAlerts ? '1' : '0';
      if ('dnsRecordCount' in body) {
        updates.dns_record_count = String(Math.max(1, Math.min(5, parseInt(body.dnsRecordCount, 10) || 1)));
      }
      if ('dnsRootDomain' in body) {
        const d = String(body.dnsRootDomain || '').trim();
        if (d && !normalizeDomain(d)) return adminJson({ success: false, error: '根域名格式不正确' }, 400);
        updates.dns_root_domain = d;
      }

      await saveSettings(env, updates);
      await addAudit(env, request, 'settings.update', Object.keys(updates).join(','));
      return adminJson({ success: true });
    }
  }

  if (url.pathname === '/admin/api/telegram/test' && method === 'POST') {
    const text = `✅ <b>Emby Proxy 测试消息</b>\n版本：${CURRENT_VERSION}\n时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`;
    const r = await sendTelegram(env, text);
    return adminJson(r, r.ok ? 200 : 400);
  }

  // ---------- 统计 / 日志 ----------
  if (url.pathname === '/admin/api/stats' && method === 'GET') {
    return handleAdminStats(env, url);
  }

  if (url.pathname === '/admin/api/logs' && method === 'GET') {
    const { results } = await env.DB.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT 50').all();
    return adminJson({ success: true, logs: results || [] });
  }

  // ---------- 导入 / 导出 ----------
  if (url.pathname === '/admin/api/config/export' && method === 'GET') {
    const routes = await env.DB.prepare('SELECT * FROM routes ORDER BY sort_order, prefix').all();
    const domains = await listOptimizedDomains(env);
    const settings = { ...(await getAllSettings(env)) };
    delete settings.tg_bot_token;
    return adminJson({
      success: true,
      version: CURRENT_VERSION,
      exportedAt: new Date().toISOString(),
      routes: routes.results || [],
      domains: domains.map(d => ({ domain: d.domain, name: d.name, isBuiltin: d.isBuiltin })),
      settings,
      dnsConfig: await getDNSConfig(env),
    });
  }

  if (url.pathname === '/admin/api/config/import' && method === 'POST') {
    const body = await request.json().catch(() => null);
    if (!body) return adminJson({ success: false, error: '请求体不是合法 JSON' }, 400);

    const mode = body.mode === 'replace' ? 'replace' : 'merge';
    const routes = Array.isArray(body.routes) ? body.routes : [];
    const domains = Array.isArray(body.domains) ? body.domains : [];

    // 先校验全部路由，避免导入一半失败
    const preparedRoutes = [];
    for (const r of routes.slice(0, 500)) {
      const prefix = normalizePrefix(r.prefix);
      if (validatePrefix(prefix)) continue;
      const t = parseTargets(r.target);
      if (t.error) continue;
      const h = parseCustomHeaders(r.custom_headers || '');
      preparedRoutes.push({
        prefix,
        target: t.targets.join(', '),
        remark: String(r.remark || '').slice(0, 120),
        cache_img: r.cache_img === 'off' ? 'off' : 'on',
        compat_mode: r.compat_mode === 'on' ? 'on' : 'off',
        ip_mode: normalizeIpMode(r.ip_mode),
        enabled: (r.enabled === 0 || r.enabled === '0' || r.enabled === false) ? 0 : 1,
        custom_headers: h.error ? '' : (Object.keys(h.headers).length ? JSON.stringify(h.headers) : ''),
        last_play: String(r.last_play || ''),
        sort_order: Number(r.sort_order) || 0,
      });
    }

    const stmts = [];
    if (mode === 'replace') stmts.push(env.DB.prepare('DELETE FROM routes'));
    for (const r of preparedRoutes) {
      stmts.push(env.DB.prepare(
        `INSERT INTO routes (prefix, target, remark, cache_img, compat_mode, ip_mode, enabled, custom_headers, last_play, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(prefix) DO UPDATE SET
           target = excluded.target, remark = excluded.remark, cache_img = excluded.cache_img,
           compat_mode = excluded.compat_mode, ip_mode = excluded.ip_mode, enabled = excluded.enabled,
           custom_headers = excluded.custom_headers, sort_order = excluded.sort_order`
      ).bind(r.prefix, r.target, r.remark, r.cache_img, r.compat_mode, r.ip_mode, r.enabled, r.custom_headers, r.last_play, r.sort_order));
    }

    if (mode === 'replace') stmts.push(env.DB.prepare('DELETE FROM optimized_domains WHERE is_builtin = 0'));
    for (const d of domains.slice(0, 300)) {
      const domain = normalizeDomain(d.domain);
      if (!domain) continue;
      stmts.push(env.DB.prepare(
        'INSERT OR IGNORE INTO optimized_domains (domain, name, is_builtin) VALUES (?, ?, 0)'
      ).bind(domain, String(d.name || domain).slice(0, 60)));
    }

    if (stmts.length) await env.DB.batch(stmts);

    if (body.settings && typeof body.settings === 'object') {
      const allowed = ['manual_redirect_domains', 'domain_proxy_rules', 'tg_chat_id', 'tg_daily_report', 'auto_dns', 'dns_record_count', 'dns_root_domain', 'health_alerts'];
      const updates = {};
      for (const k of allowed) if (k in body.settings) updates[k] = body.settings[k];
      if (Object.keys(updates).length) await saveSettings(env, updates);
    }

    if (body.dnsConfig && body.dnsConfig.dnsName) {
      await saveDNSConfig(env, body.dnsConfig.dnsName, body.dnsConfig.currentDomain || '', body.dnsConfig.zoneId || '');
    }

    clearRouteCache();
    purgeDomainCaches(ctx, url.origin);
    await addAudit(env, request, 'config.import', `${mode}: ${preparedRoutes.length} routes / ${domains.length} domains`);
    return adminJson({ success: true, importedRoutes: preparedRoutes.length, importedDomains: domains.length, mode });
  }

  return adminJson({ error: 'Not found' }, 404);
}

async function handleAdminApi(request, env, url, ctx) {
  try {
    return await handleAdminApiInner(request, env, url, ctx);
  } catch (e) {
    console.error('admin api error:', e && e.stack || e);
    await addAudit(env, request, 'error', String(e?.message || e));
    return adminJson({ error: String(e?.message || e) || '服务器内部错误' }, 500);
  }
}

// ==================== 定时任务 ====================

async function autoOptimizeDNS(env) {
  const config = await getDNSConfig(env);
  if (!config || !config.dnsName) return { ok: false, error: '未配置 DNS 记录' };
  const runtime = await getRuntimeConfig(env);
  const speed = await speedtestDeduped(env);
  const usable = speed.results.filter(r => r.latency >= 0).slice(0, runtime.dnsRecordCount);
  if (!usable.length) return { ok: false, error: '没有可用优选域名' };

  let targets = usable.map(r => r.domain);
  // CNAME 只能存在一条：若目标不是 IP，则只保留最优的一条
  const isIpTarget = (t) => /^\d{1,3}(?:\.\d{1,3}){3}$/.test(t) || /^[0-9a-f:]+$/i.test(t) && t.includes(':');
  if (targets.some(t => !isIpTarget(t))) targets = targets.slice(0, 1);

  const current = String(config.currentDomain || '').split(',').map(s => s.trim()).filter(Boolean);
  if (targets.length === current.length && targets.every((t, i) => t === current[i])) {
    return { ok: true, skipped: true, targets };
  }

  const zoneInfo = await resolveZoneInfo(env);
  const rootDomain = runtime.dnsRootDomain || zoneInfo.zoneName || getBaseDomain(env) || '';
  if (!rootDomain) return { ok: false, error: '未配置域名（请设置 BASE_DOMAIN）' };
  const result = await replaceDNSRecords(env, config.zoneId || zoneInfo.zoneId, config.dnsName, targets, rootDomain, targets.length);
  if (runtime.tgChatId || runtime.tgBotToken) {
    const text = result.success
      ? `🔄 <b>自动优选 DNS 已更新</b>\n${telegramTextEscape(config.dnsName)}\n→ ${telegramTextEscape(targets.join(', '))}`
      : `⚠️ <b>自动优选 DNS 失败</b>\n${telegramTextEscape(result.error || '未知错误')}`;
    await sendTelegram(env, text, runtime);
  }
  return result;
}

async function scheduledTask(event, env, ctx) {
  await initDatabase(env);

  // 用 scheduledTime 判断北京时间，而不是死磕 cron 字符串：
  // 只要在 23:00–23:59（北京时间）触发，就发日报。
  const when = Number(event?.scheduledTime) || Date.now();
  const bjHour = getShanghaiParts(when).hour;

  if (bjHour === 23) {
    const runtime = await getRuntimeConfig(env);
    ctx.waitUntil((async () => {
      await flushStats(env);
      if (runtime.tgDailyReport && runtime.tgBotToken && runtime.tgChatId) {
        await sendDailyReport(env, getShanghaiParts(when).dateKey);
      }
    })());
    return;
  }

  // 其余 Cron 用于自动优选 DNS
  const runtime = await getRuntimeConfig(env);
  if (runtime.autoDns) {
    ctx.waitUntil(autoOptimizeDNS(env));
  }
  ctx.waitUntil(flushStats(env));
}

// ==================== 页面样式 ====================

const PAGE_STYLE = `
  :root { --radius: 12px; --radius-s: 8px; }
  html[data-theme="dark"] {
    --bg: #06090f; --bg-grid: rgba(120,160,200,.045); --glow: rgba(56,209,255,.07);
    --surface: rgba(13,19,30,.74); --surface-2: rgba(20,28,42,.5);
    --line: rgba(148,163,184,.14); --line-strong: rgba(148,163,184,.3);
    --text: #dce5f0; --text-dim: #8494a8; --text-faint: #5a6b80;
    --accent: #41d9ff; --accent-dim: rgba(65,217,255,.12); --accent-line: rgba(65,217,255,.45);
    --accent-ink: #041018; --ok: #3ddc97; --ok-dim: rgba(61,220,151,.14);
    --warn: #ffc857; --warn-dim: rgba(255,200,87,.13);
    --bad: #ff6b6b; --bad-dim: rgba(255,107,107,.13);
    --info: #7ab8ff; --info-dim: rgba(122,184,255,.13);
    --shadow: 0 14px 44px rgba(0,0,0,.4); --input-bg: rgba(8,12,20,.62);
    --term-bar: rgba(15,22,34,.95);
  }
  html[data-theme="light"] {
    --bg: #f2f5f8; --bg-grid: rgba(30,60,90,.06); --glow: rgba(14,116,144,.06);
    --surface: rgba(255,255,255,.88); --surface-2: rgba(255,255,255,.65);
    --line: rgba(15,30,50,.1); --line-strong: rgba(15,30,50,.22);
    --text: #101826; --text-dim: #51617a; --text-faint: #8595ab;
    --accent: #087ea8; --accent-dim: rgba(8,126,168,.09); --accent-line: rgba(8,126,168,.45);
    --accent-ink: #ffffff; --ok: #0e9f6e; --ok-dim: rgba(14,159,110,.1);
    --warn: #b7791f; --warn-dim: rgba(183,121,31,.1);
    --bad: #dc2626; --bad-dim: rgba(220,38,38,.09);
    --info: #2563eb; --info-dim: rgba(37,99,235,.09);
    --shadow: 0 10px 30px rgba(20,40,70,.09); --input-bg: rgba(255,255,255,.85);
    --term-bar: #e7ecf2;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }
  html { -webkit-text-size-adjust: 100%; }
  ::-webkit-scrollbar { width: 8px; height: 8px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--line-strong); border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: var(--accent-line); }

  body {
    font-family: -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
    line-height: 1.65; color: var(--text); background: var(--bg);
    min-height: 100vh; overflow-x: hidden;
    transition: background .3s ease, color .3s ease;
  }
  body::before {
    content: ''; position: fixed; inset: 0; z-index: 0; pointer-events: none;
    background-image:
      linear-gradient(var(--bg-grid) 1px, transparent 1px),
      linear-gradient(90deg, var(--bg-grid) 1px, transparent 1px);
    background-size: 44px 44px;
  }
  body::after {
    content: ''; position: fixed; inset: 0; z-index: 0; pointer-events: none;
    background: radial-gradient(ellipse 70% 45% at 50% -12%, var(--glow), transparent 70%);
  }

  .mono, code, .stat-val, .term, .lat span, .edge-item strong { font-family: ui-monospace, 'SF Mono', 'Cascadia Code', Consolas, 'JetBrains Mono', monospace; }

  .container { max-width: 1160px; margin: auto; padding: 28px 22px 48px; display: flex; flex-direction: column; gap: 22px; position: relative; z-index: 1; }

  .topbar {
    position: sticky; top: 0; z-index: 50;
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    padding: 14px 22px; margin: -28px -22px 0;
    background: var(--surface); backdrop-filter: blur(16px) saturate(1.3); -webkit-backdrop-filter: blur(16px) saturate(1.3);
    border-bottom: 1px solid var(--line);
  }
  .brand { display: flex; align-items: center; gap: 10px; font-family: ui-monospace, 'SF Mono', Consolas, monospace; font-weight: 700; letter-spacing: .04em; font-size: 15px; color: var(--text); text-decoration: none; }
  .brand-mark { width: 9px; height: 9px; background: var(--accent); border-radius: 2px; box-shadow: 0 0 12px var(--accent-line); animation: pulse 2.6s ease-in-out infinite; }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .45; } }
  .topbar-actions { display: flex; gap: 8px; align-items: center; }

  /* 顶部快捷入口 */
  .linkbar { display: flex; flex-wrap: wrap; gap: 8px; margin-top: -6px; }
  .linkbar a {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 7px 13px; border-radius: 999px; font-size: 12px; font-weight: 600;
    border: 1px solid var(--line-strong); background: var(--surface); color: var(--text);
    text-decoration: none; transition: border-color .2s ease, color .2s ease, transform .2s ease;
  }
  .linkbar a:hover { border-color: var(--accent); color: var(--accent); transform: translateY(-1px); }

  .card {
    background: var(--surface); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
    border: 1px solid var(--line); border-radius: var(--radius);
    padding: 24px; position: relative;
    animation: rise .55s cubic-bezier(.22,1,.36,1) both;
    transition: border-color .25s ease, box-shadow .25s ease;
  }
  .container > .card:nth-child(2) { animation-delay: .06s; }
  .container > .card:nth-child(3) { animation-delay: .12s; }
  .container > .card:nth-child(4) { animation-delay: .18s; }
  .container > .card:nth-child(5) { animation-delay: .24s; }
  @keyframes rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
  .card:hover { border-color: var(--line-strong); }

  .sec-title {
    font-family: ui-monospace, 'SF Mono', Consolas, monospace;
    font-size: 12px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase;
    color: var(--text-dim); display: flex; align-items: center; gap: 8px; margin-bottom: 18px;
  }
  .sec-title::before { content: '//'; color: var(--accent); letter-spacing: 0; }
  .sec-title .chip { font-size: 10px; padding: 2px 8px; border-radius: 99px; background: var(--accent-dim); color: var(--accent); border: 1px solid var(--accent-line); letter-spacing: .08em; }

  .muted { color: var(--text-faint); font-size: 13px; }
  code {
    background: var(--accent-dim); color: var(--accent);
    padding: 3px 8px; border-radius: 5px; font-size: .85em;
    border: 1px solid var(--line); word-break: break-all;
  }

  .btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 7px;
    padding: 9px 18px; border-radius: var(--radius-s);
    background: transparent; border: 1px solid var(--line-strong); color: var(--text);
    font: 600 13.5px/1 -apple-system, system-ui, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
    cursor: pointer; text-decoration: none; white-space: nowrap;
    transition: all .18s ease;
  }
  .btn:hover { border-color: var(--accent-line); color: var(--accent); box-shadow: 0 0 0 3px var(--accent-dim); }
  .btn:active { transform: translateY(1px); }
  .btn:disabled { opacity: .45; cursor: not-allowed; }
  .btn-solid { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
  .btn-solid:hover { color: var(--accent-ink); filter: brightness(1.1); box-shadow: 0 4px 18px var(--accent-dim); }
  .btn-danger { border-color: var(--bad-dim); color: var(--bad); background: var(--bad-dim); }
  .btn-danger:hover { border-color: var(--bad); color: var(--bad); box-shadow: 0 0 0 3px var(--bad-dim); }
  .btn-sm { padding: 6px 12px; font-size: 12.5px; }

  .theme-toggle {
    font-family: ui-monospace, 'SF Mono', Consolas, monospace;
    font-size: 11px; letter-spacing: .1em; padding: 7px 12px;
    background: transparent; border: 1px solid var(--line-strong); color: var(--text-dim);
    border-radius: 99px; cursor: pointer; transition: all .18s ease; min-width: 74px;
  }
  .theme-toggle:hover { color: var(--accent); border-color: var(--accent-line); }

  .hero { text-align: center; padding: 46px 24px 38px; }
  .hero-kicker { font-family: ui-monospace, 'SF Mono', Consolas, monospace; font-size: 11px; letter-spacing: .3em; text-transform: uppercase; color: var(--accent); margin-bottom: 14px; }
  .hero h1 { font-size: clamp(1.9rem, 5vw, 2.9rem); font-weight: 800; letter-spacing: -.02em; line-height: 1.15; margin-bottom: 12px; }
  .hero h1 em { font-style: normal; color: var(--accent); text-shadow: 0 0 30px var(--accent-line); }
  .hero p { color: var(--text-dim); font-size: 14.5px; max-width: 520px; margin: 0 auto; }
  .hero-actions { margin-top: 26px; display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }

  .term { border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden; text-align: left; margin-top: 28px; background: var(--surface-2); }
  .term-bar { display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: var(--term-bar); border-bottom: 1px solid var(--line); }
  .term-bar i { width: 10px; height: 10px; border-radius: 50%; background: var(--line-strong); }
  .term-bar i:first-child { background: var(--bad); } .term-bar i:nth-child(2) { background: var(--warn); } .term-bar i:nth-child(3) { background: var(--ok); }
  .term-bar span { margin-left: 8px; font-size: 11px; color: var(--text-faint); letter-spacing: .08em; }
  .term-body { padding: 16px 18px; font-size: 13px; line-height: 2; }
  .term-body .p { color: var(--accent); margin-right: 10px; }
  .term-body .dim { color: var(--text-faint); }
  .term-body .hl { color: var(--accent); }

  .stat-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 14px; margin: 18px 0 6px; }
  .stat-row.compact { grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); }
  .stat-card { border: 1px solid var(--line); border-radius: var(--radius-s); padding: 18px; background: var(--surface-2); position: relative; overflow: hidden; transition: border-color .2s ease; }
  .stat-card:hover { border-color: var(--accent-line); }
  .stat-card > div:first-child { color: var(--text-dim); font-size: 11px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; margin-bottom: 8px; }
  .stat-val { font-size: 1.9em; font-weight: 700; color: var(--text); font-variant-numeric: tabular-nums; letter-spacing: -.01em; }
  .stat-sub { color: var(--text-faint); font-size: 11px; margin-top: 6px; }

  table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 13.5px; }
  th, td { padding: 12px 14px; text-align: left; }
  th { color: var(--text-faint); font-family: ui-monospace, 'SF Mono', Consolas, monospace; font-weight: 600; font-size: 10.5px; text-transform: uppercase; letter-spacing: .1em; border-bottom: 1px solid var(--line-strong); }
  td { border-bottom: 1px solid var(--line); }
  tbody tr:last-child td { border-bottom: none; }
  tbody tr { transition: background .15s ease; }
  tbody tr:hover { background: var(--accent-dim); }
  tr.best td { background: var(--ok-dim); }
  tr.best td:first-child { box-shadow: inset 3px 0 0 var(--ok); }

  .tag { display: inline-flex; align-items: center; padding: 3px 9px; border-radius: 5px; font-size: 11px; font-weight: 600; }
  .tag-fast { background: var(--ok-dim); color: var(--ok); }
  .tag-good { background: var(--info-dim); color: var(--info); }
  .tag-slow { background: var(--warn-dim); color: var(--warn); }
  .tag-timeout { background: var(--bad-dim); color: var(--bad); }
  .tag-builtin { background: var(--surface-2); color: var(--text-faint); border: 1px solid var(--line); }
  .tag-best { background: var(--ok-dim); color: var(--ok); border: 1px solid var(--ok); }
  .tag-off { background: var(--bad-dim); color: var(--bad); }

  .lat { display: flex; align-items: center; gap: 10px; min-width: 120px; }
  .lat-bar { flex: 1; height: 4px; border-radius: 99px; background: var(--line); overflow: hidden; max-width: 90px; }
  .lat-bar i { display: block; height: 100%; border-radius: 99px; background: linear-gradient(90deg, var(--accent), var(--info)); transition: width .5s cubic-bezier(.22,1,.36,1); }
  .lat span { font-size: 12px; color: var(--text-dim); font-variant-numeric: tabular-nums; white-space: nowrap; }

  .edge-box { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px; }
  .edge-item { background: var(--surface-2); padding: 14px 16px; border-radius: var(--radius-s); font-size: 13px; border: 1px solid var(--line); transition: border-color .2s ease; }
  .edge-item:hover { border-color: var(--accent-line); }
  .edge-item strong { display: block; margin-bottom: 5px; font-size: 10px; text-transform: uppercase; letter-spacing: .1em; color: var(--accent); font-weight: 600; }
  .edge-item span:last-child { color: var(--text); font-weight: 500; word-break: break-all; }

  .chart { display: flex; align-items: flex-end; gap: 3px; height: 88px; padding: 10px 8px 6px; background: var(--surface-2); border: 1px solid var(--line); border-radius: var(--radius-s); margin-top: 14px; }
  .chart-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 0; }
  .chart-col i { display: block; width: 100%; background: linear-gradient(180deg, var(--accent), var(--info)); border-radius: 3px 3px 0 0; min-height: 2px; transition: height .5s cubic-bezier(.22,1,.36,1); }
  .chart-col:hover i { background: var(--accent); }
  .chart-col b { font-size: 8px; color: var(--text-faint); font-weight: 500; font-family: ui-monospace, 'SF Mono', Consolas, monospace; }

  .warn { border: 1px solid var(--warn-dim); border-left: 3px solid var(--warn); padding: 13px 16px; border-radius: var(--radius-s); color: var(--warn); background: var(--warn-dim); font-size: 13px; }

  input:not([type=checkbox]):not([type=hidden]):not([type=radio]), select, textarea {
    width: 100%; padding: 11px 14px; border: 1px solid var(--line-strong); border-radius: var(--radius-s);
    background: var(--input-bg); color: var(--text); font-size: 14px; outline: none;
    transition: border-color .18s ease, box-shadow .18s ease;
  }
  textarea { resize: vertical; min-height: 86px; font-family: ui-monospace, 'SF Mono', Consolas, monospace; font-size: 12.5px; line-height: 1.6; }
  input:focus, select:focus, textarea:focus { border-color: var(--accent-line); box-shadow: 0 0 0 3px var(--accent-dim); }
  input::placeholder, textarea::placeholder { color: var(--text-faint); }
  label { display: block; font-weight: 600; margin-bottom: 8px; font-size: 12.5px; color: var(--text-dim); }

  .toolbar { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }

  .route-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(330px, 1fr)); gap: 14px; }
  .route-item { background: var(--surface-2); border: 1px solid var(--line); border-radius: var(--radius-s); padding: 18px; transition: border-color .2s ease, transform .2s ease, opacity .2s ease; }
  .route-item:hover { border-color: var(--accent-line); transform: translateY(-2px); }
  .route-item.dragging { opacity: .45; border-color: var(--accent); }
  .route-item.route-disabled { opacity: .62; }
  .route-header { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 12px; }
  .route-title { flex: 1; min-width: 0; }
  .route-name { font-size: 1.05em; font-weight: 700; color: var(--text); margin: 0 0 3px; word-break: break-all; }
  .route-path { color: var(--accent); font-weight: 600; font-size: .85em; font-family: ui-monospace, 'SF Mono', Consolas, monospace; }
  .route-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 14px; padding-top: 13px; border-top: 1px solid var(--line); }
  .target-list { margin-top: 8px; }
  .target-row { background: var(--input-bg); border: 1px solid var(--line); border-radius: 6px; padding: 9px 12px; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center; gap: 12px; }
  .target-row:hover { border-color: var(--line-strong); }
  .target-url { color: var(--text-dim); font-size: 12.5px; word-break: break-all; flex: 1; }
  .route-meta { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 10px; }
  .meta-tag { font-size: 11px; padding: 3px 8px; background: var(--surface-2); border: 1px solid var(--line); border-radius: 5px; color: var(--text-dim); }
  .drag-handle { cursor: grab; color: var(--text-faint); font-size: 15px; line-height: 1; padding-top: 4px; user-select: none; }
  .drag-handle:active { cursor: grabbing; }

  .switch { position: relative; display: inline-flex; align-items: center; flex-shrink: 0; margin: 0; }
  .switch input { position: absolute; opacity: 0; width: 0; height: 0; }
  .switch .slider { width: 38px; height: 21px; border-radius: 99px; background: var(--line-strong); position: relative; transition: background .2s ease; cursor: pointer; }
  .switch .slider::after { content: ''; position: absolute; top: 3px; left: 3px; width: 15px; height: 15px; border-radius: 50%; background: #fff; transition: transform .2s ease; }
  .switch input:checked + .slider { background: var(--ok); }
  .switch input:checked + .slider::after { transform: translateX(17px); }

  .modal { display: none; position: fixed; inset: 0; background: rgba(2,6,12,.6); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); z-index: 1000; padding: 20px; overflow: auto; }
  .modal.show { display: flex; align-items: center; justify-content: center; animation: fadeIn .18s ease; }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  .modal-inner { background: var(--surface); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); padding: 26px; border-radius: var(--radius); max-width: 560px; width: 100%; border: 1px solid var(--line-strong); box-shadow: var(--shadow); animation: slideUp .22s cubic-bezier(.22,1,.36,1); }
  @keyframes slideUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
  .modal-header { margin-bottom: 20px; }
  .modal-title { font-size: 1.15em; font-weight: 700; color: var(--text); margin: 0; }
  .modal-desc { color: var(--text-faint); font-size: 12.5px; margin: 6px 0 0; }
  .modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 22px; padding-top: 16px; border-top: 1px solid var(--line); }

  .search-box { position: relative; flex: 1; min-width: 200px; }
  .search-box input { margin-bottom: 0; padding-left: 12px; }

  .empty-state { text-align: center; padding: 36px 20px; color: var(--text-faint); }
  .empty-state-icon { font-size: 2.4em; margin-bottom: 10px; display: block; opacity: .5; }
  .empty-state-text { font-size: .95em; margin: 0; }

  .form-group { margin-bottom: 16px; }
  .form-hint { color: var(--text-faint); font-size: 12px; margin: 6px 0 0; }
  .form-hint span { color: var(--accent); font-weight: 600; }
  .checkbox-label { display: flex !important; align-items: center; gap: 10px !important; cursor: pointer; font-weight: 500 !important; }
  .checkbox-label input[type="checkbox"] { width: 16px !important; height: 16px; accent-color: var(--accent); cursor: pointer; flex-shrink: 0; }

  .settings-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 0 18px; }
  .settings-grid .form-group { margin-bottom: 14px; }

  #toast {
    position: fixed; top: -70px; left: 50%; transform: translateX(-50%);
    background: var(--surface); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
    color: var(--text); padding: 12px 22px; border-radius: 99px; font-size: 13.5px; font-weight: 500;
    transition: top .35s cubic-bezier(.22,1,.36,1); z-index: 9999;
    border: 1px solid var(--line-strong); box-shadow: var(--shadow); max-width: 90vw;
  }
  #toast.show { top: 20px; }

  .domain-list { margin-top: 12px; overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .dns-current-config { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 13px 15px; background: var(--surface-2); border: 1px solid var(--line); border-radius: var(--radius-s); margin-bottom: 16px; flex-wrap: wrap; }
  .dns-record-display { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; flex-wrap: wrap; }
  .dns-record-name { font-weight: 700; color: var(--accent); font-size: .95em; word-break: break-all; }
  .dns-record-arrow { color: var(--text-faint); font-size: 1.05em; }
  .dns-record-target { color: var(--text); font-weight: 600; font-size: .95em; word-break: break-all; }
  .dns-live-box { margin-top: 14px; padding: 13px 15px; background: var(--surface-2); border: 1px solid var(--line); border-radius: var(--radius-s); }
  .dns-live-box .rec { font-size: 14px; color: var(--accent); font-weight: 600; word-break: break-all; }
  .dns-live-box .to { font-size: 13px; color: var(--text-dim); margin-top: 4px; word-break: break-all; }
  .dns-live-box .ts { font-size: 11px; color: var(--text-faint); margin-top: 4px; }
  .zone-chip { padding: 5px 12px; background: var(--surface-2); border: 1px solid var(--line); border-radius: 6px; font-size: 13px; }

  .login-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; position: relative; z-index: 1; }
  .login-box { background: var(--surface); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); padding: 38px 34px; border-radius: 16px; max-width: 380px; width: 100%; border: 1px solid var(--line-strong); box-shadow: var(--shadow); animation: rise .55s cubic-bezier(.22,1,.36,1) both; }
  .login-theme { position: absolute; top: 18px; right: 18px; }

  .spin { display: inline-block; width: 14px; height: 14px; border: 2px solid var(--line-strong); border-top-color: var(--accent); border-radius: 50%; animation: spin .7s linear infinite; vertical-align: -2px; margin-right: 8px; }
  @keyframes spin { to { transform: rotate(360deg); } }

  @media (max-width: 768px) {
    .container { padding: 16px 14px 40px; }
    .topbar { padding: 12px 16px; margin: -16px -14px 0; }
    .card { padding: 18px 16px; }
    .hero { padding: 32px 8px 28px; }
    .stat-row { grid-template-columns: repeat(2, 1fr); gap: 10px; }
    .stat-card { padding: 14px; }
    .stat-val { font-size: 1.5em; }
    .route-grid { grid-template-columns: 1fr; }
    .edge-box { grid-template-columns: repeat(2, 1fr); gap: 10px; }
    .modal { padding: 12px; }
    .modal-inner { padding: 20px 16px; }
    table { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }
    .search-box { min-width: 140px; }
    .brand span.bname { display: none; }
  }
  @media (max-width: 480px) {
    .stat-row { grid-template-columns: 1fr 1fr; }
    .edge-box { grid-template-columns: 1fr; }
    .hero-actions .btn { flex: 1; }
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; }
  }
`;

// ==================== 主题控制 ====================

const THEME_INIT = `
(function(){
  var pref='auto';
  try{ var s=localStorage.getItem('proxy-theme'); if(s==='dark'||s==='light'||s==='auto') pref=s; }catch(e){}
  function darkNow(){ return pref==='dark'||(pref==='auto'&&window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches); }
  document.documentElement.setAttribute('data-theme',darkNow()?'dark':'light');
  document.documentElement.setAttribute('data-theme-pref',pref);
})();
`;

const THEME_LOGIC = `
var THEME_PREF=document.documentElement.getAttribute('data-theme-pref')||'auto';
function applyTheme(pref){
  THEME_PREF=pref;
  var dark=pref==='dark'||(pref==='auto'&&window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme',dark?'dark':'light');
  document.documentElement.setAttribute('data-theme-pref',pref);
  var btn=document.getElementById('themeToggle');
  if(btn){ btn.textContent=pref==='auto'?'AUTO':(pref==='dark'?'DARK':'LIGHT'); btn.title=pref==='auto'?'跟随系统':(pref==='dark'?'深色模式':'浅色模式'); }
  var meta=document.querySelector('meta[name=theme-color]');
  if(meta){ meta.setAttribute('content',dark?'#06090f':'#f2f5f8'); }
}
function cycleTheme(){
  var next=THEME_PREF==='auto'?'dark':(THEME_PREF==='dark'?'light':'auto');
  try{ localStorage.setItem('proxy-theme',next); }catch(e){}
  applyTheme(next);
}
if(window.matchMedia){
  try{
    var mq=matchMedia('(prefers-color-scheme: dark)');
    var onMq=function(){ if(THEME_PREF==='auto') applyTheme('auto'); };
    if(mq.addEventListener){ mq.addEventListener('change',onMq); } else if(mq.addListener){ mq.addListener(onMq); }
  }catch(e){}
}
applyTheme(THEME_PREF);

function escHtml(v){
  return String(v==null?'':v).replace(/[&<>"']/g,function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}
function fqdn(name, root){
  var n=String(name||'').trim().toLowerCase().replace(/^\\.+|\\.+$/g,'');
  var r=String(root||'').trim().toLowerCase().replace(/^\\.+|\\.+$/g,'');
  if(!n || n==='@') return r;
  if(!r) return n;
  if(n===r || n.slice(-(r.length+1))==='.'+r) return n;
  return n+'.'+r;
}
function fmtNum(n){ try{ return Number(n||0).toLocaleString('zh-CN'); }catch(e){ return String(n||0); } }
function fmtBytes(n){
  n=Number(n)||0; if(!n) return '0 B';
  var k=1024, u=['B','KB','MB','GB','TB','PB'], i=Math.min(u.length-1,Math.floor(Math.log(n)/Math.log(k)));
  return parseFloat((n/Math.pow(k,i)).toFixed(2))+' '+u[i];
}
`;

// ==================== 首页 ====================

// 页面顶部快捷入口（可用环境变量覆盖）
function safeHttpUrl(v, fallback) {
  const s = String(v == null ? '' : v).trim();
  return /^https?:\/\//i.test(s) ? s : fallback;
}

function renderTopLinks(env) {
  const links = [
    { icon: '📈', label: '优选域名监控', url: safeHttpUrl(envStr(env, 'MONITOR_URL'), 'https://yx.255432.xyz/') },
    { icon: '💬', label: 'Telegram 群组', url: safeHttpUrl(envStr(env, 'TG_GROUP_URL'), 'https://t.me/+7cbXthaBajszNjI1') },
  ];
  return '<div class="linkbar">' + links.map(l =>
    '<a href="' + l.url + '" target="_blank" rel="noopener">' + l.icon + ' ' + l.label + '</a>'
  ).join('') + '</div>';
}

function buildFrontendHtml(env) {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light"><meta name="theme-color" content="#06090f">
<title>Emby 反向代理</title><link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎬</text></svg>">
<script>${THEME_INIT}</script>
<style>${PAGE_STYLE}</style></head><body>
<div class="container">
  <div class="topbar">
    <a class="brand" href="/"><i class="brand-mark"></i><span class="bname">EMBY<span style="color:var(--accent)">·</span>PROXY</span></a>
    <div class="topbar-actions">
      <button class="theme-toggle" id="themeToggle" onclick="cycleTheme()">AUTO</button>
      <a href="/admin" class="btn btn-sm">管理后台</a>
    </div>
  </div>

  ${renderTopLinks(env)}

  <div class="card hero">
    <div class="hero-kicker">REVERSE&nbsp;PROXY&nbsp;·&nbsp;EDGE&nbsp;NETWORK</div>
    <h1>Emby <em>反向代理</em></h1>
    <p>版本 ${CURRENT_VERSION} · 支持别名快捷入口与优选域名自动测速 · 边缘节点智能加速</p>
    <div class="term">
      <div class="term-bar"><i></i><i></i><i></i><span>~/emby-proxy — usage</span></div>
      <div class="term-body">
        <div><span class="p">$</span>https://<span class="hl">你的域名</span>/别名</div>
        <div><span class="p">$</span>https://<span class="hl">你的域名</span>/https://emby.example.com:8096</div>
        <div class="dim"># 添加服务后请务必手动测试 · 登录与接口已限流</div>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="sec-title">当前边缘节点 <span class="chip">EDGE</span></div>
    <div id="edge-loading" class="muted"><span class="spin"></span>正在探测...</div>
    <div id="edge-info" class="edge-box" style="display:none"></div>
  </div>

  <div class="card">
    <div class="sec-title">优选域名测速 <span class="chip">LATENCY</span></div>
    <div class="toolbar" style="margin-bottom:14px">
      <button class="btn btn-sm" id="btn-retest">重新测速</button>
      <span id="speed-status" class="muted"></span>
    </div>
    <div id="domain-table-wrap"><p class="muted"><span class="spin"></span>正在测速...</p></div>
  </div>

  <div class="card">
    <div class="sec-title">使用统计 <span class="chip">D1&nbsp;+&nbsp;CF</span></div>
    <div id="stats-loading" class="muted"><span class="spin"></span>加载中...</div>
    <div id="stats-body" style="display:none">
      <div class="stat-row compact">
        <div class="stat-card"><div>今日请求</div><div class="stat-val" id="st-req">0</div><div class="stat-sub" id="st-req-sub"></div></div>
        <div class="stat-card"><div>出站流量</div><div class="stat-val" id="st-traffic">0 B</div><div class="stat-sub" id="st-traffic-sub"></div></div>
        <div class="stat-card"><div>入站流量</div><div class="stat-val" id="st-in">0 B</div><div class="stat-sub">请求体大小</div></div>
        <div class="stat-card"><div>播放次数</div><div class="stat-val" id="st-plays">0</div><div class="stat-sub">仅 Sessions/Playing</div></div>
        <div class="stat-card"><div>CF 访问量</div><div class="stat-val" id="st-uv">—</div><div class="stat-sub">需 CF Analytics Token</div></div>
      </div>
      <div id="hourly-chart"></div>
      <div class="sec-title" style="margin-top:22px">近 7 日 <span class="chip">7D</span></div>
      <div id="daily-chart"></div>
      <p class="muted" style="font-size:11px;margin-top:10px" id="st-updated"></p>
    </div>
  </div>
</div>
<script>${THEME_LOGIC}
var TAG = { fast:'极快', good:'良好', slow:'较慢', timeout:'超时' };
var CLS = { fast:'tag-fast', good:'tag-good', slow:'tag-slow', timeout:'tag-timeout' };

async function loadEdge() {
  try {
    var r = await fetch('/api/edge-info', { cache:'no-store' });
    var d = await r.json();
    document.getElementById('edge-loading').style.display = 'none';
    var box = document.getElementById('edge-info');
    box.style.display = 'grid';
    box.innerHTML = [
      ['客户端 IP', d.clientIp],
      ['接入 POP', d.entryColo],
      ['国家/地区', d.entryCountry + (d.entryCity ? ' / '+d.entryCity : '')],
      ['边缘出口 IP', d.edgeIp],
      ['落地 COLO', d.egressColo]
    ].map(function(kv){ return '<div class="edge-item"><strong>'+escHtml(kv[0])+'</strong><span>'+escHtml(kv[1]||'—')+'</span></div>'; }).join('');
  } catch(e) { document.getElementById('edge-loading').textContent = '加载失败'; }
}

function renderDomainTable(results, best) {
  var wrap = document.getElementById('domain-table-wrap');
  if (!results || !results.length) { wrap.innerHTML = '<p class="muted">无数据</p>'; return; }
  var html = '<div style="overflow-x:auto;-webkit-overflow-scrolling:touch"><table style="min-width:520px"><thead><tr><th>#</th><th>名称</th><th>域名</th><th>延迟</th><th>状态</th></tr></thead><tbody>';
  results.forEach(function(r, i) {
    var host = r.host || r.domain;
    var isBest = best && best.domain === r.domain;
    var pct = r.latency >= 0 ? Math.max(5, Math.min(100, Math.round(r.latency / 3))) : 0;
    html += '<tr class="'+(isBest?'best':'')+'"><td class="mono" style="color:var(--text-faint)">'+(i+1)+'</td>'
      + '<td style="white-space:nowrap">'+ escHtml(r.name||'—') + (isBest?' <span class="tag tag-best">BEST</span>':'') +'</td>'
      + '<td><code style="font-size:12px">'+escHtml(host)+'</code></td>'
      + '<td><div class="lat"><div class="lat-bar"><i style="width:'+pct+'%"></i></div><span>'+(r.latency>=0?r.latency+' ms':'—')+'</span></div></td>'
      + '<td><span class="tag '+CLS[r.status||'timeout']+'">'+(TAG[r.status]||'—')+'</span></td></tr>';
  });
  wrap.innerHTML = html + '</tbody></table></div>';
}

function pingMs(url, timeout) {
  return new Promise(function(resolve) {
    var t0 = performance.now();
    var timer = setTimeout(function(){ resolve(-1); }, timeout || 7000);
    var done = function(ms) { clearTimeout(timer); resolve(ms >= 0 && ms < (timeout || 7000) ? ms : -1); };
    fetch(url, { mode: 'no-cors', cache: 'no-store', credentials: 'omit' })
      .then(function(){ done(Math.round(performance.now() - t0)); })
      .catch(function() {
        var img = new Image();
        var t1 = performance.now();
        var t2 = setTimeout(function(){ done(-1); }, 5000);
        var end = function(){ clearTimeout(t2); done(Math.round(performance.now() - t1)); };
        img.onload = end;
        img.onerror = end;
        img.src = url + (url.indexOf('?') >= 0 ? '&' : '?') + '_=' + Date.now();
      });
  });
}

async function probeDomain(item) {
  var host = item.domain;
  var paths = ['/cdn-cgi/trace', '/favicon.ico', '/'];
  for (var i = 0; i < paths.length; i++) {
    var ms = await pingMs('https://' + host + paths[i], 7000);
    if (ms >= 0) {
      var status = ms < 100 ? 'fast' : ms < 300 ? 'good' : 'slow';
      return { id: item.id, domain: item.domain, name: item.name, host: host, latency: ms, status: status, isBuiltin: item.isBuiltin };
    }
  }
  try {
    var r = await fetch('/api/ping-host?host=' + encodeURIComponent(host));
    var d = await r.json();
    if (d.ms >= 0) {
      var st = d.ms < 100 ? 'fast' : d.ms < 300 ? 'good' : 'slow';
      return { id: item.id, domain: item.domain, name: item.name, host: host, latency: d.ms, status: st, isBuiltin: item.isBuiltin };
    }
  } catch (_) {}
  return { id: item.id, domain: item.domain, name: item.name, host: host, latency: -1, status: 'timeout', isBuiltin: item.isBuiltin };
}

function finalizeResults(rows) {
  rows.forEach(function(r){ r.status = r.latency >= 0 ? (r.latency < 100 ? 'fast' : r.latency < 300 ? 'good' : 'slow') : 'timeout'; });
  rows.sort(function(a,b){ if (a.latency<0) return 1; if (b.latency<0) return -1; return a.latency-b.latency; });
  return rows;
}

async function getOptimizedDomains() {
  try {
    var r = await fetch('/api/domains/list');
    var d = await r.json();
    if (d.success) return d.domains || [];
  } catch (_) {}
  return [];
}

async function runDomainSpeed(force) {
  var st = document.getElementById('speed-status');
  var wrap = document.getElementById('domain-table-wrap');
  st.textContent = '正在测速...';
  wrap.innerHTML = '<p class="muted"><span class="spin"></span>正在测试您本地网络到各优选域名的延迟...</p>';
  try {
    var er = await fetch('/api/domains/speed?edge=1');
    var ed = await er.json();
    if (ed.results && ed.results.length) {
      renderDomainTable(ed.results, ed.best);
      st.textContent = '边缘测速完成，正在用您的网络复测...';
    }
  } catch (_) {}
  var domains = await getOptimizedDomains();
  var clientResults = await Promise.all(domains.map(probeDomain));
  finalizeResults(clientResults);
  var clientOk = clientResults.filter(function(r){ return r.latency >= 0; }).length;
  var best = clientResults.find(function(r){ return r.latency >= 0; });
  renderDomainTable(clientResults, best);
  if (clientOk > 0) st.textContent = '测速完成 · ' + clientOk + ' 个可用 · 推荐: ' + (best ? best.domain : '无');
  else st.textContent = '测速失败，请检查网络或稍后重试';
}

function renderChart(el, series, labelSuffix) {
  if (!el || !series || !series.length) return;
  var max = Math.max(1, Math.max.apply(null, series.map(function(h){ return h.total; })));
  var html = '<div class="chart">';
  series.forEach(function(h){
    var ht = Math.max(2, Math.round((h.total/max)*68));
    var label = h.label || '';
    html += '<div class="chart-col" title="'+escHtml(label+' · '+fmtNum(h.total)+' 次')+'"><i style="height:'+ht+'px"></i><b>'+escHtml(label.slice(0,2))+'</b></div>';
  });
  html += '</div>';
  if (labelSuffix) html += '<p class="muted" style="font-size:11px;margin-top:6px">'+escHtml(labelSuffix)+'</p>';
  el.innerHTML = html;
}

async function loadStats() {
  try {
    var r = await fetch('/stats');
    var d = await r.json();
    if (d.error) { document.getElementById('stats-loading').textContent = d.error; return; }
    var s = d.data;
    document.getElementById('stats-loading').style.display = 'none';
    document.getElementById('stats-body').style.display = 'block';
    document.getElementById('st-req').textContent = fmtNum(s.todayRequests);
    document.getElementById('st-req-sub').textContent = '来源: ' + (s.source || 'D1');
    document.getElementById('st-traffic').textContent = s.todayTraffic || '0 B';
    document.getElementById('st-traffic-sub').textContent = 'Worker 实际响应字节';
    document.getElementById('st-in').textContent = s.requestTraffic || '0 B';
    document.getElementById('st-plays').textContent = fmtNum(s.plays);
    document.getElementById('st-uv').textContent = s.todayVisits == null ? '—' : fmtNum(s.todayVisits);
    document.getElementById('st-updated').textContent = '更新时间 ' + (s.lastUpdated||'') + ' · ' + (s.cfStatus||'') + (s.cfError ? ' (' + s.cfError + ')' : '');
    renderChart(document.getElementById('hourly-chart'), s.hourlySeries, '今日 24 小时请求分布（上海时区）');
    var daily = (s.dailySeries || []).map(function(x){ return { label: x.date.slice(5), total: x.requests }; });
    renderChart(document.getElementById('daily-chart'), daily, '近 7 日请求趋势');
  } catch(e) { document.getElementById('stats-loading').textContent = '统计加载失败'; }
}

document.getElementById('btn-retest').onclick = function(){ runDomainSpeed(true); };
loadEdge();
runDomainSpeed(false);
loadStats();
</script></body></html>`;
}

// ==================== 登录页 ====================

function buildLoginHtml() {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light"><meta name="theme-color" content="#06090f">
<title>管理登录</title><link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🔐</text></svg>">
<script>${THEME_INIT}</script>
<style>${PAGE_STYLE}</style></head><body>
<div class="login-wrap">
  <div class="login-theme"><button class="theme-toggle" id="themeToggle" onclick="cycleTheme()">AUTO</button></div>
  <div class="login-box">
    <div style="text-align:center;margin-bottom:26px">
      <div class="hero-kicker" style="margin-bottom:10px">ADMIN&nbsp;ACCESS</div>
      <h1 style="font-size:1.5em;font-weight:800;letter-spacing:-.01em">管理后台</h1>
      <p class="muted" style="margin-top:8px">请输入管理密钥以继续</p>
    </div>
    <input type="password" id="tokenInput" placeholder="管理密钥" onkeydown="if(event.key==='Enter')login()" style="text-align:center;letter-spacing:.2em">
    <p id="loginErr" style="color:var(--bad);font-size:13px;min-height:1.4em;margin:10px 0 6px;text-align:center"></p>
    <button class="btn btn-solid" style="width:100%;padding:12px" id="loginBtn" onclick="login()">登 录</button>
    <p class="muted" style="font-size:11px;text-align:center;margin-top:14px">连续失败 8 次将临时封禁 15 分钟</p>
  </div>
</div>
<script>${THEME_LOGIC}
async function login(){
  var t=document.getElementById('tokenInput').value.trim();
  var err=document.getElementById('loginErr');
  var btn=document.getElementById('loginBtn');
  err.textContent='';
  if(!t){ err.textContent='请输入密钥'; return; }
  btn.disabled=true; btn.textContent='验证中...';
  try{
    var r=await fetch('/admin/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:t})});
    var d=await r.json();
    if(d.ok){ location.href='/admin'; return; }
    err.textContent=d.error||'登录失败';
  } catch(e){ err.textContent='请求失败: '+e.message; }
  btn.disabled=false; btn.textContent='登 录';
}
</script></body></html>`;
}

// ==================== 管理后台 ====================

function buildAdminHtml(env) {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light"><meta name="theme-color" content="#06090f">
<title>管理后台</title><link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎛️</text></svg>">
<script>${THEME_INIT}</script>
<style>${PAGE_STYLE}</style></head><body>
<div id="toast"></div>
<div class="container">
  <div class="topbar">
    <a class="brand" href="/"><i class="brand-mark"></i><span class="bname">ADMIN<span style="color:var(--accent)">·</span>CONSOLE</span></a>
    <div class="topbar-actions">
      <button class="theme-toggle" id="themeToggle" onclick="cycleTheme()">AUTO</button>
      <a href="/" class="btn btn-sm">首页</a>
      <button class="btn btn-sm btn-danger" onclick="logout()">退出</button>
    </div>
  </div>

  ${renderTopLinks(env)}

  <div class="card">
    <div class="sec-title">路由管理 <span class="chip" id="routeCount"></span></div>
    <div class="toolbar" style="margin-bottom:16px">
      <button class="btn btn-sm btn-solid" onclick="openRouteModal()">添加路由</button>
      <button class="btn btn-sm" onclick="testAllRoutes()">全部测试</button>
      <button class="btn btn-sm" onclick="exportConfig()">导出配置</button>
      <button class="btn btn-sm" onclick="document.getElementById('importFile').click()">导入配置</button>
      <input type="file" id="importFile" accept="application/json,.json" style="display:none" onchange="importConfig(this)">
      <div class="search-box">
        <input type="text" id="routeSearch" placeholder="搜索备注或路径..." oninput="filterRoutes()">
      </div>
    </div>
    <div id="routeList" class="route-grid"><p class="muted"><span class="spin"></span>加载中...</p></div>
  </div>

  <div class="card">
    <div class="sec-title">优选域名管理 <span class="chip">CDN</span></div>
    <div class="toolbar" style="margin-bottom:16px">
      <button class="btn btn-sm" onclick="openDomainModal()">添加域名</button>
      <button class="btn btn-sm" onclick="testDomains()">开始测速</button>
      <button class="btn btn-sm btn-solid" onclick="openDNSModal()">一键替换 DNS</button>
      <span id="domain-status" class="muted"></span>
    </div>
    <div id="domainList" class="domain-list"><p class="muted"><span class="spin"></span>加载中...</p></div>
  </div>

  <div class="card">
    <div class="sec-title">DNS 配置 <span class="chip">CLOUDFLARE</span></div>
    <div id="dnsConfig"><p class="muted"><span class="spin"></span>加载中...</p></div>
  </div>

  <div class="card">
    <div class="sec-title">流量统计 <span class="chip" id="adminStatsDate">TODAY</span></div>
    <div class="stat-row compact">
      <div class="stat-card"><div>请求数</div><div class="stat-val" id="as-req">0</div><div class="stat-sub">D1 聚合</div></div>
      <div class="stat-card"><div>出站流量</div><div class="stat-val" id="as-out">0 B</div><div class="stat-sub">响应体</div></div>
      <div class="stat-card"><div>入站流量</div><div class="stat-val" id="as-in">0 B</div><div class="stat-sub">请求体</div></div>
      <div class="stat-card"><div>播放</div><div class="stat-val" id="as-plays">0</div><div class="stat-sub">Sessions/Playing</div></div>
      <div class="stat-card"><div>PlaybackInfo</div><div class="stat-val" id="as-pb">0</div><div class="stat-sub">请求次数</div></div>
      <div class="stat-card"><div>CF 访问 / Worker</div><div class="stat-val" id="as-visits">—</div><div class="stat-sub" id="as-worker">Worker 0</div></div>
    </div>
    <div class="sec-title" style="margin-top:20px">TOP 路由 <span class="chip">ROUTES</span></div>
    <div id="adminTopRoutes"><p class="muted">暂无数据</p></div>
    <div class="sec-title" style="margin-top:20px">近 14 日 <span class="chip">TREND</span></div>
    <div id="adminDaily"></div>
    <p class="muted" style="font-size:11px;margin-top:10px" id="adminStatsMeta"></p>
  </div>

  <div class="card">
    <div class="sec-title">高级设置 <span class="chip">CONFIG</span></div>
    <div class="settings-grid">
      <div class="form-group">
        <label>手动跳转域名</label>
        <textarea id="setRedirectDomains" rows="4" placeholder="每个域名一行或用逗号分隔"></textarea>
        <p class="form-hint">命中这些域名时直接把 3xx 返回客户端，不跟随跳转</p>
      </div>
      <div class="form-group">
        <label>JP 机房域名替换规则（JSON）</label>
        <textarea id="setDomainRules" rows="4" placeholder='{"example.com":"jp.example.com"}'></textarea>
        <p class="form-hint">仅在日本机房（NRT/KIX/FUK/OKA）生效，键为原域名后缀</p>
      </div>
      <div class="form-group">
        <label>Telegram Chat ID</label>
        <input id="setTgChat" placeholder="例如：123456789 或 -1001234567890">
      </div>
      <div class="form-group">
        <label>Telegram Bot Token</label>
        <input id="setTgToken" type="password" placeholder="已配置则留空不修改">
      </div>
      <div class="form-group">
        <label>DNS 根域名</label>
        <input id="setDnsRoot" placeholder="example.com">
      </div>
      <div class="form-group">
        <label>DNS 记录条数（1-5）</label>
        <input id="setDnsCount" type="number" min="1" max="5" step="1">
        <p class="form-hint">多 IP 时保留 Top N 条 A/AAAA 记录轮询；CNAME 只能 1 条</p>
      </div>
    </div>
    <label class="checkbox-label"><input type="checkbox" id="setAutoDns"> 定时自动测速并替换 DNS（需配置 Cron）</label>
    <label class="checkbox-label" style="margin-top:10px"><input type="checkbox" id="setDailyReport"> 每天 23:00（北京时间）发送 Telegram 日报（需配置 Cron）</label>
    <div class="toolbar" style="margin-top:18px">
      <button class="btn btn-solid" onclick="saveSettings()">保存设置</button>
      <button class="btn" onclick="testTelegram()">发送 TG 测试</button>
      <button class="btn btn-danger" onclick="clearTgToken()">清除 TG Token</button>
    </div>
  </div>

  <div class="card">
    <div class="sec-title">最近操作 <span class="chip">AUDIT</span></div>
    <div id="auditLog"><p class="muted">加载中...</p></div>
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
      <label>目标地址 (target)</label>
      <input id="routeTarget" placeholder="https://emby.example.com:8096">
      <p class="form-hint">多个地址用逗号分隔（按顺序故障转移），最多 8 个</p>
    </div>
    <div class="form-group">
      <label class="checkbox-label">
        <input type="checkbox" id="routeCache" checked> 启用图片/静态资源缓存
      </label>
      <label class="checkbox-label" style="margin-top:12px">
        <input type="checkbox" id="routeCompat"> 兼容模式
      </label>
      <label class="checkbox-label" style="margin-top:12px">
        <input type="checkbox" id="routeEnabled" checked> 启用此路由
      </label>
      <p class="form-hint">兼容模式适用于部分无法正常播放的 Emby 服务器，会补充 Origin / X-Forwarded-* 头</p>
    </div>
    <div class="form-group">
      <label>客户端 IP</label>
      <select id="routeIpMode">
        <option value="forward">默认模式（透传客户端 IP）</option>
        <option value="strip">不透传 IP（不发送 X-Forwarded-For / X-Real-IP）</option>
        <option value="disable">彻底隐藏（剥离所有客户端身份头）</option>
      </select>
      <p class="form-hint">反代目标也是 Cloudflare 站点时建议选「彻底隐藏」，源站将只能看到 Worker 出口 IP</p>
    </div>
    <div class="form-group">
      <label>自定义请求头（JSON，可选）</label>
      <textarea id="routeHeaders" rows="3" placeholder='{"User-Agent":"Emby/4.8.0","Referer":"https://example.com/"}'></textarea>
      <p class="form-hint">用于固定 UA、Origin、Referer 等；Host 与逐跳头会被忽略</p>
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal('modalRoute')">取消</button>
      <button class="btn btn-solid" onclick="saveRoute()">保存</button>
    </div>
  </div>
</div>

<div id="modalDomain" class="modal">
  <div class="modal-inner">
    <div class="modal-header">
      <h2 class="modal-title" id="domainModalTitle">添加优选域名</h2>
      <p class="modal-desc">添加您自己的优选域名</p>
    </div>
    <input type="hidden" id="domainId">
    <div class="form-group">
      <label>名称</label>
      <input id="domainName" placeholder="例如：我的优选域名">
    </div>
    <div class="form-group">
      <label>域名</label>
      <input id="domainUrl" placeholder="https://example.com">
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal('modalDomain')">取消</button>
      <button class="btn btn-solid" onclick="saveDomain()">保存</button>
    </div>
  </div>
</div>

<div id="modalDNS" class="modal">
  <div class="modal-inner">
    <div class="modal-header">
      <h2 class="modal-title">一键替换 DNS</h2>
      <p class="modal-desc">优先原地 PATCH 同名记录，尽量不产生解析空窗；只处理 A / AAAA / CNAME</p>
    </div>
    <div class="form-group">
      <label>当前 DNS 记录</label>
      <div id="dnsCurrentConfig" class="dns-current-config">
        <div class="dns-record-display">
          <span id="dnsCurrentName" class="dns-record-name">加载中...</span>
          <span class="dns-record-arrow">→</span>
          <span id="dnsCurrentTarget" class="dns-record-target">加载中...</span>
        </div>
        <button class="btn btn-sm" onclick="editDNSConfig()">编辑</button>
      </div>
      <input type="hidden" id="dnsZone" value="">
    </div>
    <div class="form-group">
      <label>DNS 名称</label>
      <input id="dnsName" placeholder="留空 = 直接用 BASE_DOMAIN，或填前缀 / 完整域名">
      <p class="form-hint">将创建 <span id="dnsPreview">yourdomain.com</span>（留空即 BASE_DOMAIN 本身；填 <code>fd</code> 或 <code>fd.dirige.de5.net</code> 都可以）</p>
    </div>
    <div class="form-group">
      <label>目标（域名或 IP，可逗号分隔多个）</label>
      <input id="dnsTarget" placeholder="最优域名或 IP 地址">
    </div>
    <div class="form-group">
      <label>保留记录条数</label>
      <input id="dnsRecordCount" type="number" min="1" max="5" value="1">
      <p class="form-hint">多 IP 轮询时填写 2-5；CNAME 只能 1 条</p>
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal('modalDNS')">取消</button>
      <button class="btn btn-solid" onclick="replaceDNS(this)">替换</button>
    </div>
  </div>
</div>

<script>${THEME_LOGIC}
var allRoutes = [];
var allDomains = [];
var bestDomain = null;
var dnsConfig = null;
var currentBaseDomain = '';
var dragEl = null;

function showToast(msg) {
  var t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(function() { t.classList.remove('show'); }, 2800);
}
function closeModal(id) { document.getElementById(id).classList.remove('show'); }
function openModal(id) { document.getElementById(id).classList.add('show'); }
async function logout() {
  try { await fetch('/admin/api/logout', { method: 'POST' }); } catch (_) {}
  document.cookie = 'admin_token=;path=/;max-age=0';
  location.href = '/admin';
}

// ---------- 路由 ----------
async function loadRoutes() {
  try {
    var r = await fetch('/admin/api/routes', { cache: 'no-store' });
    if (r.status === 401) { location.href = '/admin'; return; }
    var data = await r.json();
    if (!Array.isArray(data)) { showToast(data.error || '加载失败'); return; }
    allRoutes = data;
    renderRoutes(allRoutes);
  } catch (e) {
    document.getElementById('routeList').innerHTML = '<p class="muted">加载失败: ' + escHtml(e.message) + '</p>';
  }
}

function renderRoutes(list) {
  var el = document.getElementById('routeList');
  var countChip = document.getElementById('routeCount');
  if (countChip) countChip.textContent = list.length + ' 条';
  if (!list.length) {
    el.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><span class="empty-state-icon">📦</span><p class="empty-state-text">暂无路由，点击上方按钮添加</p></div>';
    return;
  }
  el.innerHTML = list.map(function(r) {
    var targets = String(r.target || '').split(',').map(function(s){ return s.trim(); }).filter(Boolean);
    var remarkName = r.remark || '未命名';
    var enabled = !(r.enabled === 0 || r.enabled === '0');
    var cacheOn = r.cache_img !== 'off';
    var compatOn = r.compat_mode === 'on';

    var targetsHtml = '';
    targets.forEach(function(t, idx) {
      var tag = idx === 0
        ? '<span style="color:var(--ok);font-weight:700">[主]</span>'
        : '<span style="color:var(--warn);font-weight:700">[备' + idx + ']</span>';
      targetsHtml += '<div class="target-row">' + tag + ' <span class="target-url"><code>' + escHtml(t) + '</code></span></div>';
    });

    var meta = [];
    meta.push(enabled ? '<span class="meta-tag">✅ 已启用</span>' : '<span class="meta-tag tag-off">⏸ 已停用</span>');
    meta.push(cacheOn ? '<span class="meta-tag">🖼️ 缓存开启</span>' : '<span class="meta-tag">缓存关闭</span>');
    if (compatOn) meta.push('<span class="meta-tag" style="color:var(--warn);border-color:var(--warn-dim)">🔧 兼容模式</span>');
    if (r.ip_mode === 'strip') meta.push('<span class="meta-tag" style="color:var(--info);border-color:var(--info-dim)">🛡️ IP 不透传</span>');
    if (r.ip_mode === 'disable') meta.push('<span class="meta-tag" style="color:var(--ok);border-color:var(--ok-dim)">🛡️ IP 彻底隐藏</span>');
    if (r.custom_headers) meta.push('<span class="meta-tag">🧩 自定义头</span>');
    if (r.last_play) meta.push('<span class="meta-tag">📺 ' + escHtml(r.last_play) + '</span>');

    return '<div class="route-item' + (enabled ? '' : ' route-disabled') + '" draggable="true" data-prefix="' + escHtml(r.prefix) + '" data-search="' + escHtml((remarkName + ' ' + r.prefix).toLowerCase()) + '">'
      + '<div class="route-header">'
      +   '<span class="drag-handle" title="拖拽排序">⋮⋮</span>'
      +   '<div class="route-title"><h3 class="route-name">' + escHtml(remarkName) + '</h3><span class="route-path">/' + escHtml(r.prefix) + '</span></div>'
      +   '<label class="switch" title="启用/停用"><input type="checkbox" data-action="toggle" ' + (enabled ? 'checked' : '') + '><span class="slider"></span></label>'
      + '</div>'
      + '<div class="target-list">' + targetsHtml + '</div>'
      + '<div class="route-meta">' + meta.join('') + '</div>'
      + '<div class="route-actions">'
      +   '<button class="btn btn-sm" data-action="edit">编辑</button>'
      +   '<button class="btn btn-sm" data-action="test">测试</button>'
      +   '<button class="btn btn-sm btn-danger" data-action="delete">删除</button>'
      + '</div>'
      + '</div>';
  }).join('');
}

function filterRoutes() {
  var q = document.getElementById('routeSearch').value.toLowerCase();
  document.querySelectorAll('.route-item').forEach(function(c) {
    c.style.display = (!q || (c.dataset.search || '').indexOf(q) >= 0) ? 'block' : 'none';
  });
}

function openRouteModal() {
  document.getElementById('oldPrefix').value = '';
  document.getElementById('routeRemark').value = '';
  document.getElementById('routePrefix').value = '';
  document.getElementById('routeTarget').value = '';
  document.getElementById('routeCache').checked = true;
  document.getElementById('routeCompat').checked = false;
  document.getElementById('routeEnabled').checked = true;
  document.getElementById('routeIpMode').value = 'forward';
  document.getElementById('routeHeaders').value = '';
  document.getElementById('prefixPreview').textContent = 'myemby';
  document.getElementById('routeModalTitle').textContent = '添加路由';
  openModal('modalRoute');
}

function editRoute(prefix) {
  var r = allRoutes.find(function(x){ return x.prefix === prefix; });
  if (!r) return;
  document.getElementById('oldPrefix').value = r.prefix;
  document.getElementById('routeRemark').value = r.remark || '';
  document.getElementById('routePrefix').value = r.prefix;
  document.getElementById('routeTarget').value = r.target;
  document.getElementById('routeCache').checked = r.cache_img !== 'off';
  document.getElementById('routeCompat').checked = r.compat_mode === 'on';
  document.getElementById('routeEnabled').checked = !(r.enabled === 0 || r.enabled === '0');
  document.getElementById('routeIpMode').value = (r.ip_mode === 'strip' || r.ip_mode === 'disable') ? r.ip_mode : 'forward';
  var headers = '';
  if (r.custom_headers) {
    try { headers = JSON.stringify(JSON.parse(r.custom_headers), null, 2); } catch (_) { headers = r.custom_headers; }
  }
  document.getElementById('routeHeaders').value = headers;
  document.getElementById('prefixPreview').textContent = r.prefix;
  document.getElementById('routeModalTitle').textContent = '编辑路由';
  openModal('modalRoute');
}

async function saveRoute() {
  var oldPrefix = document.getElementById('oldPrefix').value;
  var remark = document.getElementById('routeRemark').value.trim();
  var prefix = document.getElementById('routePrefix').value.trim();
  while (prefix.charAt(0) === '/') prefix = prefix.slice(1);
  while (prefix.slice(-1) === '/') prefix = prefix.slice(0, -1);
  var cacheImg = document.getElementById('routeCache').checked ? 'on' : 'off';
  var compat = document.getElementById('routeCompat').checked ? 'on' : 'off';
  var enabled = document.getElementById('routeEnabled').checked;
  var ipMode = document.getElementById('routeIpMode').value || 'forward';
  var target = document.getElementById('routeTarget').value.trim();
  var customHeaders = document.getElementById('routeHeaders').value.trim() || '{}';

  if (!prefix) { showToast('请输入路径'); return; }
  if (!target) { showToast('请至少填写一个目标地址'); return; }
  if (customHeaders) {
    try {
      var obj = JSON.parse(customHeaders);
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('必须是 JSON 对象');
    } catch (e) { showToast('自定义请求头格式错误: ' + e.message); return; }
  }

  var r = await fetch('/admin/api/routes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      oldPrefix: oldPrefix, prefix: prefix, target: target, remark: remark,
      cache_img: cacheImg, compat_mode: compat, enabled: enabled,
      ip_mode: ipMode, custom_headers: customHeaders
    })
  });
  var d = await r.json();
  if (!r.ok) { showToast(d.error || '保存失败'); return; }
  closeModal('modalRoute');
  showToast('保存成功');
  loadRoutes();
}

async function delRoute(prefix) {
  if (!confirm('确定删除路由 /' + prefix + ' ？')) return;
  var r = await fetch('/admin/api/routes?prefix=' + encodeURIComponent(prefix), { method: 'DELETE' });
  var d = await r.json();
  if (d.error) { showToast(d.error); return; }
  showToast('已删除');
  loadRoutes();
}

async function toggleRoute(prefix, enabled) {
  var r = await fetch('/admin/api/routes/toggle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix: prefix, enabled: enabled })
  });
  var d = await r.json();
  if (d.error) { showToast(d.error); return; }
  showToast(enabled ? '已启用' : '已停用');
  loadRoutes();
}

async function testRoute(prefix) {
  showToast('正在测试 /' + prefix + ' ...');
  var r = await fetch('/admin/api/routes/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix: prefix })
  });
  var d = await r.json();
  if (!d.success || !d.results || !d.results.length) { showToast(d.error || '测试失败'); return; }
  var row = d.results[0];
  var parts = row.targets.map(function(t, i) {
    return (i === 0 ? '主' : '备' + i) + ': ' + (t.ok ? (t.status || 'OK') + ' / ' + t.ms + 'ms' : '失败');
  });
  showToast('/' + prefix + ' ' + parts.join(' · '));
}

async function testAllRoutes() {
  showToast('正在测试所有路由...');
  var r = await fetch('/admin/api/routes/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  var d = await r.json();
  if (!d.success) { showToast(d.error || '测试失败'); return; }
  var ok = 0, total = 0;
  (d.results || []).forEach(function(row) {
    row.targets.forEach(function(t) { total++; if (t.ok) ok++; });
  });
  showToast('测试完成：' + ok + ' / ' + total + ' 个上游可用');
}

function persistRouteOrder() {
  var prefixes = [];
  document.querySelectorAll('#routeList .route-item').forEach(function(el) {
    prefixes.push(el.getAttribute('data-prefix'));
  });
  if (!prefixes.length) return;
  fetch('/admin/api/routes/reorder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefixes: prefixes })
  }).then(function(r) {
    if (!r.ok) showToast('排序保存失败');
  }).catch(function() { showToast('排序保存失败'); });
}

// ---------- 域名 ----------
async function loadDomains() {
  try {
    var r = await fetch('/admin/api/optimized-domains', { cache: 'no-store' });
    if (r.status === 401) { location.href = '/admin'; return; }
    var d = await r.json();
    if (d.success) {
      allDomains = d.domains || [];
      renderDomains(allDomains);
    } else {
      document.getElementById('domainList').innerHTML = '<p class="muted">加载失败</p>';
    }
  } catch (e) {
    document.getElementById('domainList').innerHTML = '<p class="muted">加载失败: ' + escHtml(e.message) + '</p>';
  }
}

function renderDomains(list, speedResults, best) {
  var el = document.getElementById('domainList');
  if (!list.length) {
    el.innerHTML = '<div class="empty-state"><span class="empty-state-icon">🌐</span><p class="empty-state-text">暂无优选域名</p></div>';
    return;
  }
  var speedMap = {};
  if (speedResults) speedResults.forEach(function(r) { speedMap[r.domain] = r; });
  var sorted = list.slice().sort(function(a, b) {
    var sa = speedMap[a.domain], sb = speedMap[b.domain];
    var la = sa && sa.latency >= 0 ? sa.latency : Infinity;
    var lb = sb && sb.latency >= 0 ? sb.latency : Infinity;
    return la - lb;
  });
  var html = '<table><thead><tr><th>名称</th><th>域名</th><th>延迟</th><th>状态</th><th>操作</th></tr></thead><tbody>';
  sorted.forEach(function(d) {
    var sr = speedMap[d.domain];
    var latency = sr && sr.latency >= 0 ? sr.latency + 'ms' : (sr ? '超时' : '—');
    var pct = sr && sr.latency >= 0 ? Math.max(5, Math.min(100, Math.round(sr.latency / 3))) : 0;
    var statusClass = sr ? (sr.latency >= 0 ? (sr.latency < 100 ? 'tag-fast' : sr.latency < 300 ? 'tag-good' : 'tag-slow') : 'tag-timeout') : '';
    var statusText = sr ? (sr.latency >= 0 ? (sr.latency < 100 ? '极快' : sr.latency < 300 ? '良好' : '较慢') : '超时') : '';
    var isBest = best && best.domain === d.domain;
    html += '<tr' + (isBest ? ' class="best"' : '') + '>'
      + '<td>' + escHtml(d.name) + (d.isBuiltin ? ' <span class="tag tag-builtin">内置</span>' : '') + (isBest ? ' <span class="tag tag-best">BEST</span>' : '') + '</td>'
      + '<td><code>' + escHtml(d.domain) + '</code></td>'
      + '<td><div class="lat"><div class="lat-bar"><i style="width:' + pct + '%"></i></div><span>' + latency + '</span></div></td>'
      + '<td>' + (statusText ? '<span class="tag ' + statusClass + '">' + statusText + '</span>' : '—') + '</td>'
      + '<td>' + (!d.isBuiltin
        ? '<button class="btn btn-sm" onclick="editDomain(' + d.id + ')">编辑</button> <button class="btn btn-sm btn-danger" onclick="delDomain(' + d.id + ')">删除</button>'
        : '<span class="muted" style="font-size:11px">内置不可改</span>') + '</td>'
      + '</tr>';
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
  var d = allDomains.find(function(x) { return Number(x.id) === Number(id); });
  if (!d) return;
  document.getElementById('domainId').value = d.id;
  document.getElementById('domainName').value = d.name;
  document.getElementById('domainUrl').value = d.domain;
  document.getElementById('domainModalTitle').textContent = '编辑优选域名';
  openModal('modalDomain');
}

async function saveDomain() {
  var id = document.getElementById('domainId').value;
  var name = document.getElementById('domainName').value.trim();
  var url = document.getElementById('domainUrl').value.trim();
  if (!name) { showToast('请输入名称'); return; }
  if (!url) { showToast('请输入域名'); return; }
  var domain = url.replace(/^https?:\\/\\//i, '').split('/')[0].split('?')[0];

  var method = id ? 'PUT' : 'POST';
  var endpoint = id ? '/admin/api/optimized-domains/' + id : '/admin/api/optimized-domains';
  var r = await fetch(endpoint, {
    method: method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domain: domain, name: name })
  });
  var d = await r.json();
  if (!d.success) { showToast(d.error || '保存失败'); return; }
  closeModal('modalDomain');
  showToast('保存成功');
  loadDomains();
}

async function delDomain(id) {
  if (!confirm('确定删除此优选域名？')) return;
  var r = await fetch('/admin/api/optimized-domains/' + id, { method: 'DELETE' });
  var d = await r.json();
  if (d.success) { showToast('已删除'); loadDomains(); }
  else showToast(d.error || '删除失败');
}

async function testDomains() {
  var st = document.getElementById('domain-status');
  if (st) st.textContent = '测速中...';
  try {
    var r = await fetch('/admin/api/speedtest/domains', { method: 'POST' });
    var d = await r.json();
    if (d.best) bestDomain = d.best;
    if (st) st.textContent = d.best ? '最优: ' + d.best.domain : '无可用域名';
    renderDomains(allDomains, d.results || [], d.best);
  } catch (e) {
    if (st) st.textContent = '测速失败';
  }
}

// ---------- DNS ----------
async function loadDNSConfig() {
  try {
    var r = await fetch('/admin/api/dns-config', { cache: 'no-store' });
    if (r.status === 401) { location.href = '/admin'; return; }
    var d = await r.json();
    if (d.success) {
      dnsConfig = d.config;
      currentBaseDomain = d.rootDomain || '';
      renderDNSConfig(d.config, d.zones, d.zonesError, currentBaseDomain, d.liveRecord);
    } else {
      document.getElementById('dnsConfig').innerHTML = '<p class="muted">加载失败</p>';
    }
  } catch (e) {
    document.getElementById('dnsConfig').innerHTML = '<p class="muted">加载失败: ' + escHtml(e.message) + '</p>';
  }
}

function renderDNSConfig(config, zones, zonesError, baseDomain, liveRecord) {
  var el = document.getElementById('dnsConfig');
  var html = '';
  if (zonesError) html += '<div class="warn" style="margin-bottom:14px">获取区域列表失败: ' + escHtml(zonesError) + '</div>';

  var fullRecordName = liveRecord && liveRecord.name
    ? liveRecord.name
    : fqdn(config && config.dnsName, baseDomain);

  if (fullRecordName) {
    html += '<div class="form-group"><label>当前配置 DNS 记录</label><div class="dns-live-box"><div class="rec">📌 ' + escHtml(fullRecordName) + '</div></div></div>';
  }

  if (zones && zones.length) {
    html += '<div class="form-group"><label>可用区域</label><div style="display:flex;gap:8px;flex-wrap:wrap">';
    zones.forEach(function(z) { html += '<span class="zone-chip">' + escHtml(z.name) + '</span>'; });
    html += '</div></div>';
  } else if (!zonesError) {
    html += '<p class="muted">未找到可用区域，请确认 CF_API_TOKEN 有 Zone:Read 权限</p>';
  }

  if (liveRecord) {
    html += '<div class="form-group"><label>Cloudflare 实时记录</label><div class="dns-live-box">';
    html += '<div class="rec">[' + escHtml(liveRecord.type) + '] ' + escHtml(liveRecord.name) + '</div>';
    html += '<div class="to">指向 → ' + escHtml(liveRecord.content) + '</div>';
    if (liveRecord.modifiedOn) html += '<div class="ts">更新时间: ' + escHtml(liveRecord.modifiedOn) + '</div>';
    html += '</div></div>';
  } else if (config && config.dnsName) {
    html += '<div class="form-group"><label>本地缓存记录（未在 Cloudflare 找到该记录）</label><div class="dns-live-box">';
    html += '<div class="rec">[CNAME] ' + escHtml(fullRecordName) + '</div>';
    html += '<div class="to">指向 → ' + escHtml(config.currentDomain || '未设置') + '</div>';
    if (config.updatedAt) html += '<div class="ts">更新时间: ' + escHtml(config.updatedAt) + '</div>';
    html += '</div></div>';
  } else {
    html += '<p class="muted">尚未配置 DNS 记录，请测速后点击一键替换 DNS</p>';
  }
  el.innerHTML = html;
}

async function openDNSModal() {
  if (!bestDomain) { showToast('请先测速找到最优域名'); return; }
  var r = await fetch('/admin/api/dns-config', { cache: 'no-store' });
  var d = await r.json();
  var baseDomain = d.rootDomain || 'yourdomain.com';
  currentBaseDomain = baseDomain;
  var dnsZone = document.getElementById('dnsZone');

  if (d.liveRecord) {
    document.getElementById('dnsCurrentName').textContent = d.liveRecord.name;
    document.getElementById('dnsCurrentTarget').textContent = d.liveRecord.content;
    dnsZone.value = d.liveRecord.zoneId || d.config?.zoneId || '';
  } else if (d.success && d.config && d.config.dnsName) {
    document.getElementById('dnsCurrentName').textContent = fqdn(d.config.dnsName, baseDomain);
    document.getElementById('dnsCurrentTarget').textContent = d.config.currentDomain || '未设置';
    dnsZone.value = d.config.zoneId || '';
  } else {
    document.getElementById('dnsCurrentName').textContent = '未配置';
    document.getElementById('dnsCurrentTarget').textContent = '未设置';
  }

  // 优先用服务端返回的记录名（支持完整域名 BASE_DOMAIN）
  var existingName = (d.config && d.config.dnsName) || d.dnsRecordName || '';
  document.getElementById('dnsName').value = existingName;
  document.getElementById('dnsTarget').value = bestDomain.domain;
  document.getElementById('dnsPreview').textContent = fqdn(existingName, baseDomain);

  try {
    var sr = await fetch('/admin/api/settings');
    var sd = await sr.json();
    document.getElementById('dnsRecordCount').value = (sd.settings && sd.settings.dnsRecordCount) || 1;
  } catch (_) {
    document.getElementById('dnsRecordCount').value = 1;
  }
  openModal('modalDNS');
}

function editDNSConfig() {
  var currentName = document.getElementById('dnsCurrentName').textContent;
  var currentTarget = document.getElementById('dnsCurrentTarget').textContent;
  if (currentName === '未配置') { showToast('当前没有配置 DNS 记录'); return; }

  // 直接回填完整记录名，由服务端 toFqdn 处理前缀/完整域名两种情况
  var name = currentName;
  document.getElementById('dnsName').value = name;
  document.getElementById('dnsPreview').textContent = fqdn(name, currentBaseDomain);
  if (currentTarget !== '未设置') document.getElementById('dnsTarget').value = currentTarget;
  showToast('已加载当前配置，可以修改后替换');
}

async function replaceDNS(btn) {
  var zoneId = document.getElementById('dnsZone').value;
  var dnsName = document.getElementById('dnsName').value.trim();
  var targetDomain = document.getElementById('dnsTarget').value.trim();
  var recordCount = document.getElementById('dnsRecordCount').value;
  if (!targetDomain) { showToast('请输入目标域名或 IP'); return; }

  if (btn) { btn.disabled = true; btn.textContent = '替换中...'; }
  try {
    var r = await fetch('/admin/api/dns/replace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zoneId: zoneId, dnsName: dnsName, targetDomain: targetDomain, recordCount: recordCount })
    });
    var d = await r.json();
    if (d.success) {
      var info = d.result || {};
      showToast('✅ [' + (info.type || 'DNS') + '] ' + (info.name || dnsName) + ' → ' + (info.content || targetDomain));
      closeModal('modalDNS');
      loadDNSConfig();
    } else {
      showToast('❌ ' + (d.error || 'DNS 替换失败'));
    }
  } catch (e) {
    showToast('❌ 请求失败: ' + e.message);
  }
  if (btn) { btn.disabled = false; btn.textContent = '替换'; }
}

// ---------- 统计 / 设置 / 日志 ----------
function renderAdminChart(el, series) {
  if (!el || !series || !series.length) return;
  var max = Math.max(1, Math.max.apply(null, series.map(function(x){ return x.total; })));
  var html = '<div class="chart">';
  series.forEach(function(x) {
    var ht = Math.max(2, Math.round((x.total / max) * 68));
    html += '<div class="chart-col" title="' + escHtml(x.label + ' · ' + fmtNum(x.total)) + '"><i style="height:' + ht + 'px"></i><b>' + escHtml(String(x.label).slice(0, 2)) + '</b></div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

async function loadAdminStats() {
  try {
    var r = await fetch('/admin/api/stats', { cache: 'no-store' });
    var d = await r.json();
    if (!d.success) { document.getElementById('adminStatsMeta').textContent = d.error || '统计加载失败'; return; }
    var s = d.stats, f = d.formatted;
    document.getElementById('adminStatsDate').textContent = d.date;
    document.getElementById('as-req').textContent = f.requests;
    document.getElementById('as-out').textContent = f.traffic;
    document.getElementById('as-in').textContent = f.requestTraffic;
    document.getElementById('as-plays').textContent = f.plays;
    document.getElementById('as-pb').textContent = f.playbackInfo;
    document.getElementById('as-visits').textContent = f.visits;
    document.getElementById('as-worker').textContent = 'Worker ' + f.workerRequests;

    var top = document.getElementById('adminTopRoutes');
    if (s.topRoutes && s.topRoutes.length) {
      var t = '<div style="overflow-x:auto"><table style="min-width:460px"><thead><tr><th>路由</th><th>请求</th><th>播放</th><th>流量</th></tr></thead><tbody>';
      s.topRoutes.forEach(function(x) {
        t += '<tr><td><code>' + escHtml(x.prefix ? '/' + x.prefix : '直连') + '</code></td><td>' + fmtNum(x.requests) + '</td><td>' + fmtNum(x.plays) + '</td><td>' + fmtBytes(x.traffic) + '</td></tr>';
      });
      top.innerHTML = t + '</tbody></table></div>';
    } else {
      top.innerHTML = '<p class="muted">暂无数据</p>';
    }

    renderAdminChart(document.getElementById('adminDaily'), (d.daily || []).map(function(x) {
      return { label: x.date.slice(5), total: x.requests };
    }));

    var cfText = d.cf && !d.cf.error ? ('CF 访问 ' + fmtNum(d.cf.visits) + ' / 边缘流量 ' + fmtBytes(d.cf.bytes)) : (d.cf && d.cf.error ? 'CF: ' + d.cf.error : 'CF 未配置');
    document.getElementById('adminStatsMeta').textContent = '日期 ' + d.date + ' · ' + cfText + ' · 数据来源 D1 小时聚合';
  } catch (e) {
    document.getElementById('adminStatsMeta').textContent = '统计加载失败: ' + e.message;
  }
}

async function loadSettings() {
  try {
    var r = await fetch('/admin/api/settings', { cache: 'no-store' });
    var d = await r.json();
    if (!d.success) return;
    var s = d.settings;
    document.getElementById('setRedirectDomains').value = s.manualRedirectDomains || '';
    document.getElementById('setDomainRules').value = s.domainProxyRules || '{}';
    document.getElementById('setTgChat').value = s.tgChatId || '';
    document.getElementById('setTgToken').value = '';
    document.getElementById('setTgToken').placeholder = s.tgBotTokenSet ? '已配置，留空不修改' : '未配置';
    document.getElementById('setDnsRoot').value = s.dnsRootDomain || '';
    document.getElementById('setDnsCount').value = s.dnsRecordCount || 1;
    document.getElementById('setAutoDns').checked = Boolean(s.autoDns);
    document.getElementById('setDailyReport').checked = Boolean(s.tgDailyReport);
  } catch (_) {}
}

async function saveSettings() {
  var body = {
    manualRedirectDomains: document.getElementById('setRedirectDomains').value,
    domainProxyRules: document.getElementById('setDomainRules').value,
    tgChatId: document.getElementById('setTgChat').value.trim(),
    tgBotToken: document.getElementById('setTgToken').value.trim(),
    dnsRootDomain: document.getElementById('setDnsRoot').value.trim(),
    dnsRecordCount: parseInt(document.getElementById('setDnsCount').value, 10) || 1,
    autoDns: document.getElementById('setAutoDns').checked,
    tgDailyReport: document.getElementById('setDailyReport').checked
  };
  try {
    var rules = JSON.parse(body.domainProxyRules || '{}');
    if (!rules || typeof rules !== 'object' || Array.isArray(rules)) throw new Error('必须是 JSON 对象');
  } catch (e) { showToast('域名替换规则错误: ' + e.message); return; }

  var r = await fetch('/admin/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  var d = await r.json();
  if (!d.success) { showToast(d.error || '保存失败'); return; }
  document.getElementById('setTgToken').value = '';
  showToast('设置已保存');
  loadSettings();
}

async function testTelegram() {
  showToast('正在发送测试消息...');
  var r = await fetch('/admin/api/telegram/test', { method: 'POST' });
  var d = await r.json();
  showToast(d.ok ? 'TG 测试消息已发送' : ('发送失败: ' + (d.error || '未知错误')));
}

async function clearTgToken() {
  if (!confirm('确定清除后台保存的 Telegram Token？环境变量中的 Token 不受影响。')) return;
  var r = await fetch('/admin/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clearTgToken: true })
  });
  var d = await r.json();
  showToast(d.success ? '已清除' : '清除失败');
  loadSettings();
}

async function loadLogs() {
  try {
    var r = await fetch('/admin/api/logs', { cache: 'no-store' });
    var d = await r.json();
    var el = document.getElementById('auditLog');
    if (!d.success || !d.logs || !d.logs.length) { el.innerHTML = '<p class="muted">暂无记录</p>'; return; }
    var html = '<div style="overflow-x:auto"><table style="min-width:560px"><thead><tr><th>时间</th><th>操作</th><th>IP</th><th>详情</th></tr></thead><tbody>';
    d.logs.forEach(function(x) {
      html += '<tr><td class="mono" style="font-size:11px;white-space:nowrap">' + escHtml(x.ts) + '</td><td>' + escHtml(x.action) + '</td><td class="mono" style="font-size:11px">' + escHtml(x.ip) + '</td><td style="font-size:12px;color:var(--text-dim);word-break:break-all">' + escHtml(x.detail) + '</td></tr>';
    });
    el.innerHTML = html + '</tbody></table></div>';
  } catch (_) {
    document.getElementById('auditLog').innerHTML = '<p class="muted">加载失败</p>';
  }
}

async function exportConfig() {
  var r = await fetch('/admin/api/config/export', { cache: 'no-store' });
  var d = await r.json();
  if (!d.success) { showToast(d.error || '导出失败'); return; }
  var blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'emby-proxy-config-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a);
  a.click();
  setTimeout(function() { URL.revokeObjectURL(a.href); a.remove(); }, 3000);
  showToast('配置已导出（不含 TG Token）');
}

async function importConfig(input) {
  var file = input.files && input.files[0];
  if (!file) return;
  input.value = '';
  if (!confirm('导入会合并到现有配置（同路径路由会被覆盖），继续？')) return;
  var text = await file.text();
  var data;
  try { data = JSON.parse(text); } catch (e) { showToast('JSON 解析失败: ' + e.message); return; }
  data.mode = 'merge';
  var r = await fetch('/admin/api/config/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  var d = await r.json();
  if (!d.success) { showToast(d.error || '导入失败'); return; }
  showToast('导入完成：' + d.importedRoutes + ' 条路由 / ' + d.importedDomains + ' 个域名');
  clearRouteCacheClient();
  loadRoutes(); loadDomains(); loadDNSConfig(); loadSettings(); loadAdminStats(); loadLogs();
}

function clearRouteCacheClient() { /* 服务端已在导入时清理，这里保留占位 */ }

// ---------- 事件绑定 ----------
document.getElementById('routeList').addEventListener('click', function(e) {
  var btn = e.target.closest('[data-action]');
  if (!btn) return;
  var item = btn.closest('.route-item');
  if (!item) return;
  var prefix = item.getAttribute('data-prefix');
  var action = btn.getAttribute('data-action');
  if (action === 'edit') editRoute(prefix);
  else if (action === 'delete') delRoute(prefix);
  else if (action === 'test') testRoute(prefix);
});

document.getElementById('routeList').addEventListener('change', function(e) {
  if (e.target && e.target.getAttribute('data-action') === 'toggle') {
    var item = e.target.closest('.route-item');
    if (item) toggleRoute(item.getAttribute('data-prefix'), e.target.checked);
  }
});

document.getElementById('routeList').addEventListener('dragstart', function(e) {
  var it = e.target.closest('.route-item');
  if (!it) return;
  dragEl = it;
  it.classList.add('dragging');
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', it.getAttribute('data-prefix')); } catch (_) {}
  }
});
document.getElementById('routeList').addEventListener('dragover', function(e) {
  if (!dragEl) return;
  e.preventDefault();
  var it = e.target.closest('.route-item');
  if (!it || it === dragEl) return;
  var rect = it.getBoundingClientRect();
  var after = (e.clientY - rect.top) > rect.height / 2;
  document.getElementById('routeList').insertBefore(dragEl, after ? it.nextSibling : it);
});
document.getElementById('routeList').addEventListener('drop', function(e) { e.preventDefault(); });
document.getElementById('routeList').addEventListener('dragend', function() {
  if (dragEl) {
    dragEl.classList.remove('dragging');
    dragEl = null;
    persistRouteOrder();
  }
});

document.getElementById('routePrefix').addEventListener('input', function() {
  document.getElementById('prefixPreview').textContent = this.value.trim() || 'myemby';
});
document.getElementById('dnsName').addEventListener('input', function() {
  document.getElementById('dnsPreview').textContent = fqdn(this.value.trim(), currentBaseDomain);
});

loadRoutes();
loadDNSConfig();
loadSettings();
loadAdminStats();
loadLogs();
loadDomains().then(function() { testDomains(); });
</script></body></html>`;
}

// ==================== 请求路由 ====================

async function handleRequest(request, env, ctx) {
  const url = new URL(request.url);

  if (request.method === 'OPTIONS') {
    const isAdminPath = url.pathname.startsWith('/admin');
    if (isAdminPath) {
      return new Response(null, {
        status: 204,
        headers: { 'Allow': 'GET, POST, PUT, DELETE, OPTIONS', 'X-Robots-Tag': 'noindex, nofollow' },
      });
    }
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  if (env.DB) await initDatabase(env);

  if (url.pathname === '/') return html(buildFrontendHtml(env));
  if (url.pathname === '/robots.txt') {
    return textResponse('User-agent: *\nDisallow: /admin\nDisallow: /api/\n', 200, { 'Cache-Control': 'public, max-age=3600' });
  }
  if (url.pathname === '/favicon.ico') {
    return new Response('', { headers: { 'Content-Type': 'image/x-icon', 'Cache-Control': 'public, max-age=86400' } });
  }
  if (url.pathname.startsWith('/cdn-cgi/') || url.pathname.startsWith('/.well-known/')) {
    return textResponse('Not Found', 404);
  }
  if (url.pathname === '/health') {
    return json({
      status: 'ok',
      version: CURRENT_VERSION,
      colo: request.cf?.colo,
      timestamp: new Date().toISOString(),
    });
  }

  if (url.pathname === '/stats') {
    return handleStatsRequest(request, env, url, ctx);
  }

  if (url.pathname === '/api/edge-info') {
    const ipFp = (await sha256Hex(getClientIp(request))).slice(0, 16);
    return withEdgeCache(ctx, CACHE_URLS.edge(url.origin, ipFp), 60, async () => json(await getEdgeInfo(request)));
  }

  if (url.pathname === '/api/ping-host') {
    const host = normalizeDomain(url.searchParams.get('host'));
    if (!host) return json({ ms: -1, error: 'missing host' }, 400);
    let allowed = false;
    if (env.DB) {
      const row = await env.DB.prepare('SELECT 1 AS ok FROM optimized_domains WHERE domain = ?').bind(host).first();
      allowed = Boolean(row);
    } else {
      allowed = DEFAULT_OPTIMIZED_DOMAINS.some(d => d.domain === host);
    }
    if (!allowed) return json({ ms: -1, error: 'host not allowed' }, 403);
    return withEdgeCache(ctx, CACHE_URLS.pingHost(url.origin, host), 60, async () => {
      const ms = await speedtestUrl('https://' + host + '/cdn-cgi/trace', 5000);
      return json({ ms, host });
    });
  }

  if (url.pathname === '/api/domains/list') {
    return withEdgeCache(ctx, CACHE_URLS.domainsList(url.origin), 60, async () => {
      const domains = await listOptimizedDomains(env);
      return json({ success: true, domains });
    });
  }

  if (url.pathname === '/api/domains/speed') {
    if (url.searchParams.get('edge') === '1') {
      return withEdgeCache(ctx, CACHE_URLS.domainsSpeed(url.origin), 180, async () => {
        const data = await speedtestDeduped(env);
        return json({ cached: false, edge: true, best: data.best, results: data.results });
      });
    }
    return json({ cached: false, results: [] });
  }

  if (url.pathname === '/api/config/base-domain') {
    return withEdgeCache(ctx, CACHE_URLS.baseDomain(url.origin), 300, async () => json({ baseDomain: getBaseDomain(env) || 'yourdomain.com' }));
  }

  if (url.pathname === '/api/config/dns-record-name') {
    return withEdgeCache(ctx, CACHE_URLS.dnsName(url.origin), 300, async () => json({
      dnsRecordName: getDnsRecordName(env),
    }));
  }

  if (url.pathname === '/admin/api/login' && request.method === 'POST') {
    try {
      const body = await request.json();
      return await adminLoginResponse(request, env, String(body.token || '').trim());
    } catch (e) {
      return adminJson({ ok: false, error: '请求格式错误' }, 400);
    }
  }

  if (url.pathname === '/admin/api/logout') {
    return clearAdminCookies();
  }

  if (url.pathname === '/admin' || url.pathname === '/admin/') {
    const ok = await isAdmin(request, env);
    if (!ok) return html(buildLoginHtml());
    return html(buildAdminHtml(env), 200, { admin: true });
  }

  if (url.pathname.startsWith('/admin/api/')) {
    const ok = await isAdmin(request, env);
    if (!ok) return adminJson({ error: 'Unauthorized' }, 401);
    if (!env.DB) return adminJson({ error: 'D1 数据库未绑定（变量名必须是 DB）' }, 500);
    return handleAdminApi(request, env, url, ctx);
  }

  // 直连代理（开放代理是刻意保留的功能）
  if (looksLikeDirectProxy(url.pathname)) {
    let raw = url.pathname.slice(1);
    if (raw.startsWith('/')) return textResponse('Invalid proxy format', 400);
    raw = raw.replace(/^(https?):?\/(?!\/)/, '$1://');
    if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw;
    try {
      const upstreamUrl = new URL(raw);
      if (!/^https?:$/.test(upstreamUrl.protocol)) return textResponse('仅支持 http/https', 400);
      upstreamUrl.search = url.search;
      return proxyDirectUrl(request, env, ctx, [upstreamUrl.toString()], { enableCache: true });
    } catch (_) {
      return textResponse('Invalid URL format', 400);
    }
  }

  if (!env.DB) {
    return textResponse('D1 数据库未绑定，路由反代不可用。仍可使用 /https://... 格式。', 500);
  }

  const resolved = await resolveProxyTarget(request, env, url);
  if (resolved.error) return resolved.error;

  return proxyDirectUrl(request, env, ctx, resolved.upstreamUrls, {
    enableCache: resolved.enableCache,
    compatMode: resolved.compatMode,
    clientIpMode: resolved.clientIpMode,
    matchedPrefix: resolved.matchedPrefix,
    customHeaders: resolved.customHeaders,
  });
}

export default {
  async fetch(request, env, ctx) {
    try {
      return await handleRequest(request, env, ctx);
    } catch (e) {
      console.error('worker error:', e && e.stack || e);
      return textResponse('Internal Error: ' + String(e?.message || e), 500);
    }
  },

  async scheduled(event, env, ctx) {
    try {
      await scheduledTask(event, env, ctx);
    } catch (e) {
      console.error('scheduled error:', e && e.stack || e);
    }
  },
};



