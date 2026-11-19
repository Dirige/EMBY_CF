// Baseline: 4e0357e. Edition-specific behavior is intentionally retained.
import { getShanghaiParts } from "./../../../shared/http/primitives.js";
import { routesHasUserId } from "./routes.js";
import { clearUserCache, entryNameError, getUserById, getUserByUsername, hashPassword, publicUser, randomHex, rowToUser, sanitizeSubdomain, sanitizeUsername } from "./../auth/session.js";
import { DEFAULT_USER_ROUTE_LIMIT, RESERVED_SUBDOMAINS } from "./../storage/schema.js";
import { auditLog } from "./../../../shared/observability/audit.js";
import { provisionUserDns } from "./dns.js";
import { escapeLike } from "./../integrations/stats.js";
import { clearRouteCache } from "./../proxy/routes.js";
import { clearStatsBuffers } from "./../integrations/analytics.js";

async function adminListUsers(env2) {
    const today = getShanghaiParts().dateKey;
    const hasLegacy = await routesHasUserId(env2);
    const rcSql = hasLegacy ? `LEFT JOIN (
         SELECT owner, COUNT(DISTINCT prefix) AS cnt FROM (
           SELECT owner, prefix FROM user_routes
           UNION
           SELECT u2.username AS owner, r.prefix FROM routes r JOIN users u2 ON u2.id = r.user_id
         ) GROUP BY owner
       ) rc ON rc.owner = u.username` : `LEFT JOIN (SELECT owner, COUNT(*) AS cnt FROM user_routes GROUP BY owner) rc ON rc.owner = u.username`;
    const { results } = await env2.DB.prepare(`SELECT u.*, COALESCE(s.req, 0) AS today_req, COALESCE(s.bytes, 0) AS today_bytes,
            COALESCE(rc.cnt, 0) AS route_count
     FROM users u
     LEFT JOIN (
       SELECT substr(prefix, 1, instr(prefix, '/') - 1) AS owner,
              SUM(request_count) AS req, SUM(traffic_bytes) AS bytes
       FROM route_stats_daily
       WHERE bucket_date = ? AND instr(prefix, '/') > 0
       GROUP BY owner
     ) s ON s.owner = u.username
     ${rcSql}
     ORDER BY u.id`).bind(today).all();
    return (results || []).map((r) => ({
        ...publicUser(rowToUser(r)),
        todayRequests: Number(r.today_req) || 0,
        todayTraffic: Number(r.today_bytes) || 0,
        routeCount: Number(r.route_count) || 0
    }));
}

async function adminCreateUser(env2, data, actor) {
    const username = sanitizeUsername(data.username);
    const password = String(data.password || "");
    const subdomain = sanitizeSubdomain(data.subdomain) || sanitizeSubdomain(username);
    const role = data.role === "admin" ? "admin" : "user";
    const status = data.status === "disabled" ? "disabled" : "active";
    const routeLimit = Math.max(1, Math.min(200, parseInt(data.route_limit, 10) || DEFAULT_USER_ROUTE_LIMIT));
    if (!username)
        return { error: "\u7528\u6237\u540D\u9700\u4E3A 3-32 \u4F4D\u5C0F\u5199\u5B57\u6BCD\u3001\u6570\u5B57\u6216\u77ED\u6A2A\u7EBF\uFF0C\u4E14\u4E0D\u80FD\u4EE5\u77ED\u6A2A\u7EBF\u5F00\u5934/\u7ED3\u5C3E" };
    if (password.length < 6)
        return { error: "\u5BC6\u7801\u81F3\u5C11 6 \u4F4D" };
    if (!subdomain)
        return { error: "\u5B50\u57DF\u540D\u4E0D\u5408\u6CD5" };
    const entryErr = entryNameError(env2, subdomain);
    if (entryErr)
        return { error: entryErr };
    const exists = await env2.DB.prepare("SELECT 1 AS x FROM users WHERE username = ? OR subdomain = ?").bind(username, subdomain).first();
    if (exists)
        return { error: "\u7528\u6237\u540D\u6216\u5B50\u57DF\u540D\u5DF2\u88AB\u5360\u7528" };
    const salt = randomHex(16);
    const hash = await hashPassword(password, salt);
    const nowIso = ( /* @__PURE__ */new Date()).toISOString();
    let created = null;
    try {
        const res = await env2.DB.prepare("INSERT INTO users (username, password_hash, salt, role, status, subdomain, route_limit, created_at, last_login) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(username, hash, salt, role, status, subdomain, routeLimit, nowIso, "").run();
        clearUserCache();
        await auditLog(env2, "user.create", actor + " -> " + username + " / " + subdomain);
        created = { id: res.meta?.last_row_id, username, role, status, subdomain, routeLimit };
    }
    catch (e) {
        return { error: /UNIQUE/i.test(String(e?.message)) ? "\u7528\u6237\u540D\u6216\u5B50\u57DF\u540D\u5DF2\u88AB\u5360\u7528" : "\u521B\u5EFA\u5931\u8D25" };
    }
    const user = await getUserByUsername(env2, username);
    const dns = user ? await provisionUserDns(env2, user) : { ok: false, error: "\u8BFB\u53D6\u7528\u6237\u5931\u8D25" };
    return dns.ok ? { user: created, dns: { entryHost: dns.entryHost, target: dns.target, type: dns.type } } : { user: created, dnsWarning: dns.error };
}

async function adminUpdateUser(env2, id, data, actor) {
    const user = await getUserById(env2, id);
    if (!user)
        return { error: "\u7528\u6237\u4E0D\u5B58\u5728" };
    const fields = [];
    const changed = [];
    const args = [];
    let subdomain = user.subdomain;
    if (data.subdomain !== void 0) {
        subdomain = sanitizeSubdomain(data.subdomain) || sanitizeSubdomain(user.username);
        if (!subdomain)
            return { error: "\u5B50\u57DF\u540D\u4E0D\u5408\u6CD5" };
        if (RESERVED_SUBDOMAINS.has(subdomain))
            return { error: "\u8BE5\u5B50\u57DF\u540D\u4E0D\u53EF\u7528" };
        const clash = await env2.DB.prepare("SELECT 1 AS x FROM users WHERE subdomain = ? AND id <> ?").bind(subdomain, id).first();
        if (clash)
            return { error: "\u5B50\u57DF\u540D\u5DF2\u88AB\u5360\u7528" };
        fields.push("subdomain = ?");
        changed.push("subdomain");
        args.push(subdomain);
    }
    if (data.role !== void 0) {
        fields.push("role = ?");
        changed.push("role");
        args.push(data.role === "admin" ? "admin" : "user");
    }
    if (data.status !== void 0) {
        fields.push("status = ?");
        changed.push("status");
        args.push(data.status === "disabled" ? "disabled" : "active");
    }
    if (data.route_limit !== void 0) {
        const limit = Math.max(1, Math.min(200, parseInt(data.route_limit, 10) || DEFAULT_USER_ROUTE_LIMIT));
        fields.push("route_limit = ?");
        changed.push("route_limit");
        args.push(limit);
    }
    if (data.password) {
        if (String(data.password).length < 6)
            return { error: "\u5BC6\u7801\u81F3\u5C11 6 \u4F4D" };
        const salt = randomHex(16);
        fields.push("password_hash = ?", "salt = ?");
        changed.push("password");
        args.push(await hashPassword(String(data.password), salt), salt);
    }
    if (!fields.length)
        return { error: "\u6CA1\u6709\u9700\u8981\u66F4\u65B0\u7684\u5B57\u6BB5" };
    args.push(id);
    await env2.DB.prepare("UPDATE users SET " + fields.join(", ") + " WHERE id = ?").bind(...args).run();
    clearUserCache();
    await auditLog(env2, "user.update", actor + " -> " + user.username + " (" + changed.join(",") + ")");
    const updated = await getUserById(env2, id);
    return { user: publicUser(updated) };
}

async function adminDeleteUser(env2, id, actor) {
    const user = await getUserById(env2, id);
    if (!user)
        return { error: "\u7528\u6237\u4E0D\u5B58\u5728" };
    await env2.DB.batch([
        env2.DB.prepare("DELETE FROM user_routes WHERE owner = ?").bind(user.username),
        env2.DB.prepare("DELETE FROM user_stats_hourly WHERE owner = ?").bind(user.username),
        env2.DB.prepare("DELETE FROM route_stats_daily WHERE prefix LIKE ? ESCAPE '!'").bind(escapeLike(user.username) + "/%"),
        env2.DB.prepare("DELETE FROM users WHERE id = ?").bind(id)
    ]);
    clearUserCache();
    clearRouteCache();
    await auditLog(env2, "user.delete", actor + " -> " + user.username);
    return { ok: true };
}

async function adminResetData(env2, data, actor) {
    if (String(data.confirm || "") !== "RESET")
        return { error: "\u8BF7\u8F93\u5165 RESET \u786E\u8BA4" };
    const scope = String(data.scope || "stats");
    const jobs = [];
    if (scope === "stats" || scope === "all") {
        jobs.push(env2.DB.prepare("DELETE FROM proxy_stats_hourly"), env2.DB.prepare("DELETE FROM route_stats_daily"), env2.DB.prepare("DELETE FROM user_stats_hourly"), env2.DB.prepare("DELETE FROM route_health"), env2.DB.prepare("DELETE FROM audit_log"));
        clearStatsBuffers();
    }
    if (scope === "users" || scope === "all") {
        jobs.push(env2.DB.prepare("DELETE FROM user_routes"), env2.DB.prepare("DELETE FROM user_stats_hourly"), env2.DB.prepare("DELETE FROM route_stats_daily WHERE instr(prefix, '/') > 0"), env2.DB.prepare("DELETE FROM invite_codes"), env2.DB.prepare("DELETE FROM users"));
        clearUserCache();
        clearRouteCache();
    }
    if (!jobs.length)
        return { error: "\u672A\u77E5\u7684\u6E05\u7406\u8303\u56F4" };
    await env2.DB.batch(jobs);
    await auditLog(env2, "db.reset", actor + " -> " + scope);
    return { ok: true, scope };
}

export { adminListUsers, adminCreateUser, adminUpdateUser, adminDeleteUser, adminResetData };
