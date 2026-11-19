// Baseline: 4e0357e. Edition-specific behavior is intentionally retained.
import { getBaseDomain } from "./../../../shared/auth/session.js";
import { cloudflareAPICall, detectRecordType, getDNSRecords, saveDNSConfig } from "./../../../shared/integrations/dns.js";

async function createOrUpdateDNSRecord(env2, zoneId, dnsName, targetDomain, rootDomain, opts = {}) {
    if (!zoneId)
        zoneId = env2.CF_ZONE_ID;
    const baseDomain = rootDomain || getBaseDomain(env2) || "";
    const rawName = String(dnsName || "").trim().replace(/^\.+|\.+$/g, "");
    const recordHost = rawName === "@" ? baseDomain : rawName;
    const fullDNSName = recordHost === baseDomain ? baseDomain : baseDomain && !recordHost.endsWith("." + baseDomain) ? `${recordHost}.${baseDomain}` : recordHost;
    const recordsResult = await getDNSRecords(env2, zoneId);
    if (!recordsResult.success) {
        return recordsResult;
    }
    const recordType = detectRecordType(targetDomain);
    const proxied = opts.proxied === true;
    const recordData = {
        type: recordType,
        name: fullDNSName,
        content: targetDomain,
        ttl: 1,
        proxied: recordType === "CNAME" || recordType === "A" || recordType === "AAAA" ? proxied : false
    };
    const sameType = recordsResult.result.filter((r) => r.name === fullDNSName && ["A", "AAAA", "CNAME"].includes(r.type));
    if (!opts.forceRecreate && sameType.length === 1 && sameType[0].type === recordType) {
        const upd = await cloudflareAPICall(env2, "PUT", `/zones/${zoneId}/dns_records/${sameType[0].id}`, recordData);
        if (upd.success) {
            if (opts.saveConfig !== false)
                await saveDNSConfig(env2, dnsName, targetDomain, zoneId);
            return upd;
        }
    }
    const oldRecords = recordsResult.result.filter((r) => r.name === fullDNSName && ["A", "AAAA", "CNAME"].includes(r.type));
    for (const old of oldRecords) {
        const delResult = await cloudflareAPICall(env2, "DELETE", `/zones/${zoneId}/dns_records/${old.id}`);
        if (!delResult.success) {
            return { success: false, error: "\u5220\u9664\u65E7\u8BB0\u5F55\u5931\u8D25: " + (delResult.errors?.[0]?.message || "\u672A\u77E5\u9519\u8BEF") };
        }
    }
    let result = await cloudflareAPICall(env2, "POST", `/zones/${zoneId}/dns_records`, recordData);
    if (!result.success) {
        const rollbackFailed = [];
        for (const old of oldRecords) {
            const rb = await cloudflareAPICall(env2, "POST", `/zones/${zoneId}/dns_records`, {
                type: old.type,
                name: old.name,
                content: old.content,
                ttl: old.ttl || 1,
                proxied: Boolean(old.proxied)
            });
            if (!rb.success)
                rollbackFailed.push(old.name + " (" + old.type + ")");
        }
        let errMsg = result.errors?.[0]?.message || "\u521B\u5EFA\u65B0\u8BB0\u5F55\u5931\u8D25";
        if (rollbackFailed.length) {
            errMsg += "\uFF1B\u56DE\u6EDA\u5931\u8D25\uFF0C\u4EE5\u4E0B\u539F\u8BB0\u5F55\u672A\u80FD\u6062\u590D\uFF0C\u8BF7\u624B\u52A8\u5904\u7406: " + rollbackFailed.join(", ");
        }
        else if (oldRecords.length) {
            errMsg += "\uFF08\u539F\u8BB0\u5F55\u5DF2\u81EA\u52A8\u6062\u590D\uFF09";
        }
        return { success: false, error: errMsg, errors: result.errors };
    }
    if (opts.saveConfig !== false)
        await saveDNSConfig(env2, dnsName, targetDomain, zoneId);
    return result;
}

export { createOrUpdateDNSRecord };
