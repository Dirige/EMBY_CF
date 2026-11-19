// Baseline: 4e0357e. Edition-specific behavior is intentionally retained.
import { envStr, findZoneForHost, getBaseDomain, getCFApiToken, getDnsRecordName, toFqdn } from "./../../../shared/auth/session.js";

function getStatsHost(env2) {
    const override = envStr(env2, "STATS_HOSTS").split(/[\s,]+/).filter(Boolean)[0] || "";
    if (override)
        return override.toLowerCase();
    return toFqdn(getDnsRecordName(env2), getBaseDomain(env2)).toLowerCase();
}

var zoneInfoCache = { at: 0, base: "", zoneId: "", accountId: "", zoneName: "", error: "" };

async function resolveZoneInfo(env2, force = false) {
    const envZone = envStr(env2, "CF_ZONE_ID");
    const envAccount = envStr(env2, "CF_ACCOUNT_ID");
    const base = getBaseDomain(env2);
    if (envZone && envAccount)
        return { zoneId: envZone, accountId: envAccount, zoneName: base, base, error: "", from: "env" };
    if (!force && zoneInfoCache && zoneInfoCache.base === base && Date.now() - zoneInfoCache.at < 6e5)
        return zoneInfoCache;
    const token = getCFApiToken(env2);
    if (!base)
        return { zoneId: envZone, accountId: envAccount, zoneName: "", base, error: "未配置 BASE_DOMAIN", from: "none" };
    if (!token)
        return { zoneId: envZone, accountId: envAccount, zoneName: base, base, error: "未配置 CF_API_TOKEN", from: "none" };
    try {
        const { zone, error: error3 } = await findZoneForHost(env2, base);
        const info3 = {
            at: Date.now(),
            base,
            zoneId: envZone || zone && zone.id || "",
            accountId: envAccount || zone && zone.account && zone.account.id || "",
            zoneName: zone && zone.name || base,
            error: zone ? "" : error3 || "未找到该域名所属区域",
            from: envZone ? "env+api" : "api"
        };
        zoneInfoCache = info3;
        return info3;
    }
    catch (e) {
        return { zoneId: envZone, accountId: envAccount, zoneName: base, base, error: String(e?.message || e), from: "none" };
    }
}

function invalidateZoneInfoCache() {
    zoneInfoCache = { at: 0, base: "", zoneId: "", accountId: "", zoneName: "", error: "" };
}

export { getStatsHost, zoneInfoCache, resolveZoneInfo, invalidateZoneInfoCache };
