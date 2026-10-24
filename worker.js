const CURRENT_VERSION = 'v6.7.5-multi';

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
]);

// 多人版常量
const DEFAULT_USER_ROUTE_LIMIT = 20;
// 用户 DNS 记录的默认 CNAME 目标（注册时自动创建，用户可在用户中心改值）
const DEFAULT_USER_DNS_TARGET = 'youxuan.cf.090227.xyz';
// 用户名同时作为 DNS 记录名，必须是合法主机名前缀：3-32 位，字母数字或短横线，首尾不能是短横线
const USERNAME_RE = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/;
const RESERVED_PREFIXES = new Set([
  'admin', 'api', 'stats', 'health', 'register', 'login', 'logout',
  'favicon.ico', 'robots.txt', 'cdn-cgi', '.well-known', 'assets', 'static',
]);
const RESERVED_SUBDOMAINS = new Set([
  'admin', 'api', 'www', 'mail', 'smtp', 'ftp', 'ns', 'ns1', 'ns2', 'dns',
  'proxy', 'stats', 'health', 'register', 'login', 'logout', 'cdn', 'static',
  'test', 'dev', 'staging', 'root', 'support', 'help', 'status',
]);

const MANUAL_REDIRECT_DOMAINS = [
  'emby.bangumi.ca', 'aliyundrive.com', 'aliyundrive.net', 'aliyuncs.com', 'alicdn.com', 'aliyun.com',
  'cdn.aliyundrive.com', 'xunlei.com', 'xlusercdn.com', 'xycdn.com', 'sandai.net', 'thundercdn.com',
  '115.com', '115cdn.com', '115cdn.net', 'anxia.com', '189.cn', 'mini189.cn', 'ctyunxs.cn',
  'cloud.189.cn', 'tianyiyun.com', 'telecomjs.com', 'quark.cn', 'quarkdrive.cn', 'uc.cn', 'ucdrive.cn',
  'xiaoya.pro', 'myqcloud.com', 'cloudfront.net', 'akamaized.net', 'fastly.net', 'hwcdn.net', 'bytecdn.cn', 'bdcdn.net',
];

const DOMAIN_PROXY_RULES = {};
const JP_COLOS = ['NRT', 'KIX', 'FUK', 'OKA'];

const CONFIG = {
  enableStats: true,
};

// ==================== 安全 Headers ====================
const SECURITY_HEADERS = Object.freeze({
  'Referrer-Policy': 'origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=15552000; preload',
  'X-Frame-Options': 'SAMEORIGIN',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
});

const DROP_REQUEST_HEADERS = Object.freeze(new Set([
  'host', 'x-real-ip', 'x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto', 'forwarded',
  'connection', 'upgrade', 'transfer-encoding', 'te', 'keep-alive',
  'proxy-authorization', 'proxy-authenticate', 'trailer', 'expect',
]));

// ==================== 客户端 IP 隐藏模式 ====================
const CLIENT_IDENTITY_HEADERS = Object.freeze(new Set([
  'cf-connecting-ip', 'cf-ipcountry', 'cf-worker', 'true-client-ip',
  'x-real-ip', 'x-forwarded-for', 'forwarded', 'x-cluster-client-ip', 'client-ip',
]));

const IP_MODES = Object.freeze(['forward', 'strip', 'disable']);

function normalizeIpMode(v) {
  const m = String(v || '').trim().toLowerCase();
  return IP_MODES.includes(m) ? m : 'forward';
}

function stripClientIdentityHeaders(headers) {
  for (const h of CLIENT_IDENTITY_HEADERS) headers.delete(h);
}

const DROP_RESPONSE_HEADERS = Object.freeze(new Set([
  'access-control-allow-origin', 'access-control-allow-methods',
  'access-control-allow-headers', 'access-control-allow-credentials',
  'x-frame-options', 'strict-transport-security', 'x-content-type-options',
  'x-xss-protection', 'referrer-policy', 'x-powered-by', 'server',
]));

const REQUEST_PATTERNS = Object.freeze({
  imageExt: /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
  staticExt: /\.(?:js|css|woff2?|ttf|otf|map|webmanifest)$/i,
  subtitleExt: /\.(?:srt|ass|vtt|sub)$/i,
  embyImages: /(?:\/Images\/|\/Icons\/|\/Branding\/|\/emby\/covers\/)/i,
  manifestExt: /\.(?:m3u8|mpd)$/i,
  segmentExt: /\.(?:ts|m4s)$/i,
  streaming: /\.(?:mp4|m4v|m4a|ogv|webm|mkv|mov|avi|wmv|flv)$/i,
});

const progressMap = new Map();
const PROGRESS_THROTTLE_MS = 30000;
const PROGRESS_MAP_MAX = 10000;

const CORS_JSON = { 'Content-Type': 'application/json; charset=utf-8' };

let dbReady = false;

function classifyRequest(pathname, method) {
  if (REQUEST_PATTERNS.embyImages.test(pathname)) return 'image';
  if (REQUEST_PATTERNS.manifestExt.test(pathname)) return 'manifest';
  if (REQUEST_PATTERNS.segmentExt.test(pathname)) return 'segment';
  if (REQUEST_PATTERNS.streaming.test(pathname)) return 'streaming';
  if (REQUEST_PATTERNS.subtitleExt.test(pathname)) return 'subtitle';
  if (REQUEST_PATTERNS.imageExt.test(pathname)) return 'image';
  if (REQUEST_PATTERNS.staticExt.test(pathname)) return 'static';
  if (/\/PlaybackInfo/i.test(pathname)) return 'playback_info';
  if (/\/Sessions\/Playing/i.test(pathname)) return 'playing';
  if (/\/emby\/(Sessions|Items|Users|System)/i.test(pathname)) return 'api';
  return 'other';
}

// 字幕可能含用户权限内容，不再缓存；图片/静态资源才走边缘缓存
function isCacheableRequest(category) {
  return category === 'image' || category === 'static';
}

// ==================== 流量/请求数/访问量 工具（参考 CF-EMBY-PROXY-UI proxy_stats_hourly）====================
function formatBytes(bytes) {
  const b = Math.max(0, Number(bytes) || 0);
  if (!b) return '0 B';
  const k = 1024, sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return parseFloat((b / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getShanghaiParts(ts = Date.now()) {
  const d = new Date(ts + 8 * 3600000);
  const iso = d.toISOString();
  return { dateKey: iso.slice(0, 10), hour: d.getUTCHours(), ts };
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

// 透传计数流：不缓冲、不阻塞首字节，按【实际发出】的字节记账。
// 正常结束（close）和客户端中途断开（cancel）都会回调一次，避免拖动进度/缓冲够了就断开时丢数。
function countingBody(body, onDone) {
  if (!body) { onDone(0); return body; }
  let n = 0;
  let done = false;
  const finish = () => { if (done) return; done = true; try { onDone(n); } catch (_) {} };
  const reader = body.getReader();
  return new ReadableStream({
    async pull(ctrl) {
      try {
        const r = await reader.read();
        if (r.done) { finish(); ctrl.close(); return; }
        n += r.value?.byteLength || 0;
        ctrl.enqueue(r.value);
      } catch (e) {
        finish();
        try { ctrl.error(e); } catch (_) {}
      }
    },
    cancel(reason) {
      finish();
      try { reader.cancel(reason); } catch (_) {}
    },
  });
}

// ==================== Cloudflare GraphQL API ====================
function toGraphQLStr(v) { return JSON.stringify(String(v ?? '')); }

async function cfFetchGraphql(apiToken, query) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`cf_http_${res.status}`);
    const data = await res.json();
    if (Array.isArray(data?.errors) && data.errors.length) throw new Error(data.errors.map(e => e?.message).filter(Boolean).join('; ') || 'cf_graphql_error');
    return data;
  } finally {
    clearTimeout(tid);
  }
}

// useHostDim=true 时额外按 clientRequestHTTPHost 分组，用于只统计反代域名自身流量，
// 避免整个 Zone 里其他站点/记录把数字撑大。
async function cfGetZoneAnalytics(cfZoneId, cfApiToken, startIso, endIso, useHostDim = true) {
  const dims = useHostDim ? 'datetimeHour clientRequestHTTPHost' : 'datetimeHour';
  const query = `query { viewer { zones(filter: { zoneTag: ${toGraphQLStr(cfZoneId)} }) { series: httpRequestsAdaptiveGroups(limit: 10000, filter: { datetime_geq: ${toGraphQLStr(startIso)}, datetime_leq: ${toGraphQLStr(endIso)} }) { count dimensions { ${dims} } sum { edgeResponseBytes visits } } } } }`;
  const data = await cfFetchGraphql(cfApiToken, query);
  return data?.data?.viewer?.zones?.[0] || null;
}

async function cfGetWorkerRequests(cfAccountId, cfApiToken, startIso, endIso) {
  const query = `query { viewer { accounts(filter: { accountTag: ${toGraphQLStr(cfAccountId)} }) { workersInvocationsAdaptive(limit: 10000, filter: { datetime_geq: ${toGraphQLStr(startIso)}, datetime_leq: ${toGraphQLStr(endIso)} }) { dimensions { datetime scriptName status } sum { requests } } } } }`;
  const data = await cfFetchGraphql(cfApiToken, query);
  return data?.data?.viewer?.accounts?.[0] || null;
}

// 账号级 HTTP 汇总（对应后台「账号分析」页）：覆盖账号下所有域名的真实出站字节。
// 用户子域名即使灰云 CNAME 到第三方优选域名，只要那个 zone 在本账号里，也能统计到。
async function cfGetAccountHttp(cfAccountId, cfApiToken, startIso, endIso, useHostDim = true) {
  const dims = useHostDim ? 'datetimeHour clientRequestHTTPHost' : 'datetimeHour';
  const query = `query { viewer { accounts(filter: { accountTag: ${toGraphQLStr(cfAccountId)} }) { series: httpRequestsAdaptiveGroups(limit: 10000, filter: { datetime_geq: ${toGraphQLStr(startIso)}, datetime_leq: ${toGraphQLStr(endIso)} }) { count dimensions { ${dims} } sum { edgeResponseBytes visits } } } } }`;
  const data = await cfFetchGraphql(cfApiToken, query);
  return data?.data?.viewer?.accounts?.[0] || null;
}

function dayRangeIso(dateKey) {
  const start = new Date(dateKey + 'T00:00:00+08:00').getTime();
  return { start: new Date(start).toISOString(), end: new Date(start + 86400000 - 1).toISOString() };
}

// 返回该 Zone 中【反代域名】当天的 CF 侧数据；查询失败时返回 { error } 而不是抛出。
// 全站 CF 汇总时用到的域名集合：Worker 主入口 + 所有用户入口（子域名/用户名）。
// 只统计这些域名，避免把同 Zone 里其它 Worker/站点（如 emos/tg）算进来。
const workerHostCache = { at: 0, key: '', set: null };

async function getWorkerHosts(env) {
  const userDomain = getUserDomain(env);
  const main = getStatsHost(env);
  const cacheKey = (userDomain || '') + '|' + (main || '') + '|' + (env.DB ? 'db' : 'nodb');
  if (workerHostCache.set && workerHostCache.key === cacheKey && Date.now() - workerHostCache.at < 60000) {
    return workerHostCache.set;
  }
  const set = new Set();
  for (const h of envStr(env, 'STATS_HOSTS').split(/[\s,]+/).filter(Boolean)) set.add(h.toLowerCase());
  if (main) set.add(main);
  if (env.DB && userDomain) {
    try {
      const { results } = await env.DB.prepare('SELECT username, subdomain FROM users').all();
      for (const u of results || []) {
        const sub = String(u?.subdomain || u?.username || '').trim().toLowerCase();
        if (sub) set.add(sub + '.' + userDomain);
      }
    } catch (_) {}
  }
  workerHostCache.at = Date.now();
  workerHostCache.key = cacheKey;
  workerHostCache.set = set;
  return set;
}

// hostSet 为空时只统计主入口域名（后台仪表盘用）；传入域名集合时统计全站（日报用）。
async function cfGetZoneSummary(env, dateKey, hostSet = null) {
  const token = getCFApiToken(env);
  if (!token) return { error: '未配置 CF_API_TOKEN' };
  let info;
  try { info = await resolveZoneInfo(env); } catch (e) { return { error: String(e?.message || e) }; }
  if (!info.zoneId) return { error: info.error || '未解析到 CF_ZONE_ID' };

  const { start, end } = dayRangeIso(dateKey);
  let zone = null;
  let hostDim = true;
  let firstError = '';
  try {
    zone = await cfGetZoneAnalytics(info.zoneId, token, start, end, true);
  } catch (e) {
    firstError = String(e?.message || e);
    hostDim = false;
    try { zone = await cfGetZoneAnalytics(info.zoneId, token, start, end, false); } catch (e2) {
      return { error: String(e2?.message || e2).slice(0, 240) };
    }
  }
  if (!zone?.series) return { error: 'CF 未返回数据（Token 可能缺少 Analytics:Read 权限）' };

  const statsHost = getStatsHost(env);
  const wanted = hostSet && hostSet.size ? hostSet : (statsHost ? new Set([statsHost]) : null);
  const matches = (item) => {
    if (!wanted) return true;
    const h = String(item?.dimensions?.clientRequestHTTPHost || '').toLowerCase();
    return wanted.has(h);
  };
  const rows = hostDim ? zone.series.filter(matches) : zone.series;

  // 有 host 维度但没匹配到任何域名时：日报模式返回空（避免把其它站点算进来），
  // 仪表盘模式退回全 Zone 并给出提示。
  let hostMatched = true;
  let useRows = rows;
  if (hostDim && wanted && rows.length === 0) {
    hostMatched = false;
    useRows = hostSet ? [] : zone.series;
  }

  const sumRows = (list) => {
    let requests = 0, visits = 0, bytes = 0;
    const hourly = Array.from({ length: 24 }, () => 0);
    for (const item of list) {
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
  };
  const total = sumRows(useRows);
  // 主入口单独一份，日报里用来说明「CF 后台看到的那个数」是多少
  const mainRows = hostDim && statsHost
    ? zone.series.filter(it => String(it?.dimensions?.clientRequestHTTPHost || '').toLowerCase() === statsHost)
    : useRows;
  const main = sumRows(mainRows);

  return {
    requests: total.requests, visits: total.visits, bytes: total.bytes, hourly: total.hourly,
    mainRequests: main.requests, mainVisits: main.visits, mainBytes: main.bytes,
    zoneId: info.zoneId,
    zoneName: info.zoneName,
    statsHost,
    hostMatched,
    hostDim,
    note: hostMatched ? '' : ('CF 中未找到 ' + (statsHost || 'Worker 域名') + ' 的数据，当前展示整个 Zone 汇总；请检查 DNS_RECORD_NAME / STATS_HOSTS'),
    warning: firstError ? ('按域名分组查询失败，已退回 Zone 汇总: ' + firstError.slice(0, 120)) : '',
  };
}

// 近 N 日：同样只统计反代域名（statsHost），与日报头部保持同一口径。
// 一次查询 7 天的按小时数据，再按上海时区分桶，避免 7 次 GraphQL 请求。
async function cfGetZoneDailySeries(env, days = 7) {
  const token = getCFApiToken(env);
  if (!token) return { error: '未配置 CF_API_TOKEN' };
  let info;
  try { info = await resolveZoneInfo(env); } catch (e) { return { error: String(e?.message || e) }; }
  if (!info.zoneId) return { error: info.error || '未解析到 CF_ZONE_ID' };

  const today = getShanghaiParts().dateKey;
  const startDate = new Date(new Date(today + 'T00:00:00Z').getTime() - (days - 1) * 86400000).toISOString().slice(0, 10);
  const start = new Date(startDate + 'T00:00:00+08:00').toISOString();
  const end = new Date(new Date(today + 'T00:00:00+08:00').getTime() + 86400000 - 1).toISOString();
  const statsHost = getStatsHost(env);
  // 直接在 GraphQL 里按域名过滤：7 天 × 24 小时最多 168 行，
  // 不加过滤时全 Zone 的所有子域名会把 10000 行上限顶掉，导致统计被截断。
  const buildQuery = (hostFilter) => {
    const hostPart = hostFilter ? `, clientRequestHTTPHost: ${toGraphQLStr(hostFilter)}` : '';
    return `query { viewer { zones(filter: { zoneTag: ${toGraphQLStr(info.zoneId)} }) { series: httpRequestsAdaptiveGroups(limit: 10000, filter: { datetime_geq: ${toGraphQLStr(start)}, datetime_leq: ${toGraphQLStr(end)}${hostPart} }) { count dimensions { datetimeHour clientRequestHTTPHost } sum { edgeResponseBytes visits } } } } }`;
  };

  let rows = null;
  let hostFilterUsed = false;
  if (statsHost) {
    try {
      const zone = await cfFetchGraphql(token, buildQuery(statsHost));
      const r = zone?.data?.viewer?.zones?.[0]?.series;
      if (Array.isArray(r)) { rows = r; hostFilterUsed = true; }
    } catch (_) {}
  }
  // 域名过滤不可用时退回全 Zone 查询，再在本地按域名筛
  if (!hostFilterUsed) {
    try {
      const zone = await cfFetchGraphql(token, buildQuery(''));
      const r = zone?.data?.viewer?.zones?.[0]?.series;
      if (Array.isArray(r)) rows = r;
    } catch (e) { return { error: String(e?.message || e).slice(0, 200) }; }
  }
  if (!Array.isArray(rows)) return { error: 'CF 未返回数据' };

  const map = new Map();
  let hostMatched = hostFilterUsed;
  for (const item of rows) {
    const h = String(item?.dimensions?.clientRequestHTTPHost || '').toLowerCase();
    if (statsHost && h !== statsHost) continue;
    hostMatched = true;
    const raw = item?.dimensions?.datetimeHour;
    if (!raw) continue;
    const { dateKey } = getShanghaiParts(new Date(raw).getTime());
    const cur = map.get(dateKey) || { requests: 0, traffic: 0, visits: 0 };
    cur.requests += Number(item?.count) || 0;
    cur.traffic += Number(item?.sum?.edgeResponseBytes) || 0;
    cur.visits += Number(item?.sum?.visits) || 0;
    map.set(dateKey, cur);
  }
  if (statsHost && !hostMatched) return { error: 'CF 中未找到 ' + statsHost + ' 的数据', series: [] };

  const series = [];
  for (let i = 0; i < days; i++) {
    const key = new Date(new Date(startDate + 'T00:00:00Z').getTime() + i * 86400000).toISOString().slice(0, 10);
    const r = map.get(key) || { requests: 0, traffic: 0, visits: 0 };
    series.push({ date: key, requests: r.requests, traffic: r.traffic, visits: r.visits });
  }
  return { series, zoneId: info.zoneId, zoneName: info.zoneName, statsHost, hostMatched };
}

// 全站（整个 Worker）汇总：账号分析 + 按 Worker 域名过滤。
// hostSet 覆盖主入口 + 所有用户入口，因此灰云 CNAME 的用户子域名也会被算进来；
// 账号里若还有别的站点，会被 hostSet 过滤掉。过滤后无数据时退回账号总量并给出提示。
async function cfGetAccountSummary(env, dateKey, hostSet = null) {
  const token = getCFApiToken(env);
  if (!token) return { error: '未配置 CF_API_TOKEN' };
  let info;
  try { info = await resolveZoneInfo(env); } catch (e) { return { error: String(e?.message || e) }; }
  if (!info.accountId) return { error: '未解析到 CF_ACCOUNT_ID（Token 需 Account Analytics:Read）' };

  const { start, end } = dayRangeIso(dateKey);
  let account = null;
  let hostDim = true;
  let firstError = '';
  try {
    account = await cfGetAccountHttp(info.accountId, token, start, end, true);
  } catch (e) {
    firstError = String(e?.message || e);
    hostDim = false;
    try { account = await cfGetAccountHttp(info.accountId, token, start, end, false); } catch (e2) {
      return { error: String(e2?.message || e2).slice(0, 240) };
    }
  }
  if (!account?.series) return { error: '账号分析未返回数据（Token 需 Account Analytics:Read 权限）' };
  // 账号下域名很多时按域名分组的行数会被 10000 上限截断，退回不带域名的账号汇总
  if (hostDim && account.series.length >= 10000) {
    try {
      const plain = await cfGetAccountHttp(info.accountId, token, start, end, false);
      if (Array.isArray(plain?.series)) { account = plain; hostDim = false; }
    } catch (_) {}
  }

  const statsHost = getStatsHost(env);
  const wanted = hostSet && hostSet.size ? hostSet : null;
  let hostMatched = Boolean(hostDim && wanted);
  let rows = hostDim && wanted ? account.series.filter(it => wanted.has(String(it?.dimensions?.clientRequestHTTPHost || '').toLowerCase())) : account.series;
  if (hostDim && wanted && rows.length === 0) {
    hostMatched = false;
    rows = account.series;
  }

  const sumRows = (list) => {
    let requests = 0, visits = 0, bytes = 0;
    const hourly = Array.from({ length: 24 }, () => 0);
    const byHost = {};
    for (const item of list) {
      const n = Number(item?.count) || 0;
      const b = Number(item?.sum?.edgeResponseBytes) || 0;
      requests += n;
      visits += Number(item?.sum?.visits) || 0;
      bytes += b;
      const hHost = String(item?.dimensions?.clientRequestHTTPHost || '').toLowerCase();
      if (hHost) {
        const cur = byHost[hHost] || { requests: 0, bytes: 0, visits: 0 };
        cur.requests += n; cur.bytes += b; cur.visits += Number(item?.sum?.visits) || 0;
        byHost[hHost] = cur;
      }
      const raw = item?.dimensions?.datetimeHour;
      if (raw) {
        const h = (new Date(raw).getUTCHours() + 8) % 24;
        if (h >= 0 && h < 24) hourly[h] += n;
      }
    }
    return { requests, visits, bytes, hourly, byHost };
  };
  const total = sumRows(rows);
  // 主入口单独一份，日报里说明「CF 后台 fd 那个数」
  const mainRows = hostDim && statsHost
    ? account.series.filter(it => String(it?.dimensions?.clientRequestHTTPHost || '').toLowerCase() === statsHost)
    : rows;
  const main = sumRows(mainRows);

  return {
    requests: total.requests, visits: total.visits, bytes: total.bytes,
    hourly: total.hourly, byHost: total.byHost,
    mainRequests: main.requests, mainVisits: main.visits, mainBytes: main.bytes,
    accountId: info.accountId,
    statsHost,
    hostMatched,
    hostDim,
    source: 'account',
    note: hostMatched ? '' : '账号分析中未匹配到 Worker 域名，当前使用账号总量',
    warning: firstError ? ('按域名分组查询失败，已退回账号汇总: ' + firstError.slice(0, 120)) : '',
  };
}

// 近 N 日：账号级查询，按上海时区分桶；行数被 10000 上限截断时退回不带域名的账号汇总。
async function cfGetAccountDailySeries(env, days = 7, hostSet = null) {
  const token = getCFApiToken(env);
  if (!token) return { error: '未配置 CF_API_TOKEN' };
  let info;
  try { info = await resolveZoneInfo(env); } catch (e) { return { error: String(e?.message || e) }; }
  if (!info.accountId) return { error: '未解析到 CF_ACCOUNT_ID' };

  const today = getShanghaiParts().dateKey;
  const startDate = new Date(new Date(today + 'T00:00:00Z').getTime() - (days - 1) * 86400000).toISOString().slice(0, 10);
  const start = new Date(startDate + 'T00:00:00+08:00').toISOString();
  const end = new Date(new Date(today + 'T00:00:00+08:00').getTime() + 86400000 - 1).toISOString();

  let rows = null;
  let truncated = false;
  try {
    const acc = await cfGetAccountHttp(info.accountId, token, start, end, true);
    rows = Array.isArray(acc?.series) ? acc.series : null;
    truncated = Boolean(rows && rows.length >= 10000);
  } catch (_) {}
  if (!Array.isArray(rows) || truncated) {
    try {
      const acc = await cfGetAccountHttp(info.accountId, token, start, end, false);
      rows = Array.isArray(acc?.series) ? acc.series : null;
    } catch (e) { return { error: String(e?.message || e).slice(0, 200) }; }
  }
  if (!Array.isArray(rows)) return { error: '账号分析未返回数据' };

  const wanted = hostSet && hostSet.size ? hostSet : null;
  const map = new Map();
  for (const item of rows) {
    const h = String(item?.dimensions?.clientRequestHTTPHost || '').toLowerCase();
    if (wanted && h && !wanted.has(h)) continue;
    const raw = item?.dimensions?.datetimeHour;
    if (!raw) continue;
    const { dateKey } = getShanghaiParts(new Date(raw).getTime());
    const cur = map.get(dateKey) || { requests: 0, traffic: 0, visits: 0 };
    cur.requests += Number(item?.count) || 0;
    cur.traffic += Number(item?.sum?.edgeResponseBytes) || 0;
    cur.visits += Number(item?.sum?.visits) || 0;
    map.set(dateKey, cur);
  }

  const series = [];
  for (let i = 0; i < days; i++) {
    const key = new Date(new Date(startDate + 'T00:00:00Z').getTime() + i * 86400000).toISOString().slice(0, 10);
    const r = map.get(key) || { requests: 0, traffic: 0, visits: 0 };
    series.push({ date: key, requests: r.requests, traffic: r.traffic, visits: r.visits });
  }
  return { series, accountId: info.accountId, source: 'account' };
}

async function cfGetWorkerSummary(env, dateKey) {
  const token = getCFApiToken(env);
  if (!token) return { error: '未配置 CF_API_TOKEN' };
  let info;
  try { info = await resolveZoneInfo(env); } catch (e) { return { error: String(e?.message || e) }; }
  if (!info.accountId) return { error: '未解析到 CF_ACCOUNT_ID（Token 需 Account Analytics:Read）' };
  const { start, end } = dayRangeIso(dateKey);
  try {
    const account = await cfGetWorkerRequests(info.accountId, token, start, end);
    if (!account?.workersInvocationsAdaptive) return { error: 'CF 未返回 Worker 调用数据' };
    let requests = 0;
    const hourly = Array.from({ length: 24 }, () => 0);
    const byScript = {};
    for (const item of account.workersInvocationsAdaptive) {
      const n = Number(item?.sum?.requests) || 0;
      requests += n;
      const name = item?.dimensions?.scriptName || 'unknown';
      byScript[name] = (byScript[name] || 0) + n;
      const raw = item?.dimensions?.datetime;
      if (raw) {
        const h = (new Date(raw).getUTCHours() + 8) % 24;
        if (h >= 0 && h < 24) hourly[h] += n;
      }
    }
    return { requests, hourly, byScript, accountId: info.accountId };
  } catch (e) {
    return { error: String(e?.message || e).slice(0, 200) };
  }
}

// ==================== 日报（Telegram / Webhook）====================
function tgEscape(v) {
  return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// 把 Telegram 的英文错误翻译成可操作的中文提示（保留原始错误，便于排查）
function describeTelegramError(raw) {
  const msg = String(raw == null ? '' : raw).trim();
  const low = msg.toLowerCase();
  if (!msg) return '未知错误';
  if (low.includes('chat not found')) {
    return msg + '（机器人找不到该会话：请先用 Telegram 打开这个机器人并点「开始」或发送 /start，再确认 TELEGRAM_CHAT_ID 填的是该账号的数字 ID，而不是手机号/用户名）';
  }
  if (low.includes('bot was blocked')) return msg + '（该账号把机器人拉黑/屏蔽了，请在 Telegram 中解除屏蔽后重新发送 /start）';
  if (low.includes('user is deactivated')) return msg + '（该 Telegram 账号已注销）';
  if (low.includes('not enough rights') || low.includes('chat_write_forbidden')) return msg + '（机器人不在该群组，或没有发言权限）';
  if (low.includes('unauthorized') || low.includes('invalid token')) return msg + '（TELEGRAM_BOT_TOKEN 无效，请到 BotFather 重新复制 Token）';
  if (low.includes('too many requests')) return msg + '（发送过于频繁，请稍后再试）';
  if (low.includes('button_url_invalid') || low.includes('can\'t parse entities')) return msg + '（消息内容格式错误）';
  return msg;
}

async function sendTelegramMessage(env, text) {
  const token = getTelegramToken(env);
  const chatId = getTelegramChatId(env);
  if (!token || !chatId) {
    return { ok: false, error: '未配置 TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID（或 TG_BOT_TOKEN / TG_CHAT_ID）', rawError: 'not configured' };
  }
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: String(text).slice(0, 4096), parse_mode: 'HTML', disable_web_page_preview: true }),
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      const raw = data.description || ('HTTP ' + res.status);
      return { ok: false, error: describeTelegramError(raw), rawError: raw };
    }
    return { ok: true };
  } catch (e) {
    const raw = String(e?.message || e);
    return { ok: false, error: raw, rawError: raw };
  } finally {
    clearTimeout(tid);
  }
}

// 根据实际原因生成日报发送失败提示，避免“已配置却说没配置”
function reportFailureHint(env, out) {
  const tg = out.telegram || {};
  const wh = out.webhook || {};
  const tgConfigured = Boolean(getTelegramToken(env) && getTelegramChatId(env));
  if (tg.error) {
    return tgConfigured
      ? 'Telegram 变量已读取，但发送失败：' + tg.error
      : '未配置 Telegram 变量：请设置 TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID（或 TG_BOT_TOKEN / TG_CHAT_ID）';
  }
  if (wh.error) return 'Webhook 发送失败：' + wh.error;
  if (wh.skipped && !tg.ok) return '未配置通知渠道：请设置 TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID（或 TG_*），或 NOTIFY_WEBHOOK';
  return '发送失败：未知错误';
}

async function buildDailyReport(env, dateKey) {
  const key = /^\d{4}-\d{2}-\d{2}$/.test(dateKey || '') ? dateKey : getShanghaiParts().dateKey;
  try { await flushHourlyStats(env); } catch (_) {}
  const workerHosts = await getWorkerHosts(env);

  // 主口径：CF 账号分析（整个账号所有域名，带宽 = 边缘真正发给客户端的字节）。
  // 用户子域名是灰云 CNAME 到优选域名，zone 级统计看不到它们，只有账号级能覆盖全站。
  const acc = await cfGetAccountSummary(env, key, workerHosts);
  const accOk = !acc.error;
  const d1 = await getD1Stats(env, key);
  // 账号分析不可用时退回 Zone 级（仅主域名）
  const cf = accOk ? { error: '' } : await cfGetZoneSummary(env, key, workerHosts);
  const cfOk = !accOk && !cf.error;

  const requests = accOk ? (Number(acc.requests) || 0) : (cfOk ? (Number(cf.requests) || 0) : (d1.requests || 0));
  const traffic = accOk ? (Number(acc.bytes) || 0) : (cfOk ? (Number(cf.bytes) || 0) : (d1.traffic || 0));
  const visits = accOk ? (Number(acc.visits) || 0) : (cfOk ? (Number(cf.visits) || 0) : 0);

  // 近 7 日同样用账号分析；不可用时退回 D1（声明长度口径）
  let daily = [];
  if (accOk) {
    const s = await cfGetAccountDailySeries(env, 7, workerHosts);
    if (!s.error && Array.isArray(s.series)) daily = s.series;
  }
  if (!daily.some(d => Number(d.requests) > 0)) daily = await getD1DailySeries(env, 7);
  // D1 也没有数据（刚部署）时退回 Zone 级
  if (!daily.some(d => Number(d.requests) > 0)) {
    const zs = await cfGetZoneDailySeries(env, 7);
    if (!zs.error && Array.isArray(zs.series)) daily = zs.series;
  }

  const lines = [];
  lines.push('📊 <b>Emby Proxy 日报</b>');
  const host = getStatsHost(env);
  lines.push('<code>全站（' + tgEscape(host ? host + ' + 用户子域名' : '含用户子域名') + '）</code>');
  lines.push('<code>' + tgEscape(key) + '</code>');
  lines.push('');
  lines.push('请求数：<b>' + requests + '</b>');
  lines.push('出站流量：<b>' + formatBytes(traffic) + '</b>');
  if (accOk || cfOk) lines.push('CF 访问量：<b>' + visits + '</b>');
  // 主域名单列一行：CF 后台看到的是这个数，和上面的全站合计不是一个口径
  if (host) {
    if (accOk && acc.hostDim) {
      lines.push('其中 ' + tgEscape(host) + '：' + (Number(acc.mainRequests) || 0) + ' 次 / ' + formatBytes(Number(acc.mainBytes) || 0));
    } else if (cfOk && cf.hostDim) {
      lines.push('其中 ' + tgEscape(host) + '：' + (Number(cf.mainRequests) || 0) + ' 次 / ' + formatBytes(Number(cf.mainBytes) || 0));
    }
  }

  // 多人版日报不展示全局热门路由（避免把其他用户的路径暴露给所有接收者）
  // 也不展示「用户用量」：日报只保留全站汇总数据

  if (daily.length) {
    lines.push('');
    lines.push('<b>近 7 日（全站）</b>');
    for (const d of daily) {
      lines.push(d.date + '  ' + d.requests + ' 次 / ' + formatBytes(d.traffic));
    }
  }

  if (!accOk) {
    lines.push('');
    lines.push('<i>账号分析不可用，已退回 ' + (cfOk ? 'Zone 统计' : 'D1 统计') + '：' + tgEscape(String(acc.error).slice(0, 160)) + '</i>');
  } else if (acc.hostMatched === false) {
    lines.push('');
    lines.push('<i>账号分析中未匹配到 Worker 域名，当前为账号总量</i>');
  }
  lines.push('');
  lines.push('<i>' + tgEscape(new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })) + '</i>');
  const githubUrl = envStr(env, 'GITHUB_URL', 'GITHUB_REPO') || 'https://github.com/Dirige/EMBY_CF';
  const monitorUrl = envStr(env, 'MONITOR_URL') || 'https://yx.255432.xyz/';
  lines.push('');
  lines.push('🔗 GitHub：<a href="' + githubUrl + '">' + tgEscape(githubUrl) + '</a>');
  lines.push('📈 优选域名监控：<a href="' + monitorUrl + '">' + tgEscape(monitorUrl) + '</a>');
  return lines.join('\n');
}

async function sendDailyReport(env, dateKey) {
  const key = /^\d{4}-\d{2}-\d{2}$/.test(dateKey || '') ? dateKey : getShanghaiParts().dateKey;
  const text = await buildDailyReport(env, key);
  const tg = await sendTelegramMessage(env, text);
  let webhook = { ok: false, skipped: true };
  if (env.NOTIFY_WEBHOOK && isValidHttpUrl(env.NOTIFY_WEBHOOK)) {
    try {
      const res = await fetch(env.NOTIFY_WEBHOOK, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, content: text, date: key }),
      });
      webhook = { ok: res.ok, status: res.status };
    } catch (e) {
      webhook = { ok: false, error: String(e?.message || e) };
    }
  }
  // 记录上次发送日期，避免 Cron 在 23 点这一小时内重复推送（手动发送不受影响）
  return { ok: tg.ok || webhook.ok, telegram: tg, webhook, date: key, text };
}

// 用 D1 做一次原子抢占，保证多 isolate 下同一天只自动发一次日报
async function claimReportSlot(env, dateKey) {
  if (!env.DB) return false;
  try {
    const r = await env.DB.prepare(
      `INSERT INTO settings (key, value) VALUES ('last_report_date', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value WHERE settings.value <> excluded.value`
    ).bind(dateKey).run();
    return Boolean(r.meta && r.meta.changes);
  } catch (_) {
    return false;
  }
}

// 内存聚合后批量写 D1，降低写入次数（isolate 被回收时最多丢失尚未刷入的少量数据）
const statsBuffer = new Map();
const routeStatsBuffer = new Map();
const userStatsBuffer = new Map();
let statsBufferCount = 0;
let statsLastFlush = Date.now();
const STATS_FLUSH_EVERY = 20;
const STATS_FLUSH_MS = 30000;

function bufferHourlyStats({ isPlay, isPlaybackInfo, bytes, timestamp, prefix, owner }) {
  const { dateKey, hour } = getShanghaiParts(timestamp);
  const b = Math.max(0, Number(bytes) || 0);
  const key = dateKey + '|' + hour;
  const cur = statsBuffer.get(key) || { dateKey, hour, req: 0, play: 0, info: 0, bytes: 0 };
  cur.req += 1;
  if (isPlay) cur.play += 1;
  if (isPlaybackInfo) cur.info += 1;
  cur.bytes += b;
  statsBuffer.set(key, cur);
  if (prefix) {
    // prefix 已经是最终的统计键（用户路由由 proxyDirectUrl 传 owner/prefix），这里不要再拼一次 owner
    const rk = prefix + '|' + dateKey;
    const rc = routeStatsBuffer.get(rk) || { prefix, dateKey, req: 0, bytes: 0 };
    rc.req += 1;
    rc.bytes += b;
    routeStatsBuffer.set(rk, rc);
  }
  if (owner) {
    const uk = owner + '|' + dateKey + '|' + hour;
    const uc = userStatsBuffer.get(uk) || { owner, dateKey, hour, req: 0, play: 0, info: 0, bytes: 0 };
    uc.req += 1;
    if (isPlay) uc.play += 1;
    if (isPlaybackInfo) uc.info += 1;
    uc.bytes += b;
    userStatsBuffer.set(uk, uc);
  }
  statsBufferCount++;
}

async function flushHourlyStats(env) {
  if (!env.DB || (!statsBuffer.size && !routeStatsBuffer.size && !userStatsBuffer.size)) return;
  const items = Array.from(statsBuffer.values());
  const ritems = Array.from(routeStatsBuffer.values());
  const uitems = Array.from(userStatsBuffer.values());
  statsBuffer.clear();
  routeStatsBuffer.clear();
  userStatsBuffer.clear();
  statsBufferCount = 0;
  statsLastFlush = Date.now();
  const updatedAt = new Date().toISOString();
  const sql = `INSERT INTO proxy_stats_hourly (bucket_date, bucket_hour, request_count, play_count, playback_info_count, traffic_bytes, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(bucket_date, bucket_hour) DO UPDATE SET
       request_count = request_count + excluded.request_count,
       play_count = play_count + excluded.play_count,
       playback_info_count = playback_info_count + excluded.playback_info_count,
       traffic_bytes = traffic_bytes + excluded.traffic_bytes,
       updated_at = excluded.updated_at`;
  const rsql = `INSERT INTO route_stats_daily (prefix, bucket_date, request_count, traffic_bytes) VALUES (?, ?, ?, ?)
     ON CONFLICT(prefix, bucket_date) DO UPDATE SET
       request_count = request_count + excluded.request_count,
       traffic_bytes = traffic_bytes + excluded.traffic_bytes`;
  const usql = `INSERT INTO user_stats_hourly (owner, bucket_date, bucket_hour, request_count, play_count, playback_info_count, traffic_bytes)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(owner, bucket_date, bucket_hour) DO UPDATE SET
       request_count = request_count + excluded.request_count,
       play_count = play_count + excluded.play_count,
       playback_info_count = playback_info_count + excluded.playback_info_count,
       traffic_bytes = traffic_bytes + excluded.traffic_bytes`;
  try {
    await env.DB.batch([
      ...items.map(i => env.DB.prepare(sql).bind(i.dateKey, i.hour, i.req, i.play, i.info, i.bytes, updatedAt)),
      ...ritems.map(i => env.DB.prepare(rsql).bind(i.prefix, i.dateKey, i.req, i.bytes)),
      ...uitems.map(i => env.DB.prepare(usql).bind(i.owner, i.dateKey, i.hour, i.req, i.play, i.info, i.bytes)),
    ]);
  } catch (_) {}
}

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

function json(data, status = 200) {
  const headers = { ...CORS_JSON, 'Cache-Control': 'no-store' };
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) headers[k] = v;
  return new Response(JSON.stringify(data), { status, headers });
}

function html(body, status = 200) {
  const headers = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' };
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) headers[k] = v;
  return new Response(body, { status, headers });
}

function getCookie(req, name) {
  const s = req.headers.get('Cookie');
  if (!s) return null;
  const m = s.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  if (!m) return null;
  try { return decodeURIComponent(m[1]); } catch { return null; }
}

function getAdminToken(env) {
  const raw = env.ADMIN_TOKEN ?? env.ADMIN_PASSWORD ?? env.admin_token ?? env.AdminToken;
  if (raw == null) return null;
  const t = String(raw).trim();
  return t.length ? t : null;
}

// ==================== 环境变量兼容层 ====================
// 同时兼容新老命名，避免因为变量名（TG_* / TELEGRAM_*、CF_DOMAIN / BASE_DOMAIN）不同导致
// 统计、日报、通知静默失效。
function envStr(env, ...keys) {
  for (const k of keys) {
    const v = env && env[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

function getBaseDomain(env) {
  return envStr(env, 'BASE_DOMAIN', 'CF_DOMAIN').toLowerCase()
    .replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/:\d+$/, '')
    .replace(/^\.+|\.+$/g, '');
}

// 用户入口使用的域名后缀
// 默认从现有变量自动推导（不绑定任何具体域名）：
//   BASE_DOMAIN=example.com       + DNS_RECORD_NAME=proxy  -> example.com（用户 alice.example.com）
//   BASE_DOMAIN=example.com       + DNS_RECORD_NAME=fd     -> example.com（用户 alice.example.com）
//   BASE_DOMAIN=fd.example.com    + DNS_RECORD_NAME=fd     -> example.com（自动去掉 Worker 那一级）
// 也可以用 USER_DOMAIN 显式覆盖（任意域名，例如想让用户继续用 x.fd.example.com）
function getUserDomain(env) {
  const raw = envStr(env, 'USER_DOMAIN', 'ENTRY_DOMAIN', 'USER_BASE_DOMAIN');
  if (raw) {
    return raw.toLowerCase()
      .replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/:\d+$/, '')
      .replace(/^\.+|\.+$/g, '');
  }
  const base = getBaseDomain(env);
  const dns = getDnsRecordName(env);
  if (base && dns && base !== dns && base.startsWith(dns + '.')) {
    const rest = base.slice(dns.length + 1);
    if (rest.includes('.')) return rest;
  }
  return base;
}

function getDnsRecordName(env) {
  return envStr(env, 'DNS_RECORD_NAME').replace(/^\.+|\.+$/g, '').toLowerCase();
}

function toFqdn(name, root) {
  const n = String(name || '').trim().toLowerCase().replace(/^\.+|\.+$/g, '');
  const r = String(root || '').trim().toLowerCase().replace(/^\.+|\.+$/g, '');
  if (!n || n === '@') return r;
  if (!r) return n;
  if (n === r || n.endsWith('.' + r)) return n;
  return n + '.' + r;
}

// 统计/日报里对应的完整访问域名，例如 BASE_DOMAIN=example.com + DNS_RECORD_NAME=proxy => proxy.example.com
// 如果 BASE_DOMAIN 本身已经是 fd.example.com（带 Worker 前缀），则主入口就是 BASE_DOMAIN
function getStatsHost(env) {
  const override = envStr(env, 'STATS_HOSTS').split(/[\s,]+/).filter(Boolean)[0] || '';
  if (override) return override.toLowerCase();
  const base = getBaseDomain(env);
  const dns = getDnsRecordName(env);
  if (base && dns && base !== dns && base.startsWith(dns + '.')) return base;
  return toFqdn(dns, base).toLowerCase();
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

// ---- Cloudflare Zone / Account 自动解析（CF_ZONE_ID、CF_ACCOUNT_ID 都可以不配）----
// 按主机名分别缓存：BASE_DOMAIN 与 USER_DOMAIN 可能属于不同的 Zone
const zoneInfoCaches = new Map();

async function findZoneForHost(env, host) {
  const h = String(host || '').toLowerCase().replace(/^\.+|\.+$/g, '');
  if (!h) return { zone: null, error: '域名为空' };

  const exact = await cloudflareAPICall(env, 'GET', '/zones?name=' + encodeURIComponent(h) + '&per_page=1');
  if (exact && exact.success && Array.isArray(exact.result) && exact.result[0]) {
    return { zone: exact.result[0], error: '' };
  }
  const lastError = (exact && ((exact.errors && exact.errors[0] && exact.errors[0].message) || exact.error)) || '';

  const list = await cloudflareAPICall(env, 'GET', '/zones?per_page=50');
  if (!list || !list.success || !Array.isArray(list.result)) {
    return { zone: null, error: (list && ((list.errors && list.errors[0] && list.errors[0].message) || list.error)) || lastError || '读取区域列表失败（检查 Token 是否有 Zone:Read 权限）' };
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

async function resolveZoneInfo(env, force = false, host = '') {
  const envZone = envStr(env, 'CF_ZONE_ID');
  const envAccount = envStr(env, 'CF_ACCOUNT_ID');
  const base = getBaseDomain(env);
  // 解析 Zone 的目标主机：传入的 host > 用户域名 > BASE_DOMAIN
  const target = String(host || getUserDomain(env) || base || '')
    .toLowerCase().replace(/^\.+|\.+$/g, '').replace(/:\d+$/, '');

  if (envZone && envAccount) return { zoneId: envZone, accountId: envAccount, zoneName: target || base, base: target || base, host: target, error: '', from: 'env' };
  const cached = zoneInfoCaches.get(target);
  if (!force && cached && Date.now() - cached.at < 600000) return cached;

  const token = getCFApiToken(env);
  if (!target) return { zoneId: envZone, accountId: envAccount, zoneName: '', base, host: '', error: '未配置 BASE_DOMAIN / USER_DOMAIN', from: 'none' };
  if (!token) return { zoneId: envZone, accountId: envAccount, zoneName: target, base: target, host: target, error: '未配置 CF_API_TOKEN', from: 'none' };

  try {
    const { zone, error } = await findZoneForHost(env, target);
    const info = {
      at: Date.now(),
      base: target,
      host: target,
      zoneId: envZone || (zone && zone.id) || '',
      accountId: envAccount || (zone && zone.account && zone.account.id) || '',
      zoneName: (zone && zone.name) || target,
      error: zone ? '' : (error || '未找到该域名所属区域'),
      from: envZone ? 'env+api' : 'api',
    };
    zoneInfoCaches.set(target, info);
    return info;
  } catch (e) {
    return { zoneId: envZone, accountId: envAccount, zoneName: target, base: target, host: target, error: String(e?.message || e), from: 'none' };
  }
}

function invalidateZoneInfoCache() { zoneInfoCaches.clear(); }

// ---- 会话：HMAC 签名令牌（Cookie 中不再保存明文密钥）----
// 多人版 Cookie 格式：uid.exp.sig（管理员 uid=0，普通用户 uid=users.id）
const SESSION_COOKIE = 'admin_session';
const SESSION_TTL_SEC = 7 * 24 * 3600;
const ADMIN_UID = 0;
const enc = new TextEncoder();

function toHex(buf) {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
  const h = String(hex || '');
  const out = new Uint8Array(Math.floor(h.length / 2));
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.substr(i * 2, 2), 16) || 0;
  return out;
}

async function hmacHex(secret, msg) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toHex(await crypto.subtle.sign('HMAC', key, enc.encode(msg)));
}

// 常量时间比较（先对两边做 HMAC，保证长度一致）
async function safeEqual(a, b, secret) {
  const [x, y] = await Promise.all([hmacHex(secret, 'cmp:' + a), hmacHex(secret, 'cmp:' + b)]);
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return d === 0;
}

function sessionSecret(env) {
  return envStr(env, 'SESSION_SECRET') || getAdminToken(env) || '';
}

async function makeSessionToken(secret, uid = ADMIN_UID) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SEC;
  const id = Number(uid) || 0;
  return id + '.' + exp + '.' + await hmacHex(secret, 'session:' + id + ':' + exp);
}

// 兼容两种格式：
//   3 段：uid.exp.sig（多人版）
//   2 段：exp.sig（v6.1 老会话，等价于管理员）
async function verifySessionToken(token, secret) {
  const parts = String(token || '').split('.');
  const now = Math.floor(Date.now() / 1000);
  if (parts.length === 2) {
    const exp = parseInt(parts[0], 10);
    if (!parts[1] || !Number.isFinite(exp) || exp < now) return null;
    if (!(await safeEqual(parts[1], await hmacHex(secret, 'session:' + exp), secret))) return null;
    return { uid: ADMIN_UID, exp };
  }
  if (parts.length !== 3) return null;
  const uid = parseInt(parts[0], 10);
  const exp = parseInt(parts[1], 10);
  if (!Number.isFinite(uid) || uid < 0 || !Number.isFinite(exp) || exp < now) return null;
  if (!(await safeEqual(parts[2], await hmacHex(secret, 'session:' + uid + ':' + exp), secret))) return null;
  return { uid, exp };
}

// ---- 密码哈希（PBKDF2-SHA256 100000 次）----
function randomHex(bytes = 16) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return toHex(buf);
}

async function hashPassword(password, saltHex) {
  const key = await crypto.subtle.importKey('raw', enc.encode(String(password || '')), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: hexToBytes(saltHex), iterations: 100000, hash: 'SHA-256' },
    key, 256
  );
  return toHex(bits);
}

async function verifyPassword(password, saltHex, expectedHex) {
  try {
    const got = await hashPassword(password, saltHex);
    return safeEqual(got, expectedHex, 'pw-cmp');
  } catch (_) {
    return false;
  }
}

// ---- 用户读取（15 秒内存缓存，后台改动后主动清空）----
const userCache = new Map();

function clearUserCache() { userCache.clear(); try { clearOwnerCache(); } catch (_) {} }

function rowToUser(r) {
  if (!r) return null;
  return {
    id: Number(r.id),
    username: r.username,
    passwordHash: r.password_hash,
    salt: r.salt,
    role: r.role || 'user',
    status: r.status || 'active',
    subdomain: r.subdomain || '',
    routeLimit: Number(r.route_limit) || 20,
    createdAt: r.created_at || '',
    lastLogin: r.last_login || '',
  };
}

function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    username: u.username,
    role: u.role,
    status: u.status,
    subdomain: u.subdomain || '',
    routeLimit: u.routeLimit || 20,
    createdAt: u.createdAt || '',
    lastLogin: u.lastLogin || '',
  };
}

async function getUserById(env, id) {
  if (!env.DB || !Number.isFinite(Number(id))) return null;
  const key = 'id:' + id;
  const now = Date.now();
  const hit = userCache.get(key);
  if (hit && hit.exp > now) return hit.user;
  const row = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(Number(id)).first();
  const user = rowToUser(row);
  userCache.set(key, { user, exp: now + 15000 });
  if (userCache.size > 500) userCache.clear();
  return user;
}

async function getUserByUsername(env, username) {
  if (!env.DB || !username) return null;
  const uname = String(username).toLowerCase();
  const key = 'name:' + uname;
  const now = Date.now();
  const hit = userCache.get(key);
  if (hit && hit.exp > now) return hit.user;
  const row = await env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(uname).first();
  const user = rowToUser(row);
  userCache.set(key, { user, exp: now + 15000 });
  if (userCache.size > 500) userCache.clear();
  return user;
}

async function getSession(request, env) {
  const secret = sessionSecret(env);
  if (!secret) return null;
  const tok = getCookie(request, SESSION_COOKIE);
  if (!tok) return null;
  const v = await verifySessionToken(tok, secret);
  if (!v) return null;
  if (v.uid === ADMIN_UID) {
    return { uid: 0, id: 0, username: 'admin', role: 'admin', status: 'active', subdomain: '', isAdmin: true, exp: v.exp };
  }
  const user = await getUserById(env, v.uid);
  if (!user || user.status !== 'active') return null;
  return {
    uid: user.id, id: user.id, username: user.username, role: user.role,
    status: user.status, subdomain: user.subdomain, isAdmin: user.role === 'admin', exp: v.exp,
  };
}

async function isAdmin(request, env) {
  const s = await getSession(request, env);
  return Boolean(s && s.isAdmin);
}

// ---- 登录限流（单 isolate 内的尽力而为；严格限速请配合 Cloudflare WAF 速率限制规则）----
const loginFails = new Map();
const LOGIN_MAX_FAILS = 5;
const LOGIN_WINDOW_MS = 10 * 60 * 1000;

function loginBlocked(ip) {
  const rec = loginFails.get(ip);
  if (!rec) return false;
  if (Date.now() - rec.first > LOGIN_WINDOW_MS) { loginFails.delete(ip); return false; }
  return rec.n >= LOGIN_MAX_FAILS;
}

function loginFailed(ip) {
  const now = Date.now();
  const rec = loginFails.get(ip);
  if (!rec || now - rec.first > LOGIN_WINDOW_MS) loginFails.set(ip, { n: 1, first: now });
  else rec.n++;
  if (loginFails.size > 5000) {
    for (const [k, v] of loginFails) if (now - v.first > LOGIN_WINDOW_MS) loginFails.delete(k);
  }
}

function sessionCookie(token, maxAge = SESSION_TTL_SEC) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Strict; Secure`;
}

async function loginJson(env, uid, username, isAdminUser, extra = {}) {
  const token = await makeSessionToken(sessionSecret(env), uid);
  return new Response(JSON.stringify({ ok: true, user: { uid, username, isAdmin: Boolean(isAdminUser) }, ...extra }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Set-Cookie': sessionCookie(token),
      'Cache-Control': 'no-store',
    },
  });
}

// 支持三种登录方式：
//   1) { username: 'admin', password: ADMIN_TOKEN }  管理员
//   2) { username: 'alice', password: '...' }         普通用户
//   3) { token: ADMIN_TOKEN }                         兼容旧版前端
async function adminLoginResponse(request, env, creds = {}) {
  const secret = sessionSecret(env);
  if (!secret) {
    return json({
      ok: false,
      error: 'Worker 未读到 ADMIN_TOKEN / SESSION_SECRET。请在 Cloudflare 控制台 → Worker → 设置 → 变量和机密 中添加。',
    }, 503);
  }
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  if (loginBlocked(ip)) return json({ ok: false, error: '尝试次数过多，请 10 分钟后再试' }, 429);

  const username = String(creds.username || '').trim().toLowerCase();
  const password = String(creds.password != null ? creds.password : (creds.token || ''));

  if (!password) return json({ ok: false, error: '请输入密码 / 管理密钥' }, 400);

  // 管理员：用户名为空、或为 admin
  if (!username || username === 'admin') {
    const expected = getAdminToken(env);
    if (!expected || !(await safeEqual(password, expected, secret))) {
      loginFailed(ip);
      return json({ ok: false, error: '管理密钥错误' }, 401);
    }
    loginFails.delete(ip);
    return loginJson(env, ADMIN_UID, 'admin', true);
  }

  const user = await getUserByUsername(env, username);
  if (!user || user.status !== 'active' || !(await verifyPassword(password, user.salt, user.passwordHash))) {
    loginFailed(ip);
    return json({ ok: false, error: '用户名或密码错误' }, 401);
  }
  loginFails.delete(ip);
  try {
    await env.DB.prepare('UPDATE users SET last_login = ? WHERE id = ?').bind(new Date().toISOString(), user.id).run();
    clearUserCache();
  } catch (_) {}
  return loginJson(env, user.id, user.username, user.role === 'admin');
}

// ---- 注册（邀请码制）----
function makeInviteCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  const rnd = crypto.getRandomValues(new Uint8Array(10));
  for (let i = 0; i < 10; i++) s += alphabet[rnd[i] % alphabet.length];
  return s;
}

async function handleRegister(request, env) {
  if (!env.DB) return json({ ok: false, error: 'D1 数据库未绑定' }, 500);
  const secret = sessionSecret(env);
  if (!secret) return json({ ok: false, error: '未配置 ADMIN_TOKEN / SESSION_SECRET' }, 503);

  const data = await readJson(request) || {};
  const username = sanitizeUsername(data.username);
  const password = String(data.password || '');
  const code = String(data.invite || data.code || '').trim();
  // DNS 记录名固定为用户名，因此不再允许单独设置子域名
  const requestedSub = username;

  if (!username) return json({ ok: false, error: '用户名需为 3-32 位小写字母、数字或短横线，且不能以短横线开头/结尾' }, 400);
  if (password.length < 6) return json({ ok: false, error: '密码至少 6 位' }, 400);
  if (!code) return json({ ok: false, error: '请输入邀请码' }, 400);
  if (!requestedSub) return json({ ok: false, error: '用户名不能作为子域名，请更换' }, 400);
  const entryErr = entryNameError(env, requestedSub);
  if (entryErr) return json({ ok: false, error: entryErr }, 400);

  const invite = await env.DB.prepare('SELECT * FROM invite_codes WHERE code = ? OR UPPER(code) = ? LIMIT 1').bind(code, code.toUpperCase()).first();
  if (!invite) return json({ ok: false, error: '邀请码无效' }, 403);
  if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
    return json({ ok: false, error: '邀请码已过期' }, 403);
  }
  if (Number(invite.max_uses) > 0 && Number(invite.used_count) >= Number(invite.max_uses)) {
    return json({ ok: false, error: '邀请码使用次数已用完' }, 403);
  }

  const exists = await env.DB.prepare('SELECT 1 AS x FROM users WHERE username = ? OR (subdomain <> \'\' AND subdomain = ?)').bind(username, requestedSub).first();
  if (exists) return json({ ok: false, error: '用户名或子域名已被占用' }, 409);

  const salt = randomHex(16);
  const hash = await hashPassword(password, salt);
  const nowIso = new Date().toISOString();
  let batchOut = null;
  try {
    batchOut = await env.DB.batch([
      env.DB.prepare('INSERT INTO users (username, password_hash, salt, role, status, subdomain, route_limit, created_at, last_login) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(username, hash, salt, 'user', 'active', requestedSub, DEFAULT_USER_ROUTE_LIMIT, nowIso, nowIso),
      env.DB.prepare('UPDATE invite_codes SET used_count = used_count + 1 WHERE code = ? AND (max_uses = 0 OR used_count < max_uses)').bind(invite.code),
    ]);
  } catch (e) {
    return json({ ok: false, error: /UNIQUE/i.test(String(e?.message)) ? '用户名或子域名已被占用' : '注册失败，请稍后重试' }, 409);
  }
  // 并发注册时，邀请码可能刚好用完：撤销刚创建的用户，避免超发
  const usedNow = batchOut && batchOut[1] && batchOut[1].meta ? Number(batchOut[1].meta.changes) : 0;
  if (!usedNow) {
    try { await env.DB.prepare('DELETE FROM users WHERE username = ?').bind(username).run(); } catch (_) {}
    clearUserCache();
    return json({ ok: false, error: '邀请码使用次数已用完' }, 403);
  }

  clearUserCache();
  const user = await getUserByUsername(env, username);
  if (!user) return json({ ok: false, error: '注册成功但读取用户失败' }, 500);
  await auditLog(env, 'user.register', username + ' / ' + requestedSub);
  // 注册成功后自动创建 DNS 记录（CNAME → 优选域名，默认关闭小黄云）
  const dns = await provisionUserDns(env, user);
  return loginJson(env, user.id, user.username, user.role === 'admin',
    dns.ok ? { dns: { entryHost: dns.entryHost, target: dns.target, type: dns.type } } : { dnsWarning: dns.error });
}

// 用户名/子域名规范化
function sanitizeUsername(v) {
  const s = String(v || '').trim().toLowerCase();
  return USERNAME_RE.test(s) ? s : '';
}

function sanitizeSubdomain(v) {
  const s = String(v || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (!/^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$/.test(s)) return '';
  return s;
}

// 用户名/子域名同时作为入口主机名，不能与 Worker 主入口或系统保留名冲突
function entryNameError(env, name) {
  const s = String(name || '').trim().toLowerCase();
  if (!s) return '子域名不合法';
  if (RESERVED_SUBDOMAINS.has(s)) return '该用户名已被系统保留，请更换';
  const dns = getDnsRecordName(env);
  if (dns && s === dns) return '该用户名与 Worker 主入口重名，请更换';
  if (getStatsHost(env) && s === getStatsHost(env)) return '该用户名与统计入口重名，请更换';
  return '';
}

async function changePassword(request, env, session) {
  if (!session || session.uid === ADMIN_UID) return json({ ok: false, error: '管理员请直接修改 ADMIN_TOKEN' }, 400);
  const data = await readJson(request) || {};
  const oldPassword = String(data.oldPassword || data.old || '');
  const newPassword = String(data.newPassword || data.new || '');
  if (newPassword.length < 6) return json({ ok: false, error: '新密码至少 6 位' }, 400);
  const user = await getUserById(env, session.uid);
  if (!user || !(await verifyPassword(oldPassword, user.salt, user.passwordHash))) {
    return json({ ok: false, error: '原密码错误' }, 401);
  }
  const salt = randomHex(16);
  const hash = await hashPassword(newPassword, salt);
  await env.DB.prepare('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?').bind(hash, salt, user.id).run();
  clearUserCache();
  await auditLog(env, 'user.password', user.username);
  return json({ ok: true });
}

function logoutResponse() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Set-Cookie': `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict; Secure`,
      'Cache-Control': 'no-store',
    },
  });
}

// ---- 设置（存 D1 settings 表，30 秒内存缓存）----
const SETTING_KEYS = ['health_check', 'rate_limit_per_min', 'manual_redirect_domains', 'domain_proxy_rules', 'tg_daily_report'];
let settingsCache = { exp: 0, v: null };

async function getSettings(env) {
  const now = Date.now();
  if (settingsCache.v && settingsCache.exp > now) return settingsCache.v;
  const raw = {};
  if (env.DB) {
    try {
      const { results } = await env.DB.prepare('SELECT key, value FROM settings').all();
      for (const r of results || []) raw[r.key] = r.value;
    } catch (_) {}
  }
  let rules = {};
  try { rules = JSON.parse(raw.domain_proxy_rules || '{}') || {}; } catch (_) {}
  const v = {
    raw,
    healthCheck: raw.health_check === '1',
    rateLimitPerMin: Math.max(0, parseInt(raw.rate_limit_per_min || '0', 10) || 0),
    manualDomains: String(raw.manual_redirect_domains || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean),
    domainProxyRules: { ...DOMAIN_PROXY_RULES, ...rules },
  };
  settingsCache = { exp: now + 30000, v };
  return v;
}

async function setSetting(env, key, value) {
  await env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .bind(key, String(value)).run();
  settingsCache = { exp: 0, v: null };
}

// ---- 通知：Telegram（TG_BOT_TOKEN + TG_CHAT_ID）和/或 Webhook（NOTIFY_WEBHOOK）----
async function notify(env, text) {
  const jobs = [];
  const tgToken = getTelegramToken(env);
  const tgChat = getTelegramChatId(env);
  if (tgToken && tgChat) {
    jobs.push(fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: tgChat, text: String(text).slice(0, 4096), parse_mode: 'HTML', disable_web_page_preview: true }),
    }).catch(() => {}));
  }
  if (env.NOTIFY_WEBHOOK && isValidHttpUrl(env.NOTIFY_WEBHOOK)) {
    jobs.push(fetch(env.NOTIFY_WEBHOOK, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, content: text }),
    }).catch(() => {}));
  }
  await Promise.all(jobs);
}

// ---- 审计日志（只保留最近 500 条）----
async function auditLog(env, action, detail) {
  if (!env.DB) return;
  try {
    await env.DB.prepare('INSERT INTO audit_log (ts, action, detail) VALUES (?, ?, ?)')
      .bind(new Date().toISOString(), action, String(detail || '').slice(0, 500)).run();
    if (Math.random() < 0.05) {
      await env.DB.prepare('DELETE FROM audit_log WHERE id <= (SELECT MAX(id) - 500 FROM audit_log)').run();
    }
  } catch (_) {}
}

// ---- 上游探测（健康检查 / 路由连通性测试）----
async function probeTarget(target, timeoutMs = 6000) {
  const start = Date.now();
  try {
    const res = await fetch(target, {
      method: 'GET', redirect: 'manual',
      headers: { 'User-Agent': 'proxy-health-check' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    try { await res.body?.cancel(); } catch (_) {}
    return { ok: res.status < 500, status: res.status, ms: Date.now() - start };
  } catch (e) {
    return { ok: false, status: 0, ms: -1, error: String(e?.message || e).slice(0, 80) };
  }
}

// ---- 自定义请求头 / IP 访问控制 ----
const FORBIDDEN_CUSTOM_HEADERS = new Set(['host', 'content-length', 'connection', 'transfer-encoding', 'upgrade', 'te', 'keep-alive', 'proxy-authorization']);

function parseHeaderLines(text) {
  const out = []; let error = null;
  for (const line of String(text || '').split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    const i = t.indexOf(':');
    if (i <= 0) { error = '自定义请求头格式应为 Name: Value，每行一个'; break; }
    const k = t.slice(0, i).trim(); const v = t.slice(i + 1).trim();
    if (!/^[A-Za-z0-9-]+$/.test(k)) { error = '请求头名称不合法: ' + k; break; }
    if (FORBIDDEN_CUSTOM_HEADERS.has(k.toLowerCase())) { error = '不允许覆盖请求头: ' + k; break; }
    out.push([k, v]);
  }
  return { headers: out, error };
}

function parseIpList(text) {
  return String(text || '').split(/[\s,]+/).map(x => x.trim()).filter(Boolean);
}

function ipv4ToInt(ip) {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3];
}

function ipMatches(ip, list) {
  for (const item of list) {
    if (item === ip) return true;
    const m = item.match(/^(\d+\.\d+\.\d+\.\d+)\/(\d{1,2})$/);
    if (m && !ip.includes(':')) {
      const base = ipv4ToInt(m[1]); const cur = ipv4ToInt(ip); const bits = parseInt(m[2], 10);
      if (base == null || cur == null || bits > 32) continue;
      const mask = bits === 0 ? 0 : (0xFFFFFFFF << (32 - bits)) >>> 0;
      if ((base & mask) >>> 0 === (cur & mask) >>> 0) return true;
    }
  }
  return false;
}

function validIpList(list) {
  return list.every(x => /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/.test(x) || /^[0-9a-fA-F:]+$/.test(x));
}

// ---- 全局按 IP 限速（可选，单 isolate 内的尽力而为）----
const rateMap = new Map();
function rateLimited(ip, limit) {
  if (!limit) return false;
  const now = Date.now();
  const rec = rateMap.get(ip);
  if (!rec || now - rec.start > 60000) { rateMap.set(ip, { start: now, n: 1 }); }
  else { rec.n++; if (rec.n > limit) return true; }
  if (rateMap.size > 20000) for (const [k, v] of rateMap) if (now - v.start > 60000) rateMap.delete(k);
  return false;
}

// ---- 公开接口短缓存，避免被刷导致子请求/配额放大 ----
async function cachedJson(request, key, ttlSec, producer) {
  const cache = caches.default;
  const ck = new Request('https://cache.internal/' + key);
  try {
    const hit = await cache.match(ck);
    if (hit) return new Response(hit.body, hit);
  } catch (_) {}
  const res = await producer();
  try {
    const copy = new Response(res.clone().body, res);
    copy.headers.set('Cache-Control', 'public, max-age=' + ttlSec);
    await cache.put(ck, copy);
  } catch (_) {}
  return res;
}

// ---- 直连代理目标校验：拦截内网/保留地址，可选白名单 ----
function isPrivateHost(h) {
  h = String(h || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (!h || h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(h)) {
    const [a, b] = h.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
  }
  if (h.includes(':')) return h === '::1' || h === '::' || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80');
  return false;
}

function directProxyAllowed(env, hostname) {
  if (String(env.DISABLE_DIRECT_PROXY || '') === '1') return false;
  if (isPrivateHost(hostname)) return false;
  const list = String(env.DIRECT_PROXY_ALLOW || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
  if (!list.length) return true;
  const h = hostname.toLowerCase();
  return list.some(d => h === d || h.endsWith('.' + d));
}

function isValidHttpUrl(u) {
  try { const x = new URL(u); return x.protocol === 'http:' || x.protocol === 'https:'; } catch { return false; }
}

function getClientCacheKey(request) {
  const ip = request.headers.get('cf-connecting-ip') || '0.0.0.0';
  const cf = request.cf || {};
  let ipKey = ip;
  if (ip.includes('.')) ipKey = ip.split('.').slice(0, 3).join('.');
  else if (ip.includes(':')) ipKey = ip.split(':').slice(0, 4).join(':');
  return `${cf.country || 'XX'}|${cf.city || ''}|${cf.asn || ''}|${ipKey}`;
}

async function initDatabase(env) {
  if (!env.DB || dbReady) return;
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS routes (
      prefix TEXT PRIMARY KEY, target TEXT NOT NULL,
      remark TEXT DEFAULT '', last_play TEXT DEFAULT '',
      cache_img TEXT DEFAULT 'on', compat_mode TEXT DEFAULT 'off',
      ip_mode TEXT DEFAULT 'forward',
      sort_order INTEGER DEFAULT 0,
      created_by TEXT NOT NULL DEFAULT ''
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
    // 新增：小时级聚合统计（参考 CF-EMBY-PROXY-UI proxy_stats_hourly）
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS proxy_stats_hourly (
      bucket_date TEXT NOT NULL,
      bucket_hour INTEGER NOT NULL,
      request_count INTEGER NOT NULL DEFAULT 0,
      play_count INTEGER NOT NULL DEFAULT 0,
      playback_info_count INTEGER NOT NULL DEFAULT 0,
      traffic_bytes INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (bucket_date, bucket_hour)
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT '')`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS route_health (
      prefix TEXT NOT NULL, target TEXT NOT NULL,
      down INTEGER NOT NULL DEFAULT 0, fail_count INTEGER NOT NULL DEFAULT 0,
      latency INTEGER NOT NULL DEFAULT -1, last_check TEXT, last_change TEXT,
      PRIMARY KEY (prefix, target)
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS route_stats_daily (
      prefix TEXT NOT NULL, bucket_date TEXT NOT NULL,
      request_count INTEGER NOT NULL DEFAULT 0, traffic_bytes INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (prefix, bucket_date)
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL, action TEXT NOT NULL, detail TEXT NOT NULL DEFAULT ''
    )`),
    // ===== 多人版 =====
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      status TEXT NOT NULL DEFAULT 'active',
      subdomain TEXT NOT NULL DEFAULT '',
      route_limit INTEGER NOT NULL DEFAULT 20,
      created_at TEXT NOT NULL DEFAULT '',
      last_login TEXT NOT NULL DEFAULT ''
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS invite_codes (
      code TEXT PRIMARY KEY,
      max_uses INTEGER NOT NULL DEFAULT 1,
      used_count INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      created_by TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT ''
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS user_routes (
      owner TEXT NOT NULL,
      prefix TEXT NOT NULL,
      target TEXT NOT NULL,
      remark TEXT DEFAULT '',
      last_play TEXT DEFAULT '',
      cache_img TEXT DEFAULT 'on',
      compat_mode TEXT DEFAULT 'off',
      ip_mode TEXT DEFAULT 'forward',
      sort_order INTEGER DEFAULT 0,
      enabled INTEGER NOT NULL DEFAULT 1,
      custom_headers TEXT NOT NULL DEFAULT '',
      ip_allow TEXT NOT NULL DEFAULT '',
      ip_block TEXT NOT NULL DEFAULT '',
      PRIMARY KEY (owner, prefix)
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS user_stats_hourly (
      owner TEXT NOT NULL,
      bucket_date TEXT NOT NULL,
      bucket_hour INTEGER NOT NULL,
      request_count INTEGER NOT NULL DEFAULT 0,
      play_count INTEGER NOT NULL DEFAULT 0,
      playback_info_count INTEGER NOT NULL DEFAULT 0,
      traffic_bytes INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (owner, bucket_date, bucket_hour)
    )`),
  ]);
  
  try {
    await env.DB.prepare(`ALTER TABLE routes ADD COLUMN ip_mode TEXT DEFAULT 'forward'`).run();
  } catch (e) {}
  // 多人版补列 / 索引
  try { await env.DB.prepare(`ALTER TABLE users ADD COLUMN subdomain TEXT NOT NULL DEFAULT ''`).run(); } catch (e) {}
  try { await env.DB.prepare(`ALTER TABLE users ADD COLUMN route_limit INTEGER NOT NULL DEFAULT 20`).run(); } catch (e) {}
  try { await env.DB.prepare(`ALTER TABLE users ADD COLUMN last_login TEXT NOT NULL DEFAULT ''`).run(); } catch (e) {}
  try { await env.DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_subdomain ON users(subdomain) WHERE subdomain <> ''`).run(); } catch (e) {}
  // 老库 invite_codes 可能缺列（早期多人版只有 code/max_uses/used_count）
  for (const col of [
    `max_uses INTEGER NOT NULL DEFAULT 1`,
    `used_count INTEGER NOT NULL DEFAULT 0`,
    `expires_at TEXT NOT NULL DEFAULT ''`,
    `note TEXT NOT NULL DEFAULT ''`,
    `created_by TEXT NOT NULL DEFAULT ''`,
    `created_at TEXT NOT NULL DEFAULT ''`,
  ]) {
    try { await env.DB.prepare(`ALTER TABLE invite_codes ADD COLUMN ${col}`).run(); } catch (e) {}
  }
  try { await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_user_routes_owner ON user_routes(owner)`).run(); } catch (e) {}
  try { await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_user_stats_owner ON user_stats_hourly(owner, bucket_date)`).run(); } catch (e) {}
  for (const col of [
    `enabled INTEGER NOT NULL DEFAULT 1`,
    `custom_headers TEXT NOT NULL DEFAULT ''`,
    `ip_allow TEXT NOT NULL DEFAULT ''`,
    `ip_block TEXT NOT NULL DEFAULT ''`,
    // 路由归属：记录是哪个管理员添加的。老数据为空字符串，视为「历史路由」，
    // 仍在代理链路里生效，但不会出现在任何管理员的「我的路由」里。
    `created_by TEXT NOT NULL DEFAULT ''`,
  ]) {
    try { await env.DB.prepare(`ALTER TABLE routes ADD COLUMN ${col}`).run(); } catch (e) {}
  }
  try { await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_routes_created_by ON routes(created_by)`).run(); } catch (e) {}

  // 老库（如从单用户版升级）的 routes 表带 user_id 字段：按 user_id 恢复真实归属，
  // 避免所有路由都被算到 admin 名下。只执行一次。
  try {
    let hasUserId = false;
    try {
      await env.DB.prepare('SELECT user_id FROM routes LIMIT 1').first();
      hasUserId = true;
    } catch (_) {}
    if (hasUserId) {
      const done = await env.DB.prepare("SELECT value FROM settings WHERE key = 'route_owner_from_user_id_v1'").first();
      if (!done) {
        await env.DB.prepare(
          `UPDATE routes
              SET created_by = COALESCE((SELECT username FROM users WHERE users.id = routes.user_id), '')
            WHERE user_id IS NOT NULL AND user_id <> '' AND CAST(user_id AS INTEGER) > 0`
        ).run();
        await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('route_owner_from_user_id_v1', '1') ON CONFLICT(key) DO UPDATE SET value = '1'").run();
      }
    }
  } catch (e) {}

  try {
    await env.DB.prepare(`DELETE FROM optimized_domains WHERE domain = 'www.visa.cn' AND is_builtin = 1`).run();
  } catch (e) {}
  // 兼容老表补列
  try { await env.DB.prepare(`ALTER TABLE proxy_stats_hourly ADD COLUMN traffic_bytes INTEGER NOT NULL DEFAULT 0`).run(); } catch (e) {}
  try { await env.DB.prepare(`ALTER TABLE proxy_stats_hourly ADD COLUMN play_count INTEGER NOT NULL DEFAULT 0`).run(); } catch (e) {}
  try { await env.DB.prepare(`ALTER TABLE proxy_stats_hourly ADD COLUMN playback_info_count INTEGER NOT NULL DEFAULT 0`).run(); } catch (e) {}
  
  try {
    const { results } = await env.DB.prepare('SELECT COUNT(*) as count FROM optimized_domains').all();
    if (results[0].count === 0) {
      const stmt = env.DB.prepare('INSERT INTO optimized_domains (domain, name, is_builtin) VALUES (?, ?, 1)');
      for (const d of DEFAULT_OPTIMIZED_DOMAINS) {
        try {
          await stmt.bind(d.domain, d.name).run();
        } catch (e) {}
      }
    }
  } catch (e) {}
  
  dbReady = true;
}

async function getOptimizedDomains(env) {
  const { results } = await env.DB.prepare('SELECT * FROM optimized_domains ORDER BY is_builtin DESC, name ASC').all();
  return results.map(r => ({
    id: r.id,
    domain: r.domain,
    name: r.name,
    isBuiltin: Boolean(r.is_builtin),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

async function addOptimizedDomain(env, domain, name) {
  const result = await env.DB.prepare('INSERT INTO optimized_domains (domain, name, is_builtin) VALUES (?, ?, 0)')
    .bind(domain, name)
    .run();
  return result.success;
}

function normalizeDomain(v) {
  const d = String(v || '').trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
  return /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(d) ? d : '';
}

async function updateOptimizedDomain(env, id, domain, name) {
  const result = await env.DB.prepare('UPDATE optimized_domains SET domain = ?, name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND is_builtin = 0')
    .bind(domain, name, id)
    .run();
  return Boolean(result.meta && result.meta.changes);
}

async function deleteOptimizedDomain(env, id) {
  const result = await env.DB.prepare('DELETE FROM optimized_domains WHERE id = ? AND is_builtin = 0')
    .bind(id)
    .run();
  return Boolean(result.meta && result.meta.changes);
}

async function getDNSConfig(env) {
  const { results } = await env.DB.prepare('SELECT * FROM dns_config ORDER BY id DESC LIMIT 1').all();
  if (results.length > 0) {
    return {
      id: results[0].id,
      dnsName: results[0].dns_name,
      currentDomain: results[0].current_domain,
      zoneId: results[0].zone_id,
      createdAt: results[0].created_at,
      updatedAt: results[0].updated_at,
    };
  }
  return null;
}

async function saveDNSConfig(env, dnsName, currentDomain, zoneId) {
  const existing = await getDNSConfig(env);
  let result;
  if (existing) {
    result = await env.DB.prepare('UPDATE dns_config SET dns_name = ?, current_domain = ?, zone_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind(dnsName, currentDomain || '', zoneId || '', existing.id)
      .run();
  } else {
    result = await env.DB.prepare('INSERT INTO dns_config (dns_name, current_domain, zone_id) VALUES (?, ?, ?)')
      .bind(dnsName, currentDomain || '', zoneId || '')
      .run();
  }
  return result.success;
}

async function cloudflareAPICall(env, method, endpoint, body = null) {
  const apiToken = getCFApiToken(env);
  const zoneId = env.CF_ZONE_ID;
  const accountId = env.CF_ACCOUNT_ID;
  const dnsRecordName = env.DNS_RECORD_NAME;
  
  if (!apiToken) {
    return { success: false, error: 'CF_API_TOKEN not configured' };
  }
  
  const url = `https://api.cloudflare.com/client/v4${endpoint}`;
  const headers = {
    'Authorization': 'Bearer ' + apiToken,
    'Content-Type': 'application/json',
  };
  
  const options = {
    method,
    headers,
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  try {
    const response = await fetch(url, options);
    const data = await response.json();
    return data;
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function getZones(env) {
  const accountId = env.CF_ACCOUNT_ID;
  const endpoint = accountId ? '/zones?per_page=50&account.id=' + accountId : '/zones?per_page=50';
  return await cloudflareAPICall(env, 'GET', endpoint);
}

async function getDNSRecords(env, zoneId) {
  return await cloudflareAPICall(env, 'GET', `/zones/${zoneId}/dns_records?per_page=100`);
}

// 自动识别记录类型：IPv4 → A，IPv6 → AAAA，其他 → CNAME
function detectRecordType(content) {
  const v = String(content || '').trim();
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(v)) return 'A';
  if (v.includes(':') && /^[0-9a-fA-F:]+$/.test(v)) return 'AAAA';
  return 'CNAME';
}

async function createOrUpdateDNSRecord(env, zoneId, dnsName, targetDomain, rootDomain, opts = {}) {
  if (!zoneId) zoneId = env.CF_ZONE_ID;
  const baseDomain = rootDomain || getBaseDomain(env) || '';
  const rawName = String(dnsName || '').trim().replace(/^\.+|\.+$/g, '');
  const recordHost = rawName === '@' ? baseDomain : rawName;
  const fullDNSName = recordHost === baseDomain ? baseDomain
    : ((baseDomain && !recordHost.endsWith('.' + baseDomain)) ? `${recordHost}.${baseDomain}` : recordHost);

  const recordsResult = await getDNSRecords(env, zoneId);
  if (!recordsResult.success) {
    return recordsResult;
  }

  const recordType = detectRecordType(targetDomain);
  const proxied = opts.proxied === true;

  const recordData = {
    type: recordType,
    name: fullDNSName,
    content: targetDomain,
    ttl: 1,
    proxied: recordType === 'CNAME' || recordType === 'A' || recordType === 'AAAA' ? proxied : false,
  };

  const sameType = recordsResult.result.filter(r => r.name === fullDNSName && ['A', 'AAAA', 'CNAME'].includes(r.type));
  if (!opts.forceRecreate && sameType.length === 1 && sameType[0].type === recordType) {
    // 类型相同：原地 PUT 更新，避免"先删后建"造成的解析空窗
    const upd = await cloudflareAPICall(env, 'PUT', `/zones/${zoneId}/dns_records/${sameType[0].id}`, recordData);
    if (upd.success) {
      if (opts.saveConfig !== false) await saveDNSConfig(env, dnsName, targetDomain, zoneId);
      return upd;
    }
  }

  // 先删除同名的 A/AAAA/CNAME 旧记录（避免互相冲突）；TXT/MX 等其他类型保持不动
  const oldRecords = recordsResult.result.filter(r => r.name === fullDNSName && ['A', 'AAAA', 'CNAME'].includes(r.type));
  for (const old of oldRecords) {
    const delResult = await cloudflareAPICall(env, 'DELETE', `/zones/${zoneId}/dns_records/${old.id}`);
    if (!delResult.success) {
      return { success: false, error: '删除旧记录失败: ' + (delResult.errors?.[0]?.message || '未知错误') };
    }
  }

  // 创建新记录；若失败则回滚，尽量恢复被删除的原记录
  let result = await cloudflareAPICall(env, 'POST', `/zones/${zoneId}/dns_records`, recordData);
  if (!result.success) {
    const rollbackFailed = [];
    for (const old of oldRecords) {
      const rb = await cloudflareAPICall(env, 'POST', `/zones/${zoneId}/dns_records`, {
        type: old.type, name: old.name, content: old.content, ttl: old.ttl || 1, proxied: Boolean(old.proxied),
      });
      if (!rb.success) rollbackFailed.push(old.name + ' (' + old.type + ')');
    }
    let errMsg = result.errors?.[0]?.message || '创建新记录失败';
    if (rollbackFailed.length) {
      errMsg += '；回滚失败，以下原记录未能恢复，请手动处理: ' + rollbackFailed.join(', ');
    } else if (oldRecords.length) {
      errMsg += '（原记录已自动恢复）';
    }
    return { success: false, error: errMsg, errors: result.errors };
  }

  if (opts.saveConfig !== false) await saveDNSConfig(env, dnsName, targetDomain, zoneId);
  return result;
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

function escapeLike(s) {
  // 用户名允许下划线，而 _ 是 LIKE 通配符；用 ! 作为转义符避免误匹配
  return String(s || '').replace(/[!%_]/g, ch => '!' + ch);
}

async function getD1Stats(env, dateKey, owner = '') {
  const empty = { requests: 0, plays: 0, playbackInfo: 0, traffic: 0, hourly: new Array(24).fill(0), routes: [] };
  if (!env.DB) return empty;
  try {
    if (owner) {
      // 用户维度：小时数据来自 user_stats_hourly；路由排行来自 route_stats_daily 的 owner/prefix
      const totals = await env.DB.prepare(
        `SELECT COALESCE(SUM(request_count),0) AS requests,
                COALESCE(SUM(play_count),0) AS plays,
                COALESCE(SUM(playback_info_count),0) AS info,
                COALESCE(SUM(traffic_bytes),0) AS traffic
         FROM user_stats_hourly WHERE owner = ? AND bucket_date = ?`
      ).bind(owner, dateKey).first();
      const hourly = await env.DB.prepare(
        `SELECT bucket_hour AS hour,
                COALESCE(SUM(request_count),0) AS requests,
                COALESCE(SUM(traffic_bytes),0) AS traffic
         FROM user_stats_hourly WHERE owner = ? AND bucket_date = ? GROUP BY bucket_hour`
      ).bind(owner, dateKey).all();
      const routes = await env.DB.prepare(
        `SELECT prefix,
                COALESCE(SUM(request_count),0) AS requests,
                COALESCE(SUM(traffic_bytes),0) AS traffic
         FROM route_stats_daily WHERE bucket_date = ? AND prefix LIKE ? ESCAPE '!' GROUP BY prefix ORDER BY requests DESC LIMIT 12`
      ).bind(dateKey, escapeLike(owner) + '/%').all();
      const h = new Array(24).fill(0);
      for (const r of hourly.results || []) {
        const i = Number(r.hour);
        if (i >= 0 && i < 24) h[i] += Number(r.requests) || 0;
      }
      return {
        requests: Number(totals?.requests) || 0,
        plays: Number(totals?.plays) || 0,
        playbackInfo: Number(totals?.info) || 0,
        traffic: Number(totals?.traffic) || 0,
        hourly: h,
        routes: (routes.results || []).map(r => ({
          prefix: String(r.prefix || '').startsWith(owner + '/') ? String(r.prefix).slice(owner.length + 1) : (r.prefix || ''),
          requests: Number(r.requests) || 0,
          traffic: Number(r.traffic) || 0,
        })),
      };
    }

    const totals = await env.DB.prepare(
      `SELECT COALESCE(SUM(request_count),0) AS requests,
              COALESCE(SUM(play_count),0) AS plays,
              COALESCE(SUM(playback_info_count),0) AS info,
              COALESCE(SUM(traffic_bytes),0) AS traffic
       FROM proxy_stats_hourly WHERE bucket_date = ?`
    ).bind(dateKey).first();
    const hourly = await env.DB.prepare(
      `SELECT bucket_hour AS hour,
              COALESCE(SUM(request_count),0) AS requests,
              COALESCE(SUM(traffic_bytes),0) AS traffic
       FROM proxy_stats_hourly WHERE bucket_date = ? GROUP BY bucket_hour`
    ).bind(dateKey).all();
    const routes = await env.DB.prepare(
      `SELECT prefix,
              COALESCE(SUM(request_count),0) AS requests,
              COALESCE(SUM(traffic_bytes),0) AS traffic
       FROM route_stats_daily WHERE bucket_date = ? AND instr(prefix, '/') = 0
       GROUP BY prefix ORDER BY requests DESC LIMIT 12`
    ).bind(dateKey).all();
    const h = new Array(24).fill(0);
    for (const r of hourly.results || []) {
      const i = Number(r.hour);
      if (i >= 0 && i < 24) h[i] += Number(r.requests) || 0;
    }
    return {
      requests: Number(totals?.requests) || 0,
      plays: Number(totals?.plays) || 0,
      playbackInfo: Number(totals?.info) || 0,
      traffic: Number(totals?.traffic) || 0,
      hourly: h,
      routes: (routes.results || []).map(r => ({ prefix: r.prefix || '', requests: Number(r.requests) || 0, traffic: Number(r.traffic) || 0 })),
    };
  } catch (e) {
    console.error('getD1Stats failed:', e?.message);
    return empty;
  }
}

async function getD1DailySeries(env, days = 7, owner = '') {
  if (!env.DB) return [];
  const today = getShanghaiParts().dateKey;
  const start = new Date(new Date(today + 'T00:00:00Z').getTime() - (days - 1) * 86400000).toISOString().slice(0, 10);
  try {
    const { results } = owner
      ? await env.DB.prepare(
          `SELECT bucket_date AS date,
                  COALESCE(SUM(request_count),0) AS requests,
                  COALESCE(SUM(play_count),0) AS plays,
                  COALESCE(SUM(traffic_bytes),0) AS traffic
           FROM user_stats_hourly WHERE owner = ? AND bucket_date >= ? AND bucket_date <= ?
           GROUP BY bucket_date ORDER BY bucket_date`
        ).bind(owner, start, today).all()
      : await env.DB.prepare(
          `SELECT bucket_date AS date,
                  COALESCE(SUM(request_count),0) AS requests,
                  COALESCE(SUM(play_count),0) AS plays,
                  COALESCE(SUM(traffic_bytes),0) AS traffic
           FROM proxy_stats_hourly WHERE bucket_date >= ? AND bucket_date <= ?
           GROUP BY bucket_date ORDER BY bucket_date`
        ).bind(start, today).all();
    const map = new Map((results || []).map(r => [r.date, r]));
    const out = [];
    for (let i = 0; i < days; i++) {
      const key = new Date(new Date(start + 'T00:00:00Z').getTime() + i * 86400000).toISOString().slice(0, 10);
      const r = map.get(key);
      out.push({ date: key, requests: Number(r?.requests) || 0, plays: Number(r?.plays) || 0, traffic: Number(r?.traffic) || 0 });
    }
    return out;
  } catch (_) {
    return [];
  }
}

async function handleStatsRequest(env, url, opts = {}) {
  if (!env.DB) return json({ error: 'D1 数据库未绑定', data: null });

  const owner = String(opts.owner || '').toLowerCase();
  const dateParam = url.searchParams.get('date') || '';
  const dateKey = /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : getShanghaiParts().dateKey;

  // 把内存里还没落库的统计先刷进 D1，避免刚发生的请求不出现在页面上
  try { await flushHourlyStats(env); } catch (_) {}

  const d1 = await getD1Stats(env, dateKey, owner);
  // 用户只展示自己的 D1 数据，不查询整个账号，避免越权看到其他用户/站点数据
  const workerHosts = owner ? null : await getWorkerHosts(env);
  // 主口径：CF 账号分析（覆盖 fd + 所有用户子域名，带宽为真实出站字节）
  const acc = owner ? { error: '' } : await cfGetAccountSummary(env, dateKey, workerHosts);
  const accOk = !owner && !acc.error;
  // 账号分析不可用时退回 Zone 级（仅主域名）
  const cf = owner || accOk ? { error: '' } : await cfGetZoneSummary(env, dateKey);
  const worker = owner ? { error: '' } : await cfGetWorkerSummary(env, dateKey);

  const cfOk = !owner && !accOk && !cf.error;
  const statsSource = owner ? 'd1' : (accOk ? 'account' : (cfOk ? 'zone' : 'd1'));
  const trafficBytes = accOk ? (Number(acc.bytes) || 0) : (cfOk ? (Number(cf.bytes) || 0) : (d1.traffic || 0));
  const requests = accOk ? (Number(acc.requests) || 0) : (cfOk ? (Number(cf.requests) || 0) : (d1.requests || 0));
  const visits = accOk ? (Number(acc.visits) || 0) : (cfOk ? (Number(cf.visits) || 0) : null);

  const hourly = accOk ? acc.hourly : (cfOk ? cf.hourly : null);
  const hourlySeries = Array.from({ length: 24 }, (_, h) => ({
    label: String(h).padStart(2, '0') + ':00',
    total: hourly ? (hourly[h] || 0) : (d1.hourly[h] || 0),
    d1: d1.hourly[h] || 0,
    cf: hourly ? hourly[h] : 0,
  }));

  let dailySeries = [];
  if (accOk) {
    const s = await cfGetAccountDailySeries(env, 7, workerHosts);
    if (!s.error && Array.isArray(s.series)) dailySeries = s.series;
  }
  if (!dailySeries.some(d => Number(d.requests) > 0)) dailySeries = await getD1DailySeries(env, 7, owner);
  const zoneInfo = owner ? { zoneId: '', zoneName: '', from: '' } : await resolveZoneInfo(env);
  const tgReady = Boolean(getTelegramToken(env) && getTelegramChatId(env));

  return json({
    error: null,
    data: {
      date: dateKey,
      scope: owner ? 'user' : 'global',
      owner,
      todayRequests: requests,
      todayTraffic: formatBytes(trafficBytes),
      todayTrafficBytes: trafficBytes,
      todayVisits: visits,
      plays: d1.plays,
      playbackInfo: d1.playbackInfo,
      d1: { requests: d1.requests, trafficBytes: d1.traffic, plays: d1.plays, playbackInfo: d1.playbackInfo },
      account: accOk
        ? { requests: Number(acc.requests) || 0, trafficBytes: Number(acc.bytes) || 0, visits: Number(acc.visits) || 0, accountId: acc.accountId, hostMatched: acc.hostMatched, note: acc.note || '', warning: acc.warning || '' }
        : { error: acc.error || '' },
      cf: cfOk
        ? { requests: Number(cf.requests) || 0, trafficBytes: Number(cf.bytes) || 0, visits: Number(cf.visits) || 0, zoneId: cf.zoneId, zoneName: cf.zoneName, hostMatched: cf.hostMatched, note: cf.note || '', warning: cf.warning || '' }
        : { error: cf.error },
      worker: worker.error ? { error: worker.error } : { requests: Number(worker.requests) || 0, byScript: worker.byScript || {} },
      hourlySeries,
      dailySeries,
      topRoutes: d1.routes,
      statsSource,
      cfStatus: owner ? 'D1 统计（用户维度）'
        : (accOk ? (acc.hostMatched === false ? 'CF 账号分析（账号总量）' : 'CF 账号分析（全站）')
          : (cfOk ? (cf.hostMatched ? 'CF Zone 统计' : 'CF Zone 统计（全 Zone）') : 'D1 统计（账号分析不可用）')),
      cfError: owner ? '' : (accOk || cfOk ? '' : (acc.error || cf.error)),
      envInfo: {
        baseDomain: getBaseDomain(env),
        statsHost: getStatsHost(env),
        zoneId: zoneInfo.zoneId || '',
        zoneSource: zoneInfo.from || '',
        hasCfToken: Boolean(getCFApiToken(env)),
        telegramConfigured: tgReady,
        telegramTokenVar: getTelegramToken(env) ? '已读取' : '未读取',
        telegramChatVar: getTelegramChatId(env) ? '已读取' : '未读取',
      },
      source: owner ? 'D1' : (accOk ? 'CF 账号分析' : (cfOk ? 'CF Zone' : 'D1')),
      lastUpdated: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
    },
  });
}

function normalizePrefix(p) {
  return String(p || '').trim().toLowerCase().replace(/^\/+|\/+$/g, '');
}

// 支持逗号、换行、空格分隔（后台输入框已改成一行一个）
function splitTargets(raw) {
  return String(raw == null ? '' : raw).split(/[\r\n,]+/).map(x => x.trim()).filter(Boolean);
}

function normalizeDnsTarget(v) {
  let s = String(v == null ? '' : v).trim();
  s = s.replace(/^https?:\/\//i, '').split('/')[0].split('?')[0].split('#')[0];
  return s.replace(/^\.+|\.+$/g, '').toLowerCase();
}

function validatePrefix(prefix) {
  const a = normalizePrefix(prefix);
  if (!a || !/^[a-z0-9][a-z0-9_-]{0,62}$/i.test(a)) return '路径仅允许字母数字、下划线和连字符';
  if (RESERVED_ALIASES.has(a.toLowerCase())) return '该路径为系统保留，不可使用';
  return null;
}

function validateUserPrefix(prefix) {
  const a = normalizePrefix(prefix);
  if (!a || !/^[a-z0-9][a-z0-9_-]{0,62}$/i.test(a)) return '路径仅允许字母数字、下划线和连字符';
  // 用户路由允许 /emby、/web 这类名字（全局路由才保留这些别名），只挡系统接口路径
  if (RESERVED_PREFIXES.has(a.toLowerCase())) return '该路径为系统保留，不可使用';
  return null;
}

// 从访问域名解析用户：alice.example.com -> alice；主入口域名 / 未知子域名 -> ''（走全局路由）
// 支持三级及更深的域名：用户入口是 用户名.用户域名，用户域名由变量自动推导
// 子域名可能和用户名不同，所以这里要把 subdomain 映射回 username（路由/统计都以 username 为 owner）
const ownerCache = new Map();

function clearOwnerCache() { ownerCache.clear(); }

async function resolveOwnerFromHost(env, host) {
  const h = String(host || '').toLowerCase().replace(/:\d+$/, '');
  const base = getBaseDomain(env);
  const userDomain = getUserDomain(env);
  if (!h) return '';
  if (h === base || h === userDomain) return '';
  const dnsName = getDnsRecordName(env);
  if (dnsName && h === toFqdn(dnsName, base)) return '';
  if (h === getStatsHost(env)) return '';

  // 用户域名优先，BASE_DOMAIN 作为兼容回退（老记录 alice.fd.example.com）
  const zones = [];
  if (userDomain) zones.push(userDomain);
  if (base && base !== userDomain) zones.push(base);

  let sub = '';
  for (const z of zones) {
    if (h === z) return '';
    if (!h.endsWith('.' + z)) continue;
    const cand = h.slice(0, -(z.length + 1));
    if (cand && !cand.includes('.') && !RESERVED_SUBDOMAINS.has(cand)) { sub = cand; break; }
  }
  const lookupOwner = async (name) => {
    if (!env.DB) return '';
    try {
      const row = await env.DB.prepare("SELECT username FROM users WHERE (subdomain = ? OR username = ?) AND status = 'active'").bind(name, name).first();
      return row && row.username ? row.username : '';
    } catch (_) { return ''; }
  };

  const now = Date.now();
  const cacheKey = sub || h;
  const hit = ownerCache.get(cacheKey);
  if (hit && hit.exp > now) return hit.owner;

  let owner = '';
  if (sub) {
    // 配置域名下的入口：优先映射到真实用户名，没有记录时沿用子域名本身
    owner = (await lookupOwner(sub)) || sub;
  } else {
    // 通用回退：任意域名下的一级主机名，只要能匹配到已注册用户就归为该用户。
    // 这样换域名 / 多域名 / 三级域名都不用改代码，也不依赖固定的域名后缀。
    const first = h.split('.')[0] || '';
    if (!first || RESERVED_SUBDOMAINS.has(first)) return '';
    owner = await lookupOwner(first);
    if (!owner) return '';
  }
  if (ownerCache.size > 500) ownerCache.clear();
  ownerCache.set(cacheKey, { owner, exp: now + 60000 });
  return owner;
}

async function readJson(request) {
  try { return await request.json(); } catch { return null; }
}

async function handleAdminApi(request, env, url, session) {
  // 当前管理员身份：token 登录固定为 admin；角色为 admin 的普通账号用自己的用户名
  const adminActor = String(session?.username || 'admin');
  if (url.pathname === '/admin/api/logout' && request.method === 'POST') return logoutResponse();
  if (!(await isAdmin(request, env))) return new Response('Unauthorized', { status: 401 });

  // 简单的同源校验，防 CSRF（Cookie 已是 SameSite=Strict，这里是第二道防线）
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const origin = request.headers.get('Origin');
    if (origin && origin !== url.origin) return json({ error: 'Forbidden origin' }, 403);
  }

  if (url.pathname === '/admin/api/report/send' && request.method === 'POST') {
    const out = await sendDailyReport(env, url.searchParams.get('date') || '');
    await auditLog(env, 'report.send', out.ok ? 'ok' : ('fail: ' + (out.telegram.rawError || out.telegram.error || out.webhook.error || 'unknown')));
    return json({
      success: out.ok,
      date: out.date,
      telegram: out.telegram,
      webhook: out.webhook,
      preview: out.text,
      hint: out.ok ? '' : reportFailureHint(env, out),
    }, out.ok ? 200 : 502);
  }

  if (url.pathname === '/admin/api/stats' && request.method === 'GET') {
    // 管理员只统计全局/公共数据：不接受 owner 参数，避免查看某个用户的路由明细
    return handleStatsRequest(env, url);
  }

  if (url.pathname === '/admin/api/settings') {
    if (request.method === 'GET') {
      const st = await getSettings(env);
      return json({
        success: true,
        settings: st.raw,
        notify: {
          telegram: Boolean(getTelegramToken(env) && getTelegramChatId(env)),
          webhook: Boolean(env.NOTIFY_WEBHOOK),
          tokenVar: getTelegramToken(env) ? '已读取' : '未读取',
          chatVar: getTelegramChatId(env) ? '已读取' : '未读取',
        },
      });
    }
    if (request.method === 'POST') {
      const data = await readJson(request) || {};
      if (data.domain_proxy_rules) {
        try { const o = JSON.parse(data.domain_proxy_rules); if (!o || typeof o !== 'object' || Array.isArray(o)) throw 0; }
        catch { return json({ error: '域名映射规则必须是 JSON 对象，例如 {"example.com":"1.2.3.4"}' }, 400); }
      }
      for (const k of SETTING_KEYS) if (k in data) await setSetting(env, k, data[k] ?? '');
      await auditLog(env, 'settings', Object.keys(data).filter(k => SETTING_KEYS.includes(k)).join(','));
      return json({ success: true });
    }
  }

  if (url.pathname === '/admin/api/audit' && request.method === 'GET') {
    const { results } = await env.DB.prepare('SELECT ts, action, detail FROM audit_log ORDER BY id DESC LIMIT 100').all();
    return json({ success: true, logs: results || [] });
  }

  if (url.pathname === '/admin/api/export' && request.method === 'GET') {
    // 只导出当前管理员自己添加的路由，避免把其他管理员/历史路由带出去
    const routes = (await env.DB.prepare('SELECT prefix, target, remark, cache_img, compat_mode, ip_mode, sort_order, enabled, custom_headers, ip_allow, ip_block FROM routes WHERE created_by = ? ORDER BY sort_order, prefix').bind(adminActor).all()).results || [];
    const domains = (await env.DB.prepare('SELECT domain, name FROM optimized_domains WHERE is_builtin = 0').all()).results || [];
    const st = await getSettings(env);
    const body = JSON.stringify({ version: CURRENT_VERSION, exportedAt: new Date().toISOString(), routes, domains, settings: st.raw }, null, 2);
    return new Response(body, { headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': 'attachment; filename="proxy-config-' + new Date().toISOString().slice(0, 10) + '.json"',
      'Cache-Control': 'no-store',
    } });
  }

  if (url.pathname === '/admin/api/import' && request.method === 'POST') {
    const data = await readJson(request);
    if (!data || typeof data !== 'object') return json({ error: '不是合法的配置 JSON' }, 400);
    const stmts = []; let nr = 0, nd = 0; const skipped = [];
    // 只能覆盖自己添加的路由；别人/历史路由一律跳过，避免导入时把别人的路由顶掉
    const existingRows = (await env.DB.prepare('SELECT rowid AS _rid, prefix, created_by FROM routes').all()).results || [];
    const ownerByPrefix = new Map(existingRows.map(x => [x.prefix, x]));
    for (const r of Array.isArray(data.routes) ? data.routes : []) {
      const err = validatePrefix(r?.prefix);
      const targets = splitTargets(r?.target);
      if (err || !targets.length || !targets.every(isValidHttpUrl) || parseHeaderLines(r.custom_headers).error ||
          !validIpList(parseIpList(r.ip_allow)) || !validIpList(parseIpList(r.ip_block))) { skipped.push(String(r?.prefix || '?')); continue; }
      const pf = normalizePrefix(r.prefix);
      const cur = ownerByPrefix.get(pf);
      if (cur !== undefined && (cur.created_by || '') !== adminActor) { skipped.push(pf); continue; }
      const commonArgs = [
        targets.join(','), String(r.remark || ''), r.cache_img === 'off' ? 'off' : 'on', r.compat_mode === 'on' ? 'on' : 'off',
        normalizeIpMode(r.ip_mode), Number(r.sort_order) || 0, r.enabled === 0 ? 0 : 1,
        String(r.custom_headers || ''), String(r.ip_allow || ''), String(r.ip_block || ''), adminActor,
      ];
      if (cur !== undefined) {
        // 老库 routes.prefix 可能不唯一：按 rowid 更新，避免 INSERT OR REPLACE 生成重复行
        stmts.push(env.DB.prepare(
          `UPDATE routes SET target = ?, remark = ?, cache_img = ?, compat_mode = ?, ip_mode = ?,
             sort_order = ?, enabled = ?, custom_headers = ?, ip_allow = ?, ip_block = ?, created_by = ?
           WHERE rowid = ?`
        ).bind(...commonArgs, cur._rid));
      } else {
        stmts.push(env.DB.prepare(
          `INSERT INTO routes (target, remark, cache_img, compat_mode, ip_mode, sort_order, enabled, custom_headers, ip_allow, ip_block, created_by, prefix, last_play)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '')`
        ).bind(...commonArgs, pf));
      }
      nr++;
    }
    for (const d of Array.isArray(data.domains) ? data.domains : []) {
      const domain = normalizeDomain(d?.domain); const name = String(d?.name || '').trim();
      if (!domain || !name) continue;
      stmts.push(env.DB.prepare('INSERT OR IGNORE INTO optimized_domains (domain, name, is_builtin) VALUES (?, ?, 0)').bind(domain, name));
      nd++;
    }
    if (data.settings && typeof data.settings === 'object') {
      for (const k of SETTING_KEYS) if (k in data.settings) {
        stmts.push(env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(k, String(data.settings[k] ?? '')));
      }
    }
    if (stmts.length) await env.DB.batch(stmts);
    clearRouteCache(); settingsCache = { exp: 0, v: null };
    await auditLog(env, 'import', `routes=${nr} domains=${nd} skipped=${skipped.length}`);
    return json({ success: true, routes: nr, domains: nd, skipped });
  }

  if (url.pathname === '/admin/api/routes/toggle' && request.method === 'POST') {
    const data = await readJson(request) || {};
    const prefix = normalizePrefix(data.prefix);
    if (!prefix) return json({ error: '缺少 prefix' }, 400);
    const res = await env.DB.prepare('UPDATE routes SET enabled = ? WHERE prefix = ? AND created_by = ?').bind(data.enabled ? 1 : 0, prefix, adminActor).run();
    if (!res.meta?.changes) return json({ error: '路由不存在或无权操作' }, 404);
    clearRouteCache();
    await auditLog(env, data.enabled ? 'route.enable' : 'route.disable', '/' + prefix);
    return json({ success: true });
  }

  if (url.pathname === '/admin/api/routes/reorder' && request.method === 'POST') {
    const data = await readJson(request) || {};
    const order = Array.isArray(data.order) ? data.order.map(normalizePrefix).filter(Boolean) : [];
    if (!order.length) return json({ error: '缺少 order' }, 400);
    await env.DB.batch(order.map((pf, i) => env.DB.prepare('UPDATE routes SET sort_order = ? WHERE prefix = ? AND created_by = ?').bind(i, pf, adminActor)));
    return json({ success: true });
  }

  if (url.pathname === '/admin/api/routes/test' && request.method === 'POST') {
    const data = await readJson(request) || {};
    const route = await env.DB.prepare('SELECT target FROM routes WHERE prefix = ? AND created_by = ?').bind(normalizePrefix(data.prefix), adminActor).first();
    if (!route) return json({ error: '路由不存在或无权操作' }, 404);
    const targets = splitTargets(route.target);
    const results = await Promise.all(targets.map(async t => ({ target: t, ...(await probeTarget(t)) })));
    return json({ success: true, results });
  }

  if (url.pathname === '/admin/api/health/run' && request.method === 'POST') {
    const out = await runHealthCheck(env, true);
    return json({ success: true, ...out });
  }

  if (url.pathname === '/admin/api/routes') {
    if (request.method === 'GET') {
      const today = getShanghaiParts().dateKey;
      const { results } = await env.DB.prepare(
        `SELECT r.*, COALESCE(s.request_count, 0) AS today_req, COALESCE(s.traffic_bytes, 0) AS today_bytes
         FROM routes r LEFT JOIN route_stats_daily s ON s.prefix = r.prefix AND s.bucket_date = ?
         WHERE r.created_by = ?
         ORDER BY r.sort_order, r.prefix`
      ).bind(today, adminActor).all();
      let health = [];
      try { health = (await env.DB.prepare('SELECT prefix, down FROM route_health').all()).results || []; } catch (_) {}
      const downMap = {};
      for (const h of health) if (h.down) downMap[h.prefix] = (downMap[h.prefix] || 0) + 1;
      return json((results || []).map(r => ({ ...r, down_count: downMap[r.prefix] || 0 })));
    }
    if (request.method === 'POST') {
      const data = await readJson(request);
      if (!data) return json({ error: '请求体不是合法 JSON' }, 400);
      const err = validatePrefix(data.prefix);
      if (err) return json({ error: err }, 400);
      const prefix = normalizePrefix(data.prefix);
      const oldPrefix = data.oldPrefix ? normalizePrefix(data.oldPrefix) : '';

      const targets = splitTargets(data.target);
      if (!targets.length) return json({ error: '请至少填写一个目标地址' }, 400);
      const badTarget = targets.find(t => !isValidHttpUrl(t));
      if (badTarget) return json({ error: '目标地址必须是 http(s):// 开头的合法 URL：' + badTarget }, 400);

      const hdrCheck = parseHeaderLines(data.custom_headers);
      if (hdrCheck.error) return json({ error: hdrCheck.error }, 400);
      const allowList = parseIpList(data.ip_allow); const blockList = parseIpList(data.ip_block);
      if (!validIpList(allowList) || !validIpList(blockList)) return json({ error: 'IP 黑白名单格式不合法（支持 IPv4、IPv6 和 IPv4 CIDR，用逗号或空格分隔）' }, 400);

      const isRename = oldPrefix && oldPrefix !== prefix;
      // 用户私有历史路由不占用全局路径：管理员的查重只看全局路由（user_id 为空）
      const hasLegacy = await routesHasUserId(env);
      const globalScope = hasLegacy ? " AND (user_id IS NULL OR user_id = 0 OR user_id = '')" : '';
      const existing = await env.DB.prepare(
        'SELECT rowid AS _rid, sort_order, last_play, enabled, created_by FROM routes WHERE prefix = ?' + globalScope
      ).bind(isRename ? oldPrefix : prefix).first();
      if (isRename) {
        if (!existing) return json({ error: '原路由不存在' }, 404);
        if ((existing.created_by || '') !== adminActor) return json({ error: '无权修改其他管理员或历史路由' }, 403);
        const clash = await env.DB.prepare('SELECT 1 AS x FROM routes WHERE prefix = ?' + globalScope).bind(prefix).first();
        if (clash) return json({ error: '路径 /' + prefix + ' 已存在' }, 409);
      } else if (oldPrefix) {
        // 编辑：只能编辑自己添加的路由
        if (!existing) return json({ error: '路由不存在' }, 404);
        if ((existing.created_by || '') !== adminActor) return json({ error: '无权修改其他管理员或历史路由' }, 403);
      } else if (existing) {
        if ((existing.created_by || '') === adminActor) return json({ error: '路径 /' + prefix + ' 已存在，请直接编辑它' }, 409);
        return json({ error: '路径 /' + prefix + ' 已被其他管理员或历史路由占用' }, 409);
      }

      if (oldPrefix) {
        // 编辑/改名：按 rowid 直接 UPDATE，兼容老库 routes.prefix 非唯一的情况，避免 INSERT 出重复行
        await env.DB.prepare(
          `UPDATE routes SET prefix = ?, target = ?, remark = ?, cache_img = ?, compat_mode = ?, ip_mode = ?,
             custom_headers = ?, ip_allow = ?, ip_block = ?, created_by = ?
           WHERE rowid = ? AND created_by = ?`
        ).bind(
          prefix, targets.join(','), String(data.remark || ''), data.cache_img === 'off' ? 'off' : 'on',
          data.compat_mode === 'on' ? 'on' : 'off', normalizeIpMode(data.ip_mode),
          String(data.custom_headers || '').trim(), allowList.join(','), blockList.join(','), adminActor,
          existing._rid, adminActor
        ).run();
      } else {
        await env.DB.prepare(
          'INSERT INTO routes (prefix, target, remark, cache_img, compat_mode, ip_mode, last_play, sort_order, enabled, custom_headers, ip_allow, ip_block, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(
          prefix, targets.join(','), String(data.remark || ''), data.cache_img === 'off' ? 'off' : 'on',
          data.compat_mode === 'on' ? 'on' : 'off', normalizeIpMode(data.ip_mode), '', 0, 1,
          String(data.custom_headers || '').trim(), allowList.join(','), blockList.join(','), adminActor
        ).run();
      }
      clearRouteCache();
      await auditLog(env, isRename ? 'route.rename' : 'route.save', '/' + (isRename ? oldPrefix + ' → /' : '') + prefix);
      return json({ success: true });
    }
    if (request.method === 'DELETE') {
      const prefix = url.searchParams.get('prefix');
      if (!prefix) return json({ error: '缺少 prefix 参数' }, 400);
      const p = normalizePrefix(prefix);
      const res = await env.DB.prepare('DELETE FROM routes WHERE prefix = ? AND created_by = ?').bind(p, adminActor).run();
      if (!res.meta?.changes) return json({ error: '路由不存在或无权操作' }, 404);
      clearRouteCache();
      try { await env.DB.prepare('DELETE FROM route_health WHERE prefix = ?').bind(p).run(); } catch (_) {}
      await auditLog(env, 'route.delete', '/' + p);
      return json({ success: true });
    }
  }

  if (url.pathname === '/admin/api/optimized-domains') {
    if (request.method === 'GET') {
      const domains = await getOptimizedDomains(env);
      return json({ success: true, domains });
    }
    if (request.method === 'POST') {
      const data = await readJson(request);
      const domain = normalizeDomain(data?.domain);
      const name = String(data?.name || '').trim();
      if (!domain || !name) return json({ success: false, error: '域名或名称不合法' }, 400);
      try {
        const success = await addOptimizedDomain(env, domain, name);
        await auditLog(env, 'domain.add', domain);
        return json({ success });
      } catch (e) {
        if (/UNIQUE/i.test(String(e?.message))) return json({ success: false, error: '该域名已存在' }, 409);
        return json({ success: false, error: '保存失败' }, 500);
      }
    }
  }

  if (url.pathname.startsWith('/admin/api/optimized-domains/')) {
    const id = parseInt(url.pathname.split('/').pop(), 10);
    if (!Number.isFinite(id)) return json({ success: false, error: 'id 不合法' }, 400);
    if (request.method === 'PUT') {
      const data = await readJson(request);
      const domain = normalizeDomain(data?.domain);
      const name = String(data?.name || '').trim();
      if (!domain || !name) return json({ success: false, error: '域名或名称不合法' }, 400);
      try {
        const success = await updateOptimizedDomain(env, id, domain, name);
        if (!success) return json({ success: false, error: '内置域名不可修改，或该记录不存在' }, 403);
        return json({ success });
      } catch (e) {
        if (/UNIQUE/i.test(String(e?.message))) return json({ success: false, error: '该域名已存在' }, 409);
        return json({ success: false, error: '保存失败' }, 500);
      }
    }
    if (request.method === 'DELETE') {
      const success = await deleteOptimizedDomain(env, id);
      if (!success) return json({ success: false, error: '内置域名不可删除，或该记录不存在' }, 403);
      await auditLog(env, 'domain.delete', 'id=' + id);
      return json({ success });
    }
  }

  if (url.pathname === '/admin/api/dns-config') {
    if (request.method === 'GET') {
      const config = await getDNSConfig(env);
      const zoneInfo = await resolveZoneInfo(env);
      const baseDomain = getBaseDomain(env);
      const resolvedName = (config && config.dnsName) || getDnsRecordName(env);
      const targetName = toFqdn(resolvedName, baseDomain);

      const candidates = [];
      const accessHost = String(url.hostname || '').toLowerCase();
      if (accessHost) candidates.push(accessHost);
      if (targetName && !candidates.includes(targetName)) candidates.push(targetName);

      // 只查解析出来的那一个 Zone，避免每打开一次后台就打一遍所有区域的 DNS 记录（容易触发速率限制）
      let zones = [];
      let zonesError = null;
      let zoneId = zoneInfo.zoneId || (config && config.zoneId) || '';

      if (!zoneId) {
        zonesError = zoneInfo.error || '未解析到 Zone ID';
        const zr = await getZones(env);
        if (zr.success && Array.isArray(zr.result)) {
          zones = zr.result;
          if (zones[0]) zoneId = zones[0].id;
        } else {
          zonesError = zr.errors?.[0]?.message || zr.error || '获取区域列表失败';
        }
      }

      let liveRecord = null;
      if (zoneId) {
        try {
          const rr = await getDNSRecords(env, zoneId);
          if (rr.success && Array.isArray(rr.result)) {
            for (const name of candidates) {
              const rec = rr.result.find(r => ['A', 'AAAA', 'CNAME'].includes(r.type) && r.name === name);
              if (rec) {
                liveRecord = { type: rec.type, name: rec.name, content: rec.content, proxied: rec.proxied, modifiedOn: rec.modified_on, zoneId };
                break;
              }
            }
          } else if (!zonesError) {
            zonesError = rr.errors?.[0]?.message || rr.error || '读取 DNS 记录失败';
          }
        } catch (e) {
          zonesError = zonesError || String(e?.message || e);
        }
      }

      return json({
        success: true,
        config,
        zones,
        zonesError,
        liveRecord,
        zoneId,
        baseDomain,
        resolvedName,
        targetName,
        statsHost: getStatsHost(env),
      });
    }
    if (request.method === 'POST') {
      const data = await readJson(request) || {};
      const success = await saveDNSConfig(env, data.dnsName, data.currentDomain || '', data.zoneId || '');
      return json({ success });
    }
  }

  if (url.pathname === '/admin/api/dns/replace' && request.method === 'POST') {
    const data = await readJson(request) || {};
    let { zoneId, dnsName, targetDomain } = data;

    // 记录名留空 = 直接用 BASE_DOMAIN；也允许填前缀（proxy）或完整域名
    const baseDomain = getBaseDomain(env);
    const nameInput = String(dnsName || '').trim() || getDnsRecordName(env);
    const targets = splitTargets(targetDomain).map(normalizeDnsTarget).filter(Boolean);
    if (!nameInput || !targets.length) return json({ success: false, error: '缺少必要参数（记录名 / 目标）' }, 400);
    if (!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(targets[0]) && !targets[0].includes(':') && !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(targets[0])) {
      return json({ success: false, error: '目标必须是合法域名、IPv4 或 IPv6' }, 400);
    }

    if (!zoneId) {
      const info = await resolveZoneInfo(env);
      zoneId = info.zoneId;
      if (!zoneId) return json({ success: false, error: info.error || '未解析到 Zone ID，请检查 CF_API_TOKEN 权限' }, 400);
    }

    const result = await createOrUpdateDNSRecord(env, zoneId, nameInput, targets[0], baseDomain);
    if (result.success && result.result) {
      await saveDNSConfig(env, nameInput, targets[0], zoneId);
      invalidateZoneInfoCache();
      await auditLog(env, 'dns.replace', `${result.result.name} → ${result.result.content}`);
      return json({ success: true, result: result.result });
    }
    return json({ success: false, error: result.error || result.errors?.[0]?.message || 'DNS 替换失败', errors: result.errors });
  }

  // ===== 用户管理 =====
  if (url.pathname === '/admin/api/users') {
    if (request.method === 'GET') return json({ success: true, users: await adminListUsers(env) });
    if (request.method === 'POST') {
      const data = await readJson(request) || {};
      const out = await adminCreateUser(env, data, adminActor);
      return json(out, out.error ? 400 : 200);
    }
  }

  if (url.pathname.startsWith('/admin/api/users/')) {
    const id = parseInt(url.pathname.split('/').pop(), 10);
    if (!Number.isFinite(id)) return json({ error: 'id 不合法' }, 400);
    if (request.method === 'PUT') {
      const data = await readJson(request) || {};
      const out = await adminUpdateUser(env, id, data, adminActor);
      return json(out, out.error ? 400 : 200);
    }
    if (request.method === 'DELETE') {
      const out = await adminDeleteUser(env, id, adminActor);
      return json(out, out.error ? 404 : 200);
    }
  }

  // ===== 邀请码管理 =====
  if (url.pathname === '/admin/api/invites') {
    if (request.method === 'GET') return json({ success: true, invites: await adminListInvites(env) });
    if (request.method === 'POST') {
      const data = await readJson(request) || {};
      const out = await adminCreateInvite(env, data, adminActor);
      return json(out, out.error ? 400 : 200);
    }
  }

  // 一键删除全部邀请码（含历史遗留的混合大小写邀请码）
  if (url.pathname === '/admin/api/invites/clear' && request.method === 'POST') {
    const out = await adminClearInvites(env, adminActor);
    return json(out, out.error ? 400 : 200);
  }

  if (url.pathname.startsWith('/admin/api/invites/') && request.method === 'DELETE') {
    const code = decodeURIComponent(url.pathname.split('/').pop() || '');
    const out = await adminDeleteInvite(env, code, 'admin');
    return json(out, out.error ? 404 : 200);
  }

  // ===== 数据清理（只清统计 / 或清用户，路由和域名配置保留）=====
  if (url.pathname === '/admin/api/db/reset' && request.method === 'POST') {
    const data = await readJson(request) || {};
    const out = await adminResetData(env, data, adminActor);
    return json(out, out.error ? 400 : 200);
  }

  return json({ error: 'Not found' }, 404);
}

// ==================== 多人版后台 API（用户 / 邀请码 / 重置）====================

async function adminListUsers(env) {
  const today = getShanghaiParts().dateKey;
  const hasLegacy = await routesHasUserId(env);
  const rcSql = hasLegacy
    ? `LEFT JOIN (
         SELECT owner, COUNT(DISTINCT prefix) AS cnt FROM (
           SELECT owner, prefix FROM user_routes
           UNION
           SELECT u2.username AS owner, r.prefix FROM routes r JOIN users u2 ON u2.id = r.user_id
         ) GROUP BY owner
       ) rc ON rc.owner = u.username`
    : `LEFT JOIN (SELECT owner, COUNT(*) AS cnt FROM user_routes GROUP BY owner) rc ON rc.owner = u.username`;
  const { results } = await env.DB.prepare(
    `SELECT u.*, COALESCE(s.req, 0) AS today_req, COALESCE(s.bytes, 0) AS today_bytes,
            COALESCE(rc.cnt, 0) AS route_count
     FROM users u
     LEFT JOIN (
       SELECT substr(prefix, 1, instr(prefix, '/') - 1) AS owner,
              SUM(request_count) AS req, SUM(traffic_bytes) AS bytes
       FROM route_stats_daily
       WHERE bucket_date = ? AND instr(prefix, '/') > 0
       GROUP BY owner
     ) s ON s.owner = u.username
     ${rcSql}
     ORDER BY u.id`
  ).bind(today).all();
  return (results || []).map(r => ({
    ...publicUser(rowToUser(r)),
    todayRequests: Number(r.today_req) || 0,
    todayTraffic: Number(r.today_bytes) || 0,
    routeCount: Number(r.route_count) || 0,
  }));
}

async function adminCreateUser(env, data, actor) {
  const username = sanitizeUsername(data.username);
  const password = String(data.password || '');
  const subdomain = sanitizeSubdomain(data.subdomain) || sanitizeSubdomain(username);
  const role = data.role === 'admin' ? 'admin' : 'user';
  const status = data.status === 'disabled' ? 'disabled' : 'active';
  const routeLimit = Math.max(1, Math.min(200, parseInt(data.route_limit, 10) || DEFAULT_USER_ROUTE_LIMIT));

  if (!username) return { error: '用户名需为 3-32 位小写字母、数字或短横线，且不能以短横线开头/结尾' };
  if (password.length < 6) return { error: '密码至少 6 位' };
  if (!subdomain) return { error: '子域名不合法' };
  const entryErr = entryNameError(env, subdomain);
  if (entryErr) return { error: entryErr };

  const exists = await env.DB.prepare('SELECT 1 AS x FROM users WHERE username = ? OR subdomain = ?').bind(username, subdomain).first();
  if (exists) return { error: '用户名或子域名已被占用' };

  const salt = randomHex(16);
  const hash = await hashPassword(password, salt);
  const nowIso = new Date().toISOString();
  let created = null;
  try {
    const res = await env.DB.prepare(
      'INSERT INTO users (username, password_hash, salt, role, status, subdomain, route_limit, created_at, last_login) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(username, hash, salt, role, status, subdomain, routeLimit, nowIso, '').run();
    clearUserCache();
    await auditLog(env, 'user.create', actor + ' -> ' + username + ' / ' + subdomain);
    created = { id: res.meta?.last_row_id, username, role, status, subdomain, routeLimit };
  } catch (e) {
    return { error: /UNIQUE/i.test(String(e?.message)) ? '用户名或子域名已被占用' : '创建失败' };
  }
  // 创建后自动建 DNS 记录（失败不影响建号，返回 warning 供后台提示）
  const user = await getUserByUsername(env, username);
  const dns = user ? await provisionUserDns(env, user) : { ok: false, error: '读取用户失败' };
  return dns.ok
    ? { user: created, dns: { entryHost: dns.entryHost, target: dns.target, type: dns.type } }
    : { user: created, dnsWarning: dns.error };
}

async function adminUpdateUser(env, id, data, actor) {
  const user = await getUserById(env, id);
  if (!user) return { error: '用户不存在' };
  const fields = [];
  const changed = [];
  const args = [];
  let subdomain = user.subdomain;

  if (data.subdomain !== undefined) {
    subdomain = sanitizeSubdomain(data.subdomain) || sanitizeSubdomain(user.username);
    if (!subdomain) return { error: '子域名不合法' };
    if (RESERVED_SUBDOMAINS.has(subdomain)) return { error: '该子域名不可用' };
    const clash = await env.DB.prepare('SELECT 1 AS x FROM users WHERE subdomain = ? AND id <> ?').bind(subdomain, id).first();
    if (clash) return { error: '子域名已被占用' };
    fields.push('subdomain = ?'); changed.push('subdomain'); args.push(subdomain);
  }
  if (data.role !== undefined) {
    fields.push('role = ?'); changed.push('role'); args.push(data.role === 'admin' ? 'admin' : 'user');
  }
  if (data.status !== undefined) {
    fields.push('status = ?'); changed.push('status'); args.push(data.status === 'disabled' ? 'disabled' : 'active');
  }
  if (data.route_limit !== undefined) {
    const limit = Math.max(1, Math.min(200, parseInt(data.route_limit, 10) || DEFAULT_USER_ROUTE_LIMIT));
    fields.push('route_limit = ?'); changed.push('route_limit'); args.push(limit);
  }
  if (data.password) {
    if (String(data.password).length < 6) return { error: '密码至少 6 位' };
    const salt = randomHex(16);
    fields.push('password_hash = ?', 'salt = ?');
    changed.push('password');
    args.push(await hashPassword(String(data.password), salt), salt);
  }
  if (!fields.length) return { error: '没有需要更新的字段' };

  args.push(id);
  await env.DB.prepare('UPDATE users SET ' + fields.join(', ') + ' WHERE id = ?').bind(...args).run();
  clearUserCache();
  await auditLog(env, 'user.update', actor + ' -> ' + user.username + ' (' + changed.join(',') + ')');
  const updated = await getUserById(env, id);
  return { user: publicUser(updated) };
}

async function adminDeleteUser(env, id, actor) {
  const user = await getUserById(env, id);
  if (!user) return { error: '用户不存在' };
  await env.DB.batch([
    env.DB.prepare('DELETE FROM user_routes WHERE owner = ?').bind(user.username),
    env.DB.prepare('DELETE FROM user_stats_hourly WHERE owner = ?').bind(user.username),
    env.DB.prepare("DELETE FROM route_stats_daily WHERE prefix LIKE ? ESCAPE '!'").bind(escapeLike(user.username) + '/%'),
    env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id),
  ]);
  clearUserCache(); clearRouteCache();
  await auditLog(env, 'user.delete', actor + ' -> ' + user.username);
  return { ok: true };
}

async function adminListInvites(env) {
  const { results } = await env.DB.prepare('SELECT * FROM invite_codes ORDER BY created_at DESC, code').all();
  return (results || []).map(r => ({
    code: r.code,
    maxUses: Number(r.max_uses) || 0,
    usedCount: Number(r.used_count) || 0,
    expiresAt: r.expires_at || '',
    note: r.note || '',
    createdBy: r.created_by || '',
    createdAt: r.created_at || '',
  }));
}

async function adminCreateInvite(env, data, actor) {
  const code = String(data.code || '').trim().toUpperCase() || makeInviteCode();
  if (!/^[A-Z0-9-]{4,32}$/.test(code)) return { error: '邀请码仅允许 4-32 位字母、数字和短横线' };
  const maxUses = Math.max(0, Math.min(10000, parseInt(data.max_uses, 10) || 1));
  const expiresAt = String(data.expires_at || '').trim();
  if (expiresAt && isNaN(new Date(expiresAt).getTime())) return { error: '过期时间格式不正确' };
  const note = String(data.note || '').slice(0, 200);
  try {
    await env.DB.prepare('INSERT INTO invite_codes (code, max_uses, used_count, expires_at, note, created_by, created_at) VALUES (?, ?, 0, ?, ?, ?, ?)')
      .bind(code, maxUses, expiresAt, note, actor, new Date().toISOString()).run();
    await auditLog(env, 'invite.create', actor + ' -> ' + code);
    return { invite: { code, maxUses, usedCount: 0, expiresAt, note, createdBy: actor } };
  } catch (e) {
    const msg = String(e?.message || e || '');
    return { error: /UNIQUE/i.test(msg) ? '邀请码已存在' : ('创建失败: ' + msg) };
  }
}

async function adminClearInvites(env, actor) {
  let deleted = 0;
  try {
    const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM invite_codes').first();
    deleted = Number(row?.n) || 0;
  } catch (_) {}
  const res = await env.DB.prepare('DELETE FROM invite_codes').run();
  if (Number(res.meta?.changes) > 0) deleted = Number(res.meta.changes);
  await auditLog(env, 'invite.clear', actor + ' -> ' + deleted);
  return { ok: true, deleted };
}

async function adminDeleteInvite(env, code, actor) {
  const raw = String(code || '').trim();
  const upper = raw.toUpperCase();
  if (!raw) return { error: '邀请码不能为空' };
  // 兼容历史遗留的混合大小写邀请码：先按原样/大写精确匹配，再退化为忽略大小写
  let row = await env.DB.prepare('SELECT code FROM invite_codes WHERE code = ? OR code = ? LIMIT 1').bind(raw, upper).first();
  if (!row) row = await env.DB.prepare('SELECT code FROM invite_codes WHERE UPPER(code) = ? LIMIT 1').bind(upper).first();
  if (!row) return { ok: true, alreadyDeleted: true };
  const res = await env.DB.prepare('DELETE FROM invite_codes WHERE code = ?').bind(row.code).run();
  if (!res.meta?.changes) return { error: '删除失败，请刷新后重试' };
  await auditLog(env, 'invite.delete', actor + ' -> ' + row.code);
  return { ok: true };
}

async function adminResetData(env, data, actor) {
  if (String(data.confirm || '') !== 'RESET') return { error: '请输入 RESET 确认' };
  const scope = String(data.scope || 'stats');
  const jobs = [];
  if (scope === 'stats' || scope === 'all') {
    jobs.push(
      env.DB.prepare('DELETE FROM proxy_stats_hourly'),
      env.DB.prepare('DELETE FROM route_stats_daily'),
      env.DB.prepare('DELETE FROM user_stats_hourly'),
      env.DB.prepare('DELETE FROM route_health'),
      env.DB.prepare('DELETE FROM audit_log'),
    );
    // 清空当前 isolate 尚未落盘的内存缓冲，避免清空后又被写回
    statsBuffer.clear();
    routeStatsBuffer.clear();
    userStatsBuffer.clear();
    statsBufferCount = 0;
  }
  if (scope === 'users' || scope === 'all') {
    jobs.push(
      env.DB.prepare('DELETE FROM user_routes'),
      env.DB.prepare('DELETE FROM user_stats_hourly'),
      env.DB.prepare('DELETE FROM route_stats_daily WHERE instr(prefix, \'/\') > 0'),
      env.DB.prepare('DELETE FROM invite_codes'),
      env.DB.prepare('DELETE FROM users'),
    );
    clearUserCache(); clearRouteCache();
  }
  if (!jobs.length) return { error: '未知的清理范围' };
  await env.DB.batch(jobs);
  await auditLog(env, 'db.reset', actor + ' -> ' + scope);
  return { ok: true, scope };
}

// ==================== 用户前台 API ====================

function userEntryHost(env, user) {
  const root = getUserDomain(env) || getBaseDomain(env);
  const sub = (user && user.subdomain) || (user && user.username) || '';
  return toFqdn(sub, root);
}

// 老库的 routes 表带 user_id 字段（单用户版升级过来的）。缓存一次检测结果。
let routesHasUserIdCache = null;
async function routesHasUserId(env) {
  if (routesHasUserIdCache !== null) return routesHasUserIdCache;
  try {
    await env.DB.prepare('SELECT user_id FROM routes LIMIT 1').first();
    routesHasUserIdCache = true;
  } catch (_) {
    routesHasUserIdCache = false;
  }
  return routesHasUserIdCache;
}

// 当前用户拥有、但还留在全局 routes 表里的老路由（按 user_id 归属）。
// 每个 prefix 只取最早的一条，避免旧表的重复行全部显示出来。
async function getUserLegacyRoutes(env, user, today) {
  if (!user || !(await routesHasUserId(env))) return [];
  try {
    const { results } = await env.DB.prepare(
      `SELECT r.*,
              COALESCE((SELECT SUM(request_count) FROM route_stats_daily
                        WHERE bucket_date = ? AND prefix IN (r.prefix, ? || '/' || r.prefix)), 0) AS today_req,
              COALESCE((SELECT SUM(traffic_bytes) FROM route_stats_daily
                        WHERE bucket_date = ? AND prefix IN (r.prefix, ? || '/' || r.prefix)), 0) AS today_bytes
       FROM routes r
       JOIN (SELECT prefix, MIN(rowid) AS rid FROM routes WHERE user_id = ? GROUP BY prefix) x
         ON x.rid = r.rowid
       WHERE r.user_id = ?
       ORDER BY r.sort_order, r.prefix`
    ).bind(today, user.username, today, user.username, user.id, user.id).all();
    return results || [];
  } catch (_) {
    return [];
  }
}

async function getLegacyRouteForUser(env, user, id, prefix) {
  if (!user || !(await routesHasUserId(env))) return null;
  try {
    if (id) {
      const row = await env.DB.prepare('SELECT rowid AS _rid, * FROM routes WHERE id = ? AND user_id = ?').bind(Number(id), user.id).first();
      if (row) return row;
    }
  } catch (_) {}
  try {
    return await env.DB.prepare('SELECT rowid AS _rid, * FROM routes WHERE user_id = ? AND prefix = ? ORDER BY rowid LIMIT 1').bind(user.id, prefix).first();
  } catch (_) {
    return null;
  }
}

// 用户名下路由总数：私有路由 + 老库按 user_id 归属的路由（同名路径只算一次）
async function countUserRoutes(env, user) {
  if (!user) return 0;
  if (await routesHasUserId(env)) {
    try {
      const c = await env.DB.prepare(
        'SELECT COUNT(*) AS n FROM (SELECT prefix FROM user_routes WHERE owner = ? UNION SELECT prefix FROM routes WHERE user_id = ?)'
      ).bind(user.username, user.id).first();
      return Number(c?.n) || 0;
    } catch (_) {}
  }
  try {
    const c = await env.DB.prepare('SELECT COUNT(*) AS n FROM user_routes WHERE owner = ?').bind(user.username).first();
    return Number(c?.n) || 0;
  } catch (_) {
    return 0;
  }
}

async function userListRoutes(env, owner) {
  const today = getShanghaiParts().dateKey;
  const { results } = await env.DB.prepare(
    `SELECT r.*, COALESCE(s.request_count, 0) AS today_req, COALESCE(s.traffic_bytes, 0) AS today_bytes
     FROM user_routes r
     LEFT JOIN route_stats_daily s ON s.prefix = ? || '/' || r.prefix AND s.bucket_date = ?
     WHERE r.owner = ?
     ORDER BY r.sort_order, r.prefix`
  ).bind(owner, today, owner).all();
  let health = [];
  try { health = (await env.DB.prepare('SELECT prefix, target, down FROM route_health').all()).results || []; } catch (_) {}
  const downSet = new Set();
  for (const h of health) if (h.down) downSet.add(h.prefix + '|' + h.target);
  // 只统计这条路由自己的目标，避免同路径下别的用户线路异常被算进来
  const countDown = (keyPrefix, target) => splitTargets(target).filter(t => downSet.has(keyPrefix + '|' + t)).length;

  const user = await getUserByUsername(env, owner);
  const legacy = await getUserLegacyRoutes(env, user, today);

  const out = [];
  const seen = new Set();
  for (const r of results || []) {
    out.push({ ...r, source: 'user', down_count: countDown(owner + '/' + r.prefix, r.target) });
    seen.add(r.prefix);
  }
  for (const r of legacy) {
    if (seen.has(r.prefix)) continue;
    out.push({ ...r, source: 'legacy', down_count: countDown(r.prefix, r.target) });
    seen.add(r.prefix);
  }
  return out;
}

async function userSaveRoute(env, owner, data) {
  const err = validateUserPrefix(data.prefix);
  if (err) return { error: err };
  const prefix = normalizePrefix(data.prefix);
  const oldPrefix = data.oldPrefix ? normalizePrefix(data.oldPrefix) : '';
  const targets = splitTargets(data.target);
  if (!targets.length) return { error: '请至少填写一个目标地址' };
  const badTarget = targets.find(t => !isValidHttpUrl(t));
  if (badTarget) return { error: '目标地址必须是 http(s):// 开头的合法 URL：' + badTarget };

  const hdrCheck = parseHeaderLines(data.custom_headers);
  if (hdrCheck.error) return { error: hdrCheck.error };
  const allowList = parseIpList(data.ip_allow);
  const blockList = parseIpList(data.ip_block);
  if (!validIpList(allowList) || !validIpList(blockList)) return { error: 'IP 黑白名单格式不合法' };

  const user = await getUserByUsername(env, owner);
  if (!user) return { error: '用户不存在' };
  const limit = user.routeLimit || DEFAULT_USER_ROUTE_LIMIT;
  const isRename = oldPrefix && oldPrefix !== prefix;
  const lookupPrefix = isRename ? oldPrefix : prefix;
  const source = data.source === 'legacy' ? 'legacy' : 'user';
  const routeId = Number(data.routeId || data.id || 0) || 0;

  // ===== 老库路由（单用户版升级过来的 routes 表）：直接改自己那一行，保留 user_id =====
  if (source === 'legacy') {
    const row = await getLegacyRouteForUser(env, user, routeId, lookupPrefix);
    if (!row) return { error: '路由不存在或不属于当前账号' };
    if (isRename) {
      const clashUser = await env.DB.prepare('SELECT 1 AS x FROM user_routes WHERE owner = ? AND prefix = ?').bind(owner, prefix).first();
      if (clashUser) return { error: '路径 /' + prefix + ' 已存在' };
      const clashLegacy = await env.DB.prepare('SELECT 1 AS x FROM routes WHERE user_id = ? AND prefix = ? AND rowid <> ?').bind(user.id, prefix, row._rid).first();
      if (clashLegacy) return { error: '路径 /' + prefix + ' 已存在' };
      const clashOther = await env.DB.prepare('SELECT 1 AS x FROM routes WHERE prefix = ? AND (user_id IS NULL OR user_id <> ?)').bind(prefix, user.id).first();
      if (clashOther) return { error: '路径 /' + prefix + ' 已被其他路由占用' };
    }
    await env.DB.prepare(
      `UPDATE routes SET prefix = ?, target = ?, remark = ?, cache_img = ?, compat_mode = ?, ip_mode = ?,
        custom_headers = ?, ip_allow = ?, ip_block = ? WHERE rowid = ? AND user_id = ?`
    ).bind(
      prefix, targets.join(','), String(data.remark || ''), data.cache_img === 'off' ? 'off' : 'on',
      data.compat_mode === 'on' ? 'on' : 'off', normalizeIpMode(data.ip_mode),
      String(data.custom_headers || '').trim(), allowList.join(','), blockList.join(','),
      row._rid, user.id
    ).run();
    clearRouteCache();
    await auditLog(env, isRename ? 'user.route.rename' : 'user.route.save', owner + ' /' + prefix + ' (历史路由)');
    return { ok: true };
  }

  // ===== 私有路由（user_routes）=====
  if (isRename) {
    const clash = await env.DB.prepare('SELECT 1 AS x FROM user_routes WHERE owner = ? AND prefix = ?').bind(owner, prefix).first();
    if (clash) return { error: '路径 /' + prefix + ' 已存在' };
  } else if (!oldPrefix) {
    const existing = await env.DB.prepare('SELECT 1 AS x FROM user_routes WHERE owner = ? AND prefix = ?').bind(owner, prefix).first();
    if (existing) return { error: '路径 /' + prefix + ' 已存在，请直接编辑它' };
    if (await routesHasUserId(env)) {
      const legacyClash = await env.DB.prepare('SELECT 1 AS x FROM routes WHERE user_id = ? AND prefix = ?').bind(user.id, prefix).first();
      if (legacyClash) return { error: '路径 /' + prefix + ' 已存在，请直接编辑它' };
    }
    const total = await countUserRoutes(env, user);
    if (total >= limit) return { error: '路由数量已达上限（' + limit + ' 条），请联系管理员调整' };
  }

  const existing = await env.DB.prepare('SELECT sort_order, last_play, enabled FROM user_routes WHERE owner = ? AND prefix = ?').bind(owner, lookupPrefix).first();
  const insert = env.DB.prepare(
    'INSERT OR REPLACE INTO user_routes (owner, prefix, target, remark, cache_img, compat_mode, ip_mode, last_play, sort_order, enabled, custom_headers, ip_allow, ip_block) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(
    owner, prefix, targets.join(','), String(data.remark || ''), data.cache_img === 'off' ? 'off' : 'on',
    data.compat_mode === 'on' ? 'on' : 'off', normalizeIpMode(data.ip_mode), existing?.last_play || '',
    existing?.sort_order || 0, existing?.enabled === 0 ? 0 : 1,
    String(data.custom_headers || '').trim(), allowList.join(','), blockList.join(',')
  );
  if (isRename) {
    await env.DB.batch([insert, env.DB.prepare('DELETE FROM user_routes WHERE owner = ? AND prefix = ?').bind(owner, oldPrefix)]);
  } else {
    await insert.run();
  }
  clearRouteCache();
  await auditLog(env, 'user.route.save', owner + ' /' + prefix);
  return { ok: true };
}

async function userDeleteRoute(env, owner, prefix, source) {
  const p = normalizePrefix(prefix);
  if (!p) return { error: '缺少路径参数' };
  const user = await getUserByUsername(env, owner);
  let changes = 0;
  if (source === 'legacy' && user && (await routesHasUserId(env))) {
    // 老表同一路径可能有重复行，一次性全部删掉
    const res = await env.DB.prepare('DELETE FROM routes WHERE user_id = ? AND prefix = ?').bind(user.id, p).run();
    changes = Number(res.meta?.changes) || 0;
  } else {
    const res = await env.DB.prepare('DELETE FROM user_routes WHERE owner = ? AND prefix = ?').bind(owner, p).run();
    changes = Number(res.meta?.changes) || 0;
    // 兼容不带 source 的旧前端：私有路由不存在时再尝试老库
    if (!changes && !source && user && (await routesHasUserId(env))) {
      const res2 = await env.DB.prepare('DELETE FROM routes WHERE user_id = ? AND prefix = ?').bind(user.id, p).run();
      changes = Number(res2.meta?.changes) || 0;
    }
  }
  if (!changes) return { error: '路由不存在' };
  clearRouteCache();
  await auditLog(env, 'user.route.delete', owner + ' /' + p);
  return { ok: true };
}

function isValidIPv4(v) {
  const parts = String(v || '').split('.');
  if (parts.length !== 4) return false;
  return parts.every(p => /^\d{1,3}$/.test(p) && Number(p) >= 0 && Number(p) <= 255);
}

// 用户 DNS 记录值：允许 IPv4 / IPv6 / 域名
function isValidDnsValue(v) {
  const s = String(v || '').trim().replace(/\.$/, '');
  if (!s || s.length > 253) return false;
  if (isValidIPv4(s)) return true;
  if (s.includes(':')) return /^[0-9a-f:]+$/i.test(s) && s.split(':').length <= 9;
  return /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(s);
}

// 注册后自动创建 DNS：CNAME 记录名 = 用户名/子域名，默认目标为优选域名，小黄云关闭
// 记录建在 USER_DOMAIN（未配置时 = BASE_DOMAIN）下，支持三级域名入口
async function provisionUserDns(env, user) {
  try {
    const root = getUserDomain(env) || getBaseDomain(env);
    if (!root) return { ok: false, error: '未配置 BASE_DOMAIN / USER_DOMAIN' };
    const info = await resolveZoneInfo(env, false, root);
    if (!info.zoneId) return { ok: false, error: info.error || '未解析到 Cloudflare Zone，请检查 CF_API_TOKEN' };
    const entryHost = userEntryHost(env, user);
    const target = DEFAULT_USER_DNS_TARGET;
    if (!isValidDnsValue(target)) return { ok: false, error: '默认 DNS 目标不合法' };
    if (entryHost === target) return { ok: false, error: 'DNS 目标不能与入口域名相同' };
    // 不覆盖已存在的其他 DNS 记录（避免误删业务记录）
    const existing = await getDNSRecords(env, info.zoneId);
    if (existing.success && Array.isArray(existing.result)) {
      const same = existing.result.filter(r => r.name === entryHost.toLowerCase() && ['A', 'AAAA', 'CNAME'].includes(r.type));
      const isOurs = same.length === 1 && same[0].type === 'CNAME' && String(same[0].content).toLowerCase() === target.toLowerCase();
      if (same.length && !isOurs) {
        return { ok: false, error: '子域名 ' + entryHost + ' 已存在 DNS 记录（' + same.map(r => r.type + ' ' + r.content).join('、') + '），未自动覆盖，请手动处理' };
      }
    }
    const result = await createOrUpdateDNSRecord(env, info.zoneId, user.subdomain || user.username, target, root,
      { proxied: false, saveConfig: false });
    if (!result.success) return { ok: false, error: result.error || result.errors?.[0]?.message || 'DNS 创建失败' };
    await auditLog(env, 'user.dns', user.username + ' -> ' + entryHost + ' = ' + target + '（自动）');
    return { ok: true, entryHost, target, type: result.result?.type || 'CNAME' };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

// 用户修改 DNS 记录值：先删除同名 A/AAAA/CNAME 记录，再按新值创建，避免冲突
async function userUpdateDns(env, session, target) {
  const user = await getUserById(env, session.uid);
  if (!user) return { error: '用户不存在' };
  const value = String(target || '').trim().replace(/\.$/, '');
  if (!value) return { error: '请输入 IP 或域名' };
  if (!isValidDnsValue(value)) return { error: 'DNS 值必须是合法的 IPv4 / IPv6 地址或域名' };
  const root = getUserDomain(env) || getBaseDomain(env);
  if (!root) return { error: '未配置 BASE_DOMAIN / USER_DOMAIN' };
  const entryHost = userEntryHost(env, user);
  if (value.toLowerCase() === entryHost.toLowerCase()) return { error: 'DNS 值不能指向入口域名自身' };
  const info = await resolveZoneInfo(env, false, root);
  if (!info.zoneId) return { error: info.error || '未解析到 Cloudflare Zone，请检查 CF_API_TOKEN' };
  const result = await createOrUpdateDNSRecord(env, info.zoneId, user.subdomain || user.username, value, root,
    { proxied: false, saveConfig: false, forceRecreate: true });
  if (!result.success) return { error: result.error || result.errors?.[0]?.message || 'DNS 更新失败', errors: result.errors };
  await auditLog(env, 'user.dns', user.username + ' -> ' + entryHost + ' = ' + value);
  return { ok: true, entryHost, target: value, type: result.result?.type || detectRecordType(value), proxied: false, result: result.result };
}

async function userEnsureDNS(env, session) {
  const user = await getUserById(env, session.uid);
  if (!user) return { error: '用户不存在' };
  const root = getUserDomain(env) || getBaseDomain(env);
  if (!root) return { error: '未配置 BASE_DOMAIN / USER_DOMAIN' };
  const entryHost = userEntryHost(env, user);
  // 重新创建时保留用户当前设置的值，没有记录则使用默认优选域名
  const current = await userDnsInfo(env, session);
  let target = current && current.record && current.record.content ? current.record.content : DEFAULT_USER_DNS_TARGET;
  if (target === entryHost) target = root;
  if (target === entryHost) return { error: '入口域名与目标相同，无法创建 CNAME' };
  if (!isValidDnsValue(target)) return { error: '当前 DNS 值不合法，请先保存新的 IP 或域名' };

  const info = await resolveZoneInfo(env, false, root);
  if (!info.zoneId) return { error: info.error || '未解析到 Cloudflare Zone，请检查 CF_API_TOKEN' };

  const result = await createOrUpdateDNSRecord(env, info.zoneId, user.subdomain || user.username, target, root, { proxied: false, saveConfig: false });
  if (!result.success) return { error: result.error || result.errors?.[0]?.message || 'DNS 创建失败', errors: result.errors };
  await auditLog(env, 'user.dns', user.username + ' -> ' + entryHost);
  return { ok: true, entryHost, target, type: result.result?.type || 'CNAME', proxied: false, result: result.result };
}

async function userDnsInfo(env, session) {
  const user = await getUserById(env, session.uid);
  if (!user) return { error: '用户不存在' };
  const entryHost = userEntryHost(env, user);
  const root = getUserDomain(env) || getBaseDomain(env);
  const info = await resolveZoneInfo(env, false, root);
  let record = null;
  if (info.zoneId) {
    try {
      const rr = await getDNSRecords(env, info.zoneId);
      if (rr.success && Array.isArray(rr.result)) {
        const rec = rr.result.find(r => ['A', 'AAAA', 'CNAME'].includes(r.type) && r.name === entryHost);
        if (rec) record = { type: rec.type, name: rec.name, content: rec.content, proxied: rec.proxied, modifiedOn: rec.modified_on };
      }
    } catch (_) {}
  }
  return { ok: true, entryHost, baseDomain: getBaseDomain(env), userDomain: getUserDomain(env), statsHost: getStatsHost(env), defaultTarget: DEFAULT_USER_DNS_TARGET, zoneId: info.zoneId || '', zoneError: info.error || '', record };
}

async function handleUserApi(request, env, url, session) {
  if (!session) return json({ error: 'Unauthorized' }, 401);
  if (!env.DB) return json({ error: 'D1 数据库未绑定' }, 500);

  // CSRF 第二道防线
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const origin = request.headers.get('Origin');
    if (origin && origin !== url.origin) return json({ error: 'Forbidden origin' }, 403);
  }

  if (url.pathname === '/api/user/me' && request.method === 'GET') {
    const user = session.uid === ADMIN_UID ? null : await getUserById(env, session.uid);
    const entryHost = user ? userEntryHost(env, user) : '';
    let routeCount = 0;
    if (user) routeCount = await countUserRoutes(env, user);
    const userDomain = getUserDomain(env) || getBaseDomain(env);
    return json({
      ok: true,
      user: user ? publicUser(user) : { id: 0, username: 'admin', role: 'admin', subdomain: '', routeLimit: 999, status: 'active' },
      baseDomain: getBaseDomain(env),
      userDomain,
      mainHost: getStatsHost(env),
      entryHost,
      entryUrl: entryHost ? 'https://' + entryHost : '',
      routeCount,
      routeLimit: user ? (user.routeLimit || DEFAULT_USER_ROUTE_LIMIT) : 999,
      workerRouteHint: '需要在 Cloudflare 给 Worker 添加路由 ' + (userDomain ? '*.' + userDomain + '/*' : '*/*') + '，子域名请求才会进入 Worker',
    });
  }

  if (url.pathname === '/api/user/routes') {
    if (request.method === 'GET') return json(await userListRoutes(env, session.username));
    if (request.method === 'POST') {
      const data = await readJson(request) || {};
      const out = await userSaveRoute(env, session.username, data);
      return json(out, out.error ? 400 : 200);
    }
    if (request.method === 'DELETE') {
      const out = await userDeleteRoute(env, session.username, url.searchParams.get('prefix'), url.searchParams.get('source'));
      return json(out, out.error ? 404 : 200);
    }
  }

  if (url.pathname === '/api/user/routes/toggle' && request.method === 'POST') {
    const data = await readJson(request) || {};
    const p = normalizePrefix(data.prefix);
    if (!p) return json({ error: '缺少 prefix' }, 400);
    const enabled = data.enabled ? 1 : 0;
    const user = await getUserByUsername(env, session.username);
    if (!user) return json({ error: '用户不存在' }, 404);
    let changes = 0;
    if (data.source === 'legacy' && (await routesHasUserId(env))) {
      const res = await env.DB.prepare('UPDATE routes SET enabled = ? WHERE user_id = ? AND prefix = ?').bind(enabled, user.id, p).run();
      changes = Number(res.meta?.changes) || 0;
    } else {
      const res = await env.DB.prepare('UPDATE user_routes SET enabled = ? WHERE owner = ? AND prefix = ?').bind(enabled, session.username, p).run();
      changes = Number(res.meta?.changes) || 0;
      if (!changes && !data.source && (await routesHasUserId(env))) {
        const res2 = await env.DB.prepare('UPDATE routes SET enabled = ? WHERE user_id = ? AND prefix = ?').bind(enabled, user.id, p).run();
        changes = Number(res2.meta?.changes) || 0;
      }
    }
    if (!changes) return json({ error: '路由不存在' }, 404);
    clearRouteCache();
    return json({ success: true });
  }

  if (url.pathname === '/api/user/routes/reorder' && request.method === 'POST') {
    const data = await readJson(request) || {};
    const order = Array.isArray(data.order) ? data.order.map(normalizePrefix).filter(Boolean) : [];
    if (!order.length) return json({ error: '缺少 order' }, 400);
    const user = await getUserByUsername(env, session.username);
    const hasLegacy = user && (await routesHasUserId(env));
    const jobs = [];
    order.forEach((pf, i) => {
      jobs.push(env.DB.prepare('UPDATE user_routes SET sort_order = ? WHERE owner = ? AND prefix = ?').bind(i, session.username, pf));
      if (hasLegacy) jobs.push(env.DB.prepare('UPDATE routes SET sort_order = ? WHERE user_id = ? AND prefix = ?').bind(i, user.id, pf));
    });
    await env.DB.batch(jobs);
    clearRouteCache();
    return json({ success: true });
  }

  if (url.pathname === '/api/user/routes/test' && request.method === 'POST') {
    const data = await readJson(request) || {};
    const p = normalizePrefix(data.prefix);
    if (!p) return json({ error: '缺少 prefix' }, 400);
    let route = await env.DB.prepare('SELECT target FROM user_routes WHERE owner = ? AND prefix = ?').bind(session.username, p).first();
    if (!route) {
      const user = await getUserByUsername(env, session.username);
      if (user && (await routesHasUserId(env))) {
        route = await env.DB.prepare('SELECT target FROM routes WHERE user_id = ? AND prefix = ? ORDER BY rowid LIMIT 1').bind(user.id, p).first();
      }
    }
    if (!route) return json({ error: '路由不存在' }, 404);
    const targets = splitTargets(route.target);
    const results = await Promise.all(targets.map(async t => ({ target: t, ...(await probeTarget(t)) })));
    return json({ success: true, results });
  }

  if (url.pathname === '/api/user/stats' && request.method === 'GET') {
    return handleStatsRequest(env, url, { owner: session.username });
  }

  if (url.pathname === '/api/user/dns') {
    if (request.method === 'GET') {
      const out = await userDnsInfo(env, session);
      return json(out, out.error ? 400 : 200);
    }
    if (request.method === 'POST') {
      const data = await readJson(request) || {};
      const target = String(data.target || '').trim();
      const out = target ? await userUpdateDns(env, session, target) : await userEnsureDNS(env, session);
      return json(out, out.error ? 400 : 200);
    }
  }

  if (url.pathname === '/api/user/password' && request.method === 'POST') {
    return changePassword(request, env, session);
  }

  if (url.pathname === '/api/user/logout' && request.method === 'POST') return logoutResponse();

  return json({ error: 'Not found' }, 404);
}

// 路由内存缓存：减少每个请求一次 D1 查询（后台改动后本 isolate 立即失效，其余 isolate 最多滞后 TTL）
const routeCache = new Map();
const ROUTE_CACHE_TTL = 30000;

function clearRouteCache() { routeCache.clear(); }

// owner 为空 = 全局路由（与原版完全一致）；owner 有值 = 用户子域名下的私有路由
async function getRouteCached(env, prefix, owner = '') {
  const now = Date.now();
  const cacheKey = (owner || '') + '|' + prefix;
  const hit = routeCache.get(cacheKey);
  if (hit && hit.exp > now) return hit.route;

  let route = null;
  if (owner) {
    route = await env.DB.prepare('SELECT * FROM user_routes WHERE owner = ? AND prefix = ?').bind(owner, prefix).first();
    if (route) route = { ...route, owner };
    // 老库 routes 表里按 user_id 归属的路由：在用户自己的子域名下必须优先用自己的那条。
    // 否则同路径下 id 最小的别人的行会一直抢占，用户自己的路由永远不生效。
    if (!route && (await routesHasUserId(env))) {
      const user = await getUserByUsername(env, owner);
      if (user) {
        const legacy = await env.DB.prepare(
          'SELECT * FROM routes WHERE user_id = ? AND prefix = ? ORDER BY rowid LIMIT 1'
        ).bind(user.id, prefix).first();
        if (legacy) route = { ...legacy, owner, legacyUserId: user.id };
      }
    }
  }
  // 全局回退只认管理员/公共路由（user_id 为空）。用户的历史路由只在本人子域名下生效，
  // 主域名下管理员没添加同路径路由时直接 404（仍可用 /https://... 通用反代）。
  if (!route) {
    if (await routesHasUserId(env)) {
      route = await env.DB.prepare(
        'SELECT * FROM routes WHERE prefix = ? AND (user_id IS NULL OR user_id = 0 OR user_id = \'\') ORDER BY rowid LIMIT 1'
      ).bind(prefix).first();
    } else {
      route = await env.DB.prepare('SELECT * FROM routes WHERE prefix = ?').bind(prefix).first();
    }
  }
  if (routeCache.size > 1000) routeCache.clear();
  routeCache.set(cacheKey, { route: route || null, exp: now + ROUTE_CACHE_TTL });
  return route || null;
}

async function getRoute(env, prefix) {
  return getRouteCached(env, prefix, '');
}

async function resolveProxyTarget(request, env, url) {
  // 不对整条路径 decode：只对首段解码，其余保持原始编码，避免 %2F %23 %3F 被还原后改变上游路径
  const rawSegments = url.pathname.split('/').filter(Boolean);
  let firstSeg = rawSegments[0] || '';
  try { firstSeg = decodeURIComponent(firstSeg); } catch { return { error: new Response('Bad Request', { status: 400 }) }; }
  const prefix = normalizePrefix(firstSeg);
  if (!prefix) return { error: new Response('Not Found', { status: 404 }) };

  const routeOwner = await resolveOwnerFromHost(env, url.hostname);
  const route = await getRouteCached(env, prefix, routeOwner);
  if (!route) return { error: new Response('404: 节点不存在', { status: 404 }) };
  if (route.enabled === 0) return { error: new Response('503: 该路由已停用', { status: 503 }) };

  const clientIp = request.headers.get('cf-connecting-ip') || '';
  const allow = parseIpList(route.ip_allow);
  const block = parseIpList(route.ip_block);
  if (block.length && ipMatches(clientIp, block)) return { error: new Response('Forbidden', { status: 403 }) };
  if (allow.length && !ipMatches(clientIp, allow)) return { error: new Response('Forbidden', { status: 403 }) };

  const enableCache = route.cache_img !== 'off';
  const compatMode = route.compat_mode === 'on';
  const rest = url.pathname.replace(/^\/[^/]*/, '');
  const targetUrls = splitTargets(route.target);

  const upstreamUrls = [];
  for (const target of targetUrls) {
    try {
      const t = new URL(target);
      const base = t.pathname.replace(/\/+$/, '');
      upstreamUrls.push(t.origin + base + rest + url.search);
    } catch {
      upstreamUrls.push(target.replace(/\/+$/, '') + rest + url.search);
    }
  }

  return {
    upstreamUrls, enableCache, compatMode,
    clientIpMode: normalizeIpMode(route.ip_mode),
    matchedPrefix: route.prefix,
    statPrefix: route.owner ? (route.owner + '/' + route.prefix) : route.prefix,
    routeOwner: route.owner || '',
    legacyUserId: route.legacyUserId || 0,
    customHeaders: parseHeaderLines(route.custom_headers).headers,
  };
}

function normalizeAlias(a) {
  return String(a || '').trim().toLowerCase().replace(/^\/+|\/+$/g, '');
}

const SENSITIVE_REQ_HEADERS = Object.freeze(['authorization', 'cookie', 'x-emby-token', 'x-mediabrowser-token', 'x-emby-authorization']);
const hostDownUntil = new Map();
const HOST_DOWN_MS = 30000;
const lastPlayTouched = new Map();
const LAST_PLAY_THROTTLE_MS = 60000;
const API_TIMEOUT_MS = 15000;

// 统一构造上游请求头：先清理，再设置（修复原先"先 set 后被 DROP 删除"的顺序错误）
function buildUpstreamHeaders(request, upstreamUrl, { ipMode, compatMode, crossOrigin = false }) {
  const headers = new Headers(request.headers);
  for (const h of DROP_REQUEST_HEADERS) headers.delete(h);
  headers.delete('referer');
  if (crossOrigin) for (const h of SENSITIVE_REQ_HEADERS) headers.delete(h);

  headers.set('Host', upstreamUrl.host);
  if (ipMode === 'forward') {
    const clientIp = request.headers.get('cf-connecting-ip');
    if (clientIp) {
      headers.set('x-forwarded-for', clientIp);
      headers.set('x-real-ip', clientIp);
    }
  } else if (ipMode === 'disable') {
    stripClientIdentityHeaders(headers);
  }
  if (compatMode) {
    headers.set('Origin', upstreamUrl.origin);
    headers.set('X-Forwarded-Proto', upstreamUrl.protocol.replace(':', ''));
    headers.set('X-Forwarded-Host', upstreamUrl.host);
  }
  return headers;
}

function progressKeyOf(request) {
  const u = new URL(request.url);
  const auth = request.headers.get('x-emby-authorization') || '';
  const dm = auth.match(/DeviceId="?([^",]+)/i);
  const device = u.searchParams.get('DeviceId') || request.headers.get('x-emby-device-id') || (dm && dm[1]) || '';
  const session = u.searchParams.get('PlaySessionId') || '';
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  return 'progress:' + ip + ':' + device + ':' + session;
}

async function proxyDirectUrl(request, env, ctx, upstreamUrls, opts = {}) {
  const { enableCache = true, compatMode = false, clientIpMode = 'forward', matchedPrefix = null, statPrefix = null, routeOwner = '', legacyUserId = 0, customHeaders = [] } = opts;
  const ipMode = normalizeIpMode(clientIpMode);
  const settings = await getSettings(env);

  if (!upstreamUrls.length) return new Response('404: Target empty', { status: 404 });

  let firstUpstreamUrl;
  try {
    firstUpstreamUrl = new URL(upstreamUrls[0]);
  } catch {
    return new Response('Invalid upstream URL', { status: 500 });
  }

  const pathname = firstUpstreamUrl.pathname;
  const reqCategory = classifyRequest(pathname, request.method);
  const isPlaybackInfo = reqCategory === 'playback_info';
  const isPlaying = reqCategory === 'playing';
  const isPlayStart = isPlaying && /\/Sessions\/Playing\/?$/i.test(pathname);

  if (!['streaming', 'segment', 'image', 'static'].includes(reqCategory) &&
      rateLimited(request.headers.get('cf-connecting-ip') || 'unknown', settings.rateLimitPerMin)) {
    return new Response('429: Too Many Requests', { status: 429, headers: { 'Retry-After': '30' } });
  }

  // Progress 心跳节流：同一 IP + 设备 + 播放会话 30 秒内只放行一次，其余直接返回 204，不转发上游
  if (/\/Sessions\/Playing\/Progress\/?$/i.test(pathname)) {
    const progressKey = progressKeyOf(request);
    const last = progressMap.get(progressKey) || 0;
    const now = Date.now();
    if (now - last < PROGRESS_THROTTLE_MS) {
      return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
    }
    progressMap.set(progressKey, now);
    if (progressMap.size > PROGRESS_MAP_MAX) {
      const cutoff = now - 60000;
      for (const [k, v] of progressMap) {
        if (v < cutoff) progressMap.delete(k);
        if (progressMap.size <= PROGRESS_MAP_MAX / 2) break;
      }
    }
  }

  // 统计：同步入内存缓冲，D1 写入放到 waitUntil 批量完成，不阻塞响应
  const recordStats = (bytes) => {
    if (!CONFIG.enableStats || !env.DB) return;
    const nowTs = Date.now();
    const statsKey = statPrefix != null ? statPrefix : matchedPrefix;
    bufferHourlyStats({ isPlay: isPlayStart, isPlaybackInfo, bytes, timestamp: nowTs, prefix: statsKey, owner: routeOwner });
    if (statsBufferCount >= STATS_FLUSH_EVERY || nowTs - statsLastFlush > STATS_FLUSH_MS) {
      ctx.waitUntil(flushHourlyStats(env));
    }
    if (matchedPrefix && (isPlaybackInfo || isPlaying || reqCategory === 'streaming')) {
      const lastPlayKey = (routeOwner ? routeOwner + '/' : '') + matchedPrefix;
      const lt = lastPlayTouched.get(lastPlayKey) || 0;
      if (nowTs - lt > LAST_PLAY_THROTTLE_MS) {
        lastPlayTouched.set(lastPlayKey, nowTs);
        const nowTime = new Date(nowTs + 8 * 3600000).toISOString().replace('T', ' ').split('.')[0];
        let lastPlaySql, lastPlayArgs;
        if (legacyUserId) {
          // 老库按 user_id 归属的路由，仍写在 routes 表
          lastPlaySql = 'UPDATE routes SET last_play = ? WHERE user_id = ? AND prefix = ?';
          lastPlayArgs = [nowTime, legacyUserId, matchedPrefix];
        } else if (routeOwner) {
          lastPlaySql = 'UPDATE user_routes SET last_play = ? WHERE owner = ? AND prefix = ?';
          lastPlayArgs = [nowTime, routeOwner, matchedPrefix];
        } else {
          lastPlaySql = 'UPDATE routes SET last_play = ? WHERE prefix = ?';
          lastPlayArgs = [nowTime, matchedPrefix];
        }
        ctx.waitUntil(
          env.DB.prepare(lastPlaySql).bind(...lastPlayArgs).run().catch(() => {})
        );
      }
    }
  };

  // 包装响应体：按【实际发送】的字节记账。
  // 以前只要有 content-length 就立刻按声明长度记账，Emby 播放时客户端缓冲够了/拖动进度
  // 会提前断开，结果把整个文件长度都算成流量（实测虚高 5~8 倍）。
  // 现在只对小响应（≤ 1 MB，图片/JSON/字幕等）用 content-length 快速路径，
  // 视频/分段等大响应一律走计数流，客户端断开时按已发送字节结算。
  const SMALL_BODY_BYTES = 1024 * 1024;
  const meterBody = (response) => {
    if (!response.body) { recordStats(0); return null; }
    const cl = parseInt(response.headers.get('content-length') || '', 10);
    if (Number.isFinite(cl) && cl >= 0 && cl <= SMALL_BODY_BYTES) { recordStats(cl); return response.body; }
    return countingBody(response.body, recordStats);
  };

  const upgradeHeader = request.headers.get('Upgrade');
  if (upgradeHeader?.toLowerCase() === 'websocket') {
    if (ipMode === 'forward') {
      return fetch(upstreamUrls[0], request);
    }
    const wsHeaders = new Headers(request.headers);
    if (ipMode === 'disable') {
      stripClientIdentityHeaders(wsHeaders);
    } else {
      wsHeaders.delete('x-real-ip');
      wsHeaders.delete('x-forwarded-for');
      wsHeaders.delete('forwarded');
    }
    return fetch(upstreamUrls[0], new Request(upstreamUrls[0], { method: request.method, headers: wsHeaders }));
  }

  // Edge Cache：仅 GET、无 Range；图片在请求头携带凭据时不缓存，避免跨用户共享
  const hasAuthHeader = SENSITIVE_REQ_HEADERS.some(h => request.headers.has(h));
  const canUseCache = enableCache && isCacheableRequest(reqCategory) && request.method === 'GET' &&
    !request.headers.has('Range') && !(reqCategory === 'image' && hasAuthHeader);
  const cacheKey = canUseCache ? new Request(request.url, { method: 'GET' }) : null;

  if (canUseCache) {
    try {
      const cachedResponse = await caches.default.match(cacheKey);
      if (cachedResponse) {
        const headers = new Headers(cachedResponse.headers);
        headers.set('X-Cache', 'HIT');
        applySecurityHeaders(headers);
        recordStats(getResponseBytes(cachedResponse));
        return new Response(cachedResponse.body, { status: cachedResponse.status, statusText: cachedResponse.statusText, headers });
      }
    } catch (_) {}
  }

  let requestBody = null;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    requestBody = await request.arrayBuffer();
  }

  const timeoutSignal = () =>
    (isPlaybackInfo || isPlaying || reqCategory === 'api') && typeof AbortSignal.timeout === 'function'
      ? AbortSignal.timeout(API_TIMEOUT_MS) : undefined;

  let finalResponse = null;
  let fallbackResponse = null;
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

    // 熔断：近期失败的线路短时间内跳过（最后一条线路始终尝试）
    if (i < upstreamUrls.length - 1 && (hostDownUntil.get(upstreamUrl.host) || 0) > Date.now()) {
      lastError = lastError || new Error('线路暂时不可用: ' + upstreamUrl.host);
      continue;
    }

    const colo = request.cf?.colo;
    if (colo && JP_COLOS.includes(colo)) {
      for (const suffix in settings.domainProxyRules) {
        if (upstreamUrl.host.endsWith(suffix)) {
          upstreamUrl.hostname = settings.domainProxyRules[suffix];
          break;
        }
      }
    }

    const headers = buildUpstreamHeaders(request, upstreamUrl, { ipMode, compatMode });
    for (const [k, v] of customHeaders) headers.set(k, v);

    const rangeHeader = request.headers.get('Range');
    if (rangeHeader && (reqCategory === 'streaming' || reqCategory === 'segment' || reqCategory === 'other')) {
      if (!headers.has('Range')) headers.set('Range', rangeHeader);
      const ifRange = request.headers.get('If-Range');
      if (ifRange && !headers.has('If-Range')) headers.set('If-Range', ifRange);
    }

    const fetchInit = {
      method: request.method,
      headers,
      redirect: compatMode ? 'follow' : 'manual',
    };
    if (requestBody) fetchInit.body = requestBody;
    const sig = timeoutSignal();
    if (sig) fetchInit.signal = sig;

    try {
      const response = await fetch(new Request(upstreamUrl.toString(), fetchInit));
      if (!compatMode && [502, 503, 504].includes(response.status)) {
        lastError = new Error(`HTTP ${response.status}`);
        hostDownUntil.set(upstreamUrl.host, Date.now() + HOST_DOWN_MS);
        fallbackResponse = response;
        continue;
      }
      hostDownUntil.delete(upstreamUrl.host);
      finalResponse = response;
      lastUpstreamUrl = upstreamUrl;
      break;
    } catch (err) {
      lastError = err;
      hostDownUntil.set(upstreamUrl.host, Date.now() + HOST_DOWN_MS);
      continue;
    }
  }

  if (!finalResponse && fallbackResponse) {
    // 所有线路都返回 5xx：把最后一个上游响应原样透传，比统一 502 更便于排查
    finalResponse = fallbackResponse;
    lastUpstreamUrl = null;
  }

  if (!finalResponse) {
    return new Response('所有线路不可用: ' + (lastError?.message || 'Unknown'), { status: 502 });
  }

  if (!compatMode && lastUpstreamUrl) {
    const location = finalResponse.headers.get('Location');
    if (location && finalResponse.status >= 300 && finalResponse.status < 400) {
      let redirectUrl;
      try { redirectUrl = new URL(location, lastUpstreamUrl); } catch { return new Response('Bad redirect location', { status: 502 }); }
      if (redirectUrl.protocol !== 'http:' && redirectUrl.protocol !== 'https:') {
        return new Response('Bad redirect location', { status: 502 });
      }

      if (MANUAL_REDIRECT_DOMAINS.concat(settings.manualDomains).some(domain => redirectUrl.hostname === domain || redirectUrl.hostname.endsWith('.' + domain))) {
        const newHeaders = sanitizeResponseHeaders(finalResponse.headers);
        newHeaders.set('Location', redirectUrl.toString());
        applySecurityHeaders(newHeaders);
        recordStats(0);
        return new Response(finalResponse.body, { status: finalResponse.status, headers: newHeaders });
      }

      if (isPrivateHost(redirectUrl.hostname)) {
        return new Response('Redirect target not allowed', { status: 502 });
      }

      // 跨域重定向时不携带 Token / Cookie / Authorization，避免泄露给第三方域名
      const crossOrigin = redirectUrl.origin !== lastUpstreamUrl.origin;
      const newReqHeaders = buildUpstreamHeaders(request, redirectUrl, { ipMode, compatMode: false, crossOrigin });
      const redirectInit = { method: request.method, headers: newReqHeaders, body: requestBody || undefined, redirect: 'follow' };
      const rsig = timeoutSignal();
      if (rsig) redirectInit.signal = rsig;
      try {
        finalResponse = await fetch(redirectUrl.toString(), redirectInit);
      } catch (err) {
        return new Response('重定向目标不可用: ' + (err?.message || 'Unknown'), { status: 502 });
      }
      // 不 return：继续走下面统一的响应头清理 / 安全头 / CORS / 统计流程
    }
  }

  const responseHeaders = sanitizeResponseHeaders(finalResponse.headers);
  responseHeaders.set('Access-Control-Allow-Origin', '*');
  responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  responseHeaders.set('Access-Control-Allow-Headers', '*');
  applySecurityHeaders(responseHeaders);

  if (isPlaying || isPlaybackInfo) {
    responseHeaders.set('X-Served-By', request.cf?.colo || 'Unknown');
  }

  const body = meterBody(finalResponse);

  // Edge Cache: 只缓存 200、且上游未下发 Set-Cookie 的图片 / 静态资源
  if (canUseCache && finalResponse.status === 200 && !finalResponse.headers.has('Set-Cookie')) {
    const maxAge = reqCategory === 'image' ? 2592000 : 86400;
    responseHeaders.set('Cache-Control', `public, max-age=${maxAge}`);
    responseHeaders.set('X-Cache', 'MISS');
    const responseToCache = new Response(body, { status: finalResponse.status, statusText: finalResponse.statusText, headers: responseHeaders });
    ctx.waitUntil(caches.default.put(cacheKey, responseToCache.clone()).catch(() => {}));
    return responseToCache;
  }

  return new Response(body, {
    status: finalResponse.status,
    statusText: finalResponse.statusText,
    headers: responseHeaders,
  });
}

// 浏览器端测速（在访问者自己的网络里测到各优选域名的真实延迟）。
// 注意：此段位于模板字符串内，不要使用反引号、美元花括号和反斜杠。
const SPEED_TOOLS = `
function pingOnce(url, timeout) {
  return new Promise(function(resolve) {
    var t0 = performance.now(), settled = false;
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function() { if (ctrl) ctrl.abort(); fin(-1); }, timeout);
    function fin(ms) { if (settled) return; settled = true; clearTimeout(timer); resolve(ms); }
    var bust = (url.indexOf('?') >= 0 ? '&' : '?') + '_=' + Date.now() + Math.random().toString(36).slice(2);
    fetch(url + bust, { mode: 'no-cors', cache: 'no-store', credentials: 'omit', signal: ctrl ? ctrl.signal : undefined })
      .then(function() { fin(Math.round(performance.now() - t0)); })
      .catch(function() { fin(-1); });
  });
}

// 同一域名顺序测多次（后续请求复用连接，反映稳定往返延迟），取中位数；失败过半视为不可用
async function measureDomain(host, samples, timeout) {
  var times = [];
  for (var i = 0; i < samples; i++) {
    var ms = await pingOnce('https://' + host + '/cdn-cgi/trace', timeout);
    if (ms >= 0) times.push(ms);
  }
  if (times.length < Math.ceil(samples / 2)) return -1;
  times.sort(function(a, b) { return a - b; });
  return times[Math.floor(times.length / 2)];
}

async function runPool(items, limit, fn) {
  var out = new Array(items.length), idx = 0;
  async function w() { while (idx < items.length) { var i = idx++; out[i] = await fn(items[i]); } }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, w));
  return out;
}

function latencyLabel(ms) { return ms < 0 ? 'timeout' : ms < 100 ? 'fast' : ms < 300 ? 'good' : 'slow'; }

async function speedTestDomains(domains, onProgress) {
  var done = 0;
  var rows = await runPool(domains, 3, async function(d) {
    var ms = await measureDomain(d.domain, 4, 4000);
    done++;
    if (onProgress) onProgress(done, domains.length);
    return { id: d.id, domain: d.domain, name: d.name, host: d.domain, latency: ms, status: latencyLabel(ms), isBuiltin: d.isBuiltin };
  });
  rows.sort(function(a, b) { if (a.latency < 0) return 1; if (b.latency < 0) return -1; return a.latency - b.latency; });
  return rows;
}
`;

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

  /* 审计日志：操作列不换行/不裁切，详情列允许换行 */
  #auditList td:nth-child(1) { white-space: nowrap; color: var(--text-faint); font-size: 12.5px; }
  #auditList td:nth-child(2) { white-space: nowrap; font-weight: 600; }
  #auditList td:nth-child(2) code { white-space: nowrap; }
  #auditList td:nth-child(3) { color: var(--text-dim); word-break: break-word; min-width: 220px; }
  #auditList th:nth-child(2) { white-space: nowrap; }

  .tag { display: inline-flex; align-items: center; padding: 3px 9px; border-radius: 5px; font-size: 11px; font-weight: 600; }
  .tag-fast { background: var(--ok-dim); color: var(--ok); }
  .tag-good { background: var(--info-dim); color: var(--info); }
  .tag-slow { background: var(--warn-dim); color: var(--warn); }
  .tag-timeout { background: var(--bad-dim); color: var(--bad); }
  .tag-builtin { background: var(--surface-2); color: var(--text-faint); border: 1px solid var(--line); }
  .tag-best { background: var(--ok-dim); color: var(--ok); border: 1px solid var(--ok); }

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
  textarea {
    display: block; min-height: 84px; padding: 10px 13px; font-size: 12.5px; line-height: 1.6;
    font-family: ui-monospace, 'SF Mono', 'Cascadia Code', Consolas, monospace;
    white-space: pre-wrap; overflow-wrap: anywhere; resize: vertical;
  }
  input:focus, select:focus, textarea:focus { border-color: var(--accent-line); box-shadow: 0 0 0 3px var(--accent-dim); }
  input::placeholder, textarea::placeholder { color: var(--text-faint); }
  label { display: block; font-weight: 600; margin-bottom: 8px; font-size: 12.5px; color: var(--text-dim); }

  .toolbar { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }

  .dns-quick { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 10px 12px; margin-bottom: 8px; border: 1px solid var(--line); border-radius: var(--radius-s); background: var(--surface-2); }
  .dns-quick-tag { font-family: ui-monospace, 'SF Mono', Consolas, monospace; font-size: 10px; font-weight: 700; letter-spacing: .12em; color: var(--accent); border: 1px solid var(--accent-line); background: var(--accent-dim); border-radius: 4px; padding: 3px 8px; }
  .dns-quick input { flex: 1 1 160px; min-width: 120px; padding: 8px 12px; font-size: 13px; }
  .dns-quick-arrow { color: var(--text-faint); font-size: 13px; }
  @media (max-width: 768px) { .dns-quick input { flex: 1 1 100%; } }

  .route-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(330px, 1fr)); gap: 14px; }
  .route-item { background: var(--surface-2); border: 1px solid var(--line); border-radius: var(--radius-s); padding: 18px; transition: border-color .2s ease, transform .2s ease; }
  .route-item:hover { border-color: var(--accent-line); transform: translateY(-2px); }
  .route-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
  .route-title { flex: 1; min-width: 0; }
  .route-name { font-size: 1.05em; font-weight: 700; color: var(--text); margin: 0 0 3px; }
  .route-path { color: var(--accent); font-weight: 600; font-size: .85em; font-family: ui-monospace, 'SF Mono', Consolas, monospace; }
  .route-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 14px; padding-top: 13px; border-top: 1px solid var(--line); }
  .target-list { margin-top: 8px; }
  .target-row { background: var(--input-bg); border: 1px solid var(--line); border-radius: 6px; padding: 9px 12px; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center; gap: 12px; }
  .target-row:hover { border-color: var(--line-strong); }
  .target-url { color: var(--text-dim); font-size: 12.5px; word-break: break-all; flex: 1; }
  .route-meta { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 10px; }
  .meta-tag { font-size: 11px; padding: 3px 8px; background: var(--surface-2); border: 1px solid var(--line); border-radius: 5px; color: var(--text-dim); }

  .modal { display: none; position: fixed; inset: 0; background: rgba(2,6,12,.6); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); z-index: 1000; padding: 20px; overflow: auto; }
  .modal.show { display: flex; align-items: center; justify-content: center; animation: fadeIn .18s ease; }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  .modal-inner { background: var(--surface); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); padding: 26px; border-radius: var(--radius); max-width: 520px; width: 100%; border: 1px solid var(--line-strong); box-shadow: var(--shadow); animation: slideUp .22s cubic-bezier(.22,1,.36,1); }
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

  #toast {
    position: fixed; top: -70px; left: 50%; transform: translateX(-50%);
    background: var(--surface); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
    color: var(--text); padding: 12px 22px; border-radius: 14px; font-size: 13.5px; font-weight: 500; line-height: 1.5; text-align: left;
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

// ==================== 主题控制（自动白天/夜晚 + 手动切换） ====================
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
`;

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
        <div class="dim"># 添加服务后请务必手动测试 · 恶意刷接口将封禁 IP</div>
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
    <div class="sec-title">使用统计 <span class="chip">CF&nbsp;ANALYTICS</span></div>
    <div id="stats-loading" class="muted"><span class="spin"></span>加载中...</div>
    <div id="stats-body" style="display:none">
      <div class="stat-row">
        <div class="stat-card"><div>今日请求</div><div class="stat-val" id="st-req">0</div><div class="stat-sub" id="st-req-sub"></div></div>
        <div class="stat-card"><div>今日流量</div><div class="stat-val" id="st-traffic">0 B</div><div class="stat-sub" id="st-traffic-sub"></div></div>
        <div class="stat-card"><div>今日访问</div><div class="stat-val" id="st-uv">0</div><div class="stat-sub" id="st-uv-sub"></div></div>
      </div>
      <div id="hourly-chart"></div>
      <p class="muted" style="font-size:11px;margin-top:8px" id="st-updated"></p>
    </div>
  </div>
</div>
<script>${THEME_LOGIC}
var TAG = { fast:'极快', good:'良好', slow:'较慢', timeout:'超时' };
var CLS = { fast:'tag-fast', good:'tag-good', slow:'tag-slow', timeout:'tag-timeout' };

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
    ].map(function(kv){ return '<div class="edge-item"><strong>'+kv[0]+'</strong><span>'+(kv[1]||'—')+'</span></div>'; }).join('');
  } catch(e) { document.getElementById('edge-loading').textContent = '加载失败'; }
}

function renderDomainTable(results, best) {
  const wrap = document.getElementById('domain-table-wrap');
  if (!results.length) { wrap.innerHTML = '<p class="muted">无数据</p>'; return; }
  let html = '<div style="overflow-x:auto;-webkit-overflow-scrolling:touch"><table style="min-width:520px"><thead><tr><th>#</th><th>名称</th><th>域名</th><th>延迟</th><th>状态</th></tr></thead><tbody>';
  results.forEach((r, i) => {
    const host = r.host || r.domain;
    const isBest = best && best.domain === r.domain;
    const pct = r.latency >= 0 ? Math.max(5, Math.min(100, Math.round(r.latency / 3))) : 0;
    html += '<tr class="'+(isBest?'best':'')+'"><td class="mono" style="color:var(--text-faint)">'+(i+1)+'</td>'
      + '<td style="white-space:nowrap">'+ (r.name||'—') + (isBest?' <span class="tag tag-best">BEST</span>':'') +'</td>'
      + '<td><code style="font-size:12px">'+host+'</code></td>'
      + '<td><div class="lat"><div class="lat-bar"><i style="width:'+pct+'%"></i></div><span>'+(r.latency>=0?r.latency+' ms':'—')+'</span></div></td>'
      + '<td><span class="tag '+CLS[r.status||'timeout']+'">'+(TAG[r.status]||'—')+'</span></td></tr>';
  });
  wrap.innerHTML = html + '</tbody></table></div>';
}

${SPEED_TOOLS}

function finalizeResults(rows) {
  rows.forEach(r => { if (r.latency >= 0) r.status = r.latency < 100 ? 'fast' : r.latency < 300 ? 'good' : 'slow'; else r.status = 'timeout'; });
  rows.sort((a,b) => { if (a.latency<0) return 1; if (b.latency<0) return -1; return a.latency-b.latency; });
  return rows;
}

async function getOptimizedDomains() {
  try {
    const r = await fetch('/api/domains/list');
    const d = await r.json();
    if (d.success) return d.domains;
  } catch (_) {}
  return [];
}

async function runDomainSpeed(force) {
  const st = document.getElementById('speed-status');
  const wrap = document.getElementById('domain-table-wrap');
  st.textContent = '正在测速...';
  wrap.innerHTML = '<p class="muted"><span class="spin"></span>正在测试您本地网络到各优选域名的延迟...</p>';

  const domains = await getOptimizedDomains();
  const clientResults = await speedTestDomains(domains, function(d, n) { st.textContent = '正在测速 ' + d + '/' + n + '（在您本机浏览器中进行，每个域名测 4 次取中位数）'; });
  finalizeResults(clientResults);
  const clientOk = clientResults.filter(r => r.latency >= 0).length;
  const best = clientResults.find(r => r.latency >= 0);
  renderDomainTable(clientResults, best);

  if (clientOk > 0) {
    st.textContent = '测速完成 · ' + clientOk + ' 个可用 · 推荐: ' + (best ? best.domain : '无');
  } else {
    st.textContent = '测速失败，请检查网络或稍后重试';
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
    document.getElementById('st-req-sub').textContent = '来源: ' + (d.data.d1 && d.data.d1.requests ? 'Worker 实际转发（D1）' : 'CF Zone Analytics');
    document.getElementById('st-traffic').textContent = d.data.todayTraffic || '0 B';
    document.getElementById('st-traffic-sub').textContent = '来源: ' + (d.data.d1 && d.data.d1.trafficBytes ? 'Worker 出站流量（D1）' : 'CF edgeResponseBytes');
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

document.getElementById('btn-retest').onclick = () => runDomainSpeed(true);
loadEdge();
runDomainSpeed(false);
loadStats();
</script></body></html>`;
}

function buildLoginHtml() {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light"><meta name="theme-color" content="#06090f">
<title>登录</title><link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🔐</text></svg>">
<script>${THEME_INIT}</script>
<style>${PAGE_STYLE}</style></head><body>
<div class="login-wrap">
  <div class="login-theme"><button class="theme-toggle" id="themeToggle" onclick="cycleTheme()">AUTO</button></div>
  <div class="login-box">
    <div style="text-align:center;margin-bottom:26px">
      <div class="hero-kicker" style="margin-bottom:10px">MULTI&nbsp;USER&nbsp;ACCESS</div>
      <h1 style="font-size:1.5em;font-weight:800;letter-spacing:-.01em">登录</h1>
      <p class="muted" style="margin-top:8px">普通用户输入用户名 + 密码；管理员用户名填 admin（或留空）并使用管理密钥</p>
    </div>
    <form onsubmit="login();return false">
      <input id="usernameInput" placeholder="用户名（管理员填 admin 或留空）" autocomplete="username" autocapitalize="off" style="margin-bottom:10px">
      <input type="password" id="passwordInput" placeholder="密码 / 管理密钥" autocomplete="current-password" style="margin-bottom:10px">
      <p id="loginErr" style="color:var(--bad);font-size:13px;min-height:1.4em;margin:6px 0;text-align:center"></p>
      <button class="btn btn-solid" style="width:100%;padding:12px" id="loginBtn" type="submit">登 录</button>
    </form>
    <p class="muted" style="text-align:center;margin-top:16px;font-size:13px">
      没有账号？<a href="/register" style="color:var(--accent)">使用邀请码注册</a>
    </p>
  </div>
</div>
<script>${THEME_LOGIC}
async function login(){
  const u=document.getElementById('usernameInput').value.trim();
  const p=document.getElementById('passwordInput').value;
  const err=document.getElementById('loginErr');
  const btn=document.getElementById('loginBtn');
  err.textContent='';
  if(!p){ err.textContent='请输入密码 / 管理密钥'; return; }
  btn.disabled=true; btn.textContent='验证中...';
  const body = u ? {username:u,password:p} : {token:p};
  try{
    const r=await fetch('/admin/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const d=await r.json();
    if(d.ok){ location.href='/admin'; return; }
    err.textContent=d.error||'登录失败';
  } catch(e){ err.textContent='请求失败: '+e.message; }
  btn.disabled=false; btn.textContent='登 录';
}
</script></body></html>`;
}

function buildRegisterHtml(env) {
  const userDomain = (typeof getUserDomain === 'function' ? getUserDomain(env) : '') || '';
  const entryExample = userDomain ? '用户名.' + userDomain : '用户名.根域名';
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light"><meta name="theme-color" content="#06090f">
<title>注册</title><link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎫</text></svg>">
<script>${THEME_INIT}</script>
<style>${PAGE_STYLE}</style></head><body>
<div class="login-wrap">
  <div class="login-theme"><button class="theme-toggle" id="themeToggle" onclick="cycleTheme()">AUTO</button></div>
  <div class="login-box">
    <div style="text-align:center;margin-bottom:22px">
      <div class="hero-kicker" style="margin-bottom:10px">INVITE&nbsp;ONLY</div>
      <h1 style="font-size:1.5em;font-weight:800;letter-spacing:-.01em">注册账号</h1>
      <p class="muted" style="margin-top:8px">注册后自动获得独立子域名，并自动创建 <code>${entryExample}</code> 的 DNS 记录</p>
    </div>
    <form onsubmit="register();return false">
      <input id="regInvite" placeholder="邀请码" autocapitalize="characters" style="margin-bottom:10px">
      <input id="regUsername" placeholder="用户名（3-32 位小写字母/数字/-）" autocomplete="username" autocapitalize="off" style="margin-bottom:10px">
      <p class="form-hint" style="margin:-4px 0 10px;text-align:left">用户名同时作为 DNS 前缀，不能以 - 开头或结尾</p>
      <input type="password" id="regPassword" placeholder="密码（至少 6 位）" autocomplete="new-password" style="margin-bottom:10px">
      <input type="password" id="regPassword2" placeholder="确认密码" autocomplete="new-password" style="margin-bottom:10px">
      <p id="regErr" style="color:var(--bad);font-size:13px;min-height:1.4em;margin:6px 0;text-align:center"></p>
      <button class="btn btn-solid" style="width:100%;padding:12px" id="regBtn" type="submit">注 册</button>
    </form>
    <p class="muted" style="text-align:center;margin-top:16px;font-size:13px">
      已有账号？<a href="/admin" style="color:var(--accent)">返回登录</a>
    </p>
  </div>
</div>
<script>${THEME_LOGIC}
async function register(){
  const invite=document.getElementById('regInvite').value.trim();
  const username=document.getElementById('regUsername').value.trim();
  const password=document.getElementById('regPassword').value;
  const password2=document.getElementById('regPassword2').value;
  const err=document.getElementById('regErr');
  const btn=document.getElementById('regBtn');
  err.textContent='';
  if(!invite){ err.textContent='请输入邀请码'; return; }
  if(!username){ err.textContent='请输入用户名'; return; }
  if(!/^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/.test(username.toLowerCase())){ err.textContent='用户名需为 3-32 位小写字母、数字或短横线，且不能以 - 开头/结尾'; return; }
  if(password.length<6){ err.textContent='密码至少 6 位'; return; }
  if(password!==password2){ err.textContent='两次输入的密码不一致'; return; }
  btn.disabled=true; btn.textContent='注册中...';
  try{
    const r=await fetch('/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({invite,username,password})});
    const d=await r.json();
    if(d.ok){
      if(d.dnsWarning){ alert('账号已创建，但 DNS 记录自动创建失败：' + d.dnsWarning + '\\n\\n登录后可在「我的入口」中重试。'); }
      location.href='/admin'; return;
    }
    err.textContent=d.error||'注册失败';
  } catch(e){ err.textContent='请求失败: '+e.message; }
  btn.disabled=false; btn.textContent='注 册';
}
</script></body></html>`;
}

function buildAdminHtml(session, env) {
  const isAdmin = Boolean(session && session.isAdmin);
  const username = String((session && session.username) || 'user').replace(/[^a-z0-9_-]/gi, '') || 'user';
  const roleLabel = isAdmin ? 'ADMIN' : 'USER';
  const consoleName = isAdmin ? 'ADMIN' : 'USER';
  const effectiveMainHost = env ? (getStatsHost(env) || getBaseDomain(env) || '') : '';
  const effectiveUserDomain = env ? (getUserDomain(env) || getBaseDomain(env) || '') : '';

  const reportBtn = isAdmin ? '<button class="btn btn-sm" id="btnDailyReport" onclick="sendReport(this)">发送日报</button>' : '';
  const settingsBtn = isAdmin ? '<button class="btn btn-sm" onclick="openSettings()">设置</button>' : '';
  const passwordBtn = isAdmin ? '' : '<button class="btn btn-sm" onclick="changePassword()">改密码</button>';

  const routeToolbar = isAdmin
    ? '<button class="btn btn-sm btn-solid" onclick="openRouteModal()">添加路由</button>'
      + '<button class="btn btn-sm" onclick="location.href=\'/admin/api/export\'">导出配置</button>'
      + '<button class="btn btn-sm" onclick="document.getElementById(\'importFile\').click()">导入配置</button>'
      + '<input type="file" id="importFile" accept="application/json,.json" style="display:none" onchange="importConfig(this)">'
    : '<button class="btn btn-sm btn-solid" onclick="openRouteModal()">添加路由</button>'
      + '<span class="muted" id="routeLimitHint"></span>';

  const dnsQuick = isAdmin ? `
    <div class="dns-quick">
      <span class="dns-quick-tag">DNS</span>
      <input id="dnsQuickName" placeholder="记录名（留空 = BASE_DOMAIN）">
      <span class="dns-quick-arrow">→</span>
      <input id="dnsQuickTarget" placeholder="目标域名或 IP（可以直接改）">
      <button class="btn btn-sm btn-solid" id="dnsQuickSave" onclick="quickSaveDNS(this)">保存</button>
      <button class="btn btn-sm" onclick="loadQuickDNS()">刷新</button>
    </div>
    <p class="muted" id="dnsQuickMeta" style="margin:-2px 0 14px;font-size:12px">DNS 记录加载中...</p>` : '';

  const statsCard = `
  <div class="card">
    <div class="sec-title">使用统计 <span class="chip" id="statsChip">D1</span></div>
    <div id="stats-loading" class="muted"><span class="spin"></span>加载中...</div>
    <div id="stats-body" style="display:none">
      <div class="stat-row">
        <div class="stat-card"><div>今日请求</div><div class="stat-val" id="st-req">0</div><div class="stat-sub" id="st-req-sub"></div></div>
        <div class="stat-card"><div>今日流量</div><div class="stat-val" id="st-traffic">0 B</div><div class="stat-sub" id="st-traffic-sub"></div></div>
        <div class="stat-card"><div>今日访问</div><div class="stat-val" id="st-uv">0</div><div class="stat-sub" id="st-uv-sub"></div></div>
      </div>
      <div id="hourly-chart"></div>
      <p class="muted" style="font-size:11px;margin-top:8px" id="st-updated"></p>
    </div>
  </div>`;

  const userEntryCard = isAdmin ? '' : `
  <div class="card">
    <div class="sec-title">我的入口 <span class="chip">ENTRY</span></div>
    <div class="edge-box">
      <div class="edge-item"><strong>用户名</strong><span id="entryUser">${username}</span></div>
      <div class="edge-item"><strong>入口域名</strong><span id="entryHost">加载中...</span></div>
      <div class="edge-item"><strong>路由数量</strong><span id="entryRoutes">—</span></div>
      <div class="edge-item"><strong>DNS 状态</strong><span id="entryDns">加载中...</span></div>
    </div>
    <p class="muted" style="margin-top:12px;font-size:12px" id="entryHint"></p>
    <div class="form-group" style="margin-top:12px">
      <label>DNS 记录值（CNAME 目标，可填 IP 或域名）</label>
      <div class="toolbar" style="flex-wrap:nowrap">
        <input id="entryDnsValue" placeholder="例如 youxuan.cf.090227.xyz 或 1.2.3.4" style="flex:1 1 auto;min-width:0">
        <button class="btn btn-sm btn-solid" style="flex:0 0 auto" onclick="saveUserDNS(this)">保存 DNS 值</button>
      </div>
      <p class="form-hint">保存时会先删除同名旧记录再重新创建，避免类型冲突；新记录默认关闭小黄云。若状态显示「已代理」，保存一次即可改为仅 DNS。</p>
    </div>
    <div class="toolbar" style="margin-top:12px">
      <button class="btn btn-sm" onclick="ensureUserDNS(this)">重新创建 DNS</button>
      <button class="btn btn-sm" onclick="loadUserEntry()">刷新</button>
      <a class="btn btn-sm" id="entryUrl" href="#" target="_blank" rel="noopener">打开入口</a>
    </div>
    <p class="muted" style="margin-top:10px;font-size:12px">访问方式：<code>https://入口域名/路由前缀</code></p>
  </div>`;

  const adminCards = isAdmin ? `
  <div class="card">
    <div class="sec-title">用户管理 <span class="chip" id="userCount"></span></div>
    <div class="toolbar" style="margin-bottom:14px">
      <button class="btn btn-sm btn-solid" onclick="openUserModal()">添加用户</button>
      <button class="btn btn-sm" onclick="loadUsers()">刷新</button>
    </div>
    <div id="userList" class="muted">加载中...</div>
  </div>

  <div class="card">
    <div class="sec-title">邀请码 <span class="chip">INVITE</span></div>
    <div class="toolbar" style="margin-bottom:14px">
      <button class="btn btn-sm btn-solid" onclick="openInviteModal()">生成邀请码</button>
      <button class="btn btn-sm btn-danger" onclick="clearInvites()">删除全部邀请码</button>
      <button class="btn btn-sm" onclick="loadInvites()">刷新</button>
    </div>
    <div id="inviteList" class="muted">加载中...</div>
  </div>

  <div class="card">
    <div class="sec-title">优选域名管理 <span class="chip">CDN</span></div>
    <div class="toolbar" style="margin-bottom:16px">
      <button class="btn btn-sm" onclick="openDomainModal()">添加域名</button>
      <button class="btn btn-sm" onclick="testDomains()">手动测速</button>
      <span id="domain-status" class="muted"></span>
    </div>
    <div id="domainList" class="domain-list"><p class="muted"><span class="spin"></span>加载中...</p></div>
  </div>

  <div class="card">
    <div class="sec-title">操作日志 <span class="chip">AUDIT</span></div>
    <div class="toolbar" style="margin-bottom:16px">
      <button class="btn btn-sm" onclick="loadAudit()">刷新</button>
      <button class="btn btn-sm btn-danger" onclick="resetStats()">清空统计</button>
    </div>
    <div id="auditList" class="muted">点击刷新查看最近 100 条操作</div>
  </div>` : '';

  const adminModals = isAdmin ? `
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
      <input id="domainUrl" type="url" placeholder="https://example.com">
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal('modalDomain')">取消</button>
      <button class="btn btn-solid" onclick="saveDomain()">保存</button>
    </div>
  </div>
</div>

<div id="modalSettings" class="modal">
  <div class="modal-inner">
    <div class="modal-header">
      <h2 class="modal-title">系统设置</h2>
      <p class="modal-desc">定时任务需要在 Cloudflare 控制台为 Worker 添加 Cron 触发器（如 */10 * * * *）</p>
    </div>
    <div class="form-group">
      <label class="checkbox-label"><input type="checkbox" id="setHealth"> 启用线路健康检查（连续 2 次失败告警，恢复时再通知）</label>
      <p class="form-hint" id="notifyHint"></p>
    </div>
    <div class="form-group">
      <label class="checkbox-label"><input type="checkbox" id="setDailyReport" checked> 每天 23:00（北京时间）自动发送 Telegram 日报</label>
      <p class="form-hint">需要给 Worker 配置 Cron 触发器，例如 <code>0 15 * * *</code>；也可以随时点顶部的「发送日报」手动发送</p>
    </div>
    <div class="form-group">
      <label>每 IP 每分钟请求上限（0 = 不限制）</label>
      <input id="setRate" type="number" min="0" placeholder="0">
      <p class="form-hint">仅限制 API 类请求，不影响图片和视频流</p>
    </div>
    <div class="form-group">
      <label>额外的手动重定向域名（逗号分隔）</label>
      <input id="setManual" placeholder="例如 example-cdn.com, other.net">
      <label style="margin-top:12px">域名映射规则（JSON，日本机房使用）</label>
      <textarea id="setRules" rows="2" placeholder='{"example.com":"1.2.3.4"}'></textarea>
    </div>
    <div class="form-group">
      <label>多人版说明</label>
      <p class="form-hint">用户通过 <code>用户名.用户域名</code> 访问自己的路由；需要在 Cloudflare 给 Worker 添加路由 <code>*.${effectiveUserDomain || '用户域名'}/*</code>（或 <code>*/*</code>）。</p>
      <p class="form-hint">当前 Worker 入口：<code>${effectiveMainHost || '未配置'}</code>；用户域名：<code>${effectiveUserDomain || '未配置'}</code></p>
      <p class="form-hint">用户域名自动从现有变量推导，不绑定任何固定域名：默认 = <code>BASE_DOMAIN</code>；如果 <code>BASE_DOMAIN</code> 本身就是 Worker 入口（形如 <code>子域名.example.com</code>）且 <code>DNS_RECORD_NAME</code> 与那一级相同，会自动去掉它，得到 <code>example.com</code>，用户入口就是 <code>用户名.example.com</code>。需要时也可用 <code>USER_DOMAIN</code> 显式指定任意域名。</p>
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="runNow()">立即健康检查</button>
      <button class="btn" onclick="closeModal('modalSettings')">取消</button>
      <button class="btn btn-solid" onclick="saveSettings()">保存</button>
    </div>
  </div>
</div>

<div id="modalUser" class="modal">
  <div class="modal-inner">
    <div class="modal-header">
      <h2 class="modal-title" id="userModalTitle">添加用户</h2>
      <p class="modal-desc">用户将拥有独立的子域名和路由空间</p>
    </div>
    <input type="hidden" id="userId">
    <div class="form-group">
      <label>用户名</label>
      <input id="userUsername" placeholder="3-32 位小写字母/数字/-（同时作为 DNS 记录名）" autocapitalize="off">
    </div>
    <div class="form-group">
      <label>密码</label>
      <input id="userPassword" type="password" placeholder="编辑时留空表示不修改" autocomplete="new-password">
    </div>
    <div class="form-group">
      <label>子域名</label>
      <input id="userSubdomain" placeholder="例如 alice（留空 = 用户名）" autocapitalize="off">
      <p class="form-hint">最终入口：<code>子域名.用户域名</code>；创建用户时会自动建 CNAME（小黄云关闭），用户可在「我的入口」里修改记录值</p>
    </div>
    <div class="form-group">
      <label>角色</label>
      <select id="userRole">
        <option value="user">普通用户</option>
        <option value="admin">管理员</option>
      </select>
    </div>
    <div class="form-group">
      <label>状态</label>
      <select id="userStatus">
        <option value="active">正常</option>
        <option value="disabled">禁用</option>
      </select>
    </div>
    <div class="form-group">
      <label>路由数量上限</label>
      <input id="userRouteLimit" type="number" min="1" max="200" value="20">
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal('modalUser')">取消</button>
      <button class="btn btn-solid" onclick="saveUser()">保存</button>
    </div>
  </div>
</div>

<div id="modalInvite" class="modal">
  <div class="modal-inner">
    <div class="modal-header">
      <h2 class="modal-title">生成邀请码</h2>
      <p class="modal-desc">邀请码用于注册新用户</p>
    </div>
    <div class="form-group">
      <label>邀请码（留空自动生成）</label>
      <input id="inviteCode" placeholder="例如 WELCOME2026" autocapitalize="characters">
    </div>
    <div class="form-group">
      <label>最大使用次数（0 = 不限）</label>
      <input id="inviteMaxUses" type="number" min="0" value="1">
    </div>
    <div class="form-group">
      <label>过期日期（可选）</label>
      <input id="inviteExpires" type="date">
    </div>
    <div class="form-group">
      <label>备注</label>
      <input id="inviteNote" placeholder="例如：给朋友">
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal('modalInvite')">取消</button>
      <button class="btn btn-solid" onclick="saveInvite()">生成</button>
    </div>
  </div>
</div>` : '';

  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light"><meta name="theme-color" content="#06090f">
<title>${consoleName} 控制台</title><link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎛️</text></svg>">
<script>${THEME_INIT}</script>
<style>${PAGE_STYLE}</style></head><body>
<div id="toast"></div>
<div class="container">
  <div class="topbar">
    <a class="brand" href="/"><i class="brand-mark"></i><span class="bname">${consoleName}<span style="color:var(--accent)">·</span>CONSOLE</span></a>
    <div class="topbar-actions">
      <button class="theme-toggle" id="themeToggle" onclick="cycleTheme()">AUTO</button>
      <span class="meta-tag" title="${roleLabel}">${roleLabel} · ${username}</span>
      ${reportBtn}
      ${passwordBtn}
      <a href="/" class="btn btn-sm">首页</a>
      ${settingsBtn}
      <button class="btn btn-sm btn-danger" onclick="logout()">退出</button>
    </div>
  </div>

  ${renderTopLinks(env)}

  <div class="card">
    <div class="sec-title">${isAdmin ? '我添加的全局路由' : '我的路由'} <span class="chip" id="routeCount"></span></div>
    <div class="toolbar" style="margin-bottom:16px">
      ${routeToolbar}
      <div class="search-box">
        <input type="text" id="routeSearch" placeholder="搜索备注或路径..." oninput="filterRoutes()">
      </div>
    </div>
    ${isAdmin ? '<p class="muted" style="margin:-6px 0 14px">只能看到你自己添加的路由；其他管理员和用户的路由不会显示（用户路由仍正常代理）。</p>' : ''}
    ${dnsQuick}
    <div id="routeList" class="route-grid"><p class="muted"><span class="spin"></span>加载中...</p></div>
  </div>

  ${userEntryCard}
  ${statsCard}
  ${adminCards}
</div>

<div id="modalRoute" class="modal">
  <div class="modal-inner">
    <div class="modal-header">
      <h2 class="modal-title" id="routeModalTitle">添加路由</h2>
      <p class="modal-desc">创建路由后可通过 /路径 快捷访问目标服务</p>
    </div>
    <input type="hidden" id="oldPrefix">
    <input type="hidden" id="routeSource">
    <input type="hidden" id="routeId">
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
      <textarea id="routeTarget" rows="3" placeholder="https://emby.example.com:8096&#10;https://emby-backup.example.com:8096"></textarea>
      <p class="form-hint">一行一个地址（也支持逗号分隔），按顺序故障转移</p>
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
      <label>自定义请求头（可选）</label>
      <textarea id="routeHeaders" rows="3" placeholder="User-Agent: Emby/4.8&#10;Origin: https://example.com"></textarea>
      <p class="form-hint">每行一个 Name: Value，会覆盖转发给上游的同名请求头，可用于应对防盗链</p>
    </div>
    <div class="form-group">
      <label>IP 白名单（可选）</label>
      <input id="routeIpAllow" placeholder="留空表示不限制，例如 1.2.3.4, 10.0.0.0/8">
      <label style="margin-top:12px">IP 黑名单（可选）</label>
      <input id="routeIpBlock" placeholder="例如 5.6.7.8">
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal('modalRoute')">取消</button>
      <button class="btn btn-solid" onclick="saveRoute()">保存</button>
    </div>
  </div>
</div>

${adminModals}

<script>${THEME_LOGIC}
var IS_ADMIN = ${isAdmin ? 'true' : 'false'};
var USERNAME = '${username}';
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
        (r.today_req ? '<span class="meta-tag">📊 今日 ' + r.today_req + ' 次 / ' + fmtB(r.today_bytes) + '</span>' : '') +
        (r.last_play ? '<span class="meta-tag">📺 ' + esc(r.last_play) + '</span>' : '') +
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
  document.getElementById('routeTarget').value = String(r.target || '').split(',').map(function(x) { return x.trim(); }).filter(Boolean).join('\\n');
  document.getElementById('routeCache').checked = r.cache_img !== 'off';
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
  const target = document.getElementById('routeTarget').value.split(/[\\r\\n,]+/).map(function(s) { return s.trim(); }).filter(Boolean).join(',');
  if (!prefix) { showToast('请输入路径'); return; }
  if (!target) { showToast('请至少填写一个目标地址'); return; }

  const r = await fetch(ROUTE_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      oldPrefix: oldPrefix, prefix: prefix, target: target, remark: remark,
      source: document.getElementById('routeSource').value || '',
      routeId: document.getElementById('routeId').value || '',
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
    const src = data.statsSource || 'd1';
    const srcLabel = src === 'account' ? 'CF 账号分析（全站）' : (src === 'zone' ? 'CF Zone Analytics（仅主域名）' : 'D1（声明长度口径）');
    document.getElementById('st-req').textContent = data.todayRequests == null ? 0 : data.todayRequests;
    document.getElementById('st-req-sub').textContent = '来源: ' + (isUserScope ? '我的转发请求（D1）' : srcLabel);
    document.getElementById('st-traffic').textContent = data.todayTraffic || '0 B';
    document.getElementById('st-traffic-sub').textContent = '来源: ' + (isUserScope ? '我的出站流量（D1）' : (src === 'account' ? '真实出站流量（CF 账号分析）' : (src === 'zone' ? 'CF edgeResponseBytes（仅主域名）' : 'D1 出站流量（声明长度）')));
    document.getElementById('st-uv').textContent = data.todayVisits == null ? '—' : data.todayVisits;
    document.getElementById('st-uv-sub').textContent = isUserScope ? '用户维度不统计独立访问' : '来源: CF 独立访问（全站）';
    var chip = document.getElementById('statsChip');
    if (chip) chip.textContent = isUserScope ? 'D1' : (data.cfStatus || 'STATS');
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
  const oldPassword = prompt('请输入原密码');
  if (!oldPassword) return;
  const newPassword = prompt('请输入新密码（至少 6 位）');
  if (!newPassword) return;
  const confirmPassword = prompt('请再次输入新密码');
  if (newPassword !== confirmPassword) { showToast('两次输入不一致'); return; }
  const x = await postJson('/api/user/password', { oldPassword: oldPassword, newPassword: newPassword });
  showToast(x.ok ? '✅ 密码已修改' : ('❌ ' + (x.data.error || '修改失败')));
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
  let html = '<div style="overflow-x:auto"><table><thead><tr><th>用户名</th><th>子域名</th><th>角色</th><th>状态</th><th>路由</th><th>今日</th><th>操作</th></tr></thead><tbody>';
  list.forEach(function(u) {
    const disabled = u.status === 'disabled';
    html += '<tr' + (disabled ? ' style="opacity:.55"' : '') + '>' +
      '<td><code>' + esc(u.username) + '</code></td>' +
      '<td><code>' + esc(u.subdomain || '—') + '</code></td>' +
      '<td>' + (u.role === 'admin' ? '管理员' : '普通用户') + '</td>' +
      '<td>' + (disabled ? '<span style="color:var(--warn)">禁用</span>' : '<span style="color:var(--ok)">正常</span>') + '</td>' +
      '<td>' + (u.routeCount || 0) + ' / ' + (u.routeLimit || 0) + '</td>' +
      '<td>' + (u.todayRequests || 0) + ' 次 / ' + fmtB(u.todayTraffic) + '</td>' +
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
        '<button class="btn btn-sm" onclick="copyInvite(\\'' + esc(v.code) + '\\')">复制</button> ' +
        '<button class="btn btn-sm btn-danger" onclick="delInvite(\\'' + esc(v.code) + '\\')">删除</button>' +
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
  if (!confirm('确定删除全部邀请码吗？\\n\\n所有未使用和已使用的邀请码都会被删除，此操作不可恢复。')) return;
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
  if (!confirm('确定清空所有统计数据吗？\\n\\n路由、用户、域名配置会保留，此操作不可恢复。')) return;
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
  document.getElementById('setDailyReport').checked = String(s.tg_daily_report == null ? '1' : s.tg_daily_report) !== '0';
  document.getElementById('setRate').value = s.rate_limit_per_min || '0';
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

${SPEED_TOOLS}

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
</script></body></html>`;
}

// ==================== 定时任务（Cron Triggers）====================
async function runHealthCheck(env, manual = false) {
  if (!env.DB) return { checked: 0, alerts: [] };
  const { results: routes } = await env.DB.prepare('SELECT prefix, target, remark FROM routes WHERE enabled != 0').all();
  // 多人版：用户路由也要巡检，状态键写成 owner/prefix，和 userListRoutes 里的查法保持一致
  let userRoutes = [];
  try {
    const res = await env.DB.prepare('SELECT owner, prefix, target, remark FROM user_routes WHERE enabled != 0').all();
    userRoutes = (res.results || []).map(r => ({
      prefix: r.owner + '/' + r.prefix,
      target: r.target,
      remark: (r.remark ? r.remark + ' ' : '') + '(@' + r.owner + ')',
    }));
  } catch (_) {}
  const { results: states } = await env.DB.prepare('SELECT * FROM route_health').all();
  const stateMap = new Map((states || []).map(r => [r.prefix + '|' + r.target, r]));
  const jobs = [];
  for (const r of [...(routes || []), ...userRoutes]) {
    for (const t of splitTargets(r.target)) jobs.push({ r, t });
  }
  const limited = jobs.slice(0, 40);
  const probes = await Promise.all(limited.map(async j => ({ ...j, res: await probeTarget(j.t) })));
  const nowIso = new Date().toISOString();
  const stmts = []; const alerts = [];
  for (const { r, t, res } of probes) {
    const prev = stateMap.get(r.prefix + '|' + t);
    const fail = res.ok ? 0 : (prev?.fail_count || 0) + 1;
    const down = res.ok ? 0 : (fail >= 2 ? 1 : (prev?.down || 0));
    const changed = (prev?.down || 0) !== down;
    if (changed) alerts.push(`${down ? '🔴 线路异常' : '🟢 线路恢复'}：/${r.prefix}${r.remark ? '（' + r.remark + '）' : ''}\n${t}${res.ok ? '' : '\n' + (res.error || 'HTTP ' + res.status)}`);
    stmts.push(env.DB.prepare(
      `INSERT INTO route_health (prefix, target, down, fail_count, latency, last_check, last_change) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(prefix, target) DO UPDATE SET down = excluded.down, fail_count = excluded.fail_count, latency = excluded.latency,
         last_check = excluded.last_check, last_change = CASE WHEN route_health.down != excluded.down THEN excluded.last_check ELSE route_health.last_change END`
    ).bind(r.prefix, t, down, fail, res.ms, nowIso, nowIso));
  }
  if (stmts.length) await env.DB.batch(stmts);
  if (alerts.length) await notify(env, alerts.join('\n\n'));
  return { checked: probes.length, alerts };
}

async function runScheduled(env) {
  if (!env.DB) return;
  await initDatabase(env);
  await flushHourlyStats(env);
  const st = await getSettings(env);
  if (st.healthCheck) { try { await runHealthCheck(env); } catch (_) {} }

  // 每天 23:00（北京时间）自动发送日报；用 D1 抢占避免多个 Cron/isolate 重复发送
  const now = getShanghaiParts();
  const reportEnabled = String(st.raw.tg_daily_report ?? '1') !== '0';
  if (reportEnabled && now.hour === 23) {
    try {
      if (await claimReportSlot(env, now.dateKey)) await sendDailyReport(env, now.dateKey);
    } catch (_) {}
  }
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runScheduled(env));
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    if (env.DB) { try { await initDatabase(env); } catch (_) {} }

    if (url.pathname === '/') return html(buildFrontendHtml(env));
    if (url.pathname === '/favicon.ico') return new Response('', { headers: { 'Content-Type': 'image/x-icon' } });
    if (url.pathname.startsWith('/cdn-cgi/')) return new Response('Not Found', { status: 404 });

    if (url.pathname === '/health') {
      return json({ status: 'ok', version: CURRENT_VERSION, colo: request.cf?.colo, timestamp: new Date().toISOString() });
    }

    if (url.pathname === '/stats') {
      const dateParam = url.searchParams.get('date') || '';
      return cachedJson(request, 'stats:' + dateParam, 60, () => handleStatsRequest(env, url));
    }

    if (url.pathname === '/api/edge-info') return json(await getEdgeInfo(request));

    if (url.pathname === '/api/domains/list') {
      if (!env.DB) {
        return json({ success: true, domains: DEFAULT_OPTIMIZED_DOMAINS.map((d, i) => ({ id: i, ...d })) });
      }
      const domains = await getOptimizedDomains(env);
      return json({ success: true, domains });
    }

    if (url.pathname === '/api/config/dns-record-name') {
      const base = getBaseDomain(env);
      return json({ dnsRecordName: getDnsRecordName(env) || (base ? base.split('.')[0] : 'emby') });
    }

    if (url.pathname === '/api/config/base-domain') {
      return json({ baseDomain: getBaseDomain(env) || 'yourdomain.com' });
    }

    if (url.pathname === '/admin/api/login' && request.method === 'POST') {
      try {
        const body = await readJson(request) || {};
        return adminLoginResponse(request, env, body);
      } catch (e) {
        return json({ ok: false, error: e.message }, 400);
      }
    }

    if (url.pathname === '/api/register' && request.method === 'POST') {
      try {
        return await handleRegister(request, env);
      } catch (e) {
        return json({ ok: false, error: '注册失败: ' + String(e?.message || e).slice(0, 160) }, 500);
      }
    }

    if (url.pathname === '/api/logout' && request.method === 'POST') return logoutResponse();

    if (url.pathname === '/register' || url.pathname === '/register/') {
      const res = html(buildRegisterHtml(env));
      res.headers.set('X-Robots-Tag', 'noindex, nofollow');
      return res;
    }

    if (url.pathname === '/login') {
      return Response.redirect(url.origin + '/admin', 302);
    }

    if (url.pathname === '/robots.txt') {
      return new Response('User-agent: *\nDisallow: /\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }

    if (url.pathname === '/admin' || url.pathname === '/admin/') {
      const session = await getSession(request, env);
      const page = session ? buildAdminHtml(session, env) : buildLoginHtml();
      const res = html(page);
      res.headers.set('X-Robots-Tag', 'noindex, nofollow');
      return res;
    }

    if (url.pathname.startsWith('/admin/api/')) {
      const session = await getSession(request, env);
      if (!session || !session.isAdmin) return new Response('Unauthorized', { status: 401 });
      if (!env.DB) return json({ error: 'DB 未绑定' }, 500);
      try {
        return await handleAdminApi(request, env, url, session);
      } catch (e) {
        return json({ error: '服务器内部错误: ' + String(e?.message || e).slice(0, 200) }, 500);
      }
    }

    if (url.pathname.startsWith('/api/user/')) {
      if (!env.DB) return json({ error: 'DB 未绑定' }, 500);
      const session = await getSession(request, env);
      if (!session) return json({ error: 'Unauthorized' }, 401);
      try {
        return await handleUserApi(request, env, url, session);
      } catch (e) {
        return json({ error: '服务器内部错误: ' + String(e?.message || e).slice(0, 200) }, 500);
      }
    }

    const pathFirst = url.pathname.split('/').filter(Boolean)[0]?.toLowerCase();
    const looksLikeFileName = /\.(?:txt|html?|xml|json|ico|png|jpe?g|gif|svg|webp|css|js|map|php|aspx?|env|git)$/i.test(pathFirst || '');
    const looksLikeDirectUrl = url.pathname.startsWith('/http://') || url.pathname.startsWith('/https://') ||
      (pathFirst && !looksLikeFileName && (pathFirst.includes('.') || pathFirst.includes(':')));

    if (looksLikeDirectUrl) {
      let path = url.pathname.substring(1);
      if (path.startsWith('/')) return new Response('Invalid proxy format', { status: 400 });
      path = path.replace(/^(https?)\/(?!\/)/, '$1://');
      if (!path.startsWith('http')) path = 'https://' + path;
      try {
        const upstreamUrl = new URL(path);
        if (upstreamUrl.protocol !== 'http:' && upstreamUrl.protocol !== 'https:') {
          return new Response('Invalid URL format', { status: 400 });
        }
        if (!directProxyAllowed(env, upstreamUrl.hostname)) {
          return new Response('Forbidden: direct proxy target not allowed', { status: 403 });
        }
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
      clientIpMode: resolved.clientIpMode,
      matchedPrefix: resolved.matchedPrefix,
      statPrefix: resolved.statPrefix,
      routeOwner: resolved.routeOwner,
      legacyUserId: resolved.legacyUserId,
      customHeaders: resolved.customHeaders,
    });
  },
};
