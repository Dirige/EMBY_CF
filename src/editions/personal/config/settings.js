// Baseline: 4e0357e. Edition-specific behavior is intentionally retained.
import { DOMAIN_PROXY_RULES } from "./../../../shared/http/primitives.js";

var settingsCache = { exp: 0, v: null };

export function invalidateSettingsCache() {
    settingsCache = { exp: 0, v: null };
}

var XFO_CURRENT = "SAMEORIGIN";

function normalizeXfo(v) {
    const s = String(v || "").trim().toLowerCase();
    if (s === "deny")
        return "DENY";
    if (s === "off" || s === "none" || s === "0")
        return "";
    return "SAMEORIGIN";
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
                if (SETTING_KEYS.includes(r.key)) raw[r.key] = r.value;
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
        domainProxyRules: { ...DOMAIN_PROXY_RULES, ...rules }
    };
    XFO_CURRENT = normalizeXfo(raw.x_frame_options);
    settingsCache = { exp: now + 3e4, v };
    return v;
}

async function setSetting(env2, key, value) {
    await env2.DB.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(key, String(value)).run();
    settingsCache = { exp: 0, v: null };
}

var SETTING_KEYS = ["health_check", "rate_limit_per_min", "manual_redirect_domains", "domain_proxy_rules", "tg_daily_report", "tg_route_alerts", "x_frame_options"];

export { settingsCache, XFO_CURRENT, normalizeXfo, getSettings, setSetting, SETTING_KEYS };
