// Baseline: 4e0357e. Edition-specific behavior is intentionally retained.


function normalizeRelayBase(v) {
    let u = String(v || "").trim();
    if (!u)
        return "";
    if (!/^https?:\/\//i.test(u))
        u = "http://" + u;
    return u.replace(/\/+$/, "");
}

function relayPortFrom(relayUrl) {
    try {
        const u = new URL(/^https?:\/\//i.test(relayUrl) ? relayUrl : "http://" + relayUrl);
        return u.port ? parseInt(u.port, 10) : u.protocol === "https:" ? 443 : 80;
    }
    catch (_) {
        return 2087;
    }
}

var relayConfigCache = { at: 0, v: null };

var RELAY_CACHE_TTL = 6e4;

function invalidateRelayCache() {
    relayConfigCache = { at: 0, v: null };
}

async function getRelayConfig(env2) {
    const empty = { relayUrl: "", port: 2087, secret: "", certPem: "", keyPem: "", enabled: false, updatedAt: "" };
    if (!env2.DB)
        return empty;
    const now = Date.now();
    if (relayConfigCache.v && now - relayConfigCache.at < RELAY_CACHE_TTL)
        return relayConfigCache.v;
    try {
        const row = await env2.DB.prepare("SELECT * FROM relay_config WHERE id = 1").first();
        if (!row) {
            relayConfigCache = { at: now, v: empty };
            return empty;
        }
        const relayUrl = normalizeRelayBase(row.relay_url);
        const cfg = {
            relayUrl,
            port: relayUrl ? relayPortFrom(relayUrl) : 2087,
            secret: row.secret || "",
            certPem: row.cert_pem || "",
            keyPem: row.key_pem || "",
            enabled: row.enabled === "on",
            updatedAt: row.updated_at || ""
        };
        relayConfigCache = { at: now, v: cfg };
        return cfg;
    }
    catch (_) {
        return empty;
    }
}

async function hmacSha256Hex(secret, message) {
    const enc2 = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", enc2.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = await crypto.subtle.sign("HMAC", key, enc2.encode(message));
    return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function relayFetchHeaders(secret, targetUrl) {
    const ts = Date.now();
    const auth = await hmacSha256Hex(secret, `${ts}:${targetUrl}`);
    return { "X-Relay-Target": targetUrl, "X-Relay-Ts": String(ts), "X-Relay-Auth": auth };
}

export { normalizeRelayBase, relayPortFrom, relayConfigCache, RELAY_CACHE_TTL, invalidateRelayCache, getRelayConfig, hmacSha256Hex, relayFetchHeaders };
