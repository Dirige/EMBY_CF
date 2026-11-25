// Baseline: 4e0357e. Edition-specific behavior is intentionally retained.


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
        }
        catch (_) {
        }
        return { ok: res.status < 500, status: res.status, ms: Date.now() - start };
    }
    catch (e) {
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
            error3 = "自定义请求头格式应为 Name: Value，每行一个";
            break;
        }
        const k = t.slice(0, i).trim();
        const v = t.slice(i + 1).trim();
        if (!/^[A-Za-z0-9-]+$/.test(k)) {
            error3 = "请求头名称不合法: " + k;
            break;
        }
        if (FORBIDDEN_CUSTOM_HEADERS.has(k.toLowerCase())) {
            error3 = "不允许覆盖请求头: " + k;
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
    }
    catch (_) {
    }
    const res = await producer();
    try {
        const copy = new Response(res.clone().body, res);
        copy.headers.set("Cache-Control", "public, max-age=" + ttlSec);
        await cache.put(ck, copy);
    }
    catch (_) {
    }
    return res;
}

function isPrivateHost(h) {
    h = String(h || "").toLowerCase().replace(/^\[|\]$/g, "").replace(/\.+$/, '');
    const mapped = h.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (mapped) {
        const high = parseInt(mapped[1], 16), low = parseInt(mapped[2], 16);
        return isPrivateHost(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`);
    }
    if (h.startsWith('::ffff:') && h.slice(7).includes('.')) return isPrivateHost(h.slice(7));
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
    // Registered routes are the default. A raw-URL proxy requires both an
    // explicit opt-in and an allowlist; never publish an open forward proxy.
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
    }
    catch {
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

export { probeTarget, FORBIDDEN_CUSTOM_HEADERS, parseHeaderLines, parseIpList, ipv4ToInt, ipMatches, validIpList, cachedJson, isPrivateHost, directProxyAllowed, isValidHttpUrl, getClientCacheKey };
