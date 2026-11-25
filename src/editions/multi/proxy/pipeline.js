// Baseline: 4e0357e. Edition-specific behavior is intentionally retained.
import { JP_COLOS, PROGRESS_MAP_MAX, PROGRESS_THROTTLE_MS, classifyRequest, getResponseBytes, isCacheableRequest, normalizeIpMode } from "./../../../shared/http/primitives.js";
import { API_TIMEOUT_MS, HOST_DOWN_MS, LAST_PLAY_THROTTLE_MS, buildUpstreamHeaders, progressKeyOf } from "./../../../shared/proxy/pipeline.js";
import { getSettings } from "./../config/settings.js";
import { CONFIG, fallbackLogThrottled, hostDownUntil, relayPreferences, lastPlayTouched, progressMap, rateLimited } from "./state.js";
import { getRelayCfg, relayFetchHeaders } from "./../relay/protocol.js";
import { applySecurityHeaders } from "./../http/responses.js";
import { UPSTREAM_FAILOVER_STATUSES } from "./../storage/schema.js";
import { auditLog } from "./../../../shared/observability/audit.js";
import { getStreamProxyLocation, rewritePlaybackStreamUrls } from "./stream-targets.js";
import { sanitizeResponseHeaders } from "./../../../shared/http/responses.js";
import { MANUAL_REDIRECT_DOMAINS } from "./../../../shared/rules/netdisk.js";
import { prepareRequestBody } from '../../../shared/proxy/body-plan.js';
import { discardResponse, upstreamSignal, isRetryableMethod } from '../../../shared/proxy/lifecycle.js';
import { hasPrivateRequestState, canStorePublicResponse } from '../../../shared/proxy/cache-policy.js';
import { followUpstreamRedirects } from '../../../shared/proxy/redirects.js';
import { circuitKey, markCircuitDown, circuitUnavailable } from '../../../shared/proxy/circuit.js';
import { createFetchBudget, MAX_UPSTREAM_ATTEMPTS } from '../../../shared/proxy/budget.js';
import { rewriteJsonResponse } from '../../../shared/proxy/json-rewrite.js';
import { relayPostEndpoint, relayRetryAllowed, relayResponseUsable } from '../relay/mode.js';
import { relayPreferenceKey, markRelayPreferred, getRelayPreference, forgetRelayPreference, finishRelayProbe } from '../relay/preference.js';

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
    const relay = getRelayCfg(settings);
    const budget = createFetchBudget(request);
    let bodyPlan = null;
    let relayAttempted = false;
    let usingAutoRelay = false;
    let relayFallbackUsed = false;
    const preferenceKey = target => relayPreferenceKey(request, target, matchedPrefix, routeOwner || String(legacyUserId || ''));
    async function fetchThroughRelay(target, init) {
        const relayUrl = new URL(target.pathname + target.search, relay.base);
        const headers = new Headers(init.headers);
        for (const [name, value] of Object.entries(await relayFetchHeaders(relay.secret, target.href))) headers.set(name, value);
        return budget.fetch(new Request(relayUrl, { ...init, headers, redirect: 'manual', signal: request.signal }));
    }
    function acceptedRelay(target, init, response, reason) {
        usingAutoRelay = true;
        relayFallbackUsed = true;
        if (reason !== 'preferred' && response.status < 400) markRelayPreferred(relayPreferences, preferenceKey(target));
        if (!fallbackLogThrottled((statPrefix || matchedPrefix || 'direct') + '|relay')) {
            ctx.waitUntil(auditLog(env2, reason === 'transport' ? 'relay.fallback.err' : 'relay.fallback',
                `${statPrefix || matchedPrefix || 'direct'} ${init.method} category=${reqCategory} reason=${reason}`));
        }
        return response;
    }
    async function tryRelay(target, init, reason) {
        if (!relay || relayAttempted || request.signal.aborted
            || !relayRetryAllowed(init.method, target, reason, bodyPlan?.replayable)) return null;
        relayAttempted = true;
        try {
            const retryInit = { method: init.method, headers: new Headers(init.headers), signal: request.signal };
            if (!['GET', 'HEAD'].includes(init.method)) bodyPlan.apply(retryInit);
            const response = await fetchThroughRelay(target, retryInit);
            if (!relayResponseUsable(response)) {
                discardResponse(response);
                return null;
            }
            return acceptedRelay(target, init, response, reason);
        } catch { return null; }
    }
    async function fetchUpstream(target, init) {
        if (usingAutoRelay) return fetchThroughRelay(target, init);
        const key = relay ? preferenceKey(target) : null;
        const preference = relay && !relayAttempted ? getRelayPreference(relayPreferences, key, init.method)
            : { useRelay: false, probe: null };
        if (preference.useRelay) {
            relayAttempted = true;
            try {
                const response = await fetchThroughRelay(target, init);
                if (relayResponseUsable(response)) return acceptedRelay(target, init, response, 'preferred');
                forgetRelayPreference(relayPreferences, key, preference.entry);
                if (!['GET', 'HEAD'].includes(init.method)) {
                    relayFallbackUsed = true;
                    return response;
                }
                discardResponse(response);
            } catch (error) {
                forgetRelayPreference(relayPreferences, key, preference.entry);
                if (!['GET', 'HEAD'].includes(init.method) || request.signal.aborted) throw error;
            }
        }
        let response;
        try { response = await budget.fetch(new Request(target, init)); }
        catch (error) {
            const fallback = await tryRelay(target, init, 'transport');
            finishRelayProbe(relayPreferences, key, preference.probe, false);
            if (fallback) return fallback;
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
        wsHeaders.set('Upgrade', 'websocket');
        wsHeaders.set('Connection', 'Upgrade');
        return fetchUpstream(firstUpstreamUrl, { method: request.method, headers: wsHeaders, redirect: 'manual', signal: request.signal });
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
        }
        catch (_) {
        }
    }
    bodyPlan = await prepareRequestBody(request, undefined, undefined, {
        bufferUnknown: !!relay && relayPostEndpoint(request.method, firstUpstreamUrl),
    });
    const retryable = isRetryableMethod(request);
    const timeoutSignal = () => upstreamSignal(request, (isPlaybackInfo || isPlaying || reqCategory === 'api') ? API_TIMEOUT_MS : 0);
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
        }
        catch {
            lastError = new Error("Invalid target URL");
            continue;
        }
        const healthKey = circuitKey(request, upstreamUrl, matchedPrefix, routeOwner || String(legacyUserId || ''));
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
        if (isPlaybackInfo && streamTargets.length) headers.set('Accept-Encoding', 'identity');
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
            redirect: 'manual'
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
        }
        catch (err) {
            if (request.signal.aborted) {
                discardResponse(fallbackResponse);
                return new Response('Client closed request', { status: 499 });
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
        return new Response('Client closed request', { status: 499 });
    }
    if (fallbackResponse && finalResponse && fallbackResponse !== finalResponse) discardResponse(fallbackResponse);
    if (!finalResponse && fallbackResponse) {
        finalResponse = fallbackResponse;
        lastUpstreamUrl = null;
    }
    if (!finalResponse) {
        return new Response('所有线路不可用，请检查线路配置或稍后重试', { status: 502 });
    }
    if (lastUpstreamUrl) {
        try {
            const followed = await followUpstreamRedirects(finalResponse, lastUpstreamUrl, {
                request, bodyPlan, signalFor: timeoutSignal,
                fetcher: next => fetchUpstream(new URL(next.url), { method: next.method, headers: next.headers, redirect: 'manual', body: next.body, duplex: 'half', signal: next.signal }),
                headersFor: (target, crossOrigin) => buildUpstreamHeaders(request, target, { ipMode, compatMode, crossOrigin: crossOrigin || isStreamRequest }),
                clientLocation: target => {
                    const mapped = getStreamProxyLocation(request, target, streamTargets, streamProxyPath);
                    if (mapped) {
                        // Preserve the multi edition's explicit 302 stream mapping.
                        // Its next Worker request must retain the VPS/IP path too.
                        if (usingAutoRelay) markRelayPreferred(relayPreferences, preferenceKey(target));
                        if (!fallbackLogThrottled((statPrefix || matchedPrefix || 'direct') + '|stream.redirect')) {
                            ctx.waitUntil(auditLog(env2, 'stream.redirect', `${statPrefix || matchedPrefix || 'direct'} ${request.method} mapped_stream`));
                        }
                        return mapped;
                    }
                    return !usingAutoRelay && redirectMode === 'manual' && MANUAL_REDIRECT_DOMAINS.concat(settings.manualDomains).some(domain => target.hostname === domain || target.hostname.endsWith('.' + domain)) ? target.href : null;
                },
            });
            finalResponse = followed.response;
        } catch (error) {
            return new Response(request.signal.aborted ? 'Client closed request' : 'Upstream redirect failed', { status: request.signal.aborted ? 499 : 502 });
        }
    }
    if (isPlaybackInfo && streamTargets.length && finalResponse.status === 200 && request.method !== "HEAD") {
        finalResponse = await rewriteJsonResponse(finalResponse, data => rewritePlaybackStreamUrls(data, request, streamTargets, streamProxyPath, lastUpstreamUrl || firstUpstreamUrl,
            usingAutoRelay ? target => markRelayPreferred(relayPreferences, preferenceKey(target)) : undefined));
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

export { proxyDirectUrl };
