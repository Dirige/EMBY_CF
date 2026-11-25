// Baseline: 4e0357e. Edition-specific behavior is intentionally retained.
import { CORS_JSON, DROP_RESPONSE_HEADERS, SECURITY_HEADERS } from "./primitives.js";

function sanitizeResponseHeaders(upstreamHeaders) {
    // Copy first to retain distinct Set-Cookie fields; never combine them via
    // iteration + set(). WebSocket responses bypass this ordinary HTTP path.
    const headers = new Headers(upstreamHeaders);
    for (const name of (headers.get('Connection') || '').split(',')) {
        const token = name.trim();
        if (token) headers.delete(token);
    }
    for (const name of DROP_RESPONSE_HEADERS) headers.delete(name);
    for (const name of ['connection', 'keep-alive', 'proxy-connection', 'transfer-encoding', 'te', 'trailer', 'upgrade', 'proxy-authenticate', 'proxy-authorization']) headers.delete(name);
    return headers;
}

function json(data, status = 200) {
    const headers = { ...CORS_JSON, "Cache-Control": "no-store" };
    for (const [k, v] of Object.entries(SECURITY_HEADERS))
        headers[k] = v;
    return new Response(JSON.stringify(data), { status, headers });
}

function html(body, status = 200) {
    const headers = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" };
    for (const [k, v] of Object.entries(SECURITY_HEADERS))
        headers[k] = v;
    return new Response(body, { status, headers });
}

export { sanitizeResponseHeaders, json, html };
