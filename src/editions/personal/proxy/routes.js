// Baseline: 4e0357e. Edition-specific behavior is intentionally retained.
import { ROUTE_CACHE_TTL, normalizePrefix, splitTargets } from "./../../../shared/admin/api.js";
import { errResponse } from "./../http/responses.js";
import { ipMatches, parseHeaderLines, parseIpList } from "./../../../shared/http/validation.js";
import { normalizeIpMode } from "./../../../shared/http/primitives.js";
import { normalizeRelayMode } from '../relay/mode.js';

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
    }
    catch {
        return { error: errResponse("Bad Request", 400) };
    }
    const prefix = normalizePrefix(firstSeg);
    if (!prefix)
        return { error: errResponse("Not Found", 404) };
    const route = await getRoute(env2, prefix);
    if (!route)
        return { error: errResponse("404: 节点不存在", 404) };
    if (route.enabled === 0)
        return { error: errResponse("503: 该路由已停用", 503) };
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
        }
        catch {
            upstreamUrls.push(target.replace(/\/+$/, "") + rest + url.search);
        }
    }
    return { upstreamUrls, enableCache, compatMode, clientIpMode: normalizeIpMode(route.ip_mode), matchedPrefix: route.prefix, customHeaders: parseHeaderLines(route.custom_headers).headers, relayMode: normalizeRelayMode(route.use_relay, 'off') };
}

export { routeCache, clearRouteCache, getRoute, resolveProxyTarget };
