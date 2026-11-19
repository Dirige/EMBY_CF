// Baseline: 4e0357e. Edition-specific behavior is intentionally retained.
import { getBaseDomain, getDnsRecordName, getTelegramChatId, getTelegramToken, logoutResponse, toFqdn } from "./../../../shared/auth/session.js";
import { ADMIN_UID, changePassword, getUserById, getUserByUsername, isAdmin, publicUser } from "./../auth/session.js";
import { json } from "./../../../shared/http/responses.js";
import { sendDailyReport } from "./../integrations/analytics.js";
import { auditLog } from "./../../../shared/observability/audit.js";
import { reportFailureHint } from "./../../../shared/integrations/analytics.js";
import { handleStatsRequest } from "./../integrations/stats.js";
import { SETTING_KEYS, getSettings, setSetting, invalidateSettingsCache } from "./../config/settings.js";
import { normalizeDnsTarget, normalizePrefix, readJson, splitTargets, validatePrefix } from "./../../../shared/admin/api.js";
import { normalizeRelayBase } from "./../relay/protocol.js";
import { CURRENT_VERSION } from "./../version.js";
import { isValidHttpUrl, parseHeaderLines, parseIpList, probeTarget, validIpList } from "./../../../shared/http/validation.js";
import { getShanghaiParts, normalizeIpMode } from "./../../../shared/http/primitives.js";
import { addOptimizedDomain, deleteOptimizedDomain, getDNSConfig, getDNSRecords, getOptimizedDomains, getZones, normalizeDomain, saveDNSConfig, updateOptimizedDomain } from "./../../../shared/integrations/dns.js";
import { clearRouteCache } from "./../proxy/routes.js";
import { runHealthCheck } from "./../maintenance.js";
import { countUserRoutes, routesHasUserId, userDeleteRoute, userListRoutes, userSaveRoute } from "./../users/routes.js";
import { getStatsHost, getUserDomain, invalidateZoneInfoCache, resolveZoneInfo } from "./../integrations/zone.js";
import { createOrUpdateDNSRecord } from "./../integrations/dns.js";
import { adminCreateUser, adminDeleteUser, adminListUsers, adminResetData, adminUpdateUser } from "./../users/admin.js";
import { adminClearInvites, adminCreateInvite, adminDeleteInvite, adminListInvites } from "./../users/invites.js";
import { userDnsInfo, userEnsureDNS, userEntryHost, userUpdateDns } from "./../users/dns.js";
import { DEFAULT_USER_ROUTE_LIMIT } from "./../storage/schema.js";

async function handleAdminApi(request, env2, url, session) {
    const adminActor = String(session?.username || "admin");
    if (url.pathname === "/admin/api/logout" && request.method === "POST")
        return logoutResponse();
    if (!await isAdmin(request, env2))
        return new Response("Unauthorized", { status: 401 });
    if (request.method !== "GET" && request.method !== "HEAD") {
        const origin = request.headers.get("Origin");
        if (origin && origin !== url.origin)
            return json({ error: "Forbidden origin" }, 403);
    }
    if (url.pathname === "/admin/api/report/send" && request.method === "POST") {
        const out = await sendDailyReport(env2, url.searchParams.get("date") || "");
        await auditLog(env2, "report.send", out.ok ? "ok" : "fail: " + (out.telegram.rawError || out.telegram.error || out.webhook.error || "unknown"));
        return json({
            success: out.ok,
            date: out.date,
            telegram: out.telegram,
            webhook: out.webhook,
            preview: out.text,
            hint: out.ok ? "" : reportFailureHint(env2, out)
        }, out.ok ? 200 : 502);
    }
    if (url.pathname === "/admin/api/stats" && request.method === "GET") {
        return handleStatsRequest(env2, url);
    }
    if (url.pathname === "/admin/api/settings") {
        if (request.method === "GET") {
            const st = await getSettings(env2);
            const safeRaw = { ...st.raw };
            if (safeRaw.relay_secret)
                safeRaw.relay_secret = safeRaw.relay_secret.slice(0, 6) + "...";
            return json({
                success: true,
                settings: safeRaw,
                notify: {
                    telegram: Boolean(getTelegramToken(env2) && getTelegramChatId(env2)),
                    webhook: Boolean(env2.NOTIFY_WEBHOOK),
                    tokenVar: getTelegramToken(env2) ? "\u5DF2\u8BFB\u53D6" : "\u672A\u8BFB\u53D6",
                    chatVar: getTelegramChatId(env2) ? "\u5DF2\u8BFB\u53D6" : "\u672A\u8BFB\u53D6"
                }
            });
        }
        if (request.method === "POST") {
            const data = await readJson(request) || {};
            if (data.domain_proxy_rules) {
                try {
                    const o = JSON.parse(data.domain_proxy_rules);
                    if (!o || typeof o !== "object" || Array.isArray(o))
                        throw 0;
                }
                catch {
                    return json({ error: '\u57DF\u540D\u6620\u5C04\u89C4\u5219\u5FC5\u987B\u662F JSON \u5BF9\u8C61\uFF0C\u4F8B\u5982 {"example.com":"1.2.3.4"}' }, 400);
                }
            }
            for (const k of SETTING_KEYS)
                if (k in data)
                    await setSetting(env2, k, data[k] ?? "");
            await auditLog(env2, "settings", Object.keys(data).filter((k) => SETTING_KEYS.includes(k)).join(","));
            return json({ success: true });
        }
    }
    if (url.pathname === "/admin/api/relay" && request.method === "GET") {
        const st = await getSettings(env2);
        return json({
            success: true,
            relay_url: st.relayUrl,
            relay_enabled: st.relayEnabled ? "1" : "0",
            has_secret: !!st.relaySecret,
            secret_hint: st.relaySecret ? st.relaySecret.slice(0, 6) + "..." + st.relaySecret.slice(-4) : "",
            active: !!(st.relayEnabled && st.relayUrl && st.relaySecret)
        });
    }
    if (url.pathname === "/admin/api/relay" && request.method === "POST") {
        const data = await readJson(request) || {};
        const url2 = String(data.relay_url ?? "").trim();
        if (url2) {
            const u = normalizeRelayBase(url2);
            if (!/^https?:\/\//i.test(u))
                return json({ error: "\u4E2D\u7EE7\u5730\u5740\u5FC5\u987B\u662F http(s):// \u5F00\u5934" }, 400);
            await setSetting(env2, "relay_url", u);
        }
        const secret = String(data.relay_secret ?? "").trim();
        if (secret)
            await setSetting(env2, "relay_secret", secret);
        if (data.relay_enabled != null)
            await setSetting(env2, "relay_enabled", data.relay_enabled === "1" || data.relay_enabled === true ? "1" : "0");
        await auditLog(env2, "relay.save", `url=${url2 ? "\u5DF2\u66F4\u65B0" : "\u672A\u53D8"} secret=${secret ? "\u5DF2\u66F4\u65B0" : "\u672A\u53D8"} enabled=${data.relay_enabled != null ? data.relay_enabled : "\u672A\u53D8"}`);
        return json({ success: true });
    }
    if (url.pathname === "/admin/api/relay/test" && request.method === "POST") {
        const st = await getSettings(env2);
        const base = normalizeRelayBase(st.relayUrl);
        if (!base || !st.relaySecret)
            return json({ ok: false, error: "\u8BF7\u5148\u586B\u5199\u4E2D\u7EE7\u5730\u5740\u548C\u5BC6\u94A5\u5E76\u4FDD\u5B58" });
        const t0 = Date.now();
        try {
            const res = await fetch(new Request(base + "/_relay/health", { headers: { "X-Relay-Key": st.relaySecret } }));
            const text = (await res.text()).slice(0, 400);
            let body = null;
            try {
                body = JSON.parse(text);
            }
            catch (_) {
            }
            const result = { ok: res.ok, status: res.status, ms: Date.now() - t0, version: body?.version || "", limits: body?.limits || null, usage: body?.usage || null };
            if (res.ok && !st.relayEnabled) {
                await setSetting(env2, "relay_enabled", "1");
                result.auto_enabled = true;
            }
            if (res.ok) {
                try {
                    await auditLog(env2, "relay.test.ok", `${base} ${result.ms}ms ${result.version}`);
                }
                catch (_) {
                }
            }
            return json(result);
        }
        catch (e) {
            return json({ ok: false, ms: Date.now() - t0, error: String(e?.message || e).slice(0, 200) });
        }
    }
    if (url.pathname === "/admin/api/relay/usage" && request.method === "GET") {
        const st = await getSettings(env2);
        const base = normalizeRelayBase(st.relayUrl);
        if (!base || !st.relaySecret)
            return json({ ok: false, error: "\u672A\u914D\u7F6E\u4E2D\u7EE7" });
        let fallback24 = 0, fallbackErr24 = 0;
        try {
            const since = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
            const { results } = await env2.DB.prepare(`SELECT action, COUNT(*) AS n FROM audit_log
         WHERE action IN ('relay.fallback', 'relay.fallback.err') AND substr(ts, 1, 10) >= ?
         GROUP BY action`).bind(since).all();
            for (const row of results || []) {
                if (row.action === "relay.fallback")
                    fallback24 = Number(row.n) || 0;
                if (row.action === "relay.fallback.err")
                    fallbackErr24 = Number(row.n) || 0;
            }
        }
        catch (_) {
        }
        try {
            const res = await fetch(new Request(base + "/_relay/health", { headers: { "X-Relay-Key": st.relaySecret } }));
            const body = await res.json().catch(() => null);
            return json({ ok: res.ok, usage: body?.usage || null, limits: body?.limits || null, version: body?.version || "", uptime: body?.uptime || "", fallback24, fallbackErr24 });
        }
        catch (e) {
            return json({ ok: false, error: String(e?.message || e).slice(0, 200), fallback24, fallbackErr24 });
        }
    }
    if (url.pathname === "/admin/api/audit" && request.method === "GET") {
        const { results } = await env2.DB.prepare("SELECT ts, action, detail FROM audit_log ORDER BY id DESC LIMIT 100").all();
        return json({ success: true, logs: results || [] });
    }
    if (url.pathname === "/admin/api/export" && request.method === "GET") {
        const routes = (await env2.DB.prepare("SELECT prefix, target, stream_target, remark, cache_img, compat_mode, ip_mode, sort_order, enabled, custom_headers, ip_allow, ip_block FROM routes WHERE created_by = ? ORDER BY sort_order, prefix").bind(adminActor).all()).results || [];
        const domains = (await env2.DB.prepare("SELECT domain, name FROM optimized_domains WHERE is_builtin = 0").all()).results || [];
        const st = await getSettings(env2);
        const body = JSON.stringify({ version: CURRENT_VERSION, exportedAt: ( /* @__PURE__ */new Date()).toISOString(), routes, domains, settings: st.raw }, null, 2);
        return new Response(body, { headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Content-Disposition": 'attachment; filename="proxy-config-' + ( /* @__PURE__ */new Date()).toISOString().slice(0, 10) + '.json"',
                "Cache-Control": "no-store"
            } });
    }
    if (url.pathname === "/admin/api/import" && request.method === "POST") {
        const data = await readJson(request);
        if (!data || typeof data !== "object")
            return json({ error: "\u4E0D\u662F\u5408\u6CD5\u7684\u914D\u7F6E JSON" }, 400);
        const stmts = [];
        let nr = 0, nd = 0;
        const skipped = [];
        const existingRows = (await env2.DB.prepare("SELECT rowid AS _rid, prefix, created_by FROM routes").all()).results || [];
        const ownerByPrefix = new Map(existingRows.map((x) => [x.prefix, x]));
        for (const r of Array.isArray(data.routes) ? data.routes : []) {
            const err = validatePrefix(r?.prefix);
            const targets = splitTargets(r?.target);
            const streamTargets = splitTargets(r?.stream_target || "");
            if (err || !targets.length || !targets.every(isValidHttpUrl) || streamTargets.length > 0 && !streamTargets.every(isValidHttpUrl) || parseHeaderLines(r.custom_headers).error || !validIpList(parseIpList(r.ip_allow)) || !validIpList(parseIpList(r.ip_block))) {
                skipped.push(String(r?.prefix || "?"));
                continue;
            }
            const pf = normalizePrefix(r.prefix);
            const cur = ownerByPrefix.get(pf);
            if (cur !== void 0 && (cur.created_by || "") !== adminActor) {
                skipped.push(pf);
                continue;
            }
            const commonArgs = [
                targets.join(","),
                streamTargets.join(","),
                String(r.remark || ""),
                r.cache_img === "off" ? "off" : "on",
                r.compat_mode === "on" ? "on" : "off",
                normalizeIpMode(r.ip_mode),
                Number(r.sort_order) || 0,
                r.enabled === 0 ? 0 : 1,
                String(r.custom_headers || ""),
                String(r.ip_allow || ""),
                String(r.ip_block || ""),
                adminActor
            ];
            if (cur !== void 0) {
                stmts.push(env2.DB.prepare(`UPDATE routes SET target = ?, stream_target = ?, remark = ?, cache_img = ?, compat_mode = ?, ip_mode = ?,
             sort_order = ?, enabled = ?, custom_headers = ?, ip_allow = ?, ip_block = ?, created_by = ?
           WHERE rowid = ?`).bind(...commonArgs, cur._rid));
            }
            else {
                stmts.push(env2.DB.prepare(`INSERT INTO routes (target, stream_target, remark, cache_img, compat_mode, ip_mode, sort_order, enabled, custom_headers, ip_allow, ip_block, created_by, prefix, last_play)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '')`).bind(...commonArgs, pf));
            }
            nr++;
        }
        for (const d of Array.isArray(data.domains) ? data.domains : []) {
            const domain2 = normalizeDomain(d?.domain);
            const name = String(d?.name || "").trim();
            if (!domain2 || !name)
                continue;
            stmts.push(env2.DB.prepare("INSERT OR IGNORE INTO optimized_domains (domain, name, is_builtin) VALUES (?, ?, 0)").bind(domain2, name));
            nd++;
        }
        if (data.settings && typeof data.settings === "object") {
            for (const k of SETTING_KEYS)
                if (k in data.settings) {
                    stmts.push(env2.DB.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(k, String(data.settings[k] ?? "")));
                }
        }
        if (stmts.length)
            await env2.DB.batch(stmts);
        clearRouteCache();
        invalidateSettingsCache();
        await auditLog(env2, "import", `routes=${nr} domains=${nd} skipped=${skipped.length}`);
        return json({ success: true, routes: nr, domains: nd, skipped });
    }
    if (url.pathname === "/admin/api/routes/toggle" && request.method === "POST") {
        const data = await readJson(request) || {};
        const prefix = normalizePrefix(data.prefix);
        if (!prefix)
            return json({ error: "\u7F3A\u5C11 prefix" }, 400);
        const res = await env2.DB.prepare("UPDATE routes SET enabled = ? WHERE prefix = ? AND created_by = ?").bind(data.enabled ? 1 : 0, prefix, adminActor).run();
        if (!res.meta?.changes)
            return json({ error: "\u8DEF\u7531\u4E0D\u5B58\u5728\u6216\u65E0\u6743\u64CD\u4F5C" }, 404);
        clearRouteCache();
        await auditLog(env2, data.enabled ? "route.enable" : "route.disable", "/" + prefix);
        return json({ success: true });
    }
    if (url.pathname === "/admin/api/routes/reorder" && request.method === "POST") {
        const data = await readJson(request) || {};
        const order = Array.isArray(data.order) ? data.order.map(normalizePrefix).filter(Boolean) : [];
        if (!order.length)
            return json({ error: "\u7F3A\u5C11 order" }, 400);
        await env2.DB.batch(order.map((pf, i) => env2.DB.prepare("UPDATE routes SET sort_order = ? WHERE prefix = ? AND created_by = ?").bind(i, pf, adminActor)));
        return json({ success: true });
    }
    if (url.pathname === "/admin/api/routes/test" && request.method === "POST") {
        const data = await readJson(request) || {};
        const route = await env2.DB.prepare("SELECT target FROM routes WHERE prefix = ? AND created_by = ?").bind(normalizePrefix(data.prefix), adminActor).first();
        if (!route)
            return json({ error: "\u8DEF\u7531\u4E0D\u5B58\u5728\u6216\u65E0\u6743\u64CD\u4F5C" }, 404);
        const targets = splitTargets(route.target);
        const results = await Promise.all(targets.map(async (t) => ({ target: t, ...await probeTarget(t) })));
        return json({ success: true, results });
    }
    if (url.pathname === "/admin/api/health/run" && request.method === "POST") {
        const out = await runHealthCheck(env2, true);
        return json({ success: true, ...out });
    }
    if (url.pathname === "/admin/api/routes") {
        if (request.method === "GET") {
            const today = getShanghaiParts().dateKey;
            const { results } = await env2.DB.prepare(`SELECT r.*, COALESCE(s.request_count, 0) AS today_req, COALESCE(s.traffic_bytes, 0) AS today_bytes
         FROM routes r LEFT JOIN route_stats_daily s ON s.prefix = r.prefix AND s.bucket_date = ?
         WHERE r.created_by = ?
         ORDER BY r.sort_order, r.prefix`).bind(today, adminActor).all();
            let health = [];
            try {
                health = (await env2.DB.prepare("SELECT prefix, down FROM route_health").all()).results || [];
            }
            catch (_) {
            }
            const downMap = {};
            for (const h of health)
                if (h.down)
                    downMap[h.prefix] = (downMap[h.prefix] || 0) + 1;
            return json((results || []).map((r) => ({ ...r, down_count: downMap[r.prefix] || 0 })));
        }
        if (request.method === "POST") {
            const data = await readJson(request);
            if (!data)
                return json({ error: "\u8BF7\u6C42\u4F53\u4E0D\u662F\u5408\u6CD5 JSON" }, 400);
            const err = validatePrefix(data.prefix);
            if (err)
                return json({ error: err }, 400);
            const prefix = normalizePrefix(data.prefix);
            const oldPrefix = data.oldPrefix ? normalizePrefix(data.oldPrefix) : "";
            const targets = splitTargets(data.target);
            if (!targets.length)
                return json({ error: "\u8BF7\u81F3\u5C11\u586B\u5199\u4E00\u4E2A\u76EE\u6807\u5730\u5740" }, 400);
            const badTarget = targets.find((t) => !isValidHttpUrl(t));
            if (badTarget)
                return json({ error: "\u76EE\u6807\u5730\u5740\u5FC5\u987B\u662F http(s):// \u5F00\u5934\u7684\u5408\u6CD5 URL\uFF1A" + badTarget }, 400);
            const streamTargets = splitTargets(data.stream_target || "");
            const badStreamTarget = streamTargets.find((t) => !isValidHttpUrl(t));
            if (badStreamTarget)
                return json({ error: "推流地址必须是 http(s):// 开头的合法 URL：" + badStreamTarget }, 400);
            const hdrCheck = parseHeaderLines(data.custom_headers);
            if (hdrCheck.error)
                return json({ error: hdrCheck.error }, 400);
            const allowList = parseIpList(data.ip_allow);
            const blockList = parseIpList(data.ip_block);
            if (!validIpList(allowList) || !validIpList(blockList))
                return json({ error: "IP \u9ED1\u767D\u540D\u5355\u683C\u5F0F\u4E0D\u5408\u6CD5\uFF08\u652F\u6301 IPv4\u3001IPv6 \u548C IPv4 CIDR\uFF0C\u7528\u9017\u53F7\u6216\u7A7A\u683C\u5206\u9694\uFF09" }, 400);
            const isRename = oldPrefix && oldPrefix !== prefix;
            const hasLegacy = await routesHasUserId(env2);
            const globalScope = hasLegacy ? " AND (user_id IS NULL OR user_id = 0 OR user_id = '')" : "";
            const existing = await env2.DB.prepare("SELECT rowid AS _rid, sort_order, last_play, enabled, created_by FROM routes WHERE prefix = ?" + globalScope).bind(isRename ? oldPrefix : prefix).first();
            if (isRename) {
                if (!existing)
                    return json({ error: "\u539F\u8DEF\u7531\u4E0D\u5B58\u5728" }, 404);
                if ((existing.created_by || "") !== adminActor)
                    return json({ error: "\u65E0\u6743\u4FEE\u6539\u5176\u4ED6\u7BA1\u7406\u5458\u6216\u5386\u53F2\u8DEF\u7531" }, 403);
                const clash = await env2.DB.prepare("SELECT 1 AS x FROM routes WHERE prefix = ?" + globalScope).bind(prefix).first();
                if (clash)
                    return json({ error: "\u8DEF\u5F84 /" + prefix + " \u5DF2\u5B58\u5728" }, 409);
            }
            else if (oldPrefix) {
                if (!existing)
                    return json({ error: "\u8DEF\u7531\u4E0D\u5B58\u5728" }, 404);
                if ((existing.created_by || "") !== adminActor)
                    return json({ error: "\u65E0\u6743\u4FEE\u6539\u5176\u4ED6\u7BA1\u7406\u5458\u6216\u5386\u53F2\u8DEF\u7531" }, 403);
            }
            else if (existing) {
                if ((existing.created_by || "") === adminActor)
                    return json({ error: "\u8DEF\u5F84 /" + prefix + " \u5DF2\u5B58\u5728\uFF0C\u8BF7\u76F4\u63A5\u7F16\u8F91\u5B83" }, 409);
                return json({ error: "\u8DEF\u5F84 /" + prefix + " \u5DF2\u88AB\u5176\u4ED6\u7BA1\u7406\u5458\u6216\u5386\u53F2\u8DEF\u7531\u5360\u7528" }, 409);
            }
            if (oldPrefix) {
                await env2.DB.prepare(`UPDATE routes SET prefix = ?, target = ?, stream_target = ?, remark = ?, cache_img = ?, compat_mode = ?, ip_mode = ?,
             custom_headers = ?, ip_allow = ?, ip_block = ?, created_by = ?
           WHERE rowid = ? AND created_by = ?`).bind(prefix, targets.join(","), streamTargets.join(","), String(data.remark || ""), data.cache_img === "off" ? "off" : "on", data.compat_mode === "on" ? "on" : "off", normalizeIpMode(data.ip_mode), String(data.custom_headers || "").trim(), allowList.join(","), blockList.join(","), adminActor, existing._rid, adminActor).run();
            }
            else {
                await env2.DB.prepare("INSERT INTO routes (prefix, target, stream_target, remark, cache_img, compat_mode, ip_mode, last_play, sort_order, enabled, custom_headers, ip_allow, ip_block, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(prefix, targets.join(","), streamTargets.join(","), String(data.remark || ""), data.cache_img === "off" ? "off" : "on", data.compat_mode === "on" ? "on" : "off", normalizeIpMode(data.ip_mode), "", 0, 1, String(data.custom_headers || "").trim(), allowList.join(","), blockList.join(","), adminActor).run();
            }
            clearRouteCache();
            await auditLog(env2, isRename ? "route.rename" : "route.save", "/" + (isRename ? oldPrefix + " \u2192 /" : "") + prefix);
            return json({ success: true });
        }
        if (request.method === "DELETE") {
            const prefix = url.searchParams.get("prefix");
            if (!prefix)
                return json({ error: "\u7F3A\u5C11 prefix \u53C2\u6570" }, 400);
            const p = normalizePrefix(prefix);
            const res = await env2.DB.prepare("DELETE FROM routes WHERE prefix = ? AND created_by = ?").bind(p, adminActor).run();
            if (!res.meta?.changes)
                return json({ error: "\u8DEF\u7531\u4E0D\u5B58\u5728\u6216\u65E0\u6743\u64CD\u4F5C" }, 404);
            clearRouteCache();
            try {
                await env2.DB.prepare("DELETE FROM route_health WHERE prefix = ?").bind(p).run();
            }
            catch (_) {
            }
            await auditLog(env2, "route.delete", "/" + p);
            return json({ success: true });
        }
    }
    if (url.pathname === "/admin/api/optimized-domains") {
        if (request.method === "GET") {
            const domains = await getOptimizedDomains(env2);
            return json({ success: true, domains });
        }
        if (request.method === "POST") {
            const data = await readJson(request);
            const domain2 = normalizeDomain(data?.domain);
            const name = String(data?.name || "").trim();
            if (!domain2 || !name)
                return json({ success: false, error: "\u57DF\u540D\u6216\u540D\u79F0\u4E0D\u5408\u6CD5" }, 400);
            try {
                const success = await addOptimizedDomain(env2, domain2, name);
                await auditLog(env2, "domain.add", domain2);
                return json({ success });
            }
            catch (e) {
                if (/UNIQUE/i.test(String(e?.message)))
                    return json({ success: false, error: "\u8BE5\u57DF\u540D\u5DF2\u5B58\u5728" }, 409);
                return json({ success: false, error: "\u4FDD\u5B58\u5931\u8D25" }, 500);
            }
        }
    }
    if (url.pathname.startsWith("/admin/api/optimized-domains/")) {
        const id = parseInt(url.pathname.split("/").pop(), 10);
        if (!Number.isFinite(id))
            return json({ success: false, error: "id \u4E0D\u5408\u6CD5" }, 400);
        if (request.method === "PUT") {
            const data = await readJson(request);
            const domain2 = normalizeDomain(data?.domain);
            const name = String(data?.name || "").trim();
            if (!domain2 || !name)
                return json({ success: false, error: "\u57DF\u540D\u6216\u540D\u79F0\u4E0D\u5408\u6CD5" }, 400);
            try {
                const success = await updateOptimizedDomain(env2, id, domain2, name);
                if (!success)
                    return json({ success: false, error: "\u5185\u7F6E\u57DF\u540D\u4E0D\u53EF\u4FEE\u6539\uFF0C\u6216\u8BE5\u8BB0\u5F55\u4E0D\u5B58\u5728" }, 403);
                return json({ success });
            }
            catch (e) {
                if (/UNIQUE/i.test(String(e?.message)))
                    return json({ success: false, error: "\u8BE5\u57DF\u540D\u5DF2\u5B58\u5728" }, 409);
                return json({ success: false, error: "\u4FDD\u5B58\u5931\u8D25" }, 500);
            }
        }
        if (request.method === "DELETE") {
            const success = await deleteOptimizedDomain(env2, id);
            if (!success)
                return json({ success: false, error: "\u5185\u7F6E\u57DF\u540D\u4E0D\u53EF\u5220\u9664\uFF0C\u6216\u8BE5\u8BB0\u5F55\u4E0D\u5B58\u5728" }, 403);
            await auditLog(env2, "domain.delete", "id=" + id);
            return json({ success });
        }
    }
    if (url.pathname === "/admin/api/dns-config") {
        if (request.method === "GET") {
            const config2 = await getDNSConfig(env2);
            const zoneInfo = await resolveZoneInfo(env2);
            const baseDomain = getBaseDomain(env2);
            const resolvedName = config2 && config2.dnsName || getDnsRecordName(env2);
            const targetName = toFqdn(resolvedName, baseDomain);
            const candidates = [];
            const accessHost = String(url.hostname || "").toLowerCase();
            if (accessHost)
                candidates.push(accessHost);
            if (targetName && !candidates.includes(targetName))
                candidates.push(targetName);
            let zones = [];
            let zonesError = null;
            let zoneId = zoneInfo.zoneId || config2 && config2.zoneId || "";
            if (!zoneId) {
                zonesError = zoneInfo.error || "\u672A\u89E3\u6790\u5230 Zone ID";
                const zr = await getZones(env2);
                if (zr.success && Array.isArray(zr.result)) {
                    zones = zr.result;
                    if (zones[0])
                        zoneId = zones[0].id;
                }
                else {
                    zonesError = zr.errors?.[0]?.message || zr.error || "\u83B7\u53D6\u533A\u57DF\u5217\u8868\u5931\u8D25";
                }
            }
            let liveRecord = null;
            if (zoneId) {
                try {
                    const rr = await getDNSRecords(env2, zoneId);
                    if (rr.success && Array.isArray(rr.result)) {
                        for (const name of candidates) {
                            const rec = rr.result.find((r) => ["A", "AAAA", "CNAME"].includes(r.type) && r.name === name);
                            if (rec) {
                                liveRecord = { type: rec.type, name: rec.name, content: rec.content, proxied: rec.proxied, modifiedOn: rec.modified_on, zoneId };
                                break;
                            }
                        }
                    }
                    else if (!zonesError) {
                        zonesError = rr.errors?.[0]?.message || rr.error || "\u8BFB\u53D6 DNS \u8BB0\u5F55\u5931\u8D25";
                    }
                }
                catch (e) {
                    zonesError = zonesError || String(e?.message || e);
                }
            }
            return json({
                success: true,
                config: config2,
                zones,
                zonesError,
                liveRecord,
                zoneId,
                baseDomain,
                resolvedName,
                targetName,
                statsHost: getStatsHost(env2)
            });
        }
        if (request.method === "POST") {
            const data = await readJson(request) || {};
            const success = await saveDNSConfig(env2, data.dnsName, data.currentDomain || "", data.zoneId || "");
            return json({ success });
        }
    }
    if (url.pathname === "/admin/api/dns/replace" && request.method === "POST") {
        const data = await readJson(request) || {};
        let { zoneId, dnsName, targetDomain } = data;
        const baseDomain = getBaseDomain(env2);
        const nameInput = String(dnsName || "").trim() || getDnsRecordName(env2);
        const targets = splitTargets(targetDomain).map(normalizeDnsTarget).filter(Boolean);
        if (!nameInput || !targets.length)
            return json({ success: false, error: "\u7F3A\u5C11\u5FC5\u8981\u53C2\u6570\uFF08\u8BB0\u5F55\u540D / \u76EE\u6807\uFF09" }, 400);
        if (!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(targets[0]) && !targets[0].includes(":") && !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(targets[0])) {
            return json({ success: false, error: "\u76EE\u6807\u5FC5\u987B\u662F\u5408\u6CD5\u57DF\u540D\u3001IPv4 \u6216 IPv6" }, 400);
        }
        if (!zoneId) {
            const info3 = await resolveZoneInfo(env2);
            zoneId = info3.zoneId;
            if (!zoneId)
                return json({ success: false, error: info3.error || "\u672A\u89E3\u6790\u5230 Zone ID\uFF0C\u8BF7\u68C0\u67E5 CF_API_TOKEN \u6743\u9650" }, 400);
        }
        const result = await createOrUpdateDNSRecord(env2, zoneId, nameInput, targets[0], baseDomain);
        if (result.success && result.result) {
            await saveDNSConfig(env2, nameInput, targets[0], zoneId);
            invalidateZoneInfoCache();
            await auditLog(env2, "dns.replace", `${result.result.name} \u2192 ${result.result.content}`);
            return json({ success: true, result: result.result });
        }
        return json({ success: false, error: result.error || result.errors?.[0]?.message || "DNS \u66FF\u6362\u5931\u8D25", errors: result.errors });
    }
    if (url.pathname === "/admin/api/users") {
        if (request.method === "GET")
            return json({ success: true, users: await adminListUsers(env2) });
        if (request.method === "POST") {
            const data = await readJson(request) || {};
            const out = await adminCreateUser(env2, data, adminActor);
            return json(out, out.error ? 400 : 200);
        }
    }
    if (url.pathname.startsWith("/admin/api/users/")) {
        const id = parseInt(url.pathname.split("/").pop(), 10);
        if (!Number.isFinite(id))
            return json({ error: "id \u4E0D\u5408\u6CD5" }, 400);
        if (request.method === "PUT") {
            const data = await readJson(request) || {};
            const out = await adminUpdateUser(env2, id, data, adminActor);
            return json(out, out.error ? 400 : 200);
        }
        if (request.method === "DELETE") {
            const out = await adminDeleteUser(env2, id, adminActor);
            return json(out, out.error ? 404 : 200);
        }
    }
    if (url.pathname === "/admin/api/invites") {
        if (request.method === "GET")
            return json({ success: true, invites: await adminListInvites(env2) });
        if (request.method === "POST") {
            const data = await readJson(request) || {};
            const out = await adminCreateInvite(env2, data, adminActor);
            return json(out, out.error ? 400 : 200);
        }
    }
    if (url.pathname === "/admin/api/invites/clear" && request.method === "POST") {
        const out = await adminClearInvites(env2, adminActor);
        return json(out, out.error ? 400 : 200);
    }
    if (url.pathname.startsWith("/admin/api/invites/") && request.method === "DELETE") {
        const code = decodeURIComponent(url.pathname.split("/").pop() || "");
        const out = await adminDeleteInvite(env2, code, "admin");
        return json(out, out.error ? 404 : 200);
    }
    if (url.pathname === "/admin/api/db/reset" && request.method === "POST") {
        const data = await readJson(request) || {};
        const out = await adminResetData(env2, data, adminActor);
        return json(out, out.error ? 400 : 200);
    }
    return json({ error: "Not found" }, 404);
}

async function handleUserApi(request, env2, url, session) {
    if (!session)
        return json({ error: "Unauthorized" }, 401);
    if (!env2.DB)
        return json({ error: "D1 \u6570\u636E\u5E93\u672A\u7ED1\u5B9A" }, 500);
    if (request.method !== "GET" && request.method !== "HEAD") {
        const origin = request.headers.get("Origin");
        if (origin && origin !== url.origin)
            return json({ error: "Forbidden origin" }, 403);
    }
    if (url.pathname === "/api/user/me" && request.method === "GET") {
        const user = session.uid === ADMIN_UID ? null : await getUserById(env2, session.uid);
        const entryHost = user ? userEntryHost(env2, user) : "";
        let routeCount = 0;
        if (user)
            routeCount = await countUserRoutes(env2, user);
        const userDomain = getUserDomain(env2) || getBaseDomain(env2);
        return json({
            ok: true,
            user: user ? publicUser(user) : { id: 0, username: "admin", role: "admin", subdomain: "", routeLimit: 999, status: "active" },
            baseDomain: getBaseDomain(env2),
            userDomain,
            mainHost: getStatsHost(env2),
            entryHost,
            entryUrl: entryHost ? "https://" + entryHost : "",
            routeCount,
            routeLimit: user ? user.routeLimit || DEFAULT_USER_ROUTE_LIMIT : 999,
            workerRouteHint: "\u9700\u8981\u5728 Cloudflare \u7ED9 Worker \u6DFB\u52A0\u8DEF\u7531 " + (userDomain ? "*." + userDomain + "/*" : "*/*") + "\uFF0C\u5B50\u57DF\u540D\u8BF7\u6C42\u624D\u4F1A\u8FDB\u5165 Worker"
        });
    }
    if (url.pathname === "/api/user/routes") {
        if (request.method === "GET")
            return json(await userListRoutes(env2, session.username));
        if (request.method === "POST") {
            const data = await readJson(request) || {};
            const out = await userSaveRoute(env2, session.username, data);
            return json(out, out.error ? 400 : 200);
        }
        if (request.method === "DELETE") {
            const out = await userDeleteRoute(env2, session.username, url.searchParams.get("prefix"), url.searchParams.get("source"));
            return json(out, out.error ? 404 : 200);
        }
    }
    if (url.pathname === "/api/user/routes/toggle" && request.method === "POST") {
        const data = await readJson(request) || {};
        const p = normalizePrefix(data.prefix);
        if (!p)
            return json({ error: "\u7F3A\u5C11 prefix" }, 400);
        const enabled = data.enabled ? 1 : 0;
        const user = await getUserByUsername(env2, session.username);
        if (!user)
            return json({ error: "\u7528\u6237\u4E0D\u5B58\u5728" }, 404);
        let changes = 0;
        if (data.source === "legacy" && await routesHasUserId(env2)) {
            const res = await env2.DB.prepare("UPDATE routes SET enabled = ? WHERE user_id = ? AND prefix = ?").bind(enabled, user.id, p).run();
            changes = Number(res.meta?.changes) || 0;
        }
        else {
            const res = await env2.DB.prepare("UPDATE user_routes SET enabled = ? WHERE owner = ? AND prefix = ?").bind(enabled, session.username, p).run();
            changes = Number(res.meta?.changes) || 0;
            if (!changes && !data.source && await routesHasUserId(env2)) {
                const res2 = await env2.DB.prepare("UPDATE routes SET enabled = ? WHERE user_id = ? AND prefix = ?").bind(enabled, user.id, p).run();
                changes = Number(res2.meta?.changes) || 0;
            }
        }
        if (!changes)
            return json({ error: "\u8DEF\u7531\u4E0D\u5B58\u5728" }, 404);
        clearRouteCache();
        return json({ success: true });
    }
    if (url.pathname === "/api/user/routes/reorder" && request.method === "POST") {
        const data = await readJson(request) || {};
        const order = Array.isArray(data.order) ? data.order.map(normalizePrefix).filter(Boolean) : [];
        if (!order.length)
            return json({ error: "\u7F3A\u5C11 order" }, 400);
        const user = await getUserByUsername(env2, session.username);
        const hasLegacy = user && await routesHasUserId(env2);
        const jobs = [];
        order.forEach((pf, i) => {
            jobs.push(env2.DB.prepare("UPDATE user_routes SET sort_order = ? WHERE owner = ? AND prefix = ?").bind(i, session.username, pf));
            if (hasLegacy)
                jobs.push(env2.DB.prepare("UPDATE routes SET sort_order = ? WHERE user_id = ? AND prefix = ?").bind(i, user.id, pf));
        });
        await env2.DB.batch(jobs);
        clearRouteCache();
        return json({ success: true });
    }
    if (url.pathname === "/api/user/routes/test" && request.method === "POST") {
        const data = await readJson(request) || {};
        const p = normalizePrefix(data.prefix);
        if (!p)
            return json({ error: "\u7F3A\u5C11 prefix" }, 400);
        let route = await env2.DB.prepare("SELECT target FROM user_routes WHERE owner = ? AND prefix = ?").bind(session.username, p).first();
        if (!route) {
            const user = await getUserByUsername(env2, session.username);
            if (user && await routesHasUserId(env2)) {
                route = await env2.DB.prepare("SELECT target FROM routes WHERE user_id = ? AND prefix = ? ORDER BY rowid LIMIT 1").bind(user.id, p).first();
            }
        }
        if (!route)
            return json({ error: "\u8DEF\u7531\u4E0D\u5B58\u5728" }, 404);
        const targets = splitTargets(route.target);
        const results = await Promise.all(targets.map(async (t) => ({ target: t, ...await probeTarget(t) })));
        return json({ success: true, results });
    }
    if (url.pathname === "/api/user/stats" && request.method === "GET") {
        return handleStatsRequest(env2, url, { owner: session.username });
    }
    if (url.pathname === "/api/user/dns") {
        if (request.method === "GET") {
            const out = await userDnsInfo(env2, session);
            return json(out, out.error ? 400 : 200);
        }
        if (request.method === "POST") {
            const data = await readJson(request) || {};
            const target = String(data.target || "").trim();
            const out = target ? await userUpdateDns(env2, session, target) : await userEnsureDNS(env2, session);
            return json(out, out.error ? 400 : 200);
        }
    }
    if (url.pathname === "/api/user/password" && request.method === "POST") {
        return changePassword(request, env2, session);
    }
    if (url.pathname === "/api/user/logout" && request.method === "POST")
        return logoutResponse();
    return json({ error: "Not found" }, 404);
}

export { handleAdminApi, handleUserApi };
