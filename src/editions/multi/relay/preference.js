import { circuitKey } from '../../../shared/proxy/circuit.js';

const RELAY_PREFERENCE_MS = 120_000;
const RELAY_RECOVERY_LEASE_MS = 10_000;
const MAX_RELAY_PREFERENCES = 512;

function relayPreferenceKey(request, target, route, owner = '') {
    return JSON.stringify([circuitKey(request, target, route, owner), request.cf?.colo || '',
        request.cf?.country || request.headers.get('cf-ipcountry') || '']);
}

function markRelayPreferred(state, key, now = Date.now()) {
    state.delete(key);
    state.set(key, { until: now + RELAY_PREFERENCE_MS, probeUntil: 0 });
    while (state.size > MAX_RELAY_PREFERENCES) state.delete(state.keys().next().value);
}

function getRelayPreference(state, key, method, now = Date.now()) {
    const entry = state.get(key);
    if (!entry) return { useRelay: false, probe: null, entry: null };
    if (entry.until > now || !['GET', 'HEAD'].includes(method) || entry.probeUntil > now) {
        return { useRelay: true, probe: null, entry };
    }
    entry.probeUntil = now + RELAY_RECOVERY_LEASE_MS;
    return { useRelay: false, probe: entry, entry };
}

function forgetRelayPreference(state, key, entry) {
    if (state.get(key) === entry) state.delete(key);
}

function finishRelayProbe(state, key, probe, available, now = Date.now()) {
    if (!probe || state.get(key) !== probe) return;
    if (available) state.delete(key);
    else {
        probe.until = now + RELAY_RECOVERY_LEASE_MS;
        probe.probeUntil = 0;
    }
}

export { RELAY_PREFERENCE_MS, RELAY_RECOVERY_LEASE_MS, MAX_RELAY_PREFERENCES,
    relayPreferenceKey, markRelayPreferred, getRelayPreference, forgetRelayPreference, finishRelayProbe };
