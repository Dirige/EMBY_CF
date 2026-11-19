// Baseline: 4e0357e. Edition-specific behavior is intentionally retained.
import { formatBytes, getShanghaiParts } from "./../../../shared/http/primitives.js";
import { cfGetWorkerSummary, cfGetZoneDailySeries, cfGetZoneSummary } from "./analytics.js";
import { getStatsHost, resolveZoneInfo } from "./zone.js";
import { getBaseDomain, getCFApiToken, getTelegramChatId, getTelegramToken } from "./../../../shared/auth/session.js";
import { json } from "./../../../shared/http/responses.js";

async function handleStatsRequest(env2, url) {
    const dateParam = url.searchParams.get("date") || "";
    const dateKey = /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : getShanghaiParts().dateKey;
    const cf = await cfGetZoneSummary(env2, dateKey);
    const worker = await cfGetWorkerSummary(env2, dateKey);
    const cfOk = !cf.error;
    const trafficBytes = cfOk ? Number(cf.bytes) || 0 : 0;
    const requests = cfOk ? Number(cf.requests) || 0 : 0;
    const hourlySeries = Array.from({ length: 24 }, (_, h) => ({
        label: String(h).padStart(2, "0") + ":00",
        total: cfOk && cf.hourly ? cf.hourly[h] || 0 : 0
    }));
    let dailySeries = [];
    if (cfOk) {
        const s = await cfGetZoneDailySeries(env2, 7);
        if (!s.error && Array.isArray(s.series))
            dailySeries = s.series;
    }
    const zoneInfo = await resolveZoneInfo(env2);
    const tgReady = Boolean(getTelegramToken(env2) && getTelegramChatId(env2));
    return json({
        error: null,
        data: {
            date: dateKey,
            todayRequests: requests,
            todayTraffic: formatBytes(trafficBytes),
            todayTrafficBytes: trafficBytes,
            todayVisits: cfOk ? Number(cf.visits) || 0 : null,
            cf: cfOk ? { requests: Number(cf.requests) || 0, trafficBytes: Number(cf.bytes) || 0, visits: Number(cf.visits) || 0, zoneId: cf.zoneId, zoneName: cf.zoneName, hostMatched: cf.hostMatched, note: cf.note || "", warning: cf.warning || "" } : { error: cf.error },
            worker: worker.error ? { error: worker.error } : { requests: Number(worker.requests) || 0, byScript: worker.byScript || {} },
            hourlySeries,
            dailySeries,
            cfStatus: cfOk ? cf.hostMatched ? "CF 统计正常" : "CF 统计正常（全 Zone）" : "CF 查询失败",
            cfError: cfOk ? "" : cf.error,
            envInfo: {
                baseDomain: getBaseDomain(env2),
                statsHost: getStatsHost(env2),
                zoneId: zoneInfo.zoneId || "",
                zoneSource: zoneInfo.from || "",
                hasCfToken: Boolean(getCFApiToken(env2)),
                telegramConfigured: tgReady,
                telegramTokenVar: getTelegramToken(env2) ? "已读取" : "未读取",
                telegramChatVar: getTelegramChatId(env2) ? "已读取" : "未读取"
            },
            source: cfOk ? "CF" : "CF 不可用",
            lastUpdated: ( /* @__PURE__ */new Date()).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })
        }
    });
}

export { handleStatsRequest };
