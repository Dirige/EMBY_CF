// Baseline: 4e0357e. Edition-specific behavior is intentionally retained.
import { DOMAIN_PROXY_RULES } from "./../../../shared/http/primitives.js";

var settingsCache = { exp: 0, v: null };

export function invalidateSettingsCache() {
    settingsCache = { exp: 0, v: null };
}

async function getSettings(env2) {
    const now = Date.now();
    if (settingsCache.v && settingsCache.exp > now)
        return settingsCache.v;
    const raw = {};
    if (env2.DB) {
        try {
            const { results } = await env2.DB.prepare("SELECT key, value FROM settings").all();
            for (const r of results || [])
                raw[r.key] = r.value;
        }
        catch (_) {
        }
    }
    let rules = {};
    try {
        rules = JSON.parse(raw.domain_proxy_rules || "{}") || {};
    }
    catch (_) {
    }
    const v = {
        raw,
        healthCheck: raw.health_check === "1",
        rateLimitPerMin: Math.max(0, parseInt(raw.rate_limit_per_min || "0", 10) || 0),
        manualDomains: String(raw.manual_redirect_domains || "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean),
        domainProxyRules: { ...DOMAIN_PROXY_RULES, ...rules },
        // VPS 中继：默认启用（relay_enabled 缺省 = 开）；未配置 url/secret 时自然不生效
        relayUrl: String(raw.relay_url || "").trim(),
        relaySecret: String(raw.relay_secret || "").trim(),
        relayEnabled: String(raw.relay_enabled == null ? "1" : raw.relay_enabled) !== "0"
    };
    settingsCache = { exp: now + 3e4, v };
    return v;
}

async function setSetting(env2, key, value) {
    await env2.DB.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(key, String(value)).run();
    settingsCache = { exp: 0, v: null };
}

var SETTING_KEYS = ["health_check", "rate_limit_per_min", "manual_redirect_domains", "domain_proxy_rules", "tg_daily_report", "relay_url", "relay_secret", "relay_enabled"];

export { settingsCache, getSettings, setSetting, SETTING_KEYS };
