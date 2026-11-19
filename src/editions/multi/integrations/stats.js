// Baseline: 4e0357e. Edition-specific behavior is intentionally retained.
import { json } from "./../../../shared/http/responses.js";
import { formatBytes, getShanghaiParts } from "./../../../shared/http/primitives.js";
import { getStatsHost, getUserDomain, resolveZoneInfo } from "./zone.js";
import { cfGetAccountDailySeries, cfGetAccountSummary, cfGetWorkerSummary, cfGetZoneSummary, getWorkerHosts } from "./analytics.js";
import { getBaseDomain, getCFApiToken, getTelegramChatId, getTelegramToken } from "./../../../shared/auth/session.js";

function escapeLike(s) {
    return String(s || "").replace(/[!%_]/g, (ch) => "!" + ch);
}

async function getD1Stats(env2, dateKey, owner = "") {
    const empty = { requests: 0, plays: 0, playbackInfo: 0, traffic: 0, hourly: new Array(24).fill(0), routes: [] };
    if (!env2.DB)
        return empty;
    try {
        if (owner) {
            const totals2 = await env2.DB.prepare(`SELECT COALESCE(SUM(request_count),0) AS requests,
                COALESCE(SUM(play_count),0) AS plays,
                COALESCE(SUM(playback_info_count),0) AS info,
                COALESCE(SUM(traffic_bytes),0) AS traffic
         FROM user_stats_hourly WHERE owner = ? AND bucket_date = ?`).bind(owner, dateKey).first();
            const hourly2 = await env2.DB.prepare(`SELECT bucket_hour AS hour,
                COALESCE(SUM(request_count),0) AS requests,
                COALESCE(SUM(traffic_bytes),0) AS traffic
         FROM user_stats_hourly WHERE owner = ? AND bucket_date = ? GROUP BY bucket_hour`).bind(owner, dateKey).all();
            const routes2 = await env2.DB.prepare(`SELECT prefix,
                COALESCE(SUM(request_count),0) AS requests,
                COALESCE(SUM(traffic_bytes),0) AS traffic
         FROM route_stats_daily WHERE bucket_date = ? AND prefix LIKE ? ESCAPE '!' GROUP BY prefix ORDER BY requests DESC LIMIT 12`).bind(dateKey, escapeLike(owner) + "/%").all();
            const h2 = new Array(24).fill(0);
            for (const r of hourly2.results || []) {
                const i = Number(r.hour);
                if (i >= 0 && i < 24)
                    h2[i] += Number(r.requests) || 0;
            }
            return {
                requests: Number(totals2?.requests) || 0,
                plays: Number(totals2?.plays) || 0,
                playbackInfo: Number(totals2?.info) || 0,
                traffic: Number(totals2?.traffic) || 0,
                hourly: h2,
                routes: (routes2.results || []).map((r) => ({
                    prefix: String(r.prefix || "").startsWith(owner + "/") ? String(r.prefix).slice(owner.length + 1) : r.prefix || "",
                    requests: Number(r.requests) || 0,
                    traffic: Number(r.traffic) || 0
                }))
            };
        }
        const totals = await env2.DB.prepare(`SELECT COALESCE(SUM(request_count),0) AS requests,
              COALESCE(SUM(play_count),0) AS plays,
              COALESCE(SUM(playback_info_count),0) AS info,
              COALESCE(SUM(traffic_bytes),0) AS traffic
       FROM proxy_stats_hourly WHERE bucket_date = ?`).bind(dateKey).first();
        const hourly = await env2.DB.prepare(`SELECT bucket_hour AS hour,
              COALESCE(SUM(request_count),0) AS requests,
              COALESCE(SUM(traffic_bytes),0) AS traffic
       FROM proxy_stats_hourly WHERE bucket_date = ? GROUP BY bucket_hour`).bind(dateKey).all();
        const routes = await env2.DB.prepare(`SELECT prefix,
              COALESCE(SUM(request_count),0) AS requests,
              COALESCE(SUM(traffic_bytes),0) AS traffic
       FROM route_stats_daily WHERE bucket_date = ? AND instr(prefix, '/') = 0
       GROUP BY prefix ORDER BY requests DESC LIMIT 12`).bind(dateKey).all();
        const h = new Array(24).fill(0);
        for (const r of hourly.results || []) {
            const i = Number(r.hour);
            if (i >= 0 && i < 24)
                h[i] += Number(r.requests) || 0;
        }
        return {
            requests: Number(totals?.requests) || 0,
            plays: Number(totals?.plays) || 0,
            playbackInfo: Number(totals?.info) || 0,
            traffic: Number(totals?.traffic) || 0,
            hourly: h,
            routes: (routes.results || []).map((r) => ({ prefix: r.prefix || "", requests: Number(r.requests) || 0, traffic: Number(r.traffic) || 0 }))
        };
    }
    catch (e) {
        console.error("getD1Stats failed:", e?.message);
        return empty;
    }
}

async function handleStatsRequest(env2, url, opts = {}) {
    if (!env2.DB)
        return json({ error: "D1 \u6570\u636E\u5E93\u672A\u7ED1\u5B9A", data: null });
    const owner = String(opts.owner || "").toLowerCase();
    const dateParam = url.searchParams.get("date") || "";
    const dateKey = /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : getShanghaiParts().dateKey;
    const d1 = await getD1Stats(env2, dateKey, owner);
    let hostSet = null;
    if (owner) {
        const userDomain = getUserDomain(env2);
        let sub = "";
        try {
            const row = await env2.DB.prepare("SELECT subdomain, username FROM users WHERE username = ?").bind(owner).first();
            sub = String(row?.subdomain || row?.username || owner).trim().toLowerCase();
        }
        catch (_) {
            sub = owner;
        }
        if (userDomain && sub)
            hostSet = /* @__PURE__ */ new Set([sub + "." + userDomain]);
    }
    else {
        hostSet = await getWorkerHosts(env2);
    }
    const acc = hostSet ? await cfGetAccountSummary(env2, dateKey, hostSet) : { error: "\u672A\u914D\u7F6E\u7EDF\u8BA1\u57DF\u540D\u8303\u56F4" };
    const accOk = !acc.error;
    const cf = accOk || owner ? { error: "" } : await cfGetZoneSummary(env2, dateKey);
    const worker = owner ? { error: "" } : await cfGetWorkerSummary(env2, dateKey);
    const cfOk = !accOk && !owner && !cf.error;
    const statsSource = accOk ? "account" : cfOk ? "zone" : "unavailable";
    const trafficBytes = accOk ? Number(acc.bytes) || 0 : cfOk ? Number(cf.bytes) || 0 : null;
    const requests = accOk ? Number(acc.requests) || 0 : cfOk ? Number(cf.requests) || 0 : null;
    const visits = accOk ? Number(acc.visits) || 0 : cfOk ? Number(cf.visits) || 0 : null;
    const hourly = accOk ? acc.hourly : cfOk ? cf.hourly : null;
    const hourlySeries = Array.from({ length: 24 }, (_, h) => ({
        label: String(h).padStart(2, "0") + ":00",
        total: hourly ? hourly[h] || 0 : 0,
        cf: hourly ? hourly[h] || 0 : 0
    }));
    let dailySeries = [];
    if (accOk) {
        const s = await cfGetAccountDailySeries(env2, 7, hostSet);
        if (!s.error && Array.isArray(s.series))
            dailySeries = s.series;
    }
    const zoneInfo = owner ? { zoneId: "", zoneName: "", from: "" } : await resolveZoneInfo(env2);
    const tgReady = Boolean(getTelegramToken(env2) && getTelegramChatId(env2));
    return json({
        error: null,
        data: {
            date: dateKey,
            scope: owner ? "user" : "global",
            owner,
            todayRequests: requests,
            todayTraffic: trafficBytes == null ? null : formatBytes(trafficBytes),
            todayTrafficBytes: trafficBytes,
            todayVisits: visits,
            plays: d1.plays,
            playbackInfo: d1.playbackInfo,
            d1: { requests: d1.requests, trafficBytes: d1.traffic, plays: d1.plays, playbackInfo: d1.playbackInfo },
            account: accOk ? { requests: Number(acc.requests) || 0, trafficBytes: Number(acc.bytes) || 0, visits: Number(acc.visits) || 0, accountId: acc.accountId, hostMatched: acc.hostMatched, note: acc.note || "", warning: acc.warning || "" } : { error: acc.error || "" },
            cf: cfOk ? { requests: Number(cf.requests) || 0, trafficBytes: Number(cf.bytes) || 0, visits: Number(cf.visits) || 0, zoneId: cf.zoneId, zoneName: cf.zoneName, hostMatched: cf.hostMatched, note: cf.note || "", warning: cf.warning || "" } : { error: cf.error },
            worker: worker.error ? { error: worker.error } : { requests: Number(worker.requests) || 0, byScript: worker.byScript || {} },
            hourlySeries,
            dailySeries,
            topRoutes: d1.routes,
            statsSource,
            cfStatus: owner ? accOk ? "CF \u8D26\u53F7\u5206\u6790\uFF08\u6211\u7684\u57DF\u540D\uFF09" : "CF \u6570\u636E\u4E0D\u53EF\u7528" : accOk ? acc.hostMatched === false ? "CF \u8D26\u53F7\u5206\u6790\uFF08\u8D26\u53F7\u603B\u91CF\uFF09" : "CF \u8D26\u53F7\u5206\u6790\uFF08\u6574\u4E2A\u57DF\u540D\uFF09" : cfOk ? "CF Zone \u7EDF\u8BA1" : "CF \u6570\u636E\u4E0D\u53EF\u7528",
            cfError: owner ? accOk ? "" : acc.error || "" : accOk || cfOk ? "" : acc.error || cf.error,
            envInfo: {
                baseDomain: getBaseDomain(env2),
                statsHost: getStatsHost(env2),
                zoneId: zoneInfo.zoneId || "",
                zoneSource: zoneInfo.from || "",
                hasCfToken: Boolean(getCFApiToken(env2)),
                telegramConfigured: tgReady,
                telegramTokenVar: getTelegramToken(env2) ? "\u5DF2\u8BFB\u53D6" : "\u672A\u8BFB\u53D6",
                telegramChatVar: getTelegramChatId(env2) ? "\u5DF2\u8BFB\u53D6" : "\u672A\u8BFB\u53D6"
            },
            source: accOk ? "CF \u8D26\u53F7\u5206\u6790" : cfOk ? "CF Zone" : "CF \u6570\u636E\u4E0D\u53EF\u7528",
            lastUpdated: ( /* @__PURE__ */new Date()).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })
        }
    });
}

export { escapeLike, getD1Stats, handleStatsRequest };
