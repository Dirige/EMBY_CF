import { isPrivateHost } from '../http/validation.js';
import { sanitizeResponseHeaders } from '../http/responses.js';
import { discardResponse } from './lifecycle.js';

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECT_HOPS = 5;

async function followUpstreamRedirects(initialResponse, initialUrl, {
    request, bodyPlan, headersFor, signalFor, clientLocation = () => null,
    maxHops = MAX_REDIRECT_HOPS,
    fetcher = (...args) => fetch(...args),
}) {
    let response = initialResponse;
    let url = new URL(initialUrl);
    let method = request.method;
    let crossedOrigin = false;
    let hops = 0;
    const seen = new Set([url.href]);
    try {
        while (REDIRECT_STATUSES.has(response.status) && response.headers.has('Location')) {
            const next = new URL(response.headers.get('Location'), url);
            if (!['http:', 'https:'].includes(next.protocol) || next.username || next.password || isPrivateHost(next.hostname)) {
                throw new Error('Redirect target not allowed');
            }
            if (url.protocol === 'https:' && next.protocol !== 'https:') throw new Error('HTTPS downgrade not allowed');
            const location = clientLocation(next);
            if (location) {
                const headers = sanitizeResponseHeaders(response.headers);
                headers.set('Location', location);
                headers.set('Cache-Control', 'no-store');
                return { response: new Response(response.body, { status: response.status, headers }), url: next, hops, clientRedirect: true };
            }
            if (hops >= maxHops || seen.has(next.href)) throw new Error('Redirect loop or hop limit exceeded');
            seen.add(next.href);
            crossedOrigin ||= next.origin !== url.origin;
            if (response.status === 303 && method !== 'HEAD' || [301, 302].includes(response.status) && method === 'POST') method = 'GET';
            if (method !== 'GET' && method !== 'HEAD' && !bodyPlan.replayable) throw new Error('Streaming request cannot follow redirect');
            const headers = headersFor(next, crossedOrigin);
            if (method === 'GET' || method === 'HEAD') {
                headers.delete('Content-Length');
                headers.delete('Content-Type');
                headers.delete('Transfer-Encoding');
            }
            const init = { method, headers, redirect: 'manual', signal: signalFor() };
            if (method !== 'GET' && method !== 'HEAD') bodyPlan.apply(init);
            discardResponse(response);
            response = null;
            url = next;
            hops++;
            response = await fetcher(new Request(url.href, init));
        }
        return { response, url, hops, clientRedirect: false };
    } catch (error) {
        discardResponse(response);
        throw error;
    }
}

export { REDIRECT_STATUSES, MAX_REDIRECT_HOPS, followUpstreamRedirects };
