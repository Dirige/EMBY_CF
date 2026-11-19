// Baseline: 4e0357e. Edition-specific behavior is intentionally retained.
import { splitTargets } from "./../../shared/admin/api.js";
import { probeTarget } from "./../../shared/http/validation.js";
import { notify } from "./../../shared/integrations/notifications.js";
import { initDatabase } from "./storage/schema.js";
import { getSettings } from "./config/settings.js";
import { getShanghaiParts } from "./../../shared/http/primitives.js";
import { claimReportSlot } from "./../../shared/integrations/analytics.js";
import { sendDailyReport } from "./integrations/analytics.js";

async function runHealthCheck(env2, manual = false) {
    if (!env2.DB)
        return { checked: 0, alerts: [] };
    const { results: routes } = await env2.DB.prepare("SELECT prefix, target, remark FROM routes WHERE enabled != 0").all();
    let userRoutes = [];
    try {
        const res = await env2.DB.prepare("SELECT owner, prefix, target, remark FROM user_routes WHERE enabled != 0").all();
        userRoutes = (res.results || []).map((r) => ({
            prefix: r.owner + "/" + r.prefix,
            target: r.target,
            remark: (r.remark ? r.remark + " " : "") + "(@" + r.owner + ")"
        }));
    }
    catch (_) {
    }
    const { results: states } = await env2.DB.prepare("SELECT * FROM route_health").all();
    const stateMap = new Map((states || []).map((r) => [r.prefix + "|" + r.target, r]));
    const jobs = [];
    for (const r of [...routes || [], ...userRoutes]) {
        for (const t of splitTargets(r.target))
            jobs.push({ r, t });
    }
    const limited = jobs.slice(0, 40);
    const probes = await Promise.all(limited.map(async (j) => ({ ...j, res: await probeTarget(j.t) })));
    const nowIso = ( /* @__PURE__ */new Date()).toISOString();
    const stmts = [];
    const alerts = [];
    for (const { r, t, res } of probes) {
        const prev = stateMap.get(r.prefix + "|" + t);
        const fail = res.ok ? 0 : (prev?.fail_count || 0) + 1;
        const down = res.ok ? 0 : fail >= 2 ? 1 : prev?.down || 0;
        const changed = (prev?.down || 0) !== down;
        if (changed)
            alerts.push(`${down ? "\u{1F534} \u7EBF\u8DEF\u5F02\u5E38" : "\u{1F7E2} \u7EBF\u8DEF\u6062\u590D"}\uFF1A/${r.prefix}${r.remark ? "\uFF08" + r.remark + "\uFF09" : ""}
${t}${res.ok ? "" : "\n" + (res.error || "HTTP " + res.status)}`);
        stmts.push(env2.DB.prepare(`INSERT INTO route_health (prefix, target, down, fail_count, latency, last_check, last_change) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(prefix, target) DO UPDATE SET down = excluded.down, fail_count = excluded.fail_count, latency = excluded.latency,
         last_check = excluded.last_check, last_change = CASE WHEN route_health.down != excluded.down THEN excluded.last_check ELSE route_health.last_change END`).bind(r.prefix, t, down, fail, res.ms, nowIso, nowIso));
    }
    if (stmts.length)
        await env2.DB.batch(stmts);
    if (alerts.length)
        await notify(env2, alerts.join("\n\n"));
    return { checked: probes.length, alerts };
}

async function runScheduled(env2) {
    if (!env2.DB)
        return;
    await initDatabase(env2);
    const st = await getSettings(env2);
    if (st.healthCheck) {
        try {
            await runHealthCheck(env2);
        }
        catch (_) {
        }
    }
    const now = getShanghaiParts();
    const reportEnabled = String(st.raw.tg_daily_report ?? "1") !== "0";
    if (reportEnabled && now.hour === 23) {
        try {
            if (await claimReportSlot(env2, now.dateKey))
                await sendDailyReport(env2, now.dateKey);
        }
        catch (_) {
        }
    }
}

export { runHealthCheck, runScheduled };
