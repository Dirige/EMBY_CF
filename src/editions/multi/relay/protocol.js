// Baseline: 4e0357e. Edition-specific behavior is intentionally retained.
import { hmacHex } from "./../auth/session.js";

function normalizeRelayBase(v) {
    let u = String(v || "").trim();
    if (!u)
        return "";
    if (!/^https?:\/\//i.test(u))
        u = "https://" + u;
    return u.replace(/\/+$/, "");
}

function getRelayCfg(settings) {
    if (!settings.relayEnabled || !settings.relayUrl || !settings.relaySecret)
        return null;
    const base = normalizeRelayBase(settings.relayUrl);
    return base && settings.relaySecret ? { base, secret: settings.relaySecret } : null;
}

async function relayFetchHeaders(secret, targetUrl) {
    const ts = Date.now();
    const auth = await hmacHex(secret, ts + ":" + targetUrl);
    return { "X-Relay-Target": targetUrl, "X-Relay-Ts": String(ts), "X-Relay-Auth": auth };
}

export { normalizeRelayBase, getRelayCfg, relayFetchHeaders };
