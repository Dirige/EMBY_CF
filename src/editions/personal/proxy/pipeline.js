// Baseline: 4e0357e. Edition-specific behavior is intentionally retained.
import { JP_COLOS, PROGRESS_MAP_MAX, PROGRESS_THROTTLE_MS, classifyRequest, getResponseBytes, isCacheableRequest, normalizeIpMode } from "./../../../shared/http/primitives.js";
import { getSettings } from "./../config/settings.js";
import { applySecurityHeaders, errResponse } from "./../http/responses.js";
import { CONFIG, fallbackLogThrottled, hostDownUntil, relayPreferences, lastPlayTouched, progressMap, rateLimited } from "./state.js";
import { API_TIMEOUT_MS, HOST_DOWN_MS, LAST_PLAY_THROTTLE_MS, buildUpstreamHeaders, buildWebSocketHeaders, progressKeyOf } from "./../../../shared/proxy/pipeline.js";
import { normalizeRelayBase, relayFetchHeaders } from "./../relay/protocol.js";
import { auditLog } from "./../../../shared/observability/audit.js";
import { MANUAL_REDIRECT_DOMAINS } from "./../../../shared/rules/netdisk.js";
import { sanitizeResponseHeaders } from "./../../../shared/http/responses.js";
import { prepareRequestBody } from '../../../shared/proxy/body-plan.js';
import { discardResponse, upstreamSignal, isRetryableMethod } from '../../../shared/proxy/lifecycle.js';
import { hasPrivateRequestState, canStorePublicResponse } from '../../../shared/proxy/cache-policy.js';
import { followUpstreamRedirects } from '../../../shared/proxy/redirects.js';
import { circuitKey, markCircuitDown, circuitUnavailable } from '../../../shared/proxy/circuit.js';
import { createFetchBudget, MAX_UPSTREAM_ATTEMPTS } from '../../../shared/proxy/budget.js';
import { normalizeRelayMode, relayPostEndpoint, relayRetryAllowed, relayResponseUsable } from '../relay/mode.js';
import { relayPreferenceKey, markRelayPreferred, getRelayPreference, forgetRelayPreference, finishRelayProbe } from '../relay/preference.js';

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
    const mode = normalizeRelayMode(relayMode, 'off');
    const relayActive = !!(relay?.enabled && relay.secret && relay.relayUrl);
    const forceRelay = mode === 'on';
    if (forceRelay && !relayActive) return errResponse('线路强制使用 VPS，但全局中继未启用或配置不完整', 503);
    const autoRelay = mode === 'auto' && relayActive;
    const budget = createFetchBudget(request);
    let bodyPlan = null;
    let relayAttempted = false;
    let usingAutoRelay = false;
    let relayFallbackUsed = false;
    async function fetchThroughRelay(target, init) {
        const relayUrl = new URL(normalizeRelayBase(relay.relayUrl));
        relayUrl.pathname = target.pathname;
        relayUrl.search = target.search;
        const headers = new Headers(init.headers);
        for (const [name, value] of Object.entries(await relayFetchHeaders(relay.secret, target.href))) headers.set(name, value);
        return budget.fetch(new Request(relayUrl, { ...init, headers, redirect: 'manual' }));
    }
    function acceptedRelay(target, init, response, reason) {
        usingAutoRelay = true;
        relayFallbackUsed = true;
        // Do not slide the cooldown on each request: a real read must get a
        // chance to recover direct routing. A 4xx is not a successful probe.
        if (reason !== 'preferred' && response.status < 400) {
            markRelayPreferred(relayPreferences, relayPreferenceKey(request, target, matchedPrefix));
        }
        if (!fallbackLogThrottled((matchedPrefix || '?') + '|relay')) {
            ctx.waitUntil(auditLog(env2, 'direct.fallback', `${matchedPrefix || '?'} ${init.method} category=${reqCategory} reason=${reason}`));
        }
        return response;
    }
    async function tryRelay(target, init, reason) {
        if (!autoRelay || relayAttempted || request.signal.aborted
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
        // Once an automatic switch succeeds, keep this redirect chain on VPS.
        // All hops still share the same total header/request budget.
        if (forceRelay || usingAutoRelay) return fetchThroughRelay(target, init);
        const key = autoRelay ? relayPreferenceKey(request, target, matchedPrefix) : null;
        const preference = autoRelay && !relayAttempted
            ? getRelayPreference(relayPreferences, key, init.method)
            : { useRelay: false, probe: null };
        if (preference.useRelay) {
            relayAttempted = true;
            try {
                // A preferred write is its first dispatch, not a body replay.
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
                // A failed write may already have run on VPS. Never send it
                // again directly, even when the bytes happen to be buffered.
                if (!['GET', 'HEAD'].includes(init.method) || request.signal.aborted) throw error;
            }
        }
        let response;
        try {
            response = await budget.fetch(new Request(target, init));
        } catch (error) {
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
    if (!["streaming", "segment", "image", "static"].includes(reqCategory) && rateLimited(request.headers.get("cf-connecting-ip") || "unknown", settings.rateLimitPerMin)) {
        return errResponse("429: Too Many Requests", 429, { "Retry-After": "30" });
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
        const wsHeaders = buildWebSocketHeaders(request, firstUpstreamUrl, { ipMode, compatMode });
        for (const [name, value] of customHeaders) wsHeaders.set(name, value);
        try {
            return await fetchUpstream(firstUpstreamUrl, { method: request.method, headers: wsHeaders, redirect: 'manual' });
        } catch (error) {
            if (request.signal.aborted) return errResponse('Client closed request', 499);
            throw error;
        }
    }
    const canUseCache = enableCache && isCacheableRequest(reqCategory) && request.method === "GET" && !request.headers.has("Range") && !hasPrivateRequestState(request);
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
        bufferUnknown: autoRelay && relayPostEndpoint(request.method, firstUpstreamUrl),
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
        const healthKey = circuitKey(request, upstreamUrl, matchedPrefix);
        if (i < upstreamUrls.length - 1 && circuitUnavailable(hostDownUntil, healthKey)) {
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
            if (retryable && !compatMode && [502, 503, 504].includes(response.status)) {
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
                return errResponse('Client closed request', 499);
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
        return errResponse('Client closed request', 499);
    }
    if (fallbackResponse && finalResponse && fallbackResponse !== finalResponse) discardResponse(fallbackResponse);
    if (!finalResponse && fallbackResponse) {
        finalResponse = fallbackResponse;
        lastUpstreamUrl = null;
    }
    if (!finalResponse) {
        return errResponse('所有线路不可用，请检查线路配置或稍后重试', 502);
    }
    if (lastUpstreamUrl) {
        try {
            const followed = await followUpstreamRedirects(finalResponse, lastUpstreamUrl, {
                request, bodyPlan, signalFor: timeoutSignal,
                fetcher: outbound => fetchUpstream(new URL(outbound.url), { method: outbound.method, headers: outbound.headers, body: outbound.body, duplex: 'half', signal: outbound.signal, redirect: 'manual' }),
                headersFor: (target, crossOrigin) => buildUpstreamHeaders(request, target, { ipMode, compatMode, crossOrigin }),
                clientLocation: target => !forceRelay && !usingAutoRelay && !compatMode && MANUAL_REDIRECT_DOMAINS.concat(settings.manualDomains).some(domain => target.hostname === domain || target.hostname.endsWith('.' + domain)) ? target.href : null,
            });
            finalResponse = followed.response;
        } catch (error) {
            return errResponse(request.signal.aborted ? 'Client closed request' : 'Upstream redirect failed', request.signal.aborted ? 499 : 502);
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
