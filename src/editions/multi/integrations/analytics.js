// Baseline: 4e0357e. Edition-specific behavior is intentionally retained.
import { formatBytes, getShanghaiParts, toGraphQLStr } from "./../../../shared/http/primitives.js";
import { cfFetchGraphql, cfGetWorkerRequests, cfGetZoneAnalytics, dayRangeIso, sendTelegramMessage, tgEscape } from "./../../../shared/integrations/analytics.js";
import { getStatsHost, getUserDomain, resolveZoneInfo } from "./zone.js";
import { envStr, getCFApiToken } from "./../../../shared/auth/session.js";
import { isValidHttpUrl } from "./../../../shared/http/validation.js";

async function cfGetAccountHttp(cfAccountId, cfApiToken, startIso, endIso, useHostDim = true) {
    const dims = useHostDim ? "datetimeHour clientRequestHTTPHost" : "datetimeHour";
    const query = `query { viewer { accounts(filter: { accountTag: ${toGraphQLStr(cfAccountId)} }) { series: httpRequestsAdaptiveGroups(limit: 10000, filter: { datetime_geq: ${toGraphQLStr(startIso)}, datetime_leq: ${toGraphQLStr(endIso)} }) { count dimensions { ${dims} } sum { edgeResponseBytes visits } } } } }`;
    const data = await cfFetchGraphql(cfApiToken, query);
    return data?.data?.viewer?.accounts?.[0] || null;
}

var workerHostCache = { at: 0, key: "", set: null };

async function getWorkerHosts(env2) {
    const userDomain = getUserDomain(env2);
    const main = getStatsHost(env2);
    const cacheKey = (userDomain || "") + "|" + (main || "") + "|" + (env2.DB ? "db" : "nodb");
    if (workerHostCache.set && workerHostCache.key === cacheKey && Date.now() - workerHostCache.at < 6e4) {
        return workerHostCache.set;
    }
    const set = /* @__PURE__ */ new Set();
    for (const h of envStr(env2, "STATS_HOSTS").split(/[\s,]+/).filter(Boolean))
        set.add(h.toLowerCase());
    if (main)
        set.add(main);
    if (env2.DB && userDomain) {
        try {
            const { results } = await env2.DB.prepare("SELECT username, subdomain FROM users").all();
            for (const u of results || []) {
                const sub = String(u?.subdomain || u?.username || "").trim().toLowerCase();
                if (sub)
                    set.add(sub + "." + userDomain);
            }
        }
        catch (_) {
        }
    }
    workerHostCache.at = Date.now();
    workerHostCache.key = cacheKey;
    workerHostCache.set = set;
    return set;
}

function makeHostMatcher(env2, hostSet) {
    const userDomain = String(getUserDomain(env2) || "").toLowerCase();
    const main = String(getStatsHost(env2) || "").toLowerCase();
    return (raw) => {
        const h = String(raw || "").toLowerCase().replace(/:\d+$/, "");
        if (!h)
            return false;
        if (hostSet && hostSet.has(h))
            return true;
        if (main && h === main)
            return true;
        if (userDomain && (h === userDomain || h.endsWith("." + userDomain)))
            return true;
        return false;
    };
}

async function cfGetZoneSummary(env2, dateKey, hostSet = null) {
    const token = getCFApiToken(env2);
    if (!token)
        return { error: "\u672A\u914D\u7F6E CF_API_TOKEN" };
    let info3;
    try {
        info3 = await resolveZoneInfo(env2);
    }
    catch (e) {
        return { error: String(e?.message || e) };
    }
    if (!info3.zoneId)
        return { error: info3.error || "\u672A\u89E3\u6790\u5230 CF_ZONE_ID" };
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
        return { error: "CF \u672A\u8FD4\u56DE\u6570\u636E\uFF08Token \u53EF\u80FD\u7F3A\u5C11 Analytics:Read \u6743\u9650\uFF09" };
    const statsHost = getStatsHost(env2);
    const wanted = hostSet && hostSet.size ? makeHostMatcher(env2, hostSet) : statsHost ? makeHostMatcher(env2, /* @__PURE__ */ new Set([statsHost])) : null;
    const matches = /* @__PURE__ */ (item) => {
        if (!wanted)
            return true;
        return wanted(item?.dimensions?.clientRequestHTTPHost);
    };
    const rows = hostDim ? zone.series.filter(matches) : zone.series;
    let hostMatched = true;
    let useRows = rows;
    if (hostDim && wanted && rows.length === 0) {
        hostMatched = false;
        useRows = hostSet ? [] : zone.series;
    }
    const sumRows = /* @__PURE__ */ (list) => {
        let requests = 0, visits = 0, bytes = 0;
        const hourly = Array.from({ length: 24 }, () => 0);
        for (const item of list) {
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
        return { requests, visits, bytes, hourly };
    };
    const total = sumRows(useRows);
    const mainRows = hostDim && statsHost ? zone.series.filter((it) => String(it?.dimensions?.clientRequestHTTPHost || "").toLowerCase() === statsHost) : useRows;
    const main = sumRows(mainRows);
    return {
        requests: total.requests,
        visits: total.visits,
        bytes: total.bytes,
        hourly: total.hourly,
        mainRequests: main.requests,
        mainVisits: main.visits,
        mainBytes: main.bytes,
        zoneId: info3.zoneId,
        zoneName: info3.zoneName,
        statsHost,
        hostMatched,
        hostDim,
        note: hostMatched ? "" : "CF \u4E2D\u672A\u627E\u5230 " + (statsHost || "Worker \u57DF\u540D") + " \u7684\u6570\u636E\uFF0C\u5F53\u524D\u5C55\u793A\u6574\u4E2A Zone \u6C47\u603B\uFF1B\u8BF7\u68C0\u67E5 DNS_RECORD_NAME / STATS_HOSTS",
        warning: firstError ? "\u6309\u57DF\u540D\u5206\u7EC4\u67E5\u8BE2\u5931\u8D25\uFF0C\u5DF2\u9000\u56DE Zone \u6C47\u603B: " + firstError.slice(0, 120) : ""
    };
}

async function cfGetZoneDailySeries(env2, days = 7) {
    const token = getCFApiToken(env2);
    if (!token)
        return { error: "\u672A\u914D\u7F6E CF_API_TOKEN" };
    let info3;
    try {
        info3 = await resolveZoneInfo(env2);
    }
    catch (e) {
        return { error: String(e?.message || e) };
    }
    if (!info3.zoneId)
        return { error: info3.error || "\u672A\u89E3\u6790\u5230 CF_ZONE_ID" };
    const today = getShanghaiParts().dateKey;
    const startDate = new Date(( /* @__PURE__ */new Date(today + "T00:00:00Z")).getTime() - (days - 1) * 864e5).toISOString().slice(0, 10);
    const start = ( /* @__PURE__ */new Date(startDate + "T00:00:00+08:00")).toISOString();
    const end = new Date(( /* @__PURE__ */new Date(today + "T00:00:00+08:00")).getTime() + 864e5 - 1).toISOString();
    const statsHost = getStatsHost(env2);
    const buildQuery = /* @__PURE__ */ (hostFilter) => {
        const hostPart = hostFilter ? `, clientRequestHTTPHost: ${toGraphQLStr(hostFilter)}` : "";
        return `query { viewer { zones(filter: { zoneTag: ${toGraphQLStr(info3.zoneId)} }) { series: httpRequestsAdaptiveGroups(limit: 10000, filter: { datetime_geq: ${toGraphQLStr(start)}, datetime_leq: ${toGraphQLStr(end)}${hostPart} }) { count dimensions { datetimeHour clientRequestHTTPHost } sum { edgeResponseBytes visits } } } } }`;
    };
    let rows = null;
    let hostFilterUsed = false;
    if (statsHost) {
        try {
            const zone = await cfFetchGraphql(token, buildQuery(statsHost));
            const r = zone?.data?.viewer?.zones?.[0]?.series;
            if (Array.isArray(r)) {
                rows = r;
                hostFilterUsed = true;
            }
        }
        catch (_) {
        }
    }
    if (!hostFilterUsed) {
        try {
            const zone = await cfFetchGraphql(token, buildQuery(""));
            const r = zone?.data?.viewer?.zones?.[0]?.series;
            if (Array.isArray(r))
                rows = r;
        }
        catch (e) {
            return { error: String(e?.message || e).slice(0, 200) };
        }
    }
    if (!Array.isArray(rows))
        return { error: "CF \u672A\u8FD4\u56DE\u6570\u636E" };
    const map = /* @__PURE__ */ new Map();
    let hostMatched = hostFilterUsed;
    for (const item of rows) {
        const h = String(item?.dimensions?.clientRequestHTTPHost || "").toLowerCase();
        if (statsHost && h !== statsHost)
            continue;
        hostMatched = true;
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
    if (statsHost && !hostMatched)
        return { error: "CF \u4E2D\u672A\u627E\u5230 " + statsHost + " \u7684\u6570\u636E", series: [] };
    const series = [];
    for (let i = 0; i < days; i++) {
        const key = new Date(( /* @__PURE__ */new Date(startDate + "T00:00:00Z")).getTime() + i * 864e5).toISOString().slice(0, 10);
        const r = map.get(key) || { requests: 0, traffic: 0, visits: 0 };
        series.push({ date: key, requests: r.requests, traffic: r.traffic, visits: r.visits });
    }
    return { series, zoneId: info3.zoneId, zoneName: info3.zoneName, statsHost, hostMatched };
}

async function cfGetAccountSummary(env2, dateKey, hostSet = null) {
    const token = getCFApiToken(env2);
    if (!token)
        return { error: "\u672A\u914D\u7F6E CF_API_TOKEN" };
    let info3;
    try {
        info3 = await resolveZoneInfo(env2);
    }
    catch (e) {
        return { error: String(e?.message || e) };
    }
    if (!info3.accountId)
        return { error: "\u672A\u89E3\u6790\u5230 CF_ACCOUNT_ID\uFF08Token \u9700 Account Analytics:Read\uFF09" };
    const { start, end } = dayRangeIso(dateKey);
    let account = null;
    let hostDim = true;
    let firstError = "";
    try {
        account = await cfGetAccountHttp(info3.accountId, token, start, end, true);
    }
    catch (e) {
        firstError = String(e?.message || e);
        hostDim = false;
        try {
            account = await cfGetAccountHttp(info3.accountId, token, start, end, false);
        }
        catch (e2) {
            return { error: String(e2?.message || e2).slice(0, 240) };
        }
    }
    if (!account?.series)
        return { error: "\u8D26\u53F7\u5206\u6790\u672A\u8FD4\u56DE\u6570\u636E\uFF08Token \u9700 Account Analytics:Read \u6743\u9650\uFF09" };
    if (hostDim && account.series.length >= 1e4) {
        try {
            const plain = await cfGetAccountHttp(info3.accountId, token, start, end, false);
            if (Array.isArray(plain?.series)) {
                account = plain;
                hostDim = false;
            }
        }
        catch (_) {
        }
    }
    const statsHost = getStatsHost(env2);
    const wanted = hostSet && hostSet.size ? makeHostMatcher(env2, hostSet) : null;
    let hostMatched = Boolean(hostDim && wanted);
    let rows = hostDim && wanted ? account.series.filter((it) => wanted(it?.dimensions?.clientRequestHTTPHost)) : account.series;
    if (hostDim && wanted && rows.length === 0) {
        hostMatched = false;
        rows = account.series;
    }
    const sumRows = /* @__PURE__ */ (list) => {
        let requests = 0, visits = 0, bytes = 0;
        const hourly = Array.from({ length: 24 }, () => 0);
        const byHost = {};
        for (const item of list) {
            const n = Number(item?.count) || 0;
            const b = Number(item?.sum?.edgeResponseBytes) || 0;
            requests += n;
            visits += Number(item?.sum?.visits) || 0;
            bytes += b;
            const hHost = String(item?.dimensions?.clientRequestHTTPHost || "").toLowerCase();
            if (hHost) {
                const cur = byHost[hHost] || { requests: 0, bytes: 0, visits: 0 };
                cur.requests += n;
                cur.bytes += b;
                cur.visits += Number(item?.sum?.visits) || 0;
                byHost[hHost] = cur;
            }
            const raw = item?.dimensions?.datetimeHour;
            if (raw) {
                const h = (new Date(raw).getUTCHours() + 8) % 24;
                if (h >= 0 && h < 24)
                    hourly[h] += n;
            }
        }
        return { requests, visits, bytes, hourly, byHost };
    };
    const total = sumRows(rows);
    const mainRows = hostDim && statsHost ? account.series.filter((it) => String(it?.dimensions?.clientRequestHTTPHost || "").toLowerCase().replace(/:\d+$/, "") === statsHost) : rows;
    const main = sumRows(mainRows);
    return {
        requests: total.requests,
        visits: total.visits,
        bytes: total.bytes,
        hourly: total.hourly,
        byHost: total.byHost,
        mainRequests: main.requests,
        mainVisits: main.visits,
        mainBytes: main.bytes,
        accountId: info3.accountId,
        statsHost,
        hostMatched,
        hostDim,
        source: "account",
        note: hostMatched ? "" : "\u8D26\u53F7\u5206\u6790\u4E2D\u672A\u5339\u914D\u5230 Worker \u57DF\u540D\uFF0C\u5F53\u524D\u4F7F\u7528\u8D26\u53F7\u603B\u91CF",
        warning: firstError ? "\u6309\u57DF\u540D\u5206\u7EC4\u67E5\u8BE2\u5931\u8D25\uFF0C\u5DF2\u9000\u56DE\u8D26\u53F7\u6C47\u603B: " + firstError.slice(0, 120) : ""
    };
}

async function cfGetAccountDailySeries(env2, days = 7, hostSet = null) {
    const token = getCFApiToken(env2);
    if (!token)
        return { error: "\u672A\u914D\u7F6E CF_API_TOKEN" };
    let info3;
    try {
        info3 = await resolveZoneInfo(env2);
    }
    catch (e) {
        return { error: String(e?.message || e) };
    }
    if (!info3.accountId)
        return { error: "\u672A\u89E3\u6790\u5230 CF_ACCOUNT_ID" };
    const today = getShanghaiParts().dateKey;
    const startDate = new Date(( /* @__PURE__ */new Date(today + "T00:00:00Z")).getTime() - (days - 1) * 864e5).toISOString().slice(0, 10);
    const start = ( /* @__PURE__ */new Date(startDate + "T00:00:00+08:00")).toISOString();
    const end = new Date(( /* @__PURE__ */new Date(today + "T00:00:00+08:00")).getTime() + 864e5 - 1).toISOString();
    let rows = null;
    let truncated = false;
    try {
        const acc = await cfGetAccountHttp(info3.accountId, token, start, end, true);
        rows = Array.isArray(acc?.series) ? acc.series : null;
        truncated = Boolean(rows && rows.length >= 1e4);
    }
    catch (_) {
    }
    if (!Array.isArray(rows) || truncated) {
        try {
            const acc = await cfGetAccountHttp(info3.accountId, token, start, end, false);
            rows = Array.isArray(acc?.series) ? acc.series : null;
        }
        catch (e) {
            return { error: String(e?.message || e).slice(0, 200) };
        }
    }
    if (!Array.isArray(rows))
        return { error: "\u8D26\u53F7\u5206\u6790\u672A\u8FD4\u56DE\u6570\u636E" };
    const wanted = hostSet && hostSet.size ? makeHostMatcher(env2, hostSet) : null;
    const map = /* @__PURE__ */ new Map();
    for (const item of rows) {
        const h = String(item?.dimensions?.clientRequestHTTPHost || "").toLowerCase();
        if (wanted && h && !wanted(h))
            continue;
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
    return { series, accountId: info3.accountId, source: "account" };
}

async function cfGetWorkerSummary(env2, dateKey) {
    const token = getCFApiToken(env2);
    if (!token)
        return { error: "\u672A\u914D\u7F6E CF_API_TOKEN" };
    let info3;
    try {
        info3 = await resolveZoneInfo(env2);
    }
    catch (e) {
        return { error: String(e?.message || e) };
    }
    if (!info3.accountId)
        return { error: "\u672A\u89E3\u6790\u5230 CF_ACCOUNT_ID\uFF08Token \u9700 Account Analytics:Read\uFF09" };
    const { start, end } = dayRangeIso(dateKey);
    try {
        const account = await cfGetWorkerRequests(info3.accountId, token, start, end);
        if (!account?.workersInvocationsAdaptive)
            return { error: "CF \u672A\u8FD4\u56DE Worker \u8C03\u7528\u6570\u636E" };
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
    const workerHosts = await getWorkerHosts(env2);
    const acc = await cfGetAccountSummary(env2, key, workerHosts);
    const accOk = !acc.error;
    const cf = accOk ? { error: "" } : await cfGetZoneSummary(env2, key, workerHosts);
    const cfOk = !accOk && !cf.error;
    const requests = accOk ? Number(acc.requests) || 0 : cfOk ? Number(cf.requests) || 0 : null;
    const traffic = accOk ? Number(acc.bytes) || 0 : cfOk ? Number(cf.bytes) || 0 : null;
    const visits = accOk ? Number(acc.visits) || 0 : cfOk ? Number(cf.visits) || 0 : 0;
    let daily = [];
    if (accOk) {
        const s = await cfGetAccountDailySeries(env2, 7, workerHosts);
        if (!s.error && Array.isArray(s.series))
            daily = s.series;
    }
    else if (cfOk) {
        const zs = await cfGetZoneDailySeries(env2, 7);
        if (!zs.error && Array.isArray(zs.series))
            daily = zs.series;
    }
    const lines = [];
    lines.push("\u{1F4CA} <b>Emby Proxy \u65E5\u62A5</b>");
    const host = getStatsHost(env2);
    const dom = getUserDomain(env2) || host || "";
    lines.push("<code>\u6574\u4E2A\u57DF\u540D\uFF08" + tgEscape(dom || "\u5168\u7AD9") + "\uFF09</code>");
    lines.push("<code>" + tgEscape(key) + "</code>");
    lines.push("");
    lines.push("\u8BF7\u6C42\u6570\uFF1A" + (requests == null ? "\uFF08CF \u6570\u636E\u4E0D\u53EF\u7528\uFF09" : "<b>" + requests + "</b>"));
    lines.push("\u51FA\u7AD9\u6D41\u91CF\uFF1A" + (traffic == null ? "\uFF08CF \u6570\u636E\u4E0D\u53EF\u7528\uFF09" : "<b>" + formatBytes(traffic) + "</b>"));
    if (accOk || cfOk)
        lines.push("CF \u8BBF\u95EE\u91CF\uFF1A<b>" + visits + "</b>");
    if (host) {
        if (accOk && acc.hostDim) {
            lines.push("\u5176\u4E2D " + tgEscape(host) + "\uFF1A" + (Number(acc.mainRequests) || 0) + " \u6B21 / " + formatBytes(Number(acc.mainBytes) || 0));
        }
        else if (cfOk && cf.hostDim) {
            lines.push("\u5176\u4E2D " + tgEscape(host) + "\uFF1A" + (Number(cf.mainRequests) || 0) + " \u6B21 / " + formatBytes(Number(cf.mainBytes) || 0));
        }
    }
    if (daily.length) {
        lines.push("");
        lines.push("<b>\u8FD1 7 \u65E5\uFF08\u5168\u7AD9\uFF09</b>");
        for (const d of daily) {
            lines.push(d.date + "  " + d.requests + " \u6B21 / " + formatBytes(d.traffic));
        }
    }
    if (!accOk) {
        lines.push("");
        lines.push("<i>\u8D26\u53F7\u5206\u6790\u4E0D\u53EF\u7528\uFF0C\u5DF2\u9000\u56DE " + (cfOk ? "Zone \u7EDF\u8BA1" : "\uFF08\u65E0 CF \u6570\u636E\uFF09") + "\uFF1A" + tgEscape(String(acc.error).slice(0, 160)) + "</i>");
    }
    else if (acc.hostMatched === false) {
        lines.push("");
        lines.push("<i>\u8D26\u53F7\u5206\u6790\u4E2D\u672A\u5339\u914D\u5230 Worker \u57DF\u540D\uFF0C\u5F53\u524D\u4E3A\u8D26\u53F7\u603B\u91CF</i>");
    }
    lines.push("");
    lines.push("<i>" + tgEscape(( /* @__PURE__ */new Date()).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })) + "</i>");
    const githubUrl = envStr(env2, "GITHUB_URL", "GITHUB_REPO") || "https://github.com/Dirige/EMBY_CF";
    const monitorUrl = envStr(env2, "MONITOR_URL") || "https://yx.255432.xyz/";
    lines.push("");
    lines.push('\u{1F517} GitHub\uFF1A<a href="' + githubUrl + '">' + tgEscape(githubUrl) + "</a>");
    lines.push('\u{1F4C8} \u4F18\u9009\u57DF\u540D\u76D1\u63A7\uFF1A<a href="' + monitorUrl + '">' + tgEscape(monitorUrl) + "</a>");
    return lines.join("\n");
}

async function sendDailyReport(env2, dateKey) {
    const key = /^\d{4}-\d{2}-\d{2}$/.test(dateKey || "") ? dateKey : getShanghaiParts().dateKey;
    const text = await buildDailyReport(env2, key);
    const tg = await sendTelegramMessage(env2, text);
    let webhook = { ok: false, skipped: true };
    if (env2.NOTIFY_WEBHOOK && isValidHttpUrl(env2.NOTIFY_WEBHOOK)) {
        try {
            const res = await fetch(env2.NOTIFY_WEBHOOK, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text, content: text, date: key })
            });
            webhook = { ok: res.ok, status: res.status };
        }
        catch (e) {
            webhook = { ok: false, error: String(e?.message || e) };
        }
    }
    return { ok: tg.ok || webhook.ok, telegram: tg, webhook, date: key, text };
}

var statsBuffer = /* @__PURE__ */ new Map();

var routeStatsBuffer = /* @__PURE__ */ new Map();

var userStatsBuffer = /* @__PURE__ */ new Map();

var statsBufferCount = 0;

export function clearStatsBuffers() {
    statsBuffer.clear();
    routeStatsBuffer.clear();
    userStatsBuffer.clear();
    statsBufferCount = 0;
}

var statsLastFlush = Date.now();

export { cfGetAccountHttp, workerHostCache, getWorkerHosts, makeHostMatcher, cfGetZoneSummary, cfGetZoneDailySeries, cfGetAccountSummary, cfGetAccountDailySeries, cfGetWorkerSummary, buildDailyReport, sendDailyReport, statsBuffer, routeStatsBuffer, userStatsBuffer, statsBufferCount, statsLastFlush };
