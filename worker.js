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

// src/editions/multi/storage/legacy.js
var legacyUserIds = /* @__PURE__ */ new WeakMap();
async function columns(env, table) {
  const result = await env.DB.prepare(`PRAGMA table_info(${table})`).all();
  return new Set((result.results || []).map((row) => row.name));
}
async function userRoutesHaveLegacyUserId(env) {
  if (!env.DB) return false;
  if (!legacyUserIds.has(env.DB)) {
    const result = columns(env, "user_routes").then((names) => names.has("user_id"));
    legacyUserIds.set(env.DB, result);
    result.catch(() => legacyUserIds.delete(env.DB));
  }
  return legacyUserIds.get(env.DB);
}
async function ensureLegacyUserRoutes(env) {
  const names = await columns(env, "user_routes");
  if (!names.has("user_id")) return;
  const additions = [
    ["owner", "TEXT NOT NULL DEFAULT ''"],
    ["stream_target", "TEXT NOT NULL DEFAULT ''"],
    ["cache_img", "TEXT DEFAULT 'on'"],
    ["ip_mode", "TEXT DEFAULT 'forward'"],
    ["sort_order", "INTEGER DEFAULT 0"],
    ["enabled", "INTEGER NOT NULL DEFAULT 1"],
    ["custom_headers", "TEXT NOT NULL DEFAULT ''"],
    ["ip_allow", "TEXT NOT NULL DEFAULT ''"],
    ["ip_block", "TEXT NOT NULL DEFAULT ''"]
  ];
  for (const [name, definition] of additions) {
    if (names.has(name)) continue;
    try {
      await env.DB.prepare(`ALTER TABLE user_routes ADD COLUMN ${name} ${definition}`).run();
    } catch (error) {
      if (!(await columns(env, "user_routes")).has(name)) throw error;
    }
  }
  await env.DB.batch([
    env.DB.prepare(`UPDATE user_routes SET owner = (SELECT username FROM users WHERE users.id = user_routes.user_id)
            WHERE COALESCE(owner, '') = '' AND EXISTS (SELECT 1 FROM users WHERE users.id = user_routes.user_id AND username <> '')`),
    env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_legacy_user_routes_owner_prefix ON user_routes(owner, prefix) WHERE owner <> ''")
  ]);
}

// src/editions/multi/storage/schema.js
var DEFAULT_USER_ROUTE_LIMIT = 20;
var DEFAULT_USER_DNS_TARGET = "youxuan.cf.090227.xyz";
var USERNAME_RE = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/;
var RESERVED_PREFIXES = /* @__PURE__ */ new Set([
  "admin",
  "api",
  "stats",
  "health",
  "register",
  "login",
  "logout",
  "favicon.ico",
  "robots.txt",
  "cdn-cgi",
  ".well-known",
  "assets",
  "static"
]);
var RESERVED_SUBDOMAINS = /* @__PURE__ */ new Set([
  "admin",
  "api",
  "www",
  "mail",
  "smtp",
  "ftp",
  "ns",
  "ns1",
  "ns2",
  "dns",
  "proxy",
  "stats",
  "health",
  "register",
  "login",
  "logout",
  "cdn",
  "static",
  "test",
  "dev",
  "staging",
  "root",
  "support",
  "help",
  "status"
]);
var UPSTREAM_FAILOVER_STATUSES = Object.freeze([502, 503, 504, 520, 521, 522, 523, 524, 525, 526, 527, 530]);
var CF_ORIGIN_ERROR_STATUSES = Object.freeze([520, 521, 522, 523, 524, 525, 526, 527, 530]);
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
var SCHEMA_ID = "multi-v6.8.5";
async function initDatabaseSchema(env2) {
  try {
    const marker = await env2.DB.prepare(`SELECT value FROM settings WHERE key = 'schema_init'`).first();
    if (marker && marker.value === SCHEMA_ID) {
      await ensureLegacyUserRoutes(env2);
      return;
    }
  } catch (_) {
  }
  await env2.DB.batch([
    env2.DB.prepare(`CREATE TABLE IF NOT EXISTS routes (
      prefix TEXT PRIMARY KEY, target TEXT NOT NULL,
      stream_target TEXT DEFAULT '',
      remark TEXT DEFAULT '', last_play TEXT DEFAULT '',
      cache_img TEXT DEFAULT 'on', compat_mode TEXT DEFAULT 'off',
      ip_mode TEXT DEFAULT 'forward',
      sort_order INTEGER DEFAULT 0,
      created_by TEXT NOT NULL DEFAULT ''
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
    // 新增：小时级聚合统计（参考 CF-EMBY-PROXY-UI proxy_stats_hourly）
    env2.DB.prepare(`CREATE TABLE IF NOT EXISTS proxy_stats_hourly (
      bucket_date TEXT NOT NULL,
      bucket_hour INTEGER NOT NULL,
      request_count INTEGER NOT NULL DEFAULT 0,
      play_count INTEGER NOT NULL DEFAULT 0,
      playback_info_count INTEGER NOT NULL DEFAULT 0,
      traffic_bytes INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (bucket_date, bucket_hour)
    )`),
    env2.DB.prepare(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT '')`),
    env2.DB.prepare(`CREATE TABLE IF NOT EXISTS route_health (
      prefix TEXT NOT NULL, target TEXT NOT NULL,
      down INTEGER NOT NULL DEFAULT 0, fail_count INTEGER NOT NULL DEFAULT 0,
      latency INTEGER NOT NULL DEFAULT -1, last_check TEXT, last_change TEXT,
      PRIMARY KEY (prefix, target)
    )`),
    env2.DB.prepare(`CREATE TABLE IF NOT EXISTS route_stats_daily (
      prefix TEXT NOT NULL, bucket_date TEXT NOT NULL,
      request_count INTEGER NOT NULL DEFAULT 0, traffic_bytes INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (prefix, bucket_date)
    )`),
    env2.DB.prepare(`CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL, action TEXT NOT NULL, detail TEXT NOT NULL DEFAULT ''
    )`),
    // ===== 多人版 =====
    env2.DB.prepare(`CREATE TABLE IF NOT EXISTS users (
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
    env2.DB.prepare(`CREATE TABLE IF NOT EXISTS invite_codes (
      code TEXT PRIMARY KEY,
      max_uses INTEGER NOT NULL DEFAULT 1,
      used_count INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      created_by TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT ''
    )`),
    env2.DB.prepare(`CREATE TABLE IF NOT EXISTS user_routes (
      owner TEXT NOT NULL,
      prefix TEXT NOT NULL,
      target TEXT NOT NULL,
      stream_target TEXT NOT NULL DEFAULT '',
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
    env2.DB.prepare(`CREATE TABLE IF NOT EXISTS user_stats_hourly (
      owner TEXT NOT NULL,
      bucket_date TEXT NOT NULL,
      bucket_hour INTEGER NOT NULL,
      request_count INTEGER NOT NULL DEFAULT 0,
      play_count INTEGER NOT NULL DEFAULT 0,
      playback_info_count INTEGER NOT NULL DEFAULT 0,
      traffic_bytes INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (owner, bucket_date, bucket_hour)
    )`)
  ]);
  try {
    await env2.DB.prepare(`ALTER TABLE routes ADD COLUMN ip_mode TEXT DEFAULT 'forward'`).run();
  } catch (e) {
  }
  try {
    await env2.DB.prepare(`ALTER TABLE routes ADD COLUMN stream_target TEXT NOT NULL DEFAULT ''`).run();
  } catch (e) {
  }
  try {
    await env2.DB.prepare(`ALTER TABLE user_routes ADD COLUMN stream_target TEXT NOT NULL DEFAULT ''`).run();
  } catch (e) {
  }
  try {
    await env2.DB.prepare(`ALTER TABLE users ADD COLUMN subdomain TEXT NOT NULL DEFAULT ''`).run();
  } catch (e) {
  }
  try {
    await env2.DB.prepare(`ALTER TABLE users ADD COLUMN route_limit INTEGER NOT NULL DEFAULT 20`).run();
  } catch (e) {
  }
  try {
    await env2.DB.prepare(`ALTER TABLE users ADD COLUMN last_login TEXT NOT NULL DEFAULT ''`).run();
  } catch (e) {
  }
  try {
    await env2.DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_subdomain ON users(subdomain) WHERE subdomain <> ''`).run();
  } catch (e) {
  }
  for (const col of [
    `max_uses INTEGER NOT NULL DEFAULT 1`,
    `used_count INTEGER NOT NULL DEFAULT 0`,
    `expires_at TEXT NOT NULL DEFAULT ''`,
    `note TEXT NOT NULL DEFAULT ''`,
    `created_by TEXT NOT NULL DEFAULT ''`,
    `created_at TEXT NOT NULL DEFAULT ''`
  ]) {
    try {
      await env2.DB.prepare(`ALTER TABLE invite_codes ADD COLUMN ${col}`).run();
    } catch (e) {
    }
  }
  await ensureLegacyUserRoutes(env2);
  try {
    await env2.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_user_routes_owner ON user_routes(owner)`).run();
  } catch (e) {
  }
  try {
    await env2.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_user_stats_owner ON user_stats_hourly(owner, bucket_date)`).run();
  } catch (e) {
  }
  for (const col of [
    `enabled INTEGER NOT NULL DEFAULT 1`,
    `custom_headers TEXT NOT NULL DEFAULT ''`,
    `ip_allow TEXT NOT NULL DEFAULT ''`,
    `ip_block TEXT NOT NULL DEFAULT ''`,
    // 路由归属：记录是哪个管理员添加的。老数据为空字符串，视为「历史路由」，
    // 仍在代理链路里生效，但不会出现在任何管理员的「我的路由」里。
    `created_by TEXT NOT NULL DEFAULT ''`
  ]) {
    try {
      await env2.DB.prepare(`ALTER TABLE routes ADD COLUMN ${col}`).run();
    } catch (e) {
    }
  }
  try {
    await env2.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_routes_created_by ON routes(created_by)`).run();
  } catch (e) {
  }
  try {
    let hasUserId = false;
    try {
      await env2.DB.prepare("SELECT user_id FROM routes LIMIT 1").first();
      hasUserId = true;
    } catch (_) {
    }
    if (hasUserId) {
      const done = await env2.DB.prepare("SELECT value FROM settings WHERE key = 'route_owner_from_user_id_v1'").first();
      if (!done) {
        await env2.DB.prepare(`UPDATE routes
              SET created_by = COALESCE((SELECT username FROM users WHERE users.id = routes.user_id), '')
            WHERE user_id IS NOT NULL AND user_id <> '' AND CAST(user_id AS INTEGER) > 0`).run();
        await env2.DB.prepare("INSERT INTO settings (key, value) VALUES ('route_owner_from_user_id_v1', '1') ON CONFLICT(key) DO UPDATE SET value = '1'").run();
      }
    }
  } catch (e) {
  }
  try {
    await env2.DB.prepare(`ALTER TABLE proxy_stats_hourly ADD COLUMN traffic_bytes INTEGER NOT NULL DEFAULT 0`).run();
  } catch (e) {
  }
  try {
    await env2.DB.prepare(`ALTER TABLE proxy_stats_hourly ADD COLUMN play_count INTEGER NOT NULL DEFAULT 0`).run();
  } catch (e) {
  }
  try {
    await env2.DB.prepare(`ALTER TABLE proxy_stats_hourly ADD COLUMN playback_info_count INTEGER NOT NULL DEFAULT 0`).run();
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

// src/editions/multi/config/settings.js
var settingsCache = { exp: 0, v: null };
var XFO_CURRENT = "SAMEORIGIN";
function normalizeXfo(value) {
  const v = String(value || "").trim().toLowerCase();
  return v === "deny" ? "DENY" : ["off", "none", "0"].includes(v) ? "" : "SAMEORIGIN";
}
function invalidateSettingsCache() {
  settingsCache = { exp: 0, v: null };
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
    domainProxyRules: { ...DOMAIN_PROXY_RULES, ...rules },
    // VPS 中继：默认启用（relay_enabled 缺省 = 开）；未配置 url/secret 时自然不生效
    relayUrl: String(raw.relay_url || "").trim(),
    relaySecret: String(raw.relay_secret || "").trim(),
    relayEnabled: String(raw.relay_enabled == null ? "1" : raw.relay_enabled) !== "0"
  };
  XFO_CURRENT = normalizeXfo(raw.x_frame_options);
  settingsCache = { exp: now + 3e4, v };
  return v;
}
async function setSetting(env2, key, value) {
  await env2.DB.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(key, String(value)).run();
  settingsCache = { exp: 0, v: null };
}
var SETTING_KEYS = ["health_check", "rate_limit_per_min", "manual_redirect_domains", "domain_proxy_rules", "tg_daily_report", "tg_route_alerts", "x_frame_options", "relay_url", "relay_secret", "relay_enabled"];
function publicSettings(raw) {
  return Object.fromEntries(Object.entries(raw).filter(([key]) => SETTING_KEYS.includes(key) && key !== "relay_secret"));
}

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

// src/editions/multi/integrations/zone.js
function getUserDomain(env2) {
  const raw = envStr(env2, "USER_DOMAIN", "ENTRY_DOMAIN", "USER_BASE_DOMAIN");
  if (raw) {
    return raw.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/:\d+$/, "").replace(/^\.+|\.+$/g, "");
  }
  const base = getBaseDomain(env2);
  const dns = getDnsRecordName(env2);
  if (base && dns && base !== dns && base.startsWith(dns + ".")) {
    const rest = base.slice(dns.length + 1);
    if (rest.includes("."))
      return rest;
  }
  return base;
}
function getStatsHost(env2) {
  const override = envStr(env2, "STATS_HOSTS").split(/[\s,]+/).filter(Boolean)[0] || "";
  if (override)
    return override.toLowerCase();
  const base = getBaseDomain(env2);
  const dns = getDnsRecordName(env2);
  if (base && dns && base !== dns && base.startsWith(dns + "."))
    return base;
  return toFqdn(dns, base).toLowerCase();
}
var zoneInfoCaches = /* @__PURE__ */ new Map();
async function resolveZoneInfo(env2, force = false, host = "") {
  const envZone = envStr(env2, "CF_ZONE_ID");
  const envAccount = envStr(env2, "CF_ACCOUNT_ID");
  const base = getBaseDomain(env2);
  const target = String(host || getUserDomain(env2) || base || "").toLowerCase().replace(/^\.+|\.+$/g, "").replace(/:\d+$/, "");
  if (envZone && envAccount)
    return { zoneId: envZone, accountId: envAccount, zoneName: target || base, base: target || base, host: target, error: "", from: "env" };
  const cached2 = zoneInfoCaches.get(target);
  if (!force && cached2 && Date.now() - cached2.at < 6e5)
    return cached2;
  const token = getCFApiToken(env2);
  if (!target)
    return { zoneId: envZone, accountId: envAccount, zoneName: "", base, host: "", error: "\u672A\u914D\u7F6E BASE_DOMAIN / USER_DOMAIN", from: "none" };
  if (!token)
    return { zoneId: envZone, accountId: envAccount, zoneName: target, base: target, host: target, error: "\u672A\u914D\u7F6E CF_API_TOKEN", from: "none" };
  try {
    const { zone, error: error3 } = await findZoneForHost(env2, target);
    const info3 = {
      at: Date.now(),
      base: target,
      host: target,
      zoneId: envZone || zone && zone.id || "",
      accountId: envAccount || zone && zone.account && zone.account.id || "",
      zoneName: zone && zone.name || target,
      error: zone ? "" : error3 || "\u672A\u627E\u5230\u8BE5\u57DF\u540D\u6240\u5C5E\u533A\u57DF",
      from: envZone ? "env+api" : "api"
    };
    zoneInfoCaches.set(target, info3);
    return info3;
  } catch (e) {
    return { zoneId: envZone, accountId: envAccount, zoneName: target, base: target, host: target, error: String(e?.message || e), from: "none" };
  }
}
function invalidateZoneInfoCache() {
  zoneInfoCaches.clear();
}

// src/editions/multi/config/private-store.js
var initialized = /* @__PURE__ */ new WeakMap();
async function privateStore(env) {
  if (!env.DB) throw new Error("DB \u672A\u7ED1\u5B9A");
  if (!initialized.has(env.DB)) {
    const ready = env.DB.batch([
      env.DB.prepare("CREATE TABLE IF NOT EXISTS multi_private (key TEXT PRIMARY KEY, value TEXT NOT NULL)"),
      env.DB.prepare(`CREATE TRIGGER IF NOT EXISTS multi_password_session_epoch
                AFTER UPDATE OF password_hash, salt ON users
                WHEN NEW.password_hash IS NOT OLD.password_hash OR NEW.salt IS NOT OLD.salt
                BEGIN
                    INSERT INTO multi_private (key, value) VALUES ('user_epoch:' || NEW.id, lower(hex(randomblob(32))))
                    ON CONFLICT(key) DO UPDATE SET value = excluded.value;
                END`)
    ]);
    initialized.set(env.DB, ready);
    ready.catch(() => initialized.delete(env.DB));
  }
  await initialized.get(env.DB);
  return env.DB;
}
async function getPrivate(env, key) {
  if (!env.DB) return null;
  const db = await privateStore(env);
  const row = await db.prepare("SELECT value FROM multi_private WHERE key = ?").bind(key).first();
  return row ? row.value : null;
}
async function putPrivate(env, key, value) {
  const db = await privateStore(env);
  await db.prepare("INSERT INTO multi_private (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(key, value).run();
}
async function replacePrivate(env, key, previous, value) {
  const db = await privateStore(env);
  const result = previous === null ? await db.prepare("INSERT OR IGNORE INTO multi_private (key, value) VALUES (?, ?)").bind(key, value).run() : await db.prepare("UPDATE multi_private SET value = ? WHERE key = ? AND value = ?").bind(value, key, previous).run();
  return result.meta?.changes === 1;
}

// src/editions/multi/config/notifications.js
var enc = new TextEncoder();
var aad = enc.encode("emby-multi:telegram:v1");
var toBase64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
var fromBase64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
async function encryptionKey(env, source = null) {
  const configured = String(env.SETTINGS_ENCRYPTION_KEY || "");
  if (source === "settings" || source === null && configured) {
    try {
      const bytes2 = fromBase64(configured);
      return bytes2.length === 32 ? { bytes: bytes2, source: "settings" } : null;
    } catch {
      return null;
    }
  }
  if (source && source !== "session") return null;
  const root = String(env.SESSION_SECRET || "");
  if (enc.encode(root).length < 32) return null;
  const key = await crypto.subtle.importKey("raw", enc.encode(root), "HKDF", false, ["deriveBits"]);
  const bytes = new Uint8Array(await crypto.subtle.deriveBits({
    name: "HKDF",
    hash: "SHA-256",
    salt: enc.encode("emby-multi:private-config:v1"),
    info: aad
  }, key, 256));
  return { bytes, source: "session" };
}
async function encryptTelegram(env, config) {
  const master = await encryptionKey(env);
  if (!master) throw new Error("\u9700\u8981 32 \u5B57\u8282 Base64 SETTINGS_ENCRYPTION_KEY \u6216\u81F3\u5C11 32 \u5B57\u8282\u7684 SESSION_SECRET");
  const key = await crypto.subtle.importKey("raw", master.bytes, "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: aad }, key, enc.encode(JSON.stringify(config)));
  return JSON.stringify({ v: 1, keySource: master.source, iv: toBase64(iv), ciphertext: toBase64(ciphertext) });
}
async function getTelegramConfig(env) {
  const saved = await getPrivate(env, "telegram");
  if (saved === null) return { token: getTelegramToken(env), chatId: getTelegramChatId(env), source: "environment" };
  if (saved === "disabled") return { token: "", chatId: "", source: "disabled" };
  try {
    const data = JSON.parse(saved);
    if (data.v !== 1 || !["settings", "session"].includes(data.keySource)) throw new Error();
    const master = await encryptionKey(env, data.keySource);
    if (!master) throw new Error();
    const key = await crypto.subtle.importKey("raw", master.bytes, "AES-GCM", false, ["decrypt"]);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(data.iv), additionalData: aad }, key, fromBase64(data.ciphertext));
    const config = JSON.parse(new TextDecoder().decode(plain));
    if (typeof config.token !== "string" || typeof config.chatId !== "string") throw new Error();
    return { ...config, source: "web" };
  } catch {
    return { token: "", chatId: "", source: "web", error: "\u901A\u77E5\u914D\u7F6E\u65E0\u6CD5\u89E3\u5BC6\uFF0C\u8BF7\u68C0\u67E5\u4E3B\u5BC6\u94A5\u6216\u91CD\u65B0\u4FDD\u5B58\u914D\u7F6E" };
  }
}
async function notificationStatus(env) {
  const config = await getTelegramConfig(env);
  let last = null;
  try {
    last = JSON.parse(await getPrivate(env, "notification_last") || "null");
  } catch {
  }
  return {
    telegram: Boolean(config.token && config.chatId),
    webhook: Boolean(env.NOTIFY_WEBHOOK),
    tokenConfigured: Boolean(config.token),
    chatId: config.chatId,
    source: config.source,
    error: config.error || "",
    encryptionReady: Boolean(await encryptionKey(env)),
    last
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
  if (!/^-?\d{1,20}$/.test(chatId)) throw new Error("Chat ID \u5FC5\u987B\u662F\u6570\u5B57");
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
  const result = await sendTelegramMessage(await notificationEnv(env), "\u2705 Emby Proxy \u591A\u4EBA\u7248\u901A\u77E5\u6D4B\u8BD5\u6210\u529F\uFF08\u4E0D\u5305\u542B\u7EBF\u8DEF\u5730\u5740\uFF09");
  await recordNotification(env, "test", result.ok);
  return { ok: result.ok, error: result.ok ? "" : "\u6D4B\u8BD5\u53D1\u9001\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u673A\u5668\u4EBA\u3001Chat ID \u548C\u53D1\u9001\u6743\u9650" };
}

// src/editions/multi/integrations/analytics.js
async function cfGetAccountHttp(cfAccountId, cfApiToken, startIso, endIso, useHostDim = true) {
  const dims = useHostDim ? "datetimeHour clientRequestHTTPHost" : "datetimeHour";
  const query = `query { viewer { accounts(filter: { accountTag: ${toGraphQLStr(cfAccountId)} }) { series: httpRequestsAdaptiveGroups(limit: 10000, filter: { datetime_geq: ${toGraphQLStr(startIso)}, datetime_leq: ${toGraphQLStr(endIso)} }) { count dimensions { ${dims} } sum { edgeResponseBytes visits } } } } }`;
  const data = await cfFetchGraphql(cfApiToken, query);
  return data?.data?.viewer?.accounts?.[0] || null;
}
var workerHostCache = { at: 0, key: "", set: null };
async function getWorkerHosts(env2) {
  const userDomain = getUserDomain(env2);
  const main = getStatsHost(env2);
  const cacheKey = (userDomain || "") + "|" + (main || "") + "|" + (env2.DB ? "db" : "nodb");
  if (workerHostCache.set && workerHostCache.key === cacheKey && Date.now() - workerHostCache.at < 6e4) {
    return workerHostCache.set;
  }
  const set = /* @__PURE__ */ new Set();
  for (const h of envStr(env2, "STATS_HOSTS").split(/[\s,]+/).filter(Boolean))
    set.add(h.toLowerCase());
  if (main)
    set.add(main);
  if (env2.DB && userDomain) {
    try {
      const { results } = await env2.DB.prepare("SELECT username, subdomain FROM users").all();
      for (const u of results || []) {
        const sub = String(u?.subdomain || u?.username || "").trim().toLowerCase();
        if (sub)
          set.add(sub + "." + userDomain);
      }
    } catch (_) {
    }
  }
  workerHostCache.at = Date.now();
  workerHostCache.key = cacheKey;
  workerHostCache.set = set;
  return set;
}
function makeHostMatcher(env2, hostSet) {
  const userDomain = String(getUserDomain(env2) || "").toLowerCase();
  const main = String(getStatsHost(env2) || "").toLowerCase();
  const explicit = hostSet ? new Set([...hostSet].map((host) => String(host).trim().toLowerCase().replace(/:\d+$/, ""))) : null;
  return (raw) => {
    const h = String(raw || "").toLowerCase().replace(/:\d+$/, "");
    if (!h)
      return false;
    if (explicit) return explicit.has(h);
    if (main && h === main)
      return true;
    if (userDomain && (h === userDomain || h.endsWith("." + userDomain)))
      return true;
    return false;
  };
}
async function cfGetZoneSummary(env2, dateKey, hostSet = null) {
  if (hostSet && !hostSet.size) return { error: "\u672A\u914D\u7F6E\u7EDF\u8BA1\u57DF\u540D\u8303\u56F4" };
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
    if (hostSet) return { error: "CF \u672A\u63D0\u4F9B\u6307\u5B9A\u57DF\u540D\u7684\u7EDF\u8BA1\u7EF4\u5EA6" };
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
  if (hostSet && !hostDim) return { error: "CF \u672A\u63D0\u4F9B\u6307\u5B9A\u57DF\u540D\u7684\u7EDF\u8BA1\u7EF4\u5EA6" };
  if (hostSet && zone.series.length >= 1e4) return { error: "CF \u6307\u5B9A\u57DF\u540D\u7EDF\u8BA1\u67E5\u8BE2\u8FBE\u5230\u4E0A\u9650\uFF0C\u65E0\u6CD5\u5B89\u5168\u6C47\u603B" };
  const statsHost = getStatsHost(env2);
  const wanted = hostSet && hostSet.size ? makeHostMatcher(env2, hostSet) : statsHost ? makeHostMatcher(env2, /* @__PURE__ */ new Set([statsHost])) : null;
  const matches = (item) => {
    if (!wanted)
      return true;
    return wanted(item?.dimensions?.clientRequestHTTPHost);
  };
  const rows = hostDim ? zone.series.filter(matches) : zone.series;
  let hostMatched = true;
  let useRows = rows;
  if (hostDim && wanted && rows.length === 0) {
    hostMatched = false;
    if (hostSet) return { error: "CF \u672A\u8FD4\u56DE\u6307\u5B9A\u57DF\u540D\u7684\u6570\u636E", hostDim, hostMatched };
    useRows = zone.series;
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
        if (h >= 0 && h < 24)
          hourly[h] += n;
      }
    }
    return { requests, visits, bytes, hourly };
  };
  const total = sumRows(useRows);
  const mainRows = hostDim && statsHost ? useRows.filter((it) => String(it?.dimensions?.clientRequestHTTPHost || "").toLowerCase() === statsHost) : useRows;
  const main = sumRows(mainRows);
  return {
    requests: total.requests,
    visits: total.visits,
    bytes: total.bytes,
    hourly: total.hourly,
    mainRequests: main.requests,
    mainVisits: main.visits,
    mainBytes: main.bytes,
    zoneId: info3.zoneId,
    zoneName: info3.zoneName,
    statsHost,
    hostMatched,
    hostDim,
    note: hostMatched ? "" : "CF \u4E2D\u672A\u627E\u5230 " + (statsHost || "Worker \u57DF\u540D") + " \u7684\u6570\u636E\uFF0C\u5F53\u524D\u5C55\u793A\u6574\u4E2A Zone \u6C47\u603B\uFF1B\u8BF7\u68C0\u67E5 DNS_RECORD_NAME / STATS_HOSTS",
    warning: firstError ? "\u6309\u57DF\u540D\u5206\u7EC4\u67E5\u8BE2\u5931\u8D25\uFF0C\u5DF2\u9000\u56DE Zone \u6C47\u603B: " + firstError.slice(0, 120) : ""
  };
}
async function cfGetZoneDailySeries(env2, days = 7, hostSet = null) {
  if (hostSet && !hostSet.size) return { error: "\u672A\u914D\u7F6E\u7EDF\u8BA1\u57DF\u540D\u8303\u56F4", series: [] };
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
  const buildQuery = (hostFilter) => {
    const hostPart = hostFilter ? `, clientRequestHTTPHost: ${toGraphQLStr(hostFilter)}` : "";
    return `query { viewer { zones(filter: { zoneTag: ${toGraphQLStr(info3.zoneId)} }) { series: httpRequestsAdaptiveGroups(limit: 10000, filter: { datetime_geq: ${toGraphQLStr(start)}, datetime_leq: ${toGraphQLStr(end)}${hostPart} }) { count dimensions { datetimeHour clientRequestHTTPHost } sum { edgeResponseBytes visits } } } } }`;
  };
  let rows = null;
  let hostFilterUsed = false;
  if (statsHost && !hostSet) {
    try {
      const zone = await cfFetchGraphql(token, buildQuery(statsHost));
      const r = zone?.data?.viewer?.zones?.[0]?.series;
      if (Array.isArray(r)) {
        rows = r;
        hostFilterUsed = true;
      }
    } catch (_) {
    }
  }
  if (!hostFilterUsed) {
    try {
      const zone = await cfFetchGraphql(token, buildQuery(""));
      const r = zone?.data?.viewer?.zones?.[0]?.series;
      if (Array.isArray(r))
        rows = r;
    } catch (e) {
      return { error: String(e?.message || e).slice(0, 200) };
    }
  }
  if (!Array.isArray(rows))
    return { error: "CF \u672A\u8FD4\u56DE\u6570\u636E" };
  if (hostSet && rows.length >= 1e4) return { error: "CF \u6307\u5B9A\u57DF\u540D\u7EDF\u8BA1\u67E5\u8BE2\u8FBE\u5230\u4E0A\u9650\uFF0C\u65E0\u6CD5\u5B89\u5168\u6C47\u603B", series: [] };
  const wanted = hostSet ? makeHostMatcher(env2, hostSet) : null;
  const map = /* @__PURE__ */ new Map();
  let hostMatched = hostFilterUsed;
  for (const item of rows) {
    const h = String(item?.dimensions?.clientRequestHTTPHost || "").toLowerCase();
    if (wanted ? !wanted(h) : statsHost && h !== statsHost)
      continue;
    hostMatched = true;
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
  if (hostSet && !hostMatched) return { error: "CF \u672A\u8FD4\u56DE\u6307\u5B9A\u57DF\u540D\u7684\u6570\u636E", series: [] };
  if (statsHost && !hostMatched)
    return { error: "CF \u4E2D\u672A\u627E\u5230 " + statsHost + " \u7684\u6570\u636E", series: [] };
  const series = [];
  for (let i = 0; i < days; i++) {
    const key = new Date((/* @__PURE__ */ new Date(startDate + "T00:00:00Z")).getTime() + i * 864e5).toISOString().slice(0, 10);
    const r = map.get(key) || { requests: 0, traffic: 0, visits: 0 };
    series.push({ date: key, requests: r.requests, traffic: r.traffic, visits: r.visits });
  }
  return { series, zoneId: info3.zoneId, zoneName: info3.zoneName, statsHost, hostMatched };
}
async function cfGetAccountSummary(env2, dateKey, hostSet = null) {
  if (hostSet && !hostSet.size) return { error: "\u672A\u914D\u7F6E\u7EDF\u8BA1\u57DF\u540D\u8303\u56F4" };
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
  let account = null;
  let hostDim = true;
  let firstError = "";
  try {
    account = await cfGetAccountHttp(info3.accountId, token, start, end, true);
  } catch (e) {
    if (hostSet) return { error: "CF \u672A\u63D0\u4F9B\u6307\u5B9A\u57DF\u540D\u7684\u7EDF\u8BA1\u7EF4\u5EA6" };
    firstError = String(e?.message || e);
    hostDim = false;
    try {
      account = await cfGetAccountHttp(info3.accountId, token, start, end, false);
    } catch (e2) {
      return { error: String(e2?.message || e2).slice(0, 240) };
    }
  }
  if (!account?.series)
    return { error: "\u8D26\u53F7\u5206\u6790\u672A\u8FD4\u56DE\u6570\u636E\uFF08Token \u9700 Account Analytics:Read \u6743\u9650\uFF09" };
  if (hostSet && !hostDim) return { error: "CF \u672A\u63D0\u4F9B\u6307\u5B9A\u57DF\u540D\u7684\u7EDF\u8BA1\u7EF4\u5EA6" };
  if (hostDim && account.series.length >= 1e4) {
    if (hostSet) return { error: "CF \u6307\u5B9A\u57DF\u540D\u7EDF\u8BA1\u67E5\u8BE2\u8FBE\u5230\u4E0A\u9650\uFF0C\u65E0\u6CD5\u5B89\u5168\u6C47\u603B" };
    try {
      const plain = await cfGetAccountHttp(info3.accountId, token, start, end, false);
      if (Array.isArray(plain?.series)) {
        account = plain;
        hostDim = false;
      }
    } catch (_) {
    }
  }
  const statsHost = getStatsHost(env2);
  const wanted = hostSet && hostSet.size ? makeHostMatcher(env2, hostSet) : null;
  let hostMatched = Boolean(hostDim && wanted);
  let rows = hostDim && wanted ? account.series.filter((it) => wanted(it?.dimensions?.clientRequestHTTPHost)) : account.series;
  if (hostDim && wanted && rows.length === 0) {
    hostMatched = false;
    return { error: "CF \u672A\u8FD4\u56DE\u6307\u5B9A\u57DF\u540D\u7684\u6570\u636E", hostDim, hostMatched };
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
      const hHost = String(item?.dimensions?.clientRequestHTTPHost || "").toLowerCase();
      if (hHost) {
        const cur = byHost[hHost] || { requests: 0, bytes: 0, visits: 0 };
        cur.requests += n;
        cur.bytes += b;
        cur.visits += Number(item?.sum?.visits) || 0;
        byHost[hHost] = cur;
      }
      const raw = item?.dimensions?.datetimeHour;
      if (raw) {
        const h = (new Date(raw).getUTCHours() + 8) % 24;
        if (h >= 0 && h < 24)
          hourly[h] += n;
      }
    }
    return { requests, visits, bytes, hourly, byHost };
  };
  const total = sumRows(rows);
  const mainRows = hostDim && statsHost ? rows.filter((it) => String(it?.dimensions?.clientRequestHTTPHost || "").toLowerCase().replace(/:\d+$/, "") === statsHost) : rows;
  const main = sumRows(mainRows);
  return {
    requests: total.requests,
    visits: total.visits,
    bytes: total.bytes,
    hourly: total.hourly,
    byHost: total.byHost,
    mainRequests: main.requests,
    mainVisits: main.visits,
    mainBytes: main.bytes,
    accountId: info3.accountId,
    statsHost,
    hostMatched,
    hostDim,
    source: "account",
    note: hostMatched ? "" : "\u8D26\u53F7\u5206\u6790\u4E2D\u672A\u5339\u914D\u5230 Worker \u57DF\u540D\uFF0C\u5F53\u524D\u4F7F\u7528\u8D26\u53F7\u603B\u91CF",
    warning: firstError ? "\u6309\u57DF\u540D\u5206\u7EC4\u67E5\u8BE2\u5931\u8D25\uFF0C\u5DF2\u9000\u56DE\u8D26\u53F7\u6C47\u603B: " + firstError.slice(0, 120) : ""
  };
}
async function cfGetAccountDailySeries(env2, days = 7, hostSet = null) {
  if (hostSet && !hostSet.size) return { error: "\u672A\u914D\u7F6E\u7EDF\u8BA1\u57DF\u540D\u8303\u56F4", series: [] };
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
    return { error: "\u672A\u89E3\u6790\u5230 CF_ACCOUNT_ID" };
  const today = getShanghaiParts().dateKey;
  const startDate = new Date((/* @__PURE__ */ new Date(today + "T00:00:00Z")).getTime() - (days - 1) * 864e5).toISOString().slice(0, 10);
  const start = (/* @__PURE__ */ new Date(startDate + "T00:00:00+08:00")).toISOString();
  const end = new Date((/* @__PURE__ */ new Date(today + "T00:00:00+08:00")).getTime() + 864e5 - 1).toISOString();
  let rows = null;
  let truncated = false;
  try {
    const acc = await cfGetAccountHttp(info3.accountId, token, start, end, true);
    rows = Array.isArray(acc?.series) ? acc.series : null;
    truncated = Boolean(rows && rows.length >= 1e4);
  } catch (_) {
  }
  if (!Array.isArray(rows) || truncated) {
    if (hostSet) return { error: "CF \u6307\u5B9A\u57DF\u540D\u7EDF\u8BA1\u7EF4\u5EA6\u4E0D\u53EF\u7528\u6216\u8FBE\u5230\u67E5\u8BE2\u4E0A\u9650", series: [] };
    try {
      const acc = await cfGetAccountHttp(info3.accountId, token, start, end, false);
      rows = Array.isArray(acc?.series) ? acc.series : null;
    } catch (e) {
      return { error: String(e?.message || e).slice(0, 200) };
    }
  }
  if (!Array.isArray(rows))
    return { error: "\u8D26\u53F7\u5206\u6790\u672A\u8FD4\u56DE\u6570\u636E" };
  const wanted = hostSet && hostSet.size ? makeHostMatcher(env2, hostSet) : null;
  if (wanted && !rows.some((item) => item?.dimensions?.clientRequestHTTPHost)) return { error: "CF \u672A\u63D0\u4F9B\u6307\u5B9A\u57DF\u540D\u7684\u7EDF\u8BA1\u7EF4\u5EA6", series: [] };
  if (wanted && !rows.some((item) => wanted(item?.dimensions?.clientRequestHTTPHost))) return { error: "CF \u672A\u8FD4\u56DE\u6307\u5B9A\u57DF\u540D\u7684\u6570\u636E", series: [] };
  const map = /* @__PURE__ */ new Map();
  for (const item of rows) {
    const h = String(item?.dimensions?.clientRequestHTTPHost || "").toLowerCase();
    if (wanted && !wanted(h))
      continue;
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
  return { series, accountId: info3.accountId, source: "account" };
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
  const workerHosts = await getWorkerHosts(env2);
  const acc = await cfGetAccountSummary(env2, key, workerHosts);
  const accOk = !acc.error;
  const cf = accOk ? { error: "" } : await cfGetZoneSummary(env2, key, workerHosts);
  const cfOk = !accOk && !cf.error;
  const requests = accOk ? Number(acc.requests) || 0 : cfOk ? Number(cf.requests) || 0 : null;
  const traffic = accOk ? Number(acc.bytes) || 0 : cfOk ? Number(cf.bytes) || 0 : null;
  const visits = accOk ? Number(acc.visits) || 0 : cfOk ? Number(cf.visits) || 0 : 0;
  let daily = [];
  if (accOk) {
    const s = await cfGetAccountDailySeries(env2, 7, workerHosts);
    if (!s.error && Array.isArray(s.series))
      daily = s.series;
  } else if (cfOk) {
    const zs = await cfGetZoneDailySeries(env2, 7, workerHosts);
    if (!zs.error && Array.isArray(zs.series))
      daily = zs.series;
  }
  const lines = [];
  lines.push("\u{1F4CA} <b>Emby Proxy \u65E5\u62A5</b>");
  lines.push("<code>" + tgEscape(key) + "</code>");
  lines.push("");
  lines.push("\u8BF7\u6C42\u6570\uFF1A" + (requests == null ? "\uFF08CF \u6570\u636E\u4E0D\u53EF\u7528\uFF09" : "<b>" + requests + "</b>"));
  lines.push("\u51FA\u7AD9\u6D41\u91CF\uFF1A" + (traffic == null ? "\uFF08CF \u6570\u636E\u4E0D\u53EF\u7528\uFF09" : "<b>" + formatBytes(traffic) + "</b>"));
  if (accOk || cfOk)
    lines.push("CF \u8BBF\u95EE\u91CF\uFF1A<b>" + visits + "</b>");
  if (accOk && acc.hostDim) lines.push("\u5176\u4E2D\u4E3B\u5165\u53E3\uFF1A" + (Number(acc.mainRequests) || 0) + " \u6B21 / " + formatBytes(Number(acc.mainBytes) || 0));
  else if (cfOk && cf.hostDim) lines.push("\u5176\u4E2D\u4E3B\u5165\u53E3\uFF1A" + (Number(cf.mainRequests) || 0) + " \u6B21 / " + formatBytes(Number(cf.mainBytes) || 0));
  if (daily.length) {
    lines.push("");
    lines.push("<b>\u8FD1 7 \u65E5\uFF08\u5168\u7AD9\uFF09</b>");
    for (const d of daily) {
      lines.push(d.date + "  " + d.requests + " \u6B21 / " + formatBytes(d.traffic));
    }
  }
  if (!accOk) {
    lines.push("");
    lines.push("<i>\u8D26\u53F7\u5206\u6790\u4E0D\u53EF\u7528\uFF0C" + (cfOk ? "\u5DF2\u4F7F\u7528 Zone \u7EDF\u8BA1" : "\u8BF7\u767B\u5F55\u540E\u53F0\u68C0\u67E5\u7EDF\u8BA1\u914D\u7F6E") + "</i>");
  } else if (acc.hostMatched === false) {
    lines.push("");
    lines.push("<i>\u8D26\u53F7\u5206\u6790\u4E2D\u672A\u5339\u914D\u5230 Worker \u57DF\u540D\uFF0C\u5F53\u524D\u4E3A\u8D26\u53F7\u603B\u91CF</i>");
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
var statsBuffer = /* @__PURE__ */ new Map();
var routeStatsBuffer = /* @__PURE__ */ new Map();
var userStatsBuffer = /* @__PURE__ */ new Map();
var statsBufferCount = 0;
function clearStatsBuffers() {
  statsBuffer.clear();
  routeStatsBuffer.clear();
  userStatsBuffer.clear();
  statsBufferCount = 0;
}
var statsLastFlush = Date.now();

// src/editions/multi/auth/password.js
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
  const raw = await getPrivate(env, "admin_password");
  if (raw === null) return { raw, record: null };
  const record = JSON.parse(raw);
  if (record.v !== 1 || record.iterations !== ITERATIONS || !/^[a-f0-9]{32}$/.test(record.salt) || !/^[a-f0-9]{64}$/.test(record.hash) || !/^[a-f0-9]{64}$/.test(record.epoch)) throw new Error("\u767B\u5F55\u914D\u7F6E\u65E0\u6548");
  return { raw, record };
}
async function passwordHash(env, password, salt) {
  const root = getAdminToken(env);
  if (!root) throw new Error("Worker \u672A\u914D\u7F6E ADMIN_TOKEN");
  const input = await keyedHash(root, "multi-admin-password:" + password);
  const key = await crypto.subtle.importKey("raw", enc2.encode(input), "PBKDF2", false, ["deriveBits"]);
  return toHex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc2.encode(salt), iterations: ITERATIONS }, key, 256));
}
async function verifyAdminPassword(env, password, state = null) {
  const root = getAdminToken(env);
  if (!root || typeof password !== "string" || password.length > 1024) return false;
  state ||= await credentialState(env);
  if (!state.record) return equal(await keyedHash(root, "compare:" + password), await keyedHash(root, "compare:" + root));
  return equal(await passwordHash(env, password, state.record.salt), state.record.hash);
}
async function changeAdminPassword(env, currentPassword, newPassword) {
  if (typeof newPassword !== "string" || newPassword.length < 12 || newPassword.length > 128) return { ok: false, status: 400, error: "\u65B0\u5BC6\u7801\u987B\u4E3A 12\u2013128 \u4E2A\u5B57\u7B26" };
  const state = await credentialState(env);
  if (!await verifyAdminPassword(env, currentPassword, state)) return { ok: false, status: 403, error: "\u5F53\u524D\u5BC6\u7801\u9519\u8BEF" };
  if (currentPassword === newPassword) return { ok: false, status: 400, error: "\u65B0\u5BC6\u7801\u4E0D\u80FD\u4E0E\u5F53\u524D\u5BC6\u7801\u76F8\u540C" };
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
  const record = { v: 1, iterations: ITERATIONS, salt, hash: await passwordHash(env, newPassword, salt), epoch: toHex(crypto.getRandomValues(new Uint8Array(32))) };
  const ok = await replacePrivate(env, "admin_password", state.raw, JSON.stringify(record));
  return ok ? { ok: true } : { ok: false, status: 409, error: "\u5BC6\u7801\u5DF2\u88AB\u5176\u4ED6\u64CD\u4F5C\u66F4\u65B0\uFF0C\u8BF7\u91CD\u65B0\u767B\u5F55" };
}

// src/editions/multi/integrations/alert-privacy.js
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
async function notificationId(env, routeKey) {
  const secret = getAdminToken(env) || String(env.SESSION_SECRET || "");
  return secret ? "R-" + (await keyedHash(secret, "multi-notification-route:" + routeKey)).slice(0, 12).toUpperCase() : "R-UNKNOWN";
}
async function privateHealthAlert(env, routeKey, index, down, { remark = "", targets = [], owner = "" } = {}) {
  const privateValues = Object.entries(env).filter(([key, value]) => typeof value === "string" && /token|secret|password|key/i.test(key)).map(([, value]) => value);
  if (owner) privateValues.push(owner);
  for (const target of targets) {
    try {
      const url = new URL(target);
      privateValues.push(url.hostname, url.pathname, ...url.searchParams.values(), decodeURIComponent(url.username), decodeURIComponent(url.password));
    } catch {
    }
  }
  const name = safeRouteRemark(remark, privateValues);
  const label = name ? escapeTelegramHtml(name) : await notificationId(env, routeKey);
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

// src/editions/multi/proxy/stream-targets.js
function getStreamTargetParts(raw) {
  try {
    const url = new URL(raw);
    if (!isValidHttpUrl(raw) || url.username || url.password || url.search || url.hash || isPrivateHost(url.hostname))
      return null;
    return { origin: url.origin, base: url.pathname.replace(/\/+$/, "") };
  } catch {
    return null;
  }
}
function matchStreamTarget(url, targets) {
  if (!url || !["http:", "https:"].includes(url.protocol) || url.username || url.password || isPrivateHost(url.hostname))
    return null;
  let match = null;
  for (let index = 0; index < targets.length; index++) {
    const parts = getStreamTargetParts(targets[index]);
    if (!parts || url.origin !== parts.origin)
      continue;
    if (url.pathname !== parts.base && !url.pathname.startsWith(parts.base + "/"))
      continue;
    if (!match || parts.base.length > match.base.length)
      match = { ...parts, index };
  }
  return match;
}
function getStreamProxyLocation(request, target, targets, routePath) {
  const match = matchStreamTarget(target, targets);
  if (!match || !routePath)
    return "";
  return new URL(request.url).origin + routePath + "/__stream/" + match.index + target.pathname.slice(match.base.length) + target.search + target.hash;
}
function rewritePlaybackStreamUrls(data, request, targets, routePath, upstreamUrl, onMapped = void 0) {
  let changed = false;
  const rewrite = (obj, key) => {
    const value = obj && obj[key];
    if (typeof value !== "string" || !/^(?:https?:)?\/\//i.test(value))
      return;
    try {
      const target = new URL(value, upstreamUrl);
      const location = getStreamProxyLocation(request, target, targets, routePath);
      if (location && location !== value) {
        obj[key] = location;
        changed = true;
        onMapped?.(target);
      }
    } catch {
    }
  };
  for (const source of Array.isArray(data?.MediaSources) ? data.MediaSources : []) {
    rewrite(source, "DirectStreamUrl");
    rewrite(source, "TranscodingUrl");
    for (const stream of Array.isArray(source?.MediaStreams) ? source.MediaStreams : [])
      rewrite(stream, "DeliveryUrl");
  }
  return changed;
}

// src/editions/multi/proxy/routes.js
function validateUserPrefix(prefix) {
  const a = normalizePrefix(prefix);
  if (!a || !/^[a-z0-9][a-z0-9_-]{0,62}$/i.test(a))
    return "\u8DEF\u5F84\u4EC5\u5141\u8BB8\u5B57\u6BCD\u6570\u5B57\u3001\u4E0B\u5212\u7EBF\u548C\u8FDE\u5B57\u7B26";
  if (RESERVED_PREFIXES.has(a.toLowerCase()))
    return "\u8BE5\u8DEF\u5F84\u4E3A\u7CFB\u7EDF\u4FDD\u7559\uFF0C\u4E0D\u53EF\u4F7F\u7528";
  return null;
}
var ownerCache = /* @__PURE__ */ new Map();
function clearOwnerCache() {
  ownerCache.clear();
}
async function resolveOwnerFromHost(env2, host) {
  const h = String(host || "").toLowerCase().replace(/:\d+$/, "");
  const base = getBaseDomain(env2);
  const userDomain = getUserDomain(env2);
  if (!h)
    return "";
  if (h === base || h === userDomain)
    return "";
  const dnsName = getDnsRecordName(env2);
  if (dnsName && h === toFqdn(dnsName, base))
    return "";
  if (h === getStatsHost(env2))
    return "";
  const zones = [];
  if (userDomain)
    zones.push(userDomain);
  if (base && base !== userDomain)
    zones.push(base);
  let sub = "";
  for (const z of zones) {
    if (h === z)
      return "";
    if (!h.endsWith("." + z))
      continue;
    const cand = h.slice(0, -(z.length + 1));
    if (cand && !cand.includes(".") && !RESERVED_SUBDOMAINS.has(cand)) {
      sub = cand;
      break;
    }
  }
  const lookupOwner = async (name) => {
    if (!env2.DB)
      return "";
    try {
      const row = await env2.DB.prepare("SELECT username FROM users WHERE (subdomain = ? OR username = ?) AND status = 'active'").bind(name, name).first();
      return row && row.username ? row.username : "";
    } catch (_) {
      return "";
    }
  };
  const now = Date.now();
  const cacheKey = sub || h;
  const hit = ownerCache.get(cacheKey);
  if (hit && hit.exp > now)
    return hit.owner;
  let owner = "";
  if (sub) {
    owner = await lookupOwner(sub) || sub;
  } else {
    const first = h.split(".")[0] || "";
    if (!first || RESERVED_SUBDOMAINS.has(first))
      return "";
    owner = await lookupOwner(first);
    if (!owner)
      return "";
  }
  if (ownerCache.size > 500)
    ownerCache.clear();
  ownerCache.set(cacheKey, { owner, exp: now + 6e4 });
  return owner;
}
var routeCache = /* @__PURE__ */ new Map();
function clearRouteCache() {
  routeCache.clear();
}
async function getRouteCached(env2, prefix, owner = "") {
  const now = Date.now();
  const cacheKey = (owner || "") + "|" + prefix;
  const hit = routeCache.get(cacheKey);
  if (hit && hit.exp > now)
    return hit.route;
  let route = null;
  if (owner) {
    route = await env2.DB.prepare("SELECT * FROM user_routes WHERE owner = ? AND prefix = ?").bind(owner, prefix).first();
    if (route)
      route = { ...route, owner };
    if (!route && await routesHasUserId(env2)) {
      const user = await getUserByUsername(env2, owner);
      if (user) {
        const legacy = await env2.DB.prepare("SELECT * FROM routes WHERE user_id = ? AND prefix = ? ORDER BY rowid LIMIT 1").bind(user.id, prefix).first();
        if (legacy)
          route = { ...legacy, owner, legacyUserId: user.id };
      }
    }
  }
  if (!route) {
    if (await routesHasUserId(env2)) {
      route = await env2.DB.prepare("SELECT * FROM routes WHERE prefix = ? AND (user_id IS NULL OR user_id = 0 OR user_id = '') ORDER BY rowid LIMIT 1").bind(prefix).first();
    } else {
      route = await env2.DB.prepare("SELECT * FROM routes WHERE prefix = ?").bind(prefix).first();
    }
  }
  if (routeCache.size > 1e3)
    routeCache.clear();
  routeCache.set(cacheKey, { route: route || null, exp: now + ROUTE_CACHE_TTL });
  return route || null;
}
async function resolveProxyTarget(request, env2, url) {
  const rawSegments = url.pathname.split("/").filter(Boolean);
  let firstSeg = rawSegments[0] || "";
  try {
    firstSeg = decodeURIComponent(firstSeg);
  } catch {
    return { error: new Response("Bad Request", { status: 400 }) };
  }
  const prefix = normalizePrefix(firstSeg);
  if (!prefix)
    return { error: new Response("Not Found", { status: 404 }) };
  const routeOwner = await resolveOwnerFromHost(env2, url.hostname);
  const route = await getRouteCached(env2, prefix, routeOwner);
  if (!route)
    return { error: new Response("404: \u8282\u70B9\u4E0D\u5B58\u5728", { status: 404 }) };
  if (route.enabled === 0)
    return { error: new Response("503: \u8BE5\u8DEF\u7531\u5DF2\u505C\u7528", { status: 503 }) };
  const clientIp = request.headers.get("cf-connecting-ip") || "";
  const allow = parseIpList(route.ip_allow);
  const block = parseIpList(route.ip_block);
  if (block.length && ipMatches(clientIp, block))
    return { error: new Response("Forbidden", { status: 403 }) };
  if (allow.length && !ipMatches(clientIp, allow))
    return { error: new Response("Forbidden", { status: 403 }) };
  const enableCache = route.cache_img !== "off";
  const compatMode = route.compat_mode === "on";
  const rest = url.pathname.replace(/^\/[^/]*/, "");
  const targetUrls = splitTargets(route.target);
  const streamTargets = splitTargets(route.stream_target);
  const streamProxyPath = "/" + encodeURIComponent(route.prefix);
  const isStreamRequest = rest === "/__stream" || rest.startsWith("/__stream/");
  const mapTargets = (list) => {
    const out = [];
    for (const target of list) {
      try {
        const t = new URL(target);
        const base = t.pathname.replace(/\/+$/, "");
        out.push(t.origin + base + rest + url.search);
      } catch {
        out.push(target.replace(/\/+$/, "") + rest + url.search);
      }
    }
    return out;
  };
  let upstreamUrls;
  let streamReferrer = "";
  if (isStreamRequest) {
    const pathMatch = rest.match(/^\/__stream\/(0|[1-9]\d*)(\/.*)?$/);
    if (!pathMatch)
      return { error: new Response("Invalid stream proxy path", { status: 400 }) };
    const parts = getStreamTargetParts(streamTargets[Number(pathMatch[1])]);
    if (!parts)
      return { error: new Response("Stream target not configured", { status: 404 }) };
    const target = new URL(parts.origin + parts.base + (pathMatch[2] || "") + url.search);
    if (target.origin !== parts.origin || target.pathname !== parts.base && !target.pathname.startsWith(parts.base + "/")) {
      return { error: new Response("Invalid stream proxy path", { status: 400 }) };
    }
    upstreamUrls = [target.toString()];
    try {
      const api = new URL(targetUrls[0]);
      streamReferrer = api.origin + api.pathname.replace(/\/+$/, "") + "/web/index.html";
    } catch {
    }
  } else {
    upstreamUrls = mapTargets(targetUrls);
  }
  return {
    upstreamUrls,
    streamTargets,
    streamProxyPath,
    isStreamRequest,
    streamReferrer,
    enableCache,
    compatMode,
    clientIpMode: normalizeIpMode(route.ip_mode),
    matchedPrefix: route.prefix,
    statPrefix: route.owner ? route.owner + "/" + route.prefix : route.prefix,
    routeOwner: route.owner || "",
    legacyUserId: route.legacyUserId || 0,
    customHeaders: parseHeaderLines(route.custom_headers).headers
  };
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

// src/editions/multi/integrations/dns.js
async function createOrUpdateDNSRecord(env2, zoneId, dnsName, targetDomain, rootDomain, opts = {}) {
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
  const proxied = opts.proxied === true;
  const recordData = {
    type: recordType,
    name: fullDNSName,
    content: targetDomain,
    ttl: 1,
    proxied: recordType === "CNAME" || recordType === "A" || recordType === "AAAA" ? proxied : false
  };
  const sameType = recordsResult.result.filter((r) => r.name === fullDNSName && ["A", "AAAA", "CNAME"].includes(r.type));
  if (!opts.forceRecreate && sameType.length === 1 && sameType[0].type === recordType) {
    const upd = await cloudflareAPICall(env2, "PUT", `/zones/${zoneId}/dns_records/${sameType[0].id}`, recordData);
    if (upd.success) {
      if (opts.saveConfig !== false)
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
  if (opts.saveConfig !== false)
    await saveDNSConfig(env2, dnsName, targetDomain, zoneId);
  return result;
}

// src/editions/multi/users/dns.js
function userEntryHost(env2, user) {
  const root = getUserDomain(env2) || getBaseDomain(env2);
  const sub = user && user.subdomain || user && user.username || "";
  return toFqdn(sub, root);
}
function isValidIPv4(v) {
  const parts = String(v || "").split(".");
  if (parts.length !== 4)
    return false;
  return parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) >= 0 && Number(p) <= 255);
}
function isValidDnsValue(v) {
  const s = String(v || "").trim().replace(/\.$/, "");
  if (!s || s.length > 253)
    return false;
  if (isValidIPv4(s))
    return true;
  if (s.includes(":"))
    return /^[0-9a-f:]+$/i.test(s) && s.split(":").length <= 9;
  return /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(s);
}
async function provisionUserDns(env2, user) {
  try {
    const root = getUserDomain(env2) || getBaseDomain(env2);
    if (!root)
      return { ok: false, error: "\u672A\u914D\u7F6E BASE_DOMAIN / USER_DOMAIN" };
    const info3 = await resolveZoneInfo(env2, false, root);
    if (!info3.zoneId)
      return { ok: false, error: info3.error || "\u672A\u89E3\u6790\u5230 Cloudflare Zone\uFF0C\u8BF7\u68C0\u67E5 CF_API_TOKEN" };
    const entryHost = userEntryHost(env2, user);
    const target = DEFAULT_USER_DNS_TARGET;
    if (!isValidDnsValue(target))
      return { ok: false, error: "\u9ED8\u8BA4 DNS \u76EE\u6807\u4E0D\u5408\u6CD5" };
    if (entryHost === target)
      return { ok: false, error: "DNS \u76EE\u6807\u4E0D\u80FD\u4E0E\u5165\u53E3\u57DF\u540D\u76F8\u540C" };
    const existing = await getDNSRecords(env2, info3.zoneId);
    if (existing.success && Array.isArray(existing.result)) {
      const same = existing.result.filter((r) => r.name === entryHost.toLowerCase() && ["A", "AAAA", "CNAME"].includes(r.type));
      const isOurs = same.length === 1 && same[0].type === "CNAME" && String(same[0].content).toLowerCase() === target.toLowerCase();
      if (same.length && !isOurs) {
        return { ok: false, error: "\u5B50\u57DF\u540D " + entryHost + " \u5DF2\u5B58\u5728 DNS \u8BB0\u5F55\uFF08" + same.map((r) => r.type + " " + r.content).join("\u3001") + "\uFF09\uFF0C\u672A\u81EA\u52A8\u8986\u76D6\uFF0C\u8BF7\u624B\u52A8\u5904\u7406" };
      }
    }
    const result = await createOrUpdateDNSRecord(env2, info3.zoneId, user.subdomain || user.username, target, root, { proxied: false, saveConfig: false });
    if (!result.success)
      return { ok: false, error: result.error || result.errors?.[0]?.message || "DNS \u521B\u5EFA\u5931\u8D25" };
    await auditLog(env2, "user.dns", user.username + " -> " + entryHost + " = " + target + "\uFF08\u81EA\u52A8\uFF09");
    return { ok: true, entryHost, target, type: result.result?.type || "CNAME" };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}
async function userUpdateDns(env2, session, target) {
  const user = await getUserById(env2, session.uid);
  if (!user)
    return { error: "\u7528\u6237\u4E0D\u5B58\u5728" };
  const value = String(target || "").trim().replace(/\.$/, "");
  if (!value)
    return { error: "\u8BF7\u8F93\u5165 IP \u6216\u57DF\u540D" };
  if (!isValidDnsValue(value))
    return { error: "DNS \u503C\u5FC5\u987B\u662F\u5408\u6CD5\u7684 IPv4 / IPv6 \u5730\u5740\u6216\u57DF\u540D" };
  const root = getUserDomain(env2) || getBaseDomain(env2);
  if (!root)
    return { error: "\u672A\u914D\u7F6E BASE_DOMAIN / USER_DOMAIN" };
  const entryHost = userEntryHost(env2, user);
  if (value.toLowerCase() === entryHost.toLowerCase())
    return { error: "DNS \u503C\u4E0D\u80FD\u6307\u5411\u5165\u53E3\u57DF\u540D\u81EA\u8EAB" };
  const info3 = await resolveZoneInfo(env2, false, root);
  if (!info3.zoneId)
    return { error: info3.error || "\u672A\u89E3\u6790\u5230 Cloudflare Zone\uFF0C\u8BF7\u68C0\u67E5 CF_API_TOKEN" };
  const result = await createOrUpdateDNSRecord(env2, info3.zoneId, user.subdomain || user.username, value, root, { proxied: false, saveConfig: false, forceRecreate: true });
  if (!result.success)
    return { error: result.error || result.errors?.[0]?.message || "DNS \u66F4\u65B0\u5931\u8D25", errors: result.errors };
  await auditLog(env2, "user.dns", user.username + " -> " + entryHost + " = " + value);
  return { ok: true, entryHost, target: value, type: result.result?.type || detectRecordType(value), proxied: false, result: result.result };
}
async function userEnsureDNS(env2, session) {
  const user = await getUserById(env2, session.uid);
  if (!user)
    return { error: "\u7528\u6237\u4E0D\u5B58\u5728" };
  const root = getUserDomain(env2) || getBaseDomain(env2);
  if (!root)
    return { error: "\u672A\u914D\u7F6E BASE_DOMAIN / USER_DOMAIN" };
  const entryHost = userEntryHost(env2, user);
  const current = await userDnsInfo(env2, session);
  let target = current && current.record && current.record.content ? current.record.content : DEFAULT_USER_DNS_TARGET;
  if (target === entryHost)
    target = root;
  if (target === entryHost)
    return { error: "\u5165\u53E3\u57DF\u540D\u4E0E\u76EE\u6807\u76F8\u540C\uFF0C\u65E0\u6CD5\u521B\u5EFA CNAME" };
  if (!isValidDnsValue(target))
    return { error: "\u5F53\u524D DNS \u503C\u4E0D\u5408\u6CD5\uFF0C\u8BF7\u5148\u4FDD\u5B58\u65B0\u7684 IP \u6216\u57DF\u540D" };
  const info3 = await resolveZoneInfo(env2, false, root);
  if (!info3.zoneId)
    return { error: info3.error || "\u672A\u89E3\u6790\u5230 Cloudflare Zone\uFF0C\u8BF7\u68C0\u67E5 CF_API_TOKEN" };
  const result = await createOrUpdateDNSRecord(env2, info3.zoneId, user.subdomain || user.username, target, root, { proxied: false, saveConfig: false });
  if (!result.success)
    return { error: result.error || result.errors?.[0]?.message || "DNS \u521B\u5EFA\u5931\u8D25", errors: result.errors };
  await auditLog(env2, "user.dns", user.username + " -> " + entryHost);
  return { ok: true, entryHost, target, type: result.result?.type || "CNAME", proxied: false, result: result.result };
}
async function userDnsInfo(env2, session) {
  const user = await getUserById(env2, session.uid);
  if (!user)
    return { error: "\u7528\u6237\u4E0D\u5B58\u5728" };
  const entryHost = userEntryHost(env2, user);
  const root = getUserDomain(env2) || getBaseDomain(env2);
  const info3 = await resolveZoneInfo(env2, false, root);
  let record = null;
  if (info3.zoneId) {
    try {
      const rr = await getDNSRecords(env2, info3.zoneId);
      if (rr.success && Array.isArray(rr.result)) {
        const rec = rr.result.find((r) => ["A", "AAAA", "CNAME"].includes(r.type) && r.name === entryHost);
        if (rec)
          record = { type: rec.type, name: rec.name, content: rec.content, proxied: rec.proxied, modifiedOn: rec.modified_on };
      }
    } catch (_) {
    }
  }
  return { ok: true, entryHost, baseDomain: getBaseDomain(env2), userDomain: getUserDomain(env2), statsHost: getStatsHost(env2), defaultTarget: DEFAULT_USER_DNS_TARGET, zoneId: info3.zoneId || "", zoneError: info3.error || "", record };
}

// src/editions/multi/auth/session.js
var SESSION_TTL_SEC = 7 * 24 * 3600;
var ADMIN_UID = 0;
var enc3 = new TextEncoder();
function hexToBytes(hex) {
  const h = String(hex || "");
  const out = new Uint8Array(Math.floor(h.length / 2));
  for (let i = 0; i < out.length; i++)
    out[i] = parseInt(h.substr(i * 2, 2), 16) || 0;
  return out;
}
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
async function sessionSecret(env2, uid = ADMIN_UID, epoch = void 0) {
  const root = envStr(env2, "SESSION_SECRET") || getAdminToken(env2) || "";
  if (!root) return "";
  if (epoch === void 0) {
    epoch = uid === ADMIN_UID ? (await credentialState(env2)).record?.epoch ?? null : await getPrivate(env2, "user_epoch:" + uid);
  }
  if (epoch === null) return root;
  if (!/^[a-f0-9]{64}$/.test(epoch)) throw new Error("\u4F1A\u8BDD\u914D\u7F6E\u65E0\u6548");
  return hmacHex(root, "multi-session:" + uid + ":epoch:" + epoch);
}
async function userCredentialState(env2, field, value) {
  await privateStore(env2);
  return env2.DB.prepare(`SELECT u.*, (SELECT value FROM multi_private WHERE key = 'user_epoch:' || u.id) AS _session_epoch
        FROM users u WHERE ${field === "id" ? "id" : "username"} = ?`).bind(value).first();
}
async function makeSessionToken(secret, uid = ADMIN_UID) {
  const exp = Math.floor(Date.now() / 1e3) + SESSION_TTL_SEC;
  const id = Number(uid) || 0;
  return id + "." + exp + "." + await hmacHex(secret, "session:" + id + ":" + exp);
}
async function verifySessionToken(token, secret) {
  const parts = String(token || "").split(".");
  const now = Math.floor(Date.now() / 1e3);
  if (parts.length === 2) {
    const exp2 = parseInt(parts[0], 10);
    if (!parts[1] || !Number.isFinite(exp2) || exp2 < now)
      return null;
    if (!await safeEqual(parts[1], await hmacHex(secret, "session:" + exp2), secret))
      return null;
    return { uid: ADMIN_UID, exp: exp2 };
  }
  if (parts.length !== 3)
    return null;
  const uid = parseInt(parts[0], 10);
  const exp = parseInt(parts[1], 10);
  if (!Number.isFinite(uid) || uid < 0 || !Number.isFinite(exp) || exp < now)
    return null;
  if (!await safeEqual(parts[2], await hmacHex(secret, "session:" + uid + ":" + exp), secret))
    return null;
  return { uid, exp };
}
function randomHex(bytes = 16) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return toHex(buf);
}
async function hashPassword(password, saltHex) {
  const key = await crypto.subtle.importKey("raw", enc3.encode(String(password || "")), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: hexToBytes(saltHex), iterations: 1e5, hash: "SHA-256" }, key, 256);
  return toHex(bits);
}
async function verifyPassword(password, saltHex, expectedHex) {
  try {
    const got = await hashPassword(password, saltHex);
    return safeEqual(got, expectedHex, "pw-cmp");
  } catch (_) {
    return false;
  }
}
var userCache = /* @__PURE__ */ new Map();
function clearUserCache() {
  userCache.clear();
  try {
    clearOwnerCache();
  } catch (_) {
  }
}
function rowToUser(r) {
  if (!r)
    return null;
  return {
    id: Number(r.id),
    username: r.username,
    passwordHash: r.password_hash,
    salt: r.salt,
    role: r.role || "user",
    status: r.status || "active",
    subdomain: r.subdomain || "",
    routeLimit: Number(r.route_limit) || 20,
    createdAt: r.created_at || "",
    lastLogin: r.last_login || ""
  };
}
function publicUser(u) {
  if (!u)
    return null;
  return {
    id: u.id,
    username: u.username,
    role: u.role,
    status: u.status,
    subdomain: u.subdomain || "",
    routeLimit: u.routeLimit || 20,
    createdAt: u.createdAt || "",
    lastLogin: u.lastLogin || ""
  };
}
async function getUserById(env2, id) {
  if (!env2.DB || !Number.isFinite(Number(id)))
    return null;
  const key = "id:" + id;
  const now = Date.now();
  const hit = userCache.get(key);
  if (hit && hit.exp > now)
    return hit.user;
  const row = await env2.DB.prepare("SELECT * FROM users WHERE id = ?").bind(Number(id)).first();
  const user = rowToUser(row);
  userCache.set(key, { user, exp: now + 15e3 });
  if (userCache.size > 500)
    userCache.clear();
  return user;
}
async function getUserByUsername(env2, username) {
  if (!env2.DB || !username)
    return null;
  const uname = String(username).toLowerCase();
  const key = "name:" + uname;
  const now = Date.now();
  const hit = userCache.get(key);
  if (hit && hit.exp > now)
    return hit.user;
  const row = await env2.DB.prepare("SELECT * FROM users WHERE username = ?").bind(uname).first();
  const user = rowToUser(row);
  userCache.set(key, { user, exp: now + 15e3 });
  if (userCache.size > 500)
    userCache.clear();
  return user;
}
async function getSession(request, env2) {
  const tok = getCookie(request, SESSION_COOKIE);
  if (!tok)
    return null;
  const parts = tok.split(".");
  const uid = parts.length === 2 ? ADMIN_UID : parts.length === 3 && /^\d+$/.test(parts[0]) ? Number(parts[0]) : -1;
  if (!Number.isSafeInteger(uid) || uid < 0) return null;
  let secret, user;
  try {
    if (uid === ADMIN_UID) secret = await sessionSecret(env2, uid);
    else {
      const row = await userCredentialState(env2, "id", uid);
      user = rowToUser(row);
      if (!user || user.status !== "active") return null;
      secret = await sessionSecret(env2, uid, row._session_epoch ?? null);
    }
  } catch {
    return null;
  }
  if (!secret) return null;
  const v = await verifySessionToken(tok, secret);
  if (!v)
    return null;
  if (v.uid === ADMIN_UID) {
    return { uid: 0, id: 0, username: "admin", role: "admin", status: "active", subdomain: "", isAdmin: true, exp: v.exp };
  }
  return {
    uid: user.id,
    id: user.id,
    username: user.username,
    role: user.role,
    status: user.status,
    subdomain: user.subdomain,
    isAdmin: user.role === "admin",
    exp: v.exp
  };
}
async function isAdmin(request, env2) {
  const s = await getSession(request, env2);
  return Boolean(s && s.isAdmin);
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
    while (loginFails.size > 5e3) loginFails.delete(loginFails.keys().next().value);
  }
}
function sessionCookie(token, maxAge = SESSION_TTL_SEC) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Strict; Secure`;
}
async function loginJson(env2, uid, username, isAdminUser, extra = {}, validatedSecret = null) {
  const token = await makeSessionToken(validatedSecret ?? await sessionSecret(env2, uid), uid);
  return new Response(JSON.stringify({ ok: true, user: { uid, username, isAdmin: Boolean(isAdminUser) }, ...extra }), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Set-Cookie": sessionCookie(token),
      "Cache-Control": "no-store"
    }
  });
}
async function adminLoginResponse(request, env2, creds = {}) {
  const secret = envStr(env2, "SESSION_SECRET") || getAdminToken(env2) || "";
  if (!secret) {
    return json({
      ok: false,
      error: "Worker \u672A\u8BFB\u5230 ADMIN_TOKEN / SESSION_SECRET\u3002\u8BF7\u5728 Cloudflare \u63A7\u5236\u53F0 \u2192 Worker \u2192 \u8BBE\u7F6E \u2192 \u53D8\u91CF\u548C\u673A\u5BC6 \u4E2D\u6DFB\u52A0\u3002"
    }, 503);
  }
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  if (loginBlocked(ip))
    return json({ ok: false, error: "\u5C1D\u8BD5\u6B21\u6570\u8FC7\u591A\uFF0C\u8BF7 10 \u5206\u949F\u540E\u518D\u8BD5" }, 429);
  const username = String(creds.username || "").trim().toLowerCase();
  const password = String(creds.password != null ? creds.password : creds.token || "");
  if (password.length > 1024 || username.length > 32) return json({ ok: false, error: "\u767B\u5F55\u4FE1\u606F\u8FC7\u957F" }, 400);
  if (!password)
    return json({ ok: false, error: "\u8BF7\u8F93\u5165\u5BC6\u7801 / \u7BA1\u7406\u5BC6\u94A5" }, 400);
  if (!username || username === "admin") {
    const expected = getAdminToken(env2);
    let valid, state;
    try {
      state = await credentialState(env2);
      valid = expected && await verifyAdminPassword(env2, password, state);
    } catch {
      return json({ ok: false, error: "\u767B\u5F55\u914D\u7F6E\u6682\u4E0D\u53EF\u7528\uFF0C\u8BF7\u68C0\u67E5\u6570\u636E\u5E93\u6216\u7BA1\u7406\u5458\u6062\u590D\u6D41\u7A0B" }, 503);
    }
    if (!valid) {
      loginFailed(ip);
      return json({ ok: false, error: "\u7BA1\u7406\u5BC6\u94A5\u9519\u8BEF" }, 401);
    }
    loginFails.delete(ip);
    return loginJson(env2, ADMIN_UID, "admin", true, {}, await sessionSecret(env2, ADMIN_UID, state.record?.epoch ?? null));
  }
  const row = await userCredentialState(env2, "username", username);
  const user = rowToUser(row);
  if (!user || user.status !== "active" || !await verifyPassword(password, user.salt, user.passwordHash)) {
    loginFailed(ip);
    return json({ ok: false, error: "\u7528\u6237\u540D\u6216\u5BC6\u7801\u9519\u8BEF" }, 401);
  }
  const validatedSecret = await sessionSecret(env2, user.id, row._session_epoch ?? null);
  loginFails.delete(ip);
  try {
    await env2.DB.prepare("UPDATE users SET last_login = ? WHERE id = ?").bind((/* @__PURE__ */ new Date()).toISOString(), user.id).run();
    clearUserCache();
  } catch (_) {
  }
  return loginJson(env2, user.id, user.username, user.role === "admin", {}, validatedSecret);
}
function makeInviteCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  const rnd = crypto.getRandomValues(new Uint8Array(10));
  for (let i = 0; i < 10; i++)
    s += alphabet[rnd[i] % alphabet.length];
  return s;
}
async function handleRegister(request, env2) {
  if (!env2.DB)
    return json({ ok: false, error: "D1 \u6570\u636E\u5E93\u672A\u7ED1\u5B9A" }, 500);
  const secret = envStr(env2, "SESSION_SECRET") || getAdminToken(env2) || "";
  if (!secret)
    return json({ ok: false, error: "\u672A\u914D\u7F6E ADMIN_TOKEN / SESSION_SECRET" }, 503);
  const data = await readJson(request) || {};
  const username = sanitizeUsername(data.username);
  const password = String(data.password || "");
  const code = String(data.invite || data.code || "").trim();
  const requestedSub = username;
  if (!username)
    return json({ ok: false, error: "\u7528\u6237\u540D\u9700\u4E3A 3-32 \u4F4D\u5C0F\u5199\u5B57\u6BCD\u3001\u6570\u5B57\u6216\u77ED\u6A2A\u7EBF\uFF0C\u4E14\u4E0D\u80FD\u4EE5\u77ED\u6A2A\u7EBF\u5F00\u5934/\u7ED3\u5C3E" }, 400);
  if (password.length < 6)
    return json({ ok: false, error: "\u5BC6\u7801\u81F3\u5C11 6 \u4F4D" }, 400);
  if (!code)
    return json({ ok: false, error: "\u8BF7\u8F93\u5165\u9080\u8BF7\u7801" }, 400);
  if (!requestedSub)
    return json({ ok: false, error: "\u7528\u6237\u540D\u4E0D\u80FD\u4F5C\u4E3A\u5B50\u57DF\u540D\uFF0C\u8BF7\u66F4\u6362" }, 400);
  const entryErr = entryNameError(env2, requestedSub);
  if (entryErr)
    return json({ ok: false, error: entryErr }, 400);
  const invite = await env2.DB.prepare("SELECT * FROM invite_codes WHERE code = ? OR UPPER(code) = ? LIMIT 1").bind(code, code.toUpperCase()).first();
  if (!invite)
    return json({ ok: false, error: "\u9080\u8BF7\u7801\u65E0\u6548" }, 403);
  if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
    return json({ ok: false, error: "\u9080\u8BF7\u7801\u5DF2\u8FC7\u671F" }, 403);
  }
  if (Number(invite.max_uses) > 0 && Number(invite.used_count) >= Number(invite.max_uses)) {
    return json({ ok: false, error: "\u9080\u8BF7\u7801\u4F7F\u7528\u6B21\u6570\u5DF2\u7528\u5B8C" }, 403);
  }
  const exists = await env2.DB.prepare("SELECT 1 AS x FROM users WHERE username = ? OR (subdomain <> '' AND subdomain = ?)").bind(username, requestedSub).first();
  if (exists)
    return json({ ok: false, error: "\u7528\u6237\u540D\u6216\u5B50\u57DF\u540D\u5DF2\u88AB\u5360\u7528" }, 409);
  const salt = randomHex(16);
  const hash = await hashPassword(password, salt);
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  let batchOut = null;
  try {
    batchOut = await env2.DB.batch([
      env2.DB.prepare("INSERT INTO users (username, password_hash, salt, role, status, subdomain, route_limit, created_at, last_login) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(username, hash, salt, "user", "active", requestedSub, DEFAULT_USER_ROUTE_LIMIT, nowIso, nowIso),
      env2.DB.prepare("UPDATE invite_codes SET used_count = used_count + 1 WHERE code = ? AND (max_uses = 0 OR used_count < max_uses)").bind(invite.code)
    ]);
  } catch (e) {
    return json({ ok: false, error: /UNIQUE/i.test(String(e?.message)) ? "\u7528\u6237\u540D\u6216\u5B50\u57DF\u540D\u5DF2\u88AB\u5360\u7528" : "\u6CE8\u518C\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5" }, 409);
  }
  const usedNow = batchOut && batchOut[1] && batchOut[1].meta ? Number(batchOut[1].meta.changes) : 0;
  if (!usedNow) {
    try {
      await env2.DB.prepare("DELETE FROM users WHERE username = ?").bind(username).run();
    } catch (_) {
    }
    clearUserCache();
    return json({ ok: false, error: "\u9080\u8BF7\u7801\u4F7F\u7528\u6B21\u6570\u5DF2\u7528\u5B8C" }, 403);
  }
  clearUserCache();
  const user = await getUserByUsername(env2, username);
  if (!user)
    return json({ ok: false, error: "\u6CE8\u518C\u6210\u529F\u4F46\u8BFB\u53D6\u7528\u6237\u5931\u8D25" }, 500);
  await auditLog(env2, "user.register", username + " / " + requestedSub);
  const dns = await provisionUserDns(env2, user);
  return loginJson(env2, user.id, user.username, user.role === "admin", dns.ok ? { dns: { entryHost: dns.entryHost, target: dns.target, type: dns.type } } : { dnsWarning: dns.error });
}
function sanitizeUsername(v) {
  const s = String(v || "").trim().toLowerCase();
  return USERNAME_RE.test(s) ? s : "";
}
function sanitizeSubdomain(v) {
  const s = String(v || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (!/^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$/.test(s))
    return "";
  return s;
}
function entryNameError(env2, name) {
  const s = String(name || "").trim().toLowerCase();
  if (!s)
    return "\u5B50\u57DF\u540D\u4E0D\u5408\u6CD5";
  if (RESERVED_SUBDOMAINS.has(s))
    return "\u8BE5\u7528\u6237\u540D\u5DF2\u88AB\u7CFB\u7EDF\u4FDD\u7559\uFF0C\u8BF7\u66F4\u6362";
  const dns = getDnsRecordName(env2);
  if (dns && s === dns)
    return "\u8BE5\u7528\u6237\u540D\u4E0E Worker \u4E3B\u5165\u53E3\u91CD\u540D\uFF0C\u8BF7\u66F4\u6362";
  if (getStatsHost(env2) && s === getStatsHost(env2))
    return "\u8BE5\u7528\u6237\u540D\u4E0E\u7EDF\u8BA1\u5165\u53E3\u91CD\u540D\uFF0C\u8BF7\u66F4\u6362";
  return "";
}
async function changePassword(request, env2, session) {
  if (!session) return json({ ok: false, error: "Unauthorized" }, 401);
  if (request.headers.get("Origin") !== new URL(request.url).origin || !request.headers.get("Content-Type")?.startsWith("application/json")) {
    return json({ ok: false, error: "\u5FC5\u987B\u4F7F\u7528\u540C\u6E90 JSON \u8BF7\u6C42" }, 403);
  }
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  if (loginBlocked(ip)) return json({ ok: false, error: "\u5C1D\u8BD5\u6B21\u6570\u8FC7\u591A\uFF0C\u8BF7 10 \u5206\u949F\u540E\u518D\u8BD5" }, 429);
  const data = await readJson(request) || {};
  const oldPassword = String(data.currentPassword ?? data.oldPassword ?? data.old ?? "");
  const newPassword = String(data.newPassword || data.new || "");
  if (newPassword.length < 12 || newPassword.length > 128 || oldPassword.length > 1024) return json({ ok: false, error: "\u65B0\u5BC6\u7801\u987B\u4E3A 12\u2013128 \u4E2A\u5B57\u7B26" }, 400);
  if (data.confirmPassword !== void 0 && data.confirmPassword !== newPassword) return json({ ok: false, error: "\u4E24\u6B21\u65B0\u5BC6\u7801\u4E0D\u4E00\u81F4" }, 400);
  if (oldPassword === newPassword) return json({ ok: false, error: "\u65B0\u5BC6\u7801\u4E0D\u80FD\u4E0E\u5F53\u524D\u5BC6\u7801\u76F8\u540C" }, 400);
  if (session.uid === ADMIN_UID) {
    let out;
    try {
      out = await changeAdminPassword(env2, oldPassword, newPassword);
    } catch {
      return json({ ok: false, error: "\u767B\u5F55\u914D\u7F6E\u6682\u4E0D\u53EF\u7528\uFF0C\u8BF7\u68C0\u67E5\u6570\u636E\u5E93" }, 503);
    }
    if (!out.ok) {
      if (out.status === 403) loginFailed(ip);
      return json({ ok: false, error: out.error }, out.status);
    }
    loginFails.delete(ip);
    await auditLog(env2, "security.password", "built-in admin changed; sessions revoked");
    return logoutResponse();
  }
  const user = rowToUser(await userCredentialState(env2, "id", session.uid));
  if (!user || !await verifyPassword(oldPassword, user.salt, user.passwordHash)) {
    loginFailed(ip);
    return json({ ok: false, error: "\u5F53\u524D\u5BC6\u7801\u9519\u8BEF" }, 403);
  }
  const salt = randomHex(16);
  const hash = await hashPassword(newPassword, salt);
  await privateStore(env2);
  const result = await env2.DB.prepare("UPDATE users SET password_hash = ?, salt = ? WHERE id = ? AND password_hash = ? AND salt = ? RETURNING id").bind(hash, salt, user.id, user.passwordHash, user.salt).first();
  clearUserCache();
  if (!result || Number(result.id) !== user.id) return json({ ok: false, error: "\u5BC6\u7801\u5DF2\u88AB\u5176\u4ED6\u64CD\u4F5C\u66F4\u65B0\uFF0C\u8BF7\u91CD\u65B0\u767B\u5F55" }, 409);
  loginFails.delete(ip);
  await auditLog(env2, "user.password", user.username + "; sessions revoked");
  return logoutResponse();
}

// src/editions/multi/users/routes.js
var routesHasUserIdCache = null;
async function routesHasUserId(env2) {
  if (routesHasUserIdCache !== null)
    return routesHasUserIdCache;
  try {
    await env2.DB.prepare("SELECT user_id FROM routes LIMIT 1").first();
    routesHasUserIdCache = true;
  } catch (_) {
    routesHasUserIdCache = false;
  }
  return routesHasUserIdCache;
}
async function getUserLegacyRoutes(env2, user, today) {
  if (!user || !await routesHasUserId(env2))
    return [];
  try {
    const { results } = await env2.DB.prepare(`SELECT r.*,
              COALESCE((SELECT SUM(request_count) FROM route_stats_daily
                        WHERE bucket_date = ? AND prefix IN (r.prefix, ? || '/' || r.prefix)), 0) AS today_req,
              COALESCE((SELECT SUM(traffic_bytes) FROM route_stats_daily
                        WHERE bucket_date = ? AND prefix IN (r.prefix, ? || '/' || r.prefix)), 0) AS today_bytes
       FROM routes r
       JOIN (SELECT prefix, MIN(rowid) AS rid FROM routes WHERE user_id = ? GROUP BY prefix) x
         ON x.rid = r.rowid
       WHERE r.user_id = ?
       ORDER BY r.sort_order, r.prefix`).bind(today, user.username, today, user.username, user.id, user.id).all();
    return results || [];
  } catch (_) {
    return [];
  }
}
async function getLegacyRouteForUser(env2, user, id, prefix) {
  if (!user || !await routesHasUserId(env2))
    return null;
  try {
    if (id) {
      const row = await env2.DB.prepare("SELECT rowid AS _rid, * FROM routes WHERE id = ? AND user_id = ?").bind(Number(id), user.id).first();
      if (row)
        return row;
    }
  } catch (_) {
  }
  try {
    return await env2.DB.prepare("SELECT rowid AS _rid, * FROM routes WHERE user_id = ? AND prefix = ? ORDER BY rowid LIMIT 1").bind(user.id, prefix).first();
  } catch (_) {
    return null;
  }
}
async function countUserRoutes(env2, user) {
  if (!user)
    return 0;
  if (await routesHasUserId(env2)) {
    try {
      const c = await env2.DB.prepare("SELECT COUNT(*) AS n FROM (SELECT prefix FROM user_routes WHERE owner = ? UNION SELECT prefix FROM routes WHERE user_id = ?)").bind(user.username, user.id).first();
      return Number(c?.n) || 0;
    } catch (_) {
    }
  }
  try {
    const c = await env2.DB.prepare("SELECT COUNT(*) AS n FROM user_routes WHERE owner = ?").bind(user.username).first();
    return Number(c?.n) || 0;
  } catch (_) {
    return 0;
  }
}
async function userListRoutes(env2, owner) {
  const today = getShanghaiParts().dateKey;
  const { results } = await env2.DB.prepare(`SELECT r.*, COALESCE(s.request_count, 0) AS today_req, COALESCE(s.traffic_bytes, 0) AS today_bytes
     FROM user_routes r
     LEFT JOIN route_stats_daily s ON s.prefix = ? || '/' || r.prefix AND s.bucket_date = ?
     WHERE r.owner = ?
     ORDER BY r.sort_order, r.prefix`).bind(owner, today, owner).all();
  let health = [];
  try {
    health = (await env2.DB.prepare("SELECT prefix, target, down FROM route_health").all()).results || [];
  } catch (_) {
  }
  const downSet = /* @__PURE__ */ new Set();
  for (const h of health)
    if (h.down)
      downSet.add(h.prefix + "|" + h.target);
  const countDown = (keyPrefix, target) => splitTargets(target).filter((t) => downSet.has(keyPrefix + "|" + t)).length;
  const user = await getUserByUsername(env2, owner);
  const legacy = await getUserLegacyRoutes(env2, user, today);
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const r of results || []) {
    out.push({ ...r, source: "user", down_count: countDown(owner + "/" + r.prefix, r.target) });
    seen.add(r.prefix);
  }
  for (const r of legacy) {
    if (seen.has(r.prefix))
      continue;
    out.push({ ...r, source: "legacy", down_count: countDown(owner + "/" + r.prefix, r.target) });
    seen.add(r.prefix);
  }
  return Promise.all(out.map(async (r) => ({ ...r, notification_id: await notificationId(env2, owner + "/" + r.prefix) })));
}
async function userSaveRoute(env2, owner, data) {
  const err = validateUserPrefix(data.prefix);
  if (err)
    return { error: err };
  const prefix = normalizePrefix(data.prefix);
  const oldPrefix = data.oldPrefix ? normalizePrefix(data.oldPrefix) : "";
  const targets = splitTargets(data.target);
  if (!targets.length)
    return { error: "\u8BF7\u81F3\u5C11\u586B\u5199\u4E00\u4E2A\u76EE\u6807\u5730\u5740" };
  const badTarget = targets.find((t) => !isValidHttpUrl(t));
  if (badTarget)
    return { error: "\u76EE\u6807\u5730\u5740\u5FC5\u987B\u662F http(s):// \u5F00\u5934\u7684\u5408\u6CD5 URL\uFF1A" + badTarget };
  const streamTargets = splitTargets(data.stream_target || "");
  const badStreamTarget = streamTargets.find((t) => !isValidHttpUrl(t));
  if (badStreamTarget)
    return { error: "\u63A8\u6D41\u5730\u5740\u5FC5\u987B\u662F http(s):// \u5F00\u5934\u7684\u5408\u6CD5 URL\uFF1A" + badStreamTarget };
  const hdrCheck = parseHeaderLines(data.custom_headers);
  if (hdrCheck.error)
    return { error: hdrCheck.error };
  const allowList = parseIpList(data.ip_allow);
  const blockList = parseIpList(data.ip_block);
  if (!validIpList(allowList) || !validIpList(blockList))
    return { error: "IP \u9ED1\u767D\u540D\u5355\u683C\u5F0F\u4E0D\u5408\u6CD5" };
  const user = await getUserByUsername(env2, owner);
  if (!user)
    return { error: "\u7528\u6237\u4E0D\u5B58\u5728" };
  const limit = user.routeLimit || DEFAULT_USER_ROUTE_LIMIT;
  const isRename = oldPrefix && oldPrefix !== prefix;
  const lookupPrefix = isRename ? oldPrefix : prefix;
  const source = data.source === "legacy" ? "legacy" : "user";
  const routeId = Number(data.routeId || data.id || 0) || 0;
  if (source === "legacy") {
    const row = await getLegacyRouteForUser(env2, user, routeId, lookupPrefix);
    if (!row)
      return { error: "\u8DEF\u7531\u4E0D\u5B58\u5728\u6216\u4E0D\u5C5E\u4E8E\u5F53\u524D\u8D26\u53F7" };
    if (isRename) {
      const clashUser = await env2.DB.prepare("SELECT 1 AS x FROM user_routes WHERE owner = ? AND prefix = ?").bind(owner, prefix).first();
      if (clashUser)
        return { error: "\u8DEF\u5F84 /" + prefix + " \u5DF2\u5B58\u5728" };
      const clashLegacy = await env2.DB.prepare("SELECT 1 AS x FROM routes WHERE user_id = ? AND prefix = ? AND rowid <> ?").bind(user.id, prefix, row._rid).first();
      if (clashLegacy)
        return { error: "\u8DEF\u5F84 /" + prefix + " \u5DF2\u5B58\u5728" };
      const clashOther = await env2.DB.prepare("SELECT 1 AS x FROM routes WHERE prefix = ? AND (user_id IS NULL OR user_id <> ?)").bind(prefix, user.id).first();
      if (clashOther)
        return { error: "\u8DEF\u5F84 /" + prefix + " \u5DF2\u88AB\u5176\u4ED6\u8DEF\u7531\u5360\u7528" };
    }
    await env2.DB.prepare(`UPDATE routes SET prefix = ?, target = ?, stream_target = ?, remark = ?, cache_img = ?, compat_mode = ?, ip_mode = ?,
        custom_headers = ?, ip_allow = ?, ip_block = ? WHERE rowid = ? AND user_id = ?`).bind(prefix, targets.join(","), streamTargets.join(","), String(data.remark || ""), data.cache_img === "off" ? "off" : "on", data.compat_mode === "on" ? "on" : "off", normalizeIpMode(data.ip_mode), String(data.custom_headers || "").trim(), allowList.join(","), blockList.join(","), row._rid, user.id).run();
    clearRouteCache();
    await auditLog(env2, isRename ? "user.route.rename" : "user.route.save", owner + " /" + prefix + " (\u5386\u53F2\u8DEF\u7531)");
    return { ok: true };
  }
  if (isRename) {
    const clash = await env2.DB.prepare("SELECT 1 AS x FROM user_routes WHERE owner = ? AND prefix = ?").bind(owner, prefix).first();
    if (clash)
      return { error: "\u8DEF\u5F84 /" + prefix + " \u5DF2\u5B58\u5728" };
  } else if (!oldPrefix) {
    const existing2 = await env2.DB.prepare("SELECT 1 AS x FROM user_routes WHERE owner = ? AND prefix = ?").bind(owner, prefix).first();
    if (existing2)
      return { error: "\u8DEF\u5F84 /" + prefix + " \u5DF2\u5B58\u5728\uFF0C\u8BF7\u76F4\u63A5\u7F16\u8F91\u5B83" };
    if (await routesHasUserId(env2)) {
      const legacyClash = await env2.DB.prepare("SELECT 1 AS x FROM routes WHERE user_id = ? AND prefix = ?").bind(user.id, prefix).first();
      if (legacyClash)
        return { error: "\u8DEF\u5F84 /" + prefix + " \u5DF2\u5B58\u5728\uFF0C\u8BF7\u76F4\u63A5\u7F16\u8F91\u5B83" };
    }
    const total = await countUserRoutes(env2, user);
    if (total >= limit)
      return { error: "\u8DEF\u7531\u6570\u91CF\u5DF2\u8FBE\u4E0A\u9650\uFF08" + limit + " \u6761\uFF09\uFF0C\u8BF7\u8054\u7CFB\u7BA1\u7406\u5458\u8C03\u6574" };
  }
  const legacyUserId = await userRoutesHaveLegacyUserId(env2);
  const existing = await env2.DB.prepare("SELECT sort_order, last_play, enabled" + (legacyUserId ? ", id" : "") + " FROM user_routes WHERE owner = ? AND prefix = ?").bind(owner, lookupPrefix).first();
  if (oldPrefix && !existing) return { error: "\u539F\u8DEF\u7531\u4E0D\u5B58\u5728\u6216\u4E0D\u5C5E\u4E8E\u5F53\u524D\u8D26\u53F7" };
  const names = ["owner", "prefix", "target", "stream_target", "remark", "cache_img", "compat_mode", "ip_mode", "last_play", "sort_order", "enabled", "custom_headers", "ip_allow", "ip_block"];
  const values = [owner, prefix, targets.join(","), streamTargets.join(","), String(data.remark || ""), data.cache_img === "off" ? "off" : "on", data.compat_mode === "on" ? "on" : "off", normalizeIpMode(data.ip_mode), existing?.last_play || "", existing?.sort_order || 0, existing?.enabled === 0 ? 0 : 1, String(data.custom_headers || "").trim(), allowList.join(","), blockList.join(",")];
  if (existing) {
    await env2.DB.prepare("UPDATE user_routes SET " + names.map((name) => name + " = ?").join(", ") + " WHERE owner = ? AND prefix = ?").bind(...values, owner, lookupPrefix).run();
  } else {
    if (legacyUserId) {
      names.unshift("user_id");
      values.unshift(user.id);
    }
    await env2.DB.prepare("INSERT INTO user_routes (" + names.join(", ") + ") VALUES (" + names.map(() => "?").join(", ") + ")").bind(...values).run();
  }
  clearRouteCache();
  await auditLog(env2, "user.route.save", owner + " /" + prefix);
  return { ok: true };
}
async function userDeleteRoute(env2, owner, prefix, source) {
  const p = normalizePrefix(prefix);
  if (!p)
    return { error: "\u7F3A\u5C11\u8DEF\u5F84\u53C2\u6570" };
  const user = await getUserByUsername(env2, owner);
  let changes = 0;
  if (source === "legacy" && user && await routesHasUserId(env2)) {
    const res = await env2.DB.prepare("DELETE FROM routes WHERE user_id = ? AND prefix = ?").bind(user.id, p).run();
    changes = Number(res.meta?.changes) || 0;
  } else {
    const res = await env2.DB.prepare("DELETE FROM user_routes WHERE owner = ? AND prefix = ?").bind(owner, p).run();
    changes = Number(res.meta?.changes) || 0;
    if (!changes && !source && user && await routesHasUserId(env2)) {
      const res2 = await env2.DB.prepare("DELETE FROM routes WHERE user_id = ? AND prefix = ?").bind(user.id, p).run();
      changes = Number(res2.meta?.changes) || 0;
    }
  }
  if (!changes)
    return { error: "\u8DEF\u7531\u4E0D\u5B58\u5728" };
  clearRouteCache();
  await auditLog(env2, "user.route.delete", owner + " /" + p);
  return { ok: true };
}

// src/editions/multi/maintenance.js
async function runHealthCheck(env2, manual = false) {
  if (!env2.DB)
    return { checked: 0, alerts: [] };
  const legacy = await routesHasUserId(env2);
  const { results: rows } = await env2.DB.prepare(legacy ? "SELECT prefix, target, remark, created_by, COALESCE((SELECT username FROM users WHERE users.id = routes.user_id), '') AS owner FROM routes WHERE enabled != 0" : "SELECT prefix, target, remark, created_by FROM routes WHERE enabled != 0").all();
  const routes = (rows || []).map((r) => ({ ...r, prefix: r.owner ? r.owner + "/" + r.prefix : r.prefix }));
  let userRoutes = [];
  try {
    const res = await env2.DB.prepare("SELECT owner, prefix, target, remark FROM user_routes WHERE enabled != 0").all();
    userRoutes = (res.results || []).map((r) => ({
      prefix: r.owner + "/" + r.prefix,
      target: r.target,
      remark: r.remark || "",
      owner: r.owner
    }));
  } catch (_) {
  }
  const { results: states } = await env2.DB.prepare("SELECT * FROM route_health").all();
  const stateMap = new Map((states || []).map((r) => [r.prefix + "|" + r.target, r]));
  const jobs = [];
  for (const r of [...routes || [], ...userRoutes]) {
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
    if (changed) alerts.push(await privateHealthAlert(env2, r.prefix, index, down, { remark: r.remark, targets: splitTargets(r.target), owner: r.owner || r.created_by }));
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

// text-asset:web/multi/frontend.js
var frontend_default = `var TAG = { fast:'\u6781\u5FEB', good:'\u826F\u597D', slow:'\u8F83\u6162', timeout:'\u8D85\u65F6' };
var CLS = { fast:'tag-fast', good:'tag-good', slow:'tag-slow', timeout:'tag-timeout' };

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
      ['\u843D\u5730 COLO', d.egressColo],
    ].map(function(kv){ return '<div class="edge-item"><strong>'+kv[0]+'</strong><span>'+(kv[1]||'\u2014')+'</span></div>'; }).join('');
  } catch(e) { document.getElementById('edge-loading').textContent = '\u52A0\u8F7D\u5931\u8D25'; }
}

function renderDomainTable(results, best) {
  const wrap = document.getElementById('domain-table-wrap');
  if (!results.length) { wrap.innerHTML = '<p class="muted">\u65E0\u6570\u636E</p>'; return; }
  let html = '<div style="overflow-x:auto;-webkit-overflow-scrolling:touch"><table style="min-width:520px"><thead><tr><th>#</th><th>\u540D\u79F0</th><th>\u57DF\u540D</th><th>\u5EF6\u8FDF</th><th>\u72B6\u6001</th></tr></thead><tbody>';
  results.forEach((r, i) => {
    const host = r.host || r.domain;
    const isBest = best && best.domain === r.domain;
    const pct = r.latency >= 0 ? Math.max(5, Math.min(100, Math.round(r.latency / 3))) : 0;
    html += '<tr class="'+(isBest?'best':'')+'"><td class="mono" style="color:var(--text-faint)">'+(i+1)+'</td>'
      + '<td style="white-space:nowrap">'+ (r.name||'\u2014') + (isBest?' <span class="tag tag-best">BEST</span>':'') +'</td>'
      + '<td><code style="font-size:12px">'+host+'</code></td>'
      + '<td><div class="lat"><div class="lat-bar"><i style="width:'+pct+'%"></i></div><span>'+(r.latency>=0?r.latency+' ms':'\u2014')+'</span></div></td>'
      + '<td><span class="tag '+CLS[r.status||'timeout']+'">'+(TAG[r.status]||'\u2014')+'</span></td></tr>';
  });
  wrap.innerHTML = html + '</tbody></table></div>';
}



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
  st.textContent = '\u6B63\u5728\u6D4B\u901F...';
  wrap.innerHTML = '<p class="muted"><span class="spin"></span>\u6B63\u5728\u6D4B\u8BD5\u60A8\u672C\u5730\u7F51\u7EDC\u5230\u5404\u4F18\u9009\u57DF\u540D\u7684\u5EF6\u8FDF...</p>';

  const domains = await getOptimizedDomains();
  const clientResults = await speedTestDomains(domains, function(d, n) { st.textContent = '\u6B63\u5728\u6D4B\u901F ' + d + '/' + n + '\uFF08\u5728\u60A8\u672C\u673A\u6D4F\u89C8\u5668\u4E2D\u8FDB\u884C\uFF0C\u6BCF\u4E2A\u57DF\u540D\u6D4B 4 \u6B21\u53D6\u4E2D\u4F4D\u6570\uFF09'; });
  finalizeResults(clientResults);
  const clientOk = clientResults.filter(r => r.latency >= 0).length;
  const best = clientResults.find(r => r.latency >= 0);
  renderDomainTable(clientResults, best);

  if (clientOk > 0) {
    st.textContent = '\u6D4B\u901F\u5B8C\u6210 \xB7 ' + clientOk + ' \u4E2A\u53EF\u7528 \xB7 \u63A8\u8350: ' + (best ? best.domain : '\u65E0');
  } else {
    st.textContent = '\u6D4B\u901F\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u7F51\u7EDC\u6216\u7A0D\u540E\u91CD\u8BD5';
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
    document.getElementById('st-req-sub').textContent = '\u6765\u6E90: ' + (d.data.source || 'CF \u6570\u636E\u4E0D\u53EF\u7528');
    document.getElementById('st-traffic').textContent = d.data.todayTraffic || '0 B';
    document.getElementById('st-traffic-sub').textContent = '\u6765\u6E90: ' + (d.data.source || 'CF \u6570\u636E\u4E0D\u53EF\u7528') + ' \xB7 CF \u8FB9\u7F18\u51FA\u7AD9';
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

document.getElementById('btn-retest').onclick = () => runDomainSpeed(true);
loadEdge();
runDomainSpeed(false);
loadStats();
`;

// text-asset:web/multi/login.js
var login_default = "async function login(){\n  const u=document.getElementById('usernameInput').value.trim();\n  const p=document.getElementById('passwordInput').value;\n  const err=document.getElementById('loginErr');\n  const btn=document.getElementById('loginBtn');\n  err.textContent='';\n  if(!p){ err.textContent='\u8BF7\u8F93\u5165\u5BC6\u7801 / \u7BA1\u7406\u5BC6\u94A5'; return; }\n  btn.disabled=true; btn.textContent='\u9A8C\u8BC1\u4E2D...';\n  const body = u ? {username:u,password:p} : {token:p};\n  try{\n    const r=await fetch('/admin/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});\n    const d=await r.json();\n    if(d.ok){ location.href='/admin'; return; }\n    err.textContent=d.error||'\u767B\u5F55\u5931\u8D25';\n  } catch(e){ err.textContent='\u8BF7\u6C42\u5931\u8D25: '+e.message; }\n  btn.disabled=false; btn.textContent='\u767B \u5F55';\n}\n";

// text-asset:web/multi/register.js
var register_default = "async function register(){\n  const invite=document.getElementById('regInvite').value.trim();\n  const username=document.getElementById('regUsername').value.trim();\n  const password=document.getElementById('regPassword').value;\n  const password2=document.getElementById('regPassword2').value;\n  const err=document.getElementById('regErr');\n  const btn=document.getElementById('regBtn');\n  err.textContent='';\n  if(!invite){ err.textContent='\u8BF7\u8F93\u5165\u9080\u8BF7\u7801'; return; }\n  if(!username){ err.textContent='\u8BF7\u8F93\u5165\u7528\u6237\u540D'; return; }\n  if(!/^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/.test(username.toLowerCase())){ err.textContent='\u7528\u6237\u540D\u9700\u4E3A 3-32 \u4F4D\u5C0F\u5199\u5B57\u6BCD\u3001\u6570\u5B57\u6216\u77ED\u6A2A\u7EBF\uFF0C\u4E14\u4E0D\u80FD\u4EE5 - \u5F00\u5934/\u7ED3\u5C3E'; return; }\n  if(password.length<6){ err.textContent='\u5BC6\u7801\u81F3\u5C11 6 \u4F4D'; return; }\n  if(password!==password2){ err.textContent='\u4E24\u6B21\u8F93\u5165\u7684\u5BC6\u7801\u4E0D\u4E00\u81F4'; return; }\n  btn.disabled=true; btn.textContent='\u6CE8\u518C\u4E2D...';\n  try{\n    const r=await fetch('/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({invite,username,password})});\n    const d=await r.json();\n    if(d.ok){\n      if(d.dnsWarning){ alert('\u8D26\u53F7\u5DF2\u521B\u5EFA\uFF0C\u4F46 DNS \u8BB0\u5F55\u81EA\u52A8\u521B\u5EFA\u5931\u8D25\uFF1A' + d.dnsWarning + '\\n\\n\u767B\u5F55\u540E\u53EF\u5728\u300C\u6211\u7684\u5165\u53E3\u300D\u4E2D\u91CD\u8BD5\u3002'); }\n      location.href='/admin'; return;\n    }\n    err.textContent=d.error||'\u6CE8\u518C\u5931\u8D25';\n  } catch(e){ err.textContent='\u8BF7\u6C42\u5931\u8D25: '+e.message; }\n  btn.disabled=false; btn.textContent='\u6CE8 \u518C';\n}\n";

// text-asset:web/multi/admin.js
var admin_default = `var IS_ADMIN = window.__EMBY_PAGE__.isAdmin;
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

// ===== \u8DEF\u7531\uFF08\u7BA1\u7406\u5458=\u5168\u5C40\u8DEF\u7531\uFF1B\u666E\u901A\u7528\u6237=\u81EA\u5DF1\u7684\u8DEF\u7531\uFF09=====
async function loadRoutes() {
  try {
    const r = await fetch(ROUTE_API);
    if (r.status === 401) { location.href = '/admin'; return; }
    const d = await r.json();
    allRoutes = Array.isArray(d) ? d : [];
    renderRoutes(allRoutes);
  } catch (e) {
    document.getElementById('routeList').innerHTML = '<p class="muted">\u52A0\u8F7D\u5931\u8D25: ' + esc(e.message) + '</p>';
  }
}

function renderRoutes(list) {
  const el = document.getElementById('routeList');
  var countChip = document.getElementById('routeCount');
  if (countChip) countChip.textContent = list.length + ' \u6761';
  if (!list.length) {
    el.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><span class="empty-state-icon">\u{1F4E6}</span><p class="empty-state-text">\u6682\u65E0\u8DEF\u7531\uFF0C\u70B9\u51FB\u4E0A\u65B9\u6309\u94AE\u6DFB\u52A0</p></div>';
    return;
  }
  el.innerHTML = list.map(function(r, ri) {
    const targets = String(r.target || '').split(',').map(function(s) { return s.trim(); }).filter(Boolean);
    const remarkName = r.remark || '\u672A\u547D\u540D';
    const cacheStatus = r.cache_img !== 'off';
    const compatStatus = r.compat_mode === 'on';
    let targetsHtml = '';
    targets.forEach(function(t, idx) {
      const tag = idx === 0 ? '<span style="color:var(--ok);font-weight:700">[\u4E3B]</span>' : '<span style="color:var(--warn);font-weight:700">[\u5907' + idx + ']</span>';
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
        (disabled ? '<span class="meta-tag" style="color:var(--warn);border-color:var(--warn-dim)">\u23F8 \u5DF2\u505C\u7528</span>' : '') +
        (isLegacy ? '<span class="meta-tag" style="color:var(--info);border-color:var(--info-dim)">\u{1F4DC} \u5386\u53F2\u8DEF\u7531</span>' : '') +
        (r.down_count ? '<span class="meta-tag" style="color:var(--warn);border-color:var(--warn-dim)">\u{1F534} ' + r.down_count + ' \u6761\u7EBF\u8DEF\u5F02\u5E38</span>' : '') +
        (cacheStatus ? '<span class="meta-tag">\u{1F5BC}\uFE0F \u7F13\u5B58\u5F00\u542F</span>' : '<span class="meta-tag">\u7F13\u5B58\u5173\u95ED</span>') +
        (compatStatus ? '<span class="meta-tag" style="color:var(--warn);border-color:var(--warn-dim)">\u{1F527} \u517C\u5BB9\u6A21\u5F0F</span>' : '') +
        (r.ip_mode === 'strip' ? '<span class="meta-tag" style="color:var(--info);border-color:var(--info-dim)">\u{1F6E1}\uFE0F IP\u4E0D\u900F\u4F20</span>' : '') +
        (r.ip_mode === 'disable' ? '<span class="meta-tag" style="color:var(--ok);border-color:var(--ok-dim)">\u{1F6E1}\uFE0F IP\u5F7B\u5E95\u9690\u85CF</span>' : '') +
        (r.today_req ? '<span class="meta-tag">\u{1F4CA} \u4ECA\u65E5 ' + r.today_req + ' \u6B21 / ' + fmtB(r.today_bytes) + '\uFF08\u5386\u53F2\uFF09</span>' : '') +
        (r.last_play ? '<span class="meta-tag">\u{1F4FA} \u6700\u8FD1\u64AD\u653E ' + esc(String(r.last_play).slice(5, 16)) + '</span>' : '') +
      '</div>' +
      '<div class="route-actions">' +
        '<button class="btn btn-sm" data-act="up" data-prefix="' + esc(r.prefix) + '"' + srcAttr + (ri === 0 ? ' disabled' : '') + '>\u2191</button>' +
        '<button class="btn btn-sm" data-act="down" data-prefix="' + esc(r.prefix) + '"' + srcAttr + (ri === list.length - 1 ? ' disabled' : '') + '>\u2193</button>' +
        '<button class="btn btn-sm" data-act="test" data-prefix="' + esc(r.prefix) + '"' + srcAttr + '>\u6D4B\u8BD5</button>' +
        '<button class="btn btn-sm" data-act="toggle" data-prefix="' + esc(r.prefix) + '"' + srcAttr + ' data-enabled="' + (disabled ? '1' : '0') + '">' + (disabled ? '\u542F\u7528' : '\u505C\u7528') + '</button>' +
        '<button class="btn btn-sm" data-act="edit" data-prefix="' + esc(r.prefix) + '"' + srcAttr + ' data-id="' + esc(r.id || '') + '">\u7F16\u8F91</button>' +
        '<button class="btn btn-sm btn-danger" data-act="del" data-prefix="' + esc(r.prefix) + '"' + srcAttr + '>\u5220\u9664</button>' +
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
  showToast(x.ok ? (enable ? '\u5DF2\u542F\u7528' : '\u5DF2\u505C\u7528') : (x.data.error || '\u64CD\u4F5C\u5931\u8D25'));
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
  btn.disabled = true; btn.textContent = '\u6D4B\u8BD5\u4E2D';
  const x = await postJson(ROUTE_API + '/test', { prefix: prefix, source: source || '' });
  btn.disabled = false; btn.textContent = '\u6D4B\u8BD5';
  if (!x.ok) { showToast(x.data.error || '\u6D4B\u8BD5\u5931\u8D25'); return; }
  showToast(x.data.results.map(function(r, i) {
    return (i === 0 ? '\u4E3B' : '\u5907' + i) + ' ' + (r.ok ? r.ms + 'ms' : '\u5931\u8D25');
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
  document.getElementById('routeModalTitle').textContent = '\u6DFB\u52A0\u8DEF\u7531';
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
  document.getElementById('routeStreamTarget').value = String(r.stream_target || '').split(',').map(function(x) { return x.trim(); }).filter(Boolean).join('\\n');
  document.getElementById('routeCompat').checked = r.compat_mode === 'on';
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
  let prefix = document.getElementById('routePrefix').value.trim();
  while (prefix.startsWith('/')) prefix = prefix.slice(1);
  while (prefix.endsWith('/')) prefix = prefix.slice(0, -1);
  const target = document.getElementById('routeTarget').value.split(/[\\r\\n,]+/).map(function(s) { return s.trim(); }).filter(Boolean).join(',');
  if (!prefix) { showToast('\u8BF7\u8F93\u5165\u8DEF\u5F84'); return; }
  if (!target) { showToast('\u8BF7\u81F3\u5C11\u586B\u5199\u4E00\u4E2A\u76EE\u6807\u5730\u5740'); return; }

  const r = await fetch(ROUTE_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      oldPrefix: oldPrefix, prefix: prefix, target: target, remark: remark,
      source: document.getElementById('routeSource').value || '',
      routeId: document.getElementById('routeId').value || '',
      stream_target: document.getElementById('routeStreamTarget').value.split(/[\\r\\n,]+/).map(function(s) { return s.trim(); }).filter(Boolean).join(','),
      cache_img: document.getElementById('routeCache').checked ? 'on' : 'off',
      compat_mode: document.getElementById('routeCompat').checked ? 'on' : 'off',
      ip_mode: document.getElementById('routeIpMode').value || 'forward',
      custom_headers: document.getElementById('routeHeaders').value,
      ip_allow: document.getElementById('routeIpAllow').value,
      ip_block: document.getElementById('routeIpBlock').value
    })
  });
  const d = await r.json();
  if (!r.ok) { showToast(d.error || '\u4FDD\u5B58\u5931\u8D25'); return; }
  closeModal('modalRoute');
  showToast('\u4FDD\u5B58\u6210\u529F');
  loadRoutes();
  if (!IS_ADMIN) loadUserEntry();
}

async function delRoute(prefix, source) {
  if (!confirm('\u786E\u5B9A\u5220\u9664\u8DEF\u7531 /' + prefix + ' \uFF1F')) return;
  await fetch(ROUTE_API + '?prefix=' + encodeURIComponent(prefix) + (source ? '&source=' + encodeURIComponent(source) : ''), { method: 'DELETE' });
  showToast('\u5DF2\u5220\u9664');
  loadRoutes();
  if (!IS_ADMIN) loadUserEntry();
}

// ===== \u7EDF\u8BA1 =====
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
    const srcLabel = src === 'account' ? 'CF \u8D26\u53F7\u5206\u6790\uFF08\u6574\u4E2A\u57DF\u540D\uFF09' : (src === 'zone' ? 'CF Zone Analytics\uFF08\u4EC5\u4E3B\u57DF\u540D\uFF09' : 'CF \u6570\u636E\u4E0D\u53EF\u7528');
    document.getElementById('st-req').textContent = data.todayRequests == null ? '\u2014' : data.todayRequests;
    document.getElementById('st-req-sub').textContent = '\u6765\u6E90: ' + (isUserScope ? (src === 'account' ? 'CF \u8D26\u53F7\u5206\u6790\uFF08\u6211\u7684\u57DF\u540D\uFF09' : srcLabel) : srcLabel);
    document.getElementById('st-traffic').textContent = data.todayTraffic || '\u2014';
    document.getElementById('st-traffic-sub').textContent = '\u6765\u6E90: ' + (isUserScope ? (src === 'account' ? '\u771F\u5B9E\u51FA\u7AD9\u6D41\u91CF\uFF08CF \u8D26\u53F7\u5206\u6790\xB7\u6211\u7684\u57DF\u540D\uFF09' : 'CF \u6570\u636E\u4E0D\u53EF\u7528') : (src === 'account' ? '\u771F\u5B9E\u51FA\u7AD9\u6D41\u91CF\uFF08CF \u8D26\u53F7\u5206\u6790\xB7\u6574\u4E2A\u57DF\u540D\uFF09' : (src === 'zone' ? 'CF edgeResponseBytes\uFF08\u4EC5\u4E3B\u57DF\u540D\uFF09' : 'CF \u6570\u636E\u4E0D\u53EF\u7528')));
    document.getElementById('st-uv').textContent = data.todayVisits == null ? '\u2014' : data.todayVisits;
    document.getElementById('st-uv-sub').textContent = isUserScope ? '\u7528\u6237\u7EF4\u5EA6\u4E0D\u7EDF\u8BA1\u72EC\u7ACB\u8BBF\u95EE' : '\u6765\u6E90: CF \u72EC\u7ACB\u8BBF\u95EE\uFF08\u5168\u7AD9\uFF09';
    var chip = document.getElementById('statsChip');
    if (chip) chip.textContent = data.cfStatus || (isUserScope ? 'CF' : 'STATS');
    const envInfo = data.envInfo || {};
    document.getElementById('st-updated').textContent = '\u66F4\u65B0\u65F6\u95F4 ' + (data.lastUpdated || '')
      + ' \xB7 ' + (data.cfStatus || '')
      + (envInfo.statsHost ? ' \xB7 \u7EDF\u8BA1\u57DF\u540D ' + envInfo.statsHost : '')
      + (data.cfError ? ' (' + data.cfError + ')' : '');
    const hourly = data.hourlySeries || [];
    if (hourly.length) {
      const max = Math.max(1, Math.max.apply(null, hourly.map(function(h) { return h.total; })));
      let hhtml = '<div class="chart">';
      hourly.forEach(function(h) {
        const ht = Math.max(2, Math.round((h.total / max) * 68));
        const label = h.label || '';
        hhtml += '<div class="chart-col" title="' + label + ' \xB7 ' + h.total + ' \u6B21"><i style="height:' + ht + 'px"></i><b>' + label.slice(0, 2) + '</b></div>';
      });
      hhtml += '</div><p class="muted" style="font-size:11px;margin-top:6px">\u4ECA\u65E5 24 \u5C0F\u65F6\u8BF7\u6C42\u5206\u5E03\uFF08\u4E0A\u6D77\u65F6\u533A\uFF09</p>';
      document.getElementById('hourly-chart').innerHTML = hhtml;
    }
  } catch (e) {
    const el = document.getElementById('stats-loading');
    if (el) el.textContent = '\u7EDF\u8BA1\u52A0\u8F7D\u5931\u8D25';
  }
}

// ===== \u7528\u6237\u4E2D\u5FC3 =====
async function loadUserEntry() {
  if (IS_ADMIN) return;
  try {
    const results = await Promise.all([fetch('/api/user/me'), fetch('/api/user/dns')]);
    const me = await results[0].json();
    let dns = {};
    try { dns = await results[1].json(); } catch (e) {}
    document.getElementById('entryUser').textContent = me.user ? me.user.username : USERNAME;
    document.getElementById('entryHost').textContent = me.entryHost || '\u672A\u914D\u7F6E';
    document.getElementById('entryRoutes').textContent = (me.routeCount || 0) + ' / ' + (me.routeLimit || 0) + ' \u6761';
    const entryUrl = document.getElementById('entryUrl');
    if (me.entryUrl) {
      entryUrl.href = me.entryUrl;
      entryUrl.textContent = '\u6253\u5F00 ' + me.entryHost;
    } else {
      entryUrl.href = '#';
      entryUrl.textContent = '\u6253\u5F00\u5165\u53E3';
    }
    const hint = document.getElementById('entryHint');
    if (hint) hint.textContent = me.workerRouteHint || '';
    const limitHint = document.getElementById('routeLimitHint');
    if (limitHint) limitHint.textContent = '\u5DF2\u7528 ' + (me.routeCount || 0) + ' / ' + (me.routeLimit || 0) + ' \u6761\u8DEF\u7531';
    const dnsEl = document.getElementById('entryDns');
    if (dns.record) {
      dnsEl.textContent = '[' + dns.record.type + '] ' + dns.record.content + (dns.record.proxied ? '\uFF08\u5DF2\u4EE3\u7406\uFF09' : '\uFF08\u5C0F\u9EC4\u4E91\u5173\u95ED\uFF09');
    } else if (dns.zoneError) {
      dnsEl.textContent = '\u26A0\uFE0F ' + dns.zoneError;
    } else {
      dnsEl.textContent = '\u5C1A\u672A\u521B\u5EFA';
    }
    const dnsInput = document.getElementById('entryDnsValue');
    if (dnsInput) dnsInput.value = dns.record ? dns.record.content : (dns.defaultTarget || 'youxuan.cf.090227.xyz');
  } catch (e) {
    const el = document.getElementById('entryHost');
    if (el) el.textContent = '\u52A0\u8F7D\u5931\u8D25';
  }
}

async function saveUserDNS(btn) {
  const input = document.getElementById('entryDnsValue');
  const target = input ? input.value.trim() : '';
  if (!target) { showToast('\u8BF7\u8F93\u5165 IP \u6216\u57DF\u540D'); return; }
  if (btn) { btn.disabled = true; btn.textContent = '\u4FDD\u5B58\u4E2D...'; }
  try {
    const r = await fetch('/api/user/dns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target }) });
    const d = await r.json().catch(function() { return {}; });
    if (r.ok && d.ok) {
      showToast('\u2705 ' + (d.type || 'CNAME') + ' ' + d.entryHost + ' \u2192 ' + d.target + '\uFF08\u5C0F\u9EC4\u4E91\u5173\u95ED\uFF09', 5000);
      loadUserEntry();
    } else {
      showToast('\u274C ' + (d.error || '\u4FDD\u5B58\u5931\u8D25'), 7000);
    }
  } catch (e) {
    showToast('\u274C \u8BF7\u6C42\u5931\u8D25: ' + e.message);
  }
  if (btn) { btn.disabled = false; btn.textContent = '\u4FDD\u5B58 DNS \u503C'; }
}

async function ensureUserDNS(btn) {
  if (btn) { btn.disabled = true; btn.textContent = '\u521B\u5EFA\u4E2D...'; }
  try {
    const r = await fetch('/api/user/dns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const d = await r.json();
    if (d.ok) {
      showToast('\u2705 ' + (d.type || 'CNAME') + ' ' + d.entryHost + ' \u2192 ' + d.target + '\uFF08\u5C0F\u9EC4\u4E91\u5173\u95ED\uFF09', 5000);
      loadUserEntry();
    } else {
      showToast('\u274C ' + (d.error || '\u521B\u5EFA\u5931\u8D25'), 7000);
    }
  } catch (e) {
    showToast('\u274C \u8BF7\u6C42\u5931\u8D25: ' + e.message);
  }
  if (btn) { btn.disabled = false; btn.textContent = '\u91CD\u65B0\u521B\u5EFA DNS'; }
}

async function changePassword() {
  ['currentPassword', 'newPassword', 'confirmPassword'].forEach(id => { document.getElementById(id).value = ''; });
  openModal('modalPassword');
}

// ===== \u7BA1\u7406\u5458\uFF1A\u7528\u6237 / \u9080\u8BF7\u7801 =====
async function loadUsers() {
  if (!IS_ADMIN) return;
  try {
    const r = await fetch('/admin/api/users');
    const d = await r.json();
    allUsers = d.users || [];
    renderUsers(allUsers);
  } catch (e) {
    document.getElementById('userList').textContent = '\u52A0\u8F7D\u5931\u8D25: ' + e.message;
  }
}

function renderUsers(list) {
  const el = document.getElementById('userList');
  const chip = document.getElementById('userCount');
  if (chip) chip.textContent = list.length + ' \u4EBA';
  if (!list.length) { el.innerHTML = '<p class="muted">\u6682\u65E0\u7528\u6237\uFF0C\u70B9\u4E0A\u65B9\u6309\u94AE\u521B\u5EFA</p>'; return; }
  let html = '<div style="overflow-x:auto"><table><thead><tr><th>\u7528\u6237\u540D</th><th>\u5B50\u57DF\u540D</th><th>\u89D2\u8272</th><th>\u72B6\u6001</th><th>\u8DEF\u7531</th><th>\u6700\u8FD1\u767B\u5F55</th><th>\u64CD\u4F5C</th></tr></thead><tbody>';
  list.forEach(function(u) {
    const disabled = u.status === 'disabled';
    html += '<tr' + (disabled ? ' style="opacity:.55"' : '') + '>' +
      '<td><code>' + esc(u.username) + '</code></td>' +
      '<td><code>' + esc(u.subdomain || '\u2014') + '</code></td>' +
      '<td>' + (u.role === 'admin' ? '\u7BA1\u7406\u5458' : '\u666E\u901A\u7528\u6237') + '</td>' +
      '<td>' + (disabled ? '<span style="color:var(--warn)">\u7981\u7528</span>' : '<span style="color:var(--ok)">\u6B63\u5E38</span>') + '</td>' +
      '<td>' + (u.routeCount || 0) + ' / ' + (u.routeLimit || 0) + '</td>' +
      '<td style="white-space:nowrap">' + (u.lastLogin ? esc(String(u.lastLogin).replace('T', ' ').slice(0, 16)) + ' UTC' : '<span class="muted">\u4ECE\u672A\u767B\u5F55</span>') + '</td>' +
      '<td style="white-space:nowrap">' +
        '<button class="btn btn-sm" onclick="editUser(' + u.id + ')">\u7F16\u8F91</button> ' +
        '<button class="btn btn-sm" onclick="toggleUser(' + u.id + ',' + (disabled ? 'true' : 'false') + ')">' + (disabled ? '\u542F\u7528' : '\u7981\u7528') + '</button> ' +
        '<button class="btn btn-sm btn-danger" onclick="delUser(' + u.id + ')">\u5220\u9664</button>' +
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
  document.getElementById('userPassword').placeholder = u ? '\u7559\u7A7A\u8868\u793A\u4E0D\u4FEE\u6539\u5BC6\u7801' : '\u81F3\u5C11 6 \u4F4D';
  document.getElementById('userSubdomain').value = u ? (u.subdomain || '') : '';
  document.getElementById('userRole').value = u ? (u.role || 'user') : 'user';
  document.getElementById('userStatus').value = u ? (u.status || 'active') : 'active';
  document.getElementById('userRouteLimit').value = u ? (u.routeLimit || 20) : 20;
  document.getElementById('userModalTitle').textContent = u ? '\u7F16\u8F91\u7528\u6237' : '\u6DFB\u52A0\u7528\u6237';
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
  if (!data.username) { showToast('\u8BF7\u8F93\u5165\u7528\u6237\u540D'); return; }
  if (!id && !data.password) { showToast('\u8BF7\u8F93\u5165\u5BC6\u7801'); return; }
  const r = await fetch(id ? '/admin/api/users/' + id : '/admin/api/users', {
    method: id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  const d = await r.json();
  if (!r.ok) { showToast(d.error || '\u4FDD\u5B58\u5931\u8D25'); return; }
  closeModal('modalUser');
  if (d.dnsWarning) showToast('\u5DF2\u4FDD\u5B58\uFF0C\u4F46\u81EA\u52A8\u521B\u5EFA DNS \u5931\u8D25\uFF1A' + d.dnsWarning, 8000);
  else if (d.dns) showToast('\u5DF2\u4FDD\u5B58\uFF0C\u5DF2\u81EA\u52A8\u521B\u5EFA DNS\uFF1A' + d.dns.entryHost + ' \u2192 ' + d.dns.target, 5000);
  else showToast('\u4FDD\u5B58\u6210\u529F');
  loadUsers();
}

async function toggleUser(id, enable) {
  const r = await fetch('/admin/api/users/' + id, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: enable ? 'active' : 'disabled' })
  });
  const d = await r.json();
  showToast(r.ok ? (enable ? '\u5DF2\u542F\u7528' : '\u5DF2\u7981\u7528') : (d.error || '\u64CD\u4F5C\u5931\u8D25'));
  loadUsers();
}

async function delUser(id) {
  const u = allUsers.find(function(x) { return x.id === id; });
  if (!confirm('\u786E\u5B9A\u5220\u9664\u7528\u6237 ' + (u ? u.username : id) + ' \uFF1F\u5176\u8DEF\u7531\u548C\u7EDF\u8BA1\u4E5F\u4F1A\u88AB\u5220\u9664\u3002')) return;
  const r = await fetch('/admin/api/users/' + id, { method: 'DELETE' });
  const d = await r.json();
  showToast(r.ok ? '\u5DF2\u5220\u9664' : (d.error || '\u5220\u9664\u5931\u8D25'));
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
    document.getElementById('inviteList').textContent = '\u52A0\u8F7D\u5931\u8D25: ' + e.message;
  }
}

function renderInvites(list) {
  const el = document.getElementById('inviteList');
  if (!list.length) { el.innerHTML = '<p class="muted">\u6682\u65E0\u9080\u8BF7\u7801\uFF0C\u70B9\u4E0A\u65B9\u6309\u94AE\u751F\u6210</p>'; return; }
  let html = '<div style="overflow-x:auto"><table><thead><tr><th>\u9080\u8BF7\u7801</th><th>\u4F7F\u7528</th><th>\u8FC7\u671F</th><th>\u5907\u6CE8</th><th>\u64CD\u4F5C</th></tr></thead><tbody>';
  list.forEach(function(v) {
    const used = Number(v.usedCount) || 0;
    const max = Number(v.maxUses) || 0;
    html += '<tr>' +
      '<td><code>' + esc(v.code) + '</code></td>' +
      '<td>' + used + ' / ' + (max === 0 ? '\u221E' : max) + '</td>' +
      '<td>' + esc(v.expiresAt ? String(v.expiresAt).slice(0, 10) : '\u2014') + '</td>' +
      '<td>' + esc(v.note || '\u2014') + '</td>' +
      '<td style="white-space:nowrap">' +
        '<button class="btn btn-sm" onclick="copyInvite(\\'' + esc(v.code) + '\\')">\u590D\u5236</button> ' +
        '<button class="btn btn-sm btn-danger" onclick="delInvite(\\'' + esc(v.code) + '\\')">\u5220\u9664</button>' +
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
  if (!x.ok) { showToast(x.data.error || '\u751F\u6210\u5931\u8D25'); return; }
  closeModal('modalInvite');
  showToast('\u9080\u8BF7\u7801\uFF1A' + (x.data.invite ? x.data.invite.code : '\u5DF2\u751F\u6210'));
  loadInvites();
}

async function delInvite(code) {
  if (!confirm('\u786E\u5B9A\u5220\u9664\u9080\u8BF7\u7801 ' + code + ' \uFF1F')) return;
  try {
    const r = await fetch('/admin/api/invites/' + encodeURIComponent(code), { method: 'DELETE' });
    const d = await r.json().catch(function() { return {}; });
    if (r.ok) showToast(d.alreadyDeleted ? '\u9080\u8BF7\u7801\u5DF2\u4E0D\u5B58\u5728\uFF0C\u5217\u8868\u5DF2\u5237\u65B0' : '\u2705 \u9080\u8BF7\u7801\u5DF2\u5220\u9664');
    else showToast('\u274C ' + (d.error || '\u5220\u9664\u5931\u8D25'), 5000);
  } catch (e) {
    showToast('\u274C \u5220\u9664\u5931\u8D25: ' + e.message, 5000);
  }
  loadInvites();
}

async function clearInvites() {
  if (!confirm('\u786E\u5B9A\u5220\u9664\u5168\u90E8\u9080\u8BF7\u7801\u5417\uFF1F\\n\\n\u6240\u6709\u672A\u4F7F\u7528\u548C\u5DF2\u4F7F\u7528\u7684\u9080\u8BF7\u7801\u90FD\u4F1A\u88AB\u5220\u9664\uFF0C\u6B64\u64CD\u4F5C\u4E0D\u53EF\u6062\u590D\u3002')) return;
  showToast('\u6B63\u5728\u5220\u9664\u5168\u90E8\u9080\u8BF7\u7801...', 3000);
  const x = await postJson('/admin/api/invites/clear', { confirm: 'CLEAR' });
  if (x.ok) showToast('\u2705 \u5DF2\u5220\u9664\u5168\u90E8\u9080\u8BF7\u7801\uFF08' + ((x.data && x.data.deleted) || 0) + ' \u4E2A\uFF09', 4000);
  else showToast('\u274C ' + ((x.data && x.data.error) || '\u64CD\u4F5C\u5931\u8D25'), 5000);
  loadInvites();
}

function copyInvite(code) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(code).then(function() { showToast('\u5DF2\u590D\u5236\uFF1A' + code); }).catch(function() { prompt('\u590D\u5236\u9080\u8BF7\u7801', code); });
  } else {
    prompt('\u590D\u5236\u9080\u8BF7\u7801', code);
  }
}

async function resetStats() {
  if (!confirm('\u786E\u5B9A\u6E05\u7A7A\u6240\u6709\u7EDF\u8BA1\u6570\u636E\u5417\uFF1F\\n\\n\u8DEF\u7531\u3001\u7528\u6237\u3001\u57DF\u540D\u914D\u7F6E\u4F1A\u4FDD\u7559\uFF0C\u6B64\u64CD\u4F5C\u4E0D\u53EF\u6062\u590D\u3002')) return;
  showToast('\u6B63\u5728\u6E05\u7A7A\u7EDF\u8BA1...', 4000);
  const x = await postJson('/admin/api/db/reset', { scope: 'stats', confirm: 'RESET' });
  showToast(x.ok ? '\u2705 \u7EDF\u8BA1\u5DF2\u6E05\u7A7A' : ('\u274C ' + (x.data.error || '\u64CD\u4F5C\u5931\u8D25')), x.ok ? 2600 : 6000);
  loadStats(); loadUsers(); loadAudit();
}

// ===== \u7BA1\u7406\u5458\uFF1A\u8BBE\u7F6E / \u5BFC\u51FA\u5BFC\u5165 / \u57DF\u540D / DNS / \u65E5\u5FD7 =====
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
  document.getElementById('setDailyReport').checked = String(s.tg_daily_report == null ? '1' : s.tg_daily_report) !== '0';
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
  loadRelayCard();
  openModal('modalSettings');
}

function renderTelegramStatus(n) {
  document.getElementById('tgChatId').value = n.chatId || '';
  document.getElementById('tgBotToken').placeholder = n.tokenConfigured ? 'Token \u5DF2\u914D\u7F6E\uFF08\u7559\u7A7A\u4FDD\u6301\u4E0D\u53D8\uFF09' : '\u586B\u5199 Bot Token';
  document.getElementById('tgConfigStatus').textContent = n.error || ('\u6765\u6E90\uFF1A' + ({ web: '\u7F51\u9875\u52A0\u5BC6\u914D\u7F6E', environment: 'Worker \u73AF\u5883\u53D8\u91CF', disabled: '\u5DF2\u505C\u7528' }[n.source] || '\u672A\u77E5') + (n.encryptionReady ? ' \xB7 \u52A0\u5BC6\u5BC6\u94A5\u5DF2\u5C31\u7EEA' : ' \xB7 \u8BF7\u5148\u914D\u7F6E\u72EC\u7ACB\u52A0\u5BC6\u4E3B\u5BC6\u94A5\u6216\u5F3A SESSION_SECRET'));
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
    const response = await fetch('/admin/api/notifications');
    if (response.ok) renderTelegramStatus(await response.json());
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
  if (!confirm('\u4FEE\u6539\u540E\u5F53\u524D\u8D26\u53F7\u7684\u6240\u6709\u65E7\u4F1A\u8BDD\u90FD\u4F1A\u5931\u6548\uFF0C\u786E\u5B9A\u7EE7\u7EED\uFF1F')) return;
  btn.disabled = true;
  try {
    const x = await postJson(IS_ADMIN ? '/admin/api/security/password' : '/api/user/password', { currentPassword, newPassword, confirmPassword });
    if (!x.ok) { showToast(x.data.error || '\u4FEE\u6539\u5931\u8D25'); return; }
    location.href = '/';
  } catch { showToast('\u8BF7\u6C42\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u8FDE\u63A5'); } finally {
    ['currentPassword', 'newPassword', 'confirmPassword'].forEach(id => { document.getElementById(id).value = ''; });
    btn.disabled = false;
  }
}

// ===== VPS \u4E2D\u7EE7\u914D\u7F6E\u5361\uFF08v6.8.0\uFF1Bv6.8.3 \u589E\u52A0\u7528\u91CF\u7EDF\u8BA1\u5C55\u793A\uFF09=====
async function loadRelayCard() {
  try {
    const r = await fetch('/admin/api/relay');
    const d = await r.json();
    document.getElementById('setRelayUrl').value = d.relay_url || '';
    document.getElementById('setRelaySecret').value = '';
    document.getElementById('setRelaySecret').placeholder = d.has_secret ? '\u5DF2\u914D\u7F6E\uFF08' + d.secret_hint + '\uFF09\uFF0C\u7559\u7A7A\u8868\u793A\u4E0D\u4FEE\u6539' : '\u7559\u7A7A\u8868\u793A\u4E0D\u4FEE\u6539\u5BC6\u94A5';
    document.getElementById('setRelayEnabled').checked = d.relay_enabled === '1';
    document.getElementById('relayTestResult').textContent = d.active ? '\u5F53\u524D\u72B6\u6001\uFF1A\u5DF2\u542F\u7528' : '\u5F53\u524D\u72B6\u6001\uFF1A\u672A\u542F\u7528';
  } catch (e) { /* \u5FFD\u7565 */ }
  loadRelayUsage();
}

// \u901A\u7528\u503C\u6E32\u67D3\uFF1A\u6570\u5B57\u52A0\u5343\u5206\u4F4D\uFF0C\u5BF9\u8C61\u9012\u5F52\uFF0C\u5B57\u7B26\u4E32\u539F\u6837
function relayVal(v) {
  if (v == null) return '';
  if (typeof v === 'number') return v.toLocaleString();
  if (typeof v === 'object') {
    return Object.keys(v).map(function(k) { return k + ': ' + relayVal(v[k]); }).join(' \xB7 ');
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
      el.innerHTML = '<span style="color:var(--warn)">\u26A0\uFE0F VPS \u7EDF\u8BA1' + (d.error ? '\uFF1A' + esc(d.error) : '\uFF1A\u4E2D\u7EE7\u4E0D\u53EF\u8FBE') + '</span>';
      return;
    }
    const usageHtml = d.usage ? esc(relayVal(d.usage)) : 'VPS \u672A\u63D0\u4F9B';
    const limitsHtml = d.limits ? esc(relayVal(d.limits)) : '';
    el.innerHTML =
      '\u{1F4CA} \u4E2D\u7EE7\u7528\u91CF\uFF1A<b>' + usageHtml + '</b><br>' +
      (limitsHtml ? '\u9650\u989D\uFF1A' + limitsHtml + '<br>' : '') +
      '\u7248\u672C\uFF1A' + esc(d.version || '\u2014') + '<br>' +
      '\u8FD1 24h \u4E2D\u7ED4\u56DE\u9000\uFF1A<b>' + (d.fallback24 || 0) + '</b> \u6B21' + (d.fallbackErr24 ? '\uFF08\u76F4\u8FDE\u5931\u8D25 ' + d.fallbackErr24 + '\uFF09' : '');
  } catch (e) {
    el.textContent = 'VPS \u7EDF\u8BA1\u52A0\u8F7D\u5931\u8D25';
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
  if (!x.ok) { showToast(x.data.error || '\u4FDD\u5B58\u5931\u8D25'); return false; }
  return true;
}

async function testRelay() {
  const el = document.getElementById('relayTestResult');
  el.textContent = '\u6D4B\u8BD5\u4E2D...';
  const saved = await saveRelay();
  if (!saved) { el.textContent = '\u8BF7\u5148\u586B\u5199\u5730\u5740/\u5BC6\u94A5'; return; }
  const x = await postJson('/admin/api/relay/test', {});
  if (!x.ok) { showToast(x.data.error || '\u8BF7\u6C42\u5931\u8D25'); el.textContent = '\u6D4B\u8BD5\u5931\u8D25'; return; }
  const d = x.data;
  if (d.ok) {
    el.textContent = '\u8054\u901A ' + d.ms + 'ms' + (d.version ? ' \xB7 ' + d.version : '') + (d.auto_enabled ? ' \xB7 \u5DF2\u81EA\u52A8\u542F\u7528\u4E2D\u7EE7' : '');
    document.getElementById('setRelayEnabled').checked = true;
    showToast('\u4E2D\u7EE7\u5065\u5EB7\u6D4B\u8BD5\u901A\u8FC7\uFF1B\u771F\u5B9E\u767B\u5F55\u4E0E\u64AD\u653E\u4ECD\u9700\u9A8C\u8BC1');
    loadRelayUsage();
  } else {
    el.textContent = '\u5931\u8D25' + (d.error ? '\uFF1A' + d.error : '\uFF08HTTP ' + d.status + '\uFF09');
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
  if (!await saveRelay()) return;
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
  settings: '\u4FEE\u6539\u8BBE\u7F6E',
  'report.send': '\u53D1\u9001\u65E5\u62A5',
  import: '\u5BFC\u5165\u914D\u7F6E',
  'route.save': '\u4FDD\u5B58\u8DEF\u7531',
  'route.rename': '\u91CD\u547D\u540D\u8DEF\u7531',
  'route.delete': '\u5220\u9664\u8DEF\u7531',
  'route.enable': '\u542F\u7528\u8DEF\u7531',
  'route.disable': '\u7981\u7528\u8DEF\u7531',
  'route.claim': '\u8BA4\u9886\u5386\u53F2\u8DEF\u7531',
  'domain.add': '\u6DFB\u52A0\u4F18\u9009\u57DF\u540D',
  'domain.update': '\u66F4\u65B0\u4F18\u9009\u57DF\u540D',
  'domain.delete': '\u5220\u9664\u4F18\u9009\u57DF\u540D',
  'dns.replace': '\u66FF\u6362 DNS \u8BB0\u5F55',
  'user.register': '\u7528\u6237\u6CE8\u518C',
  'user.create': '\u521B\u5EFA\u7528\u6237',
  'user.update': '\u66F4\u65B0\u7528\u6237',
  'user.delete': '\u5220\u9664\u7528\u6237',
  'user.password': '\u4FEE\u6539\u5BC6\u7801',
  'security.password': '\u4FEE\u6539\u7BA1\u7406\u5458\u5BC6\u7801',
  'notification.save': '\u4FDD\u5B58\u901A\u77E5\u914D\u7F6E',
  'notification.test': '\u6D4B\u8BD5\u901A\u77E5',
  'user.dns': '\u7ED1\u5B9A\u7528\u6237 DNS',
  'user.route.save': '\u4FDD\u5B58\u7528\u6237\u8DEF\u7531',
  'user.route.delete': '\u5220\u9664\u7528\u6237\u8DEF\u7531',
  'invite.create': '\u751F\u6210\u9080\u8BF7\u7801',
  'invite.delete': '\u5220\u9664\u9080\u8BF7\u7801',
  'invite.clear': '\u6E05\u7A7A\u9080\u8BF7\u7801',
  'db.reset': '\u91CD\u7F6E\u6570\u636E\u5E93'
};
var AUDIT_SETTINGS = {
  health_check: '\u7EBF\u8DEF\u5065\u5EB7\u68C0\u67E5',
  tg_daily_report: '\u6BCF\u65E5\u65E5\u62A5',
  tg_route_alerts: '\u7EBF\u8DEF\u5F02\u5E38\u548C\u6062\u590D\u901A\u77E5',
  x_frame_options: '\u4EE3\u7406\u9875\u9762\u5D4C\u5165\u7B56\u7565',
  rate_limit_per_min: '\u6BCF\u5206\u949F\u8BF7\u6C42\u9650\u5236',
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
  if (!IS_ADMIN) return;
  const el = document.getElementById('auditList');
  const r = await fetch('/admin/api/audit');
  const d = await r.json();
  if (!d.logs || !d.logs.length) { el.textContent = '\u6682\u65E0\u8BB0\u5F55'; return; }
  el.innerHTML = '<table><thead><tr><th>\u65F6\u95F4</th><th>\u64CD\u4F5C</th><th>\u8BE6\u60C5</th></tr></thead><tbody>' + d.logs.map(function(l) {
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
    else { document.getElementById('domainList').innerHTML = '<p class="muted">\u52A0\u8F7D\u5931\u8D25</p>'; }
  } catch (e) {
    document.getElementById('domainList').innerHTML = '<p class="muted">\u52A0\u8F7D\u5931\u8D25: ' + esc(e.message) + '</p>';
  }
}

function renderDomains(list, speedResults, best) {
  const el = document.getElementById('domainList');
  if (!list.length) { el.innerHTML = '<div class="empty-state"><span class="empty-state-icon">\u{1F310}</span><p class="empty-state-text">\u6682\u65E0\u4F18\u9009\u57DF\u540D</p></div>'; return; }
  const speedMap = {};
  if (speedResults) speedResults.forEach(function(r) { speedMap[r.domain] = r; });
  const sorted = list.slice().sort(function(a, b) {
    const sa = speedMap[a.domain], sb = speedMap[b.domain];
    const la = sa && sa.latency >= 0 ? sa.latency : Infinity;
    const lb = sb && sb.latency >= 0 ? sb.latency : Infinity;
    return la - lb;
  });
  let html = '<table><thead><tr><th>\u540D\u79F0</th><th>\u57DF\u540D</th><th>\u5EF6\u8FDF</th><th>\u72B6\u6001</th><th>\u64CD\u4F5C</th></tr></thead><tbody>';
  sorted.forEach(function(d) {
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
  const d = allDomains.find(function(x) { return x.id === id; });
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
  const domain = url.replace('https://', '').replace('http://', '').split('/')[0];
  const r = await fetch(id ? '/admin/api/optimized-domains/' + id : '/admin/api/optimized-domains', {
    method: id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domain: domain, name: name })
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
  showToast(d.success ? '\u5DF2\u5220\u9664' : (d.error || '\u5220\u9664\u5931\u8D25'));
  if (d.success) loadDomains();
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

async function loadQuickDNS() {
  if (!IS_ADMIN) return;
  var meta = document.getElementById('dnsQuickMeta');
  if (meta) meta.textContent = 'DNS \u8BB0\u5F55\u52A0\u8F7D\u4E2D...';
  try {
    const r = await fetch('/admin/api/dns-config');
    if (r.status === 401) { location.href = '/admin'; return; }
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
  if (!IS_ADMIN) return;
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
    if (d.success) showToast('\u2705 \u65E5\u62A5\u5DF2\u53D1\u9001' + (d.webhook && d.webhook.ok ? '\uFF08Telegram + Webhook\uFF09' : '\uFF08Telegram\uFF09'));
    else { showToast('\u274C ' + (d.hint || (d.telegram && d.telegram.error) || '\u53D1\u9001\u5931\u8D25'), 9000); loadAudit(); }
  } catch (e) {
    showToast('\u274C \u53D1\u9001\u5931\u8D25: ' + e.message);
  }
  if (btn) { btn.disabled = false; btn.textContent = '\u53D1\u9001\u65E5\u62A5'; }
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
`;

// text-asset:web/multi/speed-test.js
var speed_test_default = "function pingOnce(url, timeout) {\n  return new Promise(function(resolve) {\n    var t0 = performance.now(), settled = false;\n    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;\n    var timer = setTimeout(function() { if (ctrl) ctrl.abort(); fin(-1); }, timeout);\n    function fin(ms) { if (settled) return; settled = true; clearTimeout(timer); resolve(ms); }\n    var bust = (url.indexOf('?') >= 0 ? '&' : '?') + '_=' + Date.now() + Math.random().toString(36).slice(2);\n    fetch(url + bust, { mode: 'no-cors', cache: 'no-store', credentials: 'omit', signal: ctrl ? ctrl.signal : undefined })\n      .then(function() { fin(Math.round(performance.now() - t0)); })\n      .catch(function() { fin(-1); });\n  });\n}\n\n// \u540C\u4E00\u57DF\u540D\u987A\u5E8F\u6D4B\u591A\u6B21\uFF08\u540E\u7EED\u8BF7\u6C42\u590D\u7528\u8FDE\u63A5\uFF0C\u53CD\u6620\u7A33\u5B9A\u5F80\u8FD4\u5EF6\u8FDF\uFF09\uFF0C\u53D6\u4E2D\u4F4D\u6570\uFF1B\u5931\u8D25\u8FC7\u534A\u89C6\u4E3A\u4E0D\u53EF\u7528\nasync function measureDomain(host, samples, timeout) {\n  var times = [];\n  for (var i = 0; i < samples; i++) {\n    var ms = await pingOnce('https://' + host + '/cdn-cgi/trace', timeout);\n    if (ms >= 0) times.push(ms);\n  }\n  if (times.length < Math.ceil(samples / 2)) return -1;\n  times.sort(function(a, b) { return a - b; });\n  return times[Math.floor(times.length / 2)];\n}\n\nasync function runPool(items, limit, fn) {\n  var out = new Array(items.length), idx = 0;\n  async function w() { while (idx < items.length) { var i = idx++; out[i] = await fn(items[i]); } }\n  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, w));\n  return out;\n}\n\nfunction latencyLabel(ms) { return ms < 0 ? 'timeout' : ms < 100 ? 'fast' : ms < 300 ? 'good' : 'slow'; }\n\nasync function speedTestDomains(domains, onProgress) {\n  var done = 0;\n  var rows = await runPool(domains, 3, async function(d) {\n    var ms = await measureDomain(d.domain, 4, 4000);\n    done++;\n    if (onProgress) onProgress(done, domains.length);\n    return { id: d.id, domain: d.domain, name: d.name, host: d.domain, latency: ms, status: latencyLabel(ms), isBuiltin: d.isBuiltin };\n  });\n  rows.sort(function(a, b) { if (a.latency < 0) return 1; if (b.latency < 0) return -1; return a.latency - b.latency; });\n  return rows;\n}\n";

// src/editions/multi/ui/theme.js
var SPEED_TOOLS = speed_test_default;
function safeHttpUrl(v, fallback) {
  const s = String(v == null ? "" : v).trim();
  return /^https?:\/\//i.test(s) ? s : fallback;
}

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

// src/editions/multi/version.js
var CURRENT_VERSION = "v6.8.11-multi-refactor.3";

// web/multi/pages.js
function renderTopLinks(env2) {
  const links = [
    { icon: "\u{1F4C8}", label: "\u4F18\u9009\u57DF\u540D\u76D1\u63A7", url: safeHttpUrl(envStr(env2, "MONITOR_URL"), "https://yx.255432.xyz/") },
    { icon: "\u{1F4AC}", label: "Telegram \u7FA4\u7EC4", url: safeHttpUrl(envStr(env2, "TG_GROUP_URL"), "https://t.me/+7cbXthaBajszNjI1") }
  ];
  return '<div class="linkbar">' + links.map((l) => '<a href="' + l.url + '" target="_blank" rel="noopener">' + l.icon + " " + l.label + "</a>").join("") + "</div>";
}
function buildFrontendHtml(env2) {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light"><meta name="theme-color" content="#06090f">
<title>Emby \u53CD\u5411\u4EE3\u7406</title><link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>\u{1F3AC}</text></svg>">
<script>${THEME_INIT}<\/script>
<script>${DYN_PALETTE}<\/script>
<style>${PAGE_STYLE}</style></head><body>
<div class="admin-bg" aria-hidden="true"></div>
<div class="container">
  <div class="topbar">
    <a class="brand" href="/"><i class="brand-mark"></i><span class="bname">EMBY<span style="color:var(--accent)">\xB7</span>PROXY</span></a>
    <div class="topbar-actions">
      <button class="theme-toggle" id="themeToggle" onclick="cycleTheme()">AUTO</button>
      <a href="/admin" class="btn btn-sm">\u7BA1\u7406\u540E\u53F0</a>
    </div>
  </div>

  ${renderTopLinks(env2)}

  <div class="card hero">
    <div class="hero-kicker">REVERSE&nbsp;PROXY&nbsp;\xB7&nbsp;EDGE&nbsp;NETWORK</div>
    <h1>Emby <em>\u53CD\u5411\u4EE3\u7406</em></h1>
    <p>\u7248\u672C ${CURRENT_VERSION} \xB7 \u652F\u6301\u522B\u540D\u5FEB\u6377\u5165\u53E3\u4E0E\u4F18\u9009\u57DF\u540D\u81EA\u52A8\u6D4B\u901F \xB7 \u8FB9\u7F18\u8282\u70B9\u667A\u80FD\u52A0\u901F</p>
    <div class="term">
      <div class="term-bar"><i></i><i></i><i></i><span>~/emby-proxy \u2014 usage</span></div>
      <div class="term-body">
        <div><span class="p">$</span>https://<span class="hl">\u4F60\u7684\u57DF\u540D</span>/\u522B\u540D</div>
        <div class="dim"># \u4EC5\u5DF2\u767B\u8BB0\u7EBF\u8DEF\u53EF\u7528\uFF1B\u539F\u59CB\u5730\u5740\u4EE3\u7406\u9ED8\u8BA4\u5173\u95ED</div>
        <div class="dim"># \u6DFB\u52A0\u670D\u52A1\u540E\u8BF7\u52A1\u5FC5\u624B\u52A8\u6D4B\u8BD5 \xB7 \u6076\u610F\u5237\u63A5\u53E3\u5C06\u5C01\u7981 IP</div>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="sec-title">\u5F53\u524D\u8FB9\u7F18\u8282\u70B9 <span class="chip">EDGE</span></div>
    <div id="edge-loading" class="muted"><span class="spin"></span>\u6B63\u5728\u63A2\u6D4B...</div>
    <div id="edge-info" class="edge-box" style="display:none"></div>
  </div>

  <div class="card">
    <div class="sec-title">\u4F18\u9009\u57DF\u540D\u6D4B\u901F <span class="chip">LATENCY</span></div>
    <div class="toolbar" style="margin-bottom:14px">
      <button class="btn btn-sm" id="btn-retest">\u91CD\u65B0\u6D4B\u901F</button>
      <span id="speed-status" class="muted"></span>
    </div>
    <div id="domain-table-wrap"><p class="muted"><span class="spin"></span>\u6B63\u5728\u6D4B\u901F...</p></div>
  </div>

  <div class="card">
    <div class="sec-title">\u4F7F\u7528\u7EDF\u8BA1 <span class="chip">CF&nbsp;ANALYTICS</span></div>
    <div id="stats-loading" class="muted"><span class="spin"></span>\u52A0\u8F7D\u4E2D...</div>
    <div id="stats-body" style="display:none">
      <div class="stat-row">
        <div class="stat-card"><div>\u4ECA\u65E5\u8BF7\u6C42</div><div class="stat-val" id="st-req">0</div><div class="stat-sub" id="st-req-sub"></div></div>
        <div class="stat-card"><div>\u4ECA\u65E5\u6D41\u91CF</div><div class="stat-val" id="st-traffic">0 B</div><div class="stat-sub" id="st-traffic-sub"></div></div>
        <div class="stat-card"><div>\u4ECA\u65E5\u8BBF\u95EE</div><div class="stat-val" id="st-uv">0</div><div class="stat-sub" id="st-uv-sub"></div></div>
      </div>
      <div id="hourly-chart"></div>
      <p class="muted" style="font-size:11px;margin-top:8px" id="st-updated"></p>
    </div>
  </div>
</div>
<script>${THEME_LOGIC}
${SPEED_TOOLS}
${frontend_default}<\/script></body></html>`;
}
function buildLoginHtml() {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light"><meta name="theme-color" content="#06090f">
<title>\u767B\u5F55</title><link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>\u{1F510}</text></svg>">
<script>${THEME_INIT}<\/script>
<script>${DYN_PALETTE}<\/script>
<style>${PAGE_STYLE}</style></head><body>
<div class="admin-bg" aria-hidden="true"></div>
<div class="login-wrap">
  <div class="login-theme"><button class="theme-toggle" id="themeToggle" onclick="cycleTheme()">AUTO</button></div>
  <div class="login-box">
    <div style="text-align:center;margin-bottom:26px">
      <div class="hero-kicker" style="margin-bottom:10px">MULTI&nbsp;USER&nbsp;ACCESS</div>
      <h1 style="font-size:1.5em;font-weight:800;letter-spacing:-.01em">\u767B\u5F55</h1>
      <p class="muted" style="margin-top:8px">\u666E\u901A\u7528\u6237\u8F93\u5165\u7528\u6237\u540D + \u5BC6\u7801\uFF1B\u5185\u7F6E\u7BA1\u7406\u5458\u586B admin\uFF08\u6216\u7559\u7A7A\uFF09\uFF0C\u4F7F\u7528\u7F51\u9875\u8BBE\u7F6E\u7684\u5BC6\u7801\uFF1B\u5C1A\u672A\u6539\u5BC6\u65F6\u4F7F\u7528\u521D\u59CB\u7BA1\u7406\u5BC6\u94A5\u3002</p>
    </div>
    <form onsubmit="login();return false">
      <input id="usernameInput" placeholder="\u7528\u6237\u540D\uFF08\u7BA1\u7406\u5458\u586B admin \u6216\u7559\u7A7A\uFF09" autocomplete="username" autocapitalize="off" style="margin-bottom:10px">
      <input type="password" id="passwordInput" placeholder="\u5BC6\u7801 / \u7BA1\u7406\u5BC6\u94A5" autocomplete="current-password" style="margin-bottom:10px">
      <p id="loginErr" style="color:var(--bad);font-size:13px;min-height:1.4em;margin:6px 0;text-align:center"></p>
      <button class="btn btn-solid" style="width:100%;padding:12px" id="loginBtn" type="submit">\u767B \u5F55</button>
    </form>
    <p class="muted" style="text-align:center;margin-top:16px;font-size:13px">
      \u6CA1\u6709\u8D26\u53F7\uFF1F<a href="/register" style="color:var(--accent)">\u4F7F\u7528\u9080\u8BF7\u7801\u6CE8\u518C</a>
    </p>
  </div>
</div>
<script>${THEME_LOGIC}
${login_default}<\/script></body></html>`;
}
function buildRegisterHtml(env2) {
  const userDomain = (typeof getUserDomain === "function" ? getUserDomain(env2) : "") || "";
  const entryExample = userDomain ? "\u7528\u6237\u540D." + userDomain : "\u7528\u6237\u540D.\u6839\u57DF\u540D";
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light"><meta name="theme-color" content="#06090f">
<title>\u6CE8\u518C</title><link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>\u{1F3AB}</text></svg>">
<script>${THEME_INIT}<\/script>
<script>${DYN_PALETTE}<\/script>
<style>${PAGE_STYLE}</style></head><body>
<div class="admin-bg" aria-hidden="true"></div>
<div class="login-wrap">
  <div class="login-theme"><button class="theme-toggle" id="themeToggle" onclick="cycleTheme()">AUTO</button></div>
  <div class="login-box">
    <div style="text-align:center;margin-bottom:22px">
      <div class="hero-kicker" style="margin-bottom:10px">INVITE&nbsp;ONLY</div>
      <h1 style="font-size:1.5em;font-weight:800;letter-spacing:-.01em">\u6CE8\u518C\u8D26\u53F7</h1>
      <p class="muted" style="margin-top:8px">\u6CE8\u518C\u540E\u81EA\u52A8\u83B7\u5F97\u72EC\u7ACB\u5B50\u57DF\u540D\uFF0C\u5E76\u81EA\u52A8\u521B\u5EFA <code>${entryExample}</code> \u7684 DNS \u8BB0\u5F55</p>
    </div>
    <form onsubmit="register();return false">
      <input id="regInvite" placeholder="\u9080\u8BF7\u7801" autocapitalize="characters" style="margin-bottom:10px">
      <input id="regUsername" placeholder="\u7528\u6237\u540D\uFF083-32 \u4F4D\u5C0F\u5199\u5B57\u6BCD/\u6570\u5B57/-\uFF09" autocomplete="username" autocapitalize="off" style="margin-bottom:10px">
      <p class="form-hint" style="margin:-4px 0 10px;text-align:left">\u7528\u6237\u540D\u540C\u65F6\u4F5C\u4E3A DNS \u524D\u7F00\uFF0C\u4E0D\u80FD\u4EE5 - \u5F00\u5934\u6216\u7ED3\u5C3E</p>
      <input type="password" id="regPassword" placeholder="\u5BC6\u7801\uFF08\u81F3\u5C11 6 \u4F4D\uFF09" autocomplete="new-password" style="margin-bottom:10px">
      <input type="password" id="regPassword2" placeholder="\u786E\u8BA4\u5BC6\u7801" autocomplete="new-password" style="margin-bottom:10px">
      <p id="regErr" style="color:var(--bad);font-size:13px;min-height:1.4em;margin:6px 0;text-align:center"></p>
      <button class="btn btn-solid" style="width:100%;padding:12px" id="regBtn" type="submit">\u6CE8 \u518C</button>
    </form>
    <p class="muted" style="text-align:center;margin-top:16px;font-size:13px">
      \u5DF2\u6709\u8D26\u53F7\uFF1F<a href="/admin" style="color:var(--accent)">\u8FD4\u56DE\u767B\u5F55</a>
    </p>
  </div>
</div>
<script>${THEME_LOGIC}
${register_default}<\/script></body></html>`;
}
function buildAdminHtml(session, env2) {
  const isAdmin2 = Boolean(session && session.isAdmin);
  const username = String(session && session.username || "user").replace(/[^a-z0-9_-]/gi, "") || "user";
  const roleLabel = isAdmin2 ? "ADMIN" : "USER";
  const consoleName = isAdmin2 ? "ADMIN" : "USER";
  const effectiveMainHost = env2 ? getStatsHost(env2) || getBaseDomain(env2) || "" : "";
  const effectiveUserDomain = env2 ? getUserDomain(env2) || getBaseDomain(env2) || "" : "";
  const reportBtn = isAdmin2 ? '<button class="btn btn-sm" id="btnDailyReport" onclick="sendReport(this)">\u53D1\u9001\u65E5\u62A5</button>' : "";
  const settingsBtn = isAdmin2 ? '<button class="btn btn-sm" onclick="openSettings()">\u8BBE\u7F6E</button>' : "";
  const passwordBtn = isAdmin2 ? "" : '<button class="btn btn-sm" onclick="changePassword()">\u6539\u5BC6\u7801</button>';
  const routeToolbar = isAdmin2 ? `<button class="btn btn-sm btn-solid" onclick="openRouteModal()">\u6DFB\u52A0\u8DEF\u7531</button><button class="btn btn-sm" onclick="location.href='/admin/api/export'">\u5BFC\u51FA\u914D\u7F6E</button><button class="btn btn-sm" onclick="document.getElementById('importFile').click()">\u5BFC\u5165\u914D\u7F6E</button><input type="file" id="importFile" accept="application/json,.json" style="display:none" onchange="importConfig(this)">` : '<button class="btn btn-sm btn-solid" onclick="openRouteModal()">\u6DFB\u52A0\u8DEF\u7531</button><span class="muted" id="routeLimitHint"></span>';
  const dnsQuick = isAdmin2 ? `
    <div class="dns-quick">
      <span class="dns-quick-tag">DNS</span>
      <input id="dnsQuickName" placeholder="\u8BB0\u5F55\u540D\uFF08\u7559\u7A7A = BASE_DOMAIN\uFF09">
      <span class="dns-quick-arrow">\u2192</span>
      <input id="dnsQuickTarget" placeholder="\u76EE\u6807\u57DF\u540D\u6216 IP\uFF08\u53EF\u4EE5\u76F4\u63A5\u6539\uFF09">
      <button class="btn btn-sm btn-solid" id="dnsQuickSave" onclick="quickSaveDNS(this)">\u4FDD\u5B58</button>
      <button class="btn btn-sm" onclick="loadQuickDNS()">\u5237\u65B0</button>
    </div>
    <p class="muted" id="dnsQuickMeta" style="margin:-2px 0 14px;font-size:12px">DNS \u8BB0\u5F55\u52A0\u8F7D\u4E2D...</p>` : "";
  const statsCard = `
  <div class="card">
    <div class="sec-title">\u4F7F\u7528\u7EDF\u8BA1 <span class="chip" id="statsChip">CF</span></div>
    <div id="stats-loading" class="muted"><span class="spin"></span>\u52A0\u8F7D\u4E2D...</div>
    <div id="stats-body" style="display:none">
      <div class="stat-row">
        <div class="stat-card"><div>\u4ECA\u65E5\u8BF7\u6C42</div><div class="stat-val" id="st-req">0</div><div class="stat-sub" id="st-req-sub"></div></div>
        <div class="stat-card"><div>\u4ECA\u65E5\u6D41\u91CF</div><div class="stat-val" id="st-traffic">0 B</div><div class="stat-sub" id="st-traffic-sub"></div></div>
        <div class="stat-card"><div>\u4ECA\u65E5\u8BBF\u95EE</div><div class="stat-val" id="st-uv">0</div><div class="stat-sub" id="st-uv-sub"></div></div>
      </div>
      <div id="hourly-chart"></div>
      <p class="muted" style="font-size:11px;margin-top:8px" id="st-updated"></p>
    </div>
  </div>`;
  const userEntryCard = isAdmin2 ? "" : `
  <div class="card">
    <div class="sec-title">\u6211\u7684\u5165\u53E3 <span class="chip">ENTRY</span></div>
    <div class="edge-box">
      <div class="edge-item"><strong>\u7528\u6237\u540D</strong><span id="entryUser">${username}</span></div>
      <div class="edge-item"><strong>\u5165\u53E3\u57DF\u540D</strong><span id="entryHost">\u52A0\u8F7D\u4E2D...</span></div>
      <div class="edge-item"><strong>\u8DEF\u7531\u6570\u91CF</strong><span id="entryRoutes">\u2014</span></div>
      <div class="edge-item"><strong>DNS \u72B6\u6001</strong><span id="entryDns">\u52A0\u8F7D\u4E2D...</span></div>
    </div>
    <p class="muted" style="margin-top:12px;font-size:12px" id="entryHint"></p>
    <div class="form-group" style="margin-top:12px">
      <label>DNS \u8BB0\u5F55\u503C\uFF08CNAME \u76EE\u6807\uFF0C\u53EF\u586B IP \u6216\u57DF\u540D\uFF09</label>
      <div class="toolbar" style="flex-wrap:nowrap">
        <input id="entryDnsValue" placeholder="\u4F8B\u5982 youxuan.cf.090227.xyz \u6216 1.2.3.4" style="flex:1 1 auto;min-width:0">
        <button class="btn btn-sm btn-solid" style="flex:0 0 auto" onclick="saveUserDNS(this)">\u4FDD\u5B58 DNS \u503C</button>
      </div>
      <p class="form-hint">\u4FDD\u5B58\u65F6\u4F1A\u5148\u5220\u9664\u540C\u540D\u65E7\u8BB0\u5F55\u518D\u91CD\u65B0\u521B\u5EFA\uFF0C\u907F\u514D\u7C7B\u578B\u51B2\u7A81\uFF1B\u65B0\u8BB0\u5F55\u9ED8\u8BA4\u5173\u95ED\u5C0F\u9EC4\u4E91\u3002\u82E5\u72B6\u6001\u663E\u793A\u300C\u5DF2\u4EE3\u7406\u300D\uFF0C\u4FDD\u5B58\u4E00\u6B21\u5373\u53EF\u6539\u4E3A\u4EC5 DNS\u3002</p>
    </div>
    <div class="toolbar" style="margin-top:12px">
      <button class="btn btn-sm" onclick="ensureUserDNS(this)">\u91CD\u65B0\u521B\u5EFA DNS</button>
      <button class="btn btn-sm" onclick="loadUserEntry()">\u5237\u65B0</button>
      <a class="btn btn-sm" id="entryUrl" href="#" target="_blank" rel="noopener">\u6253\u5F00\u5165\u53E3</a>
    </div>
    <p class="muted" style="margin-top:10px;font-size:12px">\u8BBF\u95EE\u65B9\u5F0F\uFF1A<code>https://\u5165\u53E3\u57DF\u540D/\u8DEF\u7531\u524D\u7F00</code></p>
  </div>`;
  const adminCards = isAdmin2 ? `
  <div class="card">
    <div class="sec-title">\u7528\u6237\u7BA1\u7406 <span class="chip" id="userCount"></span></div>
    <div class="toolbar" style="margin-bottom:14px">
      <button class="btn btn-sm btn-solid" onclick="openUserModal()">\u6DFB\u52A0\u7528\u6237</button>
      <button class="btn btn-sm" onclick="loadUsers()">\u5237\u65B0</button>
    </div>
    <div id="userList" class="muted">\u52A0\u8F7D\u4E2D...</div>
  </div>

  <div class="card">
    <div class="sec-title">\u9080\u8BF7\u7801 <span class="chip">INVITE</span></div>
    <div class="toolbar" style="margin-bottom:14px">
      <button class="btn btn-sm btn-solid" onclick="openInviteModal()">\u751F\u6210\u9080\u8BF7\u7801</button>
      <button class="btn btn-sm btn-danger" onclick="clearInvites()">\u5220\u9664\u5168\u90E8\u9080\u8BF7\u7801</button>
      <button class="btn btn-sm" onclick="loadInvites()">\u5237\u65B0</button>
    </div>
    <div id="inviteList" class="muted">\u52A0\u8F7D\u4E2D...</div>
  </div>

  <div class="card">
    <div class="sec-title">\u4F18\u9009\u57DF\u540D\u7BA1\u7406 <span class="chip">CDN</span></div>
    <div class="toolbar" style="margin-bottom:16px">
      <button class="btn btn-sm" onclick="openDomainModal()">\u6DFB\u52A0\u57DF\u540D</button>
      <button class="btn btn-sm" onclick="testDomains()">\u624B\u52A8\u6D4B\u901F</button>
      <span id="domain-status" class="muted"></span>
    </div>
    <div id="domainList" class="domain-list"><p class="muted"><span class="spin"></span>\u52A0\u8F7D\u4E2D...</p></div>
  </div>

  <div class="card">
    <div class="sec-title">\u64CD\u4F5C\u65E5\u5FD7 <span class="chip">AUDIT</span></div>
    <div class="toolbar" style="margin-bottom:16px">
      <button class="btn btn-sm" onclick="loadAudit()">\u5237\u65B0</button>
      <button class="btn btn-sm btn-danger" onclick="resetStats()">\u6E05\u7A7A\u7EDF\u8BA1</button>
    </div>
    <div id="auditList" class="muted">\u70B9\u51FB\u5237\u65B0\u67E5\u770B\u6700\u8FD1 100 \u6761\u64CD\u4F5C</div>
  </div>` : "";
  const adminModals = isAdmin2 ? `
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
      <p class="form-hint">\u544A\u8B66\u4F18\u5148\u663E\u793A\u5B89\u5168\u7684\u7EBF\u8DEF\u5907\u6CE8\uFF0C\u4E0D\u53D1\u9001\u7EBF\u8DEF\u5730\u5740\u3001\u5165\u53E3\u3001\u7528\u6237\u540D\u6216\u539F\u59CB\u9519\u8BEF\uFF1B\u5907\u6CE8\u4E3A\u7A7A\u6216\u7591\u4F3C\u542B\u5730\u5740\u3001\u51ED\u636E\u65F6\u56DE\u9000\u5230\u7EBF\u8DEF\u5361\u7247\u4E0A\u7684\u901A\u77E5\u7F16\u53F7\u3002</p>
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
      <p class="form-hint">TG \u914D\u7F6E\u5355\u72EC\u4FDD\u5B58\uFF0CAES-GCM \u52A0\u5BC6\u5B58\u50A8\uFF0C\u4E0D\u56DE\u663E\u3001\u4E0D\u5BFC\u51FA\uFF1B\u6E05\u9664\u540E\u4E0D\u56DE\u9000\u73AF\u5883\u53D8\u91CF\u3002\u4F7F\u7528\u72EC\u7ACB\u52A0\u5BC6\u4E3B\u5BC6\u94A5\uFF0C\u6216\u4ECE\u539F SESSION_SECRET \u5206\u7528\u9014\u6D3E\u751F\uFF0C\u4E0D\u6539\u73B0\u6709\u7ED1\u5B9A\u3002</p>
    </div>
    <div class="form-group">
      <h3>\u5B89\u5168 \xB7 \u4FEE\u6539\u767B\u5F55\u5BC6\u7801</h3>
      <label for="currentPassword">\u5F53\u524D\u5BC6\u7801</label>
      <input id="currentPassword" type="password" autocomplete="current-password" maxlength="1024">
      <label for="newPassword">\u65B0\u5BC6\u7801\uFF0812\u2013128 \u4E2A\u5B57\u7B26\uFF09</label>
      <input id="newPassword" type="password" autocomplete="new-password" minlength="12" maxlength="128">
      <label for="confirmPassword">\u786E\u8BA4\u65B0\u5BC6\u7801</label>
      <input id="confirmPassword" type="password" autocomplete="new-password" minlength="12" maxlength="128">
      <p class="form-hint">\u53EA\u4FEE\u6539\u5F53\u524D\u8D26\u53F7\uFF1B\u8BE5\u8D26\u53F7\u6240\u6709\u65E7\u4F1A\u8BDD\u5931\u6548\uFF0C\u4E0D\u5F71\u54CD\u5176\u4ED6\u7528\u6237\u3002\u5185\u7F6E\u7BA1\u7406\u5458\u6539\u5BC6\u540E\u539F\u7BA1\u7406\u5BC6\u94A5\u4E0D\u518D\u4F5C\u4E3A\u7B2C\u4E8C\u4E2A\u767B\u5F55\u5BC6\u7801\u3002</p>
      <button class="btn" id="btnChangePassword" onclick="updatePassword(this)">\u4FEE\u6539\u5BC6\u7801\u5E76\u9000\u51FA</button>
    </div>
    <div class="form-group">
      <label>\u6BCF IP \u6BCF\u5206\u949F\u8BF7\u6C42\u4E0A\u9650\uFF080 = \u4E0D\u9650\u5236\uFF09</label>
      <input id="setRate" type="number" min="0" placeholder="0">
      <p class="form-hint">\u4EC5\u9650\u5236 API \u7C7B\u8BF7\u6C42\uFF0C\u4E0D\u5F71\u54CD\u56FE\u7247\u548C\u89C6\u9891\u6D41</p>
    </div>
    <div class="form-group">
      <label>\u989D\u5916\u7684\u624B\u52A8\u91CD\u5B9A\u5411\u57DF\u540D\uFF08\u9017\u53F7\u5206\u9694\uFF09</label>
      <input id="setManual" placeholder="\u4F8B\u5982 example-cdn.com, other.net">
      <label style="margin-top:12px">\u57DF\u540D\u6620\u5C04\u89C4\u5219\uFF08JSON\uFF0C\u65E5\u672C\u673A\u623F\u4F7F\u7528\uFF09</label>
      <textarea id="setRules" rows="2" placeholder='{"example.com":"1.2.3.4"}'></textarea>
    </div>
    <div class="form-group">
      <label>X-Frame-Options \u54CD\u5E94\u5934</label>
      <select id="setXfo">
        <option value="">SAMEORIGIN\uFF08\u9ED8\u8BA4\uFF0C\u4EC5\u540C\u6E90\u53EF\u5D4C\u5165\uFF09</option>
        <option value="deny">DENY\uFF08\u5B8C\u5168\u7981\u6B62\u5D4C\u5165\uFF09</option>
        <option value="off">\u4E0D\u53D1\u9001\uFF08\u5141\u8BB8\u4EFB\u610F\u7AD9\u70B9 iframe \u5D4C\u5165\uFF09</option>
      </select>
      <p class="form-hint">\u53EA\u5F71\u54CD\u4EE3\u7406\u5185\u5BB9\uFF1B\u7BA1\u7406\u540E\u53F0\u59CB\u7EC8\u4E3A SAMEORIGIN\u3002</p>
    </div>
    <div class="form-group">
      <label>\u591A\u4EBA\u7248\u8BF4\u660E</label>
      <p class="form-hint">\u7528\u6237\u901A\u8FC7 <code>\u7528\u6237\u540D.\u7528\u6237\u57DF\u540D</code> \u8BBF\u95EE\u81EA\u5DF1\u7684\u8DEF\u7531\uFF1B\u9700\u8981\u5728 Cloudflare \u7ED9 Worker \u6DFB\u52A0\u8DEF\u7531 <code>*.${effectiveUserDomain || "\u7528\u6237\u57DF\u540D"}/*</code>\uFF08\u6216 <code>*/*</code>\uFF09\u3002</p>
      <p class="form-hint">\u5F53\u524D Worker \u5165\u53E3\uFF1A<code>${effectiveMainHost || "\u672A\u914D\u7F6E"}</code>\uFF1B\u7528\u6237\u57DF\u540D\uFF1A<code>${effectiveUserDomain || "\u672A\u914D\u7F6E"}</code></p>
      <p class="form-hint">\u7528\u6237\u57DF\u540D\u81EA\u52A8\u4ECE\u73B0\u6709\u53D8\u91CF\u63A8\u5BFC\uFF0C\u4E0D\u7ED1\u5B9A\u4EFB\u4F55\u56FA\u5B9A\u57DF\u540D\uFF1A\u9ED8\u8BA4 = <code>BASE_DOMAIN</code>\uFF1B\u5982\u679C <code>BASE_DOMAIN</code> \u672C\u8EAB\u5C31\u662F Worker \u5165\u53E3\uFF08\u5F62\u5982 <code>\u5B50\u57DF\u540D.example.com</code>\uFF09\u4E14 <code>DNS_RECORD_NAME</code> \u4E0E\u90A3\u4E00\u7EA7\u76F8\u540C\uFF0C\u4F1A\u81EA\u52A8\u53BB\u6389\u5B83\uFF0C\u5F97\u5230 <code>example.com</code>\uFF0C\u7528\u6237\u5165\u53E3\u5C31\u662F <code>\u7528\u6237\u540D.example.com</code>\u3002\u9700\u8981\u65F6\u4E5F\u53EF\u7528 <code>USER_DOMAIN</code> \u663E\u5F0F\u6307\u5B9A\u4EFB\u610F\u57DF\u540D\u3002</p>
    </div>
    <div class="form-group" style="border-top:1px solid var(--border);padding-top:14px">
      <label>VPS \u4E2D\u7EE7\uFF08CF \u76F4\u8FDE\u5931\u8D25\u65F6\u81EA\u52A8\u5207\u6362\uFF0C\u8054\u901A\u540E\u6240\u6709\u8DEF\u7531\u81EA\u52A8\u542F\u7528\uFF09</label>
      <input id="setRelayUrl" placeholder="https://relay.example.com:2087" autocapitalize="off">
      <input id="setRelaySecret" type="password" placeholder="\u7559\u7A7A\u8868\u793A\u4E0D\u4FEE\u6539\u5BC6\u94A5" autocomplete="new-password" style="margin-top:8px">
      <label class="checkbox-label" style="margin-top:8px"><input type="checkbox" id="setRelayEnabled"> \u542F\u7528\u4E2D\u7EE7\uFF08\u9ED8\u8BA4\u52FE\u9009\uFF1B\u70B9\u300C\u6D4B\u8BD5\u300D\u8054\u901A\u540E\u81EA\u52A8\u5F00\u542F\uFF09</label>
      <div style="margin-top:8px;display:flex;gap:8px;align-items:center">
        <button class="btn btn-sm" onclick="testRelay()">\u6D4B\u8BD5\u8FDE\u901A</button>
        <span class="form-hint" id="relayTestResult" style="margin:0"></span>
      </div>
      <div id="relayUsage" class="muted" style="margin-top:10px;font-size:12px;line-height:1.7">VPS \u7EDF\u8BA1\u52A0\u8F7D\u4E2D...</div>
      <p class="form-hint">\u81EA\u52A8\uFF1AGET/HEAD \u9047\u5230 401/403/451\u3001\u8FDE\u63A5\u5931\u8D25\u3001\u8D85\u65F6\u6216\u6307\u5B9A\u7F51\u5173\u9519\u8BEF\u65F6\u5C1D\u8BD5\u4E00\u6B21 VPS\uFF1B\u767B\u5F55\u548C PlaybackInfo \u7684\u5C0F\u578B POST \u4EC5\u91CD\u8BD5\u660E\u786E\u7684 401/403/451\u3002\u6210\u529F\u540E\u540C\u4E00\u7528\u6237\u3001\u7EBF\u8DEF\u3001\u6E90\u7AD9\u548C CF \u5730\u533A\u4F18\u5148 VPS 2 \u5206\u949F\uFF0C\u518D\u7531\u53EA\u8BFB\u8BF7\u6C42\u63A2\u6D4B\u6062\u590D\u3002VPS \u4E0D\u53EF\u7528\u65F6\u53EA\u8BFB\u8BF7\u6C42\u53EF\u56DE\u843D\u76F4\u8FDE\uFF0C\u5DF2\u53D1\u51FA\u7684\u5199\u8BF7\u6C42\u4E0D\u91CD\u53D1\uFF1B\u4E0B\u8F7D\u6162\u4E0D\u4F1A\u4E2D\u9014\u91CD\u53D1\u89C6\u9891\u3002\u72EC\u7ACB\u63A8\u6D41\u7684 302 \u6620\u5C04\u4FDD\u7559\uFF1B\u539F\u59CB\u5730\u5740\u4EE3\u7406\u4ECD\u53D7\u72EC\u7ACB\u8BBF\u95EE\u5F00\u5173\u9650\u5236\u3002</p>
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="runNow()">\u7ACB\u5373\u5065\u5EB7\u68C0\u67E5</button>
      <button class="btn" onclick="closeModal('modalSettings')">\u53D6\u6D88</button>
      <button class="btn btn-solid" onclick="saveSettings()">\u4FDD\u5B58</button>
    </div>
  </div>
</div>

<div id="modalUser" class="modal">
  <div class="modal-inner">
    <div class="modal-header">
      <h2 class="modal-title" id="userModalTitle">\u6DFB\u52A0\u7528\u6237</h2>
      <p class="modal-desc">\u7528\u6237\u5C06\u62E5\u6709\u72EC\u7ACB\u7684\u5B50\u57DF\u540D\u548C\u8DEF\u7531\u7A7A\u95F4</p>
    </div>
    <input type="hidden" id="userId">
    <div class="form-group">
      <label>\u7528\u6237\u540D</label>
      <input id="userUsername" placeholder="3-32 \u4F4D\u5C0F\u5199\u5B57\u6BCD/\u6570\u5B57/-\uFF08\u540C\u65F6\u4F5C\u4E3A DNS \u8BB0\u5F55\u540D\uFF09" autocapitalize="off">
    </div>
    <div class="form-group">
      <label>\u5BC6\u7801</label>
      <input id="userPassword" type="password" placeholder="\u7F16\u8F91\u65F6\u7559\u7A7A\u8868\u793A\u4E0D\u4FEE\u6539" autocomplete="new-password">
    </div>
    <div class="form-group">
      <label>\u5B50\u57DF\u540D</label>
      <input id="userSubdomain" placeholder="\u4F8B\u5982 alice\uFF08\u7559\u7A7A = \u7528\u6237\u540D\uFF09" autocapitalize="off">
      <p class="form-hint">\u6700\u7EC8\u5165\u53E3\uFF1A<code>\u5B50\u57DF\u540D.\u7528\u6237\u57DF\u540D</code>\uFF1B\u521B\u5EFA\u7528\u6237\u65F6\u4F1A\u81EA\u52A8\u5EFA CNAME\uFF08\u5C0F\u9EC4\u4E91\u5173\u95ED\uFF09\uFF0C\u7528\u6237\u53EF\u5728\u300C\u6211\u7684\u5165\u53E3\u300D\u91CC\u4FEE\u6539\u8BB0\u5F55\u503C</p>
    </div>
    <div class="form-group">
      <label>\u89D2\u8272</label>
      <select id="userRole">
        <option value="user">\u666E\u901A\u7528\u6237</option>
        <option value="admin">\u7BA1\u7406\u5458</option>
      </select>
    </div>
    <div class="form-group">
      <label>\u72B6\u6001</label>
      <select id="userStatus">
        <option value="active">\u6B63\u5E38</option>
        <option value="disabled">\u7981\u7528</option>
      </select>
    </div>
    <div class="form-group">
      <label>\u8DEF\u7531\u6570\u91CF\u4E0A\u9650</label>
      <input id="userRouteLimit" type="number" min="1" max="200" value="20">
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal('modalUser')">\u53D6\u6D88</button>
      <button class="btn btn-solid" onclick="saveUser()">\u4FDD\u5B58</button>
    </div>
  </div>
</div>

<div id="modalInvite" class="modal">
  <div class="modal-inner">
    <div class="modal-header">
      <h2 class="modal-title">\u751F\u6210\u9080\u8BF7\u7801</h2>
      <p class="modal-desc">\u9080\u8BF7\u7801\u7528\u4E8E\u6CE8\u518C\u65B0\u7528\u6237</p>
    </div>
    <div class="form-group">
      <label>\u9080\u8BF7\u7801\uFF08\u7559\u7A7A\u81EA\u52A8\u751F\u6210\uFF09</label>
      <input id="inviteCode" placeholder="\u4F8B\u5982 WELCOME2026" autocapitalize="characters">
    </div>
    <div class="form-group">
      <label>\u6700\u5927\u4F7F\u7528\u6B21\u6570\uFF080 = \u4E0D\u9650\uFF09</label>
      <input id="inviteMaxUses" type="number" min="0" value="1">
    </div>
    <div class="form-group">
      <label>\u8FC7\u671F\u65E5\u671F\uFF08\u53EF\u9009\uFF09</label>
      <input id="inviteExpires" type="date">
    </div>
    <div class="form-group">
      <label>\u5907\u6CE8</label>
      <input id="inviteNote" placeholder="\u4F8B\u5982\uFF1A\u7ED9\u670B\u53CB">
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal('modalInvite')">\u53D6\u6D88</button>
      <button class="btn btn-solid" onclick="saveInvite()">\u751F\u6210</button>
    </div>
  </div>
</div>` : "";
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light"><meta name="theme-color" content="#06090f">
<title>${consoleName} \u63A7\u5236\u53F0</title><link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>\u{1F39B}\uFE0F</text></svg>">
<script>${THEME_INIT}<\/script>
<script>${DYN_PALETTE}<\/script>
<style>${PAGE_STYLE}</style></head><body>
<div class="admin-bg" aria-hidden="true"></div>
<div id="toast"></div>
<div class="container">
  <div class="topbar">
    <a class="brand" href="/"><i class="brand-mark"></i><span class="bname">${consoleName}<span style="color:var(--accent)">\xB7</span>CONSOLE</span></a>
    <div class="topbar-actions">
      <button class="theme-toggle" id="themeToggle" onclick="cycleTheme()">AUTO</button>
      <span class="meta-tag" title="${roleLabel}">${roleLabel} \xB7 ${username}</span>
      ${reportBtn}
      ${passwordBtn}
      <a href="/" class="btn btn-sm">\u9996\u9875</a>
      ${settingsBtn}
      <button class="btn btn-sm btn-danger" onclick="logout()">\u9000\u51FA</button>
    </div>
  </div>

  ${renderTopLinks(env2)}

  <div class="card">
    <div class="sec-title">${isAdmin2 ? "\u6211\u6DFB\u52A0\u7684\u5168\u5C40\u8DEF\u7531" : "\u6211\u7684\u8DEF\u7531"} <span class="chip" id="routeCount"></span></div>
    <div class="toolbar" style="margin-bottom:16px">
      ${routeToolbar}
      <div class="search-box">
        <input type="text" id="routeSearch" placeholder="\u641C\u7D22\u5907\u6CE8\u6216\u8DEF\u5F84..." oninput="filterRoutes()">
      </div>
    </div>
    ${isAdmin2 ? '<p class="muted" style="margin:-6px 0 14px">\u53EA\u80FD\u770B\u5230\u4F60\u81EA\u5DF1\u6DFB\u52A0\u7684\u8DEF\u7531\uFF1B\u5176\u4ED6\u7BA1\u7406\u5458\u548C\u7528\u6237\u7684\u8DEF\u7531\u4E0D\u4F1A\u663E\u793A\uFF08\u7528\u6237\u8DEF\u7531\u4ECD\u6B63\u5E38\u4EE3\u7406\uFF09\u3002</p>' : ""}
    ${dnsQuick}
    <div id="routeList" class="route-grid"><p class="muted"><span class="spin"></span>\u52A0\u8F7D\u4E2D...</p></div>
  </div>

  ${userEntryCard}
  ${statsCard}
  ${adminCards}
</div>

<div id="modalRoute" class="modal">
  <div class="modal-inner">
    <div class="modal-header">
      <h2 class="modal-title" id="routeModalTitle">\u6DFB\u52A0\u8DEF\u7531</h2>
      <p class="modal-desc">\u521B\u5EFA\u8DEF\u7531\u540E\u53EF\u901A\u8FC7 /\u8DEF\u5F84 \u5FEB\u6377\u8BBF\u95EE\u76EE\u6807\u670D\u52A1</p>
    </div>
    <input type="hidden" id="oldPrefix">
    <input type="hidden" id="routeSource">
    <input type="hidden" id="routeId">
    <div class="form-group">
      <label>\u5907\u6CE8\u540D</label>
      <input id="routeRemark" placeholder="\u4F8B\u5982\uFF1A\u6211\u7684 Emby \u670D\u52A1\u5668">
      <p class="form-hint">\u901A\u77E5\u4F1A\u663E\u793A\u901A\u8FC7\u5B89\u5168\u68C0\u67E5\u7684\u7B80\u77ED\u670D\u540D\uFF1B\u8BF7\u52FF\u5728\u5907\u6CE8\u91CC\u653E\u5730\u5740\u3001\u7528\u6237\u540D\u3001\u5BC6\u7801\u3001Token \u6216\u7B7E\u540D\u53C2\u6570\u3002</p>
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
      <label>\u63A8\u6D41\u5730\u5740\uFF08\u53EF\u9009\uFF09</label>
      <textarea id="routeStreamTarget" rows="2" placeholder="https://stream.example.com:8096"></textarea>
      <p class="form-hint">\u7528\u4E8E Emby \u524D\u540E\u7AEF\u5206\u79BB\uFF1A\u586B\u5199\u6E90\u7AD9\u8DF3\u8F6C\u5230\u7684\u63A8\u6D41\u670D\u52A1\u5668\u5730\u5740\uFF08\u53EF\u591A\u884C\uFF09\uFF0C\u5339\u914D\u7684 302/\u64AD\u653E URL \u4F1A\u6539\u5199\u56DE\u672C\u8DEF\u7531\u5E76\u7ECF Worker \u53CD\u4EE3\u3002\u76EE\u6807\u5730\u5740\u4ECD\u586B\u5199\u754C\u9762/API \u5730\u5740\uFF1B\u5E38\u89C4\u670D\u548C\u7F51\u76D8\u76F4\u8FDE\u7559\u7A7A\u3002\u4E0D\u4F1A\u76F4\u63A5\u5F80\u63A8\u6D41\u5730\u5740\u62FC\u63A5 Emby \u64AD\u653E\u8DEF\u5F84\u3002</p>
    </div>
    <div class="form-group">
      <label class="checkbox-label">
        <input type="checkbox" id="routeCache" checked> \u542F\u7528\u56FE\u7247/\u9759\u6001\u8D44\u6E90\u7F13\u5B58
      </label>
      <label class="checkbox-label" style="margin-top:12px">
        <input type="checkbox" id="routeCompat"> \u517C\u5BB9\u6A21\u5F0F
      </label>
      <p class="form-hint">\u517C\u5BB9\u6A21\u5F0F\u8C03\u6574\u56DE\u6E90\u8BF7\u6C42\u5934\uFF0C\u5E76\u7531 Worker \u6821\u9A8C\u548C\u8DDF\u968F\u8DF3\u8F6C\uFF1B\u914D\u7F6E\u63A8\u6D41\u5730\u5740\u65F6\u4ECD\u4FDD\u7559\u5185\u90E8 302 \u6620\u5C04\uFF0C\u4E0D\u4F1A\u8DF3\u8FC7\u5B89\u5168\u6821\u9A8C\u3002</p>
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

${adminModals}

${isAdmin2 ? "" : `<div id="modalPassword" class="modal"><div class="modal-inner">
  <div class="modal-header"><h2 class="modal-title">\u4FEE\u6539\u6211\u7684\u5BC6\u7801</h2><p class="modal-desc">\u53EA\u64A4\u9500\u5F53\u524D\u8D26\u53F7\u7684\u65E7\u4F1A\u8BDD\uFF0C\u4E0D\u5F71\u54CD\u5176\u4ED6\u7528\u6237\u3002</p></div>
  <div class="form-group"><label for="currentPassword">\u5F53\u524D\u5BC6\u7801</label><input id="currentPassword" type="password" autocomplete="current-password" maxlength="1024"></div>
  <div class="form-group"><label for="newPassword">\u65B0\u5BC6\u7801\uFF0812\u2013128 \u4E2A\u5B57\u7B26\uFF09</label><input id="newPassword" type="password" autocomplete="new-password" minlength="12" maxlength="128"></div>
  <div class="form-group"><label for="confirmPassword">\u786E\u8BA4\u65B0\u5BC6\u7801</label><input id="confirmPassword" type="password" autocomplete="new-password" minlength="12" maxlength="128"></div>
  <div class="modal-actions"><button class="btn" onclick="closeModal('modalPassword')">\u53D6\u6D88</button><button class="btn btn-solid" id="btnChangePassword" onclick="updatePassword(this)">\u4FEE\u6539\u5BC6\u7801\u5E76\u9000\u51FA</button></div>
</div></div>`}

<script>window.__EMBY_PAGE__ = ${JSON.stringify({ isAdmin: isAdmin2, username }).replace(/</g, "\\u003c")};
${THEME_LOGIC}
${SPEED_TOOLS}
${admin_default}<\/script></body></html>`;
}

// src/editions/multi/integrations/stats.js
function escapeLike(s) {
  return String(s || "").replace(/[!%_]/g, (ch) => "!" + ch);
}
async function getD1Stats(env2, dateKey, owner = "") {
  const empty = { requests: 0, plays: 0, playbackInfo: 0, traffic: 0, hourly: new Array(24).fill(0), routes: [] };
  if (!env2.DB)
    return empty;
  try {
    if (owner) {
      const totals2 = await env2.DB.prepare(`SELECT COALESCE(SUM(request_count),0) AS requests,
                COALESCE(SUM(play_count),0) AS plays,
                COALESCE(SUM(playback_info_count),0) AS info,
                COALESCE(SUM(traffic_bytes),0) AS traffic
         FROM user_stats_hourly WHERE owner = ? AND bucket_date = ?`).bind(owner, dateKey).first();
      const hourly2 = await env2.DB.prepare(`SELECT bucket_hour AS hour,
                COALESCE(SUM(request_count),0) AS requests,
                COALESCE(SUM(traffic_bytes),0) AS traffic
         FROM user_stats_hourly WHERE owner = ? AND bucket_date = ? GROUP BY bucket_hour`).bind(owner, dateKey).all();
      const routes2 = await env2.DB.prepare(`SELECT prefix,
                COALESCE(SUM(request_count),0) AS requests,
                COALESCE(SUM(traffic_bytes),0) AS traffic
         FROM route_stats_daily WHERE bucket_date = ? AND prefix LIKE ? ESCAPE '!' GROUP BY prefix ORDER BY requests DESC LIMIT 12`).bind(dateKey, escapeLike(owner) + "/%").all();
      const h2 = new Array(24).fill(0);
      for (const r of hourly2.results || []) {
        const i = Number(r.hour);
        if (i >= 0 && i < 24)
          h2[i] += Number(r.requests) || 0;
      }
      return {
        requests: Number(totals2?.requests) || 0,
        plays: Number(totals2?.plays) || 0,
        playbackInfo: Number(totals2?.info) || 0,
        traffic: Number(totals2?.traffic) || 0,
        hourly: h2,
        routes: (routes2.results || []).map((r) => ({
          prefix: String(r.prefix || "").startsWith(owner + "/") ? String(r.prefix).slice(owner.length + 1) : r.prefix || "",
          requests: Number(r.requests) || 0,
          traffic: Number(r.traffic) || 0
        }))
      };
    }
    const totals = await env2.DB.prepare(`SELECT COALESCE(SUM(request_count),0) AS requests,
              COALESCE(SUM(play_count),0) AS plays,
              COALESCE(SUM(playback_info_count),0) AS info,
              COALESCE(SUM(traffic_bytes),0) AS traffic
       FROM proxy_stats_hourly WHERE bucket_date = ?`).bind(dateKey).first();
    const hourly = await env2.DB.prepare(`SELECT bucket_hour AS hour,
              COALESCE(SUM(request_count),0) AS requests,
              COALESCE(SUM(traffic_bytes),0) AS traffic
       FROM proxy_stats_hourly WHERE bucket_date = ? GROUP BY bucket_hour`).bind(dateKey).all();
    const routes = await env2.DB.prepare(`SELECT prefix,
              COALESCE(SUM(request_count),0) AS requests,
              COALESCE(SUM(traffic_bytes),0) AS traffic
       FROM route_stats_daily WHERE bucket_date = ? AND instr(prefix, '/') = 0
       GROUP BY prefix ORDER BY requests DESC LIMIT 12`).bind(dateKey).all();
    const h = new Array(24).fill(0);
    for (const r of hourly.results || []) {
      const i = Number(r.hour);
      if (i >= 0 && i < 24)
        h[i] += Number(r.requests) || 0;
    }
    return {
      requests: Number(totals?.requests) || 0,
      plays: Number(totals?.plays) || 0,
      playbackInfo: Number(totals?.info) || 0,
      traffic: Number(totals?.traffic) || 0,
      hourly: h,
      routes: (routes.results || []).map((r) => ({ prefix: r.prefix || "", requests: Number(r.requests) || 0, traffic: Number(r.traffic) || 0 }))
    };
  } catch (e) {
    console.error("getD1Stats failed:", e?.message);
    return empty;
  }
}
async function handleStatsRequest(env2, url, opts = {}) {
  if (!env2.DB)
    return json({ error: "D1 \u6570\u636E\u5E93\u672A\u7ED1\u5B9A", data: null });
  const owner = String(opts.owner || "").toLowerCase();
  const dateParam = url.searchParams.get("date") || "";
  const dateKey = /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : getShanghaiParts().dateKey;
  const d1 = await getD1Stats(env2, dateKey, owner);
  let hostSet = null;
  if (owner) {
    const userDomain = getUserDomain(env2);
    let sub = "";
    try {
      const row = await env2.DB.prepare("SELECT subdomain, username FROM users WHERE username = ?").bind(owner).first();
      sub = String(row?.subdomain || row?.username || owner).trim().toLowerCase();
    } catch (_) {
      sub = owner;
    }
    if (userDomain && sub)
      hostSet = /* @__PURE__ */ new Set([sub + "." + userDomain]);
  } else {
    hostSet = await getWorkerHosts(env2);
  }
  let acc = hostSet ? await cfGetAccountSummary(env2, dateKey, hostSet) : { error: "\u672A\u914D\u7F6E\u7EDF\u8BA1\u57DF\u540D\u8303\u56F4" };
  if (owner && !acc.error && (!acc.hostDim || !acc.hostMatched)) acc = { error: "CF \u672A\u8FD4\u56DE\u672C\u7528\u6237\u57DF\u540D\u6570\u636E\uFF0C\u4E0D\u4F7F\u7528\u5176\u4ED6\u7528\u6237\u6216\u8D26\u6237\u6C47\u603B" };
  const accOk = !acc.error;
  const cf = accOk || owner ? { error: "" } : await cfGetZoneSummary(env2, dateKey, hostSet);
  const worker = owner ? { error: "" } : await cfGetWorkerSummary(env2, dateKey);
  const cfOk = !accOk && !owner && !cf.error;
  const statsSource = accOk ? "account" : cfOk ? "zone" : "unavailable";
  const trafficBytes = accOk ? Number(acc.bytes) || 0 : cfOk ? Number(cf.bytes) || 0 : null;
  const requests = accOk ? Number(acc.requests) || 0 : cfOk ? Number(cf.requests) || 0 : null;
  const visits = accOk ? Number(acc.visits) || 0 : cfOk ? Number(cf.visits) || 0 : null;
  const hourly = accOk ? acc.hourly : cfOk ? cf.hourly : null;
  const hourlySeries = Array.from({ length: 24 }, (_, h) => ({
    label: String(h).padStart(2, "0") + ":00",
    total: hourly ? hourly[h] || 0 : 0,
    cf: hourly ? hourly[h] || 0 : 0
  }));
  let dailySeries = [];
  if (accOk) {
    const s = await cfGetAccountDailySeries(env2, 7, hostSet);
    if (!s.error && Array.isArray(s.series))
      dailySeries = s.series;
  }
  const zoneInfo = owner ? { zoneId: "", zoneName: "", from: "" } : await resolveZoneInfo(env2);
  const notifyEnv = await notificationEnv(env2);
  const tgReady = Boolean(getTelegramToken(notifyEnv) && getTelegramChatId(notifyEnv));
  return json({
    error: null,
    data: {
      date: dateKey,
      scope: owner ? "user" : "global",
      owner,
      todayRequests: requests,
      todayTraffic: trafficBytes == null ? null : formatBytes(trafficBytes),
      todayTrafficBytes: trafficBytes,
      todayVisits: visits,
      plays: d1.plays,
      playbackInfo: d1.playbackInfo,
      d1: { requests: d1.requests, trafficBytes: d1.traffic, plays: d1.plays, playbackInfo: d1.playbackInfo },
      account: accOk ? { requests: Number(acc.requests) || 0, trafficBytes: Number(acc.bytes) || 0, visits: Number(acc.visits) || 0, accountId: acc.accountId, hostMatched: acc.hostMatched, note: acc.note || "", warning: acc.warning || "" } : { error: acc.error || "" },
      cf: cfOk ? { requests: Number(cf.requests) || 0, trafficBytes: Number(cf.bytes) || 0, visits: Number(cf.visits) || 0, zoneId: cf.zoneId, zoneName: cf.zoneName, hostMatched: cf.hostMatched, note: cf.note || "", warning: cf.warning || "" } : { error: cf.error },
      worker: worker.error ? { error: worker.error } : { requests: Number(worker.requests) || 0, byScript: worker.byScript || {} },
      hourlySeries,
      dailySeries,
      topRoutes: d1.routes,
      statsSource,
      cfStatus: owner ? accOk ? "CF \u8D26\u53F7\u5206\u6790\uFF08\u6211\u7684\u57DF\u540D\uFF09" : "CF \u6570\u636E\u4E0D\u53EF\u7528" : accOk ? acc.hostMatched === false ? "CF \u8D26\u53F7\u5206\u6790\uFF08\u8D26\u53F7\u603B\u91CF\uFF09" : "CF \u8D26\u53F7\u5206\u6790\uFF08\u6574\u4E2A\u57DF\u540D\uFF09" : cfOk ? "CF Zone \u7EDF\u8BA1" : "CF \u6570\u636E\u4E0D\u53EF\u7528",
      cfError: owner ? accOk ? "" : acc.error || "" : accOk || cfOk ? "" : acc.error || cf.error,
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
      source: accOk ? "CF \u8D26\u53F7\u5206\u6790" : cfOk ? "CF Zone" : "CF \u6570\u636E\u4E0D\u53EF\u7528",
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

// src/editions/multi/relay/protocol.js
function normalizeRelayBase(v) {
  let u = String(v || "").trim();
  if (!u)
    return "";
  if (!/^https?:\/\//i.test(u))
    u = "https://" + u;
  return u.replace(/\/+$/, "");
}
function getRelayCfg(settings) {
  if (!settings.relayEnabled || !settings.relayUrl || !settings.relaySecret)
    return null;
  const base = normalizeRelayBase(settings.relayUrl);
  return base && settings.relaySecret ? { base, secret: settings.relaySecret } : null;
}
async function relayFetchHeaders(secret, targetUrl) {
  const ts = Date.now();
  const auth = await hmacHex(secret, ts + ":" + targetUrl);
  return { "X-Relay-Target": targetUrl, "X-Relay-Ts": String(ts), "X-Relay-Auth": auth };
}

// src/editions/multi/users/admin.js
async function adminListUsers(env2) {
  const today = getShanghaiParts().dateKey;
  const hasLegacy = await routesHasUserId(env2);
  const rcSql = hasLegacy ? `LEFT JOIN (
         SELECT owner, COUNT(DISTINCT prefix) AS cnt FROM (
           SELECT owner, prefix FROM user_routes
           UNION
           SELECT u2.username AS owner, r.prefix FROM routes r JOIN users u2 ON u2.id = r.user_id
         ) GROUP BY owner
       ) rc ON rc.owner = u.username` : `LEFT JOIN (SELECT owner, COUNT(*) AS cnt FROM user_routes GROUP BY owner) rc ON rc.owner = u.username`;
  const { results } = await env2.DB.prepare(`SELECT u.*, COALESCE(s.req, 0) AS today_req, COALESCE(s.bytes, 0) AS today_bytes,
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
     ORDER BY u.id`).bind(today).all();
  return (results || []).map((r) => ({
    ...publicUser(rowToUser(r)),
    todayRequests: Number(r.today_req) || 0,
    todayTraffic: Number(r.today_bytes) || 0,
    routeCount: Number(r.route_count) || 0
  }));
}
async function adminCreateUser(env2, data, actor) {
  const username = sanitizeUsername(data.username);
  const password = String(data.password || "");
  const subdomain = sanitizeSubdomain(data.subdomain) || sanitizeSubdomain(username);
  const role = data.role === "admin" ? "admin" : "user";
  const status = data.status === "disabled" ? "disabled" : "active";
  const routeLimit = Math.max(1, Math.min(200, parseInt(data.route_limit, 10) || DEFAULT_USER_ROUTE_LIMIT));
  if (!username)
    return { error: "\u7528\u6237\u540D\u9700\u4E3A 3-32 \u4F4D\u5C0F\u5199\u5B57\u6BCD\u3001\u6570\u5B57\u6216\u77ED\u6A2A\u7EBF\uFF0C\u4E14\u4E0D\u80FD\u4EE5\u77ED\u6A2A\u7EBF\u5F00\u5934/\u7ED3\u5C3E" };
  if (password.length < 6)
    return { error: "\u5BC6\u7801\u81F3\u5C11 6 \u4F4D" };
  if (!subdomain)
    return { error: "\u5B50\u57DF\u540D\u4E0D\u5408\u6CD5" };
  const entryErr = entryNameError(env2, subdomain);
  if (entryErr)
    return { error: entryErr };
  const exists = await env2.DB.prepare("SELECT 1 AS x FROM users WHERE username = ? OR subdomain = ?").bind(username, subdomain).first();
  if (exists)
    return { error: "\u7528\u6237\u540D\u6216\u5B50\u57DF\u540D\u5DF2\u88AB\u5360\u7528" };
  const salt = randomHex(16);
  const hash = await hashPassword(password, salt);
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  let created = null;
  try {
    const res = await env2.DB.prepare("INSERT INTO users (username, password_hash, salt, role, status, subdomain, route_limit, created_at, last_login) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(username, hash, salt, role, status, subdomain, routeLimit, nowIso, "").run();
    clearUserCache();
    await auditLog(env2, "user.create", actor + " -> " + username + " / " + subdomain);
    created = { id: res.meta?.last_row_id, username, role, status, subdomain, routeLimit };
  } catch (e) {
    return { error: /UNIQUE/i.test(String(e?.message)) ? "\u7528\u6237\u540D\u6216\u5B50\u57DF\u540D\u5DF2\u88AB\u5360\u7528" : "\u521B\u5EFA\u5931\u8D25" };
  }
  const user = await getUserByUsername(env2, username);
  const dns = user ? await provisionUserDns(env2, user) : { ok: false, error: "\u8BFB\u53D6\u7528\u6237\u5931\u8D25" };
  return dns.ok ? { user: created, dns: { entryHost: dns.entryHost, target: dns.target, type: dns.type } } : { user: created, dnsWarning: dns.error };
}
async function adminUpdateUser(env2, id, data, actor) {
  const user = await getUserById(env2, id);
  if (!user)
    return { error: "\u7528\u6237\u4E0D\u5B58\u5728" };
  const fields = [];
  const changed = [];
  const args = [];
  let subdomain = user.subdomain;
  if (data.subdomain !== void 0) {
    subdomain = sanitizeSubdomain(data.subdomain) || sanitizeSubdomain(user.username);
    if (!subdomain)
      return { error: "\u5B50\u57DF\u540D\u4E0D\u5408\u6CD5" };
    if (RESERVED_SUBDOMAINS.has(subdomain))
      return { error: "\u8BE5\u5B50\u57DF\u540D\u4E0D\u53EF\u7528" };
    const clash = await env2.DB.prepare("SELECT 1 AS x FROM users WHERE subdomain = ? AND id <> ?").bind(subdomain, id).first();
    if (clash)
      return { error: "\u5B50\u57DF\u540D\u5DF2\u88AB\u5360\u7528" };
    fields.push("subdomain = ?");
    changed.push("subdomain");
    args.push(subdomain);
  }
  if (data.role !== void 0) {
    fields.push("role = ?");
    changed.push("role");
    args.push(data.role === "admin" ? "admin" : "user");
  }
  if (data.status !== void 0) {
    fields.push("status = ?");
    changed.push("status");
    args.push(data.status === "disabled" ? "disabled" : "active");
  }
  if (data.route_limit !== void 0) {
    const limit = Math.max(1, Math.min(200, parseInt(data.route_limit, 10) || DEFAULT_USER_ROUTE_LIMIT));
    fields.push("route_limit = ?");
    changed.push("route_limit");
    args.push(limit);
  }
  if (data.password) {
    if (String(data.password).length < 6)
      return { error: "\u5BC6\u7801\u81F3\u5C11 6 \u4F4D" };
    const salt = randomHex(16);
    fields.push("password_hash = ?", "salt = ?");
    changed.push("password");
    args.push(await hashPassword(String(data.password), salt), salt);
  }
  if (!fields.length)
    return { error: "\u6CA1\u6709\u9700\u8981\u66F4\u65B0\u7684\u5B57\u6BB5" };
  args.push(id);
  await env2.DB.prepare("UPDATE users SET " + fields.join(", ") + " WHERE id = ?").bind(...args).run();
  clearUserCache();
  await auditLog(env2, "user.update", actor + " -> " + user.username + " (" + changed.join(",") + ")");
  const updated = await getUserById(env2, id);
  return { user: publicUser(updated) };
}
async function adminDeleteUser(env2, id, actor) {
  const user = await getUserById(env2, id);
  if (!user)
    return { error: "\u7528\u6237\u4E0D\u5B58\u5728" };
  await env2.DB.batch([
    env2.DB.prepare("DELETE FROM user_routes WHERE owner = ?").bind(user.username),
    env2.DB.prepare("DELETE FROM user_stats_hourly WHERE owner = ?").bind(user.username),
    env2.DB.prepare("DELETE FROM route_stats_daily WHERE prefix LIKE ? ESCAPE '!'").bind(escapeLike(user.username) + "/%"),
    env2.DB.prepare("DELETE FROM users WHERE id = ?").bind(id)
  ]);
  clearUserCache();
  clearRouteCache();
  await auditLog(env2, "user.delete", actor + " -> " + user.username);
  return { ok: true };
}
async function adminResetData(env2, data, actor) {
  if (String(data.confirm || "") !== "RESET")
    return { error: "\u8BF7\u8F93\u5165 RESET \u786E\u8BA4" };
  const scope = String(data.scope || "stats");
  const jobs = [];
  if (scope === "stats" || scope === "all") {
    jobs.push(env2.DB.prepare("DELETE FROM proxy_stats_hourly"), env2.DB.prepare("DELETE FROM route_stats_daily"), env2.DB.prepare("DELETE FROM user_stats_hourly"), env2.DB.prepare("DELETE FROM route_health"), env2.DB.prepare("DELETE FROM audit_log"));
    clearStatsBuffers();
  }
  if (scope === "users" || scope === "all") {
    jobs.push(env2.DB.prepare("DELETE FROM user_routes"), env2.DB.prepare("DELETE FROM user_stats_hourly"), env2.DB.prepare("DELETE FROM route_stats_daily WHERE instr(prefix, '/') > 0"), env2.DB.prepare("DELETE FROM invite_codes"), env2.DB.prepare("DELETE FROM users"));
    clearUserCache();
    clearRouteCache();
  }
  if (!jobs.length)
    return { error: "\u672A\u77E5\u7684\u6E05\u7406\u8303\u56F4" };
  await env2.DB.batch(jobs);
  await auditLog(env2, "db.reset", actor + " -> " + scope);
  return { ok: true, scope };
}

// src/editions/multi/users/invites.js
async function adminListInvites(env2) {
  const { results } = await env2.DB.prepare("SELECT * FROM invite_codes ORDER BY created_at DESC, code").all();
  return (results || []).map((r) => ({
    code: r.code,
    maxUses: Number(r.max_uses) || 0,
    usedCount: Number(r.used_count) || 0,
    expiresAt: r.expires_at || "",
    note: r.note || "",
    createdBy: r.created_by || "",
    createdAt: r.created_at || ""
  }));
}
async function adminCreateInvite(env2, data, actor) {
  const code = String(data.code || "").trim().toUpperCase() || makeInviteCode();
  if (!/^[A-Z0-9-]{4,32}$/.test(code))
    return { error: "\u9080\u8BF7\u7801\u4EC5\u5141\u8BB8 4-32 \u4F4D\u5B57\u6BCD\u3001\u6570\u5B57\u548C\u77ED\u6A2A\u7EBF" };
  const maxUses = Math.max(0, Math.min(1e4, parseInt(data.max_uses, 10) || 1));
  const expiresAt = String(data.expires_at || "").trim();
  if (expiresAt && isNaN(new Date(expiresAt).getTime()))
    return { error: "\u8FC7\u671F\u65F6\u95F4\u683C\u5F0F\u4E0D\u6B63\u786E" };
  const note = String(data.note || "").slice(0, 200);
  try {
    await env2.DB.prepare("INSERT INTO invite_codes (code, max_uses, used_count, expires_at, note, created_by, created_at) VALUES (?, ?, 0, ?, ?, ?, ?)").bind(code, maxUses, expiresAt, note, actor, (/* @__PURE__ */ new Date()).toISOString()).run();
    await auditLog(env2, "invite.create", actor + " -> " + code);
    return { invite: { code, maxUses, usedCount: 0, expiresAt, note, createdBy: actor } };
  } catch (e) {
    const msg = String(e?.message || e || "");
    return { error: /UNIQUE/i.test(msg) ? "\u9080\u8BF7\u7801\u5DF2\u5B58\u5728" : "\u521B\u5EFA\u5931\u8D25: " + msg };
  }
}
async function adminClearInvites(env2, actor) {
  let deleted = 0;
  try {
    const row = await env2.DB.prepare("SELECT COUNT(*) AS n FROM invite_codes").first();
    deleted = Number(row?.n) || 0;
  } catch (_) {
  }
  const res = await env2.DB.prepare("DELETE FROM invite_codes").run();
  if (Number(res.meta?.changes) > 0)
    deleted = Number(res.meta.changes);
  await auditLog(env2, "invite.clear", actor + " -> " + deleted);
  return { ok: true, deleted };
}
async function adminDeleteInvite(env2, code, actor) {
  const raw = String(code || "").trim();
  const upper = raw.toUpperCase();
  if (!raw)
    return { error: "\u9080\u8BF7\u7801\u4E0D\u80FD\u4E3A\u7A7A" };
  let row = await env2.DB.prepare("SELECT code FROM invite_codes WHERE code = ? OR code = ? LIMIT 1").bind(raw, upper).first();
  if (!row)
    row = await env2.DB.prepare("SELECT code FROM invite_codes WHERE UPPER(code) = ? LIMIT 1").bind(upper).first();
  if (!row)
    return { ok: true, alreadyDeleted: true };
  const res = await env2.DB.prepare("DELETE FROM invite_codes WHERE code = ?").bind(row.code).run();
  if (!res.meta?.changes)
    return { error: "\u5220\u9664\u5931\u8D25\uFF0C\u8BF7\u5237\u65B0\u540E\u91CD\u8BD5" };
  await auditLog(env2, "invite.delete", actor + " -> " + row.code);
  return { ok: true };
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

// src/editions/multi/admin/api.js
async function handleAdminApi(request, env2, url, session) {
  const adminActor = String(session?.username || "admin");
  if (!await isAdmin(request, env2))
    return new Response("Unauthorized", { status: 401 });
  if (request.method !== "GET" && request.method !== "HEAD") {
    const origin = request.headers.get("Origin");
    if (origin && origin !== url.origin)
      return json({ error: "Forbidden origin" }, 403);
  }
  if (url.pathname === "/admin/api/logout" && request.method === "POST") return logoutResponse();
  if (["/admin/api/notifications", "/admin/api/notifications/test", "/admin/api/security/password"].includes(url.pathname)) {
    if (request.method === "POST" && (request.headers.get("Origin") !== url.origin || !request.headers.get("Content-Type")?.startsWith("application/json"))) {
      return json({ error: "\u5FC5\u987B\u4F7F\u7528\u540C\u6E90 JSON \u8BF7\u6C42" }, 403);
    }
    if (url.pathname === "/admin/api/notifications") {
      if (request.method === "GET") return json({ success: true, ...await notificationStatus(env2) });
      if (request.method === "POST") {
        const data = await readJson(request);
        if (!data) return json({ error: "\u65E0\u6548 JSON" }, 400);
        try {
          await saveTelegramConfig(env2, data);
        } catch {
          return json({ error: "\u4FDD\u5B58\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5 Token\u3001\u6570\u5B57 Chat ID \u548C\u901A\u77E5\u52A0\u5BC6\u5BC6\u94A5" }, 400);
        }
        await auditLog(env2, "notification.save", data.clear === true ? "disabled" : "updated");
        return json({ success: true, ...await notificationStatus(env2) });
      }
    }
    if (url.pathname === "/admin/api/notifications/test" && request.method === "POST") {
      const result = await testTelegram(env2);
      await auditLog(env2, "notification.test", result.ok ? "ok" : "failed");
      return json(result, result.ok ? 200 : 502);
    }
    if (url.pathname === "/admin/api/security/password") {
      if (request.method === "GET") return json({ success: true, customPassword: session.uid === ADMIN_UID ? Boolean((await credentialState(env2)).record) : true });
      if (request.method === "POST") return changePassword(request, env2, session);
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
  if (url.pathname === "/admin/api/routes/diagnose" && request.method === "POST") {
    const data = await readJson(request) || {};
    const route = await env2.DB.prepare("SELECT * FROM routes WHERE prefix = ? AND created_by = ?").bind(normalizePrefix(data.prefix), adminActor).first();
    if (!route) return json({ error: "\u8DEF\u7531\u4E0D\u5B58\u5728" }, 404);
    const settings = await getSettings(env2);
    return json(await diagnoseRoute(route, request, { edition: "multi", relayConfigured: !!(settings.relayEnabled && settings.relaySecret && settings.relayUrl) }));
  }
  if (url.pathname === "/admin/api/import/preview" && request.method === "POST") {
    const data = await readJson(request);
    const existing = (await env2.DB.prepare("SELECT prefix, created_by FROM routes").all()).results || [];
    const plan = inspectImport(data, existing.map((route) => route.prefix), SETTING_KEYS);
    if (plan.success) {
      const blocked = new Set(existing.filter((route) => route.created_by !== adminActor).map((route) => route.prefix));
      for (const prefix of plan.overwritten.filter((prefix2) => blocked.has(prefix2))) plan.invalid.push({ prefix, reason: "\u4E0D\u662F\u5F53\u524D\u7BA1\u7406\u5458\u7684\u8DEF\u7531\uFF0C\u65E0\u6CD5\u8986\u76D6" });
      plan.overwritten = plan.overwritten.filter((prefix) => !blocked.has(prefix));
      plan.canImport = plan.invalid.length === 0;
    }
    return json(plan, plan.success ? 200 : 400);
  }
  if (url.pathname === "/admin/api/settings") {
    if (request.method === "GET") {
      const st = await getSettings(env2);
      const safeRaw = publicSettings(st.raw);
      return json({
        success: true,
        settings: safeRaw,
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
  if (url.pathname === "/admin/api/relay" && request.method === "GET") {
    const st = await getSettings(env2);
    return json({
      success: true,
      relay_url: st.relayUrl,
      relay_enabled: st.relayEnabled ? "1" : "0",
      has_secret: !!st.relaySecret,
      secret_hint: st.relaySecret ? "\u5DF2\u8BBE\u7F6E\uFF0C\u7559\u7A7A\u4FDD\u6301\u4E0D\u53D8" : "",
      active: !!(st.relayEnabled && st.relayUrl && st.relaySecret)
    });
  }
  if (url.pathname === "/admin/api/relay" && request.method === "POST") {
    const data = await readJson(request) || {};
    const url2 = String(data.relay_url ?? "").trim();
    if (url2) {
      const u = normalizeRelayBase(url2);
      if (!/^https?:\/\//i.test(u))
        return json({ error: "\u4E2D\u7EE7\u5730\u5740\u5FC5\u987B\u662F http(s):// \u5F00\u5934" }, 400);
      await setSetting(env2, "relay_url", u);
    }
    const secret = String(data.relay_secret ?? "").trim();
    if (secret)
      await setSetting(env2, "relay_secret", secret);
    if (data.relay_enabled != null)
      await setSetting(env2, "relay_enabled", data.relay_enabled === "1" || data.relay_enabled === true ? "1" : "0");
    await auditLog(env2, "relay.save", `url=${url2 ? "\u5DF2\u66F4\u65B0" : "\u672A\u53D8"} secret=${secret ? "\u5DF2\u66F4\u65B0" : "\u672A\u53D8"} enabled=${data.relay_enabled != null ? data.relay_enabled : "\u672A\u53D8"}`);
    return json({ success: true });
  }
  if (url.pathname === "/admin/api/relay/test" && request.method === "POST") {
    const st = await getSettings(env2);
    const base = normalizeRelayBase(st.relayUrl);
    if (!base || !st.relaySecret)
      return json({ ok: false, error: "\u8BF7\u5148\u586B\u5199\u4E2D\u7EE7\u5730\u5740\u548C\u5BC6\u94A5\u5E76\u4FDD\u5B58" });
    const t0 = Date.now();
    try {
      const res = await fetch(new Request(base + "/_relay/health", { headers: { "X-Relay-Key": st.relaySecret }, signal: AbortSignal.timeout(15e3) }));
      const body = await readJson(res, { limit: 16384, timeoutMs: 5e3 });
      const ok = res.ok && body?.ok === true;
      const version = typeof body?.version === "string" && /^[a-z0-9._-]{1,64}$/i.test(body.version) ? body.version : "";
      const result = {
        ok,
        status: res.status,
        ms: Date.now() - t0,
        version,
        limits: body?.limits || null,
        usage: body?.usage || null,
        ...ok ? {} : { error: "\u4E2D\u7EE7\u5065\u5EB7\u54CD\u5E94\u672A\u901A\u8FC7\u6821\u9A8C" }
      };
      if (ok && !st.relayEnabled) {
        await setSetting(env2, "relay_enabled", "1");
        result.auto_enabled = true;
      }
      if (ok) {
        try {
          await auditLog(env2, "relay.test.ok", `${result.ms}ms version=${result.version}`);
        } catch (_) {
        }
      }
      return json(result);
    } catch (e) {
      return json({ ok: false, ms: Date.now() - t0, error: "\u4E2D\u7EE7\u5065\u5EB7\u6D4B\u8BD5\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u8FDE\u63A5\u3001\u5BC6\u94A5\u548C\u5065\u5EB7\u54CD\u5E94" });
    }
  }
  if (url.pathname === "/admin/api/relay/usage" && request.method === "GET") {
    const st = await getSettings(env2);
    const base = normalizeRelayBase(st.relayUrl);
    if (!base || !st.relaySecret)
      return json({ ok: false, error: "\u672A\u914D\u7F6E\u4E2D\u7EE7" });
    let fallback24 = 0, fallbackErr24 = 0;
    try {
      const since = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
      const { results } = await env2.DB.prepare(`SELECT action, COUNT(*) AS n FROM audit_log
         WHERE action IN ('relay.fallback', 'relay.fallback.err') AND substr(ts, 1, 10) >= ?
         GROUP BY action`).bind(since).all();
      for (const row of results || []) {
        if (row.action === "relay.fallback")
          fallback24 = Number(row.n) || 0;
        if (row.action === "relay.fallback.err")
          fallbackErr24 = Number(row.n) || 0;
      }
    } catch (_) {
    }
    try {
      const res = await fetch(new Request(base + "/_relay/health", { headers: { "X-Relay-Key": st.relaySecret }, signal: AbortSignal.timeout(15e3) }));
      const body = await readJson(res, { limit: 16384, timeoutMs: 5e3 });
      return json({ ok: res.ok && body?.ok === true, usage: body?.usage || null, limits: body?.limits || null, version: body?.version || "", uptime: body?.uptime || "", fallback24, fallbackErr24 });
    } catch (e) {
      return json({ ok: false, error: "\u4E2D\u7EE7\u72B6\u6001\u8BFB\u53D6\u5931\u8D25", fallback24, fallbackErr24 });
    }
  }
  if (url.pathname === "/admin/api/audit" && request.method === "GET") {
    const { results } = await env2.DB.prepare("SELECT ts, action, detail FROM audit_log ORDER BY id DESC LIMIT 100").all();
    return json({ success: true, logs: results || [] });
  }
  if (url.pathname === "/admin/api/export" && request.method === "GET") {
    const routes = (await env2.DB.prepare("SELECT prefix, target, stream_target, remark, cache_img, compat_mode, ip_mode, sort_order, enabled, custom_headers, ip_allow, ip_block FROM routes WHERE created_by = ? ORDER BY sort_order, prefix").bind(adminActor).all()).results || [];
    const domains = (await env2.DB.prepare("SELECT domain, name FROM optimized_domains WHERE is_builtin = 0").all()).results || [];
    const st = await getSettings(env2);
    const body = JSON.stringify({ version: CURRENT_VERSION, exportedAt: (/* @__PURE__ */ new Date()).toISOString(), routes, domains, settings: publicSettings(st.raw) }, null, 2);
    return new Response(body, { headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="proxy-config-' + (/* @__PURE__ */ new Date()).toISOString().slice(0, 10) + '.json"',
      "Cache-Control": "no-store"
    } });
  }
  if (url.pathname === "/admin/api/import" && request.method === "POST") {
    const data = await readJson(request);
    if (!data || typeof data !== "object")
      return json({ error: "\u4E0D\u662F\u5408\u6CD5\u7684\u914D\u7F6E JSON" }, 400);
    const stmts = [];
    let nr = 0, nd = 0;
    const skipped = [];
    const existingRows = (await env2.DB.prepare("SELECT rowid AS _rid, prefix, created_by FROM routes").all()).results || [];
    const ownerByPrefix = new Map(existingRows.map((x) => [x.prefix, x]));
    for (const r of Array.isArray(data.routes) ? data.routes : []) {
      const err = validatePrefix(r?.prefix);
      const targets = splitTargets(r?.target);
      const streamTargets = splitTargets(r?.stream_target || "");
      if (err || !targets.length || !targets.every(isValidHttpUrl) || streamTargets.length > 0 && !streamTargets.every(isValidHttpUrl) || parseHeaderLines(r.custom_headers).error || !validIpList(parseIpList(r.ip_allow)) || !validIpList(parseIpList(r.ip_block))) {
        skipped.push(String(r?.prefix || "?"));
        continue;
      }
      const pf = normalizePrefix(r.prefix);
      const cur = ownerByPrefix.get(pf);
      if (cur !== void 0 && (cur.created_by || "") !== adminActor) {
        skipped.push(pf);
        continue;
      }
      const commonArgs = [
        targets.join(","),
        streamTargets.join(","),
        String(r.remark || ""),
        r.cache_img === "off" ? "off" : "on",
        r.compat_mode === "on" ? "on" : "off",
        normalizeIpMode(r.ip_mode),
        Number(r.sort_order) || 0,
        r.enabled === 0 ? 0 : 1,
        String(r.custom_headers || ""),
        String(r.ip_allow || ""),
        String(r.ip_block || ""),
        adminActor
      ];
      if (cur !== void 0) {
        stmts.push(env2.DB.prepare(`UPDATE routes SET target = ?, stream_target = ?, remark = ?, cache_img = ?, compat_mode = ?, ip_mode = ?,
             sort_order = ?, enabled = ?, custom_headers = ?, ip_allow = ?, ip_block = ?, created_by = ?
           WHERE rowid = ?`).bind(...commonArgs, cur._rid));
      } else {
        stmts.push(env2.DB.prepare(`INSERT INTO routes (target, stream_target, remark, cache_img, compat_mode, ip_mode, sort_order, enabled, custom_headers, ip_allow, ip_block, created_by, prefix, last_play)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '')`).bind(...commonArgs, pf));
      }
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
    await auditLog(env2, "import", `routes=${nr} domains=${nd} skipped=${skipped.length}`);
    return json({ success: true, routes: nr, domains: nd, skipped });
  }
  if (url.pathname === "/admin/api/routes/toggle" && request.method === "POST") {
    const data = await readJson(request) || {};
    const prefix = normalizePrefix(data.prefix);
    if (!prefix)
      return json({ error: "\u7F3A\u5C11 prefix" }, 400);
    const res = await env2.DB.prepare("UPDATE routes SET enabled = ? WHERE prefix = ? AND created_by = ?").bind(data.enabled ? 1 : 0, prefix, adminActor).run();
    if (!res.meta?.changes)
      return json({ error: "\u8DEF\u7531\u4E0D\u5B58\u5728\u6216\u65E0\u6743\u64CD\u4F5C" }, 404);
    clearRouteCache();
    await auditLog(env2, data.enabled ? "route.enable" : "route.disable", "/" + prefix);
    return json({ success: true });
  }
  if (url.pathname === "/admin/api/routes/reorder" && request.method === "POST") {
    const data = await readJson(request) || {};
    const order = Array.isArray(data.order) ? data.order.map(normalizePrefix).filter(Boolean) : [];
    if (!order.length)
      return json({ error: "\u7F3A\u5C11 order" }, 400);
    await env2.DB.batch(order.map((pf, i) => env2.DB.prepare("UPDATE routes SET sort_order = ? WHERE prefix = ? AND created_by = ?").bind(i, pf, adminActor)));
    return json({ success: true });
  }
  if (url.pathname === "/admin/api/routes/test" && request.method === "POST") {
    const data = await readJson(request) || {};
    const route = await env2.DB.prepare("SELECT target FROM routes WHERE prefix = ? AND created_by = ?").bind(normalizePrefix(data.prefix), adminActor).first();
    if (!route)
      return json({ error: "\u8DEF\u7531\u4E0D\u5B58\u5728\u6216\u65E0\u6743\u64CD\u4F5C" }, 404);
    const targets = splitTargets(route.target);
    const results = await Promise.all(targets.map(async (t) => ({ target: t, ...await probeTarget(t) })));
    return json({ success: true, results });
  }
  if (url.pathname === "/admin/api/health/run" && request.method === "POST") {
    const out = await runHealthCheck(env2, true);
    return json({ success: true, ...out });
  }
  if (url.pathname === "/admin/api/routes") {
    if (request.method === "GET") {
      const today = getShanghaiParts().dateKey;
      const { results } = await env2.DB.prepare(`SELECT r.*, COALESCE(s.request_count, 0) AS today_req, COALESCE(s.traffic_bytes, 0) AS today_bytes
         FROM routes r LEFT JOIN route_stats_daily s ON s.prefix = r.prefix AND s.bucket_date = ?
         WHERE r.created_by = ?
         ORDER BY r.sort_order, r.prefix`).bind(today, adminActor).all();
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
      const streamTargets = splitTargets(data.stream_target || "");
      const badStreamTarget = streamTargets.find((t) => !isValidHttpUrl(t));
      if (badStreamTarget)
        return json({ error: "\u63A8\u6D41\u5730\u5740\u5FC5\u987B\u662F http(s):// \u5F00\u5934\u7684\u5408\u6CD5 URL\uFF1A" + badStreamTarget }, 400);
      const hdrCheck = parseHeaderLines(data.custom_headers);
      if (hdrCheck.error)
        return json({ error: hdrCheck.error }, 400);
      const allowList = parseIpList(data.ip_allow);
      const blockList = parseIpList(data.ip_block);
      if (!validIpList(allowList) || !validIpList(blockList))
        return json({ error: "IP \u9ED1\u767D\u540D\u5355\u683C\u5F0F\u4E0D\u5408\u6CD5\uFF08\u652F\u6301 IPv4\u3001IPv6 \u548C IPv4 CIDR\uFF0C\u7528\u9017\u53F7\u6216\u7A7A\u683C\u5206\u9694\uFF09" }, 400);
      const isRename = oldPrefix && oldPrefix !== prefix;
      const hasLegacy = await routesHasUserId(env2);
      const globalScope = hasLegacy ? " AND (user_id IS NULL OR user_id = 0 OR user_id = '')" : "";
      const existing = await env2.DB.prepare("SELECT rowid AS _rid, sort_order, last_play, enabled, created_by FROM routes WHERE prefix = ?" + globalScope).bind(isRename ? oldPrefix : prefix).first();
      if (isRename) {
        if (!existing)
          return json({ error: "\u539F\u8DEF\u7531\u4E0D\u5B58\u5728" }, 404);
        if ((existing.created_by || "") !== adminActor)
          return json({ error: "\u65E0\u6743\u4FEE\u6539\u5176\u4ED6\u7BA1\u7406\u5458\u6216\u5386\u53F2\u8DEF\u7531" }, 403);
        const clash = await env2.DB.prepare("SELECT 1 AS x FROM routes WHERE prefix = ?" + globalScope).bind(prefix).first();
        if (clash)
          return json({ error: "\u8DEF\u5F84 /" + prefix + " \u5DF2\u5B58\u5728" }, 409);
      } else if (oldPrefix) {
        if (!existing)
          return json({ error: "\u8DEF\u7531\u4E0D\u5B58\u5728" }, 404);
        if ((existing.created_by || "") !== adminActor)
          return json({ error: "\u65E0\u6743\u4FEE\u6539\u5176\u4ED6\u7BA1\u7406\u5458\u6216\u5386\u53F2\u8DEF\u7531" }, 403);
      } else if (existing) {
        if ((existing.created_by || "") === adminActor)
          return json({ error: "\u8DEF\u5F84 /" + prefix + " \u5DF2\u5B58\u5728\uFF0C\u8BF7\u76F4\u63A5\u7F16\u8F91\u5B83" }, 409);
        return json({ error: "\u8DEF\u5F84 /" + prefix + " \u5DF2\u88AB\u5176\u4ED6\u7BA1\u7406\u5458\u6216\u5386\u53F2\u8DEF\u7531\u5360\u7528" }, 409);
      }
      if (oldPrefix) {
        await env2.DB.prepare(`UPDATE routes SET prefix = ?, target = ?, stream_target = ?, remark = ?, cache_img = ?, compat_mode = ?, ip_mode = ?,
             custom_headers = ?, ip_allow = ?, ip_block = ?, created_by = ?
           WHERE rowid = ? AND created_by = ?`).bind(prefix, targets.join(","), streamTargets.join(","), String(data.remark || ""), data.cache_img === "off" ? "off" : "on", data.compat_mode === "on" ? "on" : "off", normalizeIpMode(data.ip_mode), String(data.custom_headers || "").trim(), allowList.join(","), blockList.join(","), adminActor, existing._rid, adminActor).run();
      } else {
        await env2.DB.prepare("INSERT INTO routes (prefix, target, stream_target, remark, cache_img, compat_mode, ip_mode, last_play, sort_order, enabled, custom_headers, ip_allow, ip_block, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(prefix, targets.join(","), streamTargets.join(","), String(data.remark || ""), data.cache_img === "off" ? "off" : "on", data.compat_mode === "on" ? "on" : "off", normalizeIpMode(data.ip_mode), "", 0, 1, String(data.custom_headers || "").trim(), allowList.join(","), blockList.join(","), adminActor).run();
      }
      clearRouteCache();
      await auditLog(env2, isRename ? "route.rename" : "route.save", "/" + (isRename ? oldPrefix + " \u2192 /" : "") + prefix);
      return json({ success: true });
    }
    if (request.method === "DELETE") {
      const prefix = url.searchParams.get("prefix");
      if (!prefix)
        return json({ error: "\u7F3A\u5C11 prefix \u53C2\u6570" }, 400);
      const p = normalizePrefix(prefix);
      const res = await env2.DB.prepare("DELETE FROM routes WHERE prefix = ? AND created_by = ?").bind(p, adminActor).run();
      if (!res.meta?.changes)
        return json({ error: "\u8DEF\u7531\u4E0D\u5B58\u5728\u6216\u65E0\u6743\u64CD\u4F5C" }, 404);
      clearRouteCache();
      try {
        await env2.DB.prepare("DELETE FROM route_health WHERE prefix = ?").bind(p).run();
      } catch (_) {
      }
      await auditLog(env2, "route.delete", "/" + p);
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
  if (url.pathname === "/admin/api/users") {
    if (request.method === "GET")
      return json({ success: true, users: await adminListUsers(env2) });
    if (request.method === "POST") {
      const data = await readJson(request) || {};
      const out = await adminCreateUser(env2, data, adminActor);
      return json(out, out.error ? 400 : 200);
    }
  }
  if (url.pathname.startsWith("/admin/api/users/")) {
    const id = parseInt(url.pathname.split("/").pop(), 10);
    if (!Number.isFinite(id))
      return json({ error: "id \u4E0D\u5408\u6CD5" }, 400);
    if (request.method === "PUT") {
      const data = await readJson(request) || {};
      const out = await adminUpdateUser(env2, id, data, adminActor);
      return json(out, out.error ? 400 : 200);
    }
    if (request.method === "DELETE") {
      const out = await adminDeleteUser(env2, id, adminActor);
      return json(out, out.error ? 404 : 200);
    }
  }
  if (url.pathname === "/admin/api/invites") {
    if (request.method === "GET")
      return json({ success: true, invites: await adminListInvites(env2) });
    if (request.method === "POST") {
      const data = await readJson(request) || {};
      const out = await adminCreateInvite(env2, data, adminActor);
      return json(out, out.error ? 400 : 200);
    }
  }
  if (url.pathname === "/admin/api/invites/clear" && request.method === "POST") {
    const out = await adminClearInvites(env2, adminActor);
    return json(out, out.error ? 400 : 200);
  }
  if (url.pathname.startsWith("/admin/api/invites/") && request.method === "DELETE") {
    const code = decodeURIComponent(url.pathname.split("/").pop() || "");
    const out = await adminDeleteInvite(env2, code, "admin");
    return json(out, out.error ? 404 : 200);
  }
  if (url.pathname === "/admin/api/db/reset" && request.method === "POST") {
    const data = await readJson(request) || {};
    const out = await adminResetData(env2, data, adminActor);
    return json(out, out.error ? 400 : 200);
  }
  return json({ error: "Not found" }, 404);
}
async function handleUserApi(request, env2, url, session) {
  if (!session)
    return json({ error: "Unauthorized" }, 401);
  if (!env2.DB)
    return json({ error: "D1 \u6570\u636E\u5E93\u672A\u7ED1\u5B9A" }, 500);
  if (request.method !== "GET" && request.method !== "HEAD") {
    const origin = request.headers.get("Origin");
    if (origin && origin !== url.origin)
      return json({ error: "Forbidden origin" }, 403);
  }
  if (url.pathname === "/api/user/me" && request.method === "GET") {
    const user = session.uid === ADMIN_UID ? null : await getUserById(env2, session.uid);
    const entryHost = user ? userEntryHost(env2, user) : "";
    let routeCount = 0;
    if (user)
      routeCount = await countUserRoutes(env2, user);
    const userDomain = getUserDomain(env2) || getBaseDomain(env2);
    return json({
      ok: true,
      user: user ? publicUser(user) : { id: 0, username: "admin", role: "admin", subdomain: "", routeLimit: 999, status: "active" },
      baseDomain: getBaseDomain(env2),
      userDomain,
      mainHost: getStatsHost(env2),
      entryHost,
      entryUrl: entryHost ? "https://" + entryHost : "",
      routeCount,
      routeLimit: user ? user.routeLimit || DEFAULT_USER_ROUTE_LIMIT : 999,
      workerRouteHint: "\u9700\u8981\u5728 Cloudflare \u7ED9 Worker \u6DFB\u52A0\u8DEF\u7531 " + (userDomain ? "*." + userDomain + "/*" : "*/*") + "\uFF0C\u5B50\u57DF\u540D\u8BF7\u6C42\u624D\u4F1A\u8FDB\u5165 Worker"
    });
  }
  if (url.pathname === "/api/user/routes") {
    if (request.method === "GET")
      return json(await userListRoutes(env2, session.username));
    if (request.method === "POST") {
      const data = await readJson(request) || {};
      const out = await userSaveRoute(env2, session.username, data);
      return json(out, out.error ? 400 : 200);
    }
    if (request.method === "DELETE") {
      const out = await userDeleteRoute(env2, session.username, url.searchParams.get("prefix"), url.searchParams.get("source"));
      return json(out, out.error ? 404 : 200);
    }
  }
  if (url.pathname === "/api/user/routes/toggle" && request.method === "POST") {
    const data = await readJson(request) || {};
    const p = normalizePrefix(data.prefix);
    if (!p)
      return json({ error: "\u7F3A\u5C11 prefix" }, 400);
    const enabled = data.enabled ? 1 : 0;
    const user = await getUserByUsername(env2, session.username);
    if (!user)
      return json({ error: "\u7528\u6237\u4E0D\u5B58\u5728" }, 404);
    let changes = 0;
    if (data.source === "legacy" && await routesHasUserId(env2)) {
      const res = await env2.DB.prepare("UPDATE routes SET enabled = ? WHERE user_id = ? AND prefix = ?").bind(enabled, user.id, p).run();
      changes = Number(res.meta?.changes) || 0;
    } else {
      const res = await env2.DB.prepare("UPDATE user_routes SET enabled = ? WHERE owner = ? AND prefix = ?").bind(enabled, session.username, p).run();
      changes = Number(res.meta?.changes) || 0;
      if (!changes && !data.source && await routesHasUserId(env2)) {
        const res2 = await env2.DB.prepare("UPDATE routes SET enabled = ? WHERE user_id = ? AND prefix = ?").bind(enabled, user.id, p).run();
        changes = Number(res2.meta?.changes) || 0;
      }
    }
    if (!changes)
      return json({ error: "\u8DEF\u7531\u4E0D\u5B58\u5728" }, 404);
    clearRouteCache();
    return json({ success: true });
  }
  if (url.pathname === "/api/user/routes/reorder" && request.method === "POST") {
    const data = await readJson(request) || {};
    const order = Array.isArray(data.order) ? data.order.map(normalizePrefix).filter(Boolean) : [];
    if (!order.length)
      return json({ error: "\u7F3A\u5C11 order" }, 400);
    const user = await getUserByUsername(env2, session.username);
    const hasLegacy = user && await routesHasUserId(env2);
    const jobs = [];
    order.forEach((pf, i) => {
      jobs.push(env2.DB.prepare("UPDATE user_routes SET sort_order = ? WHERE owner = ? AND prefix = ?").bind(i, session.username, pf));
      if (hasLegacy)
        jobs.push(env2.DB.prepare("UPDATE routes SET sort_order = ? WHERE user_id = ? AND prefix = ?").bind(i, user.id, pf));
    });
    await env2.DB.batch(jobs);
    clearRouteCache();
    return json({ success: true });
  }
  if (url.pathname === "/api/user/routes/test" && request.method === "POST") {
    const data = await readJson(request) || {};
    const p = normalizePrefix(data.prefix);
    if (!p)
      return json({ error: "\u7F3A\u5C11 prefix" }, 400);
    let route = await env2.DB.prepare("SELECT target FROM user_routes WHERE owner = ? AND prefix = ?").bind(session.username, p).first();
    if (!route) {
      const user = await getUserByUsername(env2, session.username);
      if (user && await routesHasUserId(env2)) {
        route = await env2.DB.prepare("SELECT target FROM routes WHERE user_id = ? AND prefix = ? ORDER BY rowid LIMIT 1").bind(user.id, p).first();
      }
    }
    if (!route)
      return json({ error: "\u8DEF\u7531\u4E0D\u5B58\u5728" }, 404);
    const targets = splitTargets(route.target);
    const results = await Promise.all(targets.map(async (t) => ({ target: t, ...await probeTarget(t) })));
    return json({ success: true, results });
  }
  if (url.pathname === "/api/user/stats" && request.method === "GET") {
    return handleStatsRequest(env2, url, { owner: session.username });
  }
  if (url.pathname === "/api/user/dns") {
    if (request.method === "GET") {
      const out = await userDnsInfo(env2, session);
      return json(out, out.error ? 400 : 200);
    }
    if (request.method === "POST") {
      const data = await readJson(request) || {};
      const target = String(data.target || "").trim();
      const out = target ? await userUpdateDns(env2, session, target) : await userEnsureDNS(env2, session);
      return json(out, out.error ? 400 : 200);
    }
  }
  if (url.pathname === "/api/user/password" && request.method === "POST") {
    return changePassword(request, env2, session);
  }
  if (url.pathname === "/api/user/logout" && request.method === "POST")
    return logoutResponse();
  return json({ error: "Not found" }, 404);
}

// src/editions/multi/proxy/state.js
var fallbackLogAt = /* @__PURE__ */ new Map();
function fallbackLogThrottled(key) {
  const now = Date.now();
  if (now - (fallbackLogAt.get(key) || 0) < FALLBACK_LOG_MS)
    return true;
  fallbackLogAt.set(key, now);
  while (fallbackLogAt.size > 512) fallbackLogAt.delete(fallbackLogAt.keys().next().value);
  return false;
}
var hostDownUntil = /* @__PURE__ */ new Map();
var relayPreferences = /* @__PURE__ */ new Map();
var lastPlayTouched = /* @__PURE__ */ new Map();
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

// src/editions/multi/http/responses.js
function applySecurityHeaders(headers) {
  for (const [k, v] of Object.entries(SECURITY_HEADERS))
    headers.set(k, v);
  if (XFO_CURRENT) headers.set("X-Frame-Options", XFO_CURRENT);
  else headers.delete("X-Frame-Options");
  return headers;
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

// src/shared/proxy/json-rewrite.js
var MAX_METADATA_BYTES = 1024 * 1024;
var METADATA_READ_MS = 5e3;
var MAX_METADATA_READERS = 4;
var activeReaders = 0;
async function rewriteJsonResponse(response, rewrite, options) {
  if (activeReaders >= MAX_METADATA_READERS) return response;
  activeReaders++;
  try {
    return await rewriteBoundedJsonResponse(response, rewrite, options);
  } finally {
    activeReaders--;
  }
}
async function rewriteBoundedJsonResponse(response, rewrite, { limit = MAX_METADATA_BYTES, timeoutMs = METADATA_READ_MS } = {}) {
  const encoding = response.headers.get("Content-Encoding");
  const declared = response.headers.get("Content-Length");
  if (!response.body || encoding && encoding !== "identity" || /^\d+$/.test(declared || "") && Number(declared) > limit) return response;
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  const deadline = Date.now() + timeoutMs;
  try {
    while (true) {
      let timer;
      let part;
      try {
        part = await Promise.race([
          reader.read(),
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error("Metadata read timed out")), Math.max(1, deadline - Date.now()));
          })
        ]);
      } finally {
        clearTimeout(timer);
      }
      if (part.done) break;
      chunks.push(part.value);
      total += part.value.byteLength;
      if (total > limit) {
        const headers = sanitizeResponseHeaders(response.headers);
        headers.delete("Content-Length");
        return new Response(streamFromReader(reader, chunks), { status: response.status, statusText: response.statusText, headers });
      }
    }
    reader.releaseLock();
  } catch {
    void reader.cancel().catch(() => {
    });
    reader.releaseLock();
    return new Response("Upstream metadata unavailable", { status: 502, headers: { "Cache-Control": "no-store" } });
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const data = JSON.parse(new TextDecoder().decode(bytes));
    if (rewrite(data)) {
      const headers = sanitizeResponseHeaders(response.headers);
      for (const name of ["Content-Length", "Content-Encoding", "ETag", "Content-MD5", "Digest"]) headers.delete(name);
      headers.set("Content-Type", "application/json; charset=utf-8");
      headers.set("Cache-Control", "no-store");
      return new Response(JSON.stringify(data), { status: response.status, statusText: response.statusText, headers });
    }
  } catch {
  }
  return new Response(bytes, { status: response.status, statusText: response.statusText, headers: response.headers });
}

// src/editions/multi/relay/mode.js
var relayAccessDeniedStatus = (status) => [401, 403, 451].includes(status);
var relayFallbackStatus = (status) => relayAccessDeniedStatus(status) || [502, 503, 504, 520, 521, 522, 523, 524, 525, 526, 527, 530].includes(status);
var relayPostEndpoint = (method, target) => method === "POST" && /\/(?:Users\/(?:AuthenticateByName|AuthenticateWithQuickConnect)|Items\/[^/]+\/PlaybackInfo)\/?$/i.test(target.pathname);
function relayRetryAllowed(method, target, status, replayable = false) {
  if (method === "GET" || method === "HEAD") return status === "transport" || relayFallbackStatus(status);
  return method === "POST" && replayable && relayAccessDeniedStatus(status) && relayPostEndpoint(method, target);
}
var relayResponseUsable = (response) => response.status < 500 && response.status !== 429 && !relayAccessDeniedStatus(response.status) && !response.headers.has("X-Relay-Denied");

// src/editions/multi/relay/preference.js
var RELAY_PREFERENCE_MS = 12e4;
var RELAY_RECOVERY_LEASE_MS = 1e4;
var MAX_RELAY_PREFERENCES = 512;
function relayPreferenceKey(request, target, route, owner = "") {
  return JSON.stringify([
    circuitKey(request, target, route, owner),
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

// src/editions/multi/proxy/pipeline.js
async function proxyDirectUrl(request, env2, ctx, upstreamUrls, opts = {}) {
  const { enableCache = true, compatMode = false, clientIpMode = "forward", matchedPrefix = null, statPrefix = null, routeOwner = "", legacyUserId = 0, customHeaders = [], streamTargets = [], streamProxyPath = "", isStreamRequest = false, streamReferrer = "" } = opts;
  const ipMode = normalizeIpMode(clientIpMode);
  const redirectMode = compatMode && !streamTargets.length ? "follow" : "manual";
  const makeUpstreamHeaders = (target) => {
    let crossOrigin = isStreamRequest;
    try {
      if (streamReferrer && new URL(streamReferrer).origin === target.origin)
        crossOrigin = false;
    } catch {
    }
    const headers = buildUpstreamHeaders(request, target, { ipMode, compatMode, crossOrigin });
    if (isStreamRequest && streamReferrer)
      headers.set("Referer", streamReferrer);
    for (const [k, v] of customHeaders)
      headers.set(k, v);
    return headers;
  };
  const settings = await getSettings(env2);
  if (!upstreamUrls.length)
    return new Response("404: Target empty", { status: 404 });
  let firstUpstreamUrl;
  try {
    firstUpstreamUrl = new URL(upstreamUrls[0]);
  } catch {
    return new Response("Invalid upstream URL", { status: 500 });
  }
  const pathname = firstUpstreamUrl.pathname;
  const reqCategory = isStreamRequest ? "streaming" : classifyRequest(pathname, request.method);
  const isPlaybackInfo = reqCategory === "playback_info";
  const isPlaying = reqCategory === "playing";
  const isPlayStart = isPlaying && /\/Sessions\/Playing\/?$/i.test(pathname);
  if (!["streaming", "segment", "image", "static"].includes(reqCategory) && rateLimited(request.headers.get("cf-connecting-ip") || "unknown", settings.rateLimitPerMin)) {
    return new Response("429: Too Many Requests", { status: 429, headers: { "Retry-After": "30" } });
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
      const lastPlayKey = (routeOwner ? routeOwner + "/" : "") + matchedPrefix;
      const lt = lastPlayTouched.get(lastPlayKey) || 0;
      if (nowTs - lt > LAST_PLAY_THROTTLE_MS) {
        lastPlayTouched.set(lastPlayKey, nowTs);
        const nowTime = new Date(nowTs + 8 * 36e5).toISOString().replace("T", " ").split(".")[0];
        let lastPlaySql, lastPlayArgs;
        if (legacyUserId) {
          lastPlaySql = "UPDATE routes SET last_play = ? WHERE user_id = ? AND prefix = ?";
          lastPlayArgs = [nowTime, legacyUserId, matchedPrefix];
        } else if (routeOwner) {
          lastPlaySql = "UPDATE user_routes SET last_play = ? WHERE owner = ? AND prefix = ?";
          lastPlayArgs = [nowTime, routeOwner, matchedPrefix];
        } else {
          lastPlaySql = "UPDATE routes SET last_play = ? WHERE prefix = ?";
          lastPlayArgs = [nowTime, matchedPrefix];
        }
        ctx.waitUntil(env2.DB.prepare(lastPlaySql).bind(...lastPlayArgs).run().catch(() => {
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
  const relay = getRelayCfg(settings);
  const budget = createFetchBudget(request);
  let bodyPlan = null;
  let relayAttempted = false;
  let usingAutoRelay = false;
  let relayFallbackUsed = false;
  const preferenceKey = (target) => relayPreferenceKey(request, target, matchedPrefix, routeOwner || String(legacyUserId || ""));
  async function fetchThroughRelay(target, init) {
    const relayUrl = new URL(target.pathname + target.search, relay.base);
    const headers = new Headers(init.headers);
    for (const [name, value] of Object.entries(await relayFetchHeaders(relay.secret, target.href))) headers.set(name, value);
    return budget.fetch(new Request(relayUrl, { ...init, headers, redirect: "manual", signal: request.signal }));
  }
  function acceptedRelay(target, init, response, reason) {
    usingAutoRelay = true;
    relayFallbackUsed = true;
    if (reason !== "preferred" && response.status < 400) markRelayPreferred(relayPreferences, preferenceKey(target));
    if (!fallbackLogThrottled((statPrefix || matchedPrefix || "direct") + "|relay")) {
      ctx.waitUntil(auditLog(
        env2,
        reason === "transport" ? "relay.fallback.err" : "relay.fallback",
        `${statPrefix || matchedPrefix || "direct"} ${init.method} category=${reqCategory} reason=${reason}`
      ));
    }
    return response;
  }
  async function tryRelay(target, init, reason) {
    if (!relay || relayAttempted || request.signal.aborted || !relayRetryAllowed(init.method, target, reason, bodyPlan?.replayable)) return null;
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
    if (usingAutoRelay) return fetchThroughRelay(target, init);
    const key = relay ? preferenceKey(target) : null;
    const preference = relay && !relayAttempted ? getRelayPreference(relayPreferences, key, init.method) : { useRelay: false, probe: null };
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
  const upgradeHeader = request.headers.get("Upgrade");
  if (upgradeHeader?.toLowerCase() === "websocket") {
    const wsHeaders = makeUpstreamHeaders(firstUpstreamUrl);
    wsHeaders.set("Upgrade", "websocket");
    wsHeaders.set("Connection", "Upgrade");
    return fetchUpstream(firstUpstreamUrl, { method: request.method, headers: wsHeaders, redirect: "manual", signal: request.signal });
  }
  const canUseCache = enableCache && !isStreamRequest && isCacheableRequest(reqCategory) && request.method === "GET" && !request.headers.has("Range") && !hasPrivateRequestState(request);
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
    bufferUnknown: !!relay && relayPostEndpoint(request.method, firstUpstreamUrl)
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
    const healthKey = circuitKey(request, upstreamUrl, matchedPrefix, routeOwner || String(legacyUserId || ""));
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
    const headers = makeUpstreamHeaders(upstreamUrl);
    if (isPlaybackInfo && streamTargets.length) headers.set("Accept-Encoding", "identity");
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
      if (retryable && redirectMode === "manual" && UPSTREAM_FAILOVER_STATUSES.includes(response.status)) {
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
        return new Response("Client closed request", { status: 499 });
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
    return new Response("Client closed request", { status: 499 });
  }
  if (fallbackResponse && finalResponse && fallbackResponse !== finalResponse) discardResponse(fallbackResponse);
  if (!finalResponse && fallbackResponse) {
    finalResponse = fallbackResponse;
    lastUpstreamUrl = null;
  }
  if (!finalResponse) {
    return new Response("\u6240\u6709\u7EBF\u8DEF\u4E0D\u53EF\u7528\uFF0C\u8BF7\u68C0\u67E5\u7EBF\u8DEF\u914D\u7F6E\u6216\u7A0D\u540E\u91CD\u8BD5", { status: 502 });
  }
  if (lastUpstreamUrl) {
    try {
      const followed = await followUpstreamRedirects(finalResponse, lastUpstreamUrl, {
        request,
        bodyPlan,
        signalFor: timeoutSignal,
        fetcher: (next) => fetchUpstream(new URL(next.url), { method: next.method, headers: next.headers, redirect: "manual", body: next.body, duplex: "half", signal: next.signal }),
        headersFor: (target, crossOrigin) => buildUpstreamHeaders(request, target, { ipMode, compatMode, crossOrigin: crossOrigin || isStreamRequest }),
        clientLocation: (target) => {
          const mapped = getStreamProxyLocation(request, target, streamTargets, streamProxyPath);
          if (mapped) {
            if (usingAutoRelay) markRelayPreferred(relayPreferences, preferenceKey(target));
            if (!fallbackLogThrottled((statPrefix || matchedPrefix || "direct") + "|stream.redirect")) {
              ctx.waitUntil(auditLog(env2, "stream.redirect", `${statPrefix || matchedPrefix || "direct"} ${request.method} mapped_stream`));
            }
            return mapped;
          }
          return !usingAutoRelay && redirectMode === "manual" && MANUAL_REDIRECT_DOMAINS.concat(settings.manualDomains).some((domain) => target.hostname === domain || target.hostname.endsWith("." + domain)) ? target.href : null;
        }
      });
      finalResponse = followed.response;
    } catch (error) {
      return new Response(request.signal.aborted ? "Client closed request" : "Upstream redirect failed", { status: request.signal.aborted ? 499 : 502 });
    }
  }
  if (isPlaybackInfo && streamTargets.length && finalResponse.status === 200 && request.method !== "HEAD") {
    finalResponse = await rewriteJsonResponse(finalResponse, (data) => rewritePlaybackStreamUrls(
      data,
      request,
      streamTargets,
      streamProxyPath,
      lastUpstreamUrl || firstUpstreamUrl,
      usingAutoRelay ? (target) => markRelayPreferred(relayPreferences, preferenceKey(target)) : void 0
    ));
  }
  const responseHeaders = sanitizeResponseHeaders(finalResponse.headers);
  responseHeaders.set("Access-Control-Allow-Origin", "*");
  responseHeaders.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  responseHeaders.set("Access-Control-Allow-Headers", "*");
  applySecurityHeaders(responseHeaders);
  if (relayFallbackUsed)
    responseHeaders.set("X-Relay-Fallback", "1");
  if (isPlaying || isPlaybackInfo) {
    responseHeaders.set("X-Served-By", request.cf?.colo || "Unknown");
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

// src/editions/multi/entry.js
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
    if (url.pathname === "/")
      return html(buildFrontendHtml(env2));
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
      if (request.headers.get("Origin") && request.headers.get("Origin") !== url.origin) return json({ ok: false, error: "Forbidden origin" }, 403);
      try {
        const body = await readJson(request) || {};
        return adminLoginResponse(request, env2, body);
      } catch (e) {
        return json({ ok: false, error: e.message }, 400);
      }
    }
    if (url.pathname === "/api/register" && request.method === "POST") {
      if (request.headers.get("Origin") && request.headers.get("Origin") !== url.origin) return json({ ok: false, error: "Forbidden origin" }, 403);
      try {
        return await handleRegister(request, env2);
      } catch (e) {
        return json({ ok: false, error: "\u6CE8\u518C\u5931\u8D25: " + String(e?.message || e).slice(0, 160) }, 500);
      }
    }
    if (url.pathname === "/api/logout" && request.method === "POST") {
      if (request.headers.get("Origin") && request.headers.get("Origin") !== url.origin) return json({ ok: false, error: "Forbidden origin" }, 403);
      return logoutResponse();
    }
    if (url.pathname === "/register" || url.pathname === "/register/") {
      const res = html(buildRegisterHtml(env2));
      res.headers.set("X-Robots-Tag", "noindex, nofollow");
      return res;
    }
    if (url.pathname === "/login") {
      return Response.redirect(url.origin + "/admin", 302);
    }
    if (url.pathname === "/robots.txt") {
      return new Response("User-agent: *\nDisallow: /\n", { headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
    if (url.pathname === "/admin" || url.pathname === "/admin/") {
      const session = await getSession(request, env2);
      const page = session ? buildAdminHtml(session, env2) : buildLoginHtml();
      const res = html(page);
      res.headers.set("X-Robots-Tag", "noindex, nofollow");
      return res;
    }
    if (url.pathname.startsWith("/admin/api/")) {
      const session = await getSession(request, env2);
      if (!session || !session.isAdmin)
        return new Response("Unauthorized", { status: 401 });
      if (!env2.DB)
        return json({ error: "DB \u672A\u7ED1\u5B9A" }, 500);
      try {
        return await handleAdminApi(request, env2, url, session);
      } catch (e) {
        return json({ error: "\u670D\u52A1\u5668\u5185\u90E8\u9519\u8BEF: " + String(e?.message || e).slice(0, 200) }, 500);
      }
    }
    if (url.pathname.startsWith("/api/user/")) {
      if (!env2.DB)
        return json({ error: "DB \u672A\u7ED1\u5B9A" }, 500);
      const session = await getSession(request, env2);
      if (!session)
        return json({ error: "Unauthorized" }, 401);
      try {
        return await handleUserApi(request, env2, url, session);
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
        return new Response("Invalid proxy format", { status: 400 });
      path = path.replace(/^(https?)\/(?!\/)/, "$1://");
      if (!path.startsWith("http"))
        path = "https://" + path;
      try {
        const upstreamUrl = new URL(path);
        if (upstreamUrl.protocol !== "http:" && upstreamUrl.protocol !== "https:") {
          return new Response("Invalid URL format", { status: 400 });
        }
        if (!directProxyAllowed(env2, upstreamUrl.hostname)) {
          return new Response("Forbidden: direct proxy target not allowed", { status: 403 });
        }
        upstreamUrl.search = url.search;
        return proxyDirectUrl(request, env2, ctx, [upstreamUrl.toString()], { enableCache: true });
      } catch {
        return new Response("Invalid URL format", { status: 400 });
      }
    }
    if (!env2.DB) {
      return new Response("D1 \u6570\u636E\u5E93\u672A\u7ED1\u5B9A\uFF0C\u8DEF\u7531\u53CD\u4EE3\u4E0D\u53EF\u7528\u3002\u4ECD\u53EF\u4F7F\u7528 /https://... \u683C\u5F0F\u3002", { status: 500 });
    }
    const resolved = await resolveProxyTarget(request, env2, url);
    if (resolved.error)
      return resolved.error;
    return proxyDirectUrl(request, env2, ctx, resolved.upstreamUrls, {
      enableCache: resolved.enableCache,
      compatMode: resolved.compatMode,
      clientIpMode: resolved.clientIpMode,
      matchedPrefix: resolved.matchedPrefix,
      statPrefix: resolved.statPrefix,
      routeOwner: resolved.routeOwner,
      legacyUserId: resolved.legacyUserId,
      customHeaders: resolved.customHeaders,
      streamTargets: resolved.streamTargets,
      streamProxyPath: resolved.streamProxyPath,
      isStreamRequest: resolved.isStreamRequest,
      streamReferrer: resolved.streamReferrer
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

// src/multi.js
var multi_default = createApplication({ edition: "multi", handler: entry_default });
export {
  multi_default as default
};
