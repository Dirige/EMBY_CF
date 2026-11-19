// Baseline: 4e0357e. Edition-specific behavior is intentionally retained.
import { getShanghaiParts, normalizeIpMode } from "./../../../shared/http/primitives.js";
import { normalizePrefix, splitTargets } from "./../../../shared/admin/api.js";
import { getUserByUsername } from "./../auth/session.js";
import { clearRouteCache, validateUserPrefix } from "./../proxy/routes.js";
import { isValidHttpUrl, parseHeaderLines, parseIpList, validIpList } from "./../../../shared/http/validation.js";
import { DEFAULT_USER_ROUTE_LIMIT } from "./../storage/schema.js";
import { auditLog } from "./../../../shared/observability/audit.js";

var routesHasUserIdCache = null;

async function routesHasUserId(env2) {
    if (routesHasUserIdCache !== null)
        return routesHasUserIdCache;
    try {
        await env2.DB.prepare("SELECT user_id FROM routes LIMIT 1").first();
        routesHasUserIdCache = true;
    }
    catch (_) {
        routesHasUserIdCache = false;
    }
    return routesHasUserIdCache;
}

async function getUserLegacyRoutes(env2, user, today) {
    if (!user || !await routesHasUserId(env2))
        return [];
    try {
        const { results } = await env2.DB.prepare(`SELECT r.*,
              COALESCE((SELECT SUM(request_count) FROM route_stats_daily
                        WHERE bucket_date = ? AND prefix IN (r.prefix, ? || '/' || r.prefix)), 0) AS today_req,
              COALESCE((SELECT SUM(traffic_bytes) FROM route_stats_daily
                        WHERE bucket_date = ? AND prefix IN (r.prefix, ? || '/' || r.prefix)), 0) AS today_bytes
       FROM routes r
       JOIN (SELECT prefix, MIN(rowid) AS rid FROM routes WHERE user_id = ? GROUP BY prefix) x
         ON x.rid = r.rowid
       WHERE r.user_id = ?
       ORDER BY r.sort_order, r.prefix`).bind(today, user.username, today, user.username, user.id, user.id).all();
        return results || [];
    }
    catch (_) {
        return [];
    }
}

async function getLegacyRouteForUser(env2, user, id, prefix) {
    if (!user || !await routesHasUserId(env2))
        return null;
    try {
        if (id) {
            const row = await env2.DB.prepare("SELECT rowid AS _rid, * FROM routes WHERE id = ? AND user_id = ?").bind(Number(id), user.id).first();
            if (row)
                return row;
        }
    }
    catch (_) {
    }
    try {
        return await env2.DB.prepare("SELECT rowid AS _rid, * FROM routes WHERE user_id = ? AND prefix = ? ORDER BY rowid LIMIT 1").bind(user.id, prefix).first();
    }
    catch (_) {
        return null;
    }
}

async function countUserRoutes(env2, user) {
    if (!user)
        return 0;
    if (await routesHasUserId(env2)) {
        try {
            const c = await env2.DB.prepare("SELECT COUNT(*) AS n FROM (SELECT prefix FROM user_routes WHERE owner = ? UNION SELECT prefix FROM routes WHERE user_id = ?)").bind(user.username, user.id).first();
            return Number(c?.n) || 0;
        }
        catch (_) {
        }
    }
    try {
        const c = await env2.DB.prepare("SELECT COUNT(*) AS n FROM user_routes WHERE owner = ?").bind(user.username).first();
        return Number(c?.n) || 0;
    }
    catch (_) {
        return 0;
    }
}

async function userListRoutes(env2, owner) {
    const today = getShanghaiParts().dateKey;
    const { results } = await env2.DB.prepare(`SELECT r.*, COALESCE(s.request_count, 0) AS today_req, COALESCE(s.traffic_bytes, 0) AS today_bytes
     FROM user_routes r
     LEFT JOIN route_stats_daily s ON s.prefix = ? || '/' || r.prefix AND s.bucket_date = ?
     WHERE r.owner = ?
     ORDER BY r.sort_order, r.prefix`).bind(owner, today, owner).all();
    let health = [];
    try {
        health = (await env2.DB.prepare("SELECT prefix, target, down FROM route_health").all()).results || [];
    }
    catch (_) {
    }
    const downSet = /* @__PURE__ */ new Set();
    for (const h of health)
        if (h.down)
            downSet.add(h.prefix + "|" + h.target);
    const countDown = /* @__PURE__ */ (keyPrefix, target) => splitTargets(target).filter((t) => downSet.has(keyPrefix + "|" + t)).length;
    const user = await getUserByUsername(env2, owner);
    const legacy = await getUserLegacyRoutes(env2, user, today);
    const out = [];
    const seen = /* @__PURE__ */ new Set();
    for (const r of results || []) {
        out.push({ ...r, source: "user", down_count: countDown(owner + "/" + r.prefix, r.target) });
        seen.add(r.prefix);
    }
    for (const r of legacy) {
        if (seen.has(r.prefix))
            continue;
        out.push({ ...r, source: "legacy", down_count: countDown(r.prefix, r.target) });
        seen.add(r.prefix);
    }
    return out;
}

async function userSaveRoute(env2, owner, data) {
    const err = validateUserPrefix(data.prefix);
    if (err)
        return { error: err };
    const prefix = normalizePrefix(data.prefix);
    const oldPrefix = data.oldPrefix ? normalizePrefix(data.oldPrefix) : "";
    const targets = splitTargets(data.target);
    if (!targets.length)
        return { error: "\u8BF7\u81F3\u5C11\u586B\u5199\u4E00\u4E2A\u76EE\u6807\u5730\u5740" };
    const badTarget = targets.find((t) => !isValidHttpUrl(t));
    if (badTarget)
        return { error: "\u76EE\u6807\u5730\u5740\u5FC5\u987B\u662F http(s):// \u5F00\u5934\u7684\u5408\u6CD5 URL\uFF1A" + badTarget };
    const streamTargets = splitTargets(data.stream_target || "");
    const badStreamTarget = streamTargets.find((t) => !isValidHttpUrl(t));
    if (badStreamTarget)
        return { error: "推流地址必须是 http(s):// 开头的合法 URL：" + badStreamTarget };
    const hdrCheck = parseHeaderLines(data.custom_headers);
    if (hdrCheck.error)
        return { error: hdrCheck.error };
    const allowList = parseIpList(data.ip_allow);
    const blockList = parseIpList(data.ip_block);
    if (!validIpList(allowList) || !validIpList(blockList))
        return { error: "IP \u9ED1\u767D\u540D\u5355\u683C\u5F0F\u4E0D\u5408\u6CD5" };
    const user = await getUserByUsername(env2, owner);
    if (!user)
        return { error: "\u7528\u6237\u4E0D\u5B58\u5728" };
    const limit = user.routeLimit || DEFAULT_USER_ROUTE_LIMIT;
    const isRename = oldPrefix && oldPrefix !== prefix;
    const lookupPrefix = isRename ? oldPrefix : prefix;
    const source = data.source === "legacy" ? "legacy" : "user";
    const routeId = Number(data.routeId || data.id || 0) || 0;
    if (source === "legacy") {
        const row = await getLegacyRouteForUser(env2, user, routeId, lookupPrefix);
        if (!row)
            return { error: "\u8DEF\u7531\u4E0D\u5B58\u5728\u6216\u4E0D\u5C5E\u4E8E\u5F53\u524D\u8D26\u53F7" };
        if (isRename) {
            const clashUser = await env2.DB.prepare("SELECT 1 AS x FROM user_routes WHERE owner = ? AND prefix = ?").bind(owner, prefix).first();
            if (clashUser)
                return { error: "\u8DEF\u5F84 /" + prefix + " \u5DF2\u5B58\u5728" };
            const clashLegacy = await env2.DB.prepare("SELECT 1 AS x FROM routes WHERE user_id = ? AND prefix = ? AND rowid <> ?").bind(user.id, prefix, row._rid).first();
            if (clashLegacy)
                return { error: "\u8DEF\u5F84 /" + prefix + " \u5DF2\u5B58\u5728" };
            const clashOther = await env2.DB.prepare("SELECT 1 AS x FROM routes WHERE prefix = ? AND (user_id IS NULL OR user_id <> ?)").bind(prefix, user.id).first();
            if (clashOther)
                return { error: "\u8DEF\u5F84 /" + prefix + " \u5DF2\u88AB\u5176\u4ED6\u8DEF\u7531\u5360\u7528" };
        }
        await env2.DB.prepare(`UPDATE routes SET prefix = ?, target = ?, stream_target = ?, remark = ?, cache_img = ?, compat_mode = ?, ip_mode = ?,
        custom_headers = ?, ip_allow = ?, ip_block = ? WHERE rowid = ? AND user_id = ?`).bind(prefix, targets.join(","), streamTargets.join(","), String(data.remark || ""), data.cache_img === "off" ? "off" : "on", data.compat_mode === "on" ? "on" : "off", normalizeIpMode(data.ip_mode), String(data.custom_headers || "").trim(), allowList.join(","), blockList.join(","), row._rid, user.id).run();
        clearRouteCache();
        await auditLog(env2, isRename ? "user.route.rename" : "user.route.save", owner + " /" + prefix + " (\u5386\u53F2\u8DEF\u7531)");
        return { ok: true };
    }
    if (isRename) {
        const clash = await env2.DB.prepare("SELECT 1 AS x FROM user_routes WHERE owner = ? AND prefix = ?").bind(owner, prefix).first();
        if (clash)
            return { error: "\u8DEF\u5F84 /" + prefix + " \u5DF2\u5B58\u5728" };
    }
    else if (!oldPrefix) {
        const existing2 = await env2.DB.prepare("SELECT 1 AS x FROM user_routes WHERE owner = ? AND prefix = ?").bind(owner, prefix).first();
        if (existing2)
            return { error: "\u8DEF\u5F84 /" + prefix + " \u5DF2\u5B58\u5728\uFF0C\u8BF7\u76F4\u63A5\u7F16\u8F91\u5B83" };
        if (await routesHasUserId(env2)) {
            const legacyClash = await env2.DB.prepare("SELECT 1 AS x FROM routes WHERE user_id = ? AND prefix = ?").bind(user.id, prefix).first();
            if (legacyClash)
                return { error: "\u8DEF\u5F84 /" + prefix + " \u5DF2\u5B58\u5728\uFF0C\u8BF7\u76F4\u63A5\u7F16\u8F91\u5B83" };
        }
        const total = await countUserRoutes(env2, user);
        if (total >= limit)
            return { error: "\u8DEF\u7531\u6570\u91CF\u5DF2\u8FBE\u4E0A\u9650\uFF08" + limit + " \u6761\uFF09\uFF0C\u8BF7\u8054\u7CFB\u7BA1\u7406\u5458\u8C03\u6574" };
    }
    const existing = await env2.DB.prepare("SELECT sort_order, last_play, enabled FROM user_routes WHERE owner = ? AND prefix = ?").bind(owner, lookupPrefix).first();
    const insert = env2.DB.prepare("INSERT OR REPLACE INTO user_routes (owner, prefix, target, stream_target, remark, cache_img, compat_mode, ip_mode, last_play, sort_order, enabled, custom_headers, ip_allow, ip_block) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(owner, prefix, targets.join(","), streamTargets.join(","), String(data.remark || ""), data.cache_img === "off" ? "off" : "on", data.compat_mode === "on" ? "on" : "off", normalizeIpMode(data.ip_mode), existing?.last_play || "", existing?.sort_order || 0, existing?.enabled === 0 ? 0 : 1, String(data.custom_headers || "").trim(), allowList.join(","), blockList.join(","));
    if (isRename) {
        await env2.DB.batch([insert, env2.DB.prepare("DELETE FROM user_routes WHERE owner = ? AND prefix = ?").bind(owner, oldPrefix)]);
    }
    else {
        await insert.run();
    }
    clearRouteCache();
    await auditLog(env2, "user.route.save", owner + " /" + prefix);
    return { ok: true };
}

async function userDeleteRoute(env2, owner, prefix, source) {
    const p = normalizePrefix(prefix);
    if (!p)
        return { error: "\u7F3A\u5C11\u8DEF\u5F84\u53C2\u6570" };
    const user = await getUserByUsername(env2, owner);
    let changes = 0;
    if (source === "legacy" && user && await routesHasUserId(env2)) {
        const res = await env2.DB.prepare("DELETE FROM routes WHERE user_id = ? AND prefix = ?").bind(user.id, p).run();
        changes = Number(res.meta?.changes) || 0;
    }
    else {
        const res = await env2.DB.prepare("DELETE FROM user_routes WHERE owner = ? AND prefix = ?").bind(owner, p).run();
        changes = Number(res.meta?.changes) || 0;
        if (!changes && !source && user && await routesHasUserId(env2)) {
            const res2 = await env2.DB.prepare("DELETE FROM routes WHERE user_id = ? AND prefix = ?").bind(user.id, p).run();
            changes = Number(res2.meta?.changes) || 0;
        }
    }
    if (!changes)
        return { error: "\u8DEF\u7531\u4E0D\u5B58\u5728" };
    clearRouteCache();
    await auditLog(env2, "user.route.delete", owner + " /" + p);
    return { ok: true };
}

export { routesHasUserIdCache, routesHasUserId, getUserLegacyRoutes, getLegacyRouteForUser, countUserRoutes, userListRoutes, userSaveRoute, userDeleteRoute };
