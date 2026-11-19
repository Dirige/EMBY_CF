// Baseline: 4e0357e. Edition-specific behavior is intentionally retained.
import { getBaseDomain } from "./../../../shared/auth/session.js";
import { cloudflareAPICall, detectRecordType, getDNSRecords, saveDNSConfig } from "./../../../shared/integrations/dns.js";

async function createOrUpdateDNSRecord(env2, zoneId, dnsName, targetDomain, rootDomain) {
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
    const recordData = {
        type: recordType,
        name: fullDNSName,
        content: targetDomain,
        ttl: 1,
        proxied: false
    };
    const sameType = recordsResult.result.filter((r) => r.name === fullDNSName && ["A", "AAAA", "CNAME"].includes(r.type));
    if (sameType.length === 1 && sameType[0].type === recordType) {
        const upd = await cloudflareAPICall(env2, "PUT", `/zones/${zoneId}/dns_records/${sameType[0].id}`, recordData);
        if (upd.success) {
            await saveDNSConfig(env2, dnsName, targetDomain, zoneId);
            return upd;
        }
    }
    const oldRecords = recordsResult.result.filter((r) => r.name === fullDNSName && ["A", "AAAA", "CNAME"].includes(r.type));
    for (const old of oldRecords) {
        const delResult = await cloudflareAPICall(env2, "DELETE", `/zones/${zoneId}/dns_records/${old.id}`);
        if (!delResult.success) {
            return { success: false, error: "删除旧记录失败: " + (delResult.errors?.[0]?.message || "未知错误") };
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
        let errMsg = result.errors?.[0]?.message || "创建新记录失败";
        if (rollbackFailed.length) {
            errMsg += "；回滚失败，以下原记录未能恢复，请手动处理: " + rollbackFailed.join(", ");
        }
        else if (oldRecords.length) {
            errMsg += "（原记录已自动恢复）";
        }
        return { success: false, error: errMsg, errors: result.errors };
    }
    await saveDNSConfig(env2, dnsName, targetDomain, zoneId);
    return result;
}

export { createOrUpdateDNSRecord };
