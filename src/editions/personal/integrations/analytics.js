// Baseline: 4e0357e. Edition-specific behavior is intentionally retained.
import { getCFApiToken } from "./../../../shared/auth/session.js";
import { getStatsHost, resolveZoneInfo } from "./zone.js";
import { cfGetWorkerRequests, cfGetZoneAnalytics, dayRangeIso, sendTelegramMessage, tgEscape } from "./../../../shared/integrations/analytics.js";
import { formatBytes, getShanghaiParts } from "./../../../shared/http/primitives.js";
import { isValidHttpUrl } from "./../../../shared/http/validation.js";
import { notificationEnv, recordNotification } from '../config/notifications.js';

async function cfGetZoneSummary(env2, dateKey) {
    const token = getCFApiToken(env2);
    if (!token)
        return { error: "未配置 CF_API_TOKEN" };
    let info3;
    try {
        info3 = await resolveZoneInfo(env2);
    }
    catch (e) {
        return { error: String(e?.message || e) };
    }
    if (!info3.zoneId)
        return { error: info3.error || "未解析到 CF_ZONE_ID" };
    const { start, end } = dayRangeIso(dateKey);
    let zone = null;
    let hostDim = true;
    let firstError = "";
    try {
        zone = await cfGetZoneAnalytics(info3.zoneId, token, start, end, true);
    }
    catch (e) {
        firstError = String(e?.message || e);
        hostDim = false;
        try {
            zone = await cfGetZoneAnalytics(info3.zoneId, token, start, end, false);
        }
        catch (e2) {
            return { error: String(e2?.message || e2).slice(0, 240) };
        }
    }
    if (!zone?.series)
        return { error: "CF 未返回数据（Token 可能缺少 Analytics:Read 权限）" };
    const statsHost = getStatsHost(env2);
    const rows = hostDim ? zone.series.filter((it) => {
        const h = String(it?.dimensions?.clientRequestHTTPHost || "").toLowerCase();
        return !statsHost || h === statsHost;
    }) : zone.series;
    let hostMatched = true;
    if (hostDim && statsHost && rows.length === 0) {
        hostMatched = false;
    }
    const useRows = hostMatched ? rows : zone.series;
    let requests = 0, visits = 0, bytes = 0;
    const hourly = Array.from({ length: 24 }, () => 0);
    for (const item of useRows) {
        const n = Number(item?.count) || 0;
        requests += n;
        visits += Number(item?.sum?.visits) || 0;
        bytes += Number(item?.sum?.edgeResponseBytes) || 0;
        const raw = item?.dimensions?.datetimeHour;
        if (raw) {
            const h = (new Date(raw).getUTCHours() + 8) % 24;
            if (h >= 0 && h < 24)
                hourly[h] += n;
        }
    }
    return {
        requests,
        visits,
        bytes,
        hourly,
        zoneId: info3.zoneId,
        zoneName: info3.zoneName,
        statsHost,
        hostMatched,
        hostDim,
        note: hostMatched ? "" : "CF 中未找到 " + statsHost + " 的数据，当前展示整个 Zone 汇总；请检查 DNS_RECORD_NAME / STATS_HOSTS",
        warning: firstError ? "按域名分组查询失败，已退回 Zone 汇总: " + firstError.slice(0, 120) : ""
    };
}

async function cfGetZoneDailySeries(env2, days = 7) {
    const token = getCFApiToken(env2);
    if (!token)
        return { error: "未配置 CF_API_TOKEN" };
    let info3;
    try {
        info3 = await resolveZoneInfo(env2);
    }
    catch (e) {
        return { error: String(e?.message || e) };
    }
    if (!info3.zoneId)
        return { error: info3.error || "未解析到 CF_ZONE_ID" };
    const today = getShanghaiParts().dateKey;
    const startDate = new Date(( /* @__PURE__ */new Date(today + "T00:00:00Z")).getTime() - (days - 1) * 864e5).toISOString().slice(0, 10);
    const start = ( /* @__PURE__ */new Date(startDate + "T00:00:00+08:00")).toISOString();
    const end = new Date(( /* @__PURE__ */new Date(today + "T00:00:00+08:00")).getTime() + 864e5 - 1).toISOString();
    const statsHost = getStatsHost(env2);
    let zone = null;
    let hostDim = true;
    try {
        zone = await cfGetZoneAnalytics(info3.zoneId, token, start, end, true);
    }
    catch (_) {
        hostDim = false;
        try {
            zone = await cfGetZoneAnalytics(info3.zoneId, token, start, end, false);
        }
        catch (e) {
            return { error: String(e?.message || e).slice(0, 200) };
        }
    }
    if (!zone?.series)
        return { error: "CF 未返回数据" };
    const rows = hostDim && statsHost ? zone.series.filter((it) => {
        const h = String(it?.dimensions?.clientRequestHTTPHost || "").toLowerCase();
        return !h || h === statsHost;
    }) : zone.series;
    const map = /* @__PURE__ */ new Map();
    for (const item of rows) {
        const raw = item?.dimensions?.datetimeHour;
        if (!raw)
            continue;
        const { dateKey } = getShanghaiParts(new Date(raw).getTime());
        const cur = map.get(dateKey) || { requests: 0, traffic: 0, visits: 0 };
        cur.requests += Number(item?.count) || 0;
        cur.traffic += Number(item?.sum?.edgeResponseBytes) || 0;
        cur.visits += Number(item?.sum?.visits) || 0;
        map.set(dateKey, cur);
    }
    const series = [];
    for (let i = 0; i < days; i++) {
        const key = new Date(( /* @__PURE__ */new Date(startDate + "T00:00:00Z")).getTime() + i * 864e5).toISOString().slice(0, 10);
        const r = map.get(key) || { requests: 0, traffic: 0, visits: 0 };
        series.push({ date: key, requests: r.requests, traffic: r.traffic, visits: r.visits });
    }
    return { series, zoneId: info3.zoneId, statsHost };
}

async function cfGetWorkerSummary(env2, dateKey) {
    const token = getCFApiToken(env2);
    if (!token)
        return { error: "未配置 CF_API_TOKEN" };
    let info3;
    try {
        info3 = await resolveZoneInfo(env2);
    }
    catch (e) {
        return { error: String(e?.message || e) };
    }
    if (!info3.accountId)
        return { error: "未解析到 CF_ACCOUNT_ID（Token 需 Account Analytics:Read）" };
    const { start, end } = dayRangeIso(dateKey);
    try {
        const account = await cfGetWorkerRequests(info3.accountId, token, start, end);
        if (!account?.workersInvocationsAdaptive)
            return { error: "CF 未返回 Worker 调用数据" };
        let requests = 0;
        const hourly = Array.from({ length: 24 }, () => 0);
        const byScript = {};
        for (const item of account.workersInvocationsAdaptive) {
            const n = Number(item?.sum?.requests) || 0;
            requests += n;
            const name = item?.dimensions?.scriptName || "unknown";
            byScript[name] = (byScript[name] || 0) + n;
            const raw = item?.dimensions?.datetime;
            if (raw) {
                const h = (new Date(raw).getUTCHours() + 8) % 24;
                if (h >= 0 && h < 24)
                    hourly[h] += n;
            }
        }
        return { requests, hourly, byScript, accountId: info3.accountId };
    }
    catch (e) {
        return { error: String(e?.message || e).slice(0, 200) };
    }
}

async function buildDailyReport(env2, dateKey) {
    const key = /^\d{4}-\d{2}-\d{2}$/.test(dateKey || "") ? dateKey : getShanghaiParts().dateKey;
    const cf = await cfGetZoneSummary(env2, key);
    const worker = await cfGetWorkerSummary(env2, key);
    const cfOk = !cf.error;
    let daily = [];
    if (cfOk) {
        const s = await cfGetZoneDailySeries(env2, 7);
        if (!s.error && Array.isArray(s.series))
            daily = s.series;
    }
    const requests = cfOk ? Number(cf.requests) || 0 : null;
    const traffic = cfOk ? Number(cf.bytes) || 0 : null;
    const lines = [];
    lines.push("📊 <b>Emby Proxy 日报</b>");
    lines.push("<code>" + tgEscape(key) + "</code>");
    lines.push("");
    lines.push("请求数：" + (requests == null ? "（CF 数据不可用）" : "<b>" + requests + "</b>"));
    lines.push("出站流量：" + (traffic == null ? "（CF 数据不可用）" : "<b>" + formatBytes(traffic) + "</b>"));
    if (cfOk) {
        lines.push("CF 访问量：<b>" + (Number(cf.visits) || 0) + "</b>");
    }
    if (!worker.error && worker.requests)
        lines.push("Worker 调用：<b>" + worker.requests + "</b>");
    if (daily.length) {
        lines.push("");
        lines.push("<b>近 7 日</b>");
        for (const d of daily) {
            lines.push(d.date + "  " + d.requests + " 次 / " + formatBytes(d.traffic));
        }
    }
    if (!cfOk) {
        lines.push("");
        lines.push("<i>CF 数据不可用，请登录后台检查统计配置</i>");
    }
    lines.push("");
    lines.push("<i>" + tgEscape(( /* @__PURE__ */new Date()).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })) + "</i>");
    return lines.join("\n");
}

async function sendDailyReport(env2, dateKey) {
    const key = /^\d{4}-\d{2}-\d{2}$/.test(dateKey || "") ? dateKey : getShanghaiParts().dateKey;
    const text = await buildDailyReport(env2, key);
    const result = await sendTelegramMessage(await notificationEnv(env2), text);
    const tg = { ok: result.ok, ...(result.ok ? {} : { error: 'Telegram 发送失败，请检查通知配置和机器人权限' }) };
    let webhook = { ok: false, skipped: true };
    if (env2.NOTIFY_WEBHOOK && isValidHttpUrl(env2.NOTIFY_WEBHOOK)) {
        try {
            const res = await fetch(env2.NOTIFY_WEBHOOK, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text, content: text, date: key }),
                signal: AbortSignal.timeout(15000)
            });
            webhook = { ok: res.ok, status: res.status };
        }
        catch (e) {
            webhook = { ok: false, error: 'Webhook 发送失败' };
        }
    }
    await recordNotification(env2, 'daily', tg.ok || webhook.ok);
    return { ok: tg.ok || webhook.ok, telegram: tg, webhook, date: key, text };
}

export { cfGetZoneSummary, cfGetZoneDailySeries, cfGetWorkerSummary, buildDailyReport, sendDailyReport };
