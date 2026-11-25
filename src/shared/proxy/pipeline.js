// Baseline: 4e0357e. Edition-specific behavior is intentionally retained.
import { DROP_REQUEST_HEADERS, stripClientIdentityHeaders } from "./../http/primitives.js";

var SENSITIVE_REQ_HEADERS = Object.freeze(["authorization", "cookie", "x-emby-token", "x-mediabrowser-token", "x-emby-authorization", "x-mediabrowser-authorization", "x-emby-api-key", "x-api-key"]);

var HOST_DOWN_MS = 3e4;

var LAST_PLAY_THROTTLE_MS = 6e4;

var API_TIMEOUT_MS = 15e3;

var FALLBACK_LOG_MS = 3e5;

function buildUpstreamHeaders(request, upstreamUrl, { ipMode, compatMode, crossOrigin = false }) {
    const headers = new Headers(request.headers);
    for (const name of (headers.get('Connection') || '').split(',')) {
        const token = name.trim();
        if (token) headers.delete(token);
    }
    for (const h of DROP_REQUEST_HEADERS)
        headers.delete(h);
    headers.delete("referer");
    const cookies = (headers.get('Cookie') || '').split(';').map(part => part.trim()).filter(part => part && !/^(?:admin_session|emby_preview_personal|emby_preview_multi)=/i.test(part));
    if (cookies.length) headers.set('Cookie', cookies.join('; '));
    else headers.delete('Cookie');
    if (crossOrigin)
        for (const h of SENSITIVE_REQ_HEADERS)
            headers.delete(h);
    headers.set("Host", upstreamUrl.host);
    if (ipMode === "forward") {
        const clientIp = request.headers.get("cf-connecting-ip");
        if (clientIp) {
            headers.set("x-forwarded-for", clientIp);
            headers.set("x-real-ip", clientIp);
        }
    }
    else if (ipMode === "disable") {
        stripClientIdentityHeaders(headers);
    }
    if (compatMode) {
        headers.set("Origin", upstreamUrl.origin);
        headers.set("X-Forwarded-Proto", upstreamUrl.protocol.replace(":", ""));
        headers.set("X-Forwarded-Host", upstreamUrl.host);
    }
    return headers;
}

function buildWebSocketHeaders(request, upstreamUrl, options) {
    const headers = buildUpstreamHeaders(request, upstreamUrl, options);
    headers.set('Upgrade', 'websocket');
    headers.set('Connection', 'Upgrade');
    return headers;
}

function progressKeyOf(request) {
    const u = new URL(request.url);
    const auth = request.headers.get("x-emby-authorization") || "";
    const dm = auth.match(/DeviceId="?([^",]+)/i);
    const device = u.searchParams.get("DeviceId") || request.headers.get("x-emby-device-id") || dm && dm[1] || "";
    const session = u.searchParams.get("PlaySessionId") || "";
    // Without a reliable identity, collapsing all viewers behind the same NAT
    // loses somebody else's watch progress. Prefer forwarding to guessing.
    if (!device && !session) return null;
    const ip = request.headers.get("cf-connecting-ip") || "unknown";
    return JSON.stringify(['progress', u.host, u.pathname.split('/')[1] || '/', ip, device, session]);
}

export { SENSITIVE_REQ_HEADERS, HOST_DOWN_MS, LAST_PLAY_THROTTLE_MS, API_TIMEOUT_MS, FALLBACK_LOG_MS, buildUpstreamHeaders, buildWebSocketHeaders, progressKeyOf };
