// Baseline: 4e0357e. Edition-specific behavior is intentionally retained.
import { runScheduled } from "./maintenance.js";
import { initDatabase } from "./storage/schema.js";
import { adminLoginResponse, isAdmin } from "./auth/session.js";
import { html, json } from "./../../shared/http/responses.js";
import { buildAdminHtml, buildFrontendHtml } from "./../../../web/personal/pages.js";
import { CURRENT_VERSION } from "./version.js";
import { cachedJson, directProxyAllowed } from "./../../shared/http/validation.js";
import { handleStatsRequest } from "./integrations/stats.js";
import { getEdgeInfo } from "./../../shared/integrations/stats.js";
import { DEFAULT_OPTIMIZED_DOMAINS } from "./../../shared/http/primitives.js";
import { getOptimizedDomains } from "./../../shared/integrations/dns.js";
import { getBaseDomain, getDnsRecordName } from "./../../shared/auth/session.js";
import { handleAdminApi } from "./admin/api.js";
import { errResponse } from "./http/responses.js";
import { proxyDirectUrl } from "./proxy/pipeline.js";
import { resolveProxyTarget } from "./proxy/routes.js";
import { getRelayConfig } from "./relay/protocol.js";

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
            }
            catch (_) {
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
            return json({ status: "ok", version: CURRENT_VERSION, colo: request.cf?.colo, timestamp: ( /* @__PURE__ */new Date()).toISOString() });
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
            try {
                const body = await request.json();
                return adminLoginResponse(request, env2, String(body.token || "").trim());
            }
            catch (e) {
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
                return json({ error: "DB 未绑定" }, 500);
            try {
                return await handleAdminApi(request, env2, url);
            }
            catch (e) {
                return json({ error: "服务器内部错误: " + String(e?.message || e).slice(0, 200) }, 500);
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
            }
            catch {
                return errResponse("Invalid URL format", 400);
            }
        }
        if (!env2.DB) {
            return errResponse("D1 数据库未绑定，路由反代不可用。仍可使用 /https://... 格式。", 500);
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

export { worker_default };
export default worker_default;
