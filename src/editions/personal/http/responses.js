// Baseline: 4e0357e. Edition-specific behavior is intentionally retained.
import { SECURITY_HEADERS } from "./../../../shared/http/primitives.js";
import { XFO_CURRENT } from "./../config/settings.js";

function applySecurityHeaders(headers) {
    for (const [k, v] of Object.entries(SECURITY_HEADERS))
        headers.set(k, v);
    if (XFO_CURRENT)
        headers.set("X-Frame-Options", XFO_CURRENT);
    else
        headers.delete("X-Frame-Options");
    return headers;
}

function errResponse(body, status, extra) {
    const headers = { "Content-Type": "text/plain; charset=utf-8", "Access-Control-Allow-Origin": "*", "X-Content-Type-Options": "nosniff" };
    if (extra)
        for (const [k, v] of Object.entries(extra))
            headers[k] = v;
    return new Response(body, { status, headers });
}

export { applySecurityHeaders, errResponse };
