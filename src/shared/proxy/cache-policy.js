const PRIVATE_HEADERS = ['authorization', 'cookie', 'x-emby-token', 'x-mediabrowser-token', 'x-emby-authorization', 'x-mediabrowser-authorization', 'x-emby-api-key', 'x-api-key'];
const PRIVATE_QUERY = /(?:token|api[_-]?key|authorization|signature|sign|secret|password|credential|jwt|^key$|^auth$)/i;

function hasPrivateRequestState(request) {
    if (PRIVATE_HEADERS.some(name => request.headers.has(name))) return true;
    for (const key of new URL(request.url).searchParams.keys()) {
        if (PRIVATE_QUERY.test(key)) return true;
    }
    return false;
}

function canStorePublicResponse(response) {
    if (response.status !== 200 || response.headers.has('Set-Cookie')) return false;
    if (/(?:^|,)\s*(?:private|no-store|no-cache)(?:\s|,|=|$)/i.test(response.headers.get('Cache-Control') || '')) return false;
    // Cache keys do not model content negotiation; fail closed on all Vary.
    return !response.headers.get('Vary');
}

export { hasPrivateRequestState, canStorePublicResponse };
