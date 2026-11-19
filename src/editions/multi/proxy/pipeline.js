// Baseline: 4e0357e. Edition-specific behavior is intentionally retained.
import { JP_COLOS, PROGRESS_MAP_MAX, PROGRESS_THROTTLE_MS, classifyRequest, getResponseBytes, isCacheableRequest, normalizeIpMode, stripClientIdentityHeaders } from "./../../../shared/http/primitives.js";
import { API_TIMEOUT_MS, HOST_DOWN_MS, LAST_PLAY_THROTTLE_MS, SENSITIVE_REQ_HEADERS, buildUpstreamHeaders, progressKeyOf } from "./../../../shared/proxy/pipeline.js";
import { getSettings } from "./../config/settings.js";
import { CONFIG, fallbackLogThrottled, hostDownUntil, lastPlayTouched, progressMap, rateLimited } from "./state.js";
import { getRelayCfg, relayFetchHeaders } from "./../relay/protocol.js";
import { applySecurityHeaders } from "./../http/responses.js";
import { CF_ORIGIN_ERROR_STATUSES, UPSTREAM_FAILOVER_STATUSES } from "./../storage/schema.js";
import { auditLog } from "./../../../shared/observability/audit.js";
import { getStreamProxyLocation, rewritePlaybackStreamUrls } from "./stream-targets.js";
import { sanitizeResponseHeaders } from "./../../../shared/http/responses.js";
import { MANUAL_REDIRECT_DOMAINS } from "./../../../shared/rules/netdisk.js";
import { isPrivateHost } from "./../../../shared/http/validation.js";

async function proxyDirectUrl(request, env2, ctx, upstreamUrls, opts = {}) {
    const { enableCache = true, compatMode = false, clientIpMode = "forward", matchedPrefix = null, statPrefix = null, routeOwner = "", legacyUserId = 0, customHeaders = [], streamTargets = [], streamProxyPath = "", isStreamRequest = false, streamReferrer = "" } = opts;
    const ipMode = normalizeIpMode(clientIpMode);
    // 显式填写推流地址时必须看到 302，不能让兼容模式提前吞掉跳转。
    const redirectMode = compatMode && !streamTargets.length ? "follow" : "manual";
    const makeUpstreamHeaders = (target) => {
        let crossOrigin = isStreamRequest;
        try {
            if (streamReferrer && new URL(streamReferrer).origin === target.origin)
                crossOrigin = false;
        }
        catch {
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
    }
    catch {
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
        if (now - last < PROGRESS_THROTTLE_MS) {
            return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
        }
        progressMap.set(progressKey, now);
        if (progressMap.size > PROGRESS_MAP_MAX) {
            const cutoff = now - 6e4;
            for (const [k, v] of progressMap) {
                if (v < cutoff)
                    progressMap.delete(k);
                if (progressMap.size <= PROGRESS_MAP_MAX / 2)
                    break;
            }
        }
    }
    const recordStats = /* @__PURE__ */ (bytes) => {
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
                }
                else if (routeOwner) {
                    lastPlaySql = "UPDATE user_routes SET last_play = ? WHERE owner = ? AND prefix = ?";
                    lastPlayArgs = [nowTime, routeOwner, matchedPrefix];
                }
                else {
                    lastPlaySql = "UPDATE routes SET last_play = ? WHERE prefix = ?";
                    lastPlayArgs = [nowTime, matchedPrefix];
                }
                ctx.waitUntil(env2.DB.prepare(lastPlaySql).bind(...lastPlayArgs).run().catch(() => {
                }));
            }
        }
    };
    const meterBody = /* @__PURE__ */ (response) => {
        if (!response.body) {
            recordStats(0);
            return null;
        }
        recordStats(0);
        return response.body;
    };
    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader?.toLowerCase() === "websocket") {
        const relayWs = getRelayCfg(settings);
        const wsFetchRelay = /* @__PURE__ */ async (target, wsHeaders2) => {
            const rUrl = new URL(target.pathname + target.search, relayWs.base);
            const h = new Headers(wsHeaders2);
            const signHeaders = await relayFetchHeaders(relayWs.secret, target.toString());
            for (const [k, v] of Object.entries(signHeaders))
                h.set(k, v);
            return fetch(new Request(rUrl.toString(), { method: request.method, headers: h, redirect: "manual" }));
        };
        if (ipMode === "forward") {
            try {
                return await fetch(upstreamUrls[0], request);
            }
            catch (err) {
                if (relayWs) {
                    try {
                        return await wsFetchRelay(new URL(upstreamUrls[0]), request.headers);
                    }
                    catch (_) {
                    }
                }
                throw err;
            }
        }
        const wsHeaders = new Headers(request.headers);
        if (ipMode === "disable") {
            stripClientIdentityHeaders(wsHeaders);
        }
        else {
            wsHeaders.delete("x-real-ip");
            wsHeaders.delete("x-forwarded-for");
            wsHeaders.delete("forwarded");
        }
        try {
            return await fetch(upstreamUrls[0], new Request(upstreamUrls[0], { method: request.method, headers: wsHeaders }));
        }
        catch (err) {
            if (relayWs) {
                try {
                    return await wsFetchRelay(new URL(upstreamUrls[0]), wsHeaders);
                }
                catch (_) {
                }
            }
            throw err;
        }
    }
    const hasAuthHeader = SENSITIVE_REQ_HEADERS.some((h) => request.headers.has(h));
    const canUseCache = enableCache && !isStreamRequest && isCacheableRequest(reqCategory) && request.method === "GET" && !request.headers.has("Range") && !(reqCategory === "image" && hasAuthHeader);
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
        }
        catch (_) {
        }
    }
    let requestBody = null;
    if (request.method !== "GET" && request.method !== "HEAD") {
        requestBody = await request.arrayBuffer();
    }
    const timeoutSignal = /* @__PURE__ */ () => (isPlaybackInfo || isPlaying || reqCategory === "api") && typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(API_TIMEOUT_MS) : void 0;
    const relay = getRelayCfg(settings);
    const canRelayFallback = !!relay;
    let relayFallbackUsed = false;
    const tryRelayFallback = /* @__PURE__ */ async (urlForRelay) => {
        if (!relay)
            return null;
        const t = urlForRelay instanceof URL ? urlForRelay : new URL(urlForRelay);
        const rUrl = new URL(t.pathname + t.search, relay.base);
        const fbHeaders = makeUpstreamHeaders(t);
        const fbSign = await relayFetchHeaders(relay.secret, t.toString());
        for (const [k, v] of Object.entries(fbSign))
            fbHeaders.set(k, v);
        const fbRange = request.headers.get("Range");
        if (fbRange)
            fbHeaders.set("Range", fbRange);
        const fbInit = { method: request.method, headers: fbHeaders, redirect: redirectMode };
        if (requestBody)
            fbInit.body = requestBody;
        return fetch(new Request(rUrl.toString(), fbInit));
    };
    const relayResponseUsable = /* @__PURE__ */ (rb) => !!rb && !rb.headers.has("X-Relay-Denied") && ![401, 403, 451].includes(rb.status) && rb.status < 500;
    let finalResponse = null;
    let fallbackResponse = null;
    let lastError = null;
    let lastUpstreamUrl = null;
    for (let i = 0; i < upstreamUrls.length; i++) {
        let upstreamUrl;
        try {
            upstreamUrl = new URL(upstreamUrls[i]);
        }
        catch {
            lastError = new Error("Invalid target URL");
            continue;
        }
        if (i < upstreamUrls.length - 1 && (hostDownUntil.get(upstreamUrl.host) || 0) > Date.now()) {
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
            redirect: redirectMode
        };
        if (requestBody)
            fetchInit.body = requestBody;
        const sig = timeoutSignal();
        if (sig)
            fetchInit.signal = sig;
        try {
            let response = await fetch(new Request(upstreamUrl.toString(), fetchInit));
            if (canRelayFallback && ([401, 403, 451].includes(response.status) || CF_ORIGIN_ERROR_STATUSES.includes(response.status))) {
                if (!fallbackLogThrottled((matchedPrefix || "direct") + "|40x")) {
                    try {
                        await auditLog(env2, "relay.fallback", `${matchedPrefix || "direct"} ${request.method} ${pathname} direct_status=${response.status} colo=${request.cf?.colo || ""}`);
                    }
                    catch (_) {
                    }
                }
                try {
                    const rb = await tryRelayFallback(upstreamUrl);
                    if (relayResponseUsable(rb)) {
                        response = rb;
                        relayFallbackUsed = true;
                    }
                }
                catch (_) {
                }
            }
            if (redirectMode === "manual" && UPSTREAM_FAILOVER_STATUSES.includes(response.status)) {
                lastError = new Error(`HTTP ${response.status}`);
                hostDownUntil.set(upstreamUrl.host, Date.now() + HOST_DOWN_MS);
                fallbackResponse = response;
                continue;
            }
            hostDownUntil.delete(upstreamUrl.host);
            finalResponse = response;
            lastUpstreamUrl = upstreamUrl;
            break;
        }
        catch (err) {
            lastError = err;
            if (canRelayFallback) {
                if (!fallbackLogThrottled((matchedPrefix || "direct") + "|err")) {
                    try {
                        await auditLog(env2, "relay.fallback.err", `${matchedPrefix || "direct"} ${request.method} ${pathname} direct_err=${err && err.message || String(err)} colo=${request.cf?.colo || ""}`);
                    }
                    catch (_) {
                    }
                }
                try {
                    const rb = await tryRelayFallback(upstreamUrl);
                    if (relayResponseUsable(rb)) {
                        hostDownUntil.delete(upstreamUrl.host);
                        finalResponse = rb;
                        lastUpstreamUrl = upstreamUrl;
                        relayFallbackUsed = true;
                        break;
                    }
                }
                catch (_) {
                }
            }
            hostDownUntil.set(upstreamUrl.host, Date.now() + HOST_DOWN_MS);
            continue;
        }
    }
    if (!finalResponse && fallbackResponse) {
        finalResponse = fallbackResponse;
        lastUpstreamUrl = null;
    }
    if (!finalResponse) {
        return new Response("\u6240\u6709\u7EBF\u8DEF\u4E0D\u53EF\u7528: " + (lastError?.message || "Unknown"), { status: 502 });
    }
    if (redirectMode === "manual" && lastUpstreamUrl) {
        const location = finalResponse.headers.get("Location");
        if (location && finalResponse.status >= 300 && finalResponse.status < 400) {
            let redirectUrl;
            try {
                redirectUrl = new URL(location, lastUpstreamUrl);
            }
            catch {
                return new Response("Bad redirect location", { status: 502 });
            }
            if (redirectUrl.protocol !== "http:" && redirectUrl.protocol !== "https:") {
                return new Response("Bad redirect location", { status: 502 });
            }
            const streamLocation = getStreamProxyLocation(request, redirectUrl, streamTargets, streamProxyPath);
            if (streamLocation) {
                // 等价于 nginx proxy_redirect；保留真实路径/签名，客户端下一跳仍走本用户路由。
                const newHeaders = sanitizeResponseHeaders(finalResponse.headers);
                newHeaders.set("Location", streamLocation);
                newHeaders.set("Cache-Control", "no-store");
                newHeaders.set("Access-Control-Allow-Origin", "*");
                applySecurityHeaders(newHeaders);
                if (relayFallbackUsed)
                    newHeaders.set("X-Relay-Fallback", "1");
                recordStats(0);
                if (!fallbackLogThrottled((statPrefix || matchedPrefix || "direct") + "|stream.redirect")) {
                    ctx.waitUntil(auditLog(env2, "stream.redirect", `${statPrefix || matchedPrefix || "direct"} ${request.method} host=${redirectUrl.host}`));
                }
                return new Response(finalResponse.body, { status: finalResponse.status, headers: newHeaders });
            }
            if (MANUAL_REDIRECT_DOMAINS.concat(settings.manualDomains).some((domain2) => redirectUrl.hostname === domain2 || redirectUrl.hostname.endsWith("." + domain2))) {
                const newHeaders = sanitizeResponseHeaders(finalResponse.headers);
                newHeaders.set("Location", redirectUrl.toString());
                applySecurityHeaders(newHeaders);
                recordStats(0);
                return new Response(finalResponse.body, { status: finalResponse.status, headers: newHeaders });
            }
            if (isPrivateHost(redirectUrl.hostname)) {
                return new Response("Redirect target not allowed", { status: 502 });
            }
            const crossOrigin = redirectUrl.origin !== lastUpstreamUrl.origin;
            const newReqHeaders = buildUpstreamHeaders(request, redirectUrl, { ipMode, compatMode: false, crossOrigin });
            const redirectInit = { method: request.method, headers: newReqHeaders, body: requestBody || void 0, redirect: "follow" };
            const rsig = timeoutSignal();
            if (rsig)
                redirectInit.signal = rsig;
            let redirectResponse = null;
            let redirectBlocked = false;
            try {
                const rr = await fetch(redirectUrl.toString(), redirectInit);
                if ([401, 403, 451].includes(rr.status) || rr.status >= 500)
                    redirectBlocked = true;
                else
                    redirectResponse = rr;
            }
            catch (err) {
                redirectBlocked = true;
                lastError = err;
            }
            if (redirectBlocked && canRelayFallback) {
                if (!fallbackLogThrottled((matchedPrefix || "direct") + "|rdr")) {
                    try {
                        await auditLog(env2, "relay.fallback", `${matchedPrefix || "direct"} REDIRECT ${redirectUrl.host} colo=${request.cf?.colo || ""}`);
                    }
                    catch (_) {
                    }
                }
                try {
                    const rb = await tryRelayFallback(redirectUrl);
                    if (relayResponseUsable(rb)) {
                        redirectResponse = rb;
                        relayFallbackUsed = true;
                    }
                }
                catch (_) {
                }
            }
            if (!redirectResponse) {
                return new Response("\u91CD\u5B9A\u5411\u76EE\u6807\u4E0D\u53EF\u7528: " + (lastError?.message || redirectUrl.host), { status: 502 });
            }
            finalResponse = redirectResponse;
        }
    }
    if (isPlaybackInfo && streamTargets.length && finalResponse.status === 200 && request.method !== "HEAD") {
        try {
            const data = await finalResponse.clone().json();
            if (rewritePlaybackStreamUrls(data, request, streamTargets, streamProxyPath, lastUpstreamUrl || firstUpstreamUrl)) {
                const headers = sanitizeResponseHeaders(finalResponse.headers);
                for (const key of ["Content-Length", "Content-Encoding", "ETag", "Content-MD5", "Digest"])
                    headers.delete(key);
                headers.set("Content-Type", "application/json; charset=utf-8");
                headers.set("Cache-Control", "no-store");
                finalResponse = new Response(JSON.stringify(data), { status: finalResponse.status, statusText: finalResponse.statusText, headers });
            }
        }
        catch {
            // 非 JSON 或没有匹配的播放 URL 时，保持原响应，不改媒体源的存储 Path。
        }
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
    if (canUseCache && finalResponse.status === 200 && !finalResponse.headers.has("Set-Cookie")) {
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

export { proxyDirectUrl };
