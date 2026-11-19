// Baseline: 4e0357e. Edition-specific behavior is intentionally retained.
import { SECURITY_HEADERS } from "./../../../shared/http/primitives.js";

function applySecurityHeaders(headers) {
    for (const [k, v] of Object.entries(SECURITY_HEADERS))
        headers.set(k, v);
    return headers;
}

export { applySecurityHeaders };
