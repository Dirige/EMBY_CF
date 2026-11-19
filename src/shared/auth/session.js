// Baseline: 4e0357e. Edition-specific behavior is intentionally retained.
import { cloudflareAPICall } from "./../integrations/dns.js";

function getCookie(req, name) {
    const s = req.headers.get("Cookie");
    if (!s)
        return null;
    const m = s.match(new RegExp("(?:^|;\\s*)" + name + "=([^;]+)"));
    if (!m)
        return null;
    try {
        return decodeURIComponent(m[1]);
    }
    catch {
        return null;
    }
}

function getAdminToken(env2) {
    const raw = env2.ADMIN_TOKEN ?? env2.ADMIN_PASSWORD ?? env2.admin_token ?? env2.AdminToken;
    if (raw == null)
        return null;
    const t = String(raw).trim();
    return t.length ? t : null;
}

function envStr(env2, ...keys) {
    for (const k of keys) {
        const v = env2 && env2[k];
        if (v !== void 0 && v !== null && String(v).trim() !== "")
            return String(v).trim();
    }
    return "";
}

function getBaseDomain(env2) {
    return envStr(env2, "BASE_DOMAIN", "CF_DOMAIN").toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/:\d+$/, "").replace(/^\.+|\.+$/g, "");
}

function getDnsRecordName(env2) {
    return envStr(env2, "DNS_RECORD_NAME").replace(/^\.+|\.+$/g, "").toLowerCase();
}

function toFqdn(name, root) {
    const n = String(name || "").trim().toLowerCase().replace(/^\.+|\.+$/g, "");
    const r = String(root || "").trim().toLowerCase().replace(/^\.+|\.+$/g, "");
    if (!n || n === "@")
        return r;
    if (!r)
        return n;
    if (n === r || n.endsWith("." + r))
        return n;
    return n + "." + r;
}

function getCFApiToken(env2) {
    return envStr(env2, "CF_API_TOKEN", "CF_DNS_API_TOKEN", "CF_ANALYTICS_TOKEN");
}

function getTelegramToken(env2) {
    return envStr(env2, "TELEGRAM_BOT_TOKEN", "TG_BOT_TOKEN");
}

function getTelegramChatId(env2) {
    return envStr(env2, "TELEGRAM_CHAT_ID", "TG_CHAT_ID");
}

async function findZoneForHost(env2, host) {
    const h = String(host || "").toLowerCase().replace(/^\.+|\.+$/g, "");
    if (!h)
        return { zone: null, error: "域名为空" };
    const exact = await cloudflareAPICall(env2, "GET", "/zones?name=" + encodeURIComponent(h) + "&per_page=1");
    if (exact && exact.success && Array.isArray(exact.result) && exact.result[0]) {
        return { zone: exact.result[0], error: "" };
    }
    const lastError = exact && (exact.errors && exact.errors[0] && exact.errors[0].message || exact.error) || "";
    const list = await cloudflareAPICall(env2, "GET", "/zones?per_page=50");
    if (!list || !list.success || !Array.isArray(list.result)) {
        return { zone: null, error: list && (list.errors && list.errors[0] && list.errors[0].message || list.error) || lastError || "读取区域列表失败（检查 Token 是否有 Zone:Read 权限）" };
    }
    let best = null;
    for (const z of list.result) {
        const name = String(z && z.name || "").toLowerCase();
        if (!name)
            continue;
        if (h === name || h.endsWith("." + name)) {
            if (!best || name.length > String(best.name).length)
                best = z;
        }
    }
    return { zone: best, error: best ? "" : lastError || "未找到该域名所属区域" };
}

var SESSION_COOKIE = "admin_session";

function toHex(buf) {
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

var LOGIN_MAX_FAILS = 5;

var LOGIN_WINDOW_MS = 10 * 60 * 1e3;

function logoutResponse() {
    return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Set-Cookie": `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict; Secure`,
            "Cache-Control": "no-store"
        }
    });
}

export { getCookie, getAdminToken, envStr, getBaseDomain, getDnsRecordName, toFqdn, getCFApiToken, getTelegramToken, getTelegramChatId, findZoneForHost, SESSION_COOKIE, toHex, LOGIN_MAX_FAILS, LOGIN_WINDOW_MS, logoutResponse };
