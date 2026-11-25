const MAX_CIRCUIT_ENTRIES = 512;
const HALF_OPEN_LEASE_MS = 10_000;

function circuitKey(request, upstream, route = '', owner = '') {
    // A failing target for one tenant/route must not disable somebody else's.
    const incoming = new URL(request.url);
    return JSON.stringify([incoming.host, owner, route || incoming.pathname.split('/')[1] || '/', upstream.origin]);
}

function markCircuitDown(state, key, until, now = Date.now()) {
    for (const [entry, expiry] of state) if (expiry <= now) state.delete(entry);
    state.delete(key);
    state.set(key, until);
    while (state.size > MAX_CIRCUIT_ENTRIES) state.delete(state.keys().next().value);
}

function circuitUnavailable(state, key, now = Date.now()) {
    const until = state.get(key);
    if (until === undefined) return false;
    if (until > now) return true;
    // One request gets a recovery probe; concurrent requests use a backup.
    // Last/sole target bypasses this guard at the caller to avoid black holes.
    state.set(key, now + HALF_OPEN_LEASE_MS);
    return false;
}

export { circuitKey, markCircuitDown, circuitUnavailable, MAX_CIRCUIT_ENTRIES, HALF_OPEN_LEASE_MS };
