// Baseline: 4e0357e. Edition-specific behavior is intentionally retained.
import { getCFApiToken } from "./../auth/session.js";

async function getOptimizedDomains(env2) {
    const { results } = await env2.DB.prepare("SELECT * FROM optimized_domains ORDER BY is_builtin DESC, name ASC").all();
    return results.map((r) => ({
        id: r.id,
        domain: r.domain,
        name: r.name,
        isBuiltin: Boolean(r.is_builtin),
        createdAt: r.created_at,
        updatedAt: r.updated_at
    }));
}

async function addOptimizedDomain(env2, domain2, name) {
    const result = await env2.DB.prepare("INSERT INTO optimized_domains (domain, name, is_builtin) VALUES (?, ?, 0)").bind(domain2, name).run();
    return result.success;
}

function normalizeDomain(v) {
    const d = String(v || "").trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0].split(":")[0];
    return /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(d) ? d : "";
}

async function updateOptimizedDomain(env2, id, domain2, name) {
    const result = await env2.DB.prepare("UPDATE optimized_domains SET domain = ?, name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND is_builtin = 0").bind(domain2, name, id).run();
    return Boolean(result.meta && result.meta.changes);
}

async function deleteOptimizedDomain(env2, id) {
    const result = await env2.DB.prepare("DELETE FROM optimized_domains WHERE id = ? AND is_builtin = 0").bind(id).run();
    return Boolean(result.meta && result.meta.changes);
}

async function getDNSConfig(env2) {
    const { results } = await env2.DB.prepare("SELECT * FROM dns_config ORDER BY id DESC LIMIT 1").all();
    if (results.length > 0) {
        return {
            id: results[0].id,
            dnsName: results[0].dns_name,
            currentDomain: results[0].current_domain,
            zoneId: results[0].zone_id,
            createdAt: results[0].created_at,
            updatedAt: results[0].updated_at
        };
    }
    return null;
}

async function saveDNSConfig(env2, dnsName, currentDomain, zoneId) {
    const existing = await getDNSConfig(env2);
    let result;
    if (existing) {
        result = await env2.DB.prepare("UPDATE dns_config SET dns_name = ?, current_domain = ?, zone_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(dnsName, currentDomain || "", zoneId || "", existing.id).run();
    }
    else {
        result = await env2.DB.prepare("INSERT INTO dns_config (dns_name, current_domain, zone_id) VALUES (?, ?, ?)").bind(dnsName, currentDomain || "", zoneId || "").run();
    }
    return result.success;
}

async function cloudflareAPICall(env2, method, endpoint, body = null) {
    const apiToken = getCFApiToken(env2);
    const zoneId = env2.CF_ZONE_ID;
    const accountId = env2.CF_ACCOUNT_ID;
    const dnsRecordName = env2.DNS_RECORD_NAME;
    if (!apiToken) {
        return { success: false, error: "CF_API_TOKEN not configured" };
    }
    const url = `https://api.cloudflare.com/client/v4${endpoint}`;
    const headers = {
        "Authorization": "Bearer " + apiToken,
        "Content-Type": "application/json"
    };
    const options = {
        method,
        headers
    };
    if (body) {
        options.body = JSON.stringify(body);
    }
    try {
        const response = await fetch(url, options);
        const data = await response.json();
        return data;
    }
    catch (error3) {
        return { success: false, error: error3.message };
    }
}

async function getZones(env2) {
    const accountId = env2.CF_ACCOUNT_ID;
    const endpoint = accountId ? "/zones?per_page=50&account.id=" + accountId : "/zones?per_page=50";
    return await cloudflareAPICall(env2, "GET", endpoint);
}

async function getDNSRecords(env2, zoneId) {
    return await cloudflareAPICall(env2, "GET", `/zones/${zoneId}/dns_records?per_page=100`);
}

function detectRecordType(content) {
    const v = String(content || "").trim();
    if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(v))
        return "A";
    if (v.includes(":") && /^[0-9a-fA-F:]+$/.test(v))
        return "AAAA";
    return "CNAME";
}

export { getOptimizedDomains, addOptimizedDomain, normalizeDomain, updateOptimizedDomain, deleteOptimizedDomain, getDNSConfig, saveDNSConfig, cloudflareAPICall, getZones, getDNSRecords, detectRecordType };
