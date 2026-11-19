// Baseline: 4e0357e. Edition-specific behavior is intentionally retained.
import { ROUTE_CACHE_TTL, normalizePrefix, splitTargets } from "./../../../shared/admin/api.js";
import { RESERVED_PREFIXES, RESERVED_SUBDOMAINS } from "./../storage/schema.js";
import { getBaseDomain, getDnsRecordName, toFqdn } from "./../../../shared/auth/session.js";
import { getStatsHost, getUserDomain } from "./../integrations/zone.js";
import { routesHasUserId } from "./../users/routes.js";
import { getUserByUsername } from "./../auth/session.js";
import { ipMatches, parseHeaderLines, parseIpList } from "./../../../shared/http/validation.js";
import { getStreamTargetParts } from "./stream-targets.js";
import { normalizeIpMode } from "./../../../shared/http/primitives.js";

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
    const lookupOwner = /* @__PURE__ */ async (name) => {
        if (!env2.DB)
            return "";
        try {
            const row = await env2.DB.prepare("SELECT username FROM users WHERE (subdomain = ? OR username = ?) AND status = 'active'").bind(name, name).first();
            return row && row.username ? row.username : "";
        }
        catch (_) {
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
    }
    else {
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
        }
        else {
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
    }
    catch {
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
            }
            catch {
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
        }
        catch {
        }
    }
    else {
        // 播放仍先请求界面/API 服务器；真实推流路径由其 Location 或 PlaybackInfo 给出。
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

export { validateUserPrefix, ownerCache, clearOwnerCache, resolveOwnerFromHost, routeCache, clearRouteCache, getRouteCached, resolveProxyTarget };
