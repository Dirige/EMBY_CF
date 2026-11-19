// Baseline: 4e0357e. Edition-specific behavior is intentionally retained.


var DEFAULT_OPTIMIZED_DOMAINS = [
    { domain: "youxuan.cf.090227.xyz", name: "CF优选-090227", isBuiltin: true },
    { domain: "cf.877774.xyz", name: "秋名山优选", isBuiltin: true },
    { domain: "cf.cf.cnae.top", name: "NB优选", isBuiltin: true },
    { domain: "saas.sin.fan", name: "MIYU优选", isBuiltin: true },
    { domain: "bestcf.030101.xyz", name: "Mingyu优选", isBuiltin: true },
    { domain: "cf.cloudflare.182682.xyz", name: "WeTest优选", isBuiltin: true },
    { domain: "cf.tencentapp.cn", name: "无名氏维护域名", isBuiltin: true },
    { domain: "mfa.gov.ua", name: "乌克兰外交部", isBuiltin: true },
    { domain: "www.shopify.com", name: "Shopify官方", isBuiltin: true },
    { domain: "store.ubi.com", name: "育碧商店", isBuiltin: true },
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
    streaming: /\.(?:mp4|m4v|m4a|ogv|webm|mkv|mov|avi|wmv|flv)$/i
});

var PROGRESS_THROTTLE_MS = 3e4;

var PROGRESS_MAP_MAX = 1e4;

var CORS_JSON = { "Content-Type": "application/json; charset=utf-8" };

function classifyRequest(pathname, method) {
    if (REQUEST_PATTERNS.embyImages.test(pathname))
        return "image";
    if (REQUEST_PATTERNS.manifestExt.test(pathname))
        return "manifest";
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

export { DEFAULT_OPTIMIZED_DOMAINS, RESERVED_ALIASES, DOMAIN_PROXY_RULES, JP_COLOS, SECURITY_HEADERS, DROP_REQUEST_HEADERS, CLIENT_IDENTITY_HEADERS, IP_MODES, normalizeIpMode, stripClientIdentityHeaders, DROP_RESPONSE_HEADERS, REQUEST_PATTERNS, PROGRESS_THROTTLE_MS, PROGRESS_MAP_MAX, CORS_JSON, classifyRequest, isCacheableRequest, formatBytes, getShanghaiParts, getResponseBytes, toGraphQLStr };
