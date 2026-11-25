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

async function readJson(request, { limit = 2 * 1024 * 1024, timeoutMs = 5000 } = {}) {
    if (!request.body) return null;
    const declared = request.headers.get('Content-Length');
    if (/^\d+$/.test(declared || '') && Number(declared) > limit) {
        void request.body.cancel().catch(() => {});
        return null;
    }
    const reader = request.body.getReader();
    const chunks = [];
    let bytes = 0;
    const deadline = Date.now() + timeoutMs;
    try {
        while (true) {
            let timer;
            let part;
            try {
                part = await Promise.race([reader.read(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('JSON body timed out')), Math.max(1, deadline - Date.now())); })]);
            } finally { clearTimeout(timer); }
            if (part.done) break;
            bytes += part.value.byteLength;
            if (bytes > limit) {
                void reader.cancel().catch(() => {});
                return null;
            }
            chunks.push(part.value);
        }
        const body = new Uint8Array(bytes);
        let offset = 0;
        for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
        return JSON.parse(new TextDecoder().decode(body));
    }
    catch {
        void reader.cancel().catch(() => {});
        return null;
    }
    finally { reader.releaseLock(); }
}

var ROUTE_CACHE_TTL = 3e4;

export { normalizePrefix, splitTargets, normalizeDnsTarget, validatePrefix, readJson, ROUTE_CACHE_TTL };
