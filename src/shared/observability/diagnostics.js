import { readJson, splitTargets } from '../admin/api.js';
import { parseHeaderLines } from '../http/validation.js';
import { SENSITIVE_REQ_HEADERS } from '../proxy/pipeline.js';
import { createFetchBudget } from '../proxy/budget.js';
import { followUpstreamRedirects } from '../proxy/redirects.js';
import { discardResponse } from '../proxy/lifecycle.js';

// Explicit admin action only. Probes configured targets, never accepts a URL
// from the request and never forwards an admin session to the origin.
async function diagnoseRoute(route, request, { edition, relayConfigured = false } = {}) {
    const targets = splitTargets(route.target);
    const custom = parseHeaderLines(route.custom_headers).headers;
    const budget = createFetchBudget(request, { totalMs: 8_000, headerMs: 4_000, maxRequests: 9 });
    const mode = edition === 'personal' ? route.use_relay === 'image' ? 'auto' : route.use_relay || 'off' : relayConfigured ? 'fallback' : 'off';
    const results = [];
    for (const [index, target] of targets.slice(0, 3).entries()) {
        const start = performance.now();
        let response;
        try {
            const url = new URL(target);
            if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid configured target');
            const headersFor = (next, crossOrigin) => {
                const headers = new Headers(custom);
                if (crossOrigin) for (const name of SENSITIVE_REQ_HEADERS) headers.delete(name);
                headers.set('User-Agent', 'Emby-Route-Diagnostics');
                return headers;
            };
            const base = url.pathname.replace(/\/+$/, '');
            const paths = ['/System/Info/Public'];
            if (!/\/emby$/i.test(base)) paths.push('/emby/System/Info/Public');
            const getRequest = new Request(request.url, { signal: request.signal });
            for (const [attempt, path] of paths.entries()) {
                url.pathname = base + path;
                const probeStart = performance.now();
                response = await budget.fetch(new Request(url.href, { headers: headersFor(url, false), redirect: 'manual' }));
                const followed = await followUpstreamRedirects(response, url, {
                    request: getRequest, headersFor, signalFor: () => request.signal,
                    fetcher: next => budget.fetch(next), maxHops: 2,
                });
                response = followed.response;
                const status = response.status;
                const headerMs = Math.round(performance.now() - probeStart);
                if ((status === 404 || status === 405) && attempt + 1 < paths.length) {
                    discardResponse(response);
                    response = null;
                    continue;
                }
                const info = response.ok ? await readJson(response, { limit: 32 * 1024, timeoutMs: 1000 }) : null;
                const ok = typeof info?.Id === 'string' && !!info.Id && typeof info.Version === 'string' && !!info.Version;
                const stage = ok ? 'verified' : status === 404 || status === 405 ? 'endpoint-unavailable'
                    : status === 401 || status === 403 ? 'authentication' : status >= 500 ? 'upstream'
                    : response.ok ? 'unexpected-response' : 'http-error';
                results.push({ target: index + 1, ok, status, headerMs, redirects: followed.hops, stage });
                break;
            }
        } catch {
            results.push({ target: index + 1, ok: false, status: 0, headerMs: Math.round(performance.now() - start), stage: request.signal.aborted ? 'cancelled' : 'connection-or-redirect' });
        } finally { discardResponse(response); }
    }
    return { success: true, prefix: route.prefix, enabled: route.enabled !== 0,
        policy: { edition, media: mode === 'on' ? 'vps' : 'worker', relay: mode,
            relayConfigured, privateCache: 'bypass', retries: 'GET/HEAD only', targetLimit: 3, redirectLimit: 5 },
        results, omittedTargets: Math.max(0, targets.length - 3),
        notice: '只验证 Worker 直连源站的 Emby/Jellyfin 公开 API。耗时不是客户端 RTT；未测试登录、播放、VPS 或网盘直链。',
    };
}

export { diagnoseRoute };
