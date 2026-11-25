// Multi keeps its existing global relay switch and CF gateway status coverage.
export const relayAccessDeniedStatus = status => [401, 403, 451].includes(status);
export const relayFallbackStatus = status => relayAccessDeniedStatus(status)
    || [502, 503, 504, 520, 521, 522, 523, 524, 525, 526, 527, 530].includes(status);

export const relayPostEndpoint = (method, target) => method === 'POST'
    && /\/(?:Users\/(?:AuthenticateByName|AuthenticateWithQuickConnect)|Items\/[^/]+\/PlaybackInfo)\/?$/i.test(target.pathname);

export function relayRetryAllowed(method, target, status, replayable = false) {
    if (method === 'GET' || method === 'HEAD') return status === 'transport' || relayFallbackStatus(status);
    return method === 'POST' && replayable && relayAccessDeniedStatus(status) && relayPostEndpoint(method, target);
}

export const relayResponseUsable = response => response.status < 500 && response.status !== 429
    && !relayAccessDeniedStatus(response.status) && !response.headers.has('X-Relay-Denied');
