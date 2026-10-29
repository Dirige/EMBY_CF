const CURRENT_VERSION = 'v6.4.2';

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

// 透传计数流：不缓冲、不阻塞首字节，流结束后回调字节数
function countingBody(body, onDone) {
  if (!body) { onDone(0); return body; }
  let n = 0;
  const ts = new TransformStream({
    transform(chunk, ctrl) { n += chunk.byteLength || 0; ctrl.enqueue(chunk); },
    flush() { try { onDone(n); } catch (_) {} },
  });
  return body.pipeThrough(ts);
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

function dayRangeIso(dateKey) {
  const start = new Date(dateKey + 'T00:00:00+08:00').getTime();
  return { start: new Date(start).toISOString(), end: new Date(start + 86400000 - 1).toISOString() };
}

// 返回该 Zone 中【反代域名】当天的 CF 侧数据；查询失败时返回 { error } 而不是抛出。
async function cfGetZoneSummary(env, dateKey) {
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
  const rows = hostDim
    ? zone.series.filter(it => {
        const h = String(it?.dimensions?.clientRequestHTTPHost || '').toLowerCase();
        return !statsHost || h === statsHost;
      })
    : zone.series;

  // 有 host 维度但该域名当天没有数据时（例如统计域名配错），退回全 Zone 数据并给出提示
  let hostMatched = true;
  if (hostDim && statsHost && rows.length === 0) {
    hostMatched = false;
  }
  const useRows = hostMatched ? rows : zone.series;

  let requests = 0, visits = 0, bytes = 0;
  const hourly = Array.from({ length: 24 }, () => 0);
  for (const item of useRows) {
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

  return {
    requests, visits, bytes, hourly,
    zoneId: info.zoneId,
    zoneName: info.zoneName,
    statsHost,
    hostMatched,
    hostDim,
    note: hostMatched ? '' : ('CF 中未找到 ' + statsHost + ' 的数据，当前展示整个 Zone 汇总；请检查 DNS_RECORD_NAME / STATS_HOSTS'),
    warning: firstError ? ('按域名分组查询失败，已退回 Zone 汇总: ' + firstError.slice(0, 120)) : '',
  };
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
  const d1 = await getD1Stats(env, key);
  const cf = await cfGetZoneSummary(env, key);
  const worker = await cfGetWorkerSummary(env, key);
  const daily = await getD1DailySeries(env, 7);

  const requests = d1.requests || (!cf.error ? Number(cf.requests) || 0 : 0);
  const traffic = d1.traffic || (!cf.error ? Number(cf.bytes) || 0 : 0);

  const lines = [];
  lines.push('📊 <b>Emby Proxy 日报</b>');
  const host = getStatsHost(env);
  if (host) lines.push('<code>' + tgEscape(host) + '</code>');
  lines.push('<code>' + tgEscape(key) + '</code>');
  lines.push('');
  lines.push('请求数：<b>' + requests + '</b>');
  lines.push('出站流量：<b>' + formatBytes(traffic) + '</b>');
  if (d1.plays) lines.push('播放次数：<b>' + d1.plays + '</b>');
  if (d1.playbackInfo) lines.push('PlaybackInfo：<b>' + d1.playbackInfo + '</b>');
  if (!cf.error) {
    lines.push('CF 访问量：<b>' + (Number(cf.visits) || 0) + '</b>');
    if (cf.requests) lines.push('CF 请求数：<b>' + (Number(cf.requests) || 0) + '</b>');
  }
  if (!worker.error && worker.requests) lines.push('Worker 调用：<b>' + worker.requests + '</b>');

  if (d1.routes.length) {
    lines.push('');
    lines.push('<b>热门路由</b>');
    for (const r of d1.routes.slice(0, 8)) {
      lines.push(tgEscape(r.prefix ? '/' + r.prefix : '直连') + ' — ' + r.requests + ' 次 / ' + formatBytes(r.traffic));
    }
  }

  if (daily.length) {
    lines.push('');
    lines.push('<b>近 7 日</b>');
    for (const d of daily) {
      lines.push(d.date + '  ' + d.requests + ' 次 / ' + formatBytes(d.traffic));
    }
  }

  if (cf.error) {
    lines.push('');
    lines.push('<i>CF 数据不可用：' + tgEscape(String(cf.error).slice(0, 160)) + '</i>');
  }
  lines.push('');
  lines.push('<i>' + tgEscape(new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })) + '</i>');
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
let statsBufferCount = 0;
let statsLastFlush = Date.now();
const STATS_FLUSH_EVERY = 20;
const STATS_FLUSH_MS = 30000;

function bufferHourlyStats({ isPlay, isPlaybackInfo, bytes, timestamp, prefix }) {
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
    const rk = prefix + '|' + dateKey;
    const rc = routeStatsBuffer.get(rk) || { prefix, dateKey, req: 0, bytes: 0 };
    rc.req += 1;
    rc.bytes += b;
    routeStatsBuffer.set(rk, rc);
  }
  statsBufferCount++;
}

async function flushHourlyStats(env) {
  if (!env.DB || (!statsBuffer.size && !routeStatsBuffer.size)) return;
  const items = Array.from(statsBuffer.values());
  const ritems = Array.from(routeStatsBuffer.values());
  statsBuffer.clear();
  routeStatsBuffer.clear();
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
  try {
    await env.DB.batch([
      ...items.map(i => env.DB.prepare(sql).bind(i.dateKey, i.hour, i.req, i.play, i.info, i.bytes, updatedAt)),
      ...ritems.map(i => env.DB.prepare(rsql).bind(i.prefix, i.dateKey, i.req, i.bytes)),
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

// 统计/日报里对应的完整访问域名，例如 BASE_DOMAIN=255432.xyz + DNS_RECORD_NAME=proxy => proxy.255432.xyz
function getStatsHost(env) {
  const override = envStr(env, 'STATS_HOSTS').split(/[\s,]+/).filter(Boolean)[0] || '';
  if (override) return override.toLowerCase();
  return toFqdn(getDnsRecordName(env), getBaseDomain(env)).toLowerCase();
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
let zoneInfoCache = { at: 0, base: '', zoneId: '', accountId: '', zoneName: '', error: '' };

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

async function resolveZoneInfo(env, force = false) {
  const envZone = envStr(env, 'CF_ZONE_ID');
  const envAccount = envStr(env, 'CF_ACCOUNT_ID');
  const base = getBaseDomain(env);

  if (envZone && envAccount) return { zoneId: envZone, accountId: envAccount, zoneName: base, base, error: '', from: 'env' };
  if (!force && zoneInfoCache && zoneInfoCache.base === base && Date.now() - zoneInfoCache.at < 600000) return zoneInfoCache;

  const token = getCFApiToken(env);
  if (!base) return { zoneId: envZone, accountId: envAccount, zoneName: '', base, error: '未配置 BASE_DOMAIN', from: 'none' };
  if (!token) return { zoneId: envZone, accountId: envAccount, zoneName: base, base, error: '未配置 CF_API_TOKEN', from: 'none' };

  try {
    const { zone, error } = await findZoneForHost(env, base);
    const info = {
      at: Date.now(),
      base,
      zoneId: envZone || (zone && zone.id) || '',
      accountId: envAccount || (zone && zone.account && zone.account.id) || '',
      zoneName: (zone && zone.name) || base,
      error: zone ? '' : (error || '未找到该域名所属区域'),
      from: envZone ? 'env+api' : 'api',
    };
    zoneInfoCache = info;
    return info;
  } catch (e) {
    return { zoneId: envZone, accountId: envAccount, zoneName: base, base, error: String(e?.message || e), from: 'none' };
  }
}

function invalidateZoneInfoCache() { zoneInfoCache = { at: 0, base: '', zoneId: '', accountId: '', zoneName: '', error: '' }; }

// ---- 会话：HMAC 签名令牌（Cookie 中不再保存明文密钥）----
const SESSION_COOKIE = 'admin_session';
const SESSION_TTL_SEC = 7200;
const enc = new TextEncoder();

function toHex(buf) {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
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

async function makeSessionToken(secret) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SEC;
  return exp + '.' + await hmacHex(secret, 'session:' + exp);
}

async function isAdmin(request, env) {
  const secret = getAdminToken(env);
  if (!secret) return false;
  const tok = getCookie(request, SESSION_COOKIE);
  if (!tok) return false;
  const [expStr, sig] = tok.split('.');
  const exp = parseInt(expStr, 10);
  if (!sig || !Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  return safeEqual(sig, await hmacHex(secret, 'session:' + exp), secret);
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

async function adminLoginResponse(request, env, tokenFromUser) {
  const expected = getAdminToken(env);
  if (!expected) {
    return json({
      ok: false,
      error: 'Worker 未读到 ADMIN_TOKEN。请在 Cloudflare 控制台 → Worker → 设置 → 变量和机密 中添加 ADMIN_TOKEN。',
    }, 503);
  }
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  if (loginBlocked(ip)) return json({ ok: false, error: '尝试次数过多，请 10 分钟后再试' }, 429);
  if (!(await safeEqual(tokenFromUser, expected, expected))) {
    loginFailed(ip);
    return json({ ok: false, error: '密钥错误' }, 401);
  }
  loginFails.delete(ip);
  const cookie = `${SESSION_COOKIE}=${encodeURIComponent(await makeSessionToken(expected))}; Path=/; Max-Age=${SESSION_TTL_SEC}; HttpOnly; SameSite=Strict; Secure`;
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Set-Cookie': cookie,
      'Cache-Control': 'no-store',
    },
  });
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
let bingWallpaper = { at: 0, url: '' };

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
      sort_order INTEGER DEFAULT 0
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
  ]);
  
  try {
    await env.DB.prepare(`ALTER TABLE routes ADD COLUMN ip_mode TEXT DEFAULT 'forward'`).run();
  } catch (e) {}
  for (const col of [
    `enabled INTEGER NOT NULL DEFAULT 1`,
    `custom_headers TEXT NOT NULL DEFAULT ''`,
    `ip_allow TEXT NOT NULL DEFAULT ''`,
    `ip_block TEXT NOT NULL DEFAULT ''`,
    `use_relay TEXT NOT NULL DEFAULT 'off'`,
  ]) {
    try { await env.DB.prepare(`ALTER TABLE routes ADD COLUMN ${col}`).run(); } catch (e) {}
  }

  // VPS 中继配置：全部存 D1、在 Worker 后台网页管理，VPS 端无需环境变量
  try {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS relay_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      relay_url TEXT DEFAULT '',
      secret TEXT DEFAULT '',
      cert_pem TEXT DEFAULT '',
      key_pem TEXT DEFAULT '',
      enabled TEXT DEFAULT 'off',
      updated_at TEXT DEFAULT ''
    )`).run();
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

async function createOrUpdateDNSRecord(env, zoneId, dnsName, targetDomain, rootDomain) {
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

  const recordData = {
    type: recordType,
    name: fullDNSName,
    content: targetDomain,
    ttl: 1,
    proxied: false,
  };

  const sameType = recordsResult.result.filter(r => r.name === fullDNSName && ['A', 'AAAA', 'CNAME'].includes(r.type));
  if (sameType.length === 1 && sameType[0].type === recordType) {
    // 类型相同：原地 PUT 更新，避免"先删后建"造成的解析空窗
    const upd = await cloudflareAPICall(env, 'PUT', `/zones/${zoneId}/dns_records/${sameType[0].id}`, recordData);
    if (upd.success) { await saveDNSConfig(env, dnsName, targetDomain, zoneId); return upd; }
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

  await saveDNSConfig(env, dnsName, targetDomain, zoneId);
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

async function getD1Stats(env, dateKey) {
  const empty = { requests: 0, plays: 0, playbackInfo: 0, traffic: 0, hourly: new Array(24).fill(0), routes: [] };
  if (!env.DB) return empty;
  try {
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
       FROM route_stats_daily WHERE bucket_date = ? GROUP BY prefix ORDER BY requests DESC LIMIT 12`
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

async function getD1DailySeries(env, days = 7) {
  if (!env.DB) return [];
  const today = getShanghaiParts().dateKey;
  const start = new Date(new Date(today + 'T00:00:00Z').getTime() - (days - 1) * 86400000).toISOString().slice(0, 10);
  try {
    const { results } = await env.DB.prepare(
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

async function handleStatsRequest(env, url) {
  if (!env.DB) return json({ error: 'D1 数据库未绑定', data: null });

  const dateParam = url.searchParams.get('date') || '';
  const dateKey = /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : getShanghaiParts().dateKey;

  // 把内存里还没落库的统计先刷进 D1，避免刚发生的请求不出现在页面上
  try { await flushHourlyStats(env); } catch (_) {}

  const d1 = await getD1Stats(env, dateKey);
  const cf = await cfGetZoneSummary(env, dateKey);
  const worker = await cfGetWorkerSummary(env, dateKey);

  const cfOk = !cf.error;
  const trafficBytes = d1.traffic || (cfOk ? Number(cf.bytes) || 0 : 0);
  const requests = d1.requests || (cfOk ? Number(cf.requests) || 0 : 0);

  const hourlySeries = Array.from({ length: 24 }, (_, h) => ({
    label: String(h).padStart(2, '0') + ':00',
    total: d1.hourly[h] || (cfOk && cf.hourly ? cf.hourly[h] : 0) || 0,
    d1: d1.hourly[h] || 0,
    cf: cfOk && cf.hourly ? cf.hourly[h] : 0,
  }));

  const dailySeries = await getD1DailySeries(env, 7);
  const zoneInfo = await resolveZoneInfo(env);
  const tgReady = Boolean(getTelegramToken(env) && getTelegramChatId(env));

  return json({
    error: null,
    data: {
      date: dateKey,
      todayRequests: requests,
      todayTraffic: formatBytes(trafficBytes),
      todayTrafficBytes: trafficBytes,
      todayVisits: cfOk ? Number(cf.visits) || 0 : null,
      plays: d1.plays,
      playbackInfo: d1.playbackInfo,
      d1: { requests: d1.requests, trafficBytes: d1.traffic, plays: d1.plays, playbackInfo: d1.playbackInfo },
      cf: cfOk
        ? { requests: Number(cf.requests) || 0, trafficBytes: Number(cf.bytes) || 0, visits: Number(cf.visits) || 0, zoneId: cf.zoneId, zoneName: cf.zoneName, hostMatched: cf.hostMatched, note: cf.note || '', warning: cf.warning || '' }
        : { error: cf.error },
      worker: worker.error ? { error: worker.error } : { requests: Number(worker.requests) || 0, byScript: worker.byScript || {} },
      hourlySeries,
      dailySeries,
      topRoutes: d1.routes,
      cfStatus: cfOk ? (cf.hostMatched ? 'CF 统计正常' : 'CF 统计正常（全 Zone）') : 'CF 查询失败',
      cfError: cfOk ? '' : cf.error,
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
      source: d1.requests ? (cfOk ? 'D1 + CF' : 'D1') : (cfOk ? 'CF' : 'D1'),
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

async function readJson(request) {
  try { return await request.json(); } catch { return null; }
}

async function handleAdminApi(request, env, url) {
  if (!(await isAdmin(request, env))) return new Response('Unauthorized', { status: 401 });

  // 简单的同源校验，防 CSRF（Cookie 已是 SameSite=Strict，这里是第二道防线）
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const origin = request.headers.get('Origin');
    if (origin && origin !== url.origin) return json({ error: 'Forbidden origin' }, 403);
  }

  if (url.pathname === '/admin/api/logout' && request.method === 'POST') return logoutResponse();

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
    const routes = (await env.DB.prepare('SELECT prefix, target, remark, cache_img, compat_mode, ip_mode, sort_order, enabled, custom_headers, ip_allow, ip_block FROM routes ORDER BY sort_order, prefix').all()).results || [];
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
    for (const r of Array.isArray(data.routes) ? data.routes : []) {
      const err = validatePrefix(r?.prefix);
      const targets = splitTargets(r?.target);
      if (err || !targets.length || !targets.every(isValidHttpUrl) || parseHeaderLines(r.custom_headers).error ||
          !validIpList(parseIpList(r.ip_allow)) || !validIpList(parseIpList(r.ip_block))) { skipped.push(String(r?.prefix || '?')); continue; }
      stmts.push(env.DB.prepare(
        `INSERT OR REPLACE INTO routes (prefix, target, remark, cache_img, compat_mode, ip_mode, use_relay, last_play, sort_order, enabled, custom_headers, ip_allow, ip_block)
         VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT last_play FROM routes WHERE prefix = ?), ''), ?, ?, ?, ?, ?)`
      ).bind(normalizePrefix(r.prefix), targets.join(','), String(r.remark || ''), r.cache_img === 'off' ? 'off' : 'on', r.compat_mode === 'on' ? 'on' : 'off',
        normalizeIpMode(r.ip_mode), (r.use_relay === 'on' || r.use_relay === 'image') ? r.use_relay : 'off', normalizePrefix(r.prefix), Number(r.sort_order) || 0, r.enabled === 0 ? 0 : 1,
        String(r.custom_headers || ''), String(r.ip_allow || ''), String(r.ip_block || '')));
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
    await env.DB.prepare('UPDATE routes SET enabled = ? WHERE prefix = ?').bind(data.enabled ? 1 : 0, prefix).run();
    clearRouteCache();
    await auditLog(env, data.enabled ? 'route.enable' : 'route.disable', '/' + prefix);
    return json({ success: true });
  }

  if (url.pathname === '/admin/api/routes/reorder' && request.method === 'POST') {
    const data = await readJson(request) || {};
    const order = Array.isArray(data.order) ? data.order.map(normalizePrefix).filter(Boolean) : [];
    if (!order.length) return json({ error: '缺少 order' }, 400);
    await env.DB.batch(order.map((pf, i) => env.DB.prepare('UPDATE routes SET sort_order = ? WHERE prefix = ?').bind(i, pf)));
    return json({ success: true });
  }

  if (url.pathname === '/admin/api/routes/test' && request.method === 'POST') {
    const data = await readJson(request) || {};
    const route = await env.DB.prepare('SELECT target FROM routes WHERE prefix = ?').bind(normalizePrefix(data.prefix)).first();
    if (!route) return json({ error: '路由不存在' }, 404);
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
         ORDER BY r.sort_order, r.prefix`
      ).bind(today).all();
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
      const existing = await env.DB.prepare('SELECT sort_order, last_play, enabled FROM routes WHERE prefix = ?').bind(isRename ? oldPrefix : prefix).first();
      if (isRename) {
        const clash = await env.DB.prepare('SELECT 1 AS x FROM routes WHERE prefix = ?').bind(prefix).first();
        if (clash) return json({ error: '路径 /' + prefix + ' 已存在' }, 409);
      } else if (!oldPrefix && existing) {
        return json({ error: '路径 /' + prefix + ' 已存在，请直接编辑它' }, 409);
      }

      const insert = env.DB.prepare(
        'INSERT OR REPLACE INTO routes (prefix, target, remark, cache_img, compat_mode, ip_mode, use_relay, last_play, sort_order, enabled, custom_headers, ip_allow, ip_block) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(
        prefix, targets.join(','), data.remark || '', data.cache_img === 'off' ? 'off' : 'on', data.compat_mode === 'on' ? 'on' : 'off',
        normalizeIpMode(data.ip_mode), (data.use_relay === 'on' || data.use_relay === 'image') ? data.use_relay : 'off', existing?.last_play || '', existing?.sort_order || 0, existing?.enabled === 0 ? 0 : 1,
        String(data.custom_headers || '').trim(), allowList.join(','), blockList.join(',')
      );
      // 改名用 batch（同一事务）：插入新行 + 删除旧行，中途失败不会丢路由
      if (isRename) await env.DB.batch([insert, env.DB.prepare('DELETE FROM routes WHERE prefix = ?').bind(oldPrefix)]);
      else await insert.run();
      clearRouteCache();
      await auditLog(env, isRename ? 'route.rename' : 'route.save', '/' + (isRename ? oldPrefix + ' → /' : '') + prefix);
      return json({ success: true });
    }
    if (request.method === 'DELETE') {
      const prefix = url.searchParams.get('prefix');
      if (!prefix) return json({ error: '缺少 prefix 参数' }, 400);
      await env.DB.prepare('DELETE FROM routes WHERE prefix = ?').bind(normalizePrefix(prefix)).run();
      clearRouteCache();
      try { await env.DB.prepare('DELETE FROM route_health WHERE prefix = ?').bind(normalizePrefix(prefix)).run(); } catch (_) {}
      await auditLog(env, 'route.delete', '/' + normalizePrefix(prefix));
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

  // ==================== VPS 中继配置 ====================
  if (url.pathname === '/admin/api/relay' && (request.method === 'GET' || request.method === 'POST')) {
    if (request.method === 'GET') {
      const c = await getRelayConfig(env);
      return json({
        success: true,
        config: {
          relayUrl: c.relayUrl,
          port: c.port,
          secret: c.secret ? '●●●●●●●●' : '',
          hasSecret: !!c.secret,
          hasCert: !!(c.certPem && c.keyPem),
          enabled: c.enabled,
          updatedAt: c.updatedAt,
        },
      });
    }
    if (request.method === 'POST') {
      if (!env.DB) return json({ error: 'DB 未绑定' }, 500);
      const data = await readJson(request);
      if (!data) return json({ error: '请求体不是合法 JSON' }, 400);
      const cur = await getRelayConfig(env);
      const relayUrl = normalizeRelayBase(data.relayUrl ?? cur.relayUrl);
      const secret = (data.secret && data.secret !== '●●●●●●●●') ? String(data.secret).trim() : cur.secret;
      const certPem = data.certPem !== undefined ? String(data.certPem).trim() : cur.certPem;
      const keyPem = data.keyPem !== undefined ? String(data.keyPem).trim() : cur.keyPem;
      const enabled = (data.enabled === 'on' || data.enabled === true) ? 'on' : 'off';
      const nowIso = new Date().toISOString();
      try {
        await env.DB.batch([
          env.DB.prepare('DELETE FROM relay_config WHERE id = 1'),
          env.DB.prepare('INSERT INTO relay_config (id, relay_url, secret, cert_pem, key_pem, enabled, updated_at) VALUES (1, ?, ?, ?, ?, ?, ?)')
            .bind(relayUrl, secret, certPem, keyPem, enabled, nowIso),
        ]);
        await auditLog(env, 'relay.save', relayUrl + (enabled ? ' (启用)' : ' (停用)'));
      } catch (e) {
        return json({ error: '保存失败: ' + String(e?.message || e).slice(0, 150) }, 500);
      }
      // 顺手推送到 VPS（改密钥/下证书会自动让 VPS 生效，无需登录 VPS）
      const push = { vpsStatus: 0, vpsBody: '', vpsError: '' };
      if (data.pushToVps !== false && relayUrl && secret) {
        const bodyJson = JSON.stringify({
          secret,
          port: relayPortFrom(relayUrl),
          cert_pem: certPem,
          key_pem: keyPem,
          restart: Boolean(certPem && keyPem),
        });
        // 鉴权密钥依次尝试：D1 旧密钥 → 本次新填的密钥（修复“旧密钥错存导致永远 403”的死循环）
        const tryKeys = [cur.secret, secret].filter((v, i, a) => v && a.indexOf(v) === i);
        for (const k of tryKeys) {
          try {
            const res = await fetch(new Request(relayUrl + '/_relay/config', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-Relay-Key': k },
              body: bodyJson,
            }));
            push.vpsStatus = res.status;
            push.vpsBody = (await res.text()).slice(0, 200);
            if (res.status >= 200 && res.status < 300) break;
          } catch (e) {
            push.vpsStatus = 0;
            push.vpsBody = '';
            push.vpsError = String(e?.message || e).slice(0, 200);
          }
        }
      }
      return json({ success: true, ...push });
    }
  }

  if (url.pathname === '/admin/api/relay/test' && request.method === 'POST') {
    const c = await getRelayConfig(env);
    if (!c.relayUrl || !c.secret) return json({ ok: false, error: '请先填写中继地址和密钥' });
    const t0 = Date.now();
    try {
      const res = await fetch(new Request(c.relayUrl + '/_relay/health', { headers: { 'X-Relay-Key': c.secret } }));
      const text = (await res.text()).slice(0, 200);
      let body = null;
      try { body = JSON.parse(text); } catch (_) {}
      return json({ ok: res.ok, status: res.status, ms: Date.now() - t0, version: body?.version || '', tls: body?.tls });
    } catch (e) {
      return json({ ok: false, ms: Date.now() - t0, error: String(e?.message || e).slice(0, 200) });
    }
  }

  // 拉取 VPS 中继的流量统计（relay /_relay/stats，X-Relay-Key 鉴权）
  if (url.pathname === '/admin/api/relay/stats' && request.method === 'GET') {
    const c = await getRelayConfig(env);
    if (!c.relayUrl || !c.secret) return json({ ok: false, error: '未配置中继' });
    try {
      const res = await fetch(new Request(c.relayUrl + '/_relay/stats', { headers: { 'X-Relay-Key': c.secret }, signal: AbortSignal.timeout(8000) }));
      const text = await res.text();
      let body = null;
      try { body = JSON.parse(text); } catch (_) {}
      if (!res.ok || !body?.ok) return json({ ok: false, status: res.status, error: (body && JSON.stringify(body).slice(0, 120)) || ('HTTP ' + res.status) });
      return json({ ok: true, ...body });
    } catch (e) {
      return json({ ok: false, error: String(e?.message || e).slice(0, 160) });
    }
  }

  return json({ error: 'Not found' }, 404);
}

// 路由内存缓存：减少每个请求一次 D1 查询（后台改动后本 isolate 立即失效，其余 isolate 最多滞后 TTL）
const routeCache = new Map();
const ROUTE_CACHE_TTL = 30000;

function clearRouteCache() { routeCache.clear(); }

async function getRoute(env, prefix) {
  const now = Date.now();
  const hit = routeCache.get(prefix);
  if (hit && hit.exp > now) return hit.route;
  const route = await env.DB.prepare('SELECT * FROM routes WHERE prefix = ?').bind(prefix).first();
  if (routeCache.size > 500) routeCache.clear();
  routeCache.set(prefix, { route: route || null, exp: now + ROUTE_CACHE_TTL });
  return route || null;
}

// ==================== VPS 反代中继 ====================
function normalizeRelayBase(v) {
  let u = String(v || '').trim();
  if (!u) return '';
  if (!/^https?:\/\//i.test(u)) u = 'http://' + u;
  return u.replace(/\/+$/, '');
}

function relayPortFrom(relayUrl) {
  try {
    const u = new URL(/^https?:\/\//i.test(relayUrl) ? relayUrl : 'http://' + relayUrl);
    return u.port ? parseInt(u.port, 10) : (u.protocol === 'https:' ? 443 : 80);
  } catch (_) {
    return 2087;
  }
}

async function getRelayConfig(env) {
  const empty = { relayUrl: '', port: 2087, secret: '', certPem: '', keyPem: '', enabled: false, updatedAt: '' };
  if (!env.DB) return empty;
  try {
    const row = await env.DB.prepare('SELECT * FROM relay_config WHERE id = 1').first();
    if (!row) return empty;
    const relayUrl = normalizeRelayBase(row.relay_url);
    return {
      relayUrl,
      port: relayUrl ? relayPortFrom(relayUrl) : 2087,
      secret: row.secret || '',
      certPem: row.cert_pem || '',
      keyPem: row.key_pem || '',
      enabled: row.enabled === 'on',
      updatedAt: row.updated_at || '',
    };
  } catch (_) {
    return empty;
  }
}

async function hmacSha256Hex(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// 生成中继签名头。VPS 端用 X-Relay-Target 头的原文计算同一 HMAC（±300s 时间窗），两边必须完全一致
async function relayFetchHeaders(secret, targetUrl) {
  const ts = Date.now();
  const auth = await hmacSha256Hex(secret, `${ts}:${targetUrl}`);
  return { 'X-Relay-Target': targetUrl, 'X-Relay-Ts': String(ts), 'X-Relay-Auth': auth };
}

async function resolveProxyTarget(request, env, url) {
  // 不对整条路径 decode：只对首段解码，其余保持原始编码，避免 %2F %23 %3F 被还原后改变上游路径
  const rawSegments = url.pathname.split('/').filter(Boolean);
  let firstSeg = rawSegments[0] || '';
  try { firstSeg = decodeURIComponent(firstSeg); } catch { return { error: new Response('Bad Request', { status: 400 }) }; }
  const prefix = normalizePrefix(firstSeg);
  if (!prefix) return { error: new Response('Not Found', { status: 404 }) };

  const route = await getRoute(env, prefix);
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

  return { upstreamUrls, enableCache, compatMode, clientIpMode: normalizeIpMode(route.ip_mode), matchedPrefix: route.prefix, customHeaders: parseHeaderLines(route.custom_headers).headers, relayMode: (route.use_relay === 'on' || route.use_relay === 'image') ? route.use_relay : 'off' };
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
  const { enableCache = true, compatMode = false, clientIpMode = 'forward', matchedPrefix = null, customHeaders = [], relayMode = 'off', relay = null } = opts;
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

  // 中继分流：mode 'on'=全走 VPS；'image'=除视频流(streaming/segment)外全走 VPS（省 VPS 带宽，视频走 CF 骨干直连源站）
  const relayActive = !!(relay && relay.enabled && relay.secret);
  const relayedNow = relayActive && (relayMode === 'on' || (relayMode === 'image' && reqCategory !== 'streaming' && reqCategory !== 'segment'));

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
    bufferHourlyStats({ isPlay: isPlayStart, isPlaybackInfo, bytes, timestamp: nowTs, prefix: matchedPrefix });
    if (statsBufferCount >= STATS_FLUSH_EVERY || nowTs - statsLastFlush > STATS_FLUSH_MS) {
      ctx.waitUntil(flushHourlyStats(env));
    }
    if (matchedPrefix && (isPlaybackInfo || isPlaying || reqCategory === 'streaming')) {
      const lt = lastPlayTouched.get(matchedPrefix) || 0;
      if (nowTs - lt > LAST_PLAY_THROTTLE_MS) {
        lastPlayTouched.set(matchedPrefix, nowTs);
        const nowTime = new Date(nowTs + 8 * 3600000).toISOString().replace('T', ' ').split('.')[0];
        ctx.waitUntil(
          env.DB.prepare('UPDATE routes SET last_play = ? WHERE prefix = ?').bind(nowTime, matchedPrefix).run().catch(() => {})
        );
      }
    }
  };

  // 包装响应体：有 content-length 直接记账；否则用透传计数流（不缓冲、不延迟首字节）
  const meterBody = (response) => {
    if (!response.body) { recordStats(0); return null; }
    const cl = parseInt(response.headers.get('content-length') || '', 10);
    if (Number.isFinite(cl) && cl >= 0) { recordStats(cl); return response.body; }
    return countingBody(response.body, recordStats);
  };

  const upgradeHeader = request.headers.get('Upgrade');
  if (upgradeHeader?.toLowerCase() === 'websocket') {
    if (ipMode === 'forward') {
      if (relayedNow) {
        return relayFetch(request, relay, new URL(upstreamUrls[0]), null);
      }
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
    if (relayedNow) {
      return relayFetch(request, relay, new URL(upstreamUrls[0]), wsHeaders);
    }
    return fetch(upstreamUrls[0], new Request(upstreamUrls[0], { method: request.method, headers: wsHeaders }));
  }

  // 走 VPS 中继：请求发到中继服务器，真实目标 URL 放进签名头（GET/WS/POST 均可，POST 会缓存 body）
  async function relayFetch(origReq, relayCfg, targetUrl, overrideHeaders) {
    const t = targetUrl instanceof URL ? targetUrl : new URL(targetUrl);
    const rBase = normalizeRelayBase(relayCfg.relayUrl);
    const relayUrl = new URL(t.pathname + t.search, rBase);
    const signHeaders = await relayFetchHeaders(relayCfg.secret, t.toString());
    const h = new Headers(overrideHeaders || origReq.headers);
    for (const [k, v] of Object.entries(signHeaders)) h.set(k, v);
    let body;
    if (origReq.method !== 'GET' && origReq.method !== 'HEAD') {
      try { body = await origReq.clone().arrayBuffer(); } catch (_) { body = undefined; }
    }
    const init = { method: origReq.method, headers: h, redirect: 'manual' };
    if (body) init.body = body;
    return fetch(new Request(relayUrl.toString(), init));
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
  let relayFallbackUsed = false;
  // image 模式下视频流/segment 不走中继（relayedNow=false），但直连失败可回退中继
  const canRelayFallback = relayMode === 'image' && !relayedNow;

  // image 模式回退：同一请求经 VPS 中继重发（构造方式与主循环 relayFetch 分支一致）
  const tryRelayFallback = async (urlForRelay) => {
    const rBase = normalizeRelayBase(relay.relayUrl);
    const rUrl = new URL(urlForRelay.pathname + urlForRelay.search, rBase);
    const fbHeaders = buildUpstreamHeaders(request, urlForRelay, { ipMode, compatMode });
    for (const [k, v] of customHeaders) fbHeaders.set(k, v);
    const fbSign = await relayFetchHeaders(relay.secret, urlForRelay.toString());
    for (const [k, v] of Object.entries(fbSign)) fbHeaders.set(k, v);
    const fbRange = request.headers.get('Range');
    if (fbRange) fbHeaders.set('Range', fbRange);
    const fbInit = { method: request.method, headers: fbHeaders, redirect: compatMode ? 'follow' : 'manual' };
    if (requestBody) fbInit.body = requestBody;
    return fetch(new Request(rUrl.toString(), fbInit));
  };

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

    // VPS 中继：fetchTarget 改为中继地址，源站完整 URL 放进签名头；失败照旧切下一条线路
    let fetchTarget = upstreamUrl.toString();
    if (relayedNow) {
      const rBase = normalizeRelayBase(relay.relayUrl);
      const rUrl = new URL(upstreamUrl.pathname + upstreamUrl.search, rBase);
      fetchTarget = rUrl.toString();
      const signHeaders = await relayFetchHeaders(relay.secret, upstreamUrl.toString());
      for (const [k, v] of Object.entries(signHeaders)) headers.set(k, v);
    }

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
      let response = await fetch(new Request(fetchTarget, fetchInit));
      // image 模式回退：直连被源站拒绝（401/403/451，常见于 CF WAF 地区拦截）→ 自动改走 VPS 中继
      if (canRelayFallback && [401, 403, 451].includes(response.status)) {
        try { await auditLog(env, 'direct.fallback', `${matchedPrefix || request.cf?.colo || '?'} ${request.method} ${pathname} direct_status=${response.status} colo=${request.cf?.colo || ''} body=${(await response.clone().text()).slice(0, 80)}`); } catch (_) {}
        try {
          const rb = await tryRelayFallback(upstreamUrl);
          if (rb && ![401, 403, 451].includes(rb.status)) { response = rb; relayFallbackUsed = true; }
        } catch (_) { /* 回退失败则沿用原响应 */ }
      }
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
      // image 模式回退：直连网络错误/超时 → 自动改走 VPS 中继重发
      if (canRelayFallback) {
        try { await auditLog(env, 'direct.fallback.err', `${matchedPrefix || '?'} ${request.method} ${pathname} direct_err=${(err && err.message) || String(err)} colo=${request.cf?.colo || ''}`); } catch (_) {}
        try {
          const rb = await tryRelayFallback(upstreamUrl);
          if (rb) {
            hostDownUntil.delete(upstreamUrl.host);
            finalResponse = rb;
            lastUpstreamUrl = upstreamUrl;
            relayFallbackUsed = true;
            break;
          }
        } catch (_) { /* 回退也失败 → 常规切线路流程 */ }
      }
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
  if (relayFallbackUsed) {
    responseHeaders.set('X-Relay-Fallback', '1');
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
    var ms = await measureDomain(d.domain, 4, 6000);
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
    display: flex; align-items: center; justify-content: space-between; gap: 14px;
    padding: 12px 22px; margin: -28px -22px 0;
    background: linear-gradient(180deg, var(--surface), var(--surface-2));
    backdrop-filter: blur(16px) saturate(1.3); -webkit-backdrop-filter: blur(16px) saturate(1.3);
    border-bottom: 1px solid var(--line);
  }
  .topbar::after {
    content: ''; position: absolute; left: 22px; right: 22px; bottom: -1px; height: 1px;
    background: linear-gradient(90deg, transparent, var(--accent-line), transparent);
    opacity: .55; pointer-events: none;
  }
  .brand { display: flex; align-items: center; gap: 10px; font-family: ui-monospace, 'SF Mono', Consolas, monospace; font-weight: 700; letter-spacing: .04em; font-size: 15px; color: var(--text); text-decoration: none; }
  .brand-mark { width: 9px; height: 9px; background: var(--accent); border-radius: 2px; box-shadow: 0 0 12px var(--accent-line); animation: pulse 2.6s ease-in-out infinite; }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .45; } }
  .brand-ver {
    padding: 3px 7px; border: 1px solid var(--line); border-radius: 999px;
    font-size: 9.5px; line-height: 1.2; letter-spacing: .08em; color: var(--text-faint);
    background: var(--surface-2); font-weight: 600;
  }
  .topbar-actions { display: flex; gap: 6px; align-items: center; justify-content: flex-end; flex-wrap: wrap; row-gap: 6px; }
  .topbar-divider { width: 1px; height: 18px; flex: none; margin: 0 3px; background: var(--line-strong); }
  .topbar-btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    height: 33px; padding: 0 12px;
    border: 1px solid var(--line-strong); border-radius: 999px;
    background: var(--surface-2); color: var(--text-dim);
    font: 600 12.5px/1 -apple-system, system-ui, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
    letter-spacing: .01em; text-decoration: none; white-space: nowrap; cursor: pointer;
    transition: color .18s ease, border-color .18s ease, background .18s ease, box-shadow .18s ease, transform .18s ease;
  }
  .topbar-btn:hover {
    color: var(--accent); border-color: var(--accent-line); background: var(--accent-dim);
    box-shadow: 0 0 0 3px var(--accent-dim); transform: translateY(-1px);
  }
  .topbar-btn:focus-visible { outline: 2px solid var(--accent-line); outline-offset: 2px; }
  .topbar-btn:active { transform: translateY(0); }
  .topbar-btn .ext { font-size: 10px; opacity: .65; transition: opacity .18s ease, transform .18s ease; }
  .topbar-btn:hover .ext { opacity: 1; transform: translate(1px, -1px); }
  .topbar-theme {
    min-width: 74px; font-family: ui-monospace, 'SF Mono', Consolas, monospace;
    font-size: 10.5px; letter-spacing: .12em;
  }
  .topbar-theme::before {
    content: ''; width: 6px; height: 6px; border-radius: 50%; flex: none;
    background: var(--accent); box-shadow: 0 0 8px var(--accent-line);
  }
  .topbar-btn.is-accent {
    color: var(--accent-ink); background: var(--accent); border-color: var(--accent);
    box-shadow: 0 4px 14px var(--accent-dim);
  }
  .topbar-btn.is-accent:hover { color: var(--accent-ink); background: var(--accent); border-color: var(--accent); filter: brightness(1.08); box-shadow: 0 6px 18px var(--accent-dim); }

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
  .tabbar { display:flex; gap:4px; margin:0 0 16px; padding:5px; background:var(--surface); border:1px solid var(--line); border-radius:var(--radius); position:sticky; top:10px; z-index:60; backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px); box-shadow:var(--shadow); }
  .tab-btn { flex:1; padding:9px 6px; border:0; border-radius:var(--radius-s); background:transparent; color:var(--text-dim); font-size:13px; font-weight:600; cursor:pointer; transition:background .16s ease, color .16s ease; white-space:nowrap; }
  .tab-btn:hover { color:var(--text); background:var(--surface-2); }
  .tab-btn.active { background:var(--accent); color:var(--accent-ink); box-shadow:0 4px 14px var(--accent-dim); }
  .tab-badge { display:inline-block; margin-left:5px; padding:0 6px; border-radius:99px; font-size:10px; background:var(--accent-dim); color:var(--accent); }
  .tab-btn.active .tab-badge { background:rgba(255,255,255,.25); color:inherit; }
  .relay-stats { margin-top:14px; }
  .rs-row { display:flex; flex-wrap:wrap; gap:8px; }
  .rs-tile { flex:1 1 120px; padding:8px 12px; border:1px solid var(--line); border-radius:var(--radius-s); background:var(--surface-2); }
  .rs-tile span { display:block; font-size:11px; color:var(--text-dim); margin-bottom:2px; }
  .rs-tile b { font-family:ui-monospace,monospace; font-size:14px; }
  .rs-meta { margin-top:8px; font-size:11px; color:var(--text-faint); cursor:pointer; }
  .rs-hosts { margin-top:8px; font-size:12px; }
  .rs-hosts summary { cursor:pointer; color:var(--text-dim); outline:none; }
  .rs-hosts summary:hover { color:var(--text); }
  .rs-host { display:flex; justify-content:space-between; gap:10px; padding:5px 0; border-bottom:1px dashed var(--line); font-family:ui-monospace,monospace; font-size:12px; }
  .rs-host:last-child { border-bottom:0; }
  details.adv-box { border:1px solid var(--line); border-radius:var(--radius-s); padding:10px 14px; margin-top:4px; background:var(--surface-2); }
  details.adv-box summary { cursor:pointer; font-weight:600; font-size:13px; color:var(--text-dim); outline:none; }
  details.adv-box summary:hover { color:var(--text); }
  details.adv-box[open] summary { margin-bottom:10px; color:var(--text); }
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
    .brand span.bname,
    .brand .brand-ver { display: none; }
    .topbar-actions { gap: 5px; }
    .topbar-divider { margin: 0 1px; height: 16px; }
    .topbar-btn { height: 30px; padding: 0 10px; font-size: 11.5px; }
    .topbar-theme { min-width: 62px; }
  }
  @media (max-width: 480px) {
    .stat-row { grid-template-columns: 1fr 1fr; }
    .edge-box { grid-template-columns: 1fr; }
    .hero-actions .btn { flex: 1; }
    .topbar { padding: 10px 12px; gap: 8px; }
    .topbar::after { left: 12px; right: 12px; }
    .topbar-actions { gap: 4px; row-gap: 5px; }
    .topbar-divider { display: none; }
    .topbar-btn { height: 28px; padding: 0 8px; font-size: 11px; gap: 3px; }
    .topbar-theme { min-width: 56px; letter-spacing: .05em; }
    .topbar-theme::before { display: none; }
    .topbar-btn .ext { display: none; }
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

const LANDING_CSS = `
  body.lp2 { background:linear-gradient(120deg,#dfe5da,#f2ede3); display:flex; align-items:center; justify-content:center; min-height:100vh; padding:24px; }
  .lp2-bg { position:fixed; inset:0; z-index:0; }
  .lp2-photo { position:absolute; inset:0; background:#dfe5da center/cover no-repeat url(/bing-wallpaper); animation:lp2Zoom 36s ease-in-out infinite alternate; }
  @keyframes lp2Zoom { from { transform:scale(1); } to { transform:scale(1.07); } }
  .lp2-veil { position:absolute; inset:0; background:linear-gradient(115deg, rgba(250,247,240,.85) 0%, rgba(250,247,240,.5) 45%, rgba(250,247,240,.28) 100%); }
  .lp2-card { position:relative; z-index:1; display:grid; grid-template-columns:1.08fr 1fr; width:min(940px,100%); min-height:520px; border-radius:24px; overflow:hidden; box-shadow:0 30px 90px rgba(20,40,35,.35); animation:lp2Up .8s ease both; }
  @keyframes lp2Up { from { opacity:0; transform:translateY(22px); } to { opacity:1; transform:none; } }
  .lp2-left { position:relative; display:flex; flex-direction:column; justify-content:space-between; gap:40px; padding:40px 38px; background:linear-gradient(160deg,#17382e,#0f2a22); color:#fff; overflow:hidden; }
  .lp2-left::after { content:''; position:absolute; right:-70px; bottom:-90px; width:280px; height:280px; border-radius:50%; background:rgba(255,255,255,.05); }
  .lp2-brand { display:flex; align-items:center; gap:9px; font-size:12px; letter-spacing:.14em; color:rgba(255,255,255,.85); font-weight:700; }
  .lp2-brand i { width:10px; height:10px; border-radius:3px; background:#5fd4a8; box-shadow:0 0 12px rgba(95,212,168,.8); flex:none; }
  .lp2-brand span { font-weight:400; opacity:.55; letter-spacing:.06em; }
  .lp2-left h1 { font-size:clamp(2.1em, 4.6vw, 3em); line-height:1.18; margin:0 0 12px; font-weight:800; letter-spacing:.02em; }
  .lp2-head p { margin:0; color:rgba(255,255,255,.66); font-size:14px; }
  .lp2-chips { position:relative; z-index:1; display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }
  .lp2-chips div { padding:12px; border:1px solid rgba(255,255,255,.16); background:rgba(255,255,255,.07); border-radius:12px; }
  .lp2-chips b { display:block; font-size:15px; margin-bottom:3px; }
  .lp2-chips span { font-size:11px; color:rgba(255,255,255,.6); }
  .lp2-right { display:flex; flex-direction:column; padding:44px 40px; background:#faf7f1; color:#1c2b26; }
  .lp2-right h2 { margin:6px 0 6px; font-size:1.5em; font-weight:800; letter-spacing:-.01em; }
  .lp2-sub { margin:0 0 26px; color:#7d8a83; font-size:13px; }
  .lp2-cta { display:flex; align-items:center; justify-content:space-between; padding:15px 20px; border-radius:12px; background:#17382e; color:#fff; text-decoration:none; font-weight:700; font-size:15px; transition:filter .18s ease, transform .18s ease; box-shadow:0 10px 24px rgba(23,56,46,.35); }
  .lp2-cta:hover { filter:brightness(1.12); transform:translateY(-2px); }
  .lp2-cta span { font-weight:400; opacity:.8; }
  .lp2-links { display:flex; flex-direction:column; gap:10px; margin-top:22px; }
  .lp2-links a { display:flex; align-items:center; gap:12px; padding:13px 16px; border:1px solid #e5dfd2; border-radius:12px; background:#fff; color:#1c2b26; text-decoration:none; font-size:14px; font-weight:600; transition:border-color .16s ease, transform .16s ease, box-shadow .16s ease; }
  .lp2-links a:hover { border-color:#17382e; transform:translateX(3px); box-shadow:0 6px 18px rgba(23,56,46,.12); }
  .lp2-ico { font-size:17px; }
  .lp2-arrow { margin-left:auto; color:#a9b3ad; font-size:13px; }
  .lp2-foot { margin:auto 0 0; padding-top:26px; color:#a9b3ad; font-size:11px; text-align:center; }
  @media (max-width: 780px) {
    .lp2-card { grid-template-columns:1fr; min-height:0; }
    .lp2-left { gap:28px; padding:32px 28px; }
    .lp2-right { padding:30px 28px 26px; }
    .lp2-foot { padding-top:20px; }
  }
  @media (prefers-reduced-motion: reduce) { .lp2-photo, .lp2-card { animation:none; } }
`;

function buildFrontendHtml() {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="theme-color" content="#17382e">
<title>Emby 反向代理 · 控制中心</title><link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎬</text></svg>">
<style>${PAGE_STYLE}${LANDING_CSS}</style></head><body class="lp2">
<div class="lp2-bg" aria-hidden="true"><i class="lp2-photo"></i><i class="lp2-veil"></i></div>
<main class="lp2-card">
  <section class="lp2-left">
    <div class="lp2-brand"><i></i>EMBY·PROXY <span>${CURRENT_VERSION}</span></div>
    <div class="lp2-head">
      <h1>多媒体<br>控制中心</h1>
      <p>集中管理分散的 Emby 节点</p>
    </div>
    <div class="lp2-chips">
      <div><b>Route</b><span>媒体路由</span></div>
      <div><b>Relay</b><span>中继分流</span></div>
      <div><b>Signal</b><span>播放统计</span></div>
    </div>
  </section>
  <section class="lp2-right">
    <h2>快捷入口</h2>
    <p class="lp2-sub">节点管理 · 优选线路 · 使用统计</p>
    <a class="lp2-cta" href="/admin">进入管理后台 <span>→</span></a>
    <nav class="lp2-links">
      <a href="https://t.me/+7cbXthaBajszNjI1" target="_blank" rel="noopener"><span class="lp2-ico">💬</span><span class="lp2-name">TG 群组</span><span class="lp2-arrow">↗</span></a>
      <a href="https://github.com/Dirige/EMBY_CF" target="_blank" rel="noopener"><span class="lp2-ico">🐙</span><span class="lp2-name">GitHub</span><span class="lp2-arrow">↗</span></a>
      <a href="https://yx.255432.xyz/" target="_blank" rel="noopener"><span class="lp2-ico">🛰️</span><span class="lp2-name">优选域名监测</span><span class="lp2-arrow">↗</span></a>
    </nav>
    <p class="lp2-foot">每日壁纸来自 Bing · 恶意刷接口将封禁 IP</p>
  </section>
</main>
</body></html>`;
}

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
  </div>
</div>
<script>${THEME_LOGIC}
async function login(){
  const t=document.getElementById('tokenInput').value.trim();
  const err=document.getElementById('loginErr');
  const btn=document.getElementById('loginBtn');
  err.textContent='';
  if(!t){ err.textContent='请输入密钥'; return; }
  btn.disabled=true; btn.textContent='验证中...';
  try{
    const r=await fetch('/admin/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:t})});
    const d=await r.json();
    if(d.ok){ location.href='/admin'; return; }
    err.textContent=d.error||'登录失败';
  } catch(e){ err.textContent='请求失败: '+e.message; }
  btn.disabled=false; btn.textContent='登 录';
}
</script></body></html>`;
}

function buildAdminHtml() {
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
      <button class="btn btn-sm" id="btnDailyReport" onclick="sendReport(this)">发送日报</button>
      <a href="/" class="btn btn-sm">首页</a>
      <button class="btn btn-sm" onclick="openSettings()">设置</button>
      <button class="btn btn-sm btn-danger" onclick="logout()">退出</button>
    </div>
  </div>

  <nav class="tabbar" id="tabbar">
    <button class="tab-btn active" data-tab="overview" onclick="switchTab('overview')">📊 概览</button>
    <button class="tab-btn" data-tab="routes" onclick="switchTab('routes')">🚦 路由<span class="tab-badge" id="tabRouteCount"></span></button>
    <button class="tab-btn" data-tab="domains" onclick="switchTab('domains')">🌐 优选</button>
    <button class="tab-btn" data-tab="logs" onclick="switchTab('logs')">📜 日志</button>
  </nav>

  <div id="tab-overview" class="tab-pane">
    <div class="card">
      <div class="sec-title">使用统计 <span class="chip">CF&nbsp;ANALYTICS</span></div>
      <div id="stats-loading" class="muted"><span class="spin"></span>加载中...</div>
      <div id="stats-body" style="display:none">
        <div class="stat-row">
          <div class="stat-card"><div>今日请求</div><div class="stat-val" id="st-req">0</div><div class="stat-sub" id="st-req-sub"></div></div>
          <div class="stat-card"><div>今日流量</div><div class="stat-val" id="st-traffic">0 B</div><div class="stat-sub" id="st-traffic-sub"></div></div>
          <div class="stat-card"><div>今日访问</div><div class="stat-val" id="st-uv">0</div><div class="stat-sub" id="st-uv-sub"></div></div>
        </div>
        <div class="stat-row">
          <div class="stat-card"><div>中继今日请求</div><div class="stat-val" id="st-relay-req">—</div><div class="stat-sub" id="st-relay-req-sub">来源: VPS 中继</div></div>
          <div class="stat-card"><div>中继今日流量</div><div class="stat-val" id="st-relay-traffic">—</div><div class="stat-sub" id="st-relay-traffic-sub">↑源站拉取 ↓发回客户端</div></div>
        </div>
        <div id="hourly-chart"></div>
        <p class="muted" style="font-size:11px;margin-top:8px" id="st-updated"></p>
      </div>
    </div>
    <div class="card">
      <div class="sec-title">当前边缘节点 <span class="chip">EDGE</span></div>
      <div id="edge-loading" class="muted"><span class="spin"></span>正在探测...</div>
      <div id="edge-info" class="edge-box" style="display:none"></div>
    </div>
  </div>

  <div id="tab-routes" class="tab-pane" style="display:none">
  <div class="card">
    <div class="sec-title">路由管理 <span class="chip" id="routeCount"></span></div>
    <div class="toolbar" style="margin-bottom:16px">
      <button class="btn btn-sm btn-solid" onclick="openRouteModal()">添加路由</button>
      <button class="btn btn-sm" onclick="location.href='/admin/api/export'">导出配置</button>
      <button class="btn btn-sm" onclick="document.getElementById('importFile').click()">导入配置</button>
      <input type="file" id="importFile" accept="application/json,.json" style="display:none" onchange="importConfig(this)">
      <div class="search-box">
        <input type="text" id="routeSearch" placeholder="搜索备注或路径..." oninput="filterRoutes()">
      </div>
    </div>
    <div class="dns-quick">
      <span class="dns-quick-tag">DNS</span>
      <input id="dnsQuickName" placeholder="记录名（留空 = BASE_DOMAIN）">
      <span class="dns-quick-arrow">→</span>
      <input id="dnsQuickTarget" placeholder="目标域名或 IP（可以直接改）">
      <button class="btn btn-sm btn-solid" id="dnsQuickSave" onclick="quickSaveDNS(this)">保存</button>
      <button class="btn btn-sm" onclick="loadQuickDNS()">刷新</button>
    </div>
    <p class="muted" id="dnsQuickMeta" style="margin:-2px 0 14px;font-size:12px">DNS 记录加载中...</p>
    <div id="routeList" class="route-grid"><p class="muted"><span class="spin"></span>加载中...</p></div>
  </div>

  <div class="card">
    <div class="sec-title">VPS 反代中继 <span class="chip" id="relayChip" style="margin-left:8px">—</span></div>
    <p class="form-hint" style="margin-bottom:14px">勾选「走 VPS 反代」的路由，链路变为 <b>客户端 → Worker → VPS 中继 → Emby 源站</b>。VPS 地址/端口/密钥/证书全部保存在这里，保存后自动推送到 VPS，不需要登录 VPS 改配置。</p>
    <div class="form-group">
      <label>中继地址（含端口）</label>
      <input id="relayUrl" placeholder="例如 http://1.2.3.4:2087 或 https://relay.xxx.com:2087">
      <p class="form-hint">未下发证书时用 http，下发证书后改 https。端口须与 VPS 服务端口一致（当前 <span id="relayPortHint">2087</span>）</p>
    </div>
    <div class="form-group">
      <label>中继密钥</label>
      <input id="relaySecret" autocomplete="off" placeholder="">
      <p class="form-hint">首次填 VPS 服务端配置里的一次性引导密钥；之后可随时换新密钥，保存时自动推送到 VPS</p>
    </div>
    <div class="form-group">
      <label class="checkbox-label">
        <input type="checkbox" id="relayEnabled"> 启用中继（总开关，勾选后带「走 VPS 反代」标记的路由才会真正走中继）
      </label>
    </div>
    <details class="adv-box">
      <summary>🔐 TLS 证书（可选 · 高级）</summary>
      <label style="margin-top:12px">TLS 证书 (PEM，可选)</label>
      <textarea id="relayCert" rows="4" spellcheck="false" style="font-family:ui-monospace,monospace;font-size:12px" placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"></textarea>
      <label style="margin-top:12px">私钥 (PEM，可选)</label>
      <textarea id="relayKey" rows="4" spellcheck="false" style="font-family:ui-monospace,monospace;font-size:12px" placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"></textarea>
      <p class="form-hint">留空则只推送密钥不动证书；两项都填则推送证书并自动重启 VPS 证书服务。想让 Worker→VPS 这段加密，推荐在 VPS 上用 Let's Encrypt 自动签（需要时我可以给一键脚本），CF 小云朵解决不了这段的加密</p>
    </details>
    <div class="toolbar">
      <button class="btn btn-sm btn-solid" onclick="saveRelay(this)">保存并下发到 VPS</button>
      <button class="btn btn-sm" onclick="testRelay(this)">测试连通</button>
      <span id="relayStatus" class="form-hint"></span>
    </div>
    <div id="relayStats" class="relay-stats" title="点击刷新">📊 中继流量：加载中...</div>
  </div>

  </div>

  <div id="tab-domains" class="tab-pane" style="display:none">
  <div class="card">
    <div class="sec-title">优选域名 <span class="chip">CDN</span></div>
    <div class="toolbar" style="margin-bottom:16px">
      <button class="btn btn-sm" onclick="openDomainModal()">添加域名</button>
      <button class="btn btn-sm" onclick="testDomains()">重新测速</button>
      <span id="domain-status" class="muted"></span>
    </div>
    <div id="domainList" class="domain-list"><p class="muted"><span class="spin"></span>加载中...</p></div>
  </div>
  </div>

  <div id="tab-logs" class="tab-pane" style="display:none">
  <div class="card">
    <div class="sec-title">操作日志 <span class="chip">AUDIT</span></div>
    <div class="toolbar" style="margin-bottom:16px"><button class="btn btn-sm" onclick="loadAudit()">刷新</button></div>
    <div id="auditList" class="muted">点击刷新查看最近 100 条操作</div>
  </div>
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
      <label style="margin-top:12px">VPS 反代分流模式</label>
      <select id="routeRelayMode" style="margin-top:6px">
        <option value="off">off — 不启用（Worker 直连源站）</option>
        <option value="on">on — 全部流量走 VPS 中继</option>
        <option value="image">image — API/图片/WS 走 VPS，视频流直连（省 VPS 带宽）</option>
      </select>
      <p class="form-hint">「image」适合源站禁止 CN/JP 但 CF 助手能访问的视频站点：小流量嵌 VPS 当地区保险，视频大流量走 CF 骨干。若该站 CF 直连也进不去请选 on</p>
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
    <div class="modal-actions">
      <button class="btn" onclick="runNow()">立即健康检查</button>
      <button class="btn" onclick="closeModal('modalSettings')">取消</button>
      <button class="btn btn-solid" onclick="saveSettings()">保存</button>
    </div>
  </div>
</div>

<script>${THEME_LOGIC}
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

async function logout() {
  try { await fetch('/admin/api/logout', { method: 'POST' }); } catch (e) {}
  location.reload();
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

    const disabled = r.enabled === 0;
    return '<div class="route-item" style="' + (disabled ? 'opacity:.55' : '') + '" data-search="' + esc((remarkName + ' ' + r.prefix).toLowerCase()) + '">' +
      '<div class="route-header">' +
        '<div class="route-title">' +
          '<h3 class="route-name">' + esc(remarkName) + '</h3>' +
          '<span class="route-path">/' + esc(r.prefix) + '</span>' +
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
        (r.today_req ? '<span class="meta-tag">📊 今日 ' + r.today_req + ' 次 / ' + fmtB(r.today_bytes) + '</span>' : '') +
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
  document.getElementById('routeTarget').value = String(r.target || '').split(',').map(function(x) { return x.trim(); }).filter(Boolean).join('\\n');
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
  const target = document.getElementById('routeTarget').value.split(/[\\r\\n,]+/).map(function(s) { return s.trim(); }).filter(Boolean).join(',');

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
    const hosts = d.hosts || [];
    if (hosts.length) {
      s += '<details class="rs-hosts"><summary>按源站分组（' + hosts.length + '）</summary><div>'
        + hosts.slice(0, 6).map(function(h) {
          return '<div class="rs-host"><span>' + esc(h.host) + '</span><span>' + (h.req || 0) + ' req · ↑' + fmtBytes(h.up_bytes) + ' ↓' + fmtBytes(h.down_bytes) + '</span></div>';
        }).join('') + '</div></details>';
    }
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

(function initTabs() {
  var h = (location.hash || '').replace('#', '');
  if (TAB_NAMES.indexOf(h) < 0) { try { h = localStorage.getItem('adminTab') || ''; } catch (e) {} }
  if (TAB_NAMES.indexOf(h) < 0) h = 'overview';
  switchTab(h);
})();
setInterval(loadRelayStatsCard, 60000);
</script></body></html>`;
}


// ==================== 定时任务（Cron Triggers）====================
async function runHealthCheck(env, manual = false) {
  if (!env.DB) return { checked: 0, alerts: [] };
  const { results: routes } = await env.DB.prepare('SELECT prefix, target, remark FROM routes WHERE enabled != 0').all();
  const { results: states } = await env.DB.prepare('SELECT * FROM route_health').all();
  const stateMap = new Map((states || []).map(r => [r.prefix + '|' + r.target, r]));
  const jobs = [];
  for (const r of routes || []) {
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

    // 必应每日壁纸：服务端取当日图 URL，图片经边缘缓存代理（国内不直连 bing）
    if (url.pathname === '/bing-wallpaper') {
      const now = Date.now();
      if (!bingWallpaper.url || now - bingWallpaper.at > 3600e3) {
        try {
          const meta = await fetch('https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1', { cf: { cacheTtl: 3600, cacheEverything: true } });
          const j = await meta.json();
          const u = j && j.images && j.images[0] && j.images[0].url;
          if (u) bingWallpaper = { at: now, url: u.startsWith('http') ? u : 'https://www.bing.com' + u };
        } catch (e) {}
      }
      if (!bingWallpaper.url) return new Response('wallpaper unavailable', { status: 503 });
      const img = await fetch(bingWallpaper.url, { cf: { cacheEverything: true, cacheTtl: 21600 } });
      const res = new Response(img.body, img);
      res.headers.set('Cache-Control', 'public, max-age=21600');
      return res;
    }

    if (url.pathname === '/') return html(buildFrontendHtml());
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
        const body = await request.json();
        return adminLoginResponse(request, env, String(body.token || '').trim());
      } catch (e) {
        return json({ ok: false, error: e.message }, 400);
      }
    }

    if (url.pathname === '/robots.txt') {
      return new Response('User-agent: *\nDisallow: /\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }

    if (url.pathname === '/admin' || url.pathname === '/admin/') {
      const page = (await isAdmin(request, env)) ? buildAdminHtml() : buildLoginHtml();
      const res = html(page);
      res.headers.set('X-Robots-Tag', 'noindex, nofollow');
      return res;
    }

    if (url.pathname.startsWith('/admin/api/')) {
      if (!(await isAdmin(request, env))) return new Response('Unauthorized', { status: 401 });
      if (!env.DB) return json({ error: 'DB 未绑定' }, 500);
      try {
        return await handleAdminApi(request, env, url);
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

    let relayCfg = null;
    if (resolved.relayMode && resolved.relayMode !== 'off') relayCfg = await getRelayConfig(env);

    return proxyDirectUrl(request, env, ctx, resolved.upstreamUrls, {
      enableCache: resolved.enableCache,
      compatMode: resolved.compatMode,
      clientIpMode: resolved.clientIpMode,
      matchedPrefix: resolved.matchedPrefix,
      customHeaders: resolved.customHeaders,
      relayMode: resolved.relayMode,
      relay: relayCfg,
    });
  },
};
