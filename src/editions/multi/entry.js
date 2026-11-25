// Baseline: 4e0357e. Edition-specific behavior is intentionally retained.
import { runScheduled } from "./maintenance.js";
import { initDatabase } from "./storage/schema.js";
import { html, json } from "./../../shared/http/responses.js";
import { buildAdminHtml, buildFrontendHtml, buildLoginHtml, buildRegisterHtml } from "./../../../web/multi/pages.js";
import { CURRENT_VERSION } from "./version.js";
import { cachedJson, directProxyAllowed } from "./../../shared/http/validation.js";
import { handleStatsRequest } from "./integrations/stats.js";
import { getEdgeInfo } from "./../../shared/integrations/stats.js";
import { DEFAULT_OPTIMIZED_DOMAINS } from "./../../shared/http/primitives.js";
import { getOptimizedDomains } from "./../../shared/integrations/dns.js";
import { getBaseDomain, getDnsRecordName, logoutResponse } from "./../../shared/auth/session.js";
import { readJson } from "./../../shared/admin/api.js";
import { adminLoginResponse, getSession, handleRegister } from "./auth/session.js";
import { handleAdminApi, handleUserApi } from "./admin/api.js";
import { proxyDirectUrl } from "./proxy/pipeline.js";
import { resolveProxyTarget } from "./proxy/routes.js";

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
        if (url.pathname === "/")
            return html(buildFrontendHtml(env2));
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
            if (request.headers.get('Origin') && request.headers.get('Origin') !== url.origin) return json({ ok: false, error: 'Forbidden origin' }, 403);
            try {
                const body = await readJson(request) || {};
                return adminLoginResponse(request, env2, body);
            }
            catch (e) {
                return json({ ok: false, error: e.message }, 400);
            }
        }
        if (url.pathname === "/api/register" && request.method === "POST") {
            if (request.headers.get('Origin') && request.headers.get('Origin') !== url.origin) return json({ ok: false, error: 'Forbidden origin' }, 403);
            try {
                return await handleRegister(request, env2);
            }
            catch (e) {
                return json({ ok: false, error: "\u6CE8\u518C\u5931\u8D25: " + String(e?.message || e).slice(0, 160) }, 500);
            }
        }
        if (url.pathname === "/api/logout" && request.method === "POST") {
            if (request.headers.get('Origin') && request.headers.get('Origin') !== url.origin) return json({ ok: false, error: 'Forbidden origin' }, 403);
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
            }
            catch (e) {
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
            }
            catch (e) {
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
            }
            catch {
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

export { worker_default };
export default worker_default;
