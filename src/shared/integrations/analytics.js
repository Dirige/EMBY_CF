// Baseline: 4e0357e. Edition-specific behavior is intentionally retained.
import { toGraphQLStr } from "./../http/primitives.js";
import { getTelegramChatId, getTelegramToken } from "./../auth/session.js";

async function cfFetchGraphql(apiToken, query) {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 12e3);
    try {
        const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
            method: "POST",
            headers: { "Authorization": `Bearer ${apiToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({ query }),
            signal: ctrl.signal
        });
        if (!res.ok)
            throw new Error(`cf_http_${res.status}`);
        const data = await res.json();
        if (Array.isArray(data?.errors) && data.errors.length)
            throw new Error(data.errors.map((e) => e?.message).filter(Boolean).join("; ") || "cf_graphql_error");
        return data;
    }
    finally {
        clearTimeout(tid);
    }
}

async function cfGetZoneAnalytics(cfZoneId, cfApiToken, startIso, endIso, useHostDim = true) {
    const dims = useHostDim ? "datetimeHour clientRequestHTTPHost" : "datetimeHour";
    const query = `query { viewer { zones(filter: { zoneTag: ${toGraphQLStr(cfZoneId)} }) { series: httpRequestsAdaptiveGroups(limit: 10000, filter: { datetime_geq: ${toGraphQLStr(startIso)}, datetime_leq: ${toGraphQLStr(endIso)} }) { count dimensions { ${dims} } sum { edgeResponseBytes visits } } } } }`;
    const data = await cfFetchGraphql(cfApiToken, query);
    return data?.data?.viewer?.zones?.[0] || null;
}

async function cfGetWorkerRequests(cfAccountId, cfApiToken, startIso, endIso) {
    const query = `query { viewer { accounts(filter: { accountTag: ${toGraphQLStr(cfAccountId)} }) { workersInvocationsAdaptive(limit: 10000, filter: { datetime_geq: ${toGraphQLStr(startIso)}, datetime_leq: ${toGraphQLStr(endIso)} }) { dimensions { datetime scriptName status } sum { requests } } } } }`;
    const data = await cfFetchGraphql(cfApiToken, query);
    return data?.data?.viewer?.accounts?.[0] || null;
}

function dayRangeIso(dateKey) {
    const start = ( /* @__PURE__ */new Date(dateKey + "T00:00:00+08:00")).getTime();
    return { start: new Date(start).toISOString(), end: new Date(start + 864e5 - 1).toISOString() };
}

function tgEscape(v) {
    return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function describeTelegramError(raw) {
    const msg = String(raw == null ? "" : raw).trim();
    const low = msg.toLowerCase();
    if (!msg)
        return "未知错误";
    if (low.includes("chat not found")) {
        return msg + "（机器人找不到该会话：请先用 Telegram 打开这个机器人并点「开始」或发送 /start，再确认 TELEGRAM_CHAT_ID 填的是该账号的数字 ID，而不是手机号/用户名）";
    }
    if (low.includes("bot was blocked"))
        return msg + "（该账号把机器人拉黑/屏蔽了，请在 Telegram 中解除屏蔽后重新发送 /start）";
    if (low.includes("user is deactivated"))
        return msg + "（该 Telegram 账号已注销）";
    if (low.includes("not enough rights") || low.includes("chat_write_forbidden"))
        return msg + "（机器人不在该群组，或没有发言权限）";
    if (low.includes("unauthorized") || low.includes("invalid token"))
        return msg + "（TELEGRAM_BOT_TOKEN 无效，请到 BotFather 重新复制 Token）";
    if (low.includes("too many requests"))
        return msg + "（发送过于频繁，请稍后再试）";
    if (low.includes("button_url_invalid") || low.includes("can't parse entities"))
        return msg + "（消息内容格式错误）";
    return msg;
}

async function sendTelegramMessage(env2, text) {
    const token = getTelegramToken(env2);
    const chatId = getTelegramChatId(env2);
    if (!token || !chatId) {
        return { ok: false, error: "未配置 TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID（或 TG_BOT_TOKEN / TG_CHAT_ID）", rawError: "not configured" };
    }
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 15e3);
    try {
        const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, text: String(text).slice(0, 4096), parse_mode: "HTML", disable_web_page_preview: true }),
            signal: ctrl.signal
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.ok === false) {
            const raw = data.description || "HTTP " + res.status;
            return { ok: false, error: describeTelegramError(raw), rawError: raw };
        }
        return { ok: true };
    }
    catch (e) {
        const raw = String(e?.message || e);
        return { ok: false, error: raw, rawError: raw };
    }
    finally {
        clearTimeout(tid);
    }
}

function reportFailureHint(env2, out) {
    const tg = out.telegram || {};
    const wh = out.webhook || {};
    const tgConfigured = Boolean(getTelegramToken(env2) && getTelegramChatId(env2));
    if (tg.error) {
        return tgConfigured ? "Telegram 变量已读取，但发送失败：" + tg.error : "未配置 Telegram 变量：请设置 TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID（或 TG_BOT_TOKEN / TG_CHAT_ID）";
    }
    if (wh.error)
        return "Webhook 发送失败：" + wh.error;
    if (wh.skipped && !tg.ok)
        return "未配置通知渠道：请设置 TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID（或 TG_*），或 NOTIFY_WEBHOOK";
    return "发送失败：未知错误";
}

async function claimReportSlot(env2, dateKey) {
    if (!env2.DB)
        return false;
    try {
        const r = await env2.DB.prepare(`INSERT INTO settings (key, value) VALUES ('last_report_date', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value WHERE settings.value <> excluded.value`).bind(dateKey).run();
        return Boolean(r.meta && r.meta.changes);
    }
    catch (_) {
        return false;
    }
}

export { cfFetchGraphql, cfGetZoneAnalytics, cfGetWorkerRequests, dayRangeIso, tgEscape, describeTelegramError, sendTelegramMessage, reportFailureHint, claimReportSlot };
