// Baseline: 4e0357e. Edition-specific behavior is intentionally retained.
import { isAdmin, loginBlocked, loginFailed, loginFails } from "./../auth/session.js";
import { changePassword, credentialState } from '../auth/password.js';
import { notificationStatus, saveTelegramConfig, testTelegram } from '../config/notifications.js';
import { notificationId } from '../integrations/alert-privacy.js';
import { json } from "./../../../shared/http/responses.js";
import { getBaseDomain, getDnsRecordName, logoutResponse, toFqdn } from "./../../../shared/auth/session.js";
import { sendDailyReport } from "./../integrations/analytics.js";
import { auditLog } from "./../../../shared/observability/audit.js";
import { handleStatsRequest } from "./../integrations/stats.js";
import { SETTING_KEYS, getSettings, setSetting, invalidateSettingsCache } from "./../config/settings.js";
import { normalizeDnsTarget, normalizePrefix, readJson, splitTargets, validatePrefix } from "./../../../shared/admin/api.js";
import { CURRENT_VERSION } from "./../version.js";
import { isValidHttpUrl, parseHeaderLines, parseIpList, probeTarget, validIpList } from "./../../../shared/http/validation.js";
import { normalizeIpMode } from "./../../../shared/http/primitives.js";
import { addOptimizedDomain, deleteOptimizedDomain, getDNSConfig, getDNSRecords, getOptimizedDomains, getZones, normalizeDomain, saveDNSConfig, updateOptimizedDomain } from "./../../../shared/integrations/dns.js";
import { clearRouteCache } from "./../proxy/routes.js";
import { getRelayConfig, invalidateRelayCache, normalizeRelayBase, relayPortFrom } from "./../relay/protocol.js";
import { runHealthCheck } from "./../maintenance.js";
import { getStatsHost, invalidateZoneInfoCache, resolveZoneInfo } from "./../integrations/zone.js";
import { createOrUpdateDNSRecord } from "./../integrations/dns.js";
import { diagnoseRoute } from '../../../shared/observability/diagnostics.js';
import { inspectImport } from '../../../shared/admin/import-plan.js';
import { normalizeRelayMode } from '../relay/mode.js';

async function handleAdminApi(request, env2, url) {
    if (!await isAdmin(request, env2))
        return new Response("Unauthorized", { status: 401 });
    if (request.method !== "GET" && request.method !== "HEAD") {
        const origin = request.headers.get("Origin");
        if (origin && origin !== url.origin)
            return json({ error: "Forbidden origin" }, 403);
    }
    if (url.pathname === "/admin/api/logout" && request.method === "POST")
        return logoutResponse();
    if (['/admin/api/notifications', '/admin/api/notifications/test', '/admin/api/security/password'].includes(url.pathname)) {
        if (request.method === 'POST' && (request.headers.get('Origin') !== url.origin || !request.headers.get('Content-Type')?.startsWith('application/json')))
            return json({ error: '必须使用同源 JSON 请求' }, 403);
        if (url.pathname === '/admin/api/notifications') {
            if (request.method === 'GET') return json({ success: true, ...await notificationStatus(env2) });
            if (request.method === 'POST') {
                const data = await readJson(request);
                if (!data) return json({ error: '无效 JSON' }, 400);
                try { await saveTelegramConfig(env2, data); }
                catch { return json({ error: '保存失败，请检查 Token、数字 Chat ID 及 SETTINGS_ENCRYPTION_KEY 主密钥' }, 400); }
                await auditLog(env2, 'notification.save', data.clear === true ? 'disabled' : 'updated');
                return json({ success: true, ...await notificationStatus(env2) });
            }
        }
        if (url.pathname === '/admin/api/notifications/test' && request.method === 'POST') {
            const out = await testTelegram(env2);
            await auditLog(env2, 'notification.test', out.ok ? 'ok' : 'failed');
            return json(out, out.ok ? 200 : 502);
        }
        if (url.pathname === '/admin/api/security/password') {
            if (request.method === 'GET') return json({ success: true, customPassword: Boolean((await credentialState(env2)).record) });
            if (request.method === 'POST') {
                const ip = request.headers.get('cf-connecting-ip') || 'unknown';
                if (loginBlocked(ip)) return json({ error: '尝试次数过多，请 10 分钟后再试' }, 429);
                const data = await readJson(request);
                if (!data || data.newPassword !== data.confirmPassword) return json({ error: '两次新密码不一致' }, 400);
                const out = await changePassword(env2, data.currentPassword, data.newPassword);
                if (!out.ok) {
                    if (out.status === 403) loginFailed(ip);
                    return json({ error: out.error }, out.status);
                }
                loginFails.delete(ip);
                await auditLog(env2, 'security.password', 'changed; sessions revoked');
                return logoutResponse();
            }
        }
        return json({ error: 'Method not allowed' }, 405);
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
            hint: out.ok ? "" : '发送失败，请检查通知配置和发送权限'
        }, out.ok ? 200 : 502);
    }
    if (url.pathname === "/admin/api/stats" && request.method === "GET") {
        return handleStatsRequest(env2, url);
    }
    if (url.pathname === "/admin/api/settings") {
        if (request.method === "GET") {
            const st = await getSettings(env2);
            return json({
                success: true,
                settings: st.raw,
                notify: await notificationStatus(env2)
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
                    return json({ error: '域名映射规则必须是 JSON 对象，例如 {"example.com":"1.2.3.4"}' }, 400);
                }
            }
            for (const k of SETTING_KEYS)
                if (k in data)
                    await setSetting(env2, k, data[k] ?? "");
            await auditLog(env2, "settings", Object.keys(data).filter((k) => SETTING_KEYS.includes(k)).join(","));
            return json({ success: true });
        }
    }
    if (url.pathname === "/admin/api/audit" && request.method === "GET") {
        const { results } = await env2.DB.prepare("SELECT ts, action, detail FROM audit_log ORDER BY id DESC LIMIT 100").all();
        return json({ success: true, logs: results || [] });
    }
    if (url.pathname === "/admin/api/export" && request.method === "GET") {
        const routes = (await env2.DB.prepare("SELECT prefix, target, remark, cache_img, compat_mode, ip_mode, use_relay, sort_order, enabled, custom_headers, ip_allow, ip_block FROM routes ORDER BY sort_order, prefix").all()).results || [];
        const domains = (await env2.DB.prepare("SELECT domain, name FROM optimized_domains WHERE is_builtin = 0").all()).results || [];
        const st = await getSettings(env2);
        const body = JSON.stringify({ version: CURRENT_VERSION, exportedAt: ( /* @__PURE__ */new Date()).toISOString(), routes, domains, settings: st.raw }, null, 2);
        return new Response(body, { headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Content-Disposition": 'attachment; filename="proxy-config-' + ( /* @__PURE__ */new Date()).toISOString().slice(0, 10) + '.json"',
                "Cache-Control": "no-store"
            } });
    }
    if (url.pathname === '/admin/api/import/preview' && request.method === 'POST') {
        const data = await readJson(request);
        const existing = (await env2.DB.prepare('SELECT prefix FROM routes').all()).results || [];
        const plan = inspectImport(data, existing.map(route => route.prefix), SETTING_KEYS);
        return json(plan, plan.success ? 200 : 400);
    }
    if (url.pathname === "/admin/api/import" && request.method === "POST") {
        const data = await readJson(request);
        if (!data || typeof data !== "object")
            return json({ error: "不是合法的配置 JSON" }, 400);
        const stmts = [];
        let nr = 0, nd = 0;
        const skipped = [];
        for (const r of Array.isArray(data.routes) ? data.routes : []) {
            const err = validatePrefix(r?.prefix);
            const targets = splitTargets(r?.target);
            if (err || !targets.length || !targets.every(isValidHttpUrl) || parseHeaderLines(r.custom_headers).error || !validIpList(parseIpList(r.ip_allow)) || !validIpList(parseIpList(r.ip_block))) {
                skipped.push(String(r?.prefix || "?"));
                continue;
            }
            stmts.push(env2.DB.prepare(`INSERT OR REPLACE INTO routes (prefix, target, remark, cache_img, compat_mode, ip_mode, use_relay, last_play, sort_order, enabled, custom_headers, ip_allow, ip_block)
         VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, (SELECT use_relay FROM routes WHERE prefix = ?), 'auto'), COALESCE((SELECT last_play FROM routes WHERE prefix = ?), ''), ?, ?, ?, ?, ?)`).bind(normalizePrefix(r.prefix), targets.join(","), String(r.remark || ""), r.cache_img === "off" ? "off" : "on", r.compat_mode === "on" ? "on" : "off", normalizeIpMode(r.ip_mode), normalizeRelayMode(r.use_relay, null), normalizePrefix(r.prefix), normalizePrefix(r.prefix), Number(r.sort_order) || 0, r.enabled === 0 ? 0 : 1, String(r.custom_headers || ""), String(r.ip_allow || ""), String(r.ip_block || "")));
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
        invalidateRelayCache();
        await auditLog(env2, "import", `routes=${nr} domains=${nd} skipped=${skipped.length}`);
        return json({ success: true, routes: nr, domains: nd, skipped });
    }
    if (url.pathname === "/admin/api/routes/toggle" && request.method === "POST") {
        const data = await readJson(request) || {};
        const prefix = normalizePrefix(data.prefix);
        if (!prefix)
            return json({ error: "缺少 prefix" }, 400);
        await env2.DB.prepare("UPDATE routes SET enabled = ? WHERE prefix = ?").bind(data.enabled ? 1 : 0, prefix).run();
        clearRouteCache();
        await auditLog(env2, data.enabled ? "route.enable" : "route.disable", "/" + prefix);
        return json({ success: true });
    }
    if (url.pathname === "/admin/api/routes/reorder" && request.method === "POST") {
        const data = await readJson(request) || {};
        const order = Array.isArray(data.order) ? data.order.map(normalizePrefix).filter(Boolean) : [];
        if (!order.length)
            return json({ error: "缺少 order" }, 400);
        await env2.DB.batch(order.map((pf, i) => env2.DB.prepare("UPDATE routes SET sort_order = ? WHERE prefix = ?").bind(i, pf)));
        return json({ success: true });
    }
    if (url.pathname === "/admin/api/routes/test" && request.method === "POST") {
        const data = await readJson(request) || {};
        const route = await env2.DB.prepare("SELECT target FROM routes WHERE prefix = ?").bind(normalizePrefix(data.prefix)).first();
        if (!route)
            return json({ error: "路由不存在" }, 404);
        const targets = splitTargets(route.target);
        const results = await Promise.all(targets.map(async (t) => ({ target: t, ...await probeTarget(t) })));
        return json({ success: true, results });
    }
    if (url.pathname === '/admin/api/routes/diagnose' && request.method === 'POST') {
        const data = await readJson(request) || {};
        const route = await env2.DB.prepare('SELECT * FROM routes WHERE prefix = ?').bind(normalizePrefix(data.prefix)).first();
        if (!route) return json({ error: '路由不存在' }, 404);
        const relay = await getRelayConfig(env2);
        return json(await diagnoseRoute(route, request, { edition: 'personal', relayConfigured: !!(relay?.enabled && relay?.secret) }));
    }
    if (url.pathname === "/admin/api/health/run" && request.method === "POST") {
        const out = await runHealthCheck(env2, true);
        return json({ success: true, ...out });
    }
    if (url.pathname === "/admin/api/routes") {
        if (request.method === "GET") {
            const { results } = await env2.DB.prepare(`SELECT * FROM routes ORDER BY sort_order, prefix`).all();
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
            return json(await Promise.all((results || []).map(async (r) => ({ ...r, notification_id: await notificationId(env2, r.prefix), down_count: downMap[r.prefix] || 0 }))));
        }
        if (request.method === "POST") {
            const data = await readJson(request);
            if (!data)
                return json({ error: "请求体不是合法 JSON" }, 400);
            const err = validatePrefix(data.prefix);
            if (err)
                return json({ error: err }, 400);
            const prefix = normalizePrefix(data.prefix);
            const oldPrefix = data.oldPrefix ? normalizePrefix(data.oldPrefix) : "";
            const targets = splitTargets(data.target);
            if (!targets.length)
                return json({ error: "请至少填写一个目标地址" }, 400);
            const badTarget = targets.find((t) => !isValidHttpUrl(t));
            if (badTarget)
                return json({ error: "目标地址必须是 http(s):// 开头的合法 URL：" + badTarget }, 400);
            const hdrCheck = parseHeaderLines(data.custom_headers);
            if (hdrCheck.error)
                return json({ error: hdrCheck.error }, 400);
            const allowList = parseIpList(data.ip_allow);
            const blockList = parseIpList(data.ip_block);
            if (!validIpList(allowList) || !validIpList(blockList))
                return json({ error: "IP 黑白名单格式不合法（支持 IPv4、IPv6 和 IPv4 CIDR，用逗号或空格分隔）" }, 400);
            const isRename = oldPrefix && oldPrefix !== prefix;
            const existing = await env2.DB.prepare("SELECT sort_order, last_play, enabled, use_relay FROM routes WHERE prefix = ?").bind(isRename ? oldPrefix : prefix).first();
            if (isRename) {
                const clash = await env2.DB.prepare("SELECT 1 AS x FROM routes WHERE prefix = ?").bind(prefix).first();
                if (clash)
                    return json({ error: "路径 /" + prefix + " 已存在" }, 409);
            }
            else if (!oldPrefix && existing) {
                return json({ error: "路径 /" + prefix + " 已存在，请直接编辑它" }, 409);
            }
            const insert = env2.DB.prepare("INSERT OR REPLACE INTO routes (prefix, target, remark, cache_img, compat_mode, ip_mode, use_relay, last_play, sort_order, enabled, custom_headers, ip_allow, ip_block) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(prefix, targets.join(","), data.remark || "", data.cache_img === "off" ? "off" : "on", data.compat_mode === "on" ? "on" : "off", normalizeIpMode(data.ip_mode), normalizeRelayMode(data.use_relay, normalizeRelayMode(existing?.use_relay)), existing?.last_play || "", existing?.sort_order || 0, existing?.enabled === 0 ? 0 : 1, String(data.custom_headers || "").trim(), allowList.join(","), blockList.join(","));
            if (isRename)
                await env2.DB.batch([insert, env2.DB.prepare("DELETE FROM routes WHERE prefix = ?").bind(oldPrefix)]);
            else
                await insert.run();
            clearRouteCache();
            await auditLog(env2, isRename ? "route.rename" : "route.save", "/" + (isRename ? oldPrefix + " → /" : "") + prefix);
            return json({ success: true });
        }
        if (request.method === "DELETE") {
            const prefix = url.searchParams.get("prefix");
            if (!prefix)
                return json({ error: "缺少 prefix 参数" }, 400);
            await env2.DB.prepare("DELETE FROM routes WHERE prefix = ?").bind(normalizePrefix(prefix)).run();
            clearRouteCache();
            try {
                await env2.DB.prepare("DELETE FROM route_health WHERE prefix = ?").bind(normalizePrefix(prefix)).run();
            }
            catch (_) {
            }
            await auditLog(env2, "route.delete", "/" + normalizePrefix(prefix));
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
                return json({ success: false, error: "域名或名称不合法" }, 400);
            try {
                const success = await addOptimizedDomain(env2, domain2, name);
                await auditLog(env2, "domain.add", domain2);
                return json({ success });
            }
            catch (e) {
                if (/UNIQUE/i.test(String(e?.message)))
                    return json({ success: false, error: "该域名已存在" }, 409);
                return json({ success: false, error: "保存失败" }, 500);
            }
        }
    }
    if (url.pathname.startsWith("/admin/api/optimized-domains/")) {
        const id = parseInt(url.pathname.split("/").pop(), 10);
        if (!Number.isFinite(id))
            return json({ success: false, error: "id 不合法" }, 400);
        if (request.method === "PUT") {
            const data = await readJson(request);
            const domain2 = normalizeDomain(data?.domain);
            const name = String(data?.name || "").trim();
            if (!domain2 || !name)
                return json({ success: false, error: "域名或名称不合法" }, 400);
            try {
                const success = await updateOptimizedDomain(env2, id, domain2, name);
                if (!success)
                    return json({ success: false, error: "内置域名不可修改，或该记录不存在" }, 403);
                return json({ success });
            }
            catch (e) {
                if (/UNIQUE/i.test(String(e?.message)))
                    return json({ success: false, error: "该域名已存在" }, 409);
                return json({ success: false, error: "保存失败" }, 500);
            }
        }
        if (request.method === "DELETE") {
            const success = await deleteOptimizedDomain(env2, id);
            if (!success)
                return json({ success: false, error: "内置域名不可删除，或该记录不存在" }, 403);
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
                zonesError = zoneInfo.error || "未解析到 Zone ID";
                const zr = await getZones(env2);
                if (zr.success && Array.isArray(zr.result)) {
                    zones = zr.result;
                    if (zones[0])
                        zoneId = zones[0].id;
                }
                else {
                    zonesError = zr.errors?.[0]?.message || zr.error || "获取区域列表失败";
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
                        zonesError = rr.errors?.[0]?.message || rr.error || "读取 DNS 记录失败";
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
            return json({ success: false, error: "缺少必要参数（记录名 / 目标）" }, 400);
        if (!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(targets[0]) && !targets[0].includes(":") && !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(targets[0])) {
            return json({ success: false, error: "目标必须是合法域名、IPv4 或 IPv6" }, 400);
        }
        if (!zoneId) {
            const info3 = await resolveZoneInfo(env2);
            zoneId = info3.zoneId;
            if (!zoneId)
                return json({ success: false, error: info3.error || "未解析到 Zone ID，请检查 CF_API_TOKEN 权限" }, 400);
        }
        const result = await createOrUpdateDNSRecord(env2, zoneId, nameInput, targets[0], baseDomain);
        if (result.success && result.result) {
            await saveDNSConfig(env2, nameInput, targets[0], zoneId);
            invalidateZoneInfoCache();
            await auditLog(env2, "dns.replace", `${result.result.name} → ${result.result.content}`);
            return json({ success: true, result: result.result });
        }
        return json({ success: false, error: result.error || result.errors?.[0]?.message || "DNS 替换失败", errors: result.errors });
    }
    if (url.pathname === "/admin/api/relay" && (request.method === "GET" || request.method === "POST")) {
        if (request.method === "GET") {
            const c = await getRelayConfig(env2);
            return json({
                success: true,
                config: {
                    relayUrl: c.relayUrl,
                    port: c.port,
                    secret: c.secret ? "●●●●●●●●" : "",
                    hasSecret: !!c.secret,
                    hasCert: !!(c.certPem && c.keyPem),
                    enabled: c.enabled,
                    updatedAt: c.updatedAt
                }
            });
        }
        if (request.method === "POST") {
            if (!env2.DB)
                return json({ error: "DB 未绑定" }, 500);
            const data = await readJson(request);
            if (!data)
                return json({ error: "请求体不是合法 JSON" }, 400);
            const cur = await getRelayConfig(env2);
            const relayUrl = normalizeRelayBase(data.relayUrl ?? cur.relayUrl);
            const secret = data.secret && data.secret !== "●●●●●●●●" ? String(data.secret).trim() : cur.secret;
            const certPem = data.certPem !== void 0 ? String(data.certPem).trim() : cur.certPem;
            const keyPem = data.keyPem !== void 0 ? String(data.keyPem).trim() : cur.keyPem;
            const enabled = data.enabled === "on" || data.enabled === true ? "on" : "off";
            const nowIso = ( /* @__PURE__ */new Date()).toISOString();
            try {
                await env2.DB.batch([
                    env2.DB.prepare("DELETE FROM relay_config WHERE id = 1"),
                    env2.DB.prepare("INSERT INTO relay_config (id, relay_url, secret, cert_pem, key_pem, enabled, updated_at) VALUES (1, ?, ?, ?, ?, ?, ?)").bind(relayUrl, secret, certPem, keyPem, enabled, nowIso)
                ]);
                await auditLog(env2, "relay.save", relayUrl + (enabled ? " (启用)" : " (停用)"));
                invalidateRelayCache();
            }
            catch (e) {
                return json({ error: "保存失败: " + String(e?.message || e).slice(0, 150) }, 500);
            }
            const push = { vpsStatus: 0, vpsBody: "", vpsError: "" };
            if (data.pushToVps !== false && relayUrl && secret) {
                const bodyJson = JSON.stringify({
                    secret,
                    port: relayPortFrom(relayUrl),
                    cert_pem: certPem,
                    key_pem: keyPem,
                    restart: Boolean(certPem && keyPem)
                });
                const tryKeys = [cur.secret, secret].filter((v, i, a) => v && a.indexOf(v) === i);
                for (const k of tryKeys) {
                    try {
                        const res = await fetch(new Request(relayUrl + "/_relay/config", {
                            method: "POST",
                            headers: { "Content-Type": "application/json", "X-Relay-Key": k },
                            body: bodyJson
                        }));
                        push.vpsStatus = res.status;
                        push.vpsBody = (await res.text()).slice(0, 200);
                        if (res.status >= 200 && res.status < 300)
                            break;
                    }
                    catch (e) {
                        push.vpsStatus = 0;
                        push.vpsBody = "";
                        push.vpsError = String(e?.message || e).slice(0, 200);
                    }
                }
            }
            return json({ success: true, ...push });
        }
    }
    if (url.pathname === "/admin/api/relay/test" && request.method === "POST") {
        const c = await getRelayConfig(env2);
        if (!c.relayUrl || !c.secret)
            return json({ ok: false, error: "请先填写中继地址和密钥" });
        const t0 = Date.now();
        try {
            const res = await fetch(new Request(c.relayUrl + "/_relay/health", { headers: { "X-Relay-Key": c.secret }, signal: AbortSignal.timeout(8000) }));
            const body = await readJson(res, { limit: 16384, timeoutMs: 5000 });
            const ok = res.ok && body?.ok === true;
            return json({ ok, status: res.status, ms: Date.now() - t0, version: typeof body?.version === 'string' ? body.version.slice(0, 80) : '', tls: body?.tls === true,
                ...(ok ? {} : { error: '中继未返回有效健康状态，请检查服务与鉴权' }) });
        }
        catch (e) {
            return json({ ok: false, ms: Date.now() - t0, error: '中继连接失败或超时，请检查服务、证书与网络' });
        }
    }
    if (url.pathname === "/admin/api/relay/stats" && request.method === "GET") {
        const c = await getRelayConfig(env2);
        if (!c.relayUrl || !c.secret)
            return json({ ok: false, error: "未配置中继" });
        try {
            const res = await fetch(new Request(c.relayUrl + "/_relay/stats", { headers: { "X-Relay-Key": c.secret }, signal: AbortSignal.timeout(8e3) }));
            const text = await res.text();
            let body = null;
            try {
                body = JSON.parse(text);
            }
            catch (_) {
            }
            if (!res.ok || !body?.ok)
                return json({ ok: false, status: res.status, error: body && JSON.stringify(body).slice(0, 120) || "HTTP " + res.status });
            return json({ ok: true, ...body });
        }
        catch (e) {
            return json({ ok: false, error: String(e?.message || e).slice(0, 160) });
        }
    }
    return json({ error: "Not found" }, 404);
}

export { handleAdminApi };
