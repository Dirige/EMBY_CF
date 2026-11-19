// Baseline: 4e0357e. Edition-specific behavior is intentionally retained.
import { RESERVED_ALIASES } from "./../http/primitives.js";

function normalizePrefix(p) {
    return String(p || "").trim().toLowerCase().replace(/^\/+|\/+$/g, "");
}

function splitTargets(raw) {
    return String(raw == null ? "" : raw).split(/[\r\n,]+/).map((x) => x.trim()).filter(Boolean);
}

function normalizeDnsTarget(v) {
    let s = String(v == null ? "" : v).trim();
    s = s.replace(/^https?:\/\//i, "").split("/")[0].split("?")[0].split("#")[0];
    return s.replace(/^\.+|\.+$/g, "").toLowerCase();
}

function validatePrefix(prefix) {
    const a = normalizePrefix(prefix);
    if (!a || !/^[a-z0-9][a-z0-9_-]{0,62}$/i.test(a))
        return "路径仅允许字母数字、下划线和连字符";
    if (RESERVED_ALIASES.has(a.toLowerCase()))
        return "该路径为系统保留，不可使用";
    return null;
}

async function readJson(request) {
    try {
        return await request.json();
    }
    catch {
        return null;
    }
}

var ROUTE_CACHE_TTL = 3e4;

export { normalizePrefix, splitTargets, normalizeDnsTarget, validatePrefix, readJson, ROUTE_CACHE_TTL };
