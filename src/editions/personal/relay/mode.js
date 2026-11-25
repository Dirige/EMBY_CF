// Legacy image-only routes now use direct-first fallback, without a migration.
export function normalizeRelayMode(value, fallback = 'auto') {
    if (value === 'image') return 'auto';
    return ['auto', 'on', 'off'].includes(value) ? value : fallback;
}

export const relayAccessDeniedStatus = status => [401, 403, 451].includes(status);

export const relayFallbackStatus = status => relayAccessDeniedStatus(status) || [502, 503, 504, 521, 522, 523, 524, 525, 526].includes(status);

export const relayPostEndpoint = (method, target) => method === 'POST'
    && /\/(?:Users\/(?:AuthenticateByName|AuthenticateWithQuickConnect)|Items\/[^/]+\/PlaybackInfo)\/?$/i.test(target.pathname);

// A received access denial can be retried for these small Emby requests. A
// timeout/5xx is ambiguous: the original POST may already have taken effect.
export function relayRetryAllowed(method, target, status, replayable = false) {
    if (method === 'GET' || method === 'HEAD') return status === 'transport' || relayFallbackStatus(status);
    if (method !== 'POST' || !replayable || !relayAccessDeniedStatus(status)) return false;
    return relayPostEndpoint(method, target);
}

export const relayResponseUsable = response => response.status < 500 && response.status !== 429
    && !relayAccessDeniedStatus(response.status) && !response.headers.has('X-Relay-Denied');
