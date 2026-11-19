// Baseline: 4e0357e. Edition-specific behavior is intentionally retained.
import { CORS_JSON, DROP_RESPONSE_HEADERS, SECURITY_HEADERS } from "./primitives.js";

function sanitizeResponseHeaders(upstreamHeaders) {
    const headers = new Headers();
    for (const [key, value] of upstreamHeaders.entries()) {
        if (!DROP_RESPONSE_HEADERS.has(key.toLowerCase()))
            headers.set(key, value);
    }
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
