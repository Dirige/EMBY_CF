// Baseline: 4e0357e. Edition-specific behavior is intentionally retained.
import { JP_COLOS, PROGRESS_MAP_MAX, PROGRESS_THROTTLE_MS, classifyRequest, getResponseBytes, isCacheableRequest, normalizeIpMode, stripClientIdentityHeaders } from "./../../../shared/http/primitives.js";
import { getSettings } from "./../config/settings.js";
import { applySecurityHeaders, errResponse } from "./../http/responses.js";
import { CONFIG, fallbackLogThrottled, hostDownUntil, lastPlayTouched, progressMap, rateLimited } from "./state.js";
import { API_TIMEOUT_MS, HOST_DOWN_MS, LAST_PLAY_THROTTLE_MS, SENSITIVE_REQ_HEADERS, buildUpstreamHeaders, progressKeyOf } from "./../../../shared/proxy/pipeline.js";
import { normalizeRelayBase, relayFetchHeaders } from "./../relay/protocol.js";
import { auditLog } from "./../../../shared/observability/audit.js";
import { MANUAL_REDIRECT_DOMAINS } from "./../../../shared/rules/netdisk.js";
import { sanitizeResponseHeaders } from "./../../../shared/http/responses.js";
import { isPrivateHost } from "./../../../shared/http/validation.js";

var CACHE_STRIP_PARAMS = ["api_key", "x-emby-token", "x-emby-api-key"];

function cacheKeyUrl(rawUrl) {
    try {
        const u = new URL(rawUrl);
        for (const k of Array.from(u.searchParams.keys())) {
            if (CACHE_STRIP_PARAMS.includes(k.toLowerCase()))
                u.searchParams.delete(k);
        }
        return u.toString();
    }
    catch {
        return rawUrl;
    }
}

async function proxyDirectUrl(request, env2, ctx, upstreamUrls, opts = {}) {
    const { enableCache = true, compatMode = false, clientIpMode = "forward", matchedPrefix = null, customHeaders = [], relayMode = "off", relay = null } = opts;
    const ipMode = normalizeIpMode(clientIpMode);
    const settings = await getSettings(env2);
    if (!upstreamUrls.length)
        return errResponse("404: Target empty", 404);
    let firstUpstreamUrl;
    try {
        firstUpstreamUrl = new URL(upstreamUrls[0]);
    }
    catch {
        return errResponse("Invalid upstream URL", 500);
    }
    const pathname = firstUpstreamUrl.pathname;
    const reqCategory = classifyRequest(pathname, request.method);
    const isPlaybackInfo = reqCategory === "playback_info";
    const isPlaying = reqCategory === "playing";
    const isPlayStart = isPlaying && /\/Sessions\/Playing\/?$/i.test(pathname);
    const relayActive = !!(relay && relay.enabled && relay.secret);
    const relayedNow = relayActive && (relayMode === "on" || relayMode === "image" && reqCategory !== "streaming" && reqCategory !== "segment");
    if (!["streaming", "segment", "image", "static"].includes(reqCategory) && rateLimited(request.headers.get("cf-connecting-ip") || "unknown", settings.rateLimitPerMin)) {
        return errResponse("429: Too Many Requests", 429, { "Retry-After": "30" });
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
        if (ipMode === "forward") {
            if (relayedNow) {
                return relayFetch(request, relay, new URL(upstreamUrls[0]), null);
            }
            return fetch(upstreamUrls[0], request);
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
        if (relayedNow) {
            return relayFetch(request, relay, new URL(upstreamUrls[0]), wsHeaders);
        }
        return fetch(upstreamUrls[0], new Request(upstreamUrls[0], { method: request.method, headers: wsHeaders }));
    }
    async function relayFetch(origReq, relayCfg, targetUrl, overrideHeaders) {
        const t = targetUrl instanceof URL ? targetUrl : new URL(targetUrl);
        const rBase = normalizeRelayBase(relayCfg.relayUrl);
        const relayUrl = new URL(t.pathname + t.search, rBase);
        const signHeaders = await relayFetchHeaders(relayCfg.secret, t.toString());
        const h = new Headers(overrideHeaders || origReq.headers);
        for (const [k, v] of Object.entries(signHeaders))
            h.set(k, v);
        let body2;
        if (origReq.method !== "GET" && origReq.method !== "HEAD") {
            try {
                body2 = await origReq.clone().arrayBuffer();
            }
            catch (_) {
                body2 = void 0;
            }
        }
        const init = { method: origReq.method, headers: h, redirect: "manual" };
        if (body2)
            init.body = body2;
        return fetch(new Request(relayUrl.toString(), init));
    }
    const hasAuthHeader = SENSITIVE_REQ_HEADERS.some((h) => request.headers.has(h));
    const canUseCache = enableCache && isCacheableRequest(reqCategory) && request.method === "GET" && !request.headers.has("Range") && !(reqCategory === "image" && hasAuthHeader);
    const cacheKey = canUseCache ? new Request(cacheKeyUrl(request.url), { method: "GET" }) : null;
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
    const timeoutSignal = () => (isPlaybackInfo || isPlaying || reqCategory === "api") && typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(API_TIMEOUT_MS) : void 0;
    let finalResponse = null;
    let fallbackResponse = null;
    let lastError = null;
    let lastUpstreamUrl = null;
    let relayFallbackUsed = false;
    const canRelayFallback = relayMode === "image" && !relayedNow;
    const tryRelayFallback = async (urlForRelay) => {
        const rBase = normalizeRelayBase(relay.relayUrl);
        const rUrl = new URL(urlForRelay.pathname + urlForRelay.search, rBase);
        const fbHeaders = buildUpstreamHeaders(request, urlForRelay, { ipMode, compatMode });
        for (const [k, v] of customHeaders)
            fbHeaders.set(k, v);
        const fbSign = await relayFetchHeaders(relay.secret, urlForRelay.toString());
        for (const [k, v] of Object.entries(fbSign))
            fbHeaders.set(k, v);
        const fbRange = request.headers.get("Range");
        if (fbRange)
            fbHeaders.set("Range", fbRange);
        const fbInit = { method: request.method, headers: fbHeaders, redirect: compatMode ? "follow" : "manual" };
        if (requestBody)
            fbInit.body = requestBody;
        return fetch(new Request(rUrl.toString(), fbInit));
    };
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
            lastError = lastError || new Error("线路暂时不可用: " + upstreamUrl.host);
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
        let fetchTarget = upstreamUrl.toString();
        if (relayedNow) {
            const rBase = normalizeRelayBase(relay.relayUrl);
            const rUrl = new URL(upstreamUrl.pathname + upstreamUrl.search, rBase);
            fetchTarget = rUrl.toString();
            const signHeaders = await relayFetchHeaders(relay.secret, upstreamUrl.toString());
            for (const [k, v] of Object.entries(signHeaders))
                headers.set(k, v);
        }
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
            redirect: compatMode ? "follow" : "manual"
        };
        if (requestBody)
            fetchInit.body = requestBody;
        const sig = timeoutSignal();
        if (sig)
            fetchInit.signal = sig;
        try {
            let response = await fetch(new Request(fetchTarget, fetchInit));
            if (canRelayFallback && [401, 403, 451].includes(response.status)) {
                if (!fallbackLogThrottled((matchedPrefix || "?") + "|40x")) {
                    try {
                        await auditLog(env2, "direct.fallback", `${matchedPrefix || request.cf?.colo || "?"} ${request.method} ${pathname} direct_status=${response.status} colo=${request.cf?.colo || ""}`);
                    }
                    catch (_) {
                    }
                }
                try {
                    const rb = await tryRelayFallback(upstreamUrl);
                    if (rb && ![401, 403, 451].includes(rb.status)) {
                        response = rb;
                        relayFallbackUsed = true;
                    }
                }
                catch (_) {
                }
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
        }
        catch (err) {
            lastError = err;
            if (canRelayFallback) {
                if (!fallbackLogThrottled((matchedPrefix || "?") + "|err")) {
                    try {
                        await auditLog(env2, "direct.fallback.err", `${matchedPrefix || "?"} ${request.method} ${pathname} direct_err=${err && err.message || String(err)} colo=${request.cf?.colo || ""}`);
                    }
                    catch (_) {
                    }
                }
                try {
                    const rb = await tryRelayFallback(upstreamUrl);
                    if (rb) {
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
        return errResponse("所有线路不可用: " + (lastError?.message || "Unknown"), 502);
    }
    if (!compatMode && lastUpstreamUrl) {
        const location = finalResponse.headers.get("Location");
        if (location && finalResponse.status >= 300 && finalResponse.status < 400) {
            let redirectUrl;
            try {
                redirectUrl = new URL(location, lastUpstreamUrl);
            }
            catch {
                return errResponse("Bad redirect location", 502);
            }
            if (redirectUrl.protocol !== "http:" && redirectUrl.protocol !== "https:") {
                return errResponse("Bad redirect location", 502);
            }
            if (MANUAL_REDIRECT_DOMAINS.concat(settings.manualDomains).some((domain2) => redirectUrl.hostname === domain2 || redirectUrl.hostname.endsWith("." + domain2))) {
                const newHeaders = sanitizeResponseHeaders(finalResponse.headers);
                newHeaders.set("Location", redirectUrl.toString());
                applySecurityHeaders(newHeaders);
                recordStats(0);
                return new Response(finalResponse.body, { status: finalResponse.status, headers: newHeaders });
            }
            if (isPrivateHost(redirectUrl.hostname)) {
                return errResponse("Redirect target not allowed", 502);
            }
            const crossOrigin = redirectUrl.origin !== lastUpstreamUrl.origin;
            const newReqHeaders = buildUpstreamHeaders(request, redirectUrl, { ipMode, compatMode: false, crossOrigin });
            const redirectInit = { method: request.method, headers: newReqHeaders, body: requestBody || void 0, redirect: "follow" };
            const rsig = timeoutSignal();
            if (rsig)
                redirectInit.signal = rsig;
            try {
                finalResponse = await fetch(redirectUrl.toString(), redirectInit);
            }
            catch (err) {
                return errResponse("重定向目标不可用: " + (err?.message || "Unknown"), 502);
            }
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

export { CACHE_STRIP_PARAMS, cacheKeyUrl, proxyDirectUrl };
