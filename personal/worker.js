// src/shared/http/primitives.js
var DEFAULT_OPTIMIZED_DOMAINS = [
  { domain: "youxuan.cf.090227.xyz", name: "CF\u4F18\u9009-090227", isBuiltin: true },
  { domain: "cf.877774.xyz", name: "\u79CB\u540D\u5C71\u4F18\u9009", isBuiltin: true },
  { domain: "cf.cf.cnae.top", name: "NB\u4F18\u9009", isBuiltin: true },
  { domain: "saas.sin.fan", name: "MIYU\u4F18\u9009", isBuiltin: true },
  { domain: "bestcf.030101.xyz", name: "Mingyu\u4F18\u9009", isBuiltin: true },
  { domain: "cf.cloudflare.182682.xyz", name: "WeTest\u4F18\u9009", isBuiltin: true },
  { domain: "cf.tencentapp.cn", name: "\u65E0\u540D\u6C0F\u7EF4\u62A4\u57DF\u540D", isBuiltin: true },
  { domain: "mfa.gov.ua", name: "\u4E4C\u514B\u5170\u5916\u4EA4\u90E8", isBuiltin: true },
  { domain: "www.shopify.com", name: "Shopify\u5B98\u65B9", isBuiltin: true },
  { domain: "store.ubi.com", name: "\u80B2\u78A7\u5546\u5E97", isBuiltin: true },
  { domain: "staticdelivery.nexusmods.com", name: "NexusMods", isBuiltin: true }
];
var RESERVED_ALIASES = /* @__PURE__ */ new Set([
  "admin",
  "stats",
  "health",
  "api",
  "favicon.ico",
  "cdn-cgi",
  "__client_rtt__",
  "web",
  "emby",
  "sessions",
  "playbackinfo"
]);
var DOMAIN_PROXY_RULES = {};
var JP_COLOS = ["NRT", "KIX", "FUK", "OKA"];
var SECURITY_HEADERS = Object.freeze({
  "Referrer-Policy": "origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=15552000; preload",
  "X-Frame-Options": "SAMEORIGIN",
  "X-Content-Type-Options": "nosniff",
  "X-XSS-Protection": "1; mode=block"
});
var DROP_REQUEST_HEADERS = Object.freeze(/* @__PURE__ */ new Set([
  "host",
  "x-real-ip",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-proto",
  "forwarded",
  "connection",
  "upgrade",
  "transfer-encoding",
  "te",
  "keep-alive",
  "proxy-authorization",
  "proxy-authenticate",
  "trailer",
  "expect"
]));
var CLIENT_IDENTITY_HEADERS = Object.freeze(/* @__PURE__ */ new Set([
  "cf-connecting-ip",
  "cf-ipcountry",
  "cf-worker",
  "true-client-ip",
  "x-real-ip",
  "x-forwarded-for",
  "forwarded",
  "x-cluster-client-ip",
  "client-ip"
]));
var IP_MODES = Object.freeze(["forward", "strip", "disable"]);
function normalizeIpMode(v) {
  const m = String(v || "").trim().toLowerCase();
  return IP_MODES.includes(m) ? m : "forward";
}
function stripClientIdentityHeaders(headers) {
  for (const h of CLIENT_IDENTITY_HEADERS)
    headers.delete(h);
}
var DROP_RESPONSE_HEADERS = Object.freeze(/* @__PURE__ */ new Set([
  "access-control-allow-origin",
  "access-control-allow-methods",
  "access-control-allow-headers",
  "access-control-allow-credentials",
  "x-frame-options",
  "strict-transport-security",
  "x-content-type-options",
  "x-xss-protection",
  "referrer-policy",
  "x-powered-by",
  "server"
]));
var REQUEST_PATTERNS = Object.freeze({
  imageExt: /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
  staticExt: /\.(?:js|css|woff2?|ttf|otf|map|webmanifest)$/i,
  subtitleExt: /\.(?:srt|ass|vtt|sub)$/i,
  embyImages: /(?:\/Images\/|\/Icons\/|\/Branding\/|\/emby\/covers\/)/i,
  manifestExt: /\.(?:m3u8|mpd)$/i,
  segmentExt: /\.(?:ts|m4s)$/i,
  streaming: /\.(?:mp4|m4v|m4a|ogv|webm|mkv|mov|avi|wmv|flv|mp3|aac|flac|ogg|opus|wav)$/i,
  // Match complete endpoints, not their descendants: /stream/hls/1.ts is
  // a segment, whereas /Videos/id/stream.ts may be a whole movie/live stream.
  mediaEndpoint: /\/(?:Videos|Audio)\/[^/]+\/(?:stream|original|universal|master|main)(?:\.ts)?\/?$/i,
  downloadEndpoint: /\/Items\/[^/]+\/(?:Download|File)\/?$/i
});
var PROGRESS_THROTTLE_MS = 3e4;
var PROGRESS_MAP_MAX = 1e4;
var CORS_JSON = { "Content-Type": "application/json; charset=utf-8" };
function classifyRequest(pathname, method) {
  if (REQUEST_PATTERNS.embyImages.test(pathname))
    return "image";
  if (REQUEST_PATTERNS.manifestExt.test(pathname))
    return "manifest";
  if (REQUEST_PATTERNS.mediaEndpoint.test(pathname) || REQUEST_PATTERNS.downloadEndpoint.test(pathname))
    return "streaming";
  if (REQUEST_PATTERNS.segmentExt.test(pathname))
    return "segment";
  if (REQUEST_PATTERNS.streaming.test(pathname))
    return "streaming";
  if (REQUEST_PATTERNS.subtitleExt.test(pathname))
    return "subtitle";
  if (REQUEST_PATTERNS.imageExt.test(pathname))
    return "image";
  if (REQUEST_PATTERNS.staticExt.test(pathname))
    return "static";
  if (/\/PlaybackInfo/i.test(pathname))
    return "playback_info";
  if (/\/Sessions\/Playing/i.test(pathname))
    return "playing";
  if (/\/emby\/(Sessions|Items|Users|System)/i.test(pathname))
    return "api";
  return "other";
}
function isCacheableRequest(category) {
  return category === "image" || category === "static";
}
function formatBytes(bytes) {
  const b = Math.max(0, Number(bytes) || 0);
  if (!b)
    return "0 B";
  const k = 1024, sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return parseFloat((b / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
function getShanghaiParts(ts = Date.now()) {
  const d = new Date(ts + 8 * 36e5);
  const iso = d.toISOString();
  return { dateKey: iso.slice(0, 10), hour: d.getUTCHours(), ts };
}
function getResponseBytes(response) {
  if (!response)
    return 0;
  const cl = response.headers.get("content-length");
  if (cl) {
    const n = parseInt(cl, 10);
    if (Number.isFinite(n) && n >= 0)
      return n;
  }
  return 0;
}
function toGraphQLStr(v) {
  return JSON.stringify(String(v ?? ""));
}

// src/shared/admin/api.js
function normalizePrefix(p) {
  return String(p || "").trim().toLowerCase().replace(/^\/+|\/+$/g, "");
}
function splitTargets(raw) {
  return String(raw == null ? "" : raw).split(/[\r\n,]+/).map((x) => x.trim()).filter(Boolean);
}
function normalizeDnsTarget(v) {
  let s = String(v == null ? "" : v).trim();
  s = s.replace(/^https?:\/\//i, "").split("/")[0].split("?")[0].split("#")[0];
  return s.replace(/^\.+|\.+$/g, "").toLowerCase();
}
function validatePrefix(prefix) {
  const a = normalizePrefix(prefix);
  if (!a || !/^[a-z0-9][a-z0-9_-]{0,62}$/i.test(a))
    return "\u8DEF\u5F84\u4EC5\u5141\u8BB8\u5B57\u6BCD\u6570\u5B57\u3001\u4E0B\u5212\u7EBF\u548C\u8FDE\u5B57\u7B26";
  if (RESERVED_ALIASES.has(a.toLowerCase()))
    return "\u8BE5\u8DEF\u5F84\u4E3A\u7CFB\u7EDF\u4FDD\u7559\uFF0C\u4E0D\u53EF\u4F7F\u7528";
  return null;
}
async function readJson(request, { limit = 2 * 1024 * 1024, timeoutMs = 5e3 } = {}) {
  if (!request.body) return null;
  const declared = request.headers.get("Content-Length");
  if (/^\d+$/.test(declared || "") && Number(declared) > limit) {
    void request.body.cancel().catch(() => {
    });
    return null;
  }
  const reader = request.body.getReader();
  const chunks = [];
  let bytes = 0;
  const deadline = Date.now() + timeoutMs;
  try {
    while (true) {
      let timer;
      let part;
      try {
        part = await Promise.race([reader.read(), new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error("JSON body timed out")), Math.max(1, deadline - Date.now()));
        })]);
      } finally {
        clearTimeout(timer);
      }
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > limit) {
        void reader.cancel().catch(() => {
        });
        return null;
      }
      chunks.push(part.value);
    }
    const body = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder().decode(body));
  } catch {
    void reader.cancel().catch(() => {
    });
    return null;
  } finally {
    reader.releaseLock();
  }
}
var ROUTE_CACHE_TTL = 3e4;

// src/shared/http/validation.js
async function probeTarget(target, timeoutMs = 6e3) {
  const start = Date.now();
  try {
    const res = await fetch(target, {
      method: "GET",
      redirect: "manual",
      headers: { "User-Agent": "proxy-health-check" },
      signal: AbortSignal.timeout(timeoutMs)
    });
    try {
      await res.body?.cancel();
    } catch (_) {
    }
    return { ok: res.status < 500, status: res.status, ms: Date.now() - start };
  } catch (e) {
    return { ok: false, status: 0, ms: -1, error: String(e?.message || e).slice(0, 80) };
  }
}
var FORBIDDEN_CUSTOM_HEADERS = /* @__PURE__ */ new Set(["host", "content-length", "connection", "transfer-encoding", "upgrade", "te", "keep-alive", "proxy-authorization"]);
function parseHeaderLines(text) {
  const out = [];
  let error3 = null;
  for (const line of String(text || "").split(/\r?\n/)) {
    const t = line.trim();
    if (!t)
      continue;
    const i = t.indexOf(":");
    if (i <= 0) {
      error3 = "\u81EA\u5B9A\u4E49\u8BF7\u6C42\u5934\u683C\u5F0F\u5E94\u4E3A Name: Value\uFF0C\u6BCF\u884C\u4E00\u4E2A";
      break;
    }
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim();
    if (!/^[A-Za-z0-9-]+$/.test(k)) {
      error3 = "\u8BF7\u6C42\u5934\u540D\u79F0\u4E0D\u5408\u6CD5: " + k;
      break;
    }
    if (FORBIDDEN_CUSTOM_HEADERS.has(k.toLowerCase())) {
      error3 = "\u4E0D\u5141\u8BB8\u8986\u76D6\u8BF7\u6C42\u5934: " + k;
      break;
    }
    out.push([k, v]);
  }
  return { headers: out, error: error3 };
}
function parseIpList(text) {
  return String(text || "").split(/[\s,]+/).map((x) => x.trim()).filter(Boolean);
}
function ipv4ToInt(ip) {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255))
    return null;
  return (p[0] << 24 >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3];
}
function ipMatches(ip, list) {
  for (const item of list) {
    if (item === ip)
      return true;
    const m = item.match(/^(\d+\.\d+\.\d+\.\d+)\/(\d{1,2})$/);
    if (m && !ip.includes(":")) {
      const base = ipv4ToInt(m[1]);
      const cur = ipv4ToInt(ip);
      const bits = parseInt(m[2], 10);
      if (base == null || cur == null || bits > 32)
        continue;
      const mask = bits === 0 ? 0 : 4294967295 << 32 - bits >>> 0;
      if ((base & mask) >>> 0 === (cur & mask) >>> 0)
        return true;
    }
  }
  return false;
}
function validIpList(list) {
  return list.every((x) => /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/.test(x) || /^[0-9a-fA-F:]+$/.test(x));
}
async function cachedJson(request, key, ttlSec, producer) {
  const cache = caches.default;
  const ck = new Request("https://cache.internal/" + key);
  try {
    const hit = await cache.match(ck);
    if (hit)
      return new Response(hit.body, hit);
  } catch (_) {
  }
  const res = await producer();
  try {
    const copy = new Response(res.clone().body, res);
    copy.headers.set("Cache-Control", "public, max-age=" + ttlSec);
    await cache.put(ck, copy);
  } catch (_) {
  }
  return res;
}
function isPrivateHost(h) {
  h = String(h || "").toLowerCase().replace(/^\[|\]$/g, "").replace(/\.+$/, "");
  const mapped = h.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mapped) {
    const high = parseInt(mapped[1], 16), low = parseInt(mapped[2], 16);
    return isPrivateHost(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`);
  }
  if (h.startsWith("::ffff:") && h.slice(7).includes(".")) return isPrivateHost(h.slice(7));
  if (!h || h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal"))
    return true;
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(h)) {
    const [a, b] = h.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || a === 100 && b >= 64 && b <= 127 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168 || a >= 224;
  }
  if (h.includes(":"))
    return h === "::1" || h === "::" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80");
  return false;
}
function directProxyAllowed(env2, hostname) {
  if (String(env2.DISABLE_DIRECT_PROXY ?? "1") !== "0")
    return false;
  if (isPrivateHost(hostname))
    return false;
  const list = String(env2.DIRECT_PROXY_ALLOW || "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
  if (!list.length)
    return false;
  const h = hostname.toLowerCase();
  return list.some((d) => h === d || h.endsWith("." + d));
}
function isValidHttpUrl(u) {
  try {
    const x = new URL(u);
    return x.protocol === "http:" || x.protocol === "https:";
  } catch {
    return false;
  }
}
function getClientCacheKey(request) {
  const ip = request.headers.get("cf-connecting-ip") || "0.0.0.0";
  const cf = request.cf || {};
  let ipKey = ip;
  if (ip.includes("."))
    ipKey = ip.split(".").slice(0, 3).join(".");
  else if (ip.includes(":"))
    ipKey = ip.split(":").slice(0, 4).join(":");
  return `${cf.country || "XX"}|${cf.city || ""}|${cf.asn || ""}|${ipKey}`;
}

// src/shared/integrations/dns.js
async function getOptimizedDomains(env2) {
  const { results } = await env2.DB.prepare("SELECT * FROM optimized_domains ORDER BY is_builtin DESC, name ASC").all();
  return results.map((r) => ({
    id: r.id,
    domain: r.domain,
    name: r.name,
    isBuiltin: Boolean(r.is_builtin),
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }));
}
async function addOptimizedDomain(env2, domain2, name) {
  const result = await env2.DB.prepare("INSERT INTO optimized_domains (domain, name, is_builtin) VALUES (?, ?, 0)").bind(domain2, name).run();
  return result.success;
}
function normalizeDomain(v) {
  const d = String(v || "").trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0].split(":")[0];
  return /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(d) ? d : "";
}
async function updateOptimizedDomain(env2, id, domain2, name) {
  const result = await env2.DB.prepare("UPDATE optimized_domains SET domain = ?, name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND is_builtin = 0").bind(domain2, name, id).run();
  return Boolean(result.meta && result.meta.changes);
}
async function deleteOptimizedDomain(env2, id) {
  const result = await env2.DB.prepare("DELETE FROM optimized_domains WHERE id = ? AND is_builtin = 0").bind(id).run();
  return Boolean(result.meta && result.meta.changes);
}
async function getDNSConfig(env2) {
  const { results } = await env2.DB.prepare("SELECT * FROM dns_config ORDER BY id DESC LIMIT 1").all();
  if (results.length > 0) {
    return {
      id: results[0].id,
      dnsName: results[0].dns_name,
      currentDomain: results[0].current_domain,
      zoneId: results[0].zone_id,
      createdAt: results[0].created_at,
      updatedAt: results[0].updated_at
    };
  }
  return null;
}
async function saveDNSConfig(env2, dnsName, currentDomain, zoneId) {
  const existing = await getDNSConfig(env2);
  let result;
  if (existing) {
    result = await env2.DB.prepare("UPDATE dns_config SET dns_name = ?, current_domain = ?, zone_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(dnsName, currentDomain || "", zoneId || "", existing.id).run();
  } else {
    result = await env2.DB.prepare("INSERT INTO dns_config (dns_name, current_domain, zone_id) VALUES (?, ?, ?)").bind(dnsName, currentDomain || "", zoneId || "").run();
  }
  return result.success;
}
async function cloudflareAPICall(env2, method, endpoint, body = null) {
  const apiToken = getCFApiToken(env2);
  const zoneId = env2.CF_ZONE_ID;
  const accountId = env2.CF_ACCOUNT_ID;
  const dnsRecordName = env2.DNS_RECORD_NAME;
  if (!apiToken) {
    return { success: false, error: "CF_API_TOKEN not configured" };
  }
  const url = `https://api.cloudflare.com/client/v4${endpoint}`;
  const headers = {
    "Authorization": "Bearer " + apiToken,
    "Content-Type": "application/json"
  };
  const options = {
    method,
    headers
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  try {
    const response = await fetch(url, options);
    const data = await response.json();
    return data;
  } catch (error3) {
    return { success: false, error: error3.message };
  }
}
async function getZones(env2) {
  const accountId = env2.CF_ACCOUNT_ID;
  const endpoint = accountId ? "/zones?per_page=50&account.id=" + accountId : "/zones?per_page=50";
  return await cloudflareAPICall(env2, "GET", endpoint);
}
async function getDNSRecords(env2, zoneId) {
  return await cloudflareAPICall(env2, "GET", `/zones/${zoneId}/dns_records?per_page=100`);
}
function detectRecordType(content) {
  const v = String(content || "").trim();
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(v))
    return "A";
  if (v.includes(":") && /^[0-9a-fA-F:]+$/.test(v))
    return "AAAA";
  return "CNAME";
}

// src/shared/auth/session.js
function getCookie(req, name) {
  const s = req.headers.get("Cookie");
  if (!s)
    return null;
  const m = s.match(new RegExp("(?:^|;\\s*)" + name + "=([^;]+)"));
  if (!m)
    return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return null;
  }
}
function getAdminToken(env2) {
  const raw = env2.ADMIN_TOKEN ?? env2.ADMIN_PASSWORD ?? env2.admin_token ?? env2.AdminToken;
  if (raw == null)
    return null;
  const t = String(raw).trim();
  return t.length ? t : null;
}
function envStr(env2, ...keys) {
  for (const k of keys) {
    const v = env2 && env2[k];
    if (v !== void 0 && v !== null && String(v).trim() !== "")
      return String(v).trim();
  }
  return "";
}
function getBaseDomain(env2) {
  return envStr(env2, "BASE_DOMAIN", "CF_DOMAIN").toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/:\d+$/, "").replace(/^\.+|\.+$/g, "");
}
function getDnsRecordName(env2) {
  return envStr(env2, "DNS_RECORD_NAME").replace(/^\.+|\.+$/g, "").toLowerCase();
}
function toFqdn(name, root) {
  const n = String(name || "").trim().toLowerCase().replace(/^\.+|\.+$/g, "");
  const r = String(root || "").trim().toLowerCase().replace(/^\.+|\.+$/g, "");
  if (!n || n === "@")
    return r;
  if (!r)
    return n;
  if (n === r || n.endsWith("." + r))
    return n;
  return n + "." + r;
}
function getCFApiToken(env2) {
  return envStr(env2, "CF_API_TOKEN", "CF_DNS_API_TOKEN", "CF_ANALYTICS_TOKEN");
}
function getTelegramToken(env2) {
  return envStr(env2, "TELEGRAM_BOT_TOKEN", "TG_BOT_TOKEN");
}
function getTelegramChatId(env2) {
  return envStr(env2, "TELEGRAM_CHAT_ID", "TG_CHAT_ID");
}
async function findZoneForHost(env2, host) {
  const h = String(host || "").toLowerCase().replace(/^\.+|\.+$/g, "");
  if (!h)
    return { zone: null, error: "\u57DF\u540D\u4E3A\u7A7A" };
  const exact = await cloudflareAPICall(env2, "GET", "/zones?name=" + encodeURIComponent(h) + "&per_page=1");
  if (exact && exact.success && Array.isArray(exact.result) && exact.result[0]) {
    return { zone: exact.result[0], error: "" };
  }
  const lastError = exact && (exact.errors && exact.errors[0] && exact.errors[0].message || exact.error) || "";
  const list = await cloudflareAPICall(env2, "GET", "/zones?per_page=50");
  if (!list || !list.success || !Array.isArray(list.result)) {
    return { zone: null, error: list && (list.errors && list.errors[0] && list.errors[0].message || list.error) || lastError || "\u8BFB\u53D6\u533A\u57DF\u5217\u8868\u5931\u8D25\uFF08\u68C0\u67E5 Token \u662F\u5426\u6709 Zone:Read \u6743\u9650\uFF09" };
  }
  let best = null;
  for (const z of list.result) {
    const name = String(z && z.name || "").toLowerCase();
    if (!name)
      continue;
    if (h === name || h.endsWith("." + name)) {
      if (!best || name.length > String(best.name).length)
        best = z;
    }
  }
  return { zone: best, error: best ? "" : lastError || "\u672A\u627E\u5230\u8BE5\u57DF\u540D\u6240\u5C5E\u533A\u57DF" };
}
var SESSION_COOKIE = "admin_session";
function toHex(buf) {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
var LOGIN_MAX_FAILS = 5;
var LOGIN_WINDOW_MS = 10 * 60 * 1e3;
function logoutResponse() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Set-Cookie": `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict; Secure`,
      "Cache-Control": "no-store"
    }
  });
}

// src/shared/integrations/notifications.js
async function notify(env2, text) {
  const jobs = [];
  const tgToken = getTelegramToken(env2);
  const tgChat = getTelegramChatId(env2);
  if (tgToken && tgChat) {
    jobs.push(fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: tgChat, text: String(text).slice(0, 4096), parse_mode: "HTML", disable_web_page_preview: true }),
      signal: AbortSignal.timeout(15e3)
    }).then(async (res) => res.ok && (await res.json().catch(() => ({}))).ok === true).catch(() => false));
  }
  if (env2.NOTIFY_WEBHOOK && isValidHttpUrl(env2.NOTIFY_WEBHOOK)) {
    jobs.push(fetch(env2.NOTIFY_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, content: text }),
      signal: AbortSignal.timeout(15e3)
    }).then((res) => res.ok).catch(() => false));
  }
  const results = await Promise.all(jobs);
  return { ok: results.some(Boolean) };
}

// src/editions/personal/storage/schema.js
var dbReady = false;
var dbInitPromise = null;
async function initDatabase(env2) {
  if (!env2.DB || dbReady)
    return;
  if (!dbInitPromise) {
    dbInitPromise = (async () => {
      await initDatabaseSchema(env2);
      dbReady = true;
    })();
  }
  try {
    await dbInitPromise;
  } catch (_) {
    dbInitPromise = null;
    dbReady = false;
  }
}
var SCHEMA_ID = "proxy-v6.4.8";
async function initDatabaseSchema(env2) {
  try {
    const marker = await env2.DB.prepare(`SELECT value FROM settings WHERE key = 'schema_init'`).first();
    if (marker && marker.value === SCHEMA_ID)
      return;
  } catch (_) {
  }
  await env2.DB.batch([
    env2.DB.prepare(`CREATE TABLE IF NOT EXISTS routes (
      prefix TEXT PRIMARY KEY, target TEXT NOT NULL,
      remark TEXT DEFAULT '', last_play TEXT DEFAULT '',
      cache_img TEXT DEFAULT 'on', compat_mode TEXT DEFAULT 'off',
      ip_mode TEXT DEFAULT 'forward',
      sort_order INTEGER DEFAULT 0
    )`),
    env2.DB.prepare(`CREATE TABLE IF NOT EXISTS optimized_domains (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      domain TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      is_builtin INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`),
    env2.DB.prepare(`CREATE TABLE IF NOT EXISTS dns_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dns_name TEXT NOT NULL,
      current_domain TEXT,
      zone_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`),
    env2.DB.prepare(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT '')`),
    env2.DB.prepare(`CREATE TABLE IF NOT EXISTS route_health (
      prefix TEXT NOT NULL, target TEXT NOT NULL,
      down INTEGER NOT NULL DEFAULT 0, fail_count INTEGER NOT NULL DEFAULT 0,
      latency INTEGER NOT NULL DEFAULT -1, last_check TEXT, last_change TEXT,
      PRIMARY KEY (prefix, target)
    )`),
    env2.DB.prepare(`CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL, action TEXT NOT NULL, detail TEXT NOT NULL DEFAULT ''
    )`)
  ]);
  try {
    await env2.DB.prepare(`ALTER TABLE routes ADD COLUMN ip_mode TEXT DEFAULT 'forward'`).run();
  } catch (e) {
  }
  for (const col of [
    `enabled INTEGER NOT NULL DEFAULT 1`,
    `custom_headers TEXT NOT NULL DEFAULT ''`,
    `ip_allow TEXT NOT NULL DEFAULT ''`,
    `ip_block TEXT NOT NULL DEFAULT ''`,
    `use_relay TEXT NOT NULL DEFAULT 'off'`
  ]) {
    try {
      await env2.DB.prepare(`ALTER TABLE routes ADD COLUMN ${col}`).run();
    } catch (e) {
    }
  }
  try {
    await env2.DB.prepare(`CREATE TABLE IF NOT EXISTS relay_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      relay_url TEXT DEFAULT '',
      secret TEXT DEFAULT '',
      cert_pem TEXT DEFAULT '',
      key_pem TEXT DEFAULT '',
      enabled TEXT DEFAULT 'off',
      updated_at TEXT DEFAULT ''
    )`).run();
  } catch (e) {
  }
  try {
    await env2.DB.prepare(`DELETE FROM optimized_domains WHERE domain = 'www.visa.cn' AND is_builtin = 1`).run();
  } catch (e) {
  }
  try {
    const { results } = await env2.DB.prepare("SELECT COUNT(*) as count FROM optimized_domains").all();
    if (results[0].count === 0) {
      const stmt = env2.DB.prepare("INSERT INTO optimized_domains (domain, name, is_builtin) VALUES (?, ?, 1)");
      for (const d of DEFAULT_OPTIMIZED_DOMAINS) {
        try {
          await stmt.bind(d.domain, d.name).run();
        } catch (e) {
        }
      }
    }
  } catch (e) {
  }
  try {
    await env2.DB.prepare(`INSERT INTO settings (key, value) VALUES ('schema_init', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).bind(SCHEMA_ID).run();
  } catch (_) {
  }
}

// src/editions/personal/config/settings.js
var settingsCache = { exp: 0, v: null };
function invalidateSettingsCache() {
  settingsCache = { exp: 0, v: null };
}
var XFO_CURRENT = "SAMEORIGIN";
function normalizeXfo(v) {
  const s = String(v || "").trim().toLowerCase();
  if (s === "deny")
    return "DENY";
  if (s === "off" || s === "none" || s === "0")
    return "";
  return "SAMEORIGIN";
}
async function getSettings(env2) {
  const now = Date.now();
  if (settingsCache.v && settingsCache.exp > now)
    return settingsCache.v;
  const raw = {};
  if (env2.DB) {
    try {
      const { results } = await env2.DB.prepare("SELECT key, value FROM settings").all();
      for (const r of results || [])
        if (SETTING_KEYS.includes(r.key)) raw[r.key] = r.value;
    } catch (_) {
    }
  }
  let rules = {};
  try {
    rules = JSON.parse(raw.domain_proxy_rules || "{}") || {};
  } catch (_) {
  }
  const v = {
    raw,
    healthCheck: raw.health_check === "1",
    rateLimitPerMin: Math.max(0, parseInt(raw.rate_limit_per_min || "0", 10) || 0),
    manualDomains: String(raw.manual_redirect_domains || "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean),
    domainProxyRules: { ...DOMAIN_PROXY_RULES, ...rules }
  };
  XFO_CURRENT = normalizeXfo(raw.x_frame_options);
  settingsCache = { exp: now + 3e4, v };
  return v;
}
async function setSetting(env2, key, value) {
  await env2.DB.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(key, String(value)).run();
  settingsCache = { exp: 0, v: null };
}
var SETTING_KEYS = ["health_check", "rate_limit_per_min", "manual_redirect_domains", "domain_proxy_rules", "tg_daily_report", "tg_route_alerts", "x_frame_options"];

// src/shared/integrations/analytics.js
async function cfFetchGraphql(apiToken, query) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 12e3);
  try {
    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
      signal: ctrl.signal
    });
    if (!res.ok)
      throw new Error(`cf_http_${res.status}`);
    const data = await res.json();
    if (Array.isArray(data?.errors) && data.errors.length)
      throw new Error(data.errors.map((e) => e?.message).filter(Boolean).join("; ") || "cf_graphql_error");
    return data;
  } finally {
    clearTimeout(tid);
  }
}
async function cfGetZoneAnalytics(cfZoneId, cfApiToken, startIso, endIso, useHostDim = true) {
  const dims = useHostDim ? "datetimeHour clientRequestHTTPHost" : "datetimeHour";
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
  const start = (/* @__PURE__ */ new Date(dateKey + "T00:00:00+08:00")).getTime();
  return { start: new Date(start).toISOString(), end: new Date(start + 864e5 - 1).toISOString() };
}
function tgEscape(v) {
  return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function describeTelegramError(raw) {
  const msg = String(raw == null ? "" : raw).trim();
  const low = msg.toLowerCase();
  if (!msg)
    return "\u672A\u77E5\u9519\u8BEF";
  if (low.includes("chat not found")) {
    return msg + "\uFF08\u673A\u5668\u4EBA\u627E\u4E0D\u5230\u8BE5\u4F1A\u8BDD\uFF1A\u8BF7\u5148\u7528 Telegram \u6253\u5F00\u8FD9\u4E2A\u673A\u5668\u4EBA\u5E76\u70B9\u300C\u5F00\u59CB\u300D\u6216\u53D1\u9001 /start\uFF0C\u518D\u786E\u8BA4 TELEGRAM_CHAT_ID \u586B\u7684\u662F\u8BE5\u8D26\u53F7\u7684\u6570\u5B57 ID\uFF0C\u800C\u4E0D\u662F\u624B\u673A\u53F7/\u7528\u6237\u540D\uFF09";
  }
  if (low.includes("bot was blocked"))
    return msg + "\uFF08\u8BE5\u8D26\u53F7\u628A\u673A\u5668\u4EBA\u62C9\u9ED1/\u5C4F\u853D\u4E86\uFF0C\u8BF7\u5728 Telegram \u4E2D\u89E3\u9664\u5C4F\u853D\u540E\u91CD\u65B0\u53D1\u9001 /start\uFF09";
  if (low.includes("user is deactivated"))
    return msg + "\uFF08\u8BE5 Telegram \u8D26\u53F7\u5DF2\u6CE8\u9500\uFF09";
  if (low.includes("not enough rights") || low.includes("chat_write_forbidden"))
    return msg + "\uFF08\u673A\u5668\u4EBA\u4E0D\u5728\u8BE5\u7FA4\u7EC4\uFF0C\u6216\u6CA1\u6709\u53D1\u8A00\u6743\u9650\uFF09";
  if (low.includes("unauthorized") || low.includes("invalid token"))
    return msg + "\uFF08TELEGRAM_BOT_TOKEN \u65E0\u6548\uFF0C\u8BF7\u5230 BotFather \u91CD\u65B0\u590D\u5236 Token\uFF09";
  if (low.includes("too many requests"))
    return msg + "\uFF08\u53D1\u9001\u8FC7\u4E8E\u9891\u7E41\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5\uFF09";
  if (low.includes("button_url_invalid") || low.includes("can't parse entities"))
    return msg + "\uFF08\u6D88\u606F\u5185\u5BB9\u683C\u5F0F\u9519\u8BEF\uFF09";
  return msg;
}
async function sendTelegramMessage(env2, text) {
  const token = getTelegramToken(env2);
  const chatId = getTelegramChatId(env2);
  if (!token || !chatId) {
    return { ok: false, error: "\u672A\u914D\u7F6E TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID\uFF08\u6216 TG_BOT_TOKEN / TG_CHAT_ID\uFF09", rawError: "not configured" };
  }
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 15e3);
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: String(text).slice(0, 4096), parse_mode: "HTML", disable_web_page_preview: true }),
      signal: ctrl.signal
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      const raw = data.description || "HTTP " + res.status;
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
async function claimReportSlot(env2, dateKey) {
  if (!env2.DB)
    return false;
  try {
    const r = await env2.DB.prepare(`INSERT INTO settings (key, value) VALUES ('last_report_date', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value WHERE settings.value <> excluded.value`).bind(dateKey).run();
    return Boolean(r.meta && r.meta.changes);
  } catch (_) {
    return false;
  }
}

// src/editions/personal/integrations/zone.js
function getStatsHost(env2) {
  const override = envStr(env2, "STATS_HOSTS").split(/[\s,]+/).filter(Boolean)[0] || "";
  if (override)
    return override.toLowerCase();
  return toFqdn(getDnsRecordName(env2), getBaseDomain(env2)).toLowerCase();
}
var zoneInfoCache = { at: 0, base: "", zoneId: "", accountId: "", zoneName: "", error: "" };
async function resolveZoneInfo(env2, force = false) {
  const envZone = envStr(env2, "CF_ZONE_ID");
  const envAccount = envStr(env2, "CF_ACCOUNT_ID");
  const base = getBaseDomain(env2);
  if (envZone && envAccount)
    return { zoneId: envZone, accountId: envAccount, zoneName: base, base, error: "", from: "env" };
  if (!force && zoneInfoCache && zoneInfoCache.base === base && Date.now() - zoneInfoCache.at < 6e5)
    return zoneInfoCache;
  const token = getCFApiToken(env2);
  if (!base)
    return { zoneId: envZone, accountId: envAccount, zoneName: "", base, error: "\u672A\u914D\u7F6E BASE_DOMAIN", from: "none" };
  if (!token)
    return { zoneId: envZone, accountId: envAccount, zoneName: base, base, error: "\u672A\u914D\u7F6E CF_API_TOKEN", from: "none" };
  try {
    const { zone, error: error3 } = await findZoneForHost(env2, base);
    const info3 = {
      at: Date.now(),
      base,
      zoneId: envZone || zone && zone.id || "",
      accountId: envAccount || zone && zone.account && zone.account.id || "",
      zoneName: zone && zone.name || base,
      error: zone ? "" : error3 || "\u672A\u627E\u5230\u8BE5\u57DF\u540D\u6240\u5C5E\u533A\u57DF",
      from: envZone ? "env+api" : "api"
    };
    zoneInfoCache = info3;
    return info3;
  } catch (e) {
    return { zoneId: envZone, accountId: envAccount, zoneName: base, base, error: String(e?.message || e), from: "none" };
  }
}
function invalidateZoneInfoCache() {
  zoneInfoCache = { at: 0, base: "", zoneId: "", accountId: "", zoneName: "", error: "" };
}

// src/editions/personal/config/private-store.js
var initialized = /* @__PURE__ */ new WeakMap();
async function store(env) {
  if (!env.DB) throw new Error("DB \u672A\u7ED1\u5B9A");
  if (!initialized.has(env.DB)) {
    const ready = env.DB.prepare("CREATE TABLE IF NOT EXISTS admin_private (key TEXT PRIMARY KEY, value TEXT NOT NULL)").run();
    initialized.set(env.DB, ready);
    ready.catch(() => initialized.delete(env.DB));
  }
  await initialized.get(env.DB);
  return env.DB;
}
async function getPrivate(env, key) {
  if (!env.DB) return null;
  const db = await store(env);
  const row = await db.prepare("SELECT value FROM admin_private WHERE key = ?").bind(key).first();
  return row ? row.value : null;
}
async function putPrivate(env, key, value) {
  const db = await store(env);
  await db.prepare("INSERT INTO admin_private (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(key, value).run();
}
async function replacePrivate(env, key, previous, value) {
  const db = await store(env);
  const result = previous === null ? await db.prepare("INSERT OR IGNORE INTO admin_private (key, value) VALUES (?, ?)").bind(key, value).run() : await db.prepare("UPDATE admin_private SET value = ? WHERE key = ? AND value = ?").bind(value, key, previous).run();
  return result.meta?.changes === 1;
}

// src/editions/personal/config/notifications.js
var enc = new TextEncoder();
var aad = enc.encode("emby-personal:telegram:v1");
var toBase64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
var fromBase64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
function keyBytes(env) {
  try {
    const key = fromBase64(String(env.SETTINGS_ENCRYPTION_KEY || ""));
    return key.length === 32 ? key : null;
  } catch {
    return null;
  }
}
async function encryptTelegram(env, config) {
  const bytes = keyBytes(env);
  if (!bytes) throw new Error("\u8BF7\u5148\u5728 Worker Secret \u914D\u7F6E SETTINGS_ENCRYPTION_KEY\uFF0832 \u5B57\u8282\u968F\u673A\u503C\u7684 Base64\uFF09");
  const key = await crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: aad }, key, enc.encode(JSON.stringify(config)));
  return JSON.stringify({ v: 1, iv: toBase64(iv), ciphertext: toBase64(ciphertext) });
}
async function getTelegramConfig(env) {
  const saved = await getPrivate(env, "telegram");
  if (saved === null) return { token: getTelegramToken(env), chatId: getTelegramChatId(env), source: "environment" };
  if (saved === "disabled") return { token: "", chatId: "", source: "disabled" };
  try {
    const data = JSON.parse(saved);
    const bytes = keyBytes(env);
    if (data.v !== 1 || !bytes) throw new Error();
    const key = await crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["decrypt"]);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(data.iv), additionalData: aad }, key, fromBase64(data.ciphertext));
    const config = JSON.parse(new TextDecoder().decode(plain));
    if (typeof config.token !== "string" || typeof config.chatId !== "string") throw new Error();
    return { ...config, source: "web" };
  } catch {
    return { token: "", chatId: "", source: "web", error: "\u901A\u77E5\u914D\u7F6E\u65E0\u6CD5\u89E3\u5BC6\uFF0C\u8BF7\u68C0\u67E5\u52A0\u5BC6\u4E3B\u5BC6\u94A5\u6216\u91CD\u65B0\u4FDD\u5B58\u914D\u7F6E" };
  }
}
async function notificationStatus(env) {
  const config = await getTelegramConfig(env);
  return {
    telegram: Boolean(config.token && config.chatId),
    webhook: Boolean(env.NOTIFY_WEBHOOK),
    tokenConfigured: Boolean(config.token),
    chatId: config.chatId,
    source: config.source,
    error: config.error || "",
    encryptionReady: Boolean(keyBytes(env)),
    last: JSON.parse(await getPrivate(env, "notification_last") || "null")
  };
}
async function saveTelegramConfig(env, data) {
  if (data.clear === true) {
    await putPrivate(env, "telegram", "disabled");
    return;
  }
  const previous = await getTelegramConfig(env);
  const token = String(data.token || "").trim() || previous.token;
  const chatId = String(data.chatId ?? "").trim();
  if (!/^\d+:[A-Za-z0-9_-]+$/.test(token) || token.length > 256) throw new Error("Bot Token \u683C\u5F0F\u4E0D\u6B63\u786E");
  if (!/^-?\d{1,20}$/.test(chatId)) throw new Error("Chat ID \u5FC5\u987B\u662F\u6570\u5B57\uFF08\u7FA4\u7EC4\u53EF\u4E3A\u8D1F\u6570\uFF09");
  await putPrivate(env, "telegram", await encryptTelegram(env, { token, chatId }));
}
async function notificationEnv(env) {
  const config = await getTelegramConfig(env);
  return { ...env, TELEGRAM_BOT_TOKEN: config.token, TELEGRAM_CHAT_ID: config.chatId, TG_BOT_TOKEN: "", TG_CHAT_ID: "" };
}
async function recordNotification(env, kind, ok) {
  await putPrivate(env, "notification_last", JSON.stringify({ kind, ok: Boolean(ok), at: (/* @__PURE__ */ new Date()).toISOString() }));
}
async function testTelegram(env) {
  const result = await sendTelegramMessage(await notificationEnv(env), "\u2705 Emby Proxy \u901A\u77E5\u6D4B\u8BD5\u6210\u529F\uFF08\u4E0D\u5305\u542B\u7EBF\u8DEF\u5730\u5740\uFF09");
  await recordNotification(env, "test", result.ok);
  return { ok: result.ok, error: result.ok ? "" : "\u6D4B\u8BD5\u53D1\u9001\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u673A\u5668\u4EBA\u3001Chat ID \u548C\u53D1\u9001\u6743\u9650" };
}

// src/editions/personal/integrations/analytics.js
async function cfGetZoneSummary(env2, dateKey) {
  const token = getCFApiToken(env2);
  if (!token)
    return { error: "\u672A\u914D\u7F6E CF_API_TOKEN" };
  let info3;
  try {
    info3 = await resolveZoneInfo(env2);
  } catch (e) {
    return { error: String(e?.message || e) };
  }
  if (!info3.zoneId)
    return { error: info3.error || "\u672A\u89E3\u6790\u5230 CF_ZONE_ID" };
  const { start, end } = dayRangeIso(dateKey);
  let zone = null;
  let hostDim = true;
  let firstError = "";
  try {
    zone = await cfGetZoneAnalytics(info3.zoneId, token, start, end, true);
  } catch (e) {
    firstError = String(e?.message || e);
    hostDim = false;
    try {
      zone = await cfGetZoneAnalytics(info3.zoneId, token, start, end, false);
    } catch (e2) {
      return { error: String(e2?.message || e2).slice(0, 240) };
    }
  }
  if (!zone?.series)
    return { error: "CF \u672A\u8FD4\u56DE\u6570\u636E\uFF08Token \u53EF\u80FD\u7F3A\u5C11 Analytics:Read \u6743\u9650\uFF09" };
  const statsHost = getStatsHost(env2);
  const rows = hostDim ? zone.series.filter((it) => {
    const h = String(it?.dimensions?.clientRequestHTTPHost || "").toLowerCase();
    return !statsHost || h === statsHost;
  }) : zone.series;
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
      if (h >= 0 && h < 24)
        hourly[h] += n;
    }
  }
  return {
    requests,
    visits,
    bytes,
    hourly,
    zoneId: info3.zoneId,
    zoneName: info3.zoneName,
    statsHost,
    hostMatched,
    hostDim,
    note: hostMatched ? "" : "CF \u4E2D\u672A\u627E\u5230 " + statsHost + " \u7684\u6570\u636E\uFF0C\u5F53\u524D\u5C55\u793A\u6574\u4E2A Zone \u6C47\u603B\uFF1B\u8BF7\u68C0\u67E5 DNS_RECORD_NAME / STATS_HOSTS",
    warning: firstError ? "\u6309\u57DF\u540D\u5206\u7EC4\u67E5\u8BE2\u5931\u8D25\uFF0C\u5DF2\u9000\u56DE Zone \u6C47\u603B: " + firstError.slice(0, 120) : ""
  };
}
async function cfGetZoneDailySeries(env2, days = 7) {
  const token = getCFApiToken(env2);
  if (!token)
    return { error: "\u672A\u914D\u7F6E CF_API_TOKEN" };
  let info3;
  try {
    info3 = await resolveZoneInfo(env2);
  } catch (e) {
    return { error: String(e?.message || e) };
  }
  if (!info3.zoneId)
    return { error: info3.error || "\u672A\u89E3\u6790\u5230 CF_ZONE_ID" };
  const today = getShanghaiParts().dateKey;
  const startDate = new Date((/* @__PURE__ */ new Date(today + "T00:00:00Z")).getTime() - (days - 1) * 864e5).toISOString().slice(0, 10);
  const start = (/* @__PURE__ */ new Date(startDate + "T00:00:00+08:00")).toISOString();
  const end = new Date((/* @__PURE__ */ new Date(today + "T00:00:00+08:00")).getTime() + 864e5 - 1).toISOString();
  const statsHost = getStatsHost(env2);
  let zone = null;
  let hostDim = true;
  try {
    zone = await cfGetZoneAnalytics(info3.zoneId, token, start, end, true);
  } catch (_) {
    hostDim = false;
    try {
      zone = await cfGetZoneAnalytics(info3.zoneId, token, start, end, false);
    } catch (e) {
      return { error: String(e?.message || e).slice(0, 200) };
    }
  }
  if (!zone?.series)
    return { error: "CF \u672A\u8FD4\u56DE\u6570\u636E" };
  const rows = hostDim && statsHost ? zone.series.filter((it) => {
    const h = String(it?.dimensions?.clientRequestHTTPHost || "").toLowerCase();
    return !h || h === statsHost;
  }) : zone.series;
  const map = /* @__PURE__ */ new Map();
  for (const item of rows) {
    const raw = item?.dimensions?.datetimeHour;
    if (!raw)
      continue;
    const { dateKey } = getShanghaiParts(new Date(raw).getTime());
    const cur = map.get(dateKey) || { requests: 0, traffic: 0, visits: 0 };
    cur.requests += Number(item?.count) || 0;
    cur.traffic += Number(item?.sum?.edgeResponseBytes) || 0;
    cur.visits += Number(item?.sum?.visits) || 0;
    map.set(dateKey, cur);
  }
  const series = [];
  for (let i = 0; i < days; i++) {
    const key = new Date((/* @__PURE__ */ new Date(startDate + "T00:00:00Z")).getTime() + i * 864e5).toISOString().slice(0, 10);
    const r = map.get(key) || { requests: 0, traffic: 0, visits: 0 };
    series.push({ date: key, requests: r.requests, traffic: r.traffic, visits: r.visits });
  }
  return { series, zoneId: info3.zoneId, statsHost };
}
async function cfGetWorkerSummary(env2, dateKey) {
  const token = getCFApiToken(env2);
  if (!token)
    return { error: "\u672A\u914D\u7F6E CF_API_TOKEN" };
  let info3;
  try {
    info3 = await resolveZoneInfo(env2);
  } catch (e) {
    return { error: String(e?.message || e) };
  }
  if (!info3.accountId)
    return { error: "\u672A\u89E3\u6790\u5230 CF_ACCOUNT_ID\uFF08Token \u9700 Account Analytics:Read\uFF09" };
  const { start, end } = dayRangeIso(dateKey);
  try {
    const account = await cfGetWorkerRequests(info3.accountId, token, start, end);
    if (!account?.workersInvocationsAdaptive)
      return { error: "CF \u672A\u8FD4\u56DE Worker \u8C03\u7528\u6570\u636E" };
    let requests = 0;
    const hourly = Array.from({ length: 24 }, () => 0);
    const byScript = {};
    for (const item of account.workersInvocationsAdaptive) {
      const n = Number(item?.sum?.requests) || 0;
      requests += n;
      const name = item?.dimensions?.scriptName || "unknown";
      byScript[name] = (byScript[name] || 0) + n;
      const raw = item?.dimensions?.datetime;
      if (raw) {
        const h = (new Date(raw).getUTCHours() + 8) % 24;
        if (h >= 0 && h < 24)
          hourly[h] += n;
      }
    }
    return { requests, hourly, byScript, accountId: info3.accountId };
  } catch (e) {
    return { error: String(e?.message || e).slice(0, 200) };
  }
}
async function buildDailyReport(env2, dateKey) {
  const key = /^\d{4}-\d{2}-\d{2}$/.test(dateKey || "") ? dateKey : getShanghaiParts().dateKey;
  const cf = await cfGetZoneSummary(env2, key);
  const worker = await cfGetWorkerSummary(env2, key);
  const cfOk = !cf.error;
  let daily = [];
  if (cfOk) {
    const s = await cfGetZoneDailySeries(env2, 7);
    if (!s.error && Array.isArray(s.series))
      daily = s.series;
  }
  const requests = cfOk ? Number(cf.requests) || 0 : null;
  const traffic = cfOk ? Number(cf.bytes) || 0 : null;
  const lines = [];
  lines.push("\u{1F4CA} <b>Emby Proxy \u65E5\u62A5</b>");
  lines.push("<code>" + tgEscape(key) + "</code>");
  lines.push("");
  lines.push("\u8BF7\u6C42\u6570\uFF1A" + (requests == null ? "\uFF08CF \u6570\u636E\u4E0D\u53EF\u7528\uFF09" : "<b>" + requests + "</b>"));
  lines.push("\u51FA\u7AD9\u6D41\u91CF\uFF1A" + (traffic == null ? "\uFF08CF \u6570\u636E\u4E0D\u53EF\u7528\uFF09" : "<b>" + formatBytes(traffic) + "</b>"));
  if (cfOk) {
    lines.push("CF \u8BBF\u95EE\u91CF\uFF1A<b>" + (Number(cf.visits) || 0) + "</b>");
  }
  if (!worker.error && worker.requests)
    lines.push("Worker \u8C03\u7528\uFF1A<b>" + worker.requests + "</b>");
  if (daily.length) {
    lines.push("");
    lines.push("<b>\u8FD1 7 \u65E5</b>");
    for (const d of daily) {
      lines.push(d.date + "  " + d.requests + " \u6B21 / " + formatBytes(d.traffic));
    }
  }
  if (!cfOk) {
    lines.push("");
    lines.push("<i>CF \u6570\u636E\u4E0D\u53EF\u7528\uFF0C\u8BF7\u767B\u5F55\u540E\u53F0\u68C0\u67E5\u7EDF\u8BA1\u914D\u7F6E</i>");
  }
  lines.push("");
  lines.push("<i>" + tgEscape((/* @__PURE__ */ new Date()).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })) + "</i>");
  return lines.join("\n");
}
async function sendDailyReport(env2, dateKey) {
  const key = /^\d{4}-\d{2}-\d{2}$/.test(dateKey || "") ? dateKey : getShanghaiParts().dateKey;
  const text = await buildDailyReport(env2, key);
  const result = await sendTelegramMessage(await notificationEnv(env2), text);
  const tg = { ok: result.ok, ...result.ok ? {} : { error: "Telegram \u53D1\u9001\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u901A\u77E5\u914D\u7F6E\u548C\u673A\u5668\u4EBA\u6743\u9650" } };
  let webhook = { ok: false, skipped: true };
  if (env2.NOTIFY_WEBHOOK && isValidHttpUrl(env2.NOTIFY_WEBHOOK)) {
    try {
      const res = await fetch(env2.NOTIFY_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, content: text, date: key }),
        signal: AbortSignal.timeout(15e3)
      });
      webhook = { ok: res.ok, status: res.status };
    } catch (e) {
      webhook = { ok: false, error: "Webhook \u53D1\u9001\u5931\u8D25" };
    }
  }
  await recordNotification(env2, "daily", tg.ok || webhook.ok);
  return { ok: tg.ok || webhook.ok, telegram: tg, webhook, date: key, text };
}

// src/editions/personal/auth/password.js
var enc2 = new TextEncoder();
var ITERATIONS = 1e5;
async function keyedHash(secret, text) {
  const key = await crypto.subtle.importKey("raw", enc2.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toHex(await crypto.subtle.sign("HMAC", key, enc2.encode(text)));
}
function equal(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
async function credentialState(env) {
  const raw = await getPrivate(env, "password");
  if (raw === null) return { raw, record: null };
  const record = JSON.parse(raw);
  if (record.v !== 1 || record.iterations !== ITERATIONS || !/^[a-f0-9]{32}$/.test(record.salt) || !/^[a-f0-9]{64}$/.test(record.hash) || !/^[a-f0-9]{64}$/.test(record.epoch)) throw new Error("\u767B\u5F55\u914D\u7F6E\u65E0\u6548\uFF0C\u8BF7\u5728 Cloudflare \u4FA7\u91CD\u7F6E");
  return { raw, record };
}
async function passwordHash(env, password, salt) {
  const pepper = getAdminToken(env);
  if (!pepper) throw new Error("Worker \u672A\u914D\u7F6E ADMIN_TOKEN");
  const input = await keyedHash(pepper, "password:" + password);
  const key = await crypto.subtle.importKey("raw", enc2.encode(input), "PBKDF2", false, ["deriveBits"]);
  return toHex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc2.encode(salt), iterations: ITERATIONS }, key, 256));
}
async function verifyPassword(env, password, state = null) {
  const secret = getAdminToken(env);
  if (!secret || typeof password !== "string" || password.length > 1024) return false;
  state ||= await credentialState(env);
  if (!state.record) return equal(await keyedHash(secret, "compare:" + password.trim()), await keyedHash(secret, "compare:" + secret));
  return equal(await passwordHash(env, password, state.record.salt), state.record.hash);
}
async function sessionSecret(env, state = null) {
  const root = getAdminToken(env);
  if (!root) return null;
  state ||= await credentialState(env);
  return state.record ? keyedHash(root, "session-epoch:" + state.record.epoch) : root;
}
async function changePassword(env, currentPassword, newPassword) {
  if (typeof newPassword !== "string" || newPassword.length < 12 || newPassword.length > 128) return { ok: false, status: 400, error: "\u65B0\u5BC6\u7801\u987B\u4E3A 12\u2013128 \u4E2A\u5B57\u7B26" };
  const state = await credentialState(env);
  if (!await verifyPassword(env, currentPassword, state)) return { ok: false, status: 403, error: "\u5F53\u524D\u5BC6\u7801\u9519\u8BEF" };
  if (currentPassword === newPassword) return { ok: false, status: 400, error: "\u65B0\u5BC6\u7801\u4E0D\u80FD\u4E0E\u5F53\u524D\u5BC6\u7801\u76F8\u540C" };
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
  const record = { v: 1, iterations: ITERATIONS, salt, hash: await passwordHash(env, newPassword, salt), epoch: toHex(crypto.getRandomValues(new Uint8Array(32))) };
  const ok = await replacePrivate(env, "password", state.raw, JSON.stringify(record));
  return ok ? { ok: true } : { ok: false, status: 409, error: "\u5BC6\u7801\u5DF2\u88AB\u5176\u4ED6\u64CD\u4F5C\u66F4\u65B0\uFF0C\u8BF7\u91CD\u65B0\u767B\u5F55" };
}

// src/editions/personal/integrations/alert-privacy.js
var remarkCharacters = /^[\p{L}\p{M}\p{N}\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Regional_Indicator} _\-·—–()[\]{}<>!&'",，、“”‘’「」【】《》〈〉~+|]+$/u;
var credentialWords = /(?:\b(?:token|secret|password|passwd|authorization|bearer|credential|signature|sig|jwt|key|api[-_ ]?key|access[-_ ]?token)\b|密码|口令|密钥|令牌|签名|凭据)/iu;
var opaqueCredentials = /[a-z\d_-]{24,}|[a-f\d]{16,}|\d{9,}/i;
var normalizeRemark = (text) => text.normalize("NFKC").replace(/\s+/gu, " ").replace(/[\p{Cc}\p{Cf}]/gu, "").trim();
var escapeTelegramHtml = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function safeRouteRemark(remark, privateValues = []) {
  if (typeof remark !== "string" || remark.length > 512) return "";
  const name = normalizeRemark(remark);
  if (!name || [...name].length > 64 || !remarkCharacters.test(name) || credentialWords.test(name) || opaqueCredentials.test(name)) return "";
  const canonical = name.toLowerCase();
  if (privateValues.some((value) => {
    if (typeof value !== "string" || !value) return false;
    const secret = normalizeRemark(value).toLowerCase();
    return secret && (canonical === secret || secret.length >= 4 && canonical.includes(secret));
  })) return "";
  return name;
}
async function notificationId(env, prefix) {
  const secret = getAdminToken(env);
  if (!secret) return "R-UNKNOWN";
  return "R-" + (await keyedHash(secret, "notification-route:" + prefix)).slice(0, 12).toUpperCase();
}
async function privateHealthAlert(env, prefix, index, down, { remark = "", targets = [] } = {}) {
  const privateValues = Object.entries(env).filter(([key, value]) => typeof value === "string" && /token|secret|password|key/i.test(key)).map(([, value]) => value);
  for (const target of targets) {
    try {
      const url = new URL(target);
      privateValues.push(url.hostname, url.pathname, ...url.searchParams.values());
      privateValues.push(decodeURIComponent(url.username), decodeURIComponent(url.password));
    } catch {
    }
  }
  const name = safeRouteRemark(remark, privateValues);
  const label = name ? escapeTelegramHtml(name) : await notificationId(env, prefix);
  return `${down ? "\u{1F534} \u7EBF\u8DEF\u5F02\u5E38" : "\u{1F7E2} \u7EBF\u8DEF\u6062\u590D"}\uFF1A${label} \xB7 \u8282\u70B9 ${index + 1}
\u8BF7\u767B\u5F55\u540E\u53F0\u67E5\u770B\u8BE6\u60C5`;
}
function healthAlertMessages(alerts) {
  const messages = [];
  let current = "";
  for (const alert of alerts) {
    const next = current ? current + "\n\n" + alert : alert;
    if (next.length > 4096 && current) {
      messages.push(current);
      current = alert;
    } else current = next;
  }
  if (current) messages.push(current);
  return messages;
}

// src/editions/personal/maintenance.js
async function runHealthCheck(env2, manual = false) {
  if (!env2.DB)
    return { checked: 0, alerts: [] };
  const { results: routes } = await env2.DB.prepare("SELECT prefix, target, remark FROM routes WHERE enabled != 0").all();
  const { results: states } = await env2.DB.prepare("SELECT * FROM route_health").all();
  const stateMap = new Map((states || []).map((r) => [r.prefix + "|" + r.target, r]));
  const jobs = [];
  for (const r of routes || []) {
    for (const [index, t] of splitTargets(r.target).entries())
      jobs.push({ r, t, index });
  }
  const limited = jobs.slice(0, 40);
  const probes = await Promise.all(limited.map(async (j) => ({ ...j, res: await probeTarget(j.t) })));
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const stmts = [];
  const alerts = [];
  for (const { r, t, index, res } of probes) {
    const prev = stateMap.get(r.prefix + "|" + t);
    const fail = res.ok ? 0 : (prev?.fail_count || 0) + 1;
    const down = res.ok ? 0 : fail >= 2 ? 1 : prev?.down || 0;
    const changed = (prev?.down || 0) !== down;
    if (changed)
      alerts.push(await privateHealthAlert(env2, r.prefix, index, down, { remark: r.remark, targets: splitTargets(r.target) }));
    stmts.push(env2.DB.prepare(`INSERT INTO route_health (prefix, target, down, fail_count, latency, last_check, last_change) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(prefix, target) DO UPDATE SET down = excluded.down, fail_count = excluded.fail_count, latency = excluded.latency,
         last_check = excluded.last_check, last_change = CASE WHEN route_health.down != excluded.down THEN excluded.last_check ELSE route_health.last_change END`).bind(r.prefix, t, down, fail, res.ms, nowIso, nowIso));
  }
  if (stmts.length)
    await env2.DB.batch(stmts);
  const settings = await getSettings(env2);
  if (alerts.length && String(settings.raw.tg_route_alerts ?? "1") !== "0") {
    const effectiveEnv = await notificationEnv(env2);
    let ok = true;
    for (const text of healthAlertMessages(alerts)) {
      const result = await notify(effectiveEnv, text);
      ok = result.ok && ok;
    }
    await recordNotification(env2, "health", ok);
  }
  return { checked: probes.length, alerts };
}
async function runScheduled(env2) {
  if (!env2.DB)
    return;
  await initDatabase(env2);
  const st = await getSettings(env2);
  if (st.healthCheck) {
    try {
      await runHealthCheck(env2);
    } catch (_) {
    }
  }
  const now = getShanghaiParts();
  const reportEnabled = String(st.raw.tg_daily_report ?? "1") !== "0";
  if (reportEnabled && now.hour === 23) {
    try {
      if (await claimReportSlot(env2, now.dateKey))
        await sendDailyReport(env2, now.dateKey);
    } catch (_) {
    }
  }
}

// src/shared/http/responses.js
function sanitizeResponseHeaders(upstreamHeaders) {
  const headers = new Headers(upstreamHeaders);
  for (const name of (headers.get("Connection") || "").split(",")) {
    const token = name.trim();
    if (token) headers.delete(token);
  }
  for (const name of DROP_RESPONSE_HEADERS) headers.delete(name);
  for (const name of ["connection", "keep-alive", "proxy-connection", "transfer-encoding", "te", "trailer", "upgrade", "proxy-authenticate", "proxy-authorization"]) headers.delete(name);
  return headers;
}
function json(data, status = 200) {
  const headers = { ...CORS_JSON, "Cache-Control": "no-store" };
  for (const [k, v] of Object.entries(SECURITY_HEADERS))
    headers[k] = v;
  return new Response(JSON.stringify(data), { status, headers });
}
function html(body, status = 200) {
  const headers = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" };
  for (const [k, v] of Object.entries(SECURITY_HEADERS))
    headers[k] = v;
  return new Response(body, { status, headers });
}

// src/editions/personal/auth/session.js
var SESSION_TTL_SEC = 7200;
var enc3 = new TextEncoder();
async function hmacHex(secret, msg) {
  const key = await crypto.subtle.importKey("raw", enc3.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toHex(await crypto.subtle.sign("HMAC", key, enc3.encode(msg)));
}
async function safeEqual(a, b, secret) {
  const [x, y] = await Promise.all([hmacHex(secret, "cmp:" + a), hmacHex(secret, "cmp:" + b)]);
  let d = 0;
  for (let i = 0; i < x.length; i++)
    d |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return d === 0;
}
async function makeSessionToken(secret) {
  const exp = Math.floor(Date.now() / 1e3) + SESSION_TTL_SEC;
  return exp + "." + await hmacHex(secret, "session:" + exp);
}
async function isAdmin(request, env2) {
  const tok = getCookie(request, SESSION_COOKIE);
  if (!tok)
    return false;
  let secret;
  try {
    secret = await sessionSecret(env2);
  } catch {
    return false;
  }
  if (!secret) return false;
  const [expStr, sig] = tok.split(".");
  const exp = parseInt(expStr, 10);
  if (!sig || !Number.isFinite(exp) || exp < Math.floor(Date.now() / 1e3))
    return false;
  return safeEqual(sig, await hmacHex(secret, "session:" + exp), secret);
}
var loginFails = /* @__PURE__ */ new Map();
function loginBlocked(ip) {
  const rec = loginFails.get(ip);
  if (!rec)
    return false;
  if (Date.now() - rec.first > LOGIN_WINDOW_MS) {
    loginFails.delete(ip);
    return false;
  }
  return rec.n >= LOGIN_MAX_FAILS;
}
function loginFailed(ip) {
  const now = Date.now();
  const rec = loginFails.get(ip);
  if (!rec || now - rec.first > LOGIN_WINDOW_MS)
    loginFails.set(ip, { n: 1, first: now });
  else
    rec.n++;
  if (loginFails.size > 5e3) {
    for (const [k, v] of loginFails)
      if (now - v.first > LOGIN_WINDOW_MS)
        loginFails.delete(k);
  }
}
async function adminLoginResponse(request, env2, tokenFromUser) {
  const expected = getAdminToken(env2);
  if (!expected) {
    return json({
      ok: false,
      error: "Worker \u672A\u8BFB\u5230 ADMIN_TOKEN\u3002\u8BF7\u5728 Cloudflare \u63A7\u5236\u53F0 \u2192 Worker \u2192 \u8BBE\u7F6E \u2192 \u53D8\u91CF\u548C\u673A\u5BC6 \u4E2D\u6DFB\u52A0 ADMIN_TOKEN\u3002"
    }, 503);
  }
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  if (loginBlocked(ip))
    return json({ ok: false, error: "\u5C1D\u8BD5\u6B21\u6570\u8FC7\u591A\uFF0C\u8BF7 10 \u5206\u949F\u540E\u518D\u8BD5" }, 429);
  let state;
  try {
    state = await credentialState(env2);
  } catch {
    return json({ ok: false, error: "\u767B\u5F55\u914D\u7F6E\u6682\u4E0D\u53EF\u7528\uFF0C\u8BF7\u68C0\u67E5\u6570\u636E\u5E93\u6216\u6267\u884C\u7BA1\u7406\u5458\u6062\u590D\u6D41\u7A0B" }, 503);
  }
  if (!await verifyPassword(env2, tokenFromUser, state)) {
    loginFailed(ip);
    return json({ ok: false, error: "\u5BC6\u94A5\u9519\u8BEF" }, 401);
  }
  loginFails.delete(ip);
  const cookie = `${SESSION_COOKIE}=${encodeURIComponent(await makeSessionToken(await sessionSecret(env2, state)))}; Path=/; Max-Age=${SESSION_TTL_SEC}; HttpOnly; SameSite=Strict; Secure`;
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Set-Cookie": cookie,
      "Cache-Control": "no-store"
    }
  });
}

// text-asset:web/personal/admin.js
var admin_default = `let allRoutes = [];
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
  var done = function() { showToast('\u5DF2\u590D\u5236 ' + v); };
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
    document.getElementById('routeList').innerHTML = '<p class="muted">\u52A0\u8F7D\u5931\u8D25: ' + esc(e.message) + '</p>';
  }
}

function renderRoutes(list) {
  const el = document.getElementById('routeList');
  var countChip = document.getElementById('routeCount');
  if (countChip) countChip.textContent = list.length + ' \u6761';
  var tabBadge = document.getElementById('tabRouteCount');
  if (tabBadge) tabBadge.textContent = list.length;
  if (!list.length) {
    el.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><span class="empty-state-icon">\u{1F4E6}</span><p class="empty-state-text">\u6682\u65E0\u8DEF\u7531\uFF0C\u70B9\u51FB\u4E0A\u65B9\u6309\u94AE\u6DFB\u52A0</p></div>';
    return;
  }
  el.innerHTML = list.map((r, ri) => {
    const targets = r.target.split(',').map(s => s.trim()).filter(Boolean);
    const remarkName = r.remark || '\u672A\u547D\u540D';
    const cacheStatus = r.cache_img !== 'off';
    const compatStatus = r.compat_mode === 'on';

    let targetsHtml = '';
    targets.forEach((t, idx) => {
      const tag = idx === 0 ? '<span style="color:var(--ok);font-weight:700">[\u4E3B]</span>' : '<span style="color:var(--warn);font-weight:700">[\u5907' + idx + ']</span>';
      targetsHtml += '<div class="target-row">' + tag + ' <span class="target-url"><code>' + esc(t) + '</code></span></div>';
    });

    const fullUrl = location.origin + '/' + r.prefix;
    const disabled = r.enabled === 0;
    return '<div class="route-item" style="' + (disabled ? 'opacity:.55' : '') + '" data-search="' + esc((remarkName + ' ' + r.prefix).toLowerCase()) + '">' +
      '<div class="route-header">' +
        '<div class="route-title">' +
          '<h3 class="route-name">' + esc(remarkName) + '</h3>' +
          '<span class="route-path route-link" title="\u70B9\u51FB\u590D\u5236">' + esc(fullUrl) + '</span>' +
          '<button class="btn btn-sm btn-copy" onclick="copyRoute(this)" data-copy="' + esc(fullUrl) + '" title="\u590D\u5236\u5B8C\u6574\u94FE\u63A5">\u29C9</button>' +
        '</div>' +
      '</div>' +
      '<div class="target-list">' + targetsHtml + '</div>' +
      '<div class="route-meta">' +
        (r.notification_id ? '<span class="meta-tag">\u901A\u77E5\u7F16\u53F7\uFF1A' + esc(r.notification_id) + '</span>' : '') +
        (disabled ? '<span class="meta-tag" style="color:var(--warn);border-color:var(--warn-dim)">\u23F8 \u5DF2\u505C\u7528</span>' : '') +
        (r.down_count ? '<span class="meta-tag" style="color:var(--warn);border-color:var(--warn-dim)">\u{1F534} ' + r.down_count + ' \u6761\u7EBF\u8DEF\u5F02\u5E38</span>' : '') +
        (cacheStatus ? '<span class="meta-tag">\u{1F5BC}\uFE0F \u7F13\u5B58\u5F00\u542F</span>' : '<span class="meta-tag">\u7F13\u5B58\u5173\u95ED</span>') +
        (compatStatus ? '<span class="meta-tag" style="color:var(--warn);border-color:var(--warn-dim)">\u{1F527} \u517C\u5BB9\u6A21\u5F0F</span>' : '') +
        (r.ip_mode === 'strip' ? '<span class="meta-tag" style="color:var(--info);border-color:var(--info-dim)">\u{1F6E1}\uFE0F IP\u4E0D\u900F\u4F20</span>' : '') +
        (r.ip_mode === 'disable' ? '<span class="meta-tag" style="color:var(--ok);border-color:var(--ok-dim)">\u{1F6E1}\uFE0F IP\u5F7B\u5E95\u9690\u85CF</span>' : '') +
        '<span class="meta-tag">VPS \u4E2D\u7EE7\uFF1A' + (r.use_relay === 'on' ? '\u5F00' : r.use_relay === 'off' ? '\u5173' : '\u81EA\u52A8') + '</span>' +
        (r.last_play ? '<span class="meta-tag">\u{1F4FA} ' + esc(r.last_play) + '</span>' : '') +
      '</div>' +
      '<div class="route-actions">' +
        '<button class="btn btn-sm" data-act="up" data-prefix="' + esc(r.prefix) + '"' + (ri === 0 ? ' disabled' : '') + '>\u2191</button>' +
        '<button class="btn btn-sm" data-act="down" data-prefix="' + esc(r.prefix) + '"' + (ri === list.length - 1 ? ' disabled' : '') + '>\u2193</button>' +
        '<button class="btn btn-sm" data-act="test" data-prefix="' + esc(r.prefix) + '">\u6D4B\u8BD5</button>' +
        '<button class="btn btn-sm" data-act="toggle" data-prefix="' + esc(r.prefix) + '" data-enabled="' + (disabled ? '1' : '0') + '">' + (disabled ? '\u542F\u7528' : '\u505C\u7528') + '</button>' +
        '<button class="btn btn-sm" data-act="edit" data-prefix="' + esc(r.prefix) + '">\u7F16\u8F91</button>' +
        '<button class="btn btn-sm btn-danger" data-act="del" data-prefix="' + esc(r.prefix) + '">\u5220\u9664</button>' +
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
  showToast(x.ok ? (enable ? '\u5DF2\u542F\u7528' : '\u5DF2\u505C\u7528') : (x.data.error || '\u64CD\u4F5C\u5931\u8D25'));
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
  btn.disabled = true; btn.textContent = '\u6D4B\u8BD5\u4E2D';
  const x = await postJson('/admin/api/routes/test', { prefix: prefix });
  btn.disabled = false; btn.textContent = '\u6D4B\u8BD5';
  if (!x.ok) { showToast(x.data.error || '\u6D4B\u8BD5\u5931\u8D25'); return; }
  showToast(x.data.results.map(function(r, i) {
    return (i === 0 ? '\u4E3B' : '\u5907' + i) + ' ' + (r.ok ? r.ms + 'ms' : '\u5931\u8D25');
  }).join('  |  '));
}

async function importConfig(input) {
  const f = input.files && input.files[0];
  input.value = '';
  if (!f) return;
  if (f.size > 2 * 1024 * 1024) { showToast('\u914D\u7F6E\u6587\u4EF6\u4E0D\u80FD\u8D85\u8FC7 2 MiB\uFF0C\u8BF7\u5206\u6279\u5BFC\u5165'); return; }
  let data;
  try { data = JSON.parse(await f.text()); } catch (e) { showToast('\u4E0D\u662F\u5408\u6CD5\u7684 JSON \u6587\u4EF6'); return; }
  const preview = await postJson('/admin/api/import/preview', data);
  if (!preview.ok || !preview.data.canImport) { showToast(preview.data.error || '\u9884\u68C0\u53D1\u73B0\u65E0\u6548\u6216\u91CD\u590D\u7EBF\u8DEF\uFF0C\u8BF7\u4FEE\u6B63\u914D\u7F6E\u540E\u91CD\u8BD5'); return; }
  if (!confirm('\u53EA\u8BFB\u9884\u68C0\u5B8C\u6210\uFF1A\u65B0\u589E ' + preview.data.added.length + ' \u6761\uFF0C\u8986\u76D6 ' + preview.data.overwritten.length + ' \u6761\uFF1B\u8BBE\u7F6E\u9879 ' + preview.data.settings.length + ' \u4E2A\u3002\u5BFC\u5165\u540E\u5C06\u4FEE\u6539\u672C\u5730\u914D\u7F6E\uFF0C\u786E\u5B9A\u7EE7\u7EED\uFF1F')) return;
  const x = await postJson('/admin/api/import', data);
  if (!x.ok) { showToast(x.data.error || '\u5BFC\u5165\u5931\u8D25'); return; }
  showToast('\u5BFC\u5165\u5B8C\u6210\uFF1A\u8DEF\u7531 ' + x.data.routes + '\uFF0C\u57DF\u540D ' + x.data.domains + (x.data.skipped.length ? '\uFF0C\u8DF3\u8FC7 ' + x.data.skipped.length : ''));
  loadRoutes(); loadDomains();
}

async function openSettings() {
  const r = await fetch('/admin/api/settings');
  const d = await r.json();
  const s = d.settings || {};
  document.getElementById('setHealth').checked = s.health_check === '1';
  document.getElementById('setDailyReport').checked = String(s.tg_daily_report ?? '1') !== '0';
  document.getElementById('setRouteAlerts').checked = String(s.tg_route_alerts ?? '1') !== '0';
  document.getElementById('setRate').value = s.rate_limit_per_min || '0';
  document.getElementById('setXfo').value = s.x_frame_options || '';
  document.getElementById('setManual').value = s.manual_redirect_domains || '';
  document.getElementById('setRules').value = s.domain_proxy_rules || '';
  const n = d.notify || {};
  document.getElementById('notifyHint').textContent = (n.telegram || n.webhook)
    ? '\u901A\u77E5\u6E20\u9053\uFF1A' + [n.telegram ? 'Telegram' : '', n.webhook ? 'Webhook' : ''].filter(Boolean).join(' + ')
    : '\u5C1A\u672A\u914D\u7F6E\u901A\u77E5\uFF0C\u8BF7\u5728\u4E0B\u65B9\u586B\u5199 Telegram \u914D\u7F6E';
  renderTelegramStatus(n);
  ['tgBotToken', 'currentPassword', 'newPassword', 'confirmPassword'].forEach(id => { document.getElementById(id).value = ''; });
  openModal('modalSettings');
}

function renderTelegramStatus(n) {
  document.getElementById('tgChatId').value = n.chatId || '';
  document.getElementById('tgBotToken').placeholder = n.tokenConfigured ? 'Token \u5DF2\u914D\u7F6E\uFF08\u7559\u7A7A\u4FDD\u6301\u4E0D\u53D8\uFF09' : '\u586B\u5199 Bot Token';
  document.getElementById('tgConfigStatus').textContent = n.error || ('\u6765\u6E90\uFF1A' + ({ web: '\u7F51\u9875\u52A0\u5BC6\u914D\u7F6E', environment: 'Worker \u73AF\u5883\u53D8\u91CF', disabled: '\u5DF2\u505C\u7528' }[n.source] || '\u672A\u77E5') + (n.encryptionReady ? ' \xB7 \u52A0\u5BC6\u4E3B\u5BC6\u94A5\u5DF2\u5C31\u7EEA' : ' \xB7 \u7F51\u9875\u4FDD\u5B58\u524D\u9700\u914D\u7F6E SETTINGS_ENCRYPTION_KEY'));
  document.getElementById('tgLastStatus').textContent = n.last ? '\u6700\u8FD1\u901A\u77E5\uFF1A' + n.last.at + ' \xB7 ' + (n.last.ok ? '\u6210\u529F' : '\u5931\u8D25') + '\uFF08' + n.last.kind + '\uFF09' : '\u6682\u65E0\u53D1\u9001\u8BB0\u5F55';
}

async function saveTelegram(btn) {
  btn.disabled = true;
  try {
    const x = await postJson('/admin/api/notifications', { token: document.getElementById('tgBotToken').value, chatId: document.getElementById('tgChatId').value });
    if (!x.ok) { showToast(x.data.error || '\u4FDD\u5B58\u5931\u8D25'); return; }
    document.getElementById('tgBotToken').value = '';
    renderTelegramStatus(x.data);
    showToast('TG \u914D\u7F6E\u5DF2\u52A0\u5BC6\u4FDD\u5B58');
  } catch { showToast('\u8BF7\u6C42\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u8FDE\u63A5'); } finally { btn.disabled = false; }
}

async function testTelegramConfig(btn) {
  if (document.getElementById('tgBotToken').value) { showToast('\u8BF7\u5148\u4FDD\u5B58 TG \u914D\u7F6E\u518D\u6D4B\u8BD5'); return; }
  btn.disabled = true;
  try {
    const x = await postJson('/admin/api/notifications/test', {});
    showToast(x.ok ? '\u6D4B\u8BD5\u901A\u77E5\u5DF2\u53D1\u9001' : x.data.error || '\u53D1\u9001\u5931\u8D25');
    const r = await fetch('/admin/api/notifications');
    if (r.ok) renderTelegramStatus(await r.json());
  } catch { showToast('\u8BF7\u6C42\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u8FDE\u63A5'); } finally { btn.disabled = false; }
}

async function clearTelegram(btn) {
  if (!confirm('\u786E\u5B9A\u6E05\u9664\u5E76\u505C\u7528 Telegram\uFF1F\u4E0D\u4F1A\u56DE\u9000\u4F7F\u7528 Worker \u73AF\u5883\u53D8\u91CF\u3002Webhook \u4E0D\u53D7\u5F71\u54CD\u3002')) return;
  btn.disabled = true;
  try {
    const x = await postJson('/admin/api/notifications', { clear: true });
    if (!x.ok) { showToast(x.data.error || '\u6E05\u9664\u5931\u8D25'); return; }
    document.getElementById('tgBotToken').value = '';
    renderTelegramStatus(x.data);
    showToast('Telegram \u5DF2\u505C\u7528');
  } catch { showToast('\u8BF7\u6C42\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u8FDE\u63A5'); } finally { btn.disabled = false; }
}

async function updatePassword(btn) {
  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  if (newPassword.length < 12 || newPassword.length > 128 || newPassword !== confirmPassword) { showToast('\u65B0\u5BC6\u7801\u987B\u4E3A 12\u2013128 \u4E2A\u5B57\u7B26\u4E14\u4E24\u6B21\u4E00\u81F4'); return; }
  if (!confirm('\u4FEE\u6539\u540E\u6240\u6709\u65E7\u4F1A\u8BDD\u90FD\u4F1A\u5931\u6548\uFF0C\u786E\u5B9A\u7EE7\u7EED\uFF1F')) return;
  btn.disabled = true;
  try {
    const x = await postJson('/admin/api/security/password', { currentPassword, newPassword, confirmPassword });
    if (!x.ok) { showToast(x.data.error || '\u4FEE\u6539\u5931\u8D25'); return; }
    location.href = '/';
  } catch { showToast('\u8BF7\u6C42\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u8FDE\u63A5'); } finally {
    ['currentPassword', 'newPassword', 'confirmPassword'].forEach(id => { document.getElementById(id).value = ''; });
    btn.disabled = false;
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
  if (!x.ok) { showToast(x.data.error || '\u4FDD\u5B58\u5931\u8D25'); return; }
  closeModal('modalSettings');
  showToast('\u8BBE\u7F6E\u5DF2\u4FDD\u5B58');
}

async function runNow() {
  showToast('\u6267\u884C\u4E2D...');
  const x = await postJson('/admin/api/health/run', {});
  if (!x.ok) { showToast('\u6267\u884C\u5931\u8D25'); return; }
  showToast('\u5DF2\u68C0\u67E5 ' + x.data.checked + ' \u6761\u7EBF\u8DEF\uFF0C\u72B6\u6001\u53D8\u5316 ' + x.data.alerts.length + ' \u6761');
  loadRoutes();
}

var AUDIT_ACTIONS = {
  'notification.save': '\u4FEE\u6539\u901A\u77E5\u914D\u7F6E',
  'notification.test': '\u6D4B\u8BD5\u901A\u77E5',
  'security.password': '\u4FEE\u6539\u767B\u5F55\u5BC6\u7801',
  settings: '\u4FEE\u6539\u8BBE\u7F6E',
  'report.send': '\u53D1\u9001\u65E5\u62A5',
  import: '\u5BFC\u5165\u914D\u7F6E',
  'route.save': '\u4FDD\u5B58\u8DEF\u7531',
  'route.rename': '\u91CD\u547D\u540D\u8DEF\u7531',
  'route.delete': '\u5220\u9664\u8DEF\u7531',
  'route.enable': '\u542F\u7528\u8DEF\u7531',
  'route.disable': '\u7981\u7528\u8DEF\u7531',
  'domain.add': '\u6DFB\u52A0\u4F18\u9009\u57DF\u540D',
  'domain.update': '\u66F4\u65B0\u4F18\u9009\u57DF\u540D',
  'domain.delete': '\u5220\u9664\u4F18\u9009\u57DF\u540D',
  'dns.replace': '\u66FF\u6362 DNS \u8BB0\u5F55',
  'user.register': '\u7528\u6237\u6CE8\u518C',
  'user.create': '\u521B\u5EFA\u7528\u6237',
  'user.update': '\u66F4\u65B0\u7528\u6237',
  'user.delete': '\u5220\u9664\u7528\u6237',
  'user.password': '\u4FEE\u6539\u5BC6\u7801',
  'user.dns': '\u7ED1\u5B9A\u7528\u6237 DNS',
  'user.route.save': '\u4FDD\u5B58\u7528\u6237\u8DEF\u7531',
  'user.route.delete': '\u5220\u9664\u7528\u6237\u8DEF\u7531',
  'invite.create': '\u751F\u6210\u9080\u8BF7\u7801',
  'invite.delete': '\u5220\u9664\u9080\u8BF7\u7801',
  'db.reset': '\u91CD\u7F6E\u6570\u636E\u5E93'
};
var AUDIT_SETTINGS = {
  health_check: '\u7EBF\u8DEF\u5065\u5EB7\u68C0\u67E5',
  tg_daily_report: '\u6BCF\u65E5\u65E5\u62A5',
  rate_limit_per_min: '\u6BCF\u5206\u949F\u8BF7\u6C42\u9650\u5236',
  x_frame_options: 'X-Frame-Options',
  manual_redirect_domains: '\u624B\u52A8\u8DF3\u8F6C\u57DF\u540D',
  domain_proxy_rules: '\u57DF\u540D\u4EE3\u7406\u89C4\u5219'
};
function auditActionLabel(a) { return AUDIT_ACTIONS[a] || a || '\u2014'; }
function auditTgError(raw) {
  var s = String(raw || '');
  var l = s.toLowerCase();
  if (l.indexOf('chat not found') >= 0) return '\u673A\u5668\u4EBA\u627E\u4E0D\u5230\u8BE5\u4F1A\u8BDD\uFF08\u8BF7\u5148\u7ED9\u673A\u5668\u4EBA\u53D1\u9001 /start\uFF0C\u5E76\u6838\u5BF9 Chat ID\uFF09';
  if (l.indexOf('bot was blocked') >= 0) return '\u673A\u5668\u4EBA\u5DF2\u88AB\u8BE5\u8D26\u53F7\u5C4F\u853D';
  if (l.indexOf('unauthorized') >= 0) return 'Bot Token \u65E0\u6548';
  if (l.indexOf('not enough rights') >= 0) return '\u673A\u5668\u4EBA\u6CA1\u6709\u53D1\u8A00\u6743\u9650';
  if (l.indexOf('not configured') >= 0) return '\u672A\u914D\u7F6E Telegram \u53D8\u91CF';
  return s;
}
function auditDetailText(l) {
  var a = l.action || '';
  var d = String(l.detail == null ? '' : l.detail);
  if (a === 'settings') {
    if (!d) return '\u2014';
    return d.split(',').filter(Boolean).map(function(k) { return AUDIT_SETTINGS[k] || k; }).join('\u3001');
  }
  if (a === 'report.send') {
    if (d === 'ok') return '\u53D1\u9001\u6210\u529F';
    if (d.indexOf('fail:') === 0) return '\u53D1\u9001\u5931\u8D25\uFF1A' + auditTgError(d.slice(5).trim());
    return d || '\u2014';
  }
  if (a === 'import') {
    var names = { routes: '\u8DEF\u7531', domains: '\u57DF\u540D', skipped: '\u8DF3\u8FC7' };
    return d.split(' ').filter(Boolean).map(function(p) {
      var i = p.indexOf('=');
      if (i < 0) return p;
      var k = p.slice(0, i), v = p.slice(i + 1);
      return (names[k] || k) + ' ' + v;
    }).join('\u3001') || '\u2014';
  }
  if (a === 'domain.delete') return d.replace('id=', 'ID ');
  if (a === 'user.update' || a === 'user.delete' || a === 'user.password') return d.replace('->', '\u2192');
  return d || '\u2014';
}
async function loadAudit() {
  var el = document.getElementById('auditList');
  var r = await fetch('/admin/api/audit');
  var d = await r.json();
  if (!d.logs || !d.logs.length) { el.textContent = '\u6682\u65E0\u8BB0\u5F55'; return; }
  el.innerHTML = '<table><thead><tr><th>\u65F6\u95F4</th><th>\u64CD\u4F5C</th><th>\u8BE6\u60C5</th></tr></thead><tbody>' + d.logs.map(function(l) {
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
  document.getElementById('routeRelayMode').value = 'auto';
  document.getElementById('routeIpMode').value = 'forward';
  document.getElementById('routeHeaders').value = '';
  document.getElementById('routeIpAllow').value = '';
  document.getElementById('routeIpBlock').value = '';
  document.getElementById('prefixPreview').textContent = 'myemby';
  document.getElementById('routeModalTitle').textContent = '\u6DFB\u52A0\u8DEF\u7531';
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
  document.getElementById('routeRelayMode').value = ['on', 'off'].includes(r.use_relay) ? r.use_relay : 'auto';
  document.getElementById('routeIpMode').value = (r.ip_mode === 'strip' || r.ip_mode === 'disable') ? r.ip_mode : 'forward';
  document.getElementById('routeHeaders').value = r.custom_headers || '';
  document.getElementById('routeIpAllow').value = r.ip_allow || '';
  document.getElementById('routeIpBlock').value = r.ip_block || '';
  document.getElementById('prefixPreview').textContent = r.prefix;
  document.getElementById('routeModalTitle').textContent = '\u7F16\u8F91\u8DEF\u7531';
  openModal('modalRoute');
}

async function saveRoute() {
  const oldPrefix = document.getElementById('oldPrefix').value;
  const remark = document.getElementById('routeRemark').value.trim();
  let prefix = document.getElementById('routePrefix').value.trim(); while(prefix.startsWith('/')) prefix = prefix.slice(1); while(prefix.endsWith('/')) prefix = prefix.slice(0,-1);
  const cache_img = document.getElementById('routeCache').checked ? 'on' : 'off';
  const compat_mode = document.getElementById('routeCompat').checked ? 'on' : 'off';
  const use_relay = document.getElementById('routeRelayMode').value || 'auto';
  const ip_mode = document.getElementById('routeIpMode').value || 'forward';
  const target = document.getElementById('routeTarget').value.split(/[\\r\\n,]+/).map(function(s) { return s.trim(); }).filter(Boolean).join(',');

  if (!prefix) { showToast('\u8BF7\u8F93\u5165\u8DEF\u5F84'); return; }
  if (!target) { showToast('\u8BF7\u81F3\u5C11\u586B\u5199\u4E00\u4E2A\u76EE\u6807\u5730\u5740'); return; }

  document.getElementById('prefixPreview').textContent = prefix || 'myemby';

  const r = await fetch('/admin/api/routes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ oldPrefix, prefix, target, remark, cache_img, compat_mode, ip_mode, use_relay, custom_headers: document.getElementById('routeHeaders').value, ip_allow: document.getElementById('routeIpAllow').value, ip_block: document.getElementById('routeIpBlock').value })
  });
  const d = await r.json();
  if (!r.ok) { showToast(d.error || '\u4FDD\u5B58\u5931\u8D25'); return; }
  closeModal('modalRoute');
  showToast('\u4FDD\u5B58\u6210\u529F');
  loadRoutes();
}

async function delRoute(prefix) {
  if (!confirm('\u786E\u5B9A\u5220\u9664\u8DEF\u7531 /' + prefix + ' \uFF1F')) return;
  await fetch('/admin/api/routes?prefix=' + encodeURIComponent(prefix), { method: 'DELETE' });
  showToast('\u5DF2\u5220\u9664');
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
      document.getElementById('domainList').innerHTML = '<p class="muted">\u52A0\u8F7D\u5931\u8D25</p>';
    }
  } catch (e) {
    document.getElementById('domainList').innerHTML = '<p class="muted">\u52A0\u8F7D\u5931\u8D25: ' + esc(e.message) + '</p>';
  }
}

function renderDomains(list, speedResults, best) {
  const el = document.getElementById('domainList');
  if (!list.length) {
    el.innerHTML = '<div class="empty-state"><span class="empty-state-icon">\u{1F310}</span><p class="empty-state-text">\u6682\u65E0\u4F18\u9009\u57DF\u540D</p></div>';
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
  let html = '<table><thead><tr><th>\u540D\u79F0</th><th>\u57DF\u540D</th><th>\u5EF6\u8FDF</th><th>\u72B6\u6001</th><th>\u64CD\u4F5C</th></tr></thead><tbody>';
  sorted.forEach(d => {
    const sr = speedMap[d.domain];
    const latency = sr && sr.latency >= 0 ? sr.latency + 'ms' : (sr ? '\u8D85\u65F6' : '\u2014');
    const pct = sr && sr.latency >= 0 ? Math.max(5, Math.min(100, Math.round(sr.latency / 3))) : 0;
    const statusClass = sr ? (sr.latency >= 0 ? (sr.latency < 100 ? 'tag-fast' : sr.latency < 300 ? 'tag-good' : 'tag-slow') : 'tag-timeout') : '';
    const statusText = sr ? (sr.latency >= 0 ? (sr.latency < 100 ? '\u6781\u5FEB' : sr.latency < 300 ? '\u826F\u597D' : '\u8F83\u6162') : '\u8D85\u65F6') : '';
    const isBest = best && best.domain === d.domain;
    html += '<tr' + (isBest ? ' class="best"' : '') + '>' +
      '<td>' + esc(d.name) + (d.isBuiltin ? ' <span class="tag tag-builtin">\u5185\u7F6E</span>' : '') + (isBest ? ' <span class="tag tag-best">BEST</span>' : '') + '</td>' +
      '<td><code>' + esc(d.domain) + '</code></td>' +
      '<td><div class="lat"><div class="lat-bar"><i style="width:' + pct + '%"></i></div><span>' + latency + '</span></div></td>' +
      '<td>' + (statusText ? '<span class="tag ' + statusClass + '">' + statusText + '</span>' : '\u2014') + '</td>' +
      '<td>' + (!d.isBuiltin ? '<button class="btn btn-sm" onclick="editDomain(' + d.id + ')">\u7F16\u8F91</button> <button class="btn btn-sm btn-danger" onclick="delDomain(' + d.id + ')">\u5220\u9664</button>' : '') + '</td>' +
    '</tr>';
  });
  html += '</tbody></table>';
  el.innerHTML = html;
}

function openDomainModal() {
  document.getElementById('domainId').value = '';
  document.getElementById('domainName').value = '';
  document.getElementById('domainUrl').value = '';
  document.getElementById('domainModalTitle').textContent = '\u6DFB\u52A0\u4F18\u9009\u57DF\u540D';
  openModal('modalDomain');
}

function editDomain(id) {
  const d = allDomains.find(x => x.id === id);
  if (!d) return;
  document.getElementById('domainId').value = d.id;
  document.getElementById('domainName').value = d.name;
  document.getElementById('domainUrl').value = 'https://' + d.domain;
  document.getElementById('domainModalTitle').textContent = '\u7F16\u8F91\u4F18\u9009\u57DF\u540D';
  openModal('modalDomain');
}

async function saveDomain() {
  const id = document.getElementById('domainId').value;
  const name = document.getElementById('domainName').value.trim();
  const url = document.getElementById('domainUrl').value.trim();

  if (!name) { showToast('\u8BF7\u8F93\u5165\u540D\u79F0'); return; }
  if (!url) { showToast('\u8BF7\u8F93\u5165\u57DF\u540D'); return; }

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
  if (!d.success) { showToast(d.error || '\u4FDD\u5B58\u5931\u8D25'); return; }
  closeModal('modalDomain');
  showToast('\u4FDD\u5B58\u6210\u529F');
  loadDomains();
}

async function delDomain(id) {
  if (!confirm('\u786E\u5B9A\u5220\u9664\u6B64\u4F18\u9009\u57DF\u540D\uFF1F')) return;
  const r = await fetch('/admin/api/optimized-domains/' + id, { method: 'DELETE' });
  const d = await r.json();
  if (d.success) {
    showToast('\u5DF2\u5220\u9664');
    loadDomains();
  } else {
    showToast('\u5220\u9664\u5931\u8D25');
  }
}



async function testDomains() {
  var st = document.getElementById('domain-status');
  if (st) st.textContent = '\u5728\u672C\u673A\u6D4F\u89C8\u5668\u6D4B\u901F\u4E2D...';
  const rows = await speedTestDomains(allDomains, function(d, n) { if (st) st.textContent = '\u6D4B\u901F\u4E2D ' + d + '/' + n; });
  const best = rows.find(function(r) { return r.latency >= 0; }) || null;
  bestDomain = best;
  if (st) st.textContent = best ? '\u6700\u4F18: ' + best.domain + '\uFF08' + best.latency + 'ms\uFF0C\u672C\u673A\u6D4B\u5F97\uFF09' : '\u65E0\u53EF\u7528\u57DF\u540D';
  renderDomains(allDomains, rows, best);
}

var quickDns = null;

async function loadQuickDNS() {
  var meta = document.getElementById('dnsQuickMeta');
  if (meta) meta.textContent = 'DNS \u8BB0\u5F55\u52A0\u8F7D\u4E2D...';
  try {
    const r = await fetch('/admin/api/dns-config');
    if (r.status === 401) { location.reload(); return; }
    const d = await r.json();
    if (!d.success) throw new Error('\u52A0\u8F7D\u5931\u8D25');
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
      meta.textContent = '\u2705 [' + rec.type + '] ' + rec.name + ' \u2192 ' + rec.content + (rec.proxied ? '\uFF08\u5DF2\u4EE3\u7406\uFF09' : '\uFF08\u4EC5 DNS\uFF09') + (rec.modifiedOn ? ' \xB7 ' + rec.modifiedOn : '');
    } else {
      nameEl.value = d.resolvedName || '';
      targetEl.value = (d.config && d.config.currentDomain) || '';
      meta.textContent = (d.zonesError ? '\u26A0\uFE0F ' + d.zonesError : '\u672A\u5728 Cloudflare \u627E\u5230\u8BE5\u8BB0\u5F55\uFF0C\u586B\u5199\u76EE\u6807\u540E\u70B9\u4FDD\u5B58\u5373\u53EF\u521B\u5EFA');
    }
  } catch (e) {
    if (meta) meta.textContent = 'DNS \u52A0\u8F7D\u5931\u8D25: ' + (e.message || e);
  }
}

async function quickSaveDNS(btn) {
  const dnsName = document.getElementById('dnsQuickName').value.trim();
  const targetDomain = document.getElementById('dnsQuickTarget').value.trim();
  if (!targetDomain) { showToast('\u8BF7\u8F93\u5165\u76EE\u6807\u57DF\u540D\u6216 IP'); return; }
  btn.disabled = true; btn.textContent = '\u4FDD\u5B58\u4E2D...';
  try {
    const r = await fetch('/admin/api/dns/replace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zoneId: (quickDns && quickDns.zoneId) || '', dnsName: dnsName, targetDomain: targetDomain })
    });
    const d = await r.json();
    if (d.success) {
      const rec = d.result || {};
      showToast('\u2705 [' + (rec.type || 'CNAME') + '] ' + (rec.name || dnsName) + ' \u2192 ' + (rec.content || targetDomain));
      loadQuickDNS();
    } else {
      showToast('\u274C ' + (d.error || d.errors?.[0]?.message || '\u4FDD\u5B58\u5931\u8D25'));
    }
  } catch (e) {
    showToast('\u274C \u8BF7\u6C42\u5931\u8D25: ' + e.message);
  }
  btn.disabled = false; btn.textContent = '\u4FDD\u5B58';
}

async function sendReport(btn) {
  if (btn) { btn.disabled = true; btn.textContent = '\u53D1\u9001\u4E2D...'; }
  try {
    const r = await fetch('/admin/api/report/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const d = await r.json().catch(function() { return {}; });
    if (d.success) {
      showToast('\u2705 \u65E5\u62A5\u5DF2\u53D1\u9001' + (d.webhook && d.webhook.ok ? '\uFF08Telegram + Webhook\uFF09' : '\uFF08Telegram\uFF09'));
    } else {
      showToast('\u274C ' + (d.hint || (d.telegram && d.telegram.error) || '\u53D1\u9001\u5931\u8D25'), 9000);
      loadAudit();
    }
  } catch (e) {
    showToast('\u274C \u53D1\u9001\u5931\u8D25: ' + e.message);
  }
  if (btn) { btn.disabled = false; btn.textContent = '\u53D1\u9001\u65E5\u62A5'; }
}

async function loadRelay() {
  try {
    const r = await fetch('/admin/api/relay');
    if (r.status === 401) { location.reload(); return; }
    const d = await r.json();
    const c = (d && d.config) || {};
    document.getElementById('relayUrl').value = c.relayUrl || '';
    document.getElementById('relaySecret').placeholder = c.hasSecret ? '\u5DF2\u8BBE\u7F6E\uFF08\u7559\u7A7A\u4FDD\u6301\u4E0D\u53D8\uFF09' : '\u9996\u6B21\u586B VPS \u5F15\u5BFC\u5BC6\u94A5';
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
  if (!url) { showToast('\u8BF7\u586B\u5199\u4E2D\u7EE7\u5730\u5740\uFF08\u542B\u7AEF\u53E3\uFF09'); return; }
  if (btn) { btn.disabled = true; btn.textContent = '\u4E0B\u53D1\u4E2D...'; }
  try {
    const r = await fetch('/admin/api/relay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ relayUrl: url, secret, enabled, certPem, keyPem, pushToVps: true })
    });
    const d = await r.json();
    if (!r.ok || d.error) { showToast(d.error || '\u4FDD\u5B58\u5931\u8D25'); return; }
    if (d.vpsStatus > 0 && d.vpsStatus < 300) {
      showToast('\u2705 \u5DF2\u4FDD\u5B58\u5E76\u4E0B\u53D1\u5230 VPS');
    } else if (d.vpsStatus >= 300 || d.vpsError) {
      showToast('\u26A0\uFE0F \u5DF2\u4FDD\u5B58\uFF0C\u4F46 VPS \u4E0B\u53D1\u5931\u8D25: ' + (d.vpsStatus || d.vpsError), 9000);
    } else {
      showToast('\u2705 \u5DF2\u4FDD\u5B58\uFF08\u672A\u63A8\u9001 VPS\uFF09');
    }
    document.getElementById('relaySecret').value = '';
    document.getElementById('relayCert').value = '';
    document.getElementById('relayKey').value = '';
    loadRelay();
  } catch (e) {
    showToast('\u8BF7\u6C42\u5931\u8D25: ' + e.message);
  }
  if (btn) { btn.disabled = false; btn.textContent = '\u4FDD\u5B58\u5E76\u4E0B\u53D1\u5230 VPS'; }
}

async function testRelay(btn) {
  const st = document.getElementById('relayStatus');
  if (btn) { btn.disabled = true; }
  if (st) st.textContent = '\u6D4B\u8BD5\u4E2D...';
  try {
    const r = await fetch('/admin/api/relay/test', { method: 'POST' });
    const d = await r.json();
    if (d.ok) {
      st.textContent = '\u2705 \u8FDE\u901A ' + d.ms + 'ms \xB7 ' + (d.version || '') + (d.tls ? ' (HTTPS)' : ' (HTTP \u65E0\u8BC1\u4E66)');
    } else {
      st.textContent = '\u274C ' + (d.error || ('HTTP ' + d.status));
    }
  } catch (e) {
    if (st) st.textContent = '\u274C ' + e.message;
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
    if (!d.ok) { el.innerHTML = '<div class="rs-meta">\u{1F4CA} \u4E2D\u7EE7\u6D41\u91CF\uFF1A\u6682\u4E0D\u53EF\u8BFB\uFF08' + esc(d.error || '\u672A\u914D\u7F6E') + '\uFF09\xB7 \u70B9\u51FB\u91CD\u8BD5</div>'; return; }
    const t = d.today || {}, tot = d.total || {};
    const tile = function(label, val) { return '<div class="rs-tile"><span>' + label + '</span><b>' + val + '</b></div>'; };
    let s = '<div class="rs-row">'
      + tile('\u4ECA\u65E5\u8BF7\u6C42', t.req || 0)
      + tile('\u4ECA\u65E5\u6D41\u91CF', '\u2191' + fmtBytes(t.up_bytes) + ' \u2193' + fmtBytes(t.down_bytes))
      + tile('\u7D2F\u8BA1\u8BF7\u6C42', tot.req || 0)
      + tile('\u7D2F\u8BA1\u6D41\u91CF', '\u2191' + fmtBytes(tot.up_bytes) + ' \u2193' + fmtBytes(tot.down_bytes))
      + '</div>'
      + '<div class="rs-meta">\u8FD0\u884C ' + Math.round((d.uptime_s || 0) / 360) / 10 + 'h \xB7 \u4E0A\u6D77\u65F6\u533A ' + (d.date || '') + ' \xB7 \u70B9\u51FB\u5237\u65B0</div>';
    el.innerHTML = s;
  } catch (e) { el.innerHTML = '<div class="rs-meta">\u{1F4CA} \u4E2D\u7EE7\u6D41\u91CF\uFF1A\u8BFB\u53D6\u5931\u8D25 ' + esc(e.message) + '</div>'; }
}
document.getElementById('relayStats').addEventListener('click', loadRelayStats);
setInterval(loadRelayStats, 60000);

document.getElementById('routePrefix').addEventListener('input', function() {
  document.getElementById('prefixPreview').textContent = this.value.trim() || 'myemby';
});

// ---- Tab \u5F15\u64CE\uFF1A\u5207\u6362 / \u61D2\u52A0\u8F7D / \u8BB0\u5FC6 / hash \u540C\u6B65 ----
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

// ---- \u6570\u636E\u52A0\u8F7D\uFF08\u6982\u89C8\u9875\uFF1A\u7EDF\u8BA1 / \u8FB9\u7F18\u8282\u70B9 / \u4E2D\u7EE7\u6C47\u603B\u5361\uFF09----
async function loadEdge() {
  try {
    const r = await fetch('/api/edge-info');
    const d = await r.json();
    document.getElementById('edge-loading').style.display = 'none';
    const box = document.getElementById('edge-info');
    box.style.display = 'grid';
    box.innerHTML = [
      ['\u5BA2\u6237\u7AEF IP', d.clientIp],
      ['\u63A5\u5165 POP', d.entryColo],
      ['\u56FD\u5BB6/\u5730\u533A', d.entryCountry + (d.entryCity ? ' / '+d.entryCity : '')],
      ['\u8FB9\u7F18\u51FA\u53E3 IP', d.edgeIp],
      ['\u843D\u5730 COLO', d.egressColo]
    ].map(function(kv){ return '<div class="edge-item"><strong>'+kv[0]+'</strong><span>'+(kv[1]||'\u2014')+'</span></div>'; }).join('');
  } catch(e) { document.getElementById('edge-loading').textContent = '\u52A0\u8F7D\u5931\u8D25'; }
}

async function loadRelayStatsCard() {
  const reqEl = document.getElementById('st-relay-req');
  const txEl = document.getElementById('st-relay-traffic');
  if (!reqEl || !txEl) return;
  try {
    const r = await fetch('/admin/api/relay/stats');
    const d = await r.json();
    if (!d.ok) {
      reqEl.textContent = '\u2014';
      document.getElementById('st-relay-req-sub').textContent = '\u6765\u6E90: VPS \u4E2D\u7EE7\uFF08' + (d.error || '\u4E0D\u53EF\u8BFB') + '\uFF09';
      return;
    }
    const t = d.today || {};
    reqEl.textContent = t.req || 0;
    document.getElementById('st-relay-req-sub').textContent = '\u6765\u6E90: VPS \u4E2D\u7EE7 \xB7 \u4E0A\u6D77\u65F6\u533A ' + (d.date || '');
    txEl.textContent = '\u2191' + fmtBytes(t.up_bytes) + ' \u2193' + fmtBytes(t.down_bytes);
    document.getElementById('st-relay-traffic-sub').textContent = '\u2191\u6E90\u7AD9\u62C9\u53D6 \u2193\u53D1\u56DE\u5BA2\u6237\u7AEF \xB7 \u4E0A\u6D77\u65F6\u533A ' + (d.date || '');
  } catch (e) {
    reqEl.textContent = '\u2014';
    document.getElementById('st-relay-req-sub').textContent = '\u6765\u6E90: VPS \u4E2D\u7EE7\uFF08\u8BFB\u53D6\u5931\u8D25\uFF09';
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
    // v6.4.8\uFF1AD1 \u7EDF\u8BA1\u5DF2\u505C\u5199\uFF0C\u8BF7\u6C42\u6570/\u6D41\u91CF\u7EDF\u4E00\u6765\u81EA CF Zone \u5206\u6790
    document.getElementById('st-req-sub').textContent = '\u6765\u6E90: CF Zone \u5206\u6790' + (d.data.cfError ? '\uFF08\u4E0D\u53EF\u7528\uFF09' : '');
    document.getElementById('st-traffic').textContent = d.data.todayTraffic || '0 B';
    document.getElementById('st-traffic-sub').textContent = '\u6765\u6E90: CF edgeResponseBytes' + (d.data.cfError ? '\uFF08\u4E0D\u53EF\u7528\uFF09' : '');
    document.getElementById('st-uv').textContent = d.data.todayVisits ?? 0;
    document.getElementById('st-uv-sub').textContent = '\u6765\u6E90: CF \u72EC\u7ACB\u8BBF\u95EE';
    const cfInfo = d.data.cfStatus || '';
    const envInfo = d.data.envInfo || {};
    document.getElementById('st-updated').textContent = '\u66F4\u65B0\u65F6\u95F4 ' + (d.data.lastUpdated||'') + ' \xB7 ' + cfInfo
      + (envInfo.statsHost ? ' \xB7 \u7EDF\u8BA1\u57DF\u540D ' + envInfo.statsHost : '')
      + (envInfo.zoneId ? ' \xB7 Zone ' + envInfo.zoneId.slice(0, 8) + '\u2026' : '')
      + (d.data.cfError ? ' (' + d.data.cfError + ')' : '');
    const hourly = d.data.hourlySeries || [];
    if (hourly.length) {
      const max = Math.max(1, ...hourly.map(h=>h.total));
      let hhtml = '<div class="chart">';
      hourly.forEach(h=>{
        const ht = Math.max(2, Math.round((h.total/max)*68));
        const label = h.label || '';
        hhtml += '<div class="chart-col" title="'+label+' \xB7 '+h.total+' \u6B21"><i style="height:'+ht+'px"></i><b>'+label.slice(0,2)+'</b></div>';
      });
      hhtml += '</div><p class="muted" style="font-size:11px;margin-top:6px">\u4ECA\u65E5 24 \u5C0F\u65F6\u8BF7\u6C42\u5206\u5E03\uFF08\u4E0A\u6D77\u65F6\u533A\uFF09</p>';
      document.getElementById('hourly-chart').innerHTML = hhtml;
    }
  } catch(e) { document.getElementById('stats-loading').textContent = '\u7EDF\u8BA1\u52A0\u8F7D\u5931\u8D25'; }
}

(function initTabs() {
  var h = (location.hash || '').replace('#', '');
  if (TAB_NAMES.indexOf(h) < 0) { try { h = localStorage.getItem('adminTab') || ''; } catch (e) {} }
  if (TAB_NAMES.indexOf(h) < 0) h = 'overview';
  switchTab(h);
})();
setInterval(loadRelayStatsCard, 60000);
`;

// text-asset:web/shared/palette.js
var palette_default = "(function(){\n  var lastP=null;\n  function todayKey(){ return new Date(Date.now()+8*3600000).toISOString().slice(0,10); }\n  function buildVars(p,dark){\n    var a=hsl2rgb(p.h,p.s,dark?0.55:0.40);\n    var v={'--accent':'rgb('+a.r+','+a.g+','+a.b+')',\n      '--accent-dim':'rgba('+a.r+','+a.g+','+a.b+','+(dark?'0.12':'0.09')+')',\n      '--accent-line':'rgba('+a.r+','+a.g+','+a.b+',0.45)',\n      '--accent-ink':colorYiq(a.r,a.g,a.b)>150?'#0b1620':'#ffffff'};\n    if(dark){\n      var bg=hsl2rgb(p.bh,p.bs,0.05);\n      var sf=hsl2rgb(p.bh,0.3,0.09),sf2=hsl2rgb(p.bh,0.28,0.13),ib=hsl2rgb(p.bh,0.28,0.06);\n      v['--bg']='rgb('+bg.r+','+bg.g+','+bg.b+')';\n      v['--glow']='rgba('+a.r+','+a.g+','+a.b+',0.07)';\n      v['--surface']='rgba('+sf.r+','+sf.g+','+sf.b+',0.58)';\n      v['--surface-2']='rgba('+sf2.r+','+sf2.g+','+sf2.b+',0.45)';\n      v['--input-bg']='rgba('+ib.r+','+ib.g+','+ib.b+',0.62)';\n      v['--veil-rgb']=bg.r+','+bg.g+','+bg.b;\n    }\n    return v;\n  }\n  function applyDyn(p){\n    lastP=p;\n    var dark=document.documentElement.getAttribute('data-theme')!=='light';\n    var v=buildVars(p,dark),st=document.documentElement.style;\n    for(var k in v)st.setProperty(k,v[k]);\n    var meta=document.querySelector('meta[name=theme-color]');\n    if(meta&&dark&&v['--bg'])meta.setAttribute('content',v['--bg']);\n  }\n  window.__dynPalThemeHook=function(){ if(lastP)applyDyn(lastP); };\n  window.__dynBuildVars=buildVars;\n  var stored=null;\n  try{stored=JSON.parse(localStorage.getItem('dyn-pal')||'null');}catch(e){}\n  if(stored&&stored.d===todayKey()&&typeof stored.h==='number'&&typeof stored.bh==='number'){try{applyDyn(stored);}catch(e){}}\n  function extract(){\n    var img=new Image();\n    img.onload=function(){\n      try{\n        var c=document.createElement('canvas');c.width=48;c.height=48;\n        var ctx=c.getContext('2d');if(!ctx)return;\n        ctx.drawImage(img,0,0,48,48);\n        var d=ctx.getImageData(0,0,48,48).data;\n        var buckets={},total=0;\n        for(var i=0;i<d.length;i+=4){\n          var r=d[i],g=d[i+1],b=d[i+2];\n          if(d[i+3]<128)continue;\n          var mx=Math.max(r,g,b),mn=Math.min(r,g,b);\n          var l=(mx+mn)/510;\n          if(l<0.06||l>0.94)continue;\n          var dd=(mx-mn)/255;\n          var s=dd===0?0:dd/(1-Math.abs(2*l-1));\n          total++;\n          var key=((r>>4)<<8)|((g>>4)<<4)|(b>>4);\n          var bk=buckets[key];if(!bk){bk={n:0,r:0,g:0,b:0,s:0};buckets[key]=bk;}\n          bk.n++;bk.r+=r;bk.g+=g;bk.b+=b;bk.s+=s;\n        }\n        if(total<60)return;\n        var best=null,bestScore=0,dom=null,domN=0;\n        for(var k in buckets){var x=buckets[k];\n          if(x.n>domN){domN=x.n;dom=x;}\n          var as=x.s/x.n;\n          if(as>=0.28){var sc=x.n*(as+0.1);if(sc>bestScore){bestScore=sc;best=x;}}\n        }\n        if(!best||best.n<12)return;\n        var ac=rgb2hsl(best.r/best.n,best.g/best.n,best.b/best.n);\n        var bc=dom?rgb2hsl(dom.r/dom.n,dom.g/dom.n,dom.b/dom.n):ac;\n        var p={d:todayKey(),h:Math.round(ac.h),s:clampNum(ac.s,0.45,0.8),bh:Math.round(bc.h),bs:clampNum(bc.s||0.2,0.15,0.35)};\n        var old=null;try{old=JSON.parse(localStorage.getItem('dyn-pal')||'null');}catch(e){}\n        if(old&&old.d===p.d&&old.h===p.h&&old.bh===p.bh)return;\n        try{localStorage.setItem('dyn-pal',JSON.stringify(p));}catch(e){}\n        applyDyn(p);\n      }catch(e){}\n    };\n    img.src='/bing-wallpaper';\n  }\n  if(document.readyState==='complete')extract();else window.addEventListener('load',extract);\n})();\n";

// text-asset:web/shared/glass.css
var glass_default = `:root { --radius: 12px; --radius-s: 8px; }
  html[data-theme="dark"] {
    --bg: #06090f; --bg-grid: rgba(120,160,200,.045); --glow: rgba(56,209,255,.07);
    --surface: rgba(13,19,30,.58); --surface-2: rgba(20,28,42,.45);
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
    --surface: rgba(255,255,255,.78); --surface-2: rgba(255,255,255,.6);
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
    background: var(--surface); backdrop-filter: blur(18px) saturate(1.35); -webkit-backdrop-filter: blur(18px) saturate(1.35);
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

  /* \u5BA1\u8BA1\u65E5\u5FD7\uFF1A\u64CD\u4F5C\u5217\u4E0D\u6362\u884C/\u4E0D\u88C1\u5207\uFF0C\u8BE6\u60C5\u5217\u5141\u8BB8\u6362\u884C */
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
  .admin-bg { position:fixed; inset:0; z-index:0; background:center/cover no-repeat url(/bing-wallpaper); opacity:.18; pointer-events:none; }
  .container { position:relative; z-index:1; }
  .route-link { font-size:12px; word-break:break-all; color:var(--accent); cursor:pointer; }
  .route-link:hover { text-decoration:underline; }
  .btn-copy { padding:2px 9px; font-size:11px; flex:none; }
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
  .modal.show { display: flex; flex-direction: column; overscroll-behavior: contain; animation: fadeIn .18s ease; }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  .modal-inner { flex: none; margin: auto; background: var(--surface); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); padding: 26px; border-radius: var(--radius); max-width: 520px; width: 100%; border: 1px solid var(--line-strong); box-shadow: var(--shadow); animation: slideUp .22s cubic-bezier(.22,1,.36,1); }
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

// text-asset:web/shared/theme-init.js
var theme_init_default = "(function(){\n  var pref='auto';\n  try{ var s=localStorage.getItem('proxy-theme'); if(s==='dark'||s==='light'||s==='auto') pref=s; }catch(e){}\n  function darkNow(){ return pref==='dark'||(pref==='auto'&&window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches); }\n  document.documentElement.setAttribute('data-theme',darkNow()?'dark':'light');\n  document.documentElement.setAttribute('data-theme-pref',pref);\n})();\n";

// text-asset:web/shared/theme.js
var theme_default = "var THEME_PREF=document.documentElement.getAttribute('data-theme-pref')||'auto';\nfunction applyTheme(pref){\n  THEME_PREF=pref;\n  var dark=pref==='dark'||(pref==='auto'&&window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches);\n  document.documentElement.setAttribute('data-theme',dark?'dark':'light');\n  document.documentElement.setAttribute('data-theme-pref',pref);\n  var btn=document.getElementById('themeToggle');\n  if(btn){ btn.textContent=pref==='auto'?'AUTO':(pref==='dark'?'DARK':'LIGHT'); btn.title=pref==='auto'?'\u8DDF\u968F\u7CFB\u7EDF':(pref==='dark'?'\u6DF1\u8272\u6A21\u5F0F':'\u6D45\u8272\u6A21\u5F0F'); }\n  var meta=document.querySelector('meta[name=theme-color]');\n  if(meta){ meta.setAttribute('content',dark?'#06090f':'#f2f5f8'); }\n  if(window.__dynPalThemeHook){ try{ window.__dynPalThemeHook(); }catch(e){} }\n}\nfunction cycleTheme(){\n  var next=THEME_PREF==='auto'?'dark':(THEME_PREF==='dark'?'light':'auto');\n  try{ localStorage.setItem('proxy-theme',next); }catch(e){}\n  applyTheme(next);\n}\nif(window.matchMedia){\n  try{\n    var mq=matchMedia('(prefers-color-scheme: dark)');\n    var onMq=function(){ if(THEME_PREF==='auto') applyTheme('auto'); };\n    if(mq.addEventListener){ mq.addEventListener('change',onMq); } else if(mq.addListener){ mq.addListener(onMq); }\n  }catch(e){}\n}\napplyTheme(THEME_PREF);\n";

// text-asset:web/shared/palette-math.js
var palette_math_default = "function hsl2rgb(h,s,l){h=((h%360)+360)%360;var c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs((h/60)%2-1)),m=l-c/2,r,g,b;\nif(h<60){r=c;g=x;b=0}else if(h<120){r=x;g=c;b=0}else if(h<180){r=0;g=c;b=x}else if(h<240){r=0;g=x;b=c}else if(h<300){r=x;g=0;b=c}else{r=c;g=0;b=x}\nreturn{r:Math.round((r+m)*255),g:Math.round((g+m)*255),b:Math.round((b+m)*255)};}\nfunction rgb2hsl(r,g,b){r/=255;g/=255;b/=255;var mx=Math.max(r,g,b),mn=Math.min(r,g,b),h=0,s=0,l=(mx+mn)/2,d=mx-mn;\nif(d>0){s=l>0.5?d/(2-mx-mn):d/(mx+mn);\nif(mx===r)h=60*(((g-b)/d)%6);else if(mx===g)h=60*((b-r)/d+2);else h=60*((r-g)/d+4);}\nif(h<0)h+=360;return{h:h,s:s,l:l};}\nfunction colorYiq(r,g,b){return (r*299+g*587+b*114)/1000;}\nfunction clampNum(v,a,b){return v<a?a:(v>b?b:v);}\n";

// src/shared/ui/theme.js
var PAGE_STYLE = glass_default;
var THEME_INIT = theme_init_default;
var THEME_LOGIC = theme_default;
var PALETTE_MATH = palette_math_default;
var DYN_PALETTE = PALETTE_MATH + palette_default;

// text-asset:web/personal/speed-test.js
var speed_test_default = "function pingOnce(url, timeout) {\n  return new Promise(function(resolve) {\n    var t0 = performance.now(), settled = false;\n    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;\n    var timer = setTimeout(function() { if (ctrl) ctrl.abort(); fin(-1); }, timeout);\n    function fin(ms) { if (settled) return; settled = true; clearTimeout(timer); resolve(ms); }\n    var bust = (url.indexOf('?') >= 0 ? '&' : '?') + '_=' + Date.now() + Math.random().toString(36).slice(2);\n    fetch(url + bust, { mode: 'no-cors', cache: 'no-store', credentials: 'omit', signal: ctrl ? ctrl.signal : undefined })\n      .then(function() { fin(Math.round(performance.now() - t0)); })\n      .catch(function() { fin(-1); });\n  });\n}\n\n// \u540C\u4E00\u57DF\u540D\u987A\u5E8F\u6D4B\u591A\u6B21\uFF08\u540E\u7EED\u8BF7\u6C42\u590D\u7528\u8FDE\u63A5\uFF0C\u53CD\u6620\u7A33\u5B9A\u5F80\u8FD4\u5EF6\u8FDF\uFF09\uFF0C\u53D6\u4E2D\u4F4D\u6570\uFF1B\u5931\u8D25\u8FC7\u534A\u89C6\u4E3A\u4E0D\u53EF\u7528\nasync function measureDomain(host, samples, timeout) {\n  var times = [];\n  for (var i = 0; i < samples; i++) {\n    var ms = await pingOnce('https://' + host + '/cdn-cgi/trace', timeout);\n    if (ms >= 0) times.push(ms);\n  }\n  if (times.length < Math.ceil(samples / 2)) return -1;\n  times.sort(function(a, b) { return a - b; });\n  return times[Math.floor(times.length / 2)];\n}\n\nasync function runPool(items, limit, fn) {\n  var out = new Array(items.length), idx = 0;\n  async function w() { while (idx < items.length) { var i = idx++; out[i] = await fn(items[i]); } }\n  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, w));\n  return out;\n}\n\nfunction latencyLabel(ms) { return ms < 0 ? 'timeout' : ms < 100 ? 'fast' : ms < 300 ? 'good' : 'slow'; }\n\nasync function speedTestDomains(domains, onProgress) {\n  var done = 0;\n  var rows = await runPool(domains, 3, async function(d) {\n    var ms = await measureDomain(d.domain, 4, 6000);\n    done++;\n    if (onProgress) onProgress(done, domains.length);\n    return { id: d.id, domain: d.domain, name: d.name, host: d.domain, latency: ms, status: latencyLabel(ms), isBuiltin: d.isBuiltin };\n  });\n  rows.sort(function(a, b) { if (a.latency < 0) return 1; if (b.latency < 0) return -1; return a.latency - b.latency; });\n  return rows;\n}\n";

// text-asset:web/personal/landing.css
var landing_default = "body.lp2 { display:flex; align-items:center; justify-content:center; min-height:100vh; padding:24px; }\n  .lp2-bg { position:fixed; inset:0; z-index:0; }\n  .lp2-photo { position:absolute; inset:0; background:var(--bg,#06090f) center/cover no-repeat url(/bing-wallpaper); animation:lp2Zoom 36s ease-in-out infinite alternate; }\n  @keyframes lp2Zoom { from { transform:scale(1); } to { transform:scale(1.07); } }\n  .lp2-veil { position:absolute; inset:0; background:linear-gradient(115deg, rgba(var(--veil-rgb,6,9,15),.9) 0%, rgba(var(--veil-rgb,6,9,15),.74) 50%, rgba(var(--veil-rgb,6,9,15),.62) 100%); }\n  .lp2-card { position:relative; z-index:1; display:grid; grid-template-columns:1.08fr 1fr; width:min(940px,100%); min-height:520px; border-radius:24px; overflow:hidden; border:1px solid var(--line-strong); box-shadow:0 30px 90px rgba(0,0,0,.5); backdrop-filter:blur(22px); -webkit-backdrop-filter:blur(22px); animation:lp2Up .8s ease both; }\n  @keyframes lp2Up { from { opacity:0; transform:translateY(22px); } to { opacity:1; transform:none; } }\n  .lp2-left { position:relative; display:flex; flex-direction:column; justify-content:space-between; gap:40px; padding:40px 38px; background:linear-gradient(165deg, var(--accent-dim), rgba(13,19,30,.42) 60%); color:var(--text); overflow:hidden; }\n  .lp2-left::before { content:''; position:absolute; left:-90px; top:-90px; width:300px; height:300px; border-radius:50%; background:radial-gradient(circle, var(--accent-dim), transparent 70%); filter:blur(10px); }\n  .lp2-left::after { content:''; position:absolute; right:-70px; bottom:-90px; width:280px; height:280px; border-radius:50%; background:rgba(255,255,255,.045); }\n  .lp2-brand { position:relative; z-index:1; display:flex; align-items:center; gap:9px; font-size:12px; letter-spacing:.14em; color:var(--text-dim); font-weight:700; }\n  .lp2-brand i { width:10px; height:10px; border-radius:3px; background:var(--accent); box-shadow:0 0 12px var(--accent-line); flex:none; }\n  .lp2-brand span { font-weight:400; opacity:.6; letter-spacing:.06em; }\n  .lp2-left h1 { position:relative; z-index:1; font-size:clamp(2.1em, 4.6vw, 3em); line-height:1.18; margin:0 0 12px; font-weight:800; letter-spacing:-.01em; }\n  .lp2-left h1 em { font-style:normal; color:var(--accent); }\n  .lp2-head p { position:relative; z-index:1; margin:0; color:var(--text-dim); font-size:14px; }\n  .lp2-chips { position:relative; z-index:1; display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }\n  .lp2-chips div { padding:12px; border:1px solid var(--line); background:var(--surface-2); border-radius:12px; }\n  .lp2-chips b { display:block; font-size:15px; margin-bottom:3px; color:var(--accent); }\n  .lp2-chips span { font-size:11px; color:var(--text-dim); }\n  .lp2-right { display:flex; flex-direction:column; padding:44px 40px; background:var(--surface); color:var(--text); }\n  .lp2-right h2 { margin:6px 0 6px; font-size:1.5em; font-weight:800; letter-spacing:-.01em; }\n  .lp2-sub { margin:0 0 26px; color:var(--text-dim); font-size:13px; }\n  .lp2-cta { display:flex; align-items:center; justify-content:space-between; padding:15px 20px; border-radius:12px; background:var(--accent); color:var(--accent-ink); text-decoration:none; font-weight:700; font-size:15px; transition:filter .18s ease, transform .18s ease; box-shadow:0 10px 24px var(--accent-dim); }\n  .lp2-cta:hover { filter:brightness(1.1); transform:translateY(-2px); }\n  .lp2-cta span { font-weight:400; opacity:.75; }\n  .lp2-links { display:flex; flex-direction:column; gap:10px; margin-top:22px; }\n  .lp2-links a { display:flex; align-items:center; gap:12px; padding:13px 16px; border:1px solid var(--line); border-radius:12px; background:var(--surface-2); color:var(--text); text-decoration:none; font-size:14px; font-weight:600; transition:border-color .16s ease, transform .16s ease, box-shadow .16s ease; }\n  .lp2-links a:hover { border-color:var(--accent-line); transform:translateX(3px); box-shadow:0 6px 18px var(--accent-dim); }\n  .lp2-ico { font-size:17px; }\n  .lp2-arrow { margin-left:auto; color:var(--text-faint); font-size:13px; }\n  .lp2-foot { margin:auto 0 0; padding-top:26px; color:var(--text-faint); font-size:11px; text-align:center; }\n  .lp2-mini { display:flex; gap:10px; margin-top:18px; }\n  .lp2-mini a { flex:1; display:flex; align-items:center; justify-content:center; gap:6px; padding:10px; border:1px solid var(--line); border-radius:10px; background:var(--surface-2); color:var(--text-dim); text-decoration:none; font-size:12.5px; font-weight:600; transition:border-color .16s ease, color .16s ease; }\n  .lp2-mini a:hover { border-color:var(--accent-line); color:var(--text); }\n  .lp2-input { width:100%; padding:13px 16px; border-radius:12px; border:1px solid var(--line-strong); background:var(--input-bg); color:var(--text); font-size:15px; letter-spacing:.15em; text-align:center; outline:none; transition:border-color .16s ease, box-shadow .16s ease; }\n  .lp2-input:focus { border-color:var(--accent-line); box-shadow:0 0 0 3px var(--accent-dim); }\n  .lp2-err { min-height:1.4em; margin:10px 0 12px; font-size:13px; color:var(--bad); text-align:center; }\n  button.lp2-cta { width:100%; justify-content:center; cursor:pointer; border:0; font-family:inherit; }\n  @media (max-width: 780px) {\n    .lp2-card { grid-template-columns:1fr; min-height:0; }\n    .lp2-left { gap:28px; padding:32px 28px; }\n    .lp2-right { padding:30px 28px 26px; }\n    .lp2-foot { padding-top:20px; }\n  }\n  @media (prefers-reduced-motion: reduce) { .lp2-photo, .lp2-card { animation:none; } }\n";

// src/editions/personal/ui/theme.js
var SPEED_TOOLS = speed_test_default;
var LANDING_CSS = landing_default;

// src/editions/personal/version.js
var CURRENT_VERSION = "v6.4.9-refactor.8";

// web/personal/pages.js
function buildFrontendHtml(authed, { previewEdition } = {}) {
  const preview = previewEdition === "personal" || previewEdition === "multi";
  const multiPreview = previewEdition === "multi";
  const rightPanel = preview ? `    <h2>\u5FEB\u6377\u5165\u53E3</h2>
    <p class="lp2-sub">${multiPreview ? "\u591A\u4EBA\u7248" : "\u4E2A\u4EBA\u7248"} \xB7 \u672C\u5730\u9884\u89C8</p>
    <form method="post" action="/__preview/login">
      <button class="lp2-cta" type="submit">\u8FDB\u5165${multiPreview ? "\u7BA1\u7406\u5458" : "\u4E2A\u4EBA\u7248"}\u5DE5\u4F5C\u533A <span>\u2192</span></button>
    </form>
    ${multiPreview ? `<form method="post" action="/__preview/login?role=member" style="margin-top:12px">
      <button class="btn" style="width:100%" type="submit">\u9A8C\u6536\u666E\u901A\u7528\u6237\u89C6\u56FE</button>
    </form>` : ""}
    <nav class="lp2-links">
      <a href="http://127.0.0.1:${multiPreview ? "4273" : "4274"}/__preview"><span class="lp2-ico">\u{1F39B}\uFE0F</span><span class="lp2-name">\u5207\u6362\u5230${multiPreview ? "\u4E2A\u4EBA\u7248" : "\u591A\u4EBA\u7248"}</span><span class="lp2-arrow">\u2192</span></a>
    </nav>` : authed ? `    <h2>\u5FEB\u6377\u5165\u53E3</h2>
    <p class="lp2-sub">\u8282\u70B9\u7BA1\u7406 \xB7 \u4F18\u9009\u7EBF\u8DEF \xB7 \u4F7F\u7528\u7EDF\u8BA1</p>
    <a class="lp2-cta" href="/admin">\u8FDB\u5165\u7BA1\u7406\u540E\u53F0 <span>\u2192</span></a>
    <nav class="lp2-links">
      <a href="https://t.me/+7cbXthaBajszNjI1" target="_blank" rel="noopener"><span class="lp2-ico">\u{1F4AC}</span><span class="lp2-name">TG \u7FA4\u7EC4</span><span class="lp2-arrow">\u2197</span></a>
      <a href="https://github.com/Dirige/EMBY_CF" target="_blank" rel="noopener"><span class="lp2-ico">\u{1F419}</span><span class="lp2-name">GitHub</span><span class="lp2-arrow">\u2197</span></a>
      <a href="https://yx.255432.xyz/" target="_blank" rel="noopener"><span class="lp2-ico">\u{1F6F0}\uFE0F</span><span class="lp2-name">\u4F18\u9009\u57DF\u540D\u76D1\u6D4B</span><span class="lp2-arrow">\u2197</span></a>
    </nav>` : `    <h2>\u7BA1\u7406\u5458\u767B\u5F55</h2>
    <p class="lp2-sub">\u8F93\u5165\u767B\u5F55\u5BC6\u7801\u8FDB\u5165\u63A7\u5236\u53F0</p>
    <input type="password" id="tokenInput" class="lp2-input" placeholder="\u767B\u5F55\u5BC6\u7801" autocomplete="current-password" maxlength="1024" onkeydown="if(event.key==='Enter')lpLogin()">
    <p id="loginErr" class="lp2-err"></p>
    <button class="lp2-cta" id="loginBtn" onclick="lpLogin()">\u767B \u5F55 <span>\u2192</span></button>
    <div class="lp2-mini">
      <a href="https://t.me/+7cbXthaBajszNjI1" target="_blank" rel="noopener">\u{1F4AC} \u7FA4\u7EC4</a>
      <a href="https://github.com/Dirige/EMBY_CF" target="_blank" rel="noopener">\u{1F419} GitHub</a>
    </div>`;
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light"><meta name="theme-color" content="#06090f">
<title>Emby \u53CD\u5411\u4EE3\u7406 \xB7 \u7EDF\u4E00\u5165\u53E3</title><link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>\u{1F3AC}</text></svg>">
<script>${THEME_INIT}<\/script>
<script>${DYN_PALETTE}<\/script>
<style>${PAGE_STYLE}${LANDING_CSS}</style></head><body class="lp2">
<div class="lp2-bg" aria-hidden="true"><i class="lp2-photo"></i><i class="lp2-veil"></i></div>
<main class="lp2-card">
  <section class="lp2-left">
    <div class="lp2-brand"><i></i>EMBY\xB7PROXY <span>${CURRENT_VERSION}</span></div>
    <div class="lp2-head">
      <h1>Emby <em>\u8FB9\u7F18\u4EE3\u7406</em></h1>
      <p>\u591A\u6E90\u7AD9\u7EDF\u4E00\u5165\u53E3 \xB7 \u4E09\u6001\u5206\u6D41 \xB7 \u8FB9\u7F18\u52A0\u901F</p>
    </div>
    <div class="lp2-chips">
      <div><b>Route</b><span>\u5A92\u4F53\u8DEF\u7531</span></div>
      <div><b>Relay</b><span>\u4E2D\u7EE7\u5206\u6D41</span></div>
      <div><b>Signal</b><span>\u64AD\u653E\u7EDF\u8BA1</span></div>
    </div>
  </section>
  <section class="lp2-right">
${rightPanel}
    <p class="lp2-foot">${preview ? "\u4EC5\u672C\u5730\u6D4B\u8BD5 \xB7 \u672A\u90E8\u7F72\u7EBF\u4E0A \xB7 \u8BF7\u52FF\u586B\u5199\u771F\u5B9E\u51ED\u636E" : "\u6BCF\u65E5\u58C1\u7EB8\u6765\u81EA Bing \xB7 \u8BF7\u59A5\u5584\u4F7F\u7528"}</p>
  </section>
</main>
<script>${THEME_LOGIC}
${authed ? "" : `async function lpLogin() {
  var t = document.getElementById('tokenInput').value;
  var err = document.getElementById('loginErr');
  var btn = document.getElementById('loginBtn');
  err.textContent = '';
  if (!t) { err.textContent = '\u8BF7\u8F93\u5165\u5BC6\u94A5'; return; }
  btn.disabled = true; btn.style.opacity = '.6';
  try {
    var r = await fetch('/admin/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: t }) });
    var d = await r.json();
    if (d.ok) { location.href = '/admin'; return; }
    err.textContent = d.error || '\u767B\u5F55\u5931\u8D25';
  } catch (e) { err.textContent = '\u8BF7\u6C42\u5931\u8D25: ' + e.message; }
  btn.disabled = false; btn.style.opacity = '';
}`}
<\/script></body></html>`;
}
function buildAdminHtml() {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light"><meta name="theme-color" content="#06090f">
<title>\u7BA1\u7406\u540E\u53F0</title><link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>\u{1F39B}\uFE0F</text></svg>">
<script>${THEME_INIT}<\/script>
<script>${DYN_PALETTE}<\/script>
<style>${PAGE_STYLE}</style></head><body>
<div id="toast"></div>
<div class="admin-bg" aria-hidden="true"></div>
<div class="container">
  <div class="topbar">
    <a class="brand" href="/"><i class="brand-mark"></i><span class="bname">ADMIN<span style="color:var(--accent)">\xB7</span>CONSOLE</span></a>
    <div class="topbar-actions">
      <button class="theme-toggle" id="themeToggle" onclick="cycleTheme()">AUTO</button>
      <button class="btn btn-sm" id="btnDailyReport" onclick="sendReport(this)">\u53D1\u9001\u65E5\u62A5</button>
      <a href="/" class="btn btn-sm">\u9996\u9875</a>
      <button class="btn btn-sm" onclick="openSettings()">\u8BBE\u7F6E</button>
      <button class="btn btn-sm btn-danger" onclick="logout()">\u9000\u51FA</button>
    </div>
  </div>

  <nav class="tabbar" id="tabbar">
    <button class="tab-btn active" data-tab="overview" onclick="switchTab('overview')">\u{1F4CA} \u6982\u89C8</button>
    <button class="tab-btn" data-tab="routes" onclick="switchTab('routes')">\u{1F6A6} \u8DEF\u7531<span class="tab-badge" id="tabRouteCount"></span></button>
    <button class="tab-btn" data-tab="domains" onclick="switchTab('domains')">\u{1F310} \u4F18\u9009</button>
    <button class="tab-btn" data-tab="logs" onclick="switchTab('logs')">\u{1F4DC} \u65E5\u5FD7</button>
  </nav>

  <div id="tab-overview" class="tab-pane">
    <div class="card">
      <div class="sec-title">\u4F7F\u7528\u7EDF\u8BA1 <span class="chip">CF&nbsp;ANALYTICS</span></div>
      <div id="stats-loading" class="muted"><span class="spin"></span>\u52A0\u8F7D\u4E2D...</div>
      <div id="stats-body" style="display:none">
        <div class="stat-row">
          <div class="stat-card"><div>\u4ECA\u65E5\u8BF7\u6C42</div><div class="stat-val" id="st-req">0</div><div class="stat-sub" id="st-req-sub"></div></div>
          <div class="stat-card"><div>\u4ECA\u65E5\u6D41\u91CF</div><div class="stat-val" id="st-traffic">0 B</div><div class="stat-sub" id="st-traffic-sub"></div></div>
          <div class="stat-card"><div>\u4ECA\u65E5\u8BBF\u95EE</div><div class="stat-val" id="st-uv">0</div><div class="stat-sub" id="st-uv-sub"></div></div>
        </div>
        <div class="stat-row">
          <div class="stat-card"><div>\u4E2D\u7EE7\u4ECA\u65E5\u8BF7\u6C42</div><div class="stat-val" id="st-relay-req">\u2014</div><div class="stat-sub" id="st-relay-req-sub">\u6765\u6E90: VPS \u4E2D\u7EE7</div></div>
          <div class="stat-card"><div>\u4E2D\u7EE7\u4ECA\u65E5\u6D41\u91CF</div><div class="stat-val" id="st-relay-traffic">\u2014</div><div class="stat-sub" id="st-relay-traffic-sub">\u2191\u6E90\u7AD9\u62C9\u53D6 \u2193\u53D1\u56DE\u5BA2\u6237\u7AEF</div></div>
        </div>
        <div id="hourly-chart"></div>
        <p class="muted" style="font-size:11px;margin-top:8px" id="st-updated"></p>
      </div>
    </div>
    <div class="card">
      <div class="sec-title">\u5F53\u524D\u8FB9\u7F18\u8282\u70B9 <span class="chip">EDGE</span></div>
      <div id="edge-loading" class="muted"><span class="spin"></span>\u6B63\u5728\u63A2\u6D4B...</div>
      <div id="edge-info" class="edge-box" style="display:none"></div>
    </div>
  </div>

  <div id="tab-routes" class="tab-pane" style="display:none">
  <div class="card">
    <div class="sec-title">\u8DEF\u7531\u7BA1\u7406 <span class="chip" id="routeCount"></span></div>
    <div class="toolbar" style="margin-bottom:16px">
      <button class="btn btn-sm btn-solid" onclick="openRouteModal()">\u6DFB\u52A0\u8DEF\u7531</button>
      <button class="btn btn-sm" onclick="location.href='/admin/api/export'">\u5BFC\u51FA\u914D\u7F6E</button>
      <button class="btn btn-sm" onclick="document.getElementById('importFile').click()">\u5BFC\u5165\u914D\u7F6E</button>
      <input type="file" id="importFile" accept="application/json,.json" style="display:none" onchange="importConfig(this)">
      <div class="search-box">
        <input type="text" id="routeSearch" placeholder="\u641C\u7D22\u5907\u6CE8\u6216\u8DEF\u5F84..." oninput="filterRoutes()">
      </div>
    </div>
    <div class="dns-quick">
      <span class="dns-quick-tag">DNS</span>
      <input id="dnsQuickName" placeholder="\u8BB0\u5F55\u540D\uFF08\u7559\u7A7A = BASE_DOMAIN\uFF09">
      <span class="dns-quick-arrow">\u2192</span>
      <input id="dnsQuickTarget" placeholder="\u76EE\u6807\u57DF\u540D\u6216 IP\uFF08\u53EF\u4EE5\u76F4\u63A5\u6539\uFF09">
      <button class="btn btn-sm btn-solid" id="dnsQuickSave" onclick="quickSaveDNS(this)">\u4FDD\u5B58</button>
      <button class="btn btn-sm" onclick="loadQuickDNS()">\u5237\u65B0</button>
    </div>
    <p class="muted" id="dnsQuickMeta" style="margin:-2px 0 14px;font-size:12px">DNS \u8BB0\u5F55\u52A0\u8F7D\u4E2D...</p>
    <div id="routeList" class="route-grid"><p class="muted"><span class="spin"></span>\u52A0\u8F7D\u4E2D...</p></div>
  </div>

  <div class="card">
    <div class="sec-title">VPS \u53CD\u4EE3\u4E2D\u7EE7 <span class="chip" id="relayChip" style="margin-left:8px">\u2014</span></div>
    <p class="form-hint" style="margin-bottom:14px">\u7EBF\u8DEF\u9009\u300C\u5F00\u300D\u76F4\u63A5\u8D70 VPS\uFF1B\u9009\u300C\u81EA\u52A8\u300D\u5219 Worker \u4F18\u5148\uFF0C\u9047\u5230\u8FDE\u63A5\u6545\u969C\u6216 IP\uFF0F\u5730\u533A\u62E6\u622A\u65F6\u5C1D\u8BD5 VPS\uFF0C\u6210\u529F\u540E\u77ED\u671F\u4F18\u5148 VPS\uFF1B\u9009\u300C\u5173\u300D\u4E0D\u4F7F\u7528 VPS\u3002</p>
    <div class="form-group">
      <label>\u4E2D\u7EE7\u5730\u5740\uFF08\u542B\u7AEF\u53E3\uFF09</label>
      <input id="relayUrl" placeholder="\u4F8B\u5982 http://1.2.3.4:2087 \u6216 https://relay.xxx.com:2087">
      <p class="form-hint">\u672A\u4E0B\u53D1\u8BC1\u4E66\u65F6\u7528 http\uFF0C\u4E0B\u53D1\u8BC1\u4E66\u540E\u6539 https\u3002\u7AEF\u53E3\u987B\u4E0E VPS \u670D\u52A1\u7AEF\u53E3\u4E00\u81F4\uFF08\u5F53\u524D <span id="relayPortHint">2087</span>\uFF09</p>
    </div>
    <div class="form-group">
      <label>\u4E2D\u7EE7\u5BC6\u94A5</label>
      <input id="relaySecret" autocomplete="off" placeholder="">
      <p class="form-hint">\u9996\u6B21\u586B VPS \u670D\u52A1\u7AEF\u914D\u7F6E\u91CC\u7684\u4E00\u6B21\u6027\u5F15\u5BFC\u5BC6\u94A5\uFF1B\u4E4B\u540E\u53EF\u968F\u65F6\u6362\u65B0\u5BC6\u94A5\uFF0C\u4FDD\u5B58\u65F6\u81EA\u52A8\u63A8\u9001\u5230 VPS</p>
    </div>
    <div class="form-group">
      <label class="checkbox-label">
        <input type="checkbox" id="relayEnabled"> \u542F\u7528 VPS \u4E2D\u7EE7\uFF08\u603B\u5F00\u5173\uFF09
      </label>
    </div>
    <details class="adv-box">
      <summary>\u{1F510} TLS \u8BC1\u4E66\uFF08\u53EF\u9009 \xB7 \u9AD8\u7EA7\uFF09</summary>
      <label style="margin-top:12px">TLS \u8BC1\u4E66 (PEM\uFF0C\u53EF\u9009)</label>
      <textarea id="relayCert" rows="4" spellcheck="false" style="font-family:ui-monospace,monospace;font-size:12px" placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"></textarea>
      <label style="margin-top:12px">\u79C1\u94A5 (PEM\uFF0C\u53EF\u9009)</label>
      <textarea id="relayKey" rows="4" spellcheck="false" style="font-family:ui-monospace,monospace;font-size:12px" placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"></textarea>
      <p class="form-hint">\u7559\u7A7A\u5219\u53EA\u63A8\u9001\u5BC6\u94A5\u4E0D\u52A8\u8BC1\u4E66\uFF1B\u4E24\u9879\u90FD\u586B\u5219\u63A8\u9001\u8BC1\u4E66\u5E76\u81EA\u52A8\u91CD\u542F VPS \u8BC1\u4E66\u670D\u52A1\u3002\u60F3\u8BA9 Worker\u2192VPS \u8FD9\u6BB5\u52A0\u5BC6\uFF0C\u63A8\u8350\u5728 VPS \u4E0A\u7528 Let's Encrypt \u81EA\u52A8\u7B7E\uFF08\u9700\u8981\u65F6\u6211\u53EF\u4EE5\u7ED9\u4E00\u952E\u811A\u672C\uFF09\uFF0CCF \u5C0F\u4E91\u6735\u89E3\u51B3\u4E0D\u4E86\u8FD9\u6BB5\u7684\u52A0\u5BC6</p>
    </details>
    <div class="toolbar">
      <button class="btn btn-sm btn-solid" onclick="saveRelay(this)">\u4FDD\u5B58\u5E76\u4E0B\u53D1\u5230 VPS</button>
      <button class="btn btn-sm" onclick="testRelay(this)">\u6D4B\u8BD5\u8FDE\u901A</button>
      <span id="relayStatus" class="form-hint"></span>
    </div>
    <div id="relayStats" class="relay-stats" title="\u70B9\u51FB\u5237\u65B0">\u{1F4CA} \u4E2D\u7EE7\u6D41\u91CF\uFF1A\u52A0\u8F7D\u4E2D...</div>
  </div>

  </div>

  <div id="tab-domains" class="tab-pane" style="display:none">
  <div class="card">
    <div class="sec-title">\u4F18\u9009\u57DF\u540D <span class="chip">CDN</span></div>
    <div class="toolbar" style="margin-bottom:16px">
      <button class="btn btn-sm" onclick="openDomainModal()">\u6DFB\u52A0\u57DF\u540D</button>
      <button class="btn btn-sm" onclick="testDomains()">\u91CD\u65B0\u6D4B\u901F</button>
      <span id="domain-status" class="muted"></span>
    </div>
    <div id="domainList" class="domain-list"><p class="muted"><span class="spin"></span>\u52A0\u8F7D\u4E2D...</p></div>
  </div>
  </div>

  <div id="tab-logs" class="tab-pane" style="display:none">
  <div class="card">
    <div class="sec-title">\u64CD\u4F5C\u65E5\u5FD7 <span class="chip">AUDIT</span></div>
    <div class="toolbar" style="margin-bottom:16px"><button class="btn btn-sm" onclick="loadAudit()">\u5237\u65B0</button></div>
    <div id="auditList" class="muted">\u70B9\u51FB\u5237\u65B0\u67E5\u770B\u6700\u8FD1 100 \u6761\u64CD\u4F5C</div>
  </div>
  </div>
</div>

<div id="modalRoute" class="modal">
  <div class="modal-inner">
    <div class="modal-header">
      <h2 class="modal-title" id="routeModalTitle">\u6DFB\u52A0\u8DEF\u7531</h2>
      <p class="modal-desc">\u521B\u5EFA\u8DEF\u7531\u540E\u53EF\u901A\u8FC7 /\u8DEF\u5F84 \u5FEB\u6377\u8BBF\u95EE\u76EE\u6807\u670D\u52A1</p>
    </div>
    <input type="hidden" id="oldPrefix">
    <div class="form-group">
      <label>\u5907\u6CE8\u540D</label>
      <input id="routeRemark" placeholder="\u4F8B\u5982\uFF1A\u6211\u7684 Emby \u670D\u52A1\u5668">
      <p class="form-hint">\u5F02\u5E38\u4E0E\u6062\u590D\u901A\u77E5\u4F18\u5148\u663E\u793A\u5907\u6CE8\uFF1B\u8BF7\u53EA\u586B\u5199\u53EF\u516C\u5F00\u7684\u670D\u540D\uFF0C\u4E0D\u8981\u653E\u5730\u5740\u6216\u5BC6\u94A5\u3002\u7A7A\u5907\u6CE8\u3001\u7591\u4F3C\u654F\u611F\u5185\u5BB9\u6216\u8D85\u8FC7 64 \u5B57\u7B26\u65F6\u4F7F\u7528\u901A\u77E5\u7F16\u53F7\u3002</p>
    </div>
    <div class="form-group">
      <label>\u8DEF\u5F84 (prefix)</label>
      <input id="routePrefix" placeholder="myemby">
      <p class="form-hint">\u8BBF\u95EE\u8DEF\u5F84: https://\u4F60\u7684\u57DF\u540D/<span id="prefixPreview">myemby</span></p>
    </div>
    <div class="form-group">
      <label>\u76EE\u6807\u5730\u5740 (target)</label>
      <textarea id="routeTarget" rows="3" placeholder="https://emby.example.com:8096&#10;https://emby-backup.example.com:8096"></textarea>
      <p class="form-hint">\u4E00\u884C\u4E00\u4E2A\u5730\u5740\uFF08\u4E5F\u652F\u6301\u9017\u53F7\u5206\u9694\uFF09\uFF0C\u6309\u987A\u5E8F\u6545\u969C\u8F6C\u79FB</p>
    </div>
    <div class="form-group">
      <label class="checkbox-label">
        <input type="checkbox" id="routeCache" checked> \u542F\u7528\u56FE\u7247/\u9759\u6001\u8D44\u6E90\u7F13\u5B58
      </label>
      <label class="checkbox-label" style="margin-top:12px">
        <input type="checkbox" id="routeCompat"> \u517C\u5BB9\u6A21\u5F0F
      </label>
      <p class="form-hint">\u517C\u5BB9\u6A21\u5F0F\u9002\u7528\u4E8E\u90E8\u5206\u65E0\u6CD5\u6B63\u5E38\u64AD\u653E\u7684 Emby \u670D\u52A1\u5668\uFF0C\u5F00\u542F\u540E\u4E0D\u91CD\u5199\u5A92\u4F53\u6D41\u5730\u5740\uFF0C\u7531\u5BA2\u6237\u7AEF\u76F4\u8FDE\u6E90\u7AD9\u64AD\u653E</p>
      <label style="margin-top:12px">VPS \u53CD\u4EE3\u5206\u6D41\u6A21\u5F0F</label>
      <select id="routeRelayMode" style="margin-top:6px">
        <option value="auto" selected>\u81EA\u52A8 \u2014 Worker \u4F18\u5148\uFF0C\u5931\u8D25\u5207 VPS</option>
        <option value="on">\u5F00 \u2014 \u76F4\u63A5\u8D70 VPS</option>
        <option value="off">\u5173 \u2014 \u53EA\u8D70 Worker</option>
      </select>
      <p class="form-hint">\u81EA\u52A8\uFF1AGET/HEAD \u9047\u5230 401/403/451\u3001\u8FDE\u63A5\u5931\u8D25\u3001\u8D85\u65F6\u6216\u6307\u5B9A\u7F51\u5173\u9519\u8BEF\u65F6\u5C1D\u8BD5\u4E00\u6B21 VPS\uFF1B\u767B\u5F55\u548C PlaybackInfo \u7684\u5C0F\u578B POST \u4EC5\u5728\u660E\u786E\u6536\u5230 401/403/451 \u65F6\u91CD\u8BD5\u3002\u56DE\u9000\u6210\u529F\u540E\u4F18\u5148 VPS 2 \u5206\u949F\uFF0C\u518D\u7531\u53EA\u8BFB\u8BF7\u6C42\u63A2\u6D4B\u76F4\u8FDE\u6062\u590D\uFF1B\u4E0B\u8F7D\u6162\u4E0D\u4F1A\u4E2D\u9014\u91CD\u53D1\u89C6\u9891\u3002\u300C\u5F00\u300D\u8981\u6C42\u5168\u5C40\u4E2D\u7EE7\u5DF2\u542F\u7528\u5E76\u914D\u7F6E\uFF0C\u5426\u5219\u62A5\u9519\uFF0C\u4E0D\u4F1A\u6539\u8D70 Worker\u3002</p>
    </div>
    <div class="form-group">
      <label>\u5BA2\u6237\u7AEF IP</label>
      <select id="routeIpMode">
        <option value="forward">\u9ED8\u8BA4\u6A21\u5F0F\uFF08\u900F\u4F20\u5BA2\u6237\u7AEF IP\uFF09</option>
        <option value="strip">\u4E0D\u900F\u4F20 IP\uFF08\u4E0D\u53D1\u9001 X-Forwarded-For / X-Real-IP\uFF09</option>
        <option value="disable">\u5F7B\u5E95\u9690\u85CF\uFF08\u5265\u79BB\u6240\u6709\u5BA2\u6237\u7AEF\u8EAB\u4EFD\u5934\uFF09</option>
      </select>
      <p class="form-hint">\u53CD\u4EE3\u76EE\u6807\u4E5F\u662F Cloudflare \u7AD9\u70B9\u65F6\u5EFA\u8BAE\u9009\u300C\u5F7B\u5E95\u9690\u85CF\u300D\uFF0C\u6E90\u7AD9\u5C06\u53EA\u80FD\u770B\u5230 Worker \u51FA\u53E3 IP</p>
    </div>
    <div class="form-group">
      <label>\u81EA\u5B9A\u4E49\u8BF7\u6C42\u5934\uFF08\u53EF\u9009\uFF09</label>
      <textarea id="routeHeaders" rows="3" placeholder="User-Agent: Emby/4.8&#10;Origin: https://example.com"></textarea>
      <p class="form-hint">\u6BCF\u884C\u4E00\u4E2A Name: Value\uFF0C\u4F1A\u8986\u76D6\u8F6C\u53D1\u7ED9\u4E0A\u6E38\u7684\u540C\u540D\u8BF7\u6C42\u5934\uFF0C\u53EF\u7528\u4E8E\u5E94\u5BF9\u9632\u76D7\u94FE</p>
    </div>
    <div class="form-group">
      <label>IP \u767D\u540D\u5355\uFF08\u53EF\u9009\uFF09</label>
      <input id="routeIpAllow" placeholder="\u7559\u7A7A\u8868\u793A\u4E0D\u9650\u5236\uFF0C\u4F8B\u5982 1.2.3.4, 10.0.0.0/8">
      <label style="margin-top:12px">IP \u9ED1\u540D\u5355\uFF08\u53EF\u9009\uFF09</label>
      <input id="routeIpBlock" placeholder="\u4F8B\u5982 5.6.7.8">
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal('modalRoute')">\u53D6\u6D88</button>
      <button class="btn btn-solid" onclick="saveRoute()">\u4FDD\u5B58</button>
    </div>
  </div>
</div>

<div id="modalDomain" class="modal">
  <div class="modal-inner">
    <div class="modal-header">
      <h2 class="modal-title" id="domainModalTitle">\u6DFB\u52A0\u4F18\u9009\u57DF\u540D</h2>
      <p class="modal-desc">\u6DFB\u52A0\u60A8\u81EA\u5DF1\u7684\u4F18\u9009\u57DF\u540D</p>
    </div>
    <input type="hidden" id="domainId">
    <div class="form-group">
      <label>\u540D\u79F0</label>
      <input id="domainName" placeholder="\u4F8B\u5982\uFF1A\u6211\u7684\u4F18\u9009\u57DF\u540D">
    </div>
    <div class="form-group">
      <label>\u57DF\u540D</label>
      <input id="domainUrl" type="url" placeholder="https://example.com">
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal('modalDomain')">\u53D6\u6D88</button>
      <button class="btn btn-solid" onclick="saveDomain()">\u4FDD\u5B58</button>
    </div>
  </div>
</div>


<div id="modalSettings" class="modal">
  <div class="modal-inner">
    <div class="modal-header">
      <h2 class="modal-title">\u7CFB\u7EDF\u8BBE\u7F6E</h2>
      <p class="modal-desc">\u5B9A\u65F6\u4EFB\u52A1\u9700\u8981\u5728 Cloudflare \u63A7\u5236\u53F0\u4E3A Worker \u6DFB\u52A0 Cron \u89E6\u53D1\u5668\uFF08\u5982 */10 * * * *\uFF09</p>
    </div>
    <div class="form-group">
      <label class="checkbox-label"><input type="checkbox" id="setHealth"> \u542F\u7528\u7EBF\u8DEF\u5065\u5EB7\u68C0\u67E5\uFF08\u8FDE\u7EED 2 \u6B21\u5931\u8D25\u544A\u8B66\uFF0C\u6062\u590D\u65F6\u518D\u901A\u77E5\uFF09</label>
      <p class="form-hint" id="notifyHint"></p>
    </div>
    <div class="form-group">
      <label class="checkbox-label"><input type="checkbox" id="setDailyReport" checked> \u6BCF\u5929 23:00\uFF08\u5317\u4EAC\u65F6\u95F4\uFF09\u81EA\u52A8\u53D1\u9001 Telegram \u65E5\u62A5</label>
      <p class="form-hint">\u9700\u8981\u7ED9 Worker \u914D\u7F6E Cron \u89E6\u53D1\u5668\uFF0C\u4F8B\u5982 <code>0 15 * * *</code>\uFF1B\u4E5F\u53EF\u4EE5\u968F\u65F6\u70B9\u9876\u90E8\u7684\u300C\u53D1\u9001\u65E5\u62A5\u300D\u624B\u52A8\u53D1\u9001</p>
    </div>
    <div class="form-group">
      <h3>\u901A\u77E5 \xB7 Telegram</h3>
      <label class="checkbox-label"><input type="checkbox" id="setRouteAlerts" checked> \u53D1\u9001\u7EBF\u8DEF\u5F02\u5E38\u4E0E\u6062\u590D\u901A\u77E5</label>
      <p class="form-hint">\u544A\u8B66\u4F18\u5148\u663E\u793A\u5B89\u5168\u7684\u7EBF\u8DEF\u5907\u6CE8\uFF0C\u4E0D\u53D1\u9001\u7EBF\u8DEF\u5730\u5740\u3001\u5165\u53E3\u6216\u539F\u59CB\u9519\u8BEF\uFF1B\u5907\u6CE8\u4E3A\u7A7A\u6216\u7591\u4F3C\u542B\u5730\u5740\u3001\u51ED\u636E\u65F6\u56DE\u9000\u5230\u7EBF\u8DEF\u5361\u7247\u4E0A\u7684\u901A\u77E5\u7F16\u53F7\u3002</p>
      <label for="tgBotToken">Bot Token</label>
      <input id="tgBotToken" type="password" autocomplete="new-password" maxlength="256" placeholder="\u586B\u5199\u65B0 Token\uFF1B\u7559\u7A7A\u4FDD\u6301\u4E0D\u53D8">
      <label for="tgChatId">Chat ID</label>
      <input id="tgChatId" inputmode="text" maxlength="21" placeholder="\u6570\u5B57 ID\uFF1B\u7FA4\u7EC4\u901A\u5E38\u4E3A\u8D1F\u6570">
      <p class="form-hint" id="tgConfigStatus"></p>
      <p class="form-hint" id="tgLastStatus"></p>
      <div class="modal-actions">
        <button class="btn" id="btnSaveTelegram" onclick="saveTelegram(this)">\u4FDD\u5B58 TG \u914D\u7F6E</button>
        <button class="btn" id="btnTestTelegram" onclick="testTelegramConfig(this)">\u6D4B\u8BD5\u53D1\u9001</button>
        <button class="btn btn-danger" onclick="clearTelegram(this)">\u6E05\u9664\u5E76\u505C\u7528 TG</button>
      </div>
      <p class="form-hint">TG \u914D\u7F6E\u5355\u72EC\u4FDD\u5B58\uFF1B\u6D4B\u8BD5\u4F7F\u7528\u5DF2\u4FDD\u5B58\u914D\u7F6E\u3002Token \u52A0\u5BC6\u5B58\u50A8\uFF0C\u4E0D\u56DE\u663E\u3001\u4E0D\u5BFC\u51FA\u3002\u6E05\u9664\u540E\u4E0D\u4F1A\u56DE\u9000\u4F7F\u7528\u73AF\u5883\u53D8\u91CF\u3002</p>
    </div>
    <div class="form-group">
      <h3>\u5B89\u5168 \xB7 \u4FEE\u6539\u767B\u5F55\u5BC6\u7801</h3>
      <label for="currentPassword">\u5F53\u524D\u5BC6\u7801</label>
      <input id="currentPassword" type="password" autocomplete="current-password" maxlength="1024">
      <label for="newPassword">\u65B0\u5BC6\u7801\uFF0812\u2013128 \u4E2A\u5B57\u7B26\uFF09</label>
      <input id="newPassword" type="password" autocomplete="new-password" minlength="12" maxlength="128">
      <label for="confirmPassword">\u786E\u8BA4\u65B0\u5BC6\u7801</label>
      <input id="confirmPassword" type="password" autocomplete="new-password" minlength="12" maxlength="128">
      <p class="form-hint">\u4FEE\u6539\u540E\u6240\u6709\u65E7\u4F1A\u8BDD\u5931\u6548\uFF0C\u9700\u7528\u65B0\u5BC6\u7801\u91CD\u65B0\u767B\u5F55\u3002\u5FD8\u8BB0\u5BC6\u7801\u53EA\u80FD\u7531 Cloudflare \u7BA1\u7406\u5458\u6267\u884C\u6062\u590D\uFF0C\u65E7\u7BA1\u7406\u5BC6\u94A5\u4E0D\u4F1A\u4F5C\u4E3A\u7B2C\u4E8C\u4E2A\u767B\u5F55\u5BC6\u7801\u3002</p>
      <button class="btn" id="btnChangePassword" onclick="updatePassword(this)">\u4FEE\u6539\u5BC6\u7801\u5E76\u9000\u51FA</button>
    </div>
    <div class="form-group">
      <label>\u6BCF IP \u6BCF\u5206\u949F\u8BF7\u6C42\u4E0A\u9650\uFF080 = \u4E0D\u9650\u5236\uFF09</label>
      <input id="setRate" type="number" min="0" placeholder="0">
      <p class="form-hint">\u4EC5\u9650\u5236 API \u7C7B\u8BF7\u6C42\uFF0C\u4E0D\u5F71\u54CD\u56FE\u7247\u548C\u89C6\u9891\u6D41</p>
    </div>
    <div class="form-group">
      <label>X-Frame-Options \u54CD\u5E94\u5934\uFF08\u4EE3\u7406\u5185\u5BB9\u662F\u5426\u5141\u8BB8\u88AB iframe \u5D4C\u5165\uFF09</label>
      <select id="setXfo">
        <option value="">SAMEORIGIN\uFF08\u9ED8\u8BA4\uFF0C\u4EC5\u540C\u6E90\u53EF\u5D4C\u5165\uFF09</option>
        <option value="deny">DENY\uFF08\u5B8C\u5168\u7981\u6B62\u5D4C\u5165\uFF09</option>
        <option value="off">\u4E0D\u53D1\u9001\uFF08\u5141\u8BB8\u4EFB\u610F\u7AD9\u70B9 iframe \u5D4C\u5165\uFF09</option>
      </select>
      <p class="form-hint">\u53EA\u5F71\u54CD\u53CD\u4EE3\u51FA\u53BB\u7684\u5A92\u4F53\u5185\u5BB9\uFF1B\u7BA1\u7406\u540E\u53F0\u59CB\u7EC8\u4E3A SAMEORIGIN</p>
    </div>
    <div class="form-group">
      <label>\u989D\u5916\u7684\u624B\u52A8\u91CD\u5B9A\u5411\u57DF\u540D\uFF08\u9017\u53F7\u5206\u9694\uFF09</label>
      <input id="setManual" placeholder="\u4F8B\u5982 example-cdn.com, other.net">
      <label style="margin-top:12px">\u57DF\u540D\u6620\u5C04\u89C4\u5219\uFF08JSON\uFF0C\u65E5\u672C\u673A\u623F\u4F7F\u7528\uFF09</label>
      <textarea id="setRules" rows="2" placeholder='{"example.com":"1.2.3.4"}'></textarea>
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="runNow()">\u7ACB\u5373\u5065\u5EB7\u68C0\u67E5</button>
      <button class="btn" onclick="closeModal('modalSettings')">\u53D6\u6D88</button>
      <button class="btn btn-solid" onclick="saveSettings()">\u4FDD\u5B58</button>
    </div>
  </div>
</div>

<script>${THEME_LOGIC}
${SPEED_TOOLS}
${admin_default}<\/script></body></html>`;
}

// src/editions/personal/integrations/stats.js
async function handleStatsRequest(env2, url) {
  const dateParam = url.searchParams.get("date") || "";
  const dateKey = /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : getShanghaiParts().dateKey;
  const cf = await cfGetZoneSummary(env2, dateKey);
  const worker = await cfGetWorkerSummary(env2, dateKey);
  const cfOk = !cf.error;
  const trafficBytes = cfOk ? Number(cf.bytes) || 0 : 0;
  const requests = cfOk ? Number(cf.requests) || 0 : 0;
  const hourlySeries = Array.from({ length: 24 }, (_, h) => ({
    label: String(h).padStart(2, "0") + ":00",
    total: cfOk && cf.hourly ? cf.hourly[h] || 0 : 0
  }));
  let dailySeries = [];
  if (cfOk) {
    const s = await cfGetZoneDailySeries(env2, 7);
    if (!s.error && Array.isArray(s.series))
      dailySeries = s.series;
  }
  const zoneInfo = await resolveZoneInfo(env2);
  const notifyEnv = await notificationEnv(env2);
  const tgReady = Boolean(getTelegramToken(notifyEnv) && getTelegramChatId(notifyEnv));
  return json({
    error: null,
    data: {
      date: dateKey,
      todayRequests: requests,
      todayTraffic: formatBytes(trafficBytes),
      todayTrafficBytes: trafficBytes,
      todayVisits: cfOk ? Number(cf.visits) || 0 : null,
      cf: cfOk ? { requests: Number(cf.requests) || 0, trafficBytes: Number(cf.bytes) || 0, visits: Number(cf.visits) || 0, zoneId: cf.zoneId, zoneName: cf.zoneName, hostMatched: cf.hostMatched, note: cf.note || "", warning: cf.warning || "" } : { error: cf.error },
      worker: worker.error ? { error: worker.error } : { requests: Number(worker.requests) || 0, byScript: worker.byScript || {} },
      hourlySeries,
      dailySeries,
      cfStatus: cfOk ? cf.hostMatched ? "CF \u7EDF\u8BA1\u6B63\u5E38" : "CF \u7EDF\u8BA1\u6B63\u5E38\uFF08\u5168 Zone\uFF09" : "CF \u67E5\u8BE2\u5931\u8D25",
      cfError: cfOk ? "" : cf.error,
      envInfo: {
        baseDomain: getBaseDomain(env2),
        statsHost: getStatsHost(env2),
        zoneId: zoneInfo.zoneId || "",
        zoneSource: zoneInfo.from || "",
        hasCfToken: Boolean(getCFApiToken(env2)),
        telegramConfigured: tgReady,
        telegramTokenVar: getTelegramToken(notifyEnv) ? "\u5DF2\u8BFB\u53D6" : "\u672A\u8BFB\u53D6",
        telegramChatVar: getTelegramChatId(notifyEnv) ? "\u5DF2\u8BFB\u53D6" : "\u672A\u8BFB\u53D6"
      },
      source: cfOk ? "CF" : "CF \u4E0D\u53EF\u7528",
      lastUpdated: (/* @__PURE__ */ new Date()).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })
    }
  });
}

// src/shared/integrations/stats.js
async function getEdgeInfo(request) {
  const cf = request.cf || {};
  let traceIp = "";
  let traceColo = cf.colo || "\u672A\u77E5";
  try {
    const tr = await fetch("https://1.1.1.1/cdn-cgi/trace", { headers: { "User-Agent": "CF-Worker-Trace" } });
    const text = await tr.text();
    const coloM = text.match(/colo=([A-Z0-9]+)/);
    const ipM = text.match(/ip=([^\n]+)/);
    if (coloM)
      traceColo = coloM[1];
    if (ipM)
      traceIp = ipM[1].trim();
  } catch (_) {
  }
  return {
    clientIp: request.headers.get("cf-connecting-ip") || "\u672A\u77E5",
    entryColo: cf.colo || "\u672A\u77E5",
    entryCountry: cf.country || "\u672A\u77E5",
    entryCity: cf.city || "",
    edgeIp: traceIp || "\u2014",
    egressColo: traceColo,
    cacheKey: getClientCacheKey(request)
  };
}

// src/shared/observability/audit.js
async function auditLog(env2, action, detail) {
  if (!env2.DB)
    return;
  try {
    await env2.DB.prepare("INSERT INTO audit_log (ts, action, detail) VALUES (?, ?, ?)").bind((/* @__PURE__ */ new Date()).toISOString(), action, String(detail || "").slice(0, 500)).run();
    if (Math.random() < 0.05) {
      await env2.DB.prepare("DELETE FROM audit_log WHERE id <= (SELECT MAX(id) - 500 FROM audit_log)").run();
    }
  } catch (_) {
  }
}

// src/editions/personal/http/responses.js
function applySecurityHeaders(headers) {
  for (const [k, v] of Object.entries(SECURITY_HEADERS))
    headers.set(k, v);
  if (XFO_CURRENT)
    headers.set("X-Frame-Options", XFO_CURRENT);
  else
    headers.delete("X-Frame-Options");
  return headers;
}
function errResponse(body, status, extra) {
  const headers = { "Content-Type": "text/plain; charset=utf-8", "Access-Control-Allow-Origin": "*", "X-Content-Type-Options": "nosniff" };
  if (extra)
    for (const [k, v] of Object.entries(extra))
      headers[k] = v;
  return new Response(body, { status, headers });
}

// src/editions/personal/relay/mode.js
function normalizeRelayMode(value, fallback = "auto") {
  if (value === "image") return "auto";
  return ["auto", "on", "off"].includes(value) ? value : fallback;
}
var relayAccessDeniedStatus = (status) => [401, 403, 451].includes(status);
var relayFallbackStatus = (status) => relayAccessDeniedStatus(status) || [502, 503, 504, 521, 522, 523, 524, 525, 526].includes(status);
var relayPostEndpoint = (method, target) => method === "POST" && /\/(?:Users\/(?:AuthenticateByName|AuthenticateWithQuickConnect)|Items\/[^/]+\/PlaybackInfo)\/?$/i.test(target.pathname);
function relayRetryAllowed(method, target, status, replayable = false) {
  if (method === "GET" || method === "HEAD") return status === "transport" || relayFallbackStatus(status);
  if (method !== "POST" || !replayable || !relayAccessDeniedStatus(status)) return false;
  return relayPostEndpoint(method, target);
}
var relayResponseUsable = (response) => response.status < 500 && response.status !== 429 && !relayAccessDeniedStatus(response.status) && !response.headers.has("X-Relay-Denied");

// src/editions/personal/proxy/routes.js
var routeCache = /* @__PURE__ */ new Map();
function clearRouteCache() {
  routeCache.clear();
}
async function getRoute(env2, prefix) {
  const now = Date.now();
  const hit = routeCache.get(prefix);
  if (hit && hit.exp > now)
    return hit.route;
  const route = await env2.DB.prepare("SELECT * FROM routes WHERE prefix = ?").bind(prefix).first();
  if (routeCache.size > 500)
    routeCache.clear();
  routeCache.set(prefix, { route: route || null, exp: now + ROUTE_CACHE_TTL });
  return route || null;
}
async function resolveProxyTarget(request, env2, url) {
  const rawSegments = url.pathname.split("/").filter(Boolean);
  let firstSeg = rawSegments[0] || "";
  try {
    firstSeg = decodeURIComponent(firstSeg);
  } catch {
    return { error: errResponse("Bad Request", 400) };
  }
  const prefix = normalizePrefix(firstSeg);
  if (!prefix)
    return { error: errResponse("Not Found", 404) };
  const route = await getRoute(env2, prefix);
  if (!route)
    return { error: errResponse("404: \u8282\u70B9\u4E0D\u5B58\u5728", 404) };
  if (route.enabled === 0)
    return { error: errResponse("503: \u8BE5\u8DEF\u7531\u5DF2\u505C\u7528", 503) };
  const clientIp = request.headers.get("cf-connecting-ip") || "";
  const allow = parseIpList(route.ip_allow);
  const block = parseIpList(route.ip_block);
  if (block.length && ipMatches(clientIp, block))
    return { error: errResponse("Forbidden", 403) };
  if (allow.length && !ipMatches(clientIp, allow))
    return { error: errResponse("Forbidden", 403) };
  const enableCache = route.cache_img !== "off";
  const compatMode = route.compat_mode === "on";
  const rest = url.pathname.replace(/^\/[^/]*/, "");
  const targetUrls = splitTargets(route.target);
  const upstreamUrls = [];
  for (const target of targetUrls) {
    try {
      const t = new URL(target);
      const base = t.pathname.replace(/\/+$/, "");
      upstreamUrls.push(t.origin + base + rest + url.search);
    } catch {
      upstreamUrls.push(target.replace(/\/+$/, "") + rest + url.search);
    }
  }
  return { upstreamUrls, enableCache, compatMode, clientIpMode: normalizeIpMode(route.ip_mode), matchedPrefix: route.prefix, customHeaders: parseHeaderLines(route.custom_headers).headers, relayMode: normalizeRelayMode(route.use_relay, "off") };
}

// src/editions/personal/relay/protocol.js
function normalizeRelayBase(v) {
  let u = String(v || "").trim();
  if (!u)
    return "";
  if (!/^https?:\/\//i.test(u))
    u = "http://" + u;
  return u.replace(/\/+$/, "");
}
function relayPortFrom(relayUrl) {
  try {
    const u = new URL(/^https?:\/\//i.test(relayUrl) ? relayUrl : "http://" + relayUrl);
    return u.port ? parseInt(u.port, 10) : u.protocol === "https:" ? 443 : 80;
  } catch (_) {
    return 2087;
  }
}
var relayConfigCache = { at: 0, v: null };
var RELAY_CACHE_TTL = 6e4;
function invalidateRelayCache() {
  relayConfigCache = { at: 0, v: null };
}
async function getRelayConfig(env2) {
  const empty = { relayUrl: "", port: 2087, secret: "", certPem: "", keyPem: "", enabled: false, updatedAt: "" };
  if (!env2.DB)
    return empty;
  const now = Date.now();
  if (relayConfigCache.v && now - relayConfigCache.at < RELAY_CACHE_TTL)
    return relayConfigCache.v;
  try {
    const row = await env2.DB.prepare("SELECT * FROM relay_config WHERE id = 1").first();
    if (!row) {
      relayConfigCache = { at: now, v: empty };
      return empty;
    }
    const relayUrl = normalizeRelayBase(row.relay_url);
    const cfg = {
      relayUrl,
      port: relayUrl ? relayPortFrom(relayUrl) : 2087,
      secret: row.secret || "",
      certPem: row.cert_pem || "",
      keyPem: row.key_pem || "",
      enabled: row.enabled === "on",
      updatedAt: row.updated_at || ""
    };
    relayConfigCache = { at: now, v: cfg };
    return cfg;
  } catch (_) {
    return empty;
  }
}
async function hmacSha256Hex(secret, message) {
  const enc22 = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc22.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc22.encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function relayFetchHeaders(secret, targetUrl) {
  const ts = Date.now();
  const auth = await hmacSha256Hex(secret, `${ts}:${targetUrl}`);
  return { "X-Relay-Target": targetUrl, "X-Relay-Ts": String(ts), "X-Relay-Auth": auth };
}

// src/editions/personal/integrations/dns.js
async function createOrUpdateDNSRecord(env2, zoneId, dnsName, targetDomain, rootDomain) {
  if (!zoneId)
    zoneId = env2.CF_ZONE_ID;
  const baseDomain = rootDomain || getBaseDomain(env2) || "";
  const rawName = String(dnsName || "").trim().replace(/^\.+|\.+$/g, "");
  const recordHost = rawName === "@" ? baseDomain : rawName;
  const fullDNSName = recordHost === baseDomain ? baseDomain : baseDomain && !recordHost.endsWith("." + baseDomain) ? `${recordHost}.${baseDomain}` : recordHost;
  const recordsResult = await getDNSRecords(env2, zoneId);
  if (!recordsResult.success) {
    return recordsResult;
  }
  const recordType = detectRecordType(targetDomain);
  const recordData = {
    type: recordType,
    name: fullDNSName,
    content: targetDomain,
    ttl: 1,
    proxied: false
  };
  const sameType = recordsResult.result.filter((r) => r.name === fullDNSName && ["A", "AAAA", "CNAME"].includes(r.type));
  if (sameType.length === 1 && sameType[0].type === recordType) {
    const upd = await cloudflareAPICall(env2, "PUT", `/zones/${zoneId}/dns_records/${sameType[0].id}`, recordData);
    if (upd.success) {
      await saveDNSConfig(env2, dnsName, targetDomain, zoneId);
      return upd;
    }
  }
  const oldRecords = recordsResult.result.filter((r) => r.name === fullDNSName && ["A", "AAAA", "CNAME"].includes(r.type));
  for (const old of oldRecords) {
    const delResult = await cloudflareAPICall(env2, "DELETE", `/zones/${zoneId}/dns_records/${old.id}`);
    if (!delResult.success) {
      return { success: false, error: "\u5220\u9664\u65E7\u8BB0\u5F55\u5931\u8D25: " + (delResult.errors?.[0]?.message || "\u672A\u77E5\u9519\u8BEF") };
    }
  }
  let result = await cloudflareAPICall(env2, "POST", `/zones/${zoneId}/dns_records`, recordData);
  if (!result.success) {
    const rollbackFailed = [];
    for (const old of oldRecords) {
      const rb = await cloudflareAPICall(env2, "POST", `/zones/${zoneId}/dns_records`, {
        type: old.type,
        name: old.name,
        content: old.content,
        ttl: old.ttl || 1,
        proxied: Boolean(old.proxied)
      });
      if (!rb.success)
        rollbackFailed.push(old.name + " (" + old.type + ")");
    }
    let errMsg = result.errors?.[0]?.message || "\u521B\u5EFA\u65B0\u8BB0\u5F55\u5931\u8D25";
    if (rollbackFailed.length) {
      errMsg += "\uFF1B\u56DE\u6EDA\u5931\u8D25\uFF0C\u4EE5\u4E0B\u539F\u8BB0\u5F55\u672A\u80FD\u6062\u590D\uFF0C\u8BF7\u624B\u52A8\u5904\u7406: " + rollbackFailed.join(", ");
    } else if (oldRecords.length) {
      errMsg += "\uFF08\u539F\u8BB0\u5F55\u5DF2\u81EA\u52A8\u6062\u590D\uFF09";
    }
    return { success: false, error: errMsg, errors: result.errors };
  }
  await saveDNSConfig(env2, dnsName, targetDomain, zoneId);
  return result;
}

// src/shared/proxy/pipeline.js
var SENSITIVE_REQ_HEADERS = Object.freeze(["authorization", "cookie", "x-emby-token", "x-mediabrowser-token", "x-emby-authorization", "x-mediabrowser-authorization", "x-emby-api-key", "x-api-key"]);
var HOST_DOWN_MS = 3e4;
var LAST_PLAY_THROTTLE_MS = 6e4;
var API_TIMEOUT_MS = 15e3;
var FALLBACK_LOG_MS = 3e5;
function buildUpstreamHeaders(request, upstreamUrl, { ipMode, compatMode, crossOrigin = false }) {
  const headers = new Headers(request.headers);
  for (const name of (headers.get("Connection") || "").split(",")) {
    const token = name.trim();
    if (token) headers.delete(token);
  }
  for (const h of DROP_REQUEST_HEADERS)
    headers.delete(h);
  headers.delete("referer");
  const cookies = (headers.get("Cookie") || "").split(";").map((part) => part.trim()).filter((part) => part && !/^(?:admin_session|emby_preview_personal|emby_preview_multi)=/i.test(part));
  if (cookies.length) headers.set("Cookie", cookies.join("; "));
  else headers.delete("Cookie");
  if (crossOrigin)
    for (const h of SENSITIVE_REQ_HEADERS)
      headers.delete(h);
  headers.set("Host", upstreamUrl.host);
  if (ipMode === "forward") {
    const clientIp = request.headers.get("cf-connecting-ip");
    if (clientIp) {
      headers.set("x-forwarded-for", clientIp);
      headers.set("x-real-ip", clientIp);
    }
  } else if (ipMode === "disable") {
    stripClientIdentityHeaders(headers);
  }
  if (compatMode) {
    headers.set("Origin", upstreamUrl.origin);
    headers.set("X-Forwarded-Proto", upstreamUrl.protocol.replace(":", ""));
    headers.set("X-Forwarded-Host", upstreamUrl.host);
  }
  return headers;
}
function buildWebSocketHeaders(request, upstreamUrl, options) {
  const headers = buildUpstreamHeaders(request, upstreamUrl, options);
  headers.set("Upgrade", "websocket");
  headers.set("Connection", "Upgrade");
  return headers;
}
function progressKeyOf(request) {
  const u = new URL(request.url);
  const auth = request.headers.get("x-emby-authorization") || "";
  const dm = auth.match(/DeviceId="?([^",]+)/i);
  const device = u.searchParams.get("DeviceId") || request.headers.get("x-emby-device-id") || dm && dm[1] || "";
  const session = u.searchParams.get("PlaySessionId") || "";
  if (!device && !session) return null;
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  return JSON.stringify(["progress", u.host, u.pathname.split("/")[1] || "/", ip, device, session]);
}

// src/shared/proxy/budget.js
var MAX_UPSTREAM_ATTEMPTS = 3;
var MAX_OUTBOUND_REQUESTS = 9;
var TOTAL_HEADER_BUDGET_MS = 2e4;
var HEADER_TIMEOUT_MS = 1e4;
function createFetchBudget(request, {
  totalMs = TOTAL_HEADER_BUDGET_MS,
  headerMs = HEADER_TIMEOUT_MS,
  maxRequests = MAX_OUTBOUND_REQUESTS,
  clock = () => performance.now()
} = {}) {
  const deadline = clock() + totalMs;
  let requests = 0;
  return {
    get requests() {
      return requests;
    },
    async fetch(input, init) {
      request.signal.throwIfAborted();
      const remaining = deadline - clock();
      if (remaining <= 0 || requests >= maxRequests) throw new Error("Upstream request budget exhausted");
      requests++;
      const timeout = new AbortController();
      const original = input instanceof Request && !init ? input : new Request(input, init);
      const signal = AbortSignal.any([request.signal, original.signal, timeout.signal]);
      const timer = setTimeout(() => timeout.abort(new DOMException("Upstream header timeout", "TimeoutError")), Math.min(headerMs, remaining));
      try {
        return await fetch(new Request(original, { signal }));
      } finally {
        clearTimeout(timer);
      }
    }
  };
}

// src/shared/proxy/lifecycle.js
function discardResponse(response) {
  try {
    void response?.body?.cancel().catch(() => {
    });
  } catch {
  }
}
function upstreamSignal(request, timeoutMs = 0) {
  request.signal.throwIfAborted();
  return timeoutMs > 0 ? AbortSignal.any([request.signal, AbortSignal.timeout(timeoutMs)]) : request.signal;
}
function isRetryableMethod(request) {
  return request.method === "GET" || request.method === "HEAD";
}

// src/shared/proxy/redirects.js
var REDIRECT_STATUSES = /* @__PURE__ */ new Set([301, 302, 303, 307, 308]);
var MAX_REDIRECT_HOPS = 5;
async function followUpstreamRedirects(initialResponse, initialUrl, {
  request,
  bodyPlan,
  headersFor,
  signalFor,
  clientLocation = () => null,
  maxHops = MAX_REDIRECT_HOPS,
  fetcher = (...args) => fetch(...args)
}) {
  let response = initialResponse;
  let url = new URL(initialUrl);
  let method = request.method;
  let crossedOrigin = false;
  let hops = 0;
  const seen = /* @__PURE__ */ new Set([url.href]);
  try {
    while (REDIRECT_STATUSES.has(response.status) && response.headers.has("Location")) {
      const next = new URL(response.headers.get("Location"), url);
      if (!["http:", "https:"].includes(next.protocol) || next.username || next.password || isPrivateHost(next.hostname)) {
        throw new Error("Redirect target not allowed");
      }
      if (url.protocol === "https:" && next.protocol !== "https:") throw new Error("HTTPS downgrade not allowed");
      const location = clientLocation(next);
      if (location) {
        const headers2 = sanitizeResponseHeaders(response.headers);
        headers2.set("Location", location);
        headers2.set("Cache-Control", "no-store");
        return { response: new Response(response.body, { status: response.status, headers: headers2 }), url: next, hops, clientRedirect: true };
      }
      if (hops >= maxHops || seen.has(next.href)) throw new Error("Redirect loop or hop limit exceeded");
      seen.add(next.href);
      crossedOrigin ||= next.origin !== url.origin;
      if (response.status === 303 && method !== "HEAD" || [301, 302].includes(response.status) && method === "POST") method = "GET";
      if (method !== "GET" && method !== "HEAD" && !bodyPlan.replayable) throw new Error("Streaming request cannot follow redirect");
      const headers = headersFor(next, crossedOrigin);
      if (method === "GET" || method === "HEAD") {
        headers.delete("Content-Length");
        headers.delete("Content-Type");
        headers.delete("Transfer-Encoding");
      }
      const init = { method, headers, redirect: "manual", signal: signalFor() };
      if (method !== "GET" && method !== "HEAD") bodyPlan.apply(init);
      discardResponse(response);
      response = null;
      url = next;
      hops++;
      response = await fetcher(new Request(url.href, init));
    }
    return { response, url, hops, clientRedirect: false };
  } catch (error) {
    discardResponse(response);
    throw error;
  }
}

// src/shared/observability/diagnostics.js
async function diagnoseRoute(route, request, { edition, relayConfigured = false } = {}) {
  const targets = splitTargets(route.target);
  const custom = parseHeaderLines(route.custom_headers).headers;
  const budget = createFetchBudget(request, { totalMs: 8e3, headerMs: 4e3, maxRequests: 9 });
  const mode = edition === "personal" ? route.use_relay === "image" ? "auto" : route.use_relay || "off" : relayConfigured ? "fallback" : "off";
  const results = [];
  for (const [index, target] of targets.slice(0, 3).entries()) {
    const start = performance.now();
    let response;
    try {
      const url = new URL(target);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("Invalid configured target");
      const headersFor = (next, crossOrigin) => {
        const headers = new Headers(custom);
        if (crossOrigin) for (const name of SENSITIVE_REQ_HEADERS) headers.delete(name);
        headers.set("User-Agent", "Emby-Route-Diagnostics");
        return headers;
      };
      const base = url.pathname.replace(/\/+$/, "");
      const paths = ["/System/Info/Public"];
      if (!/\/emby$/i.test(base)) paths.push("/emby/System/Info/Public");
      const getRequest = new Request(request.url, { signal: request.signal });
      for (const [attempt, path] of paths.entries()) {
        url.pathname = base + path;
        const probeStart = performance.now();
        response = await budget.fetch(new Request(url.href, { headers: headersFor(url, false), redirect: "manual" }));
        const followed = await followUpstreamRedirects(response, url, {
          request: getRequest,
          headersFor,
          signalFor: () => request.signal,
          fetcher: (next) => budget.fetch(next),
          maxHops: 2
        });
        response = followed.response;
        const status = response.status;
        const headerMs = Math.round(performance.now() - probeStart);
        if ((status === 404 || status === 405) && attempt + 1 < paths.length) {
          discardResponse(response);
          response = null;
          continue;
        }
        const info = response.ok ? await readJson(response, { limit: 32 * 1024, timeoutMs: 1e3 }) : null;
        const ok = typeof info?.Id === "string" && !!info.Id && typeof info.Version === "string" && !!info.Version;
        const stage = ok ? "verified" : status === 404 || status === 405 ? "endpoint-unavailable" : status === 401 || status === 403 ? "authentication" : status >= 500 ? "upstream" : response.ok ? "unexpected-response" : "http-error";
        results.push({ target: index + 1, ok, status, headerMs, redirects: followed.hops, stage });
        break;
      }
    } catch {
      results.push({ target: index + 1, ok: false, status: 0, headerMs: Math.round(performance.now() - start), stage: request.signal.aborted ? "cancelled" : "connection-or-redirect" });
    } finally {
      discardResponse(response);
    }
  }
  return {
    success: true,
    prefix: route.prefix,
    enabled: route.enabled !== 0,
    policy: {
      edition,
      media: mode === "on" ? "vps" : "worker",
      relay: mode,
      relayConfigured,
      privateCache: "bypass",
      retries: "GET/HEAD only",
      targetLimit: 3,
      redirectLimit: 5
    },
    results,
    omittedTargets: Math.max(0, targets.length - 3),
    notice: "\u53EA\u9A8C\u8BC1 Worker \u76F4\u8FDE\u6E90\u7AD9\u7684 Emby/Jellyfin \u516C\u5F00 API\u3002\u8017\u65F6\u4E0D\u662F\u5BA2\u6237\u7AEF RTT\uFF1B\u672A\u6D4B\u8BD5\u767B\u5F55\u3001\u64AD\u653E\u3001VPS \u6216\u7F51\u76D8\u76F4\u94FE\u3002"
  };
}

// src/shared/admin/import-plan.js
function inspectImport(data, currentPrefixes, settingKeys) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return { success: false, error: "\u914D\u7F6E\u5FC5\u987B\u662F JSON \u5BF9\u8C61" };
  if (data.routes !== void 0 && !Array.isArray(data.routes)) return { success: false, error: "routes \u5FC5\u987B\u662F\u6570\u7EC4" };
  const routes = data.routes || [];
  if (routes.length > 1e3) return { success: false, error: "\u5355\u6B21\u5BFC\u5165\u6700\u591A 1000 \u6761\u7EBF\u8DEF\uFF0C\u8BF7\u5206\u6279\u5BFC\u5165" };
  const current = new Set(currentPrefixes);
  if (data.settings?.domain_proxy_rules) {
    try {
      const rules = JSON.parse(data.settings.domain_proxy_rules);
      if (!rules || typeof rules !== "object" || Array.isArray(rules)) throw new Error("Invalid rules");
    } catch {
      return { success: false, error: "\u57DF\u540D\u6620\u5C04\u89C4\u5219\u5FC5\u987B\u662F\u5408\u6CD5 JSON \u5BF9\u8C61" };
    }
  }
  const seen = /* @__PURE__ */ new Set();
  const added = [], overwritten = [], invalid = [];
  for (const route of routes) {
    const prefix = normalizePrefix(route?.prefix);
    const targets = splitTargets(route?.target);
    const streams = splitTargets(route?.stream_target);
    const valid = !validatePrefix(prefix) && targets.length && targets.every(isValidHttpUrl) && streams.every(isValidHttpUrl) && !parseHeaderLines(route?.custom_headers).error && validIpList(parseIpList(route?.ip_allow)) && validIpList(parseIpList(route?.ip_block));
    if (!valid || seen.has(prefix)) invalid.push({ prefix: prefix.slice(0, 64), reason: seen.has(prefix) ? "\u91CD\u590D\u8DEF\u5F84" : "\u8DEF\u5F84\u3001\u76EE\u6807\u6216\u9AD8\u7EA7\u89C4\u5219\u65E0\u6548" });
    else (current.has(prefix) ? overwritten : added).push(prefix);
    seen.add(prefix);
  }
  return {
    success: true,
    canImport: invalid.length === 0,
    added,
    overwritten,
    invalid,
    domainEntries: Array.isArray(data.domains) ? data.domains.length : 0,
    settings: data.settings && typeof data.settings === "object" ? Object.keys(data.settings).filter((key) => settingKeys.includes(key)) : [],
    notice: "\u53EA\u8BFB\u9884\u68C0\uFF0C\u4E0D\u5199\u6570\u636E\u5E93\u3001\u4E0D\u4FEE\u6539 DNS\u3002\u57DF\u540D\u6761\u76EE\u4ECD\u7531\u5BFC\u5165\u7AEF\u8FDB\u884C\u6700\u7EC8\u6821\u9A8C\uFF1B\u914D\u7F6E\u503C\u4E0E\u5BC6\u94A5\u4E0D\u5728\u9884\u68C0\u7ED3\u679C\u4E2D\u56DE\u663E\u3002"
  };
}

// src/editions/personal/admin/api.js
async function handleAdminApi(request, env2, url) {
  if (!await isAdmin(request, env2))
    return new Response("Unauthorized", { status: 401 });
  if (request.method !== "GET" && request.method !== "HEAD") {
    const origin = request.headers.get("Origin");
    if (origin && origin !== url.origin)
      return json({ error: "Forbidden origin" }, 403);
  }
  if (url.pathname === "/admin/api/logout" && request.method === "POST")
    return logoutResponse();
  if (["/admin/api/notifications", "/admin/api/notifications/test", "/admin/api/security/password"].includes(url.pathname)) {
    if (request.method === "POST" && (request.headers.get("Origin") !== url.origin || !request.headers.get("Content-Type")?.startsWith("application/json")))
      return json({ error: "\u5FC5\u987B\u4F7F\u7528\u540C\u6E90 JSON \u8BF7\u6C42" }, 403);
    if (url.pathname === "/admin/api/notifications") {
      if (request.method === "GET") return json({ success: true, ...await notificationStatus(env2) });
      if (request.method === "POST") {
        const data = await readJson(request);
        if (!data) return json({ error: "\u65E0\u6548 JSON" }, 400);
        try {
          await saveTelegramConfig(env2, data);
        } catch {
          return json({ error: "\u4FDD\u5B58\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5 Token\u3001\u6570\u5B57 Chat ID \u53CA SETTINGS_ENCRYPTION_KEY \u4E3B\u5BC6\u94A5" }, 400);
        }
        await auditLog(env2, "notification.save", data.clear === true ? "disabled" : "updated");
        return json({ success: true, ...await notificationStatus(env2) });
      }
    }
    if (url.pathname === "/admin/api/notifications/test" && request.method === "POST") {
      const out = await testTelegram(env2);
      await auditLog(env2, "notification.test", out.ok ? "ok" : "failed");
      return json(out, out.ok ? 200 : 502);
    }
    if (url.pathname === "/admin/api/security/password") {
      if (request.method === "GET") return json({ success: true, customPassword: Boolean((await credentialState(env2)).record) });
      if (request.method === "POST") {
        const ip = request.headers.get("cf-connecting-ip") || "unknown";
        if (loginBlocked(ip)) return json({ error: "\u5C1D\u8BD5\u6B21\u6570\u8FC7\u591A\uFF0C\u8BF7 10 \u5206\u949F\u540E\u518D\u8BD5" }, 429);
        const data = await readJson(request);
        if (!data || data.newPassword !== data.confirmPassword) return json({ error: "\u4E24\u6B21\u65B0\u5BC6\u7801\u4E0D\u4E00\u81F4" }, 400);
        const out = await changePassword(env2, data.currentPassword, data.newPassword);
        if (!out.ok) {
          if (out.status === 403) loginFailed(ip);
          return json({ error: out.error }, out.status);
        }
        loginFails.delete(ip);
        await auditLog(env2, "security.password", "changed; sessions revoked");
        return logoutResponse();
      }
    }
    return json({ error: "Method not allowed" }, 405);
  }
  if (url.pathname === "/admin/api/report/send" && request.method === "POST") {
    const out = await sendDailyReport(env2, url.searchParams.get("date") || "");
    await auditLog(env2, "report.send", out.ok ? "ok" : "fail: " + (out.telegram.rawError || out.telegram.error || out.webhook.error || "unknown"));
    return json({
      success: out.ok,
      date: out.date,
      telegram: out.telegram,
      webhook: out.webhook,
      preview: out.text,
      hint: out.ok ? "" : "\u53D1\u9001\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u901A\u77E5\u914D\u7F6E\u548C\u53D1\u9001\u6743\u9650"
    }, out.ok ? 200 : 502);
  }
  if (url.pathname === "/admin/api/stats" && request.method === "GET") {
    return handleStatsRequest(env2, url);
  }
  if (url.pathname === "/admin/api/settings") {
    if (request.method === "GET") {
      const st = await getSettings(env2);
      return json({
        success: true,
        settings: st.raw,
        notify: await notificationStatus(env2)
      });
    }
    if (request.method === "POST") {
      const data = await readJson(request) || {};
      if (data.domain_proxy_rules) {
        try {
          const o = JSON.parse(data.domain_proxy_rules);
          if (!o || typeof o !== "object" || Array.isArray(o))
            throw 0;
        } catch {
          return json({ error: '\u57DF\u540D\u6620\u5C04\u89C4\u5219\u5FC5\u987B\u662F JSON \u5BF9\u8C61\uFF0C\u4F8B\u5982 {"example.com":"1.2.3.4"}' }, 400);
        }
      }
      for (const k of SETTING_KEYS)
        if (k in data)
          await setSetting(env2, k, data[k] ?? "");
      await auditLog(env2, "settings", Object.keys(data).filter((k) => SETTING_KEYS.includes(k)).join(","));
      return json({ success: true });
    }
  }
  if (url.pathname === "/admin/api/audit" && request.method === "GET") {
    const { results } = await env2.DB.prepare("SELECT ts, action, detail FROM audit_log ORDER BY id DESC LIMIT 100").all();
    return json({ success: true, logs: results || [] });
  }
  if (url.pathname === "/admin/api/export" && request.method === "GET") {
    const routes = (await env2.DB.prepare("SELECT prefix, target, remark, cache_img, compat_mode, ip_mode, use_relay, sort_order, enabled, custom_headers, ip_allow, ip_block FROM routes ORDER BY sort_order, prefix").all()).results || [];
    const domains = (await env2.DB.prepare("SELECT domain, name FROM optimized_domains WHERE is_builtin = 0").all()).results || [];
    const st = await getSettings(env2);
    const body = JSON.stringify({ version: CURRENT_VERSION, exportedAt: (/* @__PURE__ */ new Date()).toISOString(), routes, domains, settings: st.raw }, null, 2);
    return new Response(body, { headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="proxy-config-' + (/* @__PURE__ */ new Date()).toISOString().slice(0, 10) + '.json"',
      "Cache-Control": "no-store"
    } });
  }
  if (url.pathname === "/admin/api/import/preview" && request.method === "POST") {
    const data = await readJson(request);
    const existing = (await env2.DB.prepare("SELECT prefix FROM routes").all()).results || [];
    const plan = inspectImport(data, existing.map((route) => route.prefix), SETTING_KEYS);
    return json(plan, plan.success ? 200 : 400);
  }
  if (url.pathname === "/admin/api/import" && request.method === "POST") {
    const data = await readJson(request);
    if (!data || typeof data !== "object")
      return json({ error: "\u4E0D\u662F\u5408\u6CD5\u7684\u914D\u7F6E JSON" }, 400);
    const stmts = [];
    let nr = 0, nd = 0;
    const skipped = [];
    for (const r of Array.isArray(data.routes) ? data.routes : []) {
      const err = validatePrefix(r?.prefix);
      const targets = splitTargets(r?.target);
      if (err || !targets.length || !targets.every(isValidHttpUrl) || parseHeaderLines(r.custom_headers).error || !validIpList(parseIpList(r.ip_allow)) || !validIpList(parseIpList(r.ip_block))) {
        skipped.push(String(r?.prefix || "?"));
        continue;
      }
      stmts.push(env2.DB.prepare(`INSERT OR REPLACE INTO routes (prefix, target, remark, cache_img, compat_mode, ip_mode, use_relay, last_play, sort_order, enabled, custom_headers, ip_allow, ip_block)
         VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, (SELECT use_relay FROM routes WHERE prefix = ?), 'auto'), COALESCE((SELECT last_play FROM routes WHERE prefix = ?), ''), ?, ?, ?, ?, ?)`).bind(normalizePrefix(r.prefix), targets.join(","), String(r.remark || ""), r.cache_img === "off" ? "off" : "on", r.compat_mode === "on" ? "on" : "off", normalizeIpMode(r.ip_mode), normalizeRelayMode(r.use_relay, null), normalizePrefix(r.prefix), normalizePrefix(r.prefix), Number(r.sort_order) || 0, r.enabled === 0 ? 0 : 1, String(r.custom_headers || ""), String(r.ip_allow || ""), String(r.ip_block || "")));
      nr++;
    }
    for (const d of Array.isArray(data.domains) ? data.domains : []) {
      const domain2 = normalizeDomain(d?.domain);
      const name = String(d?.name || "").trim();
      if (!domain2 || !name)
        continue;
      stmts.push(env2.DB.prepare("INSERT OR IGNORE INTO optimized_domains (domain, name, is_builtin) VALUES (?, ?, 0)").bind(domain2, name));
      nd++;
    }
    if (data.settings && typeof data.settings === "object") {
      for (const k of SETTING_KEYS)
        if (k in data.settings) {
          stmts.push(env2.DB.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(k, String(data.settings[k] ?? "")));
        }
    }
    if (stmts.length)
      await env2.DB.batch(stmts);
    clearRouteCache();
    invalidateSettingsCache();
    invalidateRelayCache();
    await auditLog(env2, "import", `routes=${nr} domains=${nd} skipped=${skipped.length}`);
    return json({ success: true, routes: nr, domains: nd, skipped });
  }
  if (url.pathname === "/admin/api/routes/toggle" && request.method === "POST") {
    const data = await readJson(request) || {};
    const prefix = normalizePrefix(data.prefix);
    if (!prefix)
      return json({ error: "\u7F3A\u5C11 prefix" }, 400);
    await env2.DB.prepare("UPDATE routes SET enabled = ? WHERE prefix = ?").bind(data.enabled ? 1 : 0, prefix).run();
    clearRouteCache();
    await auditLog(env2, data.enabled ? "route.enable" : "route.disable", "/" + prefix);
    return json({ success: true });
  }
  if (url.pathname === "/admin/api/routes/reorder" && request.method === "POST") {
    const data = await readJson(request) || {};
    const order = Array.isArray(data.order) ? data.order.map(normalizePrefix).filter(Boolean) : [];
    if (!order.length)
      return json({ error: "\u7F3A\u5C11 order" }, 400);
    await env2.DB.batch(order.map((pf, i) => env2.DB.prepare("UPDATE routes SET sort_order = ? WHERE prefix = ?").bind(i, pf)));
    return json({ success: true });
  }
  if (url.pathname === "/admin/api/routes/test" && request.method === "POST") {
    const data = await readJson(request) || {};
    const route = await env2.DB.prepare("SELECT target FROM routes WHERE prefix = ?").bind(normalizePrefix(data.prefix)).first();
    if (!route)
      return json({ error: "\u8DEF\u7531\u4E0D\u5B58\u5728" }, 404);
    const targets = splitTargets(route.target);
    const results = await Promise.all(targets.map(async (t) => ({ target: t, ...await probeTarget(t) })));
    return json({ success: true, results });
  }
  if (url.pathname === "/admin/api/routes/diagnose" && request.method === "POST") {
    const data = await readJson(request) || {};
    const route = await env2.DB.prepare("SELECT * FROM routes WHERE prefix = ?").bind(normalizePrefix(data.prefix)).first();
    if (!route) return json({ error: "\u8DEF\u7531\u4E0D\u5B58\u5728" }, 404);
    const relay = await getRelayConfig(env2);
    return json(await diagnoseRoute(route, request, { edition: "personal", relayConfigured: !!(relay?.enabled && relay?.secret) }));
  }
  if (url.pathname === "/admin/api/health/run" && request.method === "POST") {
    const out = await runHealthCheck(env2, true);
    return json({ success: true, ...out });
  }
  if (url.pathname === "/admin/api/routes") {
    if (request.method === "GET") {
      const { results } = await env2.DB.prepare(`SELECT * FROM routes ORDER BY sort_order, prefix`).all();
      let health = [];
      try {
        health = (await env2.DB.prepare("SELECT prefix, down FROM route_health").all()).results || [];
      } catch (_) {
      }
      const downMap = {};
      for (const h of health)
        if (h.down)
          downMap[h.prefix] = (downMap[h.prefix] || 0) + 1;
      return json(await Promise.all((results || []).map(async (r) => ({ ...r, notification_id: await notificationId(env2, r.prefix), down_count: downMap[r.prefix] || 0 }))));
    }
    if (request.method === "POST") {
      const data = await readJson(request);
      if (!data)
        return json({ error: "\u8BF7\u6C42\u4F53\u4E0D\u662F\u5408\u6CD5 JSON" }, 400);
      const err = validatePrefix(data.prefix);
      if (err)
        return json({ error: err }, 400);
      const prefix = normalizePrefix(data.prefix);
      const oldPrefix = data.oldPrefix ? normalizePrefix(data.oldPrefix) : "";
      const targets = splitTargets(data.target);
      if (!targets.length)
        return json({ error: "\u8BF7\u81F3\u5C11\u586B\u5199\u4E00\u4E2A\u76EE\u6807\u5730\u5740" }, 400);
      const badTarget = targets.find((t) => !isValidHttpUrl(t));
      if (badTarget)
        return json({ error: "\u76EE\u6807\u5730\u5740\u5FC5\u987B\u662F http(s):// \u5F00\u5934\u7684\u5408\u6CD5 URL\uFF1A" + badTarget }, 400);
      const hdrCheck = parseHeaderLines(data.custom_headers);
      if (hdrCheck.error)
        return json({ error: hdrCheck.error }, 400);
      const allowList = parseIpList(data.ip_allow);
      const blockList = parseIpList(data.ip_block);
      if (!validIpList(allowList) || !validIpList(blockList))
        return json({ error: "IP \u9ED1\u767D\u540D\u5355\u683C\u5F0F\u4E0D\u5408\u6CD5\uFF08\u652F\u6301 IPv4\u3001IPv6 \u548C IPv4 CIDR\uFF0C\u7528\u9017\u53F7\u6216\u7A7A\u683C\u5206\u9694\uFF09" }, 400);
      const isRename = oldPrefix && oldPrefix !== prefix;
      const existing = await env2.DB.prepare("SELECT sort_order, last_play, enabled, use_relay FROM routes WHERE prefix = ?").bind(isRename ? oldPrefix : prefix).first();
      if (isRename) {
        const clash = await env2.DB.prepare("SELECT 1 AS x FROM routes WHERE prefix = ?").bind(prefix).first();
        if (clash)
          return json({ error: "\u8DEF\u5F84 /" + prefix + " \u5DF2\u5B58\u5728" }, 409);
      } else if (!oldPrefix && existing) {
        return json({ error: "\u8DEF\u5F84 /" + prefix + " \u5DF2\u5B58\u5728\uFF0C\u8BF7\u76F4\u63A5\u7F16\u8F91\u5B83" }, 409);
      }
      const insert = env2.DB.prepare("INSERT OR REPLACE INTO routes (prefix, target, remark, cache_img, compat_mode, ip_mode, use_relay, last_play, sort_order, enabled, custom_headers, ip_allow, ip_block) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(prefix, targets.join(","), data.remark || "", data.cache_img === "off" ? "off" : "on", data.compat_mode === "on" ? "on" : "off", normalizeIpMode(data.ip_mode), normalizeRelayMode(data.use_relay, normalizeRelayMode(existing?.use_relay)), existing?.last_play || "", existing?.sort_order || 0, existing?.enabled === 0 ? 0 : 1, String(data.custom_headers || "").trim(), allowList.join(","), blockList.join(","));
      if (isRename)
        await env2.DB.batch([insert, env2.DB.prepare("DELETE FROM routes WHERE prefix = ?").bind(oldPrefix)]);
      else
        await insert.run();
      clearRouteCache();
      await auditLog(env2, isRename ? "route.rename" : "route.save", "/" + (isRename ? oldPrefix + " \u2192 /" : "") + prefix);
      return json({ success: true });
    }
    if (request.method === "DELETE") {
      const prefix = url.searchParams.get("prefix");
      if (!prefix)
        return json({ error: "\u7F3A\u5C11 prefix \u53C2\u6570" }, 400);
      await env2.DB.prepare("DELETE FROM routes WHERE prefix = ?").bind(normalizePrefix(prefix)).run();
      clearRouteCache();
      try {
        await env2.DB.prepare("DELETE FROM route_health WHERE prefix = ?").bind(normalizePrefix(prefix)).run();
      } catch (_) {
      }
      await auditLog(env2, "route.delete", "/" + normalizePrefix(prefix));
      return json({ success: true });
    }
  }
  if (url.pathname === "/admin/api/optimized-domains") {
    if (request.method === "GET") {
      const domains = await getOptimizedDomains(env2);
      return json({ success: true, domains });
    }
    if (request.method === "POST") {
      const data = await readJson(request);
      const domain2 = normalizeDomain(data?.domain);
      const name = String(data?.name || "").trim();
      if (!domain2 || !name)
        return json({ success: false, error: "\u57DF\u540D\u6216\u540D\u79F0\u4E0D\u5408\u6CD5" }, 400);
      try {
        const success = await addOptimizedDomain(env2, domain2, name);
        await auditLog(env2, "domain.add", domain2);
        return json({ success });
      } catch (e) {
        if (/UNIQUE/i.test(String(e?.message)))
          return json({ success: false, error: "\u8BE5\u57DF\u540D\u5DF2\u5B58\u5728" }, 409);
        return json({ success: false, error: "\u4FDD\u5B58\u5931\u8D25" }, 500);
      }
    }
  }
  if (url.pathname.startsWith("/admin/api/optimized-domains/")) {
    const id = parseInt(url.pathname.split("/").pop(), 10);
    if (!Number.isFinite(id))
      return json({ success: false, error: "id \u4E0D\u5408\u6CD5" }, 400);
    if (request.method === "PUT") {
      const data = await readJson(request);
      const domain2 = normalizeDomain(data?.domain);
      const name = String(data?.name || "").trim();
      if (!domain2 || !name)
        return json({ success: false, error: "\u57DF\u540D\u6216\u540D\u79F0\u4E0D\u5408\u6CD5" }, 400);
      try {
        const success = await updateOptimizedDomain(env2, id, domain2, name);
        if (!success)
          return json({ success: false, error: "\u5185\u7F6E\u57DF\u540D\u4E0D\u53EF\u4FEE\u6539\uFF0C\u6216\u8BE5\u8BB0\u5F55\u4E0D\u5B58\u5728" }, 403);
        return json({ success });
      } catch (e) {
        if (/UNIQUE/i.test(String(e?.message)))
          return json({ success: false, error: "\u8BE5\u57DF\u540D\u5DF2\u5B58\u5728" }, 409);
        return json({ success: false, error: "\u4FDD\u5B58\u5931\u8D25" }, 500);
      }
    }
    if (request.method === "DELETE") {
      const success = await deleteOptimizedDomain(env2, id);
      if (!success)
        return json({ success: false, error: "\u5185\u7F6E\u57DF\u540D\u4E0D\u53EF\u5220\u9664\uFF0C\u6216\u8BE5\u8BB0\u5F55\u4E0D\u5B58\u5728" }, 403);
      await auditLog(env2, "domain.delete", "id=" + id);
      return json({ success });
    }
  }
  if (url.pathname === "/admin/api/dns-config") {
    if (request.method === "GET") {
      const config2 = await getDNSConfig(env2);
      const zoneInfo = await resolveZoneInfo(env2);
      const baseDomain = getBaseDomain(env2);
      const resolvedName = config2 && config2.dnsName || getDnsRecordName(env2);
      const targetName = toFqdn(resolvedName, baseDomain);
      const candidates = [];
      const accessHost = String(url.hostname || "").toLowerCase();
      if (accessHost)
        candidates.push(accessHost);
      if (targetName && !candidates.includes(targetName))
        candidates.push(targetName);
      let zones = [];
      let zonesError = null;
      let zoneId = zoneInfo.zoneId || config2 && config2.zoneId || "";
      if (!zoneId) {
        zonesError = zoneInfo.error || "\u672A\u89E3\u6790\u5230 Zone ID";
        const zr = await getZones(env2);
        if (zr.success && Array.isArray(zr.result)) {
          zones = zr.result;
          if (zones[0])
            zoneId = zones[0].id;
        } else {
          zonesError = zr.errors?.[0]?.message || zr.error || "\u83B7\u53D6\u533A\u57DF\u5217\u8868\u5931\u8D25";
        }
      }
      let liveRecord = null;
      if (zoneId) {
        try {
          const rr = await getDNSRecords(env2, zoneId);
          if (rr.success && Array.isArray(rr.result)) {
            for (const name of candidates) {
              const rec = rr.result.find((r) => ["A", "AAAA", "CNAME"].includes(r.type) && r.name === name);
              if (rec) {
                liveRecord = { type: rec.type, name: rec.name, content: rec.content, proxied: rec.proxied, modifiedOn: rec.modified_on, zoneId };
                break;
              }
            }
          } else if (!zonesError) {
            zonesError = rr.errors?.[0]?.message || rr.error || "\u8BFB\u53D6 DNS \u8BB0\u5F55\u5931\u8D25";
          }
        } catch (e) {
          zonesError = zonesError || String(e?.message || e);
        }
      }
      return json({
        success: true,
        config: config2,
        zones,
        zonesError,
        liveRecord,
        zoneId,
        baseDomain,
        resolvedName,
        targetName,
        statsHost: getStatsHost(env2)
      });
    }
    if (request.method === "POST") {
      const data = await readJson(request) || {};
      const success = await saveDNSConfig(env2, data.dnsName, data.currentDomain || "", data.zoneId || "");
      return json({ success });
    }
  }
  if (url.pathname === "/admin/api/dns/replace" && request.method === "POST") {
    const data = await readJson(request) || {};
    let { zoneId, dnsName, targetDomain } = data;
    const baseDomain = getBaseDomain(env2);
    const nameInput = String(dnsName || "").trim() || getDnsRecordName(env2);
    const targets = splitTargets(targetDomain).map(normalizeDnsTarget).filter(Boolean);
    if (!nameInput || !targets.length)
      return json({ success: false, error: "\u7F3A\u5C11\u5FC5\u8981\u53C2\u6570\uFF08\u8BB0\u5F55\u540D / \u76EE\u6807\uFF09" }, 400);
    if (!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(targets[0]) && !targets[0].includes(":") && !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(targets[0])) {
      return json({ success: false, error: "\u76EE\u6807\u5FC5\u987B\u662F\u5408\u6CD5\u57DF\u540D\u3001IPv4 \u6216 IPv6" }, 400);
    }
    if (!zoneId) {
      const info3 = await resolveZoneInfo(env2);
      zoneId = info3.zoneId;
      if (!zoneId)
        return json({ success: false, error: info3.error || "\u672A\u89E3\u6790\u5230 Zone ID\uFF0C\u8BF7\u68C0\u67E5 CF_API_TOKEN \u6743\u9650" }, 400);
    }
    const result = await createOrUpdateDNSRecord(env2, zoneId, nameInput, targets[0], baseDomain);
    if (result.success && result.result) {
      await saveDNSConfig(env2, nameInput, targets[0], zoneId);
      invalidateZoneInfoCache();
      await auditLog(env2, "dns.replace", `${result.result.name} \u2192 ${result.result.content}`);
      return json({ success: true, result: result.result });
    }
    return json({ success: false, error: result.error || result.errors?.[0]?.message || "DNS \u66FF\u6362\u5931\u8D25", errors: result.errors });
  }
  if (url.pathname === "/admin/api/relay" && (request.method === "GET" || request.method === "POST")) {
    if (request.method === "GET") {
      const c = await getRelayConfig(env2);
      return json({
        success: true,
        config: {
          relayUrl: c.relayUrl,
          port: c.port,
          secret: c.secret ? "\u25CF\u25CF\u25CF\u25CF\u25CF\u25CF\u25CF\u25CF" : "",
          hasSecret: !!c.secret,
          hasCert: !!(c.certPem && c.keyPem),
          enabled: c.enabled,
          updatedAt: c.updatedAt
        }
      });
    }
    if (request.method === "POST") {
      if (!env2.DB)
        return json({ error: "DB \u672A\u7ED1\u5B9A" }, 500);
      const data = await readJson(request);
      if (!data)
        return json({ error: "\u8BF7\u6C42\u4F53\u4E0D\u662F\u5408\u6CD5 JSON" }, 400);
      const cur = await getRelayConfig(env2);
      const relayUrl = normalizeRelayBase(data.relayUrl ?? cur.relayUrl);
      const secret = data.secret && data.secret !== "\u25CF\u25CF\u25CF\u25CF\u25CF\u25CF\u25CF\u25CF" ? String(data.secret).trim() : cur.secret;
      const certPem = data.certPem !== void 0 ? String(data.certPem).trim() : cur.certPem;
      const keyPem = data.keyPem !== void 0 ? String(data.keyPem).trim() : cur.keyPem;
      const enabled = data.enabled === "on" || data.enabled === true ? "on" : "off";
      const nowIso = (/* @__PURE__ */ new Date()).toISOString();
      try {
        await env2.DB.batch([
          env2.DB.prepare("DELETE FROM relay_config WHERE id = 1"),
          env2.DB.prepare("INSERT INTO relay_config (id, relay_url, secret, cert_pem, key_pem, enabled, updated_at) VALUES (1, ?, ?, ?, ?, ?, ?)").bind(relayUrl, secret, certPem, keyPem, enabled, nowIso)
        ]);
        await auditLog(env2, "relay.save", relayUrl + (enabled ? " (\u542F\u7528)" : " (\u505C\u7528)"));
        invalidateRelayCache();
      } catch (e) {
        return json({ error: "\u4FDD\u5B58\u5931\u8D25: " + String(e?.message || e).slice(0, 150) }, 500);
      }
      const push = { vpsStatus: 0, vpsBody: "", vpsError: "" };
      if (data.pushToVps !== false && relayUrl && secret) {
        const bodyJson = JSON.stringify({
          secret,
          port: relayPortFrom(relayUrl),
          cert_pem: certPem,
          key_pem: keyPem,
          restart: Boolean(certPem && keyPem)
        });
        const tryKeys = [cur.secret, secret].filter((v, i, a) => v && a.indexOf(v) === i);
        for (const k of tryKeys) {
          try {
            const res = await fetch(new Request(relayUrl + "/_relay/config", {
              method: "POST",
              headers: { "Content-Type": "application/json", "X-Relay-Key": k },
              body: bodyJson
            }));
            push.vpsStatus = res.status;
            push.vpsBody = (await res.text()).slice(0, 200);
            if (res.status >= 200 && res.status < 300)
              break;
          } catch (e) {
            push.vpsStatus = 0;
            push.vpsBody = "";
            push.vpsError = String(e?.message || e).slice(0, 200);
          }
        }
      }
      return json({ success: true, ...push });
    }
  }
  if (url.pathname === "/admin/api/relay/test" && request.method === "POST") {
    const c = await getRelayConfig(env2);
    if (!c.relayUrl || !c.secret)
      return json({ ok: false, error: "\u8BF7\u5148\u586B\u5199\u4E2D\u7EE7\u5730\u5740\u548C\u5BC6\u94A5" });
    const t0 = Date.now();
    try {
      const res = await fetch(new Request(c.relayUrl + "/_relay/health", { headers: { "X-Relay-Key": c.secret }, signal: AbortSignal.timeout(8e3) }));
      const body = await readJson(res, { limit: 16384, timeoutMs: 5e3 });
      const ok = res.ok && body?.ok === true;
      return json({
        ok,
        status: res.status,
        ms: Date.now() - t0,
        version: typeof body?.version === "string" ? body.version.slice(0, 80) : "",
        tls: body?.tls === true,
        ...ok ? {} : { error: "\u4E2D\u7EE7\u672A\u8FD4\u56DE\u6709\u6548\u5065\u5EB7\u72B6\u6001\uFF0C\u8BF7\u68C0\u67E5\u670D\u52A1\u4E0E\u9274\u6743" }
      });
    } catch (e) {
      return json({ ok: false, ms: Date.now() - t0, error: "\u4E2D\u7EE7\u8FDE\u63A5\u5931\u8D25\u6216\u8D85\u65F6\uFF0C\u8BF7\u68C0\u67E5\u670D\u52A1\u3001\u8BC1\u4E66\u4E0E\u7F51\u7EDC" });
    }
  }
  if (url.pathname === "/admin/api/relay/stats" && request.method === "GET") {
    const c = await getRelayConfig(env2);
    if (!c.relayUrl || !c.secret)
      return json({ ok: false, error: "\u672A\u914D\u7F6E\u4E2D\u7EE7" });
    try {
      const res = await fetch(new Request(c.relayUrl + "/_relay/stats", { headers: { "X-Relay-Key": c.secret }, signal: AbortSignal.timeout(8e3) }));
      const text = await res.text();
      let body = null;
      try {
        body = JSON.parse(text);
      } catch (_) {
      }
      if (!res.ok || !body?.ok)
        return json({ ok: false, status: res.status, error: body && JSON.stringify(body).slice(0, 120) || "HTTP " + res.status });
      return json({ ok: true, ...body });
    } catch (e) {
      return json({ ok: false, error: String(e?.message || e).slice(0, 160) });
    }
  }
  return json({ error: "Not found" }, 404);
}

// src/editions/personal/proxy/state.js
var hostDownUntil = /* @__PURE__ */ new Map();
var relayPreferences = /* @__PURE__ */ new Map();
var lastPlayTouched = /* @__PURE__ */ new Map();
var fallbackLogAt = /* @__PURE__ */ new Map();
function fallbackLogThrottled(key) {
  const now = Date.now();
  if (now - (fallbackLogAt.get(key) || 0) < FALLBACK_LOG_MS)
    return true;
  fallbackLogAt.set(key, now);
  if (fallbackLogAt.size > 500) {
    for (const [k, v] of fallbackLogAt) {
      if (now - v < FALLBACK_LOG_MS)
        continue;
      fallbackLogAt.delete(k);
      if (fallbackLogAt.size <= 250)
        break;
    }
  }
  return false;
}
var CONFIG = {
  enableStats: true
};
var progressMap = /* @__PURE__ */ new Map();
var rateMap = /* @__PURE__ */ new Map();
function rateLimited(ip, limit) {
  if (!limit)
    return false;
  const now = Date.now();
  const rec = rateMap.get(ip);
  if (!rec || now - rec.start > 6e4) {
    rateMap.set(ip, { start: now, n: 1 });
  } else {
    rec.n++;
    if (rec.n > limit)
      return true;
  }
  if (rateMap.size > 2e4) {
    for (const [k, v] of rateMap)
      if (now - v.start > 6e4)
        rateMap.delete(k);
  }
  return false;
}

// src/shared/rules/netdisk.js
var MANUAL_REDIRECT_DOMAINS = [
  "emby.bangumi.ca",
  "aliyundrive.com",
  "aliyundrive.net",
  "alipan.com",
  "aliyuncs.com",
  "alicdn.com",
  "aliyun.com",
  "cdn.aliyundrive.com",
  "xunlei.com",
  "xlusercdn.com",
  "xycdn.com",
  "sandai.net",
  "thundercdn.com",
  "115.com",
  "115cdn.com",
  "115cdn.net",
  "anxia.com",
  "189.cn",
  "mini189.cn",
  "ctyunxs.cn",
  "cloud.189.cn",
  "tianyiyun.com",
  "telecomjs.com",
  "quark.cn",
  "quarkdrive.cn",
  "uc.cn",
  "ucdrive.cn",
  "xiaoya.pro",
  // 光鸭云盘
  "guangya.net",
  "guangyapan.com",
  "guangyacdn.com",
  // 123 云盘（后四个为备用访问域名）
  "123pan.com",
  "123pan.cn",
  "123684.com",
  "123865.com",
  "123912.com",
  "123952.com",
  // 移动云盘（和彩云）
  "139.com",
  "10086.cn",
  // 百度网盘
  "pan.baidu.com",
  "pcs.baidu.com",
  "baidupcs.com",
  "bcebos.com",
  // 联通云盘
  "wo.cn",
  "wocloud.com.cn",
  // 腾讯微云
  "weiyun.com",
  // 蓝奏云（含优享版）
  "lanzou.com",
  "lanzoui.com",
  "lanzoux.com",
  "lanzn.com",
  "lanpv.com",
  // 城通网盘
  "ctfile.com",
  "ctdisk.com",
  "400gb.com",
  // 小飞机网盘
  "feijipan.com",
  // 曲奇云盘
  "quqi.com",
  // 亿方云
  "fangcloud.com",
  "fangcloud.net",
  // PikPak（迅雷海外）
  "mypikpak.com",
  "myqcloud.com",
  "cloudfront.net",
  "akamaized.net",
  "fastly.net",
  "hwcdn.net",
  "bytecdn.cn",
  "bdcdn.net"
];

// src/shared/proxy/body-plan.js
var MAX_REPLAY_BYTES = 256 * 1024;
var REQUEST_BODY_READ_MS = 5e3;
function streamFromReader(reader, prefix = []) {
  let index = 0;
  return new ReadableStream({
    async pull(controller) {
      try {
        if (index < prefix.length) {
          const chunk = prefix[index];
          prefix[index++] = null;
          controller.enqueue(chunk);
          return;
        }
        const { done, value } = await reader.read();
        if (done) {
          reader.releaseLock();
          controller.close();
        } else controller.enqueue(value);
      } catch (error) {
        reader.releaseLock();
        controller.error(error);
      }
    },
    async cancel(reason) {
      prefix.length = 0;
      try {
        await reader.cancel(reason);
      } finally {
        reader.releaseLock();
      }
    }
  }, { highWaterMark: 0 });
}
async function prepareRequestBody(request, maxBytes = MAX_REPLAY_BYTES, timeoutMs = REQUEST_BODY_READ_MS, { bufferUnknown = false } = {}) {
  if (request.method === "GET" || request.method === "HEAD" || !request.body) {
    return { replayable: true, apply() {
    } };
  }
  let body = request.body;
  let replayable = false;
  let overflow = false;
  const rawLength = request.headers.get("Content-Length");
  const length = /^\d+$/.test(rawLength || "") ? Number(rawLength) : NaN;
  if (Number.isSafeInteger(length) && length <= maxBytes || bufferUnknown && rawLength === null) {
    const reader = body.getReader();
    const chunks = [];
    let total = 0;
    const deadline = Date.now() + timeoutMs;
    const onAbort = () => {
      void reader.cancel(request.signal.reason).catch(() => {
      });
    };
    request.signal.addEventListener("abort", onAbort, { once: true });
    try {
      while (true) {
        request.signal.throwIfAborted();
        let timer;
        let part;
        try {
          part = await Promise.race([reader.read(), new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error("Request body read timed out")), Math.max(1, deadline - Date.now()));
          })]);
        } finally {
          clearTimeout(timer);
        }
        request.signal.throwIfAborted();
        const { done, value } = part;
        if (done) {
          const bytes = new Uint8Array(total);
          let offset = 0;
          for (const chunk of chunks) {
            bytes.set(chunk, offset);
            offset += chunk.byteLength;
          }
          body = bytes;
          replayable = true;
          reader.releaseLock();
          break;
        }
        chunks.push(value);
        total += value.byteLength;
        if (total > maxBytes) {
          body = streamFromReader(reader, chunks);
          overflow = true;
          break;
        }
      }
    } catch (error) {
      void reader.cancel(error).catch(() => {
      });
      reader.releaseLock();
      throw error;
    } finally {
      request.signal.removeEventListener("abort", onAbort);
    }
  }
  let used = false;
  return {
    replayable,
    apply(init) {
      if (!replayable && used) throw new Error("Streaming request body cannot be replayed");
      used = true;
      init.body = body;
      if (init.headers?.has("Content-Length")) {
        if (overflow) init.headers.delete("Content-Length");
        else if (replayable) init.headers.set("Content-Length", String(body.byteLength));
      }
      if (!replayable) init.duplex = "half";
    }
  };
}

// src/shared/proxy/cache-policy.js
var PRIVATE_HEADERS = ["authorization", "cookie", "x-emby-token", "x-mediabrowser-token", "x-emby-authorization", "x-mediabrowser-authorization", "x-emby-api-key", "x-api-key"];
var PRIVATE_QUERY = /(?:token|api[_-]?key|authorization|signature|sign|secret|password|credential|jwt|^key$|^auth$)/i;
function hasPrivateRequestState(request) {
  if (PRIVATE_HEADERS.some((name) => request.headers.has(name))) return true;
  for (const key of new URL(request.url).searchParams.keys()) {
    if (PRIVATE_QUERY.test(key)) return true;
  }
  return false;
}
function canStorePublicResponse(response) {
  if (response.status !== 200 || response.headers.has("Set-Cookie")) return false;
  if (/(?:^|,)\s*(?:private|no-store|no-cache)(?:\s|,|=|$)/i.test(response.headers.get("Cache-Control") || "")) return false;
  return !response.headers.get("Vary");
}

// src/shared/proxy/circuit.js
var MAX_CIRCUIT_ENTRIES = 512;
var HALF_OPEN_LEASE_MS = 1e4;
function circuitKey(request, upstream, route = "", owner = "") {
  const incoming = new URL(request.url);
  return JSON.stringify([incoming.host, owner, route || incoming.pathname.split("/")[1] || "/", upstream.origin]);
}
function markCircuitDown(state, key, until, now = Date.now()) {
  for (const [entry, expiry] of state) if (expiry <= now) state.delete(entry);
  state.delete(key);
  state.set(key, until);
  while (state.size > MAX_CIRCUIT_ENTRIES) state.delete(state.keys().next().value);
}
function circuitUnavailable(state, key, now = Date.now()) {
  const until = state.get(key);
  if (until === void 0) return false;
  if (until > now) return true;
  state.set(key, now + HALF_OPEN_LEASE_MS);
  return false;
}

// src/editions/personal/relay/preference.js
var RELAY_PREFERENCE_MS = 12e4;
var RELAY_RECOVERY_LEASE_MS = 1e4;
var MAX_RELAY_PREFERENCES = 512;
function relayPreferenceKey(request, target, route) {
  return JSON.stringify([
    circuitKey(request, target, route),
    request.cf?.colo || "",
    request.cf?.country || request.headers.get("cf-ipcountry") || ""
  ]);
}
function markRelayPreferred(state, key, now = Date.now()) {
  state.delete(key);
  state.set(key, { until: now + RELAY_PREFERENCE_MS, probeUntil: 0 });
  while (state.size > MAX_RELAY_PREFERENCES) state.delete(state.keys().next().value);
}
function getRelayPreference(state, key, method, now = Date.now()) {
  const entry = state.get(key);
  if (!entry) return { useRelay: false, probe: null, entry: null };
  if (entry.until > now || !["GET", "HEAD"].includes(method) || entry.probeUntil > now) {
    return { useRelay: true, probe: null, entry };
  }
  entry.probeUntil = now + RELAY_RECOVERY_LEASE_MS;
  return { useRelay: false, probe: entry, entry };
}
function forgetRelayPreference(state, key, entry) {
  if (state.get(key) === entry) state.delete(key);
}
function finishRelayProbe(state, key, probe, available, now = Date.now()) {
  if (!probe || state.get(key) !== probe) return;
  if (available) state.delete(key);
  else {
    probe.until = now + RELAY_RECOVERY_LEASE_MS;
    probe.probeUntil = 0;
  }
}

// src/editions/personal/proxy/pipeline.js
async function proxyDirectUrl(request, env2, ctx, upstreamUrls, opts = {}) {
  const { enableCache = true, compatMode = false, clientIpMode = "forward", matchedPrefix = null, customHeaders = [], relayMode = "off", relay = null } = opts;
  const ipMode = normalizeIpMode(clientIpMode);
  const settings = await getSettings(env2);
  if (!upstreamUrls.length)
    return errResponse("404: Target empty", 404);
  let firstUpstreamUrl;
  try {
    firstUpstreamUrl = new URL(upstreamUrls[0]);
  } catch {
    return errResponse("Invalid upstream URL", 500);
  }
  const pathname = firstUpstreamUrl.pathname;
  const reqCategory = classifyRequest(pathname, request.method);
  const isPlaybackInfo = reqCategory === "playback_info";
  const isPlaying = reqCategory === "playing";
  const isPlayStart = isPlaying && /\/Sessions\/Playing\/?$/i.test(pathname);
  const mode = normalizeRelayMode(relayMode, "off");
  const relayActive = !!(relay?.enabled && relay.secret && relay.relayUrl);
  const forceRelay = mode === "on";
  if (forceRelay && !relayActive) return errResponse("\u7EBF\u8DEF\u5F3A\u5236\u4F7F\u7528 VPS\uFF0C\u4F46\u5168\u5C40\u4E2D\u7EE7\u672A\u542F\u7528\u6216\u914D\u7F6E\u4E0D\u5B8C\u6574", 503);
  const autoRelay = mode === "auto" && relayActive;
  const budget = createFetchBudget(request);
  let bodyPlan = null;
  let relayAttempted = false;
  let usingAutoRelay = false;
  let relayFallbackUsed = false;
  async function fetchThroughRelay(target, init) {
    const relayUrl = new URL(normalizeRelayBase(relay.relayUrl));
    relayUrl.pathname = target.pathname;
    relayUrl.search = target.search;
    const headers = new Headers(init.headers);
    for (const [name, value] of Object.entries(await relayFetchHeaders(relay.secret, target.href))) headers.set(name, value);
    return budget.fetch(new Request(relayUrl, { ...init, headers, redirect: "manual" }));
  }
  function acceptedRelay(target, init, response, reason) {
    usingAutoRelay = true;
    relayFallbackUsed = true;
    if (reason !== "preferred" && response.status < 400) {
      markRelayPreferred(relayPreferences, relayPreferenceKey(request, target, matchedPrefix));
    }
    if (!fallbackLogThrottled((matchedPrefix || "?") + "|relay")) {
      ctx.waitUntil(auditLog(env2, "direct.fallback", `${matchedPrefix || "?"} ${init.method} category=${reqCategory} reason=${reason}`));
    }
    return response;
  }
  async function tryRelay(target, init, reason) {
    if (!autoRelay || relayAttempted || request.signal.aborted || !relayRetryAllowed(init.method, target, reason, bodyPlan?.replayable)) return null;
    relayAttempted = true;
    try {
      const retryInit = { method: init.method, headers: new Headers(init.headers), signal: request.signal };
      if (!["GET", "HEAD"].includes(init.method)) bodyPlan.apply(retryInit);
      const response = await fetchThroughRelay(target, retryInit);
      if (!relayResponseUsable(response)) {
        discardResponse(response);
        return null;
      }
      return acceptedRelay(target, init, response, reason);
    } catch {
      return null;
    }
  }
  async function fetchUpstream(target, init) {
    if (forceRelay || usingAutoRelay) return fetchThroughRelay(target, init);
    const key = autoRelay ? relayPreferenceKey(request, target, matchedPrefix) : null;
    const preference = autoRelay && !relayAttempted ? getRelayPreference(relayPreferences, key, init.method) : { useRelay: false, probe: null };
    if (preference.useRelay) {
      relayAttempted = true;
      try {
        const response2 = await fetchThroughRelay(target, init);
        if (relayResponseUsable(response2)) return acceptedRelay(target, init, response2, "preferred");
        forgetRelayPreference(relayPreferences, key, preference.entry);
        if (!["GET", "HEAD"].includes(init.method)) {
          relayFallbackUsed = true;
          return response2;
        }
        discardResponse(response2);
      } catch (error) {
        forgetRelayPreference(relayPreferences, key, preference.entry);
        if (!["GET", "HEAD"].includes(init.method) || request.signal.aborted) throw error;
      }
    }
    let response;
    try {
      response = await budget.fetch(new Request(target, init));
    } catch (error) {
      const fallback2 = await tryRelay(target, init, "transport");
      finishRelayProbe(relayPreferences, key, preference.probe, false);
      if (fallback2) return fallback2;
      throw error;
    }
    const fallback = await tryRelay(target, init, response.status);
    finishRelayProbe(relayPreferences, key, preference.probe, response.status < 400 && relayResponseUsable(response));
    if (!fallback) return response;
    discardResponse(response);
    return fallback;
  }
  if (!["streaming", "segment", "image", "static"].includes(reqCategory) && rateLimited(request.headers.get("cf-connecting-ip") || "unknown", settings.rateLimitPerMin)) {
    return errResponse("429: Too Many Requests", 429, { "Retry-After": "30" });
  }
  if (/\/Sessions\/Playing\/Progress\/?$/i.test(pathname)) {
    const progressKey = progressKeyOf(request);
    const last = progressMap.get(progressKey) || 0;
    const now = Date.now();
    if (progressKey && now - last < PROGRESS_THROTTLE_MS) {
      return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
    }
    if (progressKey) progressMap.set(progressKey, now);
    if (progressMap.size > PROGRESS_MAP_MAX) {
      const cutoff = now - 6e4;
      for (const [k, v] of progressMap) {
        if (v < cutoff)
          progressMap.delete(k);
        if (progressMap.size <= PROGRESS_MAP_MAX / 2)
          break;
      }
      while (progressMap.size > PROGRESS_MAP_MAX) progressMap.delete(progressMap.keys().next().value);
    }
  }
  const recordStats = (bytes) => {
    if (!CONFIG.enableStats || !env2.DB)
      return;
    const nowTs = Date.now();
    if (matchedPrefix && (isPlaybackInfo || isPlaying || reqCategory === "streaming")) {
      const lt = lastPlayTouched.get(matchedPrefix) || 0;
      if (nowTs - lt > LAST_PLAY_THROTTLE_MS) {
        lastPlayTouched.set(matchedPrefix, nowTs);
        const nowTime = new Date(nowTs + 8 * 36e5).toISOString().replace("T", " ").split(".")[0];
        ctx.waitUntil(env2.DB.prepare("UPDATE routes SET last_play = ? WHERE prefix = ?").bind(nowTime, matchedPrefix).run().catch(() => {
        }));
      }
    }
  };
  const meterBody = (response) => {
    if (!response.body) {
      recordStats(0);
      return null;
    }
    recordStats(0);
    return response.body;
  };
  const upgradeHeader = request.headers.get("Upgrade");
  if (upgradeHeader?.toLowerCase() === "websocket") {
    const wsHeaders = buildWebSocketHeaders(request, firstUpstreamUrl, { ipMode, compatMode });
    for (const [name, value] of customHeaders) wsHeaders.set(name, value);
    try {
      return await fetchUpstream(firstUpstreamUrl, { method: request.method, headers: wsHeaders, redirect: "manual" });
    } catch (error) {
      if (request.signal.aborted) return errResponse("Client closed request", 499);
      throw error;
    }
  }
  const canUseCache = enableCache && isCacheableRequest(reqCategory) && request.method === "GET" && !request.headers.has("Range") && !hasPrivateRequestState(request);
  const cacheKey = canUseCache ? new Request(request.url, { method: "GET" }) : null;
  if (canUseCache) {
    try {
      const cachedResponse = await caches.default.match(cacheKey);
      if (cachedResponse) {
        const headers = new Headers(cachedResponse.headers);
        headers.set("X-Cache", "HIT");
        applySecurityHeaders(headers);
        recordStats(getResponseBytes(cachedResponse));
        return new Response(cachedResponse.body, { status: cachedResponse.status, statusText: cachedResponse.statusText, headers });
      }
    } catch (_) {
    }
  }
  bodyPlan = await prepareRequestBody(request, void 0, void 0, {
    bufferUnknown: autoRelay && relayPostEndpoint(request.method, firstUpstreamUrl)
  });
  const retryable = isRetryableMethod(request);
  const timeoutSignal = () => upstreamSignal(request, isPlaybackInfo || isPlaying || reqCategory === "api" ? API_TIMEOUT_MS : 0);
  let finalResponse = null;
  let fallbackResponse = null;
  let lastError = null;
  let lastUpstreamUrl = null;
  let attempts = 0;
  for (let i = 0; i < upstreamUrls.length; i++) {
    if (attempts >= MAX_UPSTREAM_ATTEMPTS) break;
    let upstreamUrl;
    try {
      upstreamUrl = new URL(upstreamUrls[i]);
    } catch {
      lastError = new Error("Invalid target URL");
      continue;
    }
    const healthKey = circuitKey(request, upstreamUrl, matchedPrefix);
    if (i < upstreamUrls.length - 1 && circuitUnavailable(hostDownUntil, healthKey)) {
      lastError = lastError || new Error("\u7EBF\u8DEF\u6682\u65F6\u4E0D\u53EF\u7528: " + upstreamUrl.host);
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
    for (const [k, v] of customHeaders)
      headers.set(k, v);
    const rangeHeader = request.headers.get("Range");
    if (rangeHeader && (reqCategory === "streaming" || reqCategory === "segment" || reqCategory === "other")) {
      if (!headers.has("Range"))
        headers.set("Range", rangeHeader);
      const ifRange = request.headers.get("If-Range");
      if (ifRange && !headers.has("If-Range"))
        headers.set("If-Range", ifRange);
    }
    const fetchInit = {
      method: request.method,
      headers,
      redirect: "manual"
    };
    bodyPlan.apply(fetchInit);
    try {
      attempts++;
      fetchInit.signal = timeoutSignal();
      const response = await fetchUpstream(upstreamUrl, fetchInit);
      if (retryable && !compatMode && [502, 503, 504].includes(response.status)) {
        lastError = new Error(`HTTP ${response.status}`);
        markCircuitDown(hostDownUntil, healthKey, Date.now() + HOST_DOWN_MS);
        discardResponse(fallbackResponse);
        fallbackResponse = response;
        continue;
      }
      hostDownUntil.delete(healthKey);
      finalResponse = response;
      lastUpstreamUrl = upstreamUrl;
      break;
    } catch (err) {
      if (request.signal.aborted) {
        discardResponse(fallbackResponse);
        return errResponse("Client closed request", 499);
      }
      lastError = err;
      markCircuitDown(hostDownUntil, healthKey, Date.now() + HOST_DOWN_MS);
      if (!retryable) break;
      continue;
    }
  }
  if (request.signal.aborted) {
    discardResponse(finalResponse);
    discardResponse(fallbackResponse);
    return errResponse("Client closed request", 499);
  }
  if (fallbackResponse && finalResponse && fallbackResponse !== finalResponse) discardResponse(fallbackResponse);
  if (!finalResponse && fallbackResponse) {
    finalResponse = fallbackResponse;
    lastUpstreamUrl = null;
  }
  if (!finalResponse) {
    return errResponse("\u6240\u6709\u7EBF\u8DEF\u4E0D\u53EF\u7528\uFF0C\u8BF7\u68C0\u67E5\u7EBF\u8DEF\u914D\u7F6E\u6216\u7A0D\u540E\u91CD\u8BD5", 502);
  }
  if (lastUpstreamUrl) {
    try {
      const followed = await followUpstreamRedirects(finalResponse, lastUpstreamUrl, {
        request,
        bodyPlan,
        signalFor: timeoutSignal,
        fetcher: (outbound) => fetchUpstream(new URL(outbound.url), { method: outbound.method, headers: outbound.headers, body: outbound.body, duplex: "half", signal: outbound.signal, redirect: "manual" }),
        headersFor: (target, crossOrigin) => buildUpstreamHeaders(request, target, { ipMode, compatMode, crossOrigin }),
        clientLocation: (target) => !forceRelay && !usingAutoRelay && !compatMode && MANUAL_REDIRECT_DOMAINS.concat(settings.manualDomains).some((domain) => target.hostname === domain || target.hostname.endsWith("." + domain)) ? target.href : null
      });
      finalResponse = followed.response;
    } catch (error) {
      return errResponse(request.signal.aborted ? "Client closed request" : "Upstream redirect failed", request.signal.aborted ? 499 : 502);
    }
  }
  const responseHeaders = sanitizeResponseHeaders(finalResponse.headers);
  responseHeaders.set("Access-Control-Allow-Origin", "*");
  responseHeaders.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  responseHeaders.set("Access-Control-Allow-Headers", "*");
  applySecurityHeaders(responseHeaders);
  if (isPlaying || isPlaybackInfo) {
    responseHeaders.set("X-Served-By", request.cf?.colo || "Unknown");
  }
  if (relayFallbackUsed) {
    responseHeaders.set("X-Relay-Fallback", "1");
  }
  const body = meterBody(finalResponse);
  if (canUseCache && canStorePublicResponse(finalResponse)) {
    const maxAge = reqCategory === "image" ? 2592e3 : 86400;
    responseHeaders.set("Cache-Control", `public, max-age=${maxAge}`);
    responseHeaders.set("X-Cache", "MISS");
    const responseToCache = new Response(body, { status: finalResponse.status, statusText: finalResponse.statusText, headers: responseHeaders });
    ctx.waitUntil(caches.default.put(cacheKey, responseToCache.clone()).catch(() => {
    }));
    return responseToCache;
  }
  return new Response(body, {
    status: finalResponse.status,
    statusText: finalResponse.statusText,
    headers: responseHeaders
  });
}

// src/editions/personal/entry.js
var worker_default = {
  async scheduled(event, env2, ctx) {
    ctx.waitUntil(runScheduled(env2));
  },
  async fetch(request, env2, ctx) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "*",
          "Access-Control-Max-Age": "86400"
        }
      });
    }
    if (env2.DB) {
      try {
        await initDatabase(env2);
      } catch (_) {
      }
    }
    if (url.pathname === "/") {
      const authed = await isAdmin(request, env2);
      return html(buildFrontendHtml(authed));
    }
    if (url.pathname === "/favicon.ico")
      return new Response("", { headers: { "Content-Type": "image/x-icon" } });
    if (url.pathname.startsWith("/cdn-cgi/"))
      return new Response("Not Found", { status: 404 });
    if (url.pathname === "/health") {
      return json({ status: "ok", version: CURRENT_VERSION, colo: request.cf?.colo, timestamp: (/* @__PURE__ */ new Date()).toISOString() });
    }
    if (url.pathname === "/stats") {
      const dateParam = url.searchParams.get("date") || "";
      return cachedJson(request, "stats:" + dateParam, 60, () => handleStatsRequest(env2, url));
    }
    if (url.pathname === "/api/edge-info")
      return json(await getEdgeInfo(request));
    if (url.pathname === "/api/domains/list") {
      if (!env2.DB) {
        return json({ success: true, domains: DEFAULT_OPTIMIZED_DOMAINS.map((d, i) => ({ id: i, ...d })) });
      }
      const domains = await getOptimizedDomains(env2);
      return json({ success: true, domains });
    }
    if (url.pathname === "/api/config/dns-record-name") {
      const base = getBaseDomain(env2);
      return json({ dnsRecordName: getDnsRecordName(env2) || (base ? base.split(".")[0] : "emby") });
    }
    if (url.pathname === "/api/config/base-domain") {
      return json({ baseDomain: getBaseDomain(env2) || "yourdomain.com" });
    }
    if (url.pathname === "/admin/api/login" && request.method === "POST") {
      if (request.headers.get("Origin") && request.headers.get("Origin") !== url.origin)
        return json({ ok: false, error: "Forbidden origin" }, 403);
      try {
        const body = await request.json();
        return adminLoginResponse(request, env2, String(body.token || ""));
      } catch (e) {
        return json({ ok: false, error: e.message }, 400);
      }
    }
    if (url.pathname === "/robots.txt") {
      return new Response("User-agent: *\nDisallow: /\n", { headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
    if (url.pathname === "/admin" || url.pathname === "/admin/") {
      if (!await isAdmin(request, env2))
        return new Response(null, { status: 302, headers: { Location: "/" } });
      const res = html(buildAdminHtml());
      res.headers.set("X-Robots-Tag", "noindex, nofollow");
      return res;
    }
    if (url.pathname.startsWith("/admin/api/")) {
      if (!await isAdmin(request, env2))
        return new Response("Unauthorized", { status: 401 });
      if (!env2.DB)
        return json({ error: "DB \u672A\u7ED1\u5B9A" }, 500);
      try {
        return await handleAdminApi(request, env2, url);
      } catch (e) {
        return json({ error: "\u670D\u52A1\u5668\u5185\u90E8\u9519\u8BEF: " + String(e?.message || e).slice(0, 200) }, 500);
      }
    }
    const pathFirst = url.pathname.split("/").filter(Boolean)[0]?.toLowerCase();
    const looksLikeFileName = /\.(?:txt|html?|xml|json|ico|png|jpe?g|gif|svg|webp|css|js|map|php|aspx?|env|git)$/i.test(pathFirst || "");
    const looksLikeDirectUrl = url.pathname.startsWith("/http://") || url.pathname.startsWith("/https://") || pathFirst && !looksLikeFileName && (pathFirst.includes(".") || pathFirst.includes(":"));
    if (looksLikeDirectUrl) {
      let path = url.pathname.substring(1);
      if (path.startsWith("/"))
        return errResponse("Invalid proxy format", 400);
      path = path.replace(/^(https?)\/(?!\/)/, "$1://");
      if (!path.startsWith("http"))
        path = "https://" + path;
      try {
        const upstreamUrl = new URL(path);
        if (upstreamUrl.protocol !== "http:" && upstreamUrl.protocol !== "https:") {
          return errResponse("Invalid URL format", 400);
        }
        if (!directProxyAllowed(env2, upstreamUrl.hostname)) {
          return errResponse("Forbidden: direct proxy target not allowed", 403);
        }
        upstreamUrl.search = url.search;
        return proxyDirectUrl(request, env2, ctx, [upstreamUrl.toString()], { enableCache: true });
      } catch {
        return errResponse("Invalid URL format", 400);
      }
    }
    if (!env2.DB) {
      return errResponse("D1 \u6570\u636E\u5E93\u672A\u7ED1\u5B9A\uFF0C\u8DEF\u7531\u53CD\u4EE3\u4E0D\u53EF\u7528\u3002\u4ECD\u53EF\u4F7F\u7528 /https://... \u683C\u5F0F\u3002", 500);
    }
    const resolved = await resolveProxyTarget(request, env2, url);
    if (resolved.error)
      return resolved.error;
    let relayCfg = null;
    if (resolved.relayMode && resolved.relayMode !== "off")
      relayCfg = await getRelayConfig(env2);
    return proxyDirectUrl(request, env2, ctx, resolved.upstreamUrls, {
      enableCache: resolved.enableCache,
      compatMode: resolved.compatMode,
      clientIpMode: resolved.clientIpMode,
      matchedPrefix: resolved.matchedPrefix,
      customHeaders: resolved.customHeaders,
      relayMode: resolved.relayMode,
      relay: relayCfg
    });
  }
};
var entry_default = worker_default;

// text-asset:web/shared/workspace.js
var workspace_default = "// Shared presentation controller. Authorization remains entirely server-side.\n(() => {\n  const edition = document.body.dataset.edition;\n  const topbar = document.querySelector('.topbar');\n  if (!topbar || !document.querySelector('#routeList')) return;\n  const badge = document.createElement('span');\n  badge.className = 'edition-label';\n  badge.textContent = edition === 'personal' ? 'PERSONAL \xB7 \u4E2A\u4EBA\u7248' : 'MULTI \xB7 \u591A\u4EBA\u7248';\n  topbar.querySelector('.brand')?.append(badge);\n  // Personal keeps its existing lazy tab loaders and controls unchanged.\n  if (edition !== 'multi') return;\n  const container = topbar.parentElement;\n  const groups = new Map();\n  for (const card of [...container.children].filter(el => el.classList.contains('card'))) {\n    const label = card.querySelector('.sec-title')?.textContent || '';\n    const name = card.querySelector('#routeList') ? 'routes'\n      : card.querySelector('#userList, #inviteList') ? 'users'\n      : card.querySelector('#domainList') ? 'domains'\n      : card.querySelector('#auditList') ? 'logs' : 'overview';\n    if (!groups.has(name)) {\n      const pane = document.createElement('section');\n      pane.className = 'workspace-pane'; pane.id = `workspace-${name}`;\n      pane.setAttribute('role', 'tabpanel');\n      groups.set(name, pane); container.append(pane);\n    }\n    groups.get(name).append(card);\n  }\n  const nav = document.createElement('nav');\n  nav.className = 'tabbar'; nav.setAttribute('aria-label', '\u5DE5\u4F5C\u533A\u5BFC\u822A'); nav.setAttribute('role', 'tablist');\n  const definitions = [['overview', '\u{1F4CA} \u6982\u89C8'], ['routes', '\u{1F6A6} \u8DEF\u7531'], ['users', '\u{1F465} \u7528\u6237\u4E0E\u9080\u8BF7'], ['domains', '\u{1F310} \u4F18\u9009'], ['logs', '\u{1F4DC} \u65E5\u5FD7']];\n  const activate = name => {\n    if (!groups.has(name)) name = groups.keys().next().value;\n    for (const [key, pane] of groups) pane.hidden = key !== name;\n    for (const button of nav.children) {\n      const active = button.dataset.tab === name;\n      button.classList.toggle('active', active); button.setAttribute('aria-selected', String(active));\n    }\n    try { sessionStorage.setItem('emby-multi-tab', name); } catch {}\n  };\n  for (const [name, label] of definitions) {\n    if (!groups.has(name)) continue;\n    const button = document.createElement('button');\n    button.className = 'tab-btn'; button.type = 'button'; button.textContent = label;\n    button.dataset.tab = name; button.setAttribute('role', 'tab'); button.setAttribute('aria-controls', `workspace-${name}`);\n    button.addEventListener('click', () => activate(name)); nav.append(button);\n  }\n  topbar.after(nav);\n  let initial = 'overview';\n  try { initial = sessionStorage.getItem('emby-multi-tab') || initial; } catch {}\n  activate(initial);\n})();\n";

// text-asset:web/shared/workspace.css
var workspace_default2 = `/* Complements the original personal glass theme; does not replace its palette. */
:root { --border: var(--line); }
.edition-label { font-size: 10px; color: var(--text-dim); border: 1px solid var(--line); border-radius: 999px; padding: 3px 9px; white-space: nowrap; letter-spacing: .04em; }
.workspace-pane { display: flex; flex-direction: column; gap: 22px; }
.workspace-pane[hidden] { display: none !important; }
.meta-tag { font-size: 11px; color: var(--text-dim); padding: 4px 9px; border: 1px solid var(--line); border-radius: 999px; }
.tabbar { flex-shrink: 0; }
.card { min-width: 0; }
.table-wrap { overflow-x: auto; }
.card table { width: 100%; border-collapse: collapse; font-size: 13px; }
.card th, .card td { text-align: left; padding: 12px 9px; border-bottom: 1px solid var(--line); }
.card th { font-weight: 600; color: var(--text-dim); }
.card td { overflow-wrap: anywhere; }
.admin-bg {
  position: fixed; inset: 0; z-index: 0; pointer-events: none;
  background-color: var(--bg);
  background-image: linear-gradient(115deg, rgba(var(--veil-rgb,6,9,15),.7), rgba(var(--veil-rgb,6,9,15),.58)), url('/bing-wallpaper');
  background-position: center; background-size: cover; background-repeat: no-repeat;
  opacity: .46;
}
@supports not (backdrop-filter: blur(1px)) { .card, .topbar, .modal-inner { background: var(--bg); } }
@media (max-width: 680px) {
  .edition-label { display: none; }
  .card { padding: 18px; }
  .card table { min-width: 520px; }
  .container { padding-left: 14px; padding-right: 14px; }
  .topbar { margin-left: -14px; margin-right: -14px; padding-left: 14px; padding-right: 14px; flex-wrap: wrap; }
  .topbar-actions { max-width: 100%; }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; scroll-behavior: auto !important; }
}
.console-route-tools, .console-card-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.console-route-tools { padding: 0 0 18px; }
.console-route-tools select { width: auto; min-width: 135px; }
.console-card-controls { border-top: 1px solid var(--line); padding-top: 14px; margin-top: 14px; }
.console-select { display: flex; align-items: center; gap: 6px; margin: 0 auto 0 0; font-size: 12px; color: var(--text-dim); }
.console-select input { width: 16px; height: 16px; }
.console-diagnostic { margin: auto; width: min(650px, calc(100vw - 28px)); max-height: 85vh; overflow: auto; padding: 28px; color: var(--text); background: var(--surface); border: 1px solid var(--line-strong); border-radius: 20px; backdrop-filter: blur(28px); box-shadow: var(--shadow); }
.console-diagnostic::backdrop { background: rgba(0, 0, 0, .55); backdrop-filter: blur(5px); }
.console-diagnostic > button { float: right; }
.console-diagnostic h2 { margin: 0 0 16px; }
.diagnostic-results { display: grid; gap: 12px; margin: 22px 0; }
.diagnostic-row { border: 1px solid var(--line); padding: 16px; border-radius: 12px; background: var(--surface-2); }
.diagnostic-row strong { margin-right: 20px; }
.diagnostic-row p { font-size: 12px; margin-top: 8px; }
.diagnostic-ok { color: var(--ok); }
.diagnostic-warning { color: var(--warn); }
body[data-edition] .route-item { opacity: 1 !important; }
.route-item[data-console-enabled="false"] { border-style: dashed; }
@media (max-width: 680px) {
  .console-diagnostic { padding: 20px; }
  .console-select { width: 100%; }
}
`;

// text-asset:web/shared/console.js
var console_default = "// Presentation only. Every write/probe still passes the edition's server auth.\n(() => {\n  const list = document.getElementById('routeList');\n  if (!list) return;\n  const edition = document.body.dataset.edition;\n  const admin = edition === 'personal' || typeof IS_ADMIN !== 'undefined' && IS_ADMIN;\n  const selected = new Set();\n  const element = (tag, text, className) => {\n    const node = document.createElement(tag);\n    if (text) node.textContent = text;\n    if (className) node.className = className;\n    return node;\n  };\n  const main = document.querySelector('.container');\n  const navigation = main.querySelector('.tabbar');\n  const updateActiveTab = () => { document.body.dataset.consoleTab = navigation?.querySelector('.tab-btn.active')?.dataset.tab || 'overview'; };\n  navigation?.addEventListener('click', () => requestAnimationFrame(updateActiveTab));\n  updateActiveTab();\n\n  const tools = element('div', '', 'console-route-tools');\n  const filter = element('select');\n  filter.setAttribute('aria-label', '\u7EBF\u8DEF\u72B6\u6001\u7B5B\u9009');\n  for (const [value, text] of [['all', '\u5168\u90E8\u7EBF\u8DEF'], ['enabled', '\u4EC5\u5DF2\u542F\u7528'], ['disabled', '\u4EC5\u5DF2\u505C\u7528']]) {\n    const option = element('option', text); option.value = value; filter.append(option);\n  }\n  const selectionCount = element('span', '\u5DF2\u9009 0 \u6761', 'muted');\n  const bulk = [];\n  tools.append(filter, selectionCount);\n  if (admin) {\n    for (const [enabled, label] of [[true, '\u542F\u7528\u6240\u9009'], [false, '\u505C\u7528\u6240\u9009']]) {\n      const button = element('button', label, 'btn btn-sm');\n      button.disabled = true;\n      button.onclick = async () => {\n        const prefixes = [...selected];\n        if (!prefixes.length || !confirm(`\u786E\u8BA4${enabled ? '\u542F\u7528' : '\u505C\u7528'} ${prefixes.length} \u6761\u7EBF\u8DEF\uFF1F`)) return;\n        bulk.forEach(item => { item.disabled = true; });\n        let succeeded = 0;\n        try {\n          for (const prefix of prefixes) {\n            const response = await fetch('/admin/api/routes/toggle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefix, enabled }) });\n            if (!response.ok) throw new Error('\u90E8\u5206\u64CD\u4F5C\u672A\u5B8C\u6210\uFF0C\u8BF7\u5237\u65B0\u6838\u5BF9');\n            succeeded++;\n          }\n          selected.clear();\n          showToast(`\u5DF2\u66F4\u65B0 ${succeeded} \u6761\u7EBF\u8DEF`);\n        } catch { showToast(`\u5DF2\u66F4\u65B0 ${succeeded} \u6761\uFF1B\u5176\u4F59\u672A\u5B8C\u6210\uFF0C\u8BF7\u6838\u5BF9`); }\n        finally { await loadRoutes(); update(); }\n      };\n      bulk.push(button); tools.append(button);\n    }\n  }\n  list.before(tools);\n  const applyFilter = () => {\n    const query = (document.getElementById('routeSearch')?.value || '').toLowerCase();\n    for (const card of list.querySelectorAll('.route-item')) {\n      const enabled = card.dataset.consoleEnabled === 'true';\n      card.style.display = (!query || (card.dataset.search || '').includes(query)) && (filter.value === 'all' || enabled === (filter.value === 'enabled')) ? '' : 'none';\n    }\n  };\n  filter.onchange = applyFilter;\n  document.getElementById('routeSearch')?.addEventListener('input', applyFilter);\n\n  const dialog = element('dialog', '', 'console-diagnostic');\n  dialog.setAttribute('aria-label', '\u7EBF\u8DEF\u8BCA\u65AD');\n  const close = element('button', '\u5173\u95ED', 'btn btn-sm');\n  close.onclick = () => dialog.close();\n  const diagnosticBody = element('div');\n  diagnosticBody.setAttribute('aria-live', 'polite');\n  dialog.append(close, diagnosticBody);\n  document.body.append(dialog);\n  let diagnosing = false;\n  async function diagnose(prefix, button) {\n    if (diagnosing) return;\n    diagnosing = true; button.disabled = true;\n    diagnosticBody.replaceChildren(element('h2', '\u7EBF\u8DEF\u8BCA\u65AD'), element('p', '\u6B63\u5728\u68C0\u67E5\u6E90\u7AD9\u7684 Emby/Jellyfin API\u2026', 'muted'));\n    dialog.showModal();\n    try {\n      const response = await fetch('/admin/api/routes/diagnose', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefix }) });\n      if (!response.ok) throw new Error('\u8BCA\u65AD\u672A\u5B8C\u6210\uFF0C\u8BF7\u68C0\u67E5\u6743\u9650\u6216\u7A0D\u540E\u91CD\u8BD5');\n      const data = await response.json();\n      diagnosticBody.replaceChildren(element('h2', `\u7EBF\u8DEF /${data.prefix}`));\n      diagnosticBody.append(element('p', `\u672C\u6B21\u63A2\u6D4B\uFF1AWorker \u76F4\u8FDE\u6E90\u7AD9${data.enabled ? '' : ' \xB7 \u6B64\u7EBF\u8DEF\u5DF2\u505C\u7528'}`, 'muted'));\n      const results = element('div', '', 'diagnostic-results');\n      for (const result of data.results) {\n        const row = element('section', '', 'diagnostic-row');\n        const labels = { verified: 'API \u6B63\u5E38', 'endpoint-unavailable': '\u672A\u9A8C\u8BC1\uFF1A\u516C\u5F00 API \u8DEF\u5F84\u4E0D\u53EF\u7528', authentication: '\u63A2\u6D4B\u53D7\u9650\uFF1A\u6E90\u7AD9\u62D2\u7EDD\u8BBF\u95EE', upstream: '\u63A2\u6D4B\u5931\u8D25\uFF1A\u6E90\u7AD9\u670D\u52A1\u9519\u8BEF', 'unexpected-response': '\u672A\u9A8C\u8BC1\uFF1A\u4E0D\u662F\u6709\u6548\u7684\u670D\u52A1\u4FE1\u606F', 'connection-or-redirect': '\u63A2\u6D4B\u5931\u8D25\uFF1A\u8FDE\u63A5\u6216\u8DF3\u8F6C\u5F02\u5E38', cancelled: '\u63A2\u6D4B\u5DF2\u53D6\u6D88' };\n        row.append(element('strong', `\u6E90\u7AD9 ${result.target}`), element('span', labels[result.stage] || '\u63A2\u6D4B\u5931\u8D25\uFF1AHTTP \u54CD\u5E94\u5F02\u5E38', result.ok ? 'diagnostic-ok' : 'diagnostic-warning'));\n        if (result.status) row.append(element('p', `HTTP ${result.status} \xB7 \u54CD\u5E94\u5934 ${result.headerMs} ms \xB7 \u8DF3\u8F6C ${result.redirects} \u6B21`, 'muted'));\n        results.append(row);\n      }\n      diagnosticBody.append(results, element('p', data.notice, 'form-hint'));\n    } catch { diagnosticBody.append(element('p', '\u8BCA\u65AD\u672A\u5B8C\u6210\uFF0C\u8BF7\u68C0\u67E5\u6743\u9650\u3001\u7EBF\u8DEF\u914D\u7F6E\u6216\u7A0D\u540E\u91CD\u8BD5\u3002', 'diagnostic-warning')); }\n    finally { diagnosing = false; button.disabled = false; }\n  }\n  const dataRoutes = () => typeof allRoutes !== 'undefined' && Array.isArray(allRoutes) ? allRoutes : [];\n  function update() {\n    const routes = dataRoutes();\n    for (const prefix of selected) if (!routes.some(route => route.prefix === prefix)) selected.delete(prefix);\n    for (const card of list.querySelectorAll('.route-item')) {\n      const original = card.querySelector('button[data-prefix]');\n      if (!original) continue;\n      const prefix = original.dataset.prefix;\n      const route = routes.find(item => item.prefix === prefix);\n      card.dataset.consoleEnabled = String(route?.enabled !== 0);\n      if (card.querySelector('[data-console-added]')) continue;\n      const controls = element('div', '', 'console-card-controls');\n      controls.dataset.consoleAdded = '1';\n      if (admin) {\n        card.querySelector('button[data-act=\"test\"]')?.remove();\n        const label = element('label', '', 'console-select');\n        const checkbox = element('input'); checkbox.type = 'checkbox'; checkbox.checked = selected.has(prefix);\n        checkbox.setAttribute('aria-label', `\u9009\u62E9\u7EBF\u8DEF ${prefix}`);\n        checkbox.onchange = () => { checkbox.checked ? selected.add(prefix) : selected.delete(prefix); refreshSelection(); };\n        label.append(checkbox, document.createTextNode('\u9009\u62E9')); controls.append(label);\n        const diagnostic = element('button', '\u94FE\u8DEF\u8BCA\u65AD', 'btn btn-sm');\n        diagnostic.onclick = () => diagnose(prefix, diagnostic); controls.append(diagnostic);\n      }\n      const clone = element('button', '\u590D\u5236\u4E3A\u65B0\u7EBF\u8DEF', 'btn btn-sm');\n      clone.onclick = () => {\n        editRoute(prefix);\n        document.getElementById('oldPrefix').value = '';\n        for (const id of ['routeId', 'routeSource']) { const field = document.getElementById(id); if (field) field.value = ''; }\n        let next = (prefix.slice(0, 52) + '-copy');\n        let index = 2;\n        while (routes.some(item => item.prefix === next)) next = prefix.slice(0, 50) + '-copy-' + index++;\n        document.getElementById('routePrefix').value = next;\n        document.getElementById('routeRemark').value = (route?.remark || prefix) + ' \xB7 \u526F\u672C';\n        document.getElementById('routeModalTitle').textContent = '\u590D\u5236\u4E3A\u65B0\u7EBF\u8DEF';\n        document.getElementById('prefixPreview').textContent = next;\n      };\n      controls.append(clone); card.append(controls);\n    }\n    refreshSelection(); applyFilter();\n  }\n  function refreshSelection() {\n    selectionCount.textContent = `\u5DF2\u9009 ${selected.size} \u6761`;\n    bulk.forEach(button => { button.disabled = !selected.size; });\n  }\n  // Only childList changes from the edition renderer need enhancement.\n  new MutationObserver(records => { if (records.some(record => record.target === list)) update(); }).observe(list, { childList: true });\n  update();\n\n})();\n";

// src/shared/ui/wallpaper.js
var cached = { day: "", url: "" };
function shanghaiDay(timestamp) {
  return new Date(timestamp + 8 * 60 * 60 * 1e3).toISOString().slice(0, 10);
}
async function wallpaperResponse(method = "GET") {
  if (!["GET", "HEAD"].includes(method)) return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
  const now = Date.now();
  const day = shanghaiDay(now);
  if (!cached.url || cached.day !== day) {
    try {
      const response = await fetch("https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1", { signal: AbortSignal.timeout(4e3), cf: { cacheTtl: 300, cacheEverything: true } });
      const data = await response.json();
      const path = data?.images?.[0]?.url;
      if (path) {
        const image2 = new URL(path, "https://www.bing.com");
        if (image2.protocol === "https:" && ["www.bing.com", "bing.com", "th.bing.com"].includes(image2.hostname) && !image2.username && !image2.password) cached = { day, url: image2.href };
      }
    } catch {
    }
  }
  if (!cached.url) return new Response("wallpaper unavailable", { status: 503 });
  let image;
  try {
    image = await fetch(cached.url, { signal: AbortSignal.timeout(6e3), cf: { cacheEverything: true, cacheTtl: 3600 } });
  } catch {
    return new Response("wallpaper unavailable", { status: 503 });
  }
  if (!image.ok || !/^image\//i.test(image.headers.get("Content-Type") || "")) {
    void image.body?.cancel().catch(() => {
    });
    return new Response("wallpaper unavailable", { status: 503 });
  }
  const headers = new Headers(image.headers);
  headers.set("Cache-Control", "public, max-age=3600");
  if (method === "HEAD") {
    await image.body?.cancel();
    return new Response(null, { status: image.status, headers });
  }
  return new Response(image.body, { status: image.status, headers });
}

// src/shared/application.js
function createApplication({ edition, handler }) {
  return {
    scheduled: handler.scheduled,
    async fetch(request, env, ctx) {
      const url = new URL(request.url);
      if (url.pathname === "/bing-wallpaper") return wallpaperResponse(request.method);
      const response = await handler.fetch(request, env, ctx);
      const page = ["/", "/admin", "/admin/", "/login", "/register", "/register/"].includes(url.pathname);
      if (request.method !== "GET" || !page || response.status !== 200 || !response.headers.get("Content-Type")?.includes("text/html")) return response;
      const html2 = (await response.text()).replace("<body", () => `<body data-edition="${edition}"`).replace("</head>", () => `<style>${workspace_default2}</style></head>`).replace("</body>", () => `<script>${workspace_default}<\/script><script>${console_default}<\/script></body>`);
      const headers = new Headers(response.headers);
      headers.delete("Content-Length");
      headers.delete("Content-Encoding");
      headers.set("Cache-Control", "no-store");
      return new Response(html2, { status: response.status, headers });
    }
  };
}

// src/personal.js
var personal_default = createApplication({ edition: "personal", handler: entry_default });
export {
  personal_default as default
};
