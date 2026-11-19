// Baseline: 4e0357e. Edition-specific behavior is intentionally retained.
import { getStatsHost, getUserDomain, resolveZoneInfo } from "./../integrations/zone.js";
import { getBaseDomain, toFqdn } from "./../../../shared/auth/session.js";
import { DEFAULT_USER_DNS_TARGET } from "./../storage/schema.js";
import { detectRecordType, getDNSRecords } from "./../../../shared/integrations/dns.js";
import { createOrUpdateDNSRecord } from "./../integrations/dns.js";
import { auditLog } from "./../../../shared/observability/audit.js";
import { getUserById } from "./../auth/session.js";

function userEntryHost(env2, user) {
    const root = getUserDomain(env2) || getBaseDomain(env2);
    const sub = user && user.subdomain || user && user.username || "";
    return toFqdn(sub, root);
}

function isValidIPv4(v) {
    const parts = String(v || "").split(".");
    if (parts.length !== 4)
        return false;
    return parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) >= 0 && Number(p) <= 255);
}

function isValidDnsValue(v) {
    const s = String(v || "").trim().replace(/\.$/, "");
    if (!s || s.length > 253)
        return false;
    if (isValidIPv4(s))
        return true;
    if (s.includes(":"))
        return /^[0-9a-f:]+$/i.test(s) && s.split(":").length <= 9;
    return /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(s);
}

async function provisionUserDns(env2, user) {
    try {
        const root = getUserDomain(env2) || getBaseDomain(env2);
        if (!root)
            return { ok: false, error: "\u672A\u914D\u7F6E BASE_DOMAIN / USER_DOMAIN" };
        const info3 = await resolveZoneInfo(env2, false, root);
        if (!info3.zoneId)
            return { ok: false, error: info3.error || "\u672A\u89E3\u6790\u5230 Cloudflare Zone\uFF0C\u8BF7\u68C0\u67E5 CF_API_TOKEN" };
        const entryHost = userEntryHost(env2, user);
        const target = DEFAULT_USER_DNS_TARGET;
        if (!isValidDnsValue(target))
            return { ok: false, error: "\u9ED8\u8BA4 DNS \u76EE\u6807\u4E0D\u5408\u6CD5" };
        if (entryHost === target)
            return { ok: false, error: "DNS \u76EE\u6807\u4E0D\u80FD\u4E0E\u5165\u53E3\u57DF\u540D\u76F8\u540C" };
        const existing = await getDNSRecords(env2, info3.zoneId);
        if (existing.success && Array.isArray(existing.result)) {
            const same = existing.result.filter((r) => r.name === entryHost.toLowerCase() && ["A", "AAAA", "CNAME"].includes(r.type));
            const isOurs = same.length === 1 && same[0].type === "CNAME" && String(same[0].content).toLowerCase() === target.toLowerCase();
            if (same.length && !isOurs) {
                return { ok: false, error: "\u5B50\u57DF\u540D " + entryHost + " \u5DF2\u5B58\u5728 DNS \u8BB0\u5F55\uFF08" + same.map((r) => r.type + " " + r.content).join("\u3001") + "\uFF09\uFF0C\u672A\u81EA\u52A8\u8986\u76D6\uFF0C\u8BF7\u624B\u52A8\u5904\u7406" };
            }
        }
        const result = await createOrUpdateDNSRecord(env2, info3.zoneId, user.subdomain || user.username, target, root, { proxied: false, saveConfig: false });
        if (!result.success)
            return { ok: false, error: result.error || result.errors?.[0]?.message || "DNS \u521B\u5EFA\u5931\u8D25" };
        await auditLog(env2, "user.dns", user.username + " -> " + entryHost + " = " + target + "\uFF08\u81EA\u52A8\uFF09");
        return { ok: true, entryHost, target, type: result.result?.type || "CNAME" };
    }
    catch (e) {
        return { ok: false, error: String(e?.message || e) };
    }
}

async function userUpdateDns(env2, session, target) {
    const user = await getUserById(env2, session.uid);
    if (!user)
        return { error: "\u7528\u6237\u4E0D\u5B58\u5728" };
    const value = String(target || "").trim().replace(/\.$/, "");
    if (!value)
        return { error: "\u8BF7\u8F93\u5165 IP \u6216\u57DF\u540D" };
    if (!isValidDnsValue(value))
        return { error: "DNS \u503C\u5FC5\u987B\u662F\u5408\u6CD5\u7684 IPv4 / IPv6 \u5730\u5740\u6216\u57DF\u540D" };
    const root = getUserDomain(env2) || getBaseDomain(env2);
    if (!root)
        return { error: "\u672A\u914D\u7F6E BASE_DOMAIN / USER_DOMAIN" };
    const entryHost = userEntryHost(env2, user);
    if (value.toLowerCase() === entryHost.toLowerCase())
        return { error: "DNS \u503C\u4E0D\u80FD\u6307\u5411\u5165\u53E3\u57DF\u540D\u81EA\u8EAB" };
    const info3 = await resolveZoneInfo(env2, false, root);
    if (!info3.zoneId)
        return { error: info3.error || "\u672A\u89E3\u6790\u5230 Cloudflare Zone\uFF0C\u8BF7\u68C0\u67E5 CF_API_TOKEN" };
    const result = await createOrUpdateDNSRecord(env2, info3.zoneId, user.subdomain || user.username, value, root, { proxied: false, saveConfig: false, forceRecreate: true });
    if (!result.success)
        return { error: result.error || result.errors?.[0]?.message || "DNS \u66F4\u65B0\u5931\u8D25", errors: result.errors };
    await auditLog(env2, "user.dns", user.username + " -> " + entryHost + " = " + value);
    return { ok: true, entryHost, target: value, type: result.result?.type || detectRecordType(value), proxied: false, result: result.result };
}

async function userEnsureDNS(env2, session) {
    const user = await getUserById(env2, session.uid);
    if (!user)
        return { error: "\u7528\u6237\u4E0D\u5B58\u5728" };
    const root = getUserDomain(env2) || getBaseDomain(env2);
    if (!root)
        return { error: "\u672A\u914D\u7F6E BASE_DOMAIN / USER_DOMAIN" };
    const entryHost = userEntryHost(env2, user);
    const current = await userDnsInfo(env2, session);
    let target = current && current.record && current.record.content ? current.record.content : DEFAULT_USER_DNS_TARGET;
    if (target === entryHost)
        target = root;
    if (target === entryHost)
        return { error: "\u5165\u53E3\u57DF\u540D\u4E0E\u76EE\u6807\u76F8\u540C\uFF0C\u65E0\u6CD5\u521B\u5EFA CNAME" };
    if (!isValidDnsValue(target))
        return { error: "\u5F53\u524D DNS \u503C\u4E0D\u5408\u6CD5\uFF0C\u8BF7\u5148\u4FDD\u5B58\u65B0\u7684 IP \u6216\u57DF\u540D" };
    const info3 = await resolveZoneInfo(env2, false, root);
    if (!info3.zoneId)
        return { error: info3.error || "\u672A\u89E3\u6790\u5230 Cloudflare Zone\uFF0C\u8BF7\u68C0\u67E5 CF_API_TOKEN" };
    const result = await createOrUpdateDNSRecord(env2, info3.zoneId, user.subdomain || user.username, target, root, { proxied: false, saveConfig: false });
    if (!result.success)
        return { error: result.error || result.errors?.[0]?.message || "DNS \u521B\u5EFA\u5931\u8D25", errors: result.errors };
    await auditLog(env2, "user.dns", user.username + " -> " + entryHost);
    return { ok: true, entryHost, target, type: result.result?.type || "CNAME", proxied: false, result: result.result };
}

async function userDnsInfo(env2, session) {
    const user = await getUserById(env2, session.uid);
    if (!user)
        return { error: "\u7528\u6237\u4E0D\u5B58\u5728" };
    const entryHost = userEntryHost(env2, user);
    const root = getUserDomain(env2) || getBaseDomain(env2);
    const info3 = await resolveZoneInfo(env2, false, root);
    let record = null;
    if (info3.zoneId) {
        try {
            const rr = await getDNSRecords(env2, info3.zoneId);
            if (rr.success && Array.isArray(rr.result)) {
                const rec = rr.result.find((r) => ["A", "AAAA", "CNAME"].includes(r.type) && r.name === entryHost);
                if (rec)
                    record = { type: rec.type, name: rec.name, content: rec.content, proxied: rec.proxied, modifiedOn: rec.modified_on };
            }
        }
        catch (_) {
        }
    }
    return { ok: true, entryHost, baseDomain: getBaseDomain(env2), userDomain: getUserDomain(env2), statsHost: getStatsHost(env2), defaultTarget: DEFAULT_USER_DNS_TARGET, zoneId: info3.zoneId || "", zoneError: info3.error || "", record };
}

export { userEntryHost, isValidIPv4, isValidDnsValue, provisionUserDns, userUpdateDns, userEnsureDNS, userDnsInfo };
