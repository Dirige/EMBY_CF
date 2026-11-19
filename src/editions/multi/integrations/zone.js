// Baseline: 4e0357e. Edition-specific behavior is intentionally retained.
import { envStr, findZoneForHost, getBaseDomain, getCFApiToken, getDnsRecordName, toFqdn } from "./../../../shared/auth/session.js";

function getUserDomain(env2) {
    const raw = envStr(env2, "USER_DOMAIN", "ENTRY_DOMAIN", "USER_BASE_DOMAIN");
    if (raw) {
        return raw.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/:\d+$/, "").replace(/^\.+|\.+$/g, "");
    }
    const base = getBaseDomain(env2);
    const dns = getDnsRecordName(env2);
    if (base && dns && base !== dns && base.startsWith(dns + ".")) {
        const rest = base.slice(dns.length + 1);
        if (rest.includes("."))
            return rest;
    }
    return base;
}

function getStatsHost(env2) {
    const override = envStr(env2, "STATS_HOSTS").split(/[\s,]+/).filter(Boolean)[0] || "";
    if (override)
        return override.toLowerCase();
    const base = getBaseDomain(env2);
    const dns = getDnsRecordName(env2);
    if (base && dns && base !== dns && base.startsWith(dns + "."))
        return base;
    return toFqdn(dns, base).toLowerCase();
}

var zoneInfoCaches = /* @__PURE__ */ new Map();

async function resolveZoneInfo(env2, force = false, host = "") {
    const envZone = envStr(env2, "CF_ZONE_ID");
    const envAccount = envStr(env2, "CF_ACCOUNT_ID");
    const base = getBaseDomain(env2);
    const target = String(host || getUserDomain(env2) || base || "").toLowerCase().replace(/^\.+|\.+$/g, "").replace(/:\d+$/, "");
    if (envZone && envAccount)
        return { zoneId: envZone, accountId: envAccount, zoneName: target || base, base: target || base, host: target, error: "", from: "env" };
    const cached = zoneInfoCaches.get(target);
    if (!force && cached && Date.now() - cached.at < 6e5)
        return cached;
    const token = getCFApiToken(env2);
    if (!target)
        return { zoneId: envZone, accountId: envAccount, zoneName: "", base, host: "", error: "\u672A\u914D\u7F6E BASE_DOMAIN / USER_DOMAIN", from: "none" };
    if (!token)
        return { zoneId: envZone, accountId: envAccount, zoneName: target, base: target, host: target, error: "\u672A\u914D\u7F6E CF_API_TOKEN", from: "none" };
    try {
        const { zone, error: error3 } = await findZoneForHost(env2, target);
        const info3 = {
            at: Date.now(),
            base: target,
            host: target,
            zoneId: envZone || zone && zone.id || "",
            accountId: envAccount || zone && zone.account && zone.account.id || "",
            zoneName: zone && zone.name || target,
            error: zone ? "" : error3 || "\u672A\u627E\u5230\u8BE5\u57DF\u540D\u6240\u5C5E\u533A\u57DF",
            from: envZone ? "env+api" : "api"
        };
        zoneInfoCaches.set(target, info3);
        return info3;
    }
    catch (e) {
        return { zoneId: envZone, accountId: envAccount, zoneName: target, base: target, host: target, error: String(e?.message || e), from: "none" };
    }
}

function invalidateZoneInfoCache() {
    zoneInfoCaches.clear();
}

export { getUserDomain, getStatsHost, zoneInfoCaches, resolveZoneInfo, invalidateZoneInfoCache };
