const MAX_UPSTREAM_ATTEMPTS = 3;
const MAX_OUTBOUND_REQUESTS = 9; // primary/relay attempts plus at most five redirects
const TOTAL_HEADER_BUDGET_MS = 20_000;
const HEADER_TIMEOUT_MS = 10_000;

function createFetchBudget(request, {
    totalMs = TOTAL_HEADER_BUDGET_MS, headerMs = HEADER_TIMEOUT_MS,
    maxRequests = MAX_OUTBOUND_REQUESTS, clock = () => performance.now(),
} = {}) {
    const deadline = clock() + totalMs;
    let requests = 0;
    return {
        get requests() { return requests; },
        async fetch(input, init) {
            request.signal.throwIfAborted();
            const remaining = deadline - clock();
            if (remaining <= 0 || requests >= maxRequests) throw new Error('Upstream request budget exhausted');
            requests++;
            const timeout = new AbortController();
            const original = input instanceof Request && !init ? input : new Request(input, init);
            const signal = AbortSignal.any([request.signal, original.signal, timeout.signal]);
            const timer = setTimeout(() => timeout.abort(new DOMException('Upstream header timeout', 'TimeoutError')), Math.min(headerMs, remaining));
            try {
                return await fetch(new Request(original, { signal }));
            } finally {
                // A full movie must not be aborted by a response-header timer.
                clearTimeout(timer);
            }
        },
    };
}

export { createFetchBudget, MAX_UPSTREAM_ATTEMPTS, MAX_OUTBOUND_REQUESTS, TOTAL_HEADER_BUDGET_MS, HEADER_TIMEOUT_MS };
