function discardResponse(response) {
    // Do not await cancel: a peer/tee implementation may never settle it.
    try { void response?.body?.cancel().catch(() => {}); } catch {}
}

function upstreamSignal(request, timeoutMs = 0) {
    request.signal.throwIfAborted();
    return timeoutMs > 0
        ? AbortSignal.any([request.signal, AbortSignal.timeout(timeoutMs)])
        : request.signal;
}

function isRetryableMethod(request) {
    // Replayable bytes alone do not make login/progress/write requests safe.
    return request.method === 'GET' || request.method === 'HEAD';
}

export { discardResponse, upstreamSignal, isRetryableMethod };
